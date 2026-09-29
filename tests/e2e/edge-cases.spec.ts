import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { OWNER, createFolder, ownerApi, removeFolder, signIn, unique, uploadText } from './helpers'

let owner: APIRequestContext
let folder: { id: string, name: string }

test.beforeAll(async () => {
  owner = await ownerApi()
  folder = await createFolder(owner, unique('edge'))
})

test.afterAll(async () => {
  await removeFolder(owner, folder.id)
})

async function openFolder(page: Page) {
  await signIn(page, OWNER.email, OWNER.password)
  await page.goto(`/drive/folder/${folder.id}`)
  await page.waitForLoadState('networkidle')
}

const overflows = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate(el => el.scrollWidth > el.clientWidth + 1)

test('very long names stay on one line without breaking the layout', async ({ page }) => {
  const name = `${'Compte rendu de la réunion annuelle du conseil '.repeat(4).trim()}.pdf`
  await uploadText(owner, folder.id, name, '%PDF-1.4')
  await openFolder(page)
  const row = page.getByRole('row', { name: /Compte rendu de la réunion/ })
  await expect(row).toBeVisible()
  expect(await row.evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(56)
  expect(await overflows(page, 'main')).toBe(false)
  await expect(row.locator('[title]').first()).toHaveAttribute('title', name)
})

test('a file without extension falls back to download', async ({ page }) => {
  await uploadText(owner, folder.id, 'Makefile', 'all:\n\techo ok')
  await openFolder(page)
  await page.getByRole('row', { name: /Makefile/ }).dblclick()
  await expect(page.getByText('Ce fichier ne peut pas être prévisualisé')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Télécharger' }).last()).toBeVisible()
})

test('very long email addresses do not overflow the share dialog', async ({ page }) => {
  const file = await uploadText(owner, folder.id, `${unique('partage')}.txt`, 'x')
  const email = `${'prenom.nom.tres.long.pour.tester'.repeat(2)}@${'sous-domaine.'.repeat(3)}example.com`
  await owner.post(`/api/resources/${file.id}/access`, { data: { email, notify: false } })
  await openFolder(page)
  await page.getByRole('row', { name: new RegExp(file.name) }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Partager' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(email)).toBeVisible()
  expect(await dialog.evaluate(el => el.scrollWidth > el.clientWidth + 1)).toBe(false)
})

test('a temporary loss of network is reported, then recovers', async ({ page, context }) => {
  const file = await uploadText(owner, folder.id, `${unique('reseau')}.txt`, 'x')
  await openFolder(page)
  await context.setOffline(true)
  await page.getByRole('row', { name: new RegExp(file.name) }).click()
  await page.keyboard.press('s')
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: /hors ligne|réessayez/i }).first()).toBeVisible()
  await context.setOffline(false)
  await page.keyboard.press('s')
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: /ajouté aux favoris/ }).first()).toBeVisible()
})

test('a double click on create makes a single folder', async ({ page }) => {
  await openFolder(page)
  await page.getByRole('button', { name: 'Nouveau', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Nouveau dossier' }).click()
  const name = unique('Double')
  await page.getByLabel('Nom du dossier').fill(name)
  await page.getByRole('button', { name: 'Créer' }).dblclick()
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible()
  await page.waitForTimeout(800)
  await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(1)
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: /existe déjà/ })).toHaveCount(0)
})

test('reloading during a preview brings the same preview back', async ({ page }) => {
  const file = await uploadText(owner, folder.id, `${unique('apercu')}.txt`, 'Contenu du fichier')
  await openFolder(page)
  await page.getByRole('row', { name: new RegExp(file.name) }).dblclick()
  await expect(page.getByText('Contenu du fichier')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Contenu du fichier')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Contenu du fichier')).toBeHidden()
  await expect(page).toHaveURL(new RegExp(`/drive/folder/${folder.id}$`))
})

test('a failed upload shows a clear error and can be retried', async ({ page }) => {
  await openFolder(page)
  let failures = 1
  await page.route('**/api/uploads?**', async (route) => {
    if (failures-- > 0) return route.fulfill({ status: 413, contentType: 'application/json', body: '{"statusCode":413,"statusMessage":"Fichier trop volumineux"}' })
    return route.continue()
  })
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'rapport-final.txt', mimeType: 'text/plain', buffer: Buffer.from('ok') })
  const queue = page.getByRole('region', { name: 'Imports' })
  await expect(queue.getByText('Fichier trop volumineux')).toBeVisible()
  await queue.getByRole('button', { name: 'Réessayer rapport-final.txt' }).click()
  await expect(page.getByRole('row', { name: /rapport-final\.txt/ })).toBeVisible()
})

test('a dropped connection is retried on its own, without an error', async ({ page }) => {
  await openFolder(page)
  let drops = 2
  await page.route('**/api/uploads?**', route => drops-- > 0 ? route.abort('connectionreset') : route.continue())
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'coupure.txt', mimeType: 'text/plain', buffer: Buffer.from('ok') })
  await expect(page.getByRole('row', { name: /coupure\.txt/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('region', { name: 'Imports' }).getByText('Connexion interrompue')).toHaveCount(0)
})

test('a connection cut after the file was stored does not create a duplicate', async ({ page }) => {
  await openFolder(page)
  let cut = false
  await page.route('**/api/uploads?**', async (route) => {
    if (cut) return route.continue()
    cut = true
    await route.fetch()
    await route.abort('connectionreset')
  })
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'une-seule-fois.txt', mimeType: 'text/plain', buffer: Buffer.from('une fois') })
  await expect(page.getByRole('row', { name: /une-seule-fois/ })).toBeVisible({ timeout: 15_000 })
  const { items } = await (await owner.get(`/api/folders/${folder.id}`)).json()
  expect(items.filter((item: { name: string }) => item.name.startsWith('une-seule-fois'))).toHaveLength(1)
})

test('files dropped on a folder list are imported once, system files left out', async ({ page }) => {
  await uploadText(owner, folder.id, 'cible.txt', 'cible')
  await openFolder(page)
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File(['déposé'], 'depose-une-fois.txt', { type: 'text/plain' }))
    data.items.add(new File(['mac'], '.DS_Store'))
    return data
  })
  const row = page.getByRole('row', { name: /cible\.txt/ })
  await row.dispatchEvent('dragenter', { dataTransfer: transfer })
  await row.dispatchEvent('dragover', { dataTransfer: transfer })
  await row.dispatchEvent('drop', { dataTransfer: transfer })
  await expect(page.getByRole('row', { name: /depose-une-fois\.txt/ })).toBeVisible()
  await page.waitForTimeout(1500)
  const { items } = await (await owner.get(`/api/folders/${folder.id}`)).json()
  expect(items.filter((item: { name: string }) => item.name.startsWith('depose-une-fois'))).toHaveLength(1)
  expect(items.some((item: { name: string }) => item.name === '.DS_Store')).toBe(false)
})

import { expect, test } from '@playwright/test'
import { OWNER, createReader, ownerApi, removeFolder, signIn, unique } from './helpers'

let cleanup: () => Promise<void> = async () => {}
test.afterEach(() => cleanup())

test('owner: folder, upload, move, share, activity, trash and restore', async ({ page, browser }) => {
  const owner = await ownerApi()
  const reader = await createReader(owner, 'Paul E2E')
  const folderName = unique('Projet')
  cleanup = async () => {
    const { items } = await (await owner.get('/api/folders/root')).json()
    const folder = items.find((item: { name: string }) => item.name === folderName)
    if (folder) await removeFolder(owner, folder.id)
    const { items: trashed } = await (await owner.get('/api/trash')).json()
    for (const item of trashed.filter((i: { location?: string }) => i.location?.includes(folderName))) await owner.delete(`/api/resources/${item.id}`)
    await owner.delete(`/api/people/${reader.id}`)
  }

  await signIn(page, OWNER.email, OWNER.password)
  await page.goto('/drive')

  await page.getByRole('button', { name: 'Nouveau', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Nouveau dossier' }).click()
  await page.getByLabel('Nom du dossier').fill(folderName)
  await page.getByRole('button', { name: 'Créer' }).click()
  const folderRow = page.getByRole('row', { name: new RegExp(folderName) })
  await expect(folderRow).toBeVisible()
  await folderRow.dblclick()
  await expect(page.getByRole('heading', { name: /vide/ })).toBeVisible()
  const folderUrl = page.url()

  await page.getByRole('button', { name: 'Nouveau dossier' }).click()
  await page.getByLabel('Nom du dossier').fill('Archives')
  await page.getByRole('button', { name: 'Créer' }).click()

  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'rapport.txt', mimeType: 'text/plain', buffer: Buffer.from('Bonjour Paul') })
  const fileRow = page.getByRole('row', { name: /rapport\.txt/ })
  await expect(fileRow).toBeVisible()
  await expect(page.getByText(/1 fichier importé/).first()).toBeVisible()

  await fileRow.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Déplacer', exact: true }).click()
  await page.getByRole('option', { name: /Archives/ }).dblclick()
  await page.getByRole('button', { name: 'Déplacer ici' }).click()
  await expect(page.getByText('rapport.txt déplacé vers Archives')).toBeVisible()
  await expect(fileRow).toBeHidden()

  await page.getByRole('row', { name: /Archives/ }).dblclick()
  await page.getByRole('row', { name: /rapport\.txt/ }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Partager' }).click()
  await page.getByLabel('Adresse email de la personne').fill(reader.email)
  await page.getByLabel('Adresse email de la personne').press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Paul E2E')).toBeVisible()
  await dialog.getByRole('button', { name: 'Terminé' }).click()

  const readerContext = await browser.newContext()
  const readerPage = await readerContext.newPage()
  await signIn(readerPage, reader.email, reader.password)
  await expect(readerPage.getByRole('row', { name: /rapport\.txt/ })).toBeVisible()
  await readerPage.getByRole('row', { name: /rapport\.txt/ }).dblclick()
  await expect(readerPage.getByText('Bonjour Paul')).toBeVisible()
  await readerContext.close()

  await page.getByRole('row', { name: /rapport\.txt/ }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Activité' }).click()
  const details = page.getByRole('complementary', { name: 'Détails' })
  await expect(details.getByText(/Paul E2E/).first()).toBeVisible()
  await expect(details.getByText('a consulté')).toBeVisible()

  await page.getByRole('row', { name: /rapport\.txt/ }).click()
  await page.keyboard.press('Delete')
  const trashToast = page.locator('[data-sonner-toast]', { hasText: 'rapport.txt déplacé vers la corbeille' })
  await expect(trashToast).toBeVisible()
  await trashToast.getByRole('button', { name: 'Annuler' }).click()
  await expect(page.getByRole('row', { name: /rapport\.txt/ })).toBeVisible()

  await page.getByRole('row', { name: /rapport\.txt/ }).click()
  await page.keyboard.press('Delete')
  await expect(page.getByRole('row', { name: /rapport\.txt/ })).toBeHidden()
  await page.getByRole('link', { name: 'Corbeille' }).click()
  await page.getByRole('row', { name: new RegExp(`rapport\\.txt.*${folderName}`) }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Restaurer' }).click()
  await expect(page.getByText(/rapport\.txt restauré/)).toBeVisible()

  await page.goto(folderUrl)
  await page.getByRole('row', { name: /Archives/ }).dblclick()
  await expect(page.getByRole('row', { name: /rapport\.txt/ })).toBeVisible()
})

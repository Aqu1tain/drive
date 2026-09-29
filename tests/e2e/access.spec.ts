import { expect, test, type APIRequestContext } from '@playwright/test'
import { createFolder, createReader, ownerApi, removeFolder, signIn, unique, uploadText } from './helpers'

let owner: APIRequestContext
let root: { id: string, name: string }

test.beforeAll(async () => {
  owner = await ownerApi()
  root = await createFolder(owner, unique('e2e-access'))
})

test.afterAll(async () => {
  await removeFolder(owner, root.id)
})

test('authorized reader: sign in, see, preview, download', async ({ page }) => {
  const reader = await createReader(owner)
  const folder = await createFolder(owner, 'Dossier client', root.id)
  const file = await uploadText(owner, folder.id, 'devis.txt', 'Devis de 1 200 euros')
  await owner.post(`/api/resources/${folder.id}/access`, { data: { email: reader.email, notify: false } })

  await signIn(page, reader.email, reader.password)
  await expect(page).toHaveURL(/shared-with-me/)
  await page.getByRole('row', { name: /Dossier client/ }).dblclick()
  await page.getByRole('row', { name: /devis\.txt/ }).dblclick()
  await expect(page.getByText('Devis de 1 200 euros')).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Télécharger' }).click()
  expect((await download).suggestedFilename()).toBe('devis.txt')

  await owner.delete(`/api/people/${reader.id}`)
  expect(file.id).toBeTruthy()
})

test('forbidden reader: a known URL leads to an access denied page', async ({ page }) => {
  const reader = await createReader(owner)
  const secret = await uploadText(owner, root.id, 'secret.txt', 'Confidentiel')

  await signIn(page, reader.email, reader.password)
  await page.goto(`/open/${secret.id}`)
  await expect(page.getByText('Vous n’avez pas ou plus accès à cet élément.')).toBeVisible()
  await expect(page.getByText('Confidentiel')).toBeHidden()

  await page.goto(`/drive/folder/${root.id}`)
  await expect(page).toHaveURL(/shared-with-me/)

  const response = await page.request.get(`/api/resources/${secret.id}/content`)
  expect(response.status()).toBe(403)
  await owner.delete(`/api/people/${reader.id}`)
})

test('public link: the shared file is immediately visible', async ({ browser }) => {
  const file = await uploadText(owner, root.id, 'Programme.md', '# Programme du week-end\n\nDépart samedi à 9h.')
  const { link } = await (await owner.put(`/api/resources/${file.id}/link`, { data: { enabled: true } })).json()

  const visitor = await browser.newContext()
  const page = await visitor.newPage()
  await page.goto(link.url)
  await expect(page.getByRole('heading', { name: 'Programme', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Programme du week-end' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Télécharger' })).toBeVisible()
  await visitor.close()
})

test('expired link: access refused', async ({ browser }) => {
  const file = await uploadText(owner, root.id, 'ancien.txt', 'Contenu périmé')
  const expiresAt = new Date(Date.now() - 60_000).toISOString()
  const { link } = await (await owner.put(`/api/resources/${file.id}/link`, { data: { enabled: true, expiresAt } })).json()

  const visitor = await browser.newContext()
  const page = await visitor.newPage()
  await page.goto(link.url)
  await expect(page.getByText('Ce lien n’est plus actif')).toBeVisible()
  await expect(page.getByText('Contenu périmé')).toBeHidden()
  await visitor.close()
})

test('revocation: an open link stops working after a refresh', async ({ browser }) => {
  const file = await uploadText(owner, root.id, 'note.txt', 'Note visible')
  const { link } = await (await owner.put(`/api/resources/${file.id}/link`, { data: { enabled: true } })).json()

  const visitor = await browser.newContext()
  const page = await visitor.newPage()
  await page.goto(link.url)
  await expect(page.getByText('Note visible')).toBeVisible()

  await owner.put(`/api/resources/${file.id}/link`, { data: { enabled: false } })
  await page.reload()
  await expect(page.getByText('Lien introuvable')).toBeVisible()
  await expect(page.getByText('Note visible')).toBeHidden()
  await visitor.close()
})

test('public folder: everything downloads as one zip', async ({ browser }) => {
  const folder = await createFolder(owner, 'Documents du camp', root.id)
  await uploadText(owner, folder.id, 'programme.txt', 'Programme')
  await uploadText(owner, folder.id, 'infos.txt', 'Infos')
  const { link } = await (await owner.put(`/api/resources/${folder.id}/link`, { data: { enabled: true } })).json()

  const visitor = await browser.newContext()
  const page = await visitor.newPage()
  await page.goto(link.url)
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Tout télécharger' }).click()
  expect((await download).suggestedFilename()).toMatch(/\.zip$/)
  await visitor.close()
})

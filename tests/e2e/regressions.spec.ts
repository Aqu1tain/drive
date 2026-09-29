import { expect, test } from '@playwright/test'
import { OWNER, createFolder, ownerApi, removeFolder, signIn, unique, uploadText } from './helpers'

test('rename and trash work after visiting the home page', async ({ page }) => {
  const owner = await ownerApi()
  const folder = await createFolder(owner, unique('accueil'))
  await uploadText(owner, folder.id, 'brouillon.txt', 'Brouillon')

  await signIn(page, OWNER.email, OWNER.password)
  await expect(page).toHaveURL(/\/home/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Bonjour|Bonsoir/)
  await page.getByRole('complementary', { name: 'Navigation principale' }).getByRole('link', { name: 'Mon Drive' }).click()
  await page.getByRole('row', { name: new RegExp(folder.name) }).dblclick()

  await page.getByRole('row', { name: /brouillon\.txt/ }).click()
  await page.keyboard.press('F2')
  const rename = page.getByRole('dialog', { name: 'Renommer' })
  await rename.getByLabel('Nom').fill('version finale.txt')
  await rename.getByRole('button', { name: 'Renommer' }).click()
  await expect(rename).toBeHidden()
  await expect(page.getByRole('row', { name: /version finale\.txt/ })).toBeVisible()

  await page.getByRole('row', { name: /version finale\.txt/ }).click()
  await page.keyboard.press('Delete')
  await expect(page.getByText('version finale.txt déplacé vers la corbeille')).toBeVisible()
  await expect(page.getByRole('row', { name: /version finale\.txt/ })).toHaveCount(0)
  const { items } = await (await owner.get(`/api/folders/${folder.id}`)).json()
  expect(items).toEqual([])

  await removeFolder(owner, folder.id)
})

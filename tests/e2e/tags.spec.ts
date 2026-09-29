import { expect, test } from '@playwright/test'
import { OWNER, createFolder, ownerApi, removeFolder, signIn, unique, uploadText } from './helpers'

test('the owner labels files and finds them from the sidebar', async ({ page }) => {
  const owner = await ownerApi()
  const folder = await createFolder(owner, unique('tags'))
  await uploadText(owner, folder.id, 'devis.txt', 'Devis')
  await uploadText(owner, folder.id, 'photo.txt', 'Photo')
  const name = unique('Client')

  await signIn(page, OWNER.email, OWNER.password)
  await page.goto(`/drive/folder/${folder.id}`)
  await page.getByRole('row', { name: /devis\.txt/ }).click()
  await page.keyboard.press('l')

  const dialog = page.getByRole('dialog', { name: 'Étiquettes' })
  await dialog.getByLabel('Nouvelle étiquette').fill(name)
  await dialog.getByRole('button', { name: 'Créer' }).click()
  await expect(dialog.getByRole('checkbox', { name })).toHaveAttribute('aria-checked', 'true')
  await dialog.getByRole('button', { name: 'Appliquer' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('row', { name: /devis\.txt/ })).toContainText(name)

  await page.getByRole('link', { name }).click()
  await expect(page.getByRole('heading', { name: `Étiquette « ${name} »` })).toBeVisible()
  await expect(page.getByRole('row', { name: /devis\.txt/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /photo\.txt/ })).toHaveCount(0)

  const { tags } = await (await owner.get('/api/tags')).json()
  await owner.delete(`/api/tags/${tags.find((tag: { name: string }) => tag.name === name).id}`)
  await removeFolder(owner, folder.id)
})

import { expect, test } from '@playwright/test'
import { OWNER, createFolder, ownerApi, removeFolder, signIn, unique, uploadText } from './helpers'

test('replacing a file in a versioned folder keeps the old one, and it can be restored', async ({ page }) => {
  const owner = await ownerApi()
  const folder = await createFolder(owner, unique('versions'))
  await owner.patch(`/api/resources/${folder.id}`, { data: { versioning: true } })
  const file = await uploadText(owner, folder.id, 'devis.txt', 'Premier jet')

  await signIn(page, OWNER.email, OWNER.password)
  await page.goto(`/drive/folder/${folder.id}`)
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'devis.txt', mimeType: 'text/plain', buffer: Buffer.from('Version finale') })
  const conflict = page.getByRole('dialog', { name: /devis\.txt/ })
  await expect(conflict.getByRole('radio', { name: /Remplacer/ })).toBeChecked()
  await expect(conflict.getByText(/historique des versions/)).toBeVisible()
  await conflict.getByRole('button', { name: 'Continuer' }).click()
  await expect.poll(async () => (await (await owner.get(`/api/resources/${file.id}/versions`)).json()).versions.length).toBe(1)

  await page.getByRole('row', { name: /devis\.txt/ }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Historique des versions' }).click()
  const panel = page.getByRole('tabpanel')
  await expect(panel.getByText('Version actuelle')).toBeVisible()
  await panel.getByRole('button', { name: /octets/ }).first().click()
  const preview = page.getByRole('dialog', { name: /devis\.txt, version du/ })
  await expect(preview.getByText('Premier jet')).toBeVisible()
  await preview.getByRole('button', { name: 'Restaurer' }).click()
  await page.getByRole('dialog', { name: 'Restaurer cette version ?' }).getByRole('button', { name: 'Restaurer' }).click()
  await expect(page.getByText('Version restaurée')).toBeVisible()
  expect(await (await owner.get(`/api/resources/${file.id}/content`)).text()).toBe('Premier jet')

  await removeFolder(owner, folder.id)
})

test('the folder menus turn version history on, and turning it off asks first', async ({ page }) => {
  const owner = await ownerApi()
  const parent = await createFolder(owner, unique('versions'))
  const name = unique('contrats')
  const folder = await createFolder(owner, name, parent.id)

  await signIn(page, OWNER.email, OWNER.password)
  await page.goto(`/drive/folder/${parent.id}`)
  await page.getByRole('row', { name: new RegExp(name) }).click({ button: 'right' })
  await page.getByRole('menuitemcheckbox', { name: 'Garder les versions précédentes' }).click()
  await expect(page.getByText(`Les versions précédentes sont maintenant gardées dans « ${name} »`)).toBeVisible()

  await page.goto(`/drive/folder/${folder.id}`)
  await expect(page.getByRole('button', { name: 'Versions gardées' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Fil d’Ariane' }).getByRole('button', { name }).click()
  const toggle = page.getByRole('menuitemcheckbox', { name: 'Garder les versions précédentes' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await page.getByRole('dialog', { name: /Désactiver l’historique des versions/ }).getByRole('button', { name: 'Désactiver' }).click()
  await expect(page.getByRole('button', { name: 'Versions gardées' })).toBeHidden()
  expect((await (await owner.get(`/api/resources/${folder.id}`)).json()).versioning.enabled).toBe(false)

  await removeFolder(owner, parent.id)
})

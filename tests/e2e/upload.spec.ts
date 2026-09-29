import { expect, test } from '@playwright/test'
import { OWNER, createFolder, ownerApi, removeFolder, signIn, unique } from './helpers'

test('large files upload in parts and survive a dropped connection', async ({ page }) => {
  const owner = await ownerApi()
  const folder = await createFolder(owner, unique('upload'))
  const size = 40 * 1024 * 1024
  let dropped = false
  await page.route('**/api/uploads/sessions/*/parts/2', async (route) => {
    if (dropped) return route.continue()
    dropped = true
    await route.abort('connectionreset')
  })

  await signIn(page, OWNER.email, OWNER.password)
  await page.goto(`/drive/folder/${folder.id}`)
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'grand-fichier.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(size, 7) })

  await expect(page.getByRole('row', { name: /grand-fichier\.bin/ })).toBeVisible({ timeout: 60_000 })
  expect(dropped).toBe(true)
  const { items } = await (await owner.get(`/api/folders/${folder.id}`)).json()
  expect(items[0]).toMatchObject({ name: 'grand-fichier.bin', size })

  await removeFolder(owner, folder.id)
})

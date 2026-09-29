import { expect, test } from '@playwright/test'
import { pack } from '../fixtures'
import { OWNER, createFolder, ownerApi, removeFolder, signIn, unique } from './helpers'

test('a zipped site runs with its modules, styles and data once made interactive', async ({ page }) => {
  const owner = await ownerApi()
  const folder = await createFolder(owner, unique('site'))
  const zip = await pack({
    'index.html': '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="assets/style.css"><h1>Camp</h1><p id="status">Chargement</p><a href="infos/">Infos</a><script type="module" src="assets/app.js"></script>',
    'assets/style.css': 'h1 { color: rgb(109, 74, 255) }',
    'assets/app.js': 'const days = await (await fetch("assets/programme.json")).json(); document.querySelector("#status").textContent = `${days.length} jours`',
    'assets/programme.json': '["lundi", "mardi", "mercredi"]',
    'infos/index.html': '<!doctype html><meta charset="utf-8"><h1>Infos pratiques</h1>',
  })
  const query = new URLSearchParams({ name: 'Site camp.zip', parentId: folder.id })
  const { id } = await (await owner.put(`/api/uploads?${query}`, { data: zip })).json()
  await expect.poll(async () => (await (await owner.post(`/api/resources/${id}/open`)).json()).frameUrl, { timeout: 15_000 }).toBeTruthy()
  await owner.patch(`/api/resources/${id}`, { data: { allowScripts: true } })

  await signIn(page, OWNER.email, OWNER.password)
  await page.goto(`/drive/folder/${folder.id}?preview=${id}`)
  const site = page.frameLocator('iframe[title="Site camp.zip"]')
  await expect(site.locator('#status')).toHaveText('3 jours')
  await expect(site.getByRole('heading', { name: 'Camp' })).toHaveCSS('color', 'rgb(109, 74, 255)')
  await site.getByRole('link', { name: 'Infos' }).click()
  await expect(site.getByRole('heading', { name: 'Infos pratiques' })).toBeVisible()

  await removeFolder(owner, folder.id)
})

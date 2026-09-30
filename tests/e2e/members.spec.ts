import { expect, test } from '@playwright/test'
import { OWNER, apiAs, createFolder, ownerApi, removeFolder, signIn, unique, uploadText } from './helpers'

test('a member works in their own folder and edits what is shared with them, without sharing it', async ({ page }) => {
  const owner = await ownerApi()
  const member = { name: unique('Membre'), email: `${unique('member')}@example.com`, password: 'member-password-123' }
  const created = await (await owner.post('/api/people', { data: { ...member, role: 'member' } })).json()
  const folder = await createFolder(owner, unique('projets'))
  await uploadText(owner, folder.id, 'plan.txt', 'Le plan')
  await owner.post(`/api/resources/${folder.id}/access`, { data: { email: member.email, role: 'editor', notify: false } })
  const own = (await (await (await apiAs(member.email, member.password)).get('/api/folders/root')).json()).items[0]

  await signIn(page, member.email, member.password)
  await expect(page).toHaveURL(/\/home/)
  const nav = page.getByRole('complementary')
  await expect(nav.getByRole('link', { name: 'Personnes' })).toHaveCount(0)
  await nav.getByRole('link', { name: 'Mon Drive' }).click()
  await expect(page.getByRole('row', { name: new RegExp(member.name) })).toBeVisible()

  await page.getByRole('row', { name: new RegExp(folder.name) }).dblclick()
  await page.getByRole('row', { name: /plan\.txt/ }).click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: 'Renommer' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Partager' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.getByRole('row', { name: /plan\.txt/ }).click()
  await page.keyboard.press('F2')
  const rename = page.getByRole('dialog')
  await rename.getByRole('textbox').fill('plan final.txt')
  await rename.getByRole('button', { name: 'Renommer' }).click()
  await expect(page.getByRole('row', { name: /plan final\.txt/ })).toBeVisible()

  await removeFolder(owner, folder.id)
  await removeFolder(owner, own.id)
  await owner.delete(`/api/people/${created.id}`)
})

test('the share dialog lets owners give members a role', async ({ page }) => {
  const owner = await ownerApi()
  const member = { name: unique('Membre'), email: `${unique('member')}@example.com`, password: 'member-password-123' }
  const created = await (await owner.post('/api/people', { data: { ...member, role: 'member' } })).json()
  const own = (await (await (await apiAs(member.email, member.password)).get('/api/folders/root')).json()).items[0]
  const folder = await createFolder(owner, unique('clients'))
  await owner.post(`/api/resources/${folder.id}/access`, { data: { email: member.email, notify: false } })

  await signIn(page, OWNER.email, OWNER.password)
  await page.goto('/drive')
  await page.getByRole('row', { name: new RegExp(folder.name) }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Partager' }).click()
  const dialog = page.getByRole('dialog')
  const role = dialog.getByRole('combobox', { name: `Ce que ${member.name} peut faire` })
  await expect(role).toHaveValue('viewer')
  await role.selectOption('manager')
  await expect.poll(async () => (await (await owner.get(`/api/resources/${folder.id}/access`)).json()).entries[0].role).toBe('manager')

  await removeFolder(owner, folder.id)
  await removeFolder(owner, own.id)
  await owner.delete(`/api/people/${created.id}`)
})

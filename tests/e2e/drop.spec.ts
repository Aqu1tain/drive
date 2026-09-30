import { expect, test, type Page } from '@playwright/test'
import { OWNER, ownerApi, signIn, unique } from './helpers'

async function dropFile(page: Page, selector: string, name: string) {
  const transfer = await page.evaluateHandle((fileName) => {
    const data = new DataTransfer()
    data.items.add(new File(['Déposé depuis le bureau'], fileName, { type: 'text/plain' }))
    return data
  }, name)
  await expect(async () => {
    await page.dispatchEvent(selector, 'dragenter', { dataTransfer: transfer })
    await page.dispatchEvent(selector, 'dragover', { dataTransfer: transfer })
    await expect(page.getByText('Déposer pour importer dans Mon Drive')).toBeVisible({ timeout: 1000 })
  }).toPass()
  await page.dispatchEvent(selector, 'drop', { dataTransfer: transfer })
}

test('files dropped on a page without a folder land in Mon Drive, and the app stays open', async ({ page }) => {
  const owner = await ownerApi()
  const name = `${unique('depose')}.txt`
  await signIn(page, OWNER.email, OWNER.password)
  await expect(page).toHaveURL(/\/home/)

  await dropFile(page, 'main', name)
  await expect(page).toHaveURL(/\/home/)
  await expect(page.getByText('Déposer pour importer dans Mon Drive')).toBeHidden()

  const find = async () => ((await (await owner.get('/api/folders/root')).json()).items as Array<{ id: string, name: string }>).find(item => item.name === name)
  await expect.poll(find).toBeTruthy()
  const file = (await find())!
  await owner.post('/api/resources/trash', { data: { ids: [file.id] } })
  await owner.delete(`/api/resources/${file.id}`)
})

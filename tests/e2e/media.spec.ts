import { expect, test } from '@playwright/test'
import { OWNER, createFolder, ownerApi, removeFolder, signIn, unique } from './helpers'

test('a video gets its thumbnail from the owner browser', async ({ page }) => {
  const owner = await ownerApi()
  const folder = await createFolder(owner, unique('video'))
  await signIn(page, OWNER.email, OWNER.password)
  await page.goto(`/drive/folder/${folder.id}`)

  const video = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const context = canvas.getContext('2d')!
    const recorder = new MediaRecorder(canvas.captureStream(25), { mimeType: 'video/webm' })
    const chunks: Blob[] = []
    recorder.ondataavailable = event => chunks.push(event.data)
    const stopped = new Promise(resolve => (recorder.onstop = resolve))
    recorder.start(100)
    for (let frame = 0; frame < 40; frame++) {
      context.fillStyle = `hsl(${frame * 9}, 70%, 50%)`
      context.fillRect(0, 0, 320, 180)
      await new Promise(resolve => setTimeout(resolve, 40))
    }
    recorder.stop()
    await stopped
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
    return Array.from(bytes)
  })

  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'vacances.webm', mimeType: 'video/webm', buffer: Buffer.from(video) })
  await expect(page.getByRole('row', { name: /vacances\.webm/ })).toBeVisible()
  await expect.poll(async () => {
    const { items } = await (await owner.get(`/api/folders/${folder.id}`)).json()
    return items[0]?.thumbnailUrl ?? null
  }, { timeout: 20_000 }).toMatch(/\/thumbnail\?v=/)

  await removeFolder(owner, folder.id)
})

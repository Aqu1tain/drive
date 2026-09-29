import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { OWNER, createFolder, ownerApi, removeFolder, signIn, unique, uploadText } from './helpers'

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  for (const violation of serious) {
    console.log(`[${label}] ${violation.id} (${violation.impact}): ${violation.help}`)
    for (const node of violation.nodes.slice(0, 3)) console.log(`   ${node.target.join(' ')}  ${node.failureSummary?.split('\n')[1] ?? ''}`)
  }
  return serious
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme })

    test('login page', async ({ page }) => {
      await page.goto('/login')
      await page.waitForLoadState('networkidle')
      expect(await audit(page, `${scheme} login`)).toEqual([])
    })

    test('owner views', async ({ page }) => {
      await signIn(page, OWNER.email, OWNER.password)
      for (const path of ['/home', '/drive', '/recent', '/shared', '/activity', '/people', '/trash', '/settings']) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(300)
        expect(await audit(page, `${scheme} ${path}`), path).toEqual([])
      }
    })

    test('share dialog', async ({ page }) => {
      const owner = await ownerApi()
      const folder = await createFolder(owner, unique('a11y'))
      await signIn(page, OWNER.email, OWNER.password)
      await page.goto('/drive')
      await page.waitForLoadState('networkidle')
      await page.getByRole('row', { name: new RegExp(folder.name) }).click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Partager' }).click()
      await page.getByRole('dialog').waitFor()
      await page.waitForTimeout(400)
      const violations = await audit(page, `${scheme} share`)
      await removeFolder(owner, folder.id)
      expect(violations).toEqual([])
    })

    test('public link page', async ({ page }) => {
      const owner = await ownerApi()
      const folder = await createFolder(owner, unique('a11y-public'))
      await uploadText(owner, folder.id, 'programme.txt', 'Programme de la journée')
      const { link } = await (await owner.put(`/api/resources/${folder.id}/link`, { data: { enabled: true } })).json()
      await page.goto(link.url)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('programme.txt')).toBeVisible()
      expect(await audit(page, `${scheme} public`)).toEqual([])
      await removeFolder(owner, folder.id)
    })
  })
}

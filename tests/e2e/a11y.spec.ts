import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { OWNER, ownerApi, signIn } from './helpers'

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

    test('share dialog and preview', async ({ page }) => {
      await signIn(page, OWNER.email, OWNER.password)
      await page.goto('/drive')
      await page.waitForLoadState('networkidle')
      const row = page.getByRole('row').nth(1)
      await row.click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Partager' }).click()
      await page.getByRole('dialog').waitFor()
      await page.waitForTimeout(400)
      expect(await audit(page, `${scheme} share`)).toEqual([])
    })

    test('public link page', async ({ page }) => {
      const owner = await ownerApi()
      const { items } = await (await owner.get('/api/shared')).json()
      const withLink = items.find((i: { access?: { hasLink: boolean } }) => i.access?.hasLink)
      test.skip(!withLink, 'no public link in the dataset')
      const { link } = await (await owner.get(`/api/resources/${withLink.id}/access`)).json()
      await page.goto(link.url)
      await page.waitForLoadState('networkidle')
      expect(await audit(page, `${scheme} public`)).toEqual([])
    })
  })
}

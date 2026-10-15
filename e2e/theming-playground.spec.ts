import { test, expect } from '@playwright/test'

/**
 * Smoke test for docs/examples-theming.html — confirms the Dark Mode
 * Playground loads, the grid renders, and the four signal controls update
 * the "winning signal" indicator correctly per color-scheme.md precedence.
 *
 * Not part of the regular suite output focus; primarily catches breakage
 * when the playground page or the signal precedence changes.
 */

test.describe('theming playground', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/examples-theming.html')
		await expect(page.locator('web-grid#demoGrid').locator('tbody tr').first()).toBeVisible()
	})

	test('default state — no signals → light mode', async ({ page }) => {
		await expect(page.locator('#resolvedMode')).toHaveText('light')
	})

	test('per-instance data-theme="dark" wins over everything else', async ({ page }) => {
		// Set conflicting lower-precedence signals first.
		await page.locator('input[name="colorScheme"][value="light"]').check()
		await page.locator('input[name="ancestor"][value="data-theme-light"]').check()
		// Then set per-instance dark — should override both.
		await page.locator('input[name="instance"][value="dark"]').check()

		await expect(page.locator('#resolvedMode')).toHaveText('dark')
		await expect(page.locator('#winningSignalText')).toContainText('per-instance')
	})

	test('ancestor [data-bs-theme="dark"] applies dark mode to the grid', async ({ page }) => {
		await page.locator('input[name="ancestor"][value="data-bs-theme-dark"]').check()
		await expect(page.locator('#resolvedMode')).toHaveText('dark')
		await expect(page.locator('#winningSignalText')).toContainText('[data-bs-theme="dark"]')
	})

	test('page color-scheme:dark + no other signal → dark', async ({ page }) => {
		await page.locator('input[name="colorScheme"][value="dark"]').check()
		await expect(page.locator('#resolvedMode')).toHaveText('dark')
		await expect(page.locator('#winningSignalText')).toContainText('color-scheme: dark')
	})

	test('state panel does not inject extra web-grid elements', async ({ page }) => {
		// Regression: an earlier version of the page interpolated strings
		// containing literal `<web-grid>` into innerHTML, which the browser
		// then parsed as a real custom element. Result: a second, empty grid
		// would appear in the state panel area.
		await page.locator('input[name="instance"][value="dark"]').check()
		await page.locator('input[name="instance"][value="light"]').check()
		await page.locator('input[name="ancestor"][value="data-bs-theme-dark"]').check()

		const gridCount = await page.locator('web-grid').count()
		expect(gridCount).toBe(1)
	})

	test('Express brand applies the full pure-admin palette', async ({ page }) => {
		await page.locator('input[name="brand"][value="express"]').check()

		// Spot-check a handful of values from the Express palette landing on :root.
		const expressVars = await page.evaluate(() => {
			const s = getComputedStyle(document.documentElement)
			return {
				accent:      s.getPropertyValue('--base-primary-color').trim(),
				mainBg:      s.getPropertyValue('--base-main-bg').trim(),
				borderColor: s.getPropertyValue('--base-border-color').trim(),
				fontFamily:  s.getPropertyValue('--base-font-family').trim(),
				tooltipBg:   s.getPropertyValue('--base-tooltip-bg').trim()
			}
		})
		expect(expressVars.accent).toBe('#D40511')           // Express red
		expect(expressVars.mainBg).toBe('#ffffff')
		expect(expressVars.borderColor).toBe('#E5E5E5')
		expect(expressVars.fontFamily).toContain('Fira Sans Condensed')
		expect(expressVars.tooltipBg).toBe('#333333')

		// The grid's own --wg-accent-color should resolve through the chain to Express red.
		const gridAccent = await page.locator('web-grid#demoGrid').evaluate(el => {
			return getComputedStyle(el).getPropertyValue('--wg-accent-color').trim()
		})
		expect(gridAccent).toBe('#D40511')
	})

	test('brand theme changes accent color of the grid', async ({ page }) => {
		// Default brand — measure header background color.
		const beforeAccent = await page.evaluate(() => {
			return getComputedStyle(document.documentElement).getPropertyValue('--base-primary-color').trim()
		})
		expect(beforeAccent).toBe('')  // not set by default

		// Switch to Rose — should set --base-primary-color.
		await page.locator('input[name="brand"][value="rose"]').check()
		const afterAccent = await page.evaluate(() => {
			return getComputedStyle(document.documentElement).getPropertyValue('--base-primary-color').trim()
		})
		expect(afterAccent).toBe('#e11d48')
	})
})

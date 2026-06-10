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

	test('brand theme changes accent color of the grid', async ({ page }) => {
		// Default brand — measure header background color.
		const beforeAccent = await page.evaluate(() => {
			return getComputedStyle(document.documentElement).getPropertyValue('--base-accent-color').trim()
		})
		expect(beforeAccent).toBe('')  // not set by default

		// Switch to Rose — should set --base-accent-color.
		await page.locator('input[name="brand"][value="rose"]').check()
		const afterAccent = await page.evaluate(() => {
			return getComputedStyle(document.documentElement).getPropertyValue('--base-accent-color').trim()
		})
		expect(afterAccent).toBe('#e11d48')
	})
})

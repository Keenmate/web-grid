import { test, expect, gridLocator, cell, readClipboard } from './fixtures'

/**
 * Core helpers the grid goes through (core-adoption pass, core 1.0.0-rc25): what the grid gets
 * from them that it didn't have before.
 *
 * The clipboard is an in-page stub (never the developer's real system clipboard).
 */

test.describe('copyText fallback (test/copy.html)', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			let text = ''
			Object.defineProperty(navigator, 'clipboard', {
				configurable: true,
				value: { writeText: () => Promise.reject(new Error('denied')), readText: async () => text }
			})
			document.execCommand = ((command: string) => {
				if (command !== 'copy') return false
				const area = document.activeElement as HTMLTextAreaElement
				text = area.value.slice(area.selectionStart, area.selectionEnd)
				return true
			}) as typeof document.execCommand
		})
		await page.goto('/test/copy.html')
		await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
	})

	test('a refused Clipboard API falls back to execCommand — Ctrl+C still copies', async ({ page }) => {
		await cell(page, 0, 1).click()
		await page.keyboard.press('Control+c')
		await expect.poll(() => readClipboard(page)).toBe('Apple')
	})

	// Core gap (reported for core rc25): copyText's textarea fallback puts focus back on
	// document.activeElement — the grid host — not on the focused cell inside its shadow root.
	test.fixme('after the fallback copy the focused cell keeps focus', async ({ page }) => {
		await cell(page, 0, 1).click()
		await page.keyboard.press('Control+c')
		await expect.poll(() => readClipboard(page)).toBe('Apple')
		await expect(cell(page, 0, 1)).toBeFocused()
	})
})

test.describe('page-wide locale (test/datepicker.html)', () => {
	test('the date editor names months in window.components.locale', async ({ page }) => {
		await page.goto('/test/datepicker.html')
		await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
		await page.evaluate(() => { (window as unknown as { components: { locale: unknown } }).components.locale = { locale: 'de-DE' } })
		await cell(page, 0, 2).click()
		await page.keyboard.press('F2')
		await expect(page.locator('.wg-datepicker')).toContainText('Juni')
	})
})

import { test, expect, type Page, cell, waitForRows, readClipboard } from './fixtures'

/**
 * `renderCellCallback` in every column type — the README order: renderCellCallback >
 * getDisplayValueCallback > the built-in text (option label / formatted date / locale number /
 * checkbox); `null` = the built-in display, `false` = empty. Copy never scrapes the HTML:
 * getCopyValueCallback > getDisplayValueCallback > the built-in text.
 *
 * Fixture: test/render-cell.html (see its header for the columns). The spec never touches the
 * real clipboard: an in-page navigator.clipboard (as copy.spec.ts).
 */

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		let text = ''
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText: async (value: string) => { text = String(value) }, readText: async () => text }
		})
	})
	await page.goto('/test/render-cell.html')
	await waitForRows(page)
})

async function copyCell(page: Page, row: number, col: number): Promise<string> {
	await page.evaluate(() => navigator.clipboard.writeText('<sentinel>'))
	await cell(page, row, 0).click()
	for (let c = 0; c < col; c++) await page.keyboard.press('ArrowRight')
	await expect(cell(page, row, col)).toBeFocused()
	await page.keyboard.press('Control+c')
	await expect.poll(() => readClipboard(page)).not.toBe('<sentinel>')
	return readClipboard(page)
}

test.describe('shown', () => {
	test('dropdown: renderCellCallback wins over getDisplayValueCallback and the option label', async ({ page }) => {
		const html = cell(page, 0, 1).locator('.wg__select-value b.r')
		await expect(html).toHaveText('R:Active')
		await expect(cell(page, 1, 1).locator('.wg__select-value b.r')).toHaveText('R:Paused')
		await expect(cell(page, 0, 1).locator('.wg__select-toggle')).toHaveCount(1)  // still a dropdown cell
	})

	test('dropdown: renderCellCallback null → the built-in option label', async ({ page }) => {
		await expect(cell(page, 0, 2).locator('.wg__select-value i.r')).toHaveText('T:g')
		await expect(cell(page, 1, 2).locator('.wg__select-value')).toHaveText('Silver')
	})

	test('date: the rendered HTML (not escaped text)', async ({ page }) => {
		await expect(cell(page, 0, 3).locator('.wg__date-value u.r')).toHaveText('due 2026-03-05')
	})

	test('checkbox: the rendered HTML replaces the checkbox; false → empty', async ({ page }) => {
		await expect(cell(page, 0, 4).locator('span.r')).toHaveText('✓')
		await expect(cell(page, 0, 4).locator('input[type="checkbox"]')).toHaveCount(0)
		await expect(cell(page, 1, 4).locator('.wg__cell-text')).toHaveText('')
		await expect(cell(page, 1, 4).locator('input[type="checkbox"]')).toHaveCount(0)
	})

	test('number: the rendered HTML', async ({ page }) => {
		await expect(cell(page, 0, 5).locator('em.r')).toHaveText('n=1500')
	})

	test('a dropdown without callbacks shows its option label escaped', async ({ page }) => {
		await expect(cell(page, 0, 6).locator('.wg__select-value')).toHaveText('<Small>')
	})

	test('after an edit the rendered HTML follows the new value', async ({ page }) => {
		await page.locator('#grid').evaluate(async (el: any) => {
			el.items = el.items.map((r: any, i: number) => i === 0 ? { ...r, status: 'p' } : r)
			await el.whenSettled()
		})
		await expect(cell(page, 0, 1).locator('b.r')).toHaveText('R:Paused')
	})
})

test.describe('copy (never the HTML)', () => {
	test('dropdown with render + display callbacks → getDisplayValueCallback', async ({ page }) => {
		expect(await copyCell(page, 0, 1)).toBe('D:a')
	})
	test('dropdown with render only → the option label', async ({ page }) => {
		expect(await copyCell(page, 0, 2)).toBe('Gold')
	})
	test('date with render only → the formatted date', async ({ page }) => {
		expect(await copyCell(page, 0, 3)).toBe('05.03.2026')
	})
	test('number with render + getCopyValueCallback → the copy callback', async ({ page }) => {
		expect(await copyCell(page, 0, 5)).toBe('copy:1500')
	})
})

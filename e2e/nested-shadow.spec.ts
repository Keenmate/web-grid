import { test, expect, type Page } from './fixtures'

/**
 * A grid inside another component's shadow root keeps / restores cell focus exactly like a
 * top-level grid (test/nested-shadow.html). There `document.activeElement` is the OUTER host
 * (the wrapper), so a focus check on it read "focus is elsewhere" / "focus left the grid".
 */

const GRIDS = [
	{ name: 'top-level grid', isNested: false },
	{ name: 'grid inside a wrapper shadow root', isNested: true }
] as const

/** Run `fn` against the grid element (page-side). */
const onGrid = <R>(page: Page, isNested: boolean, fn: (el: any) => R) =>
	page.evaluate(([nested, src]) => {
		const el = nested
			? document.getElementById('wrapper')!.shadowRoot!.getElementById('inner')
			: document.getElementById('top')
		return (0, eval)(`(${src})`)(el)
	}, [isNested, fn.toString()] as const) as Promise<R>

for (const { name, isNested } of GRIDS) {
	test.describe(name, () => {
		const grid = (page: Page) => page.locator(isNested ? '#wrapper web-grid' : '#top')
		const cell = (page: Page, row: number, col: number) => grid(page).locator(`td[data-row="${row}"][data-col="${col}"]`)
		/** "row,col" of the focused cell inside the grid's own shadow root, or null. */
		const activeCell = (page: Page) => onGrid(page, isNested, (el) => {
			const a = el.shadowRoot.activeElement?.closest('td')
			return a ? `${a.getAttribute('data-row')},${a.getAttribute('data-col')}` : null
		})
		const focusedCellCount = (page: Page) => grid(page).locator('td.wg__cell--focused').count()

		test.beforeEach(async ({ page }) => {
			await page.goto('/test/nested-shadow.html')
			await expect(grid(page).locator('tbody tr')).toHaveCount(4)
		})

		test('arrow keys move the cell focus', async ({ page }) => {
			await cell(page, 0, 1).click()
			await expect.poll(() => activeCell(page)).toBe('0,1')
			await page.keyboard.press('ArrowDown')
			await page.keyboard.press('ArrowRight')
			await expect.poll(() => activeCell(page)).toBe('1,2')
		})

		test('cancelling an edit puts focus back on the cell', async ({ page }) => {
			await cell(page, 1, 1).click()
			await page.keyboard.press('F2')
			await expect(grid(page).locator('.wg__editor').first()).toBeVisible()
			await page.keyboard.type('X')
			await page.keyboard.press('Escape')
			await expect.poll(() => activeCell(page)).toBe('1,1')
			await page.keyboard.press('ArrowDown')
			await expect.poll(() => activeCell(page)).toBe('2,1')
		})

		test('committing an edit keeps the keyboard in the grid', async ({ page }) => {
			await cell(page, 1, 2).click()
			await page.keyboard.press('F2')
			await expect(grid(page).locator('.wg__editor').first()).toBeVisible()
			await page.keyboard.type('X')
			await page.keyboard.press('Enter')
			await expect(cell(page, 1, 2)).toContainText('X')
			await expect.poll(() => activeCell(page)).not.toBeNull()
		})

		test('focus moving to the filter row keeps the focused cell', async ({ page }) => {
			await cell(page, 2, 1).click()
			await expect.poll(() => activeCell(page)).toBe('2,1')
			await grid(page).locator('.wg__filter-input').first().focus()
			// Past the focusout handler's requestAnimationFrame
			await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
			expect(await focusedCellCount(page)).toBe(1)
		})

		// focus.ts focusout check: focus left the table but stayed in the grid (its container,
		// focusable for range shortcuts) — the focused cell is kept
		test('focus moving to the grid container keeps the focused cell', async ({ page }) => {
			await cell(page, 2, 1).click()
			await expect.poll(() => activeCell(page)).toBe('2,1')
			await onGrid(page, isNested, (el) => el.shadowRoot.querySelector('.wg').focus())
			await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
			expect(await focusedCellCount(page)).toBe(1)
		})

		// post-render-focus.ts: the focus is in the grid (its container) when a render runs —
		// it comes back to the focused cell, it isn't "elsewhere on the page"
		test('a re-render while the grid container holds focus puts it back on the cell', async ({ page }) => {
			await cell(page, 0, 1).click()
			await expect.poll(() => activeCell(page)).toBe('0,1')
			await onGrid(page, isNested, (el) => {
				el.shadowRoot.querySelector('.wg').focus()
				el.sort = [{ column: 'name', direction: 'desc' }]
				el.flush()
			})
			await expect.poll(() => activeCell(page)).toBe('0,1')
			expect(await focusedCellCount(page)).toBe(1)
		})

		test('focus in another element of the wrapper / page is never pulled back', async ({ page }) => {
			await cell(page, 0, 1).click()
			await expect.poll(() => activeCell(page)).toBe('0,1')
			await page.locator('h1').evaluate((h) => { h.tabIndex = -1; h.focus() })
			await onGrid(page, isNested, (el) => { el.sort = [{ column: 'name', direction: 'desc' }]; el.flush() })
			await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
			expect(await activeCell(page)).toBeNull()
		})
	})
}

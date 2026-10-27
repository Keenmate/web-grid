import { test, expect, type Page, gridLocator, cell, header, onGrid, waitForRows, dragSelect, readClipboard, editCell } from './fixtures'

/**
 * Copy — Ctrl+C on a focused cell / cell range / row selection / column
 * selection (TSV), `shouldCopyWithHeaders`, column `getCopyValueCallback`,
 * `copySelectedRowsToClipboard()` / `copyCellSelectionToClipboard()`.
 *
 * Fixture: docs/test/copy.html — 3 rows × (id, name, price, note); price has a
 * getCopyValueCallback rendering "12.50 EUR"; Banana's note is null.
 */

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

const PAGE = '/test/copy.html'
const rowNumber = (page: Page, r: number) => gridLocator(page).locator(`.wg__row-number[data-row-number="${r}"]`)

/** Put a sentinel on the clipboard so a no-op copy is detectable. */
async function primeClipboard(page: Page) {
	await page.evaluate(() => navigator.clipboard.writeText('<sentinel>'))
}

/** The clipboard after it changed from the sentinel. */
async function copied(page: Page): Promise<string> {
	await expect.poll(() => readClipboard(page)).not.toBe('<sentinel>')
	return readClipboard(page)
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await primeClipboard(page)
})

test.describe('keyboard Ctrl+C', () => {
	test('a focused cell copies its raw value', async ({ page }) => {
		await cell(page, 0, 1).click()
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('Apple')
	})

	test('a focused cell copies its draft (edited) value', async ({ page }) => {
		await editCell(page, cell(page, 0, 1), 'Apricot')
		await cell(page, 0, 1).click()
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('Apricot')
	})

	test('a focused cell with getCopyValueCallback copies the callback text', async ({ page }) => {
		await cell(page, 0, 2).click()
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('12.50 EUR')
	})

	test('a clipboard rejection on Ctrl+C is handled (no unhandled rejection)', async ({ page }) => {
		// GRID-2: the fixtures fail the test on any uncaught page error
		await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('denied')) })
		await cell(page, 0, 1).click()
		await page.keyboard.press('Control+c')
		await page.waitForTimeout(150)
	})

	test('a dragged cell range copies TSV (null → empty)', async ({ page }) => {
		await dragSelect(page, 0, 1, 1, 3)
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('Apple\t12.5\tfresh\nBanana\t3\t')
	})

	test('a dragged range with shouldCopyWithHeaders prepends the titles', async ({ page }) => {
		await onGrid(page, el => el.setAttribute('copy-with-headers', ''))
		await dragSelect(page, 1, 0, 2, 1)
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('ID\tName\n2\tBanana\n3\tCherry')
	})

	test('a selected row copies all columns as TSV; with headers prepends titles', async ({ page }) => {
		await rowNumber(page, 2).click()
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('3\tCherry\t7.25\tripe')

		await primeClipboard(page)
		await onGrid(page, el => { el.shouldCopyWithHeaders = true })
		await rowNumber(page, 0).click()
		await rowNumber(page, 1).click({ modifiers: ['Shift'] })
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('ID\tName\tPrice\tNote\n1\tApple\t12.5\tfresh\n2\tBanana\t3\t')
	})

	test('a selected column copies every row of it', async ({ page }) => {
		await header(page, 'name').click({ modifiers: ['Shift'] })
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('Apple\nBanana\nCherry')
	})
})

test.describe('API', () => {
	test('copySelectedRowsToClipboard resolves true and writes TSV; false without a selection', async ({ page }) => {
		expect(await onGrid(page, el => el.copySelectedRowsToClipboard())).toBe(false)
		expect(await readClipboard(page)).toBe('<sentinel>')
		expect(await onGrid(page, async el => { el.selectRow(0); el.selectRow(2, 'toggle'); return el.copySelectedRowsToClipboard() })).toBe(true)
		expect(await readClipboard(page)).toBe('1\tApple\t12.5\tfresh\n3\tCherry\t7.25\tripe')
	})

	test('copySelectedRowsToClipboard honours shouldCopyWithHeaders', async ({ page }) => {
		await onGrid(page, async el => { el.shouldCopyWithHeaders = true; el.selectRow(1); await el.copySelectedRowsToClipboard() })
		expect(await readClipboard(page)).toBe('ID\tName\tPrice\tNote\n2\tBanana\t3\t')
	})

	test('copyCellSelectionToClipboard copies a programmatic range', async ({ page }) => {
		const ok = await onGrid(page, el => {
			el.selectCellRange({ startRowIndex: 0, startColIndex: 2, endRowIndex: 2, endColIndex: 2 })
			return el.copyCellSelectionToClipboard()
		})
		expect(ok).toBe(true)
		expect(await readClipboard(page)).toBe('12.5\n3\n7.25')
	})

	test('a clipboard failure resolves false instead of throwing', async ({ page }) => {
		const ok = await onGrid(page, el => {
			const orig = navigator.clipboard.writeText
			navigator.clipboard.writeText = () => Promise.reject(new Error('denied'))
			el.selectRow(0)
			return el.copySelectedRowsToClipboard().finally(() => { navigator.clipboard.writeText = orig })
		})
		expect(ok).toBe(false)
	})
})

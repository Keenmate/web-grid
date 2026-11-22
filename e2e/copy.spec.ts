import { test, expect, type Page, gridLocator, cell, header, onGrid, waitForRows, dragSelect, readClipboard, editCell } from './fixtures'

/**
 * Copy — Ctrl+C on a focused cell / cell range / row selection / column
 * selection (TSV), `shouldCopyWithHeaders`, column `getCopyValueCallback`,
 * `copySelectedRowsToClipboard()` / `copyCellSelectionToClipboard()`.
 *
 * Fixture: test/copy.html — 3 rows × (id, name, price, note); price has a
 * getCopyValueCallback rendering "12.50 EUR" (single-cell, range, row and column copy);
 * Banana's note is null.
 */

// The spec never touches the real system clipboard (it is the developer's): every browser gets an
// in-page clipboard — navigator.clipboard.writeText / readText and the document.execCommand('copy')
// fallback core's copyText() uses when the Clipboard API refuses (it copies the selected text).
// `window.__execCopyFails = true` makes that fallback fail too.
test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		let text = ''
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: async (value: string) => { text = String(value) },
				readText: async () => text
			}
		})
		document.execCommand = ((command: string) => {
			if (command !== 'copy' || (window as unknown as { __execCopyFails?: boolean }).__execCopyFails) return false
			const active = document.activeElement as HTMLTextAreaElement | null
			text = active && 'value' in active ? active.value.slice(active.selectionStart ?? 0, active.selectionEnd ?? undefined) : String(document.getSelection() ?? '')
			return true
		}) as typeof document.execCommand
	})
})

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
		expect(await copied(page)).toBe('Apple\t12.50 EUR\tfresh\nBanana\t3.00 EUR\t')
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
		expect(await copied(page)).toBe('3\tCherry\t7.25 EUR\tripe')

		await primeClipboard(page)
		await onGrid(page, el => { el.shouldCopyWithHeaders = true })
		await rowNumber(page, 0).click()
		await rowNumber(page, 1).click({ modifiers: ['Shift'] })
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('ID\tName\tPrice\tNote\n1\tApple\t12.50 EUR\tfresh\n2\tBanana\t3.00 EUR\t')
	})

	test('a selected column copies every row of it', async ({ page }) => {
		await header(page, 'name').click({ modifiers: ['Shift'] })
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('Apple\nBanana\nCherry')
	})
})

// #shown: status = select (a→Active), due = date DD.MM.YYYY, size = combobox + getCopyValueCallback,
// when = date + getDisplayValueCallback ("Q<n>"). Copy = what the cell shows (Excel).
test.describe('copy = what the cell shows (date / dropdown columns)', () => {
	test('a focused dropdown cell copies its option label; a date cell its formatted date', async ({ page }) => {
		await cell(page, 'shown', 0, 1).click()
		await expect(cell(page, 'shown', 0, 1)).toContainText('Active')
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('Active')

		await primeClipboard(page)
		await cell(page, 'shown', 0, 2).click()
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('05.03.2026')
	})

	test('getCopyValueCallback > getDisplayValueCallback > the shown text', async ({ page }) => {
		await cell(page, 'shown', 0, 3).click()
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('size:s')

		await primeClipboard(page)
		await cell(page, 'shown', 1, 4).click()
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('Q4')
	})

	test('range, row and column copies use the shown text too (null date → empty)', async ({ page }) => {
		await dragSelect(page, 0, 1, 1, 2, 'shown')
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('Active\t05.03.2026\nPaused\t')

		await primeClipboard(page)
		await gridLocator(page, 'shown').locator('.wg__row-number[data-row-number="0"]').click()
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('1\tActive\t05.03.2026\tsize:s\tQ1\t★ Gold\t1500 pcs')

		await primeClipboard(page)
		await header(page, 'shown', 'status').click({ modifiers: ['Shift'] })
		await page.keyboard.press('Control+c')
		expect(await copied(page)).toBe('Active\nPaused')
	})

	test("the column's getDisplayValueCallback is what a dropdown / date / number cell SHOWS, and copy = shown", async ({ page }) => {
		// select + callback: the callback text, not the option label (Excel: copy what you see)
		await expect(cell(page, 'shown', 0, 5).locator('.wg__select-value')).toHaveText('★ Gold')
		await expect(cell(page, 'shown', 1, 5).locator('.wg__select-value')).toHaveText('★ Silver')
		await expect(cell(page, 'shown', 1, 4)).toHaveText('Q4')
		await expect(cell(page, 'shown', 0, 6)).toHaveText('1500 pcs')
		for (const [row, col, text] of [[0, 5, '★ Gold'], [1, 4, 'Q4'], [0, 6, '1500 pcs']] as const) {
			await primeClipboard(page)
			await cell(page, 'shown', row, col).click()
			await page.keyboard.press('Control+c')
			expect(await copied(page)).toBe(text)
		}
		// an edit commit re-renders the cell with the callback too
		await onGrid(page, async el => { el.updateRowById(1, { tier: 's' }); await el.whenSettled() }, 'shown')
		await expect(cell(page, 'shown', 0, 5).locator('.wg__select-value')).toHaveText('★ Silver')
	})

	test('a copied option label pastes back to the option value', async ({ page }) => {
		await cell(page, 'shown', 1, 1).click()
		await gridLocator(page, 'shown').evaluate(async (el) => {
			const dt = new DataTransfer()
			dt.setData('text', 'Active')
			const event = new Event('paste', { bubbles: true, cancelable: true })
			Object.defineProperty(event, 'clipboardData', { value: dt })
			el.dispatchEvent(event)
			await el.whenSettled()
		})
		await expect(cell(page, 'shown', 1, 1)).toContainText('Active')
		expect(await onGrid(page, el => (el.getRowDraft(1) ?? el.items[1]).status, 'shown')).toBe('a')
	})
})

test.describe('API', () => {
	test('copySelectedRowsToClipboard resolves true and writes TSV; false without a selection', async ({ page }) => {
		expect(await onGrid(page, el => el.copySelectedRowsToClipboard())).toBe(false)
		expect(await readClipboard(page)).toBe('<sentinel>')
		expect(await onGrid(page, async el => { el.selectRow(0); el.selectRow(2, 'toggle'); return el.copySelectedRowsToClipboard() })).toBe(true)
		expect(await readClipboard(page)).toBe('1\tApple\t12.50 EUR\tfresh\n3\tCherry\t7.25 EUR\tripe')
	})

	test('copySelectedRowsToClipboard honours shouldCopyWithHeaders', async ({ page }) => {
		await onGrid(page, async el => { el.shouldCopyWithHeaders = true; el.selectRow(1); await el.copySelectedRowsToClipboard() })
		expect(await readClipboard(page)).toBe('ID\tName\tPrice\tNote\n2\tBanana\t3.00 EUR\t')
	})

	test('copyCellSelectionToClipboard copies a programmatic range', async ({ page }) => {
		const ok = await onGrid(page, el => {
			el.selectCellRange({ startRowIndex: 0, startColIndex: 2, endRowIndex: 2, endColIndex: 2 })
			return el.copyCellSelectionToClipboard()
		})
		expect(ok).toBe(true)
		expect(await readClipboard(page)).toBe('12.50 EUR\n3.00 EUR\n7.25 EUR')
	})

	test('a clipboard failure resolves false instead of throwing', async ({ page }) => {
		const ok = await onGrid(page, el => {
			const orig = navigator.clipboard.writeText
			navigator.clipboard.writeText = () => Promise.reject(new Error('denied'))
			;(window as unknown as { __execCopyFails?: boolean }).__execCopyFails = true // the fallback fails too
			el.selectRow(0)
			return el.copySelectedRowsToClipboard().finally(() => { navigator.clipboard.writeText = orig })
		})
		expect(ok).toBe(false)
	})
})

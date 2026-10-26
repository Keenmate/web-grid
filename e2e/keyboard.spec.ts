import { test, expect, type Page, gridLocator, cell, onGrid, domEvents, clearEvents, waitForRows, editorIn, dragSelect } from './fixtures'

/**
 * Keyboard navigation in navigate mode — Home / End / PageUp / PageDown and their
 * Ctrl variants, Delete commits null, Ctrl+G go-to-row, Shift+click range
 * extension, `rangeShortcuts`, typing to start an edit (number columns accept
 * digits only — GRID-1).
 *
 * Fixture: docs/test/keyboard.html — 25 rows (id, name "Row NN", qty = id*10,
 * note "nN"); cols 0=id (read-only), 1=name, 2=qty (number), 3=note.
 */

const PAGE = '/test/keyboard.html'

const focused = (page: Page) => onGrid(page, el => {
	const f = el.engine.focusedCell
	return f ? [f.rowIndex, f.colIndex] : null
})
const gotoDialog = (page: Page) => gridLocator(page).locator('.wg__goto-dialog')

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await clearEvents(page, 'keyboard')
})

test.describe('navigation keys', () => {
	test('Home / End move to the first / last column of the row', async ({ page }) => {
		await cell(page, 3, 1).click()
		await page.keyboard.press('End')
		expect(await focused(page)).toEqual([3, 3])
		await expect(cell(page, 3, 3)).toHaveClass(/wg__cell--focused/)
		await page.keyboard.press('Home')
		expect(await focused(page)).toEqual([3, 0])
	})

	test('Ctrl+Home / Ctrl+End jump to the first / last cell of the grid', async ({ page }) => {
		await cell(page, 5, 2).click()
		await page.keyboard.press('Control+End')
		expect(await focused(page)).toEqual([24, 3])
		await expect(cell(page, 24, 3)).toBeFocused()
		await page.keyboard.press('Control+Home')
		expect(await focused(page)).toEqual([0, 0])
		await expect(cell(page, 0, 0)).toBeFocused()
	})

	test('PageDown / PageUp move 10 rows, clamped to the ends', async ({ page }) => {
		await cell(page, 2, 1).click()
		await page.keyboard.press('PageDown')
		expect(await focused(page)).toEqual([12, 1])
		await page.keyboard.press('PageDown')
		await page.keyboard.press('PageDown')
		expect(await focused(page)).toEqual([24, 1])
		await page.keyboard.press('PageUp')
		expect(await focused(page)).toEqual([14, 1])
	})

	test('Ctrl+PageUp / Ctrl+PageDown go to the first / last row, same column', async ({ page }) => {
		await cell(page, 7, 2).click()
		await page.keyboard.press('Control+PageDown')
		expect(await focused(page)).toEqual([24, 2])
		await page.keyboard.press('Control+PageUp')
		expect(await focused(page)).toEqual([0, 2])
	})

	test('arrows stop at the edges', async ({ page }) => {
		await cell(page, 0, 0).click()
		await page.keyboard.press('ArrowUp')
		await page.keyboard.press('ArrowLeft')
		expect(await focused(page)).toEqual([0, 0])
	})
})

test.describe('editing keys', () => {
	test('Delete clears an editable cell (commits null), focus stays', async ({ page }) => {
		await cell(page, 1, 3).click()
		await page.keyboard.press('Delete')
		await expect(cell(page, 1, 3)).toHaveText('')
		expect(await domEvents(page, 'row-change')).toEqual([expect.objectContaining({ rowIndex: 1, field: 'note', oldValue: 'n2', newValue: null })])
		await expect(cell(page, 1, 3)).toBeFocused()
	})

	test('Delete on a read-only cell does nothing', async ({ page }) => {
		await cell(page, 1, 0).click()
		await page.keyboard.press('Delete')
		await expect(cell(page, 1, 0)).toHaveText('2')
		expect(await domEvents(page, 'row-change')).toEqual([])
	})

	test('typing a letter on a text cell starts editing with that letter', async ({ page }) => {
		await cell(page, 0, 1).click()
		await page.keyboard.press('q')
		await expect(editorIn(cell(page, 0, 1))).toBeVisible()
		await expect(editorIn(cell(page, 0, 1))).toHaveValue('q')
	})

	test('typing a digit on a number cell starts editing', async ({ page }) => {
		await cell(page, 0, 2).click()
		await page.keyboard.press('7')
		await expect(editorIn(cell(page, 0, 2))).toBeVisible()
	})

	test('a letter on a number column does not start editing', async ({ page }) => {
		await cell(page, 0, 2).click()
		await page.keyboard.press('a')
		await page.waitForTimeout(150)
		await expect(editorIn(cell(page, 0, 2))).toHaveCount(0)
		expect(await domEvents(page, 'edit-start')).toEqual([])
	})
})

test.describe('Ctrl+G go to row', () => {
	test('opens the dialog; Go focuses the row in the same column', async ({ page }) => {
		await cell(page, 0, 3).click()
		await page.keyboard.press('Control+g')
		await expect(gotoDialog(page)).toBeVisible()
		await expect(gotoDialog(page).locator('.wg__goto-label')).toContainText('1-25')
		await gotoDialog(page).locator('.wg__goto-input').fill('18')
		await gotoDialog(page).locator('.wg__goto-btn--go').click()
		await expect(gotoDialog(page)).toHaveCount(0)
		expect(await focused(page)).toEqual([17, 3])
	})

	test('Enter in the input goes', async ({ page }) => {
		await cell(page, 2, 1).click()
		await page.keyboard.press('Control+g')
		await gotoDialog(page).locator('.wg__goto-input').fill('5')
		await page.keyboard.press('Enter')
		await expect(gotoDialog(page)).toHaveCount(0)
		expect(await focused(page)).toEqual([4, 1])
		await expect(cell(page, 4, 1)).toBeFocused()
	})

	test('Escape closes the dialog and returns focus to the cell', async ({ page }) => {
		await cell(page, 4, 1).click()
		await page.keyboard.press('Control+g')
		await expect(gotoDialog(page)).toBeVisible()
		await page.keyboard.press('Escape')
		await expect(gotoDialog(page)).toHaveCount(0)
		await expect(cell(page, 4, 1)).toBeFocused({ timeout: 1500 })
		await page.waitForTimeout(100)  // the focus-left check runs a frame later
		expect(await focused(page)).toEqual([4, 1])
	})

	test('Cancel returns focus to the cell too', async ({ page }) => {
		await cell(page, 3, 2).click()
		await page.keyboard.press('Control+g')
		await gotoDialog(page).locator('.wg__goto-btn--cancel').click()
		await expect(gotoDialog(page)).toHaveCount(0)
		await expect(cell(page, 3, 2)).toBeFocused({ timeout: 1500 })
		await page.keyboard.press('ArrowDown')
		expect(await focused(page)).toEqual([4, 2])
	})

	test('Meta+G opens the go-to-row dialog (macOS)', async ({ page }) => {
		await cell(page, 0, 1).click()
		await page.keyboard.press('Meta+g')
		await expect(gotoDialog(page)).toBeVisible({ timeout: 1500 })
	})
})

test.describe('range selection from the keyboard', () => {
	test("cellSelectionMode 'shift': Shift+click twice selects the range between the cells", async ({ page }) => {
		await onGrid(page, el => el.setAttribute('cell-selection-mode', 'shift'))
		await cell(page, 1, 1).click({ modifiers: ['Shift'] })
		await cell(page, 3, 2).click({ modifiers: ['Shift'] })
		expect(await onGrid(page, el => el.selectedCellRange && [el.selectedCellRange.startRowIndex, el.selectedCellRange.startColIndex, el.selectedCellRange.endRowIndex, el.selectedCellRange.endColIndex]))
			.toEqual([1, 1, 3, 2])
		await expect(gridLocator(page).locator('.wg__cell--in-range')).toHaveCount(6)
	})

	const rangeOf = (page: Page) => onGrid(page, el => el.selectedCellRange &&
		[el.selectedCellRange.startRowIndex, el.selectedCellRange.startColIndex, el.selectedCellRange.endRowIndex, el.selectedCellRange.endColIndex])

	test('Shift+Arrow extends a range from the focused cell', async ({ page }) => {
		await cell(page, 1, 1).click()
		await page.keyboard.press('Shift+ArrowDown')
		await page.keyboard.press('Shift+ArrowRight')
		await expect.poll(() => onGrid(page, el => el.getSelectedCells().length), { timeout: 1500 }).toBe(4)
		await expect(gridLocator(page).locator('.wg__cell--in-range')).toHaveCount(4)
	})

	test('Shift+Arrow grows and shrinks; the anchor keeps focus', async ({ page }) => {
		await cell(page, 2, 1).click()
		await page.keyboard.press('Shift+ArrowDown')
		await page.keyboard.press('Shift+ArrowDown')
		expect(await rangeOf(page)).toEqual([2, 1, 4, 1])
		await page.keyboard.press('Shift+ArrowUp')
		expect(await rangeOf(page)).toEqual([2, 1, 3, 1])
		// past the anchor: the range flips to the other side
		await page.keyboard.press('Shift+ArrowUp')
		await page.keyboard.press('Shift+ArrowUp')
		expect(await rangeOf(page)).toEqual([2, 1, 1, 1])
		// back onto the anchor → no range
		await page.keyboard.press('Shift+ArrowDown')
		expect(await rangeOf(page)).toBe(null)
		await expect(cell(page, 2, 1)).toBeFocused()
	})

	test('Shift+Home / Shift+End go to the row start / end; Ctrl+Shift+Arrow to the data edge', async ({ page }) => {
		await cell(page, 3, 2).click()
		await page.keyboard.press('Shift+End')
		expect(await rangeOf(page)).toEqual([3, 2, 3, 3])
		await page.keyboard.press('Shift+Home')
		expect(await rangeOf(page)).toEqual([3, 2, 3, 0])
		await page.keyboard.press('Control+Shift+ArrowDown')
		expect(await rangeOf(page)).toEqual([3, 2, 24, 0])
		await page.keyboard.press('Control+Shift+ArrowUp')
		await page.keyboard.press('Control+Shift+ArrowRight')
		expect(await rangeOf(page)).toEqual([3, 2, 0, 3])
		await expect(cell(page, 3, 2)).toBeFocused()
	})

	test("Shift+click extends from the focused cell in 'click' mode (no edit starts)", async ({ page }) => {
		await cell(page, 1, 1).click()
		await cell(page, 3, 3).click({ modifiers: ['Shift'] })
		expect(await rangeOf(page)).toEqual([1, 1, 3, 3])
		await expect(gridLocator(page).locator('.wg__cell--in-range')).toHaveCount(9)
		await expect(cell(page, 1, 1)).toBeFocused()
		expect(await onGrid(page, el => el.editingCell ?? null)).toBe(null)
		// keyboard keeps working from the same anchor
		await page.keyboard.press('Shift+ArrowLeft')
		expect(await rangeOf(page)).toEqual([1, 1, 3, 2])
	})

	test("'disabled' mode: Shift+Arrow and Shift+click select nothing", async ({ page }) => {
		await onGrid(page, el => el.setAttribute('cell-selection-mode', 'disabled'))
		await cell(page, 1, 1).click()
		await page.keyboard.press('Shift+ArrowDown')
		await cell(page, 3, 3).click({ modifiers: ['Shift'] })
		expect(await rangeOf(page)).toBe(null)
	})

	test('while editing, Shift+Arrow selects text in the editor (no range)', async ({ page }) => {
		await cell(page, 1, 1).click()
		await page.keyboard.press('F2')
		const ed = editorIn(cell(page, 1, 1))
		await expect(ed).toBeVisible()
		await ed.evaluate((i: HTMLInputElement) => i.setSelectionRange(0, 0))
		await page.keyboard.press('Shift+ArrowRight')
		await page.keyboard.press('Shift+ArrowRight')
		expect(await ed.evaluate((i: HTMLInputElement) => [i.selectionStart, i.selectionEnd])).toEqual([0, 2])
		expect(await rangeOf(page)).toBe(null)
	})
})

test.describe('rangeShortcuts', () => {
	test('fire on a dragged cell range with { cellRange, cells }', async ({ page }) => {
		await dragSelect(page, 0, 1, 2, 2)
		await page.keyboard.press('Control+Shift+S')
		await expect.poll(() => page.evaluate(() => (window as any).__shortcuts)).toEqual([
			{ id: 'sum', rowIndices: [], rows: [], cells: 6, cellRange: [0, 1, 2, 2] }
		])
		const actions = await domEvents(page, 'action')
		expect(actions).toEqual([expect.objectContaining({ id: 'sum', source: 'keyboard' })])
	})

	test('fire on a row selection with { rows, rowIndices }', async ({ page }) => {
		const rn = (r: number) => gridLocator(page).locator(`.wg__row-number[data-row-number="${r}"]`)
		await rn(2).click()
		await rn(4).click({ modifiers: ['Shift'] })
		await page.keyboard.press('Control+Shift+S')
		await expect.poll(() => page.evaluate(() => (window as any).__shortcuts)).toEqual([
			{ id: 'sum', rowIndices: [2, 3, 4], rows: [3, 4, 5], cells: 0, cellRange: null }
		])
	})

	test('a disabled range shortcut does not fire', async ({ page }) => {
		await dragSelect(page, 0, 1, 1, 1)
		await page.keyboard.press('Control+Shift+X')
		await page.waitForTimeout(150)
		expect(await page.evaluate(() => (window as any).__shortcuts)).toEqual([])
		expect(await domEvents(page, 'action')).toEqual([])
	})

	test('without a selection the range shortcut does nothing', async ({ page }) => {
		await cell(page, 0, 1).click()
		await page.keyboard.press('Control+Shift+S')
		await page.waitForTimeout(150)
		expect(await page.evaluate(() => (window as any).__shortcuts)).toEqual([])
	})
})

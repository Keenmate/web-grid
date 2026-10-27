import { test, expect, Page, gridLocator, cell, header, dragSelect } from './fixtures'

/**
 * E2E coverage for selection (docs/test/selection.html) — an 8-row / 4-col grid
 * in navigate mode with cellSelectionMode='click' and row numbers visible.
 *
 * Covers:
 *  - row selection via clicks on .wg__row-number cells (replace / Ctrl-toggle /
 *    Shift-range)
 *  - column selection via Shift+click on a header
 *  - cell range selection via click+drag across data cells
 *  - row focus via a plain cell click (onRowFocus)
 *
 * State is read from three data-testid nodes — see selection.html for the seed
 * table. selectedRows is polled (no change event), so a couple of assertions
 * use expect.poll / a tolerant matcher.
 */

const PAGE = '/test/selection.html'
const GRID = 'web-grid#grid'

function rowNumber(page: Page, rowIndex: number) {
	return gridLocator(page).locator(`.wg__row-number[data-row-number="${rowIndex}"]`)
}

const selectedRows = (page: Page) => page.locator('[data-testid="selected-rows"]')
const selectedCells = (page: Page) => page.locator('[data-testid="selected-cells"]')
const focusedRow = (page: Page) => page.locator('[data-testid="focused-row"]')

async function gotoSelection(page: Page) {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
}

// =============================================================================
// Row selection
// =============================================================================

test.describe('row selection (via row-number clicks)', () => {
	test('clicking a row number selects that single row', async ({ page }) => {
		await gotoSelection(page)

		await rowNumber(page, 0).click()
		await expect(selectedRows(page)).toHaveText('0')
	})

	test('clicking a different row number replaces the selection', async ({ page }) => {
		await gotoSelection(page)

		await rowNumber(page, 0).click()
		await expect(selectedRows(page)).toHaveText('0')

		await rowNumber(page, 3).click()
		await expect(selectedRows(page)).toHaveText('3')
	})

	test('Ctrl+click toggles a row into / out of the selection', async ({ page }) => {
		await gotoSelection(page)

		await rowNumber(page, 0).click()
		await rowNumber(page, 2).click({ modifiers: ['Control'] })
		// selectedRows is reported sorted ascending.
		await expect(selectedRows(page)).toHaveText('0, 2')

		// Ctrl+click row 2 again removes it.
		await rowNumber(page, 2).click({ modifiers: ['Control'] })
		await expect(selectedRows(page)).toHaveText('0')
	})

	test('Shift+click selects a contiguous range from the last selected row', async ({ page }) => {
		await gotoSelection(page)

		await rowNumber(page, 1).click()
		await rowNumber(page, 4).click({ modifiers: ['Shift'] })

		await expect(selectedRows(page)).toHaveText('1, 2, 3, 4')
	})

	test('Escape clears the row selection', async ({ page }) => {
		await gotoSelection(page)

		await rowNumber(page, 0).click()
		await expect(selectedRows(page)).toHaveText('0')

		await page.keyboard.press('Escape')
		await expect(selectedRows(page)).toHaveText('none')
	})
})

// =============================================================================
// Column selection
// =============================================================================

test.describe('column selection (via Shift+click on a header)', () => {
	test('Shift+click on a header marks the header and its cells as selected', async ({ page }) => {
		await gotoSelection(page)

		await header(page, 'name').click({ modifiers: ['Shift'] })

		await expect(header(page, 'name')).toHaveClass(/wg__header--selected/)
		// Body cells in that column pick up the column-selected modifier.
		await expect(cell(page, 0, 1)).toHaveClass(/wg__cell--column-selected/)
		await expect(cell(page, 5, 1)).toHaveClass(/wg__cell--column-selected/)
		// A different column is untouched.
		await expect(cell(page, 0, 2)).not.toHaveClass(/wg__cell--column-selected/)
	})

	test('Escape clears the column selection', async ({ page }) => {
		await gotoSelection(page)

		await header(page, 'name').click({ modifiers: ['Shift'] })
		await expect(header(page, 'name')).toHaveClass(/wg__header--selected/)

		await page.keyboard.press('Escape')
		await expect(header(page, 'name')).not.toHaveClass(/wg__header--selected/)
	})
})

// =============================================================================
// Cell range selection
// =============================================================================

test.describe('cell range selection (click+drag)', () => {
	test('dragging across cells selects a rectangular range', async ({ page }) => {
		await gotoSelection(page)

		// Drag from (row 0, col 1) to (row 2, col 2) → a 3×2 = 6-cell range.
		await dragSelect(page, 0, 1, 2, 2)

		await expect(selectedCells(page)).toHaveText('6')
		// Cells inside the range pick up the in-range modifier.
		await expect(cell(page, 1, 1)).toHaveClass(/wg__cell--in-range/)
		await expect(cell(page, 2, 2)).toHaveClass(/wg__cell--in-range/)
		// A cell outside the range does not.
		await expect(cell(page, 3, 1)).not.toHaveClass(/wg__cell--in-range/)
	})

	test('starting a new drag replaces the previous range', async ({ page }) => {
		await gotoSelection(page)

		// First range: (0,1)→(1,2) = 4 cells.
		await dragSelect(page, 0, 1, 1, 2)
		await expect(selectedCells(page)).toHaveText('4')

		// A fresh drag elsewhere clears the old range and selects the new one:
		// (3,2)→(5,3) = 3 rows × 2 cols = 6 cells.
		await dragSelect(page, 3, 2, 5, 3)
		await expect(selectedCells(page)).toHaveText('6')

		// None of the original range's cells stay marked.
		await expect(cell(page, 0, 1)).not.toHaveClass(/wg__cell--in-range/)
		await expect(cell(page, 4, 2)).toHaveClass(/wg__cell--in-range/)
	})
})

// =============================================================================
// Row focus
// =============================================================================

test.describe('row focus (onRowFocus)', () => {
	test('keyboard navigation moves row focus and fires onRowFocus', async ({ page }) => {
		await gotoSelection(page)

		await expect(focusedRow(page)).toHaveText('none')

		// A plain click can race with the cell-selection pending state (see the
		// note in basic.spec) — it establishes a focused cell, but arrow-key
		// navigation is what fires onRowFocus reliably.
		await cell(page, 0, 1).click()
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('ArrowDown')
		await expect(focusedRow(page)).toHaveText('2 — Carol')

		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('ArrowDown')
		await expect(focusedRow(page)).toHaveText('5 — Frank')
	})
})

// =============================================================================
// Cell range with reordered + hidden columns — ranges span VISUAL positions
// =============================================================================
// Columns id(0) name(1) secret(2, hidden) dept(3) salary(4) (data-col in brackets),
// reordered to salary | name | id | dept. A range must be the on-screen rectangle:
// highlight, border and getSelectedCells agree; cells report their data-col.

test.describe('cell range with reordered + hidden columns', () => {
	async function setup(page: Page) {
		await gotoSelection(page)
		await gridLocator(page).evaluate(async (el: any) => {
			el.columns = [
				{ field: 'id', title: 'ID', width: '70px' },
				{ field: 'name', title: 'Name', width: '160px' },
				{ field: 'secret', title: 'Secret', width: '90px', isHidden: true },
				{ field: 'dept', title: 'Dept', width: '120px' },
				{ field: 'salary', title: 'Salary', width: '110px' }
			]
			el.setColumnOrder([
				{ field: 'salary', order: 0 }, { field: 'name', order: 1 },
				{ field: 'id', order: 2 }, { field: 'dept', order: 3 }
			])
			await el.whenSettled?.()
		})
		await expect(header(page, 'secret')).toHaveCount(0)
		const order = await gridLocator(page).locator('tbody tr[data-row-index="0"] td.wg__cell[data-col]')
			.evaluateAll(els => els.map(el => (el as HTMLElement).dataset.col))
		expect(order).toEqual(['4', '1', '0', '3'])
	}
	const selected = (page: Page) => gridLocator(page).evaluate((el: any) =>
		el.getSelectedCells().map((c: any) => `${c.rowIndex}:${c.colIndex}:${c.field}`))
	const inRangeCols = (page: Page, row: number) => gridLocator(page)
		.locator(`tbody tr[data-row-index="${row}"] td.wg__cell--in-range`)
		.evaluateAll(els => els.map(el => (el as HTMLElement).dataset.col))

	async function expectBorderSpans(page: Page, fromRow: number, fromCol: number, toRow: number, toCol: number) {
		const border = await gridLocator(page).locator('.wg__cell-range-border').boundingBox()
		const a = await cell(page, fromRow, fromCol).boundingBox()
		const b = await cell(page, toRow, toCol).boundingBox()
		if (!border || !a || !b) throw new Error('missing box')
		expect(Math.abs(border.x - a.x)).toBeLessThan(3)
		expect(Math.abs(border.x + border.width - (b.x + b.width))).toBeLessThan(3)
	}

	test('drag name → id (adjacent on screen, data-col 1 → 0)', async ({ page }) => {
		await setup(page)
		await dragSelect(page, 0, 1, 1, 0)
		expect(await selected(page)).toEqual(['0:1:name', '0:0:id', '1:1:name', '1:0:id'])
		expect(await inRangeCols(page, 0)).toEqual(['1', '0'])
		expect(await inRangeCols(page, 1)).toEqual(['1', '0'])
		await expectBorderSpans(page, 0, 1, 1, 0)
	})

	test('drag dept → salary spans every visible column in between', async ({ page }) => {
		await setup(page)
		await dragSelect(page, 0, 3, 1, 4)
		expect(await selected(page)).toEqual([
			'0:4:salary', '0:1:name', '0:0:id', '0:3:dept',
			'1:4:salary', '1:1:name', '1:0:id', '1:3:dept'
		])
		expect(await inRangeCols(page, 0)).toEqual(['4', '1', '0', '3'])
		expect(await inRangeCols(page, 2)).toEqual([])
		await expectBorderSpans(page, 0, 4, 1, 3)
	})

	test('Shift+ArrowRight from name extends to id (the next column on screen)', async ({ page }) => {
		await setup(page)
		await cell(page, 0, 1).click()
		await page.keyboard.press('Shift+ArrowRight')
		await expect.poll(() => selected(page)).toEqual(['0:1:name', '0:0:id'])
		await page.keyboard.press('Shift+ArrowDown')
		await expect.poll(() => selected(page)).toEqual(['0:1:name', '0:0:id', '1:1:name', '1:0:id'])
		await expect.poll(() => inRangeCols(page, 1)).toEqual(['1', '0'])
		await expectBorderSpans(page, 0, 1, 1, 0)
	})
})

// =============================================================================
// Column selection with reordered + hidden columns — same convention as ranges
// =============================================================================
// Same layout as above: on screen salary(4) | name(1) | id(0) | dept(3), secret(2)
// hidden. The API takes / returns column indices (index into `columns`); the
// selection itself is the on-screen set; events report fields in on-screen order.

test.describe('column selection with reordered + hidden columns', () => {
	async function setup(page: Page) {
		await gotoSelection(page)
		await gridLocator(page).evaluate(async (el: any) => {
			el.columns = [
				{ field: 'id', title: 'ID', width: '70px' },
				{ field: 'name', title: 'Name', width: '160px' },
				{ field: 'secret', title: 'Secret', width: '90px', isHidden: true },
				{ field: 'dept', title: 'Dept', width: '120px' },
				{ field: 'salary', title: 'Salary', width: '110px' }
			]
			el.setColumnOrder([
				{ field: 'salary', order: 0 }, { field: 'name', order: 1 },
				{ field: 'id', order: 2 }, { field: 'dept', order: 3 }
			])
			await el.whenSettled?.()
			;(window as any).__colEvents = []
			el.addEventListener('column-selection-change', (e: any) => (window as any).__colEvents.push(e.detail.fields))
		})
		await expect(header(page, 'secret')).toHaveCount(0)
	}
	const selectedHeaders = (page: Page) => gridLocator(page).locator('thead th.wg__header--selected')
		.evaluateAll(els => els.map(el => (el as HTMLElement).dataset.field))
	const selectedCellCols = (page: Page) => gridLocator(page)
		.locator('tbody tr[data-row-index="0"] td.wg__cell--column-selected')
		.evaluateAll(els => els.map(el => (el as HTMLElement).dataset.col))
	const api = (page: Page) => gridLocator(page).evaluate((el: any) => ({
		columns: el.controller.getSelectedColumns(),
		isIdSelected: el.controller.isColumnSelected(0),
		isSalarySelected: el.controller.isColumnSelected(4),
		events: (window as any).__colEvents
	}))

	test('controller.selectColumn(colIndex) selects that column (index into columns), not the on-screen slot', async ({ page }) => {
		await setup(page)
		await gridLocator(page).evaluate((el: any) => el.controller.selectColumn(0))  // id — on screen third
		await expect.poll(() => selectedHeaders(page)).toEqual(['id'])
		expect(await selectedCellCols(page)).toEqual(['0'])
		expect(await api(page)).toEqual({ columns: [0], isIdSelected: true, isSalarySelected: false, events: [['id']] })
	})

	test('controller.selectColumnRange(4, 1) spans the on-screen columns salary → name', async ({ page }) => {
		await setup(page)
		await gridLocator(page).evaluate((el: any) => el.controller.selectColumnRange(4, 1))
		await expect.poll(() => selectedHeaders(page)).toEqual(['salary', 'name'])
		expect(await selectedCellCols(page)).toEqual(['4', '1'])
		expect((await api(page)).columns).toEqual([1, 4])
		expect((await api(page)).events).toEqual([['salary', 'name']])
	})

	test('header click name, Shift+click id → the adjacent on-screen pair; API reports column indices', async ({ page }) => {
		await setup(page)
		await header(page, 'name').click()
		await header(page, 'id').click({ modifiers: ['Shift'] })
		await expect.poll(() => selectedHeaders(page)).toEqual(['name', 'id'])
		expect(await selectedCellCols(page)).toEqual(['1', '0'])
		expect(await api(page)).toEqual({ columns: [0, 1], isIdSelected: true, isSalarySelected: false, events: [['name'], ['name', 'id']] })
	})
})

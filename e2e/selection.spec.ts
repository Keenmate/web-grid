import { test, expect, Page } from '@playwright/test'

/**
 * E2E coverage for selection (docs/test/selection.html) — an 8-row / 4-col grid
 * in navigate mode with cellSelectionMode='click' and row numbers visible.
 *
 * Covers:
 *  - row selection via clicks on .wg__row-number cells (replace / Ctrl-toggle /
 *    Shift-range)
 *  - column selection via Shift+click on a header
 *  - cell range selection via click+drag across data cells
 *  - row focus via a plain cell click (onrowfocus)
 *
 * State is read from three data-testid nodes — see selection.html for the seed
 * table. selectedRows is polled (no change event), so a couple of assertions
 * use expect.poll / a tolerant matcher.
 */

const PAGE = '/test/selection.html'
const GRID = 'web-grid#grid'

function gridLocator(page: Page) {
	return page.locator(GRID)
}

function cell(page: Page, rowIndex: number, colIndex: number) {
	return gridLocator(page).locator(`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`)
}

function rowNumber(page: Page, rowIndex: number) {
	return gridLocator(page).locator(`.wg__row-number[data-row-number="${rowIndex}"]`)
}

function header(page: Page, field: string) {
	return gridLocator(page).locator(`thead th.wg__header[data-field="${field}"]`)
}

const selectedRows = (page: Page) => page.locator('[data-testid="selected-rows"]')
const selectedCells = (page: Page) => page.locator('[data-testid="selected-cells"]')
const focusedRow = (page: Page) => page.locator('[data-testid="focused-row"]')

/**
 * Drag-select a cell range from cell (fromRow,fromCol) to (toRow,toCol) using
 * mouse primitives — the cell-selection module listens for mousemove/mouseup at
 * the document level, so page.mouse works without shadow piercing. A couple of
 * intermediate steps keep the drag continuous.
 */
async function dragSelect(page: Page, fromRow: number, fromCol: number, toRow: number, toCol: number) {
	const from = await cell(page, fromRow, fromCol).boundingBox()
	const to = await cell(page, toRow, toCol).boundingBox()
	if (!from || !to) throw new Error('Cell bounding box missing')
	const sx = from.x + from.width / 2
	const sy = from.y + from.height / 2
	const dx = to.x + to.width / 2
	const dy = to.y + to.height / 2

	await page.mouse.move(sx, sy)
	await page.mouse.down()
	await page.mouse.move((sx + dx) / 2, (sy + dy) / 2, { steps: 5 })
	await page.mouse.move(dx, dy, { steps: 5 })
	await page.mouse.up()
}

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

test.describe('row focus (onrowfocus)', () => {
	test('keyboard navigation moves row focus and fires onrowfocus', async ({ page }) => {
		await gotoSelection(page)

		await expect(focusedRow(page)).toHaveText('none')

		// A plain click can race with the cell-selection pending state (see the
		// note in basic.spec) — it establishes a focused cell, but arrow-key
		// navigation is what fires onrowfocus reliably.
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

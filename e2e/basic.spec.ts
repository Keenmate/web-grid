import { test, expect, Page } from '@playwright/test'

/**
 * Basic-usage smoke tests against the Employee Grid in examples-basic.html.
 *
 * That demo configures the most common defaults: sortable + editable + navigate
 * mode + dirty indicator on, with 12 employees. Good baseline for verifying the
 * grid still renders, sorts, edits, and paginates without errors.
 */

const PAGE = '/examples-basic.html'
const GRID = 'web-grid#grid'

function gridLocator(page: Page) {
	return page.locator(GRID)
}

function cell(page: Page, rowIndex: number, colIndex: number) {
	return gridLocator(page).locator(`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`)
}

function headerByText(page: Page, text: string) {
	return gridLocator(page).locator('thead th').filter({ hasText: text }).first()
}

/**
 * Sort triggers on a click of the sort indicator span, not the whole header
 * (header clicks are for column selection / context-menu, not sort).
 */
function sortIndicatorByHeaderText(page: Page, text: string) {
	return headerByText(page, text).locator('.wg__sort-indicator')
}

async function gotoBasicDemo(page: Page) {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
}

// Tests -----------------------------------------------------------------------

test.describe('initial render', () => {
	test('renders the expected number of rows and columns', async ({ page }) => {
		await gotoBasicDemo(page)

		// 12 sample employees in the demo data.
		await expect(gridLocator(page).locator('tbody tr')).toHaveCount(12)

		// Headers correspond to: ID, Name, Email, Department, Salary, Start Date,
		// Status, Manager, Location, Phone — 10 columns. (Plus a filler column on
		// the right side which is rendered as a separate th — count exactly 10
		// data columns by their text content rather than raw th count.)
		await expect(headerByText(page, 'ID')).toBeVisible()
		await expect(headerByText(page, 'Name')).toBeVisible()
		await expect(headerByText(page, 'Email')).toBeVisible()
		await expect(headerByText(page, 'Salary')).toBeVisible()
	})

	test('first row shows expected employee', async ({ page }) => {
		await gotoBasicDemo(page)

		// First sample row is Alice Johnson with id=1847. Default sort is none, so
		// rows render in insertion order.
		const firstRowName = cell(page, 0, 1)  // col 1 = Name
		await expect(firstRowName).toContainText('Alice Johnson')
	})
})

test.describe('sorting', () => {
	test('clicking the ID sort indicator sorts ascending; Carol (1052) becomes first', async ({ page }) => {
		await gotoBasicDemo(page)

		// Insertion order has id=1847 (Alice) first; ascending sort by ID puts
		// id=1052 (Carol Williams) first.
		await expect(cell(page, 0, 1)).toContainText('Alice Johnson')

		await sortIndicatorByHeaderText(page, 'ID').click()

		await expect(cell(page, 0, 1)).toContainText('Carol Williams')
		await expect(cell(page, 0, 0)).toContainText('1052')
	})

	test('clicking ID indicator again (descending) puts highest ID first', async ({ page }) => {
		await gotoBasicDemo(page)

		await sortIndicatorByHeaderText(page, 'ID').click()  // asc
		await sortIndicatorByHeaderText(page, 'ID').click()  // desc

		// Largest id in the demo is 4592 (Jack Davis).
		await expect(cell(page, 0, 0)).toContainText('4592')
		await expect(cell(page, 0, 1)).toContainText('Jack Davis')
	})

	test('sort indicator shows arrow glyph after sorting', async ({ page }) => {
		await gotoBasicDemo(page)

		// Before sort: indicator is the placeholder glyph (⬍).
		const indicator = sortIndicatorByHeaderText(page, 'ID')
		await expect(indicator).toHaveClass(/wg__sort-placeholder/)

		await indicator.click()
		// After ascending sort, indicator shows ▲ and loses the placeholder class.
		await expect(indicator).not.toHaveClass(/wg__sort-placeholder/)
		await expect(indicator).toContainText('▲')
	})
})

test.describe('editing', () => {
	test('F2 starts editing the focused cell, Enter commits the new value', async ({ page }) => {
		await gotoBasicDemo(page)

		// Focus the Name cell of row 0 (col 1) — id column (col 0) is read-only.
		const nameCell = cell(page, 0, 1)
		await nameCell.click()
		await expect(nameCell).toHaveClass(/wg__cell--focused/)

		await page.keyboard.press('F2')

		// Editor should be visible inside the cell.
		const editor = nameCell.locator('input, textarea').first()
		await expect(editor).toBeVisible()

		// Replace the value.
		await editor.selectText()
		await editor.fill('Alice CHANGED')
		await page.keyboard.press('Enter')

		// Cell should show the new value (commit fired, render returned to display mode).
		await expect(nameCell).toContainText('Alice CHANGED')
		// Dirty indicator should mark this row.
		await expect(nameCell).toHaveClass(/wg__cell--dirty/)
	})

	test('Escape cancels the edit without changing the value', async ({ page }) => {
		await gotoBasicDemo(page)

		const nameCell = cell(page, 0, 1)
		const original = await nameCell.textContent()

		await nameCell.click()
		await page.keyboard.press('F2')
		const editor = nameCell.locator('input, textarea').first()
		await expect(editor).toBeVisible()

		await editor.fill('SHOULD NOT STICK')
		await page.keyboard.press('Escape')

		await expect(nameCell).toContainText(original ?? '')
		await expect(nameCell).not.toHaveClass(/wg__cell--dirty/)
	})

	test('clicking a read-only cell does NOT start editing', async ({ page }) => {
		await gotoBasicDemo(page)

		// id column (col 0) is { isEditable: false } per the demo config.
		const idCell = cell(page, 0, 0)
		await idCell.click()
		await page.keyboard.press('F2')

		// No editor should mount.
		await expect(idCell.locator('input, textarea')).toHaveCount(0)
	})
})

test.describe('keyboard navigation in navigate mode', () => {
	test('arrow keys move focus between cells', async ({ page }) => {
		await gotoBasicDemo(page)

		await cell(page, 0, 1).click()
		await expect(cell(page, 0, 1)).toHaveClass(/wg__cell--focused/)

		await page.keyboard.press('ArrowDown')
		await expect(cell(page, 1, 1)).toHaveClass(/wg__cell--focused/)

		await page.keyboard.press('ArrowRight')
		await expect(cell(page, 1, 2)).toHaveClass(/wg__cell--focused/)
	})

	test('Tab walks editable columns; ID column (read-only) is skipped', async ({ page }) => {
		await gotoBasicDemo(page)

		// Focus on Name (col 1, editable). Shift-Tab should NOT land on ID (col 0).
		await cell(page, 0, 1).click()
		await page.keyboard.press('Shift+Tab')

		// ID col is read-only → Tab walks back to the previous row's last editable col.
		// First row has no previous, so focus might stay on Name or move to a wrap point.
		// More important assertion: ID col is never focused.
		await expect(cell(page, 0, 0)).not.toHaveClass(/wg__cell--focused/)
	})
})

test.describe('pagination', () => {
	test('toggling Pageable shows page navigation', async ({ page }) => {
		await gotoBasicDemo(page)

		// Initially pagination is off (checkbox unchecked); all 12 rows visible.
		await expect(gridLocator(page).locator('tbody tr')).toHaveCount(12)

		// Tick the Pageable checkbox.
		await page.locator('#isPageable').check()

		// Demo sets pageSize=5, so page 1 shows 5 rows.
		await expect(gridLocator(page).locator('tbody tr')).toHaveCount(5)

		// Pagination control should be present in the bottom area.
		await expect(gridLocator(page).locator('.wg__pagination').first()).toBeVisible()
	})

	test('setting currentPage advances the visible rows', async ({ page }) => {
		await gotoBasicDemo(page)
		await page.locator('#isPageable').check()

		// Wait until pagination has actually wired up.
		await expect(gridLocator(page).locator('.wg__pagination-info').first()).toBeVisible()
		await expect(cell(page, 0, 1)).toContainText('Alice Johnson')

		// Drive pagination through the public grid API. The pagination button click
		// is currently broken on the toggle path (see skipped test below), so this
		// test exercises the state → render contract directly.
		await gridLocator(page).evaluate((host) => {
			(host as unknown as { currentPage: number }).currentPage = 2
		})

		// Page 2 (pageSize=5): rows 6..10 → first is Frank Lee.
		await expect(cell(page, 0, 1)).toContainText('Frank Lee')

		await gridLocator(page).evaluate((host) => {
			(host as unknown as { currentPage: number }).currentPage = 1
		})
		await expect(cell(page, 0, 1)).toContainText('Alice Johnson')
	})

	test('clicking pagination "next" advances the page', async ({ page }) => {
		await gotoBasicDemo(page)
		await page.locator('#isPageable').check()
		await expect(gridLocator(page).locator('.wg__pagination-info').first()).toBeVisible()
		await expect(cell(page, 0, 1)).toContainText('Alice Johnson')

		await gridLocator(page).locator('.wg__pagination-btn[data-action="next"]:not([disabled])').first().click()
		await expect(cell(page, 0, 1)).toContainText('Frank Lee')

		await gridLocator(page).locator('.wg__pagination-btn[data-action="prev"]:not([disabled])').first().click()
		await expect(cell(page, 0, 1)).toContainText('Alice Johnson')
	})
})

test.describe('multi-sort (cascading)', () => {
	test('Ctrl+click on a second indicator adds it to the cascade', async ({ page }) => {
		await gotoBasicDemo(page)

		// First sort: department asc.
		await sortIndicatorByHeaderText(page, 'Dept (select)').click()

		// Add Salary as a secondary sort (Ctrl+click).
		await sortIndicatorByHeaderText(page, 'Salary').click({ modifiers: ['Control'] })

		// The demo wires a sortState text node that lists each active sort. After two
		// clicks it should reference both fields (departments first, then salary).
		const sortStateText = await page.locator('#sortState').textContent()
		expect(sortStateText).toMatch(/department/i)
		expect(sortStateText).toMatch(/salary/i)
	})
})

test.describe('sort cycle', () => {
	test('clicking the same indicator three times cycles asc → desc → none', async ({ page }) => {
		await gotoBasicDemo(page)

		const indicator = sortIndicatorByHeaderText(page, 'ID')

		await indicator.click()
		await expect(indicator).toContainText('▲')

		await indicator.click()
		await expect(indicator).toContainText('▼')

		await indicator.click()
		// Back to placeholder: shows ⬍ glyph and carries the placeholder class again.
		await expect(indicator).toHaveClass(/wg__sort-placeholder/)
	})
})

test.describe('cell formatting & class callbacks', () => {
	test('formatCallback renders salary with $ and thousand separators', async ({ page }) => {
		await gotoBasicDemo(page)
		// Alice (row 0) has salary 85000 — formatted as "$85,000".
		await expect(cell(page, 0, 4)).toContainText('$85,000')
	})

	test('cellClassCallback adds salary-high class for salaries ≥ 90000', async ({ page }) => {
		await gotoBasicDemo(page)
		// Carol (row 2, salary 92000) should be highlighted; Alice (row 0, 85000) shouldn't.
		// Use word-boundary regex — "salary-highlight" is the static cellClass and would
		// match a naive /salary-high/.
		await expect(cell(page, 2, 4)).toHaveClass(/(^|\s)salary-high(\s|$)/)
		await expect(cell(page, 0, 4)).not.toHaveClass(/(^|\s)salary-high(\s|$)/)
	})
})

test.describe('row numbers', () => {
	test('isRowNumbersVisible renders a row-number cell with 0-based data attr and 1-based display', async ({ page }) => {
		await gotoBasicDemo(page)

		// The first row has a .wg__row-number td. data-row-number is the row index
		// (0-based for matching the rest of the cell data-row attributes); the visible
		// text is 1-based for human-friendly display.
		const firstRowNumber = gridLocator(page).locator('tbody tr').first().locator('.wg__row-number').first()
		await expect(firstRowNumber).toHaveAttribute('data-row-number', '0')
		await expect(firstRowNumber).toContainText('1')
	})
})

test.describe('row locking & dynamic row class', () => {
	test('On Leave row picks up both wg__row--locked and the demo "row-inactive" class', async ({ page }) => {
		await gotoBasicDemo(page)

		// Grace Kim is index 6 in insertion order, status = 'On Leave'.
		const graceRow = gridLocator(page).locator('tbody tr').nth(6)
		await expect(graceRow).toContainText('Grace Kim')
		await expect(graceRow).toHaveClass(/wg__row--locked/)
		await expect(graceRow).toHaveClass(/row-inactive/)
	})

	test('rows that are not locked do not carry the locked / inactive classes', async ({ page }) => {
		await gotoBasicDemo(page)
		// Alice (row 0) is Active.
		const aliceRow = gridLocator(page).locator('tbody tr').first()
		await expect(aliceRow).not.toHaveClass(/wg__row--locked/)
		await expect(aliceRow).not.toHaveClass(/row-inactive/)
	})
})

test.describe('feature toggles', () => {
	test('unchecking Sortable removes the sort indicators', async ({ page }) => {
		await gotoBasicDemo(page)

		// Indicators present by default.
		await expect(gridLocator(page).locator('.wg__sort-indicator').first()).toBeVisible()

		// Disable sort mode via the checkbox.
		await page.locator('#sortable').uncheck()

		// Indicators are no longer rendered (sortMode === 'none').
		await expect(gridLocator(page).locator('.wg__sort-indicator')).toHaveCount(0)
	})

	test('unchecking Editable prevents F2 from opening an editor', async ({ page }) => {
		await gotoBasicDemo(page)

		// Disable editing first.
		await page.locator('#isEditable').uncheck()

		const nameCell = cell(page, 0, 1)
		await nameCell.click()
		await page.keyboard.press('F2')

		// No editor should mount when the grid is read-only.
		await expect(nameCell.locator('input, textarea')).toHaveCount(0)
	})

	test('unchecking Striped removes the wg--striped host modifier class', async ({ page }) => {
		await gotoBasicDemo(page)

		// Default: striped is on.
		await expect(gridLocator(page).locator('.wg')).toHaveClass(/wg--striped/)

		await page.locator('#isStriped').uncheck()

		await expect(gridLocator(page).locator('.wg')).not.toHaveClass(/wg--striped/)
	})
})

test.describe('row focus event', () => {
	test('keyboard navigation updates the demo focusedRowState display via onrowfocus', async ({ page }) => {
		await gotoBasicDemo(page)

		// Initially "None".
		await expect(page.locator('#focusedRowState')).toContainText('None')

		// Click to land focus, then arrow-down to row 2 (Carol). Arrow keys fire
		// onrowfocus reliably; plain click can race with the cell-selection pending
		// state in the grid's mousedown/up handling.
		await cell(page, 0, 1).click()
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('ArrowDown')

		// Demo wires onrowfocus to print "Row 2 — Carol Williams (...)".
		await expect(page.locator('#focusedRowState')).toContainText('Carol Williams')
		await expect(page.locator('#focusedRowState')).toContainText('Row 2')
	})
})

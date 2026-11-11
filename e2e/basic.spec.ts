import { test, expect, Page, gridLocator, cell } from './fixtures'

/**
 * Basic-usage smoke tests against the dedicated fixture page
 * test/basic.html.
 *
 * The fixture is an 8-row, 5-column grid (id, name, email, salary, status) in
 * navigate mode with sorting + editing + dirty indicator on. It surfaces sort
 * state and focused-row state through data-testid nodes, and exposes four
 * feature-toggle checkboxes (#striped, #sortable, #editable, #pageable). See
 * the comment block in basic.html for the full seed-data table.
 */

const PAGE = '/test/basic.html'
const GRID = 'web-grid#grid'

// Column indices in the fixture: 0=id, 1=name, 2=email, 3=salary, 4=status.
const COL = { id: 0, name: 1, email: 2, salary: 3, status: 4 } as const

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

async function gotoBasic(page: Page) {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
}

// Tests -----------------------------------------------------------------------

test.describe('initial render', () => {
	test('renders the expected number of rows and columns', async ({ page }) => {
		await gotoBasic(page)

		// 8 seed rows.
		await expect(gridLocator(page).locator('tbody tr')).toHaveCount(8)

		// Five data columns: ID, Name, Email, Salary, Status.
		await expect(headerByText(page, 'ID')).toBeVisible()
		await expect(headerByText(page, 'Name')).toBeVisible()
		await expect(headerByText(page, 'Email')).toBeVisible()
		await expect(headerByText(page, 'Salary')).toBeVisible()
		await expect(headerByText(page, 'Status')).toBeVisible()
	})

	test('first row shows the first seed employee', async ({ page }) => {
		await gotoBasic(page)

		// Default sort is none, so rows render in insertion order — Alice first.
		await expect(cell(page, 0, COL.name)).toContainText('Alice Johnson')
	})
})

test.describe('sorting', () => {
	test('clicking the ID sort indicator sorts ascending; Carol (1052) becomes first', async ({ page }) => {
		await gotoBasic(page)

		await expect(cell(page, 0, COL.name)).toContainText('Alice Johnson')

		await sortIndicatorByHeaderText(page, 'ID').click()

		// Ascending id: lowest is 1052 (Carol Williams).
		await expect(cell(page, 0, COL.name)).toContainText('Carol Williams')
		await expect(cell(page, 0, COL.id)).toContainText('1052')
	})

	test('clicking ID indicator again (descending) puts highest ID first', async ({ page }) => {
		await gotoBasic(page)

		await sortIndicatorByHeaderText(page, 'ID').click()  // asc
		await sortIndicatorByHeaderText(page, 'ID').click()  // desc

		// Largest id in the seed is 4592 (Grace Kim).
		await expect(cell(page, 0, COL.id)).toContainText('4592')
		await expect(cell(page, 0, COL.name)).toContainText('Grace Kim')
	})

	test('sort indicator shows arrow glyph after sorting', async ({ page }) => {
		await gotoBasic(page)

		// Before sort: indicator is the placeholder glyph (⬍).
		const indicator = sortIndicatorByHeaderText(page, 'ID')
		await expect(indicator).toHaveClass(/wg__sort-placeholder/)

		await indicator.click()
		// After ascending sort, indicator shows ▲ and loses the placeholder class.
		await expect(indicator).not.toHaveClass(/wg__sort-placeholder/)
		await expect(indicator).toContainText('▲')
	})

	test('the sort-state hook reflects the active sort', async ({ page }) => {
		await gotoBasic(page)

		const sortState = page.locator('[data-testid="sort-state"]')
		await expect(sortState).toHaveText('none')

		await sortIndicatorByHeaderText(page, 'ID').click()
		await expect(sortState).toContainText('id:asc')
	})
})

test.describe('editing', () => {
	test('F2 starts editing the focused cell, Enter commits the new value', async ({ page }) => {
		await gotoBasic(page)

		// Focus the Name cell of row 0 — id column is read-only.
		const nameCell = cell(page, 0, COL.name)
		await nameCell.click()
		await expect(nameCell).toHaveClass(/wg__cell--focused/)

		await page.keyboard.press('F2')

		const editor = nameCell.locator('input, textarea').first()
		await expect(editor).toBeVisible()

		await editor.selectText()
		await editor.fill('Alice CHANGED')
		await page.keyboard.press('Enter')

		await expect(nameCell).toContainText('Alice CHANGED')
		// Dirty indicator should mark this cell.
		await expect(nameCell).toHaveClass(/wg__cell--dirty/)
	})

	test('Escape cancels the edit without changing the value', async ({ page }) => {
		await gotoBasic(page)

		const nameCell = cell(page, 0, COL.name)
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
		await gotoBasic(page)

		// id column is { isEditable: false }.
		const idCell = cell(page, 0, COL.id)
		await idCell.click()
		await page.keyboard.press('F2')

		await expect(idCell.locator('input, textarea')).toHaveCount(0)
	})
})

test.describe('keyboard navigation in navigate mode', () => {
	test('arrow keys move focus between cells', async ({ page }) => {
		await gotoBasic(page)

		await cell(page, 0, COL.name).click()
		await expect(cell(page, 0, COL.name)).toHaveClass(/wg__cell--focused/)

		await page.keyboard.press('ArrowDown')
		await expect(cell(page, 1, COL.name)).toHaveClass(/wg__cell--focused/)

		await page.keyboard.press('ArrowRight')
		await expect(cell(page, 1, COL.email)).toHaveClass(/wg__cell--focused/)
	})

	test('Tab walks editable columns; the read-only ID column is skipped', async ({ page }) => {
		await gotoBasic(page)

		// Focus Name (editable). Shift-Tab should NOT land on ID (read-only).
		await cell(page, 0, COL.name).click()
		await page.keyboard.press('Shift+Tab')

		await expect(cell(page, 0, COL.id)).not.toHaveClass(/wg__cell--focused/)
	})
})

test.describe('pagination', () => {
	test('toggling Pageable shows page navigation and clamps the visible rows', async ({ page }) => {
		await gotoBasic(page)

		// Pagination off by default — all 8 rows visible.
		await expect(gridLocator(page).locator('tbody tr')).toHaveCount(8)

		await page.locator('#pageable').check()

		// pageSize is 5 — page 1 shows 5 rows.
		await expect(gridLocator(page).locator('tbody tr')).toHaveCount(5)
		await expect(gridLocator(page).locator('.wg__pagination').first()).toBeVisible()
	})

	test('setting currentPage advances the visible rows', async ({ page }) => {
		await gotoBasic(page)
		await page.locator('#pageable').check()

		await expect(gridLocator(page).locator('.wg__pagination-info').first()).toBeVisible()
		await expect(cell(page, 0, COL.name)).toContainText('Alice Johnson')

		await gridLocator(page).evaluate((host) => {
			(host as unknown as { currentPage: number }).currentPage = 2
		})

		// Page 2 (pageSize 5): rows 5-7 → first is Frank Lee.
		await expect(cell(page, 0, COL.name)).toContainText('Frank Lee')

		await gridLocator(page).evaluate((host) => {
			(host as unknown as { currentPage: number }).currentPage = 1
		})
		await expect(cell(page, 0, COL.name)).toContainText('Alice Johnson')
	})

	test('clicking pagination "next" advances the page', async ({ page }) => {
		await gotoBasic(page)
		await page.locator('#pageable').check()
		await expect(gridLocator(page).locator('.wg__pagination-info').first()).toBeVisible()
		await expect(cell(page, 0, COL.name)).toContainText('Alice Johnson')

		await gridLocator(page).locator('.wg__pagination-btn[data-action="next"]:not([disabled])').first().click()
		await expect(cell(page, 0, COL.name)).toContainText('Frank Lee')

		await gridLocator(page).locator('.wg__pagination-btn[data-action="prev"]:not([disabled])').first().click()
		await expect(cell(page, 0, COL.name)).toContainText('Alice Johnson')
	})
})

test.describe('multi-sort (cascading)', () => {
	test('Ctrl+click on a second indicator adds it to the cascade', async ({ page }) => {
		await gotoBasic(page)

		// First sort: status asc.
		await sortIndicatorByHeaderText(page, 'Status').click()
		// Add salary as a secondary sort (Ctrl+click).
		await sortIndicatorByHeaderText(page, 'Salary').click({ modifiers: ['Control'] })

		// The sort-state hook lists each active sort as "<field>:<dir>".
		const sortStateText = await page.locator('[data-testid="sort-state"]').textContent()
		expect(sortStateText).toMatch(/status/i)
		expect(sortStateText).toMatch(/salary/i)
	})
})

test.describe('sort cycle', () => {
	test('clicking the same indicator three times cycles asc → desc → none', async ({ page }) => {
		await gotoBasic(page)

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
	test('getDisplayValueCallback renders salary with $ and thousand separators', async ({ page }) => {
		await gotoBasic(page)
		// Alice (row 0) has salary 85000 — formatted as "$85,000".
		await expect(cell(page, 0, COL.salary)).toContainText('$85,000')
	})

	test('getCellClassCallback adds salary-high class for salaries ≥ 90000', async ({ page }) => {
		await gotoBasic(page)
		// Carol (row 2, salary 92000) is highlighted; Alice (row 0, 85000) is not.
		await expect(cell(page, 2, COL.salary)).toHaveClass(/(^|\s)salary-high(\s|$)/)
		await expect(cell(page, 0, COL.salary)).not.toHaveClass(/(^|\s)salary-high(\s|$)/)
	})
})

test.describe('row numbers', () => {
	test('isRowNumbersShown renders a row-number cell with 0-based data attr and 1-based display', async ({ page }) => {
		await gotoBasic(page)

		const firstRowNumber = gridLocator(page).locator('tbody tr').first().locator('.wg__row-number').first()
		await expect(firstRowNumber).toHaveAttribute('data-row-number', '0')
		await expect(firstRowNumber).toContainText('1')
	})
})

test.describe('row locking & dynamic row class', () => {
	test('the On Leave row picks up both wg__row--locked and the "row-inactive" class', async ({ page }) => {
		await gotoBasic(page)

		// Eva Martinez is row 4, status = 'On Leave'.
		const evaRow = gridLocator(page).locator('tbody tr').nth(4)
		await expect(evaRow).toContainText('Eva Martinez')
		await expect(evaRow).toHaveClass(/wg__row--locked/)
		await expect(evaRow).toHaveClass(/row-inactive/)
	})

	test('rows that are not locked do not carry the locked / inactive classes', async ({ page }) => {
		await gotoBasic(page)
		// Alice (row 0) is Active.
		const aliceRow = gridLocator(page).locator('tbody tr').first()
		await expect(aliceRow).not.toHaveClass(/wg__row--locked/)
		await expect(aliceRow).not.toHaveClass(/row-inactive/)
	})
})

test.describe('feature toggles', () => {
	test('unchecking Sortable removes the sort indicators', async ({ page }) => {
		await gotoBasic(page)

		await expect(gridLocator(page).locator('.wg__sort-indicator').first()).toBeVisible()

		await page.locator('#sortable').uncheck()

		await expect(gridLocator(page).locator('.wg__sort-indicator')).toHaveCount(0)
	})

	test('unchecking Editable prevents F2 from opening an editor', async ({ page }) => {
		await gotoBasic(page)

		await page.locator('#editable').uncheck()

		const nameCell = cell(page, 0, COL.name)
		await nameCell.click()
		await page.keyboard.press('F2')

		await expect(nameCell.locator('input, textarea')).toHaveCount(0)
	})

	test('unchecking Striped removes the wg--striped host modifier class', async ({ page }) => {
		await gotoBasic(page)

		await expect(gridLocator(page).locator('.wg')).toHaveClass(/wg--striped/)

		await page.locator('#striped').uncheck()

		await expect(gridLocator(page).locator('.wg')).not.toHaveClass(/wg--striped/)
	})
})

test.describe('row focus event', () => {
	test('keyboard navigation updates the focused-row hook via onFocusChange', async ({ page }) => {
		await gotoBasic(page)

		// Initially "none".
		await expect(page.locator('[data-testid="focused-row"]')).toHaveText('none')

		// Click to land focus, then arrow-down twice to row 2 (Carol). Arrow keys
		// fire onFocusChange reliably; a plain click can race with the grid's pending
		// cell-selection state.
		await cell(page, 0, COL.name).click()
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('ArrowDown')

		await expect(page.locator('[data-testid="focused-row"]')).toContainText('2 — Carol Williams')
	})
})

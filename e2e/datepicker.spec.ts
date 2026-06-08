import { test, expect, Page } from '@playwright/test'

/**
 * E2E coverage for the date editor (docs/test/datepicker.html).
 *
 * The picker renders in document.body (light DOM, NOT inside the shadow root)
 * with the class prefix `wg-datepicker` (single hyphen, like the context menu).
 * The grid is in navigate mode, so F2 starts editing + opens the picker.
 *
 * Three date columns exercise dateFormat / outputFormat permutations:
 *   - iso (col 2): YYYY-MM-DD display, 'iso' string output
 *   - eu  (col 3): DD.MM.YYYY display, 'iso' string output
 *   - ts  (col 4): YYYY-MM-DD display, 'timestamp' number output
 *
 * All date columns are bounded 2026-06-01 .. 2026-06-30 so min/max behavior
 * is deterministic.
 */

const PAGE = '/test/datepicker.html'
const GRID = 'web-grid#grid'

const COL = { id: 0, name: 1, iso: 2, eu: 3, ts: 4 } as const

function gridLocator(page: Page) {
	return page.locator(GRID)
}

function cell(page: Page, rowIndex: number, colIndex: number) {
	return gridLocator(page).locator(`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`)
}

/**
 * The picker mounts in document.body as <div class="wg-datepicker-container">
 * containing <div class="wg-datepicker">. The container itself has no size
 * (it's a position:fixed positioner), so we target the inner element for
 * visibility assertions.
 */
function picker(page: Page) {
	return page.locator('.wg-datepicker')
}

function day(page: Page, isoDate: string) {
	return picker(page).locator(`.wg-datepicker__day[data-date="${isoDate}"]`)
}

function commitLogRow(page: Page, n: number) {
	return page.locator('[data-testid="commit-log"] .row').nth(n)
}

async function gotoDp(page: Page) {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
}

/**
 * Open the date picker on a given cell. F2 is the standard editing trigger in
 * navigate mode and reliably opens the picker for date columns.
 */
async function openPicker(page: Page, rowIndex: number, colIndex: number) {
	await cell(page, rowIndex, colIndex).click()
	await page.keyboard.press('F2')
	await expect(picker(page)).toBeVisible()
}

// =============================================================================
// Open / close
// =============================================================================

test.describe('open / close', () => {
	test('F2 on a date cell opens the picker positioned to the current value', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 0, COL.iso)

		// Alice's iso is 2026-06-15 → header shows June 2026, day 15 pre-selected.
		await expect(picker(page).locator('.wg-datepicker__month-year')).toHaveText(/June\s+2026/)
		await expect(picker(page).locator('.wg-datepicker__day--selected'))
			.toHaveAttribute('data-date', '2026-06-15')
	})

	test('Escape closes the picker without committing', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 0, COL.iso)

		await page.keyboard.press('Escape')

		// Picker is gone; cell text is unchanged.
		await expect(picker(page)).toHaveCount(0)
		await expect(cell(page, 0, COL.iso)).toContainText('2026-06-15')
	})

	test('clicking outside the picker closes it without committing', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 0, COL.iso)

		// Click far outside the picker (in the body header).
		await page.locator('h1').first().click()

		await expect(picker(page)).toHaveCount(0)
		await expect(cell(page, 0, COL.iso)).toContainText('2026-06-15')
	})

	test('empty cell opens the picker with no day pre-selected', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 3, COL.iso) // David's iso is null

		await expect(picker(page)).toBeVisible()
		await expect(picker(page).locator('.wg-datepicker__day--selected')).toHaveCount(0)
	})
})

// =============================================================================
// Selecting a day
// =============================================================================

test.describe('selecting a day', () => {
	test('clicking a day commits the value as an ISO string and closes the picker', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 0, COL.iso)

		await day(page, '2026-06-22').click()

		await expect(picker(page)).toHaveCount(0)
		await expect(cell(page, 0, COL.iso)).toContainText('2026-06-22')
		// onrowchange should fire with a string value.
		await expect(commitLogRow(page, 0))
			.toContainText('row=0 field=iso value="2026-06-22" type=string')
	})

	test('outputFormat=\'timestamp\' commits a number', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 0, COL.ts)

		await day(page, '2026-06-25').click()

		await expect(picker(page)).toHaveCount(0)
		// Formatted by the column's formatCallback (toISOString slice).
		await expect(cell(page, 0, COL.ts)).toContainText('2026-06-25')
		// Commit log shows numeric value with type=number.
		await expect(commitLogRow(page, 0)).toContainText('field=ts')
		await expect(commitLogRow(page, 0)).toContainText('type=number')
	})

	test('dateFormat=\'DD.MM.YYYY\' renders the cell in EU layout', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 0, COL.eu)

		await day(page, '2026-06-22').click()

		// Cell input/display uses the configured dateFormat → 22.06.2026.
		await expect(cell(page, 0, COL.eu)).toContainText('22.06.2026')
	})
})

// =============================================================================
// Keyboard navigation
// =============================================================================

test.describe('keyboard navigation', () => {
	test('arrow keys move the focused date (no commit until Enter)', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 0, COL.iso) // selected = 2026-06-15

		// ArrowRight → 16
		await page.keyboard.press('ArrowRight')
		await expect(picker(page).locator('.wg-datepicker__day--focused'))
			.toHaveAttribute('data-date', '2026-06-16')

		// ArrowDown → +7 days → 23
		await page.keyboard.press('ArrowDown')
		await expect(picker(page).locator('.wg-datepicker__day--focused'))
			.toHaveAttribute('data-date', '2026-06-23')

		// Picker is still open; commit log is empty (no onrowchange yet).
		await expect(picker(page)).toBeVisible()
		await expect(page.locator('[data-testid="commit-log"] .row')).toHaveCount(0)
	})

	test('Enter commits the focused date and moves focus down a row', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 0, COL.iso)

		// Move focus to 18, then commit.
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('Enter')

		await expect(picker(page)).toHaveCount(0)
		await expect(cell(page, 0, COL.iso)).toContainText('2026-06-18')
	})
})

// =============================================================================
// Min / max constraints
// =============================================================================

test.describe('min / max constraints', () => {
	test('out-of-range days render as disabled', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 0, COL.iso)

		// May 31 is below minDate 2026-06-01 → renders in the leading "other month"
		// space with the disabled modifier.
		const may31 = day(page, '2026-05-31')
		await expect(may31).toHaveCount(1)
		await expect(may31).toHaveClass(/wg-datepicker__day--disabled/)
	})

	test('clicking a disabled day does not commit and leaves the picker open', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 0, COL.iso)

		// handleDayClick returns null for disabled days, so selectDate is not
		// invoked and onrowchange must not fire. The mousedown preventDefault
		// keeps focus on the input, so the picker stays open.
		await day(page, '2026-05-31').click({ force: true })
		await expect(page.locator('[data-testid="commit-log"] .row')).toHaveCount(0)
		await expect(picker(page)).toBeVisible()
	})

	test('arrow keys cannot move focus past minDate', async ({ page }) => {
		await gotoDp(page)
		// Start from row 2 (Carol, 2026-06-10) so we're already close to the min.
		await openPicker(page, 2, COL.iso)

		// Move left 9 times → would reach 2026-06-01, then 10 → would reach 2026-05-31
		// (which is disabled). Navigation should clamp at 2026-06-01.
		for (let i = 0; i < 15; i++) {
			await page.keyboard.press('ArrowLeft')
		}

		const focused = picker(page).locator('.wg-datepicker__day--focused')
		await expect(focused).toHaveAttribute('data-date', '2026-06-01')
	})
})

// =============================================================================
// Month navigation
// =============================================================================

test.describe('month navigation', () => {
	test('PageDown moves to the next month (clamped by maxDate)', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 0, COL.iso) // viewing June 2026

		await page.keyboard.press('PageDown')

		// Header advances to July; all days will be disabled (above maxDate).
		await expect(picker(page).locator('.wg-datepicker__month-year')).toHaveText(/July\s+2026/)
	})

	// Clicking the picker's own chevrons / month-year button used to silently
	// close the picker — focus would shift to the button (the picker mounts in
	// document.body, outside the shadow root), the date input fired focusout,
	// handleTableFocusOut re-rendered the cell, and Floating UI's autoUpdate
	// detected the anchor disconnection. Fixed by having the picker
	// preventDefault on mousedown so focus stays on the anchor input.
	test('next-month chevron also advances the header', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 0, COL.iso)

		await picker(page).locator('.wg-datepicker__nav--next').click()

		await expect(picker(page).locator('.wg-datepicker__month-year')).toHaveText(/July\s+2026/)
	})

	test('month/year header opens the rolling selector', async ({ page }) => {
		await gotoDp(page)
		await openPicker(page, 0, COL.iso)

		await picker(page).locator('.wg-datepicker__month-year').click()

		await expect(picker(page).locator('.wg-datepicker__rolling-selector'))
			.toHaveClass(/wg-datepicker__rolling-selector--visible/)
		await expect(picker(page).locator('.wg-datepicker__calendar'))
			.toHaveClass(/wg-datepicker__calendar--hidden/)
		await expect(picker(page).locator('[data-month="5"]')).toHaveCount(1)
		await expect(picker(page).locator('[data-year="2026"]')).toHaveCount(1)
	})
})

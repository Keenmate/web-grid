import { test, expect, Page, gridLocator, header } from './fixtures'

/**
 * E2E coverage for the frozen-columns fixture (docs/test/freeze-panes.html).
 * The page hosts two grids:
 *   #grid   — 8-col / 10-row dataset, freezeColumns=2, isRowNumbers visible +
 *             sticky. A freezeColumns <select> drives grid.freezeColumns live.
 *   #grid2  — same columns + a `status` column with `isFrozen: true` declared
 *             *last*; the grid reorders it to the leftmost data slot.
 *
 * Behaviour exercised:
 *   - frozen headers/body cells get the `wg__header--frozen` / `wg__cell--frozen`
 *     modifier classes
 *   - the last frozen column gets the `--frozen-last` modifier
 *   - changing `freezeColumns` adds/removes the classes on the right headers
 *   - a column with `isFrozen: true` jumps to the leftmost data-column slot
 *     regardless of its position in the array
 *   - scrolling horizontally past a frozen column toggles the
 *     `wg--scrolled-horizontal` class on the .wg container
 *
 * NOTE: We assert on class wiring rather than visual sticky offsets — the
 * actual CSS `position: sticky` behaviour is browser-driven and tested by
 * Chromium itself; what we own is that we tag the right cells.
 */

const PAGE = '/test/freeze-panes.html'

function bodyCell(page: Page, gridId: string, rowIndex: number, field: string) {
	return gridLocator(page, gridId).locator(`.wg__cell[data-row="${rowIndex}"][data-field="${field}"]`)
}

function dataHeaderFields(page: Page, gridId: string) {
	return gridLocator(page, gridId)
		.locator('thead th.wg__header:not(.wg__row-number-header):not(.wg__inline-actions-header):not(.wg__actions-column):not(.wg__filler)')
		.evaluateAll(els => els.map(el => (el as HTMLElement).dataset.field))
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await expect(gridLocator(page, 'grid').locator('tbody tr').first()).toBeVisible()
	await expect(gridLocator(page, 'grid2').locator('tbody tr').first()).toBeVisible()
})

// =============================================================================
// #grid — freezeColumns=2 + sticky row numbers
// =============================================================================

test.describe('grid-level freezeColumns + isStickyRowNumbers — #grid', () => {
	test('first two data column headers are tagged wg__header--frozen', async ({ page }) => {
		await expect(header(page, 'grid', 'id')).toHaveClass(/wg__header--frozen/)
		await expect(header(page, 'grid', 'name')).toHaveClass(/wg__header--frozen/)

		// The third data column (email) is NOT frozen.
		await expect(header(page, 'grid', 'email')).not.toHaveClass(/wg__header--frozen/)
	})

	test('the last frozen column gets wg__header--frozen-last for the shadow indicator', async ({ page }) => {
		// With freezeColumns=2, "name" is the last frozen data column.
		await expect(header(page, 'grid', 'name')).toHaveClass(/wg__header--frozen-last/)
		await expect(header(page, 'grid', 'id')).not.toHaveClass(/wg__header--frozen-last/)
	})

	test('frozen modifier propagates to body cells in every row', async ({ page }) => {
		await expect(bodyCell(page, 'grid', 0, 'id')).toHaveClass(/wg__cell--frozen/)
		await expect(bodyCell(page, 'grid', 0, 'name')).toHaveClass(/wg__cell--frozen/)
		await expect(bodyCell(page, 'grid', 0, 'name')).toHaveClass(/wg__cell--frozen-last/)
		await expect(bodyCell(page, 'grid', 0, 'email')).not.toHaveClass(/wg__cell--frozen/)
	})

	test('sticky row numbers add wg__cell--frozen to the .wg__row-number cell', async ({ page }) => {
		const rowNumberCell = gridLocator(page, 'grid')
			.locator('tbody tr').first()
			.locator('.wg__row-number')
		await expect(rowNumberCell).toBeVisible()
		await expect(rowNumberCell).toHaveClass(/wg__cell--frozen/)
	})

	test('setting freezeColumns=0 strips the frozen class from data columns', async ({ page }) => {
		await page.locator('#freezeColumns').selectOption('0')

		await expect(header(page, 'grid', 'id')).not.toHaveClass(/wg__header--frozen/)
		await expect(header(page, 'grid', 'name')).not.toHaveClass(/wg__header--frozen/)
		await expect(bodyCell(page, 'grid', 0, 'id')).not.toHaveClass(/wg__cell--frozen/)

		// Sticky row numbers checkbox is still on, so row-number cells stay frozen.
		const rowNumberCell = gridLocator(page, 'grid')
			.locator('tbody tr').first()
			.locator('.wg__row-number')
		await expect(rowNumberCell).toHaveClass(/wg__cell--frozen/)
	})

	test('setting freezeColumns=3 extends the frozen range to the email column', async ({ page }) => {
		await page.locator('#freezeColumns').selectOption('3')

		await expect(header(page, 'grid', 'id')).toHaveClass(/wg__header--frozen/)
		await expect(header(page, 'grid', 'name')).toHaveClass(/wg__header--frozen/)
		await expect(header(page, 'grid', 'email')).toHaveClass(/wg__header--frozen/)

		// "email" is now the last frozen one; "name" loses the --frozen-last marker.
		await expect(header(page, 'grid', 'email')).toHaveClass(/wg__header--frozen-last/)
		await expect(header(page, 'grid', 'name')).not.toHaveClass(/wg__header--frozen-last/)
	})

	test('horizontal scroll adds wg--scrolled-horizontal to the .wg container', async ({ page }) => {
		const wg = gridLocator(page, 'grid').locator('.wg')
		await expect(wg).not.toHaveClass(/wg--scrolled-horizontal/)

		// Scroll the container 200px to the right. The grid listens on scroll
		// of the .wg element and toggles the class.
		await wg.evaluate(el => { (el as HTMLElement).scrollLeft = 200 })

		await expect(wg).toHaveClass(/wg--scrolled-horizontal/)
	})
})

// =============================================================================
// #grid2 — column-level isFrozen reorders the column to the front
// =============================================================================

test.describe('column-level isFrozen flag — #grid2', () => {
	test('an isFrozen column is reordered to the leftmost data slot', async ({ page }) => {
		// `status` is declared LAST in the columns array but carries isFrozen:true,
		// so the grid moves it ahead of every non-frozen column.
		const fields = await dataHeaderFields(page, 'grid2')
		expect(fields[0]).toBe('status')
		expect(fields[fields.length - 1]).toBe('phone')
	})

	test('the isFrozen column picks up the frozen + frozen-last modifiers', async ({ page }) => {
		// It's the only explicitly-frozen column, so it is both the first and the
		// last frozen column.
		await expect(header(page, 'grid2', 'status')).toHaveClass(/wg__header--frozen/)
		await expect(header(page, 'grid2', 'status')).toHaveClass(/wg__header--frozen-last/)
		await expect(bodyCell(page, 'grid2', 0, 'status')).toHaveClass(/wg__cell--frozen/)

		// A non-frozen neighbour stays unfrozen.
		await expect(header(page, 'grid2', 'id')).not.toHaveClass(/wg__header--frozen/)
	})

	test('sticky row numbers still freezes just the row-number column', async ({ page }) => {
		const rowNumberCell = gridLocator(page, 'grid2')
			.locator('tbody tr').first()
			.locator('.wg__row-number')
		await expect(rowNumberCell).toHaveClass(/wg__cell--frozen/)
	})
})

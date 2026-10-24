import { test, expect, Page, Locator } from '@playwright/test'

/**
 * E2E coverage for the fill-handle (Excel-like autofill) fixture
 * (docs/test/fill-handle.html). The page hosts four grids:
 *   #grid           — basic fill, logs every operation to [data-testid="fill-log"].
 *   #grid2          — same columns, but beforeFillCallback returns false for the
 *                     'status' column, cancelling the fill (logs to fill-log-2).
 *   #gridVertical   — narrow grid for vertical drag, row 0 value=100.
 *   #gridHorizontal — a row of cells across columns for horizontal drag.
 *
 * Fill mechanics: clicking a cell focuses it (navigate mode), which causes
 * `.wg__fill-handle` to be appended to the grid's .wg container at the cell's
 * bottom-right corner. Mousedown on the handle + ≥5 px move + mouseup over the
 * target cell triggers `applyFill`. The handler listens on document-level
 * mousemove/mouseup, so page.mouse primitives work — no shadow piercing needed
 * for the drag itself. Targets are identified by data-row + data-col on cells.
 */

const PAGE = '/test/fill-handle.html'

function gridLocator(page: Page, id: string) {
	return page.locator(`web-grid#${id}`)
}

function cell(page: Page, gridId: string, rowIndex: number, colIndex: number): Locator {
	return gridLocator(page, gridId).locator(`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`)
}

function fillHandle(page: Page, gridId: string): Locator {
	return gridLocator(page, gridId).locator('.wg__fill-handle')
}

/**
 * Click a cell to focus it (navigate mode) and wait for the fill handle to
 * attach to the grid's .wg container.
 *
 * Clicking the centre of a combobox/select cell can hit the dropdown toggle
 * and open the editor instead of focusing — we click near the left edge to
 * stay clear of the toggle chevron.
 */
async function focusCell(page: Page, gridId: string, rowIndex: number, colIndex: number) {
	const target = cell(page, gridId, rowIndex, colIndex)
	await target.scrollIntoViewIfNeeded()
	const box = await target.boundingBox()
	if (!box) throw new Error('Cell has no bounding box')
	await page.mouse.click(box.x + 6, box.y + box.height / 2)
	await expect(fillHandle(page, gridId)).toBeVisible()
}

/**
 * Programmatically focus a cell via the web component's public focusCell()
 * method. Useful when the target cell is a combobox/select that would open its
 * dropdown on click — we still want the fill handle to appear without
 * triggering the editor.
 */
async function focusCellProgrammatic(page: Page, gridId: string, rowIndex: number, colIndex: number) {
	await gridLocator(page, gridId).evaluate(
		(el, [r, c]) => (el as HTMLElement & { focusCell: (r: number, c: number) => void }).focusCell(r, c),
		[rowIndex, colIndex]
	)
	await expect(fillHandle(page, gridId)).toBeVisible()
}

/**
 * Drag the fill handle from the currently-focused cell to the center of the
 * destination cell. Uses page.mouse primitives because the fill module attaches
 * mousemove/mouseup at the document level once mousedown lands on the handle.
 *
 * The fill module's DRAG_THRESHOLD is 5 px, so we deliberately move more than
 * that before reaching the target. A couple of intermediate steps make the
 * drag look natural and ensure findCellAtPoint resolves on the way.
 */
async function dragFillTo(page: Page, gridId: string, toRowIndex: number, toColIndex: number) {
	const handle = fillHandle(page, gridId)
	const handleBox = await handle.boundingBox()
	if (!handleBox) throw new Error('Fill handle has no bounding box')
	const sx = handleBox.x + handleBox.width / 2
	const sy = handleBox.y + handleBox.height / 2

	const destCell = cell(page, gridId, toRowIndex, toColIndex)
	const destBox = await destCell.boundingBox()
	if (!destBox) throw new Error('Destination cell has no bounding box')
	const dx = destBox.x + destBox.width / 2
	const dy = destBox.y + destBox.height / 2

	await page.mouse.move(sx, sy)
	await page.mouse.down()
	// Two intermediate moves keep the drag continuous and well past DRAG_THRESHOLD.
	await page.mouse.move((sx + dx) / 2, (sy + dy) / 2, { steps: 5 })
	await page.mouse.move(dx, dy, { steps: 5 })
	await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await expect(gridLocator(page, 'grid').locator('tbody tr').first()).toBeVisible()
})

// =============================================================================
// #grid — basic vertical fill
// =============================================================================

test.describe('basic fill — #grid', () => {
	test('dragging down from the name column fills the value into rows below', async ({ page }) => {
		await focusCell(page, 'grid', 0, 1)  // Alice
		const original = (await cell(page, 'grid', 0, 1).textContent())?.trim() ?? ''
		expect(original).toBe('Alice')

		await dragFillTo(page, 'grid', 3, 1)

		// Rows 1..3 should now display 'Alice'. Source row is unchanged.
		await expect(cell(page, 'grid', 0, 1)).toContainText('Alice')
		await expect(cell(page, 'grid', 1, 1)).toContainText('Alice')
		await expect(cell(page, 'grid', 2, 1)).toContainText('Alice')
		await expect(cell(page, 'grid', 3, 1)).toContainText('Alice')
	})

	test('beforeFillCallback receives source/target/direction (logged into fill-log)', async ({ page }) => {
		await focusCell(page, 'grid', 0, 1)
		await dragFillTo(page, 'grid', 2, 1)

		// The fixture's beforeFillCallback writes a summary string into fill-log.
		const log = page.locator('[data-testid="fill-log"]')
		await expect(log).toContainText('Fill operation:')
		await expect(log).toContainText('"name"')
		await expect(log).toContainText('Direction: down')
		// Two target cells (rows 1 and 2 — source row 0 is excluded).
		await expect(log).toContainText('Target cells: 2 cells')
	})

	test('fill range overlay (.wg__fill-range) cleans up after mouseup', async ({ page }) => {
		await focusCell(page, 'grid', 0, 1)
		await dragFillTo(page, 'grid', 2, 1)
		await expect(gridLocator(page, 'grid').locator('.wg__fill-range')).toHaveCount(0)
	})
})

// =============================================================================
// #grid2 — cancellation via beforeFillCallback returning false
// =============================================================================

test.describe('cancellation — #grid2', () => {
	test('returning false from beforeFillCallback blocks the fill on status column', async ({ page }) => {
		// Status column is colIndex 5 (id=0, name=1, salary=2, startDate=3, dept=4, status=5).
		// Clicking the status cell directly opens the combobox dropdown (the
		// dropdown-display element fills the cell), so we focus programmatically.
		await focusCellProgrammatic(page, 'grid2', 0, 5)

		// Combobox cells render a trailing ▼ chevron alongside the value, so
		// assert via contains rather than exact-match text.
		await expect(cell(page, 'grid2', 1, 5)).toContainText('Pending')

		await dragFillTo(page, 'grid2', 2, 5)

		// Fixture log message confirms the block.
		await expect(page.locator('[data-testid="fill-log-2"]')).toContainText('BLOCKED')
		// Row 1 still 'Pending', not overwritten.
		await expect(cell(page, 'grid2', 1, 5)).toContainText('Pending')
	})

	test('non-blocked column still fills (name column is allowed)', async ({ page }) => {
		await focusCell(page, 'grid2', 0, 1)  // Alice
		await dragFillTo(page, 'grid2', 2, 1)

		await expect(page.locator('[data-testid="fill-log-2"]')).toContainText('ALLOWED')
		await expect(cell(page, 'grid2', 1, 1)).toContainText('Alice')
		await expect(cell(page, 'grid2', 2, 1)).toContainText('Alice')
	})
})

// =============================================================================
// #gridVertical — vertical fill demo
// =============================================================================

test.describe('vertical fill — #gridVertical', () => {
	test('dragging down from row 0 value=100 propagates 100 to the rows below', async ({ page }) => {
		// Columns: description (0, read-only), value (1).
		await focusCell(page, 'gridVertical', 0, 1)
		await expect(cell(page, 'gridVertical', 0, 1)).toContainText('100')

		await dragFillTo(page, 'gridVertical', 4, 1)

		for (const r of [1, 2, 3, 4]) {
			await expect(cell(page, 'gridVertical', r, 1)).toContainText('100')
		}
	})
})

// =============================================================================
// #gridHorizontal — fill direction constraint
// =============================================================================

test.describe('fill direction constraint — #gridHorizontal', () => {
	test('default fillDirection="vertical" leaves adjacent columns untouched on a horizontal drag', async ({ page }) => {
		// gridHorizontal does not set fillDirection, so the grid default ('vertical')
		// applies — applyFill constrains targets to the source column even when the
		// drag direction is horizontal.
		await focusCell(page, 'gridHorizontal', 0, 1)
		await expect(cell(page, 'gridHorizontal', 0, 1)).toContainText('Hello')

		await dragFillTo(page, 'gridHorizontal', 0, 4)

		// col2/3/4 stay empty — no horizontal fill under the default 'vertical' setting.
		for (const c of [2, 3, 4]) {
			await expect(cell(page, 'gridHorizontal', 0, c)).toHaveText('')
		}
	})
})

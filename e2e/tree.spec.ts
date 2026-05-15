import { test, expect, Page, Locator } from '@playwright/test'

/**
 * Smoke tests for tree mode against the tree fixture (docs/test/tree.html).
 * The page hosts four grids:
 *   #grid        — editTrigger:'navigate', treeDoubleClickBehavior:'toggle',
 *                  defaultExpandDepth:2. Exercises chevron toggle, dblclick
 *                  toggle, Ctrl+Arrow shortcuts, and focus state.
 *   #navGrid     — heterogeneous tree, fully expanded; only leaf rows editable.
 *   #rowGateGrid — grid-level isRowEditable gate (status === 'Active').
 *   #cvGrid      — column visibility in tree mode (tree column locked-visible).
 *
 * See the comment block in tree.html for the full 23-row path/index table the
 * Tab-navigation tests depend on.
 *
 * Selectors all pierce the <web-grid> shadow DOM via Playwright's locator
 * engine — no manual shadow-root traversal needed.
 */

const PAGE = '/test/tree.html'
const GRID = 'web-grid#grid'

// Helpers ---------------------------------------------------------------------

function gridLocator(page: Page) {
	return page.locator(GRID)
}

function cellAt(page: Page, rowIndex: number, colIndex: number): Locator {
	return gridLocator(page).locator(`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`)
}

async function visibleRowCount(page: Page): Promise<number> {
	return await gridLocator(page).locator('tbody tr').count()
}

async function gotoTreeDemo(page: Page) {
	await page.goto(PAGE)
	// Wait for the grid to render at least one row.
	await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
}

// Tests -----------------------------------------------------------------------

test.describe('tree mode — #grid', () => {
	test('renders rows and shows chevrons on parent rows', async ({ page }) => {
		await gotoTreeDemo(page)

		// Default expand depth is 2 → expect more than just root rows.
		const rows = await visibleRowCount(page)
		expect(rows).toBeGreaterThan(3)

		// At least one chevron is present on a parent row.
		await expect(
			gridLocator(page).locator('.wg__tree-chevron[data-tree-toggle]').first()
		).toBeVisible()
	})

	test('clicking a chevron toggles the row and changes visible row count', async ({ page }) => {
		await gotoTreeDemo(page)

		const before = await visibleRowCount(page)

		// Click the chevron on Acme (path '1') to collapse the entire tree below it.
		const acmeChevron = gridLocator(page).locator('.wg__tree-chevron[data-tree-toggle="1"]').first()
		await acmeChevron.click()

		const afterCollapse = await visibleRowCount(page)
		expect(afterCollapse).toBeLessThan(before)

		// Click again to re-expand.
		await acmeChevron.click()
		const afterExpand = await visibleRowCount(page)
		expect(afterExpand).toBe(before)
	})

	test('double-clicking a tree-column cell toggles when treeDoubleClickBehavior=toggle', async ({ page }) => {
		await gotoTreeDemo(page)
		const before = await visibleRowCount(page)

		// Find Acme's name cell (row 0, col 0 in the visible order). Dblclick the
		// cell body, not the chevron — the fixture wires treeDoubleClickBehavior:'toggle'.
		const acmeCell = cellAt(page, 0, 0)
		await acmeCell.dblclick()

		const after = await visibleRowCount(page)
		expect(after).toBeLessThan(before)
	})

	test('clicking a cell applies wg__cell--focused class', async ({ page }) => {
		await gotoTreeDemo(page)

		const cell = cellAt(page, 1, 0)
		await cell.click()
		await expect(cell).toHaveClass(/wg__cell--focused/)
	})
})

test.describe('tree shortcuts — Ctrl+Arrow on focused cell', () => {
	test('Ctrl+ArrowLeft on a focused expanded parent collapses it', async ({ page }) => {
		await gotoTreeDemo(page)

		// Click a known parent row (Acme path '1' is row 0).
		const acme = cellAt(page, 0, 0)
		await acme.click()
		await expect(acme).toHaveClass(/wg__cell--focused/)

		const before = await visibleRowCount(page)
		await page.keyboard.press('Control+ArrowLeft')

		// Acme collapsed → far fewer visible rows.
		await expect.poll(() => visibleRowCount(page)).toBeLessThan(before)

		// Focus follows the toggled row — should still be Acme at row 0.
		await expect(cellAt(page, 0, 0)).toHaveClass(/wg__cell--focused/)
	})

	test('Ctrl+ArrowRight on a focused collapsed parent expands it', async ({ page }) => {
		await gotoTreeDemo(page)

		// Collapse Acme first via chevron, so it has children but is collapsed.
		await gridLocator(page).locator('.wg__tree-chevron[data-tree-toggle="1"]').first().click()
		const collapsed = await visibleRowCount(page)

		// Click Acme to focus it, then Ctrl+ArrowRight to expand.
		await cellAt(page, 0, 0).click()
		await page.keyboard.press('Control+ArrowRight')

		await expect.poll(() => visibleRowCount(page)).toBeGreaterThan(collapsed)
		await expect(cellAt(page, 0, 0)).toHaveClass(/wg__cell--focused/)
	})

	test('arrow keys move focus across rows', async ({ page }) => {
		await gotoTreeDemo(page)

		await cellAt(page, 0, 0).click()
		await expect(cellAt(page, 0, 0)).toHaveClass(/wg__cell--focused/)

		await page.keyboard.press('ArrowDown')
		await expect(cellAt(page, 1, 0)).toHaveClass(/wg__cell--focused/)
		await expect(cellAt(page, 0, 0)).not.toHaveClass(/wg__cell--focused/)
	})
})

test.describe('cellContextMenu — predefined tree items', () => {
	// Open the cell context menu. Playwright's right-click options were all flaky:
	// click({button:'right'}) and mouse.click + dispatchEvent each had cases where
	// the contextmenu event didn't reach the listener. The combination below —
	// explicit move, then dispatchEvent with full button + buttons + clientX/Y —
	// is what survives both timing and shadow-DOM event paths.
	async function openCellContextMenu(page: Page, gridSelector: string, rowIndex: number, colIndex: number) {
		const cell = page.locator(gridSelector).locator(`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`)
		await openCellContextMenuOn(cell, page)
	}

	async function openCellContextMenuOn(locator: Locator, page: Page) {
		// Scroll the cell to the top of the viewport so the menu (which opens BELOW
		// the click point) has room to render fully inside the viewport.
		await locator.evaluate((el: Element) => el.scrollIntoView({ block: 'start' }))
		await page.waitForTimeout(50)  // tiny settle so post-scroll bounds are stable
		const box = await locator.boundingBox()
		if (!box) throw new Error(`Could not get bounding box`)
		const x = box.x + box.width / 2
		const y = box.y + box.height / 2
		await page.mouse.move(x, y)
		await locator.dispatchEvent('contextmenu', {
			bubbles: true,
			cancelable: true,
			button: 2,
			buttons: 2,
			clientX: x,
			clientY: y,
			screenX: x,
			screenY: y
		})
	}

	test('"Expand all" appears on parent rows with children', async ({ page }) => {
		await gotoTreeDemo(page)

		// Row 0 = Acme (parent). Right-click any cell on it.
		await openCellContextMenu(page, GRID, 0, 0)
		const menu = page.locator('.wg-context-menu').first()
		await expect(menu).toBeVisible()
		await expect(menu.locator('text=Expand all')).toBeVisible()
		await expect(menu.locator('text=Collapse all')).toBeVisible()
	})

	// TODO: these three tests verify clicking through to the predefined item handlers.
	// The menu opens correctly (visibility tests above prove it), but clicking the
	// menu items hits a Playwright + Floating UI interaction: the menu uses
	// `position: fixed`, and Playwright's pre-click "is this element in the viewport"
	// check fails even when the element is visually visible. Force-clicking and
	// scrolling the trigger cell to the viewport top didn't unstick it. Revisit
	// when we've isolated whether to override Floating UI placement during tests
	// or use page.evaluate to invoke the handler directly.
	test.skip('"Expand all" / "Collapse all" do NOT appear on leaf rows', async ({ page }) => {
		await gotoTreeDemo(page)

		const leafRow = gridLocator(page)
			.locator('tbody tr')
			.filter({ has: page.locator('.wg__tree-chevron--leaf') })
			.first()
		const leafCell = leafRow.locator('.wg__cell').first()
		await openCellContextMenuOn(leafCell, page)

		const menu = page.locator('.wg-context-menu').first()
		await expect(menu).toBeVisible()
		await expect(menu.locator('text=Expand all')).toHaveCount(0)
		await expect(menu.locator('text=Collapse all')).toHaveCount(0)
		// Tree-wide items still show
		await expect(menu.locator('text=Expand entire tree')).toBeVisible()
	})

	test.skip('"Expand entire tree" expands everything', async ({ page }) => {
		await gotoTreeDemo(page)

		const before = await visibleRowCount(page)

		await openCellContextMenu(page, GRID, 0, 0)
		const menu = page.locator('.wg-context-menu').first()
		await expect(menu).toBeVisible()
		await menu.locator('text=Expand entire tree').click({ force: true })

		await expect.poll(() => visibleRowCount(page)).toBeGreaterThan(before)
	})

	test.skip('"Collapse entire tree" hides everything except roots', async ({ page }) => {
		await gotoTreeDemo(page)

		await openCellContextMenu(page, GRID, 0, 0)
		const menu = page.locator('.wg-context-menu').first()
		await expect(menu).toBeVisible()
		await menu.locator('text=Collapse entire tree').click({ force: true })

		// Only the root row(s) remain. orgData has one root (Acme).
		await expect.poll(() => visibleRowCount(page)).toBe(1)
	})
})

test.describe('Tab navigation — heterogeneous tree (#navGrid)', () => {
	const NAV_GRID = 'web-grid#navGrid'

	function navCell(page: Page, rowIndex: number, colIndex: number) {
		return page.locator(NAV_GRID).locator(`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`)
	}

	test.beforeEach(async ({ page }) => {
		await page.goto(PAGE)
		await expect(page.locator(NAV_GRID).locator('tbody tr').first()).toBeVisible()
	})

	test('Tab from last leaf in a subtree skips the parent row of the next subtree', async ({ page }) => {
		// navGrid (defaultExpandDepth=99) — only leaf rows are editable.
		// Row 9 = Data Science (leaf, last leaf of Engineering subtree). Row 10 = Sales
		// (parent, all read-only). Row 11 = Enterprise (first leaf of Sales subtree).
		// Tab from row 9 col 4 should skip row 10 → row 11 col 1.
		await navCell(page, 9, 4).click()
		await expect(navCell(page, 9, 4)).toHaveClass(/wg__cell--focused/)

		await page.keyboard.press('Tab')

		// Verify Sales (row 10) was not focused — focus jumps directly to Enterprise (row 11).
		await expect(navCell(page, 11, 1)).toHaveClass(/wg__cell--focused/)
		await expect(navCell(page, 10, 1)).not.toHaveClass(/wg__cell--focused/)
	})

	test('Shift-Tab walks backward across read-only rows the same way', async ({ page }) => {
		// Reverse of the above: focus Enterprise (row 11) col 1 → Shift-Tab → Data Science (row 9) col 4.
		await navCell(page, 11, 1).click()
		await page.keyboard.press('Shift+Tab')
		await expect(navCell(page, 9, 4)).toHaveClass(/wg__cell--focused/)
	})

	test('tree column is never the Tab target (always read-only)', async ({ page }) => {
		// Focus a non-tree col on a leaf, Shift-Tab back through the row's editable cols.
		// At col 1 (first editable), Shift-Tab should NOT land on col 0 (tree column);
		// it should jump to the previous leaf row's last editable col.
		await navCell(page, 11, 1).click()
		await page.keyboard.press('Shift+Tab')

		await expect(navCell(page, 11, 0)).not.toHaveClass(/wg__cell--focused/)
		await expect(navCell(page, 9, 4)).toHaveClass(/wg__cell--focused/)
	})
})

test.describe('isRowEditable — Tab skips read-only rows (#rowGateGrid)', () => {
	const ROW_GATE_GRID = 'web-grid#rowGateGrid'

	function rgCell(page: Page, rowIndex: number, colIndex: number) {
		return page.locator(ROW_GATE_GRID).locator(`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`)
	}

	test.beforeEach(async ({ page }) => {
		await page.goto(PAGE)
		await expect(page.locator(ROW_GATE_GRID).locator('tbody tr').first()).toBeVisible()
	})

	test('Tab from SMB (row 12) last col skips Channel (Reorganizing, row 13) and lands on Marketing (row 14)', async ({ page }) => {
		// rowGateGrid uses isRowEditable: row => row.status === 'Active'.
		// Channel (row 13) has status='Reorganizing' → entire row read-only.
		// Tab from row 12 col 4 should jump over row 13 to row 14 col 1.
		await rgCell(page, 12, 4).click()
		await expect(rgCell(page, 12, 4)).toHaveClass(/wg__cell--focused/)

		await page.keyboard.press('Tab')

		await expect(rgCell(page, 14, 1)).toHaveClass(/wg__cell--focused/)
		await expect(rgCell(page, 13, 1)).not.toHaveClass(/wg__cell--focused/)
	})

	test('Shift-Tab from Marketing (row 14) col 1 jumps back over Channel (row 13) to SMB (row 12)', async ({ page }) => {
		await rgCell(page, 14, 1).click()
		await page.keyboard.press('Shift+Tab')
		await expect(rgCell(page, 12, 4)).toHaveClass(/wg__cell--focused/)
	})
})

test.describe('column visibility — tree column locked (#cvGrid)', () => {
	const CV_GRID = 'web-grid#cvGrid'

	async function rightClickHeader(page: Page, gridSelector: string, headerIndex: number) {
		const header = page.locator(gridSelector).locator('thead th').nth(headerIndex)
		await header.scrollIntoViewIfNeeded()
		const box = await header.boundingBox()
		if (!box) throw new Error(`Could not get bounding box for header ${headerIndex}`)
		const x = box.x + box.width / 2
		const y = box.y + box.height / 2
		await page.mouse.move(x, y)
		await header.dispatchEvent('contextmenu', {
			bubbles: true, cancelable: true,
			button: 2, buttons: 2,
			clientX: x, clientY: y, screenX: x, screenY: y
		})
	}

	test('right-clicking the tree column header does NOT show "Hide column"', async ({ page }) => {
		await page.goto(PAGE)
		await expect(page.locator(CV_GRID).locator('tbody tr').first()).toBeVisible()

		await rightClickHeader(page, CV_GRID, 0)  // tree column "Organization"

		const menu = page.locator('.wg-context-menu').first()
		await expect(menu).toBeVisible()
		await expect(menu.locator('text=Hide column')).toHaveCount(0)
	})

	test('right-clicking a non-tree column header DOES show "Hide column"', async ({ page }) => {
		await page.goto(PAGE)
		await expect(page.locator(CV_GRID).locator('tbody tr').first()).toBeVisible()

		await rightClickHeader(page, CV_GRID, 1)  // Headcount — not the tree column

		const menu = page.locator('.wg-context-menu').first()
		await expect(menu).toBeVisible()
		await expect(menu.locator('text=Hide column')).toBeVisible()
	})
})

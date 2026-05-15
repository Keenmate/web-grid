import { test, expect, Page, Locator } from '@playwright/test'

/**
 * E2E coverage for the context menu module (docs/test/contextmenu.html).
 *
 * Three grids:
 *   #grid        — cell context menu with dynamic labels, conditional
 *                  visible / disabled / danger, dividerBefore, shortcut keys,
 *                  oncontextmenuopen callback.
 *   #gridOffset  — contextMenuXOffset / contextMenuYOffset configuration.
 *   #gridHeader  — header context menu with predefined items
 *                  (sortAsc / sortDesc / clearSort), custom item with dynamic
 *                  label, onheadercontextmenuopen callback.
 *
 * Both menu types render into document.body (not the grid's shadow root) via
 * Floating UI, so all assertions use page-level locators with `.wg-context-menu`.
 *
 * Seed (#grid) — see fixture for row→stock/active mapping. Key cases the spec
 * relies on:
 *   row 0 (Laptop, stock=15, active=true)  → Restock visible, Delete disabled
 *   row 1 (Mouse,  stock=120, active=true) → Restock HIDDEN,  Delete disabled
 *   row 3 (Desk,   stock=3,   active=false) → Restock visible, Delete ENABLED
 */

const PAGE = '/test/contextmenu.html'

const COL = { id: 0, name: 1, category: 2, price: 3, stock: 4, active: 5 } as const

function gridLocator(page: Page, id: string) {
	return page.locator(`web-grid#${id}`)
}

function cell(page: Page, gridId: string, rowIndex: number, colIndex: number): Locator {
	return gridLocator(page, gridId).locator(
		`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
	)
}

function header(page: Page, gridId: string, field: string): Locator {
	return gridLocator(page, gridId).locator(`thead th.wg__header[data-field="${field}"]`)
}

/** Top-level menu only — `.wg-context-menu` also matches the submenu element. */
function menuRoot(page: Page) {
	return page.locator('.wg-context-menu:not(.wg-context-menu--submenu)')
}

async function dispatchContextMenu(page: Page, locator: Locator) {
	await locator.scrollIntoViewIfNeeded()
	const box = await locator.boundingBox()
	if (!box) throw new Error('No bounding box for contextmenu target')
	const x = box.x + box.width / 2
	const y = box.y + box.height / 2
	await page.mouse.move(x, y)
	await locator.dispatchEvent('contextmenu', {
		bubbles: true, cancelable: true, button: 2, buttons: 2,
		clientX: x, clientY: y, screenX: x, screenY: y
	})
	return { x, y }
}

async function clickMenuItem(page: Page, label: string) {
	await page.evaluate((text) => {
		const menu = document.querySelector('.wg-context-menu:not(.wg-context-menu--submenu)')
		if (!menu) throw new Error('No context menu')
		const items = Array.from(menu.querySelectorAll('.wg-context-menu__item')) as HTMLElement[]
		const item = items.find(it =>
			it.textContent?.includes(text) && !it.closest('.wg-context-menu--submenu')
		)
		if (!item) throw new Error(`Menu item not found: ${text}`)
		item.click()
	}, label)
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await expect(gridLocator(page, 'grid').locator('tbody tr').first()).toBeVisible()
})

// =============================================================================
// Cell context menu — #grid
// =============================================================================

test.describe('cell context menu — #grid', () => {
	test('right-click opens the menu and oncontextmenuopen logs the click target', async ({ page }) => {
		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.name))

		await expect(menuRoot(page)).toBeVisible()
		await expect(page.locator('[data-testid="cell-menu-open-log"]'))
			.toContainText('open: name row=0 value=Laptop Pro')
	})

	test('dynamic label uses the right-clicked column title — "Copy \\"Product Name\\""', async ({ page }) => {
		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.name))
		await expect(menuRoot(page)).toContainText('Copy "Product Name"')
	})

	test('dynamic label updates when right-clicking a different column — "Copy \\"Price\\""', async ({ page }) => {
		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.price))
		await expect(menuRoot(page)).toContainText('Copy "Price"')
		// Sanity: NOT the Name column label.
		await expect(menuRoot(page)).not.toContainText('Copy "Product Name"')
	})

	test('"Convert to EUR" is visible only on the Price column', async ({ page }) => {
		// Name column (row 0) — hidden.
		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.name))
		await expect(menuRoot(page)).not.toContainText('Convert to EUR')

		// Close, then open on the Price column — visible.
		await page.keyboard.press('Escape')
		await expect(menuRoot(page)).toHaveCount(0)

		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.price))
		await expect(menuRoot(page)).toContainText('Convert to EUR')
	})

	test('"Restock" is visible only when row.stock < 20', async ({ page }) => {
		// Row 0 stock=15 → visible.
		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.name))
		await expect(menuRoot(page)).toContainText('Restock (+10)')

		await page.keyboard.press('Escape')
		await expect(menuRoot(page)).toHaveCount(0)

		// Row 1 stock=120 → hidden.
		await dispatchContextMenu(page, cell(page, 'grid', 1, COL.name))
		await expect(menuRoot(page)).toBeVisible()
		await expect(menuRoot(page)).not.toContainText('Restock (+10)')
	})

	test('"Delete" carries the --danger class', async ({ page }) => {
		await dispatchContextMenu(page, cell(page, 'grid', 3, COL.name))
		const del = menuRoot(page).locator('.wg-context-menu__item', { hasText: 'Delete' })
		await expect(del).toHaveClass(/wg-context-menu__item--danger/)
	})

	test('"Delete" is disabled for active rows and enabled for inactive ones', async ({ page }) => {
		// Row 0 active=true → disabled.
		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.name))
		await expect(menuRoot(page).locator('.wg-context-menu__item', { hasText: 'Delete' }))
			.toHaveClass(/wg-context-menu__item--disabled/)

		await page.keyboard.press('Escape')
		await expect(menuRoot(page)).toHaveCount(0)

		// Row 3 active=false → enabled (no --disabled modifier).
		await dispatchContextMenu(page, cell(page, 'grid', 3, COL.name))
		await expect(menuRoot(page).locator('.wg-context-menu__item', { hasText: 'Delete' }))
			.not.toHaveClass(/wg-context-menu__item--disabled/)
	})

	test('dividerBefore on "Delete" renders a divider element above it', async ({ page }) => {
		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.name))
		// The cell menu uses one divider — before the Delete item.
		await expect(menuRoot(page).locator('.wg-context-menu__divider')).toHaveCount(1)
	})

	test('clicking an enabled item invokes its onclick handler', async ({ page }) => {
		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.name))
		await clickMenuItem(page, 'View Details')

		await expect(page.locator('[data-testid="cell-menu-log"]'))
			.toContainText('View: Laptop Pro')
	})

	test('clicking the dynamic "Copy" item logs the column value', async ({ page }) => {
		await dispatchContextMenu(page, cell(page, 'grid', 2, COL.category))
		await clickMenuItem(page, 'Copy "Category"')

		await expect(page.locator('[data-testid="cell-menu-log"]'))
			.toContainText('Copied category=Furniture')
	})

	test('clicking a disabled item does NOT invoke its handler', async ({ page }) => {
		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.name))
		// Row 0 is active → Delete is disabled. The click handler in the module
		// checks data-disabled and bails, so cell-menu-log should not change.
		await clickMenuItem(page, 'Delete')
		// Tiny wait to make sure any handler would have had a chance to run.
		await page.waitForTimeout(50)

		await expect(page.locator('[data-testid="cell-menu-log"]')).toHaveText('none')
	})

	test('"Restock" mutates the row data and the items update', async ({ page }) => {
		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.name))
		await clickMenuItem(page, 'Restock (+10)')

		await expect(page.locator('[data-testid="stock-1"]')).toHaveText('25')
		await expect(page.locator('[data-testid="cell-menu-log"]'))
			.toContainText('Restocked Laptop Pro → 25')
	})

	test('shortcut key (Y) on the Price column triggers "Convert to EUR"', async ({ page }) => {
		// "Convert to EUR" has shortcut: 'Y'. Open the menu on the Price cell
		// to populate context, then press Y — the document keydown handler in
		// the menu module matches the shortcut and fires the onclick.
		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.price))
		await expect(menuRoot(page)).toBeVisible()

		await page.keyboard.press('y')

		await expect(page.locator('[data-testid="cell-menu-log"]'))
			.toContainText('EUR(Laptop Pro): 1195.08')
		// Menu closed by the shortcut handler.
		await expect(menuRoot(page)).toHaveCount(0)
	})

	test('Escape closes the menu without firing any item', async ({ page }) => {
		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.name))
		await expect(menuRoot(page)).toBeVisible()

		await page.keyboard.press('Escape')
		await expect(menuRoot(page)).toHaveCount(0)
		await expect(page.locator('[data-testid="cell-menu-log"]')).toHaveText('none')
	})

	test('clicking outside the menu closes it', async ({ page }) => {
		await dispatchContextMenu(page, cell(page, 'grid', 0, COL.name))
		await expect(menuRoot(page)).toBeVisible()

		// Click on the page heading (well outside any grid).
		await page.locator('h1').click()

		await expect(menuRoot(page)).toHaveCount(0)
	})
})

// =============================================================================
// Context menu offsets — #gridOffset
// =============================================================================

test.describe('context menu offsets — #gridOffset', () => {
	test('contextMenuXOffset / YOffset are reflected on the grid properties', async ({ page }) => {
		// The fixture sets contextMenuXOffset=40, contextMenuYOffset=24. Read
		// them back from the custom element — this verifies the setters land
		// without depending on Floating UI's final placement (which can flip
		// near the viewport edge and invalidate pixel-level checks).
		const values = await gridLocator(page, 'gridOffset').evaluate((el: any) => ({
			x: el.contextMenuXOffset,
			y: el.contextMenuYOffset
		}))
		expect(values).toEqual({ x: 40, y: 24 })
	})

	test('the offset grid still opens a context menu on right-click', async ({ page }) => {
		// Smoke-test that the offset wiring doesn't break menu rendering.
		// We don't assert pixel positions because Floating UI's shift() can
		// push the menu back toward the viewport edge, defeating any literal
		// "menu.x === click.x + offsetX" check across CI viewport sizes.
		await dispatchContextMenu(page, cell(page, 'gridOffset', 0, COL.name))
		await expect(menuRoot(page)).toBeVisible()
		await expect(menuRoot(page)).toContainText('Action A')
		await expect(menuRoot(page)).toContainText('Action B')
	})
})

// =============================================================================
// Header context menu — #gridHeader
// =============================================================================

test.describe('header context menu — #gridHeader', () => {
	test('right-clicking a header opens the menu with predefined sort items', async ({ page }) => {
		await dispatchContextMenu(page, header(page, 'gridHeader', 'name'))

		await expect(menuRoot(page)).toBeVisible()
		await expect(menuRoot(page)).toContainText('Sort Ascending')
		await expect(menuRoot(page)).toContainText('Sort Descending')
	})

	test('"Clear Sort" is hidden when the column is not sorted', async ({ page }) => {
		await dispatchContextMenu(page, header(page, 'gridHeader', 'name'))
		await expect(menuRoot(page)).not.toContainText('Clear Sort')
	})

	test('"Sort Ascending" sorts the grid, then "Clear Sort" becomes available', async ({ page }) => {
		await dispatchContextMenu(page, header(page, 'gridHeader', 'price'))
		await clickMenuItem(page, 'Sort Ascending')

		// First row in single-sort asc by price should be the cheapest (Desk Lamp, $45).
		await expect(cell(page, 'gridHeader', 0, COL.name)).toContainText('Desk Lamp')

		await dispatchContextMenu(page, header(page, 'gridHeader', 'price'))
		await expect(menuRoot(page)).toContainText('Clear Sort')

		await clickMenuItem(page, 'Clear Sort')
		// Original order: Laptop Pro first.
		await expect(cell(page, 'gridHeader', 0, COL.name)).toContainText('Laptop Pro')
	})

	test('custom item with dynamic label includes the column title', async ({ page }) => {
		await dispatchContextMenu(page, header(page, 'gridHeader', 'category'))
		await expect(menuRoot(page)).toContainText('Export "Category"')

		// Different header → different label.
		await page.keyboard.press('Escape')
		await dispatchContextMenu(page, header(page, 'gridHeader', 'price'))
		await expect(menuRoot(page)).toContainText('Export "Price"')
	})

	test('clicking the custom export item fires its onclick with the column field', async ({ page }) => {
		await dispatchContextMenu(page, header(page, 'gridHeader', 'category'))
		await clickMenuItem(page, 'Export "Category"')

		await expect(page.locator('[data-testid="header-export-log"]'))
			.toContainText('Exported category')
	})

	test('onheadercontextmenuopen fires with the column field, index, and sort direction', async ({ page }) => {
		await dispatchContextMenu(page, header(page, 'gridHeader', 'stock'))

		const log = page.locator('[data-testid="header-menu-log"]')
		await expect(log).toContainText('open: stock')
		// stock is column index 4 (id, name, category, price, stock).
		await expect(log).toContainText('index=4')
		await expect(log).toContainText('sort=none')
	})

	test('dividerBefore between predefined items and the custom export renders a divider', async ({ page }) => {
		await dispatchContextMenu(page, header(page, 'gridHeader', 'name'))
		// With name unsorted: Sort Asc, Sort Desc (Clear Sort hidden), divider, Export.
		await expect(menuRoot(page).locator('.wg-context-menu__divider')).toHaveCount(1)
	})
})

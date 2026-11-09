import { test, expect, Page, Locator, gridLocator, header, dispatchContextMenu } from './fixtures'

/**
 * E2E coverage for column resize + drag-to-reorder
 * (docs/test/resize-reorder.html). The page hosts six grids:
 *   #grid           — basic resize + multi-sort.
 *   #grid2          — resize + persistence (storageKey + shouldPersistColumnWidths)
 *                     and onColumnResize logging to [data-testid="resize-log"].
 *   #grid3          — Status column has `isResizable: false`; its handle gets
 *                     `wg__resize-handle--disabled`.
 *   #gridMovable    — `isReorderable: false` on ID / Name / Status — drag-reorder
 *                     of those columns is blocked.
 *   #gridReorder    — drag-to-reorder, frozenColumnCount=2 (id/name frozen),
 *                     onColumnReorder logging to [data-testid="reorder-log"].
 *   #gridHeaderMenu — right-click header context menu with predefined items.
 *
 * Resize uses a mousedown on `.wg__resize-handle[data-field=…]` followed by
 * document-level mousemove/mouseup with a 5 px drag threshold. Reorder uses
 * mousedown on the header itself (anywhere but the resize handle) and the same
 * 5 px threshold before a ghost appears.
 */

const PAGE = '/test/resize-reorder.html'

function resizeHandle(page: Page, gridId: string, field: string): Locator {
	return gridLocator(page, gridId).locator(`.wg__resize-handle[data-field="${field}"]`)
}

async function getHeaderWidth(page: Page, gridId: string, field: string): Promise<number> {
	const box = await header(page, gridId, field).boundingBox()
	if (!box) throw new Error(`Header for ${field} has no bounding box`)
	return box.width
}

/**
 * Drag the resize handle for `field` by `deltaX` pixels. Mousedown on the
 * handle, move past the 5 px threshold, then to the final delta, mouseup.
 */
async function resizeColumn(page: Page, gridId: string, field: string, deltaX: number) {
	const handle = resizeHandle(page, gridId, field)
	await handle.scrollIntoViewIfNeeded()
	const box = await handle.boundingBox()
	if (!box) throw new Error(`Resize handle for ${field} has no bounding box`)
	const sx = box.x + box.width / 2
	const sy = box.y + box.height / 2

	await page.mouse.move(sx, sy)
	await page.mouse.down()
	// Intermediate move to clear threshold, then full delta in steps so any
	// mousemove handler sees gradual change.
	await page.mouse.move(sx + 10, sy, { steps: 4 })
	await page.mouse.move(sx + deltaX, sy, { steps: 8 })
	await page.mouse.up()
}

/**
 * Drag the column header for `field` to the centre of the header for
 * `targetField`. Threshold-aware: we step past 5 px before issuing the final
 * move so the reorder ghost has time to appear.
 */
async function reorderColumnTo(page: Page, gridId: string, field: string, targetField: string) {
	const src = header(page, gridId, field)
	const dst = header(page, gridId, targetField)
	await src.scrollIntoViewIfNeeded()
	const sbox = await src.boundingBox()
	const dbox = await dst.boundingBox()
	if (!sbox || !dbox) throw new Error('Header boundingBox missing')

	// Start from the LEFT of the header to stay clear of the resize handle on
	// the right edge. Source y stays at header middle.
	const sx = sbox.x + 20
	const sy = sbox.y + sbox.height / 2
	const dx = dbox.x + dbox.width / 2
	const dy = dbox.y + dbox.height / 2

	await page.mouse.move(sx, sy)
	await page.mouse.down()
	await page.mouse.move(sx + 10, sy, { steps: 4 })  // pass DRAG_THRESHOLD
	await page.mouse.move(dx, dy, { steps: 10 })       // drag to target
	await page.mouse.up()
}

async function getHeaderFieldOrder(page: Page, gridId: string): Promise<string[]> {
	const dataHeaders = gridLocator(page, gridId).locator(
		'thead th.wg__header:not(.wg__row-number-header):not(.wg__inline-actions-header):not(.wg__actions-column):not(.wg__filler)'
	)
	return dataHeaders.evaluateAll(els =>
		els.map(el => (el as HTMLElement).dataset.field || '')
	)
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await expect(gridLocator(page, 'grid').locator('tbody tr').first()).toBeVisible()
})

// =============================================================================
// Resize — #grid (basic)
// =============================================================================

test.describe('column resize — #grid', () => {
	test('dragging the name header right by 80 px widens the column', async ({ page }) => {
		const before = await getHeaderWidth(page, 'grid', 'name')
		await resizeColumn(page, 'grid', 'name', 80)
		const after = await getHeaderWidth(page, 'grid', 'name')

		// 70-90 px gives leeway for sub-pixel layout and step interpolation.
		expect(after - before).toBeGreaterThanOrEqual(70)
		expect(after - before).toBeLessThanOrEqual(90)
	})

	test('dragging the name header left by 60 px shrinks the column', async ({ page }) => {
		const before = await getHeaderWidth(page, 'grid', 'name')
		await resizeColumn(page, 'grid', 'name', -60)
		const after = await getHeaderWidth(page, 'grid', 'name')

		expect(before - after).toBeGreaterThanOrEqual(50)
		expect(before - after).toBeLessThanOrEqual(70)
	})

	test('resize handles get the --active class during drag (cleared on mouseup)', async ({ page }) => {
		const handle = resizeHandle(page, 'grid', 'email')
		await handle.scrollIntoViewIfNeeded()
		const box = await handle.boundingBox()
		if (!box) throw new Error('No handle box')

		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
		await page.mouse.down()
		await page.mouse.move(box.x + 30, box.y + box.height / 2, { steps: 4 })

		// Mid-drag the handle should carry the active modifier.
		await expect(handle).toHaveClass(/wg__resize-handle--active/)

		await page.mouse.up()
		await expect(handle).not.toHaveClass(/wg__resize-handle--active/)
	})

	test('the whole resize handle is grabbable (inside its header cell, not under the next one)', async ({ page }) => {
		// The header clips overflow and the next sticky header paints over anything sticking out, so
		// a handle straddling the border had a dead outer half (Firefox's drag landed on the next header).
		const grid = gridLocator(page, 'grid')
		await grid.scrollIntoViewIfNeeded()
		const hits = await grid.evaluate((el: Element) => {
			const sr = el.shadowRoot!
			const handle = sr.querySelector('.wg__resize-handle[data-field="name"]') as HTMLElement
			const th = handle.closest('th')!.getBoundingClientRect()
			const r = handle.getBoundingClientRect()
			const y = r.top + r.height / 2
			const xs = [r.left + 1, r.left + r.width / 2, r.right - 1]
			return { isInside: r.left >= th.left && r.right <= th.right, hits: xs.map((x) => sr.elementFromPoint(x, y) === handle) }
		})
		expect(hits).toEqual({ isInside: true, hits: [true, true, true] })
	})
})

// =============================================================================
// Resize — persistence + callback (#grid2)
// =============================================================================

test.describe('column resize — #grid2 (persistence)', () => {
	test('onColumnResize fires with field + old/new width into resize-log', async ({ page }) => {
		await resizeColumn(page, 'grid2', 'name', 60)
		const log = page.locator('[data-testid="resize-log"]')
		await expect(log).toContainText('Last resize:')
		await expect(log).toContainText('name')
		// `from <oldWidth> to <newWidth>`. Old width is 150px (set on the column).
		await expect(log).toContainText('from 150px')
	})

	test('column width is restored from localStorage after reload', async ({ page }) => {
		await resizeColumn(page, 'grid2', 'name', 80)
		const widthAfterResize = await getHeaderWidth(page, 'grid2', 'name')

		await page.reload()
		await expect(gridLocator(page, 'grid2').locator('tbody tr').first()).toBeVisible()

		const widthAfterReload = await getHeaderWidth(page, 'grid2', 'name')
		// Should match within a few px (sub-pixel rounding on reload).
		expect(Math.abs(widthAfterReload - widthAfterResize)).toBeLessThan(5)
	})
})

// =============================================================================
// Per-column opt-out — #grid3 (isResizable: false)
// =============================================================================

test.describe('isResizable opt-out — #grid3', () => {
	test('the status column resize handle gets the --disabled modifier', async ({ page }) => {
		await expect(resizeHandle(page, 'grid3', 'status'))
			.toHaveClass(/wg__resize-handle--disabled/)

		// Sibling columns remain enabled.
		await expect(resizeHandle(page, 'grid3', 'name'))
			.not.toHaveClass(/wg__resize-handle--disabled/)
	})

	test('attempting to drag the status handle leaves the width unchanged', async ({ page }) => {
		const before = await getHeaderWidth(page, 'grid3', 'status')
		await resizeColumn(page, 'grid3', 'status', 100)
		const after = await getHeaderWidth(page, 'grid3', 'status')
		// handleResizeStart bails out for non-resizable columns, so no width change.
		expect(Math.abs(after - before)).toBeLessThan(2)
	})
})

// =============================================================================
// Reorder — #gridReorder (drag-to-reorder)
// =============================================================================

test.describe('column reorder — #gridReorder', () => {
	test('dragging email past salary reorders the columns to the right', async ({ page }) => {
		// Initial order: id, name, email, department, role, location, salary, status.
		// Email starts to the LEFT of salary; after the drag it should land
		// at-or-past salary's position.
		const before = await getHeaderFieldOrder(page, 'gridReorder')
		expect(before.indexOf('email')).toBeLessThan(before.indexOf('salary'))

		await reorderColumnTo(page, 'gridReorder', 'email', 'status')

		const after = await getHeaderFieldOrder(page, 'gridReorder')
		expect(after.indexOf('email')).toBeGreaterThan(after.indexOf('salary'))
	})

	test('onColumnReorder callback fires with field + from/to indices into reorder-log', async ({ page }) => {
		await reorderColumnTo(page, 'gridReorder', 'salary', 'email')

		const log = page.locator('[data-testid="reorder-log"]')
		await expect(log).toContainText('Last reorder:')
		await expect(log).toContainText('salary')
	})

	test('the drop indicator follows the page-wide --base-drop-target-border-color', async ({ page }) => {
		await page.evaluate(() => document.documentElement.style.setProperty('--base-drop-target-border-color', 'rgb(1, 2, 3)'))
		const src = header(page, 'gridReorder', 'email')
		const dst = header(page, 'gridReorder', 'status')
		await src.scrollIntoViewIfNeeded()
		const sbox = (await src.boundingBox())!
		const dbox = (await dst.boundingBox())!
		const sy = sbox.y + sbox.height / 2
		await page.mouse.move(sbox.x + 20, sy)
		await page.mouse.down()
		await page.mouse.move(sbox.x + 30, sy, { steps: 4 })
		await page.mouse.move(dbox.x + dbox.width / 2, dbox.y + dbox.height / 2, { steps: 10 })
		const indicator = gridLocator(page, 'gridReorder').locator('.wg__drop-indicator')
		await expect(indicator).toBeVisible()
		await expect(indicator).toHaveCSS('background-color', 'rgb(1, 2, 3)')
		expect(await indicator.evaluate(el => getComputedStyle(el, '::before').borderTopColor)).toBe('rgb(1, 2, 3)')
		await page.mouse.up()
	})

	test('frozen columns (id, name) cannot be drag-reordered', async ({ page }) => {
		// gridReorder has frozenColumnCount=2 so id/name are frozen — handleReorderStart
		// returns early for them, so no ghost element ever appears.
		const before = await getHeaderFieldOrder(page, 'gridReorder')
		await reorderColumnTo(page, 'gridReorder', 'id', 'salary')
		const after = await getHeaderFieldOrder(page, 'gridReorder')
		expect(after).toEqual(before)
	})
})

// =============================================================================
// isReorderable opt-out — #gridMovable
// =============================================================================

test.describe('isReorderable opt-out — #gridMovable', () => {
	test('locked columns (id, name, status) cannot be dragged', async ({ page }) => {
		const before = await getHeaderFieldOrder(page, 'gridMovable')
		await reorderColumnTo(page, 'gridMovable', 'id', 'phone')
		const after = await getHeaderFieldOrder(page, 'gridMovable')
		expect(after).toEqual(before)
	})

	test('non-locked columns can still be moved around', async ({ page }) => {
		const before = await getHeaderFieldOrder(page, 'gridMovable')
		// email (non-locked) → phone (non-locked). Both bypass the isReorderable gate.
		const emailIndex = before.indexOf('email')
		const phoneIndex = before.indexOf('phone')
		expect(emailIndex).toBeLessThan(phoneIndex)

		await reorderColumnTo(page, 'gridMovable', 'email', 'phone')

		const after = await getHeaderFieldOrder(page, 'gridMovable')
		expect(after.indexOf('email')).toBeGreaterThanOrEqual(after.indexOf('phone'))
	})
})

// =============================================================================
// Header context menu — #gridHeaderMenu
// =============================================================================

test.describe('header context menu — #gridHeaderMenu', () => {
	/**
	 * Right-click helper that mirrors the dispatchEvent pattern from
	 * e2e/tree.spec.ts — Playwright's built-in click({button:'right'}) is flaky
	 * across web-grid's shadow DOM + Floating UI submenu re-positioning.
	 */
	async function rightClickHeader(page: Page, gridId: string, field: string) {
		// Scroll the grid itself into view first so the dispatched contextmenu
		// coords land in the visible viewport — otherwise the Floating UI menu
		// may anchor below the fold and Playwright refuses to click items in it.
		await gridLocator(page, gridId).scrollIntoViewIfNeeded()
		const h = header(page, gridId, field)
		await h.scrollIntoViewIfNeeded()
		const box = await h.boundingBox()
		if (!box) throw new Error('No header box')
		const x = box.x + box.width / 2
		const y = box.y + box.height / 2
		await page.mouse.move(x, y)
		await dispatchContextMenu(h, x, y)
	}

	/**
	 * Click a context-menu item by its label text. The menu (core `openMenu()`)
	 * is in the grid's shadow root — the locator pierces it; the click is
	 * dispatched via JS to bypass Playwright's viewport check.
	 */
	async function clickMenuItem(page: Page, label: string) {
		const item = page.locator('.km-menu .km-menu__item', { hasText: label }).first()
		await expect(item).toHaveCount(1)
		await item.evaluate((el: HTMLElement) => el.click())
	}

	test('right-clicking the name header opens the menu with sort + freeze + hide items', async ({ page }) => {
		await rightClickHeader(page, 'gridHeaderMenu', 'name')

		// The menu (core openMenu()) renders in the grid's shadow root; the page
		// locator pierces it.
		const menu = page.locator('.km-menu')
		await expect(menu).toBeVisible()
		await expect(menu).toContainText('Sort Ascending')
		await expect(menu).toContainText('Sort Descending')
		await expect(menu).toContainText('Freeze Column')
		await expect(menu).toContainText('Hide Column')
	})

	test('beforeHeaderMenuOpenCallback logs which column was opened (header-menu-log)', async ({ page }) => {
		await rightClickHeader(page, 'gridHeaderMenu', 'salary')

		const log = page.locator('[data-testid="header-menu-log"]')
		await expect(log).toContainText('Menu opened:')
		await expect(log).toContainText('salary')
	})

	test('clicking "Hide Column" removes the column from the visible header row', async ({ page }) => {
		await rightClickHeader(page, 'gridHeaderMenu', 'email')
		await expect(page.locator('.km-menu')).toBeVisible()
		await clickMenuItem(page, 'Hide Column')

		await expect(header(page, 'gridHeaderMenu', 'email')).toHaveCount(0)
	})

	test('clicking "Show All Columns" (custom item) restores hidden columns', async ({ page }) => {
		// Hide a column first, then the custom item reassigns grid.columns with a
		// fresh column-def array — the hidden column comes back.
		await rightClickHeader(page, 'gridHeaderMenu', 'email')
		await clickMenuItem(page, 'Hide Column')
		await expect(header(page, 'gridHeaderMenu', 'email')).toHaveCount(0)

		await rightClickHeader(page, 'gridHeaderMenu', 'name')
		await clickMenuItem(page, 'Show All Columns')

		await expect(page.locator('[data-testid="header-menu-log"]')).toContainText('Restored all columns')
		await expect(header(page, 'gridHeaderMenu', 'email')).toHaveCount(1)
	})
})

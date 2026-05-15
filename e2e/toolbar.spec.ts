import { test, expect, Page, Locator } from '@playwright/test'

/**
 * E2E coverage for the row-toolbar fixture (docs/test/toolbar.html). The page
 * hosts four grids, each exercising a different toolbar configuration:
 *   #grid   — floating toolbar, hover trigger (default), 5 items in 2 groups
 *             (moveUp/moveDown | add/duplicate/delete).
 *   #grid2  — multi-row toolbar (row: 1 and row: 2 with groups inside each).
 *   #grid3  — toolbarPosition='inline' renders buttons as a fixed column with
 *             disabled(row.status==='Done') and hidden(row.priority==='High').
 *             Inline buttons use class `wg__inline-action-btn` + data-action-id
 *             (not the floating toolbar's wg__toolbar-btn + data-toolbar-item).
 *   #grid4  — cellToolbar callback returning per-column item sets; uses
 *             toolbarFollowsCursor=true so each cell hover refreshes items.
 *
 * Hover reveals the floating toolbar (default trigger). Each test in this
 * file gets a fresh browser context, so the default trigger ('hover') is
 * always in effect.
 */

const PAGE = '/test/toolbar.html'

function gridLocator(page: Page, id: string) {
	return page.locator(`web-grid#${id}`)
}

function row(page: Page, gridId: string, rowIndex: number): Locator {
	return gridLocator(page, gridId).locator(`tr[data-row-index="${rowIndex}"]`)
}

function cellOnRow(page: Page, gridId: string, rowIndex: number, field: string): Locator {
	return gridLocator(page, gridId).locator(`.wg__cell[data-row="${rowIndex}"][data-field="${field}"]`)
}

function activeToolbar(page: Page, gridId: string): Locator {
	return gridLocator(page, gridId).locator('.wg__toolbar-container .wg__toolbar')
}

/**
 * Open the floating toolbar by dispatching mouseenter on a target element with
 * explicit coordinates. Real hover (locator.hover) is flaky here because the
 * toolbar listener uses {capture: true} on the table and Playwright's auto-
 * scroll can leave the mouse in a state where mouseenter doesn't re-fire.
 * Same pattern as the right-click helper in tree.spec — bypass actionability,
 * dispatch with full init dict. See memory feedback_playwright_toolbar_hover.
 */
async function openToolbarOn(locator: Locator, page: Page): Promise<void> {
	await locator.evaluate((el: Element) => el.scrollIntoView({ block: 'center' }))
	const box = await locator.boundingBox()
	if (!box) throw new Error('Could not get bounding box for toolbar trigger')
	const x = box.x + box.width / 2
	const y = box.y + box.height / 2
	await page.mouse.move(x, y)
	await locator.dispatchEvent('mouseenter', {
		bubbles: false, cancelable: true,
		clientX: x, clientY: y, screenX: x, screenY: y,
		buttons: 0
	})
	await locator.dispatchEvent('mousemove', {
		bubbles: true, cancelable: true,
		clientX: x, clientY: y, screenX: x, screenY: y,
		buttons: 0
	})
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await expect(gridLocator(page, 'grid').locator('tbody tr').first()).toBeVisible()
	await expect(gridLocator(page, 'grid3').locator('tbody tr').first()).toBeVisible()
})

// =============================================================================
// Floating toolbar — #grid
// =============================================================================

test.describe('floating toolbar — #grid (hover trigger, default)', () => {
	test('hovering a row opens the toolbar with five buttons and one divider', async ({ page }) => {
		await openToolbarOn(row(page, 'grid', 0), page)

		const toolbar = activeToolbar(page, 'grid')
		await expect(toolbar).toBeVisible()

		await expect(toolbar.locator('.wg__toolbar-btn')).toHaveCount(5)
		// One divider between the moveUp/moveDown group and the add/duplicate/delete group.
		await expect(toolbar.locator('.wg__toolbar-divider')).toHaveCount(1)

		// Buttons are emitted in declaration order and each carries data-toolbar-item=<id>.
		const ids = await toolbar.locator('.wg__toolbar-btn').evaluateAll(
			els => els.map(el => (el as HTMLElement).dataset.toolbarItem)
		)
		expect(ids).toEqual(['moveUp', 'moveDown', 'add', 'duplicate', 'delete'])
	})

	test('clicking "delete" in the toolbar removes the row', async ({ page }) => {
		const before = await gridLocator(page, 'grid').locator('tbody tr').count()
		const firstTitle = await cellOnRow(page, 'grid', 0, 'title').textContent()

		await openToolbarOn(row(page, 'grid', 0), page)
		await activeToolbar(page, 'grid').locator('button[data-toolbar-item="delete"]').click()

		await expect(gridLocator(page, 'grid').locator('tbody tr')).toHaveCount(before - 1)
		// The original first row's title is gone from row 0 — the next row took its place.
		await expect(cellOnRow(page, 'grid', 0, 'title')).not.toHaveText(firstTitle?.trim() ?? '')
	})

	test('clicking "duplicate" inserts a copy below the row', async ({ page }) => {
		const before = await gridLocator(page, 'grid').locator('tbody tr').count()
		const originalTitle = (await cellOnRow(page, 'grid', 0, 'title').textContent())?.trim() ?? ''

		await openToolbarOn(row(page, 'grid', 0), page)
		await activeToolbar(page, 'grid').locator('button[data-toolbar-item="duplicate"]').click()

		await expect(gridLocator(page, 'grid').locator('tbody tr')).toHaveCount(before + 1)
		// Handler renames the duplicate to "<original> (copy)" and places it at rowIndex+1.
		await expect(cellOnRow(page, 'grid', 1, 'title')).toContainText(originalTitle)
		await expect(cellOnRow(page, 'grid', 1, 'title')).toContainText('(copy)')
	})

	test('button titles are wired from rowToolbar config (native title attr)', async ({ page }) => {
		await openToolbarOn(row(page, 'grid', 0), page)
		const toolbar = activeToolbar(page, 'grid')

		await expect(toolbar.locator('button[data-toolbar-item="moveUp"]')).toHaveAttribute('title', 'Move up')
		await expect(toolbar.locator('button[data-toolbar-item="delete"]')).toHaveAttribute('title', 'Delete')
	})
})

// =============================================================================
// Multi-row toolbar — #grid2
// =============================================================================

test.describe('multi-row toolbar — #grid2', () => {
	test('renders two .wg__toolbar-row blocks (one per row property)', async ({ page }) => {
		await openToolbarOn(row(page, 'grid2', 0), page)

		const toolbar = activeToolbar(page, 'grid2')
		await expect(toolbar).toBeVisible()
		await expect(toolbar.locator('.wg__toolbar-row')).toHaveCount(2)

		// Row 1: 5 buttons (move + CRUD), Row 2: 3 buttons (export/preview/archive).
		// Total: 8 buttons across the two rows.
		await expect(toolbar.locator('.wg__toolbar-btn')).toHaveCount(8)
	})

	test('delete button carries the danger modifier class', async ({ page }) => {
		await openToolbarOn(row(page, 'grid2', 0), page)
		const deleteBtn = activeToolbar(page, 'grid2').locator('button[data-toolbar-item="delete"]')
		await expect(deleteBtn).toHaveClass(/wg__toolbar-btn--danger/)
	})
})

// =============================================================================
// Inline toolbar column — #grid3
// =============================================================================

test.describe('inline toolbar column — #grid3', () => {
	test('renders an inline-actions header with the configured title', async ({ page }) => {
		const header = gridLocator(page, 'grid3').locator('.wg__inline-actions-header')
		await expect(header).toBeVisible()
		await expect(header).toContainText('Actions')
	})

	test('every body row gets an inline-actions cell', async ({ page }) => {
		const inlineCells = gridLocator(page, 'grid3').locator('.wg__inline-actions-cell')
		const rowCount = await gridLocator(page, 'grid3').locator('tbody tr').count()
		await expect(inlineCells).toHaveCount(rowCount)
	})

	test('disabled callback (status===Done) disables the edit button', async ({ page }) => {
		// Row 2 in the seed is { status: 'Done' } — disabled(row) returns true,
		// so the 'edit' button has [disabled]. Inline buttons use
		// wg__inline-action-btn + data-action-id (different from floating toolbar).
		const editBtn = gridLocator(page, 'grid3')
			.locator('tr[data-row-index="2"] .wg__inline-actions-cell button[data-action-id="edit"]')
		await expect(editBtn).toBeDisabled()
	})

	test('hidden callback (priority===High) removes the delete button entirely', async ({ page }) => {
		// Row 0 has priority 'High' — delete is filtered out before render.
		const deleteBtn = gridLocator(page, 'grid3')
			.locator('tr[data-row-index="0"] .wg__inline-actions-cell button[data-action-id="delete"]')
		await expect(deleteBtn).toHaveCount(0)
	})

	test('clicking the inline "archive" button fires ontoolbarclick (toast appears)', async ({ page }) => {
		const archive = gridLocator(page, 'grid3')
			.locator('tr[data-row-index="0"] .wg__inline-actions-cell button[data-action-id="archive"]')
		await archive.scrollIntoViewIfNeeded()
		await archive.click()

		// The fixture handler appends a `.toast.success` to body for archive clicks.
		const toast = page.locator('.toast.success').last()
		await expect(toast).toBeVisible()
		await expect(toast).toContainText('Archived:')
	})
})

// =============================================================================
// Cell-aware toolbar — #grid4 (toolbarFollowsCursor=true, hover trigger)
// =============================================================================

test.describe('cell-aware toolbar — #grid4', () => {
	test('hovering the priority cell prepends the priority-specific items', async ({ page }) => {
		// cellToolbar items are merged with the base rowToolbar (cell items first,
		// then any base items not overridden by id). For 'priority' that means
		// the three set* items show up before the default add/delete/duplicate.
		await openToolbarOn(cellOnRow(page, 'grid4', 0, 'priority'), page)

		const toolbar = activeToolbar(page, 'grid4')
		await expect(toolbar).toBeVisible()

		const ids = await toolbar.locator('.wg__toolbar-btn').evaluateAll(
			els => els.map(el => (el as HTMLElement).dataset.toolbarItem)
		)
		expect(ids).toEqual(['setHigh', 'setMedium', 'setLow', 'add', 'delete', 'duplicate'])
	})

	test('hovering the status cell swaps in status-specific items', async ({ page }) => {
		await openToolbarOn(cellOnRow(page, 'grid4', 0, 'status'), page)

		const toolbar = activeToolbar(page, 'grid4')
		await expect(toolbar).toBeVisible()

		const ids = await toolbar.locator('.wg__toolbar-btn').evaluateAll(
			els => els.map(el => (el as HTMLElement).dataset.toolbarItem)
		)
		expect(ids).toEqual(['setTodo', 'setProgress', 'setDone', 'add', 'delete', 'duplicate'])
	})

	test('non-overridden columns (title) fall back to the default toolbar', async ({ page }) => {
		// cellToolbar returns undefined for 'title' → default rowToolbar = ['add','delete','duplicate'].
		await openToolbarOn(cellOnRow(page, 'grid4', 0, 'title'), page)

		const toolbar = activeToolbar(page, 'grid4')
		await expect(toolbar).toBeVisible()

		const ids = await toolbar.locator('.wg__toolbar-btn').evaluateAll(
			els => els.map(el => (el as HTMLElement).dataset.toolbarItem)
		)
		expect(ids).toEqual(['add', 'delete', 'duplicate'])
	})
})

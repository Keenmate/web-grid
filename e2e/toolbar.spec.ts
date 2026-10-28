import { test, expect, Page, Locator, gridLocator, openToolbarOn } from './fixtures'

/**
 * E2E coverage for the row-toolbar fixture (docs/test/toolbar.html). The page
 * hosts four grids, each exercising a different toolbar configuration:
 *   #grid   — floating toolbar, hover trigger (default), 5 row built-ins in 2
 *             groups split by a divider entry (move-up/move-down | add/duplicate/delete).
 *   #grid2  — multi-row toolbar (row: 1 and row: 2, dividers inside each).
 *   #grid3  — toolbarPosition='inline' renders buttons as a fixed column with
 *             getIsDisabledCallback(status==='Done') and getIsVisibleCallback(priority!=='High').
 *             Inline buttons use class `wg__inline-action-btn`; every button carries
 *             `data-action` (built-in name or `custom`) + `data-id` for custom items.
 *   #grid4  — getCellToolbarItemsCallback returning per-column item sets; uses
 *             shouldToolbarFollowCursor=true so each cell hover refreshes items.
 *
 * Hover reveals the floating toolbar (default trigger). Each test in this
 * file gets a fresh browser context, so the default trigger ('hover') is
 * always in effect.
 */

const PAGE = '/test/toolbar.html'

function row(page: Page, gridId: string, rowIndex: number): Locator {
	return gridLocator(page, gridId).locator(`tr[data-row-index="${rowIndex}"]`)
}

function cellOnRow(page: Page, gridId: string, rowIndex: number, field: string): Locator {
	return gridLocator(page, gridId).locator(`.wg__cell[data-row="${rowIndex}"][data-field="${field}"]`)
}

function activeToolbar(page: Page, gridId: string): Locator {
	return gridLocator(page, gridId).locator('.wg__toolbar-container .wg__toolbar')
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
		await openToolbarOn(page, row(page, 'grid', 0))

		const toolbar = activeToolbar(page, 'grid')
		await expect(toolbar).toBeVisible()

		await expect(toolbar.locator('.wg__toolbar-btn')).toHaveCount(5)
		// One divider between the move-up/move-down group and the add/duplicate/delete group.
		await expect(toolbar.locator('.wg__toolbar-divider')).toHaveCount(1)

		// Buttons are emitted in declaration order and each carries data-action=<built-in>.
		const actions = await toolbar.locator('.wg__toolbar-btn').evaluateAll(
			els => els.map(el => (el as HTMLElement).dataset.action)
		)
		expect(actions).toEqual(['move-up', 'move-down', 'add', 'duplicate', 'delete'])
	})

	test('clicking "delete" in the toolbar removes the row', async ({ page }) => {
		const before = await gridLocator(page, 'grid').locator('tbody tr').count()
		const firstTitle = await cellOnRow(page, 'grid', 0, 'title').textContent()

		await openToolbarOn(page, row(page, 'grid', 0))
		await activeToolbar(page, 'grid').locator('button[data-action="delete"]').click()

		await expect(gridLocator(page, 'grid').locator('tbody tr')).toHaveCount(before - 1)
		// The original first row's title is gone from row 0 — the next row took its place.
		await expect(cellOnRow(page, 'grid', 0, 'title')).not.toHaveText(firstTitle?.trim() ?? '')
	})

	test('clicking "duplicate" inserts a copy below the row', async ({ page }) => {
		const before = await gridLocator(page, 'grid').locator('tbody tr').count()
		const originalTitle = (await cellOnRow(page, 'grid', 0, 'title').textContent())?.trim() ?? ''

		await openToolbarOn(page, row(page, 'grid', 0))
		await activeToolbar(page, 'grid').locator('button[data-action="duplicate"]').click()

		await expect(gridLocator(page, 'grid').locator('tbody tr')).toHaveCount(before + 1)
		// createDuplicateRowCallback renames the copy to "<original> (copy)"; the built-in places it at rowIndex+1.
		await expect(cellOnRow(page, 'grid', 1, 'title')).toContainText(originalTitle)
		await expect(cellOnRow(page, 'grid', 1, 'title')).toContainText('(copy)')
	})

	test('button titles are wired from the item text (native title attr)', async ({ page }) => {
		await openToolbarOn(page, row(page, 'grid', 0))
		const toolbar = activeToolbar(page, 'grid')

		await expect(toolbar.locator('button[data-action="move-up"]')).toHaveAttribute('title', 'Move up')
		await expect(toolbar.locator('button[data-action="delete"]')).toHaveAttribute('title', 'Delete')
	})
})

// =============================================================================
// Multi-row toolbar — #grid2
// =============================================================================

test.describe('multi-row toolbar — #grid2', () => {
	test('renders two .wg__toolbar-row blocks (one per row property)', async ({ page }) => {
		await openToolbarOn(page, row(page, 'grid2', 0))

		const toolbar = activeToolbar(page, 'grid2')
		await expect(toolbar).toBeVisible()
		await expect(toolbar.locator('.wg__toolbar-row')).toHaveCount(2)

		// Row 1: 5 buttons (move + CRUD), Row 2: 3 buttons (export/preview/archive).
		// Total: 8 buttons across the two rows.
		await expect(toolbar.locator('.wg__toolbar-btn')).toHaveCount(8)
	})

	test('delete button carries the danger modifier class', async ({ page }) => {
		await openToolbarOn(page, row(page, 'grid2', 0))
		const deleteBtn = activeToolbar(page, 'grid2').locator('button[data-action="delete"]')
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

	test('getIsDisabledCallback (status===Done) disables the edit button', async ({ page }) => {
		// Row 2 in the seed is { status: 'Done' } — the callback returns true,
		// so the 'edit' button has [disabled].
		const editBtn = gridLocator(page, 'grid3')
			.locator('tr[data-row-index="2"] .wg__inline-actions-cell button[data-id="edit"]')
		await expect(editBtn).toBeDisabled()
	})

	test('getIsVisibleCallback (priority===High) removes the delete button entirely', async ({ page }) => {
		// Row 0 has priority 'High' — delete is filtered out before render.
		const deleteBtn = gridLocator(page, 'grid3')
			.locator('tr[data-row-index="0"] .wg__inline-actions-cell button[data-action="delete"]')
		await expect(deleteBtn).toHaveCount(0)
	})

	test('clicking the inline "archive" button fires onAction (toast appears)', async ({ page }) => {
		const archive = gridLocator(page, 'grid3')
			.locator('tr[data-row-index="0"] .wg__inline-actions-cell button[data-id="archive"]')
		await archive.scrollIntoViewIfNeeded()
		await archive.click()

		// The fixture handler appends a `.toast.success` to body for archive clicks.
		const toast = page.locator('.toast.success').last()
		await expect(toast).toBeVisible()
		await expect(toast).toContainText('Archived:')
	})
})

// =============================================================================
// Cell-aware toolbar — #grid4 (shouldToolbarFollowCursor=true, hover trigger)
// =============================================================================

test.describe('cell-aware toolbar — #grid4', () => {
	test('hovering the priority cell prepends the priority-specific items', async ({ page }) => {
		// getCellToolbarItemsCallback items are merged with the base rowToolbar (cell
		// items first, then any base items not overridden by id / action). For 'priority' that means
		// the three set* items show up before the default add/delete/duplicate.
		await openToolbarOn(page, cellOnRow(page, 'grid4', 0, 'priority'))

		const toolbar = activeToolbar(page, 'grid4')
		await expect(toolbar).toBeVisible()
		// The cell-aware merge runs on a mousemove *while the toolbar is open* and only
		// when the hovered cell changes; the mousemove sent by openToolbarOn can race
		// the open (pre-existing flake), so re-hover via another cell until it lands.
		await expect.poll(async () => {
			await cellOnRow(page, 'grid4', 0, 'title').dispatchEvent('mousemove', { bubbles: true })
			await cellOnRow(page, 'grid4', 0, 'priority').dispatchEvent('mousemove', { bubbles: true })
			return toolbar.locator('.wg__toolbar-btn').evaluateAll(
				els => els.map(el => (el as HTMLElement).dataset.id ?? (el as HTMLElement).dataset.action)
			)
		}).toEqual(['setHigh', 'setMedium', 'setLow', 'add', 'delete', 'duplicate'])
	})

	test('a shortcut on an open cell toolbar targets the row (and cell) at its current position after a move', async ({ page }) => {
		const grid4 = gridLocator(page, 'grid4')
		await grid4.evaluate((el: any) => {
			(window as any).__probe = []
			el.rowShortcuts = [
				{ shortcut: 'Alt+ArrowDown', action: 'move-down' },
				{ id: 'probe', shortcut: 'Alt+P', onClick: (ctx: any) => (window as any).__probe.push({ rowIndex: ctx.rowIndex, field: ctx.field, title: ctx.row.title }) },
			]
		})
		await openToolbarOn(page, cellOnRow(page, 'grid4', 0, 'priority'))
		const toolbar = activeToolbar(page, 'grid4')
		await expect.poll(async () => {
			await cellOnRow(page, 'grid4', 0, 'title').dispatchEvent('mousemove', { bubbles: true })
			await cellOnRow(page, 'grid4', 0, 'priority').dispatchEvent('mousemove', { bubbles: true })
			return toolbar.locator('.wg__toolbar-btn').first().getAttribute('data-id')
		}).toBe('setHigh')
		const title0 = await grid4.evaluate((el: any) => el.items[0].title)

		await page.keyboard.press('Alt+ArrowDown')
		await expect.poll(() => grid4.evaluate((el: any) => el.items[1].title)).toBe(title0)
		await expect(toolbar).toBeVisible()
		await page.keyboard.press('Alt+P')
		await expect.poll(() => page.evaluate(() => (window as any).__probe)).toEqual([{ rowIndex: 1, field: 'priority', title: title0 }])
	})

	test('hovering the status cell swaps in status-specific items', async ({ page }) => {
		await openToolbarOn(page, cellOnRow(page, 'grid4', 0, 'status'))

		const toolbar = activeToolbar(page, 'grid4')
		await expect(toolbar).toBeVisible()
		// The cell-aware merge runs on a mousemove *while the toolbar is open* and only
		// when the hovered cell changes; the mousemove sent by openToolbarOn can race
		// the open (pre-existing flake), so re-hover via another cell until it lands.
		await expect.poll(async () => {
			await cellOnRow(page, 'grid4', 0, 'title').dispatchEvent('mousemove', { bubbles: true })
			await cellOnRow(page, 'grid4', 0, 'status').dispatchEvent('mousemove', { bubbles: true })
			return toolbar.locator('.wg__toolbar-btn').evaluateAll(
				els => els.map(el => (el as HTMLElement).dataset.id ?? (el as HTMLElement).dataset.action)
			)
		}).toEqual(['setTodo', 'setProgress', 'setDone', 'add', 'delete', 'duplicate'])
	})

	test('non-overridden columns (title) fall back to the default toolbar', async ({ page }) => {
		// getCellToolbarItemsCallback returns undefined for 'title' → default rowToolbar = ['add','delete','duplicate'].
		await openToolbarOn(page, cellOnRow(page, 'grid4', 0, 'title'))

		const toolbar = activeToolbar(page, 'grid4')
		await expect(toolbar).toBeVisible()

		const ids = await toolbar.locator('.wg__toolbar-btn').evaluateAll(
			els => els.map(el => (el as HTMLElement).dataset.id ?? (el as HTMLElement).dataset.action)
		)
		expect(ids).toEqual(['add', 'delete', 'duplicate'])
	})
})

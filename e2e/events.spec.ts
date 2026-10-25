import { test, expect, type Page, gridLocator, cell, onGrid, eventsOf, domEvents, clearEvents, waitForRows, editorIn, dragSelect } from './fixtures'

/**
 * Events — `edit-start`, `edit-cancel`, `cell-selection-change`, `row-delete`
 * (Ctrl+Delete), `expand-change`. Each fires exactly once per happening, the
 * camelCase `on*` twin runs first with the very same detail object, and the
 * detail carries non-enumerable `controller` + `element`.
 *
 * Fixture: docs/test/events.html — #grid (Alpha/Beta/Gamma, navigate mode,
 * click cell-selection; 0=id, 1=name, 2=qty) and #tree (Root › Child A › Leaf A1,
 * Child B; Other root).
 */

const PAGE = '/test/events.html'

/** Exactly one DOM event + one twin call for `type`, twin first, same object; returns the detail. */
async function onceWithTwin(page: Page, type: string, gridId = 'grid') {
	const all = (await eventsOf(page, type)).filter(e => e.grid === gridId)
	expect(all.map(e => e.via), `${type}: twin then event, once each`).toEqual(['twin', 'event'])
	const ctx = await page.evaluate(({ t, g }) => {
		const ev = (window as any).__events.filter((e: any) => e.type === t && e.grid === g)
		const d = ev[1].detail
		return {
			same: ev[0].detail === d,
			isHost: d.element === document.getElementById(g),
			hasController: typeof d.controller?.getItems === 'function',
			enumerable: Object.keys(d).includes('controller') || Object.keys(d).includes('element')
		}
	}, { t: type, g: gridId })
	expect(ctx).toEqual({ same: true, isHost: true, hasController: true, enumerable: false })
	return all[1].detail
}

const chevron = (page: Page, path: string) => gridLocator(page, 'tree').locator(`.wg__tree-chevron[data-tree-toggle="${path}"]`)

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await waitForRows(page, 'tree')
	await clearEvents(page, 'events')
})

test('edit-start: F2 on a cell → { row, rowIndex, field }', async ({ page }) => {
	await cell(page, 1, 1).click()
	await page.keyboard.press('F2')
	await expect(editorIn(cell(page, 1, 1))).toBeVisible()
	expect(await onceWithTwin(page, 'edit-start')).toEqual({ row: { id: 2, name: 'Beta', qty: 20 }, rowIndex: 1, field: 'name' })
})

test('edit-cancel: Escape → { row, rowIndex, field }, no row-change', async ({ page }) => {
	await cell(page, 2, 2).click()
	await page.keyboard.press('F2')
	await editorIn(cell(page, 2, 2)).fill('99')
	await page.keyboard.press('Escape')
	await expect(editorIn(cell(page, 2, 2))).toHaveCount(0)
	expect(await onceWithTwin(page, 'edit-cancel')).toEqual({ row: { id: 3, name: 'Gamma', qty: 30 }, rowIndex: 2, field: 'qty' })
	expect(await domEvents(page, 'row-change')).toEqual([])
})

test('cell-selection-change: a drag → { range, cellCount }; Escape → { range: null, cellCount: 0 }', async ({ page }) => {
	await dragSelect(page, 0, 1, 1, 2)
	const d = await onceWithTwin(page, 'cell-selection-change')
	expect(d).toEqual({
		range: { startRowIndex: 0, startColIndex: 1, endRowIndex: 1, endColIndex: 2, startField: 'name', endField: 'qty' },
		cellCount: 4
	})
	await clearEvents(page, 'events')
	await page.keyboard.press('Escape')
	expect(await onceWithTwin(page, 'cell-selection-change')).toEqual({ range: null, cellCount: 0 })
})

test('cell-selection-change: selectCellRange / clearCellSelection through the API', async ({ page }) => {
	await onGrid(page, el => el.selectCellRange({ startRowIndex: 2, startColIndex: 0, endRowIndex: 2, endColIndex: 2 }))
	expect((await onceWithTwin(page, 'cell-selection-change')).cellCount).toBe(3)
	await clearEvents(page, 'events')
	await onGrid(page, el => el.clearCellSelection())
	expect(await onceWithTwin(page, 'cell-selection-change')).toEqual({ range: null, cellCount: 0 })
})

test('row-delete: Ctrl+Delete on a cell is a request — { row, rowIndex }, the row stays', async ({ page }) => {
	await cell(page, 1, 1).click()
	await page.keyboard.press('Control+Delete')
	expect(await onceWithTwin(page, 'row-delete')).toEqual({ row: { id: 2, name: 'Beta', qty: 20 }, rowIndex: 1 })
	await expect(gridLocator(page).locator('tbody tr.wg__row')).toHaveCount(3)
	await expect(cell(page, 1, 1)).toHaveText('Beta')
})

test('row-delete: Cmd+Delete (macOS) is the same request', async ({ page }) => {
	await cell(page, 1, 1).click()
	await page.keyboard.press('Meta+Delete')
	expect(await onceWithTwin(page, 'row-delete')).toEqual({ row: { id: 2, name: 'Beta', qty: 20 }, rowIndex: 1 })
	await expect(cell(page, 1, 1)).toHaveText('Beta')
})

test('plain Delete clears the cell (row-change to null), no row-delete', async ({ page }) => {
	await cell(page, 0, 1).click()
	await page.keyboard.press('Delete')
	await expect(cell(page, 0, 1)).toHaveText('')
	expect(await domEvents(page, 'row-delete')).toEqual([])
	expect(await domEvents(page, 'row-change')).toEqual([expect.objectContaining({ rowIndex: 0, field: 'name', oldValue: 'Alpha', newValue: null })])
})

test.describe('expand-change', () => {
	test('a chevron click → { path, isExpanded, expandedPaths }, once per toggle', async ({ page }) => {
		await chevron(page, '1.1').click()
		const d = await onceWithTwin(page, 'expand-change', 'tree')
		expect(d.path).toBe('1.1')
		expect(d.isExpanded).toBe(false)
		expect(d.expandedPaths).not.toContain('1.1')
		expect(d.expandedPaths).toContain('1')
		await expect(gridLocator(page, 'tree').locator('tbody tr.wg__row')).toHaveCount(4)  // Leaf A1 hidden

		await clearEvents(page, 'events')
		await chevron(page, '1.1').click()
		const d2 = await onceWithTwin(page, 'expand-change', 'tree')
		expect([d2.path, d2.isExpanded]).toEqual(['1.1', true])
		expect(d2.expandedPaths).toContain('1.1')
	})

	test('expandAll / collapseAll → path null', async ({ page }) => {
		await onGrid(page, el => el.collapseAll(), 'tree')
		const d = await onceWithTwin(page, 'expand-change', 'tree')
		expect([d.path, d.isExpanded, d.expandedPaths]).toEqual([null, false, []])
		await expect(gridLocator(page, 'tree').locator('tbody tr.wg__row')).toHaveCount(2)
		await clearEvents(page, 'events')
		await onGrid(page, el => el.expandAll(), 'tree')
		const d2 = await onceWithTwin(page, 'expand-change', 'tree')
		expect([d2.path, d2.isExpanded]).toEqual([null, true])
		expect(d2.expandedPaths).toEqual(expect.arrayContaining(['1', '1.1']))
	})

	test('toggleExpandedPath through the API', async ({ page }) => {
		await onGrid(page, el => el.toggleExpandedPath('1'), 'tree')
		const d = await onceWithTwin(page, 'expand-change', 'tree')
		expect([d.path, d.isExpanded]).toEqual(['1', false])
		expect(await onGrid(page, el => el.isPathExpanded('1'), 'tree')).toBe(false)
	})

	test('an earlier detail.expandedPaths is a snapshot (not mutated by later toggles)', async ({ page }) => {
		await chevron(page, '1.1').click()
		await chevron(page, '1').click()
		const sizes = await page.evaluate(() => (window as any).__events
			.filter((e: any) => e.type === 'expand-change' && e.via === 'event')
			.map((e: any) => [...e.detail.expandedPaths].sort()))
		expect(sizes).toHaveLength(2)
		// the first detail still has '1' (only 1.1 collapsed); the second lacks '1' too
		expect(sizes[0]).toContain('1')
		expect(sizes[0]).not.toContain('1.1')
		expect(sizes[1]).not.toContain('1')
		expect(sizes[0].length).toBe(sizes[1].length + 1)
	})
})

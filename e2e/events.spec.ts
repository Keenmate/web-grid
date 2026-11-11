import { test, expect, type Page, gridLocator, cell, header, onGrid, eventsOf, domEvents, clearEvents, waitForRows, editorIn, dragSelect } from './fixtures'

/**
 * Events — `cell-edit-start`, `cell-edit-cancel`, `cell-selection-change`,
 * `row-selection-change`, `column-selection-change`, `row-delete` (Ctrl+Delete),
 * `row-expand` / `row-collapse` / `expanded-change`. Each fires exactly once per happening, the
 * camelCase `on*` twin runs first with the very same detail object, and the
 * detail carries non-enumerable `controller` + `element`.
 *
 * Fixture: test/events.html — #grid (Alpha/Beta/Gamma, navigate mode,
 * click cell-selection, row numbers; 0=id, 1=name, 2=qty) and #tree (Root › Child A › Leaf A1,
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
			hasController: Array.isArray(d.controller?.items),
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

test('cell-edit-start: F2 on a cell → { row, rowIndex, field }', async ({ page }) => {
	await cell(page, 1, 1).click()
	await page.keyboard.press('F2')
	await expect(editorIn(cell(page, 1, 1))).toBeVisible()
	expect(await onceWithTwin(page, 'cell-edit-start')).toEqual({ row: { id: 2, name: 'Beta', qty: 20 }, rowIndex: 1, field: 'name' })
})

test('cell-edit-cancel: Escape → { row, rowIndex, field }, no row-change', async ({ page }) => {
	await cell(page, 2, 2).click()
	await page.keyboard.press('F2')
	await editorIn(cell(page, 2, 2)).fill('99')
	await page.keyboard.press('Escape')
	await expect(editorIn(cell(page, 2, 2))).toHaveCount(0)
	expect(await onceWithTwin(page, 'cell-edit-cancel')).toEqual({ row: { id: 3, name: 'Gamma', qty: 30 }, rowIndex: 2, field: 'qty' })
	expect(await domEvents(page, 'row-change')).toEqual([])
})

const ALPHA = { id: 1, name: 'Alpha', qty: 10 }
const BETA = { id: 2, name: 'Beta', qty: 20 }
const GAMMA = { id: 3, name: 'Gamma', qty: 30 }
const CLEARED_CELLS = { range: null, cellCount: 0, fields: [], rows: [] }

test('cell-selection-change: a drag → { range, cellCount, fields, rows }; Escape → cleared', async ({ page }) => {
	await dragSelect(page, 0, 1, 1, 2)
	const d = await onceWithTwin(page, 'cell-selection-change')
	expect(d).toEqual({
		range: { startRowIndex: 0, startColIndex: 1, endRowIndex: 1, endColIndex: 2, startField: 'name', endField: 'qty' },
		cellCount: 4,
		fields: ['name', 'qty'],
		rows: [ALPHA, BETA]
	})
	await clearEvents(page, 'events')
	await page.keyboard.press('Escape')
	expect(await onceWithTwin(page, 'cell-selection-change')).toEqual(CLEARED_CELLS)
})

test('cell-selection-change: selectCellRange / clearCellSelection through the API; no event on a no-op', async ({ page }) => {
	const range = { startRowIndex: 2, startColIndex: 0, endRowIndex: 2, endColIndex: 2, startField: 'id', endField: 'qty' }
	await onGrid(page, el => el.selectCellRange({ startRowIndex: 2, startColIndex: 0, endRowIndex: 2, endColIndex: 2, startField: 'id', endField: 'qty' }))
	expect(await onceWithTwin(page, 'cell-selection-change')).toEqual({ range, cellCount: 3, fields: ['id', 'name', 'qty'], rows: [GAMMA] })
	await clearEvents(page, 'events')
	await onGrid(page, el => el.selectCellRange({ startRowIndex: 2, startColIndex: 0, endRowIndex: 2, endColIndex: 2, startField: 'id', endField: 'qty' }))  // same range again
	expect(await eventsOf(page, 'cell-selection-change')).toEqual([])
	await onGrid(page, el => el.clearCellSelection())
	expect(await onceWithTwin(page, 'cell-selection-change')).toEqual(CLEARED_CELLS)
	await clearEvents(page, 'events')
	await onGrid(page, el => el.clearCellSelection())  // nothing to clear
	expect(await eventsOf(page, 'cell-selection-change')).toEqual([])
})

test.describe('focus-change', () => {
	test('a cell click fires it; assigning focusedRowIndex is silent (like input.value)', async ({ page }) => {
		await clearEvents(page, 'events')
		await onGrid(page, el => { el.focusedRowIndex = 2 })
		expect(await onGrid(page, el => el.focusedRowIndex)).toBe(2)
		await onGrid(page, el => { el.focusedRowIndex = null })
		expect(await onGrid(page, el => el.focusedRowIndex)).toBe(null)
		await onGrid(page, el => { el.focusedRowIndex = 0 })
		expect(await eventsOf(page, 'focus-change')).toEqual([])

		// user interaction still fires, oldRowIndex = the silently assigned row
		await cell(page, 1, 1).click()
		expect(await onceWithTwin(page, 'focus-change')).toEqual({ rowIndex: 1, row: BETA, oldRowIndex: 0 })
	})
})

test.describe('row-selection-change', () => {
	const rowNumber = (page: Page, row: number) => gridLocator(page).locator(`.wg__row-number[data-row-number="${row}"]`)

	test('row-number click / Ctrl+click / Shift+click → { rows, rowIndices }, once each; re-click is a no-op', async ({ page }) => {
		await rowNumber(page, 0).click()
		expect(await onceWithTwin(page, 'row-selection-change')).toEqual({ rows: [ALPHA], rowIndices: [0] })

		await clearEvents(page, 'events')
		await rowNumber(page, 0).click()  // already the selection
		await expect(gridLocator(page).locator('tr.wg__row--selected')).toHaveCount(1)
		expect(await eventsOf(page, 'row-selection-change')).toEqual([])

		await rowNumber(page, 2).click({ modifiers: ['Control'] })
		expect(await onceWithTwin(page, 'row-selection-change')).toEqual({ rows: [ALPHA, GAMMA], rowIndices: [0, 2] })

		await clearEvents(page, 'events')
		await rowNumber(page, 1).click()
		await rowNumber(page, 2).click({ modifiers: ['Shift'] })
		expect(await domEvents(page, 'row-selection-change')).toEqual([
			{ rows: [BETA], rowIndices: [1] },
			{ rows: [BETA, GAMMA], rowIndices: [1, 2] }
		])
	})

	test('a row-number drag fires once (on mouseup) with the final rows', async ({ page }) => {
		const a = await rowNumber(page, 0).boundingBox()
		const b = await rowNumber(page, 2).boundingBox()
		if (!a || !b) throw new Error('no box')
		await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
		await page.mouse.down()
		await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 })
		await expect(gridLocator(page).locator('tr.wg__row--selected')).toHaveCount(3)
		expect(await eventsOf(page, 'row-selection-change')).toEqual([])  // held during the drag
		await page.mouse.up()
		expect(await onceWithTwin(page, 'row-selection-change')).toEqual({ rows: [ALPHA, BETA, GAMMA], rowIndices: [0, 1, 2] })
	})

	test('selectRow / selectRowRange / clearSelection through the API; no event on a no-op', async ({ page }) => {
		await onGrid(page, el => el.selectRow(1))
		expect(await onceWithTwin(page, 'row-selection-change')).toEqual({ rows: [BETA], rowIndices: [1] })
		await clearEvents(page, 'events')
		await onGrid(page, el => el.selectRow(1))
		expect(await eventsOf(page, 'row-selection-change')).toEqual([])
		await onGrid(page, el => el.selectRowRange(2, 0))
		expect(await onceWithTwin(page, 'row-selection-change')).toEqual({ rows: [ALPHA, BETA, GAMMA], rowIndices: [0, 1, 2] })
		await clearEvents(page, 'events')
		await onGrid(page, el => el.selectRow(1, 'toggle'))
		expect(await onceWithTwin(page, 'row-selection-change')).toEqual({ rows: [ALPHA, GAMMA], rowIndices: [0, 2] })
		await clearEvents(page, 'events')
		await onGrid(page, el => el.clearSelection())
		expect(await onceWithTwin(page, 'row-selection-change')).toEqual({ rows: [], rowIndices: [] })
		await clearEvents(page, 'events')
		await onGrid(page, el => el.clearSelection())
		expect(await eventsOf(page, 'row-selection-change')).toEqual([])
	})

	test('a cell range replacing the row selection reports the rows cleared', async ({ page }) => {
		await onGrid(page, el => el.selectRow(0))
		await clearEvents(page, 'events')
		await dragSelect(page, 1, 1, 2, 2)
		expect(await onceWithTwin(page, 'row-selection-change')).toEqual({ rows: [], rowIndices: [] })
		expect((await onceWithTwin(page, 'cell-selection-change')).cellCount).toBe(4)
	})
})

test.describe('column-selection-change', () => {
	test('header click / Ctrl+click / Shift+click → { fields }, once each; re-click is a no-op', async ({ page }) => {
		await header(page, 'name').click()
		expect(await onceWithTwin(page, 'column-selection-change')).toEqual({ fields: ['name'] })
		await clearEvents(page, 'events')
		await header(page, 'name').click()
		expect(await eventsOf(page, 'column-selection-change')).toEqual([])
		await header(page, 'id').click({ modifiers: ['Control'] })
		expect(await onceWithTwin(page, 'column-selection-change')).toEqual({ fields: ['id', 'name'] })
		await clearEvents(page, 'events')
		await header(page, 'qty').click({ modifiers: ['Shift'] })
		expect(await onceWithTwin(page, 'column-selection-change')).toEqual({ fields: ['id', 'name', 'qty'] })
	})

	test('a header drag fires once (on mouseup) with the final columns', async ({ page }) => {
		const a = await header(page, 'id').boundingBox()
		const b = await header(page, 'qty').boundingBox()
		if (!a || !b) throw new Error('no box')
		await page.mouse.move(a.x + 10, a.y + a.height / 2)
		await page.mouse.down()
		await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 })
		await expect(gridLocator(page).locator('th.wg__header--selected')).toHaveCount(3)
		expect(await eventsOf(page, 'column-selection-change')).toEqual([])
		await page.mouse.up()
		expect(await onceWithTwin(page, 'column-selection-change')).toEqual({ fields: ['id', 'name', 'qty'] })
	})

	test('selectColumn / selectColumnRange / clearColumnSelection through the controller; no event on a no-op', async ({ page }) => {
		await onGrid(page, el => el.controller.selectColumn(2))
		expect(await onceWithTwin(page, 'column-selection-change')).toEqual({ fields: ['qty'] })
		await clearEvents(page, 'events')
		await onGrid(page, el => el.controller.selectColumn(2))
		expect(await eventsOf(page, 'column-selection-change')).toEqual([])
		await onGrid(page, el => el.controller.selectColumnRange(0, 1))
		expect(await onceWithTwin(page, 'column-selection-change')).toEqual({ fields: ['id', 'name'] })
		await clearEvents(page, 'events')
		await onGrid(page, el => el.controller.clearColumnSelection())
		expect(await onceWithTwin(page, 'column-selection-change')).toEqual({ fields: [] })
		await clearEvents(page, 'events')
		await onGrid(page, el => el.controller.clearColumnSelection())
		expect(await eventsOf(page, 'column-selection-change')).toEqual([])
	})

	test('selecting a row clears the columns → column-selection-change { fields: [] } + row-selection-change', async ({ page }) => {
		await onGrid(page, el => el.controller.selectColumn(1))
		await clearEvents(page, 'events')
		await onGrid(page, el => el.selectRow(0))
		expect(await onceWithTwin(page, 'column-selection-change')).toEqual({ fields: [] })
		expect(await onceWithTwin(page, 'row-selection-change')).toEqual({ rows: [ALPHA], rowIndices: [0] })
	})
})

test('row-delete: Ctrl+Delete removes the row, then reports it — { rows, rowIndices }', async ({ page }) => {
	await cell(page, 1, 1).click()
	await page.keyboard.press('Control+Delete')
	await expect(gridLocator(page).locator('tbody tr.wg__row')).toHaveCount(2)
	expect(await onceWithTwin(page, 'row-delete')).toEqual({ rows: [{ id: 2, name: 'Beta', qty: 20 }], rowIndices: [1] })
	expect(await onGrid(page, el => el.items.map((r: any) => r.name))).not.toContain('Beta')
})

test('row-delete: Cmd+Delete (macOS) does the same', async ({ page }) => {
	await cell(page, 1, 1).click()
	await page.keyboard.press('Meta+Delete')
	await expect(gridLocator(page).locator('tbody tr.wg__row')).toHaveCount(2)
	expect(await onceWithTwin(page, 'row-delete')).toEqual({ rows: [{ id: 2, name: 'Beta', qty: 20 }], rowIndices: [1] })
})

test('row-delete: beforeActionCallback returning false vetoes Ctrl+Delete (no removal, no event)', async ({ page }) => {
	await onGrid(page, el => { el.beforeActionCallback = (d: any) => d.action !== 'delete' })
	await cell(page, 1, 1).click()
	await page.keyboard.press('Control+Delete')
	await page.waitForTimeout(100)
	await expect(gridLocator(page).locator('tbody tr.wg__row')).toHaveCount(3)
	expect(await domEvents(page, 'row-delete')).toEqual([])
})

test('plain Delete clears the cell (row-change to null), no row-delete', async ({ page }) => {
	await cell(page, 0, 1).click()
	await page.keyboard.press('Delete')
	await expect(cell(page, 0, 1)).toHaveText('')
	expect(await domEvents(page, 'row-delete')).toEqual([])
	expect(await domEvents(page, 'row-change')).toEqual([expect.objectContaining({ rowIndex: 0, field: 'name', oldValue: 'Alpha', newValue: null })])
})

test.describe('row-expand / row-collapse / expanded-change', () => {
	test('a chevron click → row-collapse { row, path }, then expanded-change { paths }', async ({ page }) => {
		await chevron(page, '1.1').click()
		const r = await onceWithTwin(page, 'row-collapse', 'tree')
		expect(r.path).toBe('1.1')
		expect(r.row).toEqual(expect.objectContaining({ path: '1.1' }))
		const d = await onceWithTwin(page, 'expanded-change', 'tree')
		expect(d.paths).not.toContain('1.1')
		expect(d.paths).toContain('1')
		expect(await domEvents(page, 'row-expand')).toEqual([])
		await expect(gridLocator(page, 'tree').locator('tbody tr.wg__row')).toHaveCount(4)  // Leaf A1 hidden

		await clearEvents(page, 'events')
		await chevron(page, '1.1').click()
		expect((await onceWithTwin(page, 'row-expand', 'tree')).path).toBe('1.1')
		expect((await onceWithTwin(page, 'expanded-change', 'tree')).paths).toContain('1.1')
	})

	test('expandAll / collapseAll → only expanded-change (no row events)', async ({ page }) => {
		await onGrid(page, el => el.collapseAll(), 'tree')
		expect((await onceWithTwin(page, 'expanded-change', 'tree')).paths).toEqual([])
		expect(await domEvents(page, 'row-collapse')).toEqual([])
		await expect(gridLocator(page, 'tree').locator('tbody tr.wg__row')).toHaveCount(2)
		await clearEvents(page, 'events')
		await onGrid(page, el => el.expandAll(), 'tree')
		expect((await onceWithTwin(page, 'expanded-change', 'tree')).paths).toEqual(expect.arrayContaining(['1', '1.1']))
		expect(await domEvents(page, 'row-expand')).toEqual([])
	})

	test('expandAll(path) / collapseAll(path) act on that subtree only', async ({ page }) => {
		await onGrid(page, el => el.collapseAll('1.1'), 'tree')
		expect(await onGrid(page, el => [el.isPathExpanded('1'), el.isPathExpanded('1.1')], 'tree')).toEqual([true, false])
		await onGrid(page, el => el.expandAll('1.1'), 'tree')
		expect(await onGrid(page, el => el.isPathExpanded('1.1'), 'tree')).toBe(true)
	})

	test('toggleRowExpanded / expandRows / collapseRows through the API', async ({ page }) => {
		await onGrid(page, el => el.toggleRowExpanded('1'), 'tree')
		expect((await onceWithTwin(page, 'row-collapse', 'tree')).path).toBe('1')
		expect(await onGrid(page, el => el.isPathExpanded('1'), 'tree')).toBe(false)
		await clearEvents(page, 'events')
		await onGrid(page, el => el.expandRows(['1']), 'tree')
		expect((await onceWithTwin(page, 'row-expand', 'tree')).path).toBe('1')
		await clearEvents(page, 'events')
		await onGrid(page, el => el.collapseRows('1'), 'tree')
		expect((await onceWithTwin(page, 'row-collapse', 'tree')).path).toBe('1')
		expect(await onGrid(page, el => [...el.controller.expandedPaths].includes('1'), 'tree')).toBe(false)
	})

	test('an earlier detail.paths is a snapshot (not mutated by later toggles)', async ({ page }) => {
		await chevron(page, '1.1').click()
		await chevron(page, '1').click()
		const sizes = await page.evaluate(() => (window as any).__events
			.filter((e: any) => e.type === 'expanded-change' && e.via === 'event')
			.map((e: any) => [...e.detail.paths].sort()))
		expect(sizes).toHaveLength(2)
		// the first detail still has '1' (only 1.1 collapsed); the second lacks '1' too
		expect(sizes[0]).toContain('1')
		expect(sizes[0]).not.toContain('1.1')
		expect(sizes[1]).not.toContain('1')
		expect(sizes[0].length).toBe(sizes[1].length + 1)
	})
})

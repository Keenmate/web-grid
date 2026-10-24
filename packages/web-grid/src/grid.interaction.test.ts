// =============================================================================
// Interaction model — component context on ctx objects, notifications, the
// row operations behind the row built-ins, single-ctx column callbacks.
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { GridEngine } from './grid.js'
import type { Column } from './types.js'

type Row = { id: number; name: string; qty: number }

const rows = (): Row[] => [
	{ id: 1, name: 'a', qty: 1 },
	{ id: 2, name: 'b', qty: 2 },
	{ id: 3, name: 'c', qty: 3 }
]

function makeGrid() {
	const grid = new GridEngine<Row>()
	const element = document.createElement('div')
	const controller = { marker: 'controller' }
	const events: { name: string; detail: Record<string, unknown> }[] = []
	grid.attachHost(element, () => controller as never, (name, detail) => {
		events.push({ name, detail: detail as Record<string, unknown> })
	})
	grid.idMember = 'id'
	grid.items = rows()
	grid.columns = [
		{ field: 'name', title: 'Name' },
		{ field: 'qty', title: 'Qty' }
	] as Column<Row>[]
	return { grid, element, controller, events }
}

describe('component context', () => {
	it('ctx carries controller + element, non-enumerable', () => {
		const { grid, element, controller } = makeGrid()
		const ctx = grid.rowCtx(grid.items[0], 0)
		expect(ctx.controller).toBe(controller)
		expect(ctx.element).toBe(element)
		expect(Object.keys(ctx)).toEqual(['row', 'rowIndex'])
		expect(JSON.parse(JSON.stringify(ctx))).toEqual({ row: { id: 1, name: 'a', qty: 1 }, rowIndex: 0 })
	})

	it('cellCtx carries the draft-aware raw value and the column index', () => {
		const { grid } = makeGrid()
		const ctx = grid.cellCtx(grid.items[1], 1, grid.columns[1])
		expect(ctx).toMatchObject({ rowIndex: 1, colIndex: 1, field: 'qty', value: 2 })
	})

	it('a standalone engine (no host) builds plain ctx objects', () => {
		const grid = new GridEngine<Row>()
		const ctx = grid.ctx({ a: 1 })
		expect(ctx.a).toBe(1)
		expect(ctx.controller).toBeUndefined()
	})
})

describe('single-ctx column callbacks', () => {
	it('getDisplayValueCallback / renderCellCallback get the cell ctx', () => {
		const { grid, controller } = makeGrid()
		const seen: unknown[] = []
		grid.columns = [{
			field: 'qty',
			title: 'Qty',
			getDisplayValueCallback: (ctx) => {
				seen.push(ctx.controller)
				return `${ctx.value} pcs (${(ctx.row as Row).name})`
			}
		}] as Column<Row>[]
		expect(grid.getCellValue(grid.items[0], grid.columns[0], 0)).toBe('1 pcs (a)')
		expect(seen[0]).toBe(controller)
	})

	it('filterCallback gets { filterValue, row, column, field }', () => {
		const { grid } = makeGrid()
		grid.isFilterable = true
		grid.columns = [{
			field: 'qty',
			title: 'Qty',
			filterCallback: ({ filterValue, row }) => (row as Row).qty >= Number(filterValue)
		}] as Column<Row>[]
		grid.setFilter('qty', '2')
		expect(grid.filteredItems.map(r => r.id)).toEqual([2, 3])
	})

	it("filterMode 'server' doesn't filter, still notifies filter-change", () => {
		const { grid, events } = makeGrid()
		grid.isFilterable = true
		grid.filterMode = 'server'
		grid.setFilter('name', 'zzz')
		expect(grid.filteredItems).toHaveLength(3)
		expect(events.at(-1)).toMatchObject({ name: 'filter-change', detail: { filters: { name: 'zzz' } } })
	})
})

describe('notifications', () => {
	it('commitEdit notifies edit-start / row-change; validateCallback gets source', async () => {
		const { grid, events } = makeGrid()
		let source: unknown
		grid.isEditable = true
		grid.columns = [{ field: 'qty', title: 'Qty', validateCallback: (ctx) => { source = ctx.source; return ctx.value === 99 ? 'too many' : null } }] as Column<Row>[]
		grid.startEdit(0, 'qty')
		await grid.commitEdit(0, 'qty', 5)
		expect(source).toBe('edit')
		expect(events.map(e => e.name)).toEqual(['edit-start', 'row-change'])
		expect(events[1].detail).toMatchObject({ field: 'qty', oldValue: 1, newValue: 5, isValid: true })

		await grid.commitEdit(1, 'qty', 99, false, 'paste')
		expect(source).toBe('paste')
		expect(events.find(e => e.name === 'validation-error')?.detail).toMatchObject({ error: 'too many', source: 'paste' })
	})

	it('fireDataRequest always notifies data-request', () => {
		const { grid, events } = makeGrid()
		grid.fireDataRequest('sort')
		expect(events.at(-1)).toMatchObject({ name: 'data-request', detail: { trigger: 'sort', mode: 'replace' } })
	})
})

describe('row operations (the row built-ins)', () => {
	let g: ReturnType<typeof makeGrid>
	beforeEach(() => { g = makeGrid() })

	it('insertRow inserts after a row, or at the end', () => {
		g.grid.insertRow({ id: 9, name: 'x', qty: 0 }, g.grid.items[0])
		expect(g.grid.items.map(r => r.id)).toEqual([1, 9, 2, 3])
		g.grid.insertRow({ id: 10, name: 'y', qty: 0 })
		expect(g.grid.items.map(r => r.id)).toEqual([1, 9, 2, 3, 10])
	})

	it('removeRows removes the given rows', () => {
		g.grid.removeRows([g.grid.items[0], g.grid.items[2]])
		expect(g.grid.items.map(r => r.id)).toEqual([2])
	})

	it('duplicateRow inserts a copy after the row with the id cleared', () => {
		const copy = g.grid.duplicateRow(g.grid.items[1])
		expect(g.grid.items.map(r => r.name)).toEqual(['a', 'b', 'b', 'c'])
		expect(copy).not.toBe(g.grid.items[1])
		expect('id' in (copy as object)).toBe(false)
	})

	it('moveRow swaps with the displayed neighbour; no-op at the edges', () => {
		const b = g.grid.items[1]
		g.grid.moveRow(b, -1)
		expect(g.grid.items.map(r => r.id)).toEqual([2, 1, 3])
		g.grid.moveRow(b, -1)
		expect(g.grid.items.map(r => r.id)).toEqual([2, 1, 3])
		g.grid.moveRow(g.grid.items[2], 1)
		expect(g.grid.items.map(r => r.id)).toEqual([2, 1, 3])
	})
})

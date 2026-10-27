// =============================================================================
// isCellEditable resolution order
// =============================================================================
// Focuses on the gates documented at grid.ts:2980 — including the v1.2.0
// "tree column is always read-only when tree mode is active" hard veto.

import { describe, it, expect, beforeEach } from 'vitest'
import { GridEngine } from './grid.js'
import type { Column } from './types.js'

type Row = { id: number; path: string; name: string; status: string }

const sampleRows: Row[] = [
	{ id: 1, path: '1',     name: 'Acme',        status: 'Active' },
	{ id: 2, path: '1.1',   name: 'Engineering', status: 'Active' },
	{ id: 3, path: '1.1.1', name: 'Platform',    status: 'Active' },
	{ id: 4, path: '1.1.2', name: 'Apps',        status: 'Reorganizing' }
]

function makeGrid(opts?: { tree?: boolean }): GridEngine<Row> {
	const grid = new GridEngine<Row>()
	grid.idMember = 'id'  // silences the missing-identity warning when isEditable is true
	grid.items = sampleRows
	grid.columns = [
		{ field: 'name',   isTree: !!opts?.tree },
		{ field: 'status' }
	] as Column<Row>[]
	if (opts?.tree) grid.pathMember = 'path'
	return grid
}

describe('isCellEditable — gate ordering', () => {
	let grid: GridEngine<Row>

	beforeEach(() => {
		grid = makeGrid()
	})

	it('returns grid-level isEditable when no per-column rule is set', () => {
		grid.isEditable = false
		expect(grid.isCellEditable(grid.columns[0], sampleRows[0])).toBe(false)
		grid.isEditable = true
		expect(grid.isCellEditable(grid.columns[0], sampleRows[0])).toBe(true)
	})

	it('column.isEditable === false hard-vetoes even when grid is editable', () => {
		grid.isEditable = true
		grid.columns = [{ field: 'name', isEditable: false } as Column<Row>, ...grid.columns.slice(1)]
		expect(grid.isCellEditable(grid.columns[0], sampleRows[0])).toBe(false)
	})

	it('column.isEditable === true overrides a non-editable grid', () => {
		grid.isEditable = false
		grid.columns = [{ field: 'name', isEditable: true } as Column<Row>, ...grid.columns.slice(1)]
		expect(grid.isCellEditable(grid.columns[0], sampleRows[0])).toBe(true)
	})

	it('column.getIsEditableCallback is called per row', () => {
		grid.isEditable = false
		grid.columns = [
			{
				field: 'status',
				getIsEditableCallback: ({ row }: { row: Row }) => row.status === 'Active'
			} as Column<Row>
		]
		expect(grid.isCellEditable(grid.columns[0], sampleRows[0])).toBe(true)   // Active
		expect(grid.isCellEditable(grid.columns[0], sampleRows[3])).toBe(false)  // Reorganizing
	})

	it('getIsRowEditableCallback vetoes regardless of column rule', () => {
		grid.isEditable = true
		grid.columns = [{ field: 'name', isEditable: true } as Column<Row>, ...grid.columns.slice(1)]
		grid.getIsRowEditableCallback = ({ row }) => row.status === 'Active'
		expect(grid.isCellEditable(grid.columns[0], sampleRows[0])).toBe(true)   // Active
		expect(grid.isCellEditable(grid.columns[0], sampleRows[3])).toBe(false)  // Reorganizing
	})

	it('isRowEditable === false vetoes the entire grid', () => {
		grid.isEditable = true
		grid.isRowEditable = false
		expect(grid.isCellEditable(grid.columns[0], sampleRows[0])).toBe(false)
	})

	it('grid-level isRowEditable + per-column predicate compose with AND semantics', () => {
		grid.isEditable = true
		grid.columns = [
			{
				field: 'name',
				getIsEditableCallback: ({ row }: { row: Row }) => row.id !== 1   // skip Acme
			} as Column<Row>
		]
		grid.getIsRowEditableCallback = ({ row }) => row.status === 'Active'

		// Row 1 (Acme): Active passes row gate, but column predicate says no → false
		expect(grid.isCellEditable(grid.columns[0], sampleRows[0])).toBe(false)
		// Row 3 (Platform): Active + id !== 1 → true
		expect(grid.isCellEditable(grid.columns[0], sampleRows[2])).toBe(true)
		// Row 4 (Apps, Reorganizing): row gate fails → false even though column predicate would pass
		expect(grid.isCellEditable(grid.columns[0], sampleRows[3])).toBe(false)
	})
})

describe('isCellEditable — tree column hard veto (v1.2.0)', () => {
	it('tree column in tree mode is read-only even with isEditable: true', () => {
		const grid = makeGrid({ tree: true })
		grid.isEditable = true
		grid.columns = [
			{ field: 'name', isTree: true, isEditable: true } as Column<Row>,
			{ field: 'status' } as Column<Row>
		]
		expect(grid.isTreeMode).toBe(true)
		expect(grid.isCellEditable(grid.columns[0], sampleRows[0])).toBe(false)  // tree col vetoed
		expect(grid.isCellEditable(grid.columns[1], sampleRows[0])).toBe(true)   // non-tree col fine
	})

	it('tree column outside tree mode is editable like any other column', () => {
		// isTree: true on a column but the grid has no pathMember → not tree mode
		const grid = makeGrid()
		grid.isEditable = true
		grid.columns = [
			{ field: 'name', isTree: true } as Column<Row>,
			{ field: 'status' } as Column<Row>
		]
		expect(grid.isTreeMode).toBe(false)
		expect(grid.isCellEditable(grid.columns[0], sampleRows[0])).toBe(true)
	})

	it('tree column veto runs ahead of column.isEditable === false', () => {
		// Both vetoes would apply; tree veto wins (and matters because it's the v1.2.0 promise:
		// even if a caller sets isEditable: true on the tree column, it stays read-only).
		const grid = makeGrid({ tree: true })
		grid.isEditable = true
		grid.columns = [
			{ field: 'name', isTree: true, isEditable: false } as Column<Row>
		]
		expect(grid.isCellEditable(grid.columns[0], sampleRows[0])).toBe(false)
	})

	it('tree column veto applies under per-row predicates too', () => {
		const grid = makeGrid({ tree: true })
		grid.isEditable = true
		grid.columns = [
			{
				field: 'name',
				isTree: true,
				isEditable: () => true
			} as Column<Row>
		]
		expect(grid.isCellEditable(grid.columns[0], sampleRows[0])).toBe(false)
	})
})

describe('getEditableColumns', () => {
	it('returns empty array when no column passes isCellEditable for the row', () => {
		const grid = makeGrid()
		grid.isEditable = false  // grid-level read-only
		expect(grid.getEditableColumns(sampleRows[0])).toHaveLength(0)
	})

	it('skips the tree column in tree mode even if all others are editable', () => {
		const grid = makeGrid({ tree: true })
		grid.isEditable = true
		grid.columns = [
			{ field: 'name', isTree: true } as Column<Row>,
			{ field: 'status' } as Column<Row>
		]
		const editable = grid.getEditableColumns(sampleRows[0])
		expect(editable.map(ec => ec.column.field)).toEqual(['status'])
	})

	it('skips rows with zero editable columns (heterogeneous tree)', () => {
		// Per-column predicate: only Active rows are editable.
		const grid = makeGrid()
		grid.isEditable = true
		grid.columns = [
			{
				field: 'status',
				getIsEditableCallback: ({ row }: { row: Row }) => row.status === 'Active'
			} as Column<Row>
		]
		expect(grid.getEditableColumns(sampleRows[0]).length).toBe(1)  // Active row
		expect(grid.getEditableColumns(sampleRows[3]).length).toBe(0)  // Reorganizing row
	})
})

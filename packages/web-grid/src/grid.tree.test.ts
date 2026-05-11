// =============================================================================
// Tree mode helpers — separator detection, getRowTreeInfo,
// findNearestExpandedAncestor, expand/collapse state and subtree variants.
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { WebGrid } from './grid.js'
import type { Column } from './types.js'

type OrgRow = { path: string; name: string }
type FsRow = { path: string; kind: 'file' | 'folder' }

const orgRows: OrgRow[] = [
	{ path: '1',         name: 'Acme' },
	{ path: '1.1',       name: 'Engineering' },
	{ path: '1.1.1',     name: 'Platform' },
	{ path: '1.1.1.1',   name: 'Infra' },
	{ path: '1.1.1.2',   name: 'Build' },
	{ path: '1.1.2',     name: 'Apps' },
	{ path: '1.2',       name: 'Sales' }
]

function makeOrgGrid(): WebGrid<OrgRow> {
	const grid = new WebGrid<OrgRow>()
	grid.items = orgRows
	grid.columns = [{ field: 'name', isTree: true } as Column<OrgRow>]
	grid.treePathMember = 'path'
	return grid
}

describe('isTreeMode', () => {
	it('is true only when treePathMember is set AND items produce a tree index', () => {
		const grid = new WebGrid<OrgRow>()
		expect(grid.isTreeMode).toBe(false)
		grid.items = orgRows
		grid.columns = [{ field: 'name', isTree: true } as Column<OrgRow>]
		expect(grid.isTreeMode).toBe(false)  // no treePathMember yet
		grid.treePathMember = 'path'
		expect(grid.isTreeMode).toBe(true)
	})
})

describe('getRowTreeInfo', () => {
	let grid: WebGrid<OrgRow>

	beforeEach(() => {
		grid = makeOrgGrid()
	})

	it('returns null in non-tree mode', () => {
		const flat = new WebGrid<OrgRow>()
		flat.items = orgRows
		expect(flat.getRowTreeInfo(orgRows[0])).toBeNull()
	})

	it('returns level 0 for root paths with the auto-detected separator', () => {
		const info = grid.getRowTreeInfo(orgRows[0])  // path: '1'
		expect(info).not.toBeNull()
		expect(info!.level).toBe(0)
		expect(info!.path).toBe('1')
	})

	it('returns correct level for deep paths', () => {
		const info = grid.getRowTreeInfo(orgRows[3])  // path: '1.1.1.1'
		expect(info!.level).toBe(3)
		expect(info!.path).toBe('1.1.1.1')
	})

	it('hasChildren is true for parent rows', () => {
		expect(grid.getRowTreeInfo(orgRows[0])!.hasChildren).toBe(true)   // '1' has '1.1', '1.2'
		expect(grid.getRowTreeInfo(orgRows[2])!.hasChildren).toBe(true)   // '1.1.1' has '1.1.1.1', '1.1.1.2'
	})

	it('hasChildren is false for leaf rows', () => {
		expect(grid.getRowTreeInfo(orgRows[3])!.hasChildren).toBe(false)  // '1.1.1.1' is leaf
		expect(grid.getRowTreeInfo(orgRows[6])!.hasChildren).toBe(false)  // '1.2' is leaf in this dataset
	})
})

describe('separator auto-detection', () => {
	it('detects "/" for filesystem-style paths', () => {
		const grid = new WebGrid<FsRow>()
		grid.items = [
			{ path: '/src', kind: 'folder' },
			{ path: '/src/components', kind: 'folder' },
			{ path: '/src/index.ts', kind: 'file' }
		]
		grid.columns = [{ field: 'path', isTree: true } as Column<FsRow>]
		grid.treePathMember = 'path'
		const info = grid.getRowTreeInfo(grid.items[1])
		expect(info!.level).toBe(1)              // '/src/components' is one level under '/src'
		expect(info!.hasChildren).toBe(false)    // '/src/components' has no children in this dataset
	})

	it('honors explicit treeSeparator when provided', () => {
		const grid = new WebGrid<{ path: string }>()
		grid.items = [
			{ path: 'a' },
			{ path: 'a|b' },
			{ path: 'a|b|c' }
		]
		grid.columns = [{ field: 'path', isTree: true } as Column<{ path: string }>]
		grid.treePathMember = 'path'
		grid.treeSeparator = '|'
		expect(grid.getRowTreeInfo(grid.items[2])!.level).toBe(2)
		expect(grid.getRowTreeInfo(grid.items[2])!.path).toBe('a|b|c')
	})
})

describe('expandedPaths state', () => {
	let grid: WebGrid<OrgRow>

	beforeEach(() => {
		grid = makeOrgGrid()
		grid.expandedPaths = new Set()  // start collapsed for predictable tests
	})

	it('isPathExpanded reflects the current set', () => {
		grid.toggleExpandedPath('1')
		expect(grid.isPathExpanded('1')).toBe(true)
		expect(grid.isPathExpanded('1.1')).toBe(false)
	})

	it('toggleExpandedPath flips the state', () => {
		grid.toggleExpandedPath('1.1')
		expect(grid.isPathExpanded('1.1')).toBe(true)
		grid.toggleExpandedPath('1.1')
		expect(grid.isPathExpanded('1.1')).toBe(false)
	})

	it('toggleExpandedPath fires onexpandedpathschange with the path and new state', () => {
		const events: { path: string; expanded: boolean }[] = []
		grid.onexpandedpathschange = ({ path, expanded }) => events.push({ path, expanded })

		grid.toggleExpandedPath('1.1')
		grid.toggleExpandedPath('1.1.1')
		grid.toggleExpandedPath('1.1')

		expect(events).toEqual([
			{ path: '1.1',   expanded: true },
			{ path: '1.1.1', expanded: true },
			{ path: '1.1',   expanded: false }
		])
	})

	it('expandAll expands every parent in the tree', () => {
		grid.expandAll()
		expect(grid.isPathExpanded('1')).toBe(true)
		expect(grid.isPathExpanded('1.1')).toBe(true)
		expect(grid.isPathExpanded('1.1.1')).toBe(true)
	})

	it('collapseAll empties the set', () => {
		grid.expandAll()
		grid.collapseAll()
		expect(grid.expandedPaths.size).toBe(0)
	})
})

describe('findNearestExpandedAncestor', () => {
	let grid: WebGrid<OrgRow>

	beforeEach(() => {
		grid = makeOrgGrid()
		grid.expandedPaths = new Set()
	})

	it('returns null when no ancestor is expanded', () => {
		expect(grid.findNearestExpandedAncestor('1.1.1.1')).toBeNull()
	})

	it('returns the deepest expanded ancestor', () => {
		grid.toggleExpandedPath('1')
		grid.toggleExpandedPath('1.1')
		expect(grid.findNearestExpandedAncestor('1.1.1.1')).toBe('1.1')
	})

	it('returns the only expanded ancestor when there is just one', () => {
		grid.toggleExpandedPath('1')
		expect(grid.findNearestExpandedAncestor('1.1.1.1')).toBe('1')
	})

	it('does not return the input path itself even when expanded', () => {
		grid.toggleExpandedPath('1.1.1')
		// '1.1.1' is expanded, but we ask about '1.1.1' — the function walks ancestors,
		// not self. With no expanded ancestor, returns null.
		expect(grid.findNearestExpandedAncestor('1.1.1')).toBeNull()
	})
})

describe('expandSubtree / collapseSubtree (per-row variants)', () => {
	let grid: WebGrid<OrgRow>

	beforeEach(() => {
		grid = makeOrgGrid()
		grid.expandedPaths = new Set()
	})

	it('expandSubtree expands the path and all its descendants that have children', () => {
		grid.expandSubtree('1.1')
		// '1.1' is the root we asked to expand, and '1.1.1' is a descendant with children.
		expect(grid.isPathExpanded('1.1')).toBe(true)
		expect(grid.isPathExpanded('1.1.1')).toBe(true)
		// Sibling subtrees are untouched.
		expect(grid.isPathExpanded('1')).toBe(false)
		expect(grid.isPathExpanded('1.2')).toBe(false)
	})

	it('collapseSubtree collapses the path and all descendants', () => {
		grid.expandAll()
		grid.collapseSubtree('1.1')
		expect(grid.isPathExpanded('1.1')).toBe(false)
		expect(grid.isPathExpanded('1.1.1')).toBe(false)
		// Other branches stay expanded.
		expect(grid.isPathExpanded('1')).toBe(true)
	})
})

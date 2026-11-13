// =============================================================================
// Action items — built-in defaults, activation, built-in behaviour
// =============================================================================
// Every clickable grid item (row toolbar, inline actions, cell toolbar, cell
// context menu, header context menu, keyboard shortcuts) is a core action item
// (web-components-core `/actions`). This module is the one place that:
//   - knows each built-in's default text / icon / visibility / disabled state,
//   - activates an item in the shared order (`runAction`: beforeActionCallback →
//     onClick → built-in → `action` event), and
//   - implements the built-ins.

import {
	runAction,
	readActionDataset,
	resolveActionItem,
	type ActionItem,
	type ActionSource,
	type MenuItem,
	type ResolvedActionItem
} from '@keenmate/web-components-core/actions'
import type { GridHost } from '../grid-context.js'
import type { Column } from '../../types.js'
import type {
	GridAction,
	GridActionEventDetail,
	GridCellAction,
	GridHeaderAction,
	GridRowAction,
	HeaderMenuContext,
	RowContext,
	CellContext,
	GridShortcut,
	GridRangeShortcut,
	RangeContext
} from '../../interaction.js'
import { parseKeyCombo, matchesKeyCombo } from '../keyboard/index.js'
import { applySort } from '../events/sort.js'

const ROW_ACTIONS: readonly GridRowAction[] = ['add', 'delete', 'duplicate', 'move-up', 'move-down']
const TREE_ACTIONS: readonly string[] = ['expand', 'collapse', 'expand-subtree', 'collapse-subtree', 'expand-all', 'collapse-all']
const HEADER_ACTIONS: readonly string[] = ['sort-asc', 'sort-desc', 'clear-sort', 'hide-column', 'freeze-column', 'unfreeze-column', 'column-visibility', 'show-all-columns', 'toggle-column']

export const isRowAction = (a: unknown): a is GridRowAction => ROW_ACTIONS.includes(a as GridRowAction)
export const isTreeAction = (a: unknown): boolean => TREE_ACTIONS.includes(a as string)
export const isHeaderAction = (a: unknown): a is GridHeaderAction => HEADER_ACTIONS.includes(a as string)

// SVG icons for the row built-ins (16x16 viewBox, stroke-based)
const ROW_ICONS: Record<GridRowAction, string> = {
	'add': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
	'delete': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>',
	'duplicate': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V4a1 1 0 011-1h7"/></svg>',
	'move-up': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V3M4 7l4-4 4 4"/></svg>',
	'move-down': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v10M4 9l4 4 4-4"/></svg>'
}

/** Expand the string shorthand (`'delete'` → `{ action: 'delete' }`); dividers / objects pass through. */
export function normalizeEntry<E>(entry: string | E): E {
	return (typeof entry === 'string' ? { action: entry } : entry) as E
}

// =============================================================================
// Built-in defaults (text / icon / visibility / disabled / danger)
// =============================================================================

/**
 * Defaults of a row built-in for the row in `ctx` (null row → no row-dependent state).
 * move-up / move-down judge the whole target block (the selection when the row is in it).
 */
export function rowActionDefaults<T>(host: GridHost<T>, action: string | undefined, ctx: { row?: T }): Partial<ResolvedActionItem<GridAction>> | undefined {
	if (!isRowAction(action)) return undefined
	const labels = host.engine.labels.actions
	const display = host.engine.displayItems
	const positions = rowTargets<T>(host, ctx.row).map(r => display.indexOf(r)).filter(p => p >= 0)
	const top = positions.length ? Math.min(...positions) : -1
	const bottom = positions.length ? Math.max(...positions) : -1
	// A read-only grid changes no rows: every row built-in is disabled
	const isLocked = host.engine.isReadonly || host.engine.isDisabled
	switch (action) {
		case 'add': return { text: labels.add, icon: ROW_ICONS.add, isDisabled: isLocked }
		case 'delete': return { text: labels.delete, icon: ROW_ICONS.delete, isDanger: true, isDisabled: isLocked }
		case 'duplicate': return { text: labels.duplicate, icon: ROW_ICONS.duplicate, isDisabled: isLocked }
		case 'move-up': return { text: labels.moveUp, icon: ROW_ICONS['move-up'], isDisabled: isLocked || top <= 0 }
		case 'move-down': return { text: labels.moveDown, icon: ROW_ICONS['move-down'], isDisabled: isLocked || bottom === -1 || bottom >= display.length - 1 }
	}
}

/** Defaults of a cell-context-menu built-in (row + tree actions). */
export function cellMenuDefaults<T>(host: GridHost<T>, action: string | undefined, ctx: CellContext<T>): Partial<ResolvedActionItem<GridAction>> | undefined {
	if (isRowAction(action)) {
		const d = rowActionDefaults(host, action, ctx)
		return d && { ...d, icon: undefined }  // the toolbar SVGs don't suit a text menu
	}
	const engine = host.engine
	const labels = engine.labels.actions
	switch (action) {
		// Per-row: the targets (the selection when the row is in it, else the row); leaves hide them.
		// expand / collapse = one level; *-subtree = the row and everything under it.
		case 'expand': {
			const targets = treeTargetPaths(host, ctx.row)
			return { text: labels.expand, icon: '▾', isVisible: targets.length > 0, isDisabled: targets.every(p => engine.isPathExpanded(p)) }
		}
		case 'collapse': {
			const targets = treeTargetPaths(host, ctx.row)
			return { text: labels.collapse, icon: '▸', isVisible: targets.length > 0, isDisabled: !targets.some(p => engine.isPathExpanded(p)) }
		}
		case 'expand-subtree': return { text: labels.expandSubtree, icon: '⇊', isVisible: treeTargetPaths(host, ctx.row).length > 0 }
		case 'collapse-subtree': return { text: labels.collapseSubtree, icon: '⇈', isVisible: treeTargetPaths(host, ctx.row).length > 0 }
		// The whole tree
		case 'expand-all': return { text: labels.expandAll, icon: '⤓', isVisible: engine.isTreeMode }
		case 'collapse-all': return { text: labels.collapseAll, icon: '⤒', isVisible: engine.isTreeMode && engine.expandedPathCount > 0 }
	}
	return undefined
}

const HEADER_ICONS: Partial<Record<GridHeaderAction, string>> = {
	'sort-asc': '↑', 'sort-desc': '↓', 'clear-sort': '✕', 'hide-column': '👁',
	'freeze-column': '❄', 'unfreeze-column': '☀', 'column-visibility': '👁'
}

/** Defaults of a header-menu built-in for the column in `ctx`. */
export function headerMenuDefaults<T>(action: string | undefined, ctx: HeaderMenuContext<T>): Partial<ResolvedActionItem<GridAction>> | undefined {
	if (!isHeaderAction(action)) return undefined
	const l = ctx.labels.contextMenu
	const icon = HEADER_ICONS[action]
	switch (action) {
		case 'sort-asc': return { text: l.sortAsc, icon, isVisible: !!ctx.column && ctx.column.isSortable !== false }
		case 'sort-desc': return { text: l.sortDesc, icon, isVisible: !!ctx.column && ctx.column.isSortable !== false }
		case 'clear-sort': return { text: l.clearSort, icon, isVisible: ctx.sortDirection !== null }
		// The tree column hosts indent + chevron; hiding it would orphan the hierarchy
		case 'hide-column': return { text: l.hideColumn, icon, isVisible: !!ctx.column && !(ctx.isTreeMode && ctx.column.isTree) }
		case 'freeze-column': return { text: l.freezeColumn, icon, isVisible: !!ctx.column && !ctx.isFrozen }
		case 'unfreeze-column': return { text: l.unfreezeColumn, icon, isVisible: !!ctx.column && ctx.isFrozen }
		case 'column-visibility': return { text: l.columnVisibility, icon }
		case 'show-all-columns': return { text: l.showAll }
	}
	return undefined
}

/** Class of the column-visibility toggles (menuitemcheckbox items) — a styling hook. */
const COLUMN_TOGGLE_CLASS = 'wg-header-menu__column-toggle'

/**
 * The header-menu entries with the `column-visibility` built-in's submenu filled in:
 * "Show all" + one toggle per column (the tree column stays visible in tree mode).
 * Toggles keep the menu open and re-render with the new state (core `/menu` refreshes
 * the level after a keep-open item). Applied through `openMenu`'s `prepareItem`.
 */
export function withHeaderBuiltInChildren<T>(item: MenuItem<HeaderMenuContext<T>, GridHeaderAction>): MenuItem<HeaderMenuContext<T>, GridHeaderAction> {
	if (item.action !== 'column-visibility' || item.children || item.getChildrenCallback) return item
	return {
		...item,
		getChildrenCallback: (ctx) => {
			const togglable = ctx.allColumns.filter((col: Column<T>) => !(ctx.isTreeMode && col.isTree))
			const allVisible = togglable.every(col => !col.isHidden)
			return [
				{ action: 'show-all-columns', icon: allVisible ? '☑' : '☐', isToggled: allVisible, shouldCloseOnClick: false, cssClass: COLUMN_TOGGLE_CLASS },
				...togglable.map(col => ({
					action: 'toggle-column' as const,
					id: String(col.field),
					text: col.title || String(col.field),
					icon: col.isHidden ? '☐' : '☑',
					isToggled: !col.isHidden,
					shouldCloseOnClick: false,
					cssClass: COLUMN_TOGGLE_CLASS
				}))
			]
		}
	}
}

// =============================================================================
// Activation
// =============================================================================

export type ActivateOptions<T> = {
	item: ActionItem<any, any>
	/** The surface context (row / cell / header / range fields) — plain data, the component context is added. */
	fields: object
	source: ActionSource
	sourceEvent?: Event
	triggerElement?: HTMLElement
	/** Runs after the built-in and the `action` event — surface follow-up (close the toolbar, …). */
	after?: (detail: GridActionEventDetail<T>) => void
}

/**
 * Activate an item: beforeActionCallback (`false` cancels) → item.onClick →
 * the built-in → the `action` event (+ `onAction`) — a notification after the
 * fact, so a listener sees the new `items` (row added / gone / moved). Resolves
 * false when cancelled (or ignored while the same item is still busy).
 */
export async function activateGridItem<T>(host: GridHost<T>, opts: ActivateOptions<T>): Promise<boolean> {
	const engine = host.engine
	const { item } = opts
	const action = (item.action ?? 'custom') as GridAction | 'custom'
	const detail = engine.ctx({
		...opts.fields,
		action,
		...(item.id !== undefined ? { id: item.id } : {}),
		item,
		source: opts.source,
		sourceEvent: opts.sourceEvent,
		triggerElement: opts.triggerElement,
		dataset: readActionDataset(opts.triggerElement)
	}) as unknown as GridActionEventDetail<T>
	const ran = await runAction<any, GridAction>({
		detail: detail as any,
		beforeActionCallback: engine.beforeActionCallback as any,
		emitAction: (d) => engine.notify('action', d as any),
		runBuiltIn: (d) => runBuiltIn(host, d as unknown as GridActionEventDetail<T>)
	})
	if (ran) opts.after?.(detail)
	return ran
}

async function runBuiltIn<T>(host: GridHost<T>, d: GridActionEventDetail<T>): Promise<void> {
	if (isRowAction(d.action)) return runRowBuiltIn(host, d)
	if (isTreeAction(d.action)) return runTreeBuiltIn(host, d)
	if (isHeaderAction(d.action)) return runHeaderBuiltIn(host, d)
}

/**
 * The built-ins on rows. `add` inserts after `d.row`; delete / duplicate / move-up /
 * move-down act on the targets (`rowTargets`: `d.rows`, else the selection when
 * `d.row` is in it, else `d.row`). The row selection follows its rows afterwards.
 */
async function runRowBuiltIn<T>(host: GridHost<T>, d: GridActionEventDetail<T>): Promise<void> {
	const engine = host.engine
	if (engine.isReadonly || engine.isDisabled) return  // a read-only grid changes no rows
	const restoreSelection = engine.keepRowSelection()
	try {
		await runRowBuiltInOn(host, d)
	} finally {
		restoreSelection()
	}
}

async function runRowBuiltInOn<T>(host: GridHost<T>, d: GridActionEventDetail<T>): Promise<void> {
	const engine = host.engine
	const row = d.row as T | undefined
	const targets = rowTargets<T>(host, row, d.rows)
	switch (d.action) {
		case 'add': {
			const created = engine.createEmptyRowCallback
				? await engine.createEmptyRowCallback(engine.ctx({}))
				: blankRow(engine.columns)
			engine.insertRow(created, row ?? null)
			return
		}
		case 'delete': {
			const rows = targets
			if (rows.length === 0) return
			const display = engine.displayItems
			const rowIndices = rows.map(r => display.indexOf(r))
			engine.removeRows(rows)
			engine.notify('row-delete', { rows, rowIndices })
			return
		}
		case 'duplicate':
			for (const r of targets) engine.duplicateRow(r)  // each copy right after its original
			return
		case 'move-up':
		case 'move-down': {
			// The targets move as a block: nothing moves when its leading row can't
			const delta = d.action === 'move-up' ? -1 : 1
			const display = engine.displayItems
			const ordered = targets.filter(r => display.indexOf(r) >= 0)
				.sort((a, b) => (display.indexOf(a) - display.indexOf(b)) * -delta)  // the leading edge first
			const edge = ordered.length ? display.indexOf(ordered[0]) : -1
			if (edge === -1 || edge + delta < 0 || edge + delta >= display.length) return
			// The focused cell follows its row (the moved one, or the neighbour it swapped
			// with), so e.g. a repeated Alt+ArrowDown keeps moving the same row.
			const focused = engine.focusedCell
			const focusedRow = focused ? engine.displayItems[focused.rowIndex] : undefined
			for (const r of ordered) engine.moveRow(r, delta)
			if (focused && focusedRow !== undefined) {
				const newIndex = engine.displayItems.indexOf(focusedRow)
				if (newIndex >= 0 && newIndex !== focused.rowIndex) engine.setFocusedCell(newIndex, focused.colIndex)
			}
			return
		}
	}
}

function blankRow<T>(columns: Column<T>[]): T {
	const row: Record<string, unknown> = {}
	for (const col of columns) row[String(col.field)] = null
	return row as T
}

/**
 * Rows a row / tree action acts on: `rows` when given (a range shortcut), else the
 * whole row selection (display order) when `row` is in it, else just `row`.
 */
function rowTargets<T>(host: GridHost<T>, row: unknown, rows?: unknown[]): T[] {
	if (rows?.length) return rows as T[]
	if (row === undefined) return []
	const selected = host.engine.selectedRows
	return selected.includes(row as T) ? selected : [row as T]
}

/** Tree paths a per-row tree action acts on: the `rowTargets` with children. */
function treeTargetPaths<T>(host: GridHost<T>, row: unknown, rows?: unknown[]): string[] {
	const engine = host.engine
	const paths: string[] = []
	for (const r of rowTargets<T>(host, row, rows)) {
		const info = engine.getRowTreeInfo(r as T)
		if (info?.hasChildren) paths.push(info.path)
	}
	return paths
}

function runTreeBuiltIn<T>(host: GridHost<T>, d: GridActionEventDetail<T>): void {
	const engine = host.engine
	switch (d.action) {
		case 'expand': engine.expandRows(treeTargetPaths(host, d.row, d.rows)); return
		case 'collapse': engine.collapseRows(treeTargetPaths(host, d.row, d.rows)); return
		case 'expand-subtree': { const p = treeTargetPaths(host, d.row, d.rows); if (p.length) engine.expandAll(p); return }
		case 'collapse-subtree': { const p = treeTargetPaths(host, d.row, d.rows); if (p.length) engine.collapseAll(p); return }
		case 'expand-all': engine.expandAll(null); return
		case 'collapse-all': engine.collapseAll(null); return
	}
}

function runHeaderBuiltIn<T>(host: GridHost<T>, d: GridActionEventDetail<T>): void {
	const engine = host.engine
	const field = (d.field as string | undefined) ?? ''
	const colIndex = (d.colIndex as number | undefined) ?? -1
	switch (d.action) {
		case 'sort-asc':
		case 'sort-desc': {
			const direction = d.action === 'sort-asc' ? 'asc' : 'desc'
			const ctrlKey = (d.sourceEvent as MouseEvent | undefined)?.ctrlKey === true
			if (ctrlKey && engine.sortMode === 'multiple') {
				// Multi-sort: Ctrl+click adds/updates this column
				const next = [...engine.sort]
				const i = next.findIndex(s => s.column === field)
				if (i >= 0) next[i] = { column: field, direction }
				else next.push({ column: field, direction })
				applySort(host, next)
			} else {
				applySort(host, [{ column: field, direction }])
			}
			return
		}
		case 'clear-sort':
			applySort(host, engine.sort.filter(s => s.column !== field))
			return
		case 'hide-column': {
			// Refuse to hide the tree column in tree mode — chevrons would be orphaned
			const col = engine.columns.find(c => String(c.field) === field)
			if (col && !(engine.isTreeMode && col.isTree)) {
				col.isHidden = true
				engine.columns = [...engine.columns]
			}
			return
		}
		case 'freeze-column':
			host.setAttributes({ frozenColumnCount: colIndex + 1 })
			return
		case 'unfreeze-column':
			host.setAttributes({ frozenColumnCount: Math.max(0, colIndex) })
			return
		case 'show-all-columns':
			engine.columns.forEach(col => { col.isHidden = false })
			engine.columns = [...engine.columns]
			return
		case 'toggle-column': {
			const col = engine.columns.find(c => String(c.field) === d.id)
			if (col) {
				col.isHidden = !col.isHidden
				engine.columns = [...engine.columns]
			}
			return
		}
	}
}

// =============================================================================
// Keyboard shortcuts
// =============================================================================

/** The first enabled, visible shortcut matching `e` (row shortcuts get built-in defaults). */
export function findShortcut<T, S extends GridShortcut<T> | GridRangeShortcut<T>>(
	host: GridHost<T>,
	e: KeyboardEvent,
	shortcuts: readonly S[] | undefined,
	ctx: object
): S | null {
	if (!shortcuts?.length) return null
	for (const shortcut of shortcuts) {
		if (!shortcut?.shortcut || !matchesKeyCombo(e, parseKeyCombo(shortcut.shortcut))) continue
		const resolved = resolveActionItem(shortcut as ActionItem<any, any>, ctx, rowActionDefaults(host, shortcut.action, ctx as RowContext<T>))
		if (resolved.isVisible && !resolved.isDisabled) return shortcut
	}
	return null
}

/** Run a matching row shortcut on the cell / row in `fields`; true when one ran (the key was consumed). */
export function handleRowShortcut<T>(
	host: GridHost<T>,
	e: KeyboardEvent,
	fields: Omit<CellContext<T>, 'controller' | 'element'>,
	shouldStopPropagation = false,
	after?: (detail: GridActionEventDetail<T>) => void
): boolean {
	const ctx = host.engine.ctx(fields)
	const shortcut = findShortcut(host, e, host.engine.rowShortcuts, ctx)
	if (!shortcut) return false
	e.preventDefault()
	if (shouldStopPropagation) e.stopPropagation()
	void activateGridItem(host, { item: shortcut, fields, source: 'keyboard', sourceEvent: e, after })
	return true
}

/** Run a matching range shortcut on the selection in `fields`; true when one ran. */
export function handleRangeShortcut<T>(host: GridHost<T>, e: KeyboardEvent, fields: Omit<RangeContext<T>, 'controller' | 'element'>): boolean {
	const ctx = host.engine.ctx(fields)
	const shortcut = findShortcut(host, e, host.engine.rangeShortcuts, ctx)
	if (!shortcut) return false
	e.preventDefault()
	void activateGridItem(host, { item: shortcut, fields, source: 'keyboard', sourceEvent: e })
	return true
}

/** Plain cell fields for a row's first column (shortcuts fired from the toolbar / hovered row). */
export function rowCellFields<T>(host: GridHost<T>, row: T, rowIndex: number): Omit<CellContext<T>, 'controller' | 'element'> {
	const column = host.engine.columns[0]
	const field = column ? String(column.field) : ''
	return { row, rowIndex, column, colIndex: 0, field, value: column ? host.engine.getCellRawValue(row, rowIndex, field) : undefined }
}

export type { GridCellAction }

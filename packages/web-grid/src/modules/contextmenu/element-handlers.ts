// =============================================================================
// Context-menu element-handlers
// =============================================================================
// Extracted from GridElement. Wires the host's `contextmenu` event to the three
// menu surfaces the grid supports — cell, column-header, and header-filler. The
// menu itself is core `openMenu()` (see ./index.ts); the open one is `ctx.menu`.
// Shift+F10 / the ContextMenu key open the cell menu on the focused cell
// (`openCellMenuFromKeyboard`).

import { runBeforeCallbackSync } from '@keenmate/web-components-core'
import type { MenuItem } from '@keenmate/web-components-core/actions'
import type { GridHost } from '../grid-context.js'
import type {
	CellContext,
	GridHeaderAction,
	GridHeaderMenuEntry,
	GridMenuEntry,
	HeaderMenuContext
} from '../../interaction.js'
import { openGridMenu } from './index.js'
import {
	activateGridItem,
	cellMenuDefaults,
	headerMenuDefaults,
	normalizeEntry,
	withHeaderBuiltInChildren
} from '../items/index.js'

/**
 * Top-level right-click dispatcher: routes to header / filler / cell handlers
 * based on the click target. Each sub-handler decides whether to preventDefault
 * (no menu → the browser's shows).
 */
export function handleContextMenu<T>(ctx: GridHost<T>, e: MouseEvent): void {
	const target = e.target as HTMLElement

	// Check for header right-click first
	const header = target.closest('.wg__header') as HTMLElement
	if (header) {
		handleHeaderContextMenu(ctx, e, header)
		return
	}

	// Check for header filler cell right-click
	const fillerHeader = target.closest('th.wg__filler') as HTMLElement
	if (fillerHeader) {
		handleFillerContextMenu(ctx, e)
		return
	}

	// The browser's keyboard-initiated `contextmenu` (Shift+F10 / ContextMenu key,
	// not a right button) after ours already opened from the keydown: don't show
	// the native one too. A pointer press closes our menu before a right-click's
	// `contextmenu` arrives.
	if (ctx.menu?.isOpen && e.button !== 2) {
		e.preventDefault()
		return
	}

	const cell = target.closest('.wg__cell') as HTMLElement
	if (!cell) return // Right-click not on a cell
	if (openCellMenu(ctx, cell, { x: e.clientX, y: e.clientY }, false)) e.preventDefault()
}

/**
 * Shift+F10 / the ContextMenu key: open the cell menu on the focused cell, below
 * it, with the first item focused. Returns `false` when there is no menu to open.
 */
export function openCellMenuFromKeyboard<T>(ctx: GridHost<T>): boolean {
	const focused = ctx.engine.focusedCell
	if (!focused || ctx.engine.editingCell) return false
	const cell = ctx.shadow.querySelector(
		`.wg__cell[data-row="${focused.rowIndex}"][data-col="${focused.colIndex}"]`
	) as HTMLElement | null
	if (!cell) return false
	return openCellMenu(ctx, cell, cell, true)
}

/** Open the cell menu for `cell` at `at` (the pointer, or the cell itself from the keyboard). */
function openCellMenu<T>(ctx: GridHost<T>, cell: HTMLElement, at: { x: number; y: number } | HTMLElement, isFromKeyboard: boolean): boolean {
	const engine = ctx.engine
	if (!engine.contextMenu?.length && !engine.beforeContextMenuOpenCallback) {
		return false // No context menu defined, use browser default
	}

	const rowIndex = parseInt(cell.dataset.row || '0', 10)
	const colIndex = parseInt(cell.dataset.col || '0', 10)
	const column = engine.columns[colIndex]
	if (!column) return false
	const row = engine.displayItems[rowIndex]
	if (!row) return false

	const fields = {
		row,
		rowIndex,
		column,
		colIndex,
		field: String(column.field),
		value: engine.getCellRawValue(row, rowIndex, String(column.field))
	}
	const menuCtx: CellContext<T> = engine.ctx(fields)

	// beforeContextMenuOpenCallback: false → no grid menu (the browser's shows); entries → shown instead
	const gate = runBeforeCallbackSync<CellContext<T>, GridMenuEntry<T>[]>(engine.beforeContextMenuOpenCallback, menuCtx, 'beforeContextMenuOpenCallback')
	if (gate.isRejected) return false
	const entries = 'value' in gate && Array.isArray(gate.value) ? gate.value : engine.contextMenu ?? []
	if (!entries.length) return false

	// From the keyboard the menu drops below the cell; the pointer offsets apply to a right-click.
	return openGridMenu(ctx, {
		kind: 'cell',
		entries,
		ctx: menuCtx,
		at,
		offset: isFromKeyboard ? undefined : { x: engine.contextMenuXOffset, y: engine.contextMenuYOffset },
		defaults: (item) => cellMenuDefaults(ctx, item.action, menuCtx),
		activate: (item, triggerElement, event) => activateGridItem(ctx, {
			item, fields, source: 'context-menu', sourceEvent: event, triggerElement
		}),
		// Back to what had focus (the cell, when opened from the keyboard) — never
		// focus a cell that wasn't focused (that would move the grid's focus).
		returnFocusTo: (ctx.shadow.activeElement as HTMLElement | null) ?? null,
		shouldFocusFirst: isFromKeyboard
	})
}

/** Open the header menu for `fields` (a column, or the filler with `column: null`). */
function openHeaderMenu<T>(
	ctx: GridHost<T>,
	e: MouseEvent,
	fields: Omit<HeaderMenuContext<T>, 'controller' | 'element'>,
	baseEntries: readonly GridHeaderMenuEntry<T>[]
): void {
	const engine = ctx.engine
	const menuCtx: HeaderMenuContext<T> = engine.ctx(fields)

	// beforeHeaderMenuOpenCallback: false → no grid menu; entries → shown instead
	const gate = runBeforeCallbackSync<HeaderMenuContext<T>, GridHeaderMenuEntry<T>[]>(engine.beforeHeaderMenuOpenCallback, menuCtx, 'beforeHeaderMenuOpenCallback')
	if (gate.isRejected) return
	const entries = 'value' in gate && Array.isArray(gate.value) ? gate.value : baseEntries
	if (!entries.length) return

	const opened = openGridMenu(ctx, {
		kind: 'header',
		entries,
		ctx: menuCtx,
		at: { x: e.clientX, y: e.clientY },
		defaults: (item) => headerMenuDefaults(item.action, menuCtx),
		prepareItem: (item) => withHeaderBuiltInChildren(item as MenuItem<HeaderMenuContext<T>, GridHeaderAction>),
		activate: (item, triggerElement, event) => activateGridItem(ctx, {
			item, fields, source: 'header-menu', sourceEvent: event, triggerElement
		}),
		// Headers aren't focusable — focus goes back to where it was (the focused cell)
		returnFocusTo: (ctx.shadow.activeElement as HTMLElement | null) ?? null
	})
	if (opened) e.preventDefault()
}

/**
 * Right-click on a column header — the header context menu (sort, freeze, hide,
 * column visibility, custom items).
 */
export function handleHeaderContextMenu<T>(
	ctx: GridHost<T>,
	e: MouseEvent,
	header: HTMLElement
): void {
	const engine = ctx.engine
	if (!engine.headerContextMenu?.length && !engine.beforeHeaderMenuOpenCallback) {
		return // No header context menu defined, use browser default
	}

	const field = header.dataset.field
	if (!field) return
	const colIndex = engine.columns.findIndex(c => String(c.field) === field)
	if (colIndex === -1) return

	openHeaderMenu(ctx, e, {
		column: engine.columns[colIndex],
		field,
		colIndex,
		sortDirection: engine.sort.find(s => s.column === field)?.direction ?? null,
		isFrozen: colIndex < engine.frozenColumnCount,
		isTreeMode: engine.isTreeMode,
		allColumns: engine.columns,  // All columns (hidden included) for the visibility submenu
		labels: engine.labels
	}, engine.headerContextMenu ?? [])
}

/**
 * Right-click on the header filler (empty area after the last column): only the
 * column-agnostic entries — `column-visibility`, and custom items without a
 * dynamic text / icon (those likely read the column) — since there's no column.
 */
export function handleFillerContextMenu<T>(ctx: GridHost<T>, e: MouseEvent): void {
	const engine = ctx.engine
	if (!engine.headerContextMenu?.length && !engine.beforeHeaderMenuOpenCallback) {
		return // No header context menu defined, use browser default
	}

	const fillerEntries = (engine.headerContextMenu ?? []).filter(raw => {
		const entry = normalizeEntry<Exclude<GridHeaderMenuEntry<T>, string>>(raw as Exclude<GridHeaderMenuEntry<T>, string>)
		if ('divider' in entry) return true
		if (entry.action === 'column-visibility') return true
		if (entry.action && entry.action !== 'custom') return false
		return !entry.getTextCallback && !entry.getIconCallback
	})

	openHeaderMenu(ctx, e, {
		column: null,
		field: '',
		colIndex: -1,
		sortDirection: null,
		isFrozen: false,
		isTreeMode: engine.isTreeMode,
		allColumns: engine.columns,
		labels: engine.labels
	}, fillerEntries)
}

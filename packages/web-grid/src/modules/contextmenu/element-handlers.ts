// =============================================================================
// Context-menu element-handlers
// =============================================================================
// Extracted from GridElement. Wires the host's `contextmenu` event to the three
// menu surfaces the grid supports — cell, column-header, and header-filler — and
// owns the open/close lifecycle for the menu element tracked on
// `ctx.contextMenuElement` / `ctx.headerContextMenuElement`.

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
import { closeContextMenu, openContextMenu } from './index.js'
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

	// Cell context menu
	const engine = ctx.engine
	if (!engine.contextMenu?.length && !engine.beforeContextMenuOpenCallback) {
		return // No context menu defined, use browser default
	}

	const cell = target.closest('.wg__cell') as HTMLElement
	if (!cell) return // Right-click not on a cell

	const rowIndex = parseInt(cell.dataset.row || '0', 10)
	const colIndex = parseInt(cell.dataset.col || '0', 10)
	const column = engine.columns[colIndex]
	if (!column) return
	const row = engine.displayItems[rowIndex]
	if (!row) return

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
	if (gate.isCancelled) return
	const entries = 'value' in gate && Array.isArray(gate.value) ? gate.value : engine.contextMenu ?? []
	if (!entries.length) return

	e.preventDefault()

	// Close any existing context menu
	if (ctx.contextMenuElement) {
		closeContextMenu(ctx.contextMenuElement)
		ctx.contextMenuElement = null
	}

	// Sync any shadowed own properties to grid (workaround for property shadowing)
	const ownXOffset = Object.getOwnPropertyDescriptor(ctx, 'contextMenuXOffset')
	const ownYOffset = Object.getOwnPropertyDescriptor(ctx, 'contextMenuYOffset')
	if (ownXOffset && 'value' in ownXOffset) {
		engine.contextMenuXOffset = ownXOffset.value
		delete (ctx as any).contextMenuXOffset // Remove shadow
	}
	if (ownYOffset && 'value' in ownYOffset) {
		engine.contextMenuYOffset = ownYOffset.value
		delete (ctx as any).contextMenuYOffset // Remove shadow
	}

	ctx.contextMenuElement = openContextMenu(
		ctx,
		e.clientX,
		e.clientY,
		engine.contextMenuXOffset,
		engine.contextMenuYOffset,
		{
			entries,
			ctx: menuCtx,
			defaults: (item) => cellMenuDefaults(ctx, item.action, menuCtx),
			activate: (item, triggerElement, event) => activateGridItem(ctx, {
				item, fields, source: 'context-menu', sourceEvent: event, triggerElement
			})
		},
		() => { ctx.contextMenuElement = null }
	)
}

/** Close both menus (a new one is opening). */
function closeMenus<T>(ctx: GridHost<T>): void {
	if (ctx.contextMenuElement) {
		closeContextMenu(ctx.contextMenuElement)
		ctx.contextMenuElement = null
	}
	if (ctx.headerContextMenuElement) {
		closeContextMenu(ctx.headerContextMenuElement)
		ctx.headerContextMenuElement = null
	}
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
	if (gate.isCancelled) return
	const entries = 'value' in gate && Array.isArray(gate.value) ? gate.value : baseEntries
	if (!entries.length) return

	e.preventDefault()
	closeMenus(ctx)

	ctx.headerContextMenuElement = openContextMenu(
		ctx,
		e.clientX,
		e.clientY,
		0,
		0,
		{
			entries,
			ctx: menuCtx,
			defaults: (item) => headerMenuDefaults(item.action, menuCtx),
			prepare: (item) => withHeaderBuiltInChildren(item as MenuItem<HeaderMenuContext<T>, GridHeaderAction>),
			activate: (item, triggerElement, event) => activateGridItem(ctx, {
				item, fields, source: 'header-menu', sourceEvent: event, triggerElement
			})
		},
		() => { ctx.headerContextMenuElement = null }
	)
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
		isFrozen: colIndex < engine.freezeColumns,
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

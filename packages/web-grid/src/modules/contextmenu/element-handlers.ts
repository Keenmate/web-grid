// =============================================================================
// Context-menu element-handlers
// =============================================================================
// Extracted from GridElement. Wires the document-level `contextmenu` event to
// the three menu surfaces the grid supports — cell, column-header, and
// header-filler — and owns the open/close lifecycle for the menu element
// tracked on `ctx.contextMenuElement` / `ctx.headerContextMenuElement`.

import type { GridContext } from '../grid-context.js'
import type { Column, HeaderMenuContext } from '../../types.js'
import {
	closeContextMenu,
	openContextMenu,
	openHeaderContextMenu,
	normalizeContextMenu,
	normalizeHeaderMenuItems,
	executeHeaderMenuAction
} from './index.js'

/**
 * Top-level right-click dispatcher: routes to header / filler / cell handlers
 * based on the click target. Called unconditionally on the host listener;
 * each sub-handler decides whether to preventDefault.
 */
export function handleContextMenu<T>(ctx: GridContext<T>, e: MouseEvent): void {
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

	// Handle cell context menu
	const contextMenuConfig = ctx.grid.contextMenu
	if (!contextMenuConfig || contextMenuConfig.length === 0) {
		return // No context menu defined, use browser default
	}
	// Expand string shorthand and `type`-based items into fully-defined items
	const contextMenuItems = normalizeContextMenu(contextMenuConfig, ctx.grid)

	const cell = target.closest('.wg__cell') as HTMLElement
	if (!cell) {
		return // Right-click not on a cell
	}

	e.preventDefault()

	// Close any existing context menu
	if (ctx.contextMenuElement) {
		closeContextMenu(ctx.contextMenuElement)
		ctx.contextMenuElement = null
	}

	const rowIndex = parseInt(cell.dataset.row || '0', 10)
	const colIndex = parseInt(cell.dataset.col || '0', 10)
	const column = ctx.grid.columns[colIndex]
	if (!column) return

	const item = ctx.grid.displayItems[rowIndex]
	if (!item) return

	const field = String(column.field)
	const cellValue = ctx.grid.getCellRawValue(item, rowIndex, field)

	// Create context for callbacks
	const menuContext = {
		row: item,
		rowIndex,
		colIndex,
		column,
		cellValue
	}

	// Fire oncontextmenuopen event
	if (ctx.grid.oncontextmenuopen) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		;(ctx.grid.oncontextmenuopen as (ctx: any) => void)(menuContext)
	}

	// Sync any shadowed own properties to grid (workaround for property shadowing)
	const ownXOffset = Object.getOwnPropertyDescriptor(ctx, 'contextMenuXOffset')
	const ownYOffset = Object.getOwnPropertyDescriptor(ctx, 'contextMenuYOffset')
	if (ownXOffset && 'value' in ownXOffset) {
		ctx.grid.contextMenuXOffset = ownXOffset.value
		delete (ctx as any).contextMenuXOffset // Remove shadow
	}
	if (ownYOffset && 'value' in ownYOffset) {
		ctx.grid.contextMenuYOffset = ownYOffset.value
		delete (ctx as any).contextMenuYOffset // Remove shadow
	}

	// Open the context menu
	ctx.contextMenuElement = openContextMenu(
		ctx,
		e.clientX,
		e.clientY,
		ctx.grid.contextMenuXOffset,
		ctx.grid.contextMenuYOffset,
		contextMenuItems,
		menuContext,
		(itemId: string) => {
			// Find the clicked item and call its onclick
			const clickedItem = contextMenuItems.find(item => item.id === itemId)
			if (clickedItem?.onclick) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				;(clickedItem.onclick as (ctx: any) => void | Promise<void>)(menuContext)
			}
			// Close menu after click
			if (ctx.contextMenuElement) {
				closeContextMenu(ctx.contextMenuElement)
				ctx.contextMenuElement = null
			}
		},
		() => {
			// onClose callback
			ctx.contextMenuElement = null
		}
	)
}

/**
 * Right-click on a column header — opens the header context menu (sort,
 * freeze, hide, column visibility submenu). Fires `onheadercontextmenuopen`
 * before the menu renders so consumers can mutate the items list.
 */
export function handleHeaderContextMenu<T>(
	ctx: GridContext<T>,
	e: MouseEvent,
	header: HTMLElement
): void {
	const headerMenuItems = ctx.grid.headerContextMenu
	if (!headerMenuItems || headerMenuItems.length === 0) {
		return // No header context menu defined, use browser default
	}

	e.preventDefault()

	// Close any existing context menu (cell or header)
	if (ctx.contextMenuElement) {
		closeContextMenu(ctx.contextMenuElement)
		ctx.contextMenuElement = null
	}
	if (ctx.headerContextMenuElement) {
		closeContextMenu(ctx.headerContextMenuElement)
		ctx.headerContextMenuElement = null
	}

	// Get column info from header
	const field = header.dataset.field
	if (!field) return

	const columnIndex = ctx.grid.columns.findIndex(c => String(c.field) === field)
	if (columnIndex === -1) return

	const column = ctx.grid.columns[columnIndex]
	const frozenCount = ctx.grid.freezeColumns
	const isFrozen = columnIndex < frozenCount

	// Get sort direction for this column
	const sortState = ctx.grid.sort.find(s => s.column === field)
	const sortDirection = sortState?.direction ?? null

	// Create context for callbacks
	const menuContext: HeaderMenuContext<T> = {
		column,
		field,
		columnIndex,
		sortDirection,
		isFrozen,
		isTreeMode: ctx.grid.isTreeMode,
		allColumns: ctx.grid.columns,  // Include all columns for visibility submenu
		labels: ctx.grid.labels
	}

	// Fire onheadercontextmenuopen event
	if (ctx.grid.onheadercontextmenuopen) {
		ctx.grid.onheadercontextmenuopen(menuContext)
	}

	// Normalize menu items (convert string shortcuts to full items)
	const normalizedItems = normalizeHeaderMenuItems(headerMenuItems, menuContext)
	if (normalizedItems.length === 0) return

	// Open the header context menu
	ctx.headerContextMenuElement = openHeaderContextMenu(
		ctx,
		e.clientX,
		e.clientY,
		normalizedItems,
		menuContext,
		(itemId: string, keepOpen?: boolean, ctrlKey?: boolean) => {
			// Check if it's a predefined action
			const predefinedActions = ['sortAsc', 'sortDesc', 'clearSort', 'hideColumn', 'freezeColumn', 'unfreezeColumn']
			if (predefinedActions.includes(itemId)) {
				executeHeaderMenuAction(ctx, itemId, menuContext, ctrlKey)
			}

			// Handle "Show all" columns action
			if (itemId === 'show-all-columns') {
				ctx.grid.columns.forEach(col => {
					col.isHidden = false
				})
				ctx.grid.columns = [...ctx.grid.columns]
				return
			}

			// Handle column visibility toggles (submenu items)
			if (itemId.startsWith('toggle-col-')) {
				const field = itemId.replace('toggle-col-', '')
				const col = ctx.grid.columns.find(c => String(c.field) === field)
				if (col) {
					col.isHidden = !col.isHidden
					ctx.grid.columns = [...ctx.grid.columns]
				}
				return  // Don't search for onclick - handled here
			}

			// Also call custom onclick if defined (for top-level items)
			const clickedItem = normalizedItems.find(item => item.id === itemId)
			if (clickedItem?.onclick) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				;(clickedItem.onclick as (ctx: any) => void | Promise<void>)(menuContext)
			}

			// Close menu after click unless keepOpen is true
			if (!keepOpen && ctx.headerContextMenuElement) {
				closeContextMenu(ctx.headerContextMenuElement)
				ctx.headerContextMenuElement = null
			}
		},
		() => {
			// onClose callback
			ctx.headerContextMenuElement = null
		}
	)
}

/**
 * Right-click on the header filler (empty area after the last column). Shows a
 * restricted menu containing only column-agnostic items — `columnVisibility`
 * and static custom items — since there's no specific column to act on.
 */
export function handleFillerContextMenu<T>(ctx: GridContext<T>, e: MouseEvent): void {
	const headerMenuItems = ctx.grid.headerContextMenu
	if (!headerMenuItems || headerMenuItems.length === 0) {
		return // No header context menu defined, use browser default
	}

	e.preventDefault()

	// Close any existing context menu
	if (ctx.contextMenuElement) {
		closeContextMenu(ctx.contextMenuElement)
		ctx.contextMenuElement = null
	}
	if (ctx.headerContextMenuElement) {
		closeContextMenu(ctx.headerContextMenuElement)
		ctx.headerContextMenuElement = null
	}

	// Filter to only column-agnostic items (columnVisibility and custom items without column-specific behavior)
	const fillerMenuItems = headerMenuItems.filter(item => {
		// Keep columnVisibility
		if (item === 'columnVisibility') return true
		// Keep custom items with static labels (not functions that might access column)
		if (typeof item === 'object' && item.id) {
			// Filter out items with dynamic label/icon that likely depend on column
			if (typeof item.label === 'function') return false
			if (typeof item.icon === 'function') return false
			return true
		}
		// Filter out column-specific predefined actions
		if (typeof item === 'string') return false
		// Filter out divider-only markers
		if (typeof item === 'object' && item.dividerBefore && !item.id && !item.label) return false
		return false
	})

	if (fillerMenuItems.length === 0) return

	// Create a minimal context for filler (no specific column)
	const menuContext: HeaderMenuContext<T> = {
		column: null as unknown as Column<T>,  // No column for filler
		field: '',
		columnIndex: -1,
		sortDirection: null,
		isFrozen: false,
		isTreeMode: ctx.grid.isTreeMode,
		allColumns: ctx.grid.columns,
		labels: ctx.grid.labels
	}

	// Normalize menu items
	const normalizedItems = normalizeHeaderMenuItems(fillerMenuItems, menuContext)
	if (normalizedItems.length === 0) return

	// Open the context menu
	ctx.headerContextMenuElement = openHeaderContextMenu(
		ctx,
		e.clientX,
		e.clientY,
		normalizedItems,
		menuContext,
		(itemId: string, keepOpen?: boolean, _ctrlKey?: boolean) => {
			// Handle "Show all" columns action
			if (itemId === 'show-all-columns') {
				ctx.grid.columns.forEach(col => {
					col.isHidden = false
				})
				ctx.grid.columns = [...ctx.grid.columns]
				return
			}

			// Handle column visibility toggles
			if (itemId.startsWith('toggle-col-')) {
				const field = itemId.replace('toggle-col-', '')
				const col = ctx.grid.columns.find(c => String(c.field) === field)
				if (col) {
					col.isHidden = !col.isHidden
					ctx.grid.columns = [...ctx.grid.columns]
				}
				return
			}

			// Call custom onclick if defined
			const clickedItem = normalizedItems.find(item => item.id === itemId)
			if (clickedItem?.onclick) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				;(clickedItem.onclick as (ctx: any) => void | Promise<void>)(menuContext)
			}

			// Close menu after click unless keepOpen is true
			if (!keepOpen && ctx.headerContextMenuElement) {
				closeContextMenu(ctx.headerContextMenuElement)
				ctx.headerContextMenuElement = null
			}
		},
		() => {
			ctx.headerContextMenuElement = null
		}
	)
}

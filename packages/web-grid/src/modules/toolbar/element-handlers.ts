// =============================================================================
// Toolbar element-handlers
// =============================================================================
// Extracted from GridElement. Owns the floating-toolbar lifecycle (open / close
// / cell-item refresh / shortcut listener setup), the inline-toolbar shortcut
// listener, and the click handlers for both modes. State lives in
// `ctx.toolbar` (ToolbarService); rendering hooks go through `ctx.render()` /
// `ctx.renderConnector()` so the Element layer no longer holds this code.

import type { GridContext } from '../grid-context.js'
import type {
	NormalizedToolbarItem,
	RowToolbarConfig,
	ShortcutContext
} from '../../types.js'
import { parseKeyCombo, matchesKeyCombo } from '../keyboard/index.js'
import { showTooltip, hideTooltip } from '../tooltip/index.js'
import {
	getActiveToolbar,
	getActiveToolbarRowIndex,
	isToolbarOwnedBy,
	openToolbar,
	closeToolbar,
	normalizeToolbarItems,
	renderToolbarHTML,
	updateConnector,
	buildToolbarTooltipHtml
} from './index.js'

/**
 * Install / refresh the document-level keydown listener that drives
 * row-shortcut actions for whichever row currently owns the floating toolbar.
 * Replaces any previously-installed handler. Cleared by
 * `closeToolbarAndReset` when the toolbar closes.
 */
export function setupToolbarShortcuts<T>(ctx: GridContext<T>): void {
	// Remove any existing listener first
	const existing = ctx.toolbar.shortcutHandler
	if (existing) {
		document.removeEventListener('keydown', existing)
	}

	const shortcuts = ctx.grid.rowShortcuts
	if (!shortcuts?.length) {
		ctx.toolbar.setShortcutHandler(null)
		return
	}

	const handler: (e: KeyboardEvent) => void = (e: KeyboardEvent) => {
		// Skip if focus is in an input/editor
		const target = e.target as HTMLElement
		if (target.matches('input, textarea, select, [contenteditable="true"]')) {
			return
		}

		const toolbarRowIndex = getActiveToolbarRowIndex()
		if (toolbarRowIndex === null || !isToolbarOwnedBy(ctx.shadow)) return

		const row = ctx.grid.displayItems[toolbarRowIndex]
		if (!row) return

		const columns = ctx.grid.columns

		for (const shortcut of shortcuts) {
			const combo = parseKeyCombo(shortcut.key)
			if (matchesKeyCombo(e, combo)) {
				const sctx: ShortcutContext<T> = {
					row,
					rowIndex: toolbarRowIndex,
					colIndex: 0,
					column: columns[0],
					cellValue: null
				}

				const isDisabled = typeof shortcut.disabled === 'function'
					? shortcut.disabled(sctx)
					: shortcut.disabled === true

				if (!isDisabled) {
					e.preventDefault()
					e.stopPropagation()
					shortcut.action(sctx)
					return
				}
			}
		}
	}

	ctx.toolbar.setShortcutHandler(handler)
	document.addEventListener('keydown', handler)
}

/**
 * Inline-mode keyboard shortcuts driven by `grid.hoveredRowIndex` rather than
 * the floating toolbar's row. Replaces any previously-installed handler.
 */
export function setupInlineShortcuts<T>(ctx: GridContext<T>): void {
	removeInlineShortcuts(ctx)

	const shortcuts = ctx.grid.rowShortcuts
	if (!shortcuts?.length || ctx.grid.hoveredRowIndex === null) return

	const handler: (e: KeyboardEvent) => void = (e: KeyboardEvent) => {
		// Skip if focus is in an input/editor
		const target = e.target as HTMLElement
		if (target.matches('input, textarea, select, [contenteditable="true"]')) {
			return
		}

		const rowIndex = ctx.grid.hoveredRowIndex
		if (rowIndex === null) return

		const row = ctx.grid.displayItems[rowIndex]
		if (!row) return

		const columns = ctx.grid.columns

		for (const shortcut of shortcuts) {
			const combo = parseKeyCombo(shortcut.key)
			if (matchesKeyCombo(e, combo)) {
				const sctx: ShortcutContext<T> = {
					row,
					rowIndex,
					colIndex: 0,
					column: columns[0],
					cellValue: null
				}

				const isDisabled = typeof shortcut.disabled === 'function'
					? shortcut.disabled(sctx)
					: shortcut.disabled === true

				if (!isDisabled) {
					e.preventDefault()
					e.stopPropagation()
					shortcut.action(sctx)
					return
				}
			}
		}
	}

	ctx.toolbar.setInlineShortcutHandler(handler)
	document.addEventListener('keydown', handler)
}

/**
 * Tear down the inline-mode shortcut listener if one is installed. Safe to
 * call when nothing is registered.
 */
export function removeInlineShortcuts<T>(ctx: GridContext<T>): void {
	const handler = ctx.toolbar.inlineShortcutHandler
	if (handler) {
		document.removeEventListener('keydown', handler)
		ctx.toolbar.setInlineShortcutHandler(null)
	}
}

/**
 * Attach `mouseenter` / `mouseleave` tooltip handlers to each toolbar button.
 * Uses the item's `tooltipCallback` if present, otherwise builds the standard
 * title + description + shortcut HTML.
 */
export function setupToolbarTooltips<T>(
	ctx: GridContext<T>,
	items: NormalizedToolbarItem<T>[],
	row: T,
	rowIndex: number
): void {
	const toolbarContainer = ctx.shadow.querySelector('.wg__toolbar-container')
	if (!toolbarContainer) return

	const buttons = toolbarContainer.querySelectorAll('.wg__toolbar-btn')
	buttons.forEach(btn => {
		const button = btn as HTMLElement
		const itemId = button.dataset.toolbarItem
		const item = items.find(i => i.id === itemId)
		if (!item) return

		// Find matching keyboard shortcut from rowShortcuts
		const matchingShortcut = ctx.grid.rowShortcuts?.find(s => s.id === item.id)

		button.addEventListener('mouseenter', () => {
			// Use custom callback if provided, otherwise build standard tooltip
			const html = item.tooltipCallback
				? item.tooltipCallback(row, rowIndex)
				: buildToolbarTooltipHtml(item, matchingShortcut?.key)

			showTooltip(ctx, button, html, 0, true)
		})

		button.addEventListener('mouseleave', () => {
			hideTooltip(ctx)
		})
	})
}

/**
 * Show the floating toolbar anchored to `rowElement`. Resets any prior toolbar
 * state, installs the shortcut listener, wires up hover-tracking (for
 * `toolbarTrigger === 'hover'`), and toggles the trigger button's active class.
 * No-op in inline mode (buttons render directly in cells) or when no toolbar
 * items are configured.
 */
export function showToolbarForRow<T>(
	ctx: GridContext<T>,
	rowElement: HTMLElement,
	rowIndex: number,
	cursorX?: number
): void {
	// Skip floating toolbar in inline mode (buttons rendered directly in cells)
	if (ctx.grid.toolbarPosition === 'inline') {
		return
	}

	if (!ctx.grid.isRowToolbarVisible || !ctx.grid.rowToolbar.length) {
		return
	}

	const items = normalizeToolbarItems(ctx.grid.rowToolbar)

	const row = ctx.grid.displayItems[rowIndex]
	if (!row) {
		return
	}

	// Clear any pending hide timeout when opening new toolbar
	ctx.toolbar.clearHideTimeout()

	// Hide any toolbar tooltip left over from the previous toolbar
	// (mouseleave won't fire when the toolbar DOM is removed)
	hideTooltip(ctx, 0)

	// Reset cell toolbar state so next cell change will always update the HTML
	// (openToolbar rebuilds with base rowToolbar items, not cell-specific items)
	ctx.toolbar.setCurrentCellItemsJson(null)

	openToolbar(
		ctx,
		rowElement,
		rowIndex,
		items,
		row,
		(item: NormalizedToolbarItem<T>, event: MouseEvent, triggerElement: HTMLElement) => {
			handleToolbarItemClick(ctx, item, rowIndex, row, event, triggerElement)
		},
		cursorX
	)

	// Add document-level shortcut listener for toolbar row
	setupToolbarShortcuts(ctx)

	// Clean up any existing connector (state was reset in openToolbar)
	ctx.renderConnector()

	// Add rich tooltip handlers to toolbar buttons
	setupToolbarTooltips(ctx, items, row, rowIndex)

	// Add hover tracking to toolbar container (hover mode only)
	if (ctx.grid.toolbarTrigger === 'hover') {
		const toolbarContainer = ctx.shadow.querySelector('.wg__toolbar-container')
		if (toolbarContainer) {
			toolbarContainer.addEventListener('mouseenter', () => {
				ctx.toolbar.setIsHovered(true)
				ctx.toolbar.clearHideTimeout()
			})

			toolbarContainer.addEventListener('mouseleave', () => {
				ctx.toolbar.setIsHovered(false)
				// Don't close during move actions
				if (ctx.toolbar.isMoveInProgress) return

				// Start hide timeout when leaving the toolbar
				ctx.toolbar.setHideTimeout(setTimeout(() => {
					// Check if mouse moved back to a row or toolbar
					const table = ctx.shadow.querySelector('.wg__table')
					const isHoveringTable = table?.matches(':hover')
					const isHoveringToolbar = toolbarContainer.matches(':hover')

					if (!isHoveringTable && !isHoveringToolbar) {
						closeToolbarAndReset(ctx)
						// No render() needed — closeToolbar() surgically removes toolbar
					}
				}, 150))
			})
		}
	}

	// Update trigger button active state without full re-render
	// (re-render would destroy rowElement before Floating UI positions the toolbar)
	const triggerBtn = ctx.shadow.querySelector(`[data-toolbar-trigger="${rowIndex}"]`) as HTMLElement
	if (triggerBtn) {
		// Remove active from all triggers
		ctx.shadow.querySelectorAll('.wg__toolbar-trigger--active').forEach(el => {
			el.classList.remove('wg__toolbar-trigger--active')
		})
		triggerBtn.classList.add('wg__toolbar-trigger--active')
	}
}

/**
 * Close the floating toolbar and reset the ToolbarService's transient state
 * (hover / move flags, hovered-cell cache, cell-items snapshot, hide-timeout).
 * Removes the document-level shortcut listener and dismisses any tooltip.
 */
export function closeToolbarAndReset<T>(ctx: GridContext<T>): void {
	// Remove document shortcut listener before clearing the handler reference
	const shortcutHandler = ctx.toolbar.shortcutHandler
	if (shortcutHandler) {
		document.removeEventListener('keydown', shortcutHandler)
		ctx.toolbar.setShortcutHandler(null)
	}
	ctx.toolbar.reset()
	// Hide any toolbar tooltip (mouseleave won't fire when DOM is removed)
	hideTooltip(ctx, 0)
	closeToolbar()
}

/**
 * Merge a row's base toolbar items with cell-specific items (cell items
 * override base items by `id`, otherwise append) and swap the toolbar's
 * innerHTML in place — preserving position styles so the toolbar doesn't
 * flash to (0,0) during the update.
 */
export function updateToolbarWithCellItems<T>(
	ctx: GridContext<T>,
	rowIndex: number,
	cellItems: RowToolbarConfig<T>[]
): void {
	const row = ctx.grid.displayItems[rowIndex]
	if (!row) return

	// Merge base toolbar items with cell-specific items
	// Cell items override base items by ID, or append if new
	const baseItems = normalizeToolbarItems(ctx.grid.rowToolbar)
	const normalizedCellItems = normalizeToolbarItems(cellItems)

	// Create a map of cell items by ID for fast lookup
	const cellItemsMap = new Map(normalizedCellItems.map(item => [item.id, item]))

	// Start with cell items, then add any base items not in cell items
	const mergedItems = [...normalizedCellItems]
	for (const baseItem of baseItems) {
		if (!cellItemsMap.has(baseItem.id)) {
			mergedItems.push(baseItem)
		}
	}

	// Re-sort by row and group
	mergedItems.sort((a, b) => {
		if (a.row !== b.row) return a.row - b.row
		return a.group - b.group
	})

	const reverseRows = ctx.grid.toolbarVerticalAlign !== 'top'

	// Update the toolbar HTML in place
	const activeToolbar = getActiveToolbar()
	if (!activeToolbar) return

	const html = renderToolbarHTML(mergedItems, row, rowIndex, reverseRows)
	const temp = document.createElement('div')
	temp.innerHTML = html
	const newToolbarContent = temp.querySelector('.wg__toolbar')
	if (newToolbarContent) {
		// Keep position styles
		const { left, top, position, visibility } = activeToolbar.toolbar.style
		activeToolbar.toolbar.innerHTML = newToolbarContent.innerHTML
		activeToolbar.toolbar.style.left = left
		activeToolbar.toolbar.style.top = top
		activeToolbar.toolbar.style.position = position
		activeToolbar.toolbar.style.visibility = visibility

		// Re-setup tooltips for new items
		setupToolbarTooltips(ctx, mergedItems, row, rowIndex)
	}
}

/**
 * Fire `item.onclick` and `ontoolbarclick`, then decide what to do with the
 * toolbar: close on `delete` (row is gone), keep open + render + redraw
 * connector on `moveUp` / `moveDown` (row moved, toolbar tracks it), keep open
 * + render for other actions. Always proxied through the action pipeline first
 * to clear active selections.
 */
export function handleToolbarItemClick<T>(
	ctx: GridContext<T>,
	item: NormalizedToolbarItem<T>,
	_originalRowIndex: number,
	row: T,
	event: MouseEvent,
	triggerElement: HTMLElement
): void {
	// Clear any active selections through the pipeline
	ctx.pipelineAdapter?.clearSelection()

	// Find CURRENT index of the row item (it may have moved) - like QuickGrid
	const currentIndex = ctx.grid.displayItems.findIndex(i => i === row)
	if (currentIndex === -1) {
		// Row was deleted, close toolbar
		closeToolbarAndReset(ctx)
		// No render() needed — items setter already triggered requestUpdate()
		return
	}

	// Check if this is a move action (toolbar should stay open)
	const isMoveAction = item.id === 'moveUp' || item.id === 'moveDown'

	// Prevent mouseleave from closing toolbar during move
	if (isMoveAction) {
		ctx.toolbar.setIsMoveInProgress(true)
	}

	// Call item's onclick if defined - use CURRENT index
	if (item.onclick) {
		item.onclick({ row, rowIndex: currentIndex })
	}

	// Fire ontoolbarclick callback - use CURRENT index
	if (ctx.grid.ontoolbarclick) {
		ctx.grid.ontoolbarclick({
			item,
			rowIndex: currentIndex,
			row,
			event,
			triggerElement
		})
	}

	// For delete action, close toolbar (row is gone)
	if (item.id === 'delete') {
		closeToolbarAndReset(ctx)
		// No render() needed — delete onclick should have modified items, triggering requestUpdate()
		return
	}

	if (isMoveAction) {
		// For move actions: keep toolbar open, re-render, update connector
		ctx.render()
		// Update connector to show where the row moved to
		updateConnector(ctx, ctx.grid.displayItems)
		ctx.renderConnector()
	} else {
		// For other actions (add, duplicate): keep toolbar open
		ctx.render()
	}
}

/**
 * Inline-mode (toolbarPosition === 'inline') click handler. Fires the item's
 * onclick + `ontoolbarclick` without triggering a render — letting the
 * consumer mutate items and rely on `requestUpdate()` keeps the
 * triggerElement attached for popconfirm-style positioned UI.
 */
export function handleInlineActionClick<T>(
	ctx: GridContext<T>,
	actionId: string | undefined,
	rowIndex: number,
	event: MouseEvent,
	triggerElement: HTMLElement
): void {
	if (!actionId) return

	// Clear any active selections through the pipeline
	ctx.pipelineAdapter?.clearSelection()

	const items = normalizeToolbarItems(ctx.grid.rowToolbar)
	const item = items.find(i => i.id === actionId)
	const row = ctx.grid.displayItems[rowIndex]

	if (!item || !row) return

	// Call item's onclick if defined
	if (item.onclick) {
		item.onclick({ row, rowIndex })
	}

	// Fire ontoolbarclick callback
	if (ctx.grid.ontoolbarclick) {
		ctx.grid.ontoolbarclick({
			item,
			rowIndex,
			row,
			event,
			triggerElement
		})
	}

	// No explicit render() — if the consumer modifies items, requestUpdate() handles it.
	// Calling render() synchronously here would detach the triggerElement from the DOM,
	// breaking consumers that need to position UI relative to it (e.g., popconfirm).
}

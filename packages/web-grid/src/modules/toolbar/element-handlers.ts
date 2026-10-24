// =============================================================================
// Toolbar element-handlers
// =============================================================================
// Extracted from GridElement. Owns the floating-toolbar lifecycle (open / close
// / cell-item refresh / shortcut listener setup), the inline-toolbar shortcut
// listener, and the click handlers for both modes. State lives in
// `ctx.toolbar` (ToolbarService); rendering hooks go through `ctx.render()` /
// `ctx.renderConnector()` so the Element layer no longer holds this code.

import type { GridHost } from '../grid-context.js'
import type { CellContext, GridToolbarEntry } from '../../interaction.js'
import { showTooltip, hideTooltip } from '../tooltip/index.js'
import { activateGridItem, handleRowShortcut, rowCellFields } from '../items/index.js'
import {
	getActiveToolbar,
	getActiveToolbarRowIndex,
	isToolbarOwnedBy,
	openToolbar,
	closeToolbar,
	resolveToolbar,
	toolbarEntryKey,
	renderToolbarHTML,
	setActiveToolbarButtons,
	updateConnector,
	buildToolbarTooltipHtml,
	type ToolbarButton
} from './index.js'

/**
 * Install / refresh the document-level keydown listener that drives
 * row-shortcut actions for whichever row currently owns the floating toolbar.
 * Replaces any previously-installed handler. Cleared by
 * `closeToolbarAndReset` when the toolbar closes.
 */
export function setupToolbarShortcuts<T>(ctx: GridHost<T>): void {
	// Remove any existing listener first
	const existing = ctx.toolbar.shortcutHandler
	if (existing) {
		document.removeEventListener('keydown', existing)
	}

	const shortcuts = ctx.engine.rowShortcuts
	if (!shortcuts?.length) {
		ctx.toolbar.setShortcutHandler(null)
		return
	}

	const handler: (e: KeyboardEvent) => void = (e: KeyboardEvent) => {
		// Skip when the focused cell's own keydown already ran a shortcut, or focus is in an input/editor
		if (e.defaultPrevented) return
		const target = e.target as HTMLElement
		if (target.matches('input, textarea, select, [contenteditable="true"]')) {
			return
		}

		const toolbarRowIndex = getActiveToolbarRowIndex()
		if (toolbarRowIndex === null || !isToolbarOwnedBy(ctx.shadow)) return

		const row = ctx.engine.displayItems[toolbarRowIndex]
		if (!row) return

		handleRowShortcut(ctx, e, rowCellFields(ctx, row, toolbarRowIndex), true)
	}

	ctx.toolbar.setShortcutHandler(handler)
	document.addEventListener('keydown', handler)
}

/**
 * Inline-mode keyboard shortcuts driven by `grid.hoveredRowIndex` rather than
 * the floating toolbar's row. Replaces any previously-installed handler.
 */
export function setupInlineShortcuts<T>(ctx: GridHost<T>): void {
	removeInlineShortcuts(ctx)

	const shortcuts = ctx.engine.rowShortcuts
	if (!shortcuts?.length || ctx.engine.hoveredRowIndex === null) return

	const handler: (e: KeyboardEvent) => void = (e: KeyboardEvent) => {
		// Skip when the focused cell's own keydown already ran a shortcut, or focus is in an input/editor
		if (e.defaultPrevented) return
		const target = e.target as HTMLElement
		if (target.matches('input, textarea, select, [contenteditable="true"]')) {
			return
		}

		const rowIndex = ctx.engine.hoveredRowIndex
		if (rowIndex === null) return

		const row = ctx.engine.displayItems[rowIndex]
		if (!row) return

		handleRowShortcut(ctx, e, rowCellFields(ctx, row, rowIndex), true)
	}

	ctx.toolbar.setInlineShortcutHandler(handler)
	document.addEventListener('keydown', handler)
}

/**
 * Tear down the inline-mode shortcut listener if one is installed. Safe to
 * call when nothing is registered.
 */
export function removeInlineShortcuts<T>(ctx: GridHost<T>): void {
	const handler = ctx.toolbar.inlineShortcutHandler
	if (handler) {
		document.removeEventListener('keydown', handler)
		ctx.toolbar.setInlineShortcutHandler(null)
	}
}

/**
 * Attach `mouseenter` / `mouseleave` tooltip handlers to each toolbar button:
 * the text as heading, `tooltip` as description, the shortcut (the item's, or a
 * `rowShortcuts` entry with the same `id` / built-in `action`).
 */
export function setupToolbarTooltips<T>(ctx: GridHost<T>, buttons: ToolbarButton<T>[]): void {
	const toolbarContainer = ctx.shadow.querySelector('.wg__toolbar-container')
	if (!toolbarContainer) return

	toolbarContainer.querySelectorAll('.wg__toolbar-btn').forEach(btn => {
		const button = btn as HTMLElement
		const entry = buttons[Number(button.dataset.wgIndex)]
		if (!entry) return
		const key = entry.item.id ?? entry.item.action
		const matchingShortcut = ctx.engine.rowShortcuts?.find(s => (s.id ?? s.action) === key)

		button.addEventListener('mouseenter', () => {
			showTooltip(ctx, button, buildToolbarTooltipHtml(entry, matchingShortcut?.shortcut), 0, true)
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
	ctx: GridHost<T>,
	rowElement: HTMLElement,
	rowIndex: number,
	cursorX?: number
): void {
	// Skip floating toolbar in inline mode (buttons rendered directly in cells)
	if (ctx.engine.toolbarPosition === 'inline') {
		return
	}

	if (!ctx.engine.isRowToolbarVisible || !ctx.engine.rowToolbar.length) {
		return
	}

	const row = ctx.engine.displayItems[rowIndex]
	if (!row) {
		return
	}
	const buttons = resolveToolbar(ctx, ctx.engine.rowToolbar, ctx.engine.rowCtx(row, rowIndex))

	// Clear any pending hide timeout when opening new toolbar
	ctx.toolbar.clearHideTimeout()

	// Hide any toolbar tooltip left over from the previous toolbar
	// (mouseleave won't fire when the toolbar DOM is removed)
	hideTooltip(ctx, 0)

	// Reset cell toolbar state so next cell change will always update the HTML
	// (openToolbar rebuilds with base rowToolbar items, not cell-specific items)
	ctx.toolbar.setCurrentCellItemsJson(null)
	toolbarCells.delete(ctx)

	openToolbar(
		ctx,
		rowElement,
		rowIndex,
		buttons,
		row,
		(button: ToolbarButton<T>, event: MouseEvent, triggerElement: HTMLElement) => {
			handleToolbarItemClick(ctx, button, row, event, triggerElement)
		},
		cursorX
	)

	// Add document-level shortcut listener for toolbar row
	setupToolbarShortcuts(ctx)

	// Clean up any existing connector (state was reset in openToolbar)
	ctx.renderConnector()

	// Add rich tooltip handlers to toolbar buttons
	setupToolbarTooltips(ctx, buttons)

	// Add hover tracking to toolbar container (hover mode only)
	if (ctx.engine.toolbarTrigger === 'hover') {
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
export function closeToolbarAndReset<T>(ctx: GridHost<T>): void {
	// Remove document shortcut listener before clearing the handler reference
	const shortcutHandler = ctx.toolbar.shortcutHandler
	if (shortcutHandler) {
		document.removeEventListener('keydown', shortcutHandler)
		ctx.toolbar.setShortcutHandler(null)
	}
	ctx.toolbar.reset()
	toolbarCells.delete(ctx)
	// Hide any toolbar tooltip (mouseleave won't fire when DOM is removed)
	hideTooltip(ctx, 0)
	closeToolbar()
}

/**
 * Cell toolbar: the base `rowToolbar` with the cell's entries merged over it (a cell
 * entry replaces the base entry with the same `id` / built-in `action`, otherwise it is
 * added first), resolved against the cell's ctx and swapped into the open toolbar in
 * place — keeping its position so it doesn't flash to (0,0).
 */
export function updateToolbarWithCellItems<T>(
	ctx: GridHost<T>,
	cell: Omit<CellContext<T>, 'controller' | 'element'>,
	cellEntries: GridToolbarEntry<T>[]
): void {
	const cellKeys = new Set(cellEntries.map(toolbarEntryKey).filter((k): k is string => k !== null))
	const merged = [
		...cellEntries,
		...ctx.engine.rowToolbar.filter(e => {
			const key = toolbarEntryKey(e)
			return key === null || !cellKeys.has(key)
		})
	]
	const buttons = resolveToolbar(ctx, merged, ctx.engine.ctx(cell))
		.sort((a, b) => a.row - b.row)

	const activeToolbar = getActiveToolbar()
	if (!activeToolbar) return

	const temp = document.createElement('div')
	temp.innerHTML = renderToolbarHTML(buttons, ctx.engine.toolbarVerticalAlign !== 'top')
	const newToolbarContent = temp.querySelector('.wg__toolbar')
	if (newToolbarContent) {
		// Keep position styles
		const { left, top, position, visibility } = activeToolbar.toolbar.style
		activeToolbar.toolbar.innerHTML = newToolbarContent.innerHTML
		activeToolbar.toolbar.style.left = left
		activeToolbar.toolbar.style.top = top
		activeToolbar.toolbar.style.position = position
		activeToolbar.toolbar.style.visibility = visibility
		setActiveToolbarButtons(buttons)
		setActiveToolbarCell(ctx, cell)

		// Re-setup tooltips for new items
		setupToolbarTooltips(ctx, buttons)
	}
}

// The hovered cell of an open cell toolbar — its clicks carry the cell fields.
const toolbarCells = new WeakMap<object, Omit<CellContext<any>, 'controller' | 'element'>>()
function setActiveToolbarCell<T>(ctx: GridHost<T>, cell: Omit<CellContext<T>, 'controller' | 'element'>): void {
	toolbarCells.set(ctx, cell)
}

/**
 * Floating-toolbar click: activate the item (beforeActionCallback → onClick →
 * `action` event → built-in), then follow up — close when the row is gone
 * (`delete`), keep open + re-render + redraw the connector after a move, re-render
 * after anything else. Clears active selections first.
 */
export function handleToolbarItemClick<T>(
	ctx: GridHost<T>,
	button: ToolbarButton<T>,
	row: T,
	event: MouseEvent,
	triggerElement: HTMLElement
): void {
	// Clear any active selections through the pipeline
	ctx.pipelineAdapter?.clearSelection()

	// Find CURRENT index of the row item (it may have moved)
	const currentIndex = ctx.engine.displayItems.findIndex(i => i === row)
	if (currentIndex === -1) {
		closeToolbarAndReset(ctx)
		return
	}

	const action = button.resolved.action
	const isMoveAction = action === 'move-up' || action === 'move-down'
	// Prevent mouseleave from closing the toolbar during a move
	if (isMoveAction) ctx.toolbar.setIsMoveInProgress(true)

	const cell = toolbarCells.get(ctx)
	const fields = cell && cell.row === row
		? { ...cell, rowIndex: currentIndex }
		: { row, rowIndex: currentIndex }

	void activateGridItem(ctx, {
		item: button.item,
		fields,
		source: cell && cell.row === row ? 'cell-toolbar' : 'row-toolbar',
		sourceEvent: event,
		triggerElement,
		after: (d) => {
			if (d.action === 'delete' || ctx.engine.displayItems.indexOf(row) === -1) {
				closeToolbarAndReset(ctx)
				return
			}
			ctx.render()
			if (isMoveAction) {
				// Show where the row moved to
				updateConnector(ctx, ctx.engine.displayItems)
				ctx.renderConnector()
			}
		}
	})
}

/**
 * Inline-mode (toolbarPosition === 'inline') click: activate the item without a
 * render — if the item / built-in changes `items`, requestUpdate() re-renders, and
 * until then the triggerElement stays attached for popconfirm-style positioned UI.
 */
export function handleInlineActionClick<T>(
	ctx: GridHost<T>,
	buttonIndex: number,
	rowIndex: number,
	event: MouseEvent,
	triggerElement: HTMLElement
): void {
	// Clear any active selections through the pipeline
	ctx.pipelineAdapter?.clearSelection()

	const row = ctx.engine.displayItems[rowIndex]
	if (!row) return
	const button = resolveToolbar(ctx, ctx.engine.rowToolbar, ctx.engine.rowCtx(row, rowIndex))[buttonIndex]
	if (!button || button.resolved.isDisabled) return

	void activateGridItem(ctx, {
		item: button.item,
		fields: { row, rowIndex },
		source: 'row-toolbar',
		sourceEvent: event,
		triggerElement
	})
}

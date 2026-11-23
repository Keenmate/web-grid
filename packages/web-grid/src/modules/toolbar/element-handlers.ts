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
import { activateGridItem, rowCellFields, rowShortcutBindings } from '../items/index.js'
import { returnFocusToCell } from '../navigation/focus.js'
import { deepActiveElement, registerOverlay, type OverlayDismissReason } from '@keenmate/web-components-core'
import { bindShortcuts } from '@keenmate/web-components-core/actions'
import {
	getActiveToolbar,
	getActiveToolbarButtons,
	getActiveToolbarRowIndex,
	getActiveToolbarRowItem,
	openToolbar,
	closeToolbar,
	resolveToolbar,
	toolbarEntryKey,
	renderToolbarHTML,
	renderToolbarButton,
	setActiveToolbarButtons,
	setActiveToolbarOverlay,
	updateConnector,
	buildToolbarTooltipHtml,
	type ToolbarButton
} from './index.js'
import { GRID_ENGINE } from '../grid-context.js'

/**
 * Install / refresh the document-level shortcut listener (core `bindShortcuts`) that drives
 * row-shortcut actions for whichever row currently owns the floating toolbar.
 * Replaces any previously-installed one. Cleared by `closeToolbarAndReset` when the toolbar closes.
 */
export function setupToolbarShortcuts<T>(ctx: GridHost<T>): void {
	ctx.toolbar.shortcutHandler?.()
	ctx.toolbar.setShortcutHandler(null)

	if (!ctx[GRID_ENGINE].rowShortcuts?.length) return

	const isMove = (a: string) => a === 'move-up' || a === 'move-down'
	const bindings = rowShortcutBindings(ctx, () => {
		if (getActiveToolbarRowIndex(ctx) === null) return null
		// The toolbar's row at its CURRENT position (a move keeps the toolbar open on it)
		const row = getActiveToolbarRowItem<T>(ctx)
		const rowIndex = row === null ? -1 : ctx[GRID_ENGINE].displayItems.indexOf(row)
		if (row === null || rowIndex === -1) return null
		const cell = toolbarCells.get(ctx)
		return cell && cell.row === row ? { ...cell, rowIndex } : rowCellFields(ctx, row, rowIndex)
	}, (d, { row }) => {
		// Same follow-up as a toolbar click: close when the row is gone, else refresh
		// the open toolbar's button states (and the connector after a move)
		if (getActiveToolbarRowItem<T>(ctx) !== row) return
		if (d.action === 'delete' || ctx[GRID_ENGINE].displayItems.indexOf(row) === -1) {
			closeToolbarAndReset(ctx)
			return
		}
		ctx.render()
		refreshOpenToolbar(ctx, row, ctx[GRID_ENGINE].displayItems.indexOf(row))
		if (isMove(d.action)) {
			updateConnector(ctx, ctx[GRID_ENGINE].displayItems)
			ctx.renderConnector()
		}
	})
	ctx.toolbar.setShortcutHandler(bindShortcuts(document, bindings))
}

/**
 * Inline-mode keyboard shortcuts driven by `grid.hoveredRowIndex` rather than
 * the floating toolbar's row (core `bindShortcuts` on document). Replaces any previously-installed one.
 */
export function setupInlineShortcuts<T>(ctx: GridHost<T>): void {
	removeInlineShortcuts(ctx)

	if (!ctx[GRID_ENGINE].rowShortcuts?.length || ctx[GRID_ENGINE].hoveredRowIndex === null) return

	const bindings = rowShortcutBindings(ctx, () => {
		const rowIndex = ctx[GRID_ENGINE].hoveredRowIndex
		if (rowIndex === null) return null
		const row = ctx[GRID_ENGINE].displayItems[rowIndex]
		return row ? rowCellFields(ctx, row, rowIndex) : null
	})
	ctx.toolbar.setInlineShortcutHandler(bindShortcuts(document, bindings))
}

/**
 * Tear down the inline-mode shortcut listener if one is installed. Safe to
 * call when nothing is registered.
 */
export function removeInlineShortcuts<T>(ctx: GridHost<T>): void {
	ctx.toolbar.inlineShortcutHandler?.()
	ctx.toolbar.setInlineShortcutHandler(null)
}

/**
 * Register each toolbar button's tooltip with the grid's delegated toolbar tooltip
 * (core createTooltip — hover + keyboard focus): the text as heading, `tooltip` as
 * description, the shortcut (the item's, or a `rowShortcuts` entry with the same
 * `id` / built-in `action`).
 */
export function setupToolbarTooltips<T>(ctx: GridHost<T>, buttons: ToolbarButton<T>[], elements?: Iterable<Element>): void {
	const toolbarContainer = ctx.shadow.querySelector('.wg__toolbar-container')
	if (!toolbarContainer) return

	for (const btn of elements ?? toolbarContainer.querySelectorAll('.wg__toolbar-btn')) {
		const button = btn as HTMLElement
		const entry = buttons[Number(button.dataset.wgIndex)]
		if (!entry) continue
		const key = entry.item.id ?? entry.item.action
		const matchingShortcut = ctx[GRID_ENGINE].rowShortcuts?.find(s => (s.id ?? s.action) === key)

		ctx.tooltip.setToolbarContent(button, buildToolbarTooltipHtml(entry, matchingShortcut?.shortcut))
	}
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
	if (ctx[GRID_ENGINE].toolbarPosition === 'inline') {
		return
	}

	if (!ctx[GRID_ENGINE].isRowToolbarShown || !ctx[GRID_ENGINE].rowToolbar.length) {
		return
	}

	const row = ctx[GRID_ENGINE].displayItems[rowIndex]
	if (!row) {
		return
	}
	const buttons = resolveToolbar(ctx, ctx[GRID_ENGINE].rowToolbar, ctx[GRID_ENGINE].rowCtx(row, rowIndex))

	// Clear any pending hide timeout when opening new toolbar
	ctx.toolbar.clearHideTimeout()

	// Hide any toolbar tooltip left over from the previous toolbar
	// (mouseleave won't fire when the toolbar DOM is removed)
	hideToolbarTooltip(ctx)

	// Reset cell toolbar state so next cell change will always update the HTML
	// (openToolbar rebuilds with base rowToolbar items, not cell-specific items)
	ctx.toolbar.setCurrentCellItemsJson(null)
	toolbarCells.delete(ctx)
	toolbarEntries.delete(ctx)

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
	joinOverlayTree(ctx, rowElement, rowIndex)

	// Add document-level shortcut listener for toolbar row
	setupToolbarShortcuts(ctx)

	// Clean up any existing connector (state was reset in openToolbar)
	ctx.renderConnector()

	// Add rich tooltip handlers to toolbar buttons
	setupToolbarTooltips(ctx, buttons)

	// Add hover tracking to toolbar container (hover mode only)
	if (ctx[GRID_ENGINE].toolbarTrigger === 'hover') {
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
 * The open toolbar joins the page-wide overlay tree (core `registerOverlay`). Core decides the
 * outside click (when the click ENDS), routes Escape (deepest overlay first) and closes the
 * toolbar when another overlay of its group opens, when `dismissAllOverlays()` runs or when the
 * overlay it was opened from closes; overlays opened from a toolbar button become its children.
 *
 * - click / button trigger: a menu the user opened → the grid's `overlayGroup`, so opening it
 *   closes the group's other overlays (the grid's own cell dropdown / date editor too: leaving the
 *   cell saves) and they close it.
 * - hover trigger: a hover affordance, like a tooltip → a group of its own: moving the pointer
 *   over the rows must not close (and save) an open cell dropdown or a page popover. Only
 *   `dismissAllOverlays()` reaches it.
 *
 * Outside: a click outside the toolbar; the whole grid counts as inside for hover / click (rows
 * toggle it themselves), only the trigger buttons for 'button'. Escape: when focus is in the
 * toolbar, or (click / button) when no cell edit is open — an edit's Escape is the editor's.
 */
function joinOverlayTree<T>(ctx: GridHost<T>, rowElement: HTMLElement, rowIndex: number): void {
	const trigger = ctx[GRID_ENGINE].toolbarTrigger
	const isHover = trigger === 'hover'
	const host = (ctx.shadow as ShadowRoot).host
	const overlay = registerOverlay(
		(reason) => onToolbarDismiss(ctx, reason),
		isHover ? {} : (ctx.overlayGroup || undefined),
		{
			getElement: () => getActiveToolbar(ctx)?.container ?? null,
			shouldCloseOnOutsideClick: true,
			getInsideElements: () => trigger === 'button'
				? [...ctx.shadow.querySelectorAll('.wg__toolbar-trigger')]
				: [host],
			shouldCloseOnEscape: () => isFocusInToolbar(ctx) || (!isHover && ctx[GRID_ENGINE].editingCell === null)
		}
	)
	setActiveToolbarOverlay(ctx, overlay)
	const triggerBtn = trigger === 'button'
		? ctx.shadow.querySelector(`[data-toolbar-trigger="${rowIndex}"]`) as HTMLElement | null
		: null
	// Focus after Escape is the grid's (onToolbarDismiss): the row / trigger at its current index
	overlay.activate({ trigger: triggerBtn ?? rowElement, returnFocusTo: null })
}

/** Is keyboard focus inside the grid's open toolbar? */
function isFocusInToolbar<T>(ctx: GridHost<T>): boolean {
	const container = getActiveToolbar(ctx)?.container
	const active = deepActiveElement()
	return !!container && !!active && container.contains(active)
}

/**
 * Core closed the toolbar: Escape, an outside click, another overlay of its group, the parent
 * overlay or `dismissAllOverlays()`. It just closes — toolbar actions are not edits. Focus that
 * was in the toolbar (or lost to <body> on Escape) returns to its row: the trigger button
 * ('button'), else the row's focused cell (its first cell when another row's cell has focus).
 */
function onToolbarDismiss<T>(ctx: GridHost<T>, reason: OverlayDismissReason): void {
	if (!getActiveToolbar(ctx)) return
	const active = deepActiveElement()
	const hadFocus = isFocusInToolbar(ctx) || (reason === 'escape' && (!active || active === document.body))
	const row = getActiveToolbarRowItem<T>(ctx)
	closeToolbarAndReset(ctx)
	if (!hadFocus || row === null) return
	const rowIndex = ctx[GRID_ENGINE].displayItems.indexOf(row)
	if (rowIndex === -1) {
		(ctx.shadow.querySelector('.wg') as HTMLElement | null)?.focus({ preventScroll: true })
		return
	}
	if (ctx[GRID_ENGINE].toolbarTrigger === 'button') {
		const triggerBtn = ctx.shadow.querySelector(`[data-toolbar-trigger="${rowIndex}"]`) as HTMLElement | null
		if (triggerBtn) {
			triggerBtn.focus({ preventScroll: true })
			return
		}
	}
	const focused = ctx[GRID_ENGINE].focusedCell
	const firstCell = ctx.shadow.querySelector(`td.wg__cell[data-row="${rowIndex}"][data-col]`) as HTMLElement | null
	const colIndex = focused?.rowIndex === rowIndex ? focused.colIndex : Number(firstCell?.dataset.col ?? 0)
	returnFocusToCell(ctx, rowIndex, colIndex)
}

/**
 * Close the floating toolbar and reset the ToolbarService's transient state
 * (hover / move flags, hovered-cell cache, cell-items snapshot, hide-timeout).
 * Removes the document-level shortcut listener and dismisses any tooltip.
 */
export function closeToolbarAndReset<T>(ctx: GridHost<T>): void {
	// Unbind the document shortcut listener
	ctx.toolbar.shortcutHandler?.()
	ctx.toolbar.setShortcutHandler(null)
	ctx.toolbar.reset()
	toolbarCells.delete(ctx)
	toolbarEntries.delete(ctx)
	// Hide any toolbar tooltip (mouseleave won't fire when DOM is removed)
	hideToolbarTooltip(ctx)
	closeToolbar(ctx)
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
		...ctx[GRID_ENGINE].rowToolbar.filter(e => {
			const key = toolbarEntryKey(e)
			return key === null || !cellKeys.has(key)
		})
	]
	const buttons = resolveToolbar(ctx, merged, ctx[GRID_ENGINE].ctx(cell))
		.sort((a, b) => a.row - b.row)

	const activeToolbar = getActiveToolbar(ctx)
	if (!activeToolbar) return

	const temp = document.createElement('div')
	temp.innerHTML = renderToolbarHTML(buttons, ctx[GRID_ENGINE].toolbarVerticalAlign !== 'top', ctx.shadow.host)
	const newToolbarContent = temp.querySelector('.wg__toolbar')
	if (newToolbarContent) {
		// Keep position styles
		const { left, top, position, visibility } = activeToolbar.toolbar.style
		activeToolbar.toolbar.innerHTML = newToolbarContent.innerHTML
		activeToolbar.toolbar.style.left = left
		activeToolbar.toolbar.style.top = top
		activeToolbar.toolbar.style.position = position
		activeToolbar.toolbar.style.visibility = visibility
		setActiveToolbarButtons(ctx, buttons)
		setActiveToolbarCell(ctx, cell)
		toolbarEntries.set(ctx, merged)

		// Re-setup tooltips for new items
		setupToolbarTooltips(ctx, buttons)
	}
}

// The hovered cell of an open cell toolbar — its clicks carry the cell fields.
const toolbarCells = new WeakMap<object, Omit<CellContext<any>, 'controller' | 'element'>>()
function setActiveToolbarCell<T>(ctx: GridHost<T>, cell: Omit<CellContext<T>, 'controller' | 'element'>): void {
	toolbarCells.set(ctx, cell)
}
// The entries of an open cell toolbar (base rowToolbar merged with the cell's); absent = rowToolbar.
const toolbarEntries = new WeakMap<object, GridToolbarEntry<any>[]>()

/**
 * The page-wide icon hook changed (the element's `iconsChanged()`): redraw the icons of the
 * open floating toolbar in place — same buttons, same position, the toolbar stays open.
 */
export function repaintOpenToolbarIcons<T>(ctx: GridHost<T>): void {
	const active = getActiveToolbar(ctx)
	const buttons = getActiveToolbarButtons<T>(ctx)
	if (!active || !buttons) return
	const replaced: Element[] = []
	buttons.forEach((b, i) => {
		const el = active.toolbar.querySelector(`.wg__toolbar-btn[data-wg-index="${i}"]`)
		if (!el) return
		if (ctx.tooltip.toolbarTarget === el) hideToolbarTooltip(ctx)
		const temp = document.createElement('div')
		temp.innerHTML = renderToolbarButton(b, i, 'wg__toolbar-btn', ctx.shadow.host)
		const fresh = temp.firstElementChild!
		el.replaceWith(fresh)
		replaced.push(fresh)
	})
	if (replaced.length) setupToolbarTooltips(ctx, buttons, replaced)
}

/**
 * Re-resolve the open toolbar against the row's current position (a move changes the
 * built-ins' defaults: move-up / move-down at an edge) and patch the buttons whose
 * state changed in place — the rest (and the button under the pointer) stay put.
 * A changed layout (an item shown / hidden) re-renders the toolbar content.
 */
function refreshOpenToolbar<T>(ctx: GridHost<T>, row: T, rowIndex: number): void {
	const active = getActiveToolbar(ctx)
	const previous = getActiveToolbarButtons<T>(ctx)
	if (!active || !previous) return
	const cell = toolbarCells.get(ctx)
	const isCell = !!cell && cell.row === row
	const entries = (isCell ? toolbarEntries.get(ctx) : undefined) ?? ctx[GRID_ENGINE].rowToolbar
	let buttons = resolveToolbar(ctx, entries, isCell
		? ctx[GRID_ENGINE].ctx({ ...cell!, rowIndex })
		: ctx[GRID_ENGINE].rowCtx(row, rowIndex))
	if (isCell) {
		buttons = buttons.sort((a, b) => a.row - b.row)
		toolbarCells.set(ctx, { ...cell!, rowIndex })
	}
	const isSameLayout = buttons.length === previous.length && buttons.every((b, i) =>
		b.item === previous[i].item && b.row === previous[i].row && b.isDividerBefore === previous[i].isDividerBefore)

	if (!isSameLayout) {
		hideToolbarTooltip(ctx)
		const temp = document.createElement('div')
		temp.innerHTML = renderToolbarHTML(buttons, ctx[GRID_ENGINE].toolbarVerticalAlign !== 'top', ctx.shadow.host)
		active.toolbar.innerHTML = temp.querySelector('.wg__toolbar')?.innerHTML ?? ''
		setActiveToolbarButtons(ctx, buttons)
		setupToolbarTooltips(ctx, buttons)
		return
	}

	const replaced: Element[] = []
	buttons.forEach((b, i) => {
		const html = renderToolbarButton(b, i, 'wg__toolbar-btn', ctx.shadow.host)
		if (html === renderToolbarButton(previous[i], i, 'wg__toolbar-btn', ctx.shadow.host)) return
		const el = active.toolbar.querySelector(`.wg__toolbar-btn[data-wg-index="${i}"]`)
		if (!el) return
		if (ctx.tooltip.toolbarTarget === el) hideToolbarTooltip(ctx)
		const temp = document.createElement('div')
		temp.innerHTML = html
		const fresh = temp.firstElementChild!
		el.replaceWith(fresh)
		replaced.push(fresh)
	})
	setActiveToolbarButtons(ctx, buttons)
	if (replaced.length) setupToolbarTooltips(ctx, buttons, replaced)
}

/**
 * Floating-toolbar click: activate the item (beforeActionCallback → onClick →
 * built-in → `action` event), then follow up — close when the row is gone
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
	// Clear any active selections through the pipeline — unless the row is in the row
	// selection: then the row built-ins act on the whole selection (and keep it)
	if (!ctx[GRID_ENGINE].selectedRows.includes(row)) ctx.pipelineAdapter?.clearSelection()

	// Find CURRENT index of the row item (it may have moved)
	const currentIndex = ctx[GRID_ENGINE].displayItems.findIndex(i => i === row)
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
			if (d.action === 'delete' || ctx[GRID_ENGINE].displayItems.indexOf(row) === -1) {
				closeToolbarAndReset(ctx)
				return
			}
			ctx.render()
			const rowIndex = ctx[GRID_ENGINE].displayItems.indexOf(row)
			refreshOpenToolbar(ctx, row, rowIndex)
			if (isMoveAction) {
				// Show where the row moved to
				updateConnector(ctx, ctx[GRID_ENGINE].displayItems)
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
	// Clear any active selections through the pipeline — unless the row is in the row
	// selection: then the row built-ins act on the whole selection (and keep it)
	const row = ctx[GRID_ENGINE].displayItems[rowIndex]
	if (!ctx[GRID_ENGINE].selectedRows.includes(row)) ctx.pipelineAdapter?.clearSelection()

	if (!row) return
	const button = resolveToolbar(ctx, ctx[GRID_ENGINE].rowToolbar, ctx[GRID_ENGINE].rowCtx(row, rowIndex))[buttonIndex]
	if (!button || button.resolved.isDisabled) return

	void activateGridItem(ctx, {
		item: button.item,
		fields: { row, rowIndex },
		source: 'row-toolbar',
		sourceEvent: event,
		triggerElement
	})
}

/**
 * Hide the tooltip of a toolbar button (mouseleave won't fire when the toolbar DOM
 * is removed). Leaves a cell's tooltip alone — closing the hover toolbar as the
 * pointer leaves the grid must not cut the cell tooltip's `tooltipHideDelay` short.
 */
function hideToolbarTooltip<T>(ctx: GridHost<T>): void {
	ctx.tooltip.hideToolbar()
}

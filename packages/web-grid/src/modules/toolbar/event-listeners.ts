// =============================================================================
// Toolbar event listeners
// =============================================================================
// The DOM-event wiring that drives the floating toolbar:
//   - Trigger-button click (button mode) — toggle the toolbar for one row.
//   - Inline action click (inline mode) — fire the action without rendering
//     so the trigger element stays attached for popconfirm-style UI.
//   - Row hover / leave / move — open + close + reposition (hover mode), and
//     drive the cell-aware toolbar that swaps items as the cursor traverses
//     cells.
//   - Row click (click mode) — toggle the toolbar for one row.
//   - Document-level outside click — close the toolbar when the user clicks
//     anywhere outside its container or the table.
//
// The document-level listener is a one-shot — guarded by
// `ToolbarService.outsideClickAttached` so re-running attachEventListeners on
// every render doesn't pile up duplicates.

import type { GridContext } from '../grid-context.js'
import {
	getActiveToolbarRowIndex,
	isToolbarOpenForRow,
	isToolbarOwnedBy,
	resolveToolbarOffset,
	updateToolbarPosition
} from './index.js'
import {
	closeToolbarAndReset,
	handleInlineActionClick,
	removeInlineShortcuts,
	setupInlineShortcuts,
	showToolbarForRow,
	updateToolbarWithCellItems
} from './element-handlers.js'

/**
 * Attach every floating-toolbar event listener (button-mode trigger, inline
 * action click, row hover/leave/move, click-mode row click, outside click) to
 * the table. Idempotent w.r.t. the document-level outside-click listener
 * thanks to the `outsideClickAttached` one-shot guard on the ToolbarService.
 */
export function attachToolbarListeners<T>(ctx: GridContext<T>, table: Element): void {
	// Toolbar trigger button click (button mode)
	table.addEventListener('click', (e: Event) => {
		const target = e.target as HTMLElement
		const triggerBtn = target.closest('.wg__toolbar-trigger') as HTMLElement
		if (triggerBtn && ctx.grid.toolbarTrigger === 'button') {
			e.preventDefault()
			e.stopPropagation()
			const rowIndex = parseInt(triggerBtn.dataset.toolbarTrigger || '0', 10)
			const rowElement = table.querySelector(`tr[data-row-index="${rowIndex}"]`) as HTMLElement
			if (rowElement) {
				// Toggle toolbar for this row
				if (isToolbarOpenForRow(rowIndex)) {
					closeToolbarAndReset(ctx)
					// No render() needed — closeToolbar() surgically removes toolbar
				} else {
					showToolbarForRow(ctx, rowElement, rowIndex)
				}
			}
		}
	})

	// Inline action button click (inline mode - toolbarPosition="inline")
	table.addEventListener('click', (e: Event) => {
		if (ctx.grid.toolbarPosition !== 'inline') return

		const target = e.target as HTMLElement
		const btn = target.closest('.wg__inline-action-btn') as HTMLButtonElement
		if (btn && !btn.disabled) {
			e.preventDefault()
			e.stopPropagation()
			const actionId = btn.dataset.actionId
			const rowIndex = parseInt(btn.dataset.row || '0', 10)
			handleInlineActionClick(ctx, actionId, rowIndex, e as MouseEvent, btn)
		}
	})

	// Row hover - track hovered row and handle toolbar/inline shortcuts
	table.addEventListener('mouseenter', (e: Event) => {
		const mouseEvent = e as MouseEvent
		const target = mouseEvent.target as HTMLElement
		const row = target.closest('.wg__row') as HTMLElement
		if (row) {
			const rowIndex = parseInt(row.dataset.rowIndex || '0', 10)
			ctx.grid.setHoveredRow(rowIndex)

			// For inline mode, setup shortcuts
			if (ctx.grid.toolbarPosition === 'inline') {
				setupInlineShortcuts(ctx)
			}

			// For floating toolbar (hover trigger)
			if (ctx.grid.toolbarTrigger === 'hover' && ctx.grid.toolbarPosition !== 'inline') {
				// Cancel any pending hide timeout when entering a row
				ctx.toolbar.clearHideTimeout()
				if (!isToolbarOpenForRow(rowIndex)) {
					showToolbarForRow(ctx, row, rowIndex, mouseEvent.clientX)
				}
			}
		}
	}, true)

	// Row mouseleave - handle toolbar hide and inline shortcuts cleanup
	table.addEventListener('mouseleave', (e: Event) => {
		const mouseEvent = e as MouseEvent
		const target = mouseEvent.target as HTMLElement
		const row = target.closest('.wg__row') as HTMLElement

		if (row) {
			// For inline mode, clear hovered row and shortcuts after short delay
			if (ctx.grid.toolbarPosition === 'inline') {
				setTimeout(() => {
					if (!table.matches(':hover')) {
						ctx.grid.setHoveredRow(null)
						removeInlineShortcuts(ctx)
					}
				}, 50)
			}

			// For floating toolbar (hover trigger)
			if (ctx.grid.toolbarTrigger === 'hover' && ctx.grid.toolbarPosition !== 'inline') {
				// Don't close during move actions (connector tracking)
				if (ctx.toolbar.isMoveInProgress) return

				// Start hide timeout (shared with toolbar mouseleave)
				ctx.toolbar.clearHideTimeout()
				ctx.toolbar.setHideTimeout(setTimeout(() => {
					const toolbarContainer = ctx.shadow.querySelector('.wg__toolbar-container')
					const isHoveringToolbar = toolbarContainer?.matches(':hover')
					const isHoveringTable = table.matches(':hover')

					if (!isHoveringToolbar && !isHoveringTable) {
						ctx.grid.setHoveredRow(null)
						closeToolbarAndReset(ctx)
						// No render() needed — closeToolbar() already removes toolbar from DOM
					}
				}, 150))
			}
		}
	}, true)

	// Row mousemove - handle mouse-following toolbar and cell-aware toolbar
	table.addEventListener('mousemove', (e: Event) => {
		const mouseEvent = e as MouseEvent
		const target = mouseEvent.target as HTMLElement
		const row = target.closest('.wg__row') as HTMLElement

		if (!row) return

		const rowIndex = parseInt(row.dataset.rowIndex || '0', 10)
		const toolbarRowIndex = getActiveToolbarRowIndex()

		// Only process if toolbar is open for this row and in 'top' position
		if (toolbarRowIndex !== rowIndex || ctx.grid.toolbarPosition !== 'top') return

		// Handle mouse-following toolbar (skip if cellToolbar is active — it handles its own positioning,
		// and skip if toolbarColumn is set — column pinning takes priority over cursor following)
		if (ctx.grid.shouldToolbarFollowCursor && !ctx.grid.cellToolbar && ctx.grid.toolbarColumn === undefined) {
			const cell = target.closest('.wg__cell:not(.wg__row-number):not(.wg__inline-actions-cell)') as HTMLElement
			if (cell) {
				const cellRect = cell.getBoundingClientRect()
				const targetX = resolveToolbarOffset(cellRect, ctx.grid.cellToolbarOffset)
				updateToolbarPosition(targetX, row, 'start')
			} else {
				updateToolbarPosition(mouseEvent.clientX, row)
			}
		}

		// Handle cell-aware toolbar
		if (ctx.grid.cellToolbar) {
			const cell = target.closest('.wg__cell:not(.wg__row-number):not(.wg__inline-actions-cell)') as HTMLElement
			if (cell) {
				const field = cell.dataset.field || ''
				// Find colIndex from visualColumns since cells don't have data-col-index
				const colIndex = ctx.grid.visualColumns.findIndex(vc => String(vc.column.field) === field)

				// Check if cell changed (compare by field since that's what we have)
				const currentHovered = ctx.toolbar.hoveredCell
				const cellChanged = !currentHovered ||
					currentHovered.rowIndex !== rowIndex ||
					currentHovered.field !== field

				if (cellChanged) {
					ctx.toolbar.setHoveredCell({ rowIndex, colIndex, field })

					// Get cell-specific toolbar items
					const dataRow = ctx.grid.displayItems[rowIndex]
					if (dataRow) {
						const cellItems = ctx.grid.cellToolbar(dataRow, rowIndex, field, colIndex)
						// Use cell items if provided, otherwise use default rowToolbar
						const itemsToUse = cellItems || ctx.grid.rowToolbar
						const newItemsJson = JSON.stringify(itemsToUse)

						// Check if items changed
						if (newItemsJson !== ctx.toolbar.currentCellItemsJson) {
							ctx.toolbar.setCurrentCellItemsJson(newItemsJson)
							// Re-render toolbar with new items
							updateToolbarWithCellItems(ctx, rowIndex, itemsToUse)
						}

						// Position toolbar at configured offset from cell left edge
						const cellRect = cell.getBoundingClientRect()
						const targetX = resolveToolbarOffset(cellRect, ctx.grid.cellToolbarOffset)
						updateToolbarPosition(targetX, row, 'start')
					}
				}
			}
		}
	})

	// Row click (click mode)
	table.addEventListener('click', (e: Event) => {
		if (ctx.grid.toolbarTrigger !== 'click') return

		const mouseEvent = e as MouseEvent
		const target = mouseEvent.target as HTMLElement
		const row = target.closest('.wg__row') as HTMLElement
		if (row && !target.closest('.wg__cell--editing')) {
			const rowIndex = parseInt(row.dataset.rowIndex || '0', 10)
			// Toggle toolbar
			if (isToolbarOpenForRow(rowIndex)) {
				closeToolbarAndReset(ctx)
				// No render() needed — closeToolbar() surgically removes toolbar
			} else {
				showToolbarForRow(ctx, row, rowIndex, mouseEvent.clientX)
			}
		}
	})

	// Close toolbar on outside click — one-shot per grid (guarded by ToolbarService)
	if (!ctx.toolbar.outsideClickAttached) {
		ctx.toolbar.markOutsideClickAttached()
		document.addEventListener('click', (e: MouseEvent) => {
			// Only handle if this grid owns the active toolbar
			if (!isToolbarOwnedBy(ctx.shadow)) {
				return
			}

			const composedPath = e.composedPath()
			const isInToolbar = composedPath.some(el => (el as HTMLElement).classList?.contains('wg__toolbar-container'))
			const isInTrigger = composedPath.some(el => (el as HTMLElement).classList?.contains('wg__toolbar-trigger'))

			if (isInToolbar || isInTrigger) {
				return
			}
			// Don't close if clicking inside grid (hover/click mode handles that)
			// The `host` lookup goes through ShadowRoot.host because composedPath()
			// includes the shadow boundary, and the grid element itself is the host.
			const host = (ctx.shadow as ShadowRoot).host
			const isInGrid = composedPath.includes(host)
			if (isInGrid && (ctx.grid.toolbarTrigger === 'hover' || ctx.grid.toolbarTrigger === 'click')) {
				return
			}
			// Close toolbar if clicking outside
			if (getActiveToolbarRowIndex() !== null) {
				closeToolbarAndReset(ctx)
				// No render() needed — closeToolbar() surgically removes toolbar
			}
		})
	}
}

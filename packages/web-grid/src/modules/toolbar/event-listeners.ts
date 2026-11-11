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
//
// Outside click / Escape / other overlays close it through the core overlay
// tree (element-handlers.ts `joinOverlayTree`), not here.

import type { GridHost } from '../grid-context.js'
import {
	getActiveToolbarRowIndex,
	isToolbarOpenForRow,
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
 * action click, row hover/leave/move, click-mode row click) to the table.
 */
export function attachToolbarListeners<T>(ctx: GridHost<T>, table: Element): void {
	// Toolbar trigger button click (button mode)
	table.addEventListener('click', (e: Event) => {
		const target = e.target as HTMLElement
		const triggerBtn = target.closest('.wg__toolbar-trigger') as HTMLElement
		if (triggerBtn && ctx.engine.toolbarTrigger === 'button') {
			e.preventDefault()
			e.stopPropagation()
			const rowIndex = parseInt(triggerBtn.dataset.toolbarTrigger || '0', 10)
			const rowElement = table.querySelector(`tr[data-row-index="${rowIndex}"]`) as HTMLElement
			if (rowElement) {
				// Toggle toolbar for this row
				if (isToolbarOpenForRow(ctx, rowIndex)) {
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
		if (ctx.engine.toolbarPosition !== 'inline') return

		const target = e.target as HTMLElement
		const btn = target.closest('.wg__inline-action-btn') as HTMLButtonElement
		if (btn && !btn.disabled) {
			e.preventDefault()
			e.stopPropagation()
			const buttonIndex = Number(btn.dataset.wgIndex)
			const rowIndex = parseInt(btn.dataset.row || '0', 10)
			handleInlineActionClick(ctx, buttonIndex, rowIndex, e as MouseEvent, btn)
		}
	})

	// Row hover - track hovered row and handle toolbar/inline shortcuts
	table.addEventListener('mouseenter', (e: Event) => {
		const mouseEvent = e as MouseEvent
		const target = mouseEvent.target as HTMLElement
		const row = target.closest('.wg__row') as HTMLElement
		if (row) {
			const rowIndex = parseInt(row.dataset.rowIndex || '0', 10)
			ctx.engine.setHoveredRow(rowIndex)

			// For inline mode, setup shortcuts
			if (ctx.engine.toolbarPosition === 'inline') {
				setupInlineShortcuts(ctx)
			}

			// For floating toolbar (hover trigger)
			if (ctx.engine.toolbarTrigger === 'hover' && ctx.engine.toolbarPosition !== 'inline') {
				// Cancel any pending hide timeout when entering a row
				ctx.toolbar.clearHideTimeout()
				if (!isToolbarOpenForRow(ctx, rowIndex)) {
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
			if (ctx.engine.toolbarPosition === 'inline') {
				setTimeout(() => {
					if (!table.matches(':hover')) {
						ctx.engine.setHoveredRow(null)
						removeInlineShortcuts(ctx)
					}
				}, 50)
			}

			// For floating toolbar (hover trigger)
			if (ctx.engine.toolbarTrigger === 'hover' && ctx.engine.toolbarPosition !== 'inline') {
				// Don't close during move actions (connector tracking)
				if (ctx.toolbar.isMoveInProgress) return

				// Start hide timeout (shared with toolbar mouseleave)
				ctx.toolbar.clearHideTimeout()
				ctx.toolbar.setHideTimeout(setTimeout(() => {
					const toolbarContainer = ctx.shadow.querySelector('.wg__toolbar-container')
					const isHoveringToolbar = toolbarContainer?.matches(':hover')
					const isHoveringTable = table.matches(':hover')

					if (!isHoveringToolbar && !isHoveringTable) {
						ctx.engine.setHoveredRow(null)
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
		const toolbarRowIndex = getActiveToolbarRowIndex(ctx)

		// Only process if toolbar is open for this row and in 'top' position
		if (toolbarRowIndex !== rowIndex || ctx.engine.toolbarPosition !== 'top') return

		// Handle mouse-following toolbar (skip if a cell toolbar is active — it handles its own positioning,
		// and skip if toolbarColumn is set — column pinning takes priority over cursor following)
		if (ctx.engine.shouldToolbarFollowCursor && !ctx.engine.getCellToolbarItemsCallback && ctx.engine.toolbarColumn === undefined) {
			const cell = target.closest('.wg__cell:not(.wg__row-number):not(.wg__inline-actions-cell)') as HTMLElement
			if (cell) {
				const cellRect = cell.getBoundingClientRect()
				const targetX = resolveToolbarOffset(cellRect, ctx.engine.cellToolbarOffset)
				updateToolbarPosition(ctx, targetX, row, 'start')
			} else {
				updateToolbarPosition(ctx, mouseEvent.clientX, row)
			}
		}

		// Handle cell-aware toolbar
		const getCellItems = ctx.engine.getCellToolbarItemsCallback
		if (getCellItems) {
			const cell = target.closest('.wg__cell:not(.wg__row-number):not(.wg__inline-actions-cell)') as HTMLElement
			if (cell) {
				const field = cell.dataset.field || ''
				// Find colIndex from visualColumns since cells don't have data-col-index
				const colIndex = ctx.engine.visualColumns.findIndex(vc => String(vc.column.field) === field)

				// Check if cell changed (compare by field since that's what we have)
				const currentHovered = ctx.toolbar.hoveredCell
				const cellChanged = !currentHovered ||
					currentHovered.rowIndex !== rowIndex ||
					currentHovered.field !== field

				if (cellChanged) {
					ctx.toolbar.setHoveredCell({ rowIndex, colIndex, field })

					// Get cell-specific toolbar items (merged over rowToolbar); re-resolved on every
					// cell change, since item callbacks may depend on the cell
					const dataRow = ctx.engine.displayItems[rowIndex]
					const dataColIndex = ctx.engine.columns.findIndex(c => String(c.field) === field)
					const column = ctx.engine.columns[dataColIndex]
					if (dataRow && column) {
						const cellFields = {
							row: dataRow,
							rowIndex,
							column,
							colIndex: dataColIndex,
							field,
							value: ctx.engine.getCellRawValue(dataRow, rowIndex, field)
						}
						updateToolbarWithCellItems(ctx, cellFields, getCellItems(ctx.engine.ctx(cellFields)) ?? [])

						// Position toolbar at configured offset from cell left edge
						const cellRect = cell.getBoundingClientRect()
						const targetX = resolveToolbarOffset(cellRect, ctx.engine.cellToolbarOffset)
						updateToolbarPosition(ctx, targetX, row, 'start')
					}
				}
			}
		}
	})

	// Row click (click mode)
	table.addEventListener('click', (e: Event) => {
		if (ctx.engine.toolbarTrigger !== 'click') return

		const mouseEvent = e as MouseEvent
		const target = mouseEvent.target as HTMLElement
		const row = target.closest('.wg__row') as HTMLElement
		if (row && !target.closest('.wg__cell--editing')) {
			const rowIndex = parseInt(row.dataset.rowIndex || '0', 10)
			// Toggle toolbar
			if (isToolbarOpenForRow(ctx, rowIndex)) {
				closeToolbarAndReset(ctx)
				// No render() needed — closeToolbar() surgically removes toolbar
			} else {
				showToolbarForRow(ctx, row, rowIndex, mouseEvent.clientX)
			}
		}
	})
}

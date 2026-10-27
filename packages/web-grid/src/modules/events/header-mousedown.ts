// =============================================================================
// Header / row-number / data-cell mousedown router
// =============================================================================
// The second mousedown listener — distinct from `handleTableMouseDown` because
// it runs AFTER it and handles the "non-cell-content" interactions:
//
//  1. Resize handle drag — highest priority, claims the event before reorder
//     can also see it.
//  2. Column reorder drag — when isColumnReorderAllowed is on and no modifier
//     keys are held. Modifier-held clicks fall through to column-selection.
//  3. Column selection drag — when reorder is off, OR when Shift is held even
//     with reorder enabled. Left-click only (right-click is contextmenu).
//  4. Row selection — left-click on a row-number cell.
//  5. Select all — left-click on the row-number header (the `#` cell).
//  6. Row focus — clicking any data cell sets the focused row + surgically
//     paints `wg__row--focused`. Skipped during cell-selection drag so the
//     drag doesn't fire spurious focus-change events.
//  7. Clear row / column selection — clicking a data cell while a row or
//     column selection is active drops it (full render).
//  8. Clear all selections — clicking empty padding (outside any interactive
//     element) drops every selection.

import type { GridHost } from '../grid-context.js'
import { handleResizeStart } from '../resize/index.js'
import { handleReorderStart } from '../reorder/index.js'
import { handleHeaderMouseDown } from '../column-selection/index.js'
import { handleRowNumberMouseDown } from '../selection/index.js'
import {
	createRangeBorder,
	removeRangeBorder,
	isCellSelectionPending,
	isCellSelecting
} from '../cell-selection/index.js'

/**
 * Handle the second-pass mousedown — resize / reorder / column-select /
 * row-select / clear-on-empty-click. The order of the checks is significant
 * (resize > reorder > column-select).
 */
export function handleHeaderRowMouseDown<T>(ctx: GridHost<T>, e: Event): void {
	const target = e.target as HTMLElement

	// Resize handle takes priority
	const resizeHandle = target.closest('.wg__resize-handle') as HTMLElement
	if (resizeHandle) {
		e.preventDefault()
		e.stopPropagation()
		// Clear selections when starting resize
		ctx.clearAllSelections()
		const field = resizeHandle.dataset.field
		if (field) {
			handleResizeStart(ctx, e as MouseEvent, field)
		}
		return
	}

	// Column reorder: start drag when clicking on a non-frozen header (if enabled)
	// Skip reorder if Ctrl/Shift held - let click handler do column selection instead
	if (ctx.engine.isColumnReorderAllowed) {
		const mouseEvent = e as MouseEvent
		if (!mouseEvent.ctrlKey && !mouseEvent.metaKey && !mouseEvent.shiftKey) {
			const header = target.closest('.wg__header') as HTMLElement
			if (header && !header.classList.contains('wg__header--frozen') && !header.classList.contains('wg__row-number-header')) {
				// Clear selections when starting reorder
				ctx.clearAllSelections()
				const field = header.dataset.field
				if (field) {
					handleReorderStart(ctx, e as MouseEvent, field)
				}
			}
		}
	}

	// Column selection drag: when reorder is disabled, OR when Shift is held (even with reorder enabled)
	// Only on left-click (button 0), not right-click (button 2) which opens context menu
	if ((!ctx.engine.isColumnReorderAllowed || (e as MouseEvent).shiftKey) && (e as MouseEvent).button === 0) {
		const header = target.closest('.wg__header:not(.wg__row-number-header):not(.wg__inline-actions-header):not(.wg__actions-column):not(.wg__filler)') as HTMLElement
		if (header && !target.closest('.wg__resize-handle') && !target.closest('.wg__sort-indicator')) {
			const field = header.dataset.field
			if (field) {
				const colIndex = ctx.engine.visualColumns.findIndex(vc => String(vc.column.field) === field)
				if (colIndex >= 0) {
					handleHeaderMouseDown(ctx, colIndex, e as MouseEvent)
				}
			}
		}
	}

	// Row selection: handle mousedown on row number cells
	// Only on left-click (button 0), not right-click (button 2)
	const rowNumberCell = target.closest('.wg__row-number[data-row-number]') as HTMLElement
	if (rowNumberCell && (e as MouseEvent).button === 0) {
		const rowIndex = parseInt(rowNumberCell.dataset.rowNumber || '-1', 10)
		if (rowIndex >= 0) {
			handleRowNumberMouseDown(ctx, rowIndex, e as MouseEvent)
		}
	}

	// Select all: handle click on row number header (#)
	// Only on left-click (button 0), not right-click (button 2)
	const rowNumberHeader = target.closest('.wg__row-number-header') as HTMLElement
	if (rowNumberHeader && (e as MouseEvent).button === 0) {
		e.preventDefault()
		ctx.engine.selectAll()
		// Update the range border visual
		if (ctx.engine.selectedCellRange) {
			createRangeBorder(ctx)
		}
		ctx.render()
		// Focus container so Ctrl+C works
		requestAnimationFrame(() => {
			const container = ctx.shadow.querySelector('.wg') as HTMLElement
			container?.focus({ preventScroll: true })
		})
	}

	// Set row focus when clicking on data cells (not row numbers or headers)
	// Skip during cell range selection to avoid spurious focus-change events
	const clickedCell = target.closest('.wg__cell:not(.wg__row-number):not(.wg__inline-actions-cell)') as HTMLElement
	if (clickedCell && !target.closest('.wg__header') && !isCellSelectionPending() && !isCellSelecting()) {
		const cellRowIndex = parseInt(clickedCell.dataset.row || '-1', 10)
		if (cellRowIndex >= 0) {
			const prevFocusedRow = ctx.engine.focusedRowIndex
			ctx.engine.setFocusedRow(cellRowIndex)
			ctx.updateRowFocusVisual(prevFocusedRow, cellRowIndex)
		}
	}

	// Clear row/column selection when clicking on cells (not row numbers or headers)
	// But NOT if cell selection is pending (would interfere with shift+drag)
	if (target.closest('.wg__cell') && !target.closest('.wg__row-number, .wg__header') && !isCellSelectionPending()) {
		let needsRender = false
		if (ctx.engine.selectedRowIndices.length > 0) {
			ctx.engine.clearRowSelection()
			needsRender = true
		}
		if (ctx.engine.selectedColumns.length > 0) {
			ctx.engine.clearColumnSelection()
			needsRender = true
		}
		if (needsRender) {
			ctx.render()
		}
	}

	// Clear all selections if clicking outside interactive elements (empty areas)
	if (!target.closest('.wg__cell, .wg__row-number, .wg__header, .wg__toolbar, button, input, select, textarea')) {
		let needsRender = false
		if (ctx.engine.selectedCellRange) {
			ctx.engine.clearCellSelection()
			removeRangeBorder()
			needsRender = true
		}
		if (ctx.engine.selectedRowIndices.length > 0) {
			ctx.engine.clearRowSelection()
			needsRender = true
		}
		if (ctx.engine.selectedColumns.length > 0) {
			ctx.engine.clearColumnSelection()
			needsRender = true
		}
		if (needsRender) {
			ctx.render()
		}
	}
}

// =============================================================================
// Table-level focus handler
// =============================================================================
// Capture-phase focus listener attached to the <table>. Two branches:
//
//  1. Focus landed on a `.wg__cell` — drive handleCellFocus (the navigation
//     module's focus-into-cell entry point), refresh the fill-handle, and
//     (only for KEYBOARD-triggered focus) set + paint focused row. Mouse-
//     triggered focus skips the row-focus call so row-focus fires from the
//     click handler on mouseup, not on mousedown.
//  2. Focus landed on an editor input in 'always' editTrigger mode — surgically
//     swap `wg__cell--always-edit-focused` between old and new cells without
//     re-rendering, and update row focus on the same keyboard-only rule.
//
// Skipped during cell-selection drag (isCellSelectionPending / isCellSelecting)
// to avoid spurious row-focus while the user is dragging out a range.

import type { GridHost } from '../grid-context.js'
import { handleCellFocus, ensureCellNotBehindFrozen } from '../navigation/index.js'
import { updateFillHandle } from '../fill-handle/index.js'
import { isCellSelectionPending, isCellSelecting } from '../cell-selection/index.js'

/**
 * Capture-phase focus handler. Capture phase is required so the handler
 * fires for .wg__cell and editor input alike (focus doesn't bubble).
 */
export function handleTableFocus<T>(ctx: GridHost<T>, e: Event): void {
	const target = e.target as HTMLElement
	if (target.matches('.wg__cell')) {
		const rowIndex = parseInt(target.dataset.row || '0', 10)
		const colIndex = parseInt(target.dataset.col || '0', 10)
		handleCellFocus(ctx, rowIndex, colIndex)
		updateFillHandle(ctx)
		// Only fire row-focus for keyboard-triggered focus (Tab, arrows).
		// For mouse interactions, defer to click handler so row-focus fires on mouseup, not mousedown.
		if (!ctx.isMouseDown && !isCellSelectionPending() && !isCellSelecting()) {
			const prevFocusedRow = ctx.engine.focusedRowIndex
			ctx.engine.setFocusedRow(rowIndex)
			ctx.updateRowFocusVisual(prevFocusedRow, rowIndex)
		}

		// Auto-scroll if cell is behind frozen columns
		ensureCellNotBehindFrozen(ctx, target, rowIndex)
	}
	// Handle focus on editor inputs in always-editing mode
	// When Tab/Enter moves focus to an editor input, we need to update the grid's focus state
	if (target.matches('.wg__editor, .wg__combobox-input, .wg__autocomplete-input, .wg__date-input, .wg__select-trigger')) {
		const cell = target.closest('.wg__cell') as HTMLElement
		if (cell) {
			const rowIndex = parseInt(cell.dataset.row || '0', 10)
			const colIndex = parseInt(cell.dataset.col || '0', 10)
			const column = ctx.engine.columns[colIndex]
			// Check if this cell uses 'always' editTrigger
			const effectiveTrigger = column?.editTrigger ?? ctx.engine.editTrigger
			if (effectiveTrigger === 'always') {
				// Update focused cell state and visual
				const oldFocus = ctx.engine.focusedCell
				if (!oldFocus || oldFocus.rowIndex !== rowIndex || oldFocus.colIndex !== colIndex) {
					ctx.engine.setFocusedCell(rowIndex, colIndex)
					// Remove focus class from old cell (don't re-render - just update class)
					if (oldFocus) {
						const oldCell = ctx.shadow.querySelector(
							`td[data-row="${oldFocus.rowIndex}"][data-col="${oldFocus.colIndex}"]`
						) as HTMLElement
						if (oldCell) {
							oldCell.classList.remove('wg__cell--always-edit-focused')
						}
					}
					// Add focus class to new cell (don't re-render - just update class)
					cell.classList.add('wg__cell--always-edit-focused')
					// Update row focus (only for keyboard — mouse defers to click handler)
					if (!ctx.isMouseDown) {
						const prevFocusedRow = ctx.engine.focusedRowIndex
						ctx.engine.setFocusedRow(rowIndex)
						ctx.updateRowFocusVisual(prevFocusedRow, rowIndex)
					}
				}
			}
		}
	}
	// Dropdown opening on focus - handled by pipeline (adapter dispatches openDropdown after startEdit)
	// Legacy code removed: openDropdownForCurrentEditor was called here for .wg__select-trigger, .wg__combobox-input, .wg__autocomplete-input
}

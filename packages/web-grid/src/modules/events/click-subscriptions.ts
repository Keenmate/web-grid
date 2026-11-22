// =============================================================================
// Click event manager subscriptions (outsideClick + sortClick)
// =============================================================================
// Bodies for the two clickEvents subscriptions:
//
//  - outsideClick: fires when the user clicks anywhere outside the grid
//    (and outside body-hosted owned popovers — datepicker / context menus).
//    Tears down focused cell visuals, row focus, dropdown, in-progress edit
//    (saved, Excel-like — see commitOrCancelEditOnTransition),
//    and any active row / column / cell-range selection. Calls render only
//    when a state change actually requires a full DOM refresh.
//  - sortClick: fires when the user clicks a sort indicator. Drops every
//    selection (rows / columns / cell-range) so the new sorted order isn't
//    contaminated with stale row indices, then delegates to handleSortClick
//    and forces a render. Suppressed during an active column reorder drag
//    (drop-as-sort-trigger would be confusing).

import type { GridHost } from '../grid-context.js'
import type { ClickContext } from '../click-events/index.js'
import { removeDropdown } from '../dropdown/index.js'
import { clearEditingVisual } from '../navigation/index.js'
import { renderCell } from '../rendering/index.js'
import { removeRangeBorder } from '../cell-selection/index.js'
import { removeRowSelectionBorders, removeColumnSelectionBorders } from '../selection-border/index.js'
import { isReordering } from '../reorder/index.js'
import { handleSortClick } from './sort.js'
import { GRID_ENGINE } from '../grid-context.js'

/**
 * outsideClick subscription body — tear-down on click outside the grid.
 */
export function handleOutsideClick<T>(ctx: GridHost<T>): void {
	let needsRender = false

	// Clear focused cell state FIRST (before renderCell rebuilds it with focused class)
	if (ctx[GRID_ENGINE].focusedCell) {
		const { rowIndex, colIndex } = ctx[GRID_ENGINE].focusedCell
		const cell = ctx.shadow.querySelector(
			`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
		)
		cell?.classList.remove('wg__cell--focused', 'wg__cell--always-edit-focused')
		ctx[GRID_ENGINE].clearFocusedCell()
	}

	// Clear row focus
	if (ctx[GRID_ENGINE].focusedRowIndex !== null) {
		ctx[GRID_ENGINE].clearRowFocus()
		needsRender = true
	}

	// Close the dropdown and leave the edit — Excel: leaving a cell saves (the editor's value;
	// a select without a pick changes nothing), unless shouldCommitOnClickAway is off
	if (ctx.dropdown.isOpen || ctx[GRID_ENGINE].editingCell) {
		const oldEditingCell = ctx[GRID_ENGINE].editingCell
		const oldColIndex = oldEditingCell
			? ctx[GRID_ENGINE].columns.findIndex(c => String(c.field) === oldEditingCell.field)
			: -1

		removeDropdown(ctx)
		clearEditingVisual(ctx)
		ctx.commitOrCancelEditOnTransition()

		// Re-render old cell to restore display mode (now without focused class)
		if (oldEditingCell && oldColIndex >= 0) {
			renderCell(ctx, oldEditingCell.rowIndex, oldColIndex)
		}
	}

	if (ctx[GRID_ENGINE].selectedCellRange) {
		ctx[GRID_ENGINE].clearCellSelection()
		removeRangeBorder()
		needsRender = true
	}
	if (ctx[GRID_ENGINE].selectedRowIndices.length > 0) {
		ctx[GRID_ENGINE].clearRowSelection()
		needsRender = true
	}
	if (ctx[GRID_ENGINE].selectedColumns.length > 0) {
		ctx[GRID_ENGINE].clearColumnSelection()
		needsRender = true
	}
	if (needsRender) {
		ctx.render()
	}
}

/**
 * sortClick subscription body — clear selections then delegate.
 * Suppressed when a column reorder drag is in progress (drop-as-sort would
 * fire unexpectedly).
 */
export function handleSortClickSubscription<T>(
	ctx: GridHost<T>,
	subCtx: ClickContext
): void {
	// Skip if reordering was just performed (prevents sort on drop)
	if (isReordering()) return
	// Clear all selections when sorting
	if (ctx[GRID_ENGINE].selectedCellRange) {
		ctx[GRID_ENGINE].clearCellSelection()
		removeRangeBorder()
	}
	if (ctx[GRID_ENGINE].selectedRowIndices.length > 0) {
		ctx[GRID_ENGINE].clearRowSelection()
		removeRowSelectionBorders()
	}
	if (ctx[GRID_ENGINE].selectedColumns.length > 0) {
		ctx[GRID_ENGINE].clearColumnSelection()
		removeColumnSelectionBorders()
	}
	// Pass field directly - subCtx.event.target is retargeted when crossing shadow DOM.
	// `field` is always set for sortClick (the click-events router only fires this
	// event when a .wg__sort-indicator with a data-field attribute is hit).
	handleSortClick(ctx, subCtx.event, subCtx.field || '')
	ctx.render()
}

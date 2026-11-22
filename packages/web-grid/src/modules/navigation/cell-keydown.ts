// =============================================================================
// Cell-level keyboard handling (residual keys, every editTrigger mode)
// =============================================================================
// ONE key path: the action pipeline adapter (`modules/actions/adapter.ts`,
// `tryHandleKeyDown`) owns every built-in key on a cell — arrows, Tab,
// Home / End / PageUp / PageDown (+ Ctrl), F2, Space, Enter on dropdown / date
// columns, Delete, Ctrl+C and printable type-to-edit — and consumes them before
// this handler runs. What is left here are the keys the adapter does not claim:
//
//  - Ctrl/Cmd+G — the "go to row" dialog;
//  - Enter on a text-like column — start editing the empty (new) row, or move
//    down (Excel-like: back to the column where a Tab run started);
//  - Escape — clear row selection, then the focused cell;
//  - Ctrl/Cmd+Delete — the `delete` built-in (removes the row; `row-delete` after the fact).
//
// `tryCellShortcuts` (user range / row shortcuts) runs before the adapter so a
// configured chord wins over the built-in keys.

import type { GridHost } from '../grid-context.js'
import { handleRowShortcut, handleRangeShortcut, activateGridItem } from '../items/index.js'
import { moveFocus, updateFocusVisual, clearEditingVisual, tryStartEdit } from './focus.js'
import { GRID_ENGINE } from '../grid-context.js'

/**
 * User shortcuts on a focused (non-editing) cell: range shortcuts when rows are
 * selected, then row shortcuts. Runs before the action pipeline and the built-in
 * keys (table-keydown), so a configured chord wins over Delete / arrows / F2.
 * Returns true when one ran (the key is consumed).
 */
export function tryCellShortcuts<T>(ctx: GridHost<T>, e: KeyboardEvent, rowIndex: number, colIndex: number): boolean {
	const selectedRowIndices = ctx[GRID_ENGINE].selectedRowIndices
	if (selectedRowIndices.length > 0 && handleRangeShortcut(ctx, e, {
		rows: ctx[GRID_ENGINE].selectedRows,
		rowIndices: selectedRowIndices
	})) {
		return true
	}
	const column = ctx[GRID_ENGINE].columns[colIndex]
	const row = ctx[GRID_ENGINE].displayItems[rowIndex]
	if (!column || !row) return false
	const field = String(column.field)
	return handleRowShortcut(ctx, e, { row, rowIndex, column, colIndex, field, value: ctx[GRID_ENGINE].getCellRawValue(row, rowIndex, field) })
}

/**
 * Handle the residual keydowns on a focused (non-editing) cell — see the file
 * header for the keys the action pipeline leaves to this handler.
 *
 * Navigation is the same in every editTrigger mode (the trigger only decides how an editor opens).
 */
export function handleCellKeyDown<T>(
	ctx: GridHost<T>,
	e: KeyboardEvent,
	rowIndex: number,
	colIndex: number
): void {
	const columns = ctx[GRID_ENGINE].columns
	const displayItems = ctx[GRID_ENGINE].displayItems

	switch (e.key) {
		case 'g':
		case 'G':
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault()
				ctx.openGoToRowDialog(colIndex)
			}
			break

		case 'Enter': {
			e.preventDefault()
			const column = columns[colIndex]
			if (ctx[GRID_ENGINE].isEmptyRowIndex(rowIndex) && column && ctx[GRID_ENGINE].isCellEditable(column)) {
				// On empty row, Enter starts editing the cell (like F2)
				tryStartEdit(ctx, rowIndex, colIndex)
			} else if (rowIndex < displayItems.length - 1) {
				const targetCol = ctx[GRID_ENGINE].tabTraversalStartColIndex ?? colIndex
				ctx[GRID_ENGINE].tabTraversalStartColIndex = null
				moveFocus(ctx, rowIndex + 1, targetCol)
			}
			break
		}

		case 'Escape':
			e.preventDefault()
			if (ctx[GRID_ENGINE].editingCell) {
				clearEditingVisual(ctx)
				ctx[GRID_ENGINE].cancelEdit()
			} else if (ctx[GRID_ENGINE].selectedRowIndices.length > 0) {
				// Clear row selection first
				ctx[GRID_ENGINE].clearRowSelection()
			} else {
				const oldFocus = ctx[GRID_ENGINE].focusedCell
				ctx[GRID_ENGINE].clearFocusedCell()
				updateFocusVisual(ctx, oldFocus, null)
				;(e.target as HTMLElement)?.blur()
			}
			break

		case 'Delete':
			// Ctrl/Cmd+Delete: the `delete` built-in (beforeActionCallback can veto; `row-delete`
			// reports the removal, then `action`). A plain Delete (clear the cell) is the pipeline's `deleteCell`.
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault()
				const row = displayItems[rowIndex]
				if (row && !ctx[GRID_ENGINE].isReadonly && !ctx[GRID_ENGINE].isDisabled) {
					void activateGridItem(ctx, { item: { action: 'delete' }, fields: { row, rowIndex }, source: 'keyboard', sourceEvent: e })
				}
			}
			break
	}
}

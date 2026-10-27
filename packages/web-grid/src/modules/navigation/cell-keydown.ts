// =============================================================================
// Cell-level keyboard handling (navigate mode, residual keys)
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

/**
 * User shortcuts on a focused (non-editing) cell: range shortcuts when rows are
 * selected, then row shortcuts. Runs before the action pipeline and the built-in
 * keys (table-keydown), so a configured chord wins over Delete / arrows / F2.
 * Returns true when one ran (the key is consumed).
 */
export function tryCellShortcuts<T>(ctx: GridHost<T>, e: KeyboardEvent, rowIndex: number, colIndex: number): boolean {
	const selectedRowIndices = ctx.engine.selectedRowIndices
	if (selectedRowIndices.length > 0 && handleRangeShortcut(ctx, e, {
		rows: ctx.engine.selectedRows,
		rowIndices: selectedRowIndices
	})) {
		return true
	}
	const column = ctx.engine.columns[colIndex]
	const row = ctx.engine.displayItems[rowIndex]
	if (!column || !row) return false
	const field = String(column.field)
	return handleRowShortcut(ctx, e, { row, rowIndex, column, colIndex, field, value: ctx.engine.getCellRawValue(row, rowIndex, field) })
}

/**
 * Handle the residual keydowns on a focused (non-editing) cell — see the file
 * header for the keys the action pipeline leaves to this handler.
 *
 * Returns early if the grid isn't in navigate mode.
 */
export function handleCellKeyDown<T>(
	ctx: GridHost<T>,
	e: KeyboardEvent,
	rowIndex: number,
	colIndex: number
): void {
	if (!ctx.engine.isNavigateMode) {
		return
	}

	const columns = ctx.engine.columns
	const displayItems = ctx.engine.displayItems

	switch (e.key) {
		case 'g':
		case 'G':
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault()
				ctx.showGoToRowDialog(colIndex)
			}
			break

		case 'Enter': {
			e.preventDefault()
			const column = columns[colIndex]
			if (ctx.engine.isEmptyRowIndex(rowIndex) && column && ctx.engine.isCellEditable(column)) {
				// On empty row, Enter starts editing the cell (like F2)
				tryStartEdit(ctx, rowIndex, colIndex)
			} else if (rowIndex < displayItems.length - 1) {
				const targetCol = ctx.engine.tabTraversalStartColIndex ?? colIndex
				ctx.engine.tabTraversalStartColIndex = null
				moveFocus(ctx, rowIndex + 1, targetCol)
			}
			break
		}

		case 'Escape':
			e.preventDefault()
			if (ctx.engine.editingCell) {
				clearEditingVisual(ctx)
				ctx.engine.cancelEdit()
			} else if (ctx.engine.selectedRowIndices.length > 0) {
				// Clear row selection first
				ctx.engine.clearRowSelection()
			} else {
				const oldFocus = ctx.engine.focusedCell
				ctx.engine.clearFocusedCell()
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
				if (row && !ctx.engine.isReadonly && !ctx.engine.isDisabled) {
					void activateGridItem(ctx, { item: { action: 'delete' }, fields: { row, rowIndex }, source: 'keyboard', sourceEvent: e })
				}
			}
			break
	}
}

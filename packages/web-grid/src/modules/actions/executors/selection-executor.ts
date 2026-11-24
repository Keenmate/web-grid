// =============================================================================
// Selection Executor
// Handles row selection, column selection, clear selection
// Note: Cell range drag selection is handled separately in cell-selection module
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction, SelectRowAction, SelectColumnAction } from '../types.js'
import { removeRangeBorder } from '../../cell-selection/index.js'
import { removeRowSelectionBorders, removeColumnSelectionBorders } from '../../selection-border/index.js'
import { removeFillHandle } from '../../fill-handle/index.js'
import { interactionLogger } from '../../../logger.js'
import { reconcileSelectedAria } from '../../rendering/aria.js'
import { GRID_ENGINE } from '../../grid-context.js'

/**
 * Selection executor - handles selection actions
 */
export const selectionExecutor: ActionExecutor = {
	handles: ['selectRow', 'selectColumn', 'clearSelection'],

	execute(ctx: ExecutorContext, action: GridAction): GridAction[] | void {
		switch (action.type) {
			case 'selectRow':
				executeSelectRow(ctx, action)
				break
			case 'selectColumn':
				executeSelectColumn(ctx, action)
				break
			case 'clearSelection':
				executeClearSelection(ctx)
				break
		}
	}
}

/**
 * Select a row
 */
function executeSelectRow(ctx: ExecutorContext, action: SelectRowAction): void {
	const { rowIndex, addToSelection, extendSelection } = action

	// Clear other selection types
	if (ctx[GRID_ENGINE].selectedColumns.length > 0) {
		ctx[GRID_ENGINE].clearColumnSelection()
	}
	if (ctx[GRID_ENGINE].selectedCellRange) {
		ctx[GRID_ENGINE].clearCellSelection()
		removeRangeBorder()
		removeFillHandle()
		updateCellRangeVisual(ctx)
	}

	if (extendSelection && ctx[GRID_ENGINE].selectedRowIndices.length > 0) {
		// Extend selection from last selected row to this row
		ctx[GRID_ENGINE].selectRow(rowIndex, 'range')
	} else if (addToSelection) {
		// Toggle this row in selection
		ctx[GRID_ENGINE].selectRow(rowIndex, 'toggle')
	} else {
		// Single row selection (replace existing)
		ctx[GRID_ENGINE].selectRow(rowIndex, 'replace')
	}

	// Update visual
	updateRowSelectionVisual(ctx)
}

/**
 * Select a column
 */
function executeSelectColumn(ctx: ExecutorContext, action: SelectColumnAction): void {
	const { colIndex, addToSelection, extendSelection } = action

	// Clear other selection types
	if (ctx[GRID_ENGINE].selectedRowIndices.length > 0) {
		ctx[GRID_ENGINE].clearRowSelection()
	}
	if (ctx[GRID_ENGINE].selectedCellRange) {
		ctx[GRID_ENGINE].clearCellSelection()
		removeRangeBorder()
		removeFillHandle()
		updateCellRangeVisual(ctx)
	}

	if (extendSelection && ctx[GRID_ENGINE].selectedColumns.length > 0) {
		// Extend selection from last selected column to this column
		ctx[GRID_ENGINE].selectColumn(colIndex, 'range')
	} else if (addToSelection) {
		// Toggle this column in selection
		ctx[GRID_ENGINE].selectColumn(colIndex, 'toggle')
	} else {
		// Single column selection (replace existing)
		ctx[GRID_ENGINE].selectColumn(colIndex, 'replace')
	}

	// Update visual
	updateColumnSelectionVisual(ctx)
}

/**
 * Clear all selections
 */
function executeClearSelection(ctx: ExecutorContext): void {
	interactionLogger.debug('[clearSelection] rows:', ctx[GRID_ENGINE].selectedRowIndices.length,
		'cols:', ctx[GRID_ENGINE].selectedColumns.length,
		'cellRange:', !!ctx[GRID_ENGINE].selectedCellRange)
	// Use _noRender variants to prevent requestUpdate() from triggering a full re-render
	// which would replace DOM elements and lose focus (we handle visuals surgically below)

	// Clear row selection
	if (ctx[GRID_ENGINE].selectedRowIndices.length > 0) {
		interactionLogger.debug('[clearSelection] clearing rows')
		ctx[GRID_ENGINE].clearRowSelection_noRender()
		removeRowSelectionBorders()
		updateRowSelectionVisual(ctx)
	}

	// Clear column selection
	if (ctx[GRID_ENGINE].selectedColumns.length > 0) {
		interactionLogger.debug('[clearSelection] clearing columns, removing visual classes')
		ctx[GRID_ENGINE].clearColumnSelection_noRender()
		removeColumnSelectionBorders()
		updateColumnSelectionVisual(ctx)
		interactionLogger.debug('[clearSelection] after clear, selectedColumns:', ctx[GRID_ENGINE].selectedColumns.length)
		// Verify DOM was updated
		const remaining = ctx.shadow.querySelectorAll('.wg__header--selected')
		interactionLogger.debug('[clearSelection] remaining header--selected elements:', remaining.length)
	}

	// Clear cell range selection
	if (ctx[GRID_ENGINE].selectedCellRange) {
		ctx[GRID_ENGINE].clearCellSelection_noRender()
		removeRangeBorder()
		// Remove fill handle that was hidden by CSS while range border existed
		// (without this, the old fill handle becomes visible at its stale position)
		removeFillHandle()
		updateCellRangeVisual(ctx)
	}
}

/**
 * Update row selection visual classes
 */
function updateRowSelectionVisual(ctx: ExecutorContext): void {
	// Remove all row-selected classes
	const selectedRowIndices = ctx.shadow.querySelectorAll('.wg__row--selected')
	selectedRowIndices.forEach(row => row.classList.remove('wg__row--selected'))

	// Add class to selected rows
	for (const rowIndex of ctx[GRID_ENGINE].selectedRowIndices) {
		const row = ctx.shadow.querySelector(`tr[data-row-index="${rowIndex}"]`)
		if (row) {
			row.classList.add('wg__row--selected')
		}
	}
	reconcileSelectedAria(ctx)
}

/**
 * Update column selection visual classes
 */
function updateColumnSelectionVisual(ctx: ExecutorContext): void {
	// Remove all column-selected classes
	const selectedCells = ctx.shadow.querySelectorAll('.wg__cell--column-selected')
	selectedCells.forEach(cell => cell.classList.remove('wg__cell--column-selected'))

	const selectedHeaders = ctx.shadow.querySelectorAll('.wg__header--selected')
	selectedHeaders.forEach(header => header.classList.remove('wg__header--selected'))

	// Add class to selected column cells and headers (selection = visual positions;
	// cells are addressed by column index / data-col, headers by field)
	const visualCols = ctx[GRID_ENGINE].visualColumns
	for (const pos of ctx[GRID_ENGINE].selectedColumnPositions) {
		const entry = visualCols[pos]
		if (!entry) continue
		const cells = ctx.shadow.querySelectorAll(`.wg__cell[data-col="${entry.originalIndex}"]`)
		cells.forEach(cell => cell.classList.add('wg__cell--column-selected'))

		const header = ctx.shadow.querySelector(`.wg__header[data-field="${CSS.escape(String(entry.column.field))}"]`)
		if (header) {
			header.classList.add('wg__header--selected')
		}
	}
	reconcileSelectedAria(ctx)
}

/**
 * Update cell range selection visual classes
 */
function updateCellRangeVisual(ctx: ExecutorContext): void {
	// Remove all in-range classes
	const inRangeCells = ctx.shadow.querySelectorAll('.wg__cell--in-range')
	inRangeCells.forEach(cell => cell.classList.remove('wg__cell--in-range'))

	// Add class to cells in range
	const range = ctx[GRID_ENGINE].selectedCellRange
	if (!range) {
		reconcileSelectedAria(ctx)
		return
	}

	const { startRowIndex, endRowIndex, startColIndex, endColIndex } = range
	const minRow = Math.min(startRowIndex, endRowIndex)
	const maxRow = Math.max(startRowIndex, endRowIndex)
	const minCol = Math.min(startColIndex, endColIndex)
	const maxCol = Math.max(startColIndex, endColIndex)

	// The range spans visual positions; cells are addressed by column index (data-col)
	const visualCols = ctx[GRID_ENGINE].visualColumns
	for (let row = minRow; row <= maxRow; row++) {
		for (let pos = minCol; pos <= maxCol; pos++) {
			const col = visualCols[pos]?.originalIndex
			if (col === undefined) continue
			const cell = ctx.shadow.querySelector(`.wg__cell[data-row="${row}"][data-col="${col}"]`)
			if (cell) {
				cell.classList.add('wg__cell--in-range')
			}
		}
	}
	reconcileSelectedAria(ctx)
}

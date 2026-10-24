// =============================================================================
// Container-level keydown handler
// =============================================================================
// Keydown attached to the `.wg` container (not the table) — fires when a
// selection is active and the user has focused the container (e.g. via the
// post-mousedown focus helpers in row / column / cell-selection). Three
// concerns:
//
//  1. Escape clears the active selection (priority: cell-range > column > row).
//  2. Ctrl+C copies whichever selection is active to the clipboard.
//  3. User-defined `rangeShortcuts` fire with a RangeShortcutContext that
//     either contains row data (row selection) or cell-range data (cell
//     selection). Disabled shortcuts are skipped.
//
// Early-out: returns immediately when no selection is active OR when focus
// is inside an input/textarea/contenteditable (so e.g. an editable cell's
// editor still gets its own keys).

import type { GridHost } from '../grid-context.js'
import { handleRangeShortcut } from '../items/index.js'
import { removeRangeBorder } from '../cell-selection/index.js'

/**
 * Handle keydown on the .wg container — Escape, Ctrl+C, and user-defined
 * range shortcuts. Routes the shortcut context to either the row-selection
 * shape or the cell-range shape based on which selection is active.
 */
export function handleContainerKeyDown<T>(ctx: GridHost<T>, e: KeyboardEvent): void {
	const selectedRowIndices = ctx.engine.selectedRows
	const selectedColIndices = ctx.engine.selectedColumns
	const hasCellRange = !!ctx.engine.selectedCellRange
	if (selectedRowIndices.length === 0 && selectedColIndices.length === 0 && !hasCellRange) return

	// Skip if focus is in an input
	const target = e.target as HTMLElement
	if (target.matches('input, textarea, select, [contenteditable="true"]')) {
		return
	}

	// Handle Escape to clear selection (cell range > column > row priority)
	if (e.key === 'Escape') {
		e.preventDefault()
		if (ctx.engine.selectedCellRange) {
			ctx.engine.clearCellSelection()
			removeRangeBorder()
		} else if (selectedColIndices.length > 0) {
			ctx.engine.clearColumnSelection()
		} else {
			ctx.engine.clearSelection()
		}
		return
	}

	// Handle Ctrl+C to copy selection (built-in, works without rangeShortcuts)
	if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
		e.preventDefault()
		if (hasCellRange) {
			ctx.engine.copyCellSelectionToClipboard()
		} else if (selectedColIndices.length > 0) {
			ctx.engine.copySelectedColumnsToClipboard()
		} else if (selectedRowIndices.length > 0) {
			ctx.engine.copySelectedRowsToClipboard()
		}
		return
	}

	// Range shortcuts (row or cell selection). Skipped when the focused cell's
	// keydown already ran one (it bubbles here).
	if (e.defaultPrevented) return
	handleRangeShortcut(ctx, e, hasCellRange ? {
		// Cell range mode
		rows: [],
		rowIndices: [],
		cellRange: ctx.engine.selectedCellRange!,
		cells: ctx.engine.getSelectedCells()
	} : {
		// Row selection mode
		rows: ctx.engine.getSelectedRowsData(),
		rowIndices: selectedRowIndices
	})
}

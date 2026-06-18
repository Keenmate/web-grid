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

import type { GridContext } from '../grid-context.js'
import type { RangeShortcutContext } from '../../types.js'
import { parseKeyCombo, matchesKeyCombo } from '../keyboard/index.js'
import { removeRangeBorder } from '../cell-selection/index.js'

/**
 * Handle keydown on the .wg container — Escape, Ctrl+C, and user-defined
 * range shortcuts. Routes the shortcut context to either the row-selection
 * shape or the cell-range shape based on which selection is active.
 */
export function handleContainerKeyDown<T>(ctx: GridContext<T>, e: KeyboardEvent): void {
	const selectedRowIndices = ctx.grid.selectedRows
	const selectedColIndices = ctx.grid.selectedColumns
	const hasCellRange = !!ctx.grid.selectedCellRange
	if (selectedRowIndices.length === 0 && selectedColIndices.length === 0 && !hasCellRange) return

	// Skip if focus is in an input
	const target = e.target as HTMLElement
	if (target.matches('input, textarea, select, [contenteditable="true"]')) {
		return
	}

	// Handle Escape to clear selection (cell range > column > row priority)
	if (e.key === 'Escape') {
		e.preventDefault()
		if (ctx.grid.selectedCellRange) {
			ctx.grid.clearCellSelection()
			removeRangeBorder()
		} else if (selectedColIndices.length > 0) {
			ctx.grid.clearColumnSelection()
		} else {
			ctx.grid.clearSelection()
		}
		return
	}

	// Handle Ctrl+C to copy selection (built-in, works without rangeShortcuts)
	if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
		e.preventDefault()
		if (hasCellRange) {
			ctx.grid.copyCellSelectionToClipboard()
		} else if (selectedColIndices.length > 0) {
			ctx.grid.copySelectedColumnsToClipboard()
		} else if (selectedRowIndices.length > 0) {
			ctx.grid.copySelectedRowsToClipboard()
		}
		return
	}

	// Check range shortcuts (works for both row and cell selection)
	const rangeShortcuts = ctx.grid.rangeShortcuts
	if (!rangeShortcuts?.length) return

	for (const shortcut of rangeShortcuts) {
		const combo = parseKeyCombo(shortcut.key)
		if (matchesKeyCombo(e, combo)) {
			// Build context based on selection type
			const shortcutCtx: RangeShortcutContext<T> = hasCellRange ? {
				// Cell range mode
				rows: [],
				rowIndices: [],
				cellRange: ctx.grid.selectedCellRange!,
				cells: ctx.grid.getSelectedCells()
			} : {
				// Row selection mode
				rows: ctx.grid.getSelectedRowsData(),
				rowIndices: selectedRowIndices
			}

			const isDisabled = typeof shortcut.disabled === 'function'
				? shortcut.disabled(shortcutCtx)
				: shortcut.disabled === true

			if (!isDisabled) {
				e.preventDefault()
				shortcut.action(shortcutCtx)
				return
			}
		}
	}
}

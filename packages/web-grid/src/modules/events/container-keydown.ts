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
import { removeRangeBorder, isRangeExtensionKey, extendCellRangeByKey } from '../cell-selection/index.js'
import { prepareRowReveal, fieldAt } from '../scroll/reveal.js'

/** Keys a focused cell answers that bring a focused row outside the virtual window back first. */
const CELL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Tab', 'Enter', 'F2'])

/**
 * Virtual scroll: the keyboard sits on the container while the focused cell's row is outside
 * the rendered window (a Shift+Arrow range scrolled its anchor away, a wheel scroll). Excel-like,
 * the focused cell still owns the keyboard: Shift+Arrow keeps moving the range corner from it;
 * any other cell key renders + scrolls its row back, refocuses the cell and replays the key on
 * it. Returns true when the key was handled.
 */
function handleOffWindowCellKey<T>(ctx: GridHost<T>, e: KeyboardEvent): boolean {
	const focused = ctx.engine.focusedCell
	if (!focused || ctx.engine.editingCell || !ctx.engine.shouldUseVirtualScroll()) return false
	const target = e.target as HTMLElement
	if (!target.classList.contains('wg')) return false
	if (ctx.shadow.querySelector(`td[data-row="${focused.rowIndex}"][data-col="${focused.colIndex}"]`)) return false

	if (isRangeExtensionKey(e) && ctx.engine.cellSelectionMode !== 'none') {
		e.preventDefault()
		extendCellRangeByKey(ctx, e)
		return true
	}
	if (!CELL_KEYS.has(e.key)) return false
	// Rendering the row's window refocuses the focused cell (renderVirtualRows)
	prepareRowReveal(ctx, { rowIndex: focused.rowIndex, field: fieldAt(ctx, focused.colIndex) }, 'keyboard')
	const cell = ctx.shadow.querySelector(`td[data-row="${focused.rowIndex}"][data-col="${focused.colIndex}"]`) as HTMLElement | null
	if (!cell) return false
	e.preventDefault()
	const active = ctx.shadow.activeElement as HTMLElement | null
	const replayTarget = active && cell.contains(active) ? active : cell
	replayTarget.dispatchEvent(new KeyboardEvent('keydown', {
		key: e.key, code: e.code, location: e.location, repeat: e.repeat,
		ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
		bubbles: true, composed: true, cancelable: true
	}))
	return true
}

/**
 * Handle keydown on the .wg container — Escape, Ctrl+C, and user-defined
 * range shortcuts. Routes the shortcut context to either the row-selection
 * shape or the cell-range shape based on which selection is active.
 */
export function handleContainerKeyDown<T>(ctx: GridHost<T>, e: KeyboardEvent): void {
	if (handleOffWindowCellKey(ctx, e)) return

	const selectedRowIndices = ctx.engine.selectedRowIndices
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
			ctx.engine.clearRowSelection()
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
		rows: ctx.engine.selectedRows,
		rowIndices: selectedRowIndices
	})
}

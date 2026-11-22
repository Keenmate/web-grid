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
import { GRID_ENGINE } from '../grid-context.js'

/** Keys a focused cell answers that bring a focused row outside the virtual window back first. */
const CELL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', 'F2'])

/**
 * Virtual scroll: the keyboard sits on the container while the focused cell's row is outside
 * the rendered window (a Shift+Arrow range scrolled its anchor away, a wheel scroll). Excel-like,
 * the focused cell still owns the keyboard: Shift+Arrow keeps moving the range corner from it;
 * any other cell key renders + scrolls its row back, refocuses the cell and replays the key on
 * it. Returns true when the key was handled.
 */
function handleOffWindowCellKey<T>(ctx: GridHost<T>, e: KeyboardEvent): boolean {
	const focused = ctx[GRID_ENGINE].focusedCell
	if (!focused || ctx[GRID_ENGINE].editingCell || !ctx[GRID_ENGINE].shouldUseVirtualScroll()) return false
	const target = e.target as HTMLElement
	if (!target.classList.contains('wg')) return false
	if (ctx.shadow.querySelector(`td[data-row="${focused.rowIndex}"][data-col="${focused.colIndex}"]`)) return false

	if (isRangeExtensionKey(e) && ctx[GRID_ENGINE].cellSelectionMode !== 'none') {
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

/** Natively tabbable elements (the ones `tabindex="-1"` takes out of the tab order). */
const TABBABLE = 'a[href], button, input, select, textarea, iframe, [contenteditable="true"], [tabindex]'

/**
 * Forward Tab while the keyboard sits on the `.wg` container itself (a virtual grid whose
 * active row scrolled out of the window, a selection's post-mousedown focus): the grid is ONE
 * tab stop, so Tab leaves it — it must not land on the first tab stop INSIDE the container
 * (the filter row, the first rendered cell). Every tabbable inside the container leaves the
 * tab order for this one key press; the browser's own Tab then moves past the grid, and the
 * tabindexes come back on the next task (after the focus moved). Shift+Tab needs nothing: the
 * previous focusable is before the container already.
 */
function leaveGridOnContainerTab(e: KeyboardEvent): void {
	if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return
	const container = e.target as HTMLElement
	if (!container.classList.contains('wg')) return
	const hidden: Array<[HTMLElement, string | null]> = []
	for (const el of container.querySelectorAll<HTMLElement>(TABBABLE)) {
		if (el.tabIndex < 0) continue
		hidden.push([el, el.getAttribute('tabindex')])
		el.setAttribute('tabindex', '-1')
	}
	if (hidden.length === 0) return
	setTimeout(() => {
		for (const [el, value] of hidden) {
			// A tabindex rewritten meanwhile (the roving stop moved) is the newer truth
			if (el.getAttribute('tabindex') !== '-1') continue
			if (value === null) el.removeAttribute('tabindex')
			else el.setAttribute('tabindex', value)
		}
	}, 0)
}

/**
 * Handle keydown on the .wg container — Tab (leaves the grid), Escape, Ctrl+C, and
 * user-defined range shortcuts. Routes the shortcut context to either the row-selection
 * shape or the cell-range shape based on which selection is active.
 */
export function handleContainerKeyDown<T>(ctx: GridHost<T>, e: KeyboardEvent): void {
	leaveGridOnContainerTab(e)
	if (handleOffWindowCellKey(ctx, e)) return

	const selectedRowIndices = ctx[GRID_ENGINE].selectedRowIndices
	const selectedColIndices = ctx[GRID_ENGINE].selectedColumns
	const hasCellRange = !!ctx[GRID_ENGINE].selectedCellRange
	if (selectedRowIndices.length === 0 && selectedColIndices.length === 0 && !hasCellRange) return

	// Skip if focus is in an input
	const target = e.target as HTMLElement
	if (target.matches('input, textarea, select, [contenteditable="true"]')) {
		return
	}

	// Handle Escape to clear selection (cell range > column > row priority)
	if (e.key === 'Escape') {
		e.preventDefault()
		if (ctx[GRID_ENGINE].selectedCellRange) {
			ctx[GRID_ENGINE].clearCellSelection()
			removeRangeBorder()
		} else if (selectedColIndices.length > 0) {
			ctx[GRID_ENGINE].clearColumnSelection()
		} else {
			ctx[GRID_ENGINE].clearRowSelection()
		}
		return
	}

	// Handle Ctrl+C to copy selection (built-in, works without rangeShortcuts)
	if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
		e.preventDefault()
		if (hasCellRange) {
			ctx[GRID_ENGINE].copyCellSelectionToClipboard()
		} else if (selectedColIndices.length > 0) {
			ctx[GRID_ENGINE].copySelectedColumnsToClipboard()
		} else if (selectedRowIndices.length > 0) {
			ctx[GRID_ENGINE].copySelectedRowsToClipboard()
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
		cellRange: ctx[GRID_ENGINE].selectedCellRange!,
		cells: ctx[GRID_ENGINE].getSelectedCells()
	} : {
		// Row selection mode
		rows: ctx[GRID_ENGINE].selectedRows,
		rowIndices: selectedRowIndices
	})
}

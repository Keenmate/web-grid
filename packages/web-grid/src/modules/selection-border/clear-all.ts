// =============================================================================
// Surgical "clear all selections" helper
// =============================================================================
// Drops cell-range / row / column selection state AND removes the
// corresponding visual classes + borders, WITHOUT triggering a render.
//
// Why no render: the callers (resize start, reorder start, date-trigger
// switch in table-mousedown) capture a DOM node reference *after* this call.
// A full requestUpdate / render would replace the entire `.wg` container,
// invalidating those captured references and causing the subsequent
// resize / reorder handler to operate on a detached node.

import type { GridContext } from '../grid-context.js'
import { removeRangeBorder } from '../cell-selection/index.js'
import { removeRowSelectionBorders, removeColumnSelectionBorders } from './index.js'

/**
 * Drop every active selection (state + classes + borders) without rendering.
 * Each branch is a no-op when the corresponding selection isn't active.
 */
export function clearAllSelections<T>(ctx: GridContext<T>): void {
	// Clear state and visuals surgically WITHOUT triggering requestUpdate/render.
	// A full re-render would replace all DOM elements, making any references
	// captured after this call (e.g., resize headerCell) point to detached nodes.
	if (ctx.grid.selectedCellRange) {
		ctx.grid.clearCellSelection_noRender()
		removeRangeBorder()
		// Remove in-range highlighting
		const inRange = ctx.shadow.querySelectorAll('.wg__cell--in-range')
		inRange.forEach(c => c.classList.remove('wg__cell--in-range'))
	}
	if (ctx.grid.selectedRows.length > 0) {
		ctx.grid.clearSelection_noRender()
		removeRowSelectionBorders()
		// Remove row selection highlighting
		const selectedRows = ctx.shadow.querySelectorAll('.wg__row--selected')
		selectedRows.forEach(r => r.classList.remove('wg__row--selected'))
	}
	if (ctx.grid.selectedColumns.length > 0) {
		ctx.grid.clearColumnSelection_noRender()
		removeColumnSelectionBorders()
		// Remove column selection highlighting
		const selectedCells = ctx.shadow.querySelectorAll('.wg__cell--column-selected')
		selectedCells.forEach(c => c.classList.remove('wg__cell--column-selected'))
		const selectedHeaders = ctx.shadow.querySelectorAll('.wg__header--selected')
		selectedHeaders.forEach(h => h.classList.remove('wg__header--selected'))
	}
}

// =============================================================================
// Table mousedown router
// =============================================================================
// The fat mousedown listener attached to the <table> element. Routes a
// single MouseEvent through a layered set of intents:
//
//  1. Tree chevron — suppress focus/selection so the click handler can run
//     unmolested.
//  2. Tree column second click (mousedown.detail === 2) — preferred over the
//     native dblclick event because cell innerHTML gets re-rendered between
//     clicks, which makes dblclick unreliable. Either toggles the node (when
//     treeDoubleClickBehavior === 'toggle') or starts editing (dblclick /
//     navigate trigger + isCellEditable).
//  3. Action pipeline (`always` editTrigger) — short-circuit when the
//     pipeline claims the event.
//  4. Cell range selection — start a drag range when cellSelectionMode allows,
//     after committing any in-progress edit and clearing row / column selection.
//  5. Date trigger — open the datepicker either on an already-editing cell or
//     by transitioning out of a prior edit + starting a new one.
//  6. Editing-cell switch — clicking another cell while a dropdown / editor is
//     open commits the old edit, focuses the new cell, and either starts a new
//     click-trigger edit or just moves focus.
//  7. Display-mode dropdown click — open the dropdown for a select / combobox
//     / autocomplete column when its display container is clicked.

import type { GridHost } from '../grid-context.js'
import { uiLogger } from '../../logger.js'
import {
	removeDropdown,
	openDropdownForCurrentEditor
} from '../dropdown/index.js'
import {
	tryStartEdit,
	clearEditingVisual,
	moveFocus,
	getCursorPositionFromClick
} from '../navigation/index.js'
import { renderCell } from '../rendering/index.js'
import { handleCellMouseDown, removeRangeBorder } from '../cell-selection/index.js'
import { openDatePicker } from '../datepicker/index.js'
import { handleEditButtonMouseDown } from '../editing/edit-button.js'

/**
 * Handle the table-level mousedown. Returns nothing (drives DOM side effects);
 * the listener wrapper calls preventDefault / stopPropagation as needed
 * within each branch.
 */
export function handleTableMouseDown<T>(ctx: GridHost<T>, e: Event): void {
	const target = e.target as HTMLElement
	const mouseEvent = e as MouseEvent
	uiLogger.debug('MOUSEDOWN fired | target:', target.tagName, target.className, '| connected:', target.isConnected, '| detail:', mouseEvent.detail, '| button:', mouseEvent.button)

	// Edit button (editTrigger 'button') — starts editing its cell
	if (handleEditButtonMouseDown(ctx, mouseEvent)) return

	// Tree chevron — let click handler do its work; suppress focus/selection side effects
	if (target.closest('.wg__tree-chevron[data-tree-toggle]')) {
		uiLogger.debug('chevron mousedown intercepted (suppress focus/selection)')
		e.preventDefault()
		e.stopPropagation()
		return
	}

	// Tree column second-click handling — detect via MouseEvent.detail (the
	// browser's own click counter). The native dblclick event is unreliable
	// here because the cell's innerHTML gets re-rendered between clicks, so
	// we route both "double-click toggles tree" and "double-click starts edit"
	// through this single path.
	if (mouseEvent.detail === 2 && mouseEvent.button === 0 && ctx.engine.isTreeMode) {
		const cellEl = target.closest('.wg__cell') as HTMLElement
		if (cellEl && !target.closest('.wg__tree-chevron')) {
			const colIdx = parseInt(cellEl.dataset.col || '-1', 10)
			const rowIdx = parseInt(cellEl.dataset.row || '-1', 10)
			const col = colIdx >= 0 ? ctx.engine.columns[colIdx] : null
			if (col?.isTree && rowIdx >= 0) {
				// Tree toggle takes priority over edit when enabled
				if (ctx.engine.treeDoubleClickBehavior === 'toggle') {
					const item = ctx.engine.displayItems[rowIdx]
					const info = item ? ctx.engine.getRowTreeInfo(item) : null
					if (info?.hasChildren) {
						uiLogger.debug('tree dblclick (mousedown.detail=2) toggle:', info.path)
						e.preventDefault()
						e.stopPropagation()
						ctx.engine.toggleRowExpanded(info.path)
						return
					}
				}
				// Otherwise, if the column is editable with dblclick/navigate trigger, start edit
				const trigger = col.editTrigger || ctx.engine.editTrigger
				if ((trigger === 'dblclick' || trigger === 'navigate') && ctx.engine.canEditCell(rowIdx, String(col.field))) {
					const cursorPos = getCursorPositionFromClick(mouseEvent, cellEl)
					uiLogger.debug('tree dblclick (mousedown.detail=2) start edit:', String(col.field), '| trigger:', trigger)
					e.preventDefault()
					e.stopPropagation()
					tryStartEdit(ctx, rowIdx, colIdx, { cursorPosition: cursorPos ?? undefined })
					return
				}
			}
		}
	}

	// Try pipeline first for 'always' mode cells (handles cell clicks and toggle clicks)
	if (ctx.pipelineAdapter?.tryHandleMouseDown(mouseEvent)) {
		return
	}

	// Cell range selection - handle before other interactions
	// Skip if clicking on toggles (dropdown, date) - those have their own handlers
	const cell = target.closest('.wg__cell') as HTMLElement
	const isClickingToggle = target.closest('.wg__combobox-toggle, .wg__select-toggle, .wg__date-trigger')
	if (cell && !cell.classList.contains('wg__cell--editing') && !target.closest('.wg__row-number') && !isClickingToggle) {
		const rowIndex = parseInt(cell.dataset.row || '0', 10)
		const colIndex = parseInt(cell.dataset.col || '0', 10)
		const column = ctx.engine.visualColumns.find(v => v.originalIndex === colIndex)?.column  // colIndex is data-col

		if (column) {
			const selectionMode = ctx.engine.cellSelectionMode
			const isShiftClick = mouseEvent.shiftKey

			// Check if we should handle cell range selection
			const shouldSelectRange =
				selectionMode !== 'none' && (
					(selectionMode === 'click' && !isShiftClick) ||
					(selectionMode === 'shift' && isShiftClick)
				)

			if (shouldSelectRange) {
				// Commit (or cancel) any active edit before starting cell selection
				if (ctx.engine.editingCell) {
					const oldEditingCell = ctx.engine.editingCell
					const oldColIndex = ctx.engine.columns.findIndex(c => String(c.field) === oldEditingCell.field)
					removeDropdown(ctx)
					clearEditingVisual(ctx)
					ctx.commitOrCancelEditOnTransition()
					// Re-render old cell to restore display mode
					if (oldColIndex >= 0) {
						renderCell(ctx, oldEditingCell.rowIndex, oldColIndex)
					}
				}
				// Clear row/column selection when starting cell selection
				if (ctx.engine.selectedRows.length > 0) {
					ctx.engine.clearSelection()
				}
				if (ctx.engine.selectedColumns.length > 0) {
					ctx.engine.clearColumnSelection()
				}
				// Start cell selection
				// Note: if editTrigger='click' + cellSelectionMode='click', selection takes priority
				// For shift mode, Shift+Click always starts selection regardless of editTrigger
				handleCellMouseDown(ctx, rowIndex, colIndex, mouseEvent)
				return
			} else {
				// Not starting selection - clear any existing range
				if (ctx.engine.selectedCellRange) {
					ctx.engine.clearCellSelection()
					removeRangeBorder()
				}
			}
		}
	}

	// Date trigger button - handle in mousedown since SVG clicks don't bubble well
	const dateTrigger = target.closest('.wg__date-trigger')
	if (dateTrigger) {
		e.preventDefault()
		e.stopPropagation()

		const displayContainer = target.closest('.wg__cell-date-display') as HTMLElement
		const editorContainer = target.closest('.wg__editor--date') as HTMLElement

		if (editorContainer) {
			// Already editing - just open datepicker
			const input = editorContainer.querySelector('.wg__date-input') as HTMLInputElement
			if (input) openDatePicker(ctx, input, editorContainer)
		} else if (displayContainer) {
			// In read mode - start editing and open datepicker
			const rowIndex = parseInt(displayContainer.dataset.row || '0', 10)
			const field = displayContainer.dataset.field || ''
			const colIndex = ctx.engine.columns.findIndex(c => String(c.field) === field)
			if (colIndex >= 0) {
				// Clear selections FIRST to avoid render during picker open
				ctx.clearAllSelections()

				ctx.isTransitioningCells = true
				if (ctx.engine.editingCell) {
					// Save old cell info BEFORE commit/cancel clears it
					const oldEditingCell = ctx.engine.editingCell
					const oldColIndex = ctx.engine.columns.findIndex(c => String(c.field) === oldEditingCell.field)

					removeDropdown(ctx)
					clearEditingVisual(ctx)
					ctx.commitOrCancelEditOnTransition()

					// Move focus to the new cell BEFORE re-rendering so the old cell
					// renders without the focused class
					ctx.engine.setFocusedCell(rowIndex, colIndex)

					// Re-render old cell to remove editor HTML
					if (oldColIndex >= 0) {
						renderCell(ctx, oldEditingCell.rowIndex, oldColIndex)
					}
				}
				tryStartEdit(ctx, rowIndex, colIndex)
				requestAnimationFrame(() => {
					ctx.isTransitioningCells = false
					// Find the newly rendered date input and open picker
					const cell = ctx.shadow.querySelector(
						`.wg__cell[data-row="${rowIndex}"][data-field="${field}"]`
					)
					const input = cell?.querySelector('.wg__date-input') as HTMLInputElement
					const anchor = cell?.querySelector('.wg__editor--date') as HTMLElement
					if (input && anchor) openDatePicker(ctx, input, anchor)
				})
			}
		}
		return
	}

	// Handle click on any cell when dropdown is open
	if (ctx.dropdown.isOpen || ctx.engine.editingCell) {
		const cellSwitch = target.closest('.wg__cell') as HTMLElement
		if (cellSwitch && !target.closest('.wg__editor--select, .wg__editor--combobox, .wg__editor--autocomplete, .wg__editor--date')) {
			const rowIndex = parseInt(cellSwitch.dataset.row || '0', 10)
			const colIndex = parseInt(cellSwitch.dataset.col || '0', 10)
			const editingCell = ctx.engine.editingCell
			const isToggleClick = target.matches('.wg__combobox-toggle, .wg__select-toggle, .wg__date-trigger')
			if (editingCell && !isToggleClick) {
				const editingColIndex = ctx.engine.columns.findIndex(c => String(c.field) === editingCell.field)
				if (rowIndex !== editingCell.rowIndex || colIndex !== editingColIndex) {
					e.preventDefault()
					ctx.isTransitioningCells = true
					// Save old editing cell info
					const oldRowIndex = editingCell.rowIndex
					const oldColIndex = editingColIndex
					removeDropdown(ctx)
					clearEditingVisual(ctx)
					ctx.commitOrCancelEditOnTransition()
					// Move focus to the new cell BEFORE re-rendering so the old cell
					// renders without the focused class
					ctx.engine.setFocusedCell(rowIndex, colIndex)
					// Re-render old cell AFTER commit/cancel so it renders in display mode
					if (oldColIndex >= 0) {
						renderCell(ctx, oldRowIndex, oldColIndex)
					}
					const newColumn = ctx.engine.columns[colIndex]
					const trigger = newColumn?.editTrigger || ctx.engine.editTrigger
					// Capture click position for cursor placement
					const clickX = mouseEvent.clientX
					requestAnimationFrame(() => {
						ctx.isTransitioningCells = false
						if (trigger === 'click' && newColumn && ctx.engine.isCellEditable(newColumn, ctx.engine.displayItems[rowIndex])) {
							// For click trigger, immediately start editing the new cell
							// Find the new cell and calculate cursor position
							const newCell = ctx.shadow.querySelector(
								`td[data-row="${rowIndex}"][data-col="${colIndex}"]`
							) as HTMLElement
							const cursorPos = newCell ? getCursorPositionFromClick({ clientX: clickX } as MouseEvent, newCell) : undefined
							tryStartEdit(ctx, rowIndex, colIndex, { cursorPosition: cursorPos ?? undefined })
						} else {
							moveFocus(ctx, rowIndex, colIndex)
						}
					})
					return
				}
			}
		}
	}

	// Toggle click - handled by pipelineAdapter.tryHandleMouseDown() above
	// (dispatches focusCell → startEdit → openDropdown via pipeline)

	// Display mode dropdown click
	if (target.matches('.wg__cell-dropdown-display')) {
		e.preventDefault()
		e.stopPropagation()
		const displayContainer = target.closest('.wg__cell-dropdown-display') as HTMLElement
		if (displayContainer) {
			const rowIndex = parseInt(displayContainer.dataset.row || '0', 10)
			const field = displayContainer.dataset.field || ''
			const colIndex = ctx.engine.columns.findIndex(c => String(c.field) === field)
			if (colIndex >= 0) {
				ctx.isTransitioningCells = true
				// Save old editing cell info before clearing
				const oldEditingCell = ctx.engine.editingCell
				const oldColIndex = oldEditingCell
					? ctx.engine.columns.findIndex(c => String(c.field) === oldEditingCell.field)
					: -1
				if (oldEditingCell) {
					removeDropdown(ctx)
					clearEditingVisual(ctx)
					ctx.commitOrCancelEditOnTransition()
					// Move focus to the new cell BEFORE re-rendering so the old cell
					// renders without the focused class
					ctx.engine.setFocusedCell(rowIndex, colIndex)
					// Re-render old cell AFTER commit/cancel so it renders in display mode
					if (oldColIndex >= 0) {
						renderCell(ctx, oldEditingCell.rowIndex, oldColIndex)
					}
				}
				tryStartEdit(ctx, rowIndex, colIndex)
				requestAnimationFrame(() => {
					ctx.isTransitioningCells = false
					if (!ctx.dropdown.isOpen) {
						openDropdownForCurrentEditor(ctx)
					}
				})
			}
		}
	}
}

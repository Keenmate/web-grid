// =============================================================================
// Cell-level keyboard navigation
// =============================================================================
// The full keyboard switch for a cell in navigate mode — Tab cycle through
// editable columns, arrow-key movement, Home / End / PageUp / PageDown (with
// Ctrl variants that hop to extremes + virtual-scroll-aware focus), Ctrl+G
// "go to row" dialog, Enter (next row / open dropdown / edit empty row), F2
// (start edit + open editor for dropdown / custom), Space (toggle checkbox /
// open dropdown / open date / open custom), Escape (cancel edit → clear row
// selection → clear focused cell), Delete (Ctrl: row delete / plain: clear
// cell), printable keys (start edit with initial query, gated for numeric
// columns).
//
// The range-shortcut + row-shortcut blocks at the top run *before* the switch
// so user-defined shortcuts can preempt built-in keys; both honour `disabled`
// callbacks. Ctrl+C copies the cell-range to the clipboard if a range is
// selected, otherwise the single cell value through `beforeCopyCallback`.

import type { GridContext } from '../grid-context.js'
import type { RangeShortcutContext, ShortcutContext } from '../../types.js'
import { parseKeyCombo, matchesKeyCombo } from '../keyboard/index.js'
import { moveFocus, updateFocusVisual, clearEditingVisual, tryStartEdit } from './focus.js'
import { toggleCheckboxAndMove } from '../editing/index.js'
import { openDropdownForCurrentEditor } from '../dropdown/index.js'
import { openDatePicker } from '../datepicker/index.js'

/**
 * Handle keydown on a focused (non-editing) cell.
 *
 * Returns early if the grid isn't in navigate mode — edit-mode keydowns route
 * through `handleEditorKeyDown` on the editor input instead.
 */
export function handleCellKeyDown<T>(
	ctx: GridContext<T>,
	e: KeyboardEvent,
	rowIndex: number,
	colIndex: number
): void {
	if (!ctx.grid.isNavigateMode) {
		return
	}

	const columns = ctx.grid.columns
	const displayItems = ctx.grid.displayItems

	// For Tab navigation, we still use editable columns only — recomputed per row
	// so heterogeneous trees (some rows entirely read-only) traverse correctly.
	const currentRowForTab = displayItems[rowIndex]
	const editableCols = ctx.grid.getEditableColumns(currentRowForTab)
	const currentEditableIndex = editableCols.findIndex(ec => ec.index === colIndex)

	// Ctrl+C - Copy to clipboard
	if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
		// If cell range is selected, copy the entire range
		if (ctx.grid.selectedCellRange) {
			e.preventDefault()
			ctx.grid.copyCellSelectionToClipboard()
			return
		}

		// Otherwise copy single cell value
		const column = columns[colIndex]
		const row = displayItems[rowIndex]
		if (column && row) {
			let value: unknown = ctx.grid.getCellRawValue(row, rowIndex, String(column.field))
			if (column.beforeCopyCallback) {
				value = column.beforeCopyCallback(value, row)
			}
			const textValue = value != null ? String(value) : ''
			navigator.clipboard.writeText(textValue)
		}
		return // Let browser also handle for visual feedback
	}

	// Check range shortcuts (when rows are selected)
	const selectedRowIndices = ctx.grid.selectedRows
	if (selectedRowIndices.length > 0) {
		const rangeShortcuts = ctx.grid.rangeShortcuts
		if (rangeShortcuts && rangeShortcuts.length > 0) {
			for (const shortcut of rangeShortcuts) {
				const combo = parseKeyCombo(shortcut.key)
				if (matchesKeyCombo(e, combo)) {
					// Build range context
					const shortcutCtx: RangeShortcutContext<T> = {
						rows: ctx.grid.getSelectedRowsData(),
						rowIndices: selectedRowIndices
					}

					// Check if disabled
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
	}

	// Check row shortcuts (user-defined keyboard shortcuts)
	const shortcuts = ctx.grid.rowShortcuts
	if (shortcuts && shortcuts.length > 0) {
		const column = columns[colIndex]
		const row = displayItems[rowIndex]
		if (column && row) {
			for (const shortcut of shortcuts) {
				const combo = parseKeyCombo(shortcut.key)
				if (matchesKeyCombo(e, combo)) {
					// Build shortcut context
					const shortcutCtx: ShortcutContext<T> = {
						row,
						rowIndex,
						colIndex,
						column,
						cellValue: ctx.grid.getCellRawValue(row, rowIndex, String(column.field))
					}

					// Check if disabled
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
	}

	switch (e.key) {
		case 'ArrowUp':
			e.preventDefault()
			if (rowIndex > 0) {
				moveFocus(ctx, rowIndex - 1, colIndex)
			}
			break

		case 'ArrowDown':
			e.preventDefault()
			if (rowIndex < displayItems.length - 1) {
				moveFocus(ctx, rowIndex + 1, colIndex)
			}
			break

		case 'ArrowLeft':
			e.preventDefault()
			// Ctrl/Cmd+ArrowLeft tree-collapse is handled at the table-keydown level,
			// before pipelineAdapter — this branch only runs for plain ArrowLeft.
			if (colIndex > 0) {
				moveFocus(ctx, rowIndex, colIndex - 1)
			}
			break

		case 'ArrowRight':
			e.preventDefault()
			// Ctrl/Cmd+ArrowRight tree-expand is handled at the table-keydown level.
			if (colIndex < columns.length - 1) {
				moveFocus(ctx, rowIndex, colIndex + 1)
			}
			break

		case 'Tab': {
			e.preventDefault()
			const direction: 'forward' | 'backward' = e.shiftKey ? 'backward' : 'forward'

			// If currently focused on a non-editable cell (now possible since all cells are
			// focusable in navigate mode), find the nearest editable column on this row first.
			let fromEditableIdx = currentEditableIndex
			if (fromEditableIdx === -1 && editableCols.length > 0) {
				if (direction === 'forward') {
					const next = editableCols.find(ec => ec.index > colIndex)
					if (next) {
						moveFocus(ctx, rowIndex, next.index)
						break
					}
					// No editable column to the right on this row; fall through with sentinel
					fromEditableIdx = editableCols.length - 1
				} else {
					const prev = [...editableCols].reverse().find(ec => ec.index < colIndex)
					if (prev) {
						moveFocus(ctx, rowIndex, prev.index)
						break
					}
					fromEditableIdx = 0
				}
			}

			const next = ctx.grid.findNextEditableCell(rowIndex, fromEditableIdx, direction)
			if (next) {
				moveFocus(ctx, next.rowIndex, next.colIndex)
			} else if (direction === 'forward' && ctx.grid.isEmptyRowIndex(rowIndex) && editableCols.length > 0) {
				// On last cell of empty row - wrap to first editable cell
				moveFocus(ctx, rowIndex, editableCols[0].index)
			}
			break
		}

		case 'Home':
			e.preventDefault()
			if (e.ctrlKey) {
				if (ctx.grid.shouldUseVirtualScroll()) {
					const oldFocus = ctx.grid.focusedCell
					ctx.grid.setFocusedCell(0, 0)
					ctx.scrollToRowProgrammatically(0)
					const cell = ctx.shadow.querySelector(`td[data-row="0"][data-col="0"]`) as HTMLElement
					if (cell) {
						cell.focus({ preventScroll: true })
						updateFocusVisual(ctx, oldFocus, { rowIndex: 0, colIndex: 0 })
					}
				} else {
					moveFocus(ctx, 0, 0)
				}
			} else {
				moveFocus(ctx, rowIndex, 0)
			}
			break

		case 'End':
			e.preventDefault()
			if (e.ctrlKey) {
				const lastRow = displayItems.length - 1
				const lastCol = columns.length - 1
				if (ctx.grid.shouldUseVirtualScroll()) {
					const oldFocus = ctx.grid.focusedCell
					ctx.grid.setFocusedCell(lastRow, lastCol)
					ctx.scrollToRowProgrammatically(lastRow)
					const cell = ctx.shadow.querySelector(`td[data-row="${lastRow}"][data-col="${lastCol}"]`) as HTMLElement
					if (cell) {
						cell.focus({ preventScroll: true })
						updateFocusVisual(ctx, oldFocus, { rowIndex: lastRow, colIndex: lastCol })
					}
				} else {
					moveFocus(ctx, lastRow, lastCol)
				}
			} else {
				moveFocus(ctx, rowIndex, columns.length - 1)
			}
			break

		case 'PageUp':
			e.preventDefault()
			if (e.ctrlKey) {
				if (ctx.grid.shouldUseVirtualScroll()) {
					const oldFocus = ctx.grid.focusedCell
					ctx.grid.setFocusedCell(0, colIndex)
					ctx.scrollToRowProgrammatically(0)
					const cell = ctx.shadow.querySelector(`td[data-row="0"][data-col="${colIndex}"]`) as HTMLElement
					if (cell) {
						cell.focus({ preventScroll: true })
						updateFocusVisual(ctx, oldFocus, { rowIndex: 0, colIndex })
					}
				} else {
					moveFocus(ctx, 0, colIndex)
				}
			} else {
				const newRowUp = Math.max(0, rowIndex - 10)
				if (ctx.grid.shouldUseVirtualScroll()) {
					const oldFocus = ctx.grid.focusedCell
					ctx.grid.setFocusedCell(newRowUp, colIndex)
					ctx.scrollToRowProgrammatically(newRowUp)
					const cell = ctx.shadow.querySelector(`td[data-row="${newRowUp}"][data-col="${colIndex}"]`) as HTMLElement
					if (cell) {
						cell.focus({ preventScroll: true })
						updateFocusVisual(ctx, oldFocus, { rowIndex: newRowUp, colIndex })
					}
				} else {
					moveFocus(ctx, newRowUp, colIndex)
				}
			}
			break

		case 'PageDown':
			e.preventDefault()
			if (e.ctrlKey) {
				const lastRow = displayItems.length - 1
				if (ctx.grid.shouldUseVirtualScroll()) {
					const oldFocus = ctx.grid.focusedCell
					ctx.grid.setFocusedCell(lastRow, colIndex)
					ctx.scrollToRowProgrammatically(lastRow)
					const cell = ctx.shadow.querySelector(`td[data-row="${lastRow}"][data-col="${colIndex}"]`) as HTMLElement
					if (cell) {
						cell.focus({ preventScroll: true })
						updateFocusVisual(ctx, oldFocus, { rowIndex: lastRow, colIndex })
					}
				} else {
					moveFocus(ctx, lastRow, colIndex)
				}
			} else {
				const newRowDown = Math.min(displayItems.length - 1, rowIndex + 10)
				if (ctx.grid.shouldUseVirtualScroll()) {
					const oldFocus = ctx.grid.focusedCell
					ctx.grid.setFocusedCell(newRowDown, colIndex)
					ctx.scrollToRowProgrammatically(newRowDown)
					// Focus the cell after scroll (renderVirtualRows may not run if range unchanged)
					const cell = ctx.shadow.querySelector(`td[data-row="${newRowDown}"][data-col="${colIndex}"]`) as HTMLElement
					if (cell) {
						cell.focus({ preventScroll: true })
						updateFocusVisual(ctx, oldFocus, { rowIndex: newRowDown, colIndex })
					}
				} else {
					moveFocus(ctx, newRowDown, colIndex)
				}
			}
			break

		case 'g':
		case 'G':
			if (e.ctrlKey) {
				e.preventDefault()
				ctx.showGoToRowDialog(colIndex)
			}
			break

		case 'Enter': {
			e.preventDefault()
			const column = columns[colIndex]
			const isDropdownColumn = column?.editor === 'select' || column?.editor === 'combobox' || column?.editor === 'autocomplete'
			const isEmptyRowEnter = ctx.grid.isEmptyRowIndex(rowIndex)

			if (isDropdownColumn && ctx.grid.getEffectiveShouldOpenDropdownOnEnter(column)) {
				tryStartEdit(ctx, rowIndex, colIndex)
				requestAnimationFrame(() => {
					if (!ctx.dropdown.isOpen) {
						openDropdownForCurrentEditor(ctx)
					}
				})
			} else if (isEmptyRowEnter && column && ctx.grid.isCellEditable(column)) {
				// On empty row, Enter starts editing the cell (like F2)
				tryStartEdit(ctx, rowIndex, colIndex)
			} else {
				if (rowIndex < displayItems.length - 1) {
					const targetCol = ctx.grid.tabTraversalStartColIndex ?? colIndex
					ctx.grid.tabTraversalStartColIndex = null
					moveFocus(ctx, rowIndex + 1, targetCol)
				}
			}
			break
		}

		case 'F2': {
			e.preventDefault()
			const f2Column = columns[colIndex]
			const f2IsDropdown = f2Column?.editor === 'select' || f2Column?.editor === 'combobox' || f2Column?.editor === 'autocomplete'
			const f2IsCustom = f2Column?.editor === 'custom'
			tryStartEdit(ctx, rowIndex, colIndex)
			if (f2IsDropdown) {
				requestAnimationFrame(() => {
					if (!ctx.dropdown.isOpen) {
						openDropdownForCurrentEditor(ctx)
					}
				})
			} else if (f2IsCustom) {
				requestAnimationFrame(() => {
					ctx.openCustomEditor(rowIndex, colIndex)
				})
			}
			break
		}

		case ' ': {
			e.preventDefault()
			const col = columns[colIndex]
			const isCheckbox = col?.editor === 'checkbox'
			const isDropdown = col?.editor === 'select' || col?.editor === 'combobox' || col?.editor === 'autocomplete'
			const isDate = col?.editor === 'date'
			const isCustom = col?.editor === 'custom'

			if (isCheckbox && col && ctx.grid.isCellEditable(col, displayItems[rowIndex])) {
				toggleCheckboxAndMove(ctx, rowIndex, colIndex)
			} else if (isDropdown) {
				tryStartEdit(ctx, rowIndex, colIndex)
				requestAnimationFrame(() => {
					if (!ctx.dropdown.isOpen) {
						openDropdownForCurrentEditor(ctx)
					}
				})
			} else if (isDate) {
				// Same pattern as dropdown - start edit and open datepicker
				tryStartEdit(ctx, rowIndex, colIndex)
				requestAnimationFrame(() => {
					const cell = ctx.shadow.querySelector(
						`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
					)
					const input = cell?.querySelector('.wg__date-input') as HTMLInputElement
					const anchor = cell?.querySelector('.wg__editor--date') as HTMLElement
					if (input && anchor) openDatePicker(ctx, input, anchor)
				})
			} else if (isCustom) {
				// Custom editors - start edit and call callback
				tryStartEdit(ctx, rowIndex, colIndex)
				requestAnimationFrame(() => {
					ctx.openCustomEditor(rowIndex, colIndex)
				})
			}
			break
		}

		case 'Escape':
			e.preventDefault()
			if (ctx.grid.editingCell) {
				clearEditingVisual(ctx)
				ctx.grid.cancelEdit()
			} else if (ctx.grid.selectedRows.length > 0) {
				// Clear row selection first
				ctx.grid.clearSelection()
			} else {
				const oldFocus = ctx.grid.focusedCell
				ctx.grid.clearFocusedCell()
				updateFocusVisual(ctx, oldFocus, null)
				;(e.target as HTMLElement)?.blur()
			}
			break

		case 'Delete': {
			e.preventDefault()
			const column = columns[colIndex]
			const row = displayItems[rowIndex]
			if (e.ctrlKey) {
				// Ctrl+Delete: Request row deletion
				if (row) {
					const detail = { rowIndex, row }
					if (ctx.grid.onrowdelete) {
						ctx.grid.onrowdelete(detail)
					}
					ctx.dispatchEvent(new CustomEvent('rowdelete', { detail }))
				}
			} else {
				// Delete: Clear cell content
				if (column && ctx.grid.isCellEditable(column, row)) {
					ctx.grid.commitEdit(rowIndex, String(column.field), null)
					ctx.render()
					// Restore focus to the same cell
					requestAnimationFrame(() => {
						const cell = ctx.shadow.querySelector(
							`td[data-row="${rowIndex}"][data-col="${colIndex}"]`
						) as HTMLElement
						cell?.focus()
					})
				}
			}
			break
		}

		default:
			// Printable characters start editing with initial query
			if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
				const col = columns[colIndex]
				// For number columns, only allow numeric input to start editing
				if (col?.editor === 'number') {
					if (!/[\d.\-]/.test(e.key)) {
						return // Ignore non-numeric keys for number columns
					}
				}
				tryStartEdit(ctx, rowIndex, colIndex, { initialSearchQuery: e.key })
				e.preventDefault()
			}
			break
	}
}

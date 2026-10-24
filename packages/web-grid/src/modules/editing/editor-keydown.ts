// =============================================================================
// Editor-input keydown handler
// =============================================================================
// Keyboard handling while a cell editor (text input / number / select /
// combobox / autocomplete / date) is focused. Three rough modes:
//
//  1. Dropdown editor with CLOSED dropdown: navigation keys cancel the edit
//     and move focus to the neighbour cell (effectively letting the user
//     keyboard past the editor without ever opening its menu).
//  2. Dropdown editor with OPEN dropdown: arrows highlight options (skipping
//     disabled ones), Enter selects, Tab selects + commits + moves focus.
//  3. Text-like editor (text/number/date): Enter commits → moveFocusAfterCommit
//     ('down'), Tab commits → moveFocusAfterCommit ('next'|'prev'),
//     two-stage Escape (first close dropdown/datepicker, second cancel edit).
//
// Backspace + printable keys on the (read-only) select editor feed
// updateSelectFilter so the user can type-to-search without an actual input.

import type { GridHost } from '../grid-context.js'
import {
	updateDropdownHighlight,
	scrollHighlightedIntoView,
	openDropdownForCurrentEditor,
	selectDropdownOption,
	removeDropdown,
	isOptionDisabled,
	getOptionValue,
	updateSelectFilter
} from '../dropdown/index.js'
import { commitDateEditor } from '../datepicker/index.js'
import { clearEditingVisual, moveFocus } from '../navigation/index.js'
import {
	commitCurrentEditor,
	moveFocusAfterCommit,
	focusCellAfterCancel,
	restoreCellToDisplayMode
} from './lifecycle.js'

/**
 * Handle keydown on a focused editor input. Async because some branches
 * await the editing pipeline (commitEdit / commitCurrentEditor /
 * commitDateEditor).
 */
export async function handleEditorKeyDown<T>(
	ctx: GridHost<T>,
	e: KeyboardEvent,
	editor: HTMLElement
): Promise<void> {
	const rowIndex = parseInt(editor.dataset.row || '0', 10)
	const field = editor.dataset.field || ''
	const column = ctx.engine.columns.find(c => c.field === field)
	const editorType = column?.editor || 'text'
	const isDropdownEditor = editorType === 'select' || editorType === 'combobox' || editorType === 'autocomplete'

	// For dropdown editors with CLOSED dropdown, navigation keys cancel edit and navigate
	const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']
	if (isDropdownEditor && !ctx.dropdown.isOpen && navKeys.includes(e.key)) {
		e.preventDefault()
		e.stopPropagation()

		const colIndex = ctx.engine.columns.findIndex(c => c.field === field)
		const editableCols = ctx.engine.columns
			.map((c, i) => ({ index: i, column: c }))
			.filter(ec => ec.column.isEditable !== false)
		const currentEditableIdx = editableCols.findIndex(ec => ec.index === colIndex)
		const displayItems = ctx.engine.displayItems

		let destRow = rowIndex
		let destCol = colIndex
		let canNavigate = false

		switch (e.key) {
			case 'ArrowUp':
				if (rowIndex > 0) { destRow = rowIndex - 1; canNavigate = true }
				break
			case 'ArrowDown':
				if (rowIndex < displayItems.length - 1) { destRow = rowIndex + 1; canNavigate = true }
				break
			case 'ArrowLeft':
				if (currentEditableIdx > 0) { destCol = editableCols[currentEditableIdx - 1].index; canNavigate = true }
				break
			case 'ArrowRight':
				if (currentEditableIdx < editableCols.length - 1) { destCol = editableCols[currentEditableIdx + 1].index; canNavigate = true }
				break
			case 'PageUp':
				destRow = Math.max(0, rowIndex - 10); canNavigate = true
				break
			case 'PageDown':
				destRow = Math.min(displayItems.length - 1, rowIndex + 10); canNavigate = true
				break
			case 'Home':
				if (e.ctrlKey) { destRow = 0; destCol = 0 } else { destCol = 0 }
				canNavigate = true
				break
			case 'End':
				if (e.ctrlKey) { destRow = displayItems.length - 1; destCol = ctx.engine.columns.length - 1 } else { destCol = ctx.engine.columns.length - 1 }
				canNavigate = true
				break
		}

		if (canNavigate) {
			clearEditingVisual(ctx)
			ctx.engine.cancelEdit()
			queueMicrotask(() => {
				moveFocus(ctx, destRow, destCol)
			})
		}
		return
	}

	switch (e.key) {
		case 'ArrowDown':
			if (ctx.dropdown.isOpen) {
				e.preventDefault()
				e.stopPropagation()
				const optsDown = ctx.getCurrentEditorOptions()
				// Find next non-disabled option
				let nextIndex = ctx.dropdown.highlightedIndex + 1
				while (nextIndex < ctx.dropdown.options.length && isOptionDisabled(ctx.dropdown.options[nextIndex], optsDown)) {
					nextIndex++
				}
				if (nextIndex < ctx.dropdown.options.length) {
					ctx.dropdown.setHighlightedIndex(nextIndex)
					updateDropdownHighlight(ctx)
					scrollHighlightedIntoView(ctx)
				}
			}
			break

		case 'ArrowUp':
			if (ctx.dropdown.isOpen) {
				e.preventDefault()
				e.stopPropagation()
				const optsUp = ctx.getCurrentEditorOptions()
				// Find previous non-disabled option
				let prevIndex = ctx.dropdown.highlightedIndex - 1
				while (prevIndex >= 0 && isOptionDisabled(ctx.dropdown.options[prevIndex], optsUp)) {
					prevIndex--
				}
				if (prevIndex >= 0) {
					ctx.dropdown.setHighlightedIndex(prevIndex)
					updateDropdownHighlight(ctx)
					scrollHighlightedIntoView(ctx)
				}
			}
			break

		case 'Enter':
			// If datepicker is open, let it handle Enter (selects focused date)
			if (ctx.datepicker) {
				return
			}
			e.preventDefault()
			e.stopPropagation()
			if (ctx.dropdown.isOpen && ctx.dropdown.highlightedIndex >= 0) {
				// Enter with dropdown selects option and commits empty row
				selectDropdownOption(ctx, ctx.dropdown.highlightedIndex, true, true)
			} else if (isDropdownEditor && !ctx.dropdown.isOpen) {
				openDropdownForCurrentEditor(ctx)
			} else {
				ctx.isCommittingFromKeyboard = true
				removeDropdown(ctx)
				if (editorType === 'date' && editor instanceof HTMLInputElement) {
					// Enter commits empty row (adds to items if it has data)
					await commitDateEditor(ctx, editor, true)
				} else {
					// Enter commits empty row (adds to items if it has data)
					await commitCurrentEditor(ctx, editor, true)
				}
				moveFocusAfterCommit(ctx, rowIndex, field, 'down')
			}
			break

		case 'Tab':
			// If datepicker is open, let it handle Tab (selects focused date)
			if (ctx.datepicker) {
				return
			}
			e.preventDefault()
			e.stopPropagation()
			ctx.isCommittingFromKeyboard = true

			// Check if we're on the empty row's last editable cell (Tab should commit)
			const tabRow = ctx.engine.displayItems[rowIndex]
			const tabEditableCols = ctx.engine.getEditableColumns(tabRow)
			const tabColIndex = ctx.engine.columns.findIndex(c => String(c.field) === field)
			const tabCurrentEditableIndex = tabEditableCols.findIndex(ec => ec.index === tabColIndex)
			const isOnEmptyRow = ctx.engine.isEmptyRowIndex(rowIndex)
			const isLastEditableCell = tabCurrentEditableIndex === tabEditableCols.length - 1
			const shouldCommitEmptyRow = isOnEmptyRow && isLastEditableCell && !e.shiftKey

			// For dropdowns with a highlighted option, select it before moving
			if (ctx.dropdown.isOpen && ctx.dropdown.highlightedIndex >= 0 && isDropdownEditor) {
				// Select the highlighted option - this commits the value (skip if disabled)
				const option = ctx.dropdown.options[ctx.dropdown.highlightedIndex]
				const opts = ctx.getCurrentEditorOptions()
				if (option && !isOptionDisabled(option, opts)) {
					const value = getOptionValue(option, opts)
					await ctx.engine.commitEdit(rowIndex, field, value, shouldCommitEmptyRow)
				}
				removeDropdown(ctx)
			} else {
				removeDropdown(ctx)
				if (editorType === 'date' && editor instanceof HTMLInputElement) {
					await commitDateEditor(ctx, editor, shouldCommitEmptyRow)
				} else if (!isDropdownEditor) {
					// Only commit for non-dropdown editors (text, number, etc.)
					await commitCurrentEditor(ctx, editor, shouldCommitEmptyRow)
				}
				// For select editors without dropdown open, keep current value
			}

			// After committing empty row on last cell, focus first editable cell of new empty row
			if (shouldCommitEmptyRow) {
				// Restore current cell to display mode
				restoreCellToDisplayMode(ctx, rowIndex, tabColIndex)
				// Focus the new empty row's first editable cell
				const firstEditableColIndex = tabEditableCols.length > 0 ? tabEditableCols[0].index : 0
				// Use queueMicrotask to allow the grid to re-render with the new empty row
				queueMicrotask(() => {
					const newEmptyRowIndex = ctx.engine.newRowPosition === 'top' ? 0 : ctx.engine.displayItems.length - 1
					moveFocus(ctx, newEmptyRowIndex, firstEditableColIndex)
					ctx.isCommittingFromKeyboard = false
				})
			} else {
				moveFocusAfterCommit(ctx, rowIndex, field, e.shiftKey ? 'prev' : 'next')
			}
			break

		case 'Escape':
			e.preventDefault()
			e.stopPropagation()
			// First Escape: close dropdown/datepicker but stay in edit mode
			// Second Escape: cancel edit entirely
			if (ctx.dropdown.isOpen) {
				removeDropdown(ctx)
				// For autocomplete/combobox, clear search text and refocus input
				if (editorType === 'autocomplete' || editorType === 'combobox') {
					ctx.dropdown.setFilterText('')
					if (editor instanceof HTMLInputElement) {
						editor.value = ''
						editor.focus()
					}
				}
				return  // Stay in edit mode
			}
			// Close datepicker if open (first Escape)
			if (ctx.datepicker) {
				ctx.datepicker.close(true)
				ctx.datepicker = null
				return  // Stay in edit mode
			}
			// Second Escape (or no dropdown/datepicker): cancel edit
			ctx.isCommittingFromKeyboard = true
			clearEditingVisual(ctx)
			ctx.engine.cancelEdit()
			focusCellAfterCancel(ctx, rowIndex, field)
			break

		case 'F2':
			e.preventDefault()
			e.stopPropagation()
			if (isDropdownEditor && !ctx.dropdown.isOpen) {
				openDropdownForCurrentEditor(ctx)
			}
			break

		case 'Backspace':
			if (editorType === 'select') {
				e.preventDefault()
				e.stopPropagation()
				if (ctx.dropdown.filterText.length > 0) {
					ctx.dropdown.setFilterText(ctx.dropdown.filterText.slice(0, -1))
					updateSelectFilter(ctx, column!.editorOptions || {})
				}
			}
			break

		default:
			if (editorType === 'select' && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
				e.preventDefault()
				e.stopPropagation()
				ctx.dropdown.setFilterText(ctx.dropdown.filterText + e.key)
				updateSelectFilter(ctx, column!.editorOptions || {})
			}
			break
	}
}

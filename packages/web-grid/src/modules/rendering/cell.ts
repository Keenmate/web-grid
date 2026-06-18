// =============================================================================
// Surgical Cell Rendering
// Centralized function to update a single cell's DOM without full re-render
// =============================================================================

import type { GridContext } from '../grid-context.js'
import { renderCellEditor } from '../editing/index.js'
import { renderCellDisplay } from './display.js'
import { wrapTreeCell } from './tree-render.js'

export type RenderCellOptions = {
	/** Focus the editor after rendering (for edit mode) */
	focusEditor?: boolean
	/** Cursor position for text inputs */
	cursorPosition?: number
	/** Initial search query (type-to-start) */
	initialSearchQuery?: string
}

/**
 * Surgically update a single cell's DOM based on current grid state.
 * This is the single source of truth for cell appearance.
 *
 * Handles:
 * - All CSS classes (focused, editing, editable, invalid, etc.)
 * - Cell content (editor vs display mode)
 * - Editor focus and cursor positioning
 */
export function renderCell<T>(
	ctx: GridContext<T>,
	rowIndex: number,
	colIndex: number,
	options: RenderCellOptions = {}
): void {
	const column = ctx.grid.columns[colIndex]
	if (!column) return

	const cell = ctx.shadow.querySelector(
		`td[data-row="${rowIndex}"][data-col="${colIndex}"]`
	) as HTMLElement
	if (!cell) return

	const field = String(column.field)
	const item = ctx.grid.displayItems[rowIndex]
	if (!item) return

	// Determine cell state
	const shouldShowEditor = ctx.grid.shouldShowEditor(rowIndex, colIndex)
	const isActivelyEditing = ctx.grid.isEditing(rowIndex, field)  // Only the ONE tracked cell
	const isFocused = ctx.grid.isCellFocused(rowIndex, colIndex)
	// Use canEditCell to check both column editability AND row locking
	const isEditable = ctx.grid.canEditCell(rowIndex, field)
	const isInvalid = ctx.grid.isCellInvalid(rowIndex, field)

	// Find visual index for frozen column checks
	const visualIndex = ctx.grid.visualColumns.findIndex(vc => vc.originalIndex === colIndex)
	const isFrozen = visualIndex >= 0 && ctx.grid.isColumnFrozen(visualIndex)
	const isLastFrozen = isFrozen && visualIndex === ctx.grid.totalFrozenColumns - 1

	// Determine if this is 'always' editTrigger mode
	const effectiveTrigger = column.editTrigger ?? ctx.grid.editTrigger

	// Build class list
	const classes = ['wg__cell']
	if (isEditable) classes.push('wg__cell--editable')
	if (isFocused && !isActivelyEditing) classes.push('wg__cell--focused')
	// In 'always' mode, add special focus class even when showing editor
	if (isFocused && effectiveTrigger === 'always') classes.push('wg__cell--always-edit-focused')
	if (column.textOverflow !== 'wrap') classes.push('wg__cell--ellipsis')
	if (column.maxLines) classes.push('wg__cell--line-clamp')
	if (isActivelyEditing) classes.push('wg__cell--editing')
	if (isInvalid) classes.push('wg__cell--invalid')
	if (ctx.grid.isDirtyIndicatorVisible && ctx.grid.isCellDirty(rowIndex, field)) {
		classes.push('wg__cell--dirty')
	}
	if (visualIndex >= 0 && ctx.grid.isCellInSelectedRange(rowIndex, visualIndex)) classes.push('wg__cell--in-range')
	if (visualIndex >= 0 && ctx.grid.isColumnSelected(visualIndex)) classes.push('wg__cell--column-selected')
	if (isFrozen) classes.push('wg__cell--frozen')
	if (isLastFrozen) classes.push('wg__cell--frozen-last')
	if (column.cellClass) classes.push(column.cellClass)
	if (column.cellClassCallback) {
		const rawValue = ctx.grid.getCellRawValue(item, rowIndex, field)
		const dynamicClass = column.cellClassCallback(rawValue, item)
		if (dynamicClass) classes.push(dynamicClass)
	}

	// Update classes (replace all)
	cell.className = classes.join(' ')

	// Update content
	if (shouldShowEditor) {
		cell.innerHTML = wrapTreeCell(ctx, column, item, renderCellEditor(ctx, rowIndex, colIndex, column))

		// Focus editor if requested
		if (options.focusEditor) {
			focusEditorInCell(ctx, cell, column, options)
		}
	} else {
		const value = ctx.grid.getCellValue(item, column, rowIndex)
		cell.innerHTML = wrapTreeCell(ctx, column, item, renderCellDisplay(ctx, rowIndex, colIndex, column, value, isFocused, isEditable))
	}
}

/**
 * Focus the editor input within a cell and set cursor position
 */
function focusEditorInCell<T>(
	ctx: GridContext<T>,
	cell: HTMLElement,
	column: { field: string | number | symbol; editor?: string; editorOptions?: { editStartSelection?: string } },
	options: RenderCellOptions
): void {
	// Find the appropriate editor element
	let editor = cell.querySelector('.wg__combobox-input, .wg__autocomplete-input, .wg__select-trigger, .wg__date-input') as HTMLElement
	if (!editor) {
		editor = cell.querySelector('.wg__editor') as HTMLElement
	}
	if (!editor) return

	editor.focus()

	// Set cursor position for text inputs
	if (editor instanceof HTMLInputElement && editor.type === 'text') {
		const cursorPos = options.cursorPosition
		// Combobox/autocomplete default to selectAll (cursor positioning doesn't apply to filter inputs)
		const isDropdownInput = editor.classList.contains('wg__combobox-input') || editor.classList.contains('wg__autocomplete-input')
		const defaultSelection = isDropdownInput ? 'selectAll' : undefined
		const editStartSelection = column.editorOptions?.editStartSelection || defaultSelection || ctx.grid.editStartSelection

		if (options.initialSearchQuery !== undefined) {
			// Type-to-start: always cursor at end
			const len = editor.value.length
			editor.setSelectionRange(len, len)
		} else {
			// Apply editStartSelection setting
			switch (editStartSelection) {
				case 'mousePosition':
					if (cursorPos !== undefined) {
						const pos = Math.min(cursorPos, editor.value.length)
						editor.setSelectionRange(pos, pos)
					} else {
						editor.setSelectionRange(editor.value.length, editor.value.length)
					}
					break
				case 'cursorAtStart':
					editor.setSelectionRange(0, 0)
					break
				case 'cursorAtEnd':
					editor.setSelectionRange(editor.value.length, editor.value.length)
					break
				case 'selectAll':
				default:
					editor.select()
					break
			}
		}
	}
}

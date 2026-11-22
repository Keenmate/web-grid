// =============================================================================
// Surgical Cell Rendering
// Centralized function to update a single cell's DOM without full re-render
// =============================================================================

import type { GridHost } from '../grid-context.js'
import { renderCellEditor } from '../editing/index.js'
import { renderCellDisplay } from './display.js'
import { wrapTreeCell } from './tree-render.js'
import { getCellTooltip } from './table.js'
import { isCellSelectable } from './aria.js'
import { untabCellWidgets } from './cell-widgets.js'
import { reanchorOpenDropdown } from '../dropdown/rendering.js'
import { GRID_ENGINE } from '../grid-context.js'

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
	ctx: GridHost<T>,
	rowIndex: number,
	colIndex: number,
	options: RenderCellOptions = {}
): void {
	const column = ctx[GRID_ENGINE].columns[colIndex]
	if (!column) return

	const cell = ctx.shadow.querySelector(
		`td[data-row="${rowIndex}"][data-col="${colIndex}"]`
	) as HTMLElement
	if (!cell) return

	const field = String(column.field)
	const item = ctx[GRID_ENGINE].displayItems[rowIndex]
	if (!item) return

	// Determine cell state
	const shouldShowEditor = ctx[GRID_ENGINE].shouldShowEditor(rowIndex, colIndex)
	const isActivelyEditing = ctx[GRID_ENGINE].isEditing(rowIndex, field)  // Only the ONE tracked cell
	const isFocused = ctx[GRID_ENGINE].isCellFocused(rowIndex, colIndex)
	// Use canEditCell to check both column editability AND row locking
	const isEditable = ctx[GRID_ENGINE].canEditCell(rowIndex, field)
	const isInvalid = ctx[GRID_ENGINE].isCellInvalid(rowIndex, field)

	// Find visual index for frozen column checks
	const visualIndex = ctx[GRID_ENGINE].visualColumns.findIndex(vc => vc.originalIndex === colIndex)
	const isFrozen = visualIndex >= 0 && ctx[GRID_ENGINE].isColumnFrozen(visualIndex)
	const isLastFrozen = isFrozen && visualIndex === ctx[GRID_ENGINE].totalFrozenColumns - 1

	// Determine if this is 'always' editTrigger mode
	const effectiveTrigger = column.editTrigger ?? ctx[GRID_ENGINE].editTrigger

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
	if (ctx[GRID_ENGINE].isDirtyIndicatorShown && ctx[GRID_ENGINE].isCellDirty(rowIndex, field)) {
		classes.push('wg__cell--dirty')
	}
	if (visualIndex >= 0 && ctx[GRID_ENGINE].isCellInSelectedRange(rowIndex, visualIndex)) classes.push('wg__cell--in-range')
	if (visualIndex >= 0 && ctx[GRID_ENGINE].isColumnPositionSelected(visualIndex)) classes.push('wg__cell--column-selected')
	if (isFrozen) classes.push('wg__cell--frozen')
	if (isLastFrozen) classes.push('wg__cell--frozen-last')
	if (column.cellClass) classes.push(column.cellClass)
	if (column.getCellClassCallback) {
		const dynamicClass = column.getCellClassCallback(ctx[GRID_ENGINE].cellCtx(item, rowIndex, column))
		if (dynamicClass) classes.push(dynamicClass)
	}

	// Update classes (replace all)
	cell.className = classes.join(' ')

	// ARIA state that can change with the cell (row lock, selection) — mirrors table.ts cellAriaAttrs
	if (ctx[GRID_ENGINE].isEffectivelyEditable && !isEditable) cell.setAttribute('aria-readonly', 'true')
	else cell.removeAttribute('aria-readonly')
	if (visualIndex >= 0 && isCellSelectable(ctx)) {
		const isSelected = ctx[GRID_ENGINE].isCellInSelectedRange(rowIndex, visualIndex) || ctx[GRID_ENGINE].isColumnPositionSelected(visualIndex)
		cell.setAttribute('aria-selected', String(isSelected))
	}

	// Tooltip attributes (a commit can make the cell invalid / valid again)
	const tooltip = getCellTooltip(ctx, item, rowIndex, column)
	cell.removeAttribute('data-tooltip')
	cell.removeAttribute('data-tooltip-html')
	if (tooltip) cell.setAttribute(tooltip.attr, tooltip.text)

	// Update content
	if (shouldShowEditor) {
		cell.innerHTML = wrapTreeCell(ctx, column, item, renderCellEditor(ctx, rowIndex, colIndex, column))
		reanchorOpenDropdown(ctx)  // an open dropdown on this cell follows its new editor

		// Focus editor if requested
		if (options.focusEditor) {
			focusEditorInCell(ctx, cell, column, options)
		}
	} else {
		const display = ctx[GRID_ENGINE].getCellDisplayHtml(item, column, rowIndex)
		cell.innerHTML = wrapTreeCell(ctx, column, item, renderCellDisplay(ctx, rowIndex, colIndex, column, display, isFocused, isEditable))
		// renderCellCallback controls are no tab stops of their own (the grid is ONE tab stop)
		untabCellWidgets(cell)
	}

	// The row's dirty state may have changed with this cell — keep the row-number
	// marker in step (the full renderer sets it; surgical commits must too).
	const rowNumberCell = cell.parentElement?.querySelector('.wg__row-number') as HTMLElement | null
	if (rowNumberCell && !rowNumberCell.matches('.wg__row-number--locked, .wg__empty-row-indicator')) {
		rowNumberCell.classList.toggle(
			'wg__row-number--dirty',
			ctx[GRID_ENGINE].isDirtyIndicatorShown && ctx[GRID_ENGINE].isRowDirty(rowIndex)
		)
	}
}

/**
 * Focus the editor input within a cell and set cursor position
 */
function focusEditorInCell<T>(
	ctx: GridHost<T>,
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
		const defaultSelection = isDropdownInput ? 'select-all' : undefined
		const editStartSelection = column.editorOptions?.editStartSelection || defaultSelection || ctx[GRID_ENGINE].editStartSelection

		if (options.initialSearchQuery !== undefined) {
			// Type-to-start: always cursor at end
			const len = editor.value.length
			editor.setSelectionRange(len, len)
		} else {
			// Apply editStartSelection setting
			switch (editStartSelection) {
				case 'mouse-position':
					if (cursorPos !== undefined) {
						const pos = Math.min(cursorPos, editor.value.length)
						editor.setSelectionRange(pos, pos)
					} else {
						editor.setSelectionRange(editor.value.length, editor.value.length)
					}
					break
				case 'cursor-at-start':
					editor.setSelectionRange(0, 0)
					break
				case 'cursor-at-end':
					editor.setSelectionRange(editor.value.length, editor.value.length)
					break
				case 'select-all':
				default:
					editor.select()
					break
			}
		}
	}
}

// =============================================================================
// Edit Executor
// Handles startEdit, commitEdit, cancelEdit actions
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction, StartEditAction, DeleteCellAction, EscapeEditAction } from '../types.js'
import { tryStartEdit, clearEditingVisual, focusCellElement, moveFocus } from '../../navigation/focus.js'
import { removeDropdown, getOptionDisplayValue } from '../../dropdown/index.js'
import { renderCell } from '../../rendering/index.js'
import { resolveComboboxValue } from '../../editing/commit-on-transition.js'

/**
 * Edit executor - handles edit lifecycle actions
 */
export const editExecutor: ActionExecutor = {
	handles: ['startEdit', 'commitEdit', 'cancelEdit', 'escapeEdit', 'deleteCell'],

	execute(ctx: ExecutorContext, action: GridAction): GridAction[] | void {
		switch (action.type) {
			case 'startEdit':
				executeStartEdit(ctx, action)
				break
			case 'commitEdit':
				executeCommitEdit(ctx, action.commitEmptyRow, action.target, action.focusEmptyRowColIndex)
				break
			case 'cancelEdit':
				executeCancelEdit(ctx)
				break
			case 'escapeEdit':
				return executeEscapeEdit(ctx, action)
			case 'deleteCell':
				executeDeleteCell(ctx, action)
				break
		}
	}
}

/**
 * Start editing a cell
 */
function executeStartEdit(ctx: ExecutorContext, action: StartEditAction): void {
	const { rowIndex, colIndex } = action.target
	tryStartEdit(ctx, rowIndex, colIndex, {
		initialSearchQuery: action.initialSearchQuery,
		cursorPosition: action.cursorPosition
	})
}

/**
 * Commit the current editor and optionally navigate
 */
async function executeCommitEdit(
	ctx: ExecutorContext,
	commitEmptyRow?: boolean,
	target?: { rowIndex: number; colIndex: number },
	focusEmptyRowColIndex?: number
): Promise<void> {
	const editingCell = ctx.engine.editingCell

	// Use target coordinates if provided (for 'always' edit mode), otherwise use editingCell
	let rowIndex: number
	let colIndex: number
	let field: string

	if (target) {
		// 'always' edit mode - coordinates provided directly
		rowIndex = target.rowIndex
		colIndex = target.colIndex
		const column = ctx.engine.columns[colIndex]
		if (!column) return
		field = String(column.field)
	} else if (editingCell) {
		// Normal edit mode - use tracked editingCell
		rowIndex = editingCell.rowIndex
		field = editingCell.field
		colIndex = ctx.engine.columns.findIndex(c => String(c.field) === field)
		if (colIndex < 0) return
	} else {
		// No target and no editingCell - nothing to commit
		return
	}

	// Find the editor element
	const cell = ctx.shadow.querySelector(
		`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
	) as HTMLElement
	if (!cell) return

	// First try specific focusable inputs (combobox/autocomplete/date have wrapper divs)
	// Then fall back to .wg__editor (for text/number inputs where the input IS the .wg__editor)
	let editor = cell.querySelector(
		'.wg__combobox-input, .wg__autocomplete-input, .wg__date-input, .wg__select-trigger'
	) as HTMLInputElement | HTMLSelectElement
	if (!editor) {
		editor = cell.querySelector('.wg__editor') as HTMLInputElement | HTMLSelectElement
	}
	if (!editor) return

	// A select changes only on a pick (option click / Enter / Tab after arrowing): leaving its
	// cell otherwise changes nothing and ends as a cancel (`cell-edit-cancel`), like every
	// other no-pick close. An empty-row commit still goes through (it may add the row).
	if (!target && !commitEmptyRow && editor.classList.contains('wg__select-trigger')) {
		executeCancelEdit(ctx)
		return
	}

	// Get the value based on editor type
	let value: unknown
	const column = ctx.engine.columns[colIndex]
	if (editor.matches('.wg__combobox-input, .wg__autocomplete-input')) {
		// The typed text → the matching option's VALUE (else the raw text, free-form)
		value = resolveComboboxValue(ctx, editor as HTMLInputElement, column?.editorOptions || {})
	} else if (editor instanceof HTMLInputElement) {
		if (editor.type === 'checkbox') {
			// For checkbox, read from draft row to preserve custom trueValue/falseValue
			// The draft row is already updated by toggleCheckbox action
			const item = ctx.engine.displayItems[rowIndex]
			value = ctx.engine.getCellRawValue(item, rowIndex, field)
		} else if (editor.classList.contains('wg__date-input')) {
			// Date editor - use the stored date value
			value = editor.dataset.dateValue || editor.value
		} else if (editor.classList.contains('wg__editor--number')) {
			// Number editor - the text is parsed (strictly) and checked by engine.commitEdit
			value = editor.value
		} else {
			value = editor.value
		}
	} else if (editor instanceof HTMLSelectElement) {
		value = editor.value
	} else {
		// Select trigger - get from data attribute
		value = (editor as HTMLElement).dataset.value || ''
	}

	// Close dropdown if open
	if (ctx.dropdown.isOpen) {
		removeDropdown(ctx)
	}

	// Clear visual state
	clearEditingVisual(ctx)

	// Commit the edit and await it (may be async with validation callbacks)
	await ctx.engine.commitEdit(rowIndex, field, value, commitEmptyRow)

	// Re-render the cell (now has correct value with getDisplayValueCallback applied)
	renderCell(ctx, rowIndex, colIndex)

	if (focusEmptyRowColIndex !== undefined) {
		// An empty-row commit re-renders the grid, and the render restores focus to
		// the pre-render cell on a timeout — focus the fresh empty row after that,
		// so the next row can be typed straight away.
		setTimeout(() => {
			const engine = ctx.engine
			const emptyRowIndex = engine.newRowPosition === 'top' ? 0 : engine.displayItems.length - 1
			if (engine.isEmptyRowIndex(emptyRowIndex)) {
				moveFocus(ctx, emptyRowIndex, focusEmptyRowColIndex)
			}
		}, 0)
	}
}

/**
 * Cancel editing and discard changes
 */
function executeCancelEdit(ctx: ExecutorContext): void {
	const editingCell = ctx.engine.editingCell
	if (!editingCell) return

	const { rowIndex, field } = editingCell
	const colIndex = ctx.engine.columns.findIndex(c => String(c.field) === field)
	const column = ctx.engine.columns[colIndex]

	// Close dropdown if open
	if (ctx.dropdown.isOpen) {
		removeDropdown(ctx)
	}

	// Clear visual state
	clearEditingVisual(ctx)

	// For checkbox editor, discard the cell draft since toggle updates it during edit
	// This restores the original value when user presses Escape
	if (column?.editor === 'checkbox') {
		ctx.engine.discardCellDraft(rowIndex, field)
	}

	// Cancel the edit
	ctx.engine.cancelEdit()

	// Re-render the cell if we have valid coordinates
	if (colIndex >= 0) {
		renderCell(ctx, rowIndex, colIndex)
	}
}

/**
 * Handle Escape key - behavior depends on search text state
 * Phase 'dropdown': If search text exists, clear it and keep dropdown open; otherwise close and exit
 * Phase 'edit': Cancel edit entirely and return to display mode
 */
function executeEscapeEdit(ctx: ExecutorContext, action: EscapeEditAction): GridAction[] | void {
	const editingCell = ctx.engine.editingCell
	const focusedCell = ctx.engine.focusedCell

	if (action.phase === 'dropdown') {
		// Get cell info and editor type
		const cellInfo = editingCell || focusedCell
		if (!cellInfo) return

		const colIndex = editingCell
			? ctx.engine.columns.findIndex(c => String(c.field) === editingCell.field)
			: focusedCell?.colIndex ?? -1
		const column = ctx.engine.columns[colIndex]
		const editorType = column?.editor

		// For select: check if there's filter text (type-to-filter)
		if (editorType === 'select' && ctx.dropdown.filterText) {
			ctx.dropdown.setFilterText('')
			// Refresh dropdown by closing and reopening (shows all options)
			removeDropdown(ctx)
			ctx.dispatch({ type: 'openDropdown' })
			return // Stay in edit mode with dropdown open
		}

		// For autocomplete/combobox: check if input has search text (different from original)
		if (editorType === 'autocomplete' || editorType === 'combobox') {
			const cell = ctx.shadow.querySelector(
				`.wg__cell[data-row="${cellInfo.rowIndex}"][data-col="${colIndex}"]`
			) as HTMLElement
			const input = cell?.querySelector('.wg__combobox-input, .wg__autocomplete-input') as HTMLInputElement

			// Get original display value (using displayMember lookup)
			const row = ctx.engine.displayItems[cellInfo.rowIndex]
			const field = column?.field
			const rawValue = row && field ? (row as Record<string, unknown>)[field as string] : undefined
			const opts = column?.editorOptions || {}
			const options = opts.initialOptions || opts.options || []
			const originalDisplayValue = getOptionDisplayValue(rawValue, options, opts)
			const currentValue = input?.value ?? ''

			// If input has been modified (different from original display), restore and refresh dropdown
			if (input && currentValue !== originalDisplayValue) {
				ctx.dropdown.setFilterText('')
				input.value = originalDisplayValue  // Restore original display value
				input.focus()
				input.select()  // Select all so user can easily retype
				// Refresh dropdown by closing and reopening (shows all options with empty filter)
				removeDropdown(ctx)
				ctx.dispatch({ type: 'openDropdown' })
				return // Stay in edit mode with dropdown open
			}
		}

		// No search text OR select editor: close dropdown AND exit edit mode
		removeDropdown(ctx)
		if (editingCell) {
			clearEditingVisual(ctx)
			// For checkbox editor, discard the cell draft
			if (editorType === 'checkbox') {
				ctx.engine.discardCellDraft(cellInfo.rowIndex, editingCell.field)
			}
			ctx.engine.cancelEdit()
			renderCell(ctx, cellInfo.rowIndex, colIndex)
			focusCellElement(ctx, cellInfo.rowIndex, colIndex)
		}
		return
	}

	// Phase 2: Cancel edit entirely
	if (editingCell) {
		const { rowIndex, field } = editingCell
		const colIndex = ctx.engine.columns.findIndex(c => String(c.field) === field)
		const column = ctx.engine.columns[colIndex]

		// Close dropdown/datepicker if open
		if (ctx.dropdown.isOpen) {
			removeDropdown(ctx)
		}
		if (ctx.datepicker) {
			ctx.datepicker.close()
			ctx.datepicker = null
		}

		// Clear visual state
		clearEditingVisual(ctx)

		// For checkbox editor, discard the cell draft since toggle updates it during edit
		// This restores the original value when user presses Escape
		if (column?.editor === 'checkbox') {
			ctx.engine.discardCellDraft(rowIndex, field)
		}

		// Cancel the edit
		ctx.engine.cancelEdit()

		// Re-render the cell and focus it
		if (colIndex >= 0) {
			renderCell(ctx, rowIndex, colIndex)
			focusCellElement(ctx, rowIndex, colIndex)
		}
	} else if (focusedCell) {
		// No active edit, just clear focus
		const { rowIndex, colIndex } = focusedCell
		ctx.engine.clearFocusedCell()
		renderCell(ctx, rowIndex, colIndex)
	}
}

/**
 * Delete/clear cell content
 */
function executeDeleteCell(ctx: ExecutorContext, action: DeleteCellAction): void {
	// Get target cell - use action target or focused cell
	const target = action.target || ctx.engine.focusedCell
	if (!target) return

	const { rowIndex, colIndex } = target
	const column = ctx.engine.columns[colIndex]
	if (!column) return

	const row = ctx.engine.displayItems[rowIndex]

	// Check if cell is editable
	if (!ctx.engine.isCellEditable(column, row)) return

	const field = String(column.field)

	// Clear the cell value
	ctx.engine.commitEdit(rowIndex, field, null)

	// Re-render the cell
	renderCell(ctx, rowIndex, colIndex)
}

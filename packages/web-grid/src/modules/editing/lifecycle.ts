// =============================================================================
// Editing Lifecycle Module
// Commit, blur handling, focus after commit/cancel
// =============================================================================

import type { GridHost } from '../grid-context.js'
import type { DateOutputFormat } from '../../types.js'
import { moveFocus, tryStartEdit } from '../navigation/index.js'
import { renderCell } from '../rendering/index.js'

/**
 * Convert date input value (YYYY-MM-DD) to the specified output format
 */
function convertDateValue(dateString: string, outputFormat: string): Date | string | number | null {
	if (!dateString) return null

	// Parse YYYY-MM-DD format (use local date to avoid timezone shifts)
	const [year, month, day] = dateString.split('-').map(Number)
	const date = new Date(year, month - 1, day)
	if (isNaN(date.getTime())) return null

	switch (outputFormat as DateOutputFormat) {
		case 'date':
			return date
		case 'timestamp':
			return date.getTime()
		case 'iso':
		default:
			// Return just the date part (YYYY-MM-DD) for cleaner display
			return dateString
	}
}

/**
 * Surgically restore a cell from editing mode to display mode.
 * Uses centralized renderCell() to ensure all states are correct.
 */
export function restoreCellToDisplayMode<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	colIndex: number
): void {
	renderCell(ctx, rowIndex, colIndex)
}

/**
 * Commit the value from the current editor
 * @param commitEmptyRow - If true and editing empty row, add it to items (Enter key behavior)
 */
export async function commitCurrentEditor<T>(
	ctx: GridHost<T>,
	editor: HTMLElement,
	commitEmptyRow: boolean = false
): Promise<void> {
	const rowIndex = parseInt(editor.dataset.row || '0', 10)
	const field = editor.dataset.field || ''

	let value: unknown
	if (editor instanceof HTMLInputElement) {
		if (editor.type === 'checkbox') {
			const trueValue = JSON.parse(editor.dataset.trueValue || 'true')
			const falseValue = JSON.parse(editor.dataset.falseValue || 'false')
			value = editor.checked ? trueValue : falseValue
		} else if (editor.classList.contains('wg__editor--number')) {
			// Number editor uses type="text" with inputmode="numeric" for cursor control
			value = editor.value === '' ? null : parseFloat(editor.value)
		} else if (editor.type === 'date') {
			value = convertDateValue(editor.value, editor.dataset.outputFormat || 'iso')
		} else {
			value = editor.value
		}
	} else if (editor instanceof HTMLSelectElement) {
		value = editor.value
	}

	await ctx.engine.commitEdit(rowIndex, field, value, commitEmptyRow)
}

/**
 * Handle checkbox change (commits immediately)
 */
export function handleCheckboxChange<T>(
	ctx: GridHost<T>,
	checkbox: HTMLInputElement
): void {
	commitCurrentEditor(ctx, checkbox)
}

/**
 * Toggle checkbox value and move to next row (for Space key in Focused state)
 */
export function toggleCheckboxAndMove<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	colIndex: number
): void {
	const column = ctx.engine.columns[colIndex]
	if (!column) return

	const field = String(column.field)
	const item = ctx.engine.displayItems[rowIndex]
	if (!item) return

	const opts = column.editorOptions || {}
	const trueValue = opts.trueValue ?? true
	const falseValue = opts.falseValue ?? false
	const currentValue = (item as Record<string, unknown>)[field]
	const newValue = currentValue === trueValue ? falseValue : trueValue

	// Commit the toggle
	ctx.engine.commitEdit(rowIndex, field, newValue)

	// Re-render the cell to show new checkbox state
	renderCell(ctx, rowIndex, colIndex)

	// Move to next row
	const displayItems = ctx.engine.displayItems
	if (rowIndex < displayItems.length - 1) {
		requestAnimationFrame(() => {
			moveFocus(ctx, rowIndex + 1, colIndex)
		})
	}
}

/**
 * Handle editor blur (commit for text/number inputs)
 */
export async function handleEditorBlur<T>(
	ctx: GridHost<T>,
	input: HTMLInputElement
): Promise<void> {
	// Skip if keyboard already handled the commit
	if (ctx.isCommittingFromKeyboard) {
		return
	}
	// Only commit if we're still in edit mode (not already cancelled)
	if (ctx.engine.editingCell) {
		// Get row/col before committing (editingCell will be cleared)
		const rowIndex = parseInt(input.dataset.row || '0', 10)
		const field = input.dataset.field || ''
		const colIndex = ctx.engine.columns.findIndex(c => String(c.field) === field)

		await commitCurrentEditor(ctx, input)

		// Restore cell to display mode with formatted value
		if (colIndex >= 0) {
			restoreCellToDisplayMode(ctx, rowIndex, colIndex)
		}
	}
}

/**
 * Move focus after committing an edit
 */
export function moveFocusAfterCommit<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	field: string,
	direction: 'down' | 'up' | 'next' | 'prev'
): void {
	const columns = ctx.engine.columns
	const colIndex = columns.findIndex(c => String(c.field) === field)
	const displayItems = ctx.engine.displayItems

	let targetRow = rowIndex
	let targetCol = colIndex

	if (direction === 'down') {
		// Excel-like: Enter after Tab returns to the column where Tab started
		const tabStartCol = ctx.engine.tabTraversalStartColIndex
		if (tabStartCol !== null) {
			targetCol = tabStartCol
			ctx.engine.tabTraversalStartColIndex = null
		}
		targetRow = Math.min(rowIndex + 1, displayItems.length - 1)
	} else if (direction === 'up') {
		// Move to same column, previous row
		targetRow = Math.max(rowIndex - 1, 0)
	} else {
		// Track tab traversal start for Excel-like Enter behavior
		if (ctx.engine.tabTraversalStartColIndex === null) {
			ctx.engine.tabTraversalStartColIndex = colIndex
		}
		// Use existing Tab navigation logic — recomputed per row so heterogeneous trees
		// (some rows entirely read-only) skip those rows correctly.
		const currentRowForLifecycle = displayItems[rowIndex]
		const editableCols = ctx.engine.getEditableColumns(currentRowForLifecycle)
		const currentEditableIndex = editableCols.findIndex(ec => ec.index === colIndex)

		const walkDir: 'forward' | 'backward' = direction === 'next' ? 'forward' : 'backward'
		const fromIdx = currentEditableIndex === -1
			? (walkDir === 'forward' ? -1 : editableCols.length)
			: currentEditableIndex
		const next = ctx.engine.findNextEditableCell(rowIndex, fromIdx, walkDir)
		if (next) {
			targetRow = next.rowIndex
			targetCol = next.colIndex
		}
	}

	// Surgical update: restore current cell to display mode
	restoreCellToDisplayMode(ctx, rowIndex, colIndex)

	// Move focus to target cell
	moveFocus(ctx, targetRow, targetCol)

	// In non-navigate edit modes (dblclick/click/button), auto-open the editor on the
	// next editable cell after Tab/Shift-Tab. Without this, focus lands on a <td> with
	// no editor and the spreadsheet pattern breaks. Defer one frame so the previous
	// editor unmounts before the next mounts (avoids autofocus race).
	const isNextOrPrev = direction === 'next' || direction === 'prev'
	const movedCells = targetRow !== rowIndex || targetCol !== colIndex
	if (isNextOrPrev && movedCells) {
		const targetColumn = ctx.engine.columns[targetCol]
		const effectiveTrigger = targetColumn?.editTrigger ?? ctx.engine.editTrigger
		if (effectiveTrigger === 'dblclick' || effectiveTrigger === 'click' || effectiveTrigger === 'button') {
			requestAnimationFrame(() => {
				if (ctx.engine.canEditCell(targetRow, String(targetColumn.field))) {
					tryStartEdit(ctx, targetRow, targetCol)
				}
				ctx.isCommittingFromKeyboard = false
			})
			return
		}
	}

	ctx.isCommittingFromKeyboard = false
}

/**
 * Focus cell after cancelling edit
 */
export function focusCellAfterCancel<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	field: string
): void {
	const columns = ctx.engine.columns
	const colIndex = columns.findIndex(c => String(c.field) === field)
	if (colIndex >= 0) {
		// Surgical update: restore cell to display mode
		restoreCellToDisplayMode(ctx, rowIndex, colIndex)

		// Focus the cell
		moveFocus(ctx, rowIndex, colIndex)
		ctx.isCommittingFromKeyboard = false
	}
}

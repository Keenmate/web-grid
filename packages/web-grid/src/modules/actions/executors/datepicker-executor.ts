// =============================================================================
// DatePicker Executor
// Handles openDatePicker and closeDatePicker actions
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction } from '../types.js'
import { DatePicker } from '../../datepicker/datepicker.js'
import { toISODateString } from '../../datepicker/formatting.js'
import { renderCell } from '../../rendering/index.js'
import { clearEditingVisual } from '../../navigation/focus.js'

/**
 * DatePicker executor - handles date picker open/close actions
 */
export const datepickerExecutor: ActionExecutor = {
	handles: ['openDatePicker', 'closeDatePicker', 'toggleDatePicker'],

	execute(ctx: ExecutorContext, action: GridAction): GridAction[] | void {
		switch (action.type) {
			case 'openDatePicker':
				executeOpenDatePicker(ctx)
				break
			case 'closeDatePicker':
				executeCloseDatePicker(ctx)
				break
			case 'toggleDatePicker':
				executeToggleDatePicker(ctx)
				break
		}
	}
}

/**
 * Open date picker for the currently focused cell
 */
function executeOpenDatePicker(ctx: ExecutorContext): void {
	// Get current cell - use focusedCell for 'always' mode
	const focusedCell = ctx.grid.focusedCell
	if (!focusedCell) return

	const { rowIndex, colIndex } = focusedCell
	const column = ctx.grid.columns[colIndex]
	if (!column || column.editor !== 'date') return

	// Find the date editor elements in the DOM
	const field = String(column.field)
	const cell = ctx.shadow.querySelector(
		`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
	) as HTMLElement
	if (!cell) return

	const editorContainer = cell.querySelector('.wg__editor--date') as HTMLElement
	const input = cell.querySelector('.wg__date-input') as HTMLInputElement
	if (!editorContainer || !input) return

	// Close any existing datepicker
	if (ctx.datepicker) {
		ctx.datepicker.close(true)
		ctx.datepicker = null
	}

	// Get date configuration from input data attributes
	const dateFormat = input.dataset.dateFormat || 'YYYY-MM-DD'
	const minDateStr = input.dataset.minDate
	const maxDateStr = input.dataset.maxDate
	const currentValue = input.dataset.dateValue || ''

	// Capture stable values for callbacks (don't capture DOM refs — they go stale on re-render)
	const capturedRowIndex = rowIndex
	const capturedColIndex = colIndex
	const capturedField = field

	// Create and open the date picker
	ctx.datepicker = new DatePicker({
		dateFormat,
		minDate: minDateStr || undefined,
		maxDate: maxDateStr || undefined,
		onSelect: (date, direction) => {
			handleDateSelect(ctx, capturedRowIndex, capturedColIndex, capturedField, date, direction)
		},
		onClose: () => {
			handleDatePickerClose(ctx, capturedRowIndex, capturedColIndex)
		}
	})

	ctx.datepicker.open(editorContainer, currentValue || null)
}

/**
 * Handle date selection from the picker.
 * Uses captured rowIndex/colIndex/field instead of DOM refs (which go stale on re-render).
 */
function handleDateSelect(
	ctx: ExecutorContext,
	rowIndex: number,
	colIndex: number,
	field: string,
	date: Date,
	direction?: 'down' | 'next'
): void {
	// Clear datepicker reference
	ctx.datepicker = null

	// Convert to the format the column expects. Default 'iso' matches the
	// legacy commitDateEditor behavior.
	const column = ctx.grid.columns[colIndex]
	const outputFormat = column?.editorOptions?.outputFormat ?? 'iso'
	let value: unknown
	switch (outputFormat) {
		case 'date':
			value = date
			break
		case 'timestamp':
			value = date.getTime()
			break
		case 'iso':
		default:
			value = toISODateString(date)
			break
	}

	// Commit the date value (clears editingCell state)
	ctx.grid.commitEdit(rowIndex, field, value)

	// Re-render cell in display mode with the committed value
	renderCell(ctx, rowIndex, colIndex)

	// Focus the cell so user doesn't lose keyboard position
	const cell = ctx.shadow.querySelector(
		`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
	) as HTMLElement
	if (cell) {
		cell.focus()
	}

	// Navigate based on direction (Enter goes down, Tab goes next)
	if (direction === 'down') {
		ctx.dispatch({ type: 'navigate', direction: 'down' })
	} else if (direction === 'next') {
		ctx.dispatch({ type: 'navigate', direction: 'tab' })
	}
}

/**
 * Handle date picker close (without selection)
 */
function handleDatePickerClose(ctx: ExecutorContext, rowIndex: number, colIndex: number): void {
	ctx.datepicker = null

	// For 'always' mode, just re-render the cell to restore focus
	const column = ctx.grid.columns[colIndex]
	if (!column) return

	const effectiveTrigger = column.editTrigger ?? ctx.grid.editTrigger
	if (effectiveTrigger === 'always') {
		// Just re-render to clean up any visual state
		renderCell(ctx, rowIndex, colIndex)
	} else {
		// For other modes, cancel the edit
		clearEditingVisual(ctx)
		ctx.grid.cancelEdit()
		renderCell(ctx, rowIndex, colIndex)

		// Focus the cell after cancelling edit (so user doesn't lose focus)
		const cell = ctx.shadow.querySelector(
			`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
		) as HTMLElement
		if (cell) {
			cell.focus()
		}
	}
}

/**
 * Close the date picker
 */
function executeCloseDatePicker(ctx: ExecutorContext): void {
	if (ctx.datepicker) {
		ctx.datepicker.close(true)
		ctx.datepicker = null
	}
}

/**
 * Toggle date picker - close if open, open if closed
 */
function executeToggleDatePicker(ctx: ExecutorContext): void {
	if (ctx.datepicker) {
		// Datepicker is open - close it (non-silent so onClose callback runs)
		ctx.datepicker.close(false)
		// Note: onClose callback sets ctx.datepicker = null and cleans up edit state
	} else {
		// Datepicker is closed - open it
		executeOpenDatePicker(ctx)
	}
}

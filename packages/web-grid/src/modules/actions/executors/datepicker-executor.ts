// =============================================================================
// DatePicker Executor
// Handles openDatePicker and closeDatePicker actions
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction } from '../types.js'
import { openCellDatePicker, typedDateError } from '../../datepicker/element-handlers.js'
import { toISODateString } from '../../datepicker/formatting.js'
import { renderCell } from '../../rendering/index.js'

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
	const focusedCell = ctx.engine.focusedCell
	if (!focusedCell) return

	const { rowIndex, colIndex } = focusedCell
	const column = ctx.engine.columns[colIndex]
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

	// Capture stable values for callbacks (don't capture DOM refs — they go stale on re-render)
	openCellDatePicker(ctx, input, editorContainer, rowIndex, colIndex, (date, direction, at) => {
		handleDateSelect(ctx, rowIndex, colIndex, field, date, direction, at)
	})
}

/**
 * Handle date selection from the picker.
 * Uses captured rowIndex/colIndex/field instead of DOM refs (which go stale on re-render);
 * `input` (the current cell input) is read only for `date` null: Enter / Tab on typed text
 * that is not a date — that text is committed as is, invalid (like a paste).
 */
function handleDateSelect(
	ctx: ExecutorContext,
	rowIndex: number,
	colIndex: number,
	field: string,
	date: Date | null,
	direction: 'down' | 'next' | 'prev' | undefined,
	input: HTMLInputElement
): void {
	// Clear datepicker reference
	ctx.datepicker = null

	// Convert to the format the column expects. Default 'iso' matches the
	// legacy commitDateEditor behavior.
	const column = ctx.engine.columns[colIndex]
	const outputFormat = column?.editorOptions?.outputFormat ?? 'iso'
	const parseError = date ? null : typedDateError(ctx, input) ?? ctx.engine.labels.invalidDate
	let value: unknown = input.value
	if (date) {
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
	}

	// Commit the date value (clears editingCell state)
	ctx.engine.commitEdit(rowIndex, field, value, false, 'edit', parseError)

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
	} else if (direction === 'prev') {
		ctx.dispatch({ type: 'navigate', direction: 'tab-back' })
	}
}

/**
 * Close the date picker
 */
function executeCloseDatePicker(ctx: ExecutorContext): void {
	if (ctx.datepicker) {
		ctx.datepicker.close()
		ctx.datepicker = null
	}
}

/**
 * Toggle date picker - close if open, open if closed
 */
function executeToggleDatePicker(ctx: ExecutorContext): void {
	if (ctx.datepicker) {
		// Datepicker is open - dismiss it (the close handler cancels the edit, like Escape)
		ctx.datepicker.dismiss()
	} else {
		// Datepicker is closed - open it
		executeOpenDatePicker(ctx)
	}
}

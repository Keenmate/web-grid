// =============================================================================
// Datepicker element-handlers
// =============================================================================
// Extracted from GridElement. Owns the four glue functions that bridge the
// date editor (cell input + format metadata) and the DatePicker instance:
//
//   - openDatePicker         — instantiate + open the picker with the right
//                              format, min/max, and select/close callbacks.
//   - handleDatePickerSelect — apply the user's pick to the input, commit,
//                              move focus.
//   - commitDateEditor       — convert the input's typed value into the
//                              configured output format (ISO / Date / timestamp)
//                              and write it through grid.commitEdit.
//   - parseDateInput         — parse the format-shaped input value back to a
//                              Date (helper, no DOM access).

import type { GridHost } from '../grid-context.js'
import { clearEditingVisual, restoreEditingCellToDisplayMode } from '../navigation/focus.js'
import { DatePicker } from './datepicker.js'
import { parseFormat, formatDate, toISODateString } from './formatting.js'

/**
 * Create + open the date picker for the given input. The picker reads its
 * config from the input's `data-*` attributes (`dateFormat`, `minDate`,
 * `maxDate`, current `dateValue`) and registers select/close callbacks that
 * commit + restore visual state respectively.
 */
export function openDatePicker<T>(
	ctx: GridHost<T>,
	input: HTMLInputElement,
	anchor: HTMLElement
): void {
	// Close any existing datepicker silently (don't trigger onClose - we're opening a new one)
	if (ctx.datepicker) {
		ctx.datepicker.close(true)
		ctx.datepicker = null
	}

	const dateFormat = input.dataset.dateFormat || 'YYYY-MM-DD'
	const minDateStr = input.dataset.minDate
	const maxDateStr = input.dataset.maxDate

	// Parse current value
	const currentValue = input.dataset.dateValue || ''

	ctx.datepicker = new DatePicker({
		dateFormat,
		minDate: minDateStr || undefined,
		maxDate: maxDateStr || undefined,
		onSelect: (date, direction) => {
			handleDatePickerSelect(ctx, input, date, direction)
		},
		onClose: () => {
			// Capture editing cell info BEFORE canceling (cancelEdit clears it)
			const editingCell = ctx.engine.editingCell
			const colIndex = editingCell
				? ctx.engine.columns.findIndex(c => String(c.field) === editingCell.field)
				: -1
			const rowIndex = editingCell?.rowIndex ?? -1

			ctx.datepicker = null
			// Cancel edit mode (Escape or click outside without selecting)
			clearEditingVisual(ctx)
			ctx.engine.cancelEdit()

			// Re-render the cell to restore display mode content
			if (rowIndex >= 0 && colIndex >= 0) {
				restoreEditingCellToDisplayMode(ctx, rowIndex, colIndex)

				// Focus the cell after cancelling edit (so user doesn't lose focus)
				const cell = ctx.shadow.querySelector(
					`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
				) as HTMLElement
				if (cell) {
					cell.focus()
				}
			}
		}
	})

	ctx.datepicker.open(anchor, currentValue || null)
}

/**
 * Apply the user's date pick: write the formatted value back into the input,
 * commit the edit (`commitEmptyRow` for Enter, not for Tab), then move focus.
 */
export function handleDatePickerSelect<T>(
	ctx: GridHost<T>,
	input: HTMLInputElement,
	date: Date,
	direction?: 'down' | 'next'
): void {
	const dateFormat = input.dataset.dateFormat || 'YYYY-MM-DD'
	const formatInfo = parseFormat(dateFormat)

	// Update input value with formatted date
	input.value = formatDate(date, formatInfo)
	input.dataset.dateValue = toISODateString(date)

	// Clear datepicker reference (picker closes silently via close(true), skipping onClose)
	ctx.datepicker = null

	// Commit the date (Enter commits empty row, Tab doesn't)
	ctx.isCommittingFromKeyboard = true
	const commitEmptyRow = direction === 'down' || direction === undefined
	commitDateEditor(ctx, input, commitEmptyRow)

	// Move focus after commit (direction from keyboard: Enter=down, Tab=next)
	const rowIndex = parseInt(input.dataset.row || '0', 10)
	const field = input.dataset.field || ''
	ctx.moveFocusAfterCommit(rowIndex, field, direction || 'down')
}

/**
 * Convert the input's typed value into the configured output format (ISO
 * string / Date / timestamp) and write it through grid.commitEdit.
 *
 * @param commitEmptyRow - If true and editing empty row, add it to items
 *                        (Enter-key behavior).
 */
export async function commitDateEditor<T>(
	ctx: GridHost<T>,
	input: HTMLInputElement,
	commitEmptyRow: boolean = false
): Promise<void> {
	if (!ctx.engine.editingCell) return

	const rowIndex = parseInt(input.dataset.row || '0', 10)
	const field = input.dataset.field || ''
	const outputFormat = input.dataset.outputFormat || 'iso'
	const dateFormat = input.dataset.dateFormat || 'YYYY-MM-DD'
	const formatInfo = parseFormat(dateFormat)

	// Parse the input value using the format
	const dateValue = input.value ? parseDateInput(input.value, formatInfo) : null

	// Convert to output format
	let value: unknown = null
	if (dateValue) {
		switch (outputFormat) {
			case 'date':
				value = dateValue
				break
			case 'timestamp':
				value = dateValue.getTime()
				break
			case 'iso':
			default:
				value = toISODateString(dateValue)
				break
		}
	}

	await ctx.engine.commitEdit(rowIndex, field, value, commitEmptyRow)
}

/**
 * Parse a format-shaped input string (separator + year/month/day segments)
 * back to a Date. Returns null when the input is empty, missing parts, or
 * doesn't round-trip through the JS Date constructor (overflow check).
 */
export function parseDateInput(
	value: string,
	formatInfo: { separator: string; parts: { year?: { index: number }; month?: { index: number }; day?: { index: number } } }
): Date | null {
	if (!value) return null

	const segments = value.split(formatInfo.separator)
	let year: number | null = null
	let month: number | null = null
	let day: number | null = null

	segments.forEach((segment, index) => {
		if (!segment) return
		const numValue = parseInt(segment, 10)

		if (formatInfo.parts.year?.index === index) {
			year = numValue < 100 ? numValue + 2000 : numValue
		} else if (formatInfo.parts.month?.index === index) {
			month = numValue
		} else if (formatInfo.parts.day?.index === index) {
			day = numValue
		}
	})

	if (year === null || month === null || day === null) return null

	const date = new Date(year, month - 1, day)
	if (date.getMonth() !== month - 1 || date.getDate() !== day) return null

	return date
}

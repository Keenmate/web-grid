// =============================================================================
// Datepicker element-handlers
// =============================================================================
// Extracted from GridElement. Owns the four glue functions that bridge the
// date editor (cell input + format metadata) and the DatePicker instance:
//
//   - openCellDatePicker     — instantiate + open the picker for a cell's date
//                              input (format, min/max, scroll / overlay-tree
//                              options) with the ONE close handler,
//                              onDatePickerClose(). Both openers use it.
//   - openDatePicker         — the mousedown opener (trigger button): commits a
//                              pick via handleDatePickerSelect.
//   - handleDatePickerSelect — apply the user's pick to the input, commit,
//                              move focus.
//   - commitDateEditor       — convert the input's typed value into the
//                              configured output format (ISO / Date / timestamp)
//                              and write it through grid.commitEdit.
//   - parseDateInput         — re-exported from formatting.ts (pure helper).

import type { GridHost } from '../grid-context.js'
import { clearEditingVisual, returnFocusToCell } from '../navigation/focus.js'
import { commitEditorValue } from '../editing/commit-on-transition.js'
import { renderCell } from '../rendering/cell.js'
import { DatePicker, isTypedDateInvalid, setTypedDateInvalid } from './datepicker.js'
import type { DatePickerCloseReason } from './types.js'
import { parseFormat, formatDate, toISODateString, parseDateInput } from './formatting.js'

export { parseDateInput }

/**
 * What a pick does: save `date` from the cell's date `input`, then move per `direction`. `null`:
 * Enter / Tab on typed text that is not a date — save that text as invalid (like a paste), then move.
 */
type DatePickerSelect = (date: Date | null, direction: 'down' | 'next' | 'prev' | undefined, input: HTMLInputElement) => void

/** The cell a date picker opened on, captured at open (the grid may have moved on by the close). */
type PickerCell = {
	rowIndex: number
	colIndex: number
	field: string
	isAlwaysMode: boolean
	/** The cell's date input at open (a re-render replaces it; the old one keeps the typed text). */
	input: HTMLInputElement
	onSelect: DatePickerSelect
}

/**
 * The one close handler of the date picker. Each close path is wired ONCE: either the grid drives
 * it (and closes the picker itself → `'api'`) or core's popover does (its reason below). Excel
 * model: leaving a cell any way but Escape SAVES; Escape cancels; focus stays on / returns to the cell.
 *
 * | reason                 | close path                                               | result                                   |
 * |------------------------|----------------------------------------------------------|------------------------------------------|
 * | 'api'                  | the grid closed it: a day pick / Enter / Tab / Shift+Tab | nothing: the caller already saved /      |
 * |                        | (onSelect saved), the edit ended any other way (another  | cancelled                                |
 * |                        | cell, outside the grid, startEditing(), Tab elsewhere),  |                                          |
 * |                        | a new picker opening, grid disconnected / destroyed      |                                          |
 * | 'escape' / 'dismiss'   | Escape; the trigger toggled it / Tab with no focused day | CANCEL the edit, focus to the cell       |
 * | 'scroll'               | the page or the grid body scrolled and the cell moved    | CANCEL the edit, focus to the cell (the  |
 * |                        | (veto: a cell transition, the grid detached)             | grid when its row is no longer rendered) |
 * | 'outside-click'        | a click in the grid but outside the picker and the cell  | SAVE the edit (commitEditorValue)        |
 * |                        | editor (header, toolbar, empty area) — a click outside   |                                          |
 * |                        | the grid is the grid's outside-click (it saves; 'api')   |                                          |
 * | 'overlay' / 'parent'   | another overlay of the group opened (or                  | SAVE the edit, focus back to the cell if |
 * |                        | dismissAllOverlays()), the overlay the grid lives in     | it was in the editor                     |
 * |                        | closed                                                   |                                          |
 * | 'reference-removed'    | the cell re-rendered while open (items replaced)         | REOPEN on the re-rendered cell (typed    |
 * |                        |                                                          | text kept); the row gone → nothing       |
 * | 'resize'               | off (`shouldCloseOnResize: false`; stays open, placed)   | —                                        |
 *
 * Only the edit the picker opened with is saved / cancelled (the grid may have moved on).
 * 'always' edit mode has no edit session: any close but 'api' / 'reference-removed' re-renders the cell.
 */
function onDatePickerClose<T>(ctx: GridHost<T>, picker: DatePicker, reason: DatePickerCloseReason, at: PickerCell): void {
	if (ctx.datepicker === picker) ctx.datepicker = null
	if (reason === 'reference-removed') {
		reopenOnRerenderedCell(ctx, at)
		return
	}
	if (reason === 'api' || reason === 'resize') return
	if (at.isAlwaysMode) {
		renderCell(ctx, at.rowIndex, at.colIndex)
		return
	}
	const editing = ctx.engine.editingCell
	if (!editing || editing.rowIndex !== at.rowIndex || editing.field !== at.field) return
	const cell = ctx.shadow.querySelector(`td[data-row="${at.rowIndex}"][data-col="${at.colIndex}"]`)
	const active = ctx.shadow.activeElement
	const hadFocus = !!active && !!cell?.contains(active)
	const isCancel = reason === 'escape' || reason === 'dismiss' || reason === 'scroll'
	clearEditingVisual(ctx)
	if (isCancel) ctx.engine.cancelEdit()
	else commitEditorValue(ctx)
	// Re-render the cell to restore display mode content
	renderCell(ctx, at.rowIndex, at.colIndex)
	// Keyboard focus stays with the cell (the grid when its row is no longer rendered)
	if (isCancel || ((reason === 'overlay' || reason === 'parent') && hadFocus)) {
		returnFocusToCell(ctx, at.rowIndex, at.colIndex)
	}
}

/**
 * The edited cell was re-rendered while its picker was open (`items` replaced): the edit goes on,
 * so the picker reopens on the new cell's editor with the text typed so far (and the date it
 * stands for), the caret where it was. Nothing when the edit ended or its row is no longer
 * rendered (the row is gone: no editor to reopen on).
 */
function reopenOnRerenderedCell<T>(ctx: GridHost<T>, at: PickerCell): void {
	if (!at.isAlwaysMode) {
		const editing = ctx.engine.editingCell
		if (!editing || editing.rowIndex !== at.rowIndex || editing.field !== at.field) return
	}
	const cell = ctx.shadow.querySelector(`td[data-row="${at.rowIndex}"][data-col="${at.colIndex}"]`)
	const input = cell?.querySelector('.wg__date-input') as HTMLInputElement | null
	const anchor = cell?.querySelector('.wg__editor--date') as HTMLElement | null
	if (!input || !anchor) return
	const old = at.input
	if (input !== old) {
		input.value = old.value
		input.dataset.dateValue = old.dataset.dateValue ?? ''
		setTypedDateInvalid(input, isTypedDateInvalid(old))
		if (ctx.shadow.activeElement === input && old.selectionStart !== null && old.selectionEnd !== null) {
			input.setSelectionRange(old.selectionStart, old.selectionEnd, old.selectionDirection ?? undefined)
		}
	}
	openCellDatePicker(ctx, input, anchor, at.rowIndex, at.colIndex, at.onSelect)
}

/**
 * Create + open the date picker for a cell's date input. The picker reads its config from the
 * input's `data-*` attributes (`dateFormat`, `minDate`, `maxDate`, current `dateValue`), follows
 * what is typed into the input, and reports every close to onDatePickerClose().
 */
export function openCellDatePicker<T>(
	ctx: GridHost<T>,
	input: HTMLInputElement,
	anchor: HTMLElement,
	rowIndex: number,
	colIndex: number,
	onSelect: DatePickerSelect
): void {
	// Close any existing datepicker ('api': opening a new one)
	if (ctx.datepicker) {
		ctx.datepicker.close()
		ctx.datepicker = null
	}

	const column = ctx.engine.columns[colIndex]
	const at: PickerCell = {
		rowIndex,
		colIndex,
		field: String(column?.field ?? input.dataset.field ?? ''),
		isAlwaysMode: (column?.editTrigger ?? ctx.engine.editTrigger) === 'always',
		input,
		onSelect,
	}

	const picker: DatePicker = new DatePicker({
		container: ctx.shadow,
		dateFormat: input.dataset.dateFormat || 'YYYY-MM-DD',
		minDate: input.dataset.minDate || undefined,
		maxDate: input.dataset.maxDate || undefined,
		// A scroll that moved the cell closes it: not while the grid moves the edit between
		// cells, nor while the grid is detached
		shouldCloseOnScroll: () => !ctx.isTransitioningCells && ctx.shadow.host.isConnected,
		// The page-wide overlay tree, in the `overlay-group` input's group (unset = the default)
		overlayGroup: ctx.overlayGroup || undefined,
		onSelect: (date, direction) => onSelect(date, direction, input),
		onClose: (reason) => onDatePickerClose(ctx, picker, reason, at),
	})
	ctx.datepicker = picker
	picker.open(anchor, input.dataset.dateValue || null)
	picker.followInput(input)
}

/**
 * The trigger-button opener: open the picker on the given input; a pick commits
 * through handleDatePickerSelect.
 */
export function openDatePicker<T>(
	ctx: GridHost<T>,
	input: HTMLInputElement,
	anchor: HTMLElement
): void {
	const rowIndex = parseInt(input.dataset.row || '0', 10)
	const field = input.dataset.field || ''
	const colIndex = ctx.engine.columns.findIndex(c => String(c.field) === field)
	openCellDatePicker(ctx, input, anchor, rowIndex, colIndex, (date, direction, at) => {
		handleDatePickerSelect(ctx, at, date, direction)
	})
}

/**
 * Apply the user's date pick: write the formatted value back into the input,
 * commit the edit (`commitEmptyRow` for Enter, not for Tab), then move focus.
 * `date` null: the typed text is not a date — it is committed as is (invalid).
 */
export function handleDatePickerSelect<T>(
	ctx: GridHost<T>,
	input: HTMLInputElement,
	date: Date | null,
	direction?: 'down' | 'next' | 'prev'
): void {
	if (date) {
		// Update input value with formatted date
		input.value = formatDate(date, parseFormat(input.dataset.dateFormat || 'YYYY-MM-DD'))
		input.dataset.dateValue = toISODateString(date)
		setTypedDateInvalid(input, false)
	}

	// The picker closes right after this ('api': nothing more to do)
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
 * The parse error to save the date editor's text with: `labels.invalidDate` when the typed text
 * is not a date (DatePicker marked it — invalid, incomplete, out of min / max), else `null`.
 * Every leave-the-cell path commits that text as is with this error (like a paste): the cell is
 * marked invalid, `validation-error` fires, the edit ends.
 */
export function typedDateError<T>(ctx: GridHost<T>, input: HTMLInputElement): string | null {
	return isTypedDateInvalid(input) && input.value.trim() !== '' ? ctx.engine.labels.invalidDate : null
}

/**
 * Convert the input's typed value into the configured output format (ISO
 * string / Date / timestamp) and write it through grid.commitEdit. Text that
 * is not a date is committed as is, invalid (`labels.invalidDate`).
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

	// Not a date (marked while typing, or no parse): saved as typed, marked invalid
	const parseError = typedDateError(ctx, input) ?? (input.value.trim() !== '' && !dateValue ? ctx.engine.labels.invalidDate : null)
	if (parseError) {
		await ctx.engine.commitEdit(rowIndex, field, input.value, commitEmptyRow, 'edit', parseError)
		return
	}

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

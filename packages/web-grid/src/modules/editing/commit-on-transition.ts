// =============================================================================
// Excel-like commit-on-click-away
// =============================================================================
// Called from the cell-transition handlers (table-mousedown for date-trigger
// switches + dropdown-open cell switches) in place of grid.cancelEdit() when
// shouldCommitOnClickAway is on. Reads the in-progress editor's value
// directly off the DOM and feeds it into grid.commitEdit so the user's typed
// (but uncommitted) text is preserved on click-away.
//
// Editor value extraction is type-specific:
//
//  - checkbox: ignored — we read the original raw value (clicking another
//    cell shouldn't flip the checkbox).
//  - .wg__date-input: prefer the parsed dataset.dateValue, fall back to the
//    raw input value; typed text that is not a date is saved as is, invalid
//    (`labels.invalidDate`, typedDateError()).
//  - .wg__editor--number: the text as-is — engine.commitEdit parses it strictly
//    and applies the editorOptions (modules/editing/value-parse.ts).
//  - .wg__combobox-input / .wg__autocomplete-input: the typed text resolved to an
//    option's VALUE when it matches an option's label (resolveComboboxValue),
//    else the raw text (free-form).
//  - .wg__select-trigger: NOT committed — a select changes only on a pick (option
//    click / Enter / Tab after arrowing), so leaving it otherwise cancels the edit
//    (no change + `cell-edit-cancel`, like every other no-pick close).
//  - any other HTMLInputElement: .value as-is.
//  - HTMLSelectElement: .value.
//  - anything else: dataset.value.
//
// Fall-back paths (no editingCell / not committable / no editor DOM / column
// gone) drop back to grid.cancelEdit, matching the prior inline semantics.

import type { GridHost } from '../grid-context.js'
import type { EditorOptions } from '../../types.js'
import { getOptionLabel, getOptionValue } from '../dropdown/options.js'
import { typedDateError } from '../datepicker/element-handlers.js'

/**
 * Read the in-progress editor's value and fire grid.commitEdit; fall back
 * to grid.cancelEdit when the editor can't be read or click-away commit is
 * disabled. Must run BEFORE renderCell wipes the editor element.
 */
export function commitOrCancelEditOnTransition<T>(ctx: GridHost<T>): void {
	if (!ctx.engine.editingCell) return
	if (!ctx.engine.shouldCommitOnClickAway) {
		ctx.engine.cancelEdit()
		return
	}
	commitEditorValue(ctx)
}

/**
 * The value a combobox / autocomplete input commits: the option whose label
 * matches the typed text (case-insensitive) gives its VALUE; otherwise the raw
 * text (free-form). Shared by the editor's blur and every leave-the-cell path.
 */
export function resolveComboboxValue<T>(
	ctx: GridHost<T>,
	input: HTMLInputElement,
	opts: EditorOptions<T> = ctx.getCurrentEditorOptions()
): unknown {
	const typed = input.value.toLowerCase()
	const sources = [opts.options || opts.initialOptions || [], ctx.dropdown.options]
	for (const options of sources) {
		const matched = options.find(opt => getOptionLabel(opt, opts).toLowerCase() === typed)
		if (matched) return getOptionValue(matched, opts)
	}
	return input.value
}

/**
 * Save the in-progress edit from its editor (Excel: leaving a cell saves) —
 * regardless of `shouldCommitOnClickAway` (callers that honour it use
 * commitOrCancelEditOnTransition). A select without a pick cancels (no change).
 * Must run BEFORE renderCell wipes the editor element.
 */
export function commitEditorValue<T>(ctx: GridHost<T>): void {
	const editingCell = ctx.engine.editingCell
	if (!editingCell) return
	const { rowIndex, field } = editingCell
	const colIndex = ctx.engine.columns.findIndex(c => String(c.field) === field)
	if (colIndex < 0) {
		ctx.engine.cancelEdit()
		return
	}
	const cell = ctx.shadow.querySelector(
		`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
	) as HTMLElement | null
	let editor: HTMLElement | null = cell?.querySelector(
		'.wg__combobox-input, .wg__autocomplete-input, .wg__date-input, .wg__select-trigger'
	) as HTMLElement | null
	if (!editor) editor = cell?.querySelector('.wg__editor') as HTMLElement | null
	if (!editor || editor.classList.contains('wg__select-trigger')) {
		ctx.engine.cancelEdit()
		return
	}
	let value: unknown
	let parseError: string | null = null
	if (editor.matches('.wg__combobox-input, .wg__autocomplete-input')) {
		value = resolveComboboxValue(ctx, editor as HTMLInputElement)
	} else if (editor instanceof HTMLInputElement) {
		if (editor.type === 'checkbox') {
			const item = ctx.engine.displayItems[rowIndex]
			value = ctx.engine.getCellRawValue(item, rowIndex, field)
		} else if (editor.classList.contains('wg__date-input')) {
			parseError = typedDateError(ctx, editor)
			value = parseError ? editor.value : editor.dataset.dateValue || editor.value
		} else if (editor.classList.contains('wg__editor--number')) {
			value = editor.value
		} else {
			value = editor.value
		}
	} else if (editor instanceof HTMLSelectElement) {
		value = editor.value
	} else {
		value = editor.dataset.value || ''
	}
	// Fire and forget — grid.commitEdit handles async validation and clears
	// editingCell when complete. The surrounding caller already handles
	// post-transition rendering and focus.
	void ctx.engine.commitEdit(rowIndex, field, value, false, 'edit', parseError)
}

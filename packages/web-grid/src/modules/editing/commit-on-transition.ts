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
//    raw input value.
//  - .wg__editor--number: parseFloat (or null on empty), falling back to the
//    raw string if parseFloat returns NaN.
//  - any other HTMLInputElement: .value as-is.
//  - HTMLSelectElement: .value.
//  - anything else: dataset.value.
//
// Fall-back paths (no editingCell / not committable / no editor DOM / column
// gone) drop back to grid.cancelEdit, matching the prior inline semantics.

import type { GridHost } from '../grid-context.js'

/**
 * Read the in-progress editor's value and fire grid.commitEdit; fall back
 * to grid.cancelEdit when the editor can't be read or click-away commit is
 * disabled. Must run BEFORE renderCell wipes the editor element.
 */
export function commitOrCancelEditOnTransition<T>(ctx: GridHost<T>): void {
	const editingCell = ctx.engine.editingCell
	if (!editingCell) return
	if (!ctx.engine.shouldCommitOnClickAway) {
		ctx.engine.cancelEdit()
		return
	}
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
	if (!editor) {
		ctx.engine.cancelEdit()
		return
	}
	let value: unknown
	if (editor instanceof HTMLInputElement) {
		if (editor.type === 'checkbox') {
			const item = ctx.engine.displayItems[rowIndex]
			value = ctx.engine.getCellRawValue(item, rowIndex, field)
		} else if (editor.classList.contains('wg__date-input')) {
			value = editor.dataset.dateValue || editor.value
		} else if (editor.classList.contains('wg__editor--number')) {
			const strValue = editor.value.trim()
			if (strValue === '') {
				value = null
			} else {
				const num = parseFloat(strValue)
				value = isNaN(num) ? strValue : num
			}
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
	void ctx.engine.commitEdit(rowIndex, field, value)
}

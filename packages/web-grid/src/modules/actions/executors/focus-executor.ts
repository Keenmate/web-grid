// =============================================================================
// Focus Executor
// Handles focusCell and blurCell actions
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction, FocusCellAction, BlurCellAction } from '../types.js'
import { updateFocusVisual, focusCellTd } from '../../navigation/index.js'
import { updateFillHandle } from '../../fill-handle/index.js'
import { fieldAt, prepareRowReveal, finishCellReveal } from '../../scroll/reveal.js'

/**
 * Focus executor - handles cell focus/blur actions
 */
export const focusExecutor: ActionExecutor = {
	handles: ['focusCell', 'blurCell'],

	execute(ctx: ExecutorContext, action: GridAction): GridAction[] | void {
		switch (action.type) {
			case 'focusCell':
				return executeFocusCell(ctx, action)
			case 'blurCell':
				return executeBlurCell(ctx, action)
		}
	}
}

/**
 * Execute focusCell action
 */
function executeFocusCell(ctx: ExecutorContext, action: FocusCellAction): GridAction[] | void {
	const { rowIndex, colIndex } = action.target
	const column = ctx.engine.columns[colIndex]
	if (!column) return

	// Check if this cell uses 'always' editTrigger
	const effectiveTrigger = column.editTrigger ?? ctx.engine.editTrigger
	const isAlwaysEditMode = effectiveTrigger === 'always'

	// Update grid state
	const oldFocus = ctx.engine.focusedCell

	// Clear stale filterText when focusing a different cell.
	// renderComboboxEditor sets ctx.dropdown.filterText to the input value as a side effect,
	// which would incorrectly filter a different cell's dropdown options.
	const isNewCell = !oldFocus || oldFocus.rowIndex !== rowIndex || oldFocus.colIndex !== colIndex
	if (isNewCell) {
		ctx.dropdown.setFilterText('')

		// Cancel pending autocomplete search from previous cell
		ctx.autocomplete.clearDebounceTimer()
		ctx.autocomplete.abort()
	}

	ctx.engine.setFocusedCell(rowIndex, colIndex)

	// Update visual state (adds/removes focus classes)
	updateFocusVisual(ctx, oldFocus, { rowIndex, colIndex })

	// Row focus follows cell focus. The host's mousedown handler used to do
	// this, but the pipeline marks cell selection as "pending" on every cell
	// mousedown, which suppressed that update — so row focus only ever
	// landed after a second click on an already-focused cell. Doing it here
	// keeps focus-change tied to the focusCell action and fires regardless of
	// keyboard/mouse input. shift+click extends a selection without
	// dispatching focusCell, so row focus correctly stays put there.
	const prevRowIndex = ctx.engine.focusedRowIndex
	if (prevRowIndex !== rowIndex) {
		ctx.engine.setFocusedRow(rowIndex)
		if (prevRowIndex !== null) {
			const prevRow = ctx.shadow.querySelector(`tr[data-row-index="${prevRowIndex}"]`)
			prevRow?.classList.remove('wg__row--focused')
		}
		const newRow = ctx.shadow.querySelector(`tr[data-row-index="${rowIndex}"]`)
		newRow?.classList.add('wg__row--focused')
	}

	// Virtual scroll: the target row may be outside the rendered window — render its window and
	// scroll to it NOW, so the cell exists to take focus (a held key's next keydown comes from it)
	const revealTarget = { rowIndex, field: fieldAt(ctx, colIndex) }
	const revealState = prepareRowReveal(ctx, revealTarget, 'keyboard')

	// Find the cell element
	const cell = ctx.shadow.querySelector(
		`td[data-row="${rowIndex}"][data-col="${colIndex}"]`
	) as HTMLElement
	if (!cell) return

	// Focus the appropriate element
	if (isAlwaysEditMode) {
		// In 'always' mode, focus the editor input inside the cell
		// First try specific focusable inputs (combobox/autocomplete/date have wrapper divs)
		// Then fall back to .wg__editor (for text/number inputs where the input IS the .wg__editor)
		let editor = cell.querySelector(
			'.wg__combobox-input, .wg__autocomplete-input, .wg__date-input, .wg__select-trigger'
		) as HTMLElement
		if (!editor) {
			editor = cell.querySelector('.wg__editor') as HTMLElement
		}

		if (editor) {
			editor.focus({ preventScroll: true })
			// Select all text in text inputs (unless explicitly disabled)
			if (action.selectText !== false && editor instanceof HTMLInputElement && editor.type === 'text') {
				editor.select()
			}
		}
	} else {
		// Default: focus the cell itself
		// (cells in click/dblclick mode don't have tabindex from rendering — focusCellTd adds it)
		focusCellTd(cell)
	}

	// Scroll into view if needed (core container scroll, gated by beforeScrollCallback)
	finishCellReveal(ctx, cell, revealTarget, 'keyboard', revealState)

	// Update fill handle position for the newly focused cell
	updateFillHandle(ctx)

	// Auto-open dropdown if shouldOpenDropdownOnFocus is true
	const editorType = column.editor
	const isDropdownEditor = editorType === 'select' || editorType === 'combobox' || editorType === 'autocomplete'
	const isNavigateMode = effectiveTrigger === 'navigate'
	if (isAlwaysEditMode && ctx.engine.shouldOpenDropdownOnFocus && !ctx.dropdown.justSelected) {
		if (isDropdownEditor) {
			return [{ type: 'openDropdown' }]
		}
	}
	// Navigate mode: don't check justSelected - we're moving to a different cell,
	// so the dropdown should open even after a Tab-select from the previous cell
	if (isNavigateMode && ctx.engine.shouldOpenDropdownOnFocus) {
		if (isDropdownEditor) {
			return [
				{ type: 'startEdit', target: { rowIndex, colIndex } },
				{ type: 'openDropdown' }
			]
		}
	}
}

/**
 * Execute blurCell action
 */
function executeBlurCell(ctx: ExecutorContext, _action: BlurCellAction): void {
	const oldFocus = ctx.engine.focusedCell
	ctx.engine.clearFocusedCell()
	updateFocusVisual(ctx, oldFocus, null)
}

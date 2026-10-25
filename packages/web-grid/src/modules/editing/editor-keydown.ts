// =============================================================================
// Editor-input keydown handler (residual keys)
// =============================================================================
// ONE key path: the action pipeline adapter (`modules/actions/adapter.ts`,
// `tryHandleKeyDown`) owns every navigation / commit / cancel key while a cell
// editor is focused — Enter, Tab (incl. committing the empty row), Escape,
// arrows, Home / End / PageUp / PageDown, F2 / Space on dropdown editors — and
// the datepicker's own handler gets its keys while the picker is open.
//
// What is left here is type-to-search on the (read-only) `select` editor:
// Backspace + printable keys feed `updateSelectFilter`.

import type { GridHost } from '../grid-context.js'
import { updateSelectFilter } from '../dropdown/index.js'

/**
 * Handle the residual keydowns on a focused editor input (see the file header).
 */
export function handleEditorKeyDown<T>(
	ctx: GridHost<T>,
	e: KeyboardEvent,
	editor: HTMLElement
): void {
	const field = editor.dataset.field || ''
	const column = ctx.engine.columns.find(c => c.field === field)
	if (column?.editor !== 'select') return

	if (e.key === 'Backspace') {
		e.preventDefault()
		e.stopPropagation()
		if (ctx.dropdown.filterText.length > 0) {
			ctx.dropdown.setFilterText(ctx.dropdown.filterText.slice(0, -1))
			updateSelectFilter(ctx, column.editorOptions || {})
		}
	} else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
		e.preventDefault()
		e.stopPropagation()
		ctx.dropdown.setFilterText(ctx.dropdown.filterText + e.key)
		updateSelectFilter(ctx, column.editorOptions || {})
	}
}

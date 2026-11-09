// =============================================================================
// Edit button (editTrigger: 'button', or column.isEditButtonShown)
// =============================================================================
// An editable cell (not read-only, not locked) in display mode gets a small
// button — shown on hover and in the focused cell (CSS). A click starts editing;
// F2 / Enter work as usual. The icon is HTML (`editButtonIcon`, e.g.
// `<span class="lucide-pencil"></span>`), the accessible name `labels.editCell`.

import { escapeHtml } from '@keenmate/web-components-core'
import type { GridHost } from '../grid-context.js'
import type { Column } from '../../types.js'
import { tryStartEdit } from '../navigation/index.js'
import { openDropdownForCurrentEditor } from '../dropdown/index.js'

/** Does this (editable) cell show the edit button? */
export function hasEditButton<T>(ctx: GridHost<T>, column: Column<T>, isEditable: boolean): boolean {
	if (!isEditable) return false
	const trigger = column.editTrigger ?? ctx.engine.editTrigger
	return trigger === 'button' || column.isEditButtonShown === true
}

export function renderEditButton<T>(ctx: GridHost<T>, rowIndex: number, colIndex: number): string {
	const label = escapeHtml(ctx.engine.labels.editCell)
	return `<button type="button" class="wg__edit-button" tabindex="-1" data-row="${rowIndex}" data-col="${colIndex}" aria-label="${label}" title="${label}">${ctx.engine.editButtonIcon}</button>`
}

/**
 * Mousedown on an edit button: start editing that cell (and open its dropdown /
 * custom editor like a click-to-edit). Returns true when handled.
 */
export function handleEditButtonMouseDown<T>(ctx: GridHost<T>, e: MouseEvent): boolean {
	const btn = (e.target as HTMLElement).closest('.wg__edit-button') as HTMLElement | null
	if (!btn || e.button !== 0) return false
	e.preventDefault()
	e.stopPropagation()
	const rowIndex = parseInt(btn.dataset.row || '-1', 10)
	const colIndex = parseInt(btn.dataset.col || '-1', 10)
	const column = ctx.engine.columns[colIndex]
	if (!column || rowIndex < 0) return true
	tryStartEdit(ctx, rowIndex, colIndex)
	const editor = column.editor
	if (editor === 'select' || editor === 'combobox' || editor === 'autocomplete') {
		requestAnimationFrame(() => {
			if (!ctx.dropdown.isOpen) openDropdownForCurrentEditor(ctx)
		})
	} else if (editor === 'custom') {
		requestAnimationFrame(() => ctx.openCustomEditor(rowIndex, colIndex))
	}
	return true
}

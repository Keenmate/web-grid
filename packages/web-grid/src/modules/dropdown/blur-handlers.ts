// =============================================================================
// Dropdown editor blur handlers
// =============================================================================
// Extracted from GridElement. Two distinct blur behaviors:
//   - Select trigger: blur cancels the edit and restores display mode (no value
//     change). The dropdown handles its own commit on option-click; blur is
//     just "user moved away."
//   - Combobox / autocomplete input: blur commits whatever the input shows. If
//     the typed text matches an option's label, commit the option's value;
//     otherwise commit the raw text (free-form support).

import type { GridHost } from '../grid-context.js'
import { clearEditingVisual } from '../navigation/focus.js'
import { renderCell } from '../rendering/cell.js'
import { resolveComboboxValue } from '../editing/commit-on-transition.js'
import { removeDropdown } from './rendering.js'
import { GRID_ENGINE } from '../grid-context.js'

/**
 * Select trigger blur — cancel the edit, remove the dropdown, restore the
 * cell's display HTML. Skipped during dropdown-open (would flicker) and when
 * focus is moving to a dropdown option (the option's click handler owns the
 * commit).
 */
export function handleSelectBlur<T>(
	ctx: GridHost<T>,
	relatedTarget: HTMLElement | null
): void {
	// Skip if opening dropdown (prevents flicker during open)
	if (ctx.dropdown.isOpening) return

	// Skip if focus is moving to a dropdown option (let click handler handle it)
	if (relatedTarget?.closest('.wg__dropdown')) return

	// Capture cell info BEFORE cancelEdit clears it
	const editingCell = ctx[GRID_ENGINE].editingCell
	const colIndex = editingCell
		? ctx[GRID_ENGINE].columns.findIndex(c => String(c.field) === editingCell.field)
		: -1

	removeDropdown(ctx)
	clearEditingVisual(ctx)
	ctx[GRID_ENGINE].cancelEdit()

	// Re-render cell to restore display mode HTML
	if (editingCell && colIndex >= 0) {
		renderCell(ctx, editingCell.rowIndex, colIndex)
	}
}

/**
 * Combobox / autocomplete blur — commit whatever the input shows. Matched
 * option-label → commit the option's value; otherwise commit the raw input
 * value (free-form text support).
 */
export function handleComboboxBlur<T>(
	ctx: GridHost<T>,
	input: HTMLInputElement
): void {
	removeDropdown(ctx)

	if (!ctx[GRID_ENGINE].editingCell) return

	// Capture cell info BEFORE commit clears it
	const editingCell = ctx[GRID_ENGINE].editingCell
	const colIndex = ctx[GRID_ENGINE].columns.findIndex(c => String(c.field) === editingCell.field)

	if (!ctx.getCurrentEditingColumn()) return
	const value = resolveComboboxValue(ctx, input)

	// Clear visual and commit
	clearEditingVisual(ctx)
	ctx[GRID_ENGINE].commitEdit(editingCell.rowIndex, editingCell.field, value)

	// Re-render cell to restore display mode
	if (colIndex >= 0) {
		renderCell(ctx, editingCell.rowIndex, colIndex)
	}
}

// =============================================================================
// Checkbox Executor
// Handles toggleCheckbox action
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction, ToggleCheckboxAction } from '../types.js'
import { renderCell } from '../../rendering/index.js'

/**
 * Checkbox executor - handles checkbox toggle actions
 */
export const checkboxExecutor: ActionExecutor = {
	handles: ['toggleCheckbox'],

	execute(ctx: ExecutorContext, action: GridAction): GridAction[] | void {
		if (action.type !== 'toggleCheckbox') return
		executeToggleCheckbox(ctx, action)
	}
}

/**
 * Toggle checkbox value
 * Updates the draft row and marks the cell as being edited.
 * This allows users to toggle the checkbox multiple times before committing.
 *
 * The cell is marked as editing so that:
 * - Enter/Tab will commit the draft value
 * - Escape will cancel and discard changes
 * - Arrow keys are blocked while "editing"
 */
function executeToggleCheckbox(ctx: ExecutorContext, action: ToggleCheckboxAction): void {
	const { rowIndex, colIndex } = action.target
	const column = ctx.engine.columns[colIndex]
	if (!column) return

	const item = ctx.engine.displayItems[rowIndex]
	if (!item) return

	if (!ctx.engine.isCellEditable(column, item)) return

	const field = String(column.field)

	const opts = column.editorOptions || {}
	const trueValue = opts.trueValue ?? true
	const falseValue = opts.falseValue ?? false
	// Use getCellRawValue to get value from draft row if it exists
	const currentValue = ctx.engine.getCellRawValue(item, rowIndex, field)
	const newValue = currentValue === trueValue ? falseValue : trueValue

	// Mark the cell as being edited so navigation keys (Tab, Enter) will commit
	// This integrates checkbox toggle with the standard editing flow
	ctx.engine.startEdit(rowIndex, field)

	// Update draft row with the new value
	ctx.engine.updateDraftValue(rowIndex, field, newValue)

	// Re-render the cell to show new checkbox state AND focus the checkbox
	// Without focusEditor: true, the checkbox HTML is replaced but focus is lost,
	// which prevents subsequent keyboard events (Enter, Tab) from being received
	renderCell(ctx, rowIndex, colIndex, { focusEditor: true })
}

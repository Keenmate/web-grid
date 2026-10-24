// =============================================================================
// Transition Executor
// Handles transitionCell compound action - orchestrates cell transitions
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction, TransitionCellAction, RenderCellAction, FocusCellAction } from '../types.js'

/**
 * Transition executor - handles cell-to-cell transitions
 */
export const transitionExecutor: ActionExecutor = {
	handles: ['transitionCell'],

	execute(ctx: ExecutorContext, action: GridAction): GridAction[] | void {
		if (action.type !== 'transitionCell') return
		return executeTransition(ctx, action)
	}
}

/**
 * Execute transitionCell action
 * Produces child actions to: 1) commit edit if editing, 2) re-render old cell, 3) focus new cell
 */
function executeTransition(ctx: ExecutorContext, action: TransitionCellAction): GridAction[] {
	const { from, to, selectText } = action
	const childActions: GridAction[] = []

	// Check if we're transitioning FROM an editing cell
	const editingCell = ctx.engine.editingCell
	const isFromEditing = editingCell &&
		editingCell.rowIndex === from.rowIndex &&
		ctx.engine.columns.findIndex(c => String(c.field) === editingCell.field) === from.colIndex

	// Check if the 'from' cell is in 'always' edit mode
	const fromColumn = ctx.engine.columns[from.colIndex]
	const effectiveTrigger = fromColumn?.editTrigger ?? ctx.engine.editTrigger
	const isAlwaysEditMode = effectiveTrigger === 'always'

	// If moving to a different cell
	if (from.rowIndex !== to.rowIndex || from.colIndex !== to.colIndex) {
		// If the old cell was being edited OR is in 'always' edit mode, commit first
		// This saves the value from the DOM input before re-rendering destroys it
		if (isFromEditing) {
			childActions.push({ type: 'commitEdit' })
		} else if (isAlwaysEditMode) {
			// In 'always' mode, editingCell isn't tracked, so pass coordinates explicitly
			childActions.push({ type: 'commitEdit', target: from })
		} else {
			// Just re-render the old one to remove focus visual
			const renderOld: RenderCellAction = {
				type: 'renderCell',
				target: from
			}
			childActions.push(renderOld)
		}
	}

	// Focus the new cell
	const focusNew: FocusCellAction = {
		type: 'focusCell',
		target: to,
		selectText
	}
	childActions.push(focusNew)

	return childActions
}

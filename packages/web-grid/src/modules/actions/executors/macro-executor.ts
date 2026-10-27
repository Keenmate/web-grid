// =============================================================================
// Macro Executor
// Handles macro actions that expand into primitive sub-actions
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction, ResetStateAction } from '../types.js'

/**
 * Macro executor - expands macro actions into primitive sub-actions
 */
export const macroExecutor: ActionExecutor = {
	handles: ['resetState'],

	execute(ctx: ExecutorContext, action: GridAction): GridAction[] | void {
		if (action.type === 'resetState') {
			return executeResetState(ctx, action)
		}
	}
}

/**
 * Expand resetState into primitive cleanup actions.
 * Only emits actions for state that is actually dirty.
 * Order: overlays -> edit -> selections -> focus
 */
function executeResetState(ctx: ExecutorContext, action: ResetStateAction): GridAction[] {
	const edit = action.edit !== false
	const selections = action.selections !== false
	const overlays = action.overlays !== false
	const focus = action.focus === true

	const actions: GridAction[] = []

	// 1. Close overlays (dropdown is closed by cancelEdit, but context menu and datepicker need explicit close)
	if (overlays) {
		if (ctx.menu) {
			actions.push({ type: 'closeContextMenu' })
		}
		if (ctx.datepicker) {
			actions.push({ type: 'closeDatePicker' })
		}
	}

	// 2. Cancel active edit (cancelEdit already handles closing dropdown + clearing editing visual)
	if (edit && ctx.engine.editingCell) {
		actions.push({ type: 'cancelEdit' })
	}

	// 3. Clear selections
	if (selections) {
		const hasSelections = ctx.engine.selectedRowIndices.length > 0 ||
			ctx.engine.selectedColumns.length > 0 ||
			ctx.engine.selectedCellRange
		if (hasSelections) {
			actions.push({ type: 'clearSelection' })
		}
	}

	// 4. Clear focus (opt-in)
	if (focus && ctx.engine.focusedCell) {
		actions.push({ type: 'blurCell' })
	}

	return actions
}

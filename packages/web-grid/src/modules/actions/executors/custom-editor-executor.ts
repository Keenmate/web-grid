// =============================================================================
// Custom Editor Executor
// Handles openCustomEditor action - calls renderEditorCallback
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction, OpenCustomEditorAction } from '../types.js'

/**
 * Custom editor executor - opens custom editor dialog
 */
export const customEditorExecutor: ActionExecutor = {
	handles: ['openCustomEditor'],

	execute(ctx: ExecutorContext, action: GridAction): GridAction[] | void {
		if (action.type !== 'openCustomEditor') return

		const { rowIndex, colIndex } = (action as OpenCustomEditorAction).target
		ctx.openCustomEditor(rowIndex, colIndex)
	}
}

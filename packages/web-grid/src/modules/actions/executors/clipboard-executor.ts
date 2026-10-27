// =============================================================================
// Clipboard Executor
// Handles copy and paste actions
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction } from '../types.js'

/**
 * Clipboard executor - handles copy and paste actions
 */
export const clipboardExecutor: ActionExecutor = {
	handles: ['copy', 'paste'],

	execute(ctx: ExecutorContext, action: GridAction): GridAction[] | void {
		switch (action.type) {
			case 'copy':
				executeCopy(ctx)
				break
			case 'paste':
				// Paste is handled via the paste event on the component
				// This is a placeholder for potential future use
				break
		}
	}
}

/**
 * Copy the active selection to the clipboard — cell range > columns > rows >
 * the focused cell. Delegates to the engine's copy methods, so the keyboard and
 * the public API share one implementation (draft-aware values,
 * `shouldCopyWithHeaders`, `getCopyValueCallback` for a single cell, and a
 * clipboard rejection resolves false instead of surfacing as unhandled).
 */
async function executeCopy(ctx: ExecutorContext): Promise<void> {
	const engine = ctx.engine
	if (engine.selectedCellRange) {
		await engine.copyCellSelectionToClipboard()
	} else if (engine.selectedColumns.length > 0) {
		await engine.copySelectedColumnsToClipboard()
	} else if (engine.selectedRowIndices.length > 0) {
		await engine.copySelectedRowsToClipboard()
	} else if (engine.focusedCell) {
		await engine.copyFocusedCellToClipboard()
	}
}

// =============================================================================
// Context Menu Executor
// Handles opening and closing context menus
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction, OpenContextMenuAction } from '../types.js'
import { closeGridMenu } from '../../contextmenu/index.js'

/**
 * Context menu executor - handles context menu actions
 * Note: The actual rendering of context menus is handled by the context-menu module.
 * This executor dispatches the appropriate signals.
 */
export const contextMenuExecutor: ActionExecutor = {
	handles: ['openContextMenu', 'closeContextMenu'],

	execute(ctx: ExecutorContext, action: GridAction): GridAction[] | void {
		switch (action.type) {
			case 'openContextMenu':
				executeOpenContextMenu(ctx, action)
				break
			case 'closeContextMenu':
				executeCloseContextMenu(ctx)
				break
		}
	}
}

/**
 * Open context menu at the specified position
 */
function executeOpenContextMenu(ctx: ExecutorContext, action: OpenContextMenuAction): void {
	// The actual context menu rendering is handled by the existing context-menu module
	// This executor serves as a bridge to allow pipeline-based triggering

	// If there's a target cell, focus it first
	if (action.target) {
		ctx.dispatch({
			type: 'focusCell',
			target: action.target,
			selectText: false
		})
	}

	// Context menu opening is typically handled by the contextmenu event in web-component
	// This is a placeholder for future pipeline-based context menu control
}

/**
 * Close all open context menus (cell and header)
 */
function executeCloseContextMenu(ctx: ExecutorContext): void {
	closeGridMenu(ctx)
}

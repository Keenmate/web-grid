// =============================================================================
// Context Menu Executor
// Closes open context menus. Opening is not a pipeline action: the cell and
// header menus run on core openMenu() (/menu), triggered by the contextmenu
// event / Shift+F10 in the menu module.
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction } from '../types.js'
import { closeGridMenu } from '../../contextmenu/index.js'

/**
 * Context menu executor - closes the cell / header menus
 */
export const contextMenuExecutor: ActionExecutor = {
	handles: ['closeContextMenu'],

	execute(ctx: ExecutorContext, action: GridAction): GridAction[] | void {
		if (action.type === 'closeContextMenu') executeCloseContextMenu(ctx)
	}
}

/**
 * Close all open context menus (cell and header)
 */
function executeCloseContextMenu(ctx: ExecutorContext): void {
	closeGridMenu(ctx)
}

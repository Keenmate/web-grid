// =============================================================================
// Custom editor lifecycle
// =============================================================================
// Drives the `editor: 'custom'` path. Builds a CustomEditorContext bound to
// the in-progress edit and hands it to the column's renderEditorCallback. The
// callback is responsible for rendering its own UI; the context exposes:
//
//  - value: the current raw cell value
//  - row + rowIndex + field: identification for downstream consumers
//  - commit(newValue): clears editing visual → awaits grid.commitEdit (so
//    validateCallback runs) → renderCell → restores focus on the next RAF.
//  - cancel(): clears editing visual → grid.cancelEdit → renderCell →
//    restores focus on the next RAF.
//
// The clearEditingVisual / renderCell / moveFocus sequence mirrors the
// canonical editing-executor commit path so the custom editor's bookkeeping
// matches every other editor type.

import type { GridHost } from '../grid-context.js'
import type { EditorContext } from '../../interaction.js'
import { clearEditingVisual, moveFocus } from '../navigation/index.js'
import { renderCell } from '../rendering/index.js'

/**
 * Build the EditorContext and invoke the column's renderEditorCallback.
 * No-op if the column isn't a custom editor or has no callback installed.
 */
export function openCustomEditor<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	colIndex: number
): void {
	const column = ctx.engine.columns[colIndex]
	if (!column || column.editor !== 'custom' || !column.renderEditorCallback) {
		return
	}

	const field = String(column.field)
	const item = ctx.engine.displayItems[rowIndex]
	if (!item) return

	// Context: the cell + commit/cancel
	const context: EditorContext<T> = Object.assign(ctx.engine.cellCtx(item, rowIndex, column, colIndex), {
		commit: async (newValue: unknown) => {
			// Same order as the canonical edit-executor commit path:
			//   1. clearEditingVisual BEFORE commitEdit (so editingCell is still
			//      set and the wg__cell--editing class can be located and removed)
			//   2. await commitEdit (it's async — may run validateCallback)
			//   3. renderCell so the cell picks up the committed draft value
			clearEditingVisual(ctx)
			await ctx.engine.commitEdit(rowIndex, field, newValue)
			renderCell(ctx, rowIndex, colIndex)
			requestAnimationFrame(() => {
				moveFocus(ctx, rowIndex, colIndex)
			})
		},
		cancel: () => {
			// Cancel edit mode without saving
			clearEditingVisual(ctx)
			ctx.engine.cancelEdit()
			renderCell(ctx, rowIndex, colIndex)
			// Return focus to the cell
			requestAnimationFrame(() => {
				moveFocus(ctx, rowIndex, colIndex)
			})
		}
	})

	column.renderEditorCallback(context)
}

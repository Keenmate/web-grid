// =============================================================================
// Custom editor lifecycle
// =============================================================================
// Drives the `editor: 'custom'` path. Builds a CustomEditorContext bound to
// the in-progress edit and hands it to the column's cellEditCallback. The
// callback is responsible for rendering its own UI; the context exposes:
//
//  - value: the current raw cell value
//  - row + rowIndex + field: identification for downstream consumers
//  - commit(newValue): clears editing visual → awaits grid.commitEdit (so
//    beforeCommitCallback runs) → renderCell → restores focus on the next RAF.
//  - cancel(): clears editing visual → grid.cancelEdit → renderCell →
//    restores focus on the next RAF.
//
// The clearEditingVisual / renderCell / moveFocus sequence mirrors the
// canonical editing-executor commit path so the custom editor's bookkeeping
// matches every other editor type.

import type { GridContext } from '../grid-context.js'
import type { CustomEditorContext } from '../../types.js'
import { clearEditingVisual, moveFocus } from '../navigation/index.js'
import { renderCell } from '../rendering/index.js'

/**
 * Build the CustomEditorContext and invoke the column's cellEditCallback.
 * No-op if the column isn't a custom editor or has no callback installed.
 */
export function openCustomEditor<T>(
	ctx: GridContext<T>,
	rowIndex: number,
	colIndex: number
): void {
	const column = ctx.grid.columns[colIndex]
	if (!column || column.editor !== 'custom' || !column.cellEditCallback) {
		return
	}

	const field = String(column.field)
	const item = ctx.grid.displayItems[rowIndex]
	if (!item) return

	const currentValue = ctx.grid.getCellRawValue(item, rowIndex, field)

	// Create context with commit/cancel functions
	const context: CustomEditorContext<unknown> = {
		value: currentValue,
		row: item,
		rowIndex,
		field,
		commit: async (newValue: unknown) => {
			// Same order as the canonical edit-executor commit path:
			//   1. clearEditingVisual BEFORE commitEdit (so editingCell is still
			//      set and the wg__cell--editing class can be located and removed)
			//   2. await commitEdit (it's async — may run beforeCommitCallback)
			//   3. renderCell so the cell picks up the committed draft value
			clearEditingVisual(ctx)
			await ctx.grid.commitEdit(rowIndex, field, newValue)
			renderCell(ctx, rowIndex, colIndex)
			requestAnimationFrame(() => {
				moveFocus(ctx, rowIndex, colIndex)
			})
		},
		cancel: () => {
			// Cancel edit mode without saving
			clearEditingVisual(ctx)
			ctx.grid.cancelEdit()
			renderCell(ctx, rowIndex, colIndex)
			// Return focus to the cell
			requestAnimationFrame(() => {
				moveFocus(ctx, rowIndex, colIndex)
			})
		}
	}

	// Call the callback (cast to any to satisfy generic constraint)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	;(column.cellEditCallback as (ctx: CustomEditorContext<any>) => void)(context)
}

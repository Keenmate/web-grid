// =============================================================================
// Table-level keydown router
// =============================================================================
// Top-of-chain dispatcher for every keydown that bubbles out to the <table>:
//
//  1. Tree expand / collapse via Ctrl/Cmd + ArrowLeft / ArrowRight.
//     Runs BEFORE the pipeline because the pipeline swallows plain arrow
//     keys for cell-focus navigation regardless of editTrigger, which would
//     also consume the modified arrow. Mirrors the chevron + dblclick paths.
//     After toggling, focus is restored to the row whose tree path stays
//     visible (same path for expand/same-row-collapse, ancestor for
//     ancestor-walk collapse).
//  2. Action pipeline pass-through (`always` editTrigger). When the
//     pipeline claims the event, we stop.
//  3. Datepicker passthrough — let navigation keys bubble to the picker's
//     own document-level handler so it can drive its calendar.
//  4. Editor input dispatch — calls `handleEditorKeyDown` for any focused
//     editor (text / number / combobox / autocomplete / date).
//  5. Cell dispatch — calls `handleCellKeyDown` for any focused cell.

import type { GridHost } from '../grid-context.js'
import { moveFocus, handleCellKeyDown } from '../navigation/index.js'
import { handleEditorKeyDown } from '../editing/index.js'

/**
 * Top-level keydown router on the table. Sits in front of the cell + editor
 * keydown handlers, and intercepts tree shortcuts + action pipeline + the
 * datepicker passthrough first.
 */
export function handleTableKeyDown<T>(ctx: GridHost<T>, e: Event): void {
	const target = e.target as HTMLElement
	const ke = e as KeyboardEvent

	// Tree shortcuts (Ctrl/Cmd + ArrowLeft/Right) run BEFORE pipelineAdapter
	// because the pipeline consumes plain arrow keys for cell-focus navigation
	// (regardless of editTrigger), which would swallow the modified arrow too.
	// Direct grid-method calls — same as chevron click and dblclick paths.
	if (
		ctx.engine.isTreeMode &&
		ctx.engine.focusedCell &&
		!ctx.engine.editingCell &&
		(ke.ctrlKey || ke.metaKey) &&
		(ke.key === 'ArrowLeft' || ke.key === 'ArrowRight')
	) {
		const { rowIndex, colIndex } = ctx.engine.focusedCell
		const item = ctx.engine.displayItems[rowIndex]
		const info = item ? ctx.engine.getRowTreeInfo(item) : null
		if (info) {
			e.preventDefault()
			e.stopPropagation()
			// Compute which path's row should hold focus AFTER the toggle. For
			// same-row expand/collapse it's `info.path` (the row itself stays
			// in displayItems at some index). For ancestor-walk collapse it's
			// the ancestor (the focused row is about to be hidden).
			let targetPath: string | null = null
			if (ke.key === 'ArrowRight') {
				if (info.hasChildren && !ctx.engine.isPathExpanded(info.path)) {
					ctx.engine.toggleExpandedPath(info.path)
					targetPath = info.path
				}
			} else {
				if (info.hasChildren && ctx.engine.isPathExpanded(info.path)) {
					ctx.engine.toggleExpandedPath(info.path)
					targetPath = info.path
				} else {
					const ancestor = ctx.engine.findNearestExpandedAncestor(info.path)
					if (ancestor !== null) {
						ctx.engine.toggleExpandedPath(ancestor)
						targetPath = ancestor
					}
				}
			}
			// Restore focus after the render. toggleExpandedPath queues a
			// microtask render; ours queues after it, so displayItems is fresh
			// and the new <td> exists when moveFocus tries to focus it.
			if (targetPath !== null) {
				const path = targetPath
				queueMicrotask(() => {
					const idx = ctx.engine.displayItems
						.findIndex(it => ctx.engine.getRowTreeInfo(it)?.path === path)
					if (idx >= 0) {
						moveFocus(ctx, idx, colIndex)
					}
				})
			}
			return
		}
	}

	// Try action pipeline first (handles 'always' editTrigger mode)
	if (ctx.pipelineAdapter?.tryHandleKeyDown(e as KeyboardEvent)) {
		return
	}

	// If datepicker is open, let navigation keys bubble to datepicker's document handler
	if (ctx.datepicker) {
		const key = (e as KeyboardEvent).key
		const datepickerKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Enter', 'Escape', 'Tab']
		if (datepickerKeys.includes(key)) {
			return
		}
	}

	if (target.matches('.wg__editor, .wg__combobox-input, .wg__autocomplete-input, .wg__date-input')) {
		handleEditorKeyDown(ctx, e as KeyboardEvent, target)
		return
	}
	if (target.matches('.wg__cell')) {
		const rowIndex = parseInt(target.dataset.row || '0', 10)
		const colIndex = parseInt(target.dataset.col || '0', 10)
		handleCellKeyDown(ctx, e as KeyboardEvent, rowIndex, colIndex)
	}
}

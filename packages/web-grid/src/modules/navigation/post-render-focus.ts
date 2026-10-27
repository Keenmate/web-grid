// =============================================================================
// Post-render focus restoration
// =============================================================================
// The tail of `render()` that re-establishes focus after the table HTML has
// been swapped. Two mutually exclusive branches:
//
//  1. An edit is in progress: locate the freshly rendered editor element
//     (specific selectors first to avoid stale `.wg__editor` siblings, then
//     a generic `.wg__editor` fallback), focus it, and apply the configured
//     editStartSelection (mousePosition / cursorAtStart / cursorAtEnd /
//     selectAll). Type-to-start (initialSearchQuery present) always puts the
//     cursor at the end so the typed character isn't replaced.
//  2. No edit, but a cell was previously focused: re-focus that <td> via
//     setTimeout to allow the browser to settle into the new DOM.
//
// `container` is the freshly built (or surgically updated) `.wg` container
// — passed in so the cell-restore branch queries the right subtree.
// `focusedCell` is the focused-cell snapshot taken BEFORE the render, so we
// can restore focus even when grid.focusedCell has been cleared in between.

import type { GridHost } from '../grid-context.js'
import type { FocusedCell } from '../../types.js'

/**
 * Restore focus after a render — either to the in-progress editor (with
 * the configured selection behavior) or to the previously focused cell.
 */
export function restoreFocusAfterRender<T>(
	ctx: GridHost<T>,
	container: HTMLElement,
	focusedCell: FocusedCell | null
): void {
	// Auto-focus editor if in edit mode
	if (ctx.engine.editingCell) {
		const { rowIndex, field } = ctx.engine.editingCell
		// Use specific selectors to avoid finding stale editor elements
		let editor = ctx.shadow.querySelector(
			`.wg__combobox-input[data-row="${rowIndex}"][data-field="${field}"],
			 .wg__autocomplete-input[data-row="${rowIndex}"][data-field="${field}"],
			 .wg__select-trigger[data-row="${rowIndex}"][data-field="${field}"],
			 .wg__date-input[data-row="${rowIndex}"][data-field="${field}"]`
		) as HTMLElement
		if (!editor) {
			editor = ctx.shadow.querySelector(
				`.wg__editor[data-row="${rowIndex}"][data-field="${field}"]`
			) as HTMLElement
		}
		if (editor) {
			editor.focus()
			if (editor instanceof HTMLInputElement && editor.type === 'text') {
				const cursorPos = ctx.engine.editingCell.cursorPosition
				const column = ctx.getCurrentEditingColumn()
				const editStartSelection = column?.editorOptions?.editStartSelection || ctx.engine.editStartSelection

				if (ctx.engine.editingCell.initialSearchQuery !== undefined) {
					// Type-to-start: always cursor at end
					const len = editor.value.length
					editor.setSelectionRange(len, len)
				} else {
					// Apply editStartSelection setting
					switch (editStartSelection) {
						case 'mouse-position':
							if (cursorPos !== undefined) {
								const pos = Math.min(cursorPos, editor.value.length)
								editor.setSelectionRange(pos, pos)
							} else {
								// No click position available (e.g., Enter/F2 in navigate mode) - cursor at end
								editor.setSelectionRange(editor.value.length, editor.value.length)
							}
							break
						case 'cursor-at-start':
							editor.setSelectionRange(0, 0)
							break
						case 'cursor-at-end':
							editor.setSelectionRange(editor.value.length, editor.value.length)
							break
						case 'select-all':
						default:
							editor.select()
							break
					}
				}
			}
		}
	} else if (focusedCell && !ctx.engine.editingCell) {
		// Restore focus to the previously focused cell (if not editing)
		const cell = container.querySelector(
			`td[data-row="${focusedCell.rowIndex}"][data-col="${focusedCell.colIndex}"]`
		) as HTMLElement
		if (cell) {
			// Use setTimeout to ensure DOM is ready
			setTimeout(() => cell.focus(), 0)
		}
	}
}

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
import { focusCellTd } from './focus.js'

/** The open editor's text (+ caret) before a render replaced it — see captureEditorText(). */
export type EditorText = {
	rowIndex: number
	field: string
	value: string
	selectionStart: number | null
	selectionEnd: number | null
	selectionDirection: 'forward' | 'backward' | 'none' | null
}

/**
 * The text typed into the open cell editor (text / number / combobox / autocomplete input), read
 * before a render rebuilds the body (`items` replaced, the normal ⇄ virtual switch, …): the edit
 * goes on, so restoreFocusAfterRender() puts the typed text and caret back into the new editor.
 * The date input is left to the date picker's own reopen (it copies the text itself).
 */
export function captureEditorText<T>(ctx: GridHost<T>): EditorText | null {
	const editing = ctx.engine.editingCell
	if (!editing) return null
	const input = ctx.shadow.querySelector(
		`input.wg__editor--text[data-row="${editing.rowIndex}"][data-field="${editing.field}"],
		 input.wg__editor--number[data-row="${editing.rowIndex}"][data-field="${editing.field}"],
		 .wg__combobox-input[data-row="${editing.rowIndex}"][data-field="${editing.field}"],
		 .wg__autocomplete-input[data-row="${editing.rowIndex}"][data-field="${editing.field}"]`
	) as HTMLInputElement | null
	if (!input) return null
	let selectionStart: number | null = null
	let selectionEnd: number | null = null
	let selectionDirection: EditorText['selectionDirection'] = null
	try {
		selectionStart = input.selectionStart
		selectionEnd = input.selectionEnd
		selectionDirection = input.selectionDirection
	} catch { /* no selection API (number input) */ }
	return { rowIndex: editing.rowIndex, field: editing.field, value: input.value, selectionStart, selectionEnd, selectionDirection }
}

/**
 * Restore focus after a render — either to the in-progress editor (with
 * the configured selection behavior) or to the previously focused cell.
 */
export function restoreFocusAfterRender<T>(
	ctx: GridHost<T>,
	container: HTMLElement,
	focusedCell: FocusedCell | null,
	editorText: EditorText | null = null
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
		// The same edit re-rendered (not a fresh one): its typed text + caret come back
		const kept = editorText && editorText.rowIndex === rowIndex && editorText.field === field
			&& editor instanceof HTMLInputElement && editor.classList.contains('wg__date-input') === false
			? editorText : null
		if (editor && kept) {
			const input = editor as HTMLInputElement
			input.value = kept.value
			input.focus()
			if (kept.selectionStart !== null && kept.selectionEnd !== null) {
				try {
					input.setSelectionRange(kept.selectionStart, kept.selectionEnd, kept.selectionDirection ?? undefined)
				} catch { /* no selection API (number input) */ }
			}
		} else if (editor) {
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
		) as HTMLElement | null
		// Never pulled from an element outside the grid that holds the focus now
		const docActive = document.activeElement
		const host = ctx.shadow.host
		const isFocusElsewhere = !!docActive && docActive !== document.body && docActive !== host && !host.contains(docActive)
		if (cell) {
			// Now, not on a timer: the render just replaced the focused cell, and a key pressed
			// before a deferred focus() landed on nothing (two quick Shift+Arrows grew the range
			// by one). The new cell is in the DOM already. (focusCellTd: outside navigate mode the
			// re-rendered cell has no tabindex of its own.)
			if (ctx.shadow.activeElement !== cell && !isFocusElsewhere) focusCellTd(cell)
		} else if (ctx.engine.shouldUseVirtualScroll() && !ctx.shadow.activeElement && !isFocusElsewhere) {
			// Virtual scroll: the focused row is outside the rendered window (a Shift+Arrow range
			// scrolled its anchor away) — the keyboard stays in the grid on the container, the
			// focused cell is kept; the next key brings its row back (container-keydown)
			container.focus({ preventScroll: true })
		}
	}
}

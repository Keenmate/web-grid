// =============================================================================
// Table click / dblclick handlers
// =============================================================================
// Four distinct listeners that all fire on the <table> element. Kept here so
// the click-related dispatch logic lives together:
//
//  - handleTableDblClick: pipeline-first, then `dblclick` / `navigate` edit-
//    trigger paths. Notably we DON'T rely on the native dblclick alone for
//    edit-on-doubleclick — `handleTableMouseDown` covers that for trees via
//    MouseEvent.detail because the cell's <td> is re-rendered between clicks
//    and the browser drops the dblclick when the two click targets differ.
//  - handleCellClickToEdit: tree chevron toggle, then pipeline, then
//    `click` edit-trigger. After startEdit, dropdown / custom editors are
//    opened in an RAF callback so the editor DOM exists.
//  - handleSelectTriggerClick: legacy select trigger toggle. Skipped in
//    'always' editTrigger mode because the pipeline opens the dropdown via
//    shouldShowDropdownOnFocus — re-running it here would toggle-close it.
//  - handleHeaderColumnSelectClick: only fires when isColumnReorderAllowed
//    is on (otherwise the mousedown handler does column selection). Plain /
//    Shift / Ctrl pick replace / range / toggle.

import type { GridContext } from '../grid-context.js'
import { uiLogger } from '../../logger.js'
import { openDropdownForCurrentEditor, toggleDropdown } from '../dropdown/index.js'
import { tryStartEdit, getCursorPositionFromClick } from '../navigation/index.js'
import { removeRangeBorder } from '../cell-selection/index.js'
import { isReordering } from '../reorder/index.js'

/**
 * Pipeline-first dblclick handler. The pipeline owns `always` editTrigger
 * cells; remaining cells fall through to dblclick / navigate edit-trigger
 * paths with cursor positioning derived from the click point.
 */
export function handleTableDblClick<T>(ctx: GridContext<T>, e: Event): void {
	const target = e.target as HTMLElement

	// Try pipeline first
	if (ctx.pipelineAdapter?.tryHandleDblClick(e as MouseEvent)) {
		return
	}

	e.preventDefault()
	const cell = target.closest('.wg__cell') as HTMLElement
	if (cell) {
		const rowIndex = parseInt(cell.dataset.row || '0', 10)
		const colIndex = parseInt(cell.dataset.col || '0', 10)
		const column = ctx.grid.columns[colIndex]
		if (column) {
			const trigger = column.editTrigger || ctx.grid.editTrigger
			if (trigger === 'dblclick' || trigger === 'navigate') {
				const cursorPos = getCursorPositionFromClick(e as MouseEvent, cell)
				tryStartEdit(ctx, rowIndex, colIndex, { cursorPosition: cursorPos ?? undefined })
				const editor = column.editor
				if (editor === 'select' || editor === 'combobox' || editor === 'autocomplete') {
					requestAnimationFrame(() => {
						if (!ctx.dropdown.isOpen) {
							openDropdownForCurrentEditor(ctx)
						}
					})
				} else if (editor === 'custom') {
					requestAnimationFrame(() => {
						ctx.openCustomEditor(rowIndex, colIndex)
					})
				}
			}
		}
	}
}

/**
 * Single-click handler: tree chevron > pipeline > click editTrigger start.
 */
export function handleCellClickToEdit<T>(ctx: GridContext<T>, e: Event): void {
	const target = e.target as HTMLElement
	uiLogger.debug('CLICK fired | target:', target.tagName, target.className, '| connected:', target.isConnected)

	// Tree chevron toggle — handle first so we don't fall through to edit/select logic
	const chevron = target.closest('.wg__tree-chevron[data-tree-toggle]') as HTMLElement
	if (chevron) {
		e.preventDefault()
		e.stopPropagation()
		const path = chevron.getAttribute('data-tree-toggle')
		uiLogger.debug('chevron click:', path, '| target:', target.tagName, target.className)
		if (path !== null) {
			ctx.grid.toggleExpandedPath(path)
		}
		return
	}

	// Try pipeline first
	if (ctx.pipelineAdapter?.tryHandleClick(e as MouseEvent)) {
		return
	}

	const cell = target.closest('.wg__cell') as HTMLElement
	if (cell && !cell.classList.contains('wg__cell--editing')) {
		const rowIndex = parseInt(cell.dataset.row || '0', 10)
		const colIndex = parseInt(cell.dataset.col || '0', 10)
		const column = ctx.grid.columns[colIndex]
		if (column) {
			const trigger = column.editTrigger || ctx.grid.editTrigger
			if (trigger === 'click') {
				e.preventDefault()
				const cursorPos = getCursorPositionFromClick(e as MouseEvent, cell)
				tryStartEdit(ctx, rowIndex, colIndex, { cursorPosition: cursorPos ?? undefined })
				const editor = column.editor
				if (editor === 'select' || editor === 'combobox' || editor === 'autocomplete') {
					requestAnimationFrame(() => {
						if (!ctx.dropdown.isOpen) {
							openDropdownForCurrentEditor(ctx)
						}
					})
				} else if (editor === 'custom') {
					requestAnimationFrame(() => {
						ctx.openCustomEditor(rowIndex, colIndex)
					})
				}
			}
		}
	}
}

/**
 * Legacy click on a .wg__select-trigger / .wg__select-value — toggles the
 * select dropdown. Skipped in `always` editTrigger mode (pipeline opens the
 * dropdown there via shouldShowDropdownOnFocus; re-toggling would close it).
 */
export function handleSelectTriggerClick<T>(ctx: GridContext<T>, e: Event): void {
	const target = e.target as HTMLElement

	if (target.matches('.wg__select-trigger, .wg__select-value')) {
		// Skip if pipeline handles this cell (always mode)
		const cell = target.closest('.wg__cell') as HTMLElement
		if (cell) {
			const colIndex = parseInt(cell.dataset.col || '', 10)
			const column = ctx.grid.columns[colIndex]
			const trigger = column?.editTrigger ?? ctx.grid.editTrigger
			if (trigger === 'always') return
		}
		e.preventDefault()
		e.stopPropagation()
		toggleDropdown(ctx)
	}
}

/**
 * Header click → column selection (replace / range / toggle by modifiers).
 * Only fires when isColumnReorderAllowed is on — otherwise the mousedown
 * handler owns column selection. Sort-indicator + resize-handle clicks are
 * filtered out earlier in the listener chain.
 */
export function handleHeaderColumnSelectClick<T>(ctx: GridContext<T>, e: Event): void {
	const mouseEvent = e as MouseEvent
	const target = mouseEvent.target as HTMLElement

	// Skip if clicking on resize handle or sort indicator
	if (target.closest('.wg__resize-handle')) return
	if (target.closest('.wg__sort-indicator')) return
	// Skip if reordering was just performed (prevents accidental selection on drop)
	if (isReordering()) return
	// Skip if column reorder is disabled (mousedown handler handles column selection)
	if (!ctx.grid.isColumnReorderAllowed) return

	// Click on header = column selection
	const header = target.closest('.wg__header:not(.wg__row-number-header):not(.wg__inline-actions-header):not(.wg__actions-column):not(.wg__filler)') as HTMLElement
	if (header) {
		e.preventDefault()
		const field = header.dataset.field
		if (!field) return

		// Find visual column index
		const colIndex = ctx.grid.visualColumns.findIndex(vc => String(vc.column.field) === field)
		if (colIndex === -1) return

		// Remove any existing cell range border (column selection doesn't use border)
		removeRangeBorder()

		// Ctrl = toggle individual column, Shift = range, plain = replace
		if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
			ctx.grid.selectColumn(colIndex, 'toggle')
		} else if (mouseEvent.shiftKey) {
			ctx.grid.selectColumn(colIndex, 'range')
		} else {
			ctx.grid.selectColumn(colIndex, 'replace')
		}

		ctx.render()

		// Focus container for keyboard shortcuts
		requestAnimationFrame(() => {
			const container = ctx.shadow.querySelector('.wg') as HTMLElement
			container?.focus({ preventScroll: true })
		})
	}
}

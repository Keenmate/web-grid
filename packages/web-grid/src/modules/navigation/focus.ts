// =============================================================================
// Navigation Focus Module
// Low-level focus management utilities
// =============================================================================

import type { FocusedCell } from '../../types.js'
import type { GridHost } from '../grid-context.js'
import { renderCell } from '../rendering/index.js'
import { removeDropdown } from '../dropdown/rendering.js'
import { removeFillHandle } from '../fill-handle/index.js'

/**
 * Focus the appropriate element within a cell.
 * In 'always' edit mode, focuses the editor input inside the cell.
 * Otherwise, focuses the cell element itself.
 */
function focusElementInCell(cell: HTMLElement, isAlwaysEditMode: boolean): void {
	if (isAlwaysEditMode) {
		// In 'always' mode, find and focus the editor input inside the cell
		// First try specific focusable inputs (combobox/autocomplete/date have wrapper divs)
		// Then fall back to .wg__editor (for text/number inputs where the input IS the .wg__editor)
		let editor = cell.querySelector(
			'.wg__combobox-input, .wg__autocomplete-input, .wg__date-input, .wg__select-trigger'
		) as HTMLElement
		if (!editor) {
			editor = cell.querySelector('.wg__editor') as HTMLElement
		}
		if (editor) {
			editor.focus({ preventScroll: true })
			// Select all text in text inputs for easier editing
			if (editor instanceof HTMLInputElement && editor.type === 'text') {
				editor.select()
			}
			return
		}
	}
	// Default: focus the cell itself
	cell.focus({ preventScroll: true })
}

/**
 * Focus a cell element in the DOM
 * In virtual scroll mode, only scroll if cell is outside viewport (minimal scroll)
 */
export function focusCellElement<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	colIndex: number
): void {
	// Check if this cell uses 'always' editTrigger
	const column = ctx.engine.columns[colIndex]
	const effectiveTrigger = column?.editTrigger ?? ctx.engine.editTrigger
	const isAlwaysEditMode = effectiveTrigger === 'always'

	// In virtual scroll mode: only scroll if row is outside viewport
	if (ctx.engine.shouldUseVirtualScroll()) {
		ensureRowVisibleMinimal(ctx, rowIndex)
		// If row is already visible, focus immediately
		const cell = ctx.shadow.querySelector(
			`[data-row="${rowIndex}"][data-col="${colIndex}"]`
		) as HTMLElement
		if (cell) {
			focusElementInCell(cell, isAlwaysEditMode)
			// Ensure cell isn't hidden behind frozen columns
			ensureCellNotBehindFrozen(ctx, cell, rowIndex)
		}
		// If not visible, scroll triggered re-render which will focus via renderVirtualRows
		return
	}

	// Normal mode: focus the cell and scroll into view
	const cell = ctx.shadow.querySelector(
		`[data-row="${rowIndex}"][data-col="${colIndex}"]`
	) as HTMLElement
	if (!cell) return

	focusElementInCell(cell, isAlwaysEditMode)

	// Let scrollIntoView handle the main scrolling (both axes)
	cell.scrollIntoView({ block: 'nearest', inline: 'nearest' })

	// After scrollIntoView, adjust for sticky elements it doesn't account for
	const header = ctx.shadow.querySelector('.wg__header') as HTMLElement
	const scrollContainer = ctx.shadow.querySelector('.wg') as HTMLElement

	if (header && scrollContainer) {
		const cellRect = cell.getBoundingClientRect()

		// Check if cell is obscured by sticky header (vertical)
		const headerRect = header.getBoundingClientRect()
		if (cellRect.top < headerRect.bottom) {
			const scrollAmount = cellRect.top - headerRect.bottom - 4
			scrollContainer.scrollBy({ top: scrollAmount, behavior: 'instant' })
		}

		// Check if cell is obscured by frozen columns (horizontal)
		ensureCellNotBehindFrozen(ctx, cell, rowIndex)
	}
}

/**
 * If cell is behind frozen columns, scroll horizontally to reveal it
 */
export function ensureCellNotBehindFrozen<T>(
	ctx: GridHost<T>,
	cell: HTMLElement,
	rowIndex: number
): void {
	const scrollContainer = ctx.shadow.querySelector('.wg') as HTMLElement
	if (!scrollContainer) return

	const lastFrozenCell = ctx.shadow.querySelector(
		`tr[data-row-index="${rowIndex}"] .wg__cell--frozen-last`
	) as HTMLElement
	if (!lastFrozenCell) return

	const frozenRight = lastFrozenCell.getBoundingClientRect().right
	const cellRect = cell.getBoundingClientRect()
	if (cellRect.left < frozenRight) {
		scrollContainer.scrollBy({ left: cellRect.left - frozenRight, behavior: 'instant' })
	}
}

/**
 * Ensure a row is visible with minimal scrolling (only if outside viewport)
 * Used for arrow key navigation - doesn't reposition, just ensures visibility
 */
function ensureRowVisibleMinimal<T>(ctx: GridHost<T>, rowIndex: number): void {
	const container = ctx.shadow.querySelector('.wg') as HTMLElement
	if (!container) return

	const rowHeight = ctx.engine.virtualScrollRowHeight
	const scrollTop = container.scrollTop
	const viewportHeight = container.clientHeight

	// Account for sticky header
	const header = ctx.shadow.querySelector('.wg__header') as HTMLElement
	const headerHeight = header?.offsetHeight || 0

	const rowTop = rowIndex * rowHeight
	const rowBottom = rowTop + rowHeight
	const visibleTop = scrollTop + headerHeight
	const visibleBottom = scrollTop + viewportHeight

	// Only scroll if row is outside viewport
	if (rowTop < visibleTop) {
		// Row is above viewport - scroll up to show it
		container.scrollTop = rowTop - headerHeight
	} else if (rowBottom > visibleBottom) {
		// Row is below viewport - scroll down to show it
		container.scrollTop = rowBottom - viewportHeight
	}
	// If row is visible, don't scroll at all
}

/**
 * Scroll to position a row as the second visible row (for PageUp/PageDown)
 * Exported so keyboard handlers can use it directly
 */
export function scrollToRowPosition<T>(ctx: GridHost<T>, rowIndex: number): void {
	const container = ctx.shadow.querySelector('.wg') as HTMLElement
	if (!container) return

	const rowHeight = ctx.engine.virtualScrollRowHeight

	// Position target row as second visible row (rowIndex - 1 at top)
	// This gives one row of context above the target
	const targetScrollTop = Math.max(0, (rowIndex - 1) * rowHeight)

	// Clamp to valid range
	const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)
	container.scrollTop = Math.min(targetScrollTop, maxScroll)
}

// Track last focus visual update to debounce rapid changes during double-click
let lastFocusVisualUpdate = 0
const FOCUS_VISUAL_DEBOUNCE_MS = 100

/**
 * Update focus visual state surgically (without full re-render)
 * Uses centralized renderCell() to ensure all states are correct
 */
export function updateFocusVisual<T>(
	ctx: GridHost<T>,
	oldFocus: FocusedCell | null,
	newFocus: FocusedCell | null
): void {
	// Debounce rapid focus visual changes on SAME cell (happens during double-click)
	// Don't debounce when focus is actually moving to a different cell
	const isSameCell = oldFocus && newFocus &&
		oldFocus.rowIndex === newFocus.rowIndex &&
		oldFocus.colIndex === newFocus.colIndex
	const now = Date.now()
	if (isSameCell && now - lastFocusVisualUpdate < FOCUS_VISUAL_DEBOUNCE_MS) {
		return
	}
	lastFocusVisualUpdate = now

	const editingCell = ctx.engine.editingCell

	// Re-render old cell (will remove --focused class)
	// Skip re-render if this cell is currently being edited or in 'always' mode (don't disrupt editor)
	// For 'always' mode: renderCell triggers renderer side effects (overwrites ctx.dropdown.filterText
	// / ctx.dropdown.options) which leaks state to the next cell's dropdown open
	// But still remove focus CSS class
	if (oldFocus) {
		const isOldCellEditing = editingCell &&
			editingCell.rowIndex === oldFocus.rowIndex &&
			ctx.engine.columns.findIndex(c => String(c.field) === editingCell.field) === oldFocus.colIndex
		const oldColumn = ctx.engine.columns[oldFocus.colIndex]
		const oldTrigger = oldColumn?.editTrigger ?? ctx.engine.editTrigger
		const isOldCellAlwaysMode = oldTrigger === 'always'

		if (!isOldCellEditing && !isOldCellAlwaysMode) {
			renderCell(ctx, oldFocus.rowIndex, oldFocus.colIndex)
		} else {
			// Old cell is being edited or in 'always' mode - just remove focus class
			// Editor will be cleaned up later by tryStartEdit when click fires
			const cell = ctx.shadow.querySelector(
				`td[data-row="${oldFocus.rowIndex}"][data-col="${oldFocus.colIndex}"]`
			) as HTMLElement
			if (cell) {
				cell.classList.remove('wg__cell--focused', 'wg__cell--always-edit-focused')
			}
		}
	}

	// Re-render new cell (will add --focused class)
	// Skip if this cell is currently being edited (don't disrupt editor)
	// Also skip for 'always' mode cells (editor always visible, don't disrupt it)
	// Also skip for 'click'/'dblclick' modes - re-rendering between mousedown and click
	// would remove the original target element, preventing the click event from firing
	if (newFocus) {
		const column = ctx.engine.columns[newFocus.colIndex]
		const effectiveTrigger = column?.editTrigger ?? ctx.engine.editTrigger
		const isAlwaysMode = effectiveTrigger === 'always'
		const isClickOrDblClickMode = effectiveTrigger === 'click' || effectiveTrigger === 'dblclick'

		const isNewCellEditing = editingCell &&
			editingCell.rowIndex === newFocus.rowIndex &&
			ctx.engine.columns.findIndex(c => String(c.field) === editingCell.field) === newFocus.colIndex

		if (!isNewCellEditing && !isAlwaysMode && !isClickOrDblClickMode) {
			renderCell(ctx, newFocus.rowIndex, newFocus.colIndex)
		} else if (isAlwaysMode || isClickOrDblClickMode) {
			// Just update CSS classes, don't re-render content
			// For 'always' mode: would lose typed input
			// For 'click'/'dblclick': would prevent click event from firing
			const cell = ctx.shadow.querySelector(
				`td[data-row="${newFocus.rowIndex}"][data-col="${newFocus.colIndex}"]`
			) as HTMLElement
			if (cell) {
				cell.classList.add('wg__cell--focused')
				if (isAlwaysMode) {
					cell.classList.add('wg__cell--always-edit-focused')
				}
			}
		}
	}
}

/**
 * Surgically remove the editing visual (blue border) from current editing cell.
 * Call this BEFORE cancelEdit() to ensure the DOM class is removed immediately.
 * NOTE: This just removes the class - full cell restoration happens via renderCell()
 * after cancelEdit() clears the state.
 */
export function clearEditingVisual<T>(ctx: GridHost<T>): void {
	const editingCell = ctx.engine.editingCell
	if (editingCell) {
		const colIndex = ctx.engine.columns.findIndex(c => String(c.field) === editingCell.field)
		const cell = ctx.shadow.querySelector(
			`[data-row="${editingCell.rowIndex}"][data-col="${colIndex}"]`
		) as HTMLElement
		if (cell) {
			cell.classList.remove('wg__cell--editing')
		}
	}
}

/**
 * Fully restore an editing cell to display mode.
 * Must be called AFTER cancelEdit() so the cell renders in display mode.
 */
export function restoreEditingCellToDisplayMode<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	colIndex: number
): void {
	renderCell(ctx, rowIndex, colIndex)
}

/**
 * Handle cell focus event
 */
export function handleCellFocus<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	colIndex: number
): void {
	if (!ctx.engine.isNavigateMode) return

	const oldFocus = ctx.engine.focusedCell
	const newFocus = { rowIndex, colIndex }

	// Skip if already focused on this cell
	if (oldFocus?.rowIndex === rowIndex && oldFocus?.colIndex === colIndex) {
		return
	}

	ctx.engine.setFocusedCell(rowIndex, colIndex)  // Just updates state (no re-render)
	updateFocusVisual(ctx, oldFocus, newFocus)     // Updates DOM directly
}

/**
 * Helper to move focus to a new cell with surgical DOM updates
 */
export function moveFocus<T>(
	ctx: GridHost<T>,
	newRowIndex: number,
	newColIndex: number
): void {
	const oldFocus = ctx.engine.focusedCell
	const newFocus = { rowIndex: newRowIndex, colIndex: newColIndex }

	ctx.engine.setFocusedCell(newRowIndex, newColIndex)
	updateFocusVisual(ctx, oldFocus, newFocus)
	focusCellElement(ctx, newRowIndex, newColIndex)
}

/**
 * Try to start editing a cell (checks if editable first)
 * Uses centralized renderCell() for surgical DOM update
 */
export function tryStartEdit<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	colIndex: number,
	options?: { initialSearchQuery?: string; cursorPosition?: number }
): void {
	const column = ctx.engine.columns[colIndex]
	if (!column) return

	const field = String(column.field)

	// Check if cell can be edited (column editability + row locking)
	if (!ctx.engine.canEditCell(rowIndex, field)) {
		return
	}

	// Remove any open dropdown before transitioning to new cell
	if (ctx.dropdown.isOpen) {
		removeDropdown(ctx)
	}

	// Clear old editing cell if editing a different cell
	// Must check editingCell, not focusedCell, because focusedCell is already updated
	// by the focusCell action that runs before startEdit
	const oldEditing = ctx.engine.editingCell
	if (oldEditing) {
		const oldColIndex = ctx.engine.columns.findIndex(c => String(c.field) === oldEditing.field)
		if (oldEditing.rowIndex !== rowIndex || oldColIndex !== colIndex) {
			// Set transition flag to prevent blur handlers from clearing focus
			ctx.isTransitioningCells = true
			// Cancel old edit FIRST so renderCell shows display mode
			// (editingCell must be null before re-rendering, otherwise the cell
			// will still render with the editing visual)
			ctx.engine.cancelEdit()
			// Now re-render - will show display mode since editingCell is null
			renderCell(ctx, oldEditing.rowIndex, oldColIndex)
		}
	}

	// Update state (no longer triggers requestUpdate)
	ctx.engine.startEdit(rowIndex, field, options)

	// Re-render the cell in edit mode with focus
	renderCell(ctx, rowIndex, colIndex, {
		focusEditor: true,
		cursorPosition: options?.cursorPosition,
		initialSearchQuery: options?.initialSearchQuery
	})

	// Clear transition flag after rendering completes
	if (ctx.isTransitioningCells) {
		requestAnimationFrame(() => {
			ctx.isTransitioningCells = false
		})
	}
}

/**
 * Calculate cursor position from a click event using binary search (v3 pattern)
 */
export function getCursorPositionFromClick(
	event: MouseEvent,
	cell: HTMLElement
): number | null {
	// Find the text span inside the cell
	// Check multiple selectors: regular text, dropdown display value, date display value
	const textSpan = cell.querySelector('.wg__cell-text, .wg__select-value, .wg__date-value') as HTMLElement
	if (!textSpan) return null

	const text = textSpan.textContent || ''
	if (!text.length) return 0

	const clickX = event.clientX
	const spanRect = textSpan.getBoundingClientRect()

	// If click is before the text, position at start
	if (clickX <= spanRect.left) return 0
	// If click is after the text, position at end
	if (clickX >= spanRect.right) return text.length

	// Find text node
	const textNode = textSpan.firstChild
	if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null

	// Binary search for the character position
	const range = document.createRange()
	let low = 0
	let high = text.length

	try {
		while (low < high) {
			const mid = Math.floor((low + high) / 2)
			range.setStart(textNode, 0)
			range.setEnd(textNode, mid)
			const rect = range.getBoundingClientRect()

			if (rect.right < clickX) {
				low = mid + 1
			} else {
				high = mid
			}
		}

		// Fine-tune: check if click is closer to before or after this character
		if (low > 0 && low < text.length) {
			range.setStart(textNode, low - 1)
			range.setEnd(textNode, low)
			const charRect = range.getBoundingClientRect()
			const charMidpoint = charRect.left + charRect.width / 2
			if (clickX < charMidpoint) {
				low--
			}
		}
	} catch {
		return text.length
	}

	return low
}

/**
 * Centralized cleanup of edit/dropdown/focus state.
 * Call this from any focus-changing path that bypasses the action pipeline
 * (e.g. column selection, row selection) to ensure consistent cleanup.
 */
export function cleanupEditState<T>(ctx: GridHost<T>): void {
	if (ctx.dropdown.isOpen) {
		removeDropdown(ctx)
	}
	if (ctx.engine.editingCell) {
		const editingCell = ctx.engine.editingCell
		const colIndex = ctx.engine.columns.findIndex(c => String(c.field) === editingCell.field)
		clearEditingVisual(ctx)
		ctx.engine.cancelEdit()
		if (colIndex >= 0) {
			renderCell(ctx, editingCell.rowIndex, colIndex)
		}
	}
	if (ctx.engine.focusedCell) {
		const oldFocus = ctx.engine.focusedCell
		ctx.engine.clearFocusedCell()
		updateFocusVisual(ctx, oldFocus, null)
		removeFillHandle(ctx.shadow.host as HTMLElement)
	}
}

/**
 * Handle focus leaving the table
 * Defers cleanup to allow focus transitions to complete
 */
export function handleTableFocusOut<T>(ctx: GridHost<T>, e: FocusEvent): void {
	// Skip if we're transitioning between cells (editor removal triggers blur)
	if (ctx.isTransitioningCells) {
		return
	}

	const relatedTarget = e.relatedTarget as HTMLElement
	const table = ctx.shadow.querySelector('.wg__table')

	// If relatedTarget is in the table, focus is staying - no action needed
	if (relatedTarget && table?.contains(relatedTarget)) {
		return
	}

	// If focus is moving into one of our document.body-hosted popovers (date
	// picker, context menu, header context menu), treat it as staying inside
	// the component — otherwise the cleanup below would re-render the cell,
	// detach the popover's anchor, and Floating UI's autoUpdate would silently
	// close the popover.
	if (relatedTarget && isInsideOwnedPopover(ctx, relatedTarget)) {
		return
	}

	// Defer the check to allow focus to stabilize after cell.focus() calls
	requestAnimationFrame(() => {
		// Re-check transitioning flag (may have changed)
		if (ctx.isTransitioningCells) {
			return
		}

		// Check if focus is still within the component
		const activeElement = ctx.shadow.activeElement as HTMLElement
		const activeIsInTable = activeElement && table?.contains(activeElement)

		// If activeElement is still in the table, don't clear focus
		if (activeIsInTable) {
			return
		}

		// Check if the web component (shadow host) still has focus
		const host = ctx.shadow.host as HTMLElement
		const componentHasFocus = document.activeElement === host ||
			host.contains(document.activeElement as Node)

		if (componentHasFocus) {
			return
		}

		// Same check as the synchronous one above, but using the post-rAF
		// activeElement — covers cases where the focus shift happens between
		// the focusout event and the next frame.
		if (isInsideOwnedPopover(ctx, document.activeElement as HTMLElement | null)) {
			return
		}

		// Focus truly left the component - clear focus state
		const oldFocus = ctx.engine.focusedCell
		ctx.engine.clearFocusedCell()
		updateFocusVisual(ctx, oldFocus, null)
		// Only remove fill handle if this grid owns it (prevents one grid from removing another's)
		removeFillHandle(host)
	})
}

/**
 * Returns true if `node` is inside any of this grid's document.body-hosted
 * popovers (datepicker, cell context menu, header context menu).
 */
function isInsideOwnedPopover<T>(ctx: GridHost<T>, node: Node | null): boolean {
	if (!node) return false
	const dpEl = ctx.datepicker?.getElement() ?? null
	if (dpEl && dpEl.contains(node)) return true
	if (ctx.contextMenuElement && ctx.contextMenuElement.contains(node)) return true
	if (ctx.headerContextMenuElement && ctx.headerContextMenuElement.contains(node)) return true
	return false
}

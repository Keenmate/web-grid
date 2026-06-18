// =============================================================================
// Row Selection Module
// Multi-row selection via row number cells with drag support
// =============================================================================

import type { GridContext } from '../grid-context.js'
import { removeRangeBorder } from '../cell-selection/index.js'
import { cleanupEditState } from '../navigation/index.js'

/** Minimum distance (px) mouse must move before drag starts */
const DRAG_THRESHOLD = 5

/**
 * State for tracking row selection drag operation
 */
interface SelectionState {
	isPending: boolean      // Mouse is down but threshold not yet exceeded
	isDragging: boolean     // Actually dragging (threshold exceeded)
	startRowIndex: number
	startX: number
	startY: number
	currentRowIndex: number
}

// Module-level state
let selectionState: SelectionState = {
	isPending: false,
	isDragging: false,
	startRowIndex: -1,
	startX: 0,
	startY: 0,
	currentRowIndex: -1
}

// Store the current context for document-level handlers
let activeContext: GridContext | null = null

/**
 * Check if selection drag is in progress
 */
export function isSelecting(): boolean {
	return selectionState.isDragging
}

/**
 * Check if selection drag is pending (mouse down but not dragging yet)
 */
export function isSelectionPending(): boolean {
	return selectionState.isPending
}

/**
 * Handle mousedown on a row number cell
 */
export function handleRowNumberMouseDown<T>(ctx: GridContext<T>, rowIndex: number, event: MouseEvent): void {
	event.preventDefault()
	event.stopPropagation()

	// Close any open dropdown/edit state before selecting rows
	cleanupEditState(ctx)

	// Clear cell range selection when selecting rows
	if (ctx.grid.selectedCellRange) {
		ctx.grid.clearCellSelection()
		removeRangeBorder()
	}

	// Clear focused cell when selecting rows
	if (ctx.grid.focusedCell) {
		const { rowIndex: focusedRow, colIndex: focusedCol } = ctx.grid.focusedCell
		const focusedCellEl = ctx.shadow.querySelector(
			`.wg__cell[data-row="${focusedRow}"][data-col="${focusedCol}"]`
		)
		focusedCellEl?.classList.remove('wg__cell--focused')
		ctx.grid.clearFocusedCell()
	}

	// Determine selection mode based on modifier keys
	if (event.ctrlKey || event.metaKey) {
		// Ctrl+Click: Toggle selection
		ctx.grid.selectRow(rowIndex, 'toggle')
		// Use double RAF for reliable focus after all callbacks
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const container = ctx.shadow.querySelector('.wg') as HTMLElement | null
				container?.focus({ preventScroll: true })
			})
		})
		return
	}

	if (event.shiftKey) {
		// Shift+Click: Range selection from last selected
		ctx.grid.selectRow(rowIndex, 'range')
		// Use double RAF for reliable focus after all callbacks
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const container = ctx.shadow.querySelector('.wg') as HTMLElement | null
				container?.focus({ preventScroll: true })
			})
		})
		return
	}

	// Normal click: Start potential drag selection
	selectionState = {
		isPending: true,
		isDragging: false,
		startRowIndex: rowIndex,
		startX: event.clientX,
		startY: event.clientY,
		currentRowIndex: rowIndex
	}

	activeContext = ctx as GridContext

	// Select the row immediately (replace mode)
	ctx.grid.selectRow(rowIndex, 'replace')

	// Focus the container so keyboard shortcuts work
	// Use double RAF to ensure focus happens after all other callbacks
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			const container = ctx.shadow.querySelector('.wg') as HTMLElement | null
			container?.focus({ preventScroll: true })
		})
	})

	// Attach document-level listeners for drag
	document.addEventListener('mousemove', handleDocumentMouseMove)
	document.addEventListener('mouseup', handleDocumentMouseUp)
}

/**
 * Handle mouse move during selection drag
 */
function handleDocumentMouseMove(e: MouseEvent): void {
	if (!activeContext) return

	// If pending, check if threshold exceeded
	if (selectionState.isPending) {
		const dx = e.clientX - selectionState.startX
		const dy = e.clientY - selectionState.startY
		const distance = Math.sqrt(dx * dx + dy * dy)

		if (distance >= DRAG_THRESHOLD) {
			startActualDrag(activeContext)
		}
		return
	}

	// If not actually dragging, nothing to do
	if (!selectionState.isDragging) return

	// Find which row the mouse is over
	const rowIndex = findRowAtPoint(activeContext, e.clientY)
	if (rowIndex !== null && rowIndex !== selectionState.currentRowIndex) {
		selectionState.currentRowIndex = rowIndex
		// Update selection range
		activeContext.grid.selectRowRange(selectionState.startRowIndex, rowIndex)
	}
}

/**
 * Start the actual drag operation (after threshold exceeded)
 */
function startActualDrag<T>(ctx: GridContext<T>): void {
	selectionState.isPending = false
	selectionState.isDragging = true

	// Add selecting class to container
	const container = ctx.shadow.querySelector('.wg')
	container?.classList.add('wg--selecting')
}

/**
 * Handle mouse up - finalize selection
 */
function handleDocumentMouseUp(): void {
	if (!activeContext) return

	const ctx = activeContext

	// Remove selecting class
	const container = ctx.shadow.querySelector('.wg') as HTMLElement | null
	container?.classList.remove('wg--selecting')

	// Focus the container so keyboard shortcuts work
	// Use double RAF for reliable focus after all callbacks
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			const container = ctx.shadow.querySelector('.wg') as HTMLElement | null
			container?.focus({ preventScroll: true })
		})
	})

	// Remove document listeners
	document.removeEventListener('mousemove', handleDocumentMouseMove)
	document.removeEventListener('mouseup', handleDocumentMouseUp)

	// Reset state
	selectionState = {
		isPending: false,
		isDragging: false,
		startRowIndex: -1,
		startX: 0,
		startY: 0,
		currentRowIndex: -1
	}
	activeContext = null
}

/**
 * Find which row is at a given Y coordinate
 */
function findRowAtPoint<T>(ctx: GridContext<T>, y: number): number | null {
	const rows = ctx.shadow.querySelectorAll('.wg__row[data-row-index]')

	for (const row of rows) {
		const rect = (row as HTMLElement).getBoundingClientRect()
		if (y >= rect.top && y <= rect.bottom) {
			const rowIndex = parseInt((row as HTMLElement).dataset.rowIndex || '-1', 10)
			if (rowIndex >= 0) {
				return rowIndex
			}
		}
	}

	// If above or below all rows, return first or last
	if (rows.length > 0) {
		const firstRow = rows[0] as HTMLElement
		const lastRow = rows[rows.length - 1] as HTMLElement
		const firstRect = firstRow.getBoundingClientRect()
		const lastRect = lastRow.getBoundingClientRect()

		if (y < firstRect.top) {
			return parseInt(firstRow.dataset.rowIndex || '0', 10)
		}
		if (y > lastRect.bottom) {
			return parseInt(lastRow.dataset.rowIndex || '0', 10)
		}
	}

	return null
}

/**
 * Clear selection when clicking outside row numbers
 */
export function handleContainerClick<T>(ctx: GridContext<T>, event: MouseEvent): void {
	const target = event.target as HTMLElement

	// Don't clear if clicking on row number
	if (target.closest('.wg__row-number[data-row-number]')) {
		return
	}

	// Don't clear if clicking on other interactive elements
	if (target.closest('input, select, button, .wg__toolbar')) {
		return
	}

	// Clear selection
	ctx.grid.clearSelection()
}

/**
 * Handle Escape key to clear selection
 */
export function handleEscapeKey<T>(ctx: GridContext<T>): boolean {
	if (ctx.grid.selectedRows.length > 0) {
		ctx.grid.clearSelection()
		return true // Handled
	}
	return false // Not handled
}

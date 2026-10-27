// =============================================================================
// Column Selection Module
// Multi-column selection via column headers with drag support
// Only active when column reorder is disabled
// =============================================================================

import type { GridHost } from '../grid-context.js'
import { removeRangeBorder } from '../cell-selection/index.js'
import { cleanupEditState } from '../navigation/index.js'

/** Minimum distance (px) mouse must move before drag starts */
const DRAG_THRESHOLD = 5

/**
 * State for tracking column selection drag operation
 */
interface ColumnSelectionState {
	isPending: boolean      // Mouse is down but threshold not yet exceeded
	isDragging: boolean     // Actually dragging (threshold exceeded)
	startColIndex: number
	startX: number
	startY: number
	currentColIndex: number
}

// Module-level state
let selectionState: ColumnSelectionState = {
	isPending: false,
	isDragging: false,
	startColIndex: -1,
	startX: 0,
	startY: 0,
	currentColIndex: -1
}

// Store the current context for document-level handlers
let activeContext: GridHost | null = null

/**
 * Focus the .wg container so keyboard shortcuts (Escape, range shortcuts) work.
 *
 * Why both microtask and double-RAF: the microtask fires before any subsequent
 * dispatched event (relied on by Playwright tests + fast keyboard input). The
 * double-RAF is a safety net for the case where the browser overwrites focus
 * during the click sequence — by the second RAF the click sequence has fully
 * settled and the focus call is durable.
 */
function focusContainerForShortcuts<T>(ctx: GridHost<T>): void {
	queueMicrotask(() => {
		const container = ctx.shadow.querySelector('.wg') as HTMLElement | null
		container?.focus({ preventScroll: true })
	})
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			const container = ctx.shadow.querySelector('.wg') as HTMLElement | null
			container?.focus({ preventScroll: true })
		})
	})
}

/**
 * Check if column selection drag is in progress
 */
export function isColumnSelecting(): boolean {
	return selectionState.isDragging
}

/**
 * Check if column selection drag is pending (mouse down but not dragging yet)
 */
export function isColumnSelectionPending(): boolean {
	return selectionState.isPending
}

/**
 * Handle mousedown on a column header (when reorder is disabled)
 */
export function handleHeaderMouseDown<T>(ctx: GridHost<T>, colIndex: number, event: MouseEvent): void {
	event.preventDefault()
	event.stopPropagation()

	// Close any open dropdown/edit state before selecting columns
	cleanupEditState(ctx)

	// One selection-change notification per gesture (ends on mouseup, or below for Ctrl)
	ctx.engine.beginSelectionGesture()

	// Clear cell range selection when selecting columns
	if (ctx.engine.selectedCellRange) {
		ctx.engine.clearCellSelection()
		removeRangeBorder()
	}

	// Determine selection mode based on modifier keys
	if (event.ctrlKey || event.metaKey) {
		// Ctrl+Click: Toggle selection
		ctx.engine.selectColumn(colIndex, 'toggle')
		ctx.engine.endSelectionGesture()
		focusContainerForShortcuts(ctx)
		return
	}

	// Normal or Shift click: Start potential drag selection
	selectionState = {
		isPending: true,
		isDragging: false,
		startColIndex: colIndex,
		startX: event.clientX,
		startY: event.clientY,
		currentColIndex: colIndex
	}

	activeContext = ctx as GridHost

	if (event.shiftKey) {
		// Shift+Click: Range selection from last selected, but also allow drag to extend
		ctx.engine.selectColumn(colIndex, 'range')
	} else {
		// Plain click: Select single column (replace mode)
		ctx.engine.selectColumn(colIndex, 'replace')
	}

	// Focus the container so keyboard shortcuts work
	focusContainerForShortcuts(ctx)

	// Attach document-level listeners for drag
	document.addEventListener('mousemove', handleDocumentMouseMove)
	document.addEventListener('mouseup', handleDocumentMouseUp)
}

/**
 * Handle mouse move during column selection drag
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

	// Find which column the mouse is over
	const colIndex = findColumnAtPoint(activeContext, e.clientX)
	if (colIndex !== null && colIndex !== selectionState.currentColIndex) {
		selectionState.currentColIndex = colIndex
		// Update selection range
		activeContext.engine.selectColumnRange(selectionState.startColIndex, colIndex)
	}
}

/**
 * Start the actual drag operation (after threshold exceeded)
 */
function startActualDrag<T>(ctx: GridHost<T>): void {
	selectionState.isPending = false
	selectionState.isDragging = true

	// Add selecting class to container
	const container = ctx.shadow.querySelector('.wg')
	container?.classList.add('wg--selecting-columns')
}

/**
 * Handle mouse up - finalize column selection
 */
function handleDocumentMouseUp(): void {
	if (!activeContext) return

	const ctx = activeContext

	// The drag is over: notify the column selection once
	ctx.engine.endSelectionGesture()

	// Remove selecting class
	const container = ctx.shadow.querySelector('.wg') as HTMLElement | null
	container?.classList.remove('wg--selecting-columns')

	// Focus the container so keyboard shortcuts work
	focusContainerForShortcuts(ctx)

	// Remove document listeners
	document.removeEventListener('mousemove', handleDocumentMouseMove)
	document.removeEventListener('mouseup', handleDocumentMouseUp)

	// Reset state
	selectionState = {
		isPending: false,
		isDragging: false,
		startColIndex: -1,
		startX: 0,
		startY: 0,
		currentColIndex: -1
	}
	activeContext = null
}

/**
 * Find which column is at a given X coordinate
 * Uses header cells for accurate position detection
 */
function findColumnAtPoint<T>(ctx: GridHost<T>, x: number): number | null {
	// Get all data column headers (exclude row number header, inline actions, actions column, filler)
	const headers = ctx.shadow.querySelectorAll(
		'.wg__header:not(.wg__row-number-header):not(.wg__inline-actions-header):not(.wg__actions-column):not(.wg__filler)'
	)

	const visualColumns = ctx.engine.visualColumns

	for (const header of headers) {
		const rect = (header as HTMLElement).getBoundingClientRect()
		if (x >= rect.left && x <= rect.right) {
			const field = (header as HTMLElement).dataset.field
			if (field) {
				// Find visual column index by field
				const colIndex = visualColumns.findIndex(vc => String(vc.column.field) === field)
				if (colIndex >= 0) {
					return colIndex
				}
			}
		}
	}

	// If left or right of all columns, return first or last
	if (headers.length > 0) {
		const firstHeader = headers[0] as HTMLElement
		const lastHeader = headers[headers.length - 1] as HTMLElement
		const firstRect = firstHeader.getBoundingClientRect()
		const lastRect = lastHeader.getBoundingClientRect()

		if (x < firstRect.left) {
			const field = firstHeader.dataset.field
			if (field) {
				const colIndex = visualColumns.findIndex(vc => String(vc.column.field) === field)
				if (colIndex >= 0) return colIndex
			}
			return 0
		}
		if (x > lastRect.right) {
			const field = lastHeader.dataset.field
			if (field) {
				const colIndex = visualColumns.findIndex(vc => String(vc.column.field) === field)
				if (colIndex >= 0) return colIndex
			}
			return visualColumns.length - 1
		}
	}

	return null
}

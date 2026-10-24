// =============================================================================
// Cell Range Selection Module
// Excel-like cell range selection via click+drag or shift+click
// =============================================================================

import type { GridHost } from '../grid-context.js'
import type { CellRange, Column } from '../../types.js'
import { updateFocusVisual, focusCellElement } from '../navigation/index.js'

/** Minimum distance (px) mouse must move before drag starts */
const DRAG_THRESHOLD = 5

/**
 * State for tracking cell selection drag operation
 */
interface CellSelectionState {
	isPending: boolean      // Mouse is down but threshold not yet exceeded
	isDragging: boolean     // Actually dragging (threshold exceeded)
	startRowIndex: number
	startColIndex: number
	startX: number
	startY: number
	currentRowIndex: number
	currentColIndex: number
	rangeBorder: HTMLElement | null  // Border shown during drag and after
}

// Module-level state
let selectionState: CellSelectionState = {
	isPending: false,
	isDragging: false,
	startRowIndex: -1,
	startColIndex: -1,
	startX: 0,
	startY: 0,
	currentRowIndex: -1,
	currentColIndex: -1,
	rangeBorder: null
}

// Store the current context for document-level handlers
let activeContext: GridHost | null = null

// rAF throttle state for mousemove
let pendingMouseEvent: MouseEvent | null = null
let dragRafId: number | null = null

/**
 * Check if cell selection drag is in progress
 */
export function isCellSelecting(): boolean {
	return selectionState.isDragging
}

/**
 * Check if cell selection drag is pending (mouse down but not dragging yet)
 */
export function isCellSelectionPending(): boolean {
	return selectionState.isPending
}

/**
 * Handle mousedown on a cell to start selection
 */
export function handleCellMouseDown<T>(ctx: GridHost<T>, rowIndex: number, colIndex: number, event: MouseEvent): void {
	// DON'T preventDefault() immediately - let the cell get focus first
	// We'll preventDefault() later if/when drag threshold is exceeded

	// Clear any existing selection before starting new one (unless extending with Shift)
	const isExtendingSelection = event.shiftKey && ctx.engine.cellSelectionMode === 'shift'
	if (ctx.engine.selectedCellRange && !isExtendingSelection) {
		ctx.engine.clearCellSelection()
		removeRangeBorder()
	}

	const visualCols = ctx.engine.visualColumns
	const column = visualCols[colIndex]?.column
	if (!column) return

	// Set up pending state
	selectionState = {
		...selectionState,
		isPending: true,
		isDragging: false,
		startRowIndex: rowIndex,
		startColIndex: colIndex,
		startX: event.clientX,
		startY: event.clientY,
		currentRowIndex: rowIndex,
		currentColIndex: colIndex
	}

	activeContext = ctx as GridHost

	// Attach document-level listeners
	document.addEventListener('mousemove', handleDocumentMouseMove)
	document.addEventListener('mouseup', handleDocumentMouseUp)
	document.addEventListener('keydown', handleDocumentKeyDown)
}

/**
 * Handle Shift+Click to extend/create range to clicked cell
 */
export function handleCellShiftClick<T>(ctx: GridHost<T>, rowIndex: number, colIndex: number): void {
	// Clear existing border before creating new range
	removeRangeBorder()

	// If there's a last clicked cell, create range from it to current cell
	if (ctx.engine.lastClickedCell) {
		const { rowIndex: startRow, colIndex: startCol } = ctx.engine.lastClickedCell
		const visualCols = ctx.engine.visualColumns
		const startColumn = visualCols[startCol]?.column
		const endColumn = visualCols[colIndex]?.column

		if (startColumn && endColumn) {
			const range: CellRange = {
				startRowIndex: startRow,
				startColIndex: startCol,
				endRowIndex: rowIndex,
				endColIndex: colIndex,
				startField: String(startColumn.field),
				endField: String(endColumn.field)
			}
			// Clear focused cell when creating selection (avoid visual conflict)
			ctx.engine.clearFocusedCell()
			ctx.engine.selectCellRange(range)
			createRangeBorder(ctx)

			// Focus the container so keyboard shortcuts work
			// Use double RAF for reliable focus after all callbacks
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					const container = ctx.shadow.querySelector('.wg') as HTMLElement | null
					container?.focus({ preventScroll: true })
				})
			})
		}
	} else {
		// First shift+click, just remember this cell
		ctx.engine.lastClickedCell = { rowIndex, colIndex }
	}
}

/**
 * Handle mouse move during selection drag (rAF-throttled)
 * Mousemove fires faster than the screen refreshes, so we batch updates
 * to once per animation frame to avoid repeated forced reflows.
 */
function handleDocumentMouseMove(e: MouseEvent): void {
	if (!activeContext) return

	// Threshold check is cheap (no DOM reads), do it immediately
	if (selectionState.isPending) {
		const dx = e.clientX - selectionState.startX
		const dy = e.clientY - selectionState.startY
		const distance = Math.sqrt(dx * dx + dy * dy)

		if (distance >= DRAG_THRESHOLD) {
			startActualDrag(activeContext)
		}
		return
	}

	if (!selectionState.isDragging) return

	// Store latest event and schedule processing for next frame
	pendingMouseEvent = e
	if (!dragRafId) {
		dragRafId = requestAnimationFrame(processDragUpdate)
	}
}

/**
 * Process the batched drag update (runs once per animation frame)
 */
function processDragUpdate(): void {
	dragRafId = null
	if (!pendingMouseEvent || !activeContext) return

	const e = pendingMouseEvent
	pendingMouseEvent = null

	// Find which cell the mouse is over
	const cellInfo = findCellAtPoint(activeContext, e.clientX, e.clientY)
	if (cellInfo && (cellInfo.rowIndex !== selectionState.currentRowIndex || cellInfo.colIndex !== selectionState.currentColIndex)) {
		selectionState.currentRowIndex = cellInfo.rowIndex
		selectionState.currentColIndex = cellInfo.colIndex

		// Read border positions BEFORE writing CSS classes (avoids forced reflow)
		const borderPositions = computeRangeBorderPositions(activeContext)

		// Write phase: update cell classes and border element
		updateCellHighlighting(activeContext)
		applyRangeBorder(activeContext, borderPositions)
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
	container?.classList.add('wg--selecting-cells')

	// Clear focused cell and row so focus outlines disappear immediately when drag begins
	const oldFocus = ctx.engine.focusedCell
	ctx.engine.clearFocusedCell()
	updateFocusVisual(ctx, oldFocus, null)

	// Blur the DOM element — mousedown gave it :focus, whose box-shadow persists until blur
	const focused = ctx.shadow.querySelector('.wg__cell:focus') as HTMLElement
	focused?.blur()

	// Clear focused row visual (tracked separately from cell focus)
	const focusedRowIndex = ctx.engine.focusedRowIndex
	if (focusedRowIndex !== null) {
		const row = ctx.shadow.querySelector(`tr[data-row-index="${focusedRowIndex}"]`)
		row?.classList.remove('wg__row--focused')
		ctx.engine.clearRowFocus()
	}

	// Apply cell highlighting immediately
	updateCellHighlighting(ctx)

	// Create range border (shown during drag, not just after)
	createRangeBorderDuringDrag(ctx)
}

/**
 * Add/remove .wg__cell--in-range class to cells as range changes during drag
 */
function updateCellHighlighting<T>(ctx: GridHost<T>): void {
	const { startRowIndex, startColIndex, currentRowIndex, currentColIndex } = selectionState

	// Calculate current range
	const minRow = Math.min(startRowIndex, currentRowIndex)
	const maxRow = Math.max(startRowIndex, currentRowIndex)
	const minCol = Math.min(startColIndex, currentColIndex)
	const maxCol = Math.max(startColIndex, currentColIndex)

	// Remove class from all cells first
	const allCells = ctx.shadow.querySelectorAll('.wg__cell--in-range')
	allCells.forEach(cell => cell.classList.remove('wg__cell--in-range'))

	// Add class to cells in current range
	for (let row = minRow; row <= maxRow; row++) {
		for (let col = minCol; col <= maxCol; col++) {
			const cell = ctx.shadow.querySelector(
				`[data-row="${row}"][data-col="${col}"]`
			) as HTMLElement
			if (cell) {
				cell.classList.add('wg__cell--in-range')
			}
		}
	}
}

/**
 * Handle mouse up - apply selection and cleanup
 */
function handleDocumentMouseUp(e: MouseEvent): void {
	if (!activeContext) return

	const ctx = activeContext

	// If still pending (no drag) in shift mode, create range from last clicked cell
	if (selectionState.isPending) {
		const isShiftMode = e.shiftKey && ctx.engine.cellSelectionMode === 'shift'
		
		if (isShiftMode && ctx.engine.lastClickedCell) {
			// Shift+click without drag - create range from last clicked cell
			handleCellShiftClick(ctx, selectionState.startRowIndex, selectionState.startColIndex)
		} else {
			// Regular click - just remember the clicked cell for future shift+click
			ctx.engine.lastClickedCell = {
				rowIndex: selectionState.startRowIndex,
				colIndex: selectionState.startColIndex
			}
		}
		cleanup(ctx)
		return
	}

	// If not dragging, nothing to do
	if (!selectionState.isDragging) return

	// Check if user returned to starting cell (no actual selection made)
	const returnedToStart =
		selectionState.startRowIndex === selectionState.currentRowIndex &&
		selectionState.startColIndex === selectionState.currentColIndex

	if (returnedToStart) {
		// User canceled selection by returning to start - restore focus, clear highlighting
		const allCells = ctx.shadow.querySelectorAll('.wg__cell--in-range')
		allCells.forEach(cell => cell.classList.remove('wg__cell--in-range'))
		removeRangeBorder()

		// Restore focus on the start cell (was cleared when drag began)
		const { startRowIndex, startColIndex } = selectionState
		ctx.engine.setFocusedCell(startRowIndex, startColIndex)
		updateFocusVisual(ctx, null, { rowIndex: startRowIndex, colIndex: startColIndex })
		focusCellElement(ctx, startRowIndex, startColIndex)

		cleanup(ctx)
	} else {
		// Actual multi-cell selection made - apply it (this clears focus)
		applySelection(ctx)
		cleanup(ctx)

		// Focus the container so keyboard shortcuts work
		// Use double RAF for reliable focus after all callbacks
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const container = ctx.shadow.querySelector('.wg') as HTMLElement | null
				container?.focus({ preventScroll: true })
			})
		})
	}
}

/**
 * Handle keydown - Escape cancels selection operation
 */
function handleDocumentKeyDown(e: KeyboardEvent): void {
	if (e.key === 'Escape' && activeContext) {
		e.preventDefault()
		const ctx = activeContext

		// If dragging, restore focus on the start cell (was cleared when drag began)
		if (selectionState.isDragging) {
			const allCells = ctx.shadow.querySelectorAll('.wg__cell--in-range')
			allCells.forEach(cell => cell.classList.remove('wg__cell--in-range'))
			removeRangeBorder()

			const { startRowIndex, startColIndex } = selectionState
			ctx.engine.setFocusedCell(startRowIndex, startColIndex)
			updateFocusVisual(ctx, null, { rowIndex: startRowIndex, colIndex: startColIndex })
			focusCellElement(ctx, startRowIndex, startColIndex)
		}

		cleanup(ctx)
	}
}

/**
 * Find which cell is at a given point using elementFromPoint (O(1) hit-test)
 */
function findCellAtPoint<T>(ctx: GridHost<T>, x: number, y: number): { rowIndex: number; colIndex: number } | null {
	const element = ctx.shadow.elementFromPoint(x, y) as HTMLElement
	if (!element) return null

	const cell = element.closest('.wg__cell[data-row][data-col]') as HTMLElement
	if (!cell) return null

	const rowIndex = parseInt(cell.dataset.row || '-1', 10)
	const colIndex = parseInt(cell.dataset.col || '-1', 10)
	if (rowIndex >= 0 && colIndex >= 0) {
		return { rowIndex, colIndex }
	}
	return null
}

/**
 * Apply the cell range selection
 */
function applySelection<T>(ctx: GridHost<T>): void {
	const { startRowIndex, startColIndex, currentRowIndex, currentColIndex } = selectionState

	// Get the columns
	const visualCols = ctx.engine.visualColumns
	const startColumn = visualCols[startColIndex]?.column
	const endColumn = visualCols[currentColIndex]?.column

	if (!startColumn || !endColumn) return

	// Create the range
	const range: CellRange = {
		startRowIndex,
		startColIndex,
		endRowIndex: currentRowIndex,
		endColIndex: currentColIndex,
		startField: String(startColumn.field),
		endField: String(endColumn.field)
	}

	// Clear focused cell when creating selection (avoid visual conflict)
	ctx.engine.clearFocusedCell()

	// Apply to grid
	ctx.engine.selectCellRange(range)

	// Create persistent border
	createRangeBorder(ctx)
}

/**
 * Border position data computed from DOM reads (before any writes)
 */
interface BorderPositions {
	container: HTMLElement
	left: number
	top: number
	width: number
	height: number
}

/**
 * Compute range border positions from current selectionState (READ-ONLY, no DOM writes).
 * Call this BEFORE updateCellHighlighting to avoid forced reflow.
 */
function computeRangeBorderPositions<T>(ctx: GridHost<T>): BorderPositions | null {
	const { startRowIndex, startColIndex, currentRowIndex, currentColIndex } = selectionState
	const container = ctx.shadow.querySelector('.wg') as HTMLElement
	if (!container) return null

	const minRow = Math.min(startRowIndex, currentRowIndex)
	const maxRow = Math.max(startRowIndex, currentRowIndex)
	const minCol = Math.min(startColIndex, currentColIndex)
	const maxCol = Math.max(startColIndex, currentColIndex)

	const startCell = ctx.shadow.querySelector(
		`[data-row="${minRow}"][data-col="${minCol}"]`
	) as HTMLElement
	const endCell = ctx.shadow.querySelector(
		`[data-row="${maxRow}"][data-col="${maxCol}"]`
	) as HTMLElement

	if (!startCell || !endCell) return null

	const containerRect = container.getBoundingClientRect()
	const startRect = startCell.getBoundingClientRect()
	const endRect = endCell.getBoundingClientRect()
	const scrollLeft = container.scrollLeft
	const scrollTop = container.scrollTop

	return {
		container,
		left: startRect.left - containerRect.left + scrollLeft - container.clientLeft,
		top: startRect.top - containerRect.top + scrollTop - container.clientTop,
		width: endRect.right - startRect.left,
		height: endRect.bottom - startRect.top
	}
}

/**
 * Apply pre-computed border positions to DOM (WRITE-ONLY).
 * Reuses existing border element when possible to avoid DOM churn.
 */
function applyRangeBorder<T>(_ctx: GridHost<T>, positions: BorderPositions | null): void {
	if (!positions) {
		removeRangeBorder()
		return
	}

	// Reuse existing border element to avoid remove/create DOM churn
	let border = selectionState.rangeBorder
	if (!border) {
		border = document.createElement('div')
		border.className = 'wg__cell-range-border'
		positions.container.appendChild(border)
		selectionState.rangeBorder = border
	}

	border.style.left = `${positions.left}px`
	border.style.top = `${positions.top}px`
	border.style.width = `${positions.width}px`
	border.style.height = `${positions.height}px`
}

/**
 * Create range border during drag (combined read+write for initial creation)
 */
function createRangeBorderDuringDrag<T>(ctx: GridHost<T>): void {
	const positions = computeRangeBorderPositions(ctx)
	applyRangeBorder(ctx, positions)
}

/**
 * Create persistent range border (after selection complete)
 */
export function createRangeBorder<T>(ctx: GridHost<T>): void {
	// Remove existing border
	removeRangeBorder()

	const range = ctx.engine.selectedCellRange
	if (!range) return

	const container = ctx.shadow.querySelector('.wg') as HTMLElement
	if (!container) return

	const { startRowIndex, endRowIndex, startColIndex, endColIndex } = range
	const minRow = Math.min(startRowIndex, endRowIndex)
	const maxRow = Math.max(startRowIndex, endRowIndex)
	const minCol = Math.min(startColIndex, endColIndex)
	const maxCol = Math.max(startColIndex, endColIndex)

	// Find the bounding cells
	const startCell = ctx.shadow.querySelector(
		`[data-row="${minRow}"][data-col="${minCol}"]`
	) as HTMLElement
	const endCell = ctx.shadow.querySelector(
		`[data-row="${maxRow}"][data-col="${maxCol}"]`
	) as HTMLElement

	if (!startCell || !endCell) return

	const containerRect = container.getBoundingClientRect()
	const startRect = startCell.getBoundingClientRect()
	const endRect = endCell.getBoundingClientRect()

	// Account for scroll and container border
	// getBoundingClientRect measures from border edge, but position:absolute is from padding edge
	const scrollLeft = container.scrollLeft
	const scrollTop = container.scrollTop

	const left = startRect.left - containerRect.left + scrollLeft - container.clientLeft
	const top = startRect.top - containerRect.top + scrollTop - container.clientTop
	const width = endRect.right - startRect.left
	const height = endRect.bottom - startRect.top

	// Create border
	const border = document.createElement('div')
	border.className = 'wg__cell-range-border'
	border.style.left = `${left}px`
	border.style.top = `${top}px`
	border.style.width = `${width}px`
	border.style.height = `${height}px`
	container.appendChild(border)

	selectionState.rangeBorder = border
}

/**
 * Update range border position (e.g., on scroll)
 */
export function updateRangeBorder<T>(ctx: GridHost<T>): void {
	if (!selectionState.rangeBorder) return
	// Remove and recreate (simpler than recalculating)
	removeRangeBorder()
	
	// If dragging, use drag state; otherwise use saved range
	if (selectionState.isDragging) {
		createRangeBorderDuringDrag(ctx)
	} else {
		createRangeBorder(ctx)
	}
}

/**
 * Remove the persistent range border
 */
export function removeRangeBorder(): void {
	if (selectionState.rangeBorder) {
		selectionState.rangeBorder.remove()
		selectionState.rangeBorder = null
	}
}

/**
 * Cleanup after selection operation
 */
function cleanup<T>(ctx: GridHost<T>): void {
	// Remove cell highlighting classes (keep for final selection)
	// Classes will remain on cells for the final selected range
	
	// Remove selecting class
	const container = ctx.shadow.querySelector('.wg')
	container?.classList.remove('wg--selecting-cells')

	// Cancel pending rAF
	if (dragRafId) {
		cancelAnimationFrame(dragRafId)
		dragRafId = null
	}
	pendingMouseEvent = null

	// Remove document listeners
	document.removeEventListener('mousemove', handleDocumentMouseMove)
	document.removeEventListener('mouseup', handleDocumentMouseUp)
	document.removeEventListener('keydown', handleDocumentKeyDown)

	// Reset state (keep border for final selection)
	const rangeBorder = selectionState.rangeBorder
	selectionState = {
		isPending: false,
		isDragging: false,
		startRowIndex: -1,
		startColIndex: -1,
		startX: 0,
		startY: 0,
		currentRowIndex: -1,
		currentColIndex: -1,
		rangeBorder
	}
	activeContext = null
}

// =============================================================================
// Fill Handle Module (Excel-like autofill)
// =============================================================================

import type { GridHost } from '../grid-context.js'
import type { Column, EditorOption } from '../../types.js'
import { runBeforeCallback } from '@keenmate/web-components-core'
import { renderCell } from '../rendering/cell.js'

/** Minimum distance (px) mouse must move before drag starts */
const DRAG_THRESHOLD = 5

/**
 * Check if a value is compatible with a target column's editor type
 * Returns true if the value can be filled into the target column
 */
function isValueCompatible<T>(sourceValue: unknown, targetColumn: Column<T>): boolean {
	const editor = targetColumn.editor || 'text'

	switch (editor) {
		case 'number': {
			// Number columns only accept numeric values
			return typeof sourceValue === 'number' && !isNaN(sourceValue)
		}

		case 'select':
		case 'combobox': {
			// Select/combobox columns only accept values that exist in their options
			const options = targetColumn.editorOptions?.options
			if (!options || options.length === 0) {
				// No options defined - allow the fill (dynamic options loaded later)
				return true
			}
			// Check if the value exists in the options
			const valueMember = targetColumn.editorOptions?.valueMember || 'value'
			return options.some((opt: EditorOption) => {
				const optValue = (opt as Record<string, unknown>)[valueMember]
				return optValue === sourceValue
			})
		}

		case 'date': {
			// Date columns accept: Date objects, valid ISO date strings, or timestamps
			if (sourceValue === null || sourceValue === undefined || sourceValue === '') {
				return true // Empty values are allowed
			}
			if (sourceValue instanceof Date) {
				return !isNaN(sourceValue.getTime())
			}
			if (typeof sourceValue === 'string') {
				// Must look like a date string (contains - or / for date parts)
				if (!/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(sourceValue) &&
				    !/\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(sourceValue)) {
					return false
				}
				const parsed = new Date(sourceValue)
				return !isNaN(parsed.getTime())
			}
			if (typeof sourceValue === 'number') {
				// Only accept reasonable timestamps (after year 2000, before year 2100)
				const minTimestamp = new Date('2000-01-01').getTime()
				const maxTimestamp = new Date('2100-01-01').getTime()
				if (sourceValue < minTimestamp || sourceValue > maxTimestamp) {
					return false
				}
				const parsed = new Date(sourceValue)
				return !isNaN(parsed.getTime())
			}
			return false
		}

		case 'text':
		case 'autocomplete':
		case 'checkbox':
		case 'custom':
		default:
			// Text, autocomplete, checkbox, and custom editors allow any value
			// Programmer can validate via beforeFillCallback
			return true
	}
}

/**
 * State for tracking fill handle drag operation
 */
interface FillState {
	isPending: boolean      // Mouse is down but threshold not yet exceeded
	isDragging: boolean     // Actually dragging (threshold exceeded)
	startRowIndex: number
	startColIndex: number   // visual position
	startField: string
	startX: number
	startY: number
	currentRowIndex: number
	currentColIndex: number // visual position
	handleElement: HTMLElement | null
	rangeElement: HTMLElement | null
}

// Module-level state
let fillState: FillState = {
	isPending: false,
	isDragging: false,
	startRowIndex: -1,
	startColIndex: -1,
	startField: '',
	startX: 0,
	startY: 0,
	currentRowIndex: -1,
	currentColIndex: -1,
	handleElement: null,
	rangeElement: null
}

// Store the current context for document-level handlers
let activeContext: GridHost | null = null

// Track which grid's host element owns the current fill handle
let fillHandleOwner: HTMLElement | null = null

/**
 * Check if fill drag is in progress
 */
export function isFilling(): boolean {
	return fillState.isDragging
}

/**
 * Check if fill drag is pending (mouse down but not dragging yet)
 */
export function isFillPending(): boolean {
	return fillState.isPending
}

/**
 * Create and position the fill handle on the focused cell
 */
export function updateFillHandle<T>(ctx: GridHost<T>): void {
	const focusedCell = ctx.engine.focusedCell
	const hostElement = ctx.shadow.host as HTMLElement

	// Remove existing handle if no focused cell, in edit mode, or dropdown is open
	// Only remove if this grid owns the handle (prevents one grid from removing another's)
	if (!focusedCell || ctx.engine.editingCell || ctx.dropdown.isOpen) {
		removeFillHandle(hostElement)
		return
	}

	const { rowIndex, colIndex } = focusedCell  // colIndex = data-col (index into columns)

	// Don't show fill handle if the focused cell's column is not editable
	const column = ctx.engine.visualIndexOfColumn(colIndex) >= 0 ? ctx.engine.columns[colIndex] : undefined
	const focusedRow = ctx.engine.displayItems[rowIndex]
	if (!column || !ctx.engine.isCellEditable(column, focusedRow)) {
		removeFillHandle(hostElement)
		return
	}

	// Find the focused cell element
	const cellElement = ctx.shadow.querySelector(
		`[data-row="${rowIndex}"][data-col="${colIndex}"]`
	) as HTMLElement

	if (!cellElement) {
		removeFillHandle(hostElement)
		return
	}

	const container = ctx.shadow.querySelector('.wg') as HTMLElement
	if (!container) return

	// Measure BEFORE creating handle to avoid layout interference
	const containerRect = container.getBoundingClientRect()
	const cellRect = cellElement.getBoundingClientRect()
	const scrollLeft = container.scrollLeft
	const scrollTop = container.scrollTop
	const handleSize = 8

	// Check if on last row - if so, show handle at top-right so user can drag upward
	const isLastRow = rowIndex === ctx.engine.displayItems.length - 1
	const x = cellRect.right - containerRect.left + scrollLeft - handleSize / 2
	const y = isLastRow
		? cellRect.top - containerRect.top + scrollTop - handleSize / 2  // Top-right
		: cellRect.bottom - containerRect.top + scrollTop - handleSize / 2  // Bottom-right

	// Check if existing handle is in a DIFFERENT grid's container
	// (happens when switching between multiple grids on the same page)
	if (fillState.handleElement && fillState.handleElement.parentElement !== container) {
		fillState.handleElement.remove()
		fillState.handleElement = null
		fillHandleOwner = null
	}

	// Create handle AFTER measuring (to avoid layout interference)
	if (!fillState.handleElement) {
		const handle = document.createElement('div')
		handle.className = 'wg__fill-handle'
		container.appendChild(handle)
		fillState.handleElement = handle
		fillHandleOwner = hostElement

		// Attach mousedown listener
		handle.addEventListener('mousedown', (e) => handleFillStart(ctx, e))
	}

	fillState.handleElement.style.left = `${x}px`
	fillState.handleElement.style.top = `${y}px`
}

/**
 * Remove the fill handle from DOM
 * @param forHost - If provided, only remove if the handle belongs to this host element.
 *                  Used to prevent one grid from removing another grid's fill handle.
 */
export function removeFillHandle(forHost?: HTMLElement): void {
	if (fillState.handleElement) {
		// If forHost is specified, only remove if this grid owns the handle
		if (forHost && fillHandleOwner && forHost !== fillHandleOwner) {
			return
		}
		fillState.handleElement.remove()
		fillState.handleElement = null
		fillHandleOwner = null
	}
}

// Column convention (like cell ranges): fillState's start / current column fields
// are VISUAL positions (index into `visualColumns`, hidden skipped), so the fill
// rectangle is the on-screen one. The focused cell, the DOM (`data-col`) and the
// FillContext's `colIndex` use the column index (index into `columns`).

/** The cell element at (row, visual position). */
function cellAt<T>(ctx: GridHost<T>, row: number, pos: number): HTMLElement | null {
	const col = ctx.engine.visualColumns[pos]?.originalIndex
	if (col === undefined) return null
	return ctx.shadow.querySelector(`[data-row="${row}"][data-col="${col}"]`) as HTMLElement | null
}

/**
 * Handle mousedown on fill handle
 */
function handleFillStart<T>(ctx: GridHost<T>, e: MouseEvent): void {
	e.preventDefault()
	e.stopPropagation()

	const focusedCell = ctx.engine.focusedCell
	if (!focusedCell) return

	const { rowIndex, colIndex } = focusedCell
	const pos = ctx.engine.visualIndexOfColumn(colIndex)
	const column = ctx.engine.visualColumns[pos]?.column
	if (!column) return

	// Set up pending state (column fields are visual positions)
	fillState = {
		...fillState,
		isPending: true,
		isDragging: false,
		startRowIndex: rowIndex,
		startColIndex: pos,
		startField: String(column.field),
		startX: e.clientX,
		startY: e.clientY,
		currentRowIndex: rowIndex,
		currentColIndex: pos
	}

	activeContext = ctx as GridHost

	// Attach document-level listeners
	document.addEventListener('mousemove', handleDocumentMouseMove)
	document.addEventListener('mouseup', handleDocumentMouseUp)
	document.addEventListener('keydown', handleDocumentKeyDown)
}

/**
 * Handle mouse move during fill drag
 */
function handleDocumentMouseMove(e: MouseEvent): void {
	if (!activeContext) return

	// If pending, check if threshold exceeded
	if (fillState.isPending) {
		const dx = e.clientX - fillState.startX
		const dy = e.clientY - fillState.startY
		const distance = Math.sqrt(dx * dx + dy * dy)

		if (distance >= DRAG_THRESHOLD) {
			startActualDrag(activeContext)
		}
		return
	}

	// If not actually dragging, nothing to do
	if (!fillState.isDragging) return

	// Find which cell the mouse is over
	const cellInfo = findCellAtPoint(activeContext, e.clientX, e.clientY)
	const pos = cellInfo ? activeContext.engine.visualIndexOfColumn(cellInfo.colIndex) : -1
	if (cellInfo && pos >= 0 && (cellInfo.rowIndex !== fillState.currentRowIndex || pos !== fillState.currentColIndex)) {
		fillState.currentRowIndex = cellInfo.rowIndex
		fillState.currentColIndex = pos
		updateRangeOverlay(activeContext)
	}
}

/**
 * Start the actual drag operation (after threshold exceeded)
 */
function startActualDrag<T>(ctx: GridHost<T>): void {
	fillState.isPending = false
	fillState.isDragging = true

	// Add filling class to container
	const container = ctx.shadow.querySelector('.wg')
	container?.classList.add('wg--filling')

	// Create range overlay
	createRangeOverlay(ctx)
}

/**
 * Create the range overlay element
 */
function createRangeOverlay<T>(ctx: GridHost<T>): void {
	const container = ctx.shadow.querySelector('.wg') as HTMLElement
	if (!container) return

	const overlay = document.createElement('div')
	overlay.className = 'wg__fill-range'
	container.appendChild(overlay)
	fillState.rangeElement = overlay

	updateRangeOverlay(ctx)
}

/**
 * Update the range overlay position and size
 */
function updateRangeOverlay<T>(ctx: GridHost<T>): void {
	if (!fillState.rangeElement) return

	const container = ctx.shadow.querySelector('.wg') as HTMLElement
	if (!container) return

	const { startRowIndex, startColIndex, currentRowIndex, currentColIndex } = fillState

	// Determine the range (normalize to min/max)
	const minRow = Math.min(startRowIndex, currentRowIndex)
	const maxRow = Math.max(startRowIndex, currentRowIndex)
	const minCol = Math.min(startColIndex, currentColIndex)
	const maxCol = Math.max(startColIndex, currentColIndex)

	// Find the bounding cells (visual positions -> data-col)
	const startCell = cellAt(ctx, minRow, minCol)
	const endCell = cellAt(ctx, maxRow, maxCol)

	if (!startCell || !endCell) return

	const containerRect = container.getBoundingClientRect()
	const startRect = startCell.getBoundingClientRect()
	const endRect = endCell.getBoundingClientRect()

	// Account for scroll
	const scrollLeft = container.scrollLeft
	const scrollTop = container.scrollTop

	const left = startRect.left - containerRect.left + scrollLeft
	const top = startRect.top - containerRect.top + scrollTop
	const width = endRect.right - startRect.left
	const height = endRect.bottom - startRect.top

	fillState.rangeElement.style.left = `${left}px`
	fillState.rangeElement.style.top = `${top}px`
	fillState.rangeElement.style.width = `${width}px`
	fillState.rangeElement.style.height = `${height}px`
}

/**
 * Handle mouse up - apply fill and cleanup
 */
function handleDocumentMouseUp(e: MouseEvent): void {
	if (!activeContext) return

	const ctx = activeContext

	// If still pending (no drag), just cleanup
	if (fillState.isPending) {
		cleanup(ctx)
		return
	}

	// If not dragging, nothing to do
	if (!fillState.isDragging) return

	// Apply the fill
	applyFill(ctx)

	// Cleanup
	cleanup(ctx)
}

/**
 * Handle keydown - Escape cancels fill operation
 */
function handleDocumentKeyDown(e: KeyboardEvent): void {
	if (e.key === 'Escape' && activeContext) {
		e.preventDefault()
		cleanup(activeContext)
	}
}

/**
 * Find which cell is at a given point
 */
function findCellAtPoint<T>(ctx: GridHost<T>, x: number, y: number): { rowIndex: number; colIndex: number } | null {
	const container = ctx.shadow.querySelector('.wg') as HTMLElement
	if (!container) return null

	// Get all cells and find which one contains the point
	const cells = ctx.shadow.querySelectorAll('.wg__cell[data-row][data-col]')

	for (const cell of cells) {
		const rect = (cell as HTMLElement).getBoundingClientRect()
		if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
			const rowIndex = parseInt((cell as HTMLElement).dataset.row || '-1', 10)
			const colIndex = parseInt((cell as HTMLElement).dataset.col || '-1', 10)
			if (rowIndex >= 0 && colIndex >= 0) {
				return { rowIndex, colIndex }
			}
		}
	}

	return null
}

/**
 * Determine fill direction based on start and end positions
 */
function getDirection(
	startRow: number, startCol: number,
	endRow: number, endCol: number
): 'up' | 'down' | 'left' | 'right' {
	const rowDelta = endRow - startRow
	const colDelta = endCol - startCol

	// If same cell, default to down
	if (rowDelta === 0 && colDelta === 0) return 'down'

	// Use dominant direction
	if (Math.abs(rowDelta) >= Math.abs(colDelta)) {
		return rowDelta > 0 ? 'down' : 'up'
	} else {
		return colDelta > 0 ? 'right' : 'left'
	}
}

/**
 * Apply the fill operation
 */
async function applyFill<T>(ctx: GridHost<T>): Promise<void> {
	const { startRowIndex, startColIndex, currentRowIndex, currentColIndex, startField } = fillState

	// Get the source cell value
	const visualCols = ctx.engine.visualColumns
	const sourceColumn = visualCols[startColIndex]?.column
	if (!sourceColumn) return

	// Use draft row if it exists (contains edited values), otherwise use display item
	const sourceRow = ctx.engine.getRowDraft(startRowIndex) ?? ctx.engine.displayItems[startRowIndex]
	if (!sourceRow) return

	const sourceValue = (sourceRow as Record<string, unknown>)[startField]

	// Determine direction
	const direction = getDirection(startRowIndex, startColIndex, currentRowIndex, currentColIndex)

	// Get effective fill direction (column-level override or grid-level)
	const fillDirection = sourceColumn.fillDirection ?? ctx.engine.fillDirection

	// Calculate target cells (excluding source cell)
	const targetCells: Array<{ rowIndex: number; colIndex: number; field: string }> = []

	const minRow = Math.min(startRowIndex, currentRowIndex)
	const maxRow = Math.max(startRowIndex, currentRowIndex)

	// If fillDirection is 'vertical', constrain to same column only
	const minCol = fillDirection === 'vertical' ? startColIndex : Math.min(startColIndex, currentColIndex)
	const maxCol = fillDirection === 'vertical' ? startColIndex : Math.max(startColIndex, currentColIndex)

	for (let row = minRow; row <= maxRow; row++) {
		for (let pos = minCol; pos <= maxCol; pos++) {
			// Skip source cell
			if (row === startRowIndex && pos === startColIndex) continue

			const entry = visualCols[pos]
			if (!entry) continue
			const column = entry.column

			const field = String(column.field)

			// Check if cell is editable (column editability + row locking)
			if (!ctx.engine.canEditCell(row, field)) continue

			// Check if source value is compatible with target column's editor type
			if (!isValueCompatible(sourceValue, column)) continue

			targetCells.push({ rowIndex: row, colIndex: entry.originalIndex, field })
		}
	}

	// If no target cells, nothing to do
	if (targetCells.length === 0) return

	// ctx for beforeFillCallback
	const detail = ctx.engine.ctx({
		sourceCell: {
			rowIndex: startRowIndex,
			colIndex: visualCols[startColIndex].originalIndex,
			field: startField,
			value: sourceValue
		},
		targetCells,
		direction
	})

	// beforeFillCallback: `false` cancels (async OK)
	const gate = await runBeforeCallback(ctx.engine.beforeFillCallback, detail, 'beforeFillCallback')
	if (gate.isRejected) return

	// Apply the fill to each target cell
	for (const target of targetCells) {
		await ctx.engine.commitEdit(target.rowIndex, target.field, sourceValue)
		// Re-render the cell to show the new value
		renderCell(ctx, target.rowIndex, target.colIndex)
	}
}

/**
 * Cleanup after fill operation
 */
function cleanup<T>(ctx: GridHost<T>): void {
	// Remove range overlay
	if (fillState.rangeElement) {
		fillState.rangeElement.remove()
		fillState.rangeElement = null
	}

	// Remove filling class
	const container = ctx.shadow.querySelector('.wg')
	container?.classList.remove('wg--filling')

	// Remove document listeners
	document.removeEventListener('mousemove', handleDocumentMouseMove)
	document.removeEventListener('mouseup', handleDocumentMouseUp)
	document.removeEventListener('keydown', handleDocumentKeyDown)

	// Reset state (keep handle element)
	const handleElement = fillState.handleElement
	fillState = {
		isPending: false,
		isDragging: false,
		startRowIndex: -1,
		startColIndex: -1,
		startField: '',
		startX: 0,
		startY: 0,
		currentRowIndex: -1,
		currentColIndex: -1,
		handleElement,
		rangeElement: null
	}
	activeContext = null
}

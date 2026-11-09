// =============================================================================
// Column Resize Module
// =============================================================================

import type { GridHost } from '../grid-context.js'

/**
 * State for tracking an active resize operation
 */
export interface ResizeState {
	isResizing: boolean
	startX: number
	startWidth: number
	field: string
	headerCell: HTMLElement | null
	minWidth: number
	maxWidth: number | null
}

// Module-level state (per grid instance would need WeakMap, but single active resize is fine)
let resizeState: ResizeState = {
	isResizing: false,
	startX: 0,
	startWidth: 0,
	field: '',
	headerCell: null,
	minWidth: 30,
	maxWidth: null
}

// Store the current context for document-level handlers
let activeContext: GridHost | null = null

/**
 * Get the current resize state (useful for checking if resize is active)
 */
export function getResizeState(): ResizeState {
	return resizeState
}

/**
 * Parse a CSS width string (e.g., "100px") to a number
 */
function parseWidth(width: string | undefined, defaultValue: number): number {
	if (!width) return defaultValue
	const parsed = parseFloat(width)
	return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Start a column resize operation
 */
export function handleResizeStart<T>(ctx: GridHost<T>, e: MouseEvent, field: string): void {
	const target = e.target as HTMLElement
	const headerCell = target.closest('.wg__header') as HTMLElement
	if (!headerCell) return

	// Get column definition for min/max width
	const column = ctx.engine.columns.find(c => String(c.field) === field)
	if (!column) return

	// Check if column is resizable
	if (column.isResizable === false) return

	// Get current width
	const computedWidth = headerCell.getBoundingClientRect().width

	// Set up resize state
	resizeState = {
		isResizing: true,
		startX: e.clientX,
		startWidth: computedWidth,
		field,
		headerCell,
		minWidth: parseWidth(column.minWidth, 30),
		maxWidth: column.maxWidth ? parseWidth(column.maxWidth, Infinity) : null
	}

	activeContext = ctx as GridHost

	// Set min-width to actual column minWidth (not initial width which might be larger)
	if (column.minWidth) {
		headerCell.style.minWidth = column.minWidth
	} else {
		headerCell.style.minWidth = `${resizeState.minWidth}px`
	}

	// Add resizing class to grid container
	const container = ctx.shadow.querySelector('.wg')
	container?.classList.add('wg--resizing')

	// Add active class to resize handle
	target.classList.add('wg__resize-handle--active')

	// Attach document-level listeners
	document.addEventListener('mousemove', handleDocumentMouseMove)
	document.addEventListener('mouseup', handleDocumentMouseUp)

	// Prevent text selection during resize
	e.preventDefault()
}

/**
 * Handle mouse move during resize (document-level)
 */
function handleDocumentMouseMove(e: MouseEvent): void {
	if (!resizeState.isResizing || !activeContext) return

	const deltaX = e.clientX - resizeState.startX
	let newWidth = resizeState.startWidth + deltaX

	// Clamp to min/max
	newWidth = Math.max(newWidth, resizeState.minWidth)
	if (resizeState.maxWidth !== null) {
		newWidth = Math.min(newWidth, resizeState.maxWidth)
	}

	// Apply width to header cell immediately for visual feedback
	if (resizeState.headerCell) {
		resizeState.headerCell.style.width = `${newWidth}px`
		resizeState.headerCell.style.maxWidth = `${newWidth}px`
	}

	// Also update all body cells in this column for visual feedback
	updateAllColumnCells(activeContext, resizeState.field, `${newWidth}px`)

	// Update frozen column offsets if we have frozen columns
	if (activeContext.engine.frozenColumnCount > 0 || activeContext.engine.isStickyRowNumbers) {
		updateFrozenColumnOffsets(activeContext)
	}
}

/**
 * End resize operation (document-level)
 */
function handleDocumentMouseUp(e: MouseEvent): void {
	if (!resizeState.isResizing || !activeContext) return

	const ctx = activeContext
	const field = resizeState.field
	const oldWidth = `${resizeState.startWidth}px`

	// Calculate final width
	const deltaX = e.clientX - resizeState.startX
	let newWidth = resizeState.startWidth + deltaX
	newWidth = Math.max(newWidth, resizeState.minWidth)
	if (resizeState.maxWidth !== null) {
		newWidth = Math.min(newWidth, resizeState.maxWidth)
	}
	const newWidthStr = `${newWidth}px`

	// Store the width in grid state (skip re-render since we already updated inline styles)
	ctx.engine.setColumnWidth(field, newWidthStr, true)

	// Update the <col> element in colgroup for table-layout: fixed
	const col = ctx.shadow.querySelector(`col[data-field="${field}"]`) as HTMLElement
	if (col) {
		col.style.width = newWidthStr
	}

	// Remove resizing class
	const container = ctx.shadow.querySelector('.wg')
	container?.classList.remove('wg--resizing')

	// Remove active class from handle
	const handle = ctx.shadow.querySelector('.wg__resize-handle--active')
	handle?.classList.remove('wg__resize-handle--active')

	ctx.engine.notify('column-resize', {
		field,
		oldWidth,
		newWidth: newWidthStr,
		allWidths: ctx.engine.getColumnWidthsState()
	})

	// Persisted UI state (storage-key + persist-column-widths; core state store)
	if (ctx.engine.shouldPersistColumnWidths) ctx.engine.savePersistedState()

	// Clean up
	document.removeEventListener('mousemove', handleDocumentMouseMove)
	document.removeEventListener('mouseup', handleDocumentMouseUp)

	resizeState = {
		isResizing: false,
		startX: 0,
		startWidth: 0,
		field: '',
		headerCell: null,
		minWidth: 30,
		maxWidth: null
	}
	activeContext = null
}

/**
 * Update all cells in a column during resize for visual feedback
 */
function updateAllColumnCells<T>(ctx: GridHost<T>, field: string, width: string): void {
	// Update all body cells with this field
	const cells = ctx.shadow.querySelectorAll(`td[data-field="${field}"]`) as NodeListOf<HTMLElement>
	cells.forEach(cell => {
		cell.style.width = width
		cell.style.maxWidth = width
	})
}

// Row number column width (must match CSS)
const ROW_NUMBER_COLUMN_WIDTH = 40

/**
 * Update frozen column left offsets during resize
 * Recalculates cumulative offsets based on current widths
 */
function updateFrozenColumnOffsets<T>(ctx: GridHost<T>): void {
	const frozenCount = ctx.engine.frozenColumnCount
	const hasRowNumbers = ctx.engine.isRowNumbersShown && ctx.engine.isStickyRowNumbers
	let offset = hasRowNumbers ? ROW_NUMBER_COLUMN_WIDTH : 0

	// Get visual columns (already sorted with frozen first)
	const visualColumns = ctx.engine.visualColumns

	// Update each frozen column's left position
	for (let i = 0; i < frozenCount && i < visualColumns.length; i++) {
		const { column } = visualColumns[i]
		const field = String(column.field)

		// Update header and body cells with same offset
		const header = ctx.shadow.querySelector(`th[data-field="${field}"]`) as HTMLElement
		if (header) {
			header.style.left = `${offset}px`

			// Update all body cells in this column
			const cells = ctx.shadow.querySelectorAll(`td[data-field="${field}"]`) as NodeListOf<HTMLElement>
			cells.forEach(cell => {
				cell.style.left = `${offset}px`
			})

			// Increment offset for next column
			offset += header.getBoundingClientRect().width
		}
	}
}

/**
 * Apply all stored column widths (called after render)
 */
export function applyStoredColumnWidths<T>(ctx: GridHost<T>): void {
	const colgroup = ctx.shadow.querySelector('.wg__colgroup')
	if (!colgroup) return

	for (const column of ctx.engine.columns) {
		const fieldStr = String(column.field)
		const storedWidth = ctx.engine.getColumnWidth(fieldStr)
		if (storedWidth) {
			const col = colgroup.querySelector(`col[data-field="${fieldStr}"]`) as HTMLElement
			if (col) {
				col.style.width = storedWidth
			}
		}
	}
}

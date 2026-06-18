// =============================================================================
// Selection Border Module
// =============================================================================
// Provides visual borders around row and column selections.
// Handles contiguous segments (separate borders for non-adjacent selections).

import type { GridContext } from '../grid-context.js'

// Store references to border elements for cleanup
let rowBorders: HTMLElement[] = []
let columnBorders: HTMLElement[] = []

/**
 * Find contiguous segments from a sorted array of indices.
 * Example: [1, 2, 3, 7, 8, 10] → [{start: 1, end: 3}, {start: 7, end: 8}, {start: 10, end: 10}]
 */
function findContiguousSegments(indices: number[]): Array<{ start: number; end: number }> {
	if (indices.length === 0) return []

	const sorted = [...indices].sort((a, b) => a - b)
	const segments: Array<{ start: number; end: number }> = []

	let segmentStart = sorted[0]
	let segmentEnd = sorted[0]

	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i] === segmentEnd + 1) {
			// Contiguous, extend segment
			segmentEnd = sorted[i]
		} else {
			// Gap found, save current segment and start new one
			segments.push({ start: segmentStart, end: segmentEnd })
			segmentStart = sorted[i]
			segmentEnd = sorted[i]
		}
	}

	// Don't forget the last segment
	segments.push({ start: segmentStart, end: segmentEnd })

	return segments
}

/**
 * Create a single border element with the given position
 */
function createBorderElement(
	container: HTMLElement,
	left: number,
	top: number,
	width: number,
	height: number,
	className: string
): HTMLElement {
	const border = document.createElement('div')
	border.className = className
	border.style.left = `${left}px`
	border.style.top = `${top}px`
	border.style.width = `${width}px`
	border.style.height = `${height}px`
	container.appendChild(border)
	return border
}

/**
 * Create borders around selected rows.
 * Creates one border per contiguous segment.
 */
export function createRowSelectionBorders<T>(ctx: GridContext<T>): void {
	// Remove existing borders first
	removeRowSelectionBorders()

	const selectedRows = ctx.grid.selectedRows
	if (selectedRows.length === 0) return

	const container = ctx.shadow.querySelector('.wg') as HTMLElement
	if (!container) return

	const segments = findContiguousSegments(selectedRows)
	const visualColumns = ctx.grid.visualColumns

	if (visualColumns.length === 0) return

	const containerRect = container.getBoundingClientRect()
	const scrollLeft = container.scrollLeft
	const scrollTop = container.scrollTop

	for (const segment of segments) {
		// Find the first cell in the first row of this segment (first data column, not row number)
		const firstCell = ctx.shadow.querySelector(
			`.wg__cell[data-row="${segment.start}"][data-col="0"]`
		) as HTMLElement

		// Find the last cell in the last row of this segment
		const lastColIndex = visualColumns.length - 1
		const lastCell = ctx.shadow.querySelector(
			`.wg__cell[data-row="${segment.end}"][data-col="${lastColIndex}"]`
		) as HTMLElement

		if (!firstCell || !lastCell) continue

		const firstRect = firstCell.getBoundingClientRect()
		const lastRect = lastCell.getBoundingClientRect()

		const left = firstRect.left - containerRect.left + scrollLeft - container.clientLeft
		const top = firstRect.top - containerRect.top + scrollTop - container.clientTop
		const width = lastRect.right - firstRect.left
		const height = lastRect.bottom - firstRect.top

		const border = createBorderElement(container, left, top, width, height, 'wg__row-selection-border')
		rowBorders.push(border)
	}
}

/**
 * Create borders around selected columns.
 * Creates one border per contiguous segment.
 */
export function createColumnSelectionBorders<T>(ctx: GridContext<T>): void {
	// Remove existing borders first
	removeColumnSelectionBorders()

	const selectedColumns = ctx.grid.selectedColumns
	if (selectedColumns.length === 0) return

	const container = ctx.shadow.querySelector('.wg') as HTMLElement
	if (!container) return

	const segments = findContiguousSegments(selectedColumns)
	const displayItems = ctx.grid.displayItems
	const visualColumns = ctx.grid.visualColumns

	if (displayItems.length === 0 || visualColumns.length === 0) return

	const containerRect = container.getBoundingClientRect()
	const scrollLeft = container.scrollLeft
	const scrollTop = container.scrollTop

	for (const segment of segments) {
		// Get field names for the first and last columns in this segment
		const firstCol = visualColumns[segment.start]
		const lastCol = visualColumns[segment.end]
		if (!firstCol || !lastCol) continue

		const firstField = String(firstCol.column.field)
		const lastField = String(lastCol.column.field)

		// Find the header cell for the first column in this segment (by field)
		const firstHeader = ctx.shadow.querySelector(
			`.wg__header[data-field="${firstField}"]`
		) as HTMLElement

		// Find the last cell in the last row for the last column (by originalIndex)
		const lastRowIndex = displayItems.length - 1
		const lastCell = ctx.shadow.querySelector(
			`.wg__cell[data-row="${lastRowIndex}"][data-col="${lastCol.originalIndex}"]`
		) as HTMLElement

		if (!firstHeader || !lastCell) continue

		// For width, get the last column's header to find right edge
		const lastHeader = ctx.shadow.querySelector(
			`.wg__header[data-field="${lastField}"]`
		) as HTMLElement

		if (!lastHeader) continue

		const firstHeaderRect = firstHeader.getBoundingClientRect()
		const lastHeaderRect = lastHeader.getBoundingClientRect()
		const lastCellRect = lastCell.getBoundingClientRect()

		const left = firstHeaderRect.left - containerRect.left + scrollLeft - container.clientLeft
		const top = firstHeaderRect.top - containerRect.top + scrollTop - container.clientTop
		const width = lastHeaderRect.right - firstHeaderRect.left
		const height = lastCellRect.bottom - firstHeaderRect.top

		const border = createBorderElement(container, left, top, width, height, 'wg__column-selection-border')
		columnBorders.push(border)
	}
}

/**
 * Update all selection borders (call on scroll)
 */
export function updateSelectionBorders<T>(ctx: GridContext<T>): void {
	// Only update if there are existing borders
	if (rowBorders.length > 0) {
		createRowSelectionBorders(ctx)
	}
	if (columnBorders.length > 0) {
		createColumnSelectionBorders(ctx)
	}
}

/**
 * Remove all row selection borders
 */
export function removeRowSelectionBorders(): void {
	for (const border of rowBorders) {
		border.remove()
	}
	rowBorders = []
}

/**
 * Remove all column selection borders
 */
export function removeColumnSelectionBorders(): void {
	for (const border of columnBorders) {
		border.remove()
	}
	columnBorders = []
}

/**
 * Remove all selection borders (both row and column)
 */
export function removeAllSelectionBorders(): void {
	removeRowSelectionBorders()
	removeColumnSelectionBorders()
}

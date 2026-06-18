// =============================================================================
// Column Reorder Module
// =============================================================================

import type { GridContext } from '../grid-context.js'

/** Minimum distance (px) mouse must move before drag starts */
const DRAG_THRESHOLD = 5

/**
 * State for tracking an active reorder operation
 */
export interface ReorderState {
	isPending: boolean      // Mouse is down but threshold not yet exceeded
	isReordering: boolean   // Actually dragging (threshold exceeded)
	field: string
	startX: number
	startY: number
	headerCell: HTMLElement | null
	ghost: HTMLElement | null
	dropIndicator: HTMLElement | null
	fromIndex: number
	currentDropIndex: number
}

// Module-level state
let reorderState: ReorderState = {
	isPending: false,
	isReordering: false,
	field: '',
	startX: 0,
	startY: 0,
	headerCell: null,
	ghost: null,
	dropIndicator: null,
	fromIndex: -1,
	currentDropIndex: -1
}

// Store the current context for document-level handlers
let activeContext: GridContext | null = null

// Flag to track if a drag was just completed (to block click-to-sort)
let dragJustCompleted = false

/**
 * Get the current reorder state
 */
export function getReorderState(): ReorderState {
	return reorderState
}

/**
 * Check if reorder is currently active or was just completed.
 * This is used to block click-to-sort after a drag operation.
 * The dragJustCompleted flag is reset after being checked.
 */
export function isReordering(): boolean {
	if (dragJustCompleted) {
		dragJustCompleted = false
		return true
	}
	return reorderState.isReordering
}

/**
 * Check if a reorder operation is pending (mouse down but threshold not exceeded)
 */
export function isReorderPending(): boolean {
	return reorderState.isPending
}

/**
 * Start a column reorder operation (pending state until threshold exceeded)
 */
export function handleReorderStart<T>(ctx: GridContext<T>, e: MouseEvent, field: string): void {
	const target = e.target as HTMLElement
	const headerCell = target.closest('.wg__header') as HTMLElement
	if (!headerCell) return

	// Don't start reorder if clicking on resize handle
	if (target.classList.contains('wg__resize-handle')) return

	// Check if column is frozen (frozen columns are not reorderable)
	const visualCols = ctx.grid.visualColumns
	const frozenCount = ctx.grid.totalFrozenColumns
	const visualIndex = visualCols.findIndex(vc => String(vc.column.field) === field)
	if (visualIndex < frozenCount) return  // This is a frozen column

	// Check if column has isMovable: false
	const column = visualCols[visualIndex]?.column
	if (column?.isMovable === false) return

	// Get non-frozen column index
	const nonFrozenIndex = visualIndex - frozenCount

	// Set up pending reorder state (actual drag starts after threshold exceeded)
	reorderState = {
		isPending: true,
		isReordering: false,
		field,
		startX: e.clientX,
		startY: e.clientY,
		headerCell,
		ghost: null,
		dropIndicator: null,
		fromIndex: nonFrozenIndex,
		currentDropIndex: nonFrozenIndex
	}

	activeContext = ctx as GridContext

	// Attach document-level listeners to track mouse movement
	document.addEventListener('mousemove', handleDocumentMouseMove)
	document.addEventListener('mouseup', handleDocumentMouseUp)

	// Prevent text selection during potential reorder
	e.preventDefault()
}

/**
 * Create ghost element that follows cursor
 */
function createGhost<T>(ctx: GridContext<T>, headerCell: HTMLElement, e: MouseEvent): void {
	const ghost = document.createElement('div')
	ghost.className = 'wg__reorder-ghost'
	ghost.textContent = headerCell.querySelector('.wg__header-title')?.textContent || ''

	// Position near cursor using viewport coordinates (ghost is position: fixed)
	ghost.style.left = `${e.clientX + 10}px`
	ghost.style.top = `${e.clientY - 10}px`

	// Append to shadow root (not .wg container) to avoid overflow clipping
	ctx.shadow.appendChild(ghost)
	reorderState.ghost = ghost
}

/**
 * Create drop indicator line
 */
function createDropIndicator<T>(ctx: GridContext<T>): void {
	const indicator = document.createElement('div')
	indicator.className = 'wg__drop-indicator'
	ctx.shadow.querySelector('.wg')?.appendChild(indicator)
	reorderState.dropIndicator = indicator
}

/**
 * Actually start the drag operation (called after threshold exceeded)
 */
function startActualDrag<T>(ctx: GridContext<T>, e: MouseEvent): void {
	reorderState.isPending = false
	reorderState.isReordering = true

	// Add reordering class to grid container
	const container = ctx.shadow.querySelector('.wg')
	container?.classList.add('wg--reordering')

	// Add dragging class to header
	if (reorderState.headerCell) {
		reorderState.headerCell.classList.add('wg__header--dragging')
	}

	// Create ghost element
	if (reorderState.headerCell) {
		createGhost(ctx, reorderState.headerCell, e)
	}

	// Create drop indicator
	createDropIndicator(ctx)
}

/**
 * Handle mouse move during reorder (document-level)
 */
function handleDocumentMouseMove(e: MouseEvent): void {
	if (!activeContext) return

	// If pending, check if threshold exceeded to start actual drag
	if (reorderState.isPending) {
		const dx = e.clientX - reorderState.startX
		const dy = e.clientY - reorderState.startY
		const distance = Math.sqrt(dx * dx + dy * dy)

		if (distance >= DRAG_THRESHOLD) {
			startActualDrag(activeContext, e)
		}
		return
	}

	// If not actually reordering, nothing to do
	if (!reorderState.isReordering) return

	const container = activeContext.shadow.querySelector('.wg')
	if (!container) return

	// Move ghost to follow cursor using viewport coordinates (ghost is position: fixed)
	if (reorderState.ghost) {
		reorderState.ghost.style.left = `${e.clientX + 10}px`
		reorderState.ghost.style.top = `${e.clientY - 10}px`
	}

	// Find drop target based on mouse position
	const dropIndex = findDropIndex(activeContext, e.clientX)
	if (dropIndex !== reorderState.currentDropIndex) {
		reorderState.currentDropIndex = dropIndex
		updateDropIndicator(activeContext, dropIndex)
	}
}

/**
 * Find the minimum valid drop index (respects isMovable: false columns)
 * Dropping before a non-movable column would shift it, so we must drop after all non-movable columns.
 */
function getMinDropIndex<T>(ctx: GridContext<T>): number {
	const visualCols = ctx.grid.visualColumns
	const frozenCount = ctx.grid.totalFrozenColumns
	const nonFrozenCols = visualCols.slice(frozenCount)

	// Find the highest index of any non-movable column
	let minDropIndex = 0
	for (let i = 0; i < nonFrozenCols.length; i++) {
		if (nonFrozenCols[i].column.isMovable === false) {
			minDropIndex = i + 1  // Must drop AFTER this column
		}
	}
	return minDropIndex
}

/**
 * Find the drop index based on cursor X position
 * Returns index relative to non-frozen columns (0 = first position after frozen columns)
 */
function findDropIndex<T>(ctx: GridContext<T>, mouseX: number): number {
	const visualCols = ctx.grid.visualColumns
	const frozenCount = ctx.grid.totalFrozenColumns
	const nonFrozenCols = visualCols.slice(frozenCount)

	if (nonFrozenCols.length === 0) return 0

	// Get minimum valid drop position (after all non-movable columns)
	const minDropIndex = getMinDropIndex(ctx)

	// Get the first non-frozen column to check if mouse is in frozen area
	const firstNonFrozenField = String(nonFrozenCols[0].column.field)
	const firstNonFrozenHeader = ctx.shadow.querySelector(`th[data-field="${firstNonFrozenField}"]`) as HTMLElement

	// If mouse is to the left of the first non-frozen column, clamp to minimum valid position
	if (firstNonFrozenHeader) {
		const firstRect = firstNonFrozenHeader.getBoundingClientRect()
		if (mouseX < firstRect.left) {
			return minDropIndex
		}
	}

	// Get header cells for non-frozen columns
	for (let i = 0; i < nonFrozenCols.length; i++) {
		const field = String(nonFrozenCols[i].column.field)
		const header = ctx.shadow.querySelector(`th[data-field="${field}"]`) as HTMLElement
		if (header) {
			const rect = header.getBoundingClientRect()
			const midpoint = rect.left + rect.width / 2
			if (mouseX < midpoint) {
				// Clamp to minimum valid drop position
				return Math.max(i, minDropIndex)
			}
		}
	}

	// If past all columns, return last position
	return nonFrozenCols.length
}

/**
 * Update drop indicator position
 */
function updateDropIndicator<T>(ctx: GridContext<T>, dropIndex: number): void {
	const indicator = reorderState.dropIndicator
	if (!indicator) return

	const visualCols = ctx.grid.visualColumns
	const frozenCount = ctx.grid.totalFrozenColumns
	const nonFrozenCols = visualCols.slice(frozenCount)
	const container = ctx.shadow.querySelector('.wg') as HTMLElement
	const containerRect = container?.getBoundingClientRect()
	if (!containerRect || !container) return

	let targetX: number

	if (dropIndex >= nonFrozenCols.length) {
		// After last column
		const lastField = String(nonFrozenCols[nonFrozenCols.length - 1].column.field)
		const lastHeader = ctx.shadow.querySelector(`th[data-field="${lastField}"]`) as HTMLElement
		if (lastHeader) {
			const rect = lastHeader.getBoundingClientRect()
			targetX = rect.right - containerRect.left + container.scrollLeft
		} else {
			return
		}
	} else {
		// Before column at dropIndex
		const field = String(nonFrozenCols[dropIndex].column.field)
		const header = ctx.shadow.querySelector(`th[data-field="${field}"]`) as HTMLElement
		if (header) {
			const rect = header.getBoundingClientRect()
			targetX = rect.left - containerRect.left + container.scrollLeft
		} else {
			return
		}
	}

	// Position indicator at visible area (accounting for scroll)
	const scrollTop = container.scrollTop
	const visibleHeight = container.clientHeight

	indicator.style.left = `${targetX}px`
	indicator.style.top = `${scrollTop}px`
	indicator.style.height = `${visibleHeight}px`
	indicator.style.display = 'block'
}

/**
 * End reorder operation (document-level)
 */
function handleDocumentMouseUp(e: MouseEvent): void {
	if (!activeContext) return

	const ctx = activeContext

	// If still pending (threshold never exceeded), just cleanup - this was a click, not a drag
	if (reorderState.isPending) {
		cleanup(ctx)
		return
	}

	// If not actually reordering, nothing to do
	if (!reorderState.isReordering) return

	const field = reorderState.field
	const fromIndex = reorderState.fromIndex
	const toIndex = reorderState.currentDropIndex

	// Apply the reorder if position changed
	if (fromIndex !== toIndex && toIndex !== fromIndex + 1) {
		// Adjust toIndex if moving right (since we remove from original position first)
		const adjustedToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex
		ctx.grid.moveColumn(field, adjustedToIndex)

		// Fire callback
		if (ctx.grid.oncolumnreorder) {
			ctx.grid.oncolumnreorder({
				field,
				fromIndex,
				toIndex: adjustedToIndex,
				allOrder: ctx.grid.getColumnOrderState()
			})
		}

		// Persist to localStorage if enabled
		if (ctx.grid.shouldPersistColumnOrder && ctx.grid.gridName) {
			ctx.grid.savePersistedState()
		}
	}

	// Set flag to block the subsequent click event from triggering sort
	// Use requestAnimationFrame to auto-clear after the current frame,
	// so it only blocks the immediate click, not subsequent manual clicks
	dragJustCompleted = true
	requestAnimationFrame(() => {
		dragJustCompleted = false
	})

	// Clean up
	cleanup(ctx)
}

/**
 * Clean up reorder state and DOM elements
 */
function cleanup<T>(ctx: GridContext<T>): void {
	// Remove ghost
	if (reorderState.ghost) {
		reorderState.ghost.remove()
	}

	// Remove drop indicator
	if (reorderState.dropIndicator) {
		reorderState.dropIndicator.remove()
	}

	// Remove classes
	const container = ctx.shadow.querySelector('.wg')
	container?.classList.remove('wg--reordering')

	if (reorderState.headerCell) {
		reorderState.headerCell.classList.remove('wg__header--dragging')
	}

	// Remove document listeners
	document.removeEventListener('mousemove', handleDocumentMouseMove)
	document.removeEventListener('mouseup', handleDocumentMouseUp)

	// Reset state
	reorderState = {
		isPending: false,
		isReordering: false,
		field: '',
		startX: 0,
		startY: 0,
		headerCell: null,
		ghost: null,
		dropIndicator: null,
		fromIndex: -1,
		currentDropIndex: -1
	}
	activeContext = null
}

// =============================================================================
// Virtual Scroll Calculations - Pure functions for scroll range computation
// =============================================================================

export interface VisibleRangeParams {
	scrollTop: number
	viewportHeight: number
	rowHeight: number
	buffer: number
	totalItems: number
	editingRowIndex?: number
}

export interface VisibleRange {
	startIndex: number
	endIndex: number
}

/**
 * Calculate the visible row range for virtual scrolling.
 * Pure function - no side effects.
 */
export function calculateVisibleRange(params: VisibleRangeParams): VisibleRange {
	const { scrollTop, viewportHeight, rowHeight, buffer, totalItems, editingRowIndex } = params

	let startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer)
	const visibleCount = Math.ceil(viewportHeight / rowHeight) + buffer * 2
	let endIndex = Math.min(totalItems, startIndex + visibleCount)

	// If editing, expand range to include the editing row
	if (editingRowIndex !== undefined) {
		if (editingRowIndex < startIndex) {
			startIndex = editingRowIndex
		}
		if (editingRowIndex >= endIndex) {
			endIndex = editingRowIndex + 1
		}
	}

	return { startIndex, endIndex }
}

/**
 * Check if infinite scroll should trigger (near bottom of container).
 * Pure function - no side effects.
 */
export function shouldTriggerInfiniteScroll(
	scrollTop: number,
	scrollHeight: number,
	clientHeight: number,
	threshold: number
): boolean {
	const distanceToBottom = scrollHeight - (scrollTop + clientHeight)
	return distanceToBottom <= threshold
}

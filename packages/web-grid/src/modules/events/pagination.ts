// =============================================================================
// Pagination Event Handlers
// =============================================================================

import type { GridContext } from '../grid-context.js'

/**
 * Handle pagination button click (first, prev, next, last).
 * Returns true if page changed (caller should re-render).
 */
export function handlePaginationClick<T>(ctx: GridContext<T>, e: Event): boolean {
	const target = e.target as HTMLElement
	const btn = target.closest('.wg__pagination-btn') as HTMLElement
	if (!btn || btn.hasAttribute('disabled')) return false

	const action = btn.dataset.action
	let pageChanged = false

	if (action === 'first' && ctx.grid.currentPage !== 1) {
		ctx.grid.currentPage = 1
		pageChanged = true
	} else if (action === 'prev' && ctx.grid.currentPage > 1) {
		ctx.grid.currentPage--
		pageChanged = true
	} else if (action === 'next' && ctx.grid.currentPage < ctx.grid.totalPages) {
		ctx.grid.currentPage++
		pageChanged = true
	} else if (action === 'last' && ctx.grid.currentPage !== ctx.grid.totalPages) {
		ctx.grid.currentPage = ctx.grid.totalPages
		pageChanged = true
	}

	if (pageChanged) {
		ctx.grid.fireDataRequest('page')
	}

	return pageChanged
}

/**
 * Handle page size select change.
 * Returns true if page size changed (caller should re-render).
 */
export function handlePageSizeChange<T>(ctx: GridContext<T>, select: HTMLSelectElement): boolean {
	const newPageSize = parseInt(select.value, 10)
	if (newPageSize !== ctx.grid.pageSize) {
		ctx.grid.pageSize = newPageSize
		// Reset to page 1 when page size changes
		ctx.grid.currentPage = 1
		ctx.grid.fireDataRequest('pageSize')
		return true
	}
	return false
}

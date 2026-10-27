// =============================================================================
// Pagination Event Handlers
// =============================================================================

import type { GridHost } from '../grid-context.js'
import { guardPageChange } from './page-change.js'

/**
 * Handle pagination button click (first, prev, next, last) — through
 * `beforePageChangeCallback` (trigger 'page'). Returns true if the page changed
 * synchronously (caller should re-render); an async hook applies + renders itself.
 */
export function handlePaginationClick<T>(ctx: GridHost<T>, e: Event): boolean {
	const target = e.target as HTMLElement
	const btn = target.closest('.wg__pagination-btn') as HTMLElement
	if (!btn || btn.hasAttribute('disabled')) return false

	const action = btn.dataset.action
	const engine = ctx.engine
	const current = engine.currentPage
	let toPage = current

	if (action === 'first') toPage = 1
	else if (action === 'prev') toPage = Math.max(1, current - 1)
	else if (action === 'next') toPage = Math.min(engine.totalPages, current + 1)
	else if (action === 'last') toPage = engine.totalPages

	if (toPage === current) return false

	return guardPageChange(ctx, 'page', toPage, page => {
		engine.currentPage = page
		engine.fireDataRequest('page')
	})
}

/**
 * Handle page size select change — through `beforePageChangeCallback` (trigger
 * 'page-size', toPage 1). Returns true if the page size changed synchronously.
 */
export function handlePageSizeChange<T>(ctx: GridHost<T>, select: HTMLSelectElement): boolean {
	const newPageSize = parseInt(select.value, 10)
	if (newPageSize === ctx.engine.pageSize) return false
	return guardPageChange(ctx, 'page-size', 1, page => {
		ctx.setAttributes({ pageSize: newPageSize })
		ctx.engine.currentPage = page
		ctx.engine.fireDataRequest('page-size')
	})
}

/**
 * Attach pagination click + page-size change listeners to the `.wg` container.
 *
 * Why the container (not `.wg__pagination`): when `isPageable` toggles or the
 * pagination region re-renders, its DOM is replaced via innerHTML and any
 * listener attached directly to the pagination element is lost. Delegating
 * from the container survives surgical re-renders.
 */
export function attachPaginationListeners<T>(ctx: GridHost<T>, wgContainer: HTMLElement): void {
	wgContainer.addEventListener('click', (e: Event) => {
		const target = e.target as HTMLElement
		if (target.closest('.wg__pagination-btn')) {
			if (handlePaginationClick(ctx, e)) {
				ctx.render()
			}
		}
	})
	wgContainer.addEventListener('change', (e: Event) => {
		const target = e.target as HTMLElement
		if (target.matches('.wg__pagination-select')) {
			if (handlePageSizeChange(ctx, target as HTMLSelectElement)) {
				ctx.render()
			}
		}
	})
}

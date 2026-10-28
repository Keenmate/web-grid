// =============================================================================
// Sort Event Handler
// =============================================================================

import type { GridHost } from '../grid-context.js'
import type { SortState } from '../../types.js'
import { guardPageChange } from './page-change.js'

/**
 * Handle header click for sorting.
 * Supports single and multi-column sorting (Ctrl+Click for multi).
 * @param field - The field to sort (passed directly to avoid shadow DOM target retargeting issues)
 */
export function handleSortClick<T>(ctx: GridHost<T>, e: MouseEvent, field?: string): void {
	// If field not provided, try to extract from event target (legacy support)
	if (!field) {
		const target = e.target as HTMLElement
		const header = target.closest('.wg__header--sortable') as HTMLElement
		if (!header) return
		field = header.dataset.field
		if (!field) return
	}

	const currentSort = [...ctx.engine.sort]
	const existingIndex = currentSort.findIndex(s => s.column === field)
	const isCtrlClick = e.ctrlKey || e.metaKey

	if (isCtrlClick && ctx.engine.sortMode === 'multiple') {
		// Multi-column sort: Ctrl+Click adds/toggles/removes column
		if (existingIndex >= 0) {
			const existing = currentSort[existingIndex]
			if (existing.direction === 'asc') {
				// Toggle to desc
				currentSort[existingIndex] = { column: field, direction: 'desc' }
			} else {
				// Remove from sort
				currentSort.splice(existingIndex, 1)
			}
		} else {
			// Add new column to sort
			currentSort.push({ column: field, direction: 'asc' })
		}
	} else {
		// Single-column sort: regular click replaces all sorting
		if (existingIndex >= 0 && currentSort.length === 1) {
			// Same column, toggle direction
			const existing = currentSort[0]
			if (existing.direction === 'asc') {
				currentSort[0] = { column: field, direction: 'desc' }
			} else {
				// Clear sorting
				currentSort.length = 0
			}
		} else {
			// New column or was multi-column, start fresh with asc
			currentSort.length = 0
			currentSort.push({ column: field, direction: 'asc' })
		}
	}

	applySort(ctx, currentSort)
}

/**
 * Apply a user sort: page 1 (when pageable) + `data-request` (trigger 'sort'). In
 * server pagination the rows are swapped, so it runs through
 * `beforePageChangeCallback` first (trigger 'sort'; `false` keeps the old sort).
 */
export function applySort<T>(ctx: GridHost<T>, nextSort: SortState[]): void {
	const engine = ctx.engine
	const apply = (page: number) => {
		engine.sort = nextSort
		if (engine.isPagingEnabled) engine.currentPage = page
		engine.fireDataRequest('sort')
	}
	if (engine.paginationMode === 'server' && engine.isPagingEnabled) {
		guardPageChange(ctx, 'sort', 1, apply)
	} else {
		apply(1)
	}
}

// =============================================================================
// Scroll element-handlers
// =============================================================================
// Extracted from GridElement. The handlers in this file are subscribed to the
// scroll-event-manager and run on every scroll tick. They consult the
// VirtualScrollService to decide whether the visible range needs re-rendering,
// trigger infinite-scroll requests when the user nears the bottom, and close
// the dropdown when the editing cell scrolls out from under it.

import type { GridHost } from '../grid-context.js'
import { clearEditingVisual, updateFocusVisual } from '../navigation/focus.js'
import { renderCell } from '../rendering/cell.js'
import { renderDataRowsVirtual, type VirtualScrollParams } from '../rendering/table.js'
import { removeDropdown } from '../dropdown/rendering.js'
import { calculateVisibleRange, shouldTriggerInfiniteScroll } from './calculations.js'

/**
 * On every scroll tick, recompute the visible row window and re-render the
 * tbody if it shifted. Skipped during programmatic scroll (keyboard
 * navigation already pre-rendered the target range).
 */
export function handleVirtualScroll<T>(ctx: GridHost<T>, container: HTMLElement): void {
	// Skip during programmatic scroll (keyboard nav already handles row visibility)
	if (ctx.virtualScroll.isProgrammatic) return

	const { startIndex, endIndex } = calculateVisibleRange({
		scrollTop: container.scrollTop,
		viewportHeight: container.clientHeight,
		rowHeight: ctx.engine.virtualScrollItemHeight,
		buffer: ctx.engine.virtualScrollOverscan,
		totalItems: ctx.engine.displayItems.length,
		editingRowIndex: ctx.engine.editingCell?.rowIndex
	})

	// Only re-render if range changed
	if (ctx.virtualScroll.setRange(startIndex, endIndex)) {
		renderVirtualRows(ctx, container)
	}
}

/**
 * Re-render only the tbody using the current VirtualScrollService range. After
 * the innerHTML swap the focused cell is destroyed, so capture it beforehand
 * and re-focus + re-apply the visual after the new DOM lands.
 */
export function renderVirtualRows<T>(ctx: GridHost<T>, container: HTMLElement): void {
	const tbody = container.querySelector('tbody')
	if (!tbody) return

	const items = ctx.engine.displayItems
	const params: VirtualScrollParams = {
		startIndex: ctx.virtualScroll.start,
		endIndex: ctx.virtualScroll.end,
		rowHeight: ctx.engine.virtualScrollItemHeight,
		totalItems: items.length
	}

	// Save focusedCell BEFORE innerHTML — the blur from destroyed cell will clear it
	const focusedCell = ctx.engine.focusedCell

	tbody.innerHTML = renderDataRowsVirtual(ctx, params)

	// Re-focus the focusedCell after re-render (if it's in the rendered range).
	// Use the saved value since blur event may have cleared it.
	if (focusedCell) {
		// Restore focusedCell state (blur may have cleared it)
		ctx.engine.setFocusedCell(focusedCell.rowIndex, focusedCell.colIndex)

		const cell = tbody.querySelector(
			`td[data-row="${focusedCell.rowIndex}"][data-col="${focusedCell.colIndex}"]`
		) as HTMLElement | null
		if (cell) {
			cell.focus({ preventScroll: true })
			updateFocusVisual(ctx, null, focusedCell)
		}
	}
}

/**
 * Trigger a loadMore data request when the user scrolls within
 * `infiniteScrollThreshold` of the bottom. The consumer is responsible for
 * fetching, appending, and flipping `hasMoreItems` when exhausted.
 */
export function handleInfiniteScroll<T>(ctx: GridHost<T>, container: HTMLElement): void {
	const shouldLoad = shouldTriggerInfiniteScroll(
		container.scrollTop,
		container.scrollHeight,
		container.clientHeight,
		ctx.engine.infiniteScrollThreshold
	)

	if (shouldLoad) {
		ctx.virtualScroll.setIsLoadingMore(true)

		// Fire data request with loadMore trigger
		ctx.engine.fireDataRequest('load-more')

		// The consumer is responsible for:
		// 1. Fetching more data
		// 2. Appending to items array
		// 3. Setting hasMoreItems = false when done
		// 4. After items update, isLoadingMore will reset on next scroll
	}
}

/**
 * Close the dropdown when the editing cell scrolls out from under it. Shared
 * by both container-scroll and window-scroll subscribers — Floating UI doesn't
 * reposition on those, so the dropdown would otherwise float over the wrong
 * row.
 */
export function handleScrollCloseDropdown<T>(ctx: GridHost<T>): void {
	// Save editing cell info BEFORE cancelEdit clears it
	const oldEditingCell = ctx.engine.editingCell
	const oldColIndex = oldEditingCell
		? ctx.engine.columns.findIndex(c => String(c.field) === oldEditingCell.field)
		: -1

	removeDropdown(ctx)
	clearEditingVisual(ctx)
	ctx.engine.cancelEdit()

	// Re-render old cell to remove editor HTML (toggle, etc.)
	if (oldEditingCell && oldColIndex >= 0) {
		renderCell(ctx, oldEditingCell.rowIndex, oldColIndex)
	}
}

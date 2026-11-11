// =============================================================================
// Scroll event handlers
// =============================================================================
// Two subscription bodies attached to scrollEvents:
//
//  - Container scroll: paint the horizontal frozen-column shadow indicator,
//    advance virtual-scroll range / trigger infinite-scroll
//    loadMore, reposition the floating-toolbar connector, update fill-handle +
//    range / row / column selection borders.
//  - Window scroll: close the floating toolbar so it doesn't drift away from
//    its anchor.
//
// The cell dropdown closes on scroll through core createPopover()
// (`shouldCloseOnScroll`, dropdown/rendering.ts), not here.
//
// Both handlers take `container` and `scrollContainer` as parameters so the
// extraction doesn't depend on shadow re-querying (the listener captures the
// original DOM nodes via closure in the caller and forwards them in).

import type { GridHost } from '../grid-context.js'
import { handleVirtualScroll, handleInfiniteScroll } from '../scroll/index.js'
import { getActiveToolbarRowIndex, updateConnector, closeToolbarAndReset } from '../toolbar/index.js'
import { updateFillHandle } from '../fill-handle/index.js'
import { updateRangeBorder } from '../cell-selection/index.js'
import { updateSelectionBorders } from '../selection-border/index.js'

/**
 * Container scroll handler — runs on every scroll of the .wg / .wg__table-container.
 */
export function handleContainerScroll<T>(
	ctx: GridHost<T>,
	container: HTMLElement,
	scrollContainer: HTMLElement
): void {
	// Toggle horizontal scroll indicator for frozen column shadow
	const isScrolledHorizontally = scrollContainer.scrollLeft > 0
	container.classList.toggle('wg--scrolled-horizontal', isScrolledHorizontally)

	// Virtual scroll: recalculate visible range
	if (ctx.engine.shouldUseVirtualScroll()) {
		handleVirtualScroll(ctx, scrollContainer)
	}

	// Infinite scroll: detect when near bottom
	if (ctx.engine.isInfiniteScrollEnabled && ctx.engine.hasMoreItems && !ctx.virtualScroll.isLoadingMore) {
		handleInfiniteScroll(ctx, scrollContainer)
	}

	// Update connector position when scrolling (clips at container boundary)
	if (getActiveToolbarRowIndex(ctx) !== null) {
		updateConnector(ctx, ctx.engine.displayItems)
		ctx.renderConnector()
	}

	// Update fill handle position on scroll
	updateFillHandle(ctx)

	// Update cell range border on scroll
	if (ctx.engine.selectedCellRange) {
		updateRangeBorder(ctx)
	}

	// Update row/column selection borders on scroll
	updateSelectionBorders(ctx)
}

/**
 * Window scroll handler — close transient overlays so they don't drift.
 */
export function handleWindowScroll<T>(ctx: GridHost<T>): void {
	if (getActiveToolbarRowIndex(ctx) !== null) {
		closeToolbarAndReset(ctx)
	}
}

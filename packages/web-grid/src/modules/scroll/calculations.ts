// =============================================================================
// Virtual Scroll Calculations
// =============================================================================
// The range math is core's `computeVirtualRange()` (SPEC §12.26). The grid drives
// it on its own schedule (not `createVirtualWindow`): the tbody is part of the
// full render() template, the scroller can be rebuilt (`.wg` ↔ `.wg__table-container`),
// and a keyboard / index jump renders the target window BEFORE it scrolls.

import { computeVirtualRange } from '@keenmate/web-components-core'
import type { GridHost } from '../grid-context.js'

export interface VisibleRange {
	startIndex: number
	endIndex: number
}

/**
 * The displayed-row window for `scrollTop` / `viewport` (core `computeVirtualRange()` with the
 * grid's row height and overscan), stretched to hold each `keep` index (the edited row, a
 * keyboard target) so its row stays rendered.
 */
export function visibleRowRange<T>(
	ctx: GridHost<T>,
	scrollTop: number,
	viewport: number,
	keep: readonly (number | undefined)[] = []
): VisibleRange {
	const count = ctx.engine.displayItems.length
	const { start, end } = computeVirtualRange({
		scrollTop,
		viewport,
		count,
		rowHeight: ctx.engine.virtualScrollItemHeight,
		overscan: ctx.engine.virtualScrollOverscan
	})
	let startIndex = start
	let endIndex = end
	for (const index of keep) {
		if (index === undefined || index < 0 || index >= count) continue
		startIndex = Math.min(startIndex, index)
		endIndex = Math.max(endIndex, index + 1)
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

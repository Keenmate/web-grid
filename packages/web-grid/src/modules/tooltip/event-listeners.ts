// =============================================================================
// Tooltip event listeners
// =============================================================================
// Capture-phase mouseenter / mouseleave handlers that surface tooltips for any
// element under the table marked with `data-tooltip` (plain text) or
// `data-tooltip-html` (HTML, escaped at the caller). Lives in the tooltip
// module so the listener-attach side of the lifecycle sits next to
// showTooltip / hideTooltip in tooltip.ts.

import type { GridContext } from '../grid-context.js'
import { showTooltip, hideTooltip } from './tooltip.js'

/**
 * Attach `data-tooltip` / `data-tooltip-html` mouseenter / mouseleave
 * listeners to the table in capture phase. Capture phase is required so
 * tooltips can fire on nested elements (e.g. icons inside cells) without
 * relying on bubbling, which doesn't fire for mouseenter / mouseleave.
 *
 * The mouseleave handler skips the hide when the cursor is moving to another
 * tooltip-bearing element with the same data — prevents flicker on adjacent
 * cells with identical tooltips.
 */
export function attachTooltipListeners<T>(ctx: GridContext<T>, table: Element): void {
	table.addEventListener('mouseenter', (e: Event) => {
		const target = e.target as HTMLElement
		// Check for HTML tooltip first, then plain text
		const htmlTooltipElement = target.closest('[data-tooltip-html]') as HTMLElement
		if (htmlTooltipElement) {
			const tooltipHtml = htmlTooltipElement.getAttribute('data-tooltip-html')!
			showTooltip(ctx, htmlTooltipElement, tooltipHtml, ctx.tooltipShowDelay, true)
			return
		}
		const tooltipElement = target.closest('[data-tooltip]') as HTMLElement
		if (tooltipElement) {
			const tooltipText = tooltipElement.getAttribute('data-tooltip')!
			showTooltip(ctx, tooltipElement, tooltipText, ctx.tooltipShowDelay, false)
		}
	}, true)

	table.addEventListener('mouseleave', (e: Event) => {
		const mouseEvent = e as MouseEvent
		const target = mouseEvent.target as HTMLElement
		const relatedTarget = mouseEvent.relatedTarget as HTMLElement | null
		const tooltipEl = target.closest('[data-tooltip], [data-tooltip-html]') as HTMLElement

		if (tooltipEl && relatedTarget?.closest('[data-tooltip], [data-tooltip-html]') === tooltipEl) {
			return
		}

		if (tooltipEl) {
			hideTooltip(ctx, ctx.tooltipHideDelay)
		}
	}, true)
}

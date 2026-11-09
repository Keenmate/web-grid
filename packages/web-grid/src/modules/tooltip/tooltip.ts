// =============================================================================
// Tooltip Module
// Show/hide/create tooltips, placed by core anchor() (/positioning)
// =============================================================================

import { anchor as anchorTo } from '@keenmate/web-components-core/positioning'
import type { GridHost } from '../grid-context.js'

/**
 * Show tooltip for an element
 */
export function showTooltip<T>(
	ctx: GridHost<T>,
	anchor: HTMLElement,
	text: string,
	delay?: number,
	isHtml?: boolean
): void {
	const showDelay = delay ?? ctx.tooltipShowDelay

	// Clear any pending hide
	ctx.tooltip.clearHideTimer()

	// If tooltip already showing for same anchor, just keep it
	// (check anchor, not text - same text on different cells should reposition)
	if (ctx.tooltip.element && ctx.tooltip.anchor === anchor) {
		return
	}

	// Clear any pending show
	ctx.tooltip.clearShowTimer()

	ctx.tooltip.setShowTimer(setTimeout(() => {
		createTooltip(ctx, anchor, text, isHtml)
	}, showDelay))
}

/**
 * Hide tooltip
 */
export function hideTooltip<T>(ctx: GridHost<T>, delay?: number): void {
	const hideDelay = delay ?? ctx.tooltipHideDelay

	// Clear any pending show
	ctx.tooltip.clearShowTimer()

	// If no tooltip, nothing to hide
	if (!ctx.tooltip.element) return

	// Delay hide slightly to allow moving to tooltip
	ctx.tooltip.setHideTimer(setTimeout(() => {
		const el = ctx.tooltip.element
		if (el) {
			el.classList.remove('wg__tooltip--visible')
			// Remove after transition
			setTimeout(() => {
				ctx.tooltip.element?.remove()
				ctx.tooltip.clearMounted()
			}, 100)
		}
	}, hideDelay))
}

/**
 * Create and position tooltip element
 */
export function createTooltip<T>(
	ctx: GridHost<T>,
	anchor: HTMLElement,
	content: string,
	isHtml?: boolean
): void {
	// Remove existing
	ctx.tooltip.element?.remove()
	ctx.tooltip.clearMounted()

	// Create tooltip
	const tooltip = document.createElement('div')
	tooltip.className = 'wg__tooltip'

	// Create content wrapper (arrow goes after content, not inside it)
	const contentWrapper = document.createElement('div')
	contentWrapper.className = 'wg__tooltip-content'
	if (isHtml) {
		contentWrapper.innerHTML = content
	} else {
		contentWrapper.textContent = content
	}
	tooltip.appendChild(contentWrapper)

	// Create arrow
	const arrowEl = document.createElement('div')
	arrowEl.className = 'wg__tooltip-arrow'
	tooltip.appendChild(arrowEl)

	ctx.shadow.appendChild(tooltip)
	ctx.tooltip.setElement(tooltip)
	ctx.tooltip.setArrowElement(arrowEl)
	ctx.tooltip.setAnchor(anchor)

	// Position with core anchor() — one placement (the tooltip is rebuilt per anchor)
	let isShown = false
	ctx.tooltip.setPositioning(anchorTo(tooltip, anchor, {
		strategy: 'absolute',
		placement: 'top',
		offset: 8,
		shift: false,
		fallbackPlacements: ['bottom', 'left', 'right'],
		arrow: { element: arrowEl },
		shouldAutoUpdate: false,
		onPlaced: (placement) => {
			tooltip.setAttribute('data-placement', placement)
			if (isShown) return
			isShown = true
			// Show with animation
			requestAnimationFrame(() => {
				tooltip.classList.add('wg__tooltip--visible')
			})
		}
	}))
}

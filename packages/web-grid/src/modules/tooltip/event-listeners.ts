// =============================================================================
// Tooltip event listeners
// =============================================================================
// Capture-phase mouseenter / mouseleave handlers that surface tooltips for any
// element under the table marked with `data-tooltip` (plain text) or
// `data-tooltip-html` (HTML, escaped at the caller). Lives in the tooltip
// module so the listener-attach side of the lifecycle sits next to
// showTooltip / hideTooltip in tooltip.ts.
//
// A body cell's tooltip is resolved again when it is SHOWN (getCellTooltip:
// `getTooltipCallback` / `tooltipMember` / validation), not read from the
// attribute written at render time: state that changes without a re-render
// (selection, focus, the controller's view of the grid) would otherwise show
// stale content.

import type { GridHost } from '../grid-context.js'
import { getCellTooltip } from '../rendering/table.js'
import { showTooltip, hideTooltip, type TooltipResolver } from './tooltip.js'

const TOOLTIP_SELECTOR = '[data-tooltip], [data-tooltip-html]'
const BODY_CELL_SELECTOR = 'td.wg__cell[data-row][data-col]'


/** The body cell under `el` that can carry a column tooltip, or null. */
function bodyCellOf<T>(ctx: GridHost<T>, el: Element | null): HTMLElement | null {
	const cell = el?.closest(BODY_CELL_SELECTOR) as HTMLElement | null
	if (!cell) return null
	const column = ctx.engine.columns[Number(cell.dataset.col)]
	if (!column) return null
	const field = String(column.field)
	const mayHaveTooltip = !!column.getTooltipCallback
		|| !!column.tooltipMember
		|| ctx.engine.isCellInvalid(Number(cell.dataset.row), field)
	return mayHaveTooltip || cell.matches(TOOLTIP_SELECTOR) ? cell : null
}

/**
 * The element whose tooltip `el` belongs to: an element with its own
 * `data-tooltip*` inside a body cell wins (custom cell content, the tree
 * chevron, …); else the body cell; else the closest `data-tooltip*` element
 * (header info icon, the locked row-number cell, …).
 */
function tooltipOwnerOf<T>(ctx: GridHost<T>, el: Element | null): HTMLElement | null {
	if (!el) return null
	const attributed = el.closest(TOOLTIP_SELECTOR) as HTMLElement | null
	const cell = bodyCellOf(ctx, el)
	if (cell && (!attributed || !cell.contains(attributed) || attributed === cell)) return cell
	return attributed
}

/** Resolve the tooltip of `owner` at show time (a body cell re-runs its callbacks). */
function resolveTooltip<T>(ctx: GridHost<T>, owner: HTMLElement): ReturnType<TooltipResolver> {
	if (owner.matches(BODY_CELL_SELECTOR)) {
		const rowIndex = Number(owner.dataset.row)
		const column = ctx.engine.columns[Number(owner.dataset.col)]
		const item = ctx.engine.displayItems[rowIndex]
		if (column && item) {
			const tooltip = getCellTooltip(ctx, item, rowIndex, column)
			return tooltip ? { text: tooltip.text, isHtml: tooltip.attr === 'data-tooltip-html' } : null
		}
	}
	const html = owner.getAttribute('data-tooltip-html')
	if (html) return { text: html, isHtml: true }
	const text = owner.getAttribute('data-tooltip')
	return text ? { text, isHtml: false } : null
}

/**
 * Attach the tooltip mouseenter / mouseleave listeners to the table in
 * capture phase. Capture phase is required so tooltips can fire on nested
 * elements (e.g. icons inside cells) without relying on bubbling, which
 * doesn't fire for mouseenter / mouseleave.
 *
 * The mouseleave handler skips the hide when the cursor stays within the same
 * tooltip owner — prevents flicker when moving between a cell and its content.
 */
export function attachTooltipListeners<T>(ctx: GridHost<T>, table: Element): void {
	table.addEventListener('mouseenter', (e: Event) => {
		const owner = tooltipOwnerOf(ctx, e.target as Element)
		if (!owner) return
		showTooltip(ctx, owner, () => resolveTooltip(ctx, owner), ctx.tooltipShowDelay)
	}, true)

	table.addEventListener('mouseleave', (e: Event) => {
		const mouseEvent = e as MouseEvent
		const owner = tooltipOwnerOf(ctx, mouseEvent.target as Element)
		if (!owner) return
		if (tooltipOwnerOf(ctx, mouseEvent.relatedTarget as Element | null) === owner) return
		hideTooltip(ctx, ctx.tooltipHideDelay)
	}, true)
}

// =============================================================================
// Tooltip Module — core createTooltip (/positioning, SPEC §12.2), delegated mode
// =============================================================================
// ONE delegated tooltip over the shadow root serves every cell / header / row target
// (`closest(selector)`), plus one for the floating toolbar's buttons (their own show
// delay 0 — core's delay is per tooltip). Each shows on hover AND keyboard focus
// (core), resolves its content at every show (empty = none), hides on Escape, and
// dismisses the other one before it shows (beforeShowCallback).
//
// The tooltip owner is the innermost match: an element with its own `data-tooltip*`
// inside a body cell (custom cell content, the tree chevron, …) wins over the cell;
// a body cell is a target when its render gave it a tooltip attribute or its column
// has a tooltip source (`data-wg-tooltip`); else the closest `data-tooltip*` element
// (header info icon, the locked row-number cell, a locked row, …).
//
// A body cell's tooltip is resolved again when it is SHOWN (getCellTooltip:
// `getTooltipCallback` / `tooltipMember` / validation), not read from the attribute
// written at render time: state that changes without a re-render (selection, focus,
// the controller's view of the grid) would otherwise show stale content.

import { createTooltip, type TooltipHandle } from '@keenmate/web-components-core/positioning'
import type { GridHost } from '../grid-context.js'
import { getCellTooltip } from '../rendering/table.js'
import { GRID_ENGINE } from '../grid-context.js'

const BODY_CELL_SELECTOR = 'td.wg__cell[data-row][data-col]'
const CELL_TOOLTIP_SELECTOR = `[data-tooltip], [data-tooltip-html], ${BODY_CELL_SELECTOR}[data-wg-tooltip]`
const TOOLBAR_TOOLTIP_SELECTOR = '.wg__toolbar-container .wg__toolbar-btn'

/** The tooltip body: `.wg__tooltip-content` (text, or HTML the caller escaped). */
function contentElement(text: string, isHtml: boolean): HTMLElement {
	const el = document.createElement('div')
	el.className = 'wg__tooltip-content'
	if (isHtml) el.innerHTML = text
	else el.textContent = text
	return el
}

/** Resolve the tooltip of `target` at show time (a body cell re-runs its callbacks). */
function resolveTooltip<T>(ctx: GridHost<T>, target: HTMLElement): HTMLElement | null {
	if (target.matches(BODY_CELL_SELECTOR)) {
		const rowIndex = Number(target.dataset.row)
		const column = ctx[GRID_ENGINE].columns[Number(target.dataset.col)]
		const item = ctx[GRID_ENGINE].displayItems[rowIndex]
		if (column && item) {
			const tooltip = getCellTooltip(ctx, item, rowIndex, column)
			return tooltip ? contentElement(tooltip.text, tooltip.attr === 'data-tooltip-html') : null
		}
	}
	const html = target.getAttribute('data-tooltip-html')
	if (html) return contentElement(html, true)
	const text = target.getAttribute('data-tooltip')
	return text ? contentElement(text, false) : null
}

/**
 * The grid's two delegated core tooltips (cells / header / rows, toolbar buttons). Live
 * while the grid is connected (`start()` in connect(), `stop()` in disconnect()); a delay
 * change restarts them (core reads `delay` once).
 */
export class GridTooltips {
	#cell: TooltipHandle | null = null
	#toolbar: TooltipHandle | null = null
	/** Toolbar button → its tooltip HTML (heading, description, shortcut), set per toolbar render. */
	#toolbarContent = new WeakMap<Element, string>()

	start<T>(ctx: GridHost<T>): void {
		this.stop()
		const common = {
			trigger: ctx.shadow,
			container: ctx.shadow,
			strategy: 'absolute' as const,
			placement: 'top' as const,
			offset: 8,
			cssClass: 'wg__tooltip',
			visibleClass: 'wg__tooltip--visible',
		}
		const arrow = () => {
			const el = document.createElement('div')
			el.className = 'wg__tooltip-arrow'
			return el
		}
		this.#cell = createTooltip({
			...common,
			selector: CELL_TOOLTIP_SELECTOR,
			arrow: arrow(),
			delay: { show: ctx.tooltipShowDelay, hide: ctx.tooltipHideDelay },
			content: (target) => resolveTooltip(ctx, target),
			beforeShowCallback: () => { this.#toolbar?.hide() },
		})
		this.#toolbar = createTooltip({
			...common,
			selector: TOOLBAR_TOOLTIP_SELECTOR,
			arrow: arrow(),
			delay: { show: 0, hide: ctx.tooltipHideDelay },
			content: (target) => {
				const html = this.#toolbarContent.get(target)
				return html ? contentElement(html, true) : null
			},
			beforeShowCallback: () => { this.#cell?.hide() },
		})
	}

	stop(): void {
		this.#cell?.destroy()
		this.#toolbar?.destroy()
		this.#cell = this.#toolbar = null
	}

	/** Register a toolbar button's tooltip HTML (escaped by the caller). */
	setToolbarContent(button: Element, html: string): void {
		this.#toolbarContent.set(button, html)
	}

	/** The toolbar button whose tooltip shows, or null. */
	get toolbarTarget(): HTMLElement | null {
		return this.#toolbar?.target ?? null
	}

	/** Hide the toolbar button tooltip now (its DOM is going away; a cell tooltip stays). */
	hideToolbar(): void {
		this.#toolbar?.hide()
	}
}

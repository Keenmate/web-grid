// =============================================================================
// Reveal — every scroll the grid makes on its own (rulebook D-CA-5 = A)
// =============================================================================
//
// One gate for the grid's self-initiated scrolls: keyboard moves, `scrollToRow()`,
// the go-to-row dialog. It runs `beforeScrollCallback` (core runBeforeCallbackSync:
// `false` skips the scroll, a partial `options` replaces the defaults) and then
// scrolls through core `scrollIntoContainer()` — the one container around the cell
// or row, never the page (core SPEC §12.15). A virtual-scroll jump scrolls by index
// itself (`gateScroll()` only); there `false` still skips it.

import { scrollIntoContainer, findScrollContainer, runBeforeCallbackSync } from '@keenmate/web-components-core'
import type { GridHost } from '../grid-context.js'
import { calculateScrollToRow } from './calculations.js'
import { renderVirtualRows } from './element-handlers.js'
import type { GridBeforeScrollContext, GridScrollOptions, GridScrollSource } from '../../interaction.js'

/** Keyboard moves scroll only as far as needed; jumps center the row and bring the grid on screen. */
export const KEYBOARD_SCROLL: GridScrollOptions = { block: 'nearest', inline: 'nearest', behavior: 'auto', shouldRevealContainer: false }
export const JUMP_SCROLL: GridScrollOptions = { block: 'center', inline: 'nearest', behavior: 'auto', shouldRevealContainer: true }

/** What is being revealed, in grid vocabulary. */
export interface RevealTarget {
	rowIndex: number
	/** The column's field — `null` for a whole row (`scrollToRow`). */
	field: string | null
}

/**
 * Run `beforeScrollCallback` for a scroll the grid is about to make. Returns the options
 * to use, or `null` when the callback skipped it.
 */
export function gateScroll<T>(
	ctx: GridHost<T>,
	target: RevealTarget,
	source: GridScrollSource,
	container: HTMLElement | null,
	defaults: GridScrollOptions
): GridScrollOptions | null {
	const callback = ctx.beforeScrollCallback
	if (typeof callback !== 'function') return defaults
	const row = (ctx.engine.displayItems[target.rowIndex] ?? null) as T | null
	const callbackCtx: GridBeforeScrollContext<T> = ctx.engine.ctx({
		row,
		rowIndex: target.rowIndex,
		field: target.field,
		source,
		container,
		options: { ...defaults },
	})
	const result = runBeforeCallbackSync<GridBeforeScrollContext<T>, Partial<GridScrollOptions>>(callback, callbackCtx, 'beforeScrollCallback', ctx)
	if (result.isRejected) return null
	const replaced = (result as { hasValue: boolean; value?: Partial<GridScrollOptions> | null }).hasValue
		? (result as { value?: Partial<GridScrollOptions> | null }).value
		: undefined
	return replaced && typeof replaced === 'object' ? { ...defaults, ...replaced } : defaults
}

/**
 * Bring a rendered cell / row element into view (gated). Returns `false` when
 * `beforeScrollCallback` skipped the scroll.
 */
export function revealElement<T>(
	ctx: GridHost<T>,
	el: HTMLElement,
	target: RevealTarget,
	source: GridScrollSource,
	defaults: GridScrollOptions = KEYBOARD_SCROLL
): boolean {
	const container = findScrollContainer(el)
	const options = gateScroll(ctx, target, source, container, defaults)
	if (!options) return false
	scrollIntoContainer(el, {
		block: options.block,
		inline: options.inline,
		behavior: options.behavior,
		container: container ?? undefined,
		shouldRevealContainer: options.shouldRevealContainer,
	})
	return true
}

/** The field of the column at `colIndex` (an index into `columns`), or `null`. */
export function fieldAt<T>(ctx: GridHost<T>, colIndex: number): string | null {
	const column = ctx.engine.columns[colIndex]
	return column ? String(column.field) : null
}

/**
 * Scroll the displayed row `rowIndex` into view — `scrollToRow()` and the go-to-row dialog.
 * Resolves `true` once it is in view (after a frame), `false` when the index is out of range,
 * the row isn't rendered (not built yet) or `beforeScrollCallback` skipped it. With virtual
 * scroll it pre-renders the target range once, then scrolls by index (a flag stops the scroll
 * handler from rendering again).
 */
export function scrollRowIntoView<T>(ctx: GridHost<T>, rowIndex: number, source: GridScrollSource): Promise<boolean> {
	if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= ctx.engine.displayItems.length) return Promise.resolve(false)
	const container = ctx.shadow.querySelector('.wg') as HTMLElement | null
	if (!container) return Promise.resolve(false)
	const nextFrame = () => new Promise<boolean>(resolve => requestAnimationFrame(() => resolve(true)))

	if (!ctx.engine.shouldUseVirtualScroll()) {
		const tr = ctx.shadow.querySelector(`tr[data-row-index="${rowIndex}"]`) as HTMLElement | null
		if (!tr) return Promise.resolve(false)
		if (!revealElement(ctx, tr, { rowIndex, field: null }, source, JUMP_SCROLL)) return Promise.resolve(false)
		return nextFrame()
	}

	// Virtual scroll: an index jump — only `false` from beforeScrollCallback applies
	if (!gateScroll(ctx, { rowIndex, field: null }, source, container, JUMP_SCROLL)) return Promise.resolve(false)
	const { scrollTop, startIndex, endIndex } = calculateScrollToRow({
		targetRow: rowIndex,
		rowHeight: ctx.engine.virtualScrollItemHeight,
		buffer: ctx.engine.virtualScrollOverscan,
		totalItems: ctx.engine.displayItems.length,
		viewportHeight: container.clientHeight,
		scrollHeight: container.scrollHeight,
		clientHeight: container.clientHeight
	})
	// Update range and render ONCE (before scroll)
	if (ctx.virtualScroll.setRange(startIndex, endIndex)) renderVirtualRows(ctx, container)
	// Now scroll — the flag prevents handleVirtualScroll from re-rendering
	ctx.virtualScroll.beginProgrammaticScroll()
	container.scrollTop = scrollTop
	queueMicrotask(() => { ctx.virtualScroll.endProgrammaticScroll() })
	return nextFrame()
}

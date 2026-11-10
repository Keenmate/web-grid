// =============================================================================
// Reveal — every scroll the grid makes on its own (rulebook D-CA-5 = A)
// =============================================================================
//
// One gate for the grid's self-initiated scrolls: keyboard moves, `scrollToRow()`,
// the go-to-row dialog. It runs `beforeScrollCallback` (core runBeforeCallbackSync:
// `false` skips the scroll, a partial `options` replaces the defaults) and then
// scrolls through core `scrollIntoContainer()` — the one container around the cell
// or row, never the page (core SPEC §12.15). A virtual-scroll jump (the row isn't
// rendered) computes its scrollTop by index — core `getScrollTopForBox()` with the gated
// `block` — renders that window, then scrolls (`gateScroll()` + `virtualRowScrollTop()`).

import { scrollIntoContainer, findScrollContainer, getScrollTopForBox, runBeforeCallbackSync } from '@keenmate/web-components-core'
import type { GridHost } from '../grid-context.js'
import { calculateVisibleRange } from './calculations.js'
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

/**
 * Virtual scroll: the `.wg` scrollTop that shows the displayed row `rowIndex` per `block`
 * (core `getScrollTopForBox`, SPEC §12.15 — the row may not be rendered), or `null` when
 * nothing has to move. The row's box is in the container's content coordinates (below the
 * header: rows start at the tbody's top); the sticky header is the top inset.
 */
export function virtualRowScrollTop<T>(ctx: GridHost<T>, container: HTMLElement, rowIndex: number, block: ScrollLogicalPosition): number | null {
	const rowHeight = ctx.engine.virtualScrollItemHeight
	const tbody = container.querySelector('tbody')
	const bodyTop = tbody
		? tbody.getBoundingClientRect().top - container.getBoundingClientRect().top - container.clientTop + container.scrollTop
		: 0
	const header = container.querySelector('thead') as HTMLElement | null
	return getScrollTopForBox(container, { top: bodyTop + rowIndex * rowHeight, height: rowHeight }, { block, insetTop: header?.offsetHeight ?? 0 })
}

/** The element that scrolls the body (`.wg`, or `.wg__table-container` with `isTableBorderOnly`). */
export function bodyScroller<T>(ctx: GridHost<T>): HTMLElement | null {
	const wg = ctx.shadow.querySelector('.wg') as HTMLElement | null
	if (!ctx.engine.isTableBorderOnly) return wg
	return (ctx.shadow.querySelector('.wg__table-container') as HTMLElement | null) ?? wg
}

/**
 * How a keyboard reveal continues once the row is in place (`prepareRowReveal()`):
 * `undefined` — the row was already in view, reveal the cell as usual (gated);
 * `null` — `beforeScrollCallback` skipped the scroll (the row is rendered, not scrolled to);
 * options — the vertical scroll is done with these (already gated) options; only the horizontal is left.
 */
export type RowRevealState = GridScrollOptions | null | undefined

/**
 * Virtual scroll, a keyboard move to the displayed row `rowIndex`: make the row RENDERED and in
 * view NOW, synchronously — before the caller focuses its cell. A row outside the rendered
 * window has no element to focus or reveal; waiting for the scroll event to render it lost the
 * focus (and a held key, whose next keydown came before that render, moved from a stale cell).
 *
 * The window for the target scrollTop (core `getScrollTopForBox()` with the gated `block`) is
 * rendered first, then the container scrolls with the programmatic flag set, so the scroll
 * handler doesn't render again. `beforeScrollCallback` returning `false` keeps the scroll
 * position; the current window is then stretched to hold the row (it stays focusable).
 * No-op (`undefined`) outside virtual scroll or when the row is already fully in view.
 */
export function prepareRowReveal<T>(ctx: GridHost<T>, target: RevealTarget, source: GridScrollSource, defaults: GridScrollOptions = KEYBOARD_SCROLL): RowRevealState {
	if (!ctx.engine.shouldUseVirtualScroll()) return undefined
	const { rowIndex } = target
	if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= ctx.engine.displayItems.length) return undefined
	const container = bodyScroller(ctx)
	if (!container) return undefined
	const isRendered = !!container.querySelector(`tbody tr[data-row-index="${rowIndex}"]`)
	if (isRendered && virtualRowScrollTop(ctx, container, rowIndex, 'nearest') === null) return undefined

	const options = gateScroll(ctx, target, source, container, defaults)
	const scrollTop = options
		? virtualRowScrollTop(ctx, container, rowIndex, options.block) ?? container.scrollTop
		: container.scrollTop
	// The window for that scrollTop, stretched to hold the target row (and the edited row)
	const range = calculateVisibleRange({
		scrollTop,
		viewportHeight: container.clientHeight,
		rowHeight: ctx.engine.virtualScrollItemHeight,
		buffer: ctx.engine.virtualScrollOverscan,
		totalItems: ctx.engine.displayItems.length,
		editingRowIndex: rowIndex
	})
	const editingRow = ctx.engine.editingCell?.rowIndex
	if (editingRow !== undefined && editingRow !== rowIndex) {
		range.startIndex = Math.min(range.startIndex, editingRow)
		range.endIndex = Math.max(range.endIndex, editingRow + 1)
	}
	if (ctx.virtualScroll.setRange(range.startIndex, range.endIndex)) renderVirtualRows(ctx, container)
	if (!options) return null
	if (scrollTop !== container.scrollTop) {
		// The flag stops handleVirtualScroll from rendering again for this scroll
		ctx.virtualScroll.beginProgrammaticScroll()
		container.scrollTop = scrollTop
		queueMicrotask(() => { ctx.virtualScroll.endProgrammaticScroll() })
	}
	return options
}

/**
 * The second half of a keyboard reveal, after the cell got focus: `undefined` (nothing was
 * prepared) → the usual gated `revealElement()`; options → only the horizontal axis is left
 * (the row is in view vertically — `block: 'nearest'` keeps it); `null` → skipped.
 *
 * Virtual scroll: a scroll made here (a row a pixel short of fully visible, the horizontal axis)
 * gets its window rendered NOW, not by the scroll event a frame later — that late swap re-rendered
 * the body under the next key (an edit started right after the move lost its editor).
 */
export function finishCellReveal<T>(ctx: GridHost<T>, cell: HTMLElement, target: RevealTarget, source: GridScrollSource, state: RowRevealState): void {
	if (state === undefined) {
		revealElement(ctx, cell, target, source)
	} else if (state) {
		scrollIntoContainer(cell, {
			block: 'nearest',
			inline: state.inline,
			behavior: state.behavior,
			container: findScrollContainer(cell) ?? undefined,
		})
	} else {
		return  // skipped: the window was stretched to hold the row — keep it
	}
	syncVirtualWindow(ctx)
}

/**
 * Virtual scroll: render the window for the container's CURRENT scrollTop now, when it differs
 * from the rendered one (what the scroll handler would do on the next frame). No-op otherwise.
 */
export function syncVirtualWindow<T>(ctx: GridHost<T>): void {
	if (!ctx.engine.shouldUseVirtualScroll()) return
	const container = bodyScroller(ctx)
	if (!container) return
	const { startIndex, endIndex } = calculateVisibleRange({
		scrollTop: container.scrollTop,
		viewportHeight: container.clientHeight,
		rowHeight: ctx.engine.virtualScrollItemHeight,
		buffer: ctx.engine.virtualScrollOverscan,
		totalItems: ctx.engine.displayItems.length,
		editingRowIndex: ctx.engine.editingCell?.rowIndex
	})
	if (ctx.virtualScroll.setRange(startIndex, endIndex)) renderVirtualRows(ctx, container)
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

	// Virtual scroll: an index jump (instant — the window is rendered for it first)
	const options = gateScroll(ctx, { rowIndex, field: null }, source, container, JUMP_SCROLL)
	if (!options) return Promise.resolve(false)
	const scrollTop = virtualRowScrollTop(ctx, container, rowIndex, options.block) ?? container.scrollTop
	// The window for that scrollTop, stretched to hold the target row
	const { startIndex, endIndex } = calculateVisibleRange({
		scrollTop,
		viewportHeight: container.clientHeight,
		rowHeight: ctx.engine.virtualScrollItemHeight,
		buffer: ctx.engine.virtualScrollOverscan,
		totalItems: ctx.engine.displayItems.length,
		editingRowIndex: rowIndex
	})
	// Update range and render ONCE (before scroll)
	if (ctx.virtualScroll.setRange(startIndex, endIndex)) renderVirtualRows(ctx, container)
	// Now scroll — the flag prevents handleVirtualScroll from re-rendering
	ctx.virtualScroll.beginProgrammaticScroll()
	container.scrollTop = scrollTop
	queueMicrotask(() => { ctx.virtualScroll.endProgrammaticScroll() })
	return nextFrame()
}

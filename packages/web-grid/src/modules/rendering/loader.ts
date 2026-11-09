// =============================================================================
// Loading states — every loader is drawn by core renderLoader() (SPEC §12.14)
// =============================================================================
//
// Precedence (core): the instance `renderLoadingCallback` > page-wide
// `window.components.renderLoadingCallback` > the default `<span class="wg__loader">`
// (drawn from the --wg-loader-* tokens in states.css).
//
// The grid renders by innerHTML, so a loader's container can be replaced at any
// time. Each loading state has one slot per grid; syncLoader() keeps it in step
// with the DOM: same container → nothing, new container → the old loader's
// remove() (hook cleanup) then a fresh draw, none → remove().

import { renderLoader } from '@keenmate/web-components-core'
import type { GridHost } from '../grid-context.js'

/** The grid's loading states (= the `context` the render hooks receive, except the slot suffix). */
export type GridLoaderSlot = 'row' | 'search-editor' | 'search-dropdown'

const CONTEXTS: Record<GridLoaderSlot, string> = {
	'row': 'row',
	'search-editor': 'search',
	'search-dropdown': 'search',
}

interface DrawnLoader {
	container: HTMLElement
	remove: () => void
}

const drawn = new WeakMap<object, Map<GridLoaderSlot, DrawnLoader>>()

/**
 * Draw the `slot` loader into `container` (or remove it when `container` is null).
 * Idempotent for the same container.
 */
export function syncLoader<T>(ctx: GridHost<T>, slot: GridLoaderSlot, container: HTMLElement | null, label: string): void {
	let slots = drawn.get(ctx)
	const current = slots?.get(slot)
	if (current && current.container === container) return
	if (current) {
		current.remove()
		slots!.delete(slot)
	}
	if (!container) return
	const remove = renderLoader(ctx.shadow.host as HTMLElement, container, CONTEXTS[slot], { label, prefix: 'wg' })
	if (!slots) drawn.set(ctx, (slots = new Map()))
	slots.set(slot, { container, remove })
}

/**
 * Remove the loaders whose container left the DOM (a re-render, a closed editor /
 * dropdown) — runs their hook cleanup.
 */
export function pruneDetachedLoaders<T>(ctx: GridHost<T>): void {
	const slots = drawn.get(ctx)
	if (!slots) return
	for (const [slot, { container, remove }] of slots) {
		if (!ctx.shadow.contains(container)) {
			remove()
			slots.delete(slot)
		}
	}
}

/** The infinite-scroll "loading more" row: draw into its indicator, or clean up when it's gone. */
export function syncLoadingMoreLoader<T>(ctx: GridHost<T>): void {
	pruneDetachedLoaders(ctx)
	const container = ctx.shadow.querySelector('.wg__loading-more-indicator') as HTMLElement | null
	syncLoader(ctx, 'row', container, ctx.engine.labels.loading)
}

/** Remove every loader of this grid (destroy). */
export function removeAllLoaders<T>(ctx: GridHost<T>): void {
	const slots = drawn.get(ctx)
	if (!slots) return
	for (const { remove } of slots.values()) remove()
	drawn.delete(ctx)
}

// =============================================================================
// Filter row (grid `isFilteringEnabled`)
// =============================================================================
// The row itself is rendered with the header (rendering/table.ts →
// renderHeaderRow) so frozen offsets and widths match. This module owns the
// behaviour:
//
//   - typing → debounced (FILTER_DEBOUNCE_MS) → `setFilter(field, text)` → page 1;
//     Enter applies at once, Escape clears the input (and applies);
//   - IME-safe (core onTextInput, delegated on the shadow root): a composition filters once, on
//     commit; the Enter that confirms a candidate (isImeEnter) doesn't apply;
//   - matching is core /search "contains", case- and accent-insensitive (grid.ts filteredItems);
//   - server pagination: the change runs through `beforePageChangeCallback`
//     (trigger 'filter') and fires `data-request` (trigger 'filter');
//   - the typed-but-not-yet-applied text survives a re-render (the thead is
//     rebuilt on every render), and so does focus + caret (capture / restore).
//
// `filterCallback` returning null marks the input `.wg__filter-input--invalid` (red border) via
// `getInvalidFilterFields()`.

import type { GridHost } from '../grid-context.js'
import { guardPageChange } from '../events/page-change.js'
import { createDebounce, isImeEnter, onTextInput, type Debounce } from '@keenmate/web-components-core'
import { GRID_ENGINE } from '../grid-context.js'

export const FILTER_DEBOUNCE_MS = 300

/** Per-grid state: typed text not applied yet + one debounce per field (core createDebounce). */
export class FilterRowService {
	readonly pendingText = new Map<string, string>()
	readonly #debounces = new Map<string, Debounce<[() => void]>>()

	/** Run `apply` once typing in `field` pauses for FILTER_DEBOUNCE_MS (the last call wins). */
	schedule(field: string, apply: () => void): void {
		let debounce = this.#debounces.get(field)
		if (!debounce) this.#debounces.set(field, (debounce = createDebounce((run: () => void) => run(), FILTER_DEBOUNCE_MS)))
		debounce.schedule(apply)
	}

	clearTimer(field: string): void {
		this.#debounces.get(field)?.cancel()
	}

	reset(): void {
		for (const debounce of this.#debounces.values()) debounce.cancel()
		this.pendingText.clear()
	}
}

/** Apply a filter-row value now (the debounce fired, Enter, Escape). */
export function applyFilterInput<T>(ctx: GridHost<T>, field: string, text: string): void {
	const svc = ctx.filterRow
	svc.clearTimer(field)
	svc.pendingText.delete(field)
	const engine = ctx[GRID_ENGINE]
	if ((engine.filters[field] ?? '') === text) return

	if (engine.paginationMode === 'server') {
		guardPageChange(ctx, 'filter', 1, page => {
			engine.setFilter(field, text)
			engine.currentPage = page
			engine.fireDataRequest('filter')
		})
		return
	}
	engine.setFilter(field, text)
}

/** The focused filter input (field + caret), to restore after the thead is rebuilt. */
export interface FilterFocus {
	field: string
	selectionStart: number | null
	selectionEnd: number | null
}

export function captureFilterFocus<T>(ctx: GridHost<T>): FilterFocus | null {
	const active = ctx.shadow.activeElement as HTMLElement | null
	if (!active || !active.matches('.wg__filter-input')) return null
	const input = active as HTMLInputElement
	return { field: input.dataset.field ?? '', selectionStart: input.selectionStart, selectionEnd: input.selectionEnd }
}

export function restoreFilterFocus<T>(ctx: GridHost<T>, focus: FilterFocus | null): void {
	if (!focus) return
	const input = Array.from(ctx.shadow.querySelectorAll<HTMLInputElement>('.wg__filter-input'))
		.find(i => i.dataset.field === focus.field)
	if (!input || ctx.shadow.activeElement === input) return
	input.focus({ preventScroll: true })
	try {
		input.setSelectionRange(focus.selectionStart, focus.selectionEnd)
	} catch { /* not a text input */ }
}

/**
 * Stick the filter row under the (sticky) header row: its cells get
 * `top` = the header row's height. Measured after each render.
 */
export function positionFilterRow<T>(ctx: GridHost<T>): void {
	const row = ctx.shadow.querySelector<HTMLElement>('.wg__filter-row')
	if (!row) return
	const headerRow = row.previousElementSibling as HTMLElement | null
	const height = headerRow?.offsetHeight ?? 0
	if (height <= 0) return
	row.querySelectorAll<HTMLElement>('th').forEach(th => { th.style.top = `${height}px` })
}

/**
 * Typed filter text — core `onTextInput`, delegated on the shadow root (one subscription covers the
 * inputs every render rebuilds; an IME composition reports once, on commit). Returns the unsubscribe.
 */
export function watchFilterRowText<T>(ctx: GridHost<T>, root: ShadowRoot): () => void {
	return onTextInput(root, (text, _event, input) => {
		const field = (input as HTMLInputElement).dataset.field ?? ''
		const svc = ctx.filterRow
		svc.pendingText.set(field, text)
		svc.schedule(field, () => applyFilterInput(ctx, field, text))
	}, { selector: '.wg__filter-input' })
}

/** Delegated key listener on the `.wg` container (survives the thead re-render). */
export function attachFilterRowListeners<T>(ctx: GridHost<T>, container: HTMLElement): void {
	container.addEventListener('keydown', (e: KeyboardEvent) => {
		const input = e.target as HTMLElement
		if (!input.matches?.('.wg__filter-input')) return
		// The grid's own keys (type-to-edit, arrows, Ctrl+C, …) never see filter typing
		e.stopPropagation()
		// The IME confirming a candidate, not "apply now"
		if (isImeEnter(e)) return
		const el = input as HTMLInputElement
		const field = el.dataset.field ?? ''
		if (e.key === 'Enter') {
			e.preventDefault()
			applyFilterInput(ctx, field, el.value)
		} else if (e.key === 'Escape' && el.value !== '') {
			e.preventDefault()
			el.value = ''
			applyFilterInput(ctx, field, '')
		}
	}, true)
}

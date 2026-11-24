/**
 * Built-in text matching — core `/search`: case- and diacritics-insensitive "contains", the same rule
 * web-multiselect uses (`ces` finds `Český`, `strasse` finds `Straße`).
 *
 * - `createTextMatcher` — the dropdown / combobox editors' option lists (small; each value normalized per call).
 * - `FilterTextCache` + `prepareFilterTerm` / `matchesFilterTerm` — the filter row (grid.ts filteredItems /
 *   getTreeFilterAllowedPaths): each cell value is normalized ONCE per data change, not per keystroke
 *   (100k rows). Core's ASCII fast path keeps the first pass at about `toLowerCase` speed.
 */
import {
	createRegexCompiler, matchesSearchTerm, matchesText, normalizeSearchText, prepareSearchTerm,
	type ActiveSearchTerm,
} from '@keenmate/web-components-core/search'

/** A predicate for one typed term; the term is normalized once, each value on every call. */
export function createTextMatcher(term: string): (value: unknown) => boolean {
	const needle = normalizeSearchText(term, 'normalized')
	return (value) => matchesText(normalizeSearchText(value == null ? '' : String(value), 'normalized'), needle, 'contains')
}

// The filter row never uses `match: 'regex'`; prepareSearchTerm still wants a compiler.
const FILTER_REGEX = createRegexCompiler()

/** One typed filter-row term → core's prepared term (trimmed + normalized; blank = matches everything). */
export function prepareFilterTerm(text: string): ActiveSearchTerm {
	return prepareSearchTerm(text, { behavior: 'normalized', match: 'contains', regex: FILTER_REGEX })
}

/** Whether a prepared (normalized) cell value contains the term. */
export function matchesFilterTerm(term: ActiveSearchTerm, prepared: string): boolean {
	return matchesSearchTerm(term, 'contains', prepared, prepared)
}

/**
 * Normalized cell values per field, indexed by the row's position in `items`. `reconcile(items)` drops
 * everything when the items array changes; a value edited in place is caught by the raw-string check.
 */
export class FilterTextCache {
	#items: readonly unknown[] | null = null
	readonly #fields = new Map<string, { raws: string[]; norms: string[] }>()

	/** Call once per filter pass with the current items array. */
	reconcile(items: readonly unknown[]): void {
		if (items === this.#items) return
		this.#items = items
		this.#fields.clear()
	}

	/** The normalized text of `value` = `items[index][field]` (computed once, reused across keystrokes). */
	get(field: string, index: number, value: unknown): string {
		const raw = value == null ? '' : String(value)
		let entry = this.#fields.get(field)
		if (!entry) this.#fields.set(field, (entry = { raws: [], norms: [] }))
		if (entry.raws[index] === raw) return entry.norms[index]
		const norm = normalizeSearchText(raw, 'normalized')
		entry.raws[index] = raw
		entry.norms[index] = norm
		return norm
	}
}

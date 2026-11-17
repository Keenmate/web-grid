/**
 * Built-in text matching for the dropdown / combobox editors' option lists — core `/search`
 * (`normalizeSearchText` + `matchesText`): case- and diacritics-insensitive "contains", the same rule
 * web-multiselect uses (`ces` finds `Český`, `strasse` finds `Straße`).
 *
 * The filter row (grid.ts filteredItems / getTreeFilterAllowedPaths) still matches with
 * `toLowerCase().includes`: core normalizeSearchText is ~100x slower per value (it builds a highlight
 * source map), 0.4–0.8 s per pass over 100k rows. It moves here once core has a fast path.
 */
import { matchesText, normalizeSearchText } from '@keenmate/web-components-core/search'

/** A predicate for one typed term; the term is normalized once, each value on every call. */
export function createTextMatcher(term: string): (value: unknown) => boolean {
	const needle = normalizeSearchText(term, 'normalized')
	return (value) => matchesText(normalizeSearchText(value == null ? '' : String(value), 'normalized'), needle, 'contains')
}

// =============================================================================
// Labels (i18n) — every UI string of the grid, through core /locale
// =============================================================================
// Keys are flat `<elementType>.<name>` (rulebook D-NC-24): `buttons.nextPage`,
// `menuItems.deleteRow`, `ariaLabels.filterColumn`, … Per key (core `createLabels`,
// SPEC §12.24): the instance `labels` (property + JSON attribute; short keys or full
// `web-grid.*` keys) → the page-wide flat `window.components.locale.labels['web-grid.<key>']`
// → the English defaults below. A key set to `''` renders nothing (deliberately empty);
// a non-string falls through. A dynamic label gets its spot's context as `{ ctx }` — templates read
// `{ctx.count}`, `{ctx.currentPage}`, … (rulebook D-NC-24; numbers formatted in the grid's locale;
// `ctx.count` = the number the text's noun agrees with, so an app's `translateCallback` pluralizes).
// The `{ctx.*}` display and the `translateCallback`s (ICU / i18next) are applied by core when a
// label is read through the resolver.
// Escaping follows the core split (SPEC §12.24) by WHERE the label is written:
// - CONTENT (innerHTML: pager, empty / loading message, headers, dialog texts) → `html(key, params)`
//   (engine `labelHtml()`): the template is markup (`<b>` renders), `{…}` param values are escaped;
//   `window.components.security.shouldEscapeLabels` escapes the whole label.
// - an attribute (`aria-label`, `title`, `data-tooltip`), `textContent`, a core menu item, an
//   announcement → `text(key, params)` / the resolved `labels` object (renderers `escapeHtml` it
//   into attribute markup).

import { escapeHtml } from '@keenmate/web-components-core'
import { createLabels, formatLabel as formatTemplate, getPageSecurity, resolveLabel, type LabelParams, type Labels, type LabelsView } from '@keenmate/web-components-core/locale'
import type { GridLabels, GridLabelsInput } from './types.js'

/** The built-in UI strings (English only). */
export const DEFAULT_LABELS: GridLabels = {
	// Row toolbar / inline actions column
	'tooltips.rowActions': 'Row actions',
	'ariaLabels.rowActions': 'Row actions',
	'columnHeaders.inlineActions': 'Actions',

	// Shortcuts help
	'tooltips.keyboardShortcuts': 'Keyboard shortcuts',
	'headers.keyboardShortcuts': 'Keyboard shortcuts',
	'headers.rangeShortcuts': 'Selection shortcuts',

	// Pagination
	'buttons.firstPage': '⏮',
	'buttons.previousPage': '◀',
	'buttons.nextPage': '▶',
	'buttons.lastPage': '⏭',
	'ariaLabels.firstPage': 'First page',
	'ariaLabels.previousPage': 'Previous page',
	'ariaLabels.nextPage': 'Next page',
	'ariaLabels.lastPage': 'Last page',
	'labels.pageInfo': 'Page {ctx.currentPage} of {ctx.totalPages}',
	'labels.itemCount': 'Items: {ctx.count}',
	'labels.perPage': 'per page',

	// Empty table / loading
	'messages.noData': 'No items to display',
	'messages.noResults': 'No matching items',
	'messages.loading': 'Loading…',
	'ariaLabels.loading': 'Loading…',

	// Dropdown
	'messages.noOptions': 'No options',
	'messages.noMatchingOptions': 'No matching options',
	'messages.searching': 'Searching…',
	'ariaLabels.searching': 'Searching…',
	'labels.emptyOption': '—',

	// Phone sheet (the cell dropdown / date editor on a phone; the menu sheet / drawer too)
	'ariaLabels.closeSheet': 'Close',
	'placeholders.search': 'Search…',

	// Cell / header menu (core openMenu(): a submenu level's back row on a phone)
	'menuItems.back': 'Back',

	// Row locking
	'tooltips.rowLocked': 'This row is locked',
	'tooltips.rowLockedBy': 'Locked by {ctx.lockedBy}',

	// Go-to-row dialog
	'labels.goToRow': 'Go to row (1-{ctx.max}):',
	'buttons.go': 'Go',
	'buttons.cancel': 'Cancel',

	// Tree chevron
	'ariaLabels.expand': 'Expand',
	'ariaLabels.collapse': 'Collapse',

	// Filter row
	'ariaLabels.filterColumn': 'Filter {ctx.title}',

	// Edit button (editTrigger: 'button')
	'ariaLabels.editCell': 'Edit',
	'tooltips.editCell': 'Edit',

	// Built-in value checks
	'errors.invalidNumber': 'Not a number',
	'errors.numberMin': 'Must be at least {ctx.min}',
	'errors.numberMax': 'Must be at most {ctx.max}',
	'errors.numberNegative': 'Must not be negative',
	'errors.invalidBoolean': 'Not a yes / no value',
	'errors.invalidDate': 'Not a valid date',

	// Built-in row / tree actions (the item text: toolbar, cell context menu, shortcuts help)
	'menuItems.addRow': 'Add row',
	'menuItems.deleteRow': 'Delete row',
	'menuItems.duplicateRow': 'Duplicate row',
	'menuItems.moveUp': 'Move up',
	'menuItems.moveDown': 'Move down',
	'menuItems.expand': 'Expand',
	'menuItems.collapse': 'Collapse',
	'menuItems.expandSubtree': 'Expand subtree',
	'menuItems.collapseSubtree': 'Collapse subtree',
	'menuItems.expandAll': 'Expand all',
	'menuItems.collapseAll': 'Collapse all',

	// Header context menu
	'menuItems.sortAsc': 'Sort Ascending',
	'menuItems.sortDesc': 'Sort Descending',
	'menuItems.clearSort': 'Clear Sort',
	'menuItems.hideColumn': 'Hide Column',
	'menuItems.freezeColumn': 'Freeze Column',
	'menuItems.unfreezeColumn': 'Unfreeze Column',
	'menuItems.columnVisibility': 'Column Visibility',
	'menuItems.showAllColumns': 'Show all'
}

/** A label key (`buttons.nextPage`, `menuItems.deleteRow`, …). */
export type GridLabelKey = keyof GridLabels & string

const TAG = 'web-grid'
const KEYS = Object.keys(DEFAULT_LABELS) as GridLabelKey[]
/** Keys whose default carries `{ctx.*}` placeholders — read with params at the render site. */
const PARAM_KEYS = new Set(KEYS.filter(key => /\{[\w.]+\}/.test(DEFAULT_LABELS[key])))

/** A label formatter: `key` + its resolved template + params → the text. */
export type LabelFormat = (key: GridLabelKey, template: string, params: LabelParams) => string
/** Default `{ctx.*}` replacement (no page `translateCallback`). */
export const defaultLabelFormat: LabelFormat = (_key, template, params) => formatTemplate(template, params)

/**
 * The grid's labels for one instance: `resolve()` → the resolved `GridLabels` object the renderers read
 * (a key with placeholders holds its template), `text(key, params)` → one formatted text. Core
 * `createLabels` formats — with the element as `host` (its `translateCallback`, page-wide labels /
 * locale / logger), or host-less (`null`, the engine on its own / unit tests: tag `web-grid`, no own
 * `translateCallback`) — the same chain and escaping either way.
 */
export class GridLabelsResolver {
	#input: GridLabelsInput | null | undefined = null
	#locale: string | null = null
	#handle: Labels<GridLabels> = this.#create(null)

	/** The grid's own `locale` input (numbers in labels, `translateCallback`'s `ctx.locale`); `null` = page → browser. */
	setLocale(locale: string | null | undefined): void {
		this.#locale = locale ?? null
	}

	setInput(input: GridLabelsInput | null | undefined): void {
		this.#input = input
	}

	setHost(host: Element | null): void {
		this.#handle = this.#create(host)
	}

	#create(host: Element | null): Labels<GridLabels> {
		return createLabels<GridLabels>(host, DEFAULT_LABELS, () => this.#input, { tag: TAG, getLocale: () => this.#locale })
	}

	text(key: GridLabelKey, params?: LabelParams): string {
		return this.#handle.text(key, params)
	}

	/** One label for innerHTML: template markup kept, `{…}` params escaped (all escaped with `shouldEscapeLabels`). */
	html(key: GridLabelKey, params?: LabelParams): string {
		return this.#handle.html(key, params)
	}

	readonly format: LabelFormat = (key, _template, params) => this.text(key, params)

	/**
	 * `ctx.labels` for a user callback (core `LabelsView` — the shape of `createLabelsView`): a frozen
	 * `{ text, html }` running the whole chain, never the grid's resolved labels object.
	 */
	readonly view: LabelsView<GridLabels> = Object.freeze({
		text: (key: GridLabelKey, params?: LabelParams) => this.text(key, params),
		html: (key: GridLabelKey, params?: LabelParams) => this.html(key, params)
	})

	resolve(): GridLabels {
		const out = {} as Record<string, string>
		for (const key of KEYS) {
			out[key] = PARAM_KEYS.has(key) ? resolveLabel(TAG, DEFAULT_LABELS, this.#input, key) : this.text(key)
		}
		return out as GridLabels
	}
}

/**
 * An already-resolved label template (no params — e.g. a column's own `labels` override) for innerHTML:
 * as is, or escaped with `window.components.security.shouldEscapeLabels` — the same rule as `html()`.
 */
export function labelTemplateHtml(template: string): string {
	return getPageSecurity()?.shouldEscapeLabels === true ? escapeHtml(template) : template
}

/** The labels resolved without an element (defaults + instance + page-wide). */
export function resolveLabels(input: GridLabelsInput | null | undefined): GridLabels {
	const resolver = new GridLabelsResolver()
	resolver.setInput(input)
	return resolver.resolve()
}

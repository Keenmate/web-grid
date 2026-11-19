// =============================================================================
// Labels (i18n) — every UI string of the grid, through core /locale
// =============================================================================
// Keys are flat `<elementType>.<name>` (rulebook D-NC-24): `buttons.nextPage`,
// `menuItems.deleteRow`, `ariaLabels.filterColumn`, … Per key (core `createLabels`,
// SPEC §12.24): the instance `labels` (property + JSON attribute; short keys or full
// `web-grid.*` keys) → the page-wide flat `window.components.locale.labels['web-grid.<key>']`
// → the English defaults below. A key set to `''` renders nothing (deliberately empty);
// a non-string falls through. `{name}` placeholders and the page's `translateCallback`
// (ICU / i18next) are applied by core when a label is read through `GridLabelsResolver.text()`.
// Labels are TEXT here: renderers escape them for innerHTML (`escapeHtml`).

import { createLabels, formatLabel as formatTemplate, resolveLabel, type LabelParams, type Labels } from '@keenmate/web-components-core/locale'
import type { GridLabels, GridLabelsInput } from './types.js'

/** The built-in UI strings (English only). */
export const DEFAULT_LABELS: GridLabels = {
	// Row toolbar / inline actions column
	'tooltips.rowActions': 'Row actions',
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
	'labels.pageInfo': 'Page {current} of {total}',
	'labels.itemCount': '{count} items',
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
	'tooltips.rowLockedBy': 'Locked by {lockedBy}',

	// Go-to-row dialog
	'labels.goToRow': 'Go to row (1-{max}):',
	'buttons.go': 'Go',
	'buttons.cancel': 'Cancel',

	// Tree chevron
	'ariaLabels.expand': 'Expand',
	'ariaLabels.collapse': 'Collapse',

	// Filter row
	'ariaLabels.filterColumn': 'Filter {column}',

	// Edit button (editTrigger: 'button')
	'ariaLabels.editCell': 'Edit',
	'tooltips.editCell': 'Edit',

	// Built-in value checks
	'errors.invalidNumber': 'Not a number',
	'errors.numberMin': 'Must be at least {min}',
	'errors.numberMax': 'Must be at most {max}',
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
/** Keys whose default carries `{name}` placeholders — read with params at the render site. */
const PARAM_KEYS = new Set(KEYS.filter(key => /\{\w+\}/.test(DEFAULT_LABELS[key])))

/** A label formatter: `key` + its resolved template + params → the text. */
export type LabelFormat = (key: GridLabelKey, template: string, params: LabelParams) => string
/** Default `{name}` replacement (no page `translateCallback`). */
export const defaultLabelFormat: LabelFormat = (_key, template, params) => formatTemplate(template, params)

/**
 * The grid's labels for one instance: `resolve()` → the resolved `GridLabels` object the renderers read
 * (a key with placeholders holds its template), `text(key, params)` → one formatted text. With a `host`
 * (the element) core `createLabels` formats — page `translateCallback` included; without one (the
 * engine on its own, unit tests) the default `{name}` replacement.
 */
export class GridLabelsResolver {
	#input: GridLabelsInput | null | undefined = null
	#handle: Labels<GridLabels> | null = null

	setInput(input: GridLabelsInput | null | undefined): void {
		this.#input = input
	}

	setHost(host: Element | null): void {
		this.#handle = host ? createLabels<GridLabels>(host, DEFAULT_LABELS, () => this.#input, { tag: TAG }) : null
	}

	text(key: GridLabelKey, params?: LabelParams): string {
		if (this.#handle) return this.#handle.text(key, params)
		return formatTemplate(resolveLabel(TAG, DEFAULT_LABELS, this.#input, key), params)
	}

	readonly format: LabelFormat = (key, _template, params) => this.text(key, params)

	resolve(): GridLabels {
		const out = {} as Record<string, string>
		for (const key of KEYS) {
			out[key] = PARAM_KEYS.has(key) ? resolveLabel(TAG, DEFAULT_LABELS, this.#input, key) : this.text(key)
		}
		return out as GridLabels
	}
}

/** The labels resolved without an element (defaults + instance + page-wide). */
export function resolveLabels(input: GridLabelsInput | null | undefined): GridLabels {
	const resolver = new GridLabelsResolver()
	resolver.setInput(input)
	return resolver.resolve()
}

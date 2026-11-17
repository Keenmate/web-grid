// =============================================================================
// Labels (i18n) — every UI string of the grid, through core /locale
// =============================================================================
// Per key (core `resolveLabel` / `createLabels`, SPEC §12.24): the instance `labels`
// (property + JSON attribute, a partial object) → the page-wide
// `window.components.locale.labels['web-grid']` → the English defaults below. A
// key set to `''` renders nothing (deliberately empty); a non-string falls through.
// `{name}` placeholders and the page's `formatLabelCallback` (ICU / i18next) are
// applied by core when a label is read through `GridLabelsResolver.text()`.
// The nested groups (`actions`, `contextMenu`) resolve per key the same way —
// instance group → page group (`labels['web-grid'].actions`) → default — but core
// labels are flat, so their texts don't go through `formatLabelCallback`.
// Labels are TEXT here: renderers escape them for innerHTML (`escapeHtml`).

import { createLabels, formatLabel as formatTemplate, getPageLocale, resolveLabel, type LabelParams, type Labels } from '@keenmate/web-components-core/locale'
import type { GridLabels, GridLabelsInput } from './types.js'

/** The built-in UI strings (English only). */
export const DEFAULT_LABELS: GridLabels = {
	// Toolbar
	rowActions: 'Row actions',
	inlineActionsHeader: 'Actions',

	// Shortcuts help
	keyboardShortcuts: 'Keyboard shortcuts',
	rangeShortcuts: 'Selection shortcuts',

	// Pagination
	paginationFirst: '⏮',
	paginationPrevious: '◀',
	paginationNext: '▶',
	paginationLast: '⏭',
	paginationPageInfo: 'Page {current} of {total}',
	paginationItemCount: '{count} items',
	paginationPerPage: 'per page',

	// Empty table / loading
	noData: 'No items to display',
	noResults: 'No matching items',
	loading: 'Loading…',

	// Dropdown
	dropdownNoData: 'No options',
	dropdownNoResults: 'No matching options',
	dropdownSearching: 'Searching…',
	dropdownEmptyOption: '—',

	// Phone sheet (the cell dropdown / date editor on a phone)
	sheetClose: 'Close',
	sheetSearch: 'Search…',

	// Cell / header menu (core openMenu(); its phone sheet / drawer closes with sheetClose)
	menuBack: 'Back',

	// Row locking
	rowLocked: 'This row is locked',
	rowLockedBy: 'Locked by {lockedBy}',

	// Go-to-row dialog
	goToRow: 'Go to row (1-{max}):',
	goToRowGo: 'Go',
	goToRowCancel: 'Cancel',

	// Tree chevron
	treeExpand: 'Expand',
	treeCollapse: 'Collapse',

	// Filter row
	filterColumn: 'Filter {column}',

	// Edit button (editTrigger: 'button')
	editCell: 'Edit',

	// Built-in value checks
	invalidNumber: 'Not a number',
	numberMin: 'Must be at least {min}',
	numberMax: 'Must be at most {max}',
	numberNegative: 'Must not be negative',
	invalidBoolean: 'Not a yes / no value',
	invalidDate: 'Not a valid date',

	// Built-in row / tree actions
	actions: {
		add: 'Add row',
		delete: 'Delete row',
		duplicate: 'Duplicate row',
		moveUp: 'Move up',
		moveDown: 'Move down',
		expand: 'Expand',
		collapse: 'Collapse',
		expandSubtree: 'Expand subtree',
		collapseSubtree: 'Collapse subtree',
		expandAll: 'Expand all',
		collapseAll: 'Collapse all'
	},

	// Header context menu
	contextMenu: {
		sortAsc: 'Sort Ascending',
		sortDesc: 'Sort Descending',
		clearSort: 'Clear Sort',
		hideColumn: 'Hide Column',
		freezeColumn: 'Freeze Column',
		unfreezeColumn: 'Unfreeze Column',
		columnVisibility: 'Column Visibility',
		showAll: 'Show all'
	}
}

type GroupName = 'actions' | 'contextMenu'
/** The flat (non-group) label keys. */
export type GridLabelKey = Exclude<keyof GridLabels, GroupName>
type FlatLabels = Omit<GridLabels, GroupName>

const TAG = 'web-grid'
const GROUPS: readonly GroupName[] = ['actions', 'contextMenu']
const { actions: _actions, contextMenu: _contextMenu, ...FLAT_DEFAULTS } = DEFAULT_LABELS
const FLAT_KEYS = Object.keys(FLAT_DEFAULTS) as GridLabelKey[]
/** Keys whose default carries `{name}` placeholders — read with params at the render site. */
const PARAM_KEYS = new Set(FLAT_KEYS.filter(key => /\{\w+\}/.test(FLAT_DEFAULTS[key])))

/** A label formatter: `key` + its resolved template + params → the text. */
export type LabelFormat = (key: GridLabelKey, template: string, params: LabelParams) => string
/** Default `{name}` replacement (no page `formatLabelCallback`). */
export const defaultLabelFormat: LabelFormat = (_key, template, params) => formatTemplate(template, params)

/**
 * The grid's labels for one instance: `resolve()` → the resolved `GridLabels` object the renderers read
 * (a key with placeholders holds its template), `text(key, params)` → one formatted text. With a `host`
 * (the element) core `createLabels` formats — page `formatLabelCallback` included; without one (the
 * engine on its own, unit tests) the default `{name}` replacement.
 */
export class GridLabelsResolver {
	#input: GridLabelsInput | null | undefined = null
	#handle: Labels<FlatLabels> | null = null

	setInput(input: GridLabelsInput | null | undefined): void {
		this.#input = input
	}

	setHost(host: Element | null): void {
		this.#handle = host ? createLabels<FlatLabels>(host, FLAT_DEFAULTS, () => this.#input as Partial<FlatLabels> | null | undefined, { tag: TAG }) : null
	}

	text(key: GridLabelKey, params?: LabelParams): string {
		if (this.#handle) return this.#handle.text(key, params)
		return formatTemplate(resolveLabel(TAG, FLAT_DEFAULTS, this.#input as Partial<FlatLabels>, key), params)
	}

	readonly format: LabelFormat = (key, _template, params) => this.text(key, params)

	resolve(): GridLabels {
		const out = {} as Record<string, unknown>
		for (const key of FLAT_KEYS) {
			out[key] = PARAM_KEYS.has(key)
				? resolveLabel(TAG, FLAT_DEFAULTS, this.#input as Partial<FlatLabels>, key)
				: this.text(key)
		}
		for (const group of GROUPS) out[group] = resolveGroup(group, this.#input?.[group])
		return out as GridLabels
	}
}

/** A nested group per key: instance group → page-wide group → default (a string wins, `''` included). */
function resolveGroup<G extends GroupName>(group: G, own: Partial<GridLabels[G]> | undefined): GridLabels[G] {
	const page = (getPageLocale()?.labels?.[TAG] as Record<string, unknown> | undefined)?.[group] as Record<string, unknown> | undefined
	const defaults = DEFAULT_LABELS[group] as Record<string, string>
	const out: Record<string, string> = {}
	for (const key of Object.keys(defaults)) {
		const mine = (own as Record<string, unknown> | undefined)?.[key]
		const fromPage = page?.[key]
		out[key] = typeof mine === 'string' ? mine : typeof fromPage === 'string' ? fromPage : defaults[key]!
	}
	return out as GridLabels[G]
}

/** The labels resolved without an element (defaults + instance + page-wide). */
export function resolveLabels(input: GridLabelsInput | null | undefined): GridLabels {
	const resolver = new GridLabelsResolver()
	resolver.setInput(input)
	return resolver.resolve()
}

// =============================================================================
// Labels (i18n) — every UI string of the grid
// =============================================================================
// `labels` (property + JSON attribute) is a partial object merged per key over
// the English defaults; nested groups (`actions`, `contextMenu`) merge per key
// too. `resolveLabels()` is the one resolving seam: a page-wide core `/locale`
// layer (window.components.locale.labels['web-grid']) slots in here, between the
// instance labels and the defaults. `{name}` placeholders → `formatLabel()`.
// A key set to `''` renders nothing (deliberately empty); `undefined` / missing
// falls back to the English default.

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

/** Merge a partial `labels` input over the defaults (per key; nested groups per key too). */
export function resolveLabels(input: GridLabelsInput | null | undefined): GridLabels {
	return {
		...DEFAULT_LABELS,
		...definedOnly(input),
		actions: { ...DEFAULT_LABELS.actions, ...definedOnly(input?.actions) },
		contextMenu: { ...DEFAULT_LABELS.contextMenu, ...definedOnly(input?.contextMenu) }
	} as GridLabels
}

/** Drop `undefined` keys so they fall back to the default (`''` is kept — deliberately empty). */
function definedOnly<O extends object>(input: O | null | undefined): Partial<O> {
	if (!input) return {}
	return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<O>
}

/** Fill `{name}` placeholders (unknown names stay as written). */
export function formatLabel(text: string, vars: Record<string, string | number>): string {
	return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
}

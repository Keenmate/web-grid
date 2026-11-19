// =============================================================================
// Dropdown Input Handlers
// Handle combobox filtering and autocomplete async search
// =============================================================================

import { createTextMatcher } from '../search/text-match.js'
import type { Column } from '../../types.js'
import type { GridHost } from '../grid-context.js'
import { getOptionLabel, withEmptyOption } from './options.js'
import { dataLogger } from '../../logger.js'
import { renderDropdown } from './rendering.js'
import { updateDropdownHighlight, updateLoadingIndicator, attachDropdownListeners } from './interaction.js'

/**
 * Handle combobox input (filtering)
 */
export function handleComboboxInput<T>(ctx: GridHost<T>, e: Event): void {
	const input = e.target as HTMLInputElement
	ctx.dropdown.setFilterText(input.value)
	ctx.dropdown.setIsUserFiltering(true)

	// Try editingCell first, then fall back to input's data-field attribute (for 'always' mode)
	let column = ctx.getCurrentEditingColumn()
	if (!column) {
		const field = input.dataset.field
		if (field) {
			column = ctx.engine.columns.find(c => String(c.field) === field) || null
		}
	}
	if (!column) return

	const opts = column.editorOptions || {}
	const allOptions = opts.options || []

	// Filter options
	if (ctx.dropdown.filterText.trim()) {
		const isMatch = createTextMatcher(ctx.dropdown.filterText)
		ctx.dropdown.setOptions(allOptions.filter(opt => {
			const label = getOptionLabel(opt, opts)
			return isMatch(label)
		}))
	} else {
		ctx.dropdown.setOptions(withEmptyOption(allOptions, opts, opts.labels?.['labels.emptyOption'] ?? ctx.engine.labels['labels.emptyOption']))
	}

	ctx.dropdown.setHighlightedIndex(ctx.dropdown.options.length > 0 ? 0 : -1)

	// Open/update dropdown
	const wrapper = input.closest('.wg__editor--combobox') as HTMLElement
	if (wrapper) {
		const dropdown = renderDropdown(ctx, wrapper, ctx.dropdown.options, opts)
		attachDropdownListeners(ctx, dropdown)
		// Restore highlightedIndex after renderDropdown (which calls removeDropdown that resets it)
		ctx.dropdown.setHighlightedIndex(ctx.dropdown.options.length > 0 ? 0 : -1)
		updateDropdownHighlight(ctx)
	}
}

/**
 * Handle autocomplete input (async search)
 */
export function handleAutocompleteInput<T>(ctx: GridHost<T>, e: Event): void {
	const input = e.target as HTMLInputElement
	// Capture in a local — renderDropdown() below calls removeDropdown() which
	// resets ctx.dropdown.filterText to ''. Without this, a single `input` event
	// (paste, programmatic value set) loses the query before we read it for
	// minLength / the debounced search. Typing only "works" because keystrokes
	// 2+ skip the `if (!ctx.dropdown.isOpen)` branch and avoid the wipe.
	const query = input.value
	ctx.dropdown.setFilterText(query)

	// Try editingCell first, then fall back to input's data-field attribute (for 'always' mode)
	let column = ctx.getCurrentEditingColumn()
	if (!column) {
		const field = input.dataset.field
		if (field) {
			column = ctx.engine.columns.find(c => String(c.field) === field) || null
		}
	}
	if (!column) return

	const opts = column.editorOptions || {}
	const debounceMs = opts.debounceMs ?? 300
	const minLength = opts.minSearchLength ?? 1

	// Show dropdown immediately with initial options
	const wrapper = input.closest('.wg__editor--autocomplete') as HTMLElement
	if (!ctx.dropdown.isOpen && wrapper) {
		ctx.dropdown.setOptions(query ? (opts.initialOptions || []) : withEmptyOption(opts.initialOptions || [], opts, opts.labels?.['labels.emptyOption'] ?? ctx.engine.labels['labels.emptyOption']))
		const dropdown = renderDropdown(ctx, wrapper, ctx.dropdown.options, opts)
		attachDropdownListeners(ctx, dropdown)
		ctx.dropdown.setHighlightedIndex(ctx.dropdown.options.length > 0 ? 0 : -1)
		updateDropdownHighlight(ctx)
		// renderDropdown -> removeDropdown wiped ctx.dropdown.filterText; restore.
		ctx.dropdown.setFilterText(query)
	}

	// Check minimum length — too short: drop the pending / running search
	if (query.length < minLength) {
		ctx.autocomplete.reset()
		ctx.dropdown.setOptions(query ? (opts.initialOptions || []) : withEmptyOption(opts.initialOptions || [], opts, opts.labels?.['labels.emptyOption'] ?? ctx.engine.labels['labels.emptyOption']))
		if (wrapper) {
			const dropdown = renderDropdown(ctx, wrapper, ctx.dropdown.options, opts)
			attachDropdownListeners(ctx, dropdown)
			ctx.dropdown.setHighlightedIndex(ctx.dropdown.options.length > 0 ? 0 : -1)
			updateDropdownHighlight(ctx)
		}
		return
	}

	// Debounced search (latest wins: a new keystroke drops the pending / running one)
	startAutocompleteSearch(ctx, query, column, debounceMs)
}

/** Re-render the open autocomplete dropdown of the cell being edited with the current options. */
function rerenderAutocomplete<T>(ctx: GridHost<T>, opts: Column<T>['editorOptions'] & object, highlightIndex?: number): void {
	const editingCell = ctx.engine.editingCell
	if (!editingCell) return
	const { rowIndex, field } = editingCell
	// Specific selector: a stale editor of another cell may still be in the DOM
	const wrapper = ctx.shadow.querySelector(
		`.wg__editor--autocomplete[data-row="${rowIndex}"][data-field="${field}"]`
	) as HTMLElement
	if (!wrapper) return
	const dropdown = renderDropdown(ctx, wrapper, ctx.dropdown.options, opts)
	attachDropdownListeners(ctx, dropdown)
	if (highlightIndex !== undefined) ctx.dropdown.setHighlightedIndex(highlightIndex)
	updateDropdownHighlight(ctx)
}

/**
 * Run the autocomplete search for `query` through the grid's runner (core createAsyncRunner):
 * the column's `searchCallback` gets `{ term, signal }` and only the latest answer is shown;
 * without a `searchCallback`, `initialOptions` / `options` are filtered locally (like a combobox).
 */
export function startAutocompleteSearch<T>(
	ctx: GridHost<T>,
	query: string,
	column: Column<T>,
	debounceMs = 0
): void {
	const opts = column.editorOptions || {}
	const searchCallback = opts.searchCallback
	const task = (signal: AbortSignal) => {
		if (!searchCallback) {
			const isMatch = createTextMatcher(query)
			return (opts.initialOptions || opts.options || []).filter(opt => isMatch(getOptionLabel(opt, opts)))
		}
		const cell = ctx.engine.editingCell
		if (!cell) return null
		const item = ctx.engine.displayItems[cell.rowIndex]
		const col = ctx.engine.columns.find(c => String(c.field) === cell.field)
		if (!col) return null
		return searchCallback(Object.assign(ctx.engine.cellCtx(item, cell.rowIndex, col), { term: query, signal }))
	}

	ctx.autocomplete.search(debounceMs, task, (results) => {
		if (!results) return
		ctx.dropdown.setOptions(results)
		if (!searchCallback) ctx.dropdown.setHighlightedIndex(results.length > 0 ? 0 : -1)
		rerenderAutocomplete(ctx, opts, searchCallback ? (results.length > 0 ? 0 : -1) : undefined)
	}, {
		// The runner turns the state off BEFORE onResult, so the dropdown renders the right message.
		onLoadingChange: (isLoading) => updateLoadingIndicator(ctx, isLoading, isLoading ? (opts.labels?.['ariaLabels.searching'] ?? ctx.engine.labels['ariaLabels.searching']) : ''),
		onError: (error) => {
			dataLogger.error('Autocomplete search failed:', error)
			ctx.dropdown.setOptions([])
			rerenderAutocomplete(ctx, opts)
		}
	})
}

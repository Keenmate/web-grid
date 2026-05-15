// =============================================================================
// Dropdown Input Handlers
// Handle combobox filtering and autocomplete async search
// =============================================================================

import type { Column } from '../../types.js'
import type { GridContext } from '../types.js'
import { getOptionLabel } from './options.js'
import { renderDropdown } from './rendering.js'
import { updateDropdownHighlight, updateLoadingIndicator, attachDropdownListeners } from './interaction.js'

/**
 * Handle combobox input (filtering)
 */
export function handleComboboxInput<T>(ctx: GridContext<T>, e: Event): void {
	const input = e.target as HTMLInputElement
	ctx.filterText = input.value
	ctx.isUserFiltering = true

	// Try editingCell first, then fall back to input's data-field attribute (for 'always' mode)
	let column = ctx.getCurrentEditingColumn()
	if (!column) {
		const field = input.dataset.field
		if (field) {
			column = ctx.grid.columns.find(c => String(c.field) === field) || null
		}
	}
	if (!column) return

	const opts = column.editorOptions || {}
	const allOptions = opts.options || []

	// Filter options
	if (ctx.filterText.trim()) {
		const searchLower = ctx.filterText.toLowerCase()
		ctx.dropdownOptions = allOptions.filter(opt => {
			const label = getOptionLabel(opt, opts)
			return label.toLowerCase().includes(searchLower)
		})
	} else {
		ctx.dropdownOptions = allOptions
	}

	ctx.highlightedIndex = ctx.dropdownOptions.length > 0 ? 0 : -1

	// Open/update dropdown
	const wrapper = input.closest('.wg__editor--combobox') as HTMLElement
	if (wrapper) {
		const dropdown = renderDropdown(ctx, wrapper, ctx.dropdownOptions, opts)
		attachDropdownListeners(ctx, dropdown)
		// Restore highlightedIndex after renderDropdown (which calls removeDropdown that resets it)
		ctx.highlightedIndex = ctx.dropdownOptions.length > 0 ? 0 : -1
		updateDropdownHighlight(ctx)
	}
}

/**
 * Handle autocomplete input (async search)
 */
export function handleAutocompleteInput<T>(ctx: GridContext<T>, e: Event): void {
	const input = e.target as HTMLInputElement
	// Capture in a local — renderDropdown() below calls removeDropdown() which
	// resets ctx.filterText to ''. Without this, a single `input` event (paste,
	// programmatic value set) loses the query before we read it for minLength /
	// the debounced search. Typing only "works" because keystrokes 2+ skip the
	// `if (!ctx.dropdownOpen)` branch and avoid the wipe.
	const query = input.value
	ctx.filterText = query

	// Try editingCell first, then fall back to input's data-field attribute (for 'always' mode)
	let column = ctx.getCurrentEditingColumn()
	if (!column) {
		const field = input.dataset.field
		if (field) {
			column = ctx.grid.columns.find(c => String(c.field) === field) || null
		}
	}
	if (!column) return

	const opts = column.editorOptions || {}
	const debounceMs = opts.debounceMs ?? 300
	const minLength = opts.minSearchLength ?? 1

	// Clear existing timer
	if (ctx.searchDebounceTimer) {
		clearTimeout(ctx.searchDebounceTimer)
	}

	// Show dropdown immediately with initial options
	const wrapper = input.closest('.wg__editor--autocomplete') as HTMLElement
	if (!ctx.dropdownOpen && wrapper) {
		ctx.dropdownOptions = opts.initialOptions || []
		const dropdown = renderDropdown(ctx, wrapper, ctx.dropdownOptions, opts)
		attachDropdownListeners(ctx, dropdown)
		ctx.highlightedIndex = ctx.dropdownOptions.length > 0 ? 0 : -1
		updateDropdownHighlight(ctx)
		// renderDropdown -> removeDropdown wiped ctx.filterText; restore.
		ctx.filterText = query
	}

	// Check minimum length
	if (query.length < minLength) {
		ctx.dropdownOptions = opts.initialOptions || []
		if (wrapper) {
			const dropdown = renderDropdown(ctx, wrapper, ctx.dropdownOptions, opts)
			attachDropdownListeners(ctx, dropdown)
			ctx.highlightedIndex = ctx.dropdownOptions.length > 0 ? 0 : -1
			updateDropdownHighlight(ctx)
		}
		return
	}

	// Debounced search
	ctx.searchDebounceTimer = setTimeout(() => {
		performAutocompleteSearch(ctx, query, column)
	}, debounceMs)
}

/**
 * Perform async autocomplete search
 * If no searchCallback is provided, falls back to local filtering of initialOptions
 */
export async function performAutocompleteSearch<T>(
	ctx: GridContext<T>,
	query: string,
	column: Column<T>
): Promise<void> {
	const opts = column.editorOptions || {}

	// If no searchCallback, fall back to local filtering (like combobox)
	if (!opts.searchCallback) {
		const allOptions = opts.initialOptions || opts.options || []
		const searchLower = query.toLowerCase()
		ctx.dropdownOptions = allOptions.filter(opt => {
			const label = getOptionLabel(opt, opts)
			return label.toLowerCase().includes(searchLower)
		})
		ctx.highlightedIndex = ctx.dropdownOptions.length > 0 ? 0 : -1

		const editingCell = ctx.grid.editingCell
		if (editingCell) {
			const { rowIndex, field } = editingCell
			const wrapper = ctx.shadow.querySelector(
				`.wg__editor--autocomplete[data-row="${rowIndex}"][data-field="${field}"]`
			) as HTMLElement
			if (wrapper) {
				const dropdown = renderDropdown(ctx, wrapper, ctx.dropdownOptions, opts)
				attachDropdownListeners(ctx, dropdown)
				updateDropdownHighlight(ctx)
			}
		}
		return
	}

	// Cancel previous request
	if (ctx.searchAbortController) {
		ctx.searchAbortController.abort()
	}

	ctx.searchAbortController = new AbortController()
	const signal = ctx.searchAbortController.signal

	// Show loading
	ctx.isSearching = true
	updateLoadingIndicator(ctx, true)

	try {
		const editingCell = ctx.grid.editingCell
		if (!editingCell) return

		const item = ctx.grid.displayItems[editingCell.rowIndex]
		const results = await opts.searchCallback(query, item, signal)

		if (!signal.aborted) {
			// Clear searching state BEFORE rendering so dropdown shows correct message
			ctx.isSearching = false
			updateLoadingIndicator(ctx, false)

			ctx.dropdownOptions = results

			// Use specific selector to avoid finding stale editor elements
			const { rowIndex, field } = editingCell
			const wrapper = ctx.shadow.querySelector(
				`.wg__editor--autocomplete[data-row="${rowIndex}"][data-field="${field}"]`
			) as HTMLElement
			if (wrapper) {
				const dropdown = renderDropdown(ctx, wrapper, ctx.dropdownOptions, opts)
				attachDropdownListeners(ctx, dropdown)
				ctx.highlightedIndex = results.length > 0 ? 0 : -1
				updateDropdownHighlight(ctx)
			}
		}
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return // Expected - ignore
		}
		console.error('Autocomplete search failed:', error)

		// Clear searching state BEFORE rendering
		ctx.isSearching = false
		updateLoadingIndicator(ctx, false)

		ctx.dropdownOptions = []
		const editingCell = ctx.grid.editingCell
		if (editingCell) {
			const { rowIndex, field } = editingCell
			const wrapper = ctx.shadow.querySelector(
				`.wg__editor--autocomplete[data-row="${rowIndex}"][data-field="${field}"]`
			) as HTMLElement
			if (wrapper) {
				const dropdown = renderDropdown(ctx, wrapper, ctx.dropdownOptions, opts)
				attachDropdownListeners(ctx, dropdown)
			}
		}
	}
}

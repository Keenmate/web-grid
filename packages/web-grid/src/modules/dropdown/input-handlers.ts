// =============================================================================
// Dropdown Input Handlers
// Handle combobox filtering and autocomplete async search
// =============================================================================

import type { Column } from '../../types.js'
import type { GridHost } from '../grid-context.js'
import { getOptionLabel } from './options.js'
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
		const searchLower = ctx.dropdown.filterText.toLowerCase()
		ctx.dropdown.setOptions(allOptions.filter(opt => {
			const label = getOptionLabel(opt, opts)
			return label.toLowerCase().includes(searchLower)
		}))
	} else {
		ctx.dropdown.setOptions(allOptions)
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

	// Clear existing timer
	ctx.autocomplete.clearDebounceTimer()

	// Show dropdown immediately with initial options
	const wrapper = input.closest('.wg__editor--autocomplete') as HTMLElement
	if (!ctx.dropdown.isOpen && wrapper) {
		ctx.dropdown.setOptions(opts.initialOptions || [])
		const dropdown = renderDropdown(ctx, wrapper, ctx.dropdown.options, opts)
		attachDropdownListeners(ctx, dropdown)
		ctx.dropdown.setHighlightedIndex(ctx.dropdown.options.length > 0 ? 0 : -1)
		updateDropdownHighlight(ctx)
		// renderDropdown -> removeDropdown wiped ctx.dropdown.filterText; restore.
		ctx.dropdown.setFilterText(query)
	}

	// Check minimum length
	if (query.length < minLength) {
		ctx.dropdown.setOptions(opts.initialOptions || [])
		if (wrapper) {
			const dropdown = renderDropdown(ctx, wrapper, ctx.dropdown.options, opts)
			attachDropdownListeners(ctx, dropdown)
			ctx.dropdown.setHighlightedIndex(ctx.dropdown.options.length > 0 ? 0 : -1)
			updateDropdownHighlight(ctx)
		}
		return
	}

	// Debounced search
	ctx.autocomplete.setDebounceTimer(setTimeout(() => {
		performAutocompleteSearch(ctx, query, column)
	}, debounceMs))
}

/**
 * Perform async autocomplete search
 * If no searchCallback is provided, falls back to local filtering of initialOptions
 */
export async function performAutocompleteSearch<T>(
	ctx: GridHost<T>,
	query: string,
	column: Column<T>
): Promise<void> {
	const opts = column.editorOptions || {}

	// If no searchCallback, fall back to local filtering (like combobox)
	if (!opts.searchCallback) {
		const allOptions = opts.initialOptions || opts.options || []
		const searchLower = query.toLowerCase()
		ctx.dropdown.setOptions(allOptions.filter(opt => {
			const label = getOptionLabel(opt, opts)
			return label.toLowerCase().includes(searchLower)
		}))
		ctx.dropdown.setHighlightedIndex(ctx.dropdown.options.length > 0 ? 0 : -1)

		const editingCell = ctx.engine.editingCell
		if (editingCell) {
			const { rowIndex, field } = editingCell
			const wrapper = ctx.shadow.querySelector(
				`.wg__editor--autocomplete[data-row="${rowIndex}"][data-field="${field}"]`
			) as HTMLElement
			if (wrapper) {
				const dropdown = renderDropdown(ctx, wrapper, ctx.dropdown.options, opts)
				attachDropdownListeners(ctx, dropdown)
				updateDropdownHighlight(ctx)
			}
		}
		return
	}

	// Cancel previous request
	ctx.autocomplete.abort()

	const controller = new AbortController()
	ctx.autocomplete.setAbortController(controller)
	const signal = controller.signal

	// Show loading
	ctx.autocomplete.setIsSearching(true)
	updateLoadingIndicator(ctx, true)

	try {
		const editingCell = ctx.engine.editingCell
		if (!editingCell) return

		const item = ctx.engine.displayItems[editingCell.rowIndex]
		const column = ctx.engine.columns.find(c => String(c.field) === editingCell.field)
		if (!column) return
		const results = await opts.searchCallback(Object.assign(
			ctx.engine.cellCtx(item, editingCell.rowIndex, column),
			{ term: query, signal }
		))

		if (!signal.aborted) {
			// Clear searching state BEFORE rendering so dropdown shows correct message
			ctx.autocomplete.setIsSearching(false)
			updateLoadingIndicator(ctx, false)

			ctx.dropdown.setOptions(results)

			// Use specific selector to avoid finding stale editor elements
			const { rowIndex, field } = editingCell
			const wrapper = ctx.shadow.querySelector(
				`.wg__editor--autocomplete[data-row="${rowIndex}"][data-field="${field}"]`
			) as HTMLElement
			if (wrapper) {
				const dropdown = renderDropdown(ctx, wrapper, ctx.dropdown.options, opts)
				attachDropdownListeners(ctx, dropdown)
				ctx.dropdown.setHighlightedIndex(results.length > 0 ? 0 : -1)
				updateDropdownHighlight(ctx)
			}
		}
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return // Expected - ignore
		}
		console.error('Autocomplete search failed:', error)

		// Clear searching state BEFORE rendering
		ctx.autocomplete.setIsSearching(false)
		updateLoadingIndicator(ctx, false)

		ctx.dropdown.setOptions([])
		const editingCell = ctx.engine.editingCell
		if (editingCell) {
			const { rowIndex, field } = editingCell
			const wrapper = ctx.shadow.querySelector(
				`.wg__editor--autocomplete[data-row="${rowIndex}"][data-field="${field}"]`
			) as HTMLElement
			if (wrapper) {
				const dropdown = renderDropdown(ctx, wrapper, ctx.dropdown.options, opts)
				attachDropdownListeners(ctx, dropdown)
			}
		}
	}
}

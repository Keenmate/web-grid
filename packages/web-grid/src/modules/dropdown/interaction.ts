// =============================================================================
// Dropdown Interaction
// Selection, highlighting, scrolling, toggle, open for current editor
// =============================================================================

import { syncLoader } from '../rendering/loader.js'
import type { EditorOptions } from '../../types.js'
import type { GridHost } from '../grid-context.js'
import { getOptionValue, getOptionLabel, isOptionDisabled, withEmptyOption } from './options.js'
import { renderDropdown, removeDropdown } from './rendering.js'
import { renderCell } from '../rendering/index.js'
import { scrollIntoContainer } from '@keenmate/web-components-core'

/**
 * Select dropdown option by index
 * Works with both editingCell (normal edit mode) and focusedCell ('always' edit mode)
 * @param commitEmptyRow - If true and editing empty row, add it to items (Enter key behavior)
 */
export function selectDropdownOption<T>(
	ctx: GridHost<T>,
	index: number,
	moveAfterSelect: boolean = true,
	commitEmptyRow: boolean = false
): void {
	const option = ctx.dropdown.options[index]
	if (!option) return

	// Get cell info - prefer editingCell, fall back to focusedCell for 'always' mode
	const editingCell = ctx.engine.editingCell
	const focusedCell = ctx.engine.focusedCell
	const cellInfo = editingCell
		? { rowIndex: editingCell.rowIndex, field: editingCell.field, colIndex: ctx.engine.columns.findIndex(c => String(c.field) === editingCell.field) }
		: focusedCell
			? { rowIndex: focusedCell.rowIndex, field: String(ctx.engine.columns[focusedCell.colIndex]?.field), colIndex: focusedCell.colIndex }
			: null

	if (!cellInfo) return

	const { rowIndex, field, colIndex } = cellInfo

	// Get column for editorOptions
	const column = ctx.engine.columns[colIndex]
	const opts = column?.editorOptions || {}

	// Skip if option is disabled
	if (isOptionDisabled(option, opts)) return

	const value = getOptionValue(option, opts)
	const row = ctx.engine.displayItems[rowIndex]

	// Notify editorOptions.onSelect
	if (opts.onSelect && row && column) {
		opts.onSelect({ ...ctx.engine.cellCtx(row, rowIndex, column, colIndex), option })
	}

	ctx.dropdown.setJustSelected(true)
	ctx.isCommittingFromKeyboard = true
	removeDropdown(ctx)
	ctx.engine.commitEdit(rowIndex, field, value, commitEmptyRow)

	if (moveAfterSelect) {
		// Move focus to next row in same column (like Enter does for other editors)
		ctx.moveFocusAfterCommit(rowIndex, field, 'down')
	} else {
		// Stay on current cell with focused state - re-render to show new value
		renderCell(ctx, rowIndex, colIndex)
	}

	// Reset justSelected after focus moves
	requestAnimationFrame(() => {
		ctx.dropdown.setJustSelected(false)
	})
}

/**
 * Update dropdown highlight visually
 */
export function updateDropdownHighlight<T>(ctx: GridHost<T>): void {
	const dropdown = ctx.shadow.querySelector('.wg__dropdown')
	if (!dropdown) return

	const options = dropdown.querySelectorAll('.wg__dropdown-option')
	options.forEach((el, i) => {
		el.classList.toggle('wg__dropdown-option--highlighted', i === ctx.dropdown.highlightedIndex)
	})
}

/**
 * Scroll highlighted option into view
 */
export function scrollHighlightedIntoView<T>(ctx: GridHost<T>): void {
	// Inside the dropdown's own list only (core container scroll) — never the grid or the page
	const highlighted = ctx.shadow.querySelector('.wg__dropdown-option--highlighted')
	const list = highlighted?.closest('.wg__dropdown') as HTMLElement | null | undefined
	if (highlighted && list) scrollIntoContainer(highlighted, { block: 'nearest', container: list })
}

/**
 * Show / hide the autocomplete editor's search loader (core renderLoader, context
 * 'search', `label` = `labels.dropdownSearching`). It takes the toggle's place.
 */
export function updateLoadingIndicator<T>(ctx: GridHost<T>, show: boolean, label = ''): void {
	const indicator = ctx.shadow.querySelector('.wg__loading-indicator') as HTMLElement | null
	if (indicator) indicator.hidden = !show
	syncLoader(ctx, 'search-editor', show ? indicator : null, label)
	// Hide toggle when loading (they occupy same position)
	const toggle = ctx.shadow.querySelector('.wg__editor--autocomplete .wg__combobox-toggle') as HTMLElement
	if (toggle) {
		toggle.style.display = show ? 'none' : 'inline'
	}
}

/**
 * Open dropdown for current editor
 * Works with both editingCell (normal edit mode) and focusedCell ('always' edit mode)
 */
export function openDropdownForCurrentEditor<T>(ctx: GridHost<T>): void {
	if (ctx.dropdown.justSelected) {
		return
	}

	ctx.dropdown.setUserInteracted(false)

	// Get cell info - prefer editingCell, fall back to focusedCell for 'always' mode
	const editingCell = ctx.engine.editingCell
	const focusedCell = ctx.engine.focusedCell
	const cellInfo = editingCell
		? { rowIndex: editingCell.rowIndex, field: editingCell.field }
		: focusedCell
			? { rowIndex: focusedCell.rowIndex, field: String(ctx.engine.columns[focusedCell.colIndex]?.field) }
			: null

	if (!cellInfo) {
		return
	}

	const { rowIndex, field } = cellInfo

	// Get column - try editingCell method first, then fall back to field lookup
	let column = ctx.getCurrentEditingColumn()
	if (!column) {
		column = ctx.engine.columns.find(c => String(c.field) === field) || null
	}
	if (!column) {
		return
	}

	const opts = column.editorOptions || {}
	const editor = column.editor

	// Calculate target index BEFORE renderDropdown (which resets highlightedIndex via removeDropdown)
	let targetIndex = 0

	if (editor === 'select') {
		const allOptions = opts.options || []
		// If there's a filter text (from typing to start editing), filter and highlight first match
		if (ctx.dropdown.filterText) {
			const searchLower = ctx.dropdown.filterText.toLowerCase()
			ctx.dropdown.setOptions(allOptions.filter(opt => {
				const label = getOptionLabel(opt, opts)
				return label.toLowerCase().includes(searchLower)
			}))
			targetIndex = ctx.dropdown.options.length > 0 ? 0 : -1
		} else {
			ctx.dropdown.setOptions(withEmptyOption(allOptions, opts, opts.labels?.dropdownEmptyOption ?? ctx.engine.labels.dropdownEmptyOption))
			// Calculate highlight index for current value
			const item = ctx.engine.displayItems[rowIndex]
			const currentValue = item ? (item as Record<string, unknown>)[field] : undefined
			const currentIdx = ctx.dropdown.options.findIndex(
				opt => getOptionValue(opt, opts) === currentValue
			)
			targetIndex = currentIdx >= 0 ? currentIdx : 0
		}
	} else if (editor === 'combobox' || editor === 'autocomplete') {
		const baseOptions = withEmptyOption(editor === 'autocomplete'
			? (opts.initialOptions || opts.options || [])
			: (opts.options || []), opts, opts.labels?.dropdownEmptyOption ?? ctx.engine.labels.dropdownEmptyOption)

		// Get current cell value
		const item = ctx.engine.displayItems[rowIndex]
		const currentValue = item ? (item as Record<string, unknown>)[field] : undefined

		// Check if current value exists in options
		const currentIdx = baseOptions.findIndex(
			opt => getOptionValue(opt, opts) === currentValue
		)

		if (currentIdx >= 0) {
			// Current value is in options - highlight it
			ctx.dropdown.setOptions(baseOptions)
			targetIndex = currentIdx
		} else if (currentValue != null && currentValue !== '') {
			// Current value not in options - prepend it as first option
			const valueMember = opts.valueMember || 'value'
			const displayMember = opts.displayMember || 'label'
			const displayText = String(currentValue)
			const syntheticOption = {
				// Required base properties
				value: currentValue as string | number | boolean,
				label: displayText,
				// Custom member properties (may override above if different)
				[valueMember]: currentValue,
				[displayMember]: displayText
			}
			ctx.dropdown.setOptions([syntheticOption, ...baseOptions])
			targetIndex = 0
		} else {
			// No current value - use options as-is
			ctx.dropdown.setOptions(baseOptions)
			targetIndex = baseOptions.length > 0 ? 0 : -1
		}
	}
	const wrapper = ctx.shadow.querySelector(
		`.wg__editor--select[data-row="${rowIndex}"][data-field="${field}"],
		 .wg__editor--combobox[data-row="${rowIndex}"][data-field="${field}"],
		 .wg__editor--autocomplete[data-row="${rowIndex}"][data-field="${field}"]`
	) as HTMLElement
	if (wrapper && ctx.dropdown.options.length > 0) {
		// Save filterText before renderDropdown (which calls removeDropdown that clears it)
		const savedFilterText = ctx.dropdown.filterText
		// Set flag to prevent scroll handler from closing dropdown during opening
		ctx.dropdown.setIsOpening(true)
		const dropdown = renderDropdown(ctx, wrapper, ctx.dropdown.options, opts)
		attachDropdownListeners(ctx, dropdown)
		// Restore filterText after renderDropdown
		ctx.dropdown.setFilterText(savedFilterText)
		// Set highlightedIndex AFTER renderDropdown (which calls removeDropdown that resets it to -1)
		ctx.dropdown.setHighlightedIndex(targetIndex)
		updateDropdownHighlight(ctx)
		// Refocus the editor after dropdown renders (select trigger or input)
		// Use specific selectors to avoid finding stale elements
		const selectTrigger = ctx.shadow.querySelector(
			`.wg__select-trigger[data-row="${rowIndex}"][data-field="${field}"]`
		) as HTMLElement
		const input = ctx.shadow.querySelector(
			`.wg__combobox-input[data-row="${rowIndex}"][data-field="${field}"],
			 .wg__autocomplete-input[data-row="${rowIndex}"][data-field="${field}"]`
		) as HTMLElement
		const focusTarget = selectTrigger || input
		if (focusTarget && focusTarget !== ctx.shadow.activeElement) {
			focusTarget.focus()
		}
		// Clear flag after next frame to allow scroll events again
		requestAnimationFrame(() => {
			ctx.dropdown.setIsOpening(false)
		})
	}
}

/**
 * Toggle dropdown open/close
 */
export function toggleDropdown<T>(ctx: GridHost<T>): void {
	if (ctx.dropdown.isOpen) {
		removeDropdown(ctx)
	} else {
		openDropdownForCurrentEditor(ctx)
	}
}

/**
 * Attach event listeners to dropdown element
 */
export function attachDropdownListeners<T>(
	ctx: GridHost<T>,
	dropdown: HTMLElement
): void {
	// Click on option - don't move to next row, just save and stay
	dropdown.addEventListener('mousedown', (e) => {
		e.preventDefault() // Prevent blur
		const option = (e.target as HTMLElement).closest('.wg__dropdown-option')
		if (option && !option.hasAttribute('data-disabled')) {
			const index = parseInt(option.getAttribute('data-index') || '0', 10)
			selectDropdownOption(ctx, index, false)
		}
	})

	// Hover highlights option (skip disabled)
	dropdown.addEventListener('mouseover', (e) => {
		const option = (e.target as HTMLElement).closest('.wg__dropdown-option')
		if (option && !option.hasAttribute('data-disabled')) {
			ctx.dropdown.setHighlightedIndex(parseInt(option.getAttribute('data-index') || '0', 10))
			ctx.dropdown.setUserInteracted(true)
			updateDropdownHighlight(ctx)
		}
	})
}

/**
 * Update select dropdown filter based on current filterText
 */
export function updateSelectFilter<T>(
	ctx: GridHost<T>,
	opts: EditorOptions<any>
): void {
	const allOptions = opts.options || []
	const searchLower = ctx.dropdown.filterText.toLowerCase()
	// Save filterText before renderDropdown (which calls removeDropdown that clears it)
	const savedFilterText = ctx.dropdown.filterText

	ctx.dropdown.setOptions(allOptions.filter(opt => {
		const label = getOptionLabel(opt, opts)
		return label.toLowerCase().includes(searchLower)
	}))
	ctx.dropdown.setHighlightedIndex(ctx.dropdown.options.length > 0 ? 0 : -1)

	// Open or update dropdown (show "No options" message when empty)
	const wrapper = ctx.shadow.querySelector('.wg__editor--select') as HTMLElement
	if (wrapper) {
		const dropdown = renderDropdown(ctx, wrapper, ctx.dropdown.options, opts)
		attachDropdownListeners(ctx, dropdown)
		// Restore filterText after renderDropdown
		ctx.dropdown.setFilterText(savedFilterText)
		if (ctx.dropdown.options.length > 0) {
			ctx.dropdown.setHighlightedIndex(0)
			updateDropdownHighlight(ctx)
		}
	}
}

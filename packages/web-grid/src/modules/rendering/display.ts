// =============================================================================
// Cell Display Rendering
// Render cells in display (non-editing) mode
// =============================================================================

import type { Column } from '../../types.js'
import type { GridContext } from '../types.js'
import { getOptionDisplayValue } from '../dropdown/options.js'
import { gridPerf } from '../../perf.js'

/**
 * Render a cell in display mode (not editing)
 * For dropdown cells, renders toggle only if cell is editable - CSS controls visibility via hover/focus
 */
export function renderCellDisplay<T>(
	ctx: GridContext<T>,
	rowIndex: number,
	colIndex: number,
	column: Column<T>,
	value: string,
	isFocused: boolean,
	isEditable: boolean = true
): string {
	const isDropdown = column.editor === 'select' || column.editor === 'combobox' || column.editor === 'autocomplete'
	const isDate = column.editor === 'date'
	const isCheckbox = column.editor === 'checkbox'
	const field = String(column.field)

	if (isCheckbox) {
		// If formatCallback is provided, use its output instead of default checkbox
		if (column.formatCallback) {
			return `<span class="wg__cell-text">${ctx.escapeHtml(value)}</span>`
		}
		// Default: render checkbox
		gridPerf.counters.cellDisplayItemsLookup++
		const item = ctx.grid.displayItems[rowIndex]
		const rawValue = item ? ctx.grid.getCellRawValue(item, rowIndex, field) : false
		const opts = column.editorOptions || {}
		const trueValue = opts.trueValue !== undefined ? opts.trueValue : true
		const isChecked = rawValue === trueValue
		// Display-mode checkbox: always disabled (click on cell handles toggling)
		// Non-editable cells get additional visual styling via CSS
		return `
			<input
				type="checkbox"
				class="wg__checkbox-display${isEditable ? '' : ' wg__checkbox-display--readonly'}"
				${isChecked ? 'checked' : ''}
				disabled
				tabindex="-1"
				data-row="${rowIndex}"
				data-field="${field}"
			/>
		`
	}

	if (isDropdown) {
		// Get display value using proper fallback chain (getDisplayCallback -> displayMember -> label -> raw value)
		gridPerf.counters.cellDisplayItemsLookup++
		const item = ctx.grid.displayItems[rowIndex]
		const rawValue = item ? ctx.grid.getCellRawValue(item, rowIndex, field) : undefined
		const opts = column.editorOptions || {}
		const options = opts.initialOptions || opts.options || []
		const displayValue = getOptionDisplayValue(rawValue, options, opts)

		// Add modifier class for on-focus visibility (CSS handles hover/focus show)
		const visibility = ctx.grid.getEffectiveToggleVisibility(column)
		const toggleClass = visibility === 'on-focus' ? 'wg__cell-dropdown-display--toggle-on-focus' : ''
		// Only render toggle if cell is editable
		const toggleHtml = isEditable ? '<span class="wg__select-toggle">▼</span>' : ''
		return `
			<div class="wg__cell-dropdown-display ${toggleClass}" data-row="${rowIndex}" data-field="${field}">
				<span class="wg__select-value">${ctx.escapeHtml(displayValue)}</span>
				${toggleHtml}
			</div>
		`
	}

	if (isDate) {
		// Same pattern as dropdown - calendar button visible only if editable
		const visibility = ctx.grid.getEffectiveToggleVisibility(column)
		const toggleClass = visibility === 'on-focus' ? 'wg__cell-date-display--toggle-on-focus' : ''
		// Only render toggle if cell is editable
		const toggleHtml = isEditable
			? `<button type="button" class="wg__date-trigger" tabindex="-1">
					<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>
				</button>`
			: ''
		return `
			<div class="wg__cell-date-display ${toggleClass}" data-row="${rowIndex}" data-field="${field}">
				<span class="wg__date-value">${ctx.escapeHtml(value)}</span>
				${toggleHtml}
			</div>
		`
	}

	// Line clamp style if maxLines is set
	const lineClampStyle = column.maxLines ? `style="-webkit-line-clamp: ${column.maxLines}"` : ''

	// templateCallback returns raw HTML - don't escape it
	if (column.templateCallback) {
		return `<span class="wg__cell-text" ${lineClampStyle}>${value}</span>`
	}

	return `<span class="wg__cell-text" ${lineClampStyle}>${ctx.escapeHtml(value)}</span>`
}

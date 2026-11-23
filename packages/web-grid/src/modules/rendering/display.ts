// =============================================================================
// Cell Display Rendering
// Render cells in display (non-editing) mode
// =============================================================================

import { renderIcon, type SlotHtml } from '@keenmate/web-components-core'
import { GRID_ICONS } from '../../icons.js'
import type { Column } from '../../types.js'
import type { GridHost } from '../grid-context.js'
import { gridPerf } from '../../perf.js'
import { hasEditButton, renderEditButton } from '../editing/edit-button.js'
import { GRID_ENGINE } from '../grid-context.js'

/**
 * Render a cell in display mode (not editing). `display` is the engine's `getCellDisplayHtml()` —
 * already HTML (renderCellCallback > getDisplayValueCallback > the built-in text, escaped), so every
 * column type shows it the same way; only a checkbox with neither callback draws its checkbox.
 * For dropdown / date cells, renders the toggle only if the cell is editable - CSS controls visibility via hover/focus
 */
export function renderCellDisplay<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	colIndex: number,
	column: Column<T>,
	display: SlotHtml,
	isFocused: boolean,
	isEditable: boolean = true
): string {
	const html = renderCellDisplayContent(ctx, rowIndex, colIndex, column, display, isFocused, isEditable)
	return hasEditButton(ctx, column, isEditable) ? html + renderEditButton(ctx, rowIndex, colIndex) : html
}

function renderCellDisplayContent<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	colIndex: number,
	column: Column<T>,
	display: SlotHtml,
	isFocused: boolean,
	isEditable: boolean
): string {
	const isDropdown = column.editor === 'select' || column.editor === 'combobox' || column.editor === 'autocomplete'
	const isDate = column.editor === 'date'
	const isCheckbox = column.editor === 'checkbox'
	const field = String(column.field)
	const html = display.html

	if (isCheckbox) {
		// renderCellCallback (when it rendered) / getDisplayValueCallback replace the default checkbox
		if (display.kind !== 'default' || column.getDisplayValueCallback) {
			return `<span class="wg__cell-text">${html}</span>`
		}
		// Default: render checkbox
		gridPerf.count('cellDisplayItemsLookup')
		const item = ctx[GRID_ENGINE].displayItems[rowIndex]
		const rawValue = item ? ctx[GRID_ENGINE].getCellRawValue(item, rowIndex, field) : false
		const opts = column.editorOptions || {}
		const trueValue = opts.trueValue !== undefined ? opts.trueValue : true
		const isChecked = rawValue === trueValue
		// Display-mode checkbox: disabled (click on cell handles toggling), unless
		// isCheckboxAlwaysEditable makes it interactive — one click toggles it.
		// Non-editable cells get additional visual styling via CSS
		const isInteractive = isEditable && ctx[GRID_ENGINE].isCheckboxAlwaysEditable
		return `
			<input
				type="checkbox"
				class="wg__checkbox-display${isEditable ? '' : ' wg__checkbox-display--readonly'}"
				${isChecked ? 'checked' : ''}
				${isInteractive ? '' : 'disabled'}
				tabindex="-1"
				data-row="${rowIndex}"
				data-field="${field}"
			/>
		`
	}

	if (isDropdown) {
		// The shown text: renderCellCallback > the column's getDisplayValueCallback > the option's display
		// (editorOptions.getDisplayValueCallback -> displayMember -> label -> raw value) — as copy does
		// Add modifier class for on-focus visibility (CSS handles hover/focus show)
		const visibility = ctx[GRID_ENGINE].getEffectiveToggleVisibility(column)
		const toggleClass = visibility === 'on-focus' ? 'wg__cell-dropdown-display--toggle-on-focus' : ''
		// Only render toggle if cell is editable
		const toggleHtml = isEditable ? '<span class="wg__select-toggle">▼</span>' : ''
		return `
			<div class="wg__cell-dropdown-display ${toggleClass}" data-row="${rowIndex}" data-field="${field}">
				<span class="wg__select-value">${html}</span>
				${toggleHtml}
			</div>
		`
	}

	if (isDate) {
		// Same pattern as dropdown - calendar button visible only if editable
		const visibility = ctx[GRID_ENGINE].getEffectiveToggleVisibility(column)
		const toggleClass = visibility === 'on-focus' ? 'wg__cell-date-display--toggle-on-focus' : ''
		// Only render toggle if cell is editable
		const toggleHtml = isEditable
			? `<button type="button" class="wg__date-trigger" tabindex="-1">
					${renderIcon('calendar', { prefix: 'wg', host: ctx.shadow.host, defaults: GRID_ICONS })}
				</button>`
			: ''
		return `
			<div class="wg__cell-date-display ${toggleClass}" data-row="${rowIndex}" data-field="${field}">
				<span class="wg__date-value">${html}</span>
				${toggleHtml}
			</div>
		`
	}

	// Line clamp style if maxLines is set
	const lineClampStyle = column.maxLines ? `style="-webkit-line-clamp: ${column.maxLines}"` : ''

	return `<span class="wg__cell-text" ${lineClampStyle}>${html}</span>`
}

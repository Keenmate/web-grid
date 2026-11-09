// =============================================================================
// Cell Editor Renderers
// Render HTML for each editor type
// =============================================================================

import { escapeHtml } from '@keenmate/web-components-core'
import type { Column } from '../../types.js'
import type { GridHost } from '../grid-context.js'
import { getOptionDisplayValue, getOptionValue, withEmptyOption } from '../dropdown/index.js'

/**
 * Render the appropriate editor for a cell
 */
export function renderCellEditor<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	colIndex: number,
	column: Column<T>
): string {
	const field = String(column.field)
	const item = ctx.engine.displayItems[rowIndex]
	const currentValue = ctx.engine.getCellRawValue(item, rowIndex, field)
	const editor = column.editor || 'text'

	switch (editor) {
		case 'checkbox':
			return renderCheckboxEditor(ctx, rowIndex, field, currentValue, column)
		case 'number':
			return renderNumberEditor(ctx, rowIndex, field, currentValue, column)
		case 'date':
			return renderDateEditor(ctx, rowIndex, field, currentValue, column)
		case 'select':
			return renderSelectEditor(ctx, rowIndex, field, currentValue, column)
		case 'combobox':
			return renderComboboxEditor(ctx, rowIndex, field, currentValue, column)
		case 'autocomplete':
			return renderAutocompleteEditor(ctx, rowIndex, field, currentValue, column)
		case 'custom':
			return renderCustomEditor(ctx, rowIndex, field, currentValue, column)
		case 'text':
		default:
			return renderTextEditor(ctx, rowIndex, field, currentValue, column)
	}
}

/**
 * Get vertical alignment CSS class for editor positioning
 */
function getVerticalAlignClass<T>(column: Column<T>): string {
	const vAlign = column.verticalAlign || 'middle'
	return `wg__editor--valign-${vAlign}`
}

/**
 * Render text input editor
 */
export function renderTextEditor<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	field: string,
	value: unknown,
	column: Column<T>
): string {
	const opts = column.editorOptions || {}
	const initialQuery = ctx.engine.editingCell?.initialSearchQuery
	// If user typed a character to start editing, use that as initial value
	const strValue = initialQuery !== undefined ? initialQuery : (value != null ? String(value) : '')
	const vAlignClass = getVerticalAlignClass(column)

	return `
		<input
			type="text"
			class="wg__editor wg__editor--text ${vAlignClass}"
			value="${escapeHtml(strValue)}"
			data-row="${rowIndex}"
			data-field="${field}"
			${opts.maxLength ? `maxlength="${opts.maxLength}"` : ''}
			${opts.placeholder ? `placeholder="${escapeHtml(opts.placeholder)}"` : ''}
			${opts.pattern ? `pattern="${escapeHtml(opts.pattern)}"` : ''}
		/>
	`
}

/**
 * Render number input editor
 */
export function renderNumberEditor<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	field: string,
	value: unknown,
	column: Column<T>
): string {
	const opts = column.editorOptions || {}
	const initialQuery = ctx.engine.editingCell?.initialSearchQuery
	// If user typed a digit to start editing, use that as initial value
	const numValue = initialQuery !== undefined ? initialQuery : (value != null ? String(value) : '')
	const vAlignClass = getVerticalAlignClass(column)

	// type="text" keeps caret control; min / max / step mirror the editorOptions for
	// assistive tech and styling — the value itself is checked by engine.commitEdit
	// (modules/editing/value-parse.ts: strict parse, decimalPlaces rounds, min / max /
	// allowNegative reject).
	const min = opts.min ?? (opts.allowNegative === false ? 0 : undefined)
	const step = opts.step ?? (opts.decimalPlaces != null ? 10 ** -opts.decimalPlaces : undefined)
	return `
		<input
			type="text"
			inputmode="numeric"
			class="wg__editor wg__editor--number ${vAlignClass}"
			value="${escapeHtml(numValue)}"
			data-row="${rowIndex}"
			data-field="${field}"
			${min != null ? `min="${min}"` : ''}
			${opts.max != null ? `max="${opts.max}"` : ''}
			${step != null ? `step="${step}"` : ''}
		/>
	`
}

/**
 * Render date input editor with custom datepicker
 */
export function renderDateEditor<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	field: string,
	value: unknown,
	column: Column<T>
): string {
	const opts = column.editorOptions || {}
	const initialQuery = ctx.engine.editingCell?.initialSearchQuery

	// Convert value to display format
	const dateValue = toDateInputValue(value)
	// If user typed a character to start editing, use that as initial value
	const displayValue = initialQuery !== undefined ? initialQuery : formatDateForDisplay(value, opts.dateFormat)

	return `
		<div class="wg__editor wg__editor--date" data-row="${rowIndex}" data-field="${field}">
			<input
				type="text"
				class="wg__date-input"
				value="${escapeHtml(displayValue)}"
				data-row="${rowIndex}"
				data-field="${field}"
				data-date-value="${dateValue}"
				data-output-format="${opts.outputFormat || 'iso'}"
				data-date-format="${opts.dateFormat || 'YYYY-MM-DD'}"
				${opts.minDate ? `data-min-date="${toDateInputValue(opts.minDate)}"` : ''}
				${opts.maxDate ? `data-max-date="${toDateInputValue(opts.maxDate)}"` : ''}
				placeholder="${escapeHtml(opts.dateFormat || 'YYYY-MM-DD')}"
			/>
			<button type="button" class="wg__date-trigger" tabindex="-1">
				<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>
			</button>
		</div>
	`
}

/**
 * Format date value for display in the input
 */
function formatDateForDisplay(value: unknown, format?: string): string {
	if (!value) return ''

	let date: Date | null = null

	if (value instanceof Date) {
		date = value
	} else if (typeof value === 'number') {
		date = new Date(value)
	} else if (typeof value === 'string') {
		date = new Date(value)
	}

	if (!date || isNaN(date.getTime())) return ''

	// Format according to specified format or default to YYYY-MM-DD
	const fmt = format || 'YYYY-MM-DD'
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')

	return fmt
		.replace('YYYY', String(year))
		.replace('YY', String(year).slice(-2))
		.replace('MM', month)
		.replace('DD', day)
}

/**
 * Convert various date formats to YYYY-MM-DD string for date input
 */
function toDateInputValue(value: unknown): string {
	if (!value) return ''

	let date: Date | null = null

	if (value instanceof Date) {
		date = value
	} else if (typeof value === 'number') {
		// Timestamp
		date = new Date(value)
	} else if (typeof value === 'string') {
		// ISO string or other date string
		date = new Date(value)
	}

	if (!date || isNaN(date.getTime())) return ''

	// Format as YYYY-MM-DD
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

/**
 * Render checkbox editor
 */
export function renderCheckboxEditor<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	field: string,
	value: unknown,
	column: Column<T>
): string {
	const opts = column.editorOptions || {}
	// If explicit trueValue is set, use strict comparison; otherwise use truthiness
	const isChecked = opts.trueValue !== undefined
		? value === opts.trueValue
		: Boolean(value)

	return `
		<input
			type="checkbox"
			class="wg__editor wg__editor--checkbox"
			${isChecked ? 'checked' : ''}
			data-row="${rowIndex}"
			data-field="${field}"
			data-true-value="${escapeHtml(JSON.stringify(opts.trueValue ?? true))}"
			data-false-value="${escapeHtml(JSON.stringify(opts.falseValue ?? false))}"
		/>
	`
}

/**
 * Render select dropdown editor (custom trigger like v3, not native select)
 */
export function renderSelectEditor<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	field: string,
	value: unknown,
	column: Column<T>
): string {
	const opts = column.editorOptions || {}
	const displayValue = getOptionDisplayValue(value, opts.options || [], opts)
	const options = withEmptyOption(opts.options || [], opts, opts.labels?.dropdownEmptyOption ?? ctx.engine.labels.dropdownEmptyOption)
	const initialQuery = ctx.engine.editingCell?.initialSearchQuery

	// Initialize dropdown options for select
	ctx.dropdown.setOptions(options)
	// Store initial query for filtering when dropdown opens
	ctx.dropdown.setFilterText(initialQuery || '')
	ctx.dropdown.setHighlightedIndex(options.findIndex(opt => getOptionValue(opt, opts) === value))
	if (ctx.dropdown.highlightedIndex < 0 && options.length > 0) {
		ctx.dropdown.setHighlightedIndex(0)
	}

	return `
		<div
			class="wg__editor wg__editor--select wg__select-trigger"
			tabindex="0"
			role="combobox"
			aria-haspopup="listbox"
			data-row="${rowIndex}"
			data-field="${field}"
			data-value="${escapeHtml(String(value ?? ''))}"
		>
			<span class="wg__select-value">${escapeHtml(displayValue)}</span>
			<span class="wg__select-toggle">▼</span>
		</div>
	`
}

/**
 * Render combobox editor (filterable dropdown)
 */
export function renderComboboxEditor<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	field: string,
	value: unknown,
	column: Column<T>
): string {
	const opts = column.editorOptions || {}
	const displayValue = getOptionDisplayValue(value, opts.options || [], opts)
	const initialQuery = ctx.engine.editingCell?.initialSearchQuery
	const options = initialQuery ? (opts.options || []) : withEmptyOption(opts.options || [], opts, opts.labels?.dropdownEmptyOption ?? ctx.engine.labels.dropdownEmptyOption)

	// If user typed a character to start editing, use that as initial value
	const inputValue = initialQuery !== undefined ? initialQuery : displayValue

	// Initialize dropdown options
	ctx.dropdown.setOptions(options)
	ctx.dropdown.setFilterText(inputValue)
	ctx.dropdown.setHighlightedIndex(options.length > 0 ? 0 : -1)

	return `
		<div class="wg__editor wg__editor--combobox" data-row="${rowIndex}" data-field="${field}">
			<input
				type="text"
				class="wg__combobox-input"
				value="${escapeHtml(inputValue)}"
				data-row="${rowIndex}"
				data-field="${field}"
			/>
			<span class="wg__combobox-toggle">▼</span>
		</div>
	`
}

/**
 * Render autocomplete editor (async search dropdown)
 */
export function renderAutocompleteEditor<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	field: string,
	value: unknown,
	column: Column<T>
): string {
	const opts = column.editorOptions || {}
	const displayValue = getOptionDisplayValue(value, opts.initialOptions || opts.options || [], opts)
	const initialQuery = ctx.engine.editingCell?.initialSearchQuery
	const initialOptions = initialQuery ? (opts.initialOptions || opts.options || []) : withEmptyOption(opts.initialOptions || opts.options || [], opts, opts.labels?.dropdownEmptyOption ?? ctx.engine.labels.dropdownEmptyOption)

	// If user typed a character to start editing, use that as initial value
	const inputValue = initialQuery !== undefined ? initialQuery : displayValue

	// Initialize dropdown options
	ctx.dropdown.setOptions(initialOptions)
	ctx.dropdown.setFilterText(inputValue)
	ctx.dropdown.setHighlightedIndex(initialOptions.length > 0 ? 0 : -1)

	return `
		<div class="wg__editor wg__editor--autocomplete" data-row="${rowIndex}" data-field="${field}">
			<input
				type="text"
				class="wg__autocomplete-input"
				value="${escapeHtml(inputValue)}"
				placeholder="${escapeHtml(opts.placeholder || '')}"
				data-row="${rowIndex}"
				data-field="${field}"
			/>
			<span class="wg__combobox-toggle">▼</span>
			<span class="wg__loading-indicator" hidden></span>
		</div>
	`
}

/**
 * Render custom editor placeholder
 * The actual editing UI is provided by renderEditorCallback
 */
export function renderCustomEditor<T>(
	ctx: GridHost<T>,
	rowIndex: number,
	field: string,
	value: unknown,
	column: Column<T>
): string {
	// Format the display value
	const row = ctx.engine.displayItems[rowIndex]
	const displayValue = column.getDisplayValueCallback && row !== undefined
		? column.getDisplayValueCallback(Object.assign(ctx.engine.cellCtx(row, rowIndex, column), { value }))
		: (value != null ? String(value) : '')

	return `
		<div
			class="wg__editor wg__editor--custom"
			tabindex="0"
			data-row="${rowIndex}"
			data-field="${field}"
		>
			<span class="wg__custom-value">${escapeHtml(displayValue)}</span>
		</div>
	`
}

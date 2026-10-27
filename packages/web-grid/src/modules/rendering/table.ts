// =============================================================================
// Table Rendering Module
// Render header row, data rows, pagination
// =============================================================================

import type { GridHost } from '../grid-context.js'
import type { Column } from '../../types.js'
import { renderCellEditor } from '../editing/index.js'
import { renderCellDisplay } from './display.js'
import { wrapTreeCell } from './tree-render.js'
import { renderTriggerButton, getActiveToolbarRowIndex, maxToolbarRowLength, resolveToolbar, renderToolbarButton } from '../toolbar/index.js'

// Default row number column width (must match CSS: 40px with box-sizing: border-box)
const ROW_NUMBER_COLUMN_WIDTH = 40

/**
 * Parse column width string to pixels.
 * Returns a default value for 'auto' or unparseable values.
 */
function parseColumnWidth(width: string | undefined): number {
	if (!width || width === 'auto') return 150  // Default column width

	const match = width.match(/^([\d.]+)(px|em|rem|%)?$/)
	if (!match) return 150

	const value = parseFloat(match[1])
	const unit = match[2] || 'px'

	switch (unit) {
		case 'px': return value
		case 'em': return value * 16
		case 'rem': return value * 10  // Based on --wg-rem default
		case '%': return 150  // Can't calculate without container width
		default: return value
	}
}

/**
 * Get container CSS classes
 */
export function getContainerClasses<T>(ctx: GridHost<T>): string {
	const classes = ['wg']
	if (ctx.engine.isStriped) classes.push('wg--striped')
	if (ctx.engine.isHoverable) classes.push('wg--hoverable')
	if (ctx.engine.isEffectivelyEditable) classes.push('wg--editable')
	if (ctx.engine.isReadonly) classes.push('wg--readonly')
	if (ctx.engine.isDisabled) classes.push('wg--disabled')
	if (ctx.engine.isNavigateMode) classes.push('wg--navigate-mode')
	if (ctx.engine.isColumnReorderAllowed) classes.push('wg--reorderable')
	if (ctx.engine.isScrollable) classes.push('wg--scrollable')
	if (ctx.engine.isTableBorderOnly) classes.push('wg--table-border-only')
	return classes.join(' ')
}

/**
 * Render header row
 */
export function renderHeaderRow<T>(ctx: GridHost<T>): string {
	const visualColumns = ctx.engine.visualColumns
	if (visualColumns.length === 0) return ''

	// Track cumulative offset for sticky positioning
	let cumulativeOffset = 0

	// Filter row (grid isFilterable): one cell per header cell, an input under each
	// column with `column.isFilterable` (v1: text). Built in the same pass so the
	// frozen offsets and widths match the header.
	const isFilterRowVisible = ctx.engine.isFilterable && visualColumns.some(({ column }) => column.isFilterable)
	const filters = isFilterRowVisible ? ctx.engine.filters : {}
	const invalidFilterFields = isFilterRowVisible ? ctx.engine.getInvalidFilterFields() : new Set<string>()
	let filterLeadHtml = ''
	const filterCells: string[] = []

	// Row number column (may be sticky)
	let rowNumberColumnHtml = ''
	if (ctx.engine.isRowNumbersVisible) {
		const isSticky = ctx.engine.isStickyRowNumbers
		const stickyStyle = isSticky
			? `position: sticky; left: 0; z-index: 4;`
			: ''
		const frozenClass = isSticky ? ' wg__header--frozen' : ''
		rowNumberColumnHtml = `<th class="wg__header wg__row-number-header${frozenClass}" style="${stickyStyle}">#</th>`
		filterLeadHtml += `<th class="wg__filter-cell wg__filter-cell--row-number${isSticky ? ' wg__filter-cell--frozen' : ''}" style="${isSticky ? 'left: 0;' : ''}"></th>`
		// Always include row number offset when visible (prevents frozen columns from overlapping)
		cumulativeOffset += ROW_NUMBER_COLUMN_WIDTH
	}

	// Inline actions column (toolbarPosition="inline")
	const showInlineActions = ctx.engine.isRowToolbarVisible && ctx.engine.toolbarPosition === 'inline'
	let inlineActionsHeaderHtml = ''
	if (showInlineActions) {
		// Compute column width from max button count per toolbar row
		// Each button is --wg-toolbar-btn-min-width (2.4rem), gap is 0.2rem, cell padding is ~spacing-sm each side
		const maxBtns = Math.max(1, maxToolbarRowLength(ctx.engine.rowToolbar))
		// Width = buttons * btnWidth + (buttons-1) * gap + 2 * paddingSm
		// Using calc with CSS vars so it respects theming
		const colWidth = `calc(${maxBtns} * var(--wg-toolbar-btn-min-width) + ${Math.max(0, maxBtns - 1)} * var(--wg-inline-actions-gap) + 2 * var(--wg-spacing-sm))`
		inlineActionsHeaderHtml = `<th class="wg__header wg__inline-actions-header" style="width: ${colWidth}">${ctx.escapeHtml(ctx.engine.inlineActionsTitle ?? ctx.engine.labels.inlineActionsHeader)}</th>`
		filterLeadHtml += '<th class="wg__filter-cell"></th>'
	}

	// Actions column for button trigger mode (floating toolbar trigger)
	const showActionsColumn = ctx.engine.isRowToolbarVisible && ctx.engine.toolbarTrigger === 'button' && ctx.engine.toolbarPosition !== 'inline'
	const actionsColumnHtml = showActionsColumn
		? '<th class="wg__header wg__actions-column"></th>'
		: ''
	if (showActionsColumn) filterLeadHtml += '<th class="wg__filter-cell wg__actions-column"></th>'

	const headerCells = visualColumns.map(({ column, originalIndex }, visualIndex) => {
		const field = String(column.field)
		const isSortable = column.isSortable !== false && ctx.engine.sortMode !== 'none'
		const sortState = ctx.engine.getColumnSortState(field)
		const sortPriority = ctx.engine.getColumnSortPriority(field)
		const isSorted = sortState !== undefined
		const isFrozen = ctx.engine.isColumnFrozen(visualIndex)
		const isLastFrozen = isFrozen && visualIndex === ctx.engine.totalFrozenColumns - 1

		// Check if column is selected
		const isColumnSelected = ctx.engine.isColumnPositionSelected(visualIndex)

		const classes = ['wg__header']
		if (isSortable) classes.push('wg__header--sortable')
		if (isSorted) classes.push('wg__header--sorted')
		if (isFrozen) classes.push('wg__header--frozen')
		if (isLastFrozen) classes.push('wg__header--frozen-last')
		if (isColumnSelected) classes.push('wg__header--selected')

		// Calculate column width for offset tracking
		// Use runtime width override if set (from column resize), otherwise column definition
		const runtimeWidth = ctx.engine.getColumnWidth(field)
		const colWidth = runtimeWidth || column.width || column.maxWidth
		const parsedWidth = parseColumnWidth(colWidth)

		// Build style with width, minWidth, maxWidth, and sticky positioning
		// Only use explicit minWidth (allows resizing below original width)
		// Fall back to grid-level columnMinWidth when column has no explicit minWidth
		// Add max-width equal to width to enforce column width for text-overflow
		const effectiveMinWidth = column.minWidth ?? ctx.engine.columnMinWidth
		const hAlign = column.headerHorizontalAlign || column.horizontalAlign || 'left'
		const vAlign = column.headerVerticalAlign || column.verticalAlign || 'middle'
		const styleProps = [
			isFrozen ? `position: sticky` : '',
			isFrozen ? `left: ${cumulativeOffset}px` : '',
			isFrozen ? `z-index: 2` : '',
			colWidth ? `width: ${colWidth}` : '',
			colWidth ? `max-width: ${colWidth}` : '',
			effectiveMinWidth ? `min-width: ${effectiveMinWidth}` : '',
			column.nowrap ? `white-space: nowrap` : '',
			`text-align: ${hAlign}`,
			`vertical-align: ${vAlign}`
		].filter(Boolean).join('; ')
		const styleAttr = `style="${styleProps}"`

		if (isFilterRowVisible) {
			const filterStyle = [
				isFrozen ? `left: ${cumulativeOffset}px` : '',
				colWidth ? `width: ${colWidth}` : '',
				colWidth ? `max-width: ${colWidth}` : ''
			].filter(Boolean).join('; ')
			const frozenClass = isFrozen ? ' wg__filter-cell--frozen' : ''
			if (column.isFilterable) {
				const isInvalid = invalidFilterFields.has(field)
				const value = ctx.filterInputText(field) ?? filters[field] ?? ''
				const label = ctx.engine.labels.filterColumn.replace('{column}', column.title ?? field)
				filterCells.push(`<th class="wg__filter-cell${frozenClass}" style="${filterStyle}" data-field="${ctx.escapeHtml(field)}"><input type="text" class="wg__filter-input${isInvalid ? ' invalid' : ''}" data-field="${ctx.escapeHtml(field)}" value="${ctx.escapeHtml(value)}" aria-label="${ctx.escapeHtml(label)}"${isInvalid ? ' aria-invalid="true"' : ''} autocomplete="off" spellcheck="false"></th>`)
			} else {
				filterCells.push(`<th class="wg__filter-cell${frozenClass}" style="${filterStyle}"></th>`)
			}
		}

		// Increment offset for next frozen column
		if (isFrozen) {
			cumulativeOffset += parsedWidth
		}

		let sortIndicator = ''
		if (isSortable) {
			if (isSorted) {
				const arrow = sortState.direction === 'asc' ? '▲' : '▼'
				// Show priority number for multi-column sort (only if more than one column is sorted)
				const priorityLabel = ctx.engine.sort.length > 1 ? `<sup class="wg__sort-priority">${sortPriority}</sup>` : ''
				sortIndicator = `<span class="wg__sort-indicator">${arrow}${priorityLabel}</span>`
			} else {
				sortIndicator = `<span class="wg__sort-indicator wg__sort-placeholder">⬍</span>`
			}
		}

		let headerInfo = ''
		if (column.headerInfo) {
			headerInfo = `<span class="wg__header-info" data-tooltip="${ctx.escapeHtml(column.headerInfo)}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></span>`
		}

		// Resize handle (always rendered, but disabled class for non-resizable columns)
		const isResizable = column.isResizable !== false
		const resizeHandle = `<div class="wg__resize-handle${isResizable ? '' : ' wg__resize-handle--disabled'}" data-field="${field}"></div>`

		return `
			<th class="${classes.join(' ')}" ${styleAttr} data-field="${field}">
				<div class="wg__header-container">
					<div class="wg__header-content wg__header-content--align-${hAlign} wg__header-content--valign-${vAlign}">
						<span class="wg__header-title">${ctx.escapeHtml(column.title)}</span>
						${headerInfo}
					</div>
					<div class="wg__header-controls">
						${sortIndicator}
					</div>
				</div>
				${resizeHandle}
			</th>
		`
	}).join('')

	const headerRow = `<tr>${rowNumberColumnHtml}${inlineActionsHeaderHtml}${actionsColumnHtml}${headerCells}<th class="wg__filler">&nbsp;</th></tr>`
	if (!isFilterRowVisible) return headerRow
	return `${headerRow}<tr class="wg__filter-row">${filterLeadHtml}${filterCells.join('')}<th class="wg__filter-cell wg__filter-cell--filler"></th></tr>`
}

/**
 * Render data rows
 */
export function renderDataRows<T>(ctx: GridHost<T>): string {
	const items = ctx.engine.displayItems
	const visualColumns = ctx.engine.visualColumns

	// Row number column
	const showRowNumbers = ctx.engine.isRowNumbersVisible
	const stickyRowNumbers = ctx.engine.isStickyRowNumbers

	// Inline actions column (toolbarPosition="inline")
	const showInlineActions = ctx.engine.isRowToolbarVisible && ctx.engine.toolbarPosition === 'inline'

	// Actions column for button trigger mode (floating toolbar trigger)
	const showActionsColumn = ctx.engine.isRowToolbarVisible && ctx.engine.toolbarTrigger === 'button' && ctx.engine.toolbarPosition !== 'inline'
	const colspanWithExtras = visualColumns.length + (showActionsColumn ? 1 : 0) + (showRowNumbers ? 1 : 0) + (showInlineActions ? 1 : 0)

	if (items.length === 0) {
		return `
			<tr>
				<td class="wg__empty" colspan="${colspanWithExtras}">
					No items to display
				</td>
			</tr>
		`
	}

	const activeToolbarRow = getActiveToolbarRowIndex()

	// Pre-calculate column widths for offset computation
	const columnWidths = visualColumns.map(({ column }) =>
		parseColumnWidth(column.width || column.maxWidth)
	)

	return items.map((item, rowIndex) => {
		// Check lock state
		const lockInfo = ctx.engine.getRowLockInfo(item)
		const isLocked = lockInfo?.isLocked === true

		// Check if this is the empty row
		const isEmptyRow = ctx.engine.isEmptyRowIndex(rowIndex)

		// Track cumulative offset for sticky positioning
		let cumulativeOffset = 0

		// Row number cell (shows lock icon when locked, empty row indicator, may be sticky)
		let rowNumberCell = ''
		if (showRowNumbers) {
			const stickyStyle = stickyRowNumbers
				? `position: sticky; left: 0; z-index: 2;`
				: ''
			const frozenClass = stickyRowNumbers ? ' wg__cell--frozen' : ''

			if (isLocked) {
				const lockTooltip = ctx.engine.getLockTooltip(lockInfo)
				rowNumberCell = `<td class="wg__cell wg__row-number wg__row-number--locked${frozenClass}" style="${stickyStyle}" data-tooltip="${ctx.escapeHtml(lockTooltip)}" data-row-number="${rowIndex}">🔒</td>`
			} else if (isEmptyRow) {
				rowNumberCell = `<td class="wg__cell wg__row-number wg__empty-row-indicator${frozenClass}" style="${stickyStyle}" data-row-number="${rowIndex}">${ctx.engine.newRowIndicator}</td>`
			} else {
				const dirtyClass = ctx.engine.isDirtyIndicatorVisible && ctx.engine.isRowDirty(rowIndex) ? ' wg__row-number--dirty' : ''
				rowNumberCell = `<td class="wg__cell wg__row-number${dirtyClass}${frozenClass}" style="${stickyStyle}" data-row-number="${rowIndex}">${rowIndex + 1}</td>`
			}

			// Always include row number offset when visible (prevents frozen columns from overlapping)
			cumulativeOffset += ROW_NUMBER_COLUMN_WIDTH
		}

		// Inline actions cell (toolbarPosition="inline")
		const inlineActionsCell = showInlineActions
			? renderInlineActionsCell(ctx, item, rowIndex)
			: ''

		// Actions cell for button trigger mode
		let actionsCell = ''
		if (showActionsColumn) {
			const isActive = activeToolbarRow === rowIndex
			actionsCell = `
				<td class="wg__cell wg__actions-column">
					${renderTriggerButton(rowIndex, isActive, ctx.engine.labels.rowActions)}
				</td>
			`
		}

		const cells = visualColumns.map(({ column, originalIndex }, visualIndex) => {
			const field = String(column.field)
			const value = ctx.engine.getCellValue(item, column, rowIndex)
			const align = column.horizontalAlign || 'left'
			const vAlign = column.verticalAlign || 'middle'
			// Use canEditCell to check both column editability AND row locking
			const isEditable = ctx.engine.canEditCell(rowIndex, field)
			// Use originalIndex for focus check (navigation uses original indices)
			const isFocused = ctx.engine.isCellFocused(rowIndex, originalIndex)
			const isFrozen = ctx.engine.isColumnFrozen(visualIndex)
			const isLastFrozen = isFrozen && visualIndex === ctx.engine.totalFrozenColumns - 1

			// Determine if this is 'always' editTrigger mode
			const effectiveTrigger = column.editTrigger ?? ctx.engine.editTrigger

			const classes = ['wg__cell']
			const shouldShowEditor = ctx.engine.shouldShowEditor(rowIndex, originalIndex)
			const isActivelyEditing = ctx.engine.isEditing(rowIndex, field)  // Only the ONE tracked cell
			if (isEditable) classes.push('wg__cell--editable')
			if (isFocused && !isActivelyEditing) classes.push('wg__cell--focused')
			// In 'always' mode, add special focus class even when showing editor
			if (isFocused && effectiveTrigger === 'always') classes.push('wg__cell--always-edit-focused')
			if (column.textOverflow !== 'wrap') classes.push('wg__cell--ellipsis')
			if (column.maxLines) classes.push('wg__cell--line-clamp')
			if (isActivelyEditing) classes.push('wg__cell--editing')
			if (ctx.engine.isCellInvalid(rowIndex, field)) classes.push('wg__cell--invalid')
			if (ctx.engine.isDirtyIndicatorVisible && ctx.engine.isCellDirty(rowIndex, field)) {
				classes.push('wg__cell--dirty')
			}
			if (ctx.engine.isCellInSelectedRange(rowIndex, visualIndex)) classes.push('wg__cell--in-range')
			if (ctx.engine.isColumnPositionSelected(visualIndex)) classes.push('wg__cell--column-selected')
			if (isFrozen) classes.push('wg__cell--frozen')
			if (isLastFrozen) classes.push('wg__cell--frozen-last')
			if (column.cellClass) classes.push(column.cellClass)
			if (column.getCellClassCallback) {
				// ctx.value is the raw value (not formatted)
				const dynamicClass = column.getCellClassCallback(ctx.engine.cellCtx(item, rowIndex, column))
				if (dynamicClass) classes.push(dynamicClass)
			}

			// Build cell style with width properties and sticky positioning
			// Use runtime width override if set (from column resize), otherwise column definition
			const runtimeWidth = ctx.engine.getColumnWidth(field)
			const cellWidth = runtimeWidth || column.width
			// Mirror the header's min-width logic so HTML auto table-layout can't drag a
			// body-cell-wide column past the header's caps (rc16 fix). Without this,
			// nowrap + maxWidth columns wouldn't actually clamp because body widths
			// determined the column's natural width.
			const effectiveMinWidth = column.minWidth ?? ctx.engine.columnMinWidth
			const cellStyleProps = [
				isFrozen ? `position: sticky` : '',
				isFrozen ? `left: ${cumulativeOffset}px` : '',
				isFrozen ? `z-index: 1` : '',
				`text-align: ${align}`,
				`vertical-align: ${vAlign}`,
				cellWidth ? `width: ${cellWidth}` : '',
				cellWidth ? `max-width: ${cellWidth}` : '',
				effectiveMinWidth ? `min-width: ${effectiveMinWidth}` : '',
				column.maxWidth ? `max-width: ${column.maxWidth}` : '',
				column.nowrap ? `white-space: nowrap` : ''
			].filter(Boolean).join('; ')

			// Increment offset for next frozen column
			if (isFrozen) {
				cumulativeOffset += columnWidths[visualIndex]
			}

			// In navigate mode, ALL cells are focusable (not just editable)
			const tabindexAttr = ctx.engine.isNavigateMode ? 'tabindex="0"' : ''

			// Cell tooltip: getTooltipCallback > tooltipMember > validation error
			const tooltip = getCellTooltip(ctx, item, rowIndex, column)
			const tooltipAttr = tooltip ? `${tooltip.attr}="${ctx.escapeHtml(tooltip.text)}"` : ''

			const innerHtml = shouldShowEditor
				? renderCellEditor(ctx, rowIndex, originalIndex, column)
				: renderCellDisplay(ctx, rowIndex, originalIndex, column, value, isFocused, isEditable)
			const cellInner = wrapTreeCell(ctx, column, item, innerHtml)

			return `
				<td
					class="${classes.join(' ')}"
					style="${cellStyleProps}"
					data-row="${rowIndex}"
					data-col="${originalIndex}"
					data-field="${field}"
					${tabindexAttr}
					${tooltipAttr}
				>
					${cellInner}
				</td>
			`
		}).join('')

		// Build row classes
		const rowClasses = ['wg__row']
		if (isLocked) rowClasses.push('wg__row--locked')
		if (isEmptyRow) rowClasses.push('wg__row--empty-row')
		if (ctx.engine.isRowSelected(rowIndex)) rowClasses.push('wg__row--selected')
		if (ctx.engine.isRowFocused(rowIndex)) rowClasses.push('wg__row--focused')
		if (ctx.engine.getRowClassCallback) {
			const dynamicClass = ctx.engine.getRowClassCallback(ctx.engine.rowCtx(item, rowIndex))
			if (dynamicClass) rowClasses.push(dynamicClass)
		}

		// Row tooltip for locked rows (when no row numbers visible)
		const rowTooltipAttr = isLocked && !showRowNumbers
			? `data-tooltip="${ctx.escapeHtml(ctx.engine.getLockTooltip(lockInfo))}"`
			: ''

		return `<tr class="${rowClasses.join(' ')}" data-row-index="${rowIndex}" ${rowTooltipAttr}>${rowNumberCell}${inlineActionsCell}${actionsCell}${cells}<td class="wg__cell wg__filler" data-row="${rowIndex}"></td></tr>`
	}).join('')
}

/**
 * Render inline actions cell for a row
 * Renders toolbar buttons directly in the cell (hidden buttons are excluded from DOM)
 * Supports multi-row layout via the `row` property on toolbar items
 */
function renderInlineActionsCell<T>(ctx: GridHost<T>, row: T, rowIndex: number): string {
	const buttons = resolveToolbar(ctx, ctx.engine.rowToolbar, ctx.engine.rowCtx(row, rowIndex))

	// Render each toolbar row of buttons (ascending)
	const rowNums = [...new Set(buttons.map(b => b.row))].sort((a, b) => a - b)
	const rowsHtml = rowNums.map(rowNum => {
		const html = buttons.map((b, i) => {
			if (b.row !== rowNum) return ''
			// data-row lets the click handler find the row; data-wg-index the item
			return renderToolbarButton(b, i, 'wg__inline-action-btn').replace('<button ', `<button data-row="${rowIndex}" `)
		}).join('')
		return `<div class="wg__inline-actions-row">${html}</div>`
	}).join('')

	return `<td class="wg__cell wg__inline-actions-cell"><div class="wg__inline-actions-wrap">${rowsHtml}</div></td>`
}

/**
 * Virtual scroll parameters
 */
export type VirtualScrollParams = {
	startIndex: number
	endIndex: number
	rowHeight: number
	totalItems: number
}

/**
 * Render data rows with virtual scrolling (spacer rows pattern)
 * Only renders visible rows + buffer, with spacer rows for correct scroll height
 */
export function renderDataRowsVirtual<T>(ctx: GridHost<T>, params: VirtualScrollParams): string {
	const items = ctx.engine.displayItems
	const visualColumns = ctx.engine.visualColumns
	const { startIndex, endIndex, rowHeight, totalItems } = params

	// Row number column
	const showRowNumbers = ctx.engine.isRowNumbersVisible
	const stickyRowNumbers = ctx.engine.isStickyRowNumbers

	// Inline actions column (toolbarPosition="inline")
	const showInlineActions = ctx.engine.isRowToolbarVisible && ctx.engine.toolbarPosition === 'inline'

	// Actions column for button trigger mode (floating toolbar trigger)
	const showActionsColumn = ctx.engine.isRowToolbarVisible && ctx.engine.toolbarTrigger === 'button' && ctx.engine.toolbarPosition !== 'inline'
	const colspanWithExtras = visualColumns.length + (showActionsColumn ? 1 : 0) + (showRowNumbers ? 1 : 0) + (showInlineActions ? 1 : 0)

	if (items.length === 0) {
		return `
			<tr>
				<td class="wg__empty" colspan="${colspanWithExtras}">
					No items to display
				</td>
			</tr>
		`
	}

	const activeToolbarRow = getActiveToolbarRowIndex()

	// Pre-calculate column widths for offset computation
	const columnWidths = visualColumns.map(({ column }) =>
		parseColumnWidth(column.width || column.maxWidth)
	)

	// Calculate spacer heights
	const topSpacerHeight = startIndex * rowHeight
	const bottomSpacerHeight = (totalItems - endIndex) * rowHeight

	// Top spacer row - height on TD for better browser compatibility
	const topSpacer = topSpacerHeight > 0
		? `<tr class="wg__spacer-top"><td colspan="${colspanWithExtras}" style="height: ${topSpacerHeight}px"></td></tr>`
		: ''

	// Render only visible rows
	const visibleRows = []
	for (let i = startIndex; i < endIndex && i < items.length; i++) {
		const item = items[i]
		const rowIndex = i  // Absolute index in the data array

		// Check lock state
		const lockInfo = ctx.engine.getRowLockInfo(item)
		const isLocked = lockInfo?.isLocked === true

		// Check if this is the empty row
		const isEmptyRow = ctx.engine.isEmptyRowIndex(rowIndex)

		// Track cumulative offset for sticky positioning
		let cumulativeOffset = 0

		// Row number cell (shows lock icon when locked, empty row indicator, may be sticky)
		let rowNumberCell = ''
		if (showRowNumbers) {
			const stickyStyle = stickyRowNumbers
				? `position: sticky; left: 0; z-index: 2;`
				: ''
			const frozenClass = stickyRowNumbers ? ' wg__cell--frozen' : ''

			if (isLocked) {
				const lockTooltip = ctx.engine.getLockTooltip(lockInfo)
				rowNumberCell = `<td class="wg__cell wg__row-number wg__row-number--locked${frozenClass}" style="${stickyStyle}" data-tooltip="${ctx.escapeHtml(lockTooltip)}" data-row-number="${rowIndex}">🔒</td>`
			} else if (isEmptyRow) {
				rowNumberCell = `<td class="wg__cell wg__row-number wg__empty-row-indicator${frozenClass}" style="${stickyStyle}" data-row-number="${rowIndex}">${ctx.engine.newRowIndicator}</td>`
			} else {
				const dirtyClass = ctx.engine.isDirtyIndicatorVisible && ctx.engine.isRowDirty(rowIndex) ? ' wg__row-number--dirty' : ''
				rowNumberCell = `<td class="wg__cell wg__row-number${dirtyClass}${frozenClass}" style="${stickyStyle}" data-row-number="${rowIndex}">${rowIndex + 1}</td>`
			}

			// Always include row number offset when visible (prevents frozen columns from overlapping)
			cumulativeOffset += ROW_NUMBER_COLUMN_WIDTH
		}

		// Inline actions cell (toolbarPosition="inline")
		const inlineActionsCell = showInlineActions
			? renderInlineActionsCell(ctx, item, rowIndex)
			: ''

		// Actions cell for button trigger mode
		let actionsCell = ''
		if (showActionsColumn) {
			const isActive = activeToolbarRow === rowIndex
			actionsCell = `
				<td class="wg__cell wg__actions-column">
					${renderTriggerButton(rowIndex, isActive, ctx.engine.labels.rowActions)}
				</td>
			`
		}

		const cells = visualColumns.map(({ column, originalIndex }, visualIndex) => {
			const field = String(column.field)
			const value = ctx.engine.getCellValue(item, column, rowIndex)
			const align = column.horizontalAlign || 'left'
			const vAlign = column.verticalAlign || 'middle'
			// Use canEditCell to check both column editability AND row locking
			const isEditable = ctx.engine.canEditCell(rowIndex, field)
			// Use originalIndex for focus check (navigation uses original indices)
			const isFocused = ctx.engine.isCellFocused(rowIndex, originalIndex)
			const isFrozen = ctx.engine.isColumnFrozen(visualIndex)
			const isLastFrozen = isFrozen && visualIndex === ctx.engine.totalFrozenColumns - 1

			// Determine if this is 'always' editTrigger mode
			const effectiveTrigger = column.editTrigger ?? ctx.engine.editTrigger

			const classes = ['wg__cell']
			const shouldShowEditor = ctx.engine.shouldShowEditor(rowIndex, originalIndex)
			const isActivelyEditing = ctx.engine.isEditing(rowIndex, field)  // Only the ONE tracked cell
			if (isEditable) classes.push('wg__cell--editable')
			if (isFocused && !isActivelyEditing) classes.push('wg__cell--focused')
			// In 'always' mode, add special focus class even when showing editor
			if (isFocused && effectiveTrigger === 'always') classes.push('wg__cell--always-edit-focused')
			if (column.textOverflow !== 'wrap') classes.push('wg__cell--ellipsis')
			if (column.maxLines) classes.push('wg__cell--line-clamp')
			if (isActivelyEditing) classes.push('wg__cell--editing')
			if (ctx.engine.isCellInvalid(rowIndex, field)) classes.push('wg__cell--invalid')
			if (ctx.engine.isDirtyIndicatorVisible && ctx.engine.isCellDirty(rowIndex, field)) {
				classes.push('wg__cell--dirty')
			}
			if (ctx.engine.isCellInSelectedRange(rowIndex, visualIndex)) classes.push('wg__cell--in-range')
			if (ctx.engine.isColumnPositionSelected(visualIndex)) classes.push('wg__cell--column-selected')
			if (isFrozen) classes.push('wg__cell--frozen')
			if (isLastFrozen) classes.push('wg__cell--frozen-last')
			if (column.cellClass) classes.push(column.cellClass)
			if (column.getCellClassCallback) {
				// ctx.value is the raw value (not formatted)
				const dynamicClass = column.getCellClassCallback(ctx.engine.cellCtx(item, rowIndex, column))
				if (dynamicClass) classes.push(dynamicClass)
			}

			// Build cell style with width properties and sticky positioning
			// Use runtime width override if set (from column resize), otherwise column definition
			const runtimeWidth = ctx.engine.getColumnWidth(field)
			const cellWidth = runtimeWidth || column.width
			// Mirror the header's min-width logic so HTML auto table-layout can't drag a
			// body-cell-wide column past the header's caps (rc16 fix). Without this,
			// nowrap + maxWidth columns wouldn't actually clamp because body widths
			// determined the column's natural width.
			const effectiveMinWidth = column.minWidth ?? ctx.engine.columnMinWidth
			const cellStyleProps = [
				isFrozen ? `position: sticky` : '',
				isFrozen ? `left: ${cumulativeOffset}px` : '',
				isFrozen ? `z-index: 1` : '',
				`text-align: ${align}`,
				`vertical-align: ${vAlign}`,
				cellWidth ? `width: ${cellWidth}` : '',
				cellWidth ? `max-width: ${cellWidth}` : '',
				effectiveMinWidth ? `min-width: ${effectiveMinWidth}` : '',
				column.maxWidth ? `max-width: ${column.maxWidth}` : '',
				column.nowrap ? `white-space: nowrap` : ''
			].filter(Boolean).join('; ')

			// Increment offset for next frozen column
			if (isFrozen) {
				cumulativeOffset += columnWidths[visualIndex]
			}

			// In navigate mode, ALL cells are focusable (not just editable)
			const tabindexAttr = ctx.engine.isNavigateMode ? 'tabindex="0"' : ''

			// Cell tooltip: getTooltipCallback > tooltipMember > validation error
			const tooltip = getCellTooltip(ctx, item, rowIndex, column)
			const tooltipAttr = tooltip ? `${tooltip.attr}="${ctx.escapeHtml(tooltip.text)}"` : ''

			const innerHtml = shouldShowEditor
				? renderCellEditor(ctx, rowIndex, originalIndex, column)
				: renderCellDisplay(ctx, rowIndex, originalIndex, column, value, isFocused, isEditable)
			const cellInner = wrapTreeCell(ctx, column, item, innerHtml)

			return `
				<td
					class="${classes.join(' ')}"
					style="${cellStyleProps}"
					data-row="${rowIndex}"
					data-col="${originalIndex}"
					data-field="${field}"
					${tabindexAttr}
					${tooltipAttr}
				>
					${cellInner}
				</td>
			`
		}).join('')

		// Build row classes
		const rowClasses = ['wg__row']
		if (isLocked) rowClasses.push('wg__row--locked')
		if (isEmptyRow) rowClasses.push('wg__row--empty-row')
		if (ctx.engine.isRowSelected(rowIndex)) rowClasses.push('wg__row--selected')
		if (ctx.engine.isRowFocused(rowIndex)) rowClasses.push('wg__row--focused')
		if (ctx.engine.getRowClassCallback) {
			const dynamicClass = ctx.engine.getRowClassCallback(ctx.engine.rowCtx(item, rowIndex))
			if (dynamicClass) rowClasses.push(dynamicClass)
		}

		// Row tooltip for locked rows (when no row numbers visible)
		const rowTooltipAttr = isLocked && !showRowNumbers
			? `data-tooltip="${ctx.escapeHtml(ctx.engine.getLockTooltip(lockInfo))}"`
			: ''

		visibleRows.push(`<tr class="${rowClasses.join(' ')}" data-row-index="${rowIndex}" ${rowTooltipAttr}>${rowNumberCell}${inlineActionsCell}${actionsCell}${cells}<td class="wg__cell wg__filler" data-row="${rowIndex}"></td></tr>`)
	}

	// Bottom spacer row - height on TD for better browser compatibility
	const bottomSpacer = bottomSpacerHeight > 0
		? `<tr class="wg__spacer-bottom"><td colspan="${colspanWithExtras}" style="height: ${bottomSpacerHeight}px"></td></tr>`
		: ''

	return topSpacer + visibleRows.join('') + bottomSpacer
}

/**
 * Render pagination controls
 * @param ctx Grid context
 * @param position Position string (e.g., "bottom-center", "top-right")
 */
export function renderPagination<T>(ctx: GridHost<T>, position: string = 'bottom-center'): string {
	// Don't render if not pageable or isPaginationVisible is false
	const showPag = ctx.engine.isPaginationVisible
	if (!ctx.engine.isPageable || showPag === false) return ''
	// 'auto' mode: hide when only 1 page
	if (showPag === 'auto' && ctx.engine.totalPages <= 1) return ''

	const currentPage = ctx.engine.currentPage
	const totalPages = ctx.engine.totalPages
	const currentPageSize = ctx.engine.pageSize
	// A pending beforePageChangeCallback disables the whole pager
	const isPending = ctx.engine.isPageChangePending
	const pageSizes = ctx.engine.pageSizes
	// Use totalItems if provided (server-side), otherwise use local item count
	const totalItems = ctx.engine.totalItems !== null
		? ctx.engine.totalItems
		: (ctx.engine as unknown as { sortedItems: T[] }).sortedItems.length

	// Build labels (grid.labels → getPaginationLabelsCallback → final)
	const gridLabels = ctx.engine.labels
	const defaultLabels = {
		first: gridLabels.paginationFirst,
		previous: gridLabels.paginationPrevious,
		next: gridLabels.paginationNext,
		last: gridLabels.paginationLast,
		pageInfo: gridLabels.paginationPageInfo
			.replace('{current}', String(currentPage))
			.replace('{total}', String(totalPages)),
		itemCount: gridLabels.paginationItemCount
			.replace('{count}', String(totalItems)),
		perPage: gridLabels.paginationPerPage
	}

	const labelsCallback = ctx.engine.getPaginationLabelsCallback
	const customLabels = labelsCallback
		? labelsCallback(ctx.engine.ctx({ currentPage, totalPages, totalItems, pageSize: currentPageSize }))
		: {}
	const labels = { ...defaultLabels, ...customLabels }

	// Determine alignment class from position
	const isTop = position.startsWith('top-')
	const alignment = position.replace('top-', '').replace('bottom-', '')  // left, center, or right

	// Build CSS classes
	const classes = ['wg__pagination']
	if (alignment === 'left') classes.push('wg__pagination--left')
	else if (alignment === 'right') classes.push('wg__pagination--right')
	// center is default, no modifier needed
	if (isTop) classes.push('wg__pagination--top')

	// Build element HTML fragments
	const elements: Record<string, string> = {
		first: `
			<button class="wg__pagination-btn" data-action="first" ${currentPage === 1 || isPending ? 'disabled' : ''}>
				${labels.first}
			</button>
		`,
		previous: `
			<button class="wg__pagination-btn" data-action="prev" ${currentPage === 1 || isPending ? 'disabled' : ''}>
				${labels.previous}
			</button>
		`,
		next: `
			<button class="wg__pagination-btn" data-action="next" ${currentPage === totalPages || isPending ? 'disabled' : ''}>
				${labels.next}
			</button>
		`,
		last: `
			<button class="wg__pagination-btn" data-action="last" ${currentPage === totalPages || isPending ? 'disabled' : ''}>
				${labels.last}
			</button>
		`,
		pageInfo: `
			<div class="wg__pagination-info">
				${labels.pageInfo}
				<span class="wg__pagination-count">${labels.itemCount}</span>
			</div>
		`,
		pageSize: pageSizes.length > 0 ? `
			<div class="wg__pagination-pagesize">
				<select class="wg__pagination-select" data-action="pagesize" ${isPending ? 'disabled' : ''}>
					${pageSizes.map(size =>
						`<option value="${size}" ${size === currentPageSize ? 'selected' : ''}>${size}</option>`
					).join('')}
				</select>
				<span class="wg__pagination-label">${labels.perPage}</span>
			</div>
		` : ''
	}

	// Parse layout and build content
	const layout = ctx.engine.paginationLayout.split('|').map(s => s.trim())
	const content = layout.map(part => elements[part] || '').join('')

	return `<div class="${classes.join(' ')}"${isPending ? ' aria-busy="true"' : ''}>${content}</div>`
}

/**
 * Render summary content
 * @param ctx Grid context
 * @param position Position string (e.g., "bottom-left", "top-right")
 */
export function renderSummary<T>(ctx: GridHost<T>, position: string): string {
	if (!ctx.engine.renderSummaryCallback) return ''
	const content = renderSummaryContent(ctx)

	// Determine alignment class from position
	const isTop = position.startsWith('top-')
	const alignment = position.replace('top-', '').replace('bottom-', '')

	const classes = ['wg__summary']
	if (alignment === 'left') classes.push('wg__summary--left')
	else if (alignment === 'right') classes.push('wg__summary--right')
	if (isTop) classes.push('wg__summary--top')

	return `<div class="${classes.join(' ')}">${content}</div>`
}

/** The `renderSummaryCallback` HTML for the current view ('' without a callback). */
export function renderSummaryContent<T>(ctx: GridHost<T>): string {
	const callback = ctx.engine.renderSummaryCallback
	if (!callback) return ''

	const currentPage = ctx.engine.currentPage
	const pageSize = ctx.engine.pageSize
	const allItems = (ctx.engine as unknown as { sortedItems: T[] }).sortedItems
	const items = ctx.engine.displayItems
	const totalItems = ctx.engine.totalItems !== null
		? ctx.engine.totalItems
		: allItems.length

	const content = callback(ctx.engine.ctx({
		items,
		allItems,
		totalItems,
		currentPage,
		pageSize,
		metadata: ctx.engine.summaryMetadata,
		drafts: ctx.engine.getDrafts()
	}))
	return content ?? ''
}

/**
 * The tooltip of a body cell — `getTooltipCallback` (raw value in ctx) > `tooltipMember`
 * > the validation error of an invalid cell (`getValidationTooltipCallback`, column then
 * grid, as HTML; else the plain message). `attr` is `data-tooltip` (text) or
 * `data-tooltip-html`. Shared by the full row renderers and the surgical `renderCell`.
 */
export function getCellTooltip<T>(
	ctx: GridHost<T>,
	item: T,
	rowIndex: number,
	column: Column<T>
): { attr: 'data-tooltip' | 'data-tooltip-html'; text: string } | null {
	const textAttr = column.isTooltipHtml ? 'data-tooltip-html' : 'data-tooltip'
	if (column.getTooltipCallback) {
		const text = column.getTooltipCallback(ctx.engine.cellCtx(item, rowIndex, column))
		if (text) return { attr: textAttr, text }
	} else if (column.tooltipMember) {
		const text = (item as Record<string, unknown>)[column.tooltipMember]
		if (text && typeof text === 'string') return { attr: textAttr, text }
	}
	const field = String(column.field)
	if (!ctx.engine.isCellInvalid(rowIndex, field)) return null
	const errorMsg = ctx.engine.getCellValidationError(rowIndex, field)
	if (!errorMsg) return null
	const validationTooltipCb = column.getValidationTooltipCallback || ctx.engine.getValidationTooltipCallback
	if (validationTooltipCb) {
		const html = validationTooltipCb(Object.assign(ctx.engine.cellCtx(item, rowIndex, column), { error: errorMsg }))
		if (html) return { attr: 'data-tooltip-html', text: html }
	}
	return { attr: 'data-tooltip', text: errorMsg }
}

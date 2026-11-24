// =============================================================================
// ARIA grid semantics
// role="grid" / "treegrid" + row / cell roles and the virtual-row indexes.
//
// Cell NAVIGATION stays the grid's own (Excel model over virtual rows, frozen
// columns, Tab-to-editable — VALIDATION-NOTES.md C-CA-25); this module only
// describes the structure so a screen reader can announce it:
// - aria-rowcount / aria-colcount on the table, aria-rowindex / aria-colindex
//   on every rendered row / cell (1-based, the header row(s) count) — required
//   with virtual rows, where only the rendered window exists in the DOM;
// - aria-selected (rows always; cells while cell selection is on), aria-readonly,
//   aria-sort (the primary sort column), aria-level / aria-expanded in tree mode.
// =============================================================================

import type { GridHost } from '../grid-context.js'
import { GRID_ENGINE } from '../grid-context.js'

/** Whether the filter row renders under the header (it is an ARIA row of its own). */
export function isFilterRowVisible<T>(ctx: GridHost<T>): boolean {
	return ctx[GRID_ENGINE].isFilteringEnabled && ctx[GRID_ENGINE].visualColumns.some(({ column }) => column.isFilterable)
}

/** Rows above the first data row: the header row, + the filter row when shown. */
export function headerRowCount<T>(ctx: GridHost<T>): number {
	if (ctx[GRID_ENGINE].visualColumns.length === 0) return 0
	return isFilterRowVisible(ctx) ? 2 : 1
}

/** Columns before the first data column: row numbers, inline actions, the actions column. */
export function leadColumnCount<T>(ctx: GridHost<T>): number {
	const e = ctx[GRID_ENGINE]
	const isInline = e.isRowToolbarShown && e.toolbarPosition === 'inline'
	const isActionsColumn = e.isRowToolbarShown && e.toolbarTrigger === 'button' && e.toolbarPosition !== 'inline'
	return (e.isRowNumbersShown ? 1 : 0) + (isInline ? 1 : 0) + (isActionsColumn ? 1 : 0)
}

/** `aria-rowindex` of a data row (display index → 1-based, after the header rows). */
export function dataRowAriaIndex<T>(ctx: GridHost<T>, rowIndex: number): number {
	return headerRowCount(ctx) + rowIndex + 1
}

/**
 * The grid-level attributes, written on the <table> after every render (the
 * surgical render path keeps the table element, so these can't live in markup).
 */
export function writeGridAria<T>(ctx: GridHost<T>, table: HTMLTableElement): void {
	const e = ctx[GRID_ENGINE]
	table.setAttribute('role', e.isTreeMode ? 'treegrid' : 'grid')
	// An empty grid still renders one message row
	const dataRows = Math.max(1, e.displayItems.length)
	table.setAttribute('aria-rowcount', String(headerRowCount(ctx) + dataRows))
	table.setAttribute('aria-colcount', String(leadColumnCount(ctx) + e.visualColumns.length))
	table.setAttribute('aria-multiselectable', 'true')
	if (e.isEffectivelyEditable) table.removeAttribute('aria-readonly')
	else table.setAttribute('aria-readonly', 'true')
	if (e.isDisabled) table.setAttribute('aria-disabled', 'true')
	else table.removeAttribute('aria-disabled')
}

/** `aria-sort` for a header cell: only the primary sort column carries it (ARIA: one at a time). */
export function headerSortAttr<T>(ctx: GridHost<T>, field: string): string {
	const primary = ctx[GRID_ENGINE].sort[0]
	if (!primary || primary.column !== field) return ''
	return ` aria-sort="${primary.direction === 'desc' ? 'descending' : 'ascending'}"`
}

/** The row-level ARIA attributes of a data row. */
export function dataRowAttrs<T>(ctx: GridHost<T>, item: T, rowIndex: number): string {
	const e = ctx[GRID_ENGINE]
	let attrs = ` role="row" aria-rowindex="${dataRowAriaIndex(ctx, rowIndex)}" aria-selected="${e.isRowSelected(rowIndex)}"`
	const info = e.getRowTreeInfo(item)
	if (info) {
		attrs += ` aria-level="${info.level + 1}"`
		if (info.hasChildren) attrs += ` aria-expanded="${e.isPathExpanded(info.path)}"`
	}
	return attrs
}

/** Whether body cells carry `aria-selected` (a cell range / column can be selected). */
export function isCellSelectable<T>(ctx: GridHost<T>): boolean {
	return ctx[GRID_ENGINE].cellSelectionMode !== 'none'
}

/**
 * Mirror the selection classes onto `aria-selected` after a surgical selection
 * update (one that toggles the classes without re-rendering the rows).
 */
export function reconcileSelectedAria(ctx: { shadow: ParentNode, [GRID_ENGINE]: { cellSelectionMode: string } }): void {
	ctx.shadow.querySelectorAll<HTMLElement>('tbody tr.wg__row').forEach(row => {
		row.setAttribute('aria-selected', String(row.classList.contains('wg__row--selected')))
	})
	if (ctx[GRID_ENGINE].cellSelectionMode === 'none') return
	ctx.shadow.querySelectorAll<HTMLElement>('tbody td.wg__cell[data-col]').forEach(cell => {
		const isSelected = cell.classList.contains('wg__cell--in-range') || cell.classList.contains('wg__cell--column-selected')
		cell.setAttribute('aria-selected', String(isSelected))
	})
}

// =============================================================================
// Widget cells — interactive controls inside body cells (ARIA grid pattern)
// =============================================================================
// The grid is ONE tab stop (roving tabindex on the cells, navigation/focus.ts
// syncTabStop). Controls inside body cells are never tab stops of their own
// (`tabindex="-1"`): the row-actions trigger (actions column), the inline row
// actions (`toolbarPosition: 'inline'`), and whatever a `renderCellCallback`
// renders (links, buttons, inputs — rendering/cell-widgets.ts `untabCellWidgets()` takes them out of the
// tab order and marks them `data-wg-widget`). The keyboard reaches them the
// ARIA way:
//
//  - the lead widget cells (`.wg__widget-cell`: inline actions, actions column)
//    are navigable cells: ArrowLeft from a row's first data cell enters them,
//    ArrowRight leaves to the first data cell, ArrowUp / ArrowDown move to the
//    same cell of the next / previous row, Home / End = first lead cell / last
//    data cell of the row;
//  - Enter / F2 on a cell holding widgets moves focus into its first widget
//    (a data cell only when it isn't editable — there F2 / Enter keep editing /
//    moving down);
//  - in a widget, Tab / Shift+Tab cycle the cell's widgets, Escape returns focus
//    to the cell; every other key is the widget's own (Enter / Space activate).
//
// Mouse behaviour is unchanged: the controls are still clicked directly.

import type { GridHost } from '../grid-context.js'
import { moveFocus, focusCellTd, syncTabStop } from './focus.js'
import { prepareRowReveal, revealElement, fieldAt } from '../scroll/reveal.js'
import { GRID_ENGINE } from '../grid-context.js'
export { untabCellWidgets } from '../rendering/cell-widgets.js'

/** The widgets of a cell, in DOM order: the grid's row-action buttons + controls a cell renderer made. */
const WIDGET_SELECTOR = '.wg__inline-action-btn:not([disabled]), .wg__toolbar-trigger:not([disabled]), [data-wg-widget]:not([disabled])'

function cellWidgets(cell: HTMLElement): HTMLElement[] {
	return [...cell.querySelectorAll<HTMLElement>(WIDGET_SELECTOR)]
}

function hasModifier(e: KeyboardEvent): boolean {
	return e.ctrlKey || e.metaKey || e.altKey
}

/** The row's lead widget cells (inline actions, actions column), in DOM order. */
function leadCells(row: HTMLElement): HTMLElement[] {
	return [...row.querySelectorAll<HTMLElement>(':scope > td.wg__widget-cell')]
}

/** The row's first / last data cell (DOM order = visual order). */
function edgeDataCell(row: HTMLElement, edge: 'first' | 'last'): HTMLElement | null {
	const cells = row.querySelectorAll<HTMLElement>(':scope > td.wg__cell[data-col]')
	return cells[edge === 'first' ? 0 : cells.length - 1] ?? null
}

/** Focus a lead widget cell: it becomes the tab stop, the grid scrolls it into view. */
function focusWidgetCell<T>(ctx: GridHost<T>, cell: HTMLElement): void {
	cell.focus({ preventScroll: true })
	syncTabStop(ctx, cell)
	const rowIndex = Number(cell.dataset.widgetRow)
	const first = cell.closest('tr') ? edgeDataCell(cell.closest('tr') as HTMLElement, 'first') : null
	revealElement(ctx, cell, { rowIndex, field: fieldAt(ctx, Number(first?.dataset.col ?? 0)) }, 'keyboard')
}

/** Move to a data cell of the row (the grid's own focus path: state, visual, tab stop, scroll). */
function focusDataCell<T>(ctx: GridHost<T>, cell: HTMLElement | null): void {
	if (!cell) return
	moveFocus(ctx, Number(cell.dataset.row), Number(cell.dataset.col))
}

/** ArrowUp / ArrowDown on a lead widget cell: the same lead cell of the next / previous row. */
function moveVertically<T>(ctx: GridHost<T>, cell: HTMLElement, delta: number): void {
	const rowIndex = Number(cell.dataset.widgetRow) + delta
	if (rowIndex < 0 || rowIndex >= ctx[GRID_ENGINE].displayItems.length) return
	const kind = cell.classList.contains('wg__actions-column') ? 'wg__actions-column' : 'wg__inline-actions-cell'
	const row = cell.closest('tr') as HTMLElement | null
	const firstCol = Number((row && edgeDataCell(row, 'first'))?.dataset.col ?? 0)
	// Virtual scroll: render the target row's window first
	prepareRowReveal(ctx, { rowIndex, field: fieldAt(ctx, firstCol) }, 'keyboard')
	const target = ctx.shadow.querySelector(`td.${kind}[data-widget-row="${rowIndex}"]`) as HTMLElement | null
	if (target) focusWidgetCell(ctx, target)
}

/** Keys while a widget inside a cell has focus. Returns true when the key is the widget's / handled. */
function handleWidgetKey<T>(ctx: GridHost<T>, e: KeyboardEvent, widget: HTMLElement, cell: HTMLElement): boolean {
	const widgets = cellWidgets(cell)
	const index = widgets.indexOf(widget)
	if (index === -1) return false
	if (e.key === 'Tab' && !hasModifier(e)) {
		// Tab / Shift+Tab cycle the widgets inside the cell
		e.preventDefault()
		e.stopPropagation()
		const next = widgets[(index + (e.shiftKey ? -1 : 1) + widgets.length) % widgets.length]
		next.focus({ preventScroll: true })
		return true
	}
	if (e.key === 'Escape' && !hasModifier(e)) {
		// Escape: back to the cell
		e.preventDefault()
		e.stopPropagation()
		if (cell.classList.contains('wg__widget-cell')) focusWidgetCell(ctx, cell)
		else focusCellTd(cell)
		return true
	}
	// Every other key is the widget's own (Enter / Space activate a button, a text field types)
	return true
}

/** Keys on a lead widget cell (inline actions / actions column) itself. */
function handleLeadCellKey<T>(ctx: GridHost<T>, e: KeyboardEvent, cell: HTMLElement): boolean {
	const row = cell.closest('tr') as HTMLElement | null
	if (!row) return false
	const leads = leadCells(row)
	const index = leads.indexOf(cell)
	const isPlain = !hasModifier(e) && !e.shiftKey
	switch (e.key) {
		case 'Enter':
		case 'F2': {
			if (!isPlain) return false
			const first = cellWidgets(cell)[0]
			e.preventDefault()
			first?.focus({ preventScroll: true })
			return true
		}
		case 'ArrowRight':
			e.preventDefault()
			if (index < leads.length - 1) focusWidgetCell(ctx, leads[index + 1])
			else focusDataCell(ctx, edgeDataCell(row, 'first'))
			return true
		case 'ArrowLeft':
			e.preventDefault()
			if (index > 0) focusWidgetCell(ctx, leads[index - 1])
			return true
		case 'ArrowUp':
		case 'ArrowDown':
			e.preventDefault()
			moveVertically(ctx, cell, e.key === 'ArrowUp' ? -1 : 1)
			return true
		case 'Home':
			e.preventDefault()
			if (leads[0] && leads[0] !== cell) focusWidgetCell(ctx, leads[0])
			return true
		case 'End':
			e.preventDefault()
			focusDataCell(ctx, edgeDataCell(row, 'last'))
			return true
		case 'PageUp':
		case 'PageDown':
			e.preventDefault()
			return true
		case 'Tab':
			// The browser's: the grid is one tab stop (this cell is it now) — Tab leaves the grid
			return true
	}
	return false
}

/**
 * Widget-cell keys — runs first in the table keydown router. Returns true when the key was
 * handled here (the router stops).
 */
export function handleWidgetCellKeyDown<T>(ctx: GridHost<T>, e: KeyboardEvent): boolean {
	const target = e.target as HTMLElement
	const cell = target.closest('td.wg__cell') as HTMLElement | null
	if (!cell) return false

	// Focus on a widget inside a cell
	if (target !== cell) return handleWidgetKey(ctx, e, target, cell)

	// A lead widget cell
	if (cell.classList.contains('wg__widget-cell')) return handleLeadCellKey(ctx, e, cell)

	// A data cell (not editing)
	if (!cell.hasAttribute('data-col') || ctx[GRID_ENGINE].editingCell) return false
	const isPlain = !hasModifier(e) && !e.shiftKey
	if (!isPlain) return false
	const row = cell.closest('tr') as HTMLElement | null
	if (e.key === 'ArrowLeft' && row && edgeDataCell(row, 'first') === cell) {
		// The row's first data cell: ArrowLeft enters the lead widget cells
		const leads = leadCells(row)
		const last = leads[leads.length - 1]
		if (!last) return false
		e.preventDefault()
		focusWidgetCell(ctx, last)
		return true
	}
	if (e.key === 'Enter' || e.key === 'F2') {
		// A cell holding widgets (renderCellCallback controls): into the first one — unless the
		// cell is editable, where F2 / Enter keep editing / moving down
		const widgets = cellWidgets(cell)
		if (widgets.length === 0) return false
		const column = ctx[GRID_ENGINE].columns[Number(cell.dataset.col)]
		if (column && ctx[GRID_ENGINE].canEditCell(Number(cell.dataset.row), String(column.field))) return false
		e.preventDefault()
		widgets[0].focus({ preventScroll: true })
		return true
	}
	return false
}

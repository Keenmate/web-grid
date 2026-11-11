// =============================================================================
// GridController — the public facade (`el.controller`)
// =============================================================================
// The object every callback ctx and event detail carries as `controller`.
// Delegates to the live element / engine; never exposes the engine itself.

import type { GridController } from './types.js'
import type { GridElement } from './web-component.js'
import { closeGridMenu } from './modules/contextmenu/index.js'
import { closeToolbarAndReset } from './modules/toolbar/index.js'

export function createGridController<T>(el: GridElement<T>): GridController<T> {
	// Apply pending input writes first (core flush) so `el.x = …; controller.…` sees them.
	const g = () => { el.flush(); return el.engine }
	return {
		// data
		get items() { return g().items },
		get displayItems() { return g().displayItems },
		get columns() { return g().columns },
		get sort() { return g().sort },
		get filters() { return g().filters },
		setFilter: (field, value, options) => g().setFilter(field, value, options),
		// rows
		insertRow: (row, afterRow) => g().insertRow(row, afterRow),
		insertRows: (rows, afterRow) => g().insertRows(rows, afterRow),
		removeRow: (row) => g().removeRow(row),
		removeRows: (rows) => g().removeRows(rows),
		duplicateRow: (row) => g().duplicateRow(row),
		moveRow: (row, delta) => g().moveRow(row, delta),
		getRowId: (row) => g().getRowId(row),
		getRowById: (id) => g().getRowById(id),
		getRowIndex: (row) => g().getRowIndex(row),
		updateRowById: (id, newData) => g().updateRowById(id, newData),
		replaceRowById: (id, newRow) => g().replaceRowById(id, newRow),
		// drafts / validation
		getRowDraft: (rowIndex) => g().getRowDraft(rowIndex),
		hasRowDraft: (rowIndex) => g().hasRowDraft(rowIndex),
		getDraftRowIndices: () => g().getDraftRowIndices(),
		getDrafts: () => g().getDrafts(),
		discardDraft: (row) => g().discardDraft(row),
		discardAllDrafts: () => g().discardAllDrafts(),
		isCellDirty: (rowIndex, field) => g().isCellDirty(rowIndex, field),
		isRowDirty: (rowIndex) => g().isRowDirty(rowIndex),
		isCellInvalid: (rowIndex, field) => g().isCellInvalid(rowIndex, field),
		getCellValidationError: (rowIndex, field) => g().getCellValidationError(rowIndex, field),
		get invalidCells() { return g().invalidCells },
		canEditCell: (rowIndex, field) => g().canEditCell(rowIndex, field),
		// row locking
		isRowLocked: (rowOrId) => g().isRowLocked(rowOrId),
		getRowLockInfo: (rowOrId) => g().getRowLockInfo(rowOrId),
		lockRowById: (id, lockerInfo) => g().lockRowById(id, lockerInfo),
		unlockRowById: (id) => g().unlockRowById(id),
		getExternalLocks: () => g().getExternalLocks(),
		clearExternalLocks: () => g().clearExternalLocks(),
		// row selection
		selectRow: (rowIndex, mode) => g().selectRow(rowIndex, mode),
		selectRowRange: (fromIndex, toIndex) => g().selectRowRange(fromIndex, toIndex),
		clearSelection: () => g().clearSelection(),
		clearRowSelection: () => g().clearRowSelection(),
		isRowSelected: (rowIndex) => g().isRowSelected(rowIndex),
		get selectedRows() { return g().selectedRows },
		get selectedRowIndices() { return g().selectedRowIndices },
		copySelectedRowsToClipboard: () => g().copySelectedRowsToClipboard(),
		// cell / column selection
		selectCellRange: (range) => g().selectCellRange(range),
		clearCellSelection: () => g().clearCellSelection(),
		get selectedCellRange() { return g().selectedCellRange },
		getSelectedCells: () => g().getSelectedCells(),
		copyCellSelectionToClipboard: () => g().copyCellSelectionToClipboard(),
		selectColumn: (colIndex, mode) => g().selectColumn(colIndex, mode),
		selectColumnRange: (fromIndex, toIndex) => g().selectColumnRange(fromIndex, toIndex),
		clearColumnSelection: () => g().clearColumnSelection(),
		getSelectedColumns: () => g().getSelectedColumns(),
		isColumnSelected: (colIndex) => g().isColumnSelected(colIndex),
		copySelectedColumnsToClipboard: () => g().copySelectedColumnsToClipboard(),
		selectAll: () => g().selectAll(),
		// tree
		isPathExpanded: (path) => g().isPathExpanded(path),
		get expandedPaths() { return g().expandedPaths },
		toggleRowExpanded: (path, options) => g().toggleRowExpanded(path, options),
		expandRows: (paths, options) => g().expandRows(paths, options),
		collapseRows: (paths, options) => g().collapseRows(paths, options),
		expandAll: (paths, options) => g().expandAll(paths, options),
		collapseAll: (paths, options) => g().collapseAll(paths, options),
		getRowTreeInfo: (row) => g().getRowTreeInfo(row),
		// columns
		setColumnWidth: (field, width) => g().setColumnWidth(field, width),
		setColumnWidths: (widths) => g().setColumnWidths(widths),
		getColumnWidthsState: () => g().getColumnWidthsState(),
		setColumnOrder: (order) => g().setColumnOrder(order),
		getColumnOrderState: () => g().getColumnOrderState(),
		// focus / editing
		focusCell: (rowIndex, colIndex) => el.focusCell(rowIndex, colIndex),
		startEditing: (rowIndex, colIndex) => el.startEditing(rowIndex, colIndex),
		scrollToRow: (rowIndex) => el.scrollToRow(rowIndex),
		// menus / toolbar
		closeContextMenu: () => closeGridMenu(el),
		closeToolbar: () => closeToolbarAndReset(el)
	}
}

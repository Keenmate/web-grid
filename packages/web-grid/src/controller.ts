// =============================================================================
// GridController — the public facade (`el.controller`)
// =============================================================================
// The object every callback ctx and event detail carries as `controller`.
// Delegates to the live element / engine; never exposes the engine itself.

import type { GridController } from './interaction.js'
import type { GridElement } from './web-component.js'
import { closeContextMenu } from './modules/contextmenu/index.js'
import { closeToolbarAndReset } from './modules/toolbar/index.js'

export function createGridController<T>(el: GridElement<T>): GridController<T> {
	// Apply pending input writes first (core flush) so `el.x = …; controller.…` sees them.
	const g = () => { el.flush(); return el.engine }
	return {
		// data
		getItems: () => g().items,
		getDisplayItems: () => g().displayItems,
		getColumns: () => g().columns,
		getSort: () => g().sort,
		getFilters: () => g().filters,
		setFilter: (field, value) => g().setFilter(field, value),
		// rows
		insertRow: (row, afterRow) => g().insertRow(row, afterRow),
		removeRows: (rows) => g().removeRows(rows),
		duplicateRow: (row) => g().duplicateRow(row),
		moveRow: (row, delta) => g().moveRow(row, delta),
		getRowId: (row) => g().getRowId(row),
		findRowById: (id) => g().findRowById(id),
		updateRowById: (id, newData) => g().updateRowById(id, newData),
		replaceRowById: (id, newRow) => g().replaceRowById(id, newRow),
		// drafts / validation
		getRowDraft: (rowIndex) => g().getRowDraft(rowIndex),
		hasRowDraft: (rowIndex) => g().hasRowDraft(rowIndex),
		discardRowDraft: (rowIndex) => g().discardRowDraft(rowIndex),
		getDraftRowIndices: () => g().getDraftRowIndices(),
		getDrafts: () => g().getDrafts(),
		discardDraft: (row) => g().discardDraft(row),
		discardAllDrafts: () => g().discardAllDrafts(),
		isCellDirty: (rowIndex, field) => g().isCellDirty(rowIndex, field),
		isRowDirty: (rowIndex) => g().isRowDirty(rowIndex),
		isCellInvalid: (rowIndex, field) => g().isCellInvalid(rowIndex, field),
		getCellValidationError: (rowIndex, field) => g().getCellValidationError(rowIndex, field),
		getInvalidCells: () => g().invalidCells,
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
		isRowSelected: (rowIndex) => g().isRowSelected(rowIndex),
		getSelectedRows: () => g().selectedRows,
		getSelectedRowsData: () => g().getSelectedRowsData(),
		copySelectedRowsToClipboard: () => g().copySelectedRowsToClipboard(),
		// cell / column selection
		selectCellRange: (range) => g().selectCellRange(range),
		clearCellSelection: () => g().clearCellSelection(),
		getSelectedCellRange: () => g().selectedCellRange,
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
		toggleExpandedPath: (path) => g().toggleExpandedPath(path),
		expandAll: () => g().expandAll(),
		collapseAll: () => g().collapseAll(),
		expandSubtree: (path) => g().expandSubtree(path),
		collapseSubtree: (path) => g().collapseSubtree(path),
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
		// menus / toolbar
		closeContextMenu: () => {
			if (el.contextMenuElement) {
				closeContextMenu(el.contextMenuElement)
				el.contextMenuElement = null
			}
			if (el.headerContextMenuElement) {
				closeContextMenu(el.headerContextMenuElement)
				el.headerContextMenuElement = null
			}
		},
		closeToolbar: () => closeToolbarAndReset(el)
	}
}

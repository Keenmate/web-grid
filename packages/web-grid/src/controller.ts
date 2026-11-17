// =============================================================================
// GridController — the public facade (`el.controller`)
// =============================================================================
// The object every callback ctx and event detail carries as `controller`: core
// createControllerFacade (SPEC §12.34) — a frozen object forwarding the listed
// methods / state to the live engine (pending input writes applied first, core
// flush, so `el.x = …; controller.…` sees them) plus the element-side UI calls.
// Never exposes the engine itself.

import { createControllerFacade } from '@keenmate/web-components-core'
import type { GridController } from './types.js'
import type { GridElement } from './web-component.js'
import { closeGridMenu } from './modules/contextmenu/index.js'
import { closeToolbarAndReset } from './modules/toolbar/index.js'

/** Engine methods the controller forwards. */
const ENGINE_METHODS = [
	'setFilter', 'insertRow', 'insertRows', 'removeRow', 'removeRows', 'duplicateRow',
	'moveRow', 'getRowId', 'getRowById', 'getRowIndex', 'updateRowById', 'replaceRowById',
	'getRowDraft', 'hasRowDraft', 'getDraftRowIndices', 'getDrafts', 'discardDraft', 'discardAllDrafts',
	'isCellDirty', 'isRowDirty', 'isCellInvalid', 'getCellValidationError', 'canEditCell', 'isRowLocked',
	'getRowLockInfo', 'lockRowById', 'unlockRowById', 'getExternalLocks', 'clearExternalLocks', 'selectRow',
	'selectRowRange', 'clearSelection', 'clearRowSelection', 'isRowSelected', 'copySelectedRowsToClipboard', 'selectCellRange',
	'clearCellSelection', 'getSelectedCells', 'copyCellSelectionToClipboard', 'selectColumn', 'selectColumnRange', 'clearColumnSelection',
	'getSelectedColumns', 'isColumnSelected', 'copySelectedColumnsToClipboard', 'selectAll', 'isPathExpanded', 'toggleRowExpanded',
	'expandRows', 'collapseRows', 'expandAll', 'collapseAll', 'getRowTreeInfo', 'setColumnWidth',
	'setColumnWidths', 'getColumnWidthsState', 'setColumnOrder', 'getColumnOrderState',
] as const

/** Engine state the controller reads live (read-only). */
const ENGINE_STATE = [
	'items', 'displayItems', 'columns', 'sort', 'filters', 'invalidCells',
	'selectedRows', 'selectedRowIndices', 'selectedCellRange', 'expandedPaths',
] as const

export function createGridController<T>(el: GridElement<T>): GridController<T> {
	const engine = createControllerFacade<object>(() => { el.flush(); return el.engine }, {
		methods: ENGINE_METHODS,
		state: Object.fromEntries(ENGINE_STATE.map(name => [name, null]))
	})
	// Element-side calls (focus, editing, scrolling, menus) go through the element, not the engine.
	const ui = createControllerFacade<object>({
		focusCell: (rowIndex: number, colIndex: number) => el.focusCell(rowIndex, colIndex),
		startEditing: (rowIndex: number, colIndex: number) => el.startEditing(rowIndex, colIndex),
		scrollToRow: (rowIndex: number) => el.scrollToRow(rowIndex),
		closeContextMenu: () => closeGridMenu(el),
		closeToolbar: () => closeToolbarAndReset(el)
	}, ['focusCell', 'startEditing', 'scrollToRow', 'closeContextMenu', 'closeToolbar'])
	return Object.freeze(Object.defineProperties({}, {
		...Object.getOwnPropertyDescriptors(engine),
		...Object.getOwnPropertyDescriptors(ui)
	})) as GridController<T>
}

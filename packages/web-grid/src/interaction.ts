// =============================================================================
// Interaction model — controller, contexts, action items, event details
// =============================================================================
//
// The public interaction model of `<web-grid>` (web-components-core `/actions`,
// SPEC §12.5 / §12.12). Types only.
//
// Every callback takes ONE `ctx`; every ctx and every event detail carries
// `controller` (the public {@link GridController}, also `el.controller`) and
// `element` (the host) — both non-enumerable, so `JSON.stringify` / logs see
// only the data.

import type { ComponentContext } from '@keenmate/web-components-core'
import type { ActionItem, MenuItem, MenuEntry, MenuDivider, ActionEventDetail } from '@keenmate/web-components-core/actions'
import type {
	Column,
	CellRange,
	CellValidationState,
	ColumnWidthState,
	ColumnOrderState,
	ColumnResizeDetail,
	ColumnReorderDetail,
	DataRequestDetail,
	GridLabels,
	PasteColumnMapping,
	PasteDetail,
	RowChangeDetail,
	FocusChangeDetail,
	RowLock,
	RowLockChangeDetail,
	ExpandOptions,
	SortState,
	CellSelectionChangeDetail,
	RowSelectionChangeDetail,
	ColumnSelectionChangeDetail,
	TreeExpandedChangeDetail,
	TreeRowExpandDetail,
	EditorOption
} from './types.js'

// =============================================================================
// Controller
// =============================================================================

/**
 * The public facade — `el.controller`, and `controller` on every callback ctx and
 * event detail. Delegates to the live grid.
 */
export interface GridController<T = any> {
	// data
	readonly items: T[]
	/** The rows as displayed (filtered, sorted, paginated, tree-collapsed). */
	readonly displayItems: T[]
	readonly columns: Column<T>[]
	readonly sort: SortState[]
	readonly filters: Record<string, string>
	setFilter(field: string, value: string): void
	// rows (the `add` / `delete` / `duplicate` / `move-up` / `move-down` built-ins use these)
	/** Insert `row` after `afterRow` (in `items` order), or at the end. */
	insertRow(row: T, afterRow?: T | null): void
	/** Insert `rows` (in order) after `afterRow` (in `items` order), or at the end. */
	insertRows(rows: T[], afterRow?: T | null): void
	/** Remove `row` from `items` (programmatic: no `row-delete`). */
	removeRow(row: T): void
	/** Remove the given rows from `items` (programmatic: no `row-delete`). */
	removeRows(rows: T[]): void
	/** Insert a copy of `row` after it (`createDuplicateRowCallback`, else a shallow copy with `idMember` cleared); returns it. */
	duplicateRow(row: T): T
	/** Move `row` one displayed position up (`-1`) or down (`1`). */
	moveRow(row: T, delta: -1 | 1): void
	getRowId(row: T): unknown | undefined
	/** The row with this ID (`idMember` / `getIdCallback`), or null. */
	getRowById(id: unknown): T | null
	/** The row's display index (the `rowIndex` of every ctx / event), or -1 when it isn't displayed. */
	getRowIndex(row: T): number
	updateRowById(id: unknown, newData: Partial<T>): boolean
	replaceRowById(id: unknown, newRow: T): boolean
	// drafts / validation
	getRowDraft(rowIndex: number): T | undefined
	hasRowDraft(rowIndex: number): boolean
	/** Display indices of the currently displayed rows that have a draft (drafts follow their row, see `idMember`). */
	getDraftRowIndices(): number[]
	/** Every draft — incl. rows on other pages / filtered out / not in `items` (drafts are never pruned). */
	getDrafts(): DraftInfo<T>[]
	/** Drop the draft (and invalid markers) of one row — the row object, its id-equal copy, or the draft. */
	discardDraft(row: T): void
	discardAllDrafts(): void
	isCellDirty(rowIndex: number, field: string): boolean
	isRowDirty(rowIndex: number): boolean
	isCellInvalid(rowIndex: number, field: string): boolean
	getCellValidationError(rowIndex: number, field: string): string | null
	readonly invalidCells: CellValidationState[]
	canEditCell(rowIndex: number, field: string): boolean
	// row locking
	isRowLocked(rowOrId: T | unknown): boolean
	getRowLockInfo(rowOrId: T | unknown): RowLock | null
	lockRowById(id: unknown, lockerInfo?: Partial<RowLock>): boolean
	unlockRowById(id: unknown): boolean
	getExternalLocks(): Map<unknown, RowLock>
	clearExternalLocks(): void
	// row selection
	selectRow(rowIndex: number, mode?: 'replace' | 'toggle' | 'range'): void
	selectRowRange(fromIndex: number, toIndex: number): void
	/** Clear every selection kind: rows, the cell range and columns. */
	clearSelection(): void
	/** Clear only the row selection. */
	clearRowSelection(): void
	isRowSelected(rowIndex: number): boolean
	/** The selected row objects, in display order. */
	readonly selectedRows: T[]
	/** Display indices of the selected rows, ascending. */
	readonly selectedRowIndices: number[]
	copySelectedRowsToClipboard(): Promise<boolean>
	// cell / column selection
	selectCellRange(range: CellRange): void
	clearCellSelection(): void
	readonly selectedCellRange: CellRange | null
	/** The selected range's cells (row by row, on-screen column order); `colIndex` = index in `columns`. */
	getSelectedCells(): CellContext<T>[]
	copyCellSelectionToClipboard(): Promise<boolean>
	/** `colIndex` = index in `columns` (not the on-screen position); `'range'` spans on screen from the last selected column. */
	selectColumn(colIndex: number, mode?: 'replace' | 'toggle' | 'range'): void
	/** Selects the on-screen span between two columns (indices in `columns`). */
	selectColumnRange(fromIndex: number, toIndex: number): void
	clearColumnSelection(): void
	/** The selected columns in on-screen order; `colIndex` = index in `columns` (same fields as a selected cell). */
	getSelectedColumns(): SelectedColumn<T>[]
	/** `colIndex` = index in `columns`. */
	isColumnSelected(colIndex: number): boolean
	copySelectedColumnsToClipboard(): Promise<boolean>
	selectAll(): void
	// tree
	isPathExpanded(path: string): boolean
	/** The expanded tree paths (a copy; assign `el.expandedPaths`). */
	readonly expandedPaths: string[]
	/** Expand / collapse one row (`row-expand` / `row-collapse` + `expanded-change`). */
	toggleRowExpanded(path: string, options?: ExpandOptions): void
	/** Expand the given rows one level (ancestors open too). */
	expandRows(paths: string | string[], options?: ExpandOptions): void
	/** Collapse the given rows. */
	collapseRows(paths: string | string[], options?: ExpandOptions): void
	/** Expand the whole tree (`null`) — or the given rows and every descendant. */
	expandAll(paths?: string | string[] | null, options?: ExpandOptions): void
	/** Collapse the whole tree (`null`) — or the given rows and every descendant. */
	collapseAll(paths?: string | string[] | null, options?: ExpandOptions): void
	getRowTreeInfo(row: T): { path: string; level: number; hasChildren: boolean } | null
	// columns
	setColumnWidth(field: string, width: string): void
	setColumnWidths(widths: ColumnWidthState[]): void
	getColumnWidthsState(): ColumnWidthState[]
	setColumnOrder(order: ColumnOrderState[]): void
	getColumnOrderState(): ColumnOrderState[]
	// focus / editing
	focusCell(rowIndex: number, colIndex: number): void
	startEditing(rowIndex: number, colIndex: number): void
	/** Scroll the displayed row into view; `false` when out of range / not rendered. */
	scrollToRow(rowIndex: number): Promise<boolean>
	// menus / toolbar
	closeContextMenu(): void
	closeToolbar(): void
}

// =============================================================================
// Contexts
// =============================================================================

/** Base of every callback ctx and event detail. */
export type GridContext<T = any> = ComponentContext<GridController<T>>

/** A row without a position — `getIdCallback`, `getIsRowEditableCallback`, `column.getIsEditableCallback`. */
export interface RowDataContext<T = any> extends GridContext<T> {
	row: T
}

/** A displayed row: toolbar items, `getRowClassCallback`, row locking, … */
export interface RowContext<T = any> extends RowDataContext<T> {
	/** Displayed index. */
	rowIndex: number
}

/** A cell: the cell context menu, row shortcuts, cell toolbars, and the column callbacks. */
export interface CellContext<T = any> extends RowContext<T> {
	column: Column<T>
	/** Index in `columns`. */
	colIndex: number
	field: string
	/** The cell's raw value (the pending draft value when the row has one). */
	value: unknown
}

/** A selected column (`getSelectedColumns()`) — the column fields of a `CellContext`. */
export interface SelectedColumn<T = any> {
	/** Index in `columns`. */
	colIndex: number
	field: string
	column: Column<T>
}

/** ctx of `column.filterCallback`. Runs before sorting / pagination, so there is no row index. */
export interface FilterContext<T = any> extends GridContext<T> {
	row: T
	column: Column<T>
	field: string
	/** What the user typed into the column's filter input. */
	filterValue: string
}

/** ctx of `column.validateCallback`. */
export interface ValidateContext<T = any> extends CellContext<T> {
	/** The candidate value (`value` is it too). */
	value: unknown
	oldValue: unknown
	/** `'edit'` for an editor commit, `'paste'` for a pasted cell. */
	source: 'edit' | 'paste'
}

/** ctx of `column.getPasteValueCallback`: the cell plus the pasted text. */
export interface PasteValueContext<T = any> extends CellContext<T> {
	/** The pasted text for this cell (before conversion). */
	text: string
}

/** ctx of `column.renderEditorCallback` (custom editor). */
export interface EditorContext<T = any> extends CellContext<T> {
	/** Commit `newValue` (runs `validateCallback`) and close the editor. */
	commit(newValue: unknown): void
	/** Close the editor without saving. */
	cancel(): void
}

/** ctx of `getValidationTooltipCallback` (grid and column level). */
export interface ValidationTooltipContext<T = any> extends CellContext<T> {
	error: string
}

/** ctx of `rowLocking.getCanEditLockedCallback`: the row + its lock. */
export interface RowLockContext<T = any> extends RowContext<T> {
	lockInfo: RowLock
}

/** ctx of the editor-option callbacks (`editorOptions.getValueCallback`, …). */
export interface OptionContext<T = any> extends GridContext<T> {
	option: EditorOption
}

/** ctx of `editorOptions.renderOptionCallback`. */
export interface OptionRenderContext<T = any> extends OptionContext<T> {
	/** Position in the option list. */
	optionIndex: number
	/** The keyboard / mouse cursor is on this option. */
	isFocused: boolean
	isSelected: boolean
	isDisabled: boolean
}

/** ctx of `editorOptions.searchCallback` (autocomplete). */
export interface OptionSearchContext<T = any> extends CellContext<T> {
	/** What the user typed. */
	term: string
	/** Aborted when a newer search starts. */
	signal: AbortSignal
}

/** ctx of `editorOptions.onSelect`. */
export interface OptionSelectContext<T = any> extends CellContext<T> {
	option: EditorOption
}

/** The selected rows / cell range a range shortcut acts on. */
export interface RangeContext<T = any> extends GridContext<T> {
	/** Selected rows, in display order. */
	rows: T[]
	/** Selected row indices, ascending. */
	rowIndices: number[]
	/** The cell range, when cells (not rows) are selected. */
	cellRange?: CellRange
	cells?: Array<{ row: T; rowIndex: number; colIndex: number; field: string; value: unknown }>
}

/** ctx of the header context menu (`headerContextMenu` items, `beforeHeaderMenuOpenCallback`). */
export interface HeaderMenuContext<T = any> extends GridContext<T> {
	/** The column; `null` on the filler area right of the last column. */
	column: Column<T> | null
	/** `''` on the filler. */
	field: string
	/** Index in `columns`; `-1` on the filler. */
	colIndex: number
	sortDirection: 'asc' | 'desc' | null
	isFrozen: boolean
	/** True when the grid has `pathMember` set (the tree column can't be hidden). */
	isTreeMode: boolean
	/** All columns, hidden ones included. */
	allColumns: Column<T>[]
	labels: GridLabels
}

/** ctx of `beforeFillCallback` (fill handle). */
export interface FillContext<T = any> extends GridContext<T> {
	sourceCell: { rowIndex: number; colIndex: number; field: string; value: unknown }
	targetCells: Array<{ rowIndex: number; colIndex: number; field: string }>
	direction: 'up' | 'down' | 'left' | 'right'
}

/** ctx of `beforePasteCallback` (multi-cell paste). Return `false` to cancel the paste. */
export interface BeforePasteContext<T = any> extends GridContext<T> {
	rawText: string
	/** TSV parsed into a 2D array. */
	parsedRows: string[][]
	hasHeaders: boolean
	headerMapping: PasteColumnMapping[] | null
	targetRowIndex: number
	targetColIndex: number
	/** Rows the paste will append. */
	newRowsCount: number
	/** Add `"rowIndex-colIndex"` keys to skip those cells. */
	skipCells: Set<string>
}

/** ctx of `createRowCallback` (a paste needs a new row). */
export interface CreateRowContext<T = any> extends GridContext<T> {
	/** The pasted values by field. */
	data: Record<string, unknown>
	/** Index the new row will take in `items`. */
	rowIndex: number
}

/** ctx of `getPaginationLabelsCallback`. */
export interface PaginationLabelsContext<T = any> extends GridContext<T> {
	currentPage: number
	totalPages: number
	totalItems: number
	pageSize: number
}

/** What swapped the rows — `beforePageChangeCallback` ctx `trigger`. */
export type PageChangeTrigger = 'page' | 'page-size' | 'sort' | 'filter'

/**
 * ctx of `beforePageChangeCallback` — a user action is about to swap the displayed rows
 * (pager button, page-size change, header sort / filter-row change in server mode).
 * Return `false` to stay, a page number to go there instead; may be async (the pager is
 * disabled while it is pending).
 */
export interface BeforePageChangeContext<T = any> extends GridContext<T> {
	trigger: PageChangeTrigger
	fromPage: number
	/** The page the action leads to (1 for page-size / sort / filter changes). */
	toPage: number
	/** Every unsaved draft (`getDrafts()`) — e.g. force "save before leaving the page". */
	drafts: DraftInfo<T>[]
}

/** One unsaved draft — `getDrafts()`, `ctx.drafts` of the summary / `beforePageChangeCallback`. */
export interface DraftInfo<T = any> {
	/** The row: the current `items` row with that identity, else the row the draft was made from. */
	row: T
	/** The draft copy (what the user sees). */
	draftRow: T
	/** Fields whose draft value differs from `row`. */
	changedFields: string[]
	/** False while a cell of the draft is invalid. */
	isValid: boolean
}

/** ctx of `renderSummaryCallback`. */
export interface SummaryContext<T = any> extends GridContext<T> {
	/** Displayed (paginated) rows. */
	items: T[]
	/** All rows, before pagination. */
	allItems: T[]
	totalItems: number
	currentPage: number
	pageSize: number
	/** `summaryMetadata` (server-provided aggregates, …). */
	metadata: unknown
	/**
	 * Every unsaved draft (`getDrafts()`) — incl. rows on other pages / filtered out /
	 * not in `items`. Adjust server aggregates (`metadata`) by the draft deltas.
	 */
	drafts: DraftInfo<T>[]
}

/** ctx of `renderChevronCallback`. */
export interface ChevronContext<T = any> extends GridContext<T> {
	row: T
	isExpanded: boolean
	/** False on a leaf. */
	hasChildren: boolean
	/** Depth, 0-based. */
	level: number
	path: string
}

// =============================================================================
// Action items
// =============================================================================

/** Row built-ins — row toolbar, cell toolbar, cell context menu, row shortcuts. */
export type GridRowAction = 'add' | 'delete' | 'duplicate' | 'move-up' | 'move-down'

/** Tree built-ins of the cell context menu. */
export type GridTreeAction = 'expand' | 'collapse' | 'expand-subtree' | 'collapse-subtree' | 'expand-all' | 'collapse-all'

/** Built-ins of the cell context menu. */
export type GridCellAction = GridRowAction | GridTreeAction

/** Built-ins of the header context menu. */
export type GridHeaderAction =
	| 'sort-asc'
	| 'sort-desc'
	| 'clear-sort'
	| 'hide-column'
	| 'freeze-column'
	| 'unfreeze-column'
	| 'column-visibility'
	| 'show-all-columns'
	| 'toggle-column'

export type GridAction = GridCellAction | GridHeaderAction

/**
 * A row-toolbar button (floating, inline or cell toolbar). Icon buttons: `text` is
 * the accessible name and the tooltip heading, shown as a label only when the item
 * has no `icon` or sets `isTextVisible`. `tooltip` is the description line under the
 * heading, `shortcut` the key line (also taken from a `rowShortcuts` entry with the
 * same `id`).
 */
export interface GridToolbarItem<T = any> extends ActionItem<RowContext<T>, GridRowAction> {
	/** Toolbar row, 1 = closest to the grid row. Default 1. */
	row?: number
	/** Show `text` next to the icon. */
	isTextVisible?: boolean
}

/** One `rowToolbar` entry: a built-in name, an item, or a divider. */
export type GridToolbarEntry<T = any> = GridRowAction | GridToolbarItem<T> | MenuDivider

/** A cell-context-menu item. */
export type GridMenuItem<T = any> = MenuItem<CellContext<T>, GridCellAction>

/** One `contextMenu` entry: a built-in name, an item, or a divider. */
export type GridMenuEntry<T = any> = GridCellAction | MenuEntry<CellContext<T>, GridCellAction>

/** A header-context-menu item. */
export type GridHeaderMenuItem<T = any> = MenuItem<HeaderMenuContext<T>, GridHeaderAction>

/** One `headerContextMenu` entry: a built-in name, an item, or a divider. */
export type GridHeaderMenuEntry<T = any> = GridHeaderAction | MenuEntry<HeaderMenuContext<T>, GridHeaderAction>

/**
 * A keyboard shortcut on the focused / hovered row. An action item bound to
 * `shortcut` (`'Ctrl+D'`, `'Delete'`, `'F3'`): fires the `action` event with
 * `source: 'keyboard'`; `action` may name a row built-in.
 */
export interface GridShortcut<T = any> extends ActionItem<CellContext<T>, GridRowAction> {
	/** The key chord. */
	shortcut: string
}

/** A shortcut on the selected rows / cell range. Custom only (`onClick` / the `action` event). */
export interface GridRangeShortcut<T = any> extends ActionItem<RangeContext<T>, never> {
	shortcut: string
}

// =============================================================================
// Event details
// =============================================================================

/** The surface fields an `action` detail may carry, depending on `source`. */
export type GridActionContext<T = any> = GridContext<T> &
	Partial<Omit<CellContext<T>, keyof GridContext<T>>> &
	Partial<Omit<HeaderMenuContext<T>, keyof GridContext<T> | 'column' | 'field' | 'colIndex'>> &
	Partial<Omit<RangeContext<T>, keyof GridContext<T>>>

/**
 * Detail of the `action` event (+ `onAction`, each item's `onClick`,
 * `beforeActionCallback`). `source`: `'row-toolbar' | 'cell-toolbar' |
 * 'context-menu' | 'header-menu' | 'keyboard'`. Row surfaces carry `row` /
 * `rowIndex` (+ `column` / `colIndex` / `field` / `value` for cell ones), the
 * header menu its {@link HeaderMenuContext} fields, range shortcuts `rows` /
 * `rowIndices`.
 */
export type GridActionEventDetail<T = any> = ActionEventDetail<GridActionContext<T>, GridAction>

export type RowChangeEventDetail<T = any> = RowChangeDetail<T> & GridContext<T>

export interface EditEventDetail<T = any> extends GridContext<T> {
	row: T
	rowIndex: number
	field: string
}

export interface ValidationErrorEventDetail<T = any> extends EditEventDetail<T> {
	error: string
	source: 'edit' | 'paste'
}

export type FocusChangeEventDetail<T = any> = FocusChangeDetail<T> & GridContext<T>

/** `row-delete`: the `delete` built-in removed rows (menu / toolbar / Ctrl+Delete) — after the fact. */
export interface RowDeleteEventDetail<T = any> extends GridContext<T> {
	/** The removed rows. */
	rows: T[]
	/** Their display indices before the removal. */
	rowIndices: number[]
}

/** `range` columns are on-screen positions; `fields` / `rows` name what the range covers. */
export type CellSelectionChangeEventDetail<T = any> = CellSelectionChangeDetail<T> & GridContext<T>
export type RowSelectionChangeEventDetail<T = any> = RowSelectionChangeDetail<T> & GridContext<T>
export type ColumnSelectionChangeEventDetail<T = any> = ColumnSelectionChangeDetail & GridContext<T>
export type DataRequestEventDetail<T = any> = DataRequestDetail & GridContext<T>

export interface FilterChangeEventDetail<T = any> extends GridContext<T> {
	/** Current filter value per field. */
	filters: Record<string, string>
}

export type ColumnResizeEventDetail<T = any> = ColumnResizeDetail & GridContext<T>
export type ColumnReorderEventDetail<T = any> = ColumnReorderDetail & GridContext<T>
export type ExpandedChangeEventDetail<T = any> = TreeExpandedChangeDetail & GridContext<T>
export type RowExpandEventDetail<T = any> = TreeRowExpandDetail<T> & GridContext<T>
export type RowLockChangeEventDetail<T = any> = RowLockChangeDetail<T> & GridContext<T>
export type CellPasteEventDetail<T = any> = PasteDetail<T> & GridContext<T>

/** Event name → detail. */
export type GridEventMap<T = any> = {
	'row-change': RowChangeEventDetail<T>
	'cell-edit-start': EditEventDetail<T>
	'cell-edit-cancel': EditEventDetail<T>
	'validation-error': ValidationErrorEventDetail<T>
	'focus-change': FocusChangeEventDetail<T>
	'row-delete': RowDeleteEventDetail<T>
	'cell-selection-change': CellSelectionChangeEventDetail<T>
	'row-selection-change': RowSelectionChangeEventDetail<T>
	'column-selection-change': ColumnSelectionChangeEventDetail<T>
	'data-request': DataRequestEventDetail<T>
	'filter-change': FilterChangeEventDetail<T>
	'column-resize': ColumnResizeEventDetail<T>
	'column-reorder': ColumnReorderEventDetail<T>
	'row-expand': RowExpandEventDetail<T>
	'row-collapse': RowExpandEventDetail<T>
	'expanded-change': ExpandedChangeEventDetail<T>
	'row-lock-change': RowLockChangeEventDetail<T>
	'cell-paste': CellPasteEventDetail<T>
	'action': GridActionEventDetail<T>
}

export type GridEventName = keyof GridEventMap

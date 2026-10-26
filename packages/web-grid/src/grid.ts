// =============================================================================
// GridEngine - Core Grid Logic Class
// =============================================================================

import type {
	Column,
	CellValidationState,
	EditTrigger,
	EditStartSelection,
	EditingCell,
	FocusedCell,
	SortDirection,
	SortMode,
	SortState,
	DataRequestDetail,
	DataRequestTrigger,
	ValidateResult,
	GridMode,
	ToggleVisibility,
	PaginationLabelsCallback,
	SummaryCallback,
	ToolbarPosition,
	GridLabels,
	GridLabelsInput,
	RowLock,
	RowLockingOptions,
	ColumnWidthState,
	ColumnOrderState,
	FillDirection,
	GridPersistenceState,
	CellSelectionMode,
	CellRange,
	PasteMode,
	CreateRowCallback,
	NewRowPosition,
	ChevronCallback,
	TreeDoubleClickBehavior
} from './types.js'
import type {
	GridController,
	GridContext,
	RowContext,
	RowDataContext,
	CellContext,
	ValidateContext,
	ValidationTooltipContext,
	FillContext,
	BeforePasteContext,
	GridToolbarEntry,
	GridMenuEntry,
	GridHeaderMenuEntry,
	GridShortcut,
	GridRangeShortcut,
	GridActionEventDetail,
	GridEventMap,
	GridEventName
} from './interaction.js'

// Internal tree index — built from items when treePathMember is set
type TreeNode = {
	path: string
	parent: string | null
	level: number
	rowIndex: number
	childPaths: string[]
}
type TreeIndex = {
	separator: string
	nodes: Map<string, TreeNode>
	rootPaths: string[]
}

// Date formatting utilities for auto-formatting date columns
import { parseFormat, formatDate } from './modules/datepicker/index.js'
import { bindOptionContext } from './modules/dropdown/options.js'

// Logging
import { initLogger, dataLogger, interactionLogger, perfLogger } from './logger.js'

// Perf instrumentation (temporary — investigating tree-toggle slowness)
import { gridPerf } from './perf.js'

// Default labels (English)
const DEFAULT_LABELS: GridLabels = {
	// Toolbar
	rowActions: 'Row actions',
	inlineActionsHeader: 'Actions',

	// Shortcuts help
	keyboardShortcuts: 'Keyboard shortcuts',
	rangeShortcuts: 'Selection shortcuts',

	// Pagination
	paginationFirst: '⏮',
	paginationPrevious: '◀',
	paginationNext: '▶',
	paginationLast: '⏭',
	paginationPageInfo: 'Page {current} of {total}',
	paginationItemCount: '{count} items',
	paginationPerPage: 'per page',

	// Dropdown
	dropdownNoOptions: 'No options',
	dropdownSearching: 'Searching...',

	// Row locking
	rowLocked: 'This row is locked',
	rowLockedBy: 'Locked by {lockedBy}',

	// Go-to-row dialog
	goToRow: 'Go to row (1-{max}):',
	goToRowGo: 'Go',
	goToRowCancel: 'Cancel',

	// Tree chevron
	treeExpand: 'Expand',
	treeCollapse: 'Collapse',

	// Built-in row / tree actions
	actions: {
		add: 'Add row',
		delete: 'Delete row',
		duplicate: 'Duplicate row',
		moveUp: 'Move up',
		moveDown: 'Move down',
		expandAll: 'Expand all',
		collapseAll: 'Collapse all',
		expandTree: 'Expand entire tree',
		collapseTree: 'Collapse entire tree'
	},

	// Header context menu
	contextMenu: {
		sortAsc: 'Sort Ascending',
		sortDesc: 'Sort Descending',
		clearSort: 'Clear Sort',
		hideColumn: 'Hide Column',
		freezeColumn: 'Freeze Column',
		unfreezeColumn: 'Unfreeze Column',
		columnVisibility: 'Column Visibility',
		showAll: 'Show all'
	}
}

/** The settings a `mode` also sets (a preset). Shared by the engine's `mode`
 * setter and the element's `mode` input (`getBatchValuesCallback`). */
export const MODE_PRESETS: Record<GridMode, {
	isEditable?: boolean
	editTrigger?: EditTrigger
	dropdownToggleVisibility?: ToggleVisibility
	shouldShowDropdownOnFocus?: boolean
	cellSelectionMode?: CellSelectionMode
}> = {
	// No editing, click to select cells
	'read-only': { isEditable: false, dropdownToggleVisibility: 'on-focus', cellSelectionMode: 'click' },
	// Excel-like: click+drag to select
	'excel': { isEditable: true, editTrigger: 'navigate', dropdownToggleVisibility: 'always', shouldShowDropdownOnFocus: false, cellSelectionMode: 'click' },
	// Avoid conflict with always-editing cells
	'input-matrix': { isEditable: true, editTrigger: 'always', dropdownToggleVisibility: 'always', shouldShowDropdownOnFocus: true, cellSelectionMode: 'shift' },
}

/**
 * GridEngine - Core logic class for the data grid
 *
 * This class contains all the state management and business logic.
 * GridElement extends this to add DOM rendering and web component lifecycle.
 */
export class GridEngine<T = unknown> {
	// ==========================================================================
	// Configuration Props
	// ==========================================================================

	protected _items: T[] = []
	protected _columns: Column<T>[] = []
	protected _sortMode: SortMode = "none"
	protected _isFilterable: boolean = false
	protected _isPageable: boolean = false
	protected _pageSize: number = 10
	protected _pageSizes: number[] = [10, 25, 50, 100]
	protected _paginationMode: 'client' | 'server' = 'client'
	protected _isStriped: boolean = true
	protected _isHoverable: boolean = true
	protected _isEditable: boolean = false
	protected _isRowEditable: boolean | undefined = undefined
	protected _getIsRowEditableCallback: ((ctx: RowDataContext<T>) => boolean) | undefined = undefined
	protected _editTrigger: EditTrigger = "dblclick"
	protected _editStartSelection: EditStartSelection = "mousePosition"
	protected _shouldCommitOnClickAway: boolean = true
	protected _mode: GridMode = "excel"
	protected _dropdownToggleVisibility: ToggleVisibility = "always"
	protected _shouldShowDropdownOnFocus: boolean = true
	protected _shouldOpenDropdownOnEnter: boolean = false
	protected _isCheckboxAlwaysEditable: boolean = false
	protected _isRowNumbersVisible: boolean = false
	protected _isStickyRowNumbers: boolean = false
	protected _freezeColumns: number = 0
	protected _invalidCells: CellValidationState[] = []
	protected _isDirtyIndicatorVisible: boolean = true
	protected _isRowToolbarVisible: boolean = false
	protected _rowToolbar: GridToolbarEntry<T>[] = ['add', 'delete', 'duplicate']
	protected _toolbarVerticalAlign: 'top' | 'center' | 'bottom' = 'bottom'
	protected _toolbarHorizontalAlign: 'start' | 'center' | 'end' | 'cursor' = 'center'
	protected _toolbarTrigger: 'hover' | 'click' | 'button' = 'hover'
	protected _toolbarPosition: ToolbarPosition = 'auto'
	protected _toolbarColumn: string | number | undefined = undefined
	protected _shouldToolbarFollowCursor: boolean = false
	protected _getCellToolbarItemsCallback: ((ctx: CellContext<T>) => GridToolbarEntry<T>[] | null | undefined) | undefined = undefined
	protected _cellToolbarOffset: number | string = 0.2
	protected _toolbarBtnMinWidth: string | undefined = undefined
	protected _inlineActionsTitle: string | null | undefined = undefined
	protected _contextMenu: GridMenuEntry<T>[] | undefined = undefined
	protected _contextMenuXOffset: number = 8
	protected _contextMenuYOffset: number = 0
	protected _headerContextMenu: GridHeaderMenuEntry<T>[] | undefined = undefined
	protected _rowShortcuts: GridShortcut<T>[] | undefined = undefined
	protected _isShortcutsHelpVisible: boolean = false
	protected _shortcutsHelpPosition: 'top-right' | 'top-left' = 'top-right'
	protected _renderShortcutsHelpCallback: ((ctx: GridContext<T>) => string) | undefined = undefined

	// Row identification (the member is `_idMember`, below)
	protected _getIdCallback: ((ctx: RowDataContext<T>) => unknown) | undefined = undefined

	// Row locking
	protected _rowLocking: RowLockingOptions<T> | undefined = undefined
	protected _externalLocks: Map<unknown, RowLock> = new Map()

	// Column resize & persistence
	protected _gridName: string | null = null
	protected _shouldPersistColumnWidths: boolean = false
	protected _columnWidths: Map<string, string> = new Map()  // Runtime width overrides

	// Column reorder & persistence
	protected _isColumnReorderAllowed: boolean = false
	protected _shouldPersistColumnOrder: boolean = false
	protected _columnOrder: Map<string, number> = new Map()  // Runtime order overrides

	// Fill handle
	protected _fillDirection: FillDirection = 'vertical'
	protected _beforeFillCallback: ((ctx: FillContext<T>) => boolean | void | Promise<boolean | void>) | undefined = undefined

	// ==========================================================================
	// Callbacks
	// ==========================================================================

	protected _getValidationTooltipCallback: ((ctx: ValidationTooltipContext<T>) => string | null) | undefined
	protected _beforeContextMenuOpenCallback: ((ctx: CellContext<T>) => false | GridMenuEntry<T>[] | void) | undefined
	protected _beforeHeaderMenuOpenCallback: ((ctx: import('./interaction.js').HeaderMenuContext<T>) => false | GridHeaderMenuEntry<T>[] | void) | undefined
	protected _beforeActionCallback: ((detail: GridActionEventDetail<T>) => unknown) | undefined

	// ==========================================================================
	// Internal State
	// ==========================================================================

	// Sorting (multi-column)
	protected _sort: SortState[] = []

	// Filtering
	protected _filters: Record<string, string> = {}
	protected _filterMode: 'client' | 'server' = 'client'
	protected _columnMinWidth: string | undefined = undefined

	// Pagination
	protected _currentPage: number = 1
	protected _totalItems: number | null = null  // null = use items.length (client-side)
	protected _isPaginationVisible: boolean | 'auto' = true
	protected _paginationPosition: string = 'bottom-center'
	protected _getPaginationLabelsCallback?: PaginationLabelsCallback<T>
	protected _paginationLayout: string = 'pageSize|previous|pageInfo|next'

	// Summary
	protected _summaryPosition?: string
	protected _renderSummaryCallback?: SummaryCallback<T>
	protected _summaryMetadata: unknown = undefined
	protected _isSummaryInline: boolean = true

	// Custom styles
	protected _getCustomStylesCallback?: (ctx: GridContext<T>) => string
	protected _getRowClassCallback?: (ctx: RowContext<T>) => string | null

	// Labels/i18n
	protected _labels: GridLabels = { ...DEFAULT_LABELS }

	// Scroll behavior
	protected _isScrollable: boolean = false
	protected _scrollMaxHeight: string = '100vh'
	protected _isTableBorderOnly: boolean = false

	// Virtual scroll
	protected _isVirtualScrollEnabled: boolean = false
	protected _virtualScrollThreshold: number = 100
	protected _virtualScrollRowHeight: number = 38
	protected _virtualScrollBuffer: number = 10

	// Infinite scroll
	protected _isInfiniteScrollEnabled: boolean = false
	protected _infiniteScrollThreshold: number = 100
	protected _hasMoreItems: boolean = true
	protected _isLoadingMore: boolean = false

	// Editing
	protected _editingCell: EditingCell = null
	protected _currentCellError: string | null = null
	protected _isValidating: boolean = false
	/** Drafts keyed by row identity (see `draftKey`) — they follow their row through sort / page / filter. */
	protected _draftRows: Map<unknown, T> = new Map()
	/** loadPersistedState() ran before any columns existed — retried when `columns` is set. */
	protected _isPersistedStateLoadPending = false

	// Navigation
	protected _focusedCell: FocusedCell = null
	protected _isCommittingFromKeyboard: boolean = false
	protected _skipNextDropdownAutoEdit: boolean = false
	protected _tabTraversalStartColIndex: number | null = null

	// Interaction state (centralized tracking for hover, focus, edit)
	protected _hoveredRowIndex: number | null = null
	protected _focusedRowIndex: number | null = null
	protected _onInteractionChange: ((type: 'hoveredRow' | 'focusedCell' | 'editingCell' | 'focusedRow', detail: { prev: any, current: any }) => void) | null = null

	// Row selection state
	protected _selectedRows: Set<number> = new Set()
	protected _lastSelectedRowIndex: number | null = null  // For Shift+Click range selection
	protected _rangeShortcuts: GridRangeShortcut<T>[] = []

	// Cell range selection state
	protected _cellSelectionMode: CellSelectionMode = 'click'
	protected _selectedCellRange: CellRange | null = null
	protected _lastClickedCell: { rowIndex: number, colIndex: number } | null = null
	protected _shouldCopyWithHeaders: boolean = false

	// Column selection state (like row selection, supports non-contiguous)
	protected _selectedColumns: Set<number> = new Set()
	protected _lastSelectedColumnIndex: number = -1

	// Paste configuration
	protected _pasteMode: PasteMode = 'skip-non-editable'
	protected _shouldValidateOnPaste: boolean = true
	protected _createRowCallback: CreateRowCallback<T> | undefined = undefined
	protected _beforePasteCallback: ((ctx: BeforePasteContext<T>) => boolean | void | Promise<boolean | void>) | undefined = undefined

	// New empty row (inline data entry) — EXPERIMENTAL: API may change
	protected _isNewRowEnabled: boolean = false
	protected _newRowPosition: NewRowPosition = 'bottom'
	protected _newRowIndicator: string = '+'
	protected _createEmptyRowCallback: ((ctx: GridContext<T>) => T | Promise<T>) | undefined = undefined
	protected _createDuplicateRowCallback: ((ctx: RowContext<T>) => T) | undefined = undefined
	protected _emptyRowDraft: T | null = null  // Tracks edits to empty row before commit

	// Tree / hierarchy state
	protected _treePathMember: string | null = null
	protected _treeLevelMember: string | null = null
	protected _treeParentMember: string | null = null
	protected _idMember: string | null = 'id'
	protected _hasWarnedAboutMissingRowId: boolean = false
	protected _treeSeparator: string | null = null  // null = auto-detect
	protected _treeDataSorted: boolean = false
	protected _expandedPaths: Set<string> = new Set()       // Active set used for visibility checks
	protected _expandedPathsExternal: Set<string> | null = null  // Set provided by user (we mutate it directly)
	protected _defaultExpandDepth: number | null = null
	protected _treeIndex: TreeIndex | null = null            // Built from items; null when tree mode off
	protected _treeDoubleClickBehavior: TreeDoubleClickBehavior = 'none'
	// Chevron customization
	protected _treeExpandedGlyph: string = '▶'
	protected _treeCollapsedGlyph: string = '▶'
	protected _renderChevronCallback: ChevronCallback<T> | undefined = undefined
	// WeakMap<row, Map<state-key, html>>; cleared when callback or items change
	protected _treeChevronCache: WeakMap<object, Map<string, string>> = new WeakMap()

	// Memoized data-pipeline output. Invalidated by invalidateDisplayCache(),
	// which is called from the requestUpdate() override on every state change.
	// The pipeline (filter → sort → tree-visible → paginate) used to re-run on
	// every getter access; tree-mode renders touch displayItems hundreds of
	// times per pass, so the un-cached cost was ~600ms for a 678-row tree.
	protected _paginatedItemsCache: T[] | null = null
	protected _displayItemsCache: T[] | null = null

	// ==========================================================================
	// Component context + notifications
	// ==========================================================================

	// Prototype of every ctx / detail the engine builds: `controller` and `element`
	// as getters, so they are inherited (non-enumerable — JSON / logs see only the
	// data) and an object costs one allocation on the per-cell hot paths.
	protected _ctxProto: object = {}
	protected _notifier: (<K extends GridEventName>(name: K, detail: object) => void) | null = null

	/**
	 * Wire the component context: every ctx / event detail gets `controller` +
	 * `element`, and notifications go to `notify` (the element's `emit`). A
	 * standalone engine runs without it (no events, ctx without the context).
	 */
	attachHost(element: HTMLElement, getController: () => GridController<T>, notify: <K extends GridEventName>(name: K, detail: object) => void): void {
		this._ctxProto = Object.create(null, {
			controller: { get: getController, enumerable: false },
			element: { value: element, enumerable: false }
		})
		this._notifier = notify
	}

	/** A callback ctx: `fields` + the component context. */
	ctx<F extends object>(fields: F): F & GridContext<T> {
		return Object.assign(Object.create(this._ctxProto), fields)
	}

	/** ctx for a displayed row. */
	rowCtx(row: T, rowIndex: number): RowContext<T> {
		return this.ctx({ row, rowIndex })
	}

	/** ctx for a cell (`value` is the raw, draft-aware value). */
	cellCtx(row: T, rowIndex: number, column: Column<T>, colIndex: number = this._columns.indexOf(column)): CellContext<T> {
		const field = String(column.field)
		return this.ctx({ row, rowIndex, column, colIndex, field, value: this.getCellRawValue(row, rowIndex, field) })
	}

	/** Report a happening: the element emits it (DOM event + `on*` twin). */
	notify<K extends GridEventName>(name: K, detail: Omit<GridEventMap<T>[K], 'controller' | 'element'>): void {
		this._notifier?.(name, detail as object)
	}

	// ==========================================================================
	// Public API - Getters/Setters
	// ==========================================================================

	get items(): T[] { return this._items }
	set items(value: T[]) {
		dataLogger.debug('items set:', value.length, 'rows')
		this._items = value
		this.invalidateDisplayCache()
		this._treeChevronCache = new WeakMap()  // rows replaced → drop cached glyphs
		this.rebuildTreeState()
		this.requestUpdate()
	}

	get columns(): Column<T>[] { return this._columns }
	set columns(value: Column<T>[]) {
		initLogger.debug('columns set:', value.length, 'columns', value.map(c => String(c.field)))
		this._columns = value
		// Option callbacks (editorOptions.get*Callback, …) get this grid's ctx
		for (const col of value) {
			if (col.editorOptions) bindOptionContext(col.editorOptions, (fields) => this.ctx(fields))
		}
		// A persisted-state load requested before any columns existed runs now
		if (this._isPersistedStateLoadPending && value.length > 0) this.loadPersistedState()
		this.requestUpdate()
	}

	get sortMode(): SortMode { return this._sortMode }
	set sortMode(value: SortMode) {
		this._sortMode = value
		this.requestUpdate()
	}

	get isFilterable(): boolean { return this._isFilterable }
	set isFilterable(value: boolean) {
		this._isFilterable = value
		this.requestUpdate()
	}

	/** 'server': the grid doesn't filter `items` — it fires `filter-change` and the consumer replaces `items`. */
	get filterMode(): 'client' | 'server' { return this._filterMode }
	set filterMode(value: 'client' | 'server') {
		this._filterMode = value === 'server' ? 'server' : 'client'
		this.requestUpdate()
	}

	get columnMinWidth(): string | undefined { return this._columnMinWidth }
	set columnMinWidth(value: string | undefined) {
		this._columnMinWidth = value || undefined
		this.requestUpdate()
	}

	get isPageable(): boolean { return this._isPageable }
	set isPageable(value: boolean) {
		this._isPageable = value
		this.requestUpdate()
	}

	get pageSize(): number { return this._pageSize }
	set pageSize(value: number) {
		this._pageSize = value
		this.requestUpdate()
	}

	get pageSizes(): number[] { return this._pageSizes }
	set pageSizes(value: number[]) {
		this._pageSizes = value
		this.requestUpdate()
	}

	get paginationMode(): 'client' | 'server' { return this._paginationMode }
	set paginationMode(value: 'client' | 'server') {
		this._paginationMode = value
		this.requestUpdate()
	}

	get isStriped(): boolean { return this._isStriped }
	set isStriped(value: boolean) {
		this._isStriped = value
		this.requestUpdate()
	}

	get isHoverable(): boolean { return this._isHoverable }
	set isHoverable(value: boolean) {
		this._isHoverable = value
		this.requestUpdate()
	}

	get isEditable(): boolean { return this._isEditable }
	set isEditable(value: boolean) {
		this._isEditable = value
		this.checkEditTriggerConflicts()
		this.maybeWarnAboutRowIdentity()
		this.requestUpdate()
	}

	get isRowEditable(): boolean | undefined { return this._isRowEditable }
	set isRowEditable(value: boolean | undefined) {
		this._isRowEditable = value
		this.requestUpdate()
	}

	get getIsRowEditableCallback(): ((ctx: RowDataContext<T>) => boolean) | undefined { return this._getIsRowEditableCallback }
	set getIsRowEditableCallback(value: ((ctx: RowDataContext<T>) => boolean) | undefined) {
		this._getIsRowEditableCallback = value
		this.requestUpdate()
	}

	get editTrigger(): EditTrigger { return this._editTrigger }
	set editTrigger(value: EditTrigger) {
		this._editTrigger = value
		this.checkSelectionConflicts()
		this.checkEditTriggerConflicts()
		this.requestUpdate()
	}

	get editStartSelection(): EditStartSelection { return this._editStartSelection }
	set editStartSelection(value: EditStartSelection) {
		this._editStartSelection = value
	}

	get shouldCommitOnClickAway(): boolean { return this._shouldCommitOnClickAway }
	set shouldCommitOnClickAway(value: boolean) {
		this._shouldCommitOnClickAway = value
	}

	get mode(): GridMode { return this._mode }
	set mode(value: GridMode) {
		this._mode = value
		this.applyModeDefaults()
		this.checkEditTriggerConflicts()
		this.requestUpdate()
	}

	get dropdownToggleVisibility(): ToggleVisibility { return this._dropdownToggleVisibility }
	set dropdownToggleVisibility(value: ToggleVisibility) {
		this._dropdownToggleVisibility = value
		this.requestUpdate()
	}

	/**
	 * Get effective toggle visibility for a column (column override or grid default)
	 */
	getEffectiveToggleVisibility(column: Column<T>): ToggleVisibility {
		return column.dropdownToggleVisibility ?? this._dropdownToggleVisibility
	}

	get shouldShowDropdownOnFocus(): boolean { return this._shouldShowDropdownOnFocus }
	set shouldShowDropdownOnFocus(value: boolean) {
		this._shouldShowDropdownOnFocus = value
	}

	get shouldOpenDropdownOnEnter(): boolean { return this._shouldOpenDropdownOnEnter }
	set shouldOpenDropdownOnEnter(value: boolean) {
		this._shouldOpenDropdownOnEnter = value
	}

	/**
	 * Get effective shouldOpenDropdownOnEnter for a column (column override or grid default)
	 */
	getEffectiveShouldOpenDropdownOnEnter(column: Column<T>): boolean {
		return column.shouldOpenDropdownOnEnter ?? this._shouldOpenDropdownOnEnter
	}

	get isCheckboxAlwaysEditable(): boolean { return this._isCheckboxAlwaysEditable }
	set isCheckboxAlwaysEditable(value: boolean) {
		this._isCheckboxAlwaysEditable = value
		this.requestUpdate()
	}

	get isRowNumbersVisible(): boolean { return this._isRowNumbersVisible }
	set isRowNumbersVisible(value: boolean) {
		this._isRowNumbersVisible = value
		this.requestUpdate()
	}

	get isDirtyIndicatorVisible(): boolean { return this._isDirtyIndicatorVisible }
	set isDirtyIndicatorVisible(value: boolean) {
		this._isDirtyIndicatorVisible = value
		this.requestUpdate()
	}

	get isStickyRowNumbers(): boolean { return this._isStickyRowNumbers }
	set isStickyRowNumbers(value: boolean) {
		this._isStickyRowNumbers = value
		this.requestUpdate()
	}

	get freezeColumns(): number { return this._freezeColumns }
	set freezeColumns(value: number) {
		this._freezeColumns = Math.max(0, Math.floor(value))
		this.requestUpdate()
	}

	/**
	 * Get columns in visual display order.
	 * Columns with frozen: true appear first, followed by non-frozen columns.
	 * Original column indices are preserved for data access.
	 */
	get visualColumns(): Array<{ column: Column<T>; originalIndex: number }> {
		const frozenCols: Array<{ column: Column<T>; originalIndex: number }> = []
		const normalCols: Array<{ column: Column<T>; originalIndex: number }> = []

		// First, separate explicitly frozen columns (column.isFrozen = true)
		// Skip hidden columns entirely
		const explicitlyFrozenCount = this._columns.filter(c => c.isFrozen && !c.isHidden).length

		this._columns.forEach((column, index) => {
			// Skip hidden columns
			if (column.isHidden) return

			const entry = { column, originalIndex: index }
			if (column.isFrozen) {
				// Explicitly frozen columns go first
				frozenCols.push(entry)
			} else {
				normalCols.push(entry)
			}
		})

		// Now handle freezeColumns - these freeze the first N non-explicitly-frozen columns
		// They should stay at the front of normalCols and NOT be reorderable
		const positionalFrozenCols: Array<{ column: Column<T>; originalIndex: number }> = []
		const reorderableCols: Array<{ column: Column<T>; originalIndex: number }> = []

		normalCols.forEach((entry, idx) => {
			if (idx < this._freezeColumns) {
				// This column is frozen by position (freezeColumns prop)
				positionalFrozenCols.push(entry)
			} else {
				reorderableCols.push(entry)
			}
		})

		// Apply custom order only to reorderable (non-frozen) columns
		if (this._columnOrder.size > 0) {
			reorderableCols.sort((a, b) => {
				const fieldA = String(a.column.field)
				const fieldB = String(b.column.field)
				const orderA = this._columnOrder.get(fieldA) ?? a.originalIndex
				const orderB = this._columnOrder.get(fieldB) ?? b.originalIndex
				return orderA - orderB
			})
		}

		return [...frozenCols, ...positionalFrozenCols, ...reorderableCols]
	}

	/**
	 * Get the total number of frozen columns (from frozen: true + freezeColumns prop).
	 */
	get totalFrozenColumns(): number {
		const explicitlyFrozen = this._columns.filter(c => c.isFrozen).length
		return explicitlyFrozen + this._freezeColumns
	}

	/**
	 * Check if a column at visual index should be frozen.
	 */
	isColumnFrozen(visualIndex: number): boolean {
		return visualIndex < this.totalFrozenColumns
	}

	get invalidCells(): CellValidationState[] { return this._invalidCells }
	set invalidCells(value: CellValidationState[]) {
		this._invalidCells = value
		this.requestUpdate()
	}

	get editingCell(): EditingCell { return this._editingCell }
	get isValidating(): boolean { return this._isValidating }
	get currentCellError(): string | null { return this._currentCellError }
	get hoveredRowIndex(): number | null { return this._hoveredRowIndex }

	get isRowToolbarVisible(): boolean { return this._isRowToolbarVisible }
	set isRowToolbarVisible(value: boolean) {
		this._isRowToolbarVisible = value
		this.requestUpdate()
	}

	get rowToolbar(): GridToolbarEntry<T>[] { return this._rowToolbar }
	set rowToolbar(value: GridToolbarEntry<T>[]) {
		this._rowToolbar = value
		this.requestUpdate()
	}

	get toolbarVerticalAlign(): 'top' | 'center' | 'bottom' { return this._toolbarVerticalAlign }
	set toolbarVerticalAlign(value: 'top' | 'center' | 'bottom') {
		this._toolbarVerticalAlign = value
		this.checkToolbarConflicts()
		this.requestUpdate()
	}

	get toolbarHorizontalAlign(): 'start' | 'center' | 'end' | 'cursor' { return this._toolbarHorizontalAlign }
	set toolbarHorizontalAlign(value: 'start' | 'center' | 'end' | 'cursor') {
		this._toolbarHorizontalAlign = value
		this.checkToolbarConflicts()
		this.requestUpdate()
	}

	// Deprecated aliases
	get toolbarAlign(): 'top' | 'center' | 'bottom' { return this._toolbarVerticalAlign }
	set toolbarAlign(value: 'top' | 'center' | 'bottom') { this.toolbarVerticalAlign = value }

	get toolbarTopPosition(): 'start' | 'center' | 'end' | 'cursor' { return this._toolbarHorizontalAlign }
	set toolbarTopPosition(value: 'start' | 'center' | 'end' | 'cursor') { this.toolbarHorizontalAlign = value }

	get toolbarTrigger(): 'hover' | 'click' | 'button' { return this._toolbarTrigger }
	set toolbarTrigger(value: 'hover' | 'click' | 'button') {
		this._toolbarTrigger = value
		this.requestUpdate()
	}

	get toolbarPosition(): ToolbarPosition { return this._toolbarPosition }
	set toolbarPosition(value: ToolbarPosition) {
		this._toolbarPosition = value
		this.checkToolbarConflicts()
		this.requestUpdate()
	}

	get toolbarColumn(): string | number | undefined { return this._toolbarColumn }
	set toolbarColumn(value: string | number | undefined) {
		this._toolbarColumn = value
		this.checkToolbarConflicts()
	}

	get shouldToolbarFollowCursor(): boolean { return this._shouldToolbarFollowCursor }
	set shouldToolbarFollowCursor(value: boolean) {
		this._shouldToolbarFollowCursor = value
		this.checkToolbarConflicts()
	}

	/** @deprecated use `shouldToolbarFollowCursor` */
	get toolbarFollowsCursor(): boolean { return this._shouldToolbarFollowCursor }
	/** @deprecated use `shouldToolbarFollowCursor` */
	set toolbarFollowsCursor(value: boolean) { this.shouldToolbarFollowCursor = value }

	get getCellToolbarItemsCallback(): ((ctx: CellContext<T>) => GridToolbarEntry<T>[] | null | undefined) | undefined {
		return this._getCellToolbarItemsCallback
	}
	set getCellToolbarItemsCallback(value: ((ctx: CellContext<T>) => GridToolbarEntry<T>[] | null | undefined) | undefined) {
		this._getCellToolbarItemsCallback = value
		this.checkToolbarConflicts()
	}

	get cellToolbarOffset(): number | string { return this._cellToolbarOffset }
	set cellToolbarOffset(value: number | string) {
		if (typeof value === 'number') {
			this._cellToolbarOffset = Math.max(0, Math.min(1, value))
		} else {
			this._cellToolbarOffset = value
		}
	}

	get toolbarBtnMinWidth(): string | undefined { return this._toolbarBtnMinWidth }
	set toolbarBtnMinWidth(value: string | undefined) {
		this._toolbarBtnMinWidth = value
	}

	get inlineActionsTitle(): string | null | undefined { return this._inlineActionsTitle }
	set inlineActionsTitle(value: string | null | undefined) {
		this._inlineActionsTitle = value
		this.requestUpdate()
	}

	get contextMenu(): GridMenuEntry<T>[] | undefined { return this._contextMenu }
	set contextMenu(value: GridMenuEntry<T>[] | undefined) {
		this._contextMenu = value
		this.requestUpdate()
	}

	get contextMenuXOffset(): number { return this._contextMenuXOffset }
	set contextMenuXOffset(value: number) {
		this._contextMenuXOffset = value
	}

	get contextMenuYOffset(): number { return this._contextMenuYOffset }
	set contextMenuYOffset(value: number) {
		this._contextMenuYOffset = value
	}

	// Header context menu
	get headerContextMenu(): GridHeaderMenuEntry<T>[] | undefined { return this._headerContextMenu }
	set headerContextMenu(value: GridHeaderMenuEntry<T>[] | undefined) {
		this._headerContextMenu = value
	}

	// Row keyboard shortcuts
	get rowShortcuts(): GridShortcut<T>[] | undefined { return this._rowShortcuts }
	set rowShortcuts(value: GridShortcut<T>[] | undefined) {
		this._rowShortcuts = value
		this.requestUpdate()
	}

	get isShortcutsHelpVisible(): boolean { return this._isShortcutsHelpVisible }
	set isShortcutsHelpVisible(value: boolean) {
		this._isShortcutsHelpVisible = value
		this.requestUpdate()
	}

	get shortcutsHelpPosition(): 'top-right' | 'top-left' { return this._shortcutsHelpPosition }
	set shortcutsHelpPosition(value: 'top-right' | 'top-left') {
		this._shortcutsHelpPosition = value
		this.requestUpdate()
	}

	get renderShortcutsHelpCallback(): ((ctx: GridContext<T>) => string) | undefined { return this._renderShortcutsHelpCallback }
	set renderShortcutsHelpCallback(value: ((ctx: GridContext<T>) => string) | undefined) {
		this._renderShortcutsHelpCallback = value
		this.requestUpdate()
	}

	// Sorting (multi-column)
	get sort(): SortState[] { return this._sort }
	set sort(value: SortState[]) {
		dataLogger.debug('sort changed:', value.map(s => `${s.column} ${s.direction}`).join(', ') || 'none')
		this._sort = value
		this.requestUpdate()
	}

	// Pagination
	get currentPage(): number { return this._currentPage }
	set currentPage(value: number) {
		dataLogger.debug('page changed:', value)
		this._currentPage = value
		this.requestUpdate()
	}

	get totalItems(): number | null { return this._totalItems }
	set totalItems(value: number | null) {
		this._totalItems = value
		this.requestUpdate()
	}

	get isPaginationVisible(): boolean | 'auto' { return this._isPaginationVisible }
	set isPaginationVisible(value: boolean | 'auto') {
		this._isPaginationVisible = value
		this.requestUpdate()
	}

	/** @deprecated use `isPaginationVisible` */
	get showPagination(): boolean | 'auto' { return this._isPaginationVisible }
	/** @deprecated use `isPaginationVisible` */
	set showPagination(value: boolean | 'auto') { this.isPaginationVisible = value }

	get paginationPosition(): string { return this._paginationPosition }
	set paginationPosition(value: string) {
		this._paginationPosition = value
		this.requestUpdate()
	}

	get getPaginationLabelsCallback(): PaginationLabelsCallback<T> | undefined { return this._getPaginationLabelsCallback }
	set getPaginationLabelsCallback(value: PaginationLabelsCallback<T> | undefined) {
		this._getPaginationLabelsCallback = value
		this.requestUpdate()
	}

	get paginationLayout(): string { return this._paginationLayout }
	set paginationLayout(value: string) {
		this._paginationLayout = value
		this.requestUpdate()
	}

	get summaryPosition(): string | undefined { return this._summaryPosition }
	set summaryPosition(value: string | undefined) {
		this._summaryPosition = value
		this.requestUpdate()
	}

	get renderSummaryCallback(): SummaryCallback<T> | undefined { return this._renderSummaryCallback }
	set renderSummaryCallback(value: SummaryCallback<T> | undefined) {
		this._renderSummaryCallback = value
		this.requestUpdate()
	}

	get summaryMetadata(): unknown { return this._summaryMetadata }
	set summaryMetadata(value: unknown) {
		this._summaryMetadata = value
		this.requestUpdate()
	}

	get isSummaryInline(): boolean { return this._isSummaryInline }
	set isSummaryInline(value: boolean) {
		this._isSummaryInline = value
		this.requestUpdate()
	}

	get getCustomStylesCallback(): ((ctx: GridContext<T>) => string) | undefined { return this._getCustomStylesCallback }
	set getCustomStylesCallback(value: ((ctx: GridContext<T>) => string) | undefined) {
		this._getCustomStylesCallback = value
		// Note: requestUpdate not needed - styles are handled by web-component
	}

	get getRowClassCallback(): ((ctx: RowContext<T>) => string | null) | undefined { return this._getRowClassCallback }
	set getRowClassCallback(value: ((ctx: RowContext<T>) => string | null) | undefined) {
		this._getRowClassCallback = value
		this.requestUpdate()
	}

	// Labels/i18n - merge with defaults so partial updates work
	get labels(): GridLabels { return this._labels }
	/** Tooltip text for a locked row (`labels.rowLockedBy` / `labels.rowLocked`). */
	getLockTooltip(lockInfo: RowLock | null | undefined): string {
		return lockInfo?.lockedBy
			? this._labels.rowLockedBy.replace('{lockedBy}', String(lockInfo.lockedBy))
			: this._labels.rowLocked
	}

	set labels(value: GridLabelsInput) {
		// The nested groups merge too — a partial `actions` / `contextMenu` keeps the other texts
		this._labels = {
			...DEFAULT_LABELS,
			...value,
			actions: { ...DEFAULT_LABELS.actions, ...value?.actions },
			contextMenu: { ...DEFAULT_LABELS.contextMenu, ...value?.contextMenu }
		}
		this.requestUpdate()
	}

	// Scroll behavior
	get isScrollable(): boolean { return this._isScrollable }
	set isScrollable(value: boolean) {
		this._isScrollable = value
		this.requestUpdate()
	}

	get scrollMaxHeight(): string { return this._scrollMaxHeight }
	set scrollMaxHeight(value: string) {
		this._scrollMaxHeight = value
		this.requestUpdate()
	}

	get isTableBorderOnly(): boolean { return this._isTableBorderOnly }
	set isTableBorderOnly(value: boolean) {
		this._isTableBorderOnly = value
		this.requestUpdate()
	}

	/** @deprecated use `isTableBorderOnly` */
	get tableBorderOnly(): boolean { return this._isTableBorderOnly }
	/** @deprecated use `isTableBorderOnly` */
	set tableBorderOnly(value: boolean) { this.isTableBorderOnly = value }

	// Virtual scroll
	get isVirtualScrollEnabled(): boolean { return this._isVirtualScrollEnabled }
	set isVirtualScrollEnabled(value: boolean) {
		this._isVirtualScrollEnabled = value
		this.requestUpdate()
	}

	get virtualScrollThreshold(): number { return this._virtualScrollThreshold }
	set virtualScrollThreshold(value: number) {
		this._virtualScrollThreshold = value
		this.requestUpdate()
	}

	get virtualScrollRowHeight(): number { return this._virtualScrollRowHeight }
	set virtualScrollRowHeight(value: number) {
		this._virtualScrollRowHeight = value
		this.requestUpdate()
	}

	get virtualScrollBuffer(): number { return this._virtualScrollBuffer }
	set virtualScrollBuffer(value: number) {
		this._virtualScrollBuffer = value
		this.requestUpdate()
	}

	// Infinite scroll
	get isInfiniteScrollEnabled(): boolean { return this._isInfiniteScrollEnabled }
	set isInfiniteScrollEnabled(value: boolean) {
		this._isInfiniteScrollEnabled = value
		this.requestUpdate()
	}

	get infiniteScrollThreshold(): number { return this._infiniteScrollThreshold }
	set infiniteScrollThreshold(value: number) { this._infiniteScrollThreshold = value }

	get hasMoreItems(): boolean { return this._hasMoreItems }
	set hasMoreItems(value: boolean) { this._hasMoreItems = value }

	get isLoadingMore(): boolean { return this._isLoadingMore }
	set isLoadingMore(value: boolean) { this._isLoadingMore = value }

	/**
	 * Check if virtual scroll should be used
	 */
	shouldUseVirtualScroll(): boolean {
		if (this._isVirtualScrollEnabled === false) return false
		if (this._isVirtualScrollEnabled === true) return true
		// Auto-enable based on threshold
		return this.displayItems.length >= this._virtualScrollThreshold
	}

	get getValidationTooltipCallback(): ((ctx: ValidationTooltipContext<T>) => string | null) | undefined {
		return this._getValidationTooltipCallback
	}
	set getValidationTooltipCallback(value: ((ctx: ValidationTooltipContext<T>) => string | null) | undefined) {
		this._getValidationTooltipCallback = value
	}

	get beforeContextMenuOpenCallback(): ((ctx: CellContext<T>) => false | GridMenuEntry<T>[] | void) | undefined {
		return this._beforeContextMenuOpenCallback
	}
	set beforeContextMenuOpenCallback(value: ((ctx: CellContext<T>) => false | GridMenuEntry<T>[] | void) | undefined) {
		this._beforeContextMenuOpenCallback = value
	}

	get beforeHeaderMenuOpenCallback(): ((ctx: import('./interaction.js').HeaderMenuContext<T>) => false | GridHeaderMenuEntry<T>[] | void) | undefined {
		return this._beforeHeaderMenuOpenCallback
	}
	set beforeHeaderMenuOpenCallback(value: ((ctx: import('./interaction.js').HeaderMenuContext<T>) => false | GridHeaderMenuEntry<T>[] | void) | undefined) {
		this._beforeHeaderMenuOpenCallback = value
	}

	get beforeActionCallback(): ((detail: GridActionEventDetail<T>) => unknown) | undefined {
		return this._beforeActionCallback
	}
	set beforeActionCallback(value: ((detail: GridActionEventDetail<T>) => unknown) | undefined) {
		this._beforeActionCallback = value
	}

	// Row identification — `getIdCallback` is the computed twin of `idMember`
	get getIdCallback(): ((ctx: RowDataContext<T>) => unknown) | undefined { return this._getIdCallback }
	set getIdCallback(value: ((ctx: RowDataContext<T>) => unknown) | undefined) {
		this._getIdCallback = value
	}

	// Row locking
	get rowLocking(): RowLockingOptions<T> | undefined { return this._rowLocking }
	set rowLocking(value: RowLockingOptions<T> | undefined) {
		this._rowLocking = value
		this.requestUpdate()
	}

	// Column resize & persistence
	get gridName(): string | null { return this._gridName }
	set gridName(value: string | null) {
		this._gridName = value
	}

	get shouldPersistColumnWidths(): boolean { return this._shouldPersistColumnWidths }
	set shouldPersistColumnWidths(value: boolean) {
		this._shouldPersistColumnWidths = value
	}

	// Column reorder & persistence
	get isColumnReorderAllowed(): boolean { return this._isColumnReorderAllowed }
	set isColumnReorderAllowed(value: boolean) {
		this._isColumnReorderAllowed = value
	}

	get shouldPersistColumnOrder(): boolean { return this._shouldPersistColumnOrder }
	set shouldPersistColumnOrder(value: boolean) {
		this._shouldPersistColumnOrder = value
	}

	// Fill handle
	get fillDirection(): FillDirection { return this._fillDirection }
	set fillDirection(value: FillDirection) {
		this._fillDirection = value
	}

	get beforeFillCallback(): ((ctx: FillContext<T>) => boolean | void | Promise<boolean | void>) | undefined { return this._beforeFillCallback }
	set beforeFillCallback(value: ((ctx: FillContext<T>) => boolean | void | Promise<boolean | void>) | undefined) {
		this._beforeFillCallback = value
	}

	// Row selection
	get selectedRows(): number[] {
		return Array.from(this._selectedRows).sort((a, b) => a - b)
	}

	get rangeShortcuts(): GridRangeShortcut<T>[] { return this._rangeShortcuts }
	set rangeShortcuts(value: GridRangeShortcut<T>[]) {
		this._rangeShortcuts = value ?? []
		this.requestUpdate()  // the shortcuts help lists them
	}

	isRowSelected(rowIndex: number): boolean {
		return this._selectedRows.has(rowIndex)
	}

	selectRow(rowIndex: number, mode: 'replace' | 'toggle' | 'range' = 'replace'): void {
		interactionLogger.debug('selectRow:', { rowIndex, mode })
		// Clear cell and column selection when selecting rows
		if (this._selectedCellRange) {
			this._selectedCellRange = null
		}
		this._selectedColumns.clear()

		switch (mode) {
			case 'replace':
				this._selectedRows.clear()
				this._selectedRows.add(rowIndex)
				this._lastSelectedRowIndex = rowIndex
				break
			case 'toggle':
				if (this._selectedRows.has(rowIndex)) {
					this._selectedRows.delete(rowIndex)
				} else {
					this._selectedRows.add(rowIndex)
				}
				this._lastSelectedRowIndex = rowIndex
				break
			case 'range':
				if (this._lastSelectedRowIndex !== null) {
					const start = Math.min(this._lastSelectedRowIndex, rowIndex)
					const end = Math.max(this._lastSelectedRowIndex, rowIndex)
					for (let i = start; i <= end; i++) {
						this._selectedRows.add(i)
					}
				} else {
					this._selectedRows.add(rowIndex)
					this._lastSelectedRowIndex = rowIndex
				}
				break
		}
		this.requestUpdate()
	}

	selectRowRange(fromIndex: number, toIndex: number): void {
		// Clear column selection when selecting rows
		this._selectedColumns.clear()
		this._selectedCellRange = null

		this._selectedRows.clear()
		const start = Math.min(fromIndex, toIndex)
		const end = Math.max(fromIndex, toIndex)
		for (let i = start; i <= end; i++) {
			this._selectedRows.add(i)
		}
		this._lastSelectedRowIndex = toIndex
		this.requestUpdate()
	}

	clearSelection(): void {
		if (this._selectedRows.size > 0) {
			this._selectedRows.clear()
			this._lastSelectedRowIndex = null
			this.requestUpdate()
		}
	}

	/** Clear row selection state without triggering re-render (caller handles visuals) */
	clearSelection_noRender(): void {
		this._selectedRows.clear()
		this._lastSelectedRowIndex = null
	}

	getSelectedRowsData(): T[] {
		return this.selectedRows.map(idx => this.displayItems[idx]).filter(Boolean)
	}

	/**
	 * Copy selected rows to clipboard in TSV format (Excel-compatible)
	 * @returns true if copy was successful, false if no selection or clipboard failed
	 */
	async copySelectedRowsToClipboard(): Promise<boolean> {
		const selectedIndices = this.selectedRows
		if (selectedIndices.length === 0) return false

		const rows: string[] = []

		// Add header row if configured
		if (this._shouldCopyWithHeaders) {
			const headerCells: string[] = []
			for (const vc of this.visualColumns) {
				const title = vc.column.title ?? vc.column.field ?? ''
				headerCells.push(String(title))
			}
			rows.push(headerCells.join('\t'))
		}

		// Add data rows
		for (const rowIndex of selectedIndices) {
			const rowData = this.displayItems[rowIndex]
			if (!rowData) continue

			const rowCells: string[] = []
			for (const vc of this.visualColumns) {
				rowCells.push(this.clipboardCellText(rowData, rowIndex, String(vc.column.field)))
			}
			rows.push(rowCells.join('\t'))
		}

		return this.writeClipboardText(rows.join('\n'))
	}

	/**
	 * Copy selected columns to clipboard in TSV format (Excel-compatible)
	 * @returns true if copy was successful, false if no selection or clipboard failed
	 */
	async copySelectedColumnsToClipboard(): Promise<boolean> {
		const selectedColIndices = this.selectedColumns
		if (selectedColIndices.length === 0) return false

		const rows: string[] = []

		// Add header row if configured
		if (this._shouldCopyWithHeaders) {
			const headerCells: string[] = []
			for (const colIndex of selectedColIndices) {
				const vc = this.visualColumns[colIndex]
				if (!vc) continue
				const title = vc.column.title ?? vc.column.field ?? ''
				headerCells.push(String(title))
			}
			rows.push(headerCells.join('\t'))
		}

		// Add data rows (all rows, only selected columns)
		for (let rowIndex = 0; rowIndex < this.displayItems.length; rowIndex++) {
			const rowData = this.displayItems[rowIndex]
			if (!rowData) continue

			const rowCells: string[] = []
			for (const colIndex of selectedColIndices) {
				const vc = this.visualColumns[colIndex]
				if (!vc) continue
				rowCells.push(this.clipboardCellText(rowData, rowIndex, String(vc.column.field)))
			}
			rows.push(rowCells.join('\t'))
		}

		return this.writeClipboardText(rows.join('\n'))
	}

	// Cell range selection
	get cellSelectionMode(): CellSelectionMode { return this._cellSelectionMode }
	set cellSelectionMode(value: CellSelectionMode) {
		this._cellSelectionMode = value
		this.checkSelectionConflicts()
		this.requestUpdate()
	}

	get shouldCopyWithHeaders(): boolean { return this._shouldCopyWithHeaders }
	set shouldCopyWithHeaders(value: boolean) { this._shouldCopyWithHeaders = value }

	get selectedCellRange(): CellRange | null { return this._selectedCellRange }

	get lastClickedCell(): { rowIndex: number, colIndex: number } | null {
		return this._lastClickedCell
	}
	set lastClickedCell(value: { rowIndex: number, colIndex: number } | null) {
		this._lastClickedCell = value
	}

	// Paste properties
	get pasteMode(): PasteMode { return this._pasteMode }
	set pasteMode(value: PasteMode) { this._pasteMode = value }

	get shouldValidateOnPaste(): boolean { return this._shouldValidateOnPaste }
	set shouldValidateOnPaste(value: boolean) { this._shouldValidateOnPaste = value }

	get createRowCallback(): CreateRowCallback<T> | undefined { return this._createRowCallback }
	set createRowCallback(value: CreateRowCallback<T> | undefined) { this._createRowCallback = value }

	get beforePasteCallback(): ((ctx: BeforePasteContext<T>) => boolean | void | Promise<boolean | void>) | undefined { return this._beforePasteCallback }
	set beforePasteCallback(value: ((ctx: BeforePasteContext<T>) => boolean | void | Promise<boolean | void>) | undefined) { this._beforePasteCallback = value }

	// New empty row properties — EXPERIMENTAL: API may change
	get isNewRowEnabled(): boolean { return this._isNewRowEnabled }
	set isNewRowEnabled(value: boolean) {
		if (value && !this.isNavigateMode) {
			initLogger.warn('Empty row requires navigate mode (editTrigger: "navigate"). Tab navigation will not work correctly without it.')
		}
		this._isNewRowEnabled = value
		this._emptyRowDraft = null  // Reset draft when feature is toggled
		this.requestUpdate()
	}

	get newRowPosition(): NewRowPosition { return this._newRowPosition }
	set newRowPosition(value: NewRowPosition) {
		this._newRowPosition = value
		this.requestUpdate()
	}

	get newRowIndicator(): string { return this._newRowIndicator }
	set newRowIndicator(value: string) {
		this._newRowIndicator = value
		this.requestUpdate()
	}

	get createEmptyRowCallback(): ((ctx: GridContext<T>) => T | Promise<T>) | undefined { return this._createEmptyRowCallback }
	set createEmptyRowCallback(value: ((ctx: GridContext<T>) => T | Promise<T>) | undefined) {
		this._createEmptyRowCallback = value
	}

	/** The copy the `duplicate` built-in / duplicateRow() inserts (default: shallow copy, `idMember` cleared). */
	get createDuplicateRowCallback(): ((ctx: RowContext<T>) => T) | undefined { return this._createDuplicateRowCallback }
	set createDuplicateRowCallback(value: ((ctx: RowContext<T>) => T) | undefined) {
		this._createDuplicateRowCallback = value
	}

	// ==========================================================================
	// Stable row identity
	// ==========================================================================

	get idMember(): string | null { return this._idMember }
	set idMember(value: string | null) {
		this._idMember = value || null
		// Editable grid without idMember/treePathMember produces drift on reorder; warn once.
		this.maybeWarnAboutRowIdentity()
	}

	/**
	 * Return a stable string key for a row. Coalesce order: row id (getIdCallback / idMember) → treePathMember
	 * value → displayed-index string fallback. Used to key drafts and invalid-cell markers
	 * so they don't drift when the displayed order changes (sort, filter, page, tree toggle).
	 *
	 * `getRowId` (the `getIdCallback` / `idMember` value, any type) stringified.
	 */
	getStableRowKey(item: T, displayedIndex: number): string {
		const id = this.getRowId(item)
		if (id !== undefined && id !== null) return String(id)
		if (this._treePathMember) {
			const v = (item as Record<string, unknown>)[this._treePathMember]
			if (v !== undefined && v !== null) return String(v)
		}
		return String(displayedIndex)
	}

	/** True when the row has an id (`getRowId`) or a tree path — i.e. its key is not the display index. */
	private hasStableIdentity(item: T): boolean {
		if (this.getRowId(item) != null) return true
		return !!this._treePathMember && (item as Record<string, unknown>)[this._treePathMember] != null
	}

	private maybeWarnAboutRowIdentity(): void {
		if (this._hasWarnedAboutMissingRowId) return
		if (!this._isEditable) return
		if (this._idMember || this._getIdCallback || this._treePathMember) return
		this._hasWarnedAboutMissingRowId = true
		initLogger.warn(
			'editable grid has no `idMember` (and no `treePathMember`). ' +
			'Internal state (drafts, invalid-cell markers) will be keyed by displayed index, ' +
			'so re-ordering (sort, filter, pagination) can move state to the wrong row. ' +
			'Set `idMember` to the field that uniquely identifies each row.'
		)
	}

	// ==========================================================================
	// Tree / Hierarchy
	// ==========================================================================

	get treePathMember(): string | null { return this._treePathMember }
	set treePathMember(value: string | null) {
		this._treePathMember = value || null
		this.rebuildTreeState()
		this.requestUpdate()
	}

	get treeLevelMember(): string | null { return this._treeLevelMember }
	set treeLevelMember(value: string | null) {
		this._treeLevelMember = value || null
		this.rebuildTreeState()
		this.requestUpdate()
	}

	get treeParentMember(): string | null { return this._treeParentMember }
	set treeParentMember(value: string | null) {
		this._treeParentMember = value || null
		this.rebuildTreeState()
		this.requestUpdate()
	}

	get treeSeparator(): string | null { return this._treeSeparator }
	set treeSeparator(value: string | null) {
		this._treeSeparator = value || null
		this.rebuildTreeState()
		this.requestUpdate()
	}

	get treeDataSorted(): boolean { return this._treeDataSorted }
	set treeDataSorted(value: boolean) {
		this._treeDataSorted = value
		this.requestUpdate()
	}

	get expandedPaths(): Set<string> { return this._expandedPaths }
	set expandedPaths(value: Set<string> | null | undefined) {
		this._expandedPathsExternal = value instanceof Set ? value : null
		this.rebuildExpandedPaths()
		this.requestUpdate()
	}

	get defaultExpandDepth(): number | null { return this._defaultExpandDepth }
	set defaultExpandDepth(value: number | null) {
		this._defaultExpandDepth = (typeof value === 'number' && value >= 0) ? value : null
		// Only re-init if user hasn't given us their own set
		if (!this._expandedPathsExternal) {
			this.rebuildExpandedPaths()
			this.requestUpdate()
		}
	}

	get isTreeMode(): boolean {
		return !!this._treePathMember && !!this._treeIndex
	}

	isPathExpanded(path: string): boolean {
		return this._expandedPaths.has(path)
	}

	toggleExpandedPath(path: string): void {
		const wasExpanded = this._expandedPaths.has(path)
		perfLogger.debug('toggleExpandedPath start:', path, '| willExpand:', !wasExpanded, '| _items.length:', this._items.length, '| treeNodes:', this._treeIndex?.nodes.size ?? 0)
		if (wasExpanded) this._expandedPaths.delete(path)
		else this._expandedPaths.add(path)
		interactionLogger.debug('tree toggle:', path, wasExpanded ? 'expanded → collapsed' : 'collapsed → expanded', '| set size now:', this._expandedPaths.size)
		this.notify('expand-change', { path, isExpanded: !wasExpanded, expandedPaths: new Set(this._expandedPaths) })
		this.requestUpdate()
	}

	expandAll(): void {
		if (!this._treeIndex) return
		this._expandedPaths.clear()
		for (const p of this._treeIndex.nodes.keys()) this._expandedPaths.add(p)
		interactionLogger.debug('tree expandAll: size =', this._expandedPaths.size)
		this.notify('expand-change', { path: null, isExpanded: true, expandedPaths: new Set(this._expandedPaths) })
		this.requestUpdate()
	}

	collapseAll(): void {
		this._expandedPaths.clear()
		interactionLogger.debug('tree collapseAll')
		this.notify('expand-change', { path: null, isExpanded: false, expandedPaths: new Set(this._expandedPaths) })
		this.requestUpdate()
	}

	/**
	 * Expand a path's entire subtree (the path itself + all descendants).
	 * Used by the per-row "expand all" context-menu action — file-explorer convention
	 * is "expand everything *under here*", not the entire dataset.
	 */
	expandSubtree(path: string): void {
		if (!this._treeIndex) return
		const root = this._treeIndex.nodes.get(path)
		if (!root) return
		// BFS over descendants
		const queue: string[] = [path]
		while (queue.length) {
			const p = queue.shift()!
			this._expandedPaths.add(p)
			const node = this._treeIndex.nodes.get(p)
			if (node) queue.push(...node.childPaths)
		}
		this.notify('expand-change', { path, isExpanded: true, expandedPaths: new Set(this._expandedPaths) })
		this.requestUpdate()
	}

	/**
	 * Collapse a path's entire subtree (the path itself + all descendants).
	 */
	collapseSubtree(path: string): void {
		if (!this._treeIndex) return
		const root = this._treeIndex.nodes.get(path)
		if (!root) return
		const queue: string[] = [path]
		while (queue.length) {
			const p = queue.shift()!
			this._expandedPaths.delete(p)
			const node = this._treeIndex.nodes.get(p)
			if (node) queue.push(...node.childPaths)
		}
		this.notify('expand-change', { path, isExpanded: false, expandedPaths: new Set(this._expandedPaths) })
		this.requestUpdate()
	}

	/**
	 * Walk up the path's ancestor chain looking for the nearest expanded ancestor.
	 * Used by Ctrl+ArrowLeft: when the focused row has no expanded children to collapse,
	 * step up to the closest ancestor that is expanded so the user gets meaningful action.
	 */
	findNearestExpandedAncestor(path: string): string | null {
		if (!this._treeIndex) return null
		let p: string | null = this._treeIndex.nodes.get(path)?.parent ?? null
		while (p !== null) {
			if (this._expandedPaths.has(p)) return p
			p = this._treeIndex.nodes.get(p)?.parent ?? null
		}
		return null
	}

	/** Returns tree info for a row (used by rendering) */
	getRowTreeInfo(item: T): { path: string; level: number; hasChildren: boolean } | null {
		if (!this.isTreeMode) return null
		const path = this.getRowTreePath(item)
		if (!path) return null
		const node = this._treeIndex!.nodes.get(path)
		if (!node) return null
		return { path, level: node.level, hasChildren: node.childPaths.length > 0 }
	}

	get treeDoubleClickBehavior(): TreeDoubleClickBehavior { return this._treeDoubleClickBehavior }
	set treeDoubleClickBehavior(value: TreeDoubleClickBehavior) {
		this._treeDoubleClickBehavior = value || 'none'
	}

	get treeExpandedGlyph(): string { return this._treeExpandedGlyph }
	set treeExpandedGlyph(value: string) {
		this._treeExpandedGlyph = value ?? '▶'
		this.requestUpdate()
	}

	get treeCollapsedGlyph(): string { return this._treeCollapsedGlyph }
	set treeCollapsedGlyph(value: string) {
		this._treeCollapsedGlyph = value ?? '▶'
		this.requestUpdate()
	}

	get renderChevronCallback(): ChevronCallback<T> | undefined { return this._renderChevronCallback }
	set renderChevronCallback(value: ChevronCallback<T> | undefined) {
		this._renderChevronCallback = value
		this._treeChevronCache = new WeakMap()  // callback changed → cached results are stale
		this.requestUpdate()
	}

	/**
	 * Resolve the inner HTML for a row's chevron, using callback (cached) or static glyph.
	 * Cache is keyed per (row reference, expanded). When the row reference changes
	 * (immutable update) or items are replaced, stale entries are dropped via WeakMap GC
	 * or explicit cache clear.
	 */
	getTreeChevronHtml(item: T, expanded: boolean, hasChildren: boolean, level: number, path: string): string {
		const cb = this._renderChevronCallback
		if (!cb) {
			// Default: leaves render empty (just a spacer); branches show glyph based on state
			if (!hasChildren) return ''
			return expanded ? this._treeExpandedGlyph : this._treeCollapsedGlyph
		}
		const rowKey = item as unknown as object
		let perRow = this._treeChevronCache.get(rowKey)
		if (!perRow) {
			perRow = new Map()
			this._treeChevronCache.set(rowKey, perRow)
		}
		// Cache key includes hasChildren so leaves and branches don't share an entry
		const cacheKey = `${expanded ? 'e' : 'c'}|${hasChildren ? '1' : '0'}`
		let html = perRow.get(cacheKey)
		if (html === undefined) {
			html = cb(this.ctx({ row: item, isExpanded: expanded, hasChildren, level, path }))
			perRow.set(cacheKey, html)
		}
		return html
	}

	/** Read the path field from a row */
	protected getRowTreePath(item: T): string | null {
		if (!this._treePathMember) return null
		const v = (item as Record<string, unknown>)[this._treePathMember]
		if (v === null || v === undefined) return null
		const s = String(v)
		return s === '' ? null : s
	}

	/** Detect separator from a sample path */
	protected detectTreeSeparator(path: string): string {
		if (path.includes('/')) return '/'
		if (path.includes('\\')) return '\\'
		if (path.includes('.')) return '.'
		return '.'
	}

	/** Rebuild _treeIndex from current items */
	protected rebuildTreeState(): void {
		if (!this._treePathMember || this._items.length === 0) {
			this._treeIndex = null
			this.rebuildExpandedPaths()
			return
		}
		// Detect separator
		let sep = this._treeSeparator
		if (!sep) {
			for (const item of this._items) {
				const p = this.getRowTreePath(item)
				if (p) { sep = this.detectTreeSeparator(p); break }
			}
			sep = sep || '.'
		}

		const nodes = new Map<string, TreeNode>()
		for (let i = 0; i < this._items.length; i++) {
			const item = this._items[i]
			const path = this.getRowTreePath(item)
			if (!path) continue

			// Level: from member or computed from path segments
			let level = 0
			if (this._treeLevelMember) {
				const v = (item as Record<string, unknown>)[this._treeLevelMember]
				if (typeof v === 'number') level = v
			} else {
				level = Math.max(0, path.split(sep).filter(Boolean).length - 1)
			}

			// Parent: from member or derived by stripping last segment
			let parent: string | null = null
			if (this._treeParentMember) {
				const v = (item as Record<string, unknown>)[this._treeParentMember]
				parent = (v === null || v === undefined || v === '') ? null : String(v)
			} else {
				const trimmed = path.endsWith(sep) ? path.slice(0, -sep.length) : path
				const idx = trimmed.lastIndexOf(sep)
				parent = idx < 0 ? null : (trimmed.slice(0, idx) || null)
			}

			nodes.set(path, { path, parent, level, rowIndex: i, childPaths: [] })
		}

		// Wire up children, identify roots
		const rootPaths: string[] = []
		for (const node of nodes.values()) {
			if (node.parent && nodes.has(node.parent)) {
				nodes.get(node.parent)!.childPaths.push(node.path)
			} else {
				rootPaths.push(node.path)
			}
		}

		this._treeIndex = { separator: sep, nodes, rootPaths }
		this.rebuildExpandedPaths()
	}

	/** Re-initialize the active expanded set after items/config changes */
	protected rebuildExpandedPaths(): void {
		if (this._expandedPathsExternal) {
			// User owns the set; we just point at it
			this._expandedPaths = this._expandedPathsExternal
			return
		}
		const set = new Set<string>()
		if (this._treeIndex) {
			if (this._defaultExpandDepth !== null) {
				// "Show tree to depth N" — a node at level N is visible iff every
				// ancestor (levels 0..N-1) is expanded. So expand paths with level < N.
				// depth=0 → nothing expanded, only roots visible.
				// depth=1 → roots expanded, level-1 visible (no level-2).
				for (const node of this._treeIndex.nodes.values()) {
					if (node.level < this._defaultExpandDepth) set.add(node.path)
				}
			} else {
				// Default: everything expanded
				for (const path of this._treeIndex.nodes.keys()) set.add(path)
			}
		}
		this._expandedPaths = set
	}

	/** Compare two tree nodes using current sort state, falling back to path */
	protected compareTreeNodes(a: TreeNode, b: TreeNode): number {
		const ra = this._items[a.rowIndex] as Record<string, unknown>
		const rb = this._items[b.rowIndex] as Record<string, unknown>
		for (const sortState of this._sort) {
			const aVal = ra[sortState.column]
			const bVal = rb[sortState.column]
			if (aVal === bVal) continue
			let cmp = 0
			if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal)
			else if (typeof aVal === 'number' && typeof bVal === 'number') cmp = aVal - bVal
			else cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''))
			return sortState.direction === 'asc' ? cmp : -cmp
		}
		return a.path.localeCompare(b.path)
	}

	/** Compute paths matched by current text filters, plus their ancestors */
	protected getTreeFilterAllowedPaths(): Set<string> | null {
		if (!this._treeIndex) return null
		if (!this._isFilterable) return null
		const filterEntries = Object.entries(this._filters).filter(([, v]) => !!v)
		if (filterEntries.length === 0) return null

		const matched = new Set<string>()
		for (const node of this._treeIndex.nodes.values()) {
			const item = this._items[node.rowIndex] as Record<string, unknown>
			let ok = true
			for (const [field, value] of filterEntries) {
				const cell = String(item[field] ?? '').toLowerCase()
				if (!cell.includes(value.toLowerCase())) { ok = false; break }
			}
			if (ok) matched.add(node.path)
		}

		// Add ancestors of every match
		const allowed = new Set<string>(matched)
		for (const path of matched) {
			let p: string | null = this._treeIndex.nodes.get(path)?.parent ?? null
			while (p) {
				if (allowed.has(p)) break
				allowed.add(p)
				p = this._treeIndex.nodes.get(p)?.parent ?? null
			}
		}
		return allowed
	}

	/** Items in tree-aware sort order (depth-first, sibling-sorted), with filter applied */
	protected getTreeSortedItems(): T[] {
		const __t0 = performance.now()
		gridPerf.counters.treeSorted++
		if (!this._treeIndex) {
			gridPerf.counters.treeSortedMs += performance.now() - __t0
			return this._items
		}
		const allowed = this.getTreeFilterAllowedPaths()

		// `treeDataSorted: true` means "trust me, don't re-sort". When the caller
		// owns the order — either because they want sibling sort handled in JS for
		// a server-mode simulation, or to compute aggregates like grouped sums —
		// they'll re-supply items via data-request when sort changes. The grid
		// never re-walks the tree in this mode.
		if (this._treeDataSorted) {
			const result: T[] = []
			for (let i = 0; i < this._items.length; i++) {
				const item = this._items[i]
				const path = this.getRowTreePath(item)
				if (!path) continue
				if (allowed && !allowed.has(path)) continue
				result.push(item)
			}
			gridPerf.counters.treeSortedMs += performance.now() - __t0
			return result
		}

		const idx = this._treeIndex
		const result: T[] = []
		const walk = (paths: string[]) => {
			const filtered = allowed
				? paths.filter(p => allowed.has(p))
				: [...paths]
			filtered.sort((a, b) => this.compareTreeNodes(idx.nodes.get(a)!, idx.nodes.get(b)!))
			for (const p of filtered) {
				const node = idx.nodes.get(p)!
				result.push(this._items[node.rowIndex])
				if (node.childPaths.length > 0) walk(node.childPaths)
			}
		}
		walk(idx.rootPaths)
		gridPerf.counters.treeSortedMs += performance.now() - __t0
		return result
	}

	/** Items currently visible (post-collapse). When filter is active, ancestors of matches are auto-expanded. */
	protected getTreeVisibleItems(): T[] {
		const __t0 = performance.now()
		gridPerf.counters.treeVisible++
		if (!this._treeIndex) {
			gridPerf.counters.treeVisibleMs += performance.now() - __t0
			return this._items
		}
		const sorted = this.getTreeSortedItems()
		const idx = this._treeIndex
		// When filter is active, ancestors of matches are forced visible regardless of collapse
		const filterActive = this.getTreeFilterAllowedPaths() !== null
		const result: T[] = []
		for (const item of sorted) {
			const path = this.getRowTreePath(item)
			if (!path) { result.push(item); continue }
			const node = idx.nodes.get(path)
			if (!node) { result.push(item); continue }
			// Walk ancestor chain; row visible only if every ancestor is expanded
			let visible = true
			let p = node.parent
			while (p) {
				if (!this.isPathExpanded(p) && !filterActive) { visible = false; break }
				const pn = idx.nodes.get(p)
				p = pn ? pn.parent : null
			}
			if (visible) result.push(item)
		}
		gridPerf.counters.treeVisibleMs += performance.now() - __t0
		return result
	}

	selectCellRange(range: CellRange): void {
		interactionLogger.debug('selectCellRange:', { startRow: range.startRowIndex, startCol: range.startColIndex, endRow: range.endRowIndex, endCol: range.endColIndex })
		// Clear row and column selection when selecting cells
		if (this._selectedRows.size > 0) {
			this._selectedRows.clear()
			this._lastSelectedRowIndex = null
		}
		this._selectedColumns.clear()

		this._selectedCellRange = range
		this.requestUpdate()

		this.notify('cell-selection-change', { range, cellCount: this.getSelectedCells().length })
	}

	clearCellSelection(): void {
		if (this._selectedCellRange) {
			this._selectedCellRange = null
			this.requestUpdate()

			this.notify('cell-selection-change', { range: null, cellCount: 0 })
		}
	}

	/** Clear cell selection state without triggering re-render (caller handles visuals) */
	clearCellSelection_noRender(): void {
		if (this._selectedCellRange) {
			this._selectedCellRange = null
			this.notify('cell-selection-change', { range: null, cellCount: 0 })
		}
	}

	/**
	 * Select all cells in the grid (entire visible data range)
	 */
	selectAll(): void {
		const rowCount = this.displayItems.length
		const colCount = this.visualColumns.length

		if (rowCount === 0 || colCount === 0) return

		const firstCol = this.visualColumns[0]
		const lastCol = this.visualColumns[colCount - 1]

		const range = {
			startRowIndex: 0,
			startColIndex: 0,
			endRowIndex: rowCount - 1,
			endColIndex: colCount - 1,
			startField: String(firstCol.column.field),
			endField: String(lastCol.column.field)
		}

		this.selectCellRange(range)
	}

	/**
	 * Select column(s) - similar to selectRow but for columns
	 * @param colIndex - Column index to select
	 * @param mode - 'replace' (default), 'toggle', or 'range'
	 */
	selectColumn(colIndex: number, mode: 'replace' | 'toggle' | 'range' = 'replace'): void {
		const colCount = this.visualColumns.length
		if (colIndex < 0 || colIndex >= colCount) return

		// Clear row selection and cell range when selecting columns
		this._selectedRows.clear()
		this._selectedCellRange = null

		if (mode === 'replace') {
			this._selectedColumns.clear()
			this._selectedColumns.add(colIndex)
			this._lastSelectedColumnIndex = colIndex
		} else if (mode === 'toggle') {
			if (this._selectedColumns.has(colIndex)) {
				this._selectedColumns.delete(colIndex)
			} else {
				this._selectedColumns.add(colIndex)
			}
			this._lastSelectedColumnIndex = colIndex
		} else if (mode === 'range') {
			// Select range from last selected column to this one
			const fromCol = this._lastSelectedColumnIndex >= 0 ? this._lastSelectedColumnIndex : colIndex
			const minCol = Math.min(fromCol, colIndex)
			const maxCol = Math.max(fromCol, colIndex)
			for (let i = minCol; i <= maxCol; i++) {
				this._selectedColumns.add(i)
			}
			// Don't update lastSelectedColumnIndex for range - keep the anchor
		}

		this.requestUpdate()
	}

	/**
	 * Clear column selection
	 */
	clearColumnSelection(): void {
		this._selectedColumns.clear()
		this._lastSelectedColumnIndex = -1
		this.requestUpdate()
	}

	/** Clear column selection state without triggering re-render (caller handles visuals) */
	clearColumnSelection_noRender(): void {
		this._selectedColumns.clear()
		this._lastSelectedColumnIndex = -1
	}

	/**
	 * Select a range of columns (for drag selection)
	 */
	selectColumnRange(fromIndex: number, toIndex: number): void {
		// Clear row selection and cell range when selecting columns
		this._selectedRows.clear()
		this._selectedCellRange = null

		this._selectedColumns.clear()
		const start = Math.min(fromIndex, toIndex)
		const end = Math.max(fromIndex, toIndex)
		for (let i = start; i <= end; i++) {
			this._selectedColumns.add(i)
		}
		this._lastSelectedColumnIndex = toIndex
		this.requestUpdate()
	}

	/**
	 * Get selected column indices (sorted)
	 */
	get selectedColumns(): number[] {
		return Array.from(this._selectedColumns).sort((a, b) => a - b)
	}

	/**
	 * Check if a column is selected
	 */
	isColumnSelected(colIndex: number): boolean {
		return this._selectedColumns.has(colIndex)
	}

	getSelectedCells(): Array<{ row: T, rowIndex: number, colIndex: number, field: string, value: unknown }> {
		if (!this._selectedCellRange) return []

		const { startRowIndex, endRowIndex, startColIndex, endColIndex } = this._selectedCellRange
		const minRow = Math.min(startRowIndex, endRowIndex)
		const maxRow = Math.max(startRowIndex, endRowIndex)
		const minCol = Math.min(startColIndex, endColIndex)
		const maxCol = Math.max(startColIndex, endColIndex)

		const cells = []
		for (let row = minRow; row <= maxRow; row++) {
			for (let col = minCol; col <= maxCol; col++) {
				const column = this.visualColumns[col]?.column
				if (!column) continue

				const rowData = this.displayItems[row]
				if (!rowData) continue

				const field = String(column.field)
				const value = (rowData as Record<string, unknown>)[field]

				cells.push({ row: rowData, rowIndex: row, colIndex: col, field, value })
			}
		}

		return cells
	}

	/**
	 * Check if a cell is in the selected cell range
	 */
	isCellInSelectedRange(rowIndex: number, colIndex: number): boolean {
		if (!this._selectedCellRange) return false

		const { startRowIndex, endRowIndex, startColIndex, endColIndex } = this._selectedCellRange
		const minRow = Math.min(startRowIndex, endRowIndex)
		const maxRow = Math.max(startRowIndex, endRowIndex)
		const minCol = Math.min(startColIndex, endColIndex)
		const maxCol = Math.max(startColIndex, endColIndex)

		return rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol
	}

	/**
	 * Copy selected cell range to clipboard in TSV format (Excel-compatible)
	 * @returns true if copy was successful, false if no selection or clipboard failed
	 */
	async copyCellSelectionToClipboard(): Promise<boolean> {
		if (!this._selectedCellRange) return false

		const { startRowIndex, endRowIndex, startColIndex, endColIndex } = this._selectedCellRange
		const minRow = Math.min(startRowIndex, endRowIndex)
		const maxRow = Math.max(startRowIndex, endRowIndex)
		const minCol = Math.min(startColIndex, endColIndex)
		const maxCol = Math.max(startColIndex, endColIndex)

		const rows: string[] = []

		// Add header row if configured
		if (this._shouldCopyWithHeaders) {
			const headerCells: string[] = []
			for (let col = minCol; col <= maxCol; col++) {
				const column = this.visualColumns[col]?.column
				const title = column?.title ?? column?.field ?? ''
				headerCells.push(String(title))
			}
			rows.push(headerCells.join('\t'))
		}

		// Add data rows
		for (let row = minRow; row <= maxRow; row++) {
			const rowData = this.displayItems[row]
			if (!rowData) continue

			const rowCells: string[] = []
			for (let col = minCol; col <= maxCol; col++) {
				const column = this.visualColumns[col]?.column
				if (!column) {
					rowCells.push('')
					continue
				}

				rowCells.push(this.clipboardCellText(rowData, row, String(column.field)))
			}
			rows.push(rowCells.join('\t'))
		}

		return this.writeClipboardText(rows.join('\n'))
	}

	/**
	 * Copy the focused cell to the clipboard (single-cell Ctrl+C): the column's
	 * `getCopyValueCallback` text when set, otherwise the raw (draft-aware) value.
	 * @returns true if copy was successful, false if no focused cell or clipboard failed
	 */
	async copyFocusedCellToClipboard(): Promise<boolean> {
		const focused = this._focusedCell
		if (!focused) return false
		const row = this.displayItems[focused.rowIndex]
		const column = this._columns[focused.colIndex]
		if (!row || !column) return false
		const text = column.getCopyValueCallback
			? String(column.getCopyValueCallback(this.cellCtx(row, focused.rowIndex, column, focused.colIndex)) ?? '')
			: this.clipboardCellText(row, focused.rowIndex, String(column.field))
		return this.writeClipboardText(text)
	}

	/** Clipboard text for one cell: the draft-aware raw value; null → '', objects → JSON. */
	private clipboardCellText(row: T, rowIndex: number, field: string): string {
		const value = this.getCellRawValue(row, rowIndex, field)
		if (value == null) return ''
		if (typeof value === 'object' && !(value instanceof Date)) return JSON.stringify(value)
		return String(value)
	}

	/** Write to the clipboard; a rejection (no permission / insecure context) resolves false. */
	private async writeClipboardText(text: string): Promise<boolean> {
		try {
			await navigator.clipboard.writeText(text)
			return true
		} catch {
			return false
		}
	}

	// ==========================================================================
	// Computed Properties (Data Pipeline)
	// ==========================================================================

	get isNavigateMode(): boolean {
		return this._editTrigger === "navigate" || this._columns.some(c => c.editTrigger === "navigate")
	}

	get filteredItems(): T[] {
		// filterMode 'server': filtering is delegated to the consumer (`filter-change`).
		// The grid still tracks `_filters` to drive the input UI, but doesn't apply them.
		if (this._filterMode === 'server') return this._items

		if (!this._isFilterable || Object.keys(this._filters).length === 0) {
			return this._items
		}

		return this._items.filter((item) => {
			return Object.entries(this._filters).every(([field, filterValue]) => {
				if (!filterValue) return true
				const column = this._columns.find(c => String(c.field) === field)
				// Per-column custom filter callback overrides built-in substring match
				if (column?.filterCallback) {
					const result = column.filterCallback(this.ctx({ row: item, column, field, filterValue }))
					// null = input incomplete → ignore this filter (all rows pass for it)
					if (result === null) return true
					return result
				}
				const cellValue = String((item as Record<string, unknown>)[field] ?? "").toLowerCase()
				return cellValue.includes(filterValue.toLowerCase())
			})
		})
	}

	/**
	 * Returns the set of fields whose current filter input is "incomplete" (column.filter
	 * returned null when probed against the first row). Renderers can use this to mark the
	 * input visually (red border) without excluding all rows.
	 */
	getInvalidFilterFields(): Set<string> {
		const invalid = new Set<string>()
		const probe = this._items[0]
		if (!probe) return invalid
		for (const [field, value] of Object.entries(this._filters)) {
			if (!value) continue
			const column = this._columns.find(c => String(c.field) === field)
			if (column?.filterCallback) {
				if (column.filterCallback(this.ctx({ row: probe, column, field, filterValue: value })) === null) invalid.add(field)
			}
		}
		return invalid
	}

	get filters(): Record<string, string> { return { ...this._filters } }
	set filters(value: Record<string, string>) {
		this._filters = { ...value }
		this.notify('filter-change', { filters: { ...this._filters } })
		this.requestUpdate()
	}

	setFilter(field: string, value: string): void {
		if (value) this._filters = { ...this._filters, [field]: value }
		else {
			const next = { ...this._filters }
			delete next[field]
			this._filters = next
		}
		this.notify('filter-change', { filters: { ...this._filters } })
		this.requestUpdate()
	}

	get sortedItems(): T[] {
		// Tree mode: depth-first sibling-aware sort, also applies filter
		if (this.isTreeMode) {
			return this.getTreeSortedItems()
		}

		// No sort columns = return filtered items as-is
		if (this._sort.length === 0) return this.filteredItems

		return [...this.filteredItems].sort((a, b) => {
			// Multi-column sort: compare each column in order
			for (const sortState of this._sort) {
				const aVal = (a as Record<string, unknown>)[sortState.column]
				const bVal = (b as Record<string, unknown>)[sortState.column]

				if (aVal === bVal) continue  // Equal, check next column

				let comparison = 0
				if (typeof aVal === "string" && typeof bVal === "string") {
					comparison = aVal.localeCompare(bVal)
				} else if (typeof aVal === "number" && typeof bVal === "number") {
					comparison = aVal - bVal
				} else {
					comparison = String(aVal ?? "").localeCompare(String(bVal ?? ""))
				}

				return sortState.direction === "asc" ? comparison : -comparison
			}
			return 0  // All columns equal
		})
	}

	get paginatedItems(): T[] {
		if (this._paginatedItemsCache !== null) return this._paginatedItemsCache
		const __t0 = performance.now()
		gridPerf.counters.paginatedItems++
		// In tree mode, slice over visible (post-collapse) items, not the full sorted list
		const baseItems = this.isTreeMode ? this.getTreeVisibleItems() : this.sortedItems

		let result: T[]
		if (!this._isPageable) {
			result = baseItems
		} else if (this._paginationMode === 'server') {
			// Server-side pagination: items are already the current page, don't slice
			result = baseItems
		} else {
			// Client-side pagination: slice the items array. A page past the end (a filter
			// or a shorter `items` left fewer pages) is clamped to the last page.
			const lastPage = Math.max(1, Math.ceil(baseItems.length / this._pageSize))
			if (this._currentPage > lastPage) this._currentPage = lastPage
			const start = (this._currentPage - 1) * this._pageSize
			const end = start + this._pageSize
			result = baseItems.slice(start, end)
		}

		this._paginatedItemsCache = result
		gridPerf.counters.paginatedItemsMs += performance.now() - __t0
		return result
	}

	get totalPages(): number {
		// Use totalItems if provided (server-side pagination), otherwise use local item count
		// In tree mode, paginate over visible (post-collapse) items
		let itemCount: number
		if (this._totalItems !== null) {
			itemCount = this._totalItems
		} else if (this.isTreeMode) {
			itemCount = this.getTreeVisibleItems().length
		} else {
			itemCount = this.sortedItems.length
		}
		return Math.max(1, Math.ceil(itemCount / this._pageSize))
	}

	get displayItems(): T[] {
		if (this._displayItemsCache !== null) return this._displayItemsCache
		const __t0 = performance.now()
		gridPerf.counters.displayItems++
		const items = this.paginatedItems
		let result: T[]
		if (!this._isNewRowEnabled) {
			result = items
		} else {
			const emptyRow = this.getEmptyRow()
			result = this._newRowPosition === 'top'
				? [emptyRow, ...items]
				: [...items, emptyRow]
		}
		this._displayItemsCache = result
		gridPerf.counters.displayItemsMs += performance.now() - __t0
		return result
	}

	// ==========================================================================
	// Empty Row Helpers
	// ==========================================================================

	/**
	 * Get the empty row (draft or newly created)
	 * Caches the result in _emptyRowDraft to avoid calling createEmptyRowCallback multiple times
	 */
	protected getEmptyRow(): T {
		if (this._emptyRowDraft) {
			return this._emptyRowDraft
		}
		// Create and cache the empty row. The default factory reads the columns, so a
		// row built before any columns exist (e.g. `is-new-row-enabled` in markup, a
		// render before `columns` is assigned) is not cached — it would lack the fields.
		const newRow = this.createNewEmptyRow()
		if (this._createEmptyRowCallback || this._columns.length > 0) {
			this._emptyRowDraft = newRow
		}
		return newRow
	}

	/**
	 * Create a new empty row using callback or default factory
	 */
	protected createNewEmptyRow(): T {
		if (this._createEmptyRowCallback) {
			const result = this._createEmptyRowCallback(this.ctx({}))
			if (result instanceof Promise) {
				// Async callback - return empty object for now, will update when resolved
				result.then(row => {
					this._emptyRowDraft = row
					this.requestUpdate()
				}).catch(err => {
					dataLogger.warn('createEmptyRowCallback failed', err)
				})
				return {} as T
			}
			return result
		}
		// Default: create object with null values for all columns
		const row = {} as Record<string, unknown>
		for (const col of this._columns) {
			row[String(col.field)] = null
		}
		return row as T
	}

	/**
	 * Check if a display index refers to the empty row
	 */
	isEmptyRowIndex(displayIndex: number): boolean {
		if (!this._isNewRowEnabled) return false

		if (this._newRowPosition === 'top') {
			return displayIndex === 0
		} else {
			// Bottom: empty row is last item
			return displayIndex === this.paginatedItems.length
		}
	}

	/**
	 * Convert display index to data index (accounting for empty row)
	 */
	getDataIndexFromDisplayIndex(displayIndex: number): number {
		if (!this._isNewRowEnabled) return displayIndex
		if (this._newRowPosition === 'top') {
			// Empty row at top: subtract 1 from display index
			return displayIndex - 1
		}
		// Empty row at bottom: same index
		return displayIndex
	}

	/**
	 * Check if empty row has any actual data (not all null/empty)
	 */
	protected emptyRowHasData(row: T): boolean {
		for (const col of this._columns) {
			const value = (row as Record<string, unknown>)[String(col.field)]
			if (value !== null && value !== undefined && value !== '') {
				return true
			}
		}
		return false
	}

	// ==========================================================================
	// Data Request Helper
	// ==========================================================================

	/**
	 * Fire the `data-request` event with the current state
	 */
	fireDataRequest(trigger: DataRequestTrigger): void {
		{
			// For loadMore, skip is current item count; for pagination, it's page-based
			const skip = trigger === 'loadMore'
				? this._items.length
				: (this._currentPage - 1) * this._pageSize

			const detail: DataRequestDetail = {
				sort: [...this._sort],
				page: this._currentPage,
				pageSize: this._pageSize,
				trigger,
				mode: trigger === 'loadMore' ? 'append' : 'replace',
				skip
			}
			dataLogger.debug('fireDataRequest:', trigger, detail)
			this.notify('data-request', detail)
		}
	}

	/**
	 * Check if column is currently sorted
	 */
	getColumnSortState(field: string): SortState | undefined {
		return this._sort.find(s => s.column === field)
	}

	/**
	 * Get sort priority (1-based) for a column, or 0 if not sorted
	 */
	getColumnSortPriority(field: string): number {
		const index = this._sort.findIndex(s => s.column === field)
		return index >= 0 ? index + 1 : 0
	}

	// ==========================================================================
	// Mode Defaults
	// ==========================================================================

	/**
	 * Apply sensible defaults based on the current mode.
	 * Called when mode is set.
	 */
	protected applyModeDefaults(): void {
		const preset = MODE_PRESETS[this._mode]
		if (!preset) return
		if (preset.isEditable !== undefined) this._isEditable = preset.isEditable
		if (preset.editTrigger !== undefined) this._editTrigger = preset.editTrigger
		if (preset.dropdownToggleVisibility !== undefined) this._dropdownToggleVisibility = preset.dropdownToggleVisibility
		if (preset.shouldShowDropdownOnFocus !== undefined) this._shouldShowDropdownOnFocus = preset.shouldShowDropdownOnFocus
		if (preset.cellSelectionMode !== undefined) this._cellSelectionMode = preset.cellSelectionMode
	}

	/**
	 * Check for configuration conflicts and warn user
	 */
	protected checkSelectionConflicts(): void {
		if (this._cellSelectionMode === 'click' && this._editTrigger === 'click') {
			initLogger.warn(
				'cellSelectionMode="click" conflicts with editTrigger="click". ' +
				'Cell range selection takes priority. Use Shift+click to enter edit mode, ' +
				'or change to cellSelectionMode="shift" to avoid confusion.'
			)
		}
	}

	/**
	 * Check for editTrigger conflicts in read-only mode
	 */
	protected checkEditTriggerConflicts(): void {
		if (!this._isEditable && this._editTrigger === 'always') {
			initLogger.warn(
				'editTrigger="always" is not supported in read-only mode (isEditable=false).\n' +
				'Supported editTrigger values in read-only mode: "navigate", "click", "dblclick".\n' +
				'The grid may behave unexpectedly.',
				'font-size: 14px; font-weight: bold;'
			)
		}
	}

	/**
	 * Check for incompatible toolbar configuration and warn user
	 */
	protected checkToolbarConflicts(): void {
		const pos = this._toolbarPosition
		const isTopOrInline = pos === 'top' || pos === 'inline'
		const isTop = pos === 'top'
		
		// verticalAlign only matters for left/right/auto (side positions)
		if (this._toolbarVerticalAlign !== 'bottom' && isTopOrInline) {
			initLogger.warn(
				`toolbarVerticalAlign="${this._toolbarVerticalAlign}" has no effect with toolbarPosition="${pos}".\n` +
				'verticalAlign only applies to side positions: "left", "right", or "auto".'
			)
		}

		// horizontalAlign only matters for top position
		if (this._toolbarHorizontalAlign !== 'center' && !isTop) {
			initLogger.warn(
				`toolbarHorizontalAlign="${this._toolbarHorizontalAlign}" has no effect with toolbarPosition="${pos}".\n` +
				'horizontalAlign only applies to toolbarPosition="top".'
			)
		}

		// toolbarColumn only matters for top position
		if (this._toolbarColumn !== undefined && !isTop) {
			initLogger.warn(
				`toolbarColumn has no effect with toolbarPosition="${pos}".\n` +
				'toolbarColumn only applies to toolbarPosition="top".'
			)
		}

		// shouldToolbarFollowCursor only matters for top position
		if (this._shouldToolbarFollowCursor && !isTop) {
			initLogger.warn(
				`shouldToolbarFollowCursor has no effect with toolbarPosition="${pos}".\n` +
				'shouldToolbarFollowCursor only applies to toolbarPosition="top".'
			)
		}

		// getCellToolbarItemsCallback only matters for top position
		if (this._getCellToolbarItemsCallback !== undefined && !isTop) {
			initLogger.warn(
				`getCellToolbarItemsCallback has no effect with toolbarPosition="${pos}".\n` +
				'getCellToolbarItemsCallback requires toolbarPosition="top".'
			)
		}

		// toolbarColumn takes priority over followsCursor
		if (this._shouldToolbarFollowCursor && this._toolbarColumn !== undefined) {
			initLogger.warn(
				'toolbarColumn and shouldToolbarFollowCursor are both set.\n' +
				'toolbarColumn takes priority — cursor following is disabled.'
			)
		}
	}

	// ==========================================================================
	// Update Mechanism (to be overridden by GridElement)
	// ==========================================================================

	protected requestUpdate(): void {
		// Override in GridElement to trigger DOM re-render
	}

	/**
	 * Drop memoized pipeline output. The web-component's requestUpdate override
	 * calls this on every state mutation, so callers don't need to invoke it
	 * directly — but it's safe to call any time the cache might be stale.
	 */
	invalidateDisplayCache(): void {
		this._paginatedItemsCache = null
		this._displayItemsCache = null
	}

	// ==========================================================================
	// Draft Row Management
	// ==========================================================================

	/**
	 * Identity a draft is stored under: the row's `idMember` (or `treePathMember`)
	 * value when set, otherwise the row object itself — never the display index, so
	 * a draft stays with its row when the view is sorted, paged, filtered or a tree
	 * branch toggles.
	 */
	private draftKey(item: T): unknown {
		const id = this.getRowId(item)
		if (id !== undefined && id !== null) return `key:${String(id)}`
		if (this._treePathMember) {
			const v = (item as Record<string, unknown>)[this._treePathMember]
			if (v !== undefined && v !== null) return `key:${String(v)}`
		}
		return item
	}

	/** The draft of the row at a display index (the empty row has its own draft). */
	private draftAt(rowIndex: number): T | undefined {
		const item = this.displayItems[rowIndex]
		return item ? this._draftRows.get(this.draftKey(item)) : undefined
	}

	private setDraftAt(rowIndex: number, draft: T): void {
		const item = this.displayItems[rowIndex]
		if (item) this._draftRows.set(this.draftKey(item), draft)
	}

	private deleteDraftAt(rowIndex: number): void {
		const item = this.displayItems[rowIndex]
		if (item) this._draftRows.delete(this.draftKey(item))
	}

	/** Display indices of the displayed rows that have a draft. */
	private draftRowIndices(): number[] {
		if (this._draftRows.size === 0) return []
		const out: number[] = []
		this.displayItems.forEach((item, i) => {
			if (!this.isEmptyRowIndex(i) && this._draftRows.has(this.draftKey(item))) out.push(i)
		})
		return out
	}

	getRowDraft(rowIndex: number): T | undefined {
		return this.draftAt(rowIndex)
	}

	hasRowDraft(rowIndex: number): boolean {
		return this.draftAt(rowIndex) !== undefined
	}

	/**
	 * Check if a specific cell has been modified (draft value differs from original)
	 */
	isCellDirty(rowIndex: number, field: string): boolean {
		const draftRow = this.draftAt(rowIndex)
		if (!draftRow) return false
		const originalItem = this.displayItems[rowIndex]
		if (!originalItem) return false
		const draftVal = (draftRow as Record<string, unknown>)[field]
		const origVal = (originalItem as Record<string, unknown>)[field]
		return draftVal !== origVal
	}

	/**
	 * Check if any cell in a row has been modified
	 */
	isRowDirty(rowIndex: number): boolean {
		const draftRow = this.draftAt(rowIndex)
		const originalItem = this.displayItems[rowIndex]
		return !!draftRow && !!originalItem && this.draftDiffers(draftRow, originalItem)
	}

	/** True when any field of the draft differs from the original row. */
	private draftDiffers(draftRow: T, originalItem: T): boolean {
		const draft = draftRow as Record<string, unknown>
		const orig = originalItem as Record<string, unknown>
		return Object.keys(draft).some(key => draft[key] !== orig[key])
	}

	discardRowDraft(rowIndex: number): void {
		this.deleteDraftAt(rowIndex)
		const rowKey = this.rowKeyForIndex(rowIndex)
		if (rowKey !== null) {
			this._invalidCells = this._invalidCells.filter(c => c.rowKey !== rowKey)
		}
		this.requestUpdate()
	}

	/**
	 * Discard draft value for a single cell (field)
	 * Removes the field from the draft row, or deletes the draft row if it becomes empty
	 */
	discardCellDraft(rowIndex: number, field: string): void {
		const draftRow = this.draftAt(rowIndex)
		if (!draftRow) return

		const originalItem = this.displayItems[rowIndex]
		if (!originalItem) return

		// Restore original value in draft row
		const originalValue = (originalItem as Record<string, unknown>)[field]
		;(draftRow as Record<string, unknown>)[field] = originalValue

		// Check if draft row now matches original - if so, delete it
		const draftKeys = Object.keys(draftRow as Record<string, unknown>)
		let hasChanges = false
		for (const key of draftKeys) {
			const draftValue = (draftRow as Record<string, unknown>)[key]
			const origValue = (originalItem as Record<string, unknown>)[key]
			if (draftValue !== origValue) {
				hasChanges = true
				break
			}
		}

		if (!hasChanges) {
			this.deleteDraftAt(rowIndex)
		}

		// Clear any invalid cell state for this field
		const rowKey = this.rowKeyForIndex(rowIndex)
		if (rowKey !== null) {
			this._invalidCells = this._invalidCells.filter(
				c => !(c.rowKey === rowKey && c.field === field)
			)
		}
	}

	getDraftRowIndices(): number[] {
		return this.draftRowIndices()
	}

	discardAllDrafts(): void {
		this._draftRows.clear()
		this._invalidCells = []
		this.requestUpdate()
	}

	// ==========================================================================
	// Cell Value Helpers
	// ==========================================================================

	getCellRawValue(item: T, rowIndex: number, field: string): unknown {
		// Empty row uses item directly (which is _emptyRowDraft via displayItems)
		// Don't check _draftRows for empty row - it has its own draft system
		if (!this.isEmptyRowIndex(rowIndex)) {
			const draftRow = this._draftRows.get(this.draftKey(item))
			if (draftRow) {
				return (draftRow as Record<string, unknown>)[field]
			}
		}
		return (item as Record<string, unknown>)[field]
	}

	getCellValue(item: T, column: Column<T>, rowIndex: number): string {
		if (column.renderCellCallback) {
			return column.renderCellCallback(this.cellCtx(item, rowIndex, column))
		}
		const value = this.getCellRawValue(item, rowIndex, String(column.field))
		if (column.getDisplayValueCallback) {
			return column.getDisplayValueCallback(this.cellCtx(item, rowIndex, column))
		}

		// Auto-format date columns using editorOptions.dateFormat when no getDisplayValueCallback
		if (column.editor === 'date' && column.editorOptions?.dateFormat && value) {
			try {
				const date = value instanceof Date ? value : new Date(value as string | number)
				if (!isNaN(date.getTime())) {
					const formatInfo = parseFormat(column.editorOptions.dateFormat)
					return formatDate(date, formatInfo)
				}
			} catch {
				// Fall through to default string conversion
			}
		}

		return String(value ?? "")
	}

	// ==========================================================================
	// Validation Helpers
	// ==========================================================================

	/** Compute the stable rowKey for a displayed-row index, or null if no row at that index. */
	private rowKeyForIndex(rowIndex: number): string | null {
		const item = this.displayItems[rowIndex]
		if (item === undefined) return null
		return this.getStableRowKey(item, rowIndex)
	}

	isCellInvalid(rowIndex: number, field: string): boolean {
		const rowKey = this.rowKeyForIndex(rowIndex)
		if (rowKey === null) return false
		return this._invalidCells.some(c => c.rowKey === rowKey && c.field === field)
	}

	getCellValidationError(rowIndex: number, field: string): string | null {
		const rowKey = this.rowKeyForIndex(rowIndex)
		if (rowKey === null) return null
		const cell = this._invalidCells.find(c => c.rowKey === rowKey && c.field === field)
		return cell?.error || null
	}

	addInvalidCell(rowIndex: number, field: string, error: string): void {
		const rowKey = this.rowKeyForIndex(rowIndex)
		if (rowKey === null) return
		const existingIndex = this._invalidCells.findIndex(c => c.rowKey === rowKey && c.field === field)
		if (existingIndex >= 0) {
			this._invalidCells[existingIndex] = { rowKey, field, error }
		} else {
			this._invalidCells = [...this._invalidCells, { rowKey, field, error }]
		}
	}

	removeInvalidCell(rowIndex: number, field: string): void {
		const rowKey = this.rowKeyForIndex(rowIndex)
		if (rowKey === null) return
		this._invalidCells = this._invalidCells.filter(c => !(c.rowKey === rowKey && c.field === field))
	}

	// ==========================================================================
	// Edit State Management
	// ==========================================================================

	/**
	 * Check if a specific cell is currently being edited
	 */
	isEditing(rowIndex: number, field: string): boolean {
		return this._editingCell?.rowIndex === rowIndex && this._editingCell?.field === field
	}

	/**
	 * Check if a cell should be rendered as an editor
	 * Returns true if:
	 * - The cell is actively being edited (tracked in _editingCell), OR
	 * - The cell's effective editTrigger is 'always' AND the cell is editable
	 */
	shouldShowEditor(rowIndex: number, colIndex: number): boolean {
		const column = this._columns[colIndex]
		if (!column) return false
		const field = String(column.field)

		// Always show editor if actively editing this cell
		if (this.isEditing(rowIndex, field)) return true

		// Check if editTrigger is 'always' for this column
		const effectiveTrigger = column.editTrigger ?? this._editTrigger
		if (effectiveTrigger === 'always' && this.isCellEditable(column)) {
			return true
		}

		return false
	}

	/**
	 * Start editing a cell
	 */
	startEdit(rowIndex: number, field: string, options?: { initialSearchQuery?: string; cursorPosition?: number }): void {
		// Check if edit is allowed (respects locking)
		if (!this.canEditCell(rowIndex, field)) {
			interactionLogger.debug('startEdit blocked (locked):', { rowIndex, field })
			return  // Silently block edit
		}
		interactionLogger.debug('startEdit:', { rowIndex, field, options })

		const item = this.displayItems[rowIndex]
		if (!item) return

		// No draft yet: commitEdit / updateDraftValue create it lazily, so opening an
		// editor and cancelling leaves the row clean.

		const prev = this._editingCell
		this._editingCell = {
			rowIndex,
			field,
			initialSearchQuery: options?.initialSearchQuery,
			cursorPosition: options?.cursorPosition
		}
		this._onInteractionChange?.('editingCell', { prev, current: this._editingCell })
		this._currentCellError = null
		// NOTE: No requestUpdate() - caller (tryStartEdit) handles surgical DOM update

		this.notify('edit-start', { row: item, rowIndex, field })
	}

	/**
	 * Cancel editing without saving
	 */
	cancelEdit(): void {
		if (this._editingCell) {
			const prev = this._editingCell
			const { rowIndex, field } = prev
			const item = this.displayItems[rowIndex]
			if (item) {
				this.notify('edit-cancel', { row: item, rowIndex, field })
			}
			this._editingCell = null
			this._onInteractionChange?.('editingCell', { prev, current: null })
			this._currentCellError = null
			// NOTE: No requestUpdate() - caller handles surgical DOM update
		}
	}

	/**
	 * Normalize validation result to consistent format
	 */
	normalizeValidationResult(
		result: ValidateResult,
		value: unknown
	): { valid: boolean; message?: string; finalValue: unknown } {
		if (result === null || result === undefined || result === true) {
			return { valid: true, finalValue: value }
		}
		if (result === false) {
			return { valid: false, message: "Validation failed", finalValue: value }
		}
		if (typeof result === "string") {
			return { valid: false, message: result, finalValue: value }
		}
		// ValidationResult object
		return {
			valid: result.valid,
			message: result.message,
			finalValue: result.transformedValue !== undefined
				? result.transformedValue
				: value
		}
	}

	/**
	 * Commit edit with validation
	 * @param commitEmptyRow - If true and editing empty row, add it to items. If false, just update the draft.
	 */
	async commitEdit(rowIndex: number, field: string, newValue: unknown, commitEmptyRow: boolean = false, source: 'edit' | 'paste' = 'edit'): Promise<void> {
		dataLogger.debug('commitEdit:', { rowIndex, field, newValue })
		const column = this._columns.find(c => String(c.field) === field)
		if (!column) return

		const item = this.displayItems[rowIndex]
		if (!item) return

		const isEmptyRow = this.isEmptyRowIndex(rowIndex)
		const oldValue = (item as Record<string, unknown>)[field]
		let finalValue = newValue
		let validationError: string | null = null
		let isValid = true

		this._isValidating = true

		try {
			if (column.validateCallback) {
				const context: ValidateContext<T> = this.ctx({
					row: item,
					rowIndex,
					column,
					colIndex: this._columns.indexOf(column),
					field,
					value: newValue,
					oldValue,
					source
				})
				const result = await Promise.resolve(column.validateCallback(context))
				const normalized = this.normalizeValidationResult(result, newValue)

				isValid = normalized.valid
				validationError = normalized.message || null
				finalValue = normalized.finalValue
			}
		} catch (err) {
			isValid = false
			validationError = err instanceof Error ? err.message : "Validation failed"
		}

		this._isValidating = false

		// Handle empty row commit - LENIENT validation (tracks errors but doesn't block)
		if (isEmptyRow) {
			// Always update empty row draft with the value (preserves user input)
			if (!this._emptyRowDraft) {
				this._emptyRowDraft = { ...item }
			}
			(this._emptyRowDraft as Record<string, unknown>)[field] = finalValue

			// Track validation state (but DON'T block commit)
			if (!isValid) {
				this.addInvalidCell(rowIndex, field, validationError || "Invalid value")
				this._currentCellError = validationError
				this.notify('validation-error', { row: item, rowIndex, field, error: validationError || "Invalid value", source })
			} else {
				this.removeInvalidCell(rowIndex, field)
				this._currentCellError = null
			}

			// Commit to items if explicitly requested (Enter key or Tab on last cell)
			if (commitEmptyRow) {
				// Check if the empty row has any actual data (not all null/empty)
				const hasData = this.emptyRowHasData(this._emptyRowDraft)

				if (hasData) {
					// Add the row to items (even with invalid cells)
					const newRow = { ...this._emptyRowDraft }
					const newRowIndex = this._newRowPosition === 'top'
						? 0
						: this._items.length

					// Capture the empty row's rowKey BEFORE inserting so we can rewrite its
					// invalid-cell markers to the post-commit rowKey. Indexed-fallback keys
					// (when neither idMember nor treePathMember is set) need shifting; stable
					// id keys carry over unchanged.
					const oldRowKey = this.getStableRowKey(this._emptyRowDraft as T, rowIndex)

					if (this._newRowPosition === 'top') {
						this._items = [newRow, ...this._items]
					} else {
						this._items = [...this._items, newRow]
					}

					const newRowKey = this.getStableRowKey(newRow, newRowIndex)
					const usingIndexFallback = !this.hasStableIdentity(newRow)
					this._invalidCells = this._invalidCells.map(c => {
						if (c.rowKey === oldRowKey) {
							return { ...c, rowKey: newRowKey }
						}
						// With index-string fallback, inserting at top shifts every other rowKey
						if (usingIndexFallback && this._newRowPosition === 'top') {
							const n = Number(c.rowKey)
							if (!Number.isNaN(n)) {
								return { ...c, rowKey: String(n + 1) }
							}
						}
						return c
					})

					// Check if the committed row has any invalid cells
					const rowHasInvalidCells = this._invalidCells.some(c => c.rowKey === newRowKey)

					// Fire row-change with validation state
					this.notify('row-change', {
						row: newRow,
						draftRow: newRow,
						rowIndex: newRowIndex,
						field,
						oldValue: null,
						newValue: finalValue,
						isValid: !rowHasInvalidCells,
						validationError: rowHasInvalidCells ? 'Row has invalid cells' : null
					})

					// Reset empty row draft for next entry
					this._emptyRowDraft = null

					// Exit edit mode and re-render
					const prevEditingCell = this._editingCell
					this._editingCell = null
					this._onInteractionChange?.('editingCell', { prev: prevEditingCell, current: null })
					this.requestUpdate()
					return
				}
			}

			// Tab within empty row or no data yet - exit edit mode, keep draft
			// NOTE: No requestUpdate() - caller handles surgical DOM update
			const prevEditingCell = this._editingCell
			this._editingCell = null
			this._onInteractionChange?.('editingCell', { prev: prevEditingCell, current: null })
			return
		}

		// ALWAYS update draft row (valid OR invalid) - preserves user input
		let draftRow = this.draftAt(rowIndex)
		if (!draftRow) {
			draftRow = { ...item }
			this.setDraftAt(rowIndex, draftRow)
		}
		(draftRow as Record<string, unknown>)[field] = finalValue

		// Update invalid cells tracking
		if (isValid) {
			this.removeInvalidCell(rowIndex, field)
			this._currentCellError = null
		} else {
			this.addInvalidCell(rowIndex, field, validationError || "Invalid value")
			this._currentCellError = validationError
			this.notify('validation-error', { row: item, rowIndex, field, error: validationError || "Invalid value", source })
		}

		// A draft that is back to the original values (and has no invalid cell) is dropped,
		// so committing an unchanged value doesn't leave a phantom draft behind.
		const rowKey = this.rowKeyForIndex(rowIndex)
		if (!this.draftDiffers(draftRow, item) && !this._invalidCells.some(c => c.rowKey === rowKey)) {
			this.deleteDraftAt(rowIndex)
		}

		// Fire row-change only when the value actually changed (or validation
		// failed — callers may want to know about that even with no value diff).
		// This prevents spurious "X → X" events when a user enters edit mode
		// and exits via arrow keys without typing.
		const valueChanged = finalValue !== oldValue
		if (valueChanged || !isValid) {
			this.notify('row-change', {
				row: item,
				draftRow,
				rowIndex,
				field,
				oldValue,
				newValue: finalValue,
				isValid,
				validationError
			})
		}

		// Exit edit mode
		const prevEditingCell = this._editingCell
		this._editingCell = null
		this._onInteractionChange?.('editingCell', { prev: prevEditingCell, current: null })
		// NOTE: No requestUpdate() - caller handles surgical DOM update
	}

	/**
	 * Update a cell value in the draft row without exiting edit mode.
	 * Used for checkbox toggling where user may want to toggle multiple times.
	 * Fires row-change but does NOT clear _editingCell.
	 */
	updateDraftValue(rowIndex: number, field: string, newValue: unknown): void {
		const column = this._columns.find(c => String(c.field) === field)
		if (!column) return

		const item = this.displayItems[rowIndex]
		if (!item) return

		const oldValue = this.getCellRawValue(item, rowIndex, field)

		// Handle empty row
		if (this.isEmptyRowIndex(rowIndex)) {
			if (!this._emptyRowDraft) {
				this._emptyRowDraft = { ...item }
			}
			(this._emptyRowDraft as Record<string, unknown>)[field] = newValue
		} else {
			// Update draft row (create if needed)
			let draftRow = this.draftAt(rowIndex)
			if (!draftRow) {
				draftRow = { ...item }
				this.setDraftAt(rowIndex, draftRow)
			}
			(draftRow as Record<string, unknown>)[field] = newValue
		}

		// Fire row-change only when the value actually changed
		if (newValue !== oldValue) {
			const draftRow = this.draftAt(rowIndex) || this._emptyRowDraft || item
			this.notify('row-change', {
				row: item,
				draftRow,
				rowIndex,
				field,
				oldValue,
				newValue,
				isValid: true,
				validationError: null
			})
		}

		// NOTE: Do NOT clear _editingCell - stay in edit mode
	}

	// ==========================================================================
	// Cell Editability Helpers
	// ==========================================================================

	/**
	 * Check if a column's cells can be edited.
	 * `row` is required to evaluate function-form predicates; pass it for per-row checks,
	 * omit it for static column-level checks (e.g. building toolbar UI). When omitted and a
	 * predicate exists, conservatively returns true so the column isn't hidden.
	 *
	 * Resolution order:
	 *   0. tree column in tree mode → not editable (the tree column displays hierarchy, not data)
	 *   1. column.isEditable === false → not editable (hard veto)
	 *   2. column.isEditable === function with row → must return true to continue
	 *   3. grid.isRowEditable with row → must pass to continue
	 *   4. column.isEditable === true → editable (overrides grid-level)
	 *   5. else → defer to grid-level isEditable
	 */
	isCellEditable(column: Column<T>, row?: T): boolean {
		// 0. Tree column is always read-only when tree mode is active. The column hosts
		// indent + chevron and (typically) the row's display name; editing it inline
		// conflicts with the toggle interaction and rarely matches user intent.
		if (this.isTreeMode && column.isTree) return false

		// 1. Hard veto from column
		if (column.isEditable === false) return false

		// 2. Column-level per-row predicate
		if (column.getIsEditableCallback) {
			if (row !== undefined && !column.getIsEditableCallback(this.ctx({ row }))) return false
			// Without a row we can't evaluate; let it through to subsequent gates
		}

		// 3. Grid-level row gate (callback wins over the static flag)
		if (row !== undefined) {
			const rowGate = this._getIsRowEditableCallback
				? this._getIsRowEditableCallback(this.ctx({ row }))
				: this._isRowEditable
			if (rowGate === false) return false
		}

		// 4. Column explicit true overrides grid-level (preserves existing web-grid semantic)
		if (column.isEditable === true) return true

		// 5. A column predicate, having passed, also overrides grid-level so a column can
		//    opt rows in even on a read-only grid.
		if (column.getIsEditableCallback && row !== undefined) return true

		// 6. Defer to grid-level isEditable
		return this._isEditable
	}

	/**
	 * Get all editable columns with their indices.
	 * Pass `row` to evaluate per-row predicates (function-form `isEditable`, `isRowEditable`).
	 * Without `row`, returns columns that are *potentially* editable (any row could pass).
	 */
	getEditableColumns(row?: T): { index: number; column: Column<T> }[] {
		return this._columns
			.map((col, index) => ({ index, column: col }))
			.filter(({ column }) => this.isCellEditable(column, row))
	}

	/**
	 * Walk rows in `direction` looking for the next row that has at least one editable
	 * column at or beyond `fromColEditableIndex` (or beyond the last when going forward
	 * past the row's editable list). Used by Tab traversal in heterogeneous trees so the
	 * cursor skips read-only rows (e.g. team rows) entirely instead of landing on a cell
	 * with no tabindex and silently losing focus.
	 *
	 * Returns null if no editable cell exists in the requested direction.
	 */
	findNextEditableCell(
		fromRowIndex: number,
		fromColEditableIndex: number,
		direction: 'forward' | 'backward'
	): { rowIndex: number; colIndex: number } | null {
		const items = this.displayItems
		const step = direction === 'forward' ? 1 : -1

		// First, try staying on the current row
		const currentRow = items[fromRowIndex]
		if (currentRow !== undefined) {
			const cols = this.getEditableColumns(currentRow)
			const nextIdx = fromColEditableIndex + step
			if (nextIdx >= 0 && nextIdx < cols.length) {
				return { rowIndex: fromRowIndex, colIndex: cols[nextIdx].index }
			}
		}

		// Walk to subsequent rows, skipping any that have zero editable columns
		let r = fromRowIndex + step
		while (r >= 0 && r < items.length) {
			const row = items[r]
			const cols = this.getEditableColumns(row)
			if (cols.length > 0) {
				// forward → first editable column; backward → last editable column
				const target = direction === 'forward' ? cols[0] : cols[cols.length - 1]
				return { rowIndex: r, colIndex: target.index }
			}
			r += step
		}

		return null
	}

	// ==========================================================================
	// Navigation / Focus Helpers
	// ==========================================================================

	/**
	 * Check if a specific cell is currently focused
	 */
	isCellFocused(rowIndex: number, colIndex: number): boolean {
		return this._focusedCell?.rowIndex === rowIndex && this._focusedCell?.colIndex === colIndex
	}

	/**
	 * Get the currently focused cell
	 */
	get focusedCell(): FocusedCell {
		return this._focusedCell
	}

	/**
	 * Set focus to a specific cell (state only, DOM focus handled by GridElement)
	 * NOTE: Does NOT call requestUpdate() - GridElement handles DOM updates surgically
	 */
	setFocusedCell(rowIndex: number, colIndex: number): void {
		const prev = this._focusedCell
		const next: FocusedCell = { rowIndex, colIndex }
		if (prev?.rowIndex === next.rowIndex && prev?.colIndex === next.colIndex) return
		this._focusedCell = next
		this._onInteractionChange?.('focusedCell', { prev, current: next })
		// Don't call requestUpdate() - focus updates are handled surgically in GridElement
	}

	/**
	 * Clear the focused cell
	 * NOTE: Does NOT call requestUpdate() - GridElement handles DOM updates surgically
	 */
	clearFocusedCell(): void {
		const prev = this._focusedCell
		if (prev === null) return
		this._focusedCell = null
		this._onInteractionChange?.('focusedCell', { prev, current: null })
		// Don't call requestUpdate() - focus updates are handled surgically in GridElement
	}

	/** Tab traversal start column for Excel-like Enter behavior */
	get tabTraversalStartColIndex(): number | null { return this._tabTraversalStartColIndex }
	set tabTraversalStartColIndex(value: number | null) { this._tabTraversalStartColIndex = value }

	/**
	 * Set the hovered row index (for toolbar/shortcuts)
	 * NOTE: Does NOT call requestUpdate() - GridElement handles UI updates
	 */
	setHoveredRow(rowIndex: number | null): void {
		if (this._hoveredRowIndex === rowIndex) return
		const prev = this._hoveredRowIndex
		this._hoveredRowIndex = rowIndex
		this._onInteractionChange?.('hoveredRow', { prev, current: rowIndex })
	}

	// ==========================================================================
	// Row Focus (for master/detail patterns)
	// ==========================================================================

	get focusedRowIndex(): number | null { return this._focusedRowIndex }
	set focusedRowIndex(value: number | null) {
		if (value === null) {
			this.clearRowFocus()
		} else {
			this.setFocusedRow(value)
		}
		this.requestUpdate()
	}

	/**
	 * Check if a row is currently focused
	 */
	isRowFocused(rowIndex: number): boolean {
		return this._focusedRowIndex === rowIndex
	}

	/**
	 * Clear the focused row
	 * NOTE: Does NOT call requestUpdate() - caller handles DOM updates
	 */
	clearRowFocus(): void {
		if (this._focusedRowIndex === null) return
		const prev = this._focusedRowIndex
		this._focusedRowIndex = null
		this._onInteractionChange?.('focusedRow', { prev, current: null })
	}

	/**
	 * Set the focused row (fires callback if row changed)
	 * Called internally when a cell is focused/clicked
	 * NOTE: Does NOT call requestUpdate() - caller handles DOM updates surgically
	 */
	setFocusedRow(rowIndex: number): void {
		if (this._focusedRowIndex === rowIndex) return
		interactionLogger.debug('setFocusedRow:', rowIndex, '(prev:', this._focusedRowIndex, ')')
		const previousRowIndex = this._focusedRowIndex
		this._focusedRowIndex = rowIndex
		this._onInteractionChange?.('focusedRow', { prev: previousRowIndex, current: rowIndex })

		const row = this.displayItems[rowIndex]
		if (row) this.notify('row-focus', { rowIndex, row, previousRowIndex })
	}

	// ==========================================================================
	// Row Identification
	// ==========================================================================

	/**
	 * The row's id: `getIdCallback({ row })` when set, else the `idMember` field
	 * (default `'id'`). `undefined` when neither yields one.
	 */
	getRowId(row: T): unknown | undefined {
		if (this._getIdCallback) {
			return this._getIdCallback(this.ctx({ row }))
		}
		if (this._idMember && row && typeof row === 'object') {
			return (row as Record<string, unknown>)[this._idMember]
		}
		return undefined
	}

	/**
	 * Find a row by its ID
	 */
	findRowById(id: unknown): { row: T; index: number } | null {
		const index = this._items.findIndex(row => this.getRowId(row) === id)
		if (index === -1) return null
		return { row: this._items[index], index }
	}

	// ==========================================================================
	// Row Locking
	// ==========================================================================

	/**
	 * Get lock info for a row (combines all sources: external, callback, property)
	 */
	getRowLockInfo(rowOrId: T | unknown): RowLock | null {
		let row: T | undefined
		let id: unknown
		let rowIndex: number = -1

		// Determine if input is a row object or an ID
		if (typeof rowOrId === 'object' && rowOrId !== null) {
			row = rowOrId as T
			id = this.getRowId(row)
			rowIndex = this._items.indexOf(row)
			if (rowIndex === -1) {
				// Row might be from displayItems
				rowIndex = this.displayItems.indexOf(row)
			}
		} else {
			id = rowOrId
			const found = this.findRowById(id)
			if (found) {
				row = found.row
				rowIndex = found.index
			}
		}

		// 1. Check external locks first (highest priority - real-time)
		if (id !== undefined && this._externalLocks.has(id)) {
			return this._externalLocks.get(id)!
		}

		// If no row object, can't check property/callback sources
		if (!row) return null

		const opts = this._rowLocking
		if (!opts) return null

		// 2. Callback-based sources
		if (opts.getLockInfoCallback) {
			const info = opts.getLockInfoCallback(this.rowCtx(row, rowIndex))
			if (info?.isLocked) return info
		}
		if (opts.getIsLockedCallback) {
			if (opts.getIsLockedCallback(this.rowCtx(row, rowIndex))) {
				return { isLocked: true }
			}
		}

		// 3. Property-based sources
		if (opts.lockInfoMember) {
			const info = (row as Record<string, unknown>)[String(opts.lockInfoMember)] as RowLock | undefined
			if (info?.isLocked) return info
		}
		if (opts.lockedMember) {
			const locked = (row as Record<string, unknown>)[String(opts.lockedMember)]
			if (locked) return { isLocked: true }
		}

		return null
	}

	/**
	 * Check if a row is locked
	 */
	isRowLocked(rowOrId: T | unknown): boolean {
		const lockInfo = this.getRowLockInfo(rowOrId)
		return lockInfo?.isLocked === true
	}

	/**
	 * Lock a row by ID (external lock for WebSocket scenarios)
	 */
	lockRowById(id: unknown, lockerInfo?: Partial<RowLock>): boolean {
		const lockInfo: RowLock = {
			isLocked: true,
			lockedBy: lockerInfo?.lockedBy,
			lockedAt: lockerInfo?.lockedAt ?? new Date(),
			reason: lockerInfo?.reason,
			...lockerInfo
		}
		this._externalLocks.set(id, lockInfo)

		// Cancel editing if the locked row is currently being edited
		const found = this.findRowById(id)
		if (found && this._editingCell && this._editingCell.rowIndex === found.index) {
			this.cancelEdit()
		}

		this.requestUpdate()

		this.notify('row-lock-change', {
			rowId: id,
			row: found?.row ?? null,
			rowIndex: found?.index ?? -1,
			lockInfo,
			source: 'external'
		})

		return true
	}

	/**
	 * Unlock a row by ID
	 */
	unlockRowById(id: unknown): boolean {
		const wasLocked = this._externalLocks.has(id)
		this._externalLocks.delete(id)
		if (wasLocked) {
			this.requestUpdate()

			const found = this.findRowById(id)
			this.notify('row-lock-change', {
				rowId: id,
				row: found?.row ?? null,
				rowIndex: found?.index ?? -1,
				lockInfo: null,
				source: 'external'
			})
		}
		return wasLocked
	}

	/**
	 * Get all external locks (for debugging/inspection)
	 */
	getExternalLocks(): Map<unknown, RowLock> {
		return new Map(this._externalLocks)
	}

	/**
	 * Clear all external locks
	 */
	clearExternalLocks(): void {
		this._externalLocks.clear()
		this.requestUpdate()
	}

	// ==========================================================================
	// Row Update Methods (for WebSocket/external updates)
	// ==========================================================================

	/**
	 * Update a row's data by ID (partial update, preserves other fields)
	 */
	updateRowById(id: unknown, newData: Partial<T>): boolean {
		const found = this.findRowById(id)
		if (!found) return false

		// Update original data
		Object.assign(this._items[found.index], newData)

		// Update draft if exists
		const draft = this._draftRows.get(this.draftKey(found.row))
		if (draft) {
			Object.assign(draft, newData)
		}

		this.requestUpdate()
		return true
	}

	/**
	 * Replace entire row by ID
	 */
	replaceRowById(id: unknown, newRow: T): boolean {
		const found = this.findRowById(id)
		if (!found) return false

		this._items[found.index] = newRow

		// Clear draft for this row (data was replaced externally)
		this._draftRows.delete(this.draftKey(found.row))

		this.requestUpdate()
		return true
	}

	// ==========================================================================
	// Row Operations (the add / delete / duplicate / move-up / move-down built-ins)
	// ==========================================================================

	/** Insert `row` after `afterRow` (in `items` order), or at the end. */
	insertRow(row: T, afterRow?: T | null): void {
		const at = afterRow == null ? -1 : this._items.indexOf(afterRow)
		const next = [...this._items]
		next.splice(at === -1 ? next.length : at + 1, 0, row)
		this.items = next
	}

	/** Remove the given rows from `items`. */
	removeRows(rows: T[]): void {
		if (!rows.length) return
		const drop = new Set<T>(rows)
		this.items = this._items.filter(r => !drop.has(r))
	}

	/**
	 * Insert a copy of `row` after it — `createDuplicateRowCallback`'s, else a shallow
	 * copy with the `idMember` field cleared; returns the copy.
	 */
	duplicateRow(row: T): T {
		let copy: T
		if (this._createDuplicateRowCallback) {
			copy = this._createDuplicateRowCallback(this.rowCtx(row, this.displayItems.indexOf(row)))
		} else {
			const plain = { ...(row as object) } as Record<string, unknown>
			if (this._idMember) delete plain[this._idMember]
			copy = plain as T
		}
		this.insertRow(copy, row)
		return copy
	}

	/** Move `row` one displayed position up (`-1`) or down (`1`) — swaps it with that neighbour in `items`. */
	moveRow(row: T, delta: -1 | 1): void {
		const display = this.displayItems
		const pos = display.indexOf(row)
		const neighbour = pos === -1 ? undefined : display[pos + delta]
		if (neighbour === undefined) return
		const a = this._items.indexOf(row)
		const b = this._items.indexOf(neighbour)
		if (a === -1 || b === -1) return
		const next = [...this._items]
		next[a] = neighbour
		next[b] = row
		this.items = next
	}

	// ==========================================================================
	// Edit Lock Checking
	// ==========================================================================

	/**
	 * Check if a cell can be edited (respects lock state)
	 */
	canEditCell(rowIndex: number, field: string): boolean {
		const column = this._columns.find(c => String(c.field) === field)
		if (!column) return false

		const item = this.displayItems[rowIndex]
		if (!item) return false

		if (!this.isCellEditable(column, item)) return false

		const lockInfo = this.getRowLockInfo(item)
		if (!lockInfo?.isLocked) return true  // Not locked

		const opts = this._rowLocking
		const behavior = opts?.lockedEditBehavior ?? 'block'

		switch (behavior) {
			case 'allow':
				return true
			case 'callback':
				return opts?.getCanEditLockedCallback?.(this.ctx({ row: item, rowIndex, lockInfo })) ?? false
			case 'block':
			default:
				return false
		}
	}

	// ==========================================================================
	// Column Width Management
	// ==========================================================================

	/**
	 * Get runtime column width override (or undefined if using column definition)
	 */
	getColumnWidth(field: string): string | undefined {
		return this._columnWidths.get(field)
	}

	/**
	 * Set runtime column width override
	 * @param skipRender - If true, don't trigger a re-render (useful during resize when DOM is already updated)
	 */
	setColumnWidth(field: string, width: string, skipRender = false): void {
		this._columnWidths.set(field, width)
		if (!skipRender) {
			this.requestUpdate()
		}
	}

	/**
	 * Set multiple column widths at once (for restoring saved state)
	 * Accepts the same format as the column-resize detail's allWidths
	 */
	setColumnWidths(widths: ColumnWidthState[]): void {
		for (const { field, width } of widths) {
			if (field && width) {
				this._columnWidths.set(field, width)
			}
		}
		if (this._shouldPersistColumnWidths) this.savePersistedState()
		this.requestUpdate()
	}

	/**
	 * Get all column widths state (for persistence/callback)
	 */
	getColumnWidthsState(): ColumnWidthState[] {
		return this._columns.map(column => {
			const field = String(column.field)
			const width = this._columnWidths.get(field) || column.width || ''
			return { field, width }
		}).filter(cw => cw.width)  // Only include columns with widths
	}

	/**
	 * Load column widths from localStorage
	 */
	loadPersistedWidths(): void {
		this.loadPersistedState()
	}

	/**
	 * Save column widths to localStorage
	 */
	savePersistedWidths(): void {
		this.savePersistedState()
	}

	/**
	 * Load persisted state (widths, order) from localStorage
	 * Automatically cleans up orphaned entries for columns that no longer exist
	 */
	loadPersistedState(): void {
		if (!this._gridName || typeof localStorage === 'undefined') return
		// No columns yet (e.g. gridName / persist flags set before `columns`): every stored
		// entry would look orphaned and be pruned. Defer until the columns arrive.
		if (this._columns.length === 0) {
			this._isPersistedStateLoadPending = true
			return
		}
		this._isPersistedStateLoadPending = false

		try {
			const key = `wg-${this._gridName}-state`
			const stored = localStorage.getItem(key)
			if (!stored) return

			const state: GridPersistenceState = JSON.parse(stored)

			// Get set of valid field names from current columns
			const validFields = new Set(this._columns.map(c => String(c.field)))
			let needsCleanup = false

			if (state.columnWidths) {
				this._columnWidths.clear()
				for (const cw of state.columnWidths) {
					if (validFields.has(cw.field)) {
						this._columnWidths.set(cw.field, cw.width)
					} else {
						needsCleanup = true
					}
				}
			}
			if (state.columnOrder) {
				this._columnOrder.clear()
				for (const co of state.columnOrder) {
					if (validFields.has(co.field)) {
						this._columnOrder.set(co.field, co.order)
					} else {
						needsCleanup = true
					}
				}
			}

			// Re-save cleaned state if orphaned entries were removed
			if (needsCleanup) {
				this.savePersistedState()
			}
		} catch (e) {
			dataLogger.warn('Failed to load persisted state', e)
		}
	}

	/**
	 * Save persisted state (widths, order) to localStorage
	 */
	savePersistedState(): void {
		if (!this._gridName || typeof localStorage === 'undefined') return

		try {
			const key = `wg-${this._gridName}-state`
			const state: GridPersistenceState = {}
			if (this._shouldPersistColumnWidths) {
				state.columnWidths = this.getColumnWidthsState()
			}
			if (this._shouldPersistColumnOrder) {
				state.columnOrder = this.getColumnOrderState()
			}
			localStorage.setItem(key, JSON.stringify(state))
		} catch (e) {
			dataLogger.warn('Failed to save persisted state', e)
		}
	}

	// ==========================================================================
	// Column Order Management
	// ==========================================================================

	/**
	 * Get runtime column order override (or undefined if using original order)
	 */
	getColumnOrder(field: string): number | undefined {
		return this._columnOrder.get(field)
	}

	/**
	 * Set multiple column orders at once (for restoring saved state)
	 * Accepts the same format as the column-reorder detail's allOrder
	 */
	setColumnOrder(order: ColumnOrderState[]): void {
		this._columnOrder.clear()
		for (const { field, order: orderValue } of order) {
			if (field !== undefined && orderValue !== undefined) {
				this._columnOrder.set(field, orderValue)
			}
		}
		if (this._shouldPersistColumnOrder) this.savePersistedState()
		this.requestUpdate()
	}

	/**
	 * Get all column order state (for persistence/callback)
	 * Returns only non-frozen columns in their visual order
	 */
	getColumnOrderState(): ColumnOrderState[] {
		const visualCols = this.visualColumns
		const frozenCount = this.totalFrozenColumns

		// Only return order for non-frozen columns
		return visualCols.slice(frozenCount).map((vc, index) => ({
			field: String(vc.column.field),
			order: index
		}))
	}

	/**
	 * Move a column to a new visual index (among non-frozen columns)
	 * Used by the reorder drag handler
	 */
	moveColumn(field: string, toIndex: number): void {
		const visualCols = this.visualColumns
		const frozenCount = this.totalFrozenColumns
		const nonFrozenCols = visualCols.slice(frozenCount)

		// Find the current index of the column being moved
		const fromIndex = nonFrozenCols.findIndex(vc => String(vc.column.field) === field)
		if (fromIndex === -1 || fromIndex === toIndex) return

		// Build new order: assign order numbers based on new positions
		this._columnOrder.clear()
		const reordered = [...nonFrozenCols]
		const [moved] = reordered.splice(fromIndex, 1)
		reordered.splice(toIndex, 0, moved)

		reordered.forEach((vc, index) => {
			this._columnOrder.set(String(vc.column.field), index)
		})

		this.requestUpdate()
	}
}

export default GridEngine

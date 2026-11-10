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
	GridPreset,
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
	CellSelectionChangeDetail,
	PasteMode,
	CreateRowCallback,
	NewRowPosition,
	ChevronCallback,
	TreeDoubleClickBehavior,
	ExpandOptions
} from './types.js'
import type {
	GridController,
	GridContext,
	RowContext,
	RowDataContext,
	CellContext,
	SelectedColumn,
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
	GridEventName,
	DraftInfo,
	BeforePageChangeContext
} from './interaction.js'

// Internal tree index — built from items when pathMember is set
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

/** A commit's validation result (see `GridEngine.commitEdit`). */
type CommitOutcome = { isValid: boolean; validationError: string | null; finalValue: unknown }
/** The cell a commit writes to, captured when the edit was committed. */
type CommitTarget<T> = {
	item: T
	rowIndex: number
	field: string
	oldValue: unknown
	isEmptyRow: boolean
	commitEmptyRow: boolean
	source: 'edit' | 'paste'
}
const isThenable = (v: unknown): v is PromiseLike<unknown> =>
	!!v && (typeof v === 'object' || typeof v === 'function') && typeof (v as { then?: unknown }).then === 'function'

import type { StateStore } from '@keenmate/web-components-core'
// Date formatting utilities for auto-formatting date columns
import { parseFormat, formatDate } from './modules/datepicker/index.js'
import { bindOptionContext } from './modules/dropdown/options.js'

// Logging
import { initLogger, dataLogger, interactionLogger, perfLogger } from './logger.js'
import { typeNumberValue } from './modules/editing/value-parse.js'
import { resolveLabels, formatLabel } from './labels.js'

// Perf instrumentation (temporary — investigating tree-toggle slowness)
import { gridPerf } from './perf.js'


/** The settings a `preset` also sets. Shared by the engine's `preset`
 * setter and the element's `preset` input (`getBatchValuesCallback`). */
export const GRID_PRESETS: Record<GridPreset, {
	isEditingEnabled?: boolean
	isReadonly?: boolean
	editTrigger?: EditTrigger
	dropdownToggleVisibility?: ToggleVisibility
	shouldOpenDropdownOnFocus?: boolean
	cellSelectionMode?: CellSelectionMode
}> = {
	// No editing, click to select cells
	'read-only': { isEditingEnabled: false, isReadonly: true, dropdownToggleVisibility: 'on-focus', cellSelectionMode: 'click' },
	// Excel-like: click+drag to select
	'excel': { isEditingEnabled: true, isReadonly: false, editTrigger: 'navigate', dropdownToggleVisibility: 'always', shouldOpenDropdownOnFocus: false, cellSelectionMode: 'click' },
	// Avoid conflict with always-editing cells
	'input-matrix': { isEditingEnabled: true, isReadonly: false, editTrigger: 'always', dropdownToggleVisibility: 'always', shouldOpenDropdownOnFocus: true, cellSelectionMode: 'shift' },
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
	protected _isFilteringEnabled: boolean = false
	protected _isPagingEnabled: boolean = false
	protected _pageSize: number = 10
	protected _pageSizes: number[] = [10, 25, 50, 100]
	protected _paginationMode: 'client' | 'server' = 'client'
	protected _isStriped: boolean = true
	protected _isHoverable: boolean = true
	protected _isEditingEnabled: boolean = false
	protected _isRowEditable: boolean | undefined = undefined
	protected _getIsRowEditableCallback: ((ctx: RowDataContext<T>) => boolean) | undefined = undefined
	protected _editTrigger: EditTrigger = "dblclick"
	protected _editButtonIcon: string = '✎'
	protected _editStartSelection: EditStartSelection = "mouse-position"
	protected _shouldCommitOnClickAway: boolean = true
	protected _preset: GridPreset = "excel"
	protected _isReadonly: boolean = false
	protected _isDisabled: boolean = false
	protected _dropdownToggleVisibility: ToggleVisibility = "always"
	protected _shouldOpenDropdownOnFocus: boolean = true
	protected _shouldOpenDropdownOnEnter: boolean = false
	protected _isCheckboxAlwaysEditable: boolean = false
	protected _isRowNumbersShown: boolean = false
	protected _isStickyRowNumbers: boolean = false
	protected _frozenColumnCount: number = 0
	protected _invalidCells: CellValidationState[] = []
	protected _isDirtyIndicatorShown: boolean = true
	protected _isRowToolbarShown: boolean = false
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
	protected _contextMenu: GridMenuEntry<T>[] | undefined = undefined
	protected _contextMenuXOffset: number = 8
	protected _contextMenuYOffset: number = 0
	protected _headerContextMenu: GridHeaderMenuEntry<T>[] | undefined = undefined
	protected _rowShortcuts: GridShortcut<T>[] | undefined = undefined
	protected _isShortcutsHelpShown: boolean = false
	protected _shortcutsHelpPosition: 'top-right' | 'top-left' = 'top-right'
	protected _renderShortcutsHelpCallback: ((ctx: GridContext<T>) => string) | undefined = undefined

	// Row identification (the member is `_idMember`, below)
	protected _getIdCallback: ((ctx: RowDataContext<T>) => unknown) | undefined = undefined

	// Row locking
	protected _rowLocking: RowLockingOptions<T> | undefined = undefined
	protected _externalLocks: Map<unknown, RowLock> = new Map()

	// Column resize & persistence
	/** Persisted UI state (core createStateStore(), SPEC §12.17) — injected by the element. */
	protected _stateStore: StateStore<GridPersistenceState> | null = null
	/** Bumped per load: a slower earlier load never applies over a newer one. */
	protected _persistLoadToken = 0
	protected _shouldPersistColumnWidths: boolean = false
	protected _columnWidths: Map<string, string> = new Map()  // Runtime width overrides

	// Column reorder & persistence
	protected _isColumnReorderAllowed: boolean = false
	protected _shouldPersistColumnOrder: boolean = false
	protected _columnOrder: Map<string, number> = new Map()  // Runtime order overrides

	// Fill handle
	protected _fillDirection: FillDirection = 'vertical'
	protected _beforeFillCallback: ((ctx: FillContext<T>) => boolean | void | Promise<boolean | void>) | undefined = undefined
	protected _beforePageChangeCallback: ((ctx: BeforePageChangeContext<T>) => boolean | number | void | Promise<boolean | number | void>) | undefined = undefined
	/** A `beforePageChangeCallback` is pending — the pager is disabled, further navigation ignored. */
	isPageChangePending: boolean = false

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
	protected _isPageSetInTask: boolean = false
	protected _totalItems: number | null = null  // null = use items.length (client-side)
	protected _isPaginationShown: boolean | 'auto' = true
	protected _paginationPosition: string = 'bottom-center'
	protected _getPaginationLabelsCallback?: PaginationLabelsCallback<T>
	protected _paginationLayout: string = 'page-size|previous|page-info|next'

	// Summary
	protected _summaryPosition?: string
	protected _renderSummaryCallback?: SummaryCallback<T>
	protected _summaryMetadata: unknown = undefined
	protected _isSummaryInline: boolean = true

	protected _getRowClassCallback?: (ctx: RowContext<T>) => string | null

	// Labels/i18n
	protected _labels: GridLabels = resolveLabels(null)

	// Scroll behavior
	protected _isScrollable: boolean = false
	protected _scrollMaxHeight: string = '100vh'
	protected _isTableBorderOnly: boolean = false

	// Virtual scroll
	protected _isVirtualScrollEnabled: boolean = false
	protected _virtualScrollThreshold: number = 100
	protected _virtualScrollItemHeight: number = 38
	protected _virtualScrollOverscan: number = 10

	// Infinite scroll
	protected _isInfiniteScrollEnabled: boolean = false
	protected _infiniteScrollThreshold: number = 100
	protected _hasMoreItems: boolean = true
	protected _isLoadingMore: boolean = false

	// Editing
	protected _editingCell: EditingCell = null
	protected _currentCellError: string | null = null
	protected _isValidating: boolean = false
	/** Commits whose validation result is still to be applied (async `validateCallback`). */
	protected _pendingCommits = 0
	/** The pending commits, chained so their results apply in commit order. */
	protected _commitChain: Promise<void> = Promise.resolve()
	/** A deferred commit's result was applied to (rowIndex, field) — the element re-renders that cell. */
	protected _onCommitApplied: ((rowIndex: number, field: string) => void) | null = null
	/** Drafts keyed by row identity (see `draftKey`) — they follow their row through sort / page / filter. */
	protected _draftRows: Map<unknown, T> = new Map()
	/** The row each draft was made from (by the same key) — lists drafts of rows no longer in `items`. */
	protected _draftOrigins: Map<unknown, T> = new Map()
	protected _hasWarnedAboutServerDrafts: boolean = false
	protected _isServerDraftsCheckPending: boolean = false
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
	protected _selectedRowIndices: Set<number> = new Set()
	protected _lastSelectedRowIndex: number | null = null  // For Shift+Click range selection
	protected _rangeShortcuts: GridRangeShortcut<T>[] = []

	// Cell range selection state
	protected _cellSelectionMode: CellSelectionMode = 'click'
	protected _selectedCellRange: CellRange | null = null
	protected _lastClickedCell: { rowIndex: number, colIndex: number } | null = null
	protected _shouldCopyWithHeaders: boolean = false

	// Column selection state (like row selection, supports non-contiguous). VISUAL
	// positions (indices into `visualColumns`), like a CellRange; the public API
	// takes / returns column indices (index into `columns`) and converts.
	protected _selectedColumns: Set<number> = new Set()
	protected _lastSelectedColumnIndex: number = -1  // visual position (range anchor)

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
	protected _pathMember: string | null = null
	protected _levelMember: string | null = null
	protected _parentPathMember: string | null = null
	protected _idMember: string | null = 'id'
	protected _hasWarnedAboutMissingRowId: boolean = false
	protected _treePathSeparator: string | null = null  // null = auto-detect
	protected _isTreeDataSorted: boolean = false
	protected _expandedPaths: Set<string> = new Set()       // Active set used for visibility checks
	protected _hasExplicitExpandedPaths = false              // expandedPaths was assigned: items changes keep the current state
	protected _expandLevel: number | null = null
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
		// The edited row (read before the replace: `cell-edit-cancel` carries it if it goes)
		const editing = this._editingCell
		const editedRow = editing ? this.displayItems[editing.rowIndex] : undefined
		// Drafts are never pruned here: with server paging a missing row is "another
		// page". They leave via replaceRowById / discardDraft / discardAllDrafts.
		this._items = value
		this.maybeWarnAboutServerDrafts()
		this.invalidateDisplayCache()
		this._treeChevronCache = new WeakMap()  // rows replaced → drop cached glyphs
		this.rebuildTreeState()
		// The edited row is gone (the new data has no row at its index): the edit can't go on —
		// cancel it (closes its dropdown / date picker), not a dangling edit with no editor
		if (editing && this._editingCell === editing && editing.rowIndex >= this.displayItems.length) {
			this.cancelEditOn(editedRow)
		}
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

	get isFilteringEnabled(): boolean { return this._isFilteringEnabled }
	set isFilteringEnabled(value: boolean) {
		this._isFilteringEnabled = value
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

	get isPagingEnabled(): boolean { return this._isPagingEnabled }
	set isPagingEnabled(value: boolean) {
		this._isPagingEnabled = value
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
		this.maybeWarnAboutServerDrafts()
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

	get isEditingEnabled(): boolean { return this._isEditingEnabled }
	set isEditingEnabled(value: boolean) {
		this._isEditingEnabled = value
		this.checkEditTriggerConflicts()
		this.maybeWarnAboutRowIdentity()
		this.maybeWarnAboutServerDrafts()
		this.requestUpdate()
	}

	/** Values can't change (no editing, paste, fill, row add / delete / move); still focusable, selectable, copyable. */
	get isReadonly(): boolean { return this._isReadonly }
	set isReadonly(value: boolean) {
		this._isReadonly = !!value
		if (this._isReadonly) this.cancelEdit()
		this.requestUpdate()
	}

	/** No interaction at all (not focusable). */
	get isDisabled(): boolean { return this._isDisabled }
	set isDisabled(value: boolean) {
		this._isDisabled = !!value
		if (this._isDisabled) this.cancelEdit()
		this.requestUpdate()
	}

	/** Grid-level editing is on and neither `isReadonly` nor `isDisabled` blocks it. */
	get isEffectivelyEditable(): boolean { return this._isEditingEnabled && !this._isReadonly && !this._isDisabled }

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

	/** HTML of the edit button (`editTrigger: 'button'` / `column.isEditButtonShown`). */
	get editButtonIcon(): string { return this._editButtonIcon }
	set editButtonIcon(value: string) {
		this._editButtonIcon = value
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

	get preset(): GridPreset { return this._preset }
	set preset(value: GridPreset) {
		this._preset = value
		this.applyPresetDefaults()
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

	get shouldOpenDropdownOnFocus(): boolean { return this._shouldOpenDropdownOnFocus }
	set shouldOpenDropdownOnFocus(value: boolean) {
		this._shouldOpenDropdownOnFocus = value
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

	get isRowNumbersShown(): boolean { return this._isRowNumbersShown }
	set isRowNumbersShown(value: boolean) {
		this._isRowNumbersShown = value
		this.requestUpdate()
	}

	get isDirtyIndicatorShown(): boolean { return this._isDirtyIndicatorShown }
	set isDirtyIndicatorShown(value: boolean) {
		this._isDirtyIndicatorShown = value
		this.requestUpdate()
	}

	get isStickyRowNumbers(): boolean { return this._isStickyRowNumbers }
	set isStickyRowNumbers(value: boolean) {
		this._isStickyRowNumbers = value
		this.requestUpdate()
	}

	get frozenColumnCount(): number { return this._frozenColumnCount }
	set frozenColumnCount(value: number) {
		this._frozenColumnCount = Math.max(0, Math.floor(value))
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

		// Now handle frozenColumnCount - these freeze the first N non-explicitly-frozen columns
		// They should stay at the front of normalCols and NOT be reorderable
		const positionalFrozenCols: Array<{ column: Column<T>; originalIndex: number }> = []
		const reorderableCols: Array<{ column: Column<T>; originalIndex: number }> = []

		normalCols.forEach((entry, idx) => {
			if (idx < this._frozenColumnCount) {
				// This column is frozen by position (frozenColumnCount prop)
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
	 * Visual position (index into `visualColumns`) of a column index (`data-col`,
	 * the index into `columns`). -1 when the column is hidden / unknown.
	 */
	visualIndexOfColumn(colIndex: number): number {
		return this.visualColumns.findIndex(v => v.originalIndex === colIndex)
	}

	/**
	 * Get the total number of frozen columns (from frozen: true + frozenColumnCount prop).
	 */
	get totalFrozenColumns(): number {
		const explicitlyFrozen = this._columns.filter(c => c.isFrozen).length
		return explicitlyFrozen + this._frozenColumnCount
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

	get isRowToolbarShown(): boolean { return this._isRowToolbarShown }
	set isRowToolbarShown(value: boolean) {
		this._isRowToolbarShown = value
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

	get isShortcutsHelpShown(): boolean { return this._isShortcutsHelpShown }
	set isShortcutsHelpShown(value: boolean) {
		this._isShortcutsHelpShown = value
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
		// A page set in the same task as a filter change wins over the filter's
		// page-1 reset (a restored page + filter at init survive together).
		this._isPageSetInTask = true
		queueMicrotask(() => { this._isPageSetInTask = false })
		this.requestUpdate()
	}

	get totalItems(): number | null { return this._totalItems }
	set totalItems(value: number | null) {
		this._totalItems = value
		this.requestUpdate()
	}

	get isPaginationShown(): boolean | 'auto' { return this._isPaginationShown }
	set isPaginationShown(value: boolean | 'auto') {
		this._isPaginationShown = value
		this.requestUpdate()
	}


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
			? formatLabel(this._labels.rowLockedBy, { lockedBy: String(lockInfo.lockedBy) })
			: this._labels.rowLocked
	}

	set labels(value: GridLabelsInput | null | undefined) {
		// Per key over the English defaults (nested groups too) — see labels.ts
		this._labels = resolveLabels(value)
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

	get virtualScrollItemHeight(): number { return this._virtualScrollItemHeight }
	set virtualScrollItemHeight(value: number) {
		this._virtualScrollItemHeight = value
		this.requestUpdate()
	}

	get virtualScrollOverscan(): number { return this._virtualScrollOverscan }
	set virtualScrollOverscan(value: number) {
		this._virtualScrollOverscan = value
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

	get beforePageChangeCallback(): ((ctx: BeforePageChangeContext<T>) => boolean | number | void | Promise<boolean | number | void>) | undefined { return this._beforePageChangeCallback }
	set beforePageChangeCallback(value: ((ctx: BeforePageChangeContext<T>) => boolean | number | void | Promise<boolean | number | void>) | undefined) {
		this._beforePageChangeCallback = value
	}

	get beforeFillCallback(): ((ctx: FillContext<T>) => boolean | void | Promise<boolean | void>) | undefined { return this._beforeFillCallback }
	set beforeFillCallback(value: ((ctx: FillContext<T>) => boolean | void | Promise<boolean | void>) | undefined) {
		this._beforeFillCallback = value
	}

	// Row selection
	/** Display indices of the selected rows, ascending. */
	get selectedRowIndices(): number[] {
		return Array.from(this._selectedRowIndices).sort((a, b) => a - b)
	}

	/** The selected row objects, in display order. */
	get selectedRows(): T[] {
		return this.selectedRowIndices.map(idx => this.displayItems[idx]).filter(Boolean)
	}

	get rangeShortcuts(): GridRangeShortcut<T>[] { return this._rangeShortcuts }
	set rangeShortcuts(value: GridRangeShortcut<T>[]) {
		this._rangeShortcuts = value ?? []
		this.requestUpdate()  // the shortcuts help lists them
	}

	isRowSelected(rowIndex: number): boolean {
		return this._selectedRowIndices.has(rowIndex)
	}

	selectRow(rowIndex: number, mode: 'replace' | 'toggle' | 'range' = 'replace'): void {
		interactionLogger.debug('selectRow:', { rowIndex, mode })
		this.trackSelection(() => this.selectRowState(rowIndex, mode))
		this.requestUpdate()
	}

	private selectRowState(rowIndex: number, mode: 'replace' | 'toggle' | 'range'): void {
		// Clear cell and column selection when selecting rows
		if (this._selectedCellRange) {
			this._selectedCellRange = null
		}
		this._selectedColumns.clear()

		switch (mode) {
			case 'replace':
				this._selectedRowIndices.clear()
				this._selectedRowIndices.add(rowIndex)
				this._lastSelectedRowIndex = rowIndex
				break
			case 'toggle':
				if (this._selectedRowIndices.has(rowIndex)) {
					this._selectedRowIndices.delete(rowIndex)
				} else {
					this._selectedRowIndices.add(rowIndex)
				}
				this._lastSelectedRowIndex = rowIndex
				break
			case 'range':
				if (this._lastSelectedRowIndex !== null) {
					const start = Math.min(this._lastSelectedRowIndex, rowIndex)
					const end = Math.max(this._lastSelectedRowIndex, rowIndex)
					for (let i = start; i <= end; i++) {
						this._selectedRowIndices.add(i)
					}
				} else {
					this._selectedRowIndices.add(rowIndex)
					this._lastSelectedRowIndex = rowIndex
				}
				break
		}
	}

	selectRowRange(fromIndex: number, toIndex: number): void {
		this.trackSelection(() => {
			// Clear column selection when selecting rows
			this._selectedColumns.clear()
			this._selectedCellRange = null

			this._selectedRowIndices.clear()
			const start = Math.min(fromIndex, toIndex)
			const end = Math.max(fromIndex, toIndex)
			for (let i = start; i <= end; i++) {
				this._selectedRowIndices.add(i)
			}
			this._lastSelectedRowIndex = toIndex
		})
		this.requestUpdate()
	}

	/** Clear every selection kind — rows, the cell range and columns (one notification per kind that changed). */
	clearSelection(): void {
		if (this._selectedRowIndices.size === 0 && !this._selectedCellRange && this._selectedColumns.size === 0) return
		this.trackSelection(() => {
			this.clearRowSelection_noRender()
			this.clearCellSelection_noRender()
			this.clearColumnSelection_noRender()
		})
		this.requestUpdate()
	}

	/**
	 * Snapshot the row selection by row identity; the returned function re-points it
	 * at those rows after `items` changed under it (row built-ins): removed rows
	 * drop out, moved / shifted rows stay selected. Notifies only on a real change.
	 */
	keepRowSelection(): () => void {
		const display = this.displayItems
		const rows = this.selectedRowIndices.map(i => display[i]).filter(r => r !== undefined)
		const anchor = this._lastSelectedRowIndex === null ? undefined : display[this._lastSelectedRowIndex]
		return () => {
			if (rows.length === 0) return
			const now = this.displayItems
			const next = rows.map(r => now.indexOf(r)).filter(i => i >= 0)
			if (next.length === this._selectedRowIndices.size && next.every(i => this._selectedRowIndices.has(i))) return
			this.trackSelection(() => {
				this._selectedRowIndices.clear()
				for (const i of next) this._selectedRowIndices.add(i)
				const a = anchor === undefined ? -1 : now.indexOf(anchor)
				this._lastSelectedRowIndex = a >= 0 ? a : null
			})
			this.requestUpdate()
		}
	}

	/** Clear only the row selection. */
	clearRowSelection(): void {
		if (this._selectedRowIndices.size > 0) {
			this.clearRowSelection_noRender()
			this.requestUpdate()
		}
	}

	/** Clear row selection state without triggering re-render (caller handles visuals) */
	clearRowSelection_noRender(): void {
		this.trackSelection(() => {
			this._selectedRowIndices.clear()
			this._lastSelectedRowIndex = null
		})
	}

	// --------------------------------------------------------------------------
	// Selection-change notifications (`cell-selection-change`, `row-selection-change`,
	// `column-selection-change`): every mutation runs inside `trackSelection`, which
	// snapshots before / after and notifies only the kinds that actually changed —
	// once, at the outermost level. A pointer gesture (row / column drag) holds one
	// more level via `beginSelectionGesture()` … `endSelectionGesture()`, so a drag
	// notifies once on mouseup, not per mousemove.
	// --------------------------------------------------------------------------

	private _selectionDepth = 0
	private _selectionBefore: { range: string; rows: string; cols: string } | null = null
	private _isSelectionGestureOpen = false

	private selectionSnapshot(): { range: string; rows: string; cols: string } {
		const r = this._selectedCellRange
		return {
			range: r ? `${r.startRowIndex},${r.startColIndex},${r.endRowIndex},${r.endColIndex}` : '',
			rows: this.selectedRowIndices.join(','),
			cols: JSON.stringify(this.selectedColumnFields())
		}
	}

	/** Run a selection mutation; notifies the selection kinds it changed (outermost level only). */
	protected trackSelection(fn: () => void): void {
		if (this._selectionDepth++ === 0) this._selectionBefore = this.selectionSnapshot()
		try {
			fn()
		} finally {
			this.endSelectionLevel()
		}
	}

	private endSelectionLevel(): void {
		if (this._selectionDepth === 0 || --this._selectionDepth > 0) return
		const before = this._selectionBefore
		this._selectionBefore = null
		if (!before) return
		const after = this.selectionSnapshot()
		if (before.range !== after.range) this.notify('cell-selection-change', this.cellSelectionDetail())
		if (before.rows !== after.rows) {
			const rowIndices = this.selectedRowIndices
			this.notify('row-selection-change', { rows: rowIndices.map(i => this.displayItems[i]).filter(Boolean), rowIndices })
		}
		if (before.cols !== after.cols) this.notify('column-selection-change', { fields: this.selectedColumnFields() })
	}

	/**
	 * Hold selection-change notifications for a pointer gesture (row / column drag):
	 * they fire once, at `endSelectionGesture()`, when the selection changed overall.
	 * Opening a gesture while one is open closes the previous one first.
	 */
	beginSelectionGesture(): void {
		if (this._isSelectionGestureOpen) this.endSelectionGesture()
		this._isSelectionGestureOpen = true
		if (this._selectionDepth++ === 0) this._selectionBefore = this.selectionSnapshot()
	}

	endSelectionGesture(): void {
		if (!this._isSelectionGestureOpen) return
		this._isSelectionGestureOpen = false
		this.endSelectionLevel()
	}

	/** `cell-selection-change` detail for the current range. */
	private cellSelectionDetail(): CellSelectionChangeDetail<T> {
		const range = this._selectedCellRange
		if (!range) return { range: null, cellCount: 0, fields: [], rows: [] }
		const minRow = Math.min(range.startRowIndex, range.endRowIndex)
		const maxRow = Math.max(range.startRowIndex, range.endRowIndex)
		const minCol = Math.min(range.startColIndex, range.endColIndex)
		const maxCol = Math.max(range.startColIndex, range.endColIndex)
		const fields = this.visualColumns.slice(minCol, maxCol + 1).map(v => String(v.column.field))
		const rows = this.displayItems.slice(minRow, maxRow + 1)
		return { range, cellCount: fields.length * rows.length, fields, rows }
	}

	/** Fields of the selected columns, in on-screen order. */
	selectedColumnFields(): string[] {
		const visualCols = this.visualColumns
		const fields: string[] = []
		for (const pos of [...this._selectedColumns].sort((a, b) => a - b)) {
			const column = visualCols[pos]?.column
			if (column) fields.push(String(column.field))
		}
		return fields
	}

	/**
	 * Copy selected rows to clipboard in TSV format (Excel-compatible)
	 * @returns true if copy was successful, false if no selection or clipboard failed
	 */
	async copySelectedRowsToClipboard(): Promise<boolean> {
		const selectedIndices = this.selectedRowIndices
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
		const selectedColIndices = this.selectedColumnPositions  // visual positions
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
		// Editable grid without idMember/pathMember produces drift on reorder; warn once.
		this.maybeWarnAboutRowIdentity()
	}

	/**
	 * Return a stable string key for a row. Coalesce order: row id (getIdCallback / idMember) → pathMember
	 * value → displayed-index string fallback. Used to key drafts and invalid-cell markers
	 * so they don't drift when the displayed order changes (sort, filter, page, tree toggle).
	 *
	 * `getRowId` (the `getIdCallback` / `idMember` value, any type) stringified.
	 */
	getStableRowKey(item: T, displayedIndex: number): string {
		const id = this.getRowId(item)
		if (id !== undefined && id !== null) return String(id)
		if (this._pathMember) {
			const v = (item as Record<string, unknown>)[this._pathMember]
			if (v !== undefined && v !== null) return String(v)
		}
		return String(displayedIndex)
	}

	/** True when the row has an id (`getRowId`) or a tree path — i.e. its key is not the display index. */
	private hasStableIdentity(item: T): boolean {
		if (this.getRowId(item) != null) return true
		return !!this._pathMember && (item as Record<string, unknown>)[this._pathMember] != null
	}

	/**
	 * Server paging + editing needs a row id: drafts are keyed by it, and without one a
	 * draft can't find its row again after the page is swapped. Warn once.
	 */
	private maybeWarnAboutServerDrafts(): void {
		// Deferred: the config usually arrives as several property writes in one task
		// (items before idMember is fine).
		if (this._hasWarnedAboutServerDrafts || this._isServerDraftsCheckPending) return
		this._isServerDraftsCheckPending = true
		queueMicrotask(() => {
			this._isServerDraftsCheckPending = false
			this.checkServerDrafts()
		})
	}

	private checkServerDrafts(): void {
		if (this._hasWarnedAboutServerDrafts) return
		if (this._paginationMode !== 'server' || !this._isEditingEnabled || this._items.length === 0) return
		if (this.getRowId(this._items[0]) != null) return
		this._hasWarnedAboutServerDrafts = true
		initLogger.warn(
			'paginationMode="server" with editing, but the rows have no usable id ' +
			`(idMember ${this._idMember ? `"${this._idMember}" is missing on the rows` : 'is null'}, no getIdCallback). ` +
			'Drafts cannot follow their rows across pages — set idMember / getIdCallback.'
		)
	}

	private maybeWarnAboutRowIdentity(): void {
		if (this._hasWarnedAboutMissingRowId) return
		if (!this._isEditingEnabled) return
		if (this._idMember || this._getIdCallback || this._pathMember) return
		this._hasWarnedAboutMissingRowId = true
		initLogger.warn(
			'editable grid has no `idMember` (and no `pathMember`). ' +
			'Internal state (drafts, invalid-cell markers) will be keyed by displayed index, ' +
			'so re-ordering (sort, filter, pagination) can move state to the wrong row. ' +
			'Set `idMember` to the field that uniquely identifies each row.'
		)
	}

	// ==========================================================================
	// Tree / Hierarchy
	// ==========================================================================

	get pathMember(): string | null { return this._pathMember }
	set pathMember(value: string | null) {
		this._pathMember = value || null
		this.rebuildTreeState()
		this.requestUpdate()
	}

	get levelMember(): string | null { return this._levelMember }
	set levelMember(value: string | null) {
		this._levelMember = value || null
		this.rebuildTreeState()
		this.requestUpdate()
	}

	get parentPathMember(): string | null { return this._parentPathMember }
	set parentPathMember(value: string | null) {
		this._parentPathMember = value || null
		this.rebuildTreeState()
		this.requestUpdate()
	}

	get treePathSeparator(): string | null { return this._treePathSeparator }
	set treePathSeparator(value: string | null) {
		this._treePathSeparator = value || null
		this.rebuildTreeState()
		this.requestUpdate()
	}

	get isTreeDataSorted(): boolean { return this._isTreeDataSorted }
	set isTreeDataSorted(value: boolean) {
		this._isTreeDataSorted = value
		this.requestUpdate()
	}

	/**
	 * The expanded tree paths. Reading returns a copy; assigning replaces the
	 * expanded state (no events). `null` / `undefined` → back to the `expandLevel`
	 * default.
	 */
	get expandedPaths(): string[] { return [...this._expandedPaths] }
	set expandedPaths(value: string[] | null | undefined) {
		this._hasExplicitExpandedPaths = Array.isArray(value)
		if (Array.isArray(value)) this._expandedPaths = new Set(value)
		else this.rebuildExpandedPaths()
		this.requestUpdate()
	}

	/** How many tree paths are expanded (cheap — no copy). */
	get expandedPathCount(): number { return this._expandedPaths.size }

	get expandLevel(): number | null { return this._expandLevel }
	set expandLevel(value: number | null) {
		this._expandLevel = (typeof value === 'number' && value >= 0) ? value : null
		// Only re-init if the user hasn't assigned expandedPaths
		if (!this._hasExplicitExpandedPaths) {
			this.rebuildExpandedPaths()
			this.requestUpdate()
		}
	}

	get isTreeMode(): boolean {
		return !!this._pathMember && !!this._treeIndex
	}

	isPathExpanded(path: string): boolean {
		return this._expandedPaths.has(path)
	}

	/** The row a tree path belongs to (null when the path is unknown). */
	getRowByPath(path: string): T | null {
		const node = this._treeIndex?.nodes.get(path)
		return node ? (this._items[node.rowIndex] ?? null) : null
	}

	/** One `row-expand` / `row-collapse` per changed path, then one `expanded-change` (nothing when `isSilent`). */
	private notifyExpanded(expanded: string[], collapsed: string[], options?: ExpandOptions): void {
		if (options?.isSilent) return
		for (const path of expanded) this.notify('row-expand', { row: this.getRowByPath(path), path })
		for (const path of collapsed) this.notify('row-collapse', { row: this.getRowByPath(path), path })
		this.notify('expanded-change', { paths: [...this._expandedPaths] })
	}

	/** `string | string[] | null` → the non-empty paths. */
	private toPathList(paths: string | string[] | null | undefined): string[] {
		if (paths == null) return []
		return (Array.isArray(paths) ? paths : [paths]).filter(p => typeof p === 'string' && p !== '')
	}

	/** Was a path argument given at all (vs. `null` / `undefined` / `[]` = the whole tree)? */
	private hasPathArg(paths: string | string[] | null | undefined): boolean {
		return paths != null && (!Array.isArray(paths) || paths.length > 0)
	}

	/** `path` and its ancestors (root first), known paths only. */
	private spinePaths(path: string): string[] {
		const out: string[] = []
		let p: string | null = this._treeIndex?.nodes.has(path) ? path : null
		while (p !== null) {
			out.unshift(p)
			p = this._treeIndex!.nodes.get(p)?.parent ?? null
		}
		return out
	}

	/**
	 * `isExclusive`: collapse every expanded row that isn't on a target's ancestor
	 * chain (`keepUnder`: or under a target). Returns the paths it collapsed.
	 */
	private collapseOffSpine(targets: string[], keepUnder: boolean): string[] {
		const keep = new Set<string>()
		for (const t of targets) for (const p of this.spinePaths(t)) keep.add(p)
		if (keepUnder) for (const t of targets) for (const p of this.subtreePaths(t)) keep.add(p)
		const collapsed: string[] = []
		for (const p of [...this._expandedPaths]) {
			if (!keep.has(p)) { this._expandedPaths.delete(p); collapsed.push(p) }
		}
		return collapsed
	}

	/** Expand / collapse one row (chevron, keyboard, double-click). */
	toggleRowExpanded(path: string, options?: ExpandOptions): void {
		if (this._expandedPaths.has(path)) this.collapseRows(path, options)
		else this.expandRows(path, options)
	}

	/**
	 * Expand the given rows one level (their collapsed ancestors open too, their
	 * descendants keep their state). `row-expand` per row that opened +
	 * `expanded-change`. `isExclusive`: every other branch collapses (no
	 * `row-collapse` for those); `isSilent`: no events.
	 */
	expandRows(paths: string | string[], options?: ExpandOptions): void {
		const targets = this.toPathList(paths).filter(p => this._treeIndex?.nodes.has(p))
		if (targets.length === 0) return
		const collapsed = options?.isExclusive ? this.collapseOffSpine(targets, false) : []
		const expanded: string[] = []
		for (const t of targets) {
			for (const p of this.spinePaths(t)) {
				if (this._expandedPaths.has(p) || !this._treeIndex!.nodes.get(p)?.childPaths.length) continue
				this._expandedPaths.add(p)
				expanded.push(p)
			}
		}
		if (expanded.length === 0 && collapsed.length === 0) return
		interactionLogger.debug('tree expandRows:', targets, '| size now:', this._expandedPaths.size)
		this.notifyExpanded(expanded, [], options)
		this.requestUpdate()
	}

	/** Collapse the given rows (their descendants keep their state). `row-collapse` per row + `expanded-change`; `isSilent`: no events. */
	collapseRows(paths: string | string[], options?: ExpandOptions): void {
		const changed = this.toPathList(paths).filter(p => this._expandedPaths.has(p))
		if (changed.length === 0) return
		for (const p of changed) this._expandedPaths.delete(p)
		this.notifyExpanded([], changed, options)
		this.requestUpdate()
	}

	/** `path` and every descendant (BFS); `[]` when the path is unknown. */
	private subtreePaths(path: string): string[] {
		if (!this._treeIndex?.nodes.has(path)) return []
		const out: string[] = []
		const queue: string[] = [path]
		while (queue.length) {
			const p = queue.shift()!
			out.push(p)
			const node = this._treeIndex.nodes.get(p)
			if (node) queue.push(...node.childPaths)
		}
		return out
	}

	/**
	 * Expand the whole tree (`null` / no paths) — or the given rows and everything
	 * under them (their ancestors open too). Fires `expanded-change` only (none
	 * when `isSilent`). `isExclusive` (with paths): every other branch collapses.
	 */
	expandAll(paths?: string | string[] | null, options?: ExpandOptions): void {
		if (!this._treeIndex) return
		let toExpand: string[]
		if (!this.hasPathArg(paths)) {
			toExpand = [...this._treeIndex.nodes.keys()]
		} else {
			const known = this.toPathList(paths).filter(p => this._treeIndex!.nodes.has(p))
			if (known.length === 0) return
			if (options?.isExclusive) this.collapseOffSpine(known, true)
			toExpand = known.flatMap(t => [...this.spinePaths(t), ...this.subtreePaths(t)])
		}
		for (const p of toExpand) this._expandedPaths.add(p)
		interactionLogger.debug('tree expandAll:', paths ?? '(all)', '| size =', this._expandedPaths.size)
		if (!options?.isSilent) this.notify('expanded-change', { paths: [...this._expandedPaths] })
		this.requestUpdate()
	}

	/** Collapse the whole tree (`null` / no paths) — or the given rows and everything under them. Fires `expanded-change` only (none when `isSilent`). */
	collapseAll(paths?: string | string[] | null, options?: ExpandOptions): void {
		if (!this.hasPathArg(paths)) {
			this._expandedPaths.clear()
		} else {
			const toCollapse = this.toPathList(paths).flatMap(t => this.subtreePaths(t))
			if (toCollapse.length === 0) return
			for (const p of toCollapse) this._expandedPaths.delete(p)
		}
		interactionLogger.debug('tree collapseAll:', paths ?? '(all)')
		if (!options?.isSilent) this.notify('expanded-change', { paths: [...this._expandedPaths] })
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
		if (!this._pathMember) return null
		const v = (item as Record<string, unknown>)[this._pathMember]
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
		if (!this._pathMember || this._items.length === 0) {
			this._treeIndex = null
			this.rebuildExpandedPaths()
			return
		}
		// Detect separator
		let sep = this._treePathSeparator
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
			if (this._levelMember) {
				const v = (item as Record<string, unknown>)[this._levelMember]
				if (typeof v === 'number') level = v
			} else {
				level = Math.max(0, path.split(sep).filter(Boolean).length - 1)
			}

			// Parent: from member or derived by stripping last segment
			let parent: string | null = null
			if (this._parentPathMember) {
				const v = (item as Record<string, unknown>)[this._parentPathMember]
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
		if (this._hasExplicitExpandedPaths) {
			// The user assigned expandedPaths: keep the current state (assigned + changed since)
			return
		}
		const set = new Set<string>()
		if (this._treeIndex) {
			if (this._expandLevel !== null) {
				// "Show tree to depth N" — a node at level N is visible iff every
				// ancestor (levels 0..N-1) is expanded. So expand paths with level < N.
				// depth=0 → nothing expanded, only roots visible.
				// depth=1 → roots expanded, level-1 visible (no level-2).
				for (const node of this._treeIndex.nodes.values()) {
					if (node.level < this._expandLevel) set.add(node.path)
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
		if (!this._isFilteringEnabled) return null
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

		// `isTreeDataSorted: true` means "trust me, don't re-sort". When the caller
		// owns the order — either because they want sibling sort handled in JS for
		// a server-mode simulation, or to compute aggregates like grouped sums —
		// they'll re-supply items via data-request when sort changes. The grid
		// never re-walks the tree in this mode.
		if (this._isTreeDataSorted) {
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
		this.trackSelection(() => {
			// Clear row and column selection when selecting cells
			if (this._selectedRowIndices.size > 0) {
				this._selectedRowIndices.clear()
				this._lastSelectedRowIndex = null
			}
			this._selectedColumns.clear()

			this._selectedCellRange = range
		})
		this.requestUpdate()
	}

	clearCellSelection(): void {
		if (this._selectedCellRange) {
			this.clearCellSelection_noRender()
			this.requestUpdate()
		}
	}

	/** Clear cell selection state without triggering re-render (caller handles visuals) */
	clearCellSelection_noRender(): void {
		if (this._selectedCellRange) {
			this.trackSelection(() => { this._selectedCellRange = null })
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
	 * @param colIndex - Column index (index into `columns`); hidden columns are ignored
	 * @param mode - 'replace' (default), 'toggle', or 'range' (the on-screen span from
	 *   the last selected column)
	 */
	selectColumn(colIndex: number, mode: 'replace' | 'toggle' | 'range' = 'replace'): void {
		const pos = this.visualIndexOfColumn(colIndex)
		if (pos < 0) return
		this.selectColumnAt(pos, mode)
	}

	/** Select by VISUAL position (index into `visualColumns`) — header clicks / drags. */
	selectColumnAt(pos: number, mode: 'replace' | 'toggle' | 'range' = 'replace'): void {
		if (pos < 0 || pos >= this.visualColumns.length) return
		this.trackSelection(() => this.selectColumnState(pos, mode))
		this.requestUpdate()
	}

	private selectColumnState(colIndex: number, mode: 'replace' | 'toggle' | 'range'): void {
		// Clear row selection and cell range when selecting columns
		this._selectedRowIndices.clear()
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
	}

	/**
	 * Clear column selection
	 */
	clearColumnSelection(): void {
		this.clearColumnSelection_noRender()
		this.requestUpdate()
	}

	/** Clear column selection state without triggering re-render (caller handles visuals) */
	clearColumnSelection_noRender(): void {
		this.trackSelection(() => {
			this._selectedColumns.clear()
			this._lastSelectedColumnIndex = -1
		})
	}

	/**
	 * Select the on-screen span between two columns (column indices — index into
	 * `columns`), inclusive. Hidden columns are ignored.
	 */
	selectColumnRange(fromIndex: number, toIndex: number): void {
		const from = this.visualIndexOfColumn(fromIndex)
		const to = this.visualIndexOfColumn(toIndex)
		if (from < 0 || to < 0) return
		this.selectColumnRangeAt(from, to)
	}

	/** Select a span of VISUAL positions (drag selection). */
	selectColumnRangeAt(fromIndex: number, toIndex: number): void {
		this.trackSelection(() => {
			// Clear row selection and cell range when selecting columns
			this._selectedRowIndices.clear()
			this._selectedCellRange = null

			this._selectedColumns.clear()
			const start = Math.min(fromIndex, toIndex)
			const end = Math.max(fromIndex, toIndex)
			for (let i = start; i <= end; i++) {
				this._selectedColumns.add(i)
			}
			this._lastSelectedColumnIndex = toIndex
		})
		this.requestUpdate()
	}

	/** Selected column indices (index into `columns`), ascending. */
	get selectedColumns(): number[] {
		const visualCols = this.visualColumns
		const indices: number[] = []
		for (const pos of this._selectedColumns) {
			const entry = visualCols[pos]
			if (entry) indices.push(entry.originalIndex)
		}
		return indices.sort((a, b) => a - b)
	}

	/**
	 * The selected columns in on-screen order, as `{ colIndex, field, column }`
	 * (`colIndex` = index in `columns`) — the same column fields a selected cell reports.
	 */
	getSelectedColumns(): SelectedColumn<T>[] {
		const visualCols = this.visualColumns
		const result: SelectedColumn<T>[] = []
		for (const pos of this.selectedColumnPositions) {
			const entry = visualCols[pos]
			if (entry) result.push({ colIndex: entry.originalIndex, field: String(entry.column.field), column: entry.column })
		}
		return result
	}

	/** Selected VISUAL positions (index into `visualColumns`), ascending — rendering / borders / copy. */
	get selectedColumnPositions(): number[] {
		return Array.from(this._selectedColumns).sort((a, b) => a - b)
	}

	/** Is the column (index into `columns`) selected? */
	isColumnSelected(colIndex: number): boolean {
		const pos = this.visualIndexOfColumn(colIndex)
		return pos >= 0 && this._selectedColumns.has(pos)
	}

	/** Is the column at this VISUAL position selected? */
	isColumnPositionSelected(pos: number): boolean {
		return this._selectedColumns.has(pos)
	}

	/**
	 * The cells of the selected range as cell contexts (row by row, columns in
	 * on-screen order). `colIndex` is the index in `columns` (not the range's
	 * visual position); `value` is the raw, draft-aware value.
	 */
	getSelectedCells(): CellContext<T>[] {
		if (!this._selectedCellRange) return []

		const { startRowIndex, endRowIndex, startColIndex, endColIndex } = this._selectedCellRange
		const minRow = Math.min(startRowIndex, endRowIndex)
		const maxRow = Math.max(startRowIndex, endRowIndex)
		const minCol = Math.min(startColIndex, endColIndex)
		const maxCol = Math.max(startColIndex, endColIndex)

		// The range spans visual positions; each cell reports its column index
		// (`data-col`, the index into `columns`) like every other cell context.
		const visualCols = this.visualColumns
		const cells: CellContext<T>[] = []
		for (let row = minRow; row <= maxRow; row++) {
			const rowData = this.displayItems[row]
			if (!rowData) continue
			for (let col = minCol; col <= maxCol; col++) {
				const entry = visualCols[col]
				if (!entry) continue
				cells.push(this.cellCtx(rowData, row, entry.column, entry.originalIndex))
			}
		}

		return cells
	}

	/**
	 * Check if a cell is in the selected cell range. `visualIndex` is the cell's
	 * visual position (index into `visualColumns`) — the range's convention.
	 */
	isCellInSelectedRange(rowIndex: number, visualIndex: number): boolean {
		if (!this._selectedCellRange) return false
		const pos = visualIndex

		const { startRowIndex, endRowIndex, startColIndex, endColIndex } = this._selectedCellRange
		const minRow = Math.min(startRowIndex, endRowIndex)
		const maxRow = Math.max(startRowIndex, endRowIndex)
		const minCol = Math.min(startColIndex, endColIndex)
		const maxCol = Math.max(startColIndex, endColIndex)

		return rowIndex >= minRow && rowIndex <= maxRow && pos >= minCol && pos <= maxCol
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

		if (!this._isFilteringEnabled || Object.keys(this._filters).length === 0) {
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
	/** Assignment is silent (no `filter-change`) — like a native `input.value`. */
	set filters(value: Record<string, string>) {
		const prev = this._filters
		this._filters = { ...value }
		this.resetPageAfterFilterChange(prev)
		this.requestUpdate()
	}

	/** Set (or clear, with `''`) one column filter; fires `filter-change` unless `isSilent`. */
	setFilter(field: string, value: string, options?: { isSilent?: boolean }): void {
		const prev = this._filters
		if (value) this._filters = { ...this._filters, [field]: value }
		else {
			const next = { ...this._filters }
			delete next[field]
			this._filters = next
		}
		this.resetPageAfterFilterChange(prev)
		if (!options?.isSilent) this.notify('filter-change', { filters: { ...this._filters } })
		this.requestUpdate()
	}

	/**
	 * A filter change shows a different row set → back to page 1 — unless the page
	 * was set in the same task (a page + filter restored together keep the page).
	 */
	private resetPageAfterFilterChange(prev: Record<string, string>): void {
		const isSame = (a: Record<string, string>, b: Record<string, string>) => {
			const norm = (o: Record<string, string>) => Object.entries(o).filter(([, v]) => !!v)
			const ea = norm(a), eb = norm(b)
			return ea.length === eb.length && ea.every(([k, v]) => b[k] === v)
		}
		if (isSame(prev, this._filters) || this._isPageSetInTask) return
		this._currentPage = 1
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
		if (!this._isPagingEnabled) {
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
		// row built before any columns exist (e.g. `enable-new-row` in markup, a
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
			const skip = trigger === 'load-more'
				? this._items.length
				: (this._currentPage - 1) * this._pageSize

			const detail: DataRequestDetail = {
				sort: [...this._sort],
				page: this._currentPage,
				pageSize: this._pageSize,
				trigger,
				mode: trigger === 'load-more' ? 'append' : 'replace',
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
	// Preset Defaults
	// ==========================================================================

	/**
	 * Apply the settings of the current preset.
	 * Called when `preset` is set.
	 */
	protected applyPresetDefaults(): void {
		const preset = GRID_PRESETS[this._preset]
		if (!preset) return
		if (preset.isEditingEnabled !== undefined) this._isEditingEnabled = preset.isEditingEnabled
		if (preset.isReadonly !== undefined) this._isReadonly = preset.isReadonly
		if (preset.editTrigger !== undefined) this._editTrigger = preset.editTrigger
		if (preset.dropdownToggleVisibility !== undefined) this._dropdownToggleVisibility = preset.dropdownToggleVisibility
		if (preset.shouldOpenDropdownOnFocus !== undefined) this._shouldOpenDropdownOnFocus = preset.shouldOpenDropdownOnFocus
		if (preset.cellSelectionMode !== undefined) this._cellSelectionMode = preset.cellSelectionMode
	}

	/**
	 * Check for configuration conflicts and warn user
	 */
	protected checkSelectionConflicts(): void {
		if (this._cellSelectionMode === 'click' && this._editTrigger === 'click') {
			initLogger.warn(
				'cellSelectionMode="click" conflicts with editTrigger="click". ' +
				'Cell range selection takes priority (drag selects, Shift+click extends the range); ' +
				'use F2 / Enter to edit, or change to cellSelectionMode="shift" to avoid confusion.'
			)
		}
	}

	/**
	 * Check for editTrigger conflicts in read-only mode
	 */
	protected checkEditTriggerConflicts(): void {
		if (!this._isEditingEnabled && this._editTrigger === 'always') {
			initLogger.warn(
				'editTrigger="always" is not supported in read-only mode (isEditingEnabled=false).\n' +
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
	 * Identity a draft is stored under: the row's `idMember` (or `pathMember`)
	 * value when set, otherwise the row object itself — never the display index, so
	 * a draft stays with its row when the view is sorted, paged, filtered or a tree
	 * branch toggles.
	 */
	private draftKey(item: T): unknown {
		const id = this.getRowId(item)
		if (id !== undefined && id !== null) return `key:${String(id)}`
		if (this._pathMember) {
			const v = (item as Record<string, unknown>)[this._pathMember]
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
		if (!item) return
		const key = this.draftKey(item)
		this._draftRows.set(key, draft)
		this._draftOrigins.set(key, item)
	}

	private deleteDraftAt(rowIndex: number): void {
		const item = this.displayItems[rowIndex]
		if (item) this.deleteDraftByKey(this.draftKey(item))
	}

	private deleteDraftByKey(key: unknown): void {
		this._draftRows.delete(key)
		this._draftOrigins.delete(key)
	}

	/**
	 * Every draft — including rows on other pages, filtered out, or no longer in
	 * `items` (server paging: a missing row is "another page"; drafts are never
	 * pruned). `row` is the current row with that identity when it is in `items`,
	 * else the row the draft was made from. `changedFields` lists the fields whose
	 * draft value differs from `row`; `isValid` is false while a cell of it is invalid.
	 */
	getDrafts(): DraftInfo<T>[] {
		if (this._draftRows.size === 0) return []
		const current = new Map<unknown, T>()
		for (const item of this._items) {
			const key = this.draftKey(item)
			if (this._draftRows.has(key)) current.set(key, item)
		}
		const out: DraftInfo<T>[] = []
		for (const [key, draftRow] of this._draftRows) {
			const row = current.get(key) ?? this._draftOrigins.get(key) ?? (key as T)
			const draft = draftRow as Record<string, unknown>
			const orig = row as Record<string, unknown>
			const changedFields = Object.keys(draft).filter(f => draft[f] !== orig[f])
			const rowKey = this.invalidRowKeyOf(row)
			const isValid = rowKey === null || !this._invalidCells.some(c => c.rowKey === rowKey)
			out.push({ row, draftRow, changedFields, isValid })
		}
		return out
	}

	/** The invalid-cell rowKey of a row: its id / tree path, else its display index (null when not displayed). */
	private invalidRowKeyOf(row: T): string | null {
		if (this.hasStableIdentity(row)) return this.getStableRowKey(row, -1)
		const i = this.displayItems.indexOf(row)
		return i >= 0 ? this.getStableRowKey(row, i) : null
	}

	/**
	 * Drop the draft of `row` (a row object — or its id-equal copy, or the draft
	 * itself) and its invalid-cell markers. No-op when it has none.
	 */
	discardDraft(row: T): void {
		if (row == null) return
		let key: unknown = this.draftKey(row)
		if (!this._draftRows.has(key)) {
			key = undefined
			for (const [k, d] of this._draftRows) {
				if (d === row || this._draftOrigins.get(k) === row) { key = k; break }
			}
			if (key === undefined) return
		}
		const origin = this._draftOrigins.get(key) ?? row
		const rowKey = this.invalidRowKeyOf(origin)
		this.deleteDraftByKey(key)
		if (rowKey !== null) this._invalidCells = this._invalidCells.filter(c => c.rowKey !== rowKey)
		this.requestUpdate()
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
		this._draftOrigins.clear()
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

		// Auto-format date columns using editorOptions.dateFormat when no getDisplayValueCallback.
		// Text saved as an invalid date (typed / pasted, not a date) shows as typed: `new Date()`
		// would roll '2026-02-31' over to March 3rd.
		if (column.editor === 'date' && column.editorOptions?.dateFormat && value
			&& !(typeof value === 'string' && this.isCellInvalid(rowIndex, String(column.field)))) {
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

		this.notify('cell-edit-start', { row: item, rowIndex, field })
	}

	/**
	 * Cancel editing without saving
	 */
	cancelEdit(): void {
		this.cancelEditOn(this._editingCell ? this.displayItems[this._editingCell.rowIndex] : undefined)
	}

	/** Cancel editing without saving; `item` = the row being edited (`cell-edit-cancel`'s `row`). */
	private cancelEditOn(item: T | undefined): void {
		if (this._editingCell) {
			const prev = this._editingCell
			const { rowIndex, field } = prev
			if (item) {
				this.notify('cell-edit-cancel', { row: item, rowIndex, field })
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
	 * Commit edit with validation.
	 *
	 * The edit ENDS synchronously, here — never after an `await`: a move (Tab, Enter, a click on
	 * another cell) commits and then starts the next edit at once, so an edit-state change that waited
	 * for an async `validateCallback` would end the NEXT cell's edit (and leave the old editor open to a
	 * second commit / a cancel). The validation result is applied when it arrives:
	 * - sync `validateCallback` (or none) and no commit pending → applied right here, as before;
	 * - a promise, or earlier commits still pending → the typed value goes into the draft now (the cell
	 *   shows it), the result (draft value / invalid mark / `validation-error` / `row-change`) is applied
	 *   when it arrives, in COMMIT ORDER (a later commit waits for the earlier ones), then the cell is
	 *   re-rendered (`_onCommitApplied`). The returned promise settles after the apply.
	 * @param commitEmptyRow - If true and editing empty row, add it to items. If false, just update the draft.
	 */
	commitEdit(rowIndex: number, field: string, newValue: unknown, commitEmptyRow: boolean = false, source: 'edit' | 'paste' = 'edit', parseError: string | null = null): Promise<void> {
		dataLogger.debug('commitEdit:', { rowIndex, field, newValue })
		const column = this._columns.find(c => String(c.field) === field)
		if (!column) return Promise.resolve()

		const item = this.displayItems[rowIndex]
		if (!item) return Promise.resolve()

		const isEmptyRow = this.isEmptyRowIndex(rowIndex)
		const oldValue = (item as Record<string, unknown>)[field]

		// Built-in value check first: a number column parses strictly and applies its
		// editorOptions (decimalPlaces rounds; min / max / allowNegative reject — no
		// clamping); `parseError` is a typing error the caller found (paste into a
		// checkbox / date column). Invalid → the normal invalid flow below, the draft
		// keeps what was typed, validateCallback is skipped.
		let builtInError = parseError
		if (!builtInError && column.editor === 'number') {
			const typed = typeNumberValue(newValue, column.editorOptions || {}, this._labels)
			newValue = typed.value
			builtInError = typed.error
		}

		const value = newValue
		let outcome: CommitOutcome | Promise<CommitOutcome> = { isValid: !builtInError, validationError: builtInError, finalValue: value }
		if (column.validateCallback && !builtInError) {
			const invalid = (err: unknown): CommitOutcome => ({ isValid: false, validationError: err instanceof Error ? err.message : 'Validation failed', finalValue: value })
			const normalize = (result: ValidateResult): CommitOutcome => {
				const n = this.normalizeValidationResult(result, value)
				return { isValid: n.valid, validationError: n.message || null, finalValue: n.finalValue }
			}
			try {
				const result = column.validateCallback(this.ctx({
					row: item,
					rowIndex,
					column,
					colIndex: this._columns.indexOf(column),
					field,
					value,
					oldValue,
					source
				}))
				outcome = isThenable(result)
					? Promise.resolve(result).then(normalize, invalid)
					: normalize(result)
			} catch (err) {
				outcome = invalid(err)
			}
		}

		const target: CommitTarget<T> = { item, rowIndex, field, oldValue, isEmptyRow, commitEmptyRow, source }

		// Sync result, nothing pending: apply now, then end the edit (the order it always had)
		if (!(outcome instanceof Promise) && this._pendingCommits === 0) {
			const rowAdded = this.applyCommit(target, outcome, true)
			this.endEditOnCommit()
			if (rowAdded) this.requestUpdate()
			return Promise.resolve()
		}

		// Deferred: the typed value shows now, the edit ends now, the result applies in commit order
		this.writeCommitDraft(target, value)
		this.endEditOnCommit()
		this._pendingCommits++
		this._isValidating = true
		const pending = outcome
		const run = this._commitChain
			.then(() => pending)
			.then(result => {
				const at = this.resolveCommitTarget(target)
				if (!at) {
					dataLogger.debug('commitEdit: the row is gone, validation result dropped', { rowIndex, field })
					return
				}
				const rowAdded = this.applyCommit(at, result, false)
				if (rowAdded) this.requestUpdate()
				else this._onCommitApplied?.(at.rowIndex, field)
			})
			.finally(() => {
				if (--this._pendingCommits === 0) this._isValidating = false
			})
		this._commitChain = run.catch(() => undefined)
		return run
	}

	/** End the edit a commit closes (whatever cell is edited — the commit's caller decided). */
	private endEditOnCommit(): void {
		const prev = this._editingCell
		if (!prev) return
		this._editingCell = null
		this._onInteractionChange?.('editingCell', { prev, current: null })
		// NOTE: No requestUpdate() - caller handles surgical DOM update
	}

	/** A deferred commit: put the typed value in the draft now, so the cell shows it while validating. */
	private writeCommitDraft(t: CommitTarget<T>, value: unknown): void {
		if (t.isEmptyRow) {
			if (!this._emptyRowDraft) this._emptyRowDraft = { ...t.item }
			;(this._emptyRowDraft as Record<string, unknown>)[t.field] = value
			return
		}
		let draftRow = this.draftAt(t.rowIndex)
		if (!draftRow) {
			draftRow = { ...t.item }
			this.setDraftAt(t.rowIndex, draftRow)
		}
		(draftRow as Record<string, unknown>)[t.field] = value
	}

	/** Where a deferred commit's row is now (`items` / sort may have changed while validating); null = gone. */
	private resolveCommitTarget(t: CommitTarget<T>): CommitTarget<T> | null {
		if (t.isEmptyRow) {
			const index = this._newRowPosition === 'top' ? 0 : this.displayItems.length - 1
			return this.isEmptyRowIndex(index) ? { ...t, rowIndex: index, item: this.displayItems[index] } : null
		}
		if (this.displayItems[t.rowIndex] === t.item) return t
		const key = this.draftKey(t.item)
		const index = this.displayItems.findIndex(i => this.draftKey(i) === key)
		return index < 0 ? null : { ...t, rowIndex: index, item: this.displayItems[index] }
	}

	/**
	 * Apply a commit's validation result: the draft value, the invalid mark, `validation-error`,
	 * `row-change`. Returns true when an empty-row commit added the row to `items` (the caller
	 * re-renders the grid). `immediate` = applied inside `commitEdit()` (the edit is still the
	 * committed one, so `currentCellError` follows it).
	 */
	private applyCommit(t: CommitTarget<T>, o: CommitOutcome, immediate: boolean): boolean {
		const { item, rowIndex, field, oldValue, source } = t
		const { isValid, validationError, finalValue } = o
		const setCellError = (error: string | null) => { if (immediate) this._currentCellError = error }

		// Handle empty row commit - LENIENT validation (tracks errors but doesn't block)
		if (t.isEmptyRow) {
			// Always update empty row draft with the value (preserves user input)
			if (!this._emptyRowDraft) {
				this._emptyRowDraft = { ...item }
			}
			(this._emptyRowDraft as Record<string, unknown>)[field] = finalValue

			// Track validation state (but DON'T block commit)
			if (!isValid) {
				this.addInvalidCell(rowIndex, field, validationError || "Invalid value")
				setCellError(validationError)
				this.notify('validation-error', { row: item, rowIndex, field, error: validationError || "Invalid value", source })
			} else {
				this.removeInvalidCell(rowIndex, field)
				setCellError(null)
			}

			// Commit to items if explicitly requested (Enter key or Tab on last cell)
			if (t.commitEmptyRow) {
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
					// (when neither idMember nor pathMember is set) need shifting; stable
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
					return true
				}
			}

			// Tab within empty row or no data yet - keep draft
			return false
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
			setCellError(null)
		} else {
			this.addInvalidCell(rowIndex, field, validationError || "Invalid value")
			setCellError(validationError)
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
		return false
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
	 *   5. else → defer to grid-level isEditingEnabled
	 */
	isCellEditable(column: Column<T>, row?: T): boolean {
		// 0. Tree column is always read-only when tree mode is active. The column hosts
		// indent + chevron and (typically) the row's display name; editing it inline
		// conflicts with the toggle interaction and rarely matches user intent.
		if (this.isTreeMode && column.isTree) return false

		// 0b. A read-only / disabled grid edits nothing (wins over every column / row opt-in)
		if (this._isReadonly || this._isDisabled) return false

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

		// 6. Defer to grid-level isEditingEnabled
		return this._isEditingEnabled
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
	/** Assignment is silent (no `focus-change`) — like a native `input.value`. */
	set focusedRowIndex(value: number | null) {
		if (value === null) {
			this.clearRowFocus()
		} else {
			this.setFocusedRow(value, { isSilent: true })
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
	 * Set the focused row (fires `focus-change` if the row changed, unless `isSilent`)
	 * Called internally when a cell is focused/clicked
	 * NOTE: Does NOT call requestUpdate() - caller handles DOM updates surgically
	 */
	setFocusedRow(rowIndex: number, options?: { isSilent?: boolean }): void {
		if (this._focusedRowIndex === rowIndex) return
		interactionLogger.debug('setFocusedRow:', rowIndex, '(prev:', this._focusedRowIndex, ')')
		const oldRowIndex = this._focusedRowIndex
		this._focusedRowIndex = rowIndex
		this._onInteractionChange?.('focusedRow', { prev: oldRowIndex, current: rowIndex })

		const row = this.displayItems[rowIndex]
		if (row && !options?.isSilent) this.notify('focus-change', { rowIndex, row, oldRowIndex })
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

	/** The row with this ID (`idMember` / `getIdCallback`), or null. */
	getRowById(id: unknown): T | null {
		const i = this.itemIndexById(id)
		return i === -1 ? null : this._items[i]
	}

	/** The row's display index (the `rowIndex` every ctx / event uses), or -1 when it isn't displayed. */
	getRowIndex(row: T): number {
		return this.displayItems.indexOf(row)
	}

	/** Index into `items` of the row with this ID (-1 when unknown). */
	private itemIndexById(id: unknown): number {
		return this._items.findIndex(row => this.getRowId(row) === id)
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
			rowIndex = this.getRowIndex(row)
		} else {
			id = rowOrId
			row = this.getRowById(id) ?? undefined
			if (row) rowIndex = this.getRowIndex(row)
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
		if (opts.isLockedMember) {
			const locked = (row as Record<string, unknown>)[String(opts.isLockedMember)]
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
		const row = this.getRowById(id)
		const rowIndex = row ? this.getRowIndex(row) : -1
		if (rowIndex !== -1 && this._editingCell && this._editingCell.rowIndex === rowIndex) {
			this.cancelEdit()
		}

		this.requestUpdate()

		this.notify('row-lock-change', {
			rowId: id,
			row,
			rowIndex,
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

			const row = this.getRowById(id)
			this.notify('row-lock-change', {
				rowId: id,
				row,
				rowIndex: row ? this.getRowIndex(row) : -1,
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
		const row = this.getRowById(id)
		if (!row) return false

		// Update original data
		Object.assign(row as object, newData)

		// Update draft if exists
		const draft = this._draftRows.get(this.draftKey(row))
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
		const i = this.itemIndexById(id)
		if (i === -1) return false
		const oldRow = this._items[i]

		this._items[i] = newRow

		// Clear draft for this row (data was replaced externally)
		this.deleteDraftByKey(this.draftKey(oldRow))

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

	/** Insert `rows` (in order) after `afterRow` (in `items` order), or at the end. */
	insertRows(rows: T[], afterRow?: T | null): void {
		if (!rows.length) return
		const at = afterRow == null ? -1 : this._items.indexOf(afterRow)
		const next = [...this._items]
		next.splice(at === -1 ? next.length : at + 1, 0, ...rows)
		this.items = next
	}

	/** Remove `row` from `items`. */
	removeRow(row: T): void {
		this.removeRows([row])
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
	 * The persisted-state handle (core `createStateStore()`): `storage-key` +
	 * `loadStateCallback` / `saveStateCallback`, default
	 * `localStorage['km-state:web-grid:<storage-key>']`. Set by the element.
	 */
	setStateStore(store: StateStore<GridPersistenceState> | null): void {
		this._stateStore = store
	}

	/** Persisting anything at all (a store + at least one persist flag). */
	protected get isPersistenceOn(): boolean {
		return !!this._stateStore && (this._shouldPersistColumnWidths || this._shouldPersistColumnOrder)
	}

	/**
	 * Load the persisted state (widths, order) and apply it. Asynchronous (the
	 * store may be a server callback): the grid renders again once it arrives.
	 * Entries for columns that no longer exist are dropped and the cleaned
	 * state is saved back. Without columns yet the load waits for `columns`
	 * (every entry would look orphaned and be pruned).
	 */
	loadPersistedState(): void {
		const store = this._stateStore
		if (!store || !this.isPersistenceOn) return
		if (this._columns.length === 0) {
			this._isPersistedStateLoadPending = true
			return
		}
		this._isPersistedStateLoadPending = false
		const token = ++this._persistLoadToken
		void store.load().then((state) => {
			if (token !== this._persistLoadToken || !state) return
			if (this._columns.length === 0) {
				this._isPersistedStateLoadPending = true
				return
			}
			this.applyPersistedState(state)
		})
	}

	/** Apply a loaded state; prune (and re-save) entries of columns that no longer exist. */
	protected applyPersistedState(state: GridPersistenceState): void {
		const validFields = new Set(this._columns.map(c => String(c.field)))
		const cleaned: GridPersistenceState = {}
		let needsCleanup = false

		if (Array.isArray(state.columnWidths)) {
			this._columnWidths.clear()
			cleaned.columnWidths = []
			for (const cw of state.columnWidths) {
				if (validFields.has(cw.field)) {
					this._columnWidths.set(cw.field, cw.width)
					cleaned.columnWidths.push(cw)
				} else {
					needsCleanup = true
				}
			}
		}
		if (Array.isArray(state.columnOrder)) {
			this._columnOrder.clear()
			cleaned.columnOrder = []
			for (const co of state.columnOrder) {
				if (validFields.has(co.field)) {
					this._columnOrder.set(co.field, co.order)
					cleaned.columnOrder.push(co)
				} else {
					needsCleanup = true
				}
			}
		}

		if (needsCleanup) void this._stateStore?.save(cleaned)
		this.requestUpdate()
	}

	/**
	 * Save the persisted state: the enabled parts (widths and / or order) are
	 * merged into the whole state, which goes to the store (no-op without a
	 * `storage-key`).
	 */
	savePersistedState(): void {
		const store = this._stateStore
		if (!store || !this.isPersistenceOn) return
		const state: GridPersistenceState = {}
		if (this._shouldPersistColumnWidths) state.columnWidths = this.getColumnWidthsState()
		if (this._shouldPersistColumnOrder) state.columnOrder = this.getColumnOrderState()
		void store.save(state)
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

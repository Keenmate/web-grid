// =============================================================================
// GridElement - Web Component Registration
// =============================================================================

import { WebGrid } from './grid.js'
import type {
	Column,
	CellValidationState,
	RowToolbarConfig,
	ContextMenuItem,
	ContextMenuConfig,
	RowShortcut,
	ShortcutContext,
	ParsedKeyCombo,
	RowChangeDetail,
	ToolbarClickDetail,
	RowActionClickDetail,
	ContextMenuContext,
	HeaderMenuConfig,
	HeaderMenuContext,
	CustomEditorContext,
	EditTrigger,
	EditStartSelection,
	EditorOptions,
	GridMode,
	ToggleVisibility,
	NormalizedToolbarItem,
	DataRequestDetail,
	SortState,
	SortMode,
	PaginationLabelsCallback,
	SummaryContentCallback,
	ValidationTooltipContext,
	ToolbarPosition,
	GridLabels,
	RowLock,
	RowLockingOptions,
	RowLockChangeDetail,
	ColumnResizeDetail,
	ColumnWidthState,
	ColumnReorderDetail,
	ColumnOrderState,
	FillDragDetail,
	RangeShortcut,
	RangeShortcutContext,
	RowFocusDetail,
	PasteMode,
	BeforePasteDetail,
	PasteDetail
} from './types.js'

// Import CSS (Vite inlines this as a string)
import styles from './css/main.css?inline'

// Logging
import { initLogger, uiLogger, perfLogger } from './logger.js'

// Perf instrumentation (temporary — investigating tree-toggle slowness)
import { gridPerf } from './perf.js'

// Import module functions
import {
	getOptionDisplayValue,
	getOptionLabel,
	getOptionValue,
	renderDropdown,
	removeDropdown,
	selectDropdownOption,
	updateDropdownHighlight,
	scrollHighlightedIntoView,
	updateLoadingIndicator,
	openDropdownForCurrentEditor,
	toggleDropdown,
	attachDropdownListeners,
	updateSelectFilter,
	handleComboboxInput,
	handleAutocompleteInput,
	isOptionDisabled,
	AutocompleteService,
	DropdownService,
	handleSelectBlur,
	handleComboboxBlur
} from './modules/dropdown/index.js'

import {
	showTooltip,
	hideTooltip,
	TooltipService
} from './modules/tooltip/index.js'

import {
	focusCellElement,
	ensureCellNotBehindFrozen,
	updateFocusVisual,
	clearEditingVisual,
	restoreEditingCellToDisplayMode,
	handleCellFocus,
	moveFocus,
	tryStartEdit,
	getCursorPositionFromClick,
	handleTableFocusOut,
	scrollToRowPosition
} from './modules/navigation/index.js'

import {
	commitCurrentEditor,
	handleCheckboxChange,
	toggleCheckboxAndMove,
	handleEditorBlur,
	moveFocusAfterCommit,
	focusCellAfterCancel,
	restoreCellToDisplayMode,
	renderCellEditor
} from './modules/editing/index.js'

import {
	getContainerClasses,
	renderHeaderRow,
	renderDataRows,
	renderDataRowsVirtual,
	renderPagination,
	renderSummary,
	renderCell
} from './modules/rendering/index.js'

import type { VirtualScrollParams } from './modules/rendering/index.js'

import {
	DatePicker,
	openDatePicker,
	commitDateEditor
} from './modules/datepicker/index.js'
import {
	closeContextMenu,
	handleContextMenu,
	handleHeaderContextMenu,
	handleFillerContextMenu
} from './modules/contextmenu/index.js'
import {
	closeToolbar,
	isToolbarOpenForRow,
	getActiveToolbarRowIndex,
	isToolbarOwnedBy,
	getConnectorState,
	updateConnector,
	updateToolbarPosition,
	resolveToolbarOffset,
	ToolbarService,
	setupInlineShortcuts,
	removeInlineShortcuts,
	showToolbarForRow,
	closeToolbarAndReset,
	updateToolbarWithCellItems,
	handleToolbarItemClick,
	handleInlineActionClick,
	type ConnectorState
} from './modules/toolbar/index.js'

import {
	parseKeyCombo,
	matchesKeyCombo,
	formatKeyCombo
} from './modules/keyboard/index.js'

import {
	calculateScrollToRow,
	VirtualScrollService,
	handleVirtualScroll,
	renderVirtualRows,
	handleInfiniteScroll,
	handleScrollCloseDropdown
} from './modules/scroll/index.js'

import { handleSortClick, handlePaginationClick, handlePageSizeChange } from './modules/events/index.js'
import { handleResizeStart } from './modules/resize/index.js'
import { handleReorderStart, isReordering } from './modules/reorder/index.js'
import { updateFillHandle, removeFillHandle } from './modules/fill-handle/index.js'
import { createScrollEventManager, type ScrollEventManager } from './modules/scroll-events/index.js'
import { createFocusEventManager, type FocusEventManager } from './modules/focus-events/index.js'
import { createClickEventManager, type ClickEventManager } from './modules/click-events/index.js'

import {
	handleRowNumberMouseDown,
	handleContainerClick,
	handleEscapeKey as handleSelectionEscape
} from './modules/selection/index.js'

import {
	handleCellMouseDown,
	handleCellShiftClick,
	isCellSelecting,
	isCellSelectionPending,
	createRangeBorder,
	updateRangeBorder,
	removeRangeBorder
} from './modules/cell-selection/index.js'

import {
	createRowSelectionBorders,
	createColumnSelectionBorders,
	updateSelectionBorders,
	removeRowSelectionBorders,
	removeColumnSelectionBorders,
	removeAllSelectionBorders
} from './modules/selection-border/index.js'

import {
	handleHeaderMouseDown,
	isColumnSelecting,
	isColumnSelectionPending
} from './modules/column-selection/index.js'

import { executePaste } from './modules/paste/index.js'

import {
	ActionPipelineAdapter,
	createActionPipelineAdapter
} from './modules/actions/index.js'

import type { GridContext } from './modules/grid-context.js'

/**
 * GridElement - Custom HTML Element for WebGrid
 *
 * Extends HTMLElement and composes WebGrid for business logic.
 *
 * Usage:
 * ```html
 * <web-grid></web-grid>
 * ```
 *
 * ```js
 * const grid = document.querySelector('web-grid');
 * grid.items = [...];
 * grid.columns = [...];
 * ```
 */
export class GridElement<T = unknown> extends HTMLElement implements GridContext<T> {
	// Core grid logic (composition)
	readonly grid: WebGrid<T>

	// Shadow DOM root
	readonly shadow: ShadowRoot

	// Style element (for initial CSS injection)
	private styleElement: HTMLStyleElement

	// Custom styles element (for user-provided CSS via customStylesCallback)
	private customStyleElement: HTMLStyleElement | null = null

	// Update batching
	private updatePending = false

	// Flag to prevent blur from committing when keyboard already handled it
	isCommittingFromKeyboard = false

	// Flag to prevent blur from cancelling edit when switching between dropdown cells
	isTransitioningCells = false

	// Flag to track if toolbar outside click listener has been added
	private toolbarOutsideClickAdded = false

	// Flag to track if clickEvents subscriptions have been added (only subscribe once)
	private clickEventsSubscribed = false

	// Flag to track if focusEvents subscriptions have been added (only subscribe once)
	private focusEventsSubscribed = false

	// Floating-toolbar runtime state — owned by ToolbarService (hover hide-timeout,
	// hover/move flags, hovered cell, cell-items JSON snapshot, document keydown handlers
	// for both floating and inline modes).
	toolbar = new ToolbarService()

	// Dropdown runtime state — owned by DropdownService (open flag, options, highlight,
	// filter text, race-condition flags: isOpening / isClosingViaToggle / justSelected /
	// userInteracted / isUserFiltering).
	dropdown = new DropdownService()

	// Autocomplete async state
	// Autocomplete async state — owned by AutocompleteService (debounce timer, abort controller, search-in-flight flag).
	autocomplete = new AutocompleteService()

	// Tooltip runtime state — owned by TooltipService (element, arrow, anchor, show/hide timers).
	tooltip = new TooltipService()

	// Tooltip configuration (grid-level)
	private _tooltipShowDelay: number = 200
	private _tooltipHideDelay: number = 100

	get tooltipShowDelay(): number { return this._tooltipShowDelay }
	set tooltipShowDelay(value: number) { this._tooltipShowDelay = value }

	get tooltipHideDelay(): number { return this._tooltipHideDelay }
	set tooltipHideDelay(value: number) { this._tooltipHideDelay = value }

	// DatePicker instance (for date editor) - exposed via GridContext for pipeline access
	datepicker: DatePicker | null = null

	// Context menu element (rendered to document.body) - exposed via GridContext for pipeline access
	contextMenuElement: HTMLElement | null = null
	headerContextMenuElement: HTMLElement | null = null

	// Virtual scroll state — owned by VirtualScrollService (visible-range, load-more flag, programmatic-scroll guard).
	virtualScroll = new VirtualScrollService()

	// Scroll event manager (pub/sub for scroll events)
	readonly scrollEvents: ScrollEventManager

	// Focus event manager (pub/sub for blur/focusout events)
	readonly focusEvents: FocusEventManager

	// Click event manager (pub/sub for click inside/outside events)
	readonly clickEvents: ClickEventManager

	// Action pipeline adapter (for 'always' editTrigger mode)
	pipelineAdapter: ActionPipelineAdapter<T> | null = null

	constructor() {
		super()
		this.shadow = this.attachShadow({ mode: 'open' })
		this.grid = new WebGrid<T>()

		// Install `onpaste` proxy at the instance level. Cannot be declared
		// as a class accessor because HTMLElement already defines onpaste as
		// a ClipboardEvent handler — see the comment on the onbeforepaste
		// proxy for context.
		Object.defineProperty(this, 'onpaste', {
			configurable: true,
			enumerable: true,
			get: (): ((detail: PasteDetail<T>) => void) | undefined => this.grid.onpaste,
			set: (value: ((detail: PasteDetail<T>) => void) | undefined): void => {
				this.grid.onpaste = value
			}
		})

		this.scrollEvents = createScrollEventManager()
		this.clickEvents = createClickEventManager()
		this.focusEvents = createFocusEventManager(
			() => ({
				isCommittingFromKeyboard: this.isCommittingFromKeyboard,
				isTransitioningCells: this.isTransitioningCells,
				isClosingViaToggle: this.dropdown.isClosingViaToggle,
				isOpeningDropdown: this.dropdown.isOpening
			}),
			() => { this.dropdown.setIsClosingViaToggle(false) }
		)

		// Inject styles immediately to prevent FOUC
		this.styleElement = document.createElement('style')
		this.styleElement.textContent = styles
		this.shadow.appendChild(this.styleElement)

		// Override requestUpdate to invalidate the data-pipeline cache and trigger DOM render.
		// Every state-changing setter on WebGrid funnels through requestUpdate(), so this is
		// the single canonical point to drop cached paginatedItems / displayItems.
		;(this.grid as unknown as { requestUpdate: () => void }).requestUpdate = () => {
			this.grid.invalidateDisplayCache()
			this.requestUpdate()
		}

		// Handle interaction changes (cleanup dropdown when editing is cancelled externally)
		;(this.grid as unknown as { _onInteractionChange: ((type: string, detail: { prev: unknown, current: unknown }) => void) | null })._onInteractionChange = (type, detail) => {
			if (type === 'editingCell' && detail.current === null) {
				// Editing was cancelled - clean up dropdown if open
				removeDropdown(this)
			}
		}
	}

	// ==========================================================================
	// Web Component Lifecycle
	// ==========================================================================

	connectedCallback(): void {
		initLogger.debug('connectedCallback — grid attached to DOM')
		// Load persisted column widths before initial render
		if (this.grid.gridName && this.grid.shouldPersistColumnWidths) {
			this.grid.loadPersistedWidths()
		}
		// Initialize action pipeline adapter for 'always' editTrigger mode
		this.pipelineAdapter = createActionPipelineAdapter(this)
		this.render()
		// Register paste handler for navigate mode
		this.addEventListener('paste', this.handlePaste as EventListener)
	}

	disconnectedCallback(): void {
		initLogger.debug('disconnectedCallback — grid removed from DOM')
		// Cleanup event managers
		this.scrollEvents.destroy()
		this.focusEvents.destroy()
		this.clickEvents.destroy()
		this.clickEventsSubscribed = false
		this.focusEventsSubscribed = false

		// Cleanup event listeners, observers, etc.
		this.removeEventListener('paste', this.handlePaste as EventListener)
		if (this.datepicker) {
			this.datepicker.destroy()
			this.datepicker = null
		}
		if (this.contextMenuElement) {
			closeContextMenu(this.contextMenuElement)
			this.contextMenuElement = null
		}
		if (this.headerContextMenuElement) {
			closeContextMenu(this.headerContextMenuElement)
			this.headerContextMenuElement = null
		}
		// Close any open toolbar
		closeToolbar()
		// Cleanup inline shortcuts
		removeInlineShortcuts(this)
		// Cleanup selection borders
		removeAllSelectionBorders()
	}

	// ==========================================================================
	// Public API - Proxy to WebGrid
	// ==========================================================================

	get items(): T[] { return this.grid.items }
	set items(value: T[]) {
		this.grid.items = value
		// Reset infinite scroll loading flag
		this.virtualScroll.setIsLoadingMore(false)
	}

	get columns(): Column<T>[] { return this.grid.columns }
	set columns(value: Column<T>[]) { this.grid.columns = value }

	get isFilterable(): boolean { return this.grid.isFilterable }
	set isFilterable(value: boolean) { this.grid.isFilterable = value }

	get onfilterchange(): ((filters: Record<string, string>) => void) | undefined { return this.grid.onfilterchange }
	set onfilterchange(value: ((filters: Record<string, string>) => void) | undefined) { this.grid.onfilterchange = value }

	get columnMinWidth(): string | undefined { return this.grid.columnMinWidth }
	set columnMinWidth(value: string | undefined) { this.grid.columnMinWidth = value }

	get filters(): Record<string, string> { return this.grid.filters }
	set filters(value: Record<string, string>) { this.grid.filters = value }
	setFilter(field: string, value: string): void { this.grid.setFilter(field, value) }

	get isPageable(): boolean { return this.grid.isPageable }
	set isPageable(value: boolean) { this.grid.isPageable = value }

	get pageSize(): number { return this.grid.pageSize }
	set pageSize(value: number) { this.grid.pageSize = value }

	get pageSizes(): number[] { return this.grid.pageSizes }
	set pageSizes(value: number[]) { this.grid.pageSizes = value }

	get paginationMode(): 'client' | 'server' { return this.grid.paginationMode }
	set paginationMode(value: 'client' | 'server') { this.grid.paginationMode = value }

	get isStriped(): boolean { return this.grid.isStriped }
	set isStriped(value: boolean) { this.grid.isStriped = value }

	get isHoverable(): boolean { return this.grid.isHoverable }
	set isHoverable(value: boolean) { this.grid.isHoverable = value }

	get isEditable(): boolean { return this.grid.isEditable }
	set isEditable(value: boolean) { this.grid.isEditable = value }

	get isRowEditable(): boolean | ((row: T) => boolean) | undefined { return this.grid.isRowEditable }
	set isRowEditable(value: boolean | ((row: T) => boolean) | undefined) { this.grid.isRowEditable = value }

	get editTrigger(): EditTrigger { return this.grid.editTrigger }
	set editTrigger(value: EditTrigger) { this.grid.editTrigger = value }

	get editStartSelection(): EditStartSelection { return this.grid.editStartSelection }
	set editStartSelection(value: EditStartSelection) { this.grid.editStartSelection = value }

	get shouldCommitOnClickAway(): boolean { return this.grid.shouldCommitOnClickAway }
	set shouldCommitOnClickAway(value: boolean) { this.grid.shouldCommitOnClickAway = value }

	get mode(): GridMode { return this.grid.mode }
	set mode(value: GridMode) { this.grid.mode = value }

	get dropdownToggleVisibility(): ToggleVisibility { return this.grid.dropdownToggleVisibility }
	set dropdownToggleVisibility(value: ToggleVisibility) { this.grid.dropdownToggleVisibility = value }

	get shouldShowDropdownOnFocus(): boolean { return this.grid.shouldShowDropdownOnFocus }
	set shouldShowDropdownOnFocus(value: boolean) { this.grid.shouldShowDropdownOnFocus = value }

	get shouldOpenDropdownOnEnter(): boolean { return this.grid.shouldOpenDropdownOnEnter }
	set shouldOpenDropdownOnEnter(value: boolean) { this.grid.shouldOpenDropdownOnEnter = value }

	get isCheckboxAlwaysEditable(): boolean { return this.grid.isCheckboxAlwaysEditable }
	set isCheckboxAlwaysEditable(value: boolean) { this.grid.isCheckboxAlwaysEditable = value }

	get isRowNumbersVisible(): boolean { return this.grid.isRowNumbersVisible }
	set isRowNumbersVisible(value: boolean) { this.grid.isRowNumbersVisible = value }

	get isDirtyIndicatorVisible(): boolean { return this.grid.isDirtyIndicatorVisible }
	set isDirtyIndicatorVisible(value: boolean) { this.grid.isDirtyIndicatorVisible = value }

	isCellDirty(rowIndex: number, field: string): boolean { return this.grid.isCellDirty(rowIndex, field) }
	isRowDirty(rowIndex: number): boolean { return this.grid.isRowDirty(rowIndex) }

	get isStickyRowNumbers(): boolean { return this.grid.isStickyRowNumbers }
	set isStickyRowNumbers(value: boolean) { this.grid.isStickyRowNumbers = value }

	get freezeColumns(): number { return this.grid.freezeColumns }
	set freezeColumns(value: number) { this.grid.freezeColumns = value }

	get invalidCells(): CellValidationState[] { return this.grid.invalidCells }
	set invalidCells(value: CellValidationState[]) { this.grid.invalidCells = value }

	get isRowToolbarVisible(): boolean { return this.grid.isRowToolbarVisible }
	set isRowToolbarVisible(value: boolean) { this.grid.isRowToolbarVisible = value }

	get rowToolbar(): RowToolbarConfig<T>[] { return this.grid.rowToolbar }
	set rowToolbar(value: RowToolbarConfig<T>[]) { this.grid.rowToolbar = value }

	get toolbarVerticalAlign(): 'top' | 'center' | 'bottom' { return this.grid.toolbarVerticalAlign }
	set toolbarVerticalAlign(value: 'top' | 'center' | 'bottom') { this.grid.toolbarVerticalAlign = value }

	get toolbarHorizontalAlign(): 'start' | 'center' | 'end' | 'cursor' { return this.grid.toolbarHorizontalAlign }
	set toolbarHorizontalAlign(value: 'start' | 'center' | 'end' | 'cursor') { this.grid.toolbarHorizontalAlign = value }

	// Deprecated aliases
	get toolbarAlign(): 'top' | 'center' | 'bottom' { return this.grid.toolbarVerticalAlign }
	set toolbarAlign(value: 'top' | 'center' | 'bottom') { this.grid.toolbarVerticalAlign = value }

	get toolbarTopPosition(): 'start' | 'center' | 'end' | 'cursor' { return this.grid.toolbarHorizontalAlign }
	set toolbarTopPosition(value: 'start' | 'center' | 'end' | 'cursor') { this.grid.toolbarHorizontalAlign = value }

	get toolbarTrigger(): 'hover' | 'click' | 'button' { return this.grid.toolbarTrigger }
	set toolbarTrigger(value: 'hover' | 'click' | 'button') { this.grid.toolbarTrigger = value }

	get toolbarPosition(): ToolbarPosition { return this.grid.toolbarPosition }
	set toolbarPosition(value: ToolbarPosition) { this.grid.toolbarPosition = value }

	get toolbarColumn(): string | number | undefined { return this.grid.toolbarColumn }
	set toolbarColumn(value: string | number | undefined) { this.grid.toolbarColumn = value }

	get shouldToolbarFollowCursor(): boolean { return this.grid.shouldToolbarFollowCursor }
	set shouldToolbarFollowCursor(value: boolean) { this.grid.shouldToolbarFollowCursor = value }

	/** @deprecated use `shouldToolbarFollowCursor` */
	get toolbarFollowsCursor(): boolean { return this.grid.shouldToolbarFollowCursor }
	/** @deprecated use `shouldToolbarFollowCursor` */
	set toolbarFollowsCursor(value: boolean) { this.grid.shouldToolbarFollowCursor = value }

	get cellToolbar(): ((row: T, rowIndex: number, field: string, colIndex: number) => RowToolbarConfig<T>[] | undefined) | undefined {
		return this.grid.cellToolbar
	}
	set cellToolbar(value: ((row: T, rowIndex: number, field: string, colIndex: number) => RowToolbarConfig<T>[] | undefined) | undefined) {
		this.grid.cellToolbar = value
	}

	get cellToolbarOffset(): number | string { return this.grid.cellToolbarOffset }
	set cellToolbarOffset(value: number | string) { this.grid.cellToolbarOffset = value }

	get toolbarBtnMinWidth(): string | undefined { return this.grid.toolbarBtnMinWidth }
	set toolbarBtnMinWidth(value: string | undefined) { this.grid.toolbarBtnMinWidth = value }

	get inlineActionsTitle(): string { return this.grid.inlineActionsTitle }
	set inlineActionsTitle(value: string) { this.grid.inlineActionsTitle = value }

	get contextMenu(): ContextMenuConfig<T>[] | undefined { return this.grid.contextMenu }
	set contextMenu(value: ContextMenuConfig<T>[] | undefined) { this.grid.contextMenu = value }

	get contextMenuXOffset(): number { return this.grid.contextMenuXOffset }
	set contextMenuXOffset(value: number) { this.grid.contextMenuXOffset = value }

	get contextMenuYOffset(): number { return this.grid.contextMenuYOffset }
	set contextMenuYOffset(value: number) { this.grid.contextMenuYOffset = value }

	// Header context menu
	get headerContextMenu(): HeaderMenuConfig<T>[] | undefined { return this.grid.headerContextMenu }
	set headerContextMenu(value: HeaderMenuConfig<T>[] | undefined) { this.grid.headerContextMenu = value }

	set onheadercontextmenuopen(value: ((context: HeaderMenuContext<T>) => void) | undefined) {
		this.grid.onheadercontextmenuopen = value
	}

	// Row keyboard shortcuts
	get rowShortcuts(): RowShortcut<T>[] | undefined { return this.grid.rowShortcuts }
	set rowShortcuts(value: RowShortcut<T>[] | undefined) { this.grid.rowShortcuts = value }

	// Range shortcuts (for multi-row selection)
	get rangeShortcuts(): RangeShortcut<T>[] { return this.grid.rangeShortcuts }
	set rangeShortcuts(value: RangeShortcut<T>[]) { this.grid.rangeShortcuts = value }

	// Row selection
	get selectedRows(): number[] { return this.grid.selectedRows }
	selectRow(rowIndex: number, mode: 'replace' | 'toggle' | 'range' = 'replace'): void { this.grid.selectRow(rowIndex, mode) }
	selectRowRange(fromIndex: number, toIndex: number): void { this.grid.selectRowRange(fromIndex, toIndex) }
	clearSelection(): void { this.grid.clearSelection() }
	isRowSelected(rowIndex: number): boolean { return this.grid.isRowSelected(rowIndex) }
	getSelectedRowsData(): T[] { return this.grid.getSelectedRowsData() }
	copySelectedRowsToClipboard(): Promise<boolean> { return this.grid.copySelectedRowsToClipboard() }

	// Cell range selection
	get cellSelectionMode() { return this.grid.cellSelectionMode }
	set cellSelectionMode(value) { this.grid.cellSelectionMode = value }

	get selectedCellRange() { return this.grid.selectedCellRange }
	selectCellRange(range: any): void { this.grid.selectCellRange(range) }
	clearCellSelection(): void { this.grid.clearCellSelection() }
	getSelectedCells() { return this.grid.getSelectedCells() }
	copyCellSelectionToClipboard(): Promise<boolean> { return this.grid.copyCellSelectionToClipboard() }

	get shouldCopyWithHeaders(): boolean { return this.grid.shouldCopyWithHeaders }
	set shouldCopyWithHeaders(value: boolean) { this.grid.shouldCopyWithHeaders = value }

	get oncellselectionchange() { return this.grid.oncellselectionchange }
	set oncellselectionchange(value) { this.grid.oncellselectionchange = value }

	// New empty row (inline data entry) — EXPERIMENTAL: API may change
	get isNewRowEnabled(): boolean { return this.grid.isNewRowEnabled }
	set isNewRowEnabled(value: boolean) { this.grid.isNewRowEnabled = value }

	get newRowPosition() { return this.grid.newRowPosition }
	set newRowPosition(value) { this.grid.newRowPosition = value }

	get newRowIndicator(): string { return this.grid.newRowIndicator }
	set newRowIndicator(value: string) { this.grid.newRowIndicator = value }

	get createEmptyRowCallback() { return this.grid.createEmptyRowCallback }
	set createEmptyRowCallback(value) { this.grid.createEmptyRowCallback = value }

	// Tree / hierarchy
	get idMember(): string | null { return this.grid.idMember }
	set idMember(value: string | null) { this.grid.idMember = value }

	get treePathMember(): string | null { return this.grid.treePathMember }
	set treePathMember(value: string | null) { this.grid.treePathMember = value }

	get treeLevelMember(): string | null { return this.grid.treeLevelMember }
	set treeLevelMember(value: string | null) { this.grid.treeLevelMember = value }

	get treeParentMember(): string | null { return this.grid.treeParentMember }
	set treeParentMember(value: string | null) { this.grid.treeParentMember = value }

	get treeSeparator(): string | null { return this.grid.treeSeparator }
	set treeSeparator(value: string | null) { this.grid.treeSeparator = value }

	get treeDataSorted(): boolean { return this.grid.treeDataSorted }
	set treeDataSorted(value: boolean) { this.grid.treeDataSorted = value }

	get expandedPaths(): Set<string> { return this.grid.expandedPaths }
	set expandedPaths(value: Set<string> | null | undefined) { this.grid.expandedPaths = value as Set<string> }

	get defaultExpandDepth(): number | null { return this.grid.defaultExpandDepth }
	set defaultExpandDepth(value: number | null) { this.grid.defaultExpandDepth = value }

	set onexpandedpathschange(value: ((detail: import('./types.js').TreeExpandedChangeDetail) => void) | undefined) {
		this.grid.onexpandedpathschange = value
	}
	get onexpandedpathschange() { return this.grid.onexpandedpathschange }

	isPathExpanded(path: string): boolean { return this.grid.isPathExpanded(path) }
	toggleExpandedPath(path: string): void { this.grid.toggleExpandedPath(path) }
	expandAll(): void { this.grid.expandAll() }
	collapseAll(): void { this.grid.collapseAll() }

	get treeDoubleClickBehavior(): import('./types.js').TreeDoubleClickBehavior { return this.grid.treeDoubleClickBehavior }
	set treeDoubleClickBehavior(value: import('./types.js').TreeDoubleClickBehavior) { this.grid.treeDoubleClickBehavior = value }

	get treeExpandedGlyph(): string { return this.grid.treeExpandedGlyph }
	set treeExpandedGlyph(value: string) { this.grid.treeExpandedGlyph = value }

	get treeCollapsedGlyph(): string { return this.grid.treeCollapsedGlyph }
	set treeCollapsedGlyph(value: string) { this.grid.treeCollapsedGlyph = value }

	get treeChevronCallback(): import('./types.js').TreeChevronCallback<T> | undefined {
		return this.grid.treeChevronCallback
	}
	set treeChevronCallback(value: import('./types.js').TreeChevronCallback<T> | undefined) {
		this.grid.treeChevronCallback = value
	}

	get isShortcutsHelpVisible(): boolean { return this.grid.isShortcutsHelpVisible }
	set isShortcutsHelpVisible(value: boolean) { this.grid.isShortcutsHelpVisible = value }

	get shortcutsHelpPosition(): 'top-right' | 'top-left' { return this.grid.shortcutsHelpPosition }
	set shortcutsHelpPosition(value: 'top-right' | 'top-left') { this.grid.shortcutsHelpPosition = value }

	get shortcutsHelpContentCallback(): (() => string) | undefined { return this.grid.shortcutsHelpContentCallback }
	set shortcutsHelpContentCallback(value: (() => string) | undefined) { this.grid.shortcutsHelpContentCallback = value }

	// Callback setters
	set onrowchange(value: ((detail: RowChangeDetail<T>) => void) | undefined) {
		this.grid.onrowchange = value
	}

	set onroweditstart(value: ((detail: { row: T, rowIndex: number, field: string }) => void) | undefined) {
		this.grid.onroweditstart = value
	}

	set onroweditcancel(value: ((detail: { row: T, rowIndex: number, field: string }) => void) | undefined) {
		this.grid.onroweditcancel = value
	}

	set onvalidationerror(value: ((detail: { row: T, rowIndex: number, field: string, error: string }) => void) | undefined) {
		this.grid.onvalidationerror = value
	}

	get validationTooltipCallback(): ((context: ValidationTooltipContext<T>) => string | null) | undefined {
		return this.grid.validationTooltipCallback
	}
	set validationTooltipCallback(value: ((context: ValidationTooltipContext<T>) => string | null) | undefined) {
		this.grid.validationTooltipCallback = value
	}

	set ontoolbarclick(value: ((detail: ToolbarClickDetail<T>) => void) | undefined) {
		this.grid.ontoolbarclick = value
	}

	set onrowaction(value: ((detail: RowActionClickDetail<T>) => void) | undefined) {
		this.grid.onrowaction = value
	}

	get oncontextmenuopen(): ((context: ContextMenuContext<T>) => void) | undefined {
		return this.grid.oncontextmenuopen
	}
	set oncontextmenuopen(value: ((context: ContextMenuContext<T>) => void) | undefined) {
		this.grid.oncontextmenuopen = value
	}

	get ondatarequest(): ((detail: DataRequestDetail) => void) | undefined {
		return this.grid.ondatarequest
	}
	set ondatarequest(value: ((detail: DataRequestDetail) => void) | undefined) {
		this.grid.ondatarequest = value
	}

	get onrowdelete(): ((detail: { rowIndex: number; row: T }) => void) | undefined {
		return this.grid.onrowdelete
	}
	set onrowdelete(value: ((detail: { rowIndex: number; row: T }) => void) | undefined) {
		this.grid.onrowdelete = value
	}

	get onrowfocus(): ((detail: RowFocusDetail<T>) => void) | undefined {
		return this.grid.onrowfocus
	}
	set onrowfocus(value: ((detail: RowFocusDetail<T>) => void) | undefined) {
		this.grid.onrowfocus = value
	}

	get focusedRowIndex(): number | null { return this.grid.focusedRowIndex }
	set focusedRowIndex(value: number | null) { this.grid.focusedRowIndex = value }

	// Sorting & Pagination
	get sort(): SortState[] { return this.grid.sort }
	set sort(value: SortState[]) { this.grid.sort = value }

	get sortMode(): SortMode { return this.grid.sortMode }
	set sortMode(value: SortMode) { this.grid.sortMode = value }

	get currentPage(): number { return this.grid.currentPage }
	set currentPage(value: number) { this.grid.currentPage = value }

	get totalItems(): number | null { return this.grid.totalItems }
	set totalItems(value: number | null) { this.grid.totalItems = value }

	get isPaginationVisible(): boolean | 'auto' { return this.grid.isPaginationVisible }
	set isPaginationVisible(value: boolean | 'auto') { this.grid.isPaginationVisible = value }

	/** @deprecated use `isPaginationVisible` */
	get showPagination(): boolean | 'auto' { return this.grid.isPaginationVisible }
	/** @deprecated use `isPaginationVisible` */
	set showPagination(value: boolean | 'auto') { this.grid.isPaginationVisible = value }

	get paginationPosition(): string { return this.grid.paginationPosition }
	set paginationPosition(value: string) { this.grid.paginationPosition = value }

	get paginationLabelsCallback(): PaginationLabelsCallback | undefined { return this.grid.paginationLabelsCallback }
	set paginationLabelsCallback(value: PaginationLabelsCallback | undefined) { this.grid.paginationLabelsCallback = value }

	get paginationLayout(): string { return this.grid.paginationLayout }
	set paginationLayout(value: string) { this.grid.paginationLayout = value }

	get summaryPosition(): string | undefined { return this.grid.summaryPosition }
	set summaryPosition(value: string | undefined) { this.grid.summaryPosition = value }

	get summaryContentCallback(): SummaryContentCallback<T> | undefined { return this.grid.summaryContentCallback }
	set summaryContentCallback(value: SummaryContentCallback<T> | undefined) { this.grid.summaryContentCallback = value }

	get customStylesCallback(): (() => string) | undefined { return this.grid.customStylesCallback }
	set customStylesCallback(value: (() => string) | undefined) {
		this.grid.customStylesCallback = value
		this.updateCustomStyles()
	}

	get rowClassCallback(): ((row: T, rowIndex: number) => string | null) | undefined { return this.grid.rowClassCallback }
	set rowClassCallback(value: ((row: T, rowIndex: number) => string | null) | undefined) { this.grid.rowClassCallback = value }

	get labels(): GridLabels { return this.grid.labels }
	set labels(value: Partial<GridLabels>) { this.grid.labels = value }

	get summaryMetadata(): unknown { return this.grid.summaryMetadata }
	set summaryMetadata(value: unknown) { this.grid.summaryMetadata = value }

	get isSummaryInline(): boolean { return this.grid.isSummaryInline }
	set isSummaryInline(value: boolean) { this.grid.isSummaryInline = value }

	// Row identification
	get idValueMember(): keyof T | undefined { return this.grid.idValueMember }
	set idValueMember(value: keyof T | undefined) { this.grid.idValueMember = value }

	get idValueCallback(): ((row: T) => unknown) | undefined { return this.grid.idValueCallback }
	set idValueCallback(value: ((row: T) => unknown) | undefined) { this.grid.idValueCallback = value }

	// Row locking
	get rowLocking(): RowLockingOptions<T> | undefined { return this.grid.rowLocking }
	set rowLocking(value: RowLockingOptions<T> | undefined) { this.grid.rowLocking = value }

	get onrowlockchange(): ((detail: RowLockChangeDetail<T>) => void) | undefined { return this.grid.onrowlockchange }
	set onrowlockchange(value: ((detail: RowLockChangeDetail<T>) => void) | undefined) { this.grid.onrowlockchange = value }

	// Column resize & persistence
	get gridName(): string | null { return this.grid.gridName }
	set gridName(value: string | null) {
		this.grid.gridName = value
		// Load persisted widths if both gridName and persistColumnWidths are set
		this.tryLoadPersistedWidths()
	}

	get shouldPersistColumnWidths(): boolean { return this.grid.shouldPersistColumnWidths }
	set shouldPersistColumnWidths(value: boolean) {
		this.grid.shouldPersistColumnWidths = value
		this.tryLoadPersistedState()
	}

	get isColumnReorderAllowed(): boolean { return this.grid.isColumnReorderAllowed }
	set isColumnReorderAllowed(value: boolean) { this.grid.isColumnReorderAllowed = value }

	get shouldPersistColumnOrder(): boolean { return this.grid.shouldPersistColumnOrder }
	set shouldPersistColumnOrder(value: boolean) {
		this.grid.shouldPersistColumnOrder = value
		this.tryLoadPersistedState()
	}

	/**
	 * Try to load persisted state (widths/order) if conditions are met
	 */
	private tryLoadPersistedState(): void {
		if (this.grid.gridName && (this.grid.shouldPersistColumnWidths || this.grid.shouldPersistColumnOrder)) {
			this.grid.loadPersistedState()
			// Re-render if we're connected to DOM
			if (this.isConnected) {
				this.render()
			}
		}
	}

	// Keep old method for backwards compatibility
	private tryLoadPersistedWidths(): void {
		this.tryLoadPersistedState()
	}

	get oncolumnresize(): ((detail: ColumnResizeDetail) => void) | undefined { return this.grid.oncolumnresize }
	set oncolumnresize(value: ((detail: ColumnResizeDetail) => void) | undefined) { this.grid.oncolumnresize = value }

	get oncolumnreorder(): ((detail: ColumnReorderDetail) => void) | undefined { return this.grid.oncolumnreorder }
	set oncolumnreorder(value: ((detail: ColumnReorderDetail) => void) | undefined) { this.grid.oncolumnreorder = value }

	// Fill handle callback
	get fillDragCallback(): ((detail: FillDragDetail) => boolean | void) | undefined { return this.grid.fillDragCallback }
	set fillDragCallback(value: ((detail: FillDragDetail) => boolean | void) | undefined) { this.grid.fillDragCallback = value }

	// Scroll behavior
	get isScrollable(): boolean { return this.grid.isScrollable }
	set isScrollable(value: boolean) { this.grid.isScrollable = value }

	get scrollMaxHeight(): string { return this.grid.scrollMaxHeight }
	set scrollMaxHeight(value: string) { this.grid.scrollMaxHeight = value }

	get isTableBorderOnly(): boolean { return this.grid.isTableBorderOnly }
	set isTableBorderOnly(value: boolean) { this.grid.isTableBorderOnly = value }

	/** @deprecated use `isTableBorderOnly` */
	get tableBorderOnly(): boolean { return this.grid.isTableBorderOnly }
	/** @deprecated use `isTableBorderOnly` */
	set tableBorderOnly(value: boolean) { this.grid.isTableBorderOnly = value }

	// Virtual scroll
	get isVirtualScrollEnabled(): boolean { return this.grid.isVirtualScrollEnabled }
	set isVirtualScrollEnabled(value: boolean) { this.grid.isVirtualScrollEnabled = value }

	get virtualScrollThreshold(): number { return this.grid.virtualScrollThreshold }
	set virtualScrollThreshold(value: number) { this.grid.virtualScrollThreshold = value }

	get virtualScrollRowHeight(): number { return this.grid.virtualScrollRowHeight }
	set virtualScrollRowHeight(value: number) { this.grid.virtualScrollRowHeight = value }

	get virtualScrollBuffer(): number { return this.grid.virtualScrollBuffer }
	set virtualScrollBuffer(value: number) { this.grid.virtualScrollBuffer = value }

	// Infinite scroll
	get isInfiniteScrollEnabled(): boolean { return this.grid.isInfiniteScrollEnabled }
	set isInfiniteScrollEnabled(value: boolean) { this.grid.isInfiniteScrollEnabled = value }

	get infiniteScrollThreshold(): number { return this.grid.infiniteScrollThreshold }
	set infiniteScrollThreshold(value: number) { this.grid.infiniteScrollThreshold = value }

	get hasMoreItems(): boolean { return this.grid.hasMoreItems }
	set hasMoreItems(value: boolean) { this.grid.hasMoreItems = value }

	// Paste
	// `onbeforepaste`, `pasteMode`, `shouldValidateOnPaste` are straight
	// proxies. `onpaste` is special: HTMLElement already defines it as a
	// ClipboardEvent handler, and declaring an incompatible class accessor
	// would break the structural-typing contract with HTMLElement (and the
	// `customElements.define` call). Instead we install our proxy at
	// construction time via Object.defineProperty (see installPasteProxy
	// below). TypeScript will still report the native ClipboardEvent type
	// when consumers read `el.onpaste`; in practice consumers should set
	// `onpaste` for the PasteDetail callback or fall back to
	// `el.grid.onpaste` for full type fidelity.
	get onbeforepaste(): ((detail: BeforePasteDetail<T>) => void) | undefined { return this.grid.onbeforepaste }
	set onbeforepaste(value: ((detail: BeforePasteDetail<T>) => void) | undefined) { this.grid.onbeforepaste = value }

	get pasteMode(): PasteMode { return this.grid.pasteMode }
	set pasteMode(value: PasteMode) { this.grid.pasteMode = value }

	get shouldValidateOnPaste(): boolean { return this.grid.shouldValidateOnPaste }
	set shouldValidateOnPaste(value: boolean) { this.grid.shouldValidateOnPaste = value }

	// Computed properties
	get displayItems(): T[] { return this.grid.displayItems }
	get totalPages(): number { return this.grid.totalPages }
	get isNavigateMode(): boolean { return this.grid.isNavigateMode }

	// Draft row methods
	getRowDraft(rowIndex: number): T | undefined { return this.grid.getRowDraft(rowIndex) }
	hasRowDraft(rowIndex: number): boolean { return this.grid.hasRowDraft(rowIndex) }
	discardRowDraft(rowIndex: number): void { this.grid.discardRowDraft(rowIndex) }
	getDraftRowIndices(): number[] { return this.grid.getDraftRowIndices() }
	discardAllDrafts(): void { this.grid.discardAllDrafts() }

	// Validation methods
	isCellInvalid(rowIndex: number, field: string): boolean { return this.grid.isCellInvalid(rowIndex, field) }
	getCellValidationError(rowIndex: number, field: string): string | null { return this.grid.getCellValidationError(rowIndex, field) }

	// Row identification methods
	getRowId(row: T): unknown | undefined { return this.grid.getRowId(row) }
	findRowById(id: unknown): { row: T; index: number } | null { return this.grid.findRowById(id) }

	// Row locking methods
	isRowLocked(rowOrId: T | unknown): boolean { return this.grid.isRowLocked(rowOrId) }
	getRowLockInfo(rowOrId: T | unknown): RowLock | null { return this.grid.getRowLockInfo(rowOrId) }
	lockRowById(id: unknown, lockerInfo?: Partial<RowLock>): boolean { return this.grid.lockRowById(id, lockerInfo) }
	unlockRowById(id: unknown): boolean { return this.grid.unlockRowById(id) }
	getExternalLocks(): Map<unknown, RowLock> { return this.grid.getExternalLocks() }
	clearExternalLocks(): void { this.grid.clearExternalLocks() }

	// Row update methods (for WebSocket/external updates)
	updateRowById(id: unknown, newData: Partial<T>): boolean { return this.grid.updateRowById(id, newData) }
	replaceRowById(id: unknown, newRow: T): boolean { return this.grid.replaceRowById(id, newRow) }

	// Edit permission check
	canEditCell(rowIndex: number, field: string): boolean { return this.grid.canEditCell(rowIndex, field) }

	// Column width methods
	setColumnWidth(field: string, width: string): void { this.grid.setColumnWidth(field, width) }
	setColumnWidths(widths: ColumnWidthState[]): void { this.grid.setColumnWidths(widths) }
	getColumnWidthsState(): ColumnWidthState[] { return this.grid.getColumnWidthsState() }

	// Column order methods
	setColumnOrder(order: ColumnOrderState[]): void { this.grid.setColumnOrder(order) }
	getColumnOrderState(): ColumnOrderState[] { return this.grid.getColumnOrderState() }

	// Public methods for focus and editing
	/**
	 * Programmatically focus a cell. Updates state and focuses the DOM element.
	 * State is updated immediately so pending renders use the correct position.
	 */
	focusCell(rowIndex: number, colIndex: number): void {
		const columns = this.grid.columns
		const displayItems = this.grid.displayItems
		if (rowIndex < 0 || rowIndex >= displayItems.length) return
		if (colIndex < 0 || colIndex >= columns.length) return

		// Update state immediately so any pending render uses the correct position
		this.grid.setFocusedCell(rowIndex, colIndex)

		// Schedule DOM focus for after any pending render completes
		requestAnimationFrame(() => {
			moveFocus(this, rowIndex, colIndex)
		})
	}

	/**
	 * Programmatically start editing a cell.
	 * Uses surgical DOM update instead of full re-render.
	 */
	startEditing(rowIndex: number, colIndex: number): void {
		const columns = this.grid.columns
		if (colIndex < 0 || colIndex >= columns.length) return

		const column = columns[colIndex]
		const field = String(column.field)

		// Update state (no longer triggers requestUpdate)
		this.grid.startEdit(rowIndex, field)

		// Surgical DOM update
		const cell = this.shadow.querySelector(
			`td[data-row="${rowIndex}"][data-col="${colIndex}"]`
		) as HTMLElement
		if (cell) {
			cell.classList.remove('wg__cell--focused')
			cell.classList.add('wg__cell--editing')
			cell.innerHTML = renderCellEditor(this, rowIndex, colIndex, column)
		}
	}

	// ==========================================================================
	// GridContext Implementation - Required by module functions
	// ==========================================================================

	escapeHtml(text: string): string {
		const div = document.createElement('div')
		div.textContent = text
		return div.innerHTML
	}

	getCurrentEditingColumn(): Column<T> | null {
		const editingCell = this.grid.editingCell
		if (!editingCell) return null
		return this.grid.columns.find(c => String(c.field) === editingCell.field) || null
	}

	getCurrentEditorOptions(): EditorOptions {
		const column = this.getCurrentEditingColumn()
		return column?.editorOptions || {}
	}

	// Delegate to module function - needed for lifecycle module
	moveFocusAfterCommit(rowIndex: number, field: string, direction: 'down' | 'up' | 'next' | 'prev'): void {
		moveFocusAfterCommit(this, rowIndex, field, direction)
	}

	// ==========================================================================
	// Update Mechanism
	// ==========================================================================

	private requestUpdate(): void {
		if (this.updatePending) return
		uiLogger.debug('requestUpdate: scheduling render')
		this.updatePending = true
		const __reqT0 = performance.now()

		// Batch updates using microtask
		queueMicrotask(() => {
			this.updatePending = false
			const __renderT0 = performance.now()
			perfLogger.debug('microtask delay:', (__renderT0 - __reqT0).toFixed(2), 'ms')
			this.render()
			perfLogger.debug('render() total:', (performance.now() - __renderT0).toFixed(2), 'ms')
		})
	}

	/**
	 * Update custom styles in shadow DOM from customStylesCallback
	 */
	private updateCustomStyles(): void {
		const callback = this.grid.customStylesCallback
		if (callback) {
			const css = callback()
			if (!this.customStyleElement) {
				this.customStyleElement = document.createElement('style')
				this.shadow.appendChild(this.customStyleElement)
			}
			this.customStyleElement.textContent = css
		} else if (this.customStyleElement) {
			this.customStyleElement.remove()
			this.customStyleElement = null
		}
	}

	// ==========================================================================
	// Keyboard Navigation - Cell level
	// ==========================================================================

	/**
	 * Handle keyboard navigation in cells
	 */
	private handleCellKeyDown(e: KeyboardEvent, rowIndex: number, colIndex: number): void {
		if (!this.grid.isNavigateMode) {
			return
		}

		const columns = this.grid.columns
		const displayItems = this.grid.displayItems

		// For Tab navigation, we still use editable columns only — recomputed per row
		// so heterogeneous trees (some rows entirely read-only) traverse correctly.
		const currentRowForTab = displayItems[rowIndex]
		const editableCols = this.grid.getEditableColumns(currentRowForTab)
		const currentEditableIndex = editableCols.findIndex(ec => ec.index === colIndex)

		// Ctrl+C - Copy to clipboard
		if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
			// If cell range is selected, copy the entire range
			if (this.grid.selectedCellRange) {
				e.preventDefault()
				this.grid.copyCellSelectionToClipboard()
				return
			}

			// Otherwise copy single cell value
			const column = columns[colIndex]
			const row = displayItems[rowIndex]
			if (column && row) {
				let value: unknown = this.grid.getCellRawValue(row, rowIndex, String(column.field))
				if (column.beforeCopyCallback) {
					value = column.beforeCopyCallback(value, row)
				}
				const textValue = value != null ? String(value) : ''
				navigator.clipboard.writeText(textValue)
			}
			return // Let browser also handle for visual feedback
		}

		// Check range shortcuts (when rows are selected)
		const selectedRowIndices = this.grid.selectedRows
		if (selectedRowIndices.length > 0) {
			const rangeShortcuts = this.grid.rangeShortcuts
			if (rangeShortcuts && rangeShortcuts.length > 0) {
				for (const shortcut of rangeShortcuts) {
					const combo = parseKeyCombo(shortcut.key)
					if (matchesKeyCombo(e, combo)) {
						// Build range context
						const ctx: RangeShortcutContext<T> = {
							rows: this.grid.getSelectedRowsData(),
							rowIndices: selectedRowIndices
						}

						// Check if disabled
						const isDisabled = typeof shortcut.disabled === 'function'
							? shortcut.disabled(ctx)
							: shortcut.disabled === true

						if (!isDisabled) {
							e.preventDefault()
							shortcut.action(ctx)
							return
						}
					}
				}
			}
		}

		// Check row shortcuts (user-defined keyboard shortcuts)
		const shortcuts = this.grid.rowShortcuts
		if (shortcuts && shortcuts.length > 0) {
			const column = columns[colIndex]
			const row = displayItems[rowIndex]
			if (column && row) {
				for (const shortcut of shortcuts) {
					const combo = parseKeyCombo(shortcut.key)
					if (matchesKeyCombo(e, combo)) {
						// Build shortcut context
						const ctx: ShortcutContext<T> = {
							row,
							rowIndex,
							colIndex,
							column,
							cellValue: this.grid.getCellRawValue(row, rowIndex, String(column.field))
						}

						// Check if disabled
						const isDisabled = typeof shortcut.disabled === 'function'
							? shortcut.disabled(ctx)
							: shortcut.disabled === true

						if (!isDisabled) {
							e.preventDefault()
							shortcut.action(ctx)
							return
						}
					}
				}
			}
		}

		switch (e.key) {
			case 'ArrowUp':
				e.preventDefault()
				if (rowIndex > 0) {
					moveFocus(this, rowIndex - 1, colIndex)
				}
				break

			case 'ArrowDown':
				e.preventDefault()
				if (rowIndex < displayItems.length - 1) {
					moveFocus(this, rowIndex + 1, colIndex)
				}
				break

			case 'ArrowLeft':
				e.preventDefault()
				// Ctrl/Cmd+ArrowLeft tree-collapse is handled at the table-keydown level,
				// before pipelineAdapter — this branch only runs for plain ArrowLeft.
				if (colIndex > 0) {
					moveFocus(this, rowIndex, colIndex - 1)
				}
				break

			case 'ArrowRight':
				e.preventDefault()
				// Ctrl/Cmd+ArrowRight tree-expand is handled at the table-keydown level.
				if (colIndex < columns.length - 1) {
					moveFocus(this, rowIndex, colIndex + 1)
				}
				break

			case 'Tab': {
				e.preventDefault()
				const direction: 'forward' | 'backward' = e.shiftKey ? 'backward' : 'forward'

				// If currently focused on a non-editable cell (now possible since all cells are
				// focusable in navigate mode), find the nearest editable column on this row first.
				let fromEditableIdx = currentEditableIndex
				if (fromEditableIdx === -1 && editableCols.length > 0) {
					if (direction === 'forward') {
						const next = editableCols.find(ec => ec.index > colIndex)
						if (next) {
							moveFocus(this, rowIndex, next.index)
							break
						}
						// No editable column to the right on this row; fall through with sentinel
						fromEditableIdx = editableCols.length - 1
					} else {
						const prev = [...editableCols].reverse().find(ec => ec.index < colIndex)
						if (prev) {
							moveFocus(this, rowIndex, prev.index)
							break
						}
						fromEditableIdx = 0
					}
				}

				const next = this.grid.findNextEditableCell(rowIndex, fromEditableIdx, direction)
				if (next) {
					moveFocus(this, next.rowIndex, next.colIndex)
				} else if (direction === 'forward' && this.grid.isEmptyRowIndex(rowIndex) && editableCols.length > 0) {
					// On last cell of empty row - wrap to first editable cell
					moveFocus(this, rowIndex, editableCols[0].index)
				}
				break
			}

			case 'Home':
				e.preventDefault()
				if (e.ctrlKey) {
					if (this.grid.shouldUseVirtualScroll()) {
						const oldFocus = this.grid.focusedCell
						this.grid.setFocusedCell(0, 0)
						this.scrollToRowProgrammatically(0)
						const cell = this.shadow.querySelector(`td[data-row="0"][data-col="0"]`) as HTMLElement
						if (cell) {
							cell.focus({ preventScroll: true })
							updateFocusVisual(this, oldFocus, { rowIndex: 0, colIndex: 0 })
						}
					} else {
						moveFocus(this, 0, 0)
					}
				} else {
					moveFocus(this, rowIndex, 0)
				}
				break

			case 'End':
				e.preventDefault()
				if (e.ctrlKey) {
					const lastRow = displayItems.length - 1
					const lastCol = columns.length - 1
					if (this.grid.shouldUseVirtualScroll()) {
						const oldFocus = this.grid.focusedCell
						this.grid.setFocusedCell(lastRow, lastCol)
						this.scrollToRowProgrammatically(lastRow)
						const cell = this.shadow.querySelector(`td[data-row="${lastRow}"][data-col="${lastCol}"]`) as HTMLElement
						if (cell) {
							cell.focus({ preventScroll: true })
							updateFocusVisual(this, oldFocus, { rowIndex: lastRow, colIndex: lastCol })
						}
					} else {
						moveFocus(this, lastRow, lastCol)
					}
				} else {
					moveFocus(this, rowIndex, columns.length - 1)
				}
				break

			case 'PageUp':
				e.preventDefault()
				if (e.ctrlKey) {
					if (this.grid.shouldUseVirtualScroll()) {
						const oldFocus = this.grid.focusedCell
						this.grid.setFocusedCell(0, colIndex)
						this.scrollToRowProgrammatically(0)
						const cell = this.shadow.querySelector(`td[data-row="0"][data-col="${colIndex}"]`) as HTMLElement
						if (cell) {
							cell.focus({ preventScroll: true })
							updateFocusVisual(this, oldFocus, { rowIndex: 0, colIndex })
						}
					} else {
						moveFocus(this, 0, colIndex)
					}
				} else {
					const newRowUp = Math.max(0, rowIndex - 10)
					if (this.grid.shouldUseVirtualScroll()) {
						const oldFocus = this.grid.focusedCell
						this.grid.setFocusedCell(newRowUp, colIndex)
						this.scrollToRowProgrammatically(newRowUp)
						const cell = this.shadow.querySelector(`td[data-row="${newRowUp}"][data-col="${colIndex}"]`) as HTMLElement
						if (cell) {
							cell.focus({ preventScroll: true })
							updateFocusVisual(this, oldFocus, { rowIndex: newRowUp, colIndex })
						}
					} else {
						moveFocus(this, newRowUp, colIndex)
					}
				}
				break

			case 'PageDown':
				e.preventDefault()
				if (e.ctrlKey) {
					const lastRow = displayItems.length - 1
					if (this.grid.shouldUseVirtualScroll()) {
						const oldFocus = this.grid.focusedCell
						this.grid.setFocusedCell(lastRow, colIndex)
						this.scrollToRowProgrammatically(lastRow)
						const cell = this.shadow.querySelector(`td[data-row="${lastRow}"][data-col="${colIndex}"]`) as HTMLElement
						if (cell) {
							cell.focus({ preventScroll: true })
							updateFocusVisual(this, oldFocus, { rowIndex: lastRow, colIndex })
						}
					} else {
						moveFocus(this, lastRow, colIndex)
					}
				} else {
					const newRowDown = Math.min(displayItems.length - 1, rowIndex + 10)
					if (this.grid.shouldUseVirtualScroll()) {
						const oldFocus = this.grid.focusedCell
						this.grid.setFocusedCell(newRowDown, colIndex)
						this.scrollToRowProgrammatically(newRowDown)
						// Focus the cell after scroll (renderVirtualRows may not run if range unchanged)
						const cell = this.shadow.querySelector(`td[data-row="${newRowDown}"][data-col="${colIndex}"]`) as HTMLElement
						if (cell) {
							cell.focus({ preventScroll: true })
							updateFocusVisual(this, oldFocus, { rowIndex: newRowDown, colIndex })
						}
					} else {
						moveFocus(this, newRowDown, colIndex)
					}
				}
				break

			case 'g':
			case 'G':
				if (e.ctrlKey) {
					e.preventDefault()
					this.showGoToRowDialog(colIndex)
				}
				break

			case 'Enter': {
				e.preventDefault()
				const column = columns[colIndex]
				const isDropdownColumn = column?.editor === 'select' || column?.editor === 'combobox' || column?.editor === 'autocomplete'
				const isEmptyRowEnter = this.grid.isEmptyRowIndex(rowIndex)

				if (isDropdownColumn && this.grid.getEffectiveShouldOpenDropdownOnEnter(column)) {
					tryStartEdit(this, rowIndex, colIndex)
					requestAnimationFrame(() => {
						if (!this.dropdown.isOpen) {
							openDropdownForCurrentEditor(this)
						}
					})
				} else if (isEmptyRowEnter && column && this.grid.isCellEditable(column)) {
					// On empty row, Enter starts editing the cell (like F2)
					tryStartEdit(this, rowIndex, colIndex)
				} else {
					if (rowIndex < displayItems.length - 1) {
						const targetCol = this.grid.tabTraversalStartColIndex ?? colIndex
						this.grid.tabTraversalStartColIndex = null
						moveFocus(this, rowIndex + 1, targetCol)
					}
				}
				break
			}

			case 'F2': {
				e.preventDefault()
				const f2Column = columns[colIndex]
				const f2IsDropdown = f2Column?.editor === 'select' || f2Column?.editor === 'combobox' || f2Column?.editor === 'autocomplete'
				const f2IsCustom = f2Column?.editor === 'custom'
				tryStartEdit(this, rowIndex, colIndex)
				if (f2IsDropdown) {
					requestAnimationFrame(() => {
						if (!this.dropdown.isOpen) {
							openDropdownForCurrentEditor(this)
						}
					})
				} else if (f2IsCustom) {
					requestAnimationFrame(() => {
						this.openCustomEditor(rowIndex, colIndex)
					})
				}
				break
			}

			case ' ': {
				e.preventDefault()
				const col = columns[colIndex]
				const isCheckbox = col?.editor === 'checkbox'
				const isDropdown = col?.editor === 'select' || col?.editor === 'combobox' || col?.editor === 'autocomplete'
				const isDate = col?.editor === 'date'
				const isCustom = col?.editor === 'custom'

				if (isCheckbox && col && this.grid.isCellEditable(col, displayItems[rowIndex])) {
					toggleCheckboxAndMove(this, rowIndex, colIndex)
				} else if (isDropdown) {
					tryStartEdit(this, rowIndex, colIndex)
					requestAnimationFrame(() => {
						if (!this.dropdown.isOpen) {
							openDropdownForCurrentEditor(this)
						}
					})
				} else if (isDate) {
					// Same pattern as dropdown - start edit and open datepicker
					tryStartEdit(this, rowIndex, colIndex)
					requestAnimationFrame(() => {
						const cell = this.shadowRoot?.querySelector(
							`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
						)
						const input = cell?.querySelector('.wg__date-input') as HTMLInputElement
						const anchor = cell?.querySelector('.wg__editor--date') as HTMLElement
						if (input && anchor) openDatePicker(this,input, anchor)
					})
				} else if (isCustom) {
					// Custom editors - start edit and call callback
					tryStartEdit(this, rowIndex, colIndex)
					requestAnimationFrame(() => {
						this.openCustomEditor(rowIndex, colIndex)
					})
				}
				break
			}

			case 'Escape':
				e.preventDefault()
				if (this.grid.editingCell) {
					clearEditingVisual(this)
					this.grid.cancelEdit()
				} else if (this.grid.selectedRows.length > 0) {
					// Clear row selection first
					this.grid.clearSelection()
				} else {
					const oldFocus = this.grid.focusedCell
					this.grid.clearFocusedCell()
					updateFocusVisual(this, oldFocus, null)
					;(e.target as HTMLElement)?.blur()
				}
				break

			case 'Delete': {
				e.preventDefault()
				const column = columns[colIndex]
				const row = displayItems[rowIndex]
				if (e.ctrlKey) {
					// Ctrl+Delete: Request row deletion
					if (row) {
						const detail = { rowIndex, row }
						if (this.grid.onrowdelete) {
							this.grid.onrowdelete(detail)
						}
						this.dispatchEvent(new CustomEvent('rowdelete', { detail }))
					}
				} else {
					// Delete: Clear cell content
					if (column && this.grid.isCellEditable(column, row)) {
						this.grid.commitEdit(rowIndex, String(column.field), null)
						this.render()
						// Restore focus to the same cell
						requestAnimationFrame(() => {
							const cell = this.shadow.querySelector(
								`td[data-row="${rowIndex}"][data-col="${colIndex}"]`
							) as HTMLElement
							cell?.focus()
						})
					}
				}
				break
			}

			default:
				// Printable characters start editing with initial query
				if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
					const col = columns[colIndex]
					// For number columns, only allow numeric input to start editing
					if (col?.editor === 'number') {
						if (!/[\d.\-]/.test(e.key)) {
							return // Ignore non-numeric keys for number columns
						}
					}
					tryStartEdit(this, rowIndex, colIndex, { initialSearchQuery: e.key })
					e.preventDefault()
				}
				break
		}
	}

	// ==========================================================================
	// Editor Event Handlers
	// ==========================================================================

	/**
	 * Handle keydown in editor inputs
	 */
	private async handleEditorKeyDown(e: KeyboardEvent, editor: HTMLElement): Promise<void> {
		const rowIndex = parseInt(editor.dataset.row || '0', 10)
		const field = editor.dataset.field || ''
		const column = this.grid.columns.find(c => c.field === field)
		const editorType = column?.editor || 'text'
		const isDropdownEditor = editorType === 'select' || editorType === 'combobox' || editorType === 'autocomplete'

		// For dropdown editors with CLOSED dropdown, navigation keys cancel edit and navigate
		const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']
		if (isDropdownEditor && !this.dropdown.isOpen && navKeys.includes(e.key)) {
			e.preventDefault()
			e.stopPropagation()

			const colIndex = this.grid.columns.findIndex(c => c.field === field)
			const editableCols = this.grid.columns
				.map((c, i) => ({ index: i, column: c }))
				.filter(ec => ec.column.isEditable !== false)
			const currentEditableIdx = editableCols.findIndex(ec => ec.index === colIndex)
			const displayItems = this.grid.displayItems

			let destRow = rowIndex
			let destCol = colIndex
			let canNavigate = false

			switch (e.key) {
				case 'ArrowUp':
					if (rowIndex > 0) { destRow = rowIndex - 1; canNavigate = true }
					break
				case 'ArrowDown':
					if (rowIndex < displayItems.length - 1) { destRow = rowIndex + 1; canNavigate = true }
					break
				case 'ArrowLeft':
					if (currentEditableIdx > 0) { destCol = editableCols[currentEditableIdx - 1].index; canNavigate = true }
					break
				case 'ArrowRight':
					if (currentEditableIdx < editableCols.length - 1) { destCol = editableCols[currentEditableIdx + 1].index; canNavigate = true }
					break
				case 'PageUp':
					destRow = Math.max(0, rowIndex - 10); canNavigate = true
					break
				case 'PageDown':
					destRow = Math.min(displayItems.length - 1, rowIndex + 10); canNavigate = true
					break
				case 'Home':
					if (e.ctrlKey) { destRow = 0; destCol = 0 } else { destCol = 0 }
					canNavigate = true
					break
				case 'End':
					if (e.ctrlKey) { destRow = displayItems.length - 1; destCol = this.grid.columns.length - 1 } else { destCol = this.grid.columns.length - 1 }
					canNavigate = true
					break
			}

			if (canNavigate) {
				clearEditingVisual(this)
				this.grid.cancelEdit()
				queueMicrotask(() => {
					moveFocus(this, destRow, destCol)
				})
			}
			return
		}

		switch (e.key) {
			case 'ArrowDown':
				if (this.dropdown.isOpen) {
					e.preventDefault()
					e.stopPropagation()
					const optsDown = this.getCurrentEditorOptions()
					// Find next non-disabled option
					let nextIndex = this.dropdown.highlightedIndex + 1
					while (nextIndex < this.dropdown.options.length && isOptionDisabled(this.dropdown.options[nextIndex], optsDown)) {
						nextIndex++
					}
					if (nextIndex < this.dropdown.options.length) {
						this.dropdown.setHighlightedIndex(nextIndex)
						updateDropdownHighlight(this)
						scrollHighlightedIntoView(this)
					}
				}
				break

			case 'ArrowUp':
				if (this.dropdown.isOpen) {
					e.preventDefault()
					e.stopPropagation()
					const optsUp = this.getCurrentEditorOptions()
					// Find previous non-disabled option
					let prevIndex = this.dropdown.highlightedIndex - 1
					while (prevIndex >= 0 && isOptionDisabled(this.dropdown.options[prevIndex], optsUp)) {
						prevIndex--
					}
					if (prevIndex >= 0) {
						this.dropdown.setHighlightedIndex(prevIndex)
						updateDropdownHighlight(this)
						scrollHighlightedIntoView(this)
					}
				}
				break

			case 'Enter':
				// If datepicker is open, let it handle Enter (selects focused date)
				if (this.datepicker) {
					return
				}
				e.preventDefault()
				e.stopPropagation()
				if (this.dropdown.isOpen && this.dropdown.highlightedIndex >= 0) {
					// Enter with dropdown selects option and commits empty row
					selectDropdownOption(this, this.dropdown.highlightedIndex, true, true)
				} else if (isDropdownEditor && !this.dropdown.isOpen) {
					openDropdownForCurrentEditor(this)
				} else {
					this.isCommittingFromKeyboard = true
					removeDropdown(this)
					if (editorType === 'date' && editor instanceof HTMLInputElement) {
						// Enter commits empty row (adds to items if it has data)
						await commitDateEditor(this,editor, true)
					} else {
						// Enter commits empty row (adds to items if it has data)
						await commitCurrentEditor(this, editor, true)
					}
					moveFocusAfterCommit(this, rowIndex, field, 'down')
				}
				break

			case 'Tab':
				// If datepicker is open, let it handle Tab (selects focused date)
				if (this.datepicker) {
					return
				}
				e.preventDefault()
				e.stopPropagation()
				this.isCommittingFromKeyboard = true

				// Check if we're on the empty row's last editable cell (Tab should commit)
				const tabRow = this.grid.displayItems[rowIndex]
				const tabEditableCols = this.grid.getEditableColumns(tabRow)
				const tabColIndex = this.grid.columns.findIndex(c => String(c.field) === field)
				const tabCurrentEditableIndex = tabEditableCols.findIndex(ec => ec.index === tabColIndex)
				const isOnEmptyRow = this.grid.isEmptyRowIndex(rowIndex)
				const isLastEditableCell = tabCurrentEditableIndex === tabEditableCols.length - 1
				const shouldCommitEmptyRow = isOnEmptyRow && isLastEditableCell && !e.shiftKey

				// For dropdowns with a highlighted option, select it before moving
				if (this.dropdown.isOpen && this.dropdown.highlightedIndex >= 0 && isDropdownEditor) {
					// Select the highlighted option - this commits the value (skip if disabled)
					const option = this.dropdown.options[this.dropdown.highlightedIndex]
					const opts = this.getCurrentEditorOptions()
					if (option && !isOptionDisabled(option, opts)) {
						const value = getOptionValue(option, opts)
						await this.grid.commitEdit(rowIndex, field, value, shouldCommitEmptyRow)
					}
					removeDropdown(this)
				} else {
					removeDropdown(this)
					if (editorType === 'date' && editor instanceof HTMLInputElement) {
						await commitDateEditor(this,editor, shouldCommitEmptyRow)
					} else if (!isDropdownEditor) {
						// Only commit for non-dropdown editors (text, number, etc.)
						await commitCurrentEditor(this, editor, shouldCommitEmptyRow)
					}
					// For select editors without dropdown open, keep current value
				}

				// After committing empty row on last cell, focus first editable cell of new empty row
				if (shouldCommitEmptyRow) {
					// Restore current cell to display mode
					restoreCellToDisplayMode(this, rowIndex, tabColIndex)
					// Focus the new empty row's first editable cell
					const firstEditableColIndex = tabEditableCols.length > 0 ? tabEditableCols[0].index : 0
					// Use queueMicrotask to allow the grid to re-render with the new empty row
					queueMicrotask(() => {
						const newEmptyRowIndex = this.grid.newRowPosition === 'top' ? 0 : this.grid.displayItems.length - 1
						moveFocus(this, newEmptyRowIndex, firstEditableColIndex)
						this.isCommittingFromKeyboard = false
					})
				} else {
					moveFocusAfterCommit(this, rowIndex, field, e.shiftKey ? 'prev' : 'next')
				}
				break

			case 'Escape':
				e.preventDefault()
				e.stopPropagation()
				// First Escape: close dropdown/datepicker but stay in edit mode
				// Second Escape: cancel edit entirely
				if (this.dropdown.isOpen) {
					removeDropdown(this)
					// For autocomplete/combobox, clear search text and refocus input
					if (editorType === 'autocomplete' || editorType === 'combobox') {
						this.dropdown.setFilterText('')
						if (editor instanceof HTMLInputElement) {
							editor.value = ''
							editor.focus()
						}
					}
					return  // Stay in edit mode
				}
				// Close datepicker if open (first Escape)
				if (this.datepicker) {
					this.datepicker.close(true)
					this.datepicker = null
					return  // Stay in edit mode
				}
				// Second Escape (or no dropdown/datepicker): cancel edit
				this.isCommittingFromKeyboard = true
				clearEditingVisual(this)
				this.grid.cancelEdit()
				focusCellAfterCancel(this, rowIndex, field)
				break

			case 'F2':
				e.preventDefault()
				e.stopPropagation()
				if (isDropdownEditor && !this.dropdown.isOpen) {
					openDropdownForCurrentEditor(this)
				}
				break

			case 'Backspace':
				if (editorType === 'select') {
					e.preventDefault()
					e.stopPropagation()
					if (this.dropdown.filterText.length > 0) {
						this.dropdown.setFilterText(this.dropdown.filterText.slice(0, -1))
						updateSelectFilter(this, column!.editorOptions || {})
					}
				}
				break

			default:
				if (editorType === 'select' && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
					e.preventDefault()
					e.stopPropagation()
					this.dropdown.setFilterText(this.dropdown.filterText + e.key)
					updateSelectFilter(this, column!.editorOptions || {})
				}
				break
		}
	}

	// ==========================================================================
	// Event Listener Attachment
	// ==========================================================================

	/** Tracks whether a mouse button is currently pressed on the table (mousedown→mouseup) */
	private _isMouseDown = false

	private attachEventListeners(): void {
		const table = this.shadow.querySelector('.wg__table')
		if (!table) return

		// Track mouse button state so focus handler can distinguish mouse vs keyboard focus
		table.addEventListener('mousedown', () => { this._isMouseDown = true }, true)
		document.addEventListener('mouseup', () => { this._isMouseDown = false }, true)

		// Focus events
		table.addEventListener('focus', (e: Event) => {
			const target = e.target as HTMLElement
			if (target.matches('.wg__cell')) {
				const rowIndex = parseInt(target.dataset.row || '0', 10)
				const colIndex = parseInt(target.dataset.col || '0', 10)
				handleCellFocus(this, rowIndex, colIndex)
				updateFillHandle(this)
				// Only fire onrowfocus for keyboard-triggered focus (Tab, arrows).
				// For mouse interactions, defer to click handler so onrowfocus fires on mouseup, not mousedown.
				if (!this._isMouseDown && !isCellSelectionPending() && !isCellSelecting()) {
					const prevFocusedRow = this.grid.focusedRowIndex
					this.grid.setFocusedRow(rowIndex)
					this.updateRowFocusVisual(prevFocusedRow, rowIndex)
				}

				// Auto-scroll if cell is behind frozen columns
				ensureCellNotBehindFrozen(this, target, rowIndex)
			}
			// Handle focus on editor inputs in always-editing mode
			// When Tab/Enter moves focus to an editor input, we need to update the grid's focus state
			if (target.matches('.wg__editor, .wg__combobox-input, .wg__autocomplete-input, .wg__date-input, .wg__select-trigger')) {
				const cell = target.closest('.wg__cell') as HTMLElement
				if (cell) {
					const rowIndex = parseInt(cell.dataset.row || '0', 10)
					const colIndex = parseInt(cell.dataset.col || '0', 10)
					const column = this.grid.columns[colIndex]
					// Check if this cell uses 'always' editTrigger
					const effectiveTrigger = column?.editTrigger ?? this.grid.editTrigger
					if (effectiveTrigger === 'always') {
						// Update focused cell state and visual
						const oldFocus = this.grid.focusedCell
						if (!oldFocus || oldFocus.rowIndex !== rowIndex || oldFocus.colIndex !== colIndex) {
							this.grid.setFocusedCell(rowIndex, colIndex)
							// Remove focus class from old cell (don't re-render - just update class)
							if (oldFocus) {
								const oldCell = this.shadow.querySelector(
									`td[data-row="${oldFocus.rowIndex}"][data-col="${oldFocus.colIndex}"]`
								) as HTMLElement
								if (oldCell) {
									oldCell.classList.remove('wg__cell--always-edit-focused')
								}
							}
							// Add focus class to new cell (don't re-render - just update class)
							cell.classList.add('wg__cell--always-edit-focused')
							// Update row focus (only for keyboard — mouse defers to click handler)
							if (!this._isMouseDown) {
								const prevFocusedRow = this.grid.focusedRowIndex
								this.grid.setFocusedRow(rowIndex)
								this.updateRowFocusVisual(prevFocusedRow, rowIndex)
							}
						}
					}
				}
			}
			// Dropdown opening on focus - handled by pipeline (adapter dispatches openDropdown after startEdit)
			// Legacy code removed: openDropdownForCurrentEditor was called here for .wg__select-trigger, .wg__combobox-input, .wg__autocomplete-input
		}, true)

		// Keydown events
		table.addEventListener('keydown', (e: Event) => {
			const target = e.target as HTMLElement
			const ke = e as KeyboardEvent

			// Tree shortcuts (Ctrl/Cmd + ArrowLeft/Right) run BEFORE pipelineAdapter
			// because the pipeline consumes plain arrow keys for cell-focus navigation
			// (regardless of editTrigger), which would swallow the modified arrow too.
			// Direct grid-method calls — same as chevron click and dblclick paths.
			if (
				this.grid.isTreeMode &&
				this.grid.focusedCell &&
				!this.grid.editingCell &&
				(ke.ctrlKey || ke.metaKey) &&
				(ke.key === 'ArrowLeft' || ke.key === 'ArrowRight')
			) {
				const { rowIndex, colIndex } = this.grid.focusedCell
				const item = this.grid.displayItems[rowIndex]
				const info = item ? this.grid.getRowTreeInfo(item) : null
				if (info) {
					e.preventDefault()
					e.stopPropagation()
					// Compute which path's row should hold focus AFTER the toggle. For
					// same-row expand/collapse it's `info.path` (the row itself stays
					// in displayItems at some index). For ancestor-walk collapse it's
					// the ancestor (the focused row is about to be hidden).
					let targetPath: string | null = null
					if (ke.key === 'ArrowRight') {
						if (info.hasChildren && !this.grid.isPathExpanded(info.path)) {
							this.grid.toggleExpandedPath(info.path)
							targetPath = info.path
						}
					} else {
						if (info.hasChildren && this.grid.isPathExpanded(info.path)) {
							this.grid.toggleExpandedPath(info.path)
							targetPath = info.path
						} else {
							const ancestor = this.grid.findNearestExpandedAncestor(info.path)
							if (ancestor !== null) {
								this.grid.toggleExpandedPath(ancestor)
								targetPath = ancestor
							}
						}
					}
					// Restore focus after the render. toggleExpandedPath queues a
					// microtask render; ours queues after it, so displayItems is fresh
					// and the new <td> exists when moveFocus tries to focus it.
					if (targetPath !== null) {
						const path = targetPath
						queueMicrotask(() => {
							const idx = this.grid.displayItems
								.findIndex(it => this.grid.getRowTreeInfo(it)?.path === path)
							if (idx >= 0) {
								moveFocus(this, idx, colIndex)
							}
						})
					}
					return
				}
			}

			// Try action pipeline first (handles 'always' editTrigger mode)
			if (this.pipelineAdapter?.tryHandleKeyDown(e as KeyboardEvent)) {
				return
			}

			// If datepicker is open, let navigation keys bubble to datepicker's document handler
			if (this.datepicker) {
				const key = (e as KeyboardEvent).key
				const datepickerKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Enter', 'Escape', 'Tab']
				if (datepickerKeys.includes(key)) {
					return
				}
			}

			if (target.matches('.wg__editor, .wg__combobox-input, .wg__autocomplete-input, .wg__date-input')) {
				this.handleEditorKeyDown(e as KeyboardEvent, target)
				return
			}
			if (target.matches('.wg__cell')) {
				const rowIndex = parseInt(target.dataset.row || '0', 10)
				const colIndex = parseInt(target.dataset.col || '0', 10)
				this.handleCellKeyDown(e as KeyboardEvent, rowIndex, colIndex)
			}
		})

		// Initialize focus event manager on table
		this.focusEvents.init(table as HTMLElement)

		// Focus out - subscribe to focusout events
		this.focusEvents.subscribe('focusout', (_target, relatedTarget) => {
			if (!relatedTarget || !table.contains(relatedTarget)) {
				handleTableFocusOut(this, { relatedTarget } as unknown as FocusEvent)
			}
		})

		// Double-click to edit. Tree-column dblclick-to-toggle is handled in the
		// mousedown listener (via MouseEvent.detail === 2) because surgical render
		// rebuilds the cell's <td> when focus changes between clicks, which causes
		// the browser to drop the native dblclick (its two click targets differ).
		table.addEventListener('dblclick', (e: Event) => {
			const target = e.target as HTMLElement

			// Try pipeline first
			if (this.pipelineAdapter?.tryHandleDblClick(e as MouseEvent)) {
				return
			}

			e.preventDefault()
			const cell = target.closest('.wg__cell') as HTMLElement
			if (cell) {
				const rowIndex = parseInt(cell.dataset.row || '0', 10)
				const colIndex = parseInt(cell.dataset.col || '0', 10)
				const column = this.grid.columns[colIndex]
				if (column) {
					const trigger = column.editTrigger || this.grid.editTrigger
					if (trigger === 'dblclick' || trigger === 'navigate') {
						const cursorPos = getCursorPositionFromClick(e as MouseEvent, cell)
						tryStartEdit(this, rowIndex, colIndex, { cursorPosition: cursorPos ?? undefined })
						const editor = column.editor
						if (editor === 'select' || editor === 'combobox' || editor === 'autocomplete') {
							requestAnimationFrame(() => {
								if (!this.dropdown.isOpen) {
									openDropdownForCurrentEditor(this)
								}
							})
						} else if (editor === 'custom') {
							requestAnimationFrame(() => {
								this.openCustomEditor(rowIndex, colIndex)
							})
						}
					}
				}
			}
		})

		uiLogger.debug('attaching click handler on table')

		// Single click to edit (for editTrigger = 'click')
		table.addEventListener('click', (e: Event) => {
			const target = e.target as HTMLElement
			uiLogger.debug('CLICK fired | target:', target.tagName, target.className, '| connected:', target.isConnected)

			// Tree chevron toggle — handle first so we don't fall through to edit/select logic
			const chevron = target.closest('.wg__tree-chevron[data-tree-toggle]') as HTMLElement
			if (chevron) {
				e.preventDefault()
				e.stopPropagation()
				const path = chevron.getAttribute('data-tree-toggle')
				uiLogger.debug('chevron click:', path, '| target:', target.tagName, target.className)
				if (path !== null) {
					this.grid.toggleExpandedPath(path)
				}
				return
			}


			// Try pipeline first
			if (this.pipelineAdapter?.tryHandleClick(e as MouseEvent)) {
				return
			}

			const cell = target.closest('.wg__cell') as HTMLElement
			if (cell && !cell.classList.contains('wg__cell--editing')) {
				const rowIndex = parseInt(cell.dataset.row || '0', 10)
				const colIndex = parseInt(cell.dataset.col || '0', 10)
				const column = this.grid.columns[colIndex]
				if (column) {
					const trigger = column.editTrigger || this.grid.editTrigger
					if (trigger === 'click') {
						e.preventDefault()
						const cursorPos = getCursorPositionFromClick(e as MouseEvent, cell)
						tryStartEdit(this, rowIndex, colIndex, { cursorPosition: cursorPos ?? undefined })
						const editor = column.editor
						if (editor === 'select' || editor === 'combobox' || editor === 'autocomplete') {
							requestAnimationFrame(() => {
								if (!this.dropdown.isOpen) {
									openDropdownForCurrentEditor(this)
								}
							})
						} else if (editor === 'custom') {
							requestAnimationFrame(() => {
								this.openCustomEditor(rowIndex, colIndex)
							})
						}
					}
				}
			}
		})

		// Mousedown - toggle dropdown, handle cell transitions
		table.addEventListener('mousedown', (e: Event) => {
			const target = e.target as HTMLElement
			const mouseEvent = e as MouseEvent
			uiLogger.debug('MOUSEDOWN fired | target:', target.tagName, target.className, '| connected:', target.isConnected, '| detail:', mouseEvent.detail, '| button:', mouseEvent.button)

			// Tree chevron — let click handler do its work; suppress focus/selection side effects
			if (target.closest('.wg__tree-chevron[data-tree-toggle]')) {
				uiLogger.debug('chevron mousedown intercepted (suppress focus/selection)')
				e.preventDefault()
				e.stopPropagation()
				return
			}

			// Tree column second-click handling — detect via MouseEvent.detail (the
			// browser's own click counter). The native dblclick event is unreliable
			// here because the cell's innerHTML gets re-rendered between clicks, so
			// we route both "double-click toggles tree" and "double-click starts edit"
			// through this single path.
			if (mouseEvent.detail === 2 && mouseEvent.button === 0 && this.grid.isTreeMode) {
				const cellEl = target.closest('.wg__cell') as HTMLElement
				if (cellEl && !target.closest('.wg__tree-chevron')) {
					const colIdx = parseInt(cellEl.dataset.col || '-1', 10)
					const rowIdx = parseInt(cellEl.dataset.row || '-1', 10)
					const col = colIdx >= 0 ? this.grid.columns[colIdx] : null
					if (col?.isTree && rowIdx >= 0) {
						// Tree toggle takes priority over edit when enabled
						if (this.grid.treeDoubleClickBehavior === 'toggle') {
							const item = this.grid.displayItems[rowIdx]
							const info = item ? this.grid.getRowTreeInfo(item) : null
							if (info?.hasChildren) {
								uiLogger.debug('tree dblclick (mousedown.detail=2) toggle:', info.path)
								e.preventDefault()
								e.stopPropagation()
								this.grid.toggleExpandedPath(info.path)
								return
							}
						}
						// Otherwise, if the column is editable with dblclick/navigate trigger, start edit
						const trigger = col.editTrigger || this.grid.editTrigger
						if ((trigger === 'dblclick' || trigger === 'navigate') && this.grid.canEditCell(rowIdx, String(col.field))) {
							const cursorPos = getCursorPositionFromClick(mouseEvent, cellEl)
							uiLogger.debug('tree dblclick (mousedown.detail=2) start edit:', String(col.field), '| trigger:', trigger)
							e.preventDefault()
							e.stopPropagation()
							tryStartEdit(this, rowIdx, colIdx, { cursorPosition: cursorPos ?? undefined })
							return
						}
					}
				}
			}

			// Try pipeline first for 'always' mode cells (handles cell clicks and toggle clicks)
			if (this.pipelineAdapter?.tryHandleMouseDown(mouseEvent)) {
				return
			}

			// Cell range selection - handle before other interactions
			// Skip if clicking on toggles (dropdown, date) - those have their own handlers
			const cell = target.closest('.wg__cell') as HTMLElement
			const isClickingToggle = target.closest('.wg__combobox-toggle, .wg__select-toggle, .wg__date-trigger')
			if (cell && !cell.classList.contains('wg__cell--editing') && !target.closest('.wg__row-number') && !isClickingToggle) {
				const rowIndex = parseInt(cell.dataset.row || '0', 10)
				const colIndex = parseInt(cell.dataset.col || '0', 10)
				const column = this.grid.visualColumns[colIndex]?.column
				
				if (column) {
					const selectionMode = this.grid.cellSelectionMode
					const isShiftClick = mouseEvent.shiftKey
					const trigger = column.editTrigger || this.grid.editTrigger

					// Check if we should handle cell range selection
					const shouldSelectRange = 
						selectionMode !== 'disabled' && (
							(selectionMode === 'click' && !isShiftClick) ||
							(selectionMode === 'shift' && isShiftClick)
						)

					if (shouldSelectRange) {
						// Commit (or cancel) any active edit before starting cell selection
						if (this.grid.editingCell) {
							const oldEditingCell = this.grid.editingCell
							const oldColIndex = this.grid.columns.findIndex(c => String(c.field) === oldEditingCell.field)
							removeDropdown(this)
							clearEditingVisual(this)
							this.commitOrCancelEditOnTransition()
							// Re-render old cell to restore display mode
							if (oldColIndex >= 0) {
								renderCell(this, oldEditingCell.rowIndex, oldColIndex)
							}
						}
						// Clear row/column selection when starting cell selection
						if (this.grid.selectedRows.length > 0) {
							this.grid.clearSelection()
						}
						if (this.grid.selectedColumns.length > 0) {
							this.grid.clearColumnSelection()
						}
						// Start cell selection
						// Note: if editTrigger='click' + cellSelectionMode='click', selection takes priority
						// For shift mode, Shift+Click always starts selection regardless of editTrigger
						handleCellMouseDown(this, rowIndex, colIndex, mouseEvent)
						return
					} else {
						// Not starting selection - clear any existing range
						if (this.grid.selectedCellRange) {
							this.grid.clearCellSelection()
							removeRangeBorder()
						}
					}
				}
			}

			// Date trigger button - handle in mousedown since SVG clicks don't bubble well
			const dateTrigger = target.closest('.wg__date-trigger')
			if (dateTrigger) {
				e.preventDefault()
				e.stopPropagation()

				const displayContainer = target.closest('.wg__cell-date-display') as HTMLElement
				const editorContainer = target.closest('.wg__editor--date') as HTMLElement

				if (editorContainer) {
					// Already editing - just open datepicker
					const input = editorContainer.querySelector('.wg__date-input') as HTMLInputElement
					if (input) openDatePicker(this,input, editorContainer)
				} else if (displayContainer) {
					// In read mode - start editing and open datepicker
					const rowIndex = parseInt(displayContainer.dataset.row || '0', 10)
					const field = displayContainer.dataset.field || ''
					const colIndex = this.grid.columns.findIndex(c => String(c.field) === field)
					if (colIndex >= 0) {
						// Clear selections FIRST to avoid render during picker open
						this.clearAllSelections()

						this.isTransitioningCells = true
						if (this.grid.editingCell) {
							// Save old cell info BEFORE commit/cancel clears it
							const oldEditingCell = this.grid.editingCell
							const oldColIndex = this.grid.columns.findIndex(c => String(c.field) === oldEditingCell.field)

							removeDropdown(this)
							clearEditingVisual(this)
							this.commitOrCancelEditOnTransition()

							// Move focus to the new cell BEFORE re-rendering so the old cell
							// renders without the focused class
							this.grid.setFocusedCell(rowIndex, colIndex)

							// Re-render old cell to remove editor HTML
							if (oldColIndex >= 0) {
								renderCell(this, oldEditingCell.rowIndex, oldColIndex)
							}
						}
						tryStartEdit(this, rowIndex, colIndex)
						requestAnimationFrame(() => {
							this.isTransitioningCells = false
							// Find the newly rendered date input and open picker
							const cell = this.shadowRoot?.querySelector(
								`.wg__cell[data-row="${rowIndex}"][data-field="${field}"]`
							)
							const input = cell?.querySelector('.wg__date-input') as HTMLInputElement
							const anchor = cell?.querySelector('.wg__editor--date') as HTMLElement
							if (input && anchor) openDatePicker(this,input, anchor)
						})
					}
				}
				return
			}

			// Handle click on any cell when dropdown is open
			if (this.dropdown.isOpen || this.grid.editingCell) {
				const cell = target.closest('.wg__cell') as HTMLElement
				if (cell && !target.closest('.wg__editor--select, .wg__editor--combobox, .wg__editor--autocomplete, .wg__editor--date')) {
					const rowIndex = parseInt(cell.dataset.row || '0', 10)
					const colIndex = parseInt(cell.dataset.col || '0', 10)
					const editingCell = this.grid.editingCell
					const isClickingToggle = target.matches('.wg__combobox-toggle, .wg__select-toggle, .wg__date-trigger')
					if (editingCell && !isClickingToggle) {
						const editingColIndex = this.grid.columns.findIndex(c => String(c.field) === editingCell.field)
						if (rowIndex !== editingCell.rowIndex || colIndex !== editingColIndex) {
							e.preventDefault()
							this.isTransitioningCells = true
							// Save old editing cell info
							const oldRowIndex = editingCell.rowIndex
							const oldColIndex = editingColIndex
							removeDropdown(this)
							clearEditingVisual(this)
							this.commitOrCancelEditOnTransition()
							// Move focus to the new cell BEFORE re-rendering so the old cell
							// renders without the focused class
							this.grid.setFocusedCell(rowIndex, colIndex)
							// Re-render old cell AFTER commit/cancel so it renders in display mode
							if (oldColIndex >= 0) {
								renderCell(this, oldRowIndex, oldColIndex)
							}
							const newColumn = this.grid.columns[colIndex]
							const trigger = newColumn?.editTrigger || this.grid.editTrigger
							// Capture click position for cursor placement
							const mouseEvent = e as MouseEvent
							const clickX = mouseEvent.clientX
							requestAnimationFrame(() => {
								this.isTransitioningCells = false
								if (trigger === 'click' && newColumn && this.grid.isCellEditable(newColumn, this.grid.displayItems[rowIndex])) {
									// For click trigger, immediately start editing the new cell
									// Find the new cell and calculate cursor position
									const newCell = this.shadow.querySelector(
										`td[data-row="${rowIndex}"][data-col="${colIndex}"]`
									) as HTMLElement
									const cursorPos = newCell ? getCursorPositionFromClick({ clientX: clickX } as MouseEvent, newCell) : undefined
									tryStartEdit(this, rowIndex, colIndex, { cursorPosition: cursorPos ?? undefined })
								} else {
									moveFocus(this, rowIndex, colIndex)
								}
							})
							return
						}
					}
				}
			}

			// Toggle click - handled by pipelineAdapter.tryHandleMouseDown() above
			// (dispatches focusCell → startEdit → openDropdown via pipeline)

			// Display mode dropdown click
			if (target.matches('.wg__cell-dropdown-display')) {
				e.preventDefault()
				e.stopPropagation()
				const displayContainer = target.closest('.wg__cell-dropdown-display') as HTMLElement
				if (displayContainer) {
					const rowIndex = parseInt(displayContainer.dataset.row || '0', 10)
					const field = displayContainer.dataset.field || ''
					const colIndex = this.grid.columns.findIndex(c => String(c.field) === field)
					if (colIndex >= 0) {
						this.isTransitioningCells = true
						// Save old editing cell info before clearing
						const oldEditingCell = this.grid.editingCell
						const oldColIndex = oldEditingCell
							? this.grid.columns.findIndex(c => String(c.field) === oldEditingCell.field)
							: -1
						if (oldEditingCell) {
							removeDropdown(this)
							clearEditingVisual(this)
							this.commitOrCancelEditOnTransition()
							// Move focus to the new cell BEFORE re-rendering so the old cell
							// renders without the focused class
							this.grid.setFocusedCell(rowIndex, colIndex)
							// Re-render old cell AFTER commit/cancel so it renders in display mode
							if (oldColIndex >= 0) {
								renderCell(this, oldEditingCell.rowIndex, oldColIndex)
							}
						}
						tryStartEdit(this, rowIndex, colIndex)
						requestAnimationFrame(() => {
							this.isTransitioningCells = false
							if (!this.dropdown.isOpen) {
								openDropdownForCurrentEditor(this)
							}
						})
					}
				}
			}
		})

		// Click events - legacy select trigger toggle
		// In 'always' mode, the pipeline handles dropdown open via shouldShowDropdownOnFocus
		// so this legacy handler must not fire (it would toggle-close the already-opened dropdown)
		table.addEventListener('click', (e: Event) => {
			const target = e.target as HTMLElement

			if (target.matches('.wg__select-trigger, .wg__select-value')) {
				// Skip if pipeline handles this cell (always mode)
				const cell = target.closest('.wg__cell') as HTMLElement
				if (cell) {
					const colIndex = parseInt(cell.dataset.col || '', 10)
					const column = this.grid.columns[colIndex]
					const trigger = column?.editTrigger ?? this.grid.editTrigger
					if (trigger === 'always') return
				}
				e.preventDefault()
				e.stopPropagation()
				toggleDropdown(this)
			}
		})

		// Column resize handle mousedown
		table.addEventListener('mousedown', (e: Event) => {
			const target = e.target as HTMLElement

			// Resize handle takes priority
			const resizeHandle = target.closest('.wg__resize-handle') as HTMLElement
			if (resizeHandle) {
				e.preventDefault()
				e.stopPropagation()
				// Clear selections when starting resize
				this.clearAllSelections()
				const field = resizeHandle.dataset.field
				if (field) {
					handleResizeStart(this, e as MouseEvent, field)
				}
				return
			}

			// Column reorder: start drag when clicking on a non-frozen header (if enabled)
			// Skip reorder if Ctrl/Shift held - let click handler do column selection instead
			if (this.grid.isColumnReorderAllowed) {
				const mouseEvent = e as MouseEvent
				if (!mouseEvent.ctrlKey && !mouseEvent.metaKey && !mouseEvent.shiftKey) {
					const header = target.closest('.wg__header') as HTMLElement
					if (header && !header.classList.contains('wg__header--frozen') && !header.classList.contains('wg__row-number-header')) {
						// Clear selections when starting reorder
						this.clearAllSelections()
						const field = header.dataset.field
						if (field) {
							handleReorderStart(this, e as MouseEvent, field)
						}
					}
				}
			}

			// Column selection drag: when reorder is disabled, OR when Shift is held (even with reorder enabled)
			// Only on left-click (button 0), not right-click (button 2) which opens context menu
			if ((!this.grid.isColumnReorderAllowed || (e as MouseEvent).shiftKey) && (e as MouseEvent).button === 0) {
				const header = target.closest('.wg__header:not(.wg__row-number-header):not(.wg__inline-actions-header):not(.wg__actions-column):not(.wg__filler)') as HTMLElement
				if (header && !target.closest('.wg__resize-handle') && !target.closest('.wg__sort-indicator')) {
					const field = header.dataset.field
					if (field) {
						const colIndex = this.grid.visualColumns.findIndex(vc => String(vc.column.field) === field)
						if (colIndex >= 0) {
							handleHeaderMouseDown(this, colIndex, e as MouseEvent)
						}
					}
				}
			}

			// Row selection: handle mousedown on row number cells
			// Only on left-click (button 0), not right-click (button 2)
			const rowNumberCell = target.closest('.wg__row-number[data-row-number]') as HTMLElement
			if (rowNumberCell && (e as MouseEvent).button === 0) {
				const rowIndex = parseInt(rowNumberCell.dataset.rowNumber || '-1', 10)
				if (rowIndex >= 0) {
					handleRowNumberMouseDown(this, rowIndex, e as MouseEvent)
				}
			}

			// Select all: handle click on row number header (#)
			// Only on left-click (button 0), not right-click (button 2)
			const rowNumberHeader = target.closest('.wg__row-number-header') as HTMLElement
			if (rowNumberHeader && (e as MouseEvent).button === 0) {
				e.preventDefault()
				this.grid.selectAll()
				// Update the range border visual
				if (this.grid.selectedCellRange) {
					createRangeBorder(this)
				}
				this.render()
				// Focus container so Ctrl+C works
				requestAnimationFrame(() => {
					const container = this.shadow.querySelector('.wg') as HTMLElement
					container?.focus({ preventScroll: true })
				})
			}

			// Set row focus when clicking on data cells (not row numbers or headers)
			// Skip during cell range selection to avoid spurious onrowfocus events
			const clickedCell = target.closest('.wg__cell:not(.wg__row-number):not(.wg__inline-actions-cell)') as HTMLElement
			if (clickedCell && !target.closest('.wg__header') && !isCellSelectionPending() && !isCellSelecting()) {
				const cellRowIndex = parseInt(clickedCell.dataset.row || '-1', 10)
				if (cellRowIndex >= 0) {
					const prevFocusedRow = this.grid.focusedRowIndex
					this.grid.setFocusedRow(cellRowIndex)
					this.updateRowFocusVisual(prevFocusedRow, cellRowIndex)
				}
			}

			// Clear row/column selection when clicking on cells (not row numbers or headers)
			// But NOT if cell selection is pending (would interfere with shift+drag)
			if (target.closest('.wg__cell') && !target.closest('.wg__row-number, .wg__header') && !isCellSelectionPending()) {
				let needsRender = false
				if (this.grid.selectedRows.length > 0) {
					this.grid.clearSelection()
					needsRender = true
				}
				if (this.grid.selectedColumns.length > 0) {
					this.grid.clearColumnSelection()
					needsRender = true
				}
				if (needsRender) {
					this.render()
				}
			}

			// Clear all selections if clicking outside interactive elements (empty areas)
			if (!target.closest('.wg__cell, .wg__row-number, .wg__header, .wg__toolbar, button, input, select, textarea')) {
				let needsRender = false
				if (this.grid.selectedCellRange) {
					this.grid.clearCellSelection()
					removeRangeBorder()
					needsRender = true
				}
				if (this.grid.selectedRows.length > 0) {
					this.grid.clearSelection()
					needsRender = true
				}
				if (this.grid.selectedColumns.length > 0) {
					this.grid.clearColumnSelection()
					needsRender = true
				}
				if (needsRender) {
					this.render()
				}
			}
		})

		// Header click for column selection (sort indicator handled by clickEvents)
		// Only active when column reorder is enabled (otherwise, mousedown handler does selection)
		table.addEventListener('click', (e: Event) => {
			const mouseEvent = e as MouseEvent
			const target = mouseEvent.target as HTMLElement

			// Skip if clicking on resize handle or sort indicator
			if (target.closest('.wg__resize-handle')) return
			if (target.closest('.wg__sort-indicator')) return
			// Skip if reordering was just performed (prevents accidental selection on drop)
			if (isReordering()) return
			// Skip if column reorder is disabled (mousedown handler handles column selection)
			if (!this.grid.isColumnReorderAllowed) return

			// Click on header = column selection
			const header = target.closest('.wg__header:not(.wg__row-number-header):not(.wg__inline-actions-header):not(.wg__actions-column):not(.wg__filler)') as HTMLElement
			if (header) {
				e.preventDefault()
				const field = header.dataset.field
				if (!field) return

				// Find visual column index
				const colIndex = this.grid.visualColumns.findIndex(vc => String(vc.column.field) === field)
				if (colIndex === -1) return

				// Remove any existing cell range border (column selection doesn't use border)
				removeRangeBorder()

				// Ctrl = toggle individual column, Shift = range, plain = replace
				if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
					this.grid.selectColumn(colIndex, 'toggle')
				} else if (mouseEvent.shiftKey) {
					this.grid.selectColumn(colIndex, 'range')
				} else {
					this.grid.selectColumn(colIndex, 'replace')
				}

				this.render()

				// Focus container for keyboard shortcuts
				requestAnimationFrame(() => {
					const container = this.shadow.querySelector('.wg') as HTMLElement
					container?.focus({ preventScroll: true })
				})
			}
		})

		// Context menu (right-click)
		table.addEventListener('contextmenu', (e: Event) => {
			handleContextMenu(this, e as MouseEvent)
		})

		// Change events (checkbox)
		table.addEventListener('change', (e: Event) => {
			const target = e.target as HTMLElement
			if (target.matches('.wg__editor--checkbox')) {
				handleCheckboxChange(this, target as HTMLInputElement)
			}
		})

		// Input events (combobox/autocomplete)
		table.addEventListener('input', (e: Event) => {
			const target = e.target as HTMLElement
			if (target.matches('.wg__combobox-input')) {
				handleComboboxInput(this, e)
			} else if (target.matches('.wg__autocomplete-input')) {
				handleAutocompleteInput(this, e)
			}
		})

		// Blur events - subscribe to blur events (capture phase handled internally)
		// Only subscribe once (attachEventListeners is called on every render)
		if (!this.focusEventsSubscribed) {
			this.focusEvents.subscribe('blur', (target, relatedTarget) => {
				// Use unified guard check
				if (this.focusEvents.shouldSkipBlur()) return

				// If focus is leaving the grid entirely, let outsideClick handle ALL cleanup
				// This prevents blur and outsideClick from racing/conflicting
				const isLeavingGrid = !relatedTarget || !this.shadow.contains(relatedTarget)
				if (isLeavingGrid) return

				// Handle INTERNAL focus changes only (moving between cells/editors within grid)

				// Text/number editors
				if (target.matches('.wg__editor--text, .wg__editor--number')) {
					handleEditorBlur(this, target as HTMLInputElement)
				}
				// Date input blur - commit if datepicker is not open
				else if (target.matches('.wg__date-input')) {
					if (!this.datepicker) {
						commitDateEditor(this,target as HTMLInputElement)
					}
				}
				// Select trigger
				else if (target.matches('.wg__select-trigger')) {
					handleSelectBlur(this, relatedTarget)
				}
				// Combobox/autocomplete
				else if (target.matches('.wg__combobox-input, .wg__autocomplete-input')) {
					handleComboboxBlur(this, target as HTMLInputElement)
				}
			})
			this.focusEventsSubscribed = true
		}

		// Scroll events - close dropdown + virtual scroll + infinite scroll + connector update
		const container = this.shadow.querySelector('.wg') as HTMLElement
		// When isTableBorderOnly is enabled, scroll container is .wg__table-container
		const scrollContainer = this.grid.isTableBorderOnly
			? (this.shadow.querySelector('.wg__table-container') as HTMLElement) || container
			: container
		if (container) {
			// Make container focusable for keyboard events when rows are selected
			container.setAttribute('tabindex', '-1')

			// Range shortcuts - handle keyboard shortcuts for selected rows, columns, or cell ranges
			container.addEventListener('keydown', (e: KeyboardEvent) => {
				const selectedRowIndices = this.grid.selectedRows
				const selectedColIndices = this.grid.selectedColumns
				const hasCellRange = !!this.grid.selectedCellRange
				if (selectedRowIndices.length === 0 && selectedColIndices.length === 0 && !hasCellRange) return

				// Skip if focus is in an input
				const target = e.target as HTMLElement
				if (target.matches('input, textarea, select, [contenteditable="true"]')) {
					return
				}

				// Handle Escape to clear selection (cell range > column > row priority)
				if (e.key === 'Escape') {
					e.preventDefault()
					if (this.grid.selectedCellRange) {
						this.grid.clearCellSelection()
						removeRangeBorder()
					} else if (selectedColIndices.length > 0) {
						this.grid.clearColumnSelection()
					} else {
						this.grid.clearSelection()
					}
					return
				}

				// Handle Ctrl+C to copy selection (built-in, works without rangeShortcuts)
				if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
					e.preventDefault()
					if (hasCellRange) {
						this.grid.copyCellSelectionToClipboard()
					} else if (selectedColIndices.length > 0) {
						this.grid.copySelectedColumnsToClipboard()
					} else if (selectedRowIndices.length > 0) {
						this.grid.copySelectedRowsToClipboard()
					}
					return
				}

				// Check range shortcuts (works for both row and cell selection)
				const rangeShortcuts = this.grid.rangeShortcuts
				if (!rangeShortcuts?.length) return

				for (const shortcut of rangeShortcuts) {
					const combo = parseKeyCombo(shortcut.key)
					if (matchesKeyCombo(e, combo)) {
						// Build context based on selection type
						const ctx: RangeShortcutContext<T> = hasCellRange ? {
							// Cell range mode
							rows: [],
							rowIndices: [],
							cellRange: this.grid.selectedCellRange!,
							cells: this.grid.getSelectedCells()
						} : {
							// Row selection mode
							rows: this.grid.getSelectedRowsData(),
							rowIndices: selectedRowIndices
						}

						const isDisabled = typeof shortcut.disabled === 'function'
							? shortcut.disabled(ctx)
							: shortcut.disabled === true

						if (!isDisabled) {
							e.preventDefault()
							shortcut.action(ctx)
							return
						}
					}
				}
			})

			// Initialize scroll event manager and subscribe to scroll events
			this.scrollEvents.init(scrollContainer)

			// Container scroll handler
			this.scrollEvents.subscribe('container', () => {
				// Toggle horizontal scroll indicator for frozen column shadow
				const isScrolledHorizontally = scrollContainer.scrollLeft > 0
				container.classList.toggle('wg--scrolled-horizontal', isScrolledHorizontally)

				// Close dropdown on scroll
				if (this.dropdown.isOpen && !this.isTransitioningCells && !this.dropdown.isOpening) {
					handleScrollCloseDropdown(this)
				}

				// Virtual scroll: recalculate visible range
				if (this.grid.shouldUseVirtualScroll()) {
					handleVirtualScroll(this, scrollContainer)
				}

				// Infinite scroll: detect when near bottom
				if (this.grid.isInfiniteScrollEnabled && this.grid.hasMoreItems && !this.virtualScroll.isLoadingMore) {
					handleInfiniteScroll(this, scrollContainer)
				}

				// Update connector position when scrolling (clips at container boundary)
				if (getActiveToolbarRowIndex() !== null) {
					updateConnector(this, this.grid.displayItems)
					this.renderConnector()
				}

				// Update fill handle position on scroll
				updateFillHandle(this)

				// Update cell range border on scroll
				if (this.grid.selectedCellRange) {
					updateRangeBorder(this)
				}

				// Update row/column selection borders on scroll
				updateSelectionBorders(this)
			})

			// Window scroll handler - close overlays
			this.scrollEvents.subscribe('window', () => {
				if (this.dropdown.isOpen && !this.isTransitioningCells) {
					handleScrollCloseDropdown(this)
				}
				if (getActiveToolbarRowIndex() !== null) {
					closeToolbarAndReset(this)
				}
			})

			// Initialize click event manager for outside-click detection
			// Only subscribe once (attachEventListeners is called on every render)
			if (!this.clickEventsSubscribed) {
				// Treat clicks inside our document.body-hosted popovers as
				// inside the grid — otherwise outsideClick fires while the user
				// is interacting with the picker/menu and tears down editing.
				const isPathInOwnedScope = (path: EventTarget[]): boolean => {
					const dpEl = this.datepicker?.getElement() ?? null
					for (const node of path) {
						if (dpEl && dpEl === node) return true
						if (this.contextMenuElement && this.contextMenuElement === node) return true
						if (this.headerContextMenuElement && this.headerContextMenuElement === node) return true
					}
					return false
				}
				this.clickEvents.init(container, this, isPathInOwnedScope)

				// Clear selections, focus, and close editors when clicking outside the grid
				this.clickEvents.subscribe('outsideClick', () => {
					let needsRender = false

					// Clear focused cell state FIRST (before renderCell rebuilds it with focused class)
					if (this.grid.focusedCell) {
						const { rowIndex, colIndex } = this.grid.focusedCell
						const cell = this.shadow.querySelector(
							`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
						)
						cell?.classList.remove('wg__cell--focused', 'wg__cell--always-edit-focused')
						this.grid.clearFocusedCell()
					}

					// Clear row focus
					if (this.grid.focusedRowIndex !== null) {
						this.grid.clearRowFocus()
						needsRender = true
					}

					// Close dropdown and cancel edit if editing
					if (this.dropdown.isOpen || this.grid.editingCell) {
						const oldEditingCell = this.grid.editingCell
						const oldColIndex = oldEditingCell
							? this.grid.columns.findIndex(c => String(c.field) === oldEditingCell.field)
							: -1

						removeDropdown(this)
						clearEditingVisual(this)
						this.grid.cancelEdit()

						// Re-render old cell to restore display mode (now without focused class)
						if (oldEditingCell && oldColIndex >= 0) {
							renderCell(this, oldEditingCell.rowIndex, oldColIndex)
						}
					}

					if (this.grid.selectedCellRange) {
						this.grid.clearCellSelection()
						removeRangeBorder()
						needsRender = true
					}
					if (this.grid.selectedRows.length > 0) {
						this.grid.clearSelection()
						needsRender = true
					}
					if (this.grid.selectedColumns.length > 0) {
						this.grid.clearColumnSelection()
						needsRender = true
					}
					if (needsRender) {
						this.render()
					}
				})

				// Handle sort indicator clicks
				this.clickEvents.subscribe('sortClick', (ctx) => {
					// Skip if reordering was just performed (prevents sort on drop)
					if (isReordering()) return
					// Clear all selections when sorting
					if (this.grid.selectedCellRange) {
						this.grid.clearCellSelection()
						removeRangeBorder()
					}
					if (this.grid.selectedRows.length > 0) {
						this.grid.clearSelection()
						removeRowSelectionBorders()
					}
					if (this.grid.selectedColumns.length > 0) {
						this.grid.clearColumnSelection()
						removeColumnSelectionBorders()
					}
					// Pass field directly - ctx.event.target is retargeted when crossing shadow DOM
					handleSortClick(this, ctx.event, ctx.field)
					this.render()
				})

				this.clickEventsSubscribed = true
			}
		}

		// Tooltip events
		table.addEventListener('mouseenter', (e: Event) => {
			const target = e.target as HTMLElement
			// Check for HTML tooltip first, then plain text
			const htmlTooltipElement = target.closest('[data-tooltip-html]') as HTMLElement
			if (htmlTooltipElement) {
				const tooltipHtml = htmlTooltipElement.getAttribute('data-tooltip-html')!
				showTooltip(this, htmlTooltipElement, tooltipHtml, this._tooltipShowDelay, true)
				return
			}
			const tooltipElement = target.closest('[data-tooltip]') as HTMLElement
			if (tooltipElement) {
				const tooltipText = tooltipElement.getAttribute('data-tooltip')!
				showTooltip(this, tooltipElement, tooltipText, this._tooltipShowDelay, false)
			}
		}, true)

		table.addEventListener('mouseleave', (e: Event) => {
			const mouseEvent = e as MouseEvent
			const target = mouseEvent.target as HTMLElement
			const relatedTarget = mouseEvent.relatedTarget as HTMLElement | null
			const tooltipEl = target.closest('[data-tooltip], [data-tooltip-html]') as HTMLElement

			if (tooltipEl && relatedTarget?.closest('[data-tooltip], [data-tooltip-html]') === tooltipEl) {
				return
			}

			if (tooltipEl) {
				hideTooltip(this, this._tooltipHideDelay)
			}
		}, true)

		// =========================================================================
		// Row Toolbar Events
		// =========================================================================

		// Toolbar trigger button click (button mode)
		table.addEventListener('click', (e: Event) => {
			const target = e.target as HTMLElement
			const triggerBtn = target.closest('.wg__toolbar-trigger') as HTMLElement
			if (triggerBtn && this.grid.toolbarTrigger === 'button') {
				e.preventDefault()
				e.stopPropagation()
				const rowIndex = parseInt(triggerBtn.dataset.toolbarTrigger || '0', 10)
				const rowElement = table.querySelector(`tr[data-row-index="${rowIndex}"]`) as HTMLElement
				if (rowElement) {
					// Toggle toolbar for this row
					if (isToolbarOpenForRow(rowIndex)) {
						closeToolbarAndReset(this)
						// No render() needed - closeToolbar() surgically removes toolbar
					} else {
						showToolbarForRow(this, rowElement, rowIndex)
					}
				}
			}
		})

		// Inline action button click (inline mode - toolbarPosition="inline")
		table.addEventListener('click', (e: Event) => {
			if (this.grid.toolbarPosition !== 'inline') return

			const target = e.target as HTMLElement
			const btn = target.closest('.wg__inline-action-btn') as HTMLButtonElement
			if (btn && !btn.disabled) {
				e.preventDefault()
				e.stopPropagation()
				const actionId = btn.dataset.actionId
				const rowIndex = parseInt(btn.dataset.row || '0', 10)
				handleInlineActionClick(this, actionId, rowIndex, e as MouseEvent, btn)
			}
		})

		// Row hover - track hovered row and handle toolbar/inline shortcuts
		table.addEventListener('mouseenter', (e: Event) => {
			const mouseEvent = e as MouseEvent
			const target = mouseEvent.target as HTMLElement
			const row = target.closest('.wg__row') as HTMLElement
			if (row) {
				const rowIndex = parseInt(row.dataset.rowIndex || '0', 10)
				this.grid.setHoveredRow(rowIndex)

				// For inline mode, setup shortcuts
				if (this.grid.toolbarPosition === 'inline') {
					setupInlineShortcuts(this)
				}

				// For floating toolbar (hover trigger)
				if (this.grid.toolbarTrigger === 'hover' && this.grid.toolbarPosition !== 'inline') {
					// Cancel any pending hide timeout when entering a row
					this.toolbar.clearHideTimeout()
					if (!isToolbarOpenForRow(rowIndex)) {
						showToolbarForRow(this, row, rowIndex, mouseEvent.clientX)
					}
				}
			}
		}, true)

		// Row mouseleave - handle toolbar hide and inline shortcuts cleanup
		table.addEventListener('mouseleave', (e: Event) => {
			const mouseEvent = e as MouseEvent
			const target = mouseEvent.target as HTMLElement
			const row = target.closest('.wg__row') as HTMLElement

			if (row) {
				// For inline mode, clear hovered row and shortcuts after short delay
				if (this.grid.toolbarPosition === 'inline') {
					setTimeout(() => {
						if (!table.matches(':hover')) {
							this.grid.setHoveredRow(null)
							removeInlineShortcuts(this)
						}
					}, 50)
				}

				// For floating toolbar (hover trigger)
				if (this.grid.toolbarTrigger === 'hover' && this.grid.toolbarPosition !== 'inline') {
					// Don't close during move actions (connector tracking)
					if (this.toolbar.isMoveInProgress) return

					// Start hide timeout (shared with toolbar mouseleave)
					this.toolbar.clearHideTimeout()
					this.toolbar.setHideTimeout(setTimeout(() => {
						const toolbarContainer = this.shadow.querySelector('.wg__toolbar-container')
						const isHoveringToolbar = toolbarContainer?.matches(':hover')
						const isHoveringTable = table.matches(':hover')

						if (!isHoveringToolbar && !isHoveringTable) {
							this.grid.setHoveredRow(null)
							closeToolbarAndReset(this)
							// No render() needed - closeToolbar() already removes toolbar from DOM
						}
					}, 150))
				}
			}
		}, true)

		// Row mousemove - handle mouse-following toolbar and cell-aware toolbar
		table.addEventListener('mousemove', (e: Event) => {
			const mouseEvent = e as MouseEvent
			const target = mouseEvent.target as HTMLElement
			const row = target.closest('.wg__row') as HTMLElement

			if (!row) return

			const rowIndex = parseInt(row.dataset.rowIndex || '0', 10)
			const toolbarRowIndex = getActiveToolbarRowIndex()

			// Only process if toolbar is open for this row and in 'top' position
			if (toolbarRowIndex !== rowIndex || this.grid.toolbarPosition !== 'top') return

			// Handle mouse-following toolbar (skip if cellToolbar is active - it handles its own positioning,
			// and skip if toolbarColumn is set - column pinning takes priority over cursor following)
			if (this.grid.shouldToolbarFollowCursor && !this.grid.cellToolbar && this.grid.toolbarColumn === undefined) {
				const cell = target.closest('.wg__cell:not(.wg__row-number):not(.wg__inline-actions-cell)') as HTMLElement
				if (cell) {
					const cellRect = cell.getBoundingClientRect()
					const targetX = resolveToolbarOffset(cellRect, this.grid.cellToolbarOffset)
					updateToolbarPosition(targetX, row, 'start')
				} else {
					updateToolbarPosition(mouseEvent.clientX, row)
				}
			}

			// Handle cell-aware toolbar
			if (this.grid.cellToolbar) {
				const cell = target.closest('.wg__cell:not(.wg__row-number):not(.wg__inline-actions-cell)') as HTMLElement
				if (cell) {
					const field = cell.dataset.field || ''
					// Find colIndex from visualColumns since cells don't have data-col-index
					const colIndex = this.grid.visualColumns.findIndex(vc => String(vc.column.field) === field)

					// Check if cell changed (compare by field since that's what we have)
					const currentHovered = this.toolbar.hoveredCell
					const cellChanged = !currentHovered ||
						currentHovered.rowIndex !== rowIndex ||
						currentHovered.field !== field

					if (cellChanged) {
						this.toolbar.setHoveredCell({ rowIndex, colIndex, field })

						// Get cell-specific toolbar items
						const dataRow = this.grid.displayItems[rowIndex]
						if (dataRow) {
							const cellItems = this.grid.cellToolbar(dataRow, rowIndex, field, colIndex)
							// Use cell items if provided, otherwise use default rowToolbar
							const itemsToUse = cellItems || this.grid.rowToolbar
							const newItemsJson = JSON.stringify(itemsToUse)

							// Check if items changed
							if (newItemsJson !== this.toolbar.currentCellItemsJson) {
								this.toolbar.setCurrentCellItemsJson(newItemsJson)
								// Re-render toolbar with new items
								updateToolbarWithCellItems(this, rowIndex, itemsToUse)
							}

							// Position toolbar at configured offset from cell left edge
							const cellRect = cell.getBoundingClientRect()
							const targetX = resolveToolbarOffset(cellRect, this.grid.cellToolbarOffset)
							updateToolbarPosition(targetX, row, 'start')
						}
					}
				}
			}
		})

		// Row click (click mode)
		table.addEventListener('click', (e: Event) => {
			if (this.grid.toolbarTrigger !== 'click') return

			const mouseEvent = e as MouseEvent
			const target = mouseEvent.target as HTMLElement
			const row = target.closest('.wg__row') as HTMLElement
			if (row && !target.closest('.wg__cell--editing')) {
				const rowIndex = parseInt(row.dataset.rowIndex || '0', 10)
				// Toggle toolbar
				if (isToolbarOpenForRow(rowIndex)) {
					closeToolbarAndReset(this)
					// No render() needed - closeToolbar() surgically removes toolbar
				} else {
					showToolbarForRow(this, row, rowIndex, mouseEvent.clientX)
				}
			}
		})

		// Close toolbar on outside click
		if (!this.toolbarOutsideClickAdded) {
			this.toolbarOutsideClickAdded = true
			document.addEventListener('click', (e: MouseEvent) => {
				// Only handle if this grid owns the active toolbar
				if (!isToolbarOwnedBy(this.shadow)) {
					return
				}

				const composedPath = e.composedPath()
				const isInToolbar = composedPath.some(el => (el as HTMLElement).classList?.contains('wg__toolbar-container'))
				const isInTrigger = composedPath.some(el => (el as HTMLElement).classList?.contains('wg__toolbar-trigger'))

				if (isInToolbar || isInTrigger) {
					return
				}
				// Don't close if clicking inside grid (hover/click mode handles that)
				const isInGrid = composedPath.includes(this)
				if (isInGrid && (this.grid.toolbarTrigger === 'hover' || this.grid.toolbarTrigger === 'click')) {
					return
				}
				// Close toolbar if clicking outside
				if (getActiveToolbarRowIndex() !== null) {
					closeToolbarAndReset(this)
					// No render() needed - closeToolbar() surgically removes toolbar
				}
			})
		}

		// =========================================================================
		// Pagination Events (delegated on the .wg container so the listeners
		// survive surgical renders — when isPageable toggles or pagination is
		// re-rendered, the .wg__pagination element is replaced via innerHTML and
		// loses any listeners attached directly to it.)
		// =========================================================================
		const wgContainer = this.shadow.querySelector('.wg') as HTMLElement | null
		if (wgContainer) {
			wgContainer.addEventListener('click', (e: Event) => {
				const target = e.target as HTMLElement
				if (target.closest('.wg__pagination-btn')) {
					if (handlePaginationClick(this, e)) {
						this.render()
					}
				}
			})
			wgContainer.addEventListener('change', (e: Event) => {
				const target = e.target as HTMLElement
				if (target.matches('.wg__pagination-select')) {
					if (handlePageSizeChange(this, target as HTMLSelectElement)) {
						this.render()
					}
				}
			})
		}
	}

	// ==========================================================================
	// Virtual Scroll & Infinite Scroll
	// ==========================================================================

	/**
	 * Scroll to a row position programmatically (keyboard navigation).
	 * Pre-renders the target row range ONCE, then scrolls. Flag prevents
	 * the scroll event from redundantly calling handleVirtualScroll.
	 */
	private scrollToRowProgrammatically(targetRow: number): void {
		const container = this.shadow.querySelector('.wg') as HTMLElement
		if (!container) return

		const { scrollTop, startIndex, endIndex } = calculateScrollToRow({
			targetRow,
			rowHeight: this.grid.virtualScrollRowHeight,
			buffer: this.grid.virtualScrollBuffer,
			totalItems: this.grid.displayItems.length,
			viewportHeight: container.clientHeight,
			scrollHeight: container.scrollHeight,
			clientHeight: container.clientHeight
		})

		// Update range and render ONCE (before scroll)
		if (this.virtualScroll.setRange(startIndex, endIndex)) {
			renderVirtualRows(this, container)
		}

		// Now scroll - flag prevents handleVirtualScroll from re-rendering
		this.virtualScroll.beginProgrammaticScroll()
		container.scrollTop = scrollTop
		queueMicrotask(() => { this.virtualScroll.endProgrammaticScroll() })
	}

	// ==========================================================================
	// Rendering
	// ==========================================================================

	/**
	 * Render the shortcuts help icon and overlay
	 */
	private renderShortcutsHelpIcon(): string {
		if (!this.grid.isShortcutsHelpVisible || !this.grid.rowShortcuts?.length) {
			return ''
		}

		const position = this.grid.shortcutsHelpPosition
		const positionClass = position === 'top-left' ? 'wg__shortcuts-help--left' : ''

		// Build shortcuts list HTML
		const shortcutsHtml = this.grid.rowShortcuts.map(shortcut => {
			const formattedKey = formatKeyCombo(shortcut.key)
			return `<div class="wg__shortcuts-help-item">
				<span class="wg__shortcuts-help-key">${formattedKey}</span>
				<span class="wg__shortcuts-help-label">${shortcut.label}</span>
			</div>`
		}).join('')

		// Get custom content if callback is provided
		const customContent = this.grid.shortcutsHelpContentCallback?.() || ''

		return `
			<div class="wg__shortcuts-help ${positionClass}">
				<button class="wg__shortcuts-help-icon" type="button" title="${this.grid.labels.keyboardShortcuts}">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"></circle>
						<path d="M12 16v-4"></path>
						<path d="M12 8h.01"></path>
					</svg>
				</button>
				<div class="wg__shortcuts-help-overlay">
					${customContent ? `<div class="wg__shortcuts-help-custom">${customContent}</div>` : ''}
					<div class="wg__shortcuts-help-title">${this.grid.labels.keyboardShortcuts}</div>
					<div class="wg__shortcuts-help-list">
						${shortcutsHtml}
					</div>
				</div>
			</div>
		`
	}

	render(): void {
		// Drop any stale data-pipeline cache. Normally requestUpdate() has already
		// done this, but render() is also called directly in a few places.
		this.grid.invalidateDisplayCache()
		gridPerf.reset()
		const __renderStartT = performance.now()
		uiLogger.debug('render:', this.grid.displayItems.length, 'rows,', this.grid.visualColumns.length, 'columns')
		// Preserve scroll position before re-render
		// When isTableBorderOnly is enabled, scroll container is .wg__table-container
		const oldContainer = this.shadow.querySelector('.wg') as HTMLElement
		const oldScrollContainer = this.grid.isTableBorderOnly
			? (this.shadow.querySelector('.wg__table-container') as HTMLElement) || oldContainer
			: oldContainer
		const scrollTop = oldScrollContainer?.scrollTop || 0
		const scrollLeft = oldScrollContainer?.scrollLeft || 0

		// Preserve focused cell position (for restoring after re-render)
		const focusedCell = this.grid.focusedCell

		// Parse pagination positions (e.g., "bottom-center" or "top-right|bottom-right")
		const paginationPositions = this.grid.paginationPosition.split('|').map(p => p.trim())

		// Parse summary positions (if set)
		const summaryPositions = this.grid.summaryPosition
			? this.grid.summaryPosition.split('|').map(p => p.trim())
			: []

		// Helper to render content for a position area (top or bottom)
		const renderPositionArea = (positions: string[], isTop: boolean) => {
			// Get all positions for this area
			const areaPaginationPositions = paginationPositions.filter(p =>
				isTop ? p.startsWith('top-') : p.startsWith('bottom-')
			)
			const areaSummaryPositions = summaryPositions.filter(p =>
				isTop ? p.startsWith('top-') : p.startsWith('bottom-')
			)

			const areaHasPagination = areaPaginationPositions.length > 0
			const areaHasSummary = areaSummaryPositions.length > 0

			if (!areaHasPagination && !areaHasSummary) return ''

			// If both exist in this area and summaryInline is true, combine into single footer
			if (areaHasSummary && areaHasPagination && this.grid.isSummaryInline) {
				const topClass = isTop ? ' wg__footer--top' : ''
				return `<div class="wg__footer${topClass}">
					${renderSummary(this, areaSummaryPositions[0])}
					${renderPagination(this, areaPaginationPositions[0])}
				</div>`
			}

			// Otherwise render each position separately
			const allPositions = [...new Set([...areaPaginationPositions, ...areaSummaryPositions])]
			return allPositions.map(pos => {
				const hasPagination = areaPaginationPositions.includes(pos)
				const hasSummary = areaSummaryPositions.includes(pos)

				if (hasSummary && hasPagination) {
					// Both at exact same position: wrap in footer
					const topClass = isTop ? ' wg__footer--top' : ''
					return `<div class="wg__footer${topClass}">
						${renderSummary(this, pos)}
						${renderPagination(this, pos)}
					</div>`
				} else if (hasSummary) {
					return renderSummary(this, pos)
				} else {
					return renderPagination(this, pos)
				}
			}).join('')
		}

		// Render top and bottom areas
		const topContent = renderPositionArea(paginationPositions, true)
		const bottomContent = renderPositionArea(paginationPositions, false)

		// Determine if we should use virtual scrolling
		const useVirtualScroll = this.grid.shouldUseVirtualScroll()

		// Get data rows HTML (virtual or normal)
		let dataRowsHtml: string
		if (useVirtualScroll) {
			// Calculate virtual scroll params
			const items = this.grid.displayItems
			const rowHeight = this.grid.virtualScrollRowHeight
			const buffer = this.grid.virtualScrollBuffer

			// Use stored scroll position for calculation (scrollTop from old container)
			const viewportHeight = oldContainer?.clientHeight || 400  // Default height if not available

			// Calculate visible range
			const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer)
			const visibleCount = Math.ceil(viewportHeight / rowHeight) + buffer * 2
			const endIndex = Math.min(items.length, startIndex + visibleCount)

			// Store for later comparison
			this.virtualScroll.setRange(startIndex, endIndex)

			const params: VirtualScrollParams = {
				startIndex,
				endIndex,
				rowHeight,
				totalItems: items.length
			}
			dataRowsHtml = renderDataRowsVirtual(this, params)
		} else {
			dataRowsHtml = renderDataRows(this)
		}

		// Render shortcuts help icon if enabled
		const shortcutsHelpHtml = this.renderShortcutsHelpIcon()

		const headerRowHtml = renderHeaderRow(this)

		// Decide between surgical update (keep container, table, and listeners
		// alive — replace only the slot contents) and full rebuild. Surgical path
		// is the hot path for ~every render after the first; it skips the ~10
		// addEventListener calls in attachEventListeners and saves the cost of
		// recreating the .wg / .wg__table elements.
		const existingTable = oldContainer?.querySelector('.wg__table') as HTMLTableElement | null
		const existingThead = existingTable?.querySelector('thead') as HTMLElement | null
		const existingTbody = existingTable?.querySelector('tbody') as HTMLElement | null
		const existingTopArea = oldContainer?.querySelector(':scope > .wg__top-area') as HTMLElement | null
		const existingBottomArea = oldContainer?.querySelector(':scope > .wg__bottom-area') as HTMLElement | null
		const currentlyHasTableContainer = !!oldContainer?.querySelector(':scope > .wg__table-container')
		const wantsTableContainer = !!this.grid.isTableBorderOnly
		const canSurgicalUpdate = !!oldContainer
			&& !!existingTable
			&& !!existingThead
			&& !!existingTbody
			&& !!existingTopArea
			&& !!existingBottomArea
			&& currentlyHasTableContainer === wantsTableContainer

		let container: HTMLElement

		if (canSurgicalUpdate) {
			// Surgical path: container, table, and listeners survive untouched.
			container = oldContainer!
			container.className = getContainerClasses(this)
			if (useVirtualScroll) container.classList.add('wg--virtual-scroll')

			if (this.grid.isScrollable && this.grid.scrollMaxHeight !== '100vh') {
				container.style.setProperty('--wg-scroll-max-height', this.grid.scrollMaxHeight)
			} else {
				container.style.removeProperty('--wg-scroll-max-height')
			}

			existingTopArea!.innerHTML = `${shortcutsHelpHtml}${topContent}`
			existingThead!.innerHTML = headerRowHtml
			existingTbody!.innerHTML = dataRowsHtml
			existingBottomArea!.innerHTML = bottomContent

			// Virtual scroll may have changed visible window — clamp scrollTop if it's now out of range
			if (useVirtualScroll) {
				const sc = this.grid.isTableBorderOnly
					? (container.querySelector('.wg__table-container') as HTMLElement) || container
					: container
				const maxScrollTop = Math.max(0, this.grid.displayItems.length * this.grid.virtualScrollRowHeight - sc.clientHeight)
				if (sc.scrollTop > maxScrollTop) sc.scrollTop = maxScrollTop
			}
		} else {
			// Full rebuild path: first render, or structure changed (isTableBorderOnly toggled).
			if (oldContainer) oldContainer.remove()

			container = document.createElement('div')
			container.className = getContainerClasses(this)
			if (useVirtualScroll) container.classList.add('wg--virtual-scroll')

			if (this.grid.isScrollable && this.grid.scrollMaxHeight !== '100vh') {
				container.style.setProperty('--wg-scroll-max-height', this.grid.scrollMaxHeight)
			}

			const tableCore = `
				<table class="wg__table">
					<thead>${headerRowHtml}</thead>
					<tbody>${dataRowsHtml}</tbody>
				</table>
			`
			const tableWithContainer = this.grid.isTableBorderOnly
				? `<div class="wg__table-container">${tableCore}</div>`
				: tableCore

			container.innerHTML = `
				<div class="wg__top-area">${shortcutsHelpHtml}${topContent}</div>
				${tableWithContainer}
				<div class="wg__bottom-area">${bottomContent}</div>
			`

			this.shadow.appendChild(container)

			// Restore scroll position (only needed when container was replaced)
			const scrollContainer = this.grid.isTableBorderOnly
				? (container.querySelector('.wg__table-container') as HTMLElement) || container
				: container

			if (useVirtualScroll) {
				const maxScrollTop = Math.max(0, this.grid.displayItems.length * this.grid.virtualScrollRowHeight - scrollContainer.clientHeight)
				scrollContainer.scrollTop = Math.min(scrollTop, maxScrollTop)
			} else {
				scrollContainer.scrollTop = scrollTop
			}
			scrollContainer.scrollLeft = scrollLeft

			// Wire up event listeners (only on full rebuild — surgical path keeps them alive)
			this.attachEventListeners()
		}

		// Auto-focus editor if in edit mode
		if (this.grid.editingCell) {
			const { rowIndex, field } = this.grid.editingCell
			// Use specific selectors to avoid finding stale editor elements
			let editor = this.shadow.querySelector(
				`.wg__combobox-input[data-row="${rowIndex}"][data-field="${field}"],
				 .wg__autocomplete-input[data-row="${rowIndex}"][data-field="${field}"],
				 .wg__select-trigger[data-row="${rowIndex}"][data-field="${field}"],
				 .wg__date-input[data-row="${rowIndex}"][data-field="${field}"]`
			) as HTMLElement
			if (!editor) {
				editor = this.shadow.querySelector(
					`.wg__editor[data-row="${rowIndex}"][data-field="${field}"]`
				) as HTMLElement
			}
			if (editor) {
				editor.focus()
				if (editor instanceof HTMLInputElement && editor.type === 'text') {
					const cursorPos = this.grid.editingCell.cursorPosition
					const column = this.getCurrentEditingColumn()
					const editStartSelection = column?.editorOptions?.editStartSelection || this.grid.editStartSelection

					if (this.grid.editingCell.initialSearchQuery !== undefined) {
						// Type-to-start: always cursor at end
						const len = editor.value.length
						editor.setSelectionRange(len, len)
					} else {
						// Apply editStartSelection setting
						switch (editStartSelection) {
							case 'mousePosition':
								if (cursorPos !== undefined) {
									const pos = Math.min(cursorPos, editor.value.length)
									editor.setSelectionRange(pos, pos)
								} else {
									// No click position available (e.g., Enter/F2 in navigate mode) - cursor at end
									editor.setSelectionRange(editor.value.length, editor.value.length)
								}
								break
							case 'cursorAtStart':
								editor.setSelectionRange(0, 0)
								break
							case 'cursorAtEnd':
								editor.setSelectionRange(editor.value.length, editor.value.length)
								break
							case 'selectAll':
							default:
								editor.select()
								break
						}
					}
				}
			}
		} else if (focusedCell && !this.grid.editingCell) {
			// Restore focus to the previously focused cell (if not editing)
			const cell = container.querySelector(
				`td[data-row="${focusedCell.rowIndex}"][data-col="${focusedCell.colIndex}"]`
			) as HTMLElement
			if (cell) {
				// Use setTimeout to ensure DOM is ready
				setTimeout(() => cell.focus(), 0)
			}
		}

		// Fix wheel scroll after DOM replacement - force browser to recalculate element under cursor
		// Without this, user has to move mouse for scroll to work after re-render
		if (useVirtualScroll) {
			requestAnimationFrame(() => {
				// Briefly toggle pointer-events to force recalculation
				container.style.pointerEvents = 'none'
				requestAnimationFrame(() => {
					container.style.pointerEvents = ''
				})
			})
		}

		// Render connector arrow if active
		this.renderConnector()

		// Update fill handle after render
		updateFillHandle(this)

		// Update cell range border after render
		if (this.grid.selectedCellRange) {
			updateRangeBorder(this)
		}

		// Update row selection borders after render
		if (this.grid.selectedRows.length > 0) {
			createRowSelectionBorders(this)
		} else {
			removeRowSelectionBorders()
		}

		// Update column selection borders after render
		if (this.grid.selectedColumns.length > 0) {
			createColumnSelectionBorders(this)
		} else {
			removeColumnSelectionBorders()
		}

		perfLogger.debug('render() body:', (performance.now() - __renderStartT).toFixed(2), 'ms |', gridPerf.summary())
	}

	/**
	 * Render the SVG connector arrow for toolbar row tracking
	 */
	renderConnector(): void {
		// Remove any existing connector
		const existingConnector = this.shadow.querySelector('.wg__connector')
		if (existingConnector) {
			existingConnector.remove()
		}

		const state = getConnectorState()
		if (!state.path || !state.arrowPos) {
			return
		}

		// Create SVG overlay
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
		svg.setAttribute('class', 'wg__connector')
		svg.setAttribute('style', 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 999;')

		// Create path
		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
		path.setAttribute('d', state.path)
		path.setAttribute('stroke', 'var(--wg-accent-color, #0078d4)')
		path.setAttribute('stroke-width', '2')
		path.setAttribute('fill', 'none')
		svg.appendChild(path)

		// Create arrow head
		const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
		const points = state.arrowDir === 'down' ? '-4,0 4,0 0,8' :
			state.arrowDir === 'up' ? '-4,0 4,0 0,-8' :
			state.arrowDir === 'left' ? '0,-4 -8,0 0,4' :
			'0,-4 8,0 0,4'
		arrow.setAttribute('points', points)
		arrow.setAttribute('fill', 'var(--wg-accent-color, #0078d4)')
		arrow.setAttribute('transform', `translate(${state.arrowPos.x}, ${state.arrowPos.y})`)
		svg.appendChild(arrow)

		this.shadow.appendChild(svg)
	}

	/**
	 * Clear all selections (cell range, row, column) and their visual borders
	 */
	private clearAllSelections(): void {
		// Clear state and visuals surgically WITHOUT triggering requestUpdate/render.
		// A full re-render would replace all DOM elements, making any references
		// captured after this call (e.g., resize headerCell) point to detached nodes.
		if (this.grid.selectedCellRange) {
			this.grid.clearCellSelection_noRender()
			removeRangeBorder()
			// Remove in-range highlighting
			const inRange = this.shadow.querySelectorAll('.wg__cell--in-range')
			inRange.forEach(c => c.classList.remove('wg__cell--in-range'))
		}
		if (this.grid.selectedRows.length > 0) {
			this.grid.clearSelection_noRender()
			removeRowSelectionBorders()
			// Remove row selection highlighting
			const selectedRows = this.shadow.querySelectorAll('.wg__row--selected')
			selectedRows.forEach(r => r.classList.remove('wg__row--selected'))
		}
		if (this.grid.selectedColumns.length > 0) {
			this.grid.clearColumnSelection_noRender()
			removeColumnSelectionBorders()
			// Remove column selection highlighting
			const selectedCells = this.shadow.querySelectorAll('.wg__cell--column-selected')
			selectedCells.forEach(c => c.classList.remove('wg__cell--column-selected'))
			const selectedHeaders = this.shadow.querySelectorAll('.wg__header--selected')
			selectedHeaders.forEach(h => h.classList.remove('wg__header--selected'))
		}
	}

	/**
	 * Called from cell-transition click handlers in place of grid.cancelEdit().
	 * Reads the in-progress editor value and commits it (Excel-like) when
	 * shouldCommitOnClickAway is true; falls back to cancel when false or when
	 * the editor DOM can't be read. Must be called BEFORE renderCell wipes
	 * the editor element.
	 */
	private commitOrCancelEditOnTransition(): void {
		const editingCell = this.grid.editingCell
		if (!editingCell) return
		if (!this.grid.shouldCommitOnClickAway) {
			this.grid.cancelEdit()
			return
		}
		const { rowIndex, field } = editingCell
		const colIndex = this.grid.columns.findIndex(c => String(c.field) === field)
		if (colIndex < 0) {
			this.grid.cancelEdit()
			return
		}
		const cell = this.shadow.querySelector(
			`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
		) as HTMLElement | null
		let editor: HTMLElement | null = cell?.querySelector(
			'.wg__combobox-input, .wg__autocomplete-input, .wg__date-input, .wg__select-trigger'
		) as HTMLElement | null
		if (!editor) editor = cell?.querySelector('.wg__editor') as HTMLElement | null
		if (!editor) {
			this.grid.cancelEdit()
			return
		}
		let value: unknown
		if (editor instanceof HTMLInputElement) {
			if (editor.type === 'checkbox') {
				const item = this.grid.displayItems[rowIndex]
				value = this.grid.getCellRawValue(item, rowIndex, field)
			} else if (editor.classList.contains('wg__date-input')) {
				value = editor.dataset.dateValue || editor.value
			} else if (editor.classList.contains('wg__editor--number')) {
				const strValue = editor.value.trim()
				if (strValue === '') {
					value = null
				} else {
					const num = parseFloat(strValue)
					value = isNaN(num) ? strValue : num
				}
			} else {
				value = editor.value
			}
		} else if (editor instanceof HTMLSelectElement) {
			value = editor.value
		} else {
			value = editor.dataset.value || ''
		}
		// Fire and forget — grid.commitEdit handles async validation and clears
		// editingCell when complete. The surrounding caller already handles
		// post-transition rendering and focus.
		void this.grid.commitEdit(rowIndex, field, value)
	}

	/**
	 * Surgically update row focus visual (add/remove wg__row--focused class)
	 * Avoids full re-render to preserve cell focus
	 */
	private updateRowFocusVisual(prevRowIndex: number | null, newRowIndex: number | null): void {
		if (prevRowIndex === newRowIndex) return

		if (prevRowIndex !== null) {
			const prevRow = this.shadow.querySelector(`tr[data-row-index="${prevRowIndex}"]`)
			prevRow?.classList.remove('wg__row--focused')
		}
		if (newRowIndex !== null) {
			const newRow = this.shadow.querySelector(`tr[data-row-index="${newRowIndex}"]`)
			newRow?.classList.add('wg__row--focused')
		}
	}

	/**
	 * Show "Go to Row" dialog (Ctrl+G)
	 */
	private showGoToRowDialog(colIndex: number): void {
		const displayItems = this.grid.displayItems
		if (displayItems.length === 0) return

		// Create dialog overlay
		const overlay = document.createElement('div')
		overlay.className = 'wg__goto-overlay'
		overlay.innerHTML = `
			<div class="wg__goto-dialog">
				<label class="wg__goto-label">Go to row (1-${displayItems.length}):</label>
				<input type="number" class="wg__goto-input" min="1" max="${displayItems.length}" value="1" />
				<div class="wg__goto-buttons">
					<button type="button" class="wg__goto-btn wg__goto-btn--cancel">Cancel</button>
					<button type="button" class="wg__goto-btn wg__goto-btn--go">Go</button>
				</div>
			</div>
		`

		const input = overlay.querySelector('.wg__goto-input') as HTMLInputElement
		const goBtn = overlay.querySelector('.wg__goto-btn--go') as HTMLButtonElement
		const cancelBtn = overlay.querySelector('.wg__goto-btn--cancel') as HTMLButtonElement

		const closeDialog = () => {
			overlay.remove()
		}

		const goToRow = () => {
			const rowNum = parseInt(input.value, 10)
			if (isNaN(rowNum) || rowNum < 1 || rowNum > displayItems.length) {
				input.focus()
				input.select()
				return
			}

			closeDialog()

			// Convert 1-based to 0-based index
			const targetRow = rowNum - 1
			const oldFocus = this.grid.focusedCell
			this.grid.setFocusedCell(targetRow, colIndex)

			if (this.grid.shouldUseVirtualScroll()) {
				// Virtual scroll: scroll to position (programmatic flag prevents redundant handleVirtualScroll)
				this.scrollToRowProgrammatically(targetRow)
				// After scroll settles, focus the cell
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						const cell = this.shadow.querySelector(
							`td[data-row="${targetRow}"][data-col="${colIndex}"]`
						) as HTMLElement
						cell?.focus()
					})
				})
			} else {
				// Non-virtual: scroll cell into view and focus it
				const cell = this.shadow.querySelector(
					`td[data-row="${targetRow}"][data-col="${colIndex}"]`
				) as HTMLElement
				if (cell) {
					cell.scrollIntoView({ block: 'nearest', behavior: 'auto' })
					cell.focus()
					updateFocusVisual(this, oldFocus, { rowIndex: targetRow, colIndex })
				}
			}
		}

		// Event handlers
		goBtn.addEventListener('click', goToRow)
		cancelBtn.addEventListener('click', closeDialog)
		overlay.addEventListener('click', (e) => {
			if (e.target === overlay) closeDialog()
		})
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault()
				goToRow()
			} else if (e.key === 'Escape') {
				e.preventDefault()
				closeDialog()
			}
		})

		this.shadow.appendChild(overlay)
		input.focus()
		input.select()
	}

	/**
	 * Open custom editor by calling the cellEditCallback
	 */
	openCustomEditor(rowIndex: number, colIndex: number): void {
		const column = this.grid.columns[colIndex]
		if (!column || column.editor !== 'custom' || !column.cellEditCallback) {
			return
		}

		const field = String(column.field)
		const item = this.grid.displayItems[rowIndex]
		if (!item) return

		const currentValue = this.grid.getCellRawValue(item, rowIndex, field)

		// Create context with commit/cancel functions
		const context: CustomEditorContext<unknown> = {
			value: currentValue,
			row: item,
			rowIndex,
			field,
			commit: async (newValue: unknown) => {
				// Same order as the canonical edit-executor commit path:
				//   1. clearEditingVisual BEFORE commitEdit (so editingCell is still
				//      set and the wg__cell--editing class can be located and removed)
				//   2. await commitEdit (it's async — may run beforeCommitCallback)
				//   3. renderCell so the cell picks up the committed draft value
				clearEditingVisual(this)
				await this.grid.commitEdit(rowIndex, field, newValue)
				renderCell(this, rowIndex, colIndex)
				requestAnimationFrame(() => {
					moveFocus(this, rowIndex, colIndex)
				})
			},
			cancel: () => {
				// Cancel edit mode without saving
				clearEditingVisual(this)
				this.grid.cancelEdit()
				renderCell(this, rowIndex, colIndex)
				// Return focus to the cell
				requestAnimationFrame(() => {
					moveFocus(this, rowIndex, colIndex)
				})
			}
		}

		// Call the callback (cast to any to satisfy generic constraint)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		;(column.cellEditCallback as (ctx: CustomEditorContext<any>) => void)(context)
	}


	/**
	 * Handle paste event in navigate mode
	 * Supports single-cell paste and multi-cell TSV paste from Excel
	 */
	private handlePaste = async (e: ClipboardEvent): Promise<void> => {
		// Only in navigate mode with focused cell, not while editing
		if (!this.grid.isNavigateMode || this.grid.editingCell || !this.grid.focusedCell) return

		const { rowIndex, colIndex } = this.grid.focusedCell
		const text = e.clipboardData?.getData('text') || ''
		if (!text) return

		// Check if this is multi-cell paste (contains tabs or multiple lines)
		const isMultiCell = text.includes('\t') || text.includes('\n')

		if (isMultiCell) {
			// Multi-cell paste - use paste module
			e.preventDefault()
			await executePaste(this, text, rowIndex, colIndex)
			this.render()
		} else {
			// Single cell paste - original behavior
			const column = this.grid.columns[colIndex]
			const row = this.grid.displayItems[rowIndex]
			if (!column || !row) return

			// Check if cell is editable
			if (!this.grid.isCellEditable(column, row)) return

			e.preventDefault()

			let processedText: unknown = text
			if (column.beforePasteCallback) {
				processedText = column.beforePasteCallback(text, row)
			}

			// Commit the pasted value
			const field = String(column.field)
			await this.grid.commitEdit(rowIndex, field, processedText)
			this.render()
		}
	}
}

// Register the custom element
if (typeof customElements !== 'undefined' && !customElements.get('web-grid')) {
	customElements.define('web-grid', GridElement)
}

export default GridElement

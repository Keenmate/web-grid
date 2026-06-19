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
	TooltipService,
	attachTooltipListeners
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
	scrollToRowPosition,
	handleCellKeyDown
} from './modules/navigation/index.js'

import {
	commitCurrentEditor,
	handleCheckboxChange,
	toggleCheckboxAndMove,
	handleEditorBlur,
	moveFocusAfterCommit,
	focusCellAfterCancel,
	restoreCellToDisplayMode,
	renderCellEditor,
	handleEditorKeyDown
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
	getActiveToolbarRowIndex,
	getConnectorState,
	updateConnector,
	ToolbarService,
	removeInlineShortcuts,
	closeToolbarAndReset,
	attachToolbarListeners,
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

import {
	handleSortClick,
	attachPaginationListeners,
	handleTableMouseDown,
	handleHeaderRowMouseDown,
	handleContainerKeyDown,
	handleContainerScroll,
	handleWindowScroll,
	handleOutsideClick,
	handleSortClickSubscription,
	handleTableKeyDown,
	handleTableFocus,
	handleTableDblClick,
	handleCellClickToEdit,
	handleSelectTriggerClick,
	handleHeaderColumnSelectClick,
	handleInternalBlur
} from './modules/events/index.js'
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

	// Cell-level keydown moved to modules/navigation/cell-keydown.ts —
	// see `handleCellKeyDown` import above.
	// Editor-input keydown moved to modules/editing/editor-keydown.ts —
	// see `handleEditorKeyDown` import above.

	// ==========================================================================
	// Event Listener Attachment
	// ==========================================================================

	/** Tracks whether a mouse button is currently pressed on the table (mousedown→mouseup) */
	isMouseDown = false

	private attachEventListeners(): void {
		const table = this.shadow.querySelector('.wg__table')
		if (!table) return

		// Track mouse button state so focus handler can distinguish mouse vs keyboard focus
		table.addEventListener('mousedown', () => { this.isMouseDown = true }, true)
		document.addEventListener('mouseup', () => { this.isMouseDown = false }, true)

		// Focus — capture-phase, drives handleCellFocus + always-edit-mode swap + onrowfocus (keyboard only)
		// Extracted to modules/events/table-focus.ts
		table.addEventListener('focus', (e: Event) => handleTableFocus(this, e), true)

		// Keydown — tree shortcuts + pipeline + datepicker passthrough + editor/cell dispatch
		// Extracted to modules/events/table-keydown.ts
		table.addEventListener('keydown', (e: Event) => handleTableKeyDown(this, e))

		// Initialize focus event manager on table
		this.focusEvents.init(table as HTMLElement)

		// Focus out - subscribe to focusout events
		this.focusEvents.subscribe('focusout', (_target, relatedTarget) => {
			if (!relatedTarget || !table.contains(relatedTarget)) {
				handleTableFocusOut(this, { relatedTarget } as unknown as FocusEvent)
			}
		})

		// Double-click — pipeline + dblclick / navigate editTrigger paths.
		// Tree-column dblclick-to-toggle is handled in table-mousedown via
		// MouseEvent.detail === 2 because surgical render rebuilds the cell's
		// <td> between clicks and the browser drops the native dblclick when
		// the two click targets differ.
		// Extracted to modules/events/table-clicks.ts
		table.addEventListener('dblclick', (e: Event) => handleTableDblClick(this, e))

		// Single click — tree chevron + pipeline + click editTrigger
		// Extracted to modules/events/table-clicks.ts
		table.addEventListener('click', (e: Event) => handleCellClickToEdit(this, e))

		// Mousedown - tree dblclick / cell range selection / date trigger / dropdown switch
		// Extracted to modules/events/table-mousedown.ts
		table.addEventListener('mousedown', (e: Event) => handleTableMouseDown(this, e))

		// Legacy click on .wg__select-trigger / .wg__select-value — toggles dropdown.
		// Skipped in 'always' mode (pipeline owns dropdown open there).
		// Extracted to modules/events/table-clicks.ts
		table.addEventListener('click', (e: Event) => handleSelectTriggerClick(this, e))

		// Mousedown — column resize / reorder / column-select / row-select / clear-on-empty
		// Extracted to modules/events/header-mousedown.ts
		table.addEventListener('mousedown', (e: Event) => handleHeaderRowMouseDown(this, e))

		// Header click → column selection (replace/range/toggle). Only fires when
		// isColumnReorderAllowed is on; otherwise mousedown handler does it.
		// Extracted to modules/events/table-clicks.ts
		table.addEventListener('click', (e: Event) => handleHeaderColumnSelectClick(this, e))

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

		// Blur events — internal focus change dispatch. Capture phase + skip guard
		// handled by focusEvents; outsideClick owns leaving-grid cleanup.
		// Extracted to modules/events/blur-subscription.ts
		if (!this.focusEventsSubscribed) {
			this.focusEvents.subscribe('blur', (target, relatedTarget) => {
				if (this.focusEvents.shouldSkipBlur()) return
				const isLeavingGrid = !relatedTarget || !this.shadow.contains(relatedTarget)
				if (isLeavingGrid) return
				handleInternalBlur(this, target, relatedTarget)
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

			// Range shortcuts + Escape + Ctrl+C for active selections
			// Extracted to modules/events/container-keydown.ts
			container.addEventListener('keydown', (e: KeyboardEvent) => handleContainerKeyDown(this, e))

			// Initialize scroll event manager and subscribe to scroll events
			this.scrollEvents.init(scrollContainer)

			// Container + window scroll subscriptions
			// Extracted to modules/events/scroll-handlers.ts
			this.scrollEvents.subscribe('container', () => handleContainerScroll(this, container, scrollContainer))
			this.scrollEvents.subscribe('window', () => handleWindowScroll(this))

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

				// Outside-click + sort-click subscriptions
				// Extracted to modules/events/click-subscriptions.ts
				this.clickEvents.subscribe('outsideClick', () => handleOutsideClick(this))
				this.clickEvents.subscribe('sortClick', (subCtx) => handleSortClickSubscription(this, subCtx))

				this.clickEventsSubscribed = true
			}
		}

		// Tooltip events
		attachTooltipListeners(this, table)

		// Row toolbar events — trigger / inline / hover / mousemove / click / outside click
		attachToolbarListeners(this, table)

		// Pagination events (delegated on .wg container — see attachPaginationListeners)
		const wgContainer = this.shadow.querySelector('.wg') as HTMLElement | null
		if (wgContainer) {
			attachPaginationListeners(this, wgContainer)
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
	scrollToRowProgrammatically(targetRow: number): void {
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
	clearAllSelections(): void {
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
	commitOrCancelEditOnTransition(): void {
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
	updateRowFocusVisual(prevRowIndex: number | null, newRowIndex: number | null): void {
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
	showGoToRowDialog(colIndex: number): void {
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

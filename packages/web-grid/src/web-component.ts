// =============================================================================
// GridElement - Web Component Registration
// =============================================================================

import { GridEngine, MODE_PRESETS } from './grid.js'
import type {
	Column,
	CellValidationState,
	EditTrigger,
	EditStartSelection,
	EditorOptions,
	GridMode,
	ToggleVisibility,
	SortState,
	SortMode,
	PaginationLabelsCallback,
	SummaryCallback,
	ToolbarPosition,
	GridLabels,
	GridLabelsInput,
	RowLock,
	RowLockingOptions,
	ColumnWidthState,
	ColumnOrderState,
	PasteMode,
	CreateRowCallback,
	ChevronCallback
} from './types.js'
import type {
	GridController,
	GridContext as GridCallbackContext,
	RowContext,
	RowDataContext,
	CellContext,
	ValidationTooltipContext,
	HeaderMenuContext,
	FillContext,
	BeforePasteContext,
	GridToolbarEntry,
	GridMenuEntry,
	GridHeaderMenuEntry,
	GridShortcut,
	GridRangeShortcut,
	GridActionEventDetail,
	GridEventMap,
	DraftInfo,
	BeforePageChangeContext
} from './interaction.js'
import { createGridController } from './controller.js'

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
	handleCellKeyDown,
	restoreFocusAfterRender,
	showGoToRowDialog as showGoToRowDialogModule
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
	handleEditorKeyDown,
	openCustomEditor as openCustomEditorModule,
	commitOrCancelEditOnTransition as commitOrCancelEditOnTransitionModule
} from './modules/editing/index.js'

import {
	getContainerClasses,
	renderHeaderRow,
	renderDataRows,
	renderDataRowsVirtual,
	renderPagination,
	renderSummary,
	renderSummaryContent,
	renderCell,
	renderShortcutsHelpIcon as renderShortcutsHelpIconModule
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
	renderConnector as renderConnectorModule,
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
	FilterRowService,
	attachFilterRowListeners,
	captureFilterFocus,
	restoreFilterFocus,
	positionFilterRow
} from './modules/filter-row/index.js'

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
	removeAllSelectionBorders,
	clearAllSelections as clearAllSelectionsModule
} from './modules/selection-border/index.js'

import {
	handleHeaderMouseDown,
	isColumnSelecting,
	isColumnSelectionPending
} from './modules/column-selection/index.js'

import { executePaste, handlePasteEvent } from './modules/paste/index.js'

import {
	ActionPipelineAdapter,
	createActionPipelineAdapter
} from './modules/actions/index.js'

import type { GridHost } from './modules/grid-context.js'

// Core: reactive base class + the input-table converters. web-grid keeps its
// rich config-object/property API (columns, items, callbacks stay properties);
// core owns the SSR-safe base, the §12.3 instance registry, and — via the
// `static inputs` table below — the declarative *attribute* layer for the
// scalar/enum config flags. See ../../CLAUDE.md and core SPEC §6.
import {
	BlissElement,
	toBool,
	toInt,
	toFloat,
	toText,
	toEnum,
	toCustom,
	type InputDef,
	type EventDef,
} from '@keenmate/web-components-core'

// Enum member lists for the input table (hoisted `as const` so the CEM
// extractor and toEnum both read the same literal source of truth).
const PAGINATION_MODES = ['client', 'server'] as const
const EDIT_TRIGGERS = ['click', 'dblclick', 'button', 'always', 'navigate'] as const
const EDIT_START_SELECTIONS = ['mousePosition', 'selectAll', 'cursorAtStart', 'cursorAtEnd'] as const
const GRID_MODES = ['read-only', 'excel', 'input-matrix'] as const
const CELL_SELECTION_MODES = ['disabled', 'click', 'shift'] as const
const TOGGLE_VISIBILITIES = ['always', 'on-focus'] as const
const TOOLBAR_VERTICAL_ALIGNS = ['top', 'center', 'bottom'] as const
const TOOLBAR_HORIZONTAL_ALIGNS = ['start', 'center', 'end', 'cursor'] as const
const TOOLBAR_TRIGGERS = ['hover', 'click', 'button'] as const
const TOOLBAR_POSITIONS = ['auto', 'left', 'right', 'top', 'inline'] as const
const SHORTCUTS_HELP_POSITIONS = ['top-right', 'top-left'] as const
const SORT_MODES = ['none', 'single', 'multi'] as const
const NEW_ROW_POSITIONS = ['top', 'bottom'] as const
const TREE_DOUBLE_CLICK_BEHAVIORS = ['none', 'toggle'] as const
const PASTE_MODES = ['skip-non-editable', 'all-columns', 'editable-only'] as const
const FILTER_MODES = ['client', 'server'] as const

/**
 * Event table (core SPEC §12.5): every happening is one DOM event (bubbles, not
 * composed) + a camelCase `on*` twin property called with the same detail first.
 * Every detail carries `controller` + `element` (non-enumerable).
 */
const EVENTS: readonly EventDef[] = [
	{ name: 'row-change', description: 'A cell value was committed (editor, checkbox, paste, new row). `detail`: `{ row, draftRow, rowIndex, field, oldValue, newValue, isValid, validationError }`. Twin: `onRowChange(detail)`.' },
	{ name: 'edit-start', description: 'A cell editor opened. `detail`: `{ row, rowIndex, field }`. Twin: `onEditStart(detail)`.' },
	{ name: 'edit-cancel', description: 'A cell edit was cancelled. `detail`: `{ row, rowIndex, field }`. Twin: `onEditCancel(detail)`.' },
	{ name: 'validation-error', description: '`validateCallback` rejected a value. `detail`: `{ row, rowIndex, field, error, source: "edit" | "paste" }`. Twin: `onValidationError(detail)`.' },
	{ name: 'row-focus', description: 'A different row got focus. `detail`: `{ row, rowIndex, previousRowIndex }`. Twin: `onRowFocus(detail)`.' },
	{ name: 'row-delete', description: 'Ctrl+Delete on a row — a request; the grid does not delete. `detail`: `{ row, rowIndex }`. Twin: `onRowDelete(detail)`.' },
	{ name: 'cell-selection-change', description: 'The selected cell range changed. `detail`: `{ range, cellCount }`. Twin: `onCellSelectionChange(detail)`.' },
	{ name: 'data-request', description: 'Sort / page / page size changed or more rows are needed (server-side data). `detail`: `{ sort, page, pageSize, trigger, mode, skip }`. Twin: `onDataRequest(detail)`.' },
	{ name: 'filter-change', description: 'A column filter changed. `detail`: `{ filters }`. With `filter-mode="server"` the consumer filters. Twin: `onFilterChange(detail)`.' },
	{ name: 'column-resize', description: 'A column was resized. `detail`: `{ field, oldWidth, newWidth, allWidths }`. Twin: `onColumnResize(detail)`.' },
	{ name: 'column-reorder', description: 'A column was moved. `detail`: `{ field, fromIndex, toIndex, allOrder }`. Twin: `onColumnReorder(detail)`.' },
	{ name: 'expand-change', description: 'Tree rows expanded / collapsed (toggle, subtree, expand / collapse all). `detail`: `{ path, isExpanded, expandedPaths }` (`path` null for all). Twin: `onExpandChange(detail)`.' },
	{ name: 'row-lock-change', description: 'A row was locked / unlocked by id. `detail`: `{ rowId, row, rowIndex, lockInfo, source }`. Twin: `onRowLockChange(detail)`.' },
	{ name: 'paste-complete', description: 'A multi-cell paste finished. `detail`: `{ totalCells, successfulCells, failedCells, skippedCells, newRowsCreated, cellResults, hadHeaders }`. Twin: `onPasteComplete(detail)`.' },
	{ name: 'action', description: 'A toolbar / menu / shortcut item was activated. `detail`: `action` (built-in name or `custom`), `id`, `item`, `source` (`row-toolbar` | `cell-toolbar` | `context-menu` | `header-menu` | `keyboard`), `sourceEvent`, `triggerElement`, `dataset`, plus the surface fields (`row` / `rowIndex` / `column` / `field` / `value`, header-menu fields, or range `rows` / `rowIndices`). Fires after the item’s `onClick`, before the built-in. Twin: `onAction(detail)`.' },
]

/**
 * Boolean-or-`'auto'` tri-state (used by `is-pagination-visible`). Absent → the
 * grid default; `auto` → `'auto'`; otherwise the usual true/false-ish parse.
 */
const toBoolOrAuto = (fallback: boolean): InputDef['converter'] =>
	toCustom<boolean | 'auto'>((raw) => {
		if (raw === null) return fallback
		const v = raw.trim().toLowerCase()
		if (v === 'auto') return 'auto'
		return !(v === 'false' || v === '0' || v === 'no' || v === 'off')
	})

/**
 * Number-or-CSS-length (used by `cell-toolbar-offset`, default `0.2`). A bare
 * number stays a number (em multiplier); anything else is kept as a string.
 */
const toNumberOrLength = (fallback: number | string): InputDef['converter'] =>
	toCustom<number | string>((raw) => {
		if (raw === null || raw.trim() === '') return fallback
		const n = Number(raw)
		return Number.isNaN(n) ? raw : n
	})

/**
 * GridElement - Custom HTML Element for GridEngine
 *
 * Extends {@link BlissElement} (SSR-safe base + §12.3 registry) and composes
 * GridEngine for business logic.
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
export class GridElement<T = unknown> extends BlissElement<GridEventMap<T>, GridController<T>> implements GridHost<T> {
	// ── Declarative attribute layer (core input table) ────────────────────────
	// Every row here is a scalar/enum config flag exposed as a kebab HTML
	// attribute AND a reactive property (core installs the property accessor,
	// shadowing the typed get/set facade further down which stays for
	// IntelliSense). `default` mirrors the GridEngine field initializer so a fresh
	// element behaves identically. `on: 'update'` → each change is bridged into
	// `this.engine` (see `update()`), whose setter re-renders. Structured config
	// (columns/items/callbacks), self-mutated UI state (currentPage, sort,
	// filters, focusedRowIndex, totalItems, expandedPaths, hasMoreItems) and the
	// two persist flags (side-effect setters) deliberately stay property-only.
	static inputs: readonly InputDef[] = [
		// Filtering & pagination
		{ configKey: 'isFilterable', attribute: 'is-filterable', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'filterMode', attribute: 'filter-mode', converter: toEnum(FILTER_MODES, { default: 'client' }), default: 'client', on: 'update' },
		{ configKey: 'isPageable', attribute: 'is-pageable', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'pageSize', attribute: 'page-size', converter: toInt({ min: 1, default: 10 }), default: 10, on: 'update' },
		{ configKey: 'paginationMode', attribute: 'pagination-mode', converter: toEnum(PAGINATION_MODES, { default: 'client' }), default: 'client', on: 'update' },
		{ configKey: 'isPaginationVisible', attribute: 'is-pagination-visible', converter: toBoolOrAuto(true), default: true, on: 'update', type: "boolean | 'auto'" },
		{ configKey: 'paginationPosition', attribute: 'pagination-position', converter: toText({ default: 'bottom-center' }), default: 'bottom-center', on: 'update' },
		{ configKey: 'paginationLayout', attribute: 'pagination-layout', converter: toText({ default: 'pageSize|previous|pageInfo|next' }), default: 'pageSize|previous|pageInfo|next', on: 'update' },
		// Appearance
		{ configKey: 'isStriped', attribute: 'is-striped', converter: toBool('default-true'), default: true, on: 'update' },
		{ configKey: 'isHoverable', attribute: 'is-hoverable', converter: toBool('default-true'), default: true, on: 'update' },
		{ configKey: 'isTableBorderOnly', attribute: 'is-table-border-only', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'isScrollable', attribute: 'is-scrollable', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'scrollMaxHeight', attribute: 'scroll-max-height', converter: toText({ default: '100vh' }), default: '100vh', on: 'update' },
		// Editing
		{ configKey: 'isEditable', attribute: 'is-editable', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'editTrigger', attribute: 'edit-trigger', converter: toEnum(EDIT_TRIGGERS, { default: 'dblclick' }), default: 'dblclick', on: 'update' },
		// HTML of the edit button (editTrigger 'button'), e.g. '<span class="lucide-pencil"></span>'
		{ configKey: 'editButtonIcon', attribute: 'edit-button-icon', converter: toText({ default: '✎' }), default: '✎', on: 'update' },
		{ configKey: 'editStartSelection', attribute: 'edit-start-selection', converter: toEnum(EDIT_START_SELECTIONS, { default: 'mousePosition' }), default: 'mousePosition', on: 'update' },
		{ configKey: 'shouldCommitOnClickAway', attribute: 'should-commit-on-click-away', converter: toBool('default-true'), default: true, on: 'update' },
		// A preset: also sets isEditable / editTrigger / dropdown flags / cellSelectionMode in the
		// same batch; inputs set explicitly in that batch win (core getBatchValuesCallback).
		{ configKey: 'mode', attribute: 'mode', converter: toEnum(GRID_MODES, { default: 'excel' }), default: 'excel', on: 'update',
			getBatchValuesCallback: (mode) => MODE_PRESETS[mode as GridMode] ?? null },
		{ configKey: 'cellSelectionMode', attribute: 'cell-selection-mode', converter: toEnum(CELL_SELECTION_MODES, { default: 'click' }), default: 'click', on: 'update' },
		// Dropdown editor
		{ configKey: 'dropdownToggleVisibility', attribute: 'dropdown-toggle-visibility', converter: toEnum(TOGGLE_VISIBILITIES, { default: 'always' }), default: 'always', on: 'update' },
		{ configKey: 'shouldShowDropdownOnFocus', attribute: 'should-show-dropdown-on-focus', converter: toBool('default-true'), default: true, on: 'update' },
		{ configKey: 'shouldOpenDropdownOnEnter', attribute: 'should-open-dropdown-on-enter', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'isCheckboxAlwaysEditable', attribute: 'is-checkbox-always-editable', converter: toBool('default-false'), default: false, on: 'update' },
		// Row numbers & indicators
		{ configKey: 'isRowNumbersVisible', attribute: 'is-row-numbers-visible', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'isDirtyIndicatorVisible', attribute: 'is-dirty-indicator-visible', converter: toBool('default-true'), default: true, on: 'update' },
		{ configKey: 'isStickyRowNumbers', attribute: 'is-sticky-row-numbers', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'freezeColumns', attribute: 'freeze-columns', converter: toInt({ min: 0, default: 0 }), default: 0, on: 'update' },
		// Row toolbar
		{ configKey: 'isRowToolbarVisible', attribute: 'is-row-toolbar-visible', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'toolbarVerticalAlign', attribute: 'toolbar-vertical-align', converter: toEnum(TOOLBAR_VERTICAL_ALIGNS, { default: 'bottom' }), default: 'bottom', on: 'update' },
		{ configKey: 'toolbarHorizontalAlign', attribute: 'toolbar-horizontal-align', converter: toEnum(TOOLBAR_HORIZONTAL_ALIGNS, { default: 'center' }), default: 'center', on: 'update' },
		{ configKey: 'toolbarTrigger', attribute: 'toolbar-trigger', converter: toEnum(TOOLBAR_TRIGGERS, { default: 'hover' }), default: 'hover', on: 'update' },
		{ configKey: 'toolbarPosition', attribute: 'toolbar-position', converter: toEnum(TOOLBAR_POSITIONS, { default: 'auto' }), default: 'auto', on: 'update' },
		{ configKey: 'shouldToolbarFollowCursor', attribute: 'should-toolbar-follow-cursor', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'cellToolbarOffset', attribute: 'cell-toolbar-offset', converter: toNumberOrLength(0.2), default: 0.2, on: 'update', type: 'number | string' },
		// absent → labels.inlineActionsHeader; an explicit "" → blank header
		{ configKey: 'inlineActionsTitle', attribute: 'inline-actions-title', converter: toText({ isNullable: true, isEmptyAllowed: true }), default: undefined, on: 'update' },
		// Context menu
		{ configKey: 'contextMenuXOffset', attribute: 'context-menu-x-offset', converter: toInt({ default: 8 }), default: 8, on: 'update' },
		{ configKey: 'contextMenuYOffset', attribute: 'context-menu-y-offset', converter: toInt({ default: 0 }), default: 0, on: 'update' },
		// Shortcuts help
		{ configKey: 'isShortcutsHelpVisible', attribute: 'is-shortcuts-help-visible', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'shortcutsHelpPosition', attribute: 'shortcuts-help-position', converter: toEnum(SHORTCUTS_HELP_POSITIONS, { default: 'top-right' }), default: 'top-right', on: 'update' },
		// Columns
		{ configKey: 'columnMinWidth', attribute: 'column-min-width', converter: toText({ isNullable: true }), default: undefined, on: 'update' },
		{ configKey: 'isColumnReorderAllowed', attribute: 'is-column-reorder-allowed', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'sortMode', attribute: 'sort-mode', converter: toEnum(SORT_MODES, { default: 'none' }), default: 'none', on: 'update' },
		// Summary
		{ configKey: 'summaryPosition', attribute: 'summary-position', converter: toText({ isNullable: true }), default: undefined, on: 'update' },
		{ configKey: 'isSummaryInline', attribute: 'is-summary-inline', converter: toBool('default-true'), default: true, on: 'update' },
		// Virtual & infinite scroll
		{ configKey: 'isVirtualScrollEnabled', attribute: 'is-virtual-scroll-enabled', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'virtualScrollThreshold', attribute: 'virtual-scroll-threshold', converter: toInt({ min: 0, default: 100 }), default: 100, on: 'update' },
		{ configKey: 'virtualScrollRowHeight', attribute: 'virtual-scroll-row-height', converter: toInt({ min: 1, default: 38 }), default: 38, on: 'update' },
		{ configKey: 'virtualScrollBuffer', attribute: 'virtual-scroll-buffer', converter: toInt({ min: 0, default: 10 }), default: 10, on: 'update' },
		{ configKey: 'isInfiniteScrollEnabled', attribute: 'is-infinite-scroll-enabled', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'infiniteScrollThreshold', attribute: 'infinite-scroll-threshold', converter: toInt({ min: 0, default: 100 }), default: 100, on: 'update' },
		// New empty row
		{ configKey: 'isNewRowEnabled', attribute: 'is-new-row-enabled', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'newRowPosition', attribute: 'new-row-position', converter: toEnum(NEW_ROW_POSITIONS, { default: 'bottom' }), default: 'bottom', on: 'update' },
		{ configKey: 'newRowIndicator', attribute: 'new-row-indicator', converter: toText({ default: '+' }), default: '+', on: 'update' },
		// Tree
		{ configKey: 'treeDataSorted', attribute: 'tree-data-sorted', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'treeDoubleClickBehavior', attribute: 'tree-double-click-behavior', converter: toEnum(TREE_DOUBLE_CLICK_BEHAVIORS, { default: 'none' }), default: 'none', on: 'update' },
		{ configKey: 'treeExpandedGlyph', attribute: 'tree-expanded-glyph', converter: toText({ default: '▶' }), default: '▶', on: 'update' },
		{ configKey: 'treeCollapsedGlyph', attribute: 'tree-collapsed-glyph', converter: toText({ default: '▶' }), default: '▶', on: 'update' },
		// Paste / clipboard
		{ configKey: 'shouldCopyWithHeaders', attribute: 'should-copy-with-headers', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'pasteMode', attribute: 'paste-mode', converter: toEnum(PASTE_MODES, { default: 'skip-non-editable' }), default: 'skip-non-editable', on: 'update' },
		{ configKey: 'shouldValidateOnPaste', attribute: 'should-validate-on-paste', converter: toBool('default-true'), default: true, on: 'update' },
		// Tooltip timing (element-local, not on grid — the bridge's `in this.engine`
		// guard skips them; readers use the config-backed getter)
		{ configKey: 'tooltipShowDelay', attribute: 'tooltip-show-delay', converter: toInt({ min: 0, default: 200 }), default: 200, on: 'update' },
		{ configKey: 'tooltipHideDelay', attribute: 'tooltip-hide-delay', converter: toInt({ min: 0, default: 100 }), default: 100, on: 'update' },
	]

	static events = EVENTS

	// Type-only: core installs the `on<Name>` twins at runtime (§12.5); each is
	// called with the event detail (not the CustomEvent), right before the event.
	declare onRowChange: ((detail: GridEventMap<T>['row-change']) => void) | null
	declare onEditStart: ((detail: GridEventMap<T>['edit-start']) => void) | null
	declare onEditCancel: ((detail: GridEventMap<T>['edit-cancel']) => void) | null
	declare onValidationError: ((detail: GridEventMap<T>['validation-error']) => void) | null
	declare onRowFocus: ((detail: GridEventMap<T>['row-focus']) => void) | null
	declare onRowDelete: ((detail: GridEventMap<T>['row-delete']) => void) | null
	declare onCellSelectionChange: ((detail: GridEventMap<T>['cell-selection-change']) => void) | null
	declare onDataRequest: ((detail: GridEventMap<T>['data-request']) => void) | null
	declare onFilterChange: ((detail: GridEventMap<T>['filter-change']) => void) | null
	declare onColumnResize: ((detail: GridEventMap<T>['column-resize']) => void) | null
	declare onColumnReorder: ((detail: GridEventMap<T>['column-reorder']) => void) | null
	declare onExpandChange: ((detail: GridEventMap<T>['expand-change']) => void) | null
	declare onRowLockChange: ((detail: GridEventMap<T>['row-lock-change']) => void) | null
	declare onPasteComplete: ((detail: GridEventMap<T>['paste-complete']) => void) | null
	declare onAction: ((detail: GridEventMap<T>['action']) => void) | null

	/**
	 * The internal state engine (composition) — module plumbing. Not public API:
	 * use the element's properties / methods or `el.controller`.
	 * @internal
	 */
	readonly engine: GridEngine<T>

	// Shadow DOM root
	readonly shadow: ShadowRoot

	// Style element (for initial CSS injection)
	private styleElement: HTMLStyleElement

	// Custom styles element (for user-provided CSS via getCustomStylesCallback)
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

	// Filter row runtime state — typed text not applied yet + debounce timers.
	filterRow = new FilterRowService()

	/** The filter-row text typed for `field` but not applied yet (survives re-renders). */
	filterInputText(field: string): string | undefined {
		return this.filterRow.pendingText.get(field)
	}

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

	// DatePicker instance (for date editor) - exposed via GridHost for pipeline access
	datepicker: DatePicker | null = null

	// Context menu element (rendered to document.body) - exposed via GridHost for pipeline access
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
		this.engine = new GridEngine<T>()
		// Every ctx / detail carries `controller` + `element`; the engine's
		// notifications become events (emit → `on*` twin + DOM event).
		this.engine.attachHost(this, () => this.controller, (name, detail) => {
			this.emit(name, detail as never)
			// Commits update cells surgically (no full render) — refresh the summary too
			if (name === 'row-change') this.scheduleSummaryRefresh()
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
		// Every state-changing setter on GridEngine funnels through requestUpdate(), so this is
		// the single canonical point to drop cached paginatedItems / displayItems.
		;(this.engine as unknown as { requestUpdate: () => void }).requestUpdate = () => {
			this.engine.invalidateDisplayCache()
			this.requestUpdate()
		}

		// Handle interaction changes (cleanup dropdown when editing is cancelled externally)
		;(this.engine as unknown as { _onInteractionChange: ((type: string, detail: { prev: unknown, current: unknown }) => void) | null })._onInteractionChange = (type, detail) => {
			if (type === 'editingCell' && detail.current === null) {
				// Editing was cancelled - clean up dropdown if open
				removeDropdown(this)
			}
		}
	}

	// ==========================================================================
	// Web Component Lifecycle (core hooks — see BlissElement / core SPEC §6)
	// ==========================================================================
	//
	// BlissElement owns connectedCallback/disconnectedCallback and drives these
	// hooks. `reinit()` runs on first connect (and any on:'reinit' input change —
	// we have none) and seeds the grid from the merged input config. `update()`
	// bridges later attribute/property changes into the grid. `connect()`/
	// `disconnect()` fire on EVERY connect/disconnect (a DOM move re-activates
	// without rebuilding) — they hold the former connected/disconnectedCallback
	// bodies, which are already written to be re-runnable.

	/** Copy the given input-config keys into the composed GridEngine. Grid setters
	 * call requestUpdate() → a coalesced render. The `in` guard skips element-local
	 * inputs (tooltip delays) whose readers use the config getter. `mode` goes
	 * first: the engine's own mode setter applies its preset, and the batch's
	 * values (core already resolved preset vs explicit) must land after it. */
	#applyConfig(cfg: Record<string, unknown>): void {
		const target = this.engine as unknown as Record<string, unknown>
		if ('mode' in cfg) target.mode = cfg.mode
		for (const key of Object.keys(cfg)) {
			if (key !== 'mode' && key in target) target[key] = cfg[key]
		}
	}

	protected reinit(): void {
		// First connect: seed the grid from the merged input config.
		this.#applyConfig(this.config as Record<string, unknown>)
	}

	protected update(partial: Record<string, unknown>): void {
		// Later attribute/property changes: apply just the changed inputs.
		this.#applyConfig(partial)
	}

	protected connect(): void {
		initLogger.debug('connect — grid activated')
		// Load persisted column widths before initial render
		if (this.engine.gridName && this.engine.shouldPersistColumnWidths) {
			this.engine.loadPersistedWidths()
		}
		// Initialize action pipeline adapter for 'always' editTrigger mode
		this.pipelineAdapter = createActionPipelineAdapter(this)
		this.render()
		// Register paste handler for navigate mode
		this.addEventListener('paste', this.handlePaste as EventListener)
	}

	protected disconnect(): void {
		initLogger.debug('disconnect — grid deactivated')
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
	// Public API - Proxy to GridEngine
	// ==========================================================================

	get items(): T[] { return this.engine.items }
	set items(value: T[]) {
		this.engine.items = value
		// Reset infinite scroll loading flag
		this.virtualScroll.setIsLoadingMore(false)
	}

	get columns(): Column<T>[] { return this.engine.columns }
	set columns(value: Column<T>[]) { this.engine.columns = value }

	get isFilterable(): boolean { return this.engine.isFilterable }
	set isFilterable(value: boolean) { this.engine.isFilterable = value }

	/** 'server': the grid doesn't filter `items` — handle `filter-change` and replace `items`. */
	get filterMode(): 'client' | 'server' { return this.engine.filterMode }
	set filterMode(value: 'client' | 'server') { this.engine.filterMode = value }

	get columnMinWidth(): string | undefined { return this.engine.columnMinWidth }
	set columnMinWidth(value: string | undefined) { this.engine.columnMinWidth = value }

	get filters(): Record<string, string> { this.flush(); return this.engine.filters }
	set filters(value: Record<string, string>) { this.engine.filters = value }
	setFilter(field: string, value: string): void { this.flush(); this.engine.setFilter(field, value) }

	get isPageable(): boolean { return this.engine.isPageable }
	set isPageable(value: boolean) { this.engine.isPageable = value }

	get pageSize(): number { return this.engine.pageSize }
	set pageSize(value: number) { this.engine.pageSize = value }

	get pageSizes(): number[] { return this.engine.pageSizes }
	set pageSizes(value: number[]) { this.engine.pageSizes = value }

	get paginationMode(): 'client' | 'server' { return this.engine.paginationMode }
	set paginationMode(value: 'client' | 'server') { this.engine.paginationMode = value }

	get isStriped(): boolean { return this.engine.isStriped }
	set isStriped(value: boolean) { this.engine.isStriped = value }

	get isHoverable(): boolean { return this.engine.isHoverable }
	set isHoverable(value: boolean) { this.engine.isHoverable = value }

	get isEditable(): boolean { return this.engine.isEditable }
	set isEditable(value: boolean) { this.engine.isEditable = value }

	get isRowEditable(): boolean | undefined { return this.engine.isRowEditable }
	set isRowEditable(value: boolean | undefined) { this.engine.isRowEditable = value }

	get getIsRowEditableCallback(): ((ctx: RowDataContext<T>) => boolean) | undefined { return this.engine.getIsRowEditableCallback }
	set getIsRowEditableCallback(value: ((ctx: RowDataContext<T>) => boolean) | undefined) { this.engine.getIsRowEditableCallback = value }

	get editTrigger(): EditTrigger { return this.engine.editTrigger }
	set editTrigger(value: EditTrigger) { this.engine.editTrigger = value }

	/**
	 * The edit button's content — an HTML string (default `✎`), e.g. an icon font /
	 * sprite: `'<span class="lucide-pencil"></span>'`. Shown in editable cells with
	 * `editTrigger: 'button'` (or `column.isEditButtonVisible`); its accessible name is
	 * `labels.editCell`.
	 */
	get editButtonIcon(): string { return this.engine.editButtonIcon }
	set editButtonIcon(value: string) { this.engine.editButtonIcon = value }

	get editStartSelection(): EditStartSelection { return this.engine.editStartSelection }
	set editStartSelection(value: EditStartSelection) { this.engine.editStartSelection = value }

	get shouldCommitOnClickAway(): boolean { return this.engine.shouldCommitOnClickAway }
	set shouldCommitOnClickAway(value: boolean) { this.engine.shouldCommitOnClickAway = value }

	get mode(): GridMode { return this.engine.mode }
	set mode(value: GridMode) { this.engine.mode = value }

	get dropdownToggleVisibility(): ToggleVisibility { return this.engine.dropdownToggleVisibility }
	set dropdownToggleVisibility(value: ToggleVisibility) { this.engine.dropdownToggleVisibility = value }

	get shouldShowDropdownOnFocus(): boolean { return this.engine.shouldShowDropdownOnFocus }
	set shouldShowDropdownOnFocus(value: boolean) { this.engine.shouldShowDropdownOnFocus = value }

	get shouldOpenDropdownOnEnter(): boolean { return this.engine.shouldOpenDropdownOnEnter }
	set shouldOpenDropdownOnEnter(value: boolean) { this.engine.shouldOpenDropdownOnEnter = value }

	get isCheckboxAlwaysEditable(): boolean { return this.engine.isCheckboxAlwaysEditable }
	set isCheckboxAlwaysEditable(value: boolean) { this.engine.isCheckboxAlwaysEditable = value }

	get isRowNumbersVisible(): boolean { return this.engine.isRowNumbersVisible }
	set isRowNumbersVisible(value: boolean) { this.engine.isRowNumbersVisible = value }

	get isDirtyIndicatorVisible(): boolean { return this.engine.isDirtyIndicatorVisible }
	set isDirtyIndicatorVisible(value: boolean) { this.engine.isDirtyIndicatorVisible = value }

	isCellDirty(rowIndex: number, field: string): boolean { this.flush(); return this.engine.isCellDirty(rowIndex, field) }
	isRowDirty(rowIndex: number): boolean { this.flush(); return this.engine.isRowDirty(rowIndex) }

	get isStickyRowNumbers(): boolean { return this.engine.isStickyRowNumbers }
	set isStickyRowNumbers(value: boolean) { this.engine.isStickyRowNumbers = value }

	get freezeColumns(): number { return this.engine.freezeColumns }
	set freezeColumns(value: number) { this.engine.freezeColumns = value }

	get invalidCells(): CellValidationState[] { return this.engine.invalidCells }
	set invalidCells(value: CellValidationState[]) { this.engine.invalidCells = value }

	get isRowToolbarVisible(): boolean { return this.engine.isRowToolbarVisible }
	set isRowToolbarVisible(value: boolean) { this.engine.isRowToolbarVisible = value }

	get rowToolbar(): GridToolbarEntry<T>[] { return this.engine.rowToolbar }
	set rowToolbar(value: GridToolbarEntry<T>[]) { this.engine.rowToolbar = value }

	get toolbarVerticalAlign(): 'top' | 'center' | 'bottom' { return this.engine.toolbarVerticalAlign }
	set toolbarVerticalAlign(value: 'top' | 'center' | 'bottom') { this.engine.toolbarVerticalAlign = value }

	get toolbarHorizontalAlign(): 'start' | 'center' | 'end' | 'cursor' { return this.engine.toolbarHorizontalAlign }
	set toolbarHorizontalAlign(value: 'start' | 'center' | 'end' | 'cursor') { this.engine.toolbarHorizontalAlign = value }

	// Deprecated aliases
	get toolbarAlign(): 'top' | 'center' | 'bottom' { return this.toolbarVerticalAlign }
	set toolbarAlign(value: 'top' | 'center' | 'bottom') { this.toolbarVerticalAlign = value }

	get toolbarTopPosition(): 'start' | 'center' | 'end' | 'cursor' { return this.toolbarHorizontalAlign }
	set toolbarTopPosition(value: 'start' | 'center' | 'end' | 'cursor') { this.toolbarHorizontalAlign = value }

	get toolbarTrigger(): 'hover' | 'click' | 'button' { return this.engine.toolbarTrigger }
	set toolbarTrigger(value: 'hover' | 'click' | 'button') { this.engine.toolbarTrigger = value }

	get toolbarPosition(): ToolbarPosition { return this.engine.toolbarPosition }
	set toolbarPosition(value: ToolbarPosition) { this.engine.toolbarPosition = value }

	get toolbarColumn(): string | number | undefined { return this.engine.toolbarColumn }
	set toolbarColumn(value: string | number | undefined) { this.engine.toolbarColumn = value }

	get shouldToolbarFollowCursor(): boolean { return this.engine.shouldToolbarFollowCursor }
	set shouldToolbarFollowCursor(value: boolean) { this.engine.shouldToolbarFollowCursor = value }

	/** @deprecated use `shouldToolbarFollowCursor` */
	get toolbarFollowsCursor(): boolean { return this.shouldToolbarFollowCursor }
	/** @deprecated use `shouldToolbarFollowCursor` */
	set toolbarFollowsCursor(value: boolean) { this.shouldToolbarFollowCursor = value }

	get getCellToolbarItemsCallback(): ((ctx: CellContext<T>) => GridToolbarEntry<T>[] | null | undefined) | undefined {
		return this.engine.getCellToolbarItemsCallback
	}
	set getCellToolbarItemsCallback(value: ((ctx: CellContext<T>) => GridToolbarEntry<T>[] | null | undefined) | undefined) {
		this.engine.getCellToolbarItemsCallback = value
	}

	get cellToolbarOffset(): number | string { return this.engine.cellToolbarOffset }
	set cellToolbarOffset(value: number | string) { this.engine.cellToolbarOffset = value }

	get toolbarBtnMinWidth(): string | undefined { return this.engine.toolbarBtnMinWidth }
	set toolbarBtnMinWidth(value: string | undefined) { this.engine.toolbarBtnMinWidth = value }

	/** Inline actions column header. Absent / `null` → `labels.inlineActionsHeader`; `''` → blank (narrow one-action columns). */
	get inlineActionsTitle(): string | null | undefined { return this.engine.inlineActionsTitle }
	set inlineActionsTitle(value: string | null | undefined) { this.engine.inlineActionsTitle = value }

	get contextMenu(): GridMenuEntry<T>[] | undefined { return this.engine.contextMenu }
	set contextMenu(value: GridMenuEntry<T>[] | undefined) { this.engine.contextMenu = value }

	get contextMenuXOffset(): number { return this.engine.contextMenuXOffset }
	set contextMenuXOffset(value: number) { this.engine.contextMenuXOffset = value }

	get contextMenuYOffset(): number { return this.engine.contextMenuYOffset }
	set contextMenuYOffset(value: number) { this.engine.contextMenuYOffset = value }

	// Header context menu
	get headerContextMenu(): GridHeaderMenuEntry<T>[] | undefined { return this.engine.headerContextMenu }
	set headerContextMenu(value: GridHeaderMenuEntry<T>[] | undefined) { this.engine.headerContextMenu = value }

	/** Before the cell menu opens (sync): `false` → no grid menu; an entries array → shown instead. */
	get beforeContextMenuOpenCallback(): ((ctx: CellContext<T>) => false | GridMenuEntry<T>[] | void) | undefined { return this.engine.beforeContextMenuOpenCallback }
	set beforeContextMenuOpenCallback(value: ((ctx: CellContext<T>) => false | GridMenuEntry<T>[] | void) | undefined) { this.engine.beforeContextMenuOpenCallback = value }

	/** Before the header menu opens (sync): `false` → no grid menu; an entries array → shown instead. */
	get beforeHeaderMenuOpenCallback(): ((ctx: HeaderMenuContext<T>) => false | GridHeaderMenuEntry<T>[] | void) | undefined { return this.engine.beforeHeaderMenuOpenCallback }
	set beforeHeaderMenuOpenCallback(value: ((ctx: HeaderMenuContext<T>) => false | GridHeaderMenuEntry<T>[] | void) | undefined) { this.engine.beforeHeaderMenuOpenCallback = value }

	/** Before any toolbar / menu / shortcut item activates: `false` cancels (async OK). */
	get beforeActionCallback(): ((detail: GridActionEventDetail<T>) => unknown) | undefined { return this.engine.beforeActionCallback }
	set beforeActionCallback(value: ((detail: GridActionEventDetail<T>) => unknown) | undefined) { this.engine.beforeActionCallback = value }

	// Row keyboard shortcuts
	get rowShortcuts(): GridShortcut<T>[] | undefined { return this.engine.rowShortcuts }
	set rowShortcuts(value: GridShortcut<T>[] | undefined) { this.engine.rowShortcuts = value }

	// Range shortcuts (selected rows / cell range)
	get rangeShortcuts(): GridRangeShortcut<T>[] { return this.engine.rangeShortcuts }
	set rangeShortcuts(value: GridRangeShortcut<T>[]) { this.engine.rangeShortcuts = value }

	// Row selection
	get selectedRows(): number[] { this.flush(); return this.engine.selectedRows }
	selectRow(rowIndex: number, mode: 'replace' | 'toggle' | 'range' = 'replace'): void { this.flush(); this.engine.selectRow(rowIndex, mode) }
	selectRowRange(fromIndex: number, toIndex: number): void { this.flush(); this.engine.selectRowRange(fromIndex, toIndex) }
	clearSelection(): void { this.flush(); this.engine.clearSelection() }
	isRowSelected(rowIndex: number): boolean { this.flush(); return this.engine.isRowSelected(rowIndex) }
	getSelectedRowsData(): T[] { this.flush(); return this.engine.getSelectedRowsData() }
	copySelectedRowsToClipboard(): Promise<boolean> { this.flush(); return this.engine.copySelectedRowsToClipboard() }

	// Cell range selection
	get cellSelectionMode() { return this.engine.cellSelectionMode }
	set cellSelectionMode(value) { this.engine.cellSelectionMode = value }

	get selectedCellRange() { return this.engine.selectedCellRange }
	selectCellRange(range: any): void { this.flush(); this.engine.selectCellRange(range) }
	clearCellSelection(): void { this.flush(); this.engine.clearCellSelection() }
	getSelectedCells() { this.flush(); return this.engine.getSelectedCells() }
	copyCellSelectionToClipboard(): Promise<boolean> { this.flush(); return this.engine.copyCellSelectionToClipboard() }

	get shouldCopyWithHeaders(): boolean { return this.engine.shouldCopyWithHeaders }
	set shouldCopyWithHeaders(value: boolean) { this.engine.shouldCopyWithHeaders = value }

	// New empty row (inline data entry) — EXPERIMENTAL: API may change
	get isNewRowEnabled(): boolean { return this.engine.isNewRowEnabled }
	set isNewRowEnabled(value: boolean) { this.engine.isNewRowEnabled = value }

	get newRowPosition() { return this.engine.newRowPosition }
	set newRowPosition(value) { this.engine.newRowPosition = value }

	get newRowIndicator(): string { return this.engine.newRowIndicator }
	set newRowIndicator(value: string) { this.engine.newRowIndicator = value }

	get createEmptyRowCallback() { return this.engine.createEmptyRowCallback }
	set createEmptyRowCallback(value) { this.engine.createEmptyRowCallback = value }

	/** The copy the `duplicate` built-in inserts (default: shallow copy, `idMember` cleared). */
	get createDuplicateRowCallback(): ((ctx: RowContext<T>) => T) | undefined { return this.engine.createDuplicateRowCallback }
	set createDuplicateRowCallback(value: ((ctx: RowContext<T>) => T) | undefined) { this.engine.createDuplicateRowCallback = value }

	/**
	 * Field that uniquely identifies a row (default `'id'`; `null` = none). The only row-id
	 * member: drafts, invalid-cell markers, `getRowId` / `findRowById` / `updateRowById` /
	 * `replaceRowById` / `lockRowById` use it (`getIdCallback` wins when set).
	 */
	get idMember(): string | null { return this.engine.idMember }
	set idMember(value: string | null) { this.engine.idMember = value }

	// Tree / hierarchy
	get treePathMember(): string | null { return this.engine.treePathMember }
	set treePathMember(value: string | null) { this.engine.treePathMember = value }

	get treeLevelMember(): string | null { return this.engine.treeLevelMember }
	set treeLevelMember(value: string | null) { this.engine.treeLevelMember = value }

	get treeParentMember(): string | null { return this.engine.treeParentMember }
	set treeParentMember(value: string | null) { this.engine.treeParentMember = value }

	get treeSeparator(): string | null { return this.engine.treeSeparator }
	set treeSeparator(value: string | null) { this.engine.treeSeparator = value }

	get treeDataSorted(): boolean { return this.engine.treeDataSorted }
	set treeDataSorted(value: boolean) { this.engine.treeDataSorted = value }

	get expandedPaths(): Set<string> { return this.engine.expandedPaths }
	set expandedPaths(value: Set<string> | null | undefined) { this.engine.expandedPaths = value as Set<string> }

	get defaultExpandDepth(): number | null { return this.engine.defaultExpandDepth }
	set defaultExpandDepth(value: number | null) { this.engine.defaultExpandDepth = value }

	isPathExpanded(path: string): boolean { this.flush(); return this.engine.isPathExpanded(path) }
	toggleExpandedPath(path: string): void { this.flush(); this.engine.toggleExpandedPath(path) }
	expandAll(): void { this.flush(); this.engine.expandAll() }
	collapseAll(): void { this.flush(); this.engine.collapseAll() }

	get treeDoubleClickBehavior(): import('./types.js').TreeDoubleClickBehavior { return this.engine.treeDoubleClickBehavior }
	set treeDoubleClickBehavior(value: import('./types.js').TreeDoubleClickBehavior) { this.engine.treeDoubleClickBehavior = value }

	get treeExpandedGlyph(): string { return this.engine.treeExpandedGlyph }
	set treeExpandedGlyph(value: string) { this.engine.treeExpandedGlyph = value }

	get treeCollapsedGlyph(): string { return this.engine.treeCollapsedGlyph }
	set treeCollapsedGlyph(value: string) { this.engine.treeCollapsedGlyph = value }

	get renderChevronCallback(): ChevronCallback<T> | undefined { return this.engine.renderChevronCallback }
	set renderChevronCallback(value: ChevronCallback<T> | undefined) { this.engine.renderChevronCallback = value }

	get isShortcutsHelpVisible(): boolean { return this.engine.isShortcutsHelpVisible }
	set isShortcutsHelpVisible(value: boolean) { this.engine.isShortcutsHelpVisible = value }

	get shortcutsHelpPosition(): 'top-right' | 'top-left' { return this.engine.shortcutsHelpPosition }
	set shortcutsHelpPosition(value: 'top-right' | 'top-left') { this.engine.shortcutsHelpPosition = value }

	get renderShortcutsHelpCallback(): ((ctx: GridCallbackContext<T>) => string) | undefined { return this.engine.renderShortcutsHelpCallback }
	set renderShortcutsHelpCallback(value: ((ctx: GridCallbackContext<T>) => string) | undefined) { this.engine.renderShortcutsHelpCallback = value }

	get getValidationTooltipCallback(): ((ctx: ValidationTooltipContext<T>) => string | null) | undefined {
		return this.engine.getValidationTooltipCallback
	}
	set getValidationTooltipCallback(value: ((ctx: ValidationTooltipContext<T>) => string | null) | undefined) {
		this.engine.getValidationTooltipCallback = value
	}

	get focusedRowIndex(): number | null { return this.engine.focusedRowIndex }
	set focusedRowIndex(value: number | null) { this.engine.focusedRowIndex = value }

	// Sorting & Pagination
	get sort(): SortState[] { return this.engine.sort }
	set sort(value: SortState[]) { this.engine.sort = value }

	get sortMode(): SortMode { return this.engine.sortMode }
	set sortMode(value: SortMode) { this.engine.sortMode = value }

	get currentPage(): number { return this.engine.currentPage }
	set currentPage(value: number) { this.engine.currentPage = value }

	get totalItems(): number | null { return this.engine.totalItems }
	set totalItems(value: number | null) { this.engine.totalItems = value }

	get isPaginationVisible(): boolean | 'auto' { return this.engine.isPaginationVisible }
	set isPaginationVisible(value: boolean | 'auto') { this.engine.isPaginationVisible = value }

	/** @deprecated use `isPaginationVisible` */
	get showPagination(): boolean | 'auto' { return this.isPaginationVisible }
	/** @deprecated use `isPaginationVisible` */
	set showPagination(value: boolean | 'auto') { this.isPaginationVisible = value }

	get paginationPosition(): string { return this.engine.paginationPosition }
	set paginationPosition(value: string) { this.engine.paginationPosition = value }

	get getPaginationLabelsCallback(): PaginationLabelsCallback<T> | undefined { return this.engine.getPaginationLabelsCallback }
	set getPaginationLabelsCallback(value: PaginationLabelsCallback<T> | undefined) { this.engine.getPaginationLabelsCallback = value }

	get paginationLayout(): string { return this.engine.paginationLayout }
	set paginationLayout(value: string) { this.engine.paginationLayout = value }

	get summaryPosition(): string | undefined { return this.engine.summaryPosition }
	set summaryPosition(value: string | undefined) { this.engine.summaryPosition = value }

	get renderSummaryCallback(): SummaryCallback<T> | undefined { return this.engine.renderSummaryCallback }
	set renderSummaryCallback(value: SummaryCallback<T> | undefined) { this.engine.renderSummaryCallback = value }

	get getCustomStylesCallback(): ((ctx: GridCallbackContext<T>) => string) | undefined { return this.engine.getCustomStylesCallback }
	set getCustomStylesCallback(value: ((ctx: GridCallbackContext<T>) => string) | undefined) {
		this.engine.getCustomStylesCallback = value
		this.updateCustomStyles()
	}

	get getRowClassCallback(): ((ctx: RowContext<T>) => string | null) | undefined { return this.engine.getRowClassCallback }
	set getRowClassCallback(value: ((ctx: RowContext<T>) => string | null) | undefined) { this.engine.getRowClassCallback = value }

	get labels(): GridLabels { return this.engine.labels }
	set labels(value: GridLabelsInput) { this.engine.labels = value }

	get summaryMetadata(): unknown { return this.engine.summaryMetadata }
	set summaryMetadata(value: unknown) { this.engine.summaryMetadata = value }

	get isSummaryInline(): boolean { return this.engine.isSummaryInline }
	set isSummaryInline(value: boolean) { this.engine.isSummaryInline = value }

	// Row identification (`idMember` above; this is its computed twin)
	/** The row's id when `idMember` can't express it (`{ row }` → id). Wins over `idMember`. */
	get getIdCallback(): ((ctx: RowDataContext<T>) => unknown) | undefined { return this.engine.getIdCallback }
	set getIdCallback(value: ((ctx: RowDataContext<T>) => unknown) | undefined) { this.engine.getIdCallback = value }

	// Row locking
	get rowLocking(): RowLockingOptions<T> | undefined { return this.engine.rowLocking }
	set rowLocking(value: RowLockingOptions<T> | undefined) { this.engine.rowLocking = value }

	// Column resize & persistence
	get gridName(): string | null { return this.engine.gridName }
	set gridName(value: string | null) {
		this.engine.gridName = value
		// Load persisted widths if both gridName and persistColumnWidths are set
		this.tryLoadPersistedWidths()
	}

	get shouldPersistColumnWidths(): boolean { return this.engine.shouldPersistColumnWidths }
	set shouldPersistColumnWidths(value: boolean) {
		this.engine.shouldPersistColumnWidths = value
		this.tryLoadPersistedState()
	}

	get isColumnReorderAllowed(): boolean { return this.engine.isColumnReorderAllowed }
	set isColumnReorderAllowed(value: boolean) { this.engine.isColumnReorderAllowed = value }

	get shouldPersistColumnOrder(): boolean { return this.engine.shouldPersistColumnOrder }
	set shouldPersistColumnOrder(value: boolean) {
		this.engine.shouldPersistColumnOrder = value
		this.tryLoadPersistedState()
	}

	/**
	 * Try to load persisted state (widths/order) if conditions are met
	 */
	private tryLoadPersistedState(): void {
		if (this.engine.gridName && (this.engine.shouldPersistColumnWidths || this.engine.shouldPersistColumnOrder)) {
			this.engine.loadPersistedState()
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

	// Fill handle: `false` cancels the fill (async OK)
	/**
	 * Runs before a user action swaps the displayed rows — pager buttons, page-size change,
	 * header sort and filter-row changes in server mode (`ctx.trigger`: `'page'` / `'pageSize'` /
	 * `'sort'` / `'filter'`; `fromPage`, `toPage`, `drafts`). `false` → stay; a number → go to
	 * that page instead; may be async (the pager is disabled meanwhile). Programmatic
	 * `currentPage` writes and infinite-scroll `loadMore` skip it.
	 */
	get beforePageChangeCallback(): ((ctx: BeforePageChangeContext<T>) => boolean | number | void | Promise<boolean | number | void>) | undefined { return this.engine.beforePageChangeCallback }
	set beforePageChangeCallback(value: ((ctx: BeforePageChangeContext<T>) => boolean | number | void | Promise<boolean | number | void>) | undefined) { this.engine.beforePageChangeCallback = value }

	get beforeFillCallback(): ((ctx: FillContext<T>) => boolean | void | Promise<boolean | void>) | undefined { return this.engine.beforeFillCallback }
	set beforeFillCallback(value: ((ctx: FillContext<T>) => boolean | void | Promise<boolean | void>) | undefined) { this.engine.beforeFillCallback = value }

	// Scroll behavior
	get isScrollable(): boolean { return this.engine.isScrollable }
	set isScrollable(value: boolean) { this.engine.isScrollable = value }

	get scrollMaxHeight(): string { return this.engine.scrollMaxHeight }
	set scrollMaxHeight(value: string) { this.engine.scrollMaxHeight = value }

	get isTableBorderOnly(): boolean { return this.engine.isTableBorderOnly }
	set isTableBorderOnly(value: boolean) { this.engine.isTableBorderOnly = value }

	/** @deprecated use `isTableBorderOnly` */
	get tableBorderOnly(): boolean { return this.isTableBorderOnly }
	/** @deprecated use `isTableBorderOnly` */
	set tableBorderOnly(value: boolean) { this.isTableBorderOnly = value }

	// Virtual scroll
	get isVirtualScrollEnabled(): boolean { return this.engine.isVirtualScrollEnabled }
	set isVirtualScrollEnabled(value: boolean) { this.engine.isVirtualScrollEnabled = value }

	get virtualScrollThreshold(): number { return this.engine.virtualScrollThreshold }
	set virtualScrollThreshold(value: number) { this.engine.virtualScrollThreshold = value }

	get virtualScrollRowHeight(): number { return this.engine.virtualScrollRowHeight }
	set virtualScrollRowHeight(value: number) { this.engine.virtualScrollRowHeight = value }

	get virtualScrollBuffer(): number { return this.engine.virtualScrollBuffer }
	set virtualScrollBuffer(value: number) { this.engine.virtualScrollBuffer = value }

	// Infinite scroll
	get isInfiniteScrollEnabled(): boolean { return this.engine.isInfiniteScrollEnabled }
	set isInfiniteScrollEnabled(value: boolean) { this.engine.isInfiniteScrollEnabled = value }

	get infiniteScrollThreshold(): number { return this.engine.infiniteScrollThreshold }
	set infiniteScrollThreshold(value: number) { this.engine.infiniteScrollThreshold = value }

	get hasMoreItems(): boolean { return this.engine.hasMoreItems }
	set hasMoreItems(value: boolean) { this.engine.hasMoreItems = value }

	// Paste
	/** Before a multi-cell paste: `false` cancels; add "row-col" keys to `ctx.skipCells` to skip cells (async OK). */
	get beforePasteCallback(): ((ctx: BeforePasteContext<T>) => boolean | void | Promise<boolean | void>) | undefined { return this.engine.beforePasteCallback }
	set beforePasteCallback(value: ((ctx: BeforePasteContext<T>) => boolean | void | Promise<boolean | void>) | undefined) { this.engine.beforePasteCallback = value }

	/** New row for pasted data past the last row. */
	get createRowCallback(): CreateRowCallback<T> | undefined { return this.engine.createRowCallback }
	set createRowCallback(value: CreateRowCallback<T> | undefined) { this.engine.createRowCallback = value }

	get pasteMode(): PasteMode { return this.engine.pasteMode }
	set pasteMode(value: PasteMode) { this.engine.pasteMode = value }

	get shouldValidateOnPaste(): boolean { return this.engine.shouldValidateOnPaste }
	set shouldValidateOnPaste(value: boolean) { this.engine.shouldValidateOnPaste = value }

	// Computed properties
	get displayItems(): T[] { this.flush(); return this.engine.displayItems }
	get totalPages(): number { this.flush(); return this.engine.totalPages }
	get isNavigateMode(): boolean { this.flush(); return this.engine.isNavigateMode }

	// Draft row methods
	getRowDraft(rowIndex: number): T | undefined { this.flush(); return this.engine.getRowDraft(rowIndex) }
	hasRowDraft(rowIndex: number): boolean { this.flush(); return this.engine.hasRowDraft(rowIndex) }
	discardRowDraft(rowIndex: number): void { this.flush(); this.engine.discardRowDraft(rowIndex) }
	getDraftRowIndices(): number[] { this.flush(); return this.engine.getDraftRowIndices() }
	/**
	 * Every unsaved draft `{ row, draftRow, changedFields, isValid }` — incl. rows on other
	 * pages, filtered out, or not in the current `items` (drafts are never pruned; they
	 * leave via `replaceRowById`, `discardDraft`, `discardRowDraft`, `discardAllDrafts`).
	 */
	getDrafts(): DraftInfo<T>[] { this.flush(); return this.engine.getDrafts() }
	/** Drop the draft (and invalid-cell markers) of `row` — the row object, its id-equal copy, or the draft. */
	discardDraft(row: T): void { this.flush(); this.engine.discardDraft(row) }
	discardAllDrafts(): void { this.flush(); this.engine.discardAllDrafts() }

	// Validation methods
	isCellInvalid(rowIndex: number, field: string): boolean { this.flush(); return this.engine.isCellInvalid(rowIndex, field) }
	getCellValidationError(rowIndex: number, field: string): string | null { this.flush(); return this.engine.getCellValidationError(rowIndex, field) }

	// Row identification methods
	getRowId(row: T): unknown | undefined { this.flush(); return this.engine.getRowId(row) }
	findRowById(id: unknown): { row: T; index: number } | null { this.flush(); return this.engine.findRowById(id) }

	// Row locking methods
	isRowLocked(rowOrId: T | unknown): boolean { this.flush(); return this.engine.isRowLocked(rowOrId) }
	getRowLockInfo(rowOrId: T | unknown): RowLock | null { this.flush(); return this.engine.getRowLockInfo(rowOrId) }
	lockRowById(id: unknown, lockerInfo?: Partial<RowLock>): boolean { this.flush(); return this.engine.lockRowById(id, lockerInfo) }
	unlockRowById(id: unknown): boolean { this.flush(); return this.engine.unlockRowById(id) }
	getExternalLocks(): Map<unknown, RowLock> { this.flush(); return this.engine.getExternalLocks() }
	clearExternalLocks(): void { this.flush(); this.engine.clearExternalLocks() }

	// Row update methods (for WebSocket/external updates)
	updateRowById(id: unknown, newData: Partial<T>): boolean { this.flush(); return this.engine.updateRowById(id, newData) }
	replaceRowById(id: unknown, newRow: T): boolean { this.flush(); return this.engine.replaceRowById(id, newRow) }

	// Edit permission check
	canEditCell(rowIndex: number, field: string): boolean { this.flush(); return this.engine.canEditCell(rowIndex, field) }

	// Column width methods
	setColumnWidth(field: string, width: string): void { this.flush(); this.engine.setColumnWidth(field, width) }
	setColumnWidths(widths: ColumnWidthState[]): void { this.flush(); this.engine.setColumnWidths(widths) }
	getColumnWidthsState(): ColumnWidthState[] { this.flush(); return this.engine.getColumnWidthsState() }

	// Column order methods
	setColumnOrder(order: ColumnOrderState[]): void { this.flush(); this.engine.setColumnOrder(order) }
	getColumnOrderState(): ColumnOrderState[] { this.flush(); return this.engine.getColumnOrderState() }

	// Public methods for focus and editing
	/**
	 * Programmatically focus a cell. Updates state and focuses the DOM element.
	 * State is updated immediately so pending renders use the correct position.
	 */
	focusCell(rowIndex: number, colIndex: number): void {
		this.flush()
		const columns = this.engine.columns
		const displayItems = this.engine.displayItems
		if (rowIndex < 0 || rowIndex >= displayItems.length) return
		if (colIndex < 0 || colIndex >= columns.length) return

		// Update state immediately so any pending render uses the correct position
		this.engine.setFocusedCell(rowIndex, colIndex)

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
		this.flush()
		const columns = this.engine.columns
		if (colIndex < 0 || colIndex >= columns.length) return

		const column = columns[colIndex]
		const field = String(column.field)

		// Update state (no longer triggers requestUpdate)
		this.engine.startEdit(rowIndex, field)
		// The engine refuses read-only / locked cells — render an editor only when it started
		const editing = this.engine.editingCell
		if (!editing || editing.rowIndex !== rowIndex || editing.field !== field) return

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
	// GridHost Implementation - Required by module functions
	// ==========================================================================

	/**
	 * Escape for HTML text AND attribute values (`& < > " '`). Every attribute
	 * interpolation (`data-tooltip="…"`, editor `value="…"`, …) goes through this,
	 * so row data can't close the attribute and inject new ones.
	 */
	escapeHtml(text: string): string {
		if (text == null) return ''
		return String(text)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
	}

	getCurrentEditingColumn(): Column<T> | null {
		const editingCell = this.engine.editingCell
		if (!editingCell) return null
		return this.engine.columns.find(c => String(c.field) === editingCell.field) || null
	}

	getCurrentEditorOptions(): EditorOptions<T> {
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

	private isSummaryRefreshPending = false

	/** Re-render the summary blocks (once per microtask burst) without a full render. */
	private scheduleSummaryRefresh(): void {
		if (!this.engine.renderSummaryCallback || this.isSummaryRefreshPending) return
		this.isSummaryRefreshPending = true
		queueMicrotask(() => {
			this.isSummaryRefreshPending = false
			if (this.updatePending) return  // a full render is queued — it renders the summary
			const blocks = this.shadow.querySelectorAll('.wg__summary')
			if (blocks.length === 0) return
			const content = renderSummaryContent(this)
			blocks.forEach(block => { block.innerHTML = content })
		})
	}

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
	 * Update custom styles in shadow DOM from getCustomStylesCallback
	 */
	private updateCustomStyles(): void {
		const callback = this.engine.getCustomStylesCallback
		if (callback) {
			const css = callback(this.engine.ctx({}))
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

		// Focus — capture-phase, drives handleCellFocus + always-edit-mode swap + row-focus (keyboard only)
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
		const scrollContainer = this.engine.isTableBorderOnly
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
			// Filter row (delegated too — the thead is rebuilt on every render)
			attachFilterRowListeners(this, wgContainer)
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
			rowHeight: this.engine.virtualScrollRowHeight,
			buffer: this.engine.virtualScrollBuffer,
			totalItems: this.engine.displayItems.length,
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

	/** Shortcuts help icon + overlay — see modules/rendering/shortcuts-help.ts */
	private renderShortcutsHelpIcon(): string {
		return renderShortcutsHelpIconModule(this)
	}

	render(): void {
		// Drop any stale data-pipeline cache. Normally requestUpdate() has already
		// done this, but render() is also called directly in a few places.
		this.engine.invalidateDisplayCache()
		gridPerf.reset()
		const __renderStartT = performance.now()
		uiLogger.debug('render:', this.engine.displayItems.length, 'rows,', this.engine.visualColumns.length, 'columns')
		// Preserve scroll position before re-render
		// When isTableBorderOnly is enabled, scroll container is .wg__table-container
		const oldContainer = this.shadow.querySelector('.wg') as HTMLElement
		// A focused filter-row input (+ caret) is restored after the thead is rebuilt
		const filterFocus = captureFilterFocus(this)
		const oldScrollContainer = this.engine.isTableBorderOnly
			? (this.shadow.querySelector('.wg__table-container') as HTMLElement) || oldContainer
			: oldContainer
		const scrollTop = oldScrollContainer?.scrollTop || 0
		const scrollLeft = oldScrollContainer?.scrollLeft || 0

		// Preserve focused cell position (for restoring after re-render)
		const focusedCell = this.engine.focusedCell

		// Parse pagination positions (e.g., "bottom-center" or "top-right|bottom-right")
		const paginationPositions = this.engine.paginationPosition.split('|').map(p => p.trim())

		// Parse summary positions (if set)
		const summaryPositions = this.engine.summaryPosition
			? this.engine.summaryPosition.split('|').map(p => p.trim())
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
			if (areaHasSummary && areaHasPagination && this.engine.isSummaryInline) {
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
		const useVirtualScroll = this.engine.shouldUseVirtualScroll()

		// Get data rows HTML (virtual or normal)
		let dataRowsHtml: string
		if (useVirtualScroll) {
			// Calculate virtual scroll params
			const items = this.engine.displayItems
			const rowHeight = this.engine.virtualScrollRowHeight
			const buffer = this.engine.virtualScrollBuffer

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
		const wantsTableContainer = !!this.engine.isTableBorderOnly
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

			if (this.engine.isScrollable && this.engine.scrollMaxHeight !== '100vh') {
				container.style.setProperty('--wg-scroll-max-height', this.engine.scrollMaxHeight)
			} else {
				container.style.removeProperty('--wg-scroll-max-height')
			}

			existingTopArea!.innerHTML = `${shortcutsHelpHtml}${topContent}`
			existingThead!.innerHTML = headerRowHtml
			existingTbody!.innerHTML = dataRowsHtml
			existingBottomArea!.innerHTML = bottomContent

			// Virtual scroll may have changed visible window — clamp scrollTop if it's now out of range
			if (useVirtualScroll) {
				const sc = this.engine.isTableBorderOnly
					? (container.querySelector('.wg__table-container') as HTMLElement) || container
					: container
				const maxScrollTop = Math.max(0, this.engine.displayItems.length * this.engine.virtualScrollRowHeight - sc.clientHeight)
				if (sc.scrollTop > maxScrollTop) sc.scrollTop = maxScrollTop
			}
		} else {
			// Full rebuild path: first render, or structure changed (isTableBorderOnly toggled).
			if (oldContainer) oldContainer.remove()

			container = document.createElement('div')
			container.className = getContainerClasses(this)
			if (useVirtualScroll) container.classList.add('wg--virtual-scroll')

			if (this.engine.isScrollable && this.engine.scrollMaxHeight !== '100vh') {
				container.style.setProperty('--wg-scroll-max-height', this.engine.scrollMaxHeight)
			}

			const tableCore = `
				<table class="wg__table">
					<thead>${headerRowHtml}</thead>
					<tbody>${dataRowsHtml}</tbody>
				</table>
			`
			const tableWithContainer = this.engine.isTableBorderOnly
				? `<div class="wg__table-container">${tableCore}</div>`
				: tableCore

			container.innerHTML = `
				<div class="wg__top-area">${shortcutsHelpHtml}${topContent}</div>
				${tableWithContainer}
				<div class="wg__bottom-area">${bottomContent}</div>
			`

			this.shadow.appendChild(container)

			// Restore scroll position (only needed when container was replaced)
			const scrollContainer = this.engine.isTableBorderOnly
				? (container.querySelector('.wg__table-container') as HTMLElement) || container
				: container

			if (useVirtualScroll) {
				const maxScrollTop = Math.max(0, this.engine.displayItems.length * this.engine.virtualScrollRowHeight - scrollContainer.clientHeight)
				scrollContainer.scrollTop = Math.min(scrollTop, maxScrollTop)
			} else {
				scrollContainer.scrollTop = scrollTop
			}
			scrollContainer.scrollLeft = scrollLeft

			// Wire up event listeners (only on full rebuild — surgical path keeps them alive)
			this.attachEventListeners()
		}

		// Post-render focus restore (editor focus + selection / focused-cell restore)
		// Extracted to modules/navigation/post-render-focus.ts
		// (a focused filter-row input keeps the focus — the cell isn't re-focused)
		restoreFocusAfterRender(this, container, filterFocus ? null : focusedCell)
		restoreFilterFocus(this, filterFocus)
		positionFilterRow(this)

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
		if (this.engine.selectedCellRange) {
			updateRangeBorder(this)
		}

		// Update row selection borders after render
		if (this.engine.selectedRows.length > 0) {
			createRowSelectionBorders(this)
		} else {
			removeRowSelectionBorders()
		}

		// Update column selection borders after render
		if (this.engine.selectedColumns.length > 0) {
			createColumnSelectionBorders(this)
		} else {
			removeColumnSelectionBorders()
		}

		perfLogger.debug('render() body:', (performance.now() - __renderStartT).toFixed(2), 'ms |', gridPerf.summary())
	}

	/** SVG connector arrow for toolbar row tracking — see modules/toolbar/connector-renderer.ts */
	renderConnector(): void {
		renderConnectorModule(this)
	}

	/** Surgical clear-all-selections (no render) — see modules/selection-border/clear-all.ts */
	clearAllSelections(): void {
		clearAllSelectionsModule(this)
	}

	/** Excel-like commit-on-click-away — see modules/editing/commit-on-transition.ts */
	commitOrCancelEditOnTransition(): void {
		commitOrCancelEditOnTransitionModule(this)
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

	/** "Go to row" dialog (Ctrl+G) — see modules/navigation/go-to-row-dialog.ts */
	showGoToRowDialog(colIndex: number): void {
		showGoToRowDialogModule(this, colIndex)
	}

	/** Custom editor lifecycle — see modules/editing/custom-editor.ts */
	openCustomEditor(rowIndex: number, colIndex: number): void {
		openCustomEditorModule(this, rowIndex, colIndex)
	}


	/** Paste event handler — see modules/paste/handlePasteEvent */
	private handlePaste = (e: ClipboardEvent): Promise<void> => handlePasteEvent(this, e)

	/**
	 * The public facade (`el.controller`, and `controller` on every callback ctx and
	 * event detail).
	 */
	protected override createController(): GridController<T> {
		return createGridController<T>(this)
	}
}

export default GridElement

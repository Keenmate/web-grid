// =============================================================================
// GridElement - Web Component Registration
// =============================================================================

import { GridEngine, GRID_PRESETS } from './grid.js'
import type {
	Column,
	ExpandOptions,
	CellValidationState,
	EditTrigger,
	EditStartSelection,
	EditorOptions,
	GridPreset,
	ToggleVisibility,
	SortState,
	SortMode,
	CellSelectionMode,
	NewRowPosition,
	TreeDoubleClickBehavior,
	PaginationLabelsCallback,
	SummaryCallback,
	ToolbarPosition,
	GridLabels,
	GridLabelsInput,
	RowLock,
	RowLockingOptions,
	ColumnWidthState,
	ColumnOrderState,
	GridPersistenceState,
	PasteMode,
	FillDirection,
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
	BeforePageChangeContext,
	GridBeforeScrollContext,
	GridScrollOptions
} from './interaction.js'
import { createGridController } from './controller.js'
import { toBoolOrAuto, toNumberOrLength, toPipeList, AREA_POSITIONS, PAGINATION_PARTS } from './converters.js'

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
	handleCellKeyDown,
	restoreFocusAfterRender,
	openGoToRowDialog as openGoToRowDialogModule
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
	closeGridMenu,
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

import { scrollRowIntoView } from './modules/scroll/reveal.js'
import {
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
import { syncLoadingMoreLoader, removeAllLoaders } from './modules/rendering/loader.js'

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
	toObject,
	toFunction,
	toCssLength,
	createCustomStyles,
	createStateStore,
	type CustomStylesHandle,
	type LoadStateCallback,
	type SaveStateCallback,
	type InputDef,
	type EventDef,
	type RenderLoaderCallback,
	type ResponsiveMap,
	type ResponsiveCallback,
} from '@keenmate/web-components-core'
import type { MenuHandle } from '@keenmate/web-components-core/menu'

// Enum member lists for the input table (hoisted `as const` so the CEM
// extractor and toEnum both read the same literal source of truth).
const PAGINATION_MODES = ['client', 'server'] as const
const EDIT_TRIGGERS = ['click', 'dblclick', 'button', 'always', 'navigate'] as const
const EDIT_START_SELECTIONS = ['mouse-position', 'select-all', 'cursor-at-start', 'cursor-at-end'] as const
const GRID_PRESETS_LIST = ['read-only', 'excel', 'input-matrix'] as const
const CELL_SELECTION_MODES = ['none', 'click', 'shift'] as const
const TOGGLE_VISIBILITIES = ['always', 'on-focus'] as const
const TOOLBAR_VERTICAL_ALIGNS = ['top', 'center', 'bottom'] as const
const TOOLBAR_HORIZONTAL_ALIGNS = ['start', 'center', 'end', 'cursor'] as const
const TOOLBAR_TRIGGERS = ['hover', 'click', 'button'] as const
const TOOLBAR_POSITIONS = ['auto', 'left', 'right', 'top', 'inline'] as const
const SHORTCUTS_HELP_POSITIONS = ['top-right', 'top-left'] as const
const SORT_MODES = ['none', 'single', 'multiple'] as const
const NEW_ROW_POSITIONS = ['top', 'bottom'] as const
const TREE_DOUBLE_CLICK_BEHAVIORS = ['none', 'toggle'] as const
const PASTE_MODES = ['skip-non-editable', 'all-columns', 'editable-only'] as const
const FILTER_MODES = ['client', 'server'] as const
const FILL_DIRECTIONS = ['vertical', 'all'] as const

/**
 * Event table (core SPEC §12.5): every happening is one DOM event (bubbles, not
 * composed) + a camelCase `on*` twin property called with the same detail first.
 * Every detail carries `controller` + `element` (non-enumerable).
 */
const EVENTS: readonly EventDef[] = [
	{ name: 'row-change', description: 'A cell value was committed (editor, checkbox, paste, new row). `detail`: `{ row, draftRow, rowIndex, field, oldValue, newValue, isValid, validationError }`. Twin: `onRowChange(detail)`.' },
	{ name: 'cell-edit-start', description: 'A cell editor opened. `detail`: `{ row, rowIndex, field }`. Twin: `onCellEditStart(detail)`.' },
	{ name: 'cell-edit-cancel', description: 'A cell edit was cancelled. `detail`: `{ row, rowIndex, field }`. Twin: `onCellEditCancel(detail)`.' },
	{ name: 'validation-error', description: '`validateCallback` rejected a value. `detail`: `{ row, rowIndex, field, error, source: "edit" | "paste" }`. Twin: `onValidationError(detail)`.' },
	{ name: 'focus-change', description: 'The focused row changed. `detail`: `{ row, rowIndex, oldRowIndex }`. Twin: `onFocusChange(detail)`.' },
	{ name: 'row-delete', description: 'The `delete` built-in removed rows (cell menu / row toolbar / Ctrl+Delete) — after the fact; veto it with `beforeActionCallback`. Programmatic `removeRows` / `removeRow` do not fire it. `detail`: `{ rows, rowIndices }` (indices before the removal). Twin: `onRowDelete(detail)`.' },
	{ name: 'cell-selection-change', description: 'The selected cell range changed (once per gesture / API call, only on a real change). `detail`: `{ range, cellCount, fields, rows }` — `range.startColIndex` / `endColIndex` are on-screen (visual) positions, not `columns` indices; `fields` = the range’s columns in on-screen order; `rows` = the row objects in the range. Cleared: `{ range: null, cellCount: 0, fields: [], rows: [] }`. Twin: `onCellSelectionChange(detail)`.' },
	{ name: 'row-selection-change', description: 'The row selection changed (row-number click / Ctrl / Shift / drag, `selectRow` / `selectRowRange` / `clearSelection`, or cleared by another selection) — once per gesture / API call, only on a real change. `detail`: `{ rows, rowIndices }` (display order). Twin: `onRowSelectionChange(detail)`.' },
	{ name: 'column-selection-change', description: 'The column selection changed (header click / Ctrl / Shift / drag, `selectColumn` / `selectColumnRange` / `clearColumnSelection`, or cleared by another selection) — once per gesture / API call, only on a real change. `detail`: `{ fields }` (on-screen order). Twin: `onColumnSelectionChange(detail)`.' },
	{ name: 'data-request', description: 'Sort / page / page size changed or more rows are needed (server-side data). `detail`: `{ sort, page, pageSize, trigger, mode, skip }`. Twin: `onDataRequest(detail)`.' },
	{ name: 'filter-change', description: 'A column filter changed. `detail`: `{ filters }`. With `filter-mode="server"` the consumer filters. Twin: `onFilterChange(detail)`.' },
	{ name: 'column-resize', description: 'A column was resized. `detail`: `{ field, oldWidth, newWidth, allWidths }`. Twin: `onColumnResize(detail)`.' },
	{ name: 'column-reorder', description: 'A column was moved. `detail`: `{ field, fromIndex, toIndex, allOrder }`. Twin: `onColumnReorder(detail)`.' },
	{ name: 'row-expand', description: 'A tree row was expanded (chevron, keyboard, double-click, `toggleRowExpanded`, `expandRows`; NOT `expandAll` — that fires only `expanded-change`). `detail`: `{ row, path }`. Twin: `onRowExpand(detail)`.' },
	{ name: 'row-collapse', description: 'A tree row was collapsed (chevron, keyboard, `toggleRowExpanded`, `collapseRows`; NOT `collapseAll`). `detail`: `{ row, path }`. Twin: `onRowCollapse(detail)`.' },
	{ name: 'expanded-change', description: 'The expanded set changed (any expand / collapse, incl. `expandAll` / `collapseAll`) — one event per change, after the row events. `detail`: `{ paths }` = every expanded path (same as `expandedPaths`). Twin: `onExpandedChange(detail)`.' },
	{ name: 'row-lock-change', description: 'A row was locked / unlocked by id. `detail`: `{ rowId, row, rowIndex, lockInfo, source }`. Twin: `onRowLockChange(detail)`.' },
	{ name: 'cell-paste', description: 'A multi-cell paste finished. `detail`: `{ totalCells, successfulCells, failedCells, skippedCells, newRowsCreated, cellResults, hadHeaders }`. Twin: `onCellPaste(detail)`.' },
	{ name: 'action', description: 'A toolbar / menu / shortcut item was activated. `detail`: `action` (built-in name or `custom`), `id`, `item`, `source` (`row-toolbar` | `cell-toolbar` | `context-menu` | `header-menu` | `keyboard`), `sourceEvent`, `triggerElement`, `dataset`, plus the surface fields (`row` / `rowIndex` / `column` / `field` / `value`, header-menu fields, or range `rows` / `rowIndices`). Fires after the item’s `onClick` and the built-in — a notification after the fact (after `delete` the row is already gone from `items`, after `add` the new row is present, after `move-*` the new order is in place); a throwing built-in is logged and the event still fires. Cancel with `beforeActionCallback`. Twin: `onAction(detail)`.' },
]

/**
 * Every input of the grid's `static inputs` table as a typed property (rulebook C-CA-16):
 * merged into {@link GridElement}, and the config a responsive rule may set. Lists exactly the
 * input rows — `columns`, `items`, callbacks other than the two below and UI state are plain
 * element properties, not inputs.
 */
export interface GridElementConfig<T = unknown> {
	// Filtering & pagination
	isFilteringEnabled: boolean
	/** 'server': the grid doesn't filter `items` — handle `filter-change` and replace `items`. */
	filterMode: 'client' | 'server'
	isPagingEnabled: boolean
	pageSize: number
	paginationMode: 'client' | 'server'
	isPaginationShown: boolean | 'auto'
	/** Pager position(s), `|`-separated: `'bottom-center'`, `'top-right|bottom-right'`, … */
	paginationPosition: string
	/** Pager parts in order, `|`-separated (`'page-size|previous|page-info|next'`). */
	paginationLayout: string
	// Appearance
	isStriped: boolean
	isHoverable: boolean
	isTableBorderOnly: boolean
	isScrollable: boolean
	/** CSS length; a number means pixels (stored as `'<n>px'`). */
	scrollMaxHeight: string | number
	// Editing
	isEditingEnabled: boolean
	editTrigger: EditTrigger
	/**
	 * The edit button's content — an HTML string (default `✎`), e.g. an icon font /
	 * sprite: `'<span class="lucide-pencil"></span>'`. Shown in editable cells with
	 * `editTrigger: 'button'` (or `column.isEditButtonShown`); its accessible name is
	 * `labels.editCell`.
	 */
	editButtonIcon: string
	editStartSelection: EditStartSelection
	shouldCommitOnClickAway: boolean
	/** Preset (`'read-only'` | `'excel'` | `'input-matrix'`): sets editing / selection defaults; `read-only` also sets `isReadonly`. */
	preset: GridPreset
	/** Values can't change (no edit / paste / fill / row add-delete-move); the grid stays focusable, selectable and copyable. Attribute `readonly` (presence, reflects). */
	isReadonly: boolean
	/** No interaction at all (not focusable, dimmed). Attribute `disabled` (presence, reflects). */
	isDisabled: boolean
	cellSelectionMode: CellSelectionMode
	// Dropdown editor
	dropdownToggleVisibility: ToggleVisibility
	shouldOpenDropdownOnFocus: boolean
	shouldOpenDropdownOnEnter: boolean
	isCheckboxAlwaysEditable: boolean
	// Row numbers & indicators
	isRowNumbersShown: boolean
	isDirtyIndicatorShown: boolean
	isStickyRowNumbers: boolean
	frozenColumnCount: number
	// Row toolbar
	isRowToolbarShown: boolean
	toolbarVerticalAlign: 'top' | 'center' | 'bottom'
	toolbarHorizontalAlign: 'start' | 'center' | 'end' | 'cursor'
	toolbarTrigger: 'hover' | 'click' | 'button'
	toolbarPosition: ToolbarPosition
	shouldToolbarFollowCursor: boolean
	/** A number is an em multiplier (0–1), a string any CSS length. */
	cellToolbarOffset: number | string
	// Context menu
	contextMenuXOffset: number
	contextMenuYOffset: number
	// Shortcuts help
	isShortcutsHelpShown: boolean
	shortcutsHelpPosition: 'top-right' | 'top-left'
	// Columns
	/** Default `min-width` (CSS length; a number means pixels) of every column header without its own `minWidth`; `undefined` = none. */
	columnMinWidth: string | number | undefined
	isColumnReorderAllowed: boolean
	sortMode: SortMode
	// Persisted UI state (core SPEC §12.17)
	/** Key of the persisted column state; unset / empty = off. Default store: `localStorage['km-state:web-grid:<key>']`. */
	storageKey: string | null
	/** Persist the user's column widths (needs `storageKey`). */
	shouldPersistColumnWidths: boolean
	/** Persist the user's column order (needs `storageKey`). */
	shouldPersistColumnOrder: boolean
	/** The persisted state for `ctx.key` (`{ columnWidths?, columnOrder? }`) or `null`; may be async. Set both callbacks; either one alone switches localStorage off. */
	loadStateCallback: LoadStateCallback<GridPersistenceState> | null
	/** Store `ctx.state` — the WHOLE `GridPersistenceState` — for `ctx.key`; may be async. Set both callbacks; either one alone switches localStorage off. */
	saveStateCallback: SaveStateCallback<GridPersistenceState> | null
	// Summary
	/** Summary position(s), `|`-separated like `paginationPosition`; `null` = no summary. */
	summaryPosition: string | null
	isSummaryInline: boolean
	// Virtual & infinite scroll
	isVirtualScrollEnabled: boolean
	virtualScrollThreshold: number
	virtualScrollItemHeight: number
	virtualScrollOverscan: number
	isInfiniteScrollEnabled: boolean
	infiniteScrollThreshold: number
	// New empty row
	isNewRowEnabled: boolean
	newRowPosition: NewRowPosition
	newRowIndicator: string
	// Tree
	isTreeDataSorted: boolean
	treeDoubleClickBehavior: TreeDoubleClickBehavior
	treeExpandedGlyph: string
	treeCollapsedGlyph: string
	// Paste / clipboard
	shouldCopyWithHeaders: boolean
	pasteMode: PasteMode
	shouldValidateOnPaste: boolean
	/** Fill-handle drag direction for the whole grid (`'vertical'` | `'all'`); a column's `fillDirection` wins. */
	fillDirection: FillDirection
	/** UI strings — a partial object (JSON attribute `labels`) merged per key over the English defaults. Reads back what was assigned. */
	labels: GridLabelsInput | undefined
	/** CSS for the grid's shadow root, after the page-wide `window.components['web-grid'].customStyles`. */
	customStyles: string | null
	/** Computes the instance CSS from the grid context; wins over `customStyles`. */
	getCustomStylesCallback: ((ctx: GridCallbackContext<T>) => string | null | undefined) | null
	/** Custom render for the grid's loading states (`ctx.context`: 'row' | 'search'); beats `window.components.renderLoadingCallback`. */
	renderLoadingCallback: RenderLoaderCallback | null
	/** Runs before the grid scrolls a cell / row into view on its own: `false` skips, a partial `options` replaces the defaults (synchronous). */
	beforeScrollCallback: ((ctx: GridBeforeScrollContext<T>) => false | Partial<GridScrollOptions> | void) | null
	tooltipShowDelay: number
	tooltipHideDelay: number
}

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
	// filters, focusedRowIndex, totalItems, expandedPaths, hasMoreItems)
	// deliberately stay property-only.
	// `as const` keeps the configKey literals: they type GridResponsiveConfig.
	static inputs = [
		// Filtering & pagination
		{ configKey: 'isFilteringEnabled', attribute: 'enable-filtering', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'filterMode', attribute: 'filter-mode', converter: toEnum(FILTER_MODES, { default: 'client' }), default: 'client', on: 'update' },
		{ configKey: 'isPagingEnabled', attribute: 'enable-paging', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'pageSize', attribute: 'page-size', converter: toInt({ min: 1, default: 10 }), default: 10, on: 'update' },
		{ configKey: 'paginationMode', attribute: 'pagination-mode', converter: toEnum(PAGINATION_MODES, { default: 'client' }), default: 'client', on: 'update' },
		{ configKey: 'isPaginationShown', attribute: 'show-pagination', converter: toBoolOrAuto(true), default: true, on: 'update', type: "boolean | 'auto'" },
		{ configKey: 'paginationPosition', attribute: 'pagination-position', converter: toPipeList(AREA_POSITIONS, { default: 'bottom-center' }), default: 'bottom-center', on: 'update', type: 'string' },
		{ configKey: 'paginationLayout', attribute: 'pagination-layout', converter: toPipeList(PAGINATION_PARTS, { default: 'page-size|previous|page-info|next' }), default: 'page-size|previous|page-info|next', on: 'update', type: 'string' },
		// Appearance
		{ configKey: 'isStriped', attribute: 'striped', converter: toBool('default-true'), default: true, on: 'update' },
		{ configKey: 'isHoverable', attribute: 'hoverable', converter: toBool('default-true'), default: true, on: 'update' },
		{ configKey: 'isTableBorderOnly', attribute: 'table-border-only', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'isScrollable', attribute: 'scrollable', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'scrollMaxHeight', attribute: 'scroll-max-height', converter: toCssLength({ default: '100vh' }), default: '100vh', on: 'update', type: 'string | number' },
		// Editing
		{ configKey: 'isEditingEnabled', attribute: 'enable-editing', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'editTrigger', attribute: 'edit-trigger', converter: toEnum(EDIT_TRIGGERS, { default: 'dblclick' }), default: 'dblclick', on: 'update' },
		// HTML of the edit button (editTrigger 'button'), e.g. '<span class="lucide-pencil"></span>'
		{ configKey: 'editButtonIcon', attribute: 'edit-button-icon', converter: toText({ default: '✎' }), default: '✎', on: 'update' },
		{ configKey: 'editStartSelection', attribute: 'edit-start-selection', converter: toEnum(EDIT_START_SELECTIONS, { default: 'mouse-position' }), default: 'mouse-position', on: 'update' },
		{ configKey: 'shouldCommitOnClickAway', attribute: 'commit-on-click-away', converter: toBool('default-true'), default: true, on: 'update' },
		// A preset: also sets isEditingEnabled / isReadonly / editTrigger / dropdown flags / cellSelectionMode
		// in the same batch; inputs set explicitly in that batch win (core getBatchValuesCallback).
		{ configKey: 'preset', attribute: 'preset', converter: toEnum(GRID_PRESETS_LIST, { default: 'excel' }), default: 'excel', on: 'update',
			getBatchValuesCallback: (preset) => GRID_PRESETS[preset as GridPreset] ?? null },
		// Values can't change; still focusable / selectable / copyable (the read-only preset sets it).
		// Native rule (core SPEC §6.4): the attribute's presence decides, `readonly="false"` is still read-only; reflects.
		{ configKey: 'isReadonly', attribute: 'readonly', converter: toBool('presence'), default: false, on: 'update', shouldReflect: true },
		// No interaction at all (applied via core disabledChanged(), not update()); presence rule, reflects
		{ configKey: 'isDisabled', attribute: 'disabled', converter: toBool('presence'), default: false, on: 'update', shouldReflect: true },
		{ configKey: 'cellSelectionMode', attribute: 'cell-selection-mode', converter: toEnum(CELL_SELECTION_MODES, { default: 'click' }), default: 'click', on: 'update' },
		// Dropdown editor
		{ configKey: 'dropdownToggleVisibility', attribute: 'dropdown-toggle-visibility', converter: toEnum(TOGGLE_VISIBILITIES, { default: 'always' }), default: 'always', on: 'update' },
		{ configKey: 'shouldOpenDropdownOnFocus', attribute: 'open-dropdown-on-focus', converter: toBool('default-true'), default: true, on: 'update' },
		{ configKey: 'shouldOpenDropdownOnEnter', attribute: 'open-dropdown-on-enter', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'isCheckboxAlwaysEditable', attribute: 'checkbox-always-editable', converter: toBool('default-false'), default: false, on: 'update' },
		// Row numbers & indicators
		{ configKey: 'isRowNumbersShown', attribute: 'show-row-numbers', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'isDirtyIndicatorShown', attribute: 'show-dirty-indicator', converter: toBool('default-true'), default: true, on: 'update' },
		{ configKey: 'isStickyRowNumbers', attribute: 'sticky-row-numbers', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'frozenColumnCount', attribute: 'frozen-column-count', converter: toInt({ min: 0, default: 0 }), default: 0, on: 'update' },
		// Row toolbar
		{ configKey: 'isRowToolbarShown', attribute: 'show-row-toolbar', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'toolbarVerticalAlign', attribute: 'toolbar-vertical-align', converter: toEnum(TOOLBAR_VERTICAL_ALIGNS, { default: 'bottom' }), default: 'bottom', on: 'update' },
		{ configKey: 'toolbarHorizontalAlign', attribute: 'toolbar-horizontal-align', converter: toEnum(TOOLBAR_HORIZONTAL_ALIGNS, { default: 'center' }), default: 'center', on: 'update' },
		{ configKey: 'toolbarTrigger', attribute: 'toolbar-trigger', converter: toEnum(TOOLBAR_TRIGGERS, { default: 'hover' }), default: 'hover', on: 'update' },
		{ configKey: 'toolbarPosition', attribute: 'toolbar-position', converter: toEnum(TOOLBAR_POSITIONS, { default: 'auto' }), default: 'auto', on: 'update' },
		{ configKey: 'shouldToolbarFollowCursor', attribute: 'toolbar-follow-cursor', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'cellToolbarOffset', attribute: 'cell-toolbar-offset', converter: toNumberOrLength(0.2), default: 0.2, on: 'update', type: 'number | string' },
		// Context menu
		{ configKey: 'contextMenuXOffset', attribute: 'context-menu-x-offset', converter: toInt({ default: 8 }), default: 8, on: 'update' },
		{ configKey: 'contextMenuYOffset', attribute: 'context-menu-y-offset', converter: toInt({ default: 0 }), default: 0, on: 'update' },
		// Shortcuts help
		{ configKey: 'isShortcutsHelpShown', attribute: 'show-shortcuts-help', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'shortcutsHelpPosition', attribute: 'shortcuts-help-position', converter: toEnum(SHORTCUTS_HELP_POSITIONS, { default: 'top-right' }), default: 'top-right', on: 'update' },
		// Columns
		{ configKey: 'columnMinWidth', attribute: 'column-min-width', converter: toCssLength(), on: 'update', type: 'string | number | undefined' },
		{ configKey: 'isColumnReorderAllowed', attribute: 'allow-column-reorder', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'sortMode', attribute: 'sort-mode', converter: toEnum(SORT_MODES, { default: 'none' }), default: 'none', on: 'update' },
		// Persisted UI state (core createStateStore(), SPEC §12.17 / rulebook C-CA-17): column widths / order
		// the user arranged, kept under `storage-key` (localStorage `km-state:web-grid:<key>`, or the callbacks).
		{ configKey: 'storageKey', attribute: 'storage-key', converter: toText({ isNullable: true }), default: null, on: 'update', type: 'string | null', description: 'Key of the persisted column state (widths / order the user arranged; core SPEC §12.17). Unset / empty = off; set = localStorage `km-state:web-grid:<key>`, or `loadStateCallback` / `saveStateCallback`.' },
		{ configKey: 'shouldPersistColumnWidths', attribute: 'persist-column-widths', converter: toBool('default-false'), default: false, on: 'update', description: 'Persist the column widths the user resized to (needs `storage-key`).' },
		{ configKey: 'shouldPersistColumnOrder', attribute: 'persist-column-order', converter: toBool('default-false'), default: false, on: 'update', description: 'Persist the column order the user dragged to (needs `storage-key`).' },
		{ configKey: 'loadStateCallback', converter: toFunction<LoadStateCallback<GridPersistenceState>>(), on: 'update', type: 'LoadStateCallback<GridPersistenceState> | null', description: 'Persisted column state source: `(ctx) => GridPersistenceState | null | Promise<…>`, `ctx`: `{ key }` + context. Set both callbacks; either one alone switches localStorage off.' },
		{ configKey: 'saveStateCallback', converter: toFunction<SaveStateCallback<GridPersistenceState>>(), on: 'none', type: 'SaveStateCallback<GridPersistenceState> | null', description: 'Persisted column state sink: `ctx`: `{ key, state }` + context, `state` = the WHOLE `GridPersistenceState` (`{ columnWidths?, columnOrder? }`). Set both callbacks; either one alone switches localStorage off.' },
		// Summary
		{ configKey: 'summaryPosition', attribute: 'summary-position', converter: toPipeList(AREA_POSITIONS, { isNullable: true }), default: null, on: 'update', type: 'string | null' },
		{ configKey: 'isSummaryInline', attribute: 'summary-inline', converter: toBool('default-true'), default: true, on: 'update' },
		// Virtual & infinite scroll
		{ configKey: 'isVirtualScrollEnabled', attribute: 'enable-virtual-scroll', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'virtualScrollThreshold', attribute: 'virtual-scroll-threshold', converter: toInt({ min: 0, default: 100 }), default: 100, on: 'update' },
		{ configKey: 'virtualScrollItemHeight', attribute: 'virtual-scroll-item-height', converter: toInt({ min: 1, default: 38 }), default: 38, on: 'update' },
		{ configKey: 'virtualScrollOverscan', attribute: 'virtual-scroll-overscan', converter: toInt({ min: 0, default: 10 }), default: 10, on: 'update' },
		{ configKey: 'isInfiniteScrollEnabled', attribute: 'enable-infinite-scroll', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'infiniteScrollThreshold', attribute: 'infinite-scroll-threshold', converter: toInt({ min: 0, default: 100 }), default: 100, on: 'update' },
		// New empty row
		{ configKey: 'isNewRowEnabled', attribute: 'enable-new-row', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'newRowPosition', attribute: 'new-row-position', converter: toEnum(NEW_ROW_POSITIONS, { default: 'bottom' }), default: 'bottom', on: 'update' },
		{ configKey: 'newRowIndicator', attribute: 'new-row-indicator', converter: toText({ default: '+' }), default: '+', on: 'update' },
		// Tree
		{ configKey: 'isTreeDataSorted', attribute: 'tree-data-sorted', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'treeDoubleClickBehavior', attribute: 'tree-double-click-behavior', converter: toEnum(TREE_DOUBLE_CLICK_BEHAVIORS, { default: 'none' }), default: 'none', on: 'update' },
		{ configKey: 'treeExpandedGlyph', attribute: 'tree-expanded-glyph', converter: toText({ default: '▶' }), default: '▶', on: 'update' },
		{ configKey: 'treeCollapsedGlyph', attribute: 'tree-collapsed-glyph', converter: toText({ default: '▶' }), default: '▶', on: 'update' },
		// Paste / clipboard
		{ configKey: 'shouldCopyWithHeaders', attribute: 'copy-with-headers', converter: toBool('default-false'), default: false, on: 'update' },
		{ configKey: 'pasteMode', attribute: 'paste-mode', converter: toEnum(PASTE_MODES, { default: 'skip-non-editable' }), default: 'skip-non-editable', on: 'update' },
		{ configKey: 'shouldValidateOnPaste', attribute: 'validate-on-paste', converter: toBool('default-true'), default: true, on: 'update' },
		// Fill handle — grid-wide drag direction; a column's own `fillDirection` wins
		{ configKey: 'fillDirection', attribute: 'fill-direction', converter: toEnum(FILL_DIRECTIONS, { default: 'vertical' }), default: 'vertical', on: 'update' },
		// UI strings (i18n): a partial object (also a JSON attribute) merged per key over the
		// English defaults — `noData` / `noResults`, `loading`, `dropdownNoData`, pagination / go-to-row / menu texts, … (see labels.ts)
		{ configKey: 'labels', attribute: 'labels', converter: toObject(), on: 'update', type: 'GridLabelsInput' },
		// Custom CSS for the shadow root (core createCustomStyles(), rulebook C-CA-15): applied after the
		// page-wide `window.components['web-grid'].customStyles`; the callback wins over the string.
		{ configKey: 'customStyles', attribute: 'custom-styles', converter: toText({ isNullable: true }), on: 'update', type: 'string | null', description: "CSS injected into the grid's shadow root (after the page-wide `window.components['web-grid'].customStyles`); an `@import`ed font is also linked in the document head." },
		{ configKey: 'getCustomStylesCallback', converter: toFunction<(ctx: GridCallbackContext) => string | null | undefined>(), on: 'update', type: '((ctx: GridContext) => string | null) | null', description: 'Computes the instance CSS from the grid context; wins over `customStyles`.' },
		// Loading states (core SPEC §12.14): draws every grid loader — `ctx.context` is 'row'
		// (infinite-scroll load-more row) or 'search' (async dropdown search). Beats the page-wide
		// `window.components.renderLoadingCallback`; may return a cleanup function.
		{ configKey: 'renderLoadingCallback', converter: toFunction<RenderLoaderCallback>(), default: null, on: 'update', type: 'RenderLoaderCallback | null', description: "Custom render for the grid's loading states (`ctx.context`: 'row' | 'search'); fills `ctx.containerElement`, may return a cleanup." },
		// Gate of every scroll the grid makes on its own (keyboard moves, scrollToRow, go-to-row; rulebook
		// D-CA-5): `false` skips it, a partial `options` replaces the defaults. Element-local (not on the engine).
		{ configKey: 'beforeScrollCallback', converter: toFunction<(ctx: GridBeforeScrollContext) => unknown>(), on: 'update', type: '((ctx: GridBeforeScrollContext) => false | Partial<GridScrollOptions> | void) | null', description: 'Runs before the grid scrolls a cell / row into view on its own (`ctx.source`: keyboard | scroll-to-row | go-to-row); `false` skips, a partial `options` replaces the defaults. Synchronous.' },
		// Tooltip timing (element-local, not on the engine — the bridge's `in this.engine`
		// guard skips them; readers use the input's getter)
		{ configKey: 'tooltipShowDelay', attribute: 'tooltip-show-delay', converter: toInt({ min: 0, default: 200 }), default: 200, on: 'update' },
		{ configKey: 'tooltipHideDelay', attribute: 'tooltip-hide-delay', converter: toInt({ min: 0, default: 100 }), default: 100, on: 'update' },
	] as const satisfies readonly InputDef[]

	static events = EVENTS

	// Type-only: core installs the `on<Name>` twins at runtime (§12.5); each is
	// called with the event detail (not the CustomEvent), right before the event.
	declare onRowChange: ((detail: GridEventMap<T>['row-change']) => void) | null
	declare onCellEditStart: ((detail: GridEventMap<T>['cell-edit-start']) => void) | null
	declare onCellEditCancel: ((detail: GridEventMap<T>['cell-edit-cancel']) => void) | null
	declare onValidationError: ((detail: GridEventMap<T>['validation-error']) => void) | null
	declare onFocusChange: ((detail: GridEventMap<T>['focus-change']) => void) | null
	declare onRowDelete: ((detail: GridEventMap<T>['row-delete']) => void) | null
	declare onCellSelectionChange: ((detail: GridEventMap<T>['cell-selection-change']) => void) | null
	declare onRowSelectionChange: ((detail: GridEventMap<T>['row-selection-change']) => void) | null
	declare onColumnSelectionChange: ((detail: GridEventMap<T>['column-selection-change']) => void) | null
	declare onDataRequest: ((detail: GridEventMap<T>['data-request']) => void) | null
	declare onFilterChange: ((detail: GridEventMap<T>['filter-change']) => void) | null
	declare onColumnResize: ((detail: GridEventMap<T>['column-resize']) => void) | null
	declare onColumnReorder: ((detail: GridEventMap<T>['column-reorder']) => void) | null
	declare onRowExpand: ((detail: GridEventMap<T>['row-expand']) => void) | null
	declare onRowCollapse: ((detail: GridEventMap<T>['row-collapse']) => void) | null
	declare onExpandedChange: ((detail: GridEventMap<T>['expanded-change']) => void) | null
	declare onRowLockChange: ((detail: GridEventMap<T>['row-lock-change']) => void) | null
	declare onCellPaste: ((detail: GridEventMap<T>['cell-paste']) => void) | null
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

	// DatePicker instance (for date editor) - exposed via GridHost for pipeline access
	datepicker: DatePicker | null = null

	// The open cell / header menu (core openMenu(), in the shadow root) - exposed via GridHost for pipeline access
	menu: MenuHandle | null = null

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
		this.engine.setStateStore(this.#stateStore)
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
	 * inputs (tooltip delays) whose readers use the config getter. `preset` goes
	 * first: the engine's own preset setter applies its settings, and the batch's
	 * values (core already resolved preset vs explicit) must land after it.
	 * `isDisabled` is applied by `disabledChanged()` / `reinit()` (core SPEC §6.4). */
	#applyConfig(cfg: Record<string, unknown>): void {
		const target = this.engine as unknown as Record<string, unknown>
		if ('preset' in cfg) target.preset = cfg.preset
		for (const key of Object.keys(cfg)) {
			if (key !== 'preset' && key !== 'isDisabled' && key in target) target[key] = cfg[key]
		}
	}

	/**
	 * Persisted UI state (core SPEC §12.17, rulebook C-CA-17): the column widths / order the user
	 * arranged, under `storage-key`. The engine applies / collects the state; this store does the I/O.
	 */
	readonly #stateStore = createStateStore<GridPersistenceState>(this, {
		getKey: () => this.config.storageKey as string | null,
		getLoadCallback: () => this.config.loadStateCallback as LoadStateCallback<GridPersistenceState> | null,
		getSaveCallback: () => this.config.saveStateCallback as SaveStateCallback<GridPersistenceState> | null,
		toContext: (data) => this.withContext(data),
	})

	/** First build done — before it, engine setters don't render (`defer` holds the first render). */
	#isBuilt = false

	/** The instance + page-wide custom CSS layers (core createCustomStyles(), rulebook C-CA-15). */
	#customStyles: CustomStylesHandle | null = null

	#applyCustomStyles(): void {
		if (this.#customStyles) return this.#customStyles.refresh()
		this.#customStyles = createCustomStyles(this, this.shadow, {
			cssClass: 'wg-custom-styles',
			getContext: () => this.engine.ctx({}),
			getInstanceStyles: () => ({ css: this.config.customStyles as string | null, callback: this.config.getCustomStylesCallback as GridElementConfig<T>['getCustomStylesCallback'] }),
		})
	}

	protected reinit(): void {
		// First connect: seed the grid from the merged input config.
		this.#applyConfig(this.config as Record<string, unknown>)
		this.engine.isDisabled = this.isEffectivelyDisabled
		this.#applyCustomStyles()
		// Persisted column widths / order (async; waits for `columns` when there are none yet)
		this.engine.loadPersistedState()
		this.#isBuilt = true
	}

	protected override disabledChanged(isDisabled: boolean): void {
		this.engine.isDisabled = isDisabled
		if (isDisabled) {
			closeGridMenu(this)
			closeToolbar()
		}
	}

	protected update(partial: Record<string, unknown>): void {
		// Later attribute/property changes: apply just the changed inputs.
		this.#applyConfig(partial)
		// A new key / persist flag / source: load its persisted column state
		if ('storageKey' in partial || 'shouldPersistColumnWidths' in partial || 'shouldPersistColumnOrder' in partial || 'loadStateCallback' in partial) {
			this.engine.loadPersistedState()
		}
		if ('customStyles' in partial || 'getCustomStylesCallback' in partial) this.#customStyles?.refresh()
	}

	protected connect(): void {
		initLogger.debug('connect — grid activated')
		// Initialize action pipeline adapter for 'always' editTrigger mode
		this.pipelineAdapter = createActionPipelineAdapter(this)
		this.render()
		// Register paste handler for navigate mode
		this.addEventListener('paste', this.handlePaste as EventListener)
	}

	protected override destroyCallback(): void {
		// Loader render hooks may hold resources (their returned cleanup)
		removeAllLoaders(this)
		this.#customStyles?.destroy()
		this.#customStyles = null
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
		closeGridMenu(this)
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
		// Reset infinite scroll loading flag (before the re-render, so the
		// `labels.loading` row goes away with it)
		this.virtualScroll.setIsLoadingMore(false)
		this.shadow?.querySelector('.wg__loading-more-row')?.remove()
		if (this.shadow) syncLoadingMoreLoader(this)
		this.engine.items = value
	}

	get columns(): Column<T>[] { return this.engine.columns }
	set columns(value: Column<T>[]) { this.engine.columns = value }

	get filters(): Record<string, string> { this.flush(); return this.engine.filters }
	/** Assignment is silent (no `filter-change`), like a native `input.value`; use `setFilter()` to fire it. */
	set filters(value: Record<string, string>) { this.engine.filters = value }
	/** Set (or clear, with `''`) one column filter; fires `filter-change` unless `{ isSilent: true }`. */
	setFilter(field: string, value: string, options?: { isSilent?: boolean }): void { this.flush(); this.engine.setFilter(field, value, options) }

	get pageSizes(): number[] { return this.engine.pageSizes }
	set pageSizes(value: number[]) { this.engine.pageSizes = value }

	get isRowEditable(): boolean | undefined { return this.engine.isRowEditable }
	set isRowEditable(value: boolean | undefined) { this.engine.isRowEditable = value }

	get getIsRowEditableCallback(): ((ctx: RowDataContext<T>) => boolean) | undefined { return this.engine.getIsRowEditableCallback }
	set getIsRowEditableCallback(value: ((ctx: RowDataContext<T>) => boolean) | undefined) { this.engine.getIsRowEditableCallback = value }

	isCellDirty(rowIndex: number, field: string): boolean { this.flush(); return this.engine.isCellDirty(rowIndex, field) }
	isRowDirty(rowIndex: number): boolean { this.flush(); return this.engine.isRowDirty(rowIndex) }

	get invalidCells(): CellValidationState[] { return this.engine.invalidCells }
	set invalidCells(value: CellValidationState[]) { this.engine.invalidCells = value }

	get rowToolbar(): GridToolbarEntry<T>[] { return this.engine.rowToolbar }
	set rowToolbar(value: GridToolbarEntry<T>[]) { this.engine.rowToolbar = value }

	get toolbarColumn(): string | number | undefined { return this.engine.toolbarColumn }
	set toolbarColumn(value: string | number | undefined) { this.engine.toolbarColumn = value }

	get getCellToolbarItemsCallback(): ((ctx: CellContext<T>) => GridToolbarEntry<T>[] | null | undefined) | undefined {
		return this.engine.getCellToolbarItemsCallback
	}
	set getCellToolbarItemsCallback(value: ((ctx: CellContext<T>) => GridToolbarEntry<T>[] | null | undefined) | undefined) {
		this.engine.getCellToolbarItemsCallback = value
	}

	get toolbarBtnMinWidth(): string | undefined { return this.engine.toolbarBtnMinWidth }
	set toolbarBtnMinWidth(value: string | undefined) { this.engine.toolbarBtnMinWidth = value }


	get contextMenu(): GridMenuEntry<T>[] | undefined { return this.engine.contextMenu }
	set contextMenu(value: GridMenuEntry<T>[] | undefined) { this.engine.contextMenu = value }

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
	/** The selected row objects, in display order. */
	get selectedRows(): T[] { this.flush(); return this.engine.selectedRows }
	/** Display indices of the selected rows, ascending. */
	get selectedRowIndices(): number[] { this.flush(); return this.engine.selectedRowIndices }
	selectRow(rowIndex: number, mode: 'replace' | 'toggle' | 'range' = 'replace'): void { this.flush(); this.engine.selectRow(rowIndex, mode) }
	selectRowRange(fromIndex: number, toIndex: number): void { this.flush(); this.engine.selectRowRange(fromIndex, toIndex) }
	/** Clear every selection kind: rows, the cell range and columns. */
	clearSelection(): void { this.flush(); this.engine.clearSelection() }
	/** Clear only the row selection. */
	clearRowSelection(): void { this.flush(); this.engine.clearRowSelection() }
	isRowSelected(rowIndex: number): boolean { this.flush(); return this.engine.isRowSelected(rowIndex) }
	copySelectedRowsToClipboard(): Promise<boolean> { this.flush(); return this.engine.copySelectedRowsToClipboard() }

	// Cell range selection

	get selectedCellRange() { return this.engine.selectedCellRange }
	selectCellRange(range: any): void { this.flush(); this.engine.selectCellRange(range) }
	clearCellSelection(): void { this.flush(); this.engine.clearCellSelection() }
	getSelectedCells() { this.flush(); return this.engine.getSelectedCells() }
	copyCellSelectionToClipboard(): Promise<boolean> { this.flush(); return this.engine.copyCellSelectionToClipboard() }

	// New empty row (inline data entry) — EXPERIMENTAL: API may change

	get createEmptyRowCallback() { return this.engine.createEmptyRowCallback }
	set createEmptyRowCallback(value) { this.engine.createEmptyRowCallback = value }

	/** The copy the `duplicate` built-in inserts (default: shallow copy, `idMember` cleared). */
	get createDuplicateRowCallback(): ((ctx: RowContext<T>) => T) | undefined { return this.engine.createDuplicateRowCallback }
	set createDuplicateRowCallback(value: ((ctx: RowContext<T>) => T) | undefined) { this.engine.createDuplicateRowCallback = value }

	/**
	 * Field that uniquely identifies a row (default `'id'`; `null` = none). The only row-id
	 * member: drafts, invalid-cell markers, `getRowId` / `getRowById` / `updateRowById` /
	 * `replaceRowById` / `lockRowById` use it (`getIdCallback` wins when set).
	 */
	get idMember(): string | null { return this.engine.idMember }
	set idMember(value: string | null) { this.engine.idMember = value }

	// Tree / hierarchy
	get pathMember(): string | null { return this.engine.pathMember }
	set pathMember(value: string | null) { this.engine.pathMember = value }

	get levelMember(): string | null { return this.engine.levelMember }
	set levelMember(value: string | null) { this.engine.levelMember = value }

	get parentPathMember(): string | null { return this.engine.parentPathMember }
	set parentPathMember(value: string | null) { this.engine.parentPathMember = value }

	get treePathSeparator(): string | null { return this.engine.treePathSeparator }
	set treePathSeparator(value: string | null) { this.engine.treePathSeparator = value }

	/** The expanded tree paths (a copy). Assigning replaces the expanded state (no events); `null` → the `expandLevel` default. */
	get expandedPaths(): string[] { return this.engine.expandedPaths }
	set expandedPaths(value: string[] | null | undefined) { this.engine.expandedPaths = value }

	get expandLevel(): number | null { return this.engine.expandLevel }
	set expandLevel(value: number | null) { this.engine.expandLevel = value }

	isPathExpanded(path: string): boolean { this.flush(); return this.engine.isPathExpanded(path) }
	/** Expand / collapse one tree row (`row-expand` / `row-collapse` + `expanded-change`). */
	toggleRowExpanded(path: string, options?: ExpandOptions): void { this.flush(); this.engine.toggleRowExpanded(path, options) }
	/** Expand the given tree rows one level, ancestors opening too (`row-expand` per row + `expanded-change`). */
	expandRows(paths: string | string[], options?: ExpandOptions): void { this.flush(); this.engine.expandRows(paths, options) }
	/** Collapse the given tree rows (`row-collapse` per row + `expanded-change`). */
	collapseRows(paths: string | string[], options?: ExpandOptions): void { this.flush(); this.engine.collapseRows(paths, options) }
	/** Expand the whole tree (`null`) — or the given rows and everything under them (`expanded-change` only). */
	expandAll(paths?: string | string[] | null, options?: ExpandOptions): void { this.flush(); this.engine.expandAll(paths, options) }
	/** Collapse the whole tree (`null`) — or the given rows and everything under them (`expanded-change` only). */
	collapseAll(paths?: string | string[] | null, options?: ExpandOptions): void { this.flush(); this.engine.collapseAll(paths, options) }

	get renderChevronCallback(): ChevronCallback<T> | undefined { return this.engine.renderChevronCallback }
	set renderChevronCallback(value: ChevronCallback<T> | undefined) { this.engine.renderChevronCallback = value }

	get renderShortcutsHelpCallback(): ((ctx: GridCallbackContext<T>) => string) | undefined { return this.engine.renderShortcutsHelpCallback }
	set renderShortcutsHelpCallback(value: ((ctx: GridCallbackContext<T>) => string) | undefined) { this.engine.renderShortcutsHelpCallback = value }

	get getValidationTooltipCallback(): ((ctx: ValidationTooltipContext<T>) => string | null) | undefined {
		return this.engine.getValidationTooltipCallback
	}
	set getValidationTooltipCallback(value: ((ctx: ValidationTooltipContext<T>) => string | null) | undefined) {
		this.engine.getValidationTooltipCallback = value
	}

	get focusedRowIndex(): number | null { return this.engine.focusedRowIndex }
	/** Assignment is silent (no `focus-change`), like a native `input.value`. */
	set focusedRowIndex(value: number | null) { this.engine.focusedRowIndex = value }

	// Sorting & Pagination
	get sort(): SortState[] { return this.engine.sort }
	set sort(value: SortState[]) { this.engine.sort = value }

	get currentPage(): number { return this.engine.currentPage }
	set currentPage(value: number) { this.engine.currentPage = value }

	get totalItems(): number | null { return this.engine.totalItems }
	set totalItems(value: number | null) { this.engine.totalItems = value }

	get getPaginationLabelsCallback(): PaginationLabelsCallback<T> | undefined { return this.engine.getPaginationLabelsCallback }
	set getPaginationLabelsCallback(value: PaginationLabelsCallback<T> | undefined) { this.engine.getPaginationLabelsCallback = value }

	get renderSummaryCallback(): SummaryCallback<T> | undefined { return this.engine.renderSummaryCallback }
	set renderSummaryCallback(value: SummaryCallback<T> | undefined) { this.engine.renderSummaryCallback = value }

	get getRowClassCallback(): ((ctx: RowContext<T>) => string | null) | undefined { return this.engine.getRowClassCallback }
	set getRowClassCallback(value: ((ctx: RowContext<T>) => string | null) | undefined) { this.engine.getRowClassCallback = value }

	get summaryMetadata(): unknown { return this.engine.summaryMetadata }
	set summaryMetadata(value: unknown) { this.engine.summaryMetadata = value }

	// Row identification (`idMember` above; this is its computed twin)
	/** The row's id when `idMember` can't express it (`{ row }` → id). Wins over `idMember`. */
	get getIdCallback(): ((ctx: RowDataContext<T>) => unknown) | undefined { return this.engine.getIdCallback }
	set getIdCallback(value: ((ctx: RowDataContext<T>) => unknown) | undefined) { this.engine.getIdCallback = value }

	// Row locking
	get rowLocking(): RowLockingOptions<T> | undefined { return this.engine.rowLocking }
	set rowLocking(value: RowLockingOptions<T> | undefined) { this.engine.rowLocking = value }


	// Fill handle: `false` cancels the fill (async OK)
	/**
	 * Runs before a user action swaps the displayed rows — pager buttons, page-size change,
	 * header sort and filter-row changes in server mode (`ctx.trigger`: `'page'` / `'page-size'` /
	 * `'sort'` / `'filter'`; `fromPage`, `toPage`, `drafts`). `false` → stay; a number → go to
	 * that page instead; may be async (the pager is disabled meanwhile). Programmatic
	 * `currentPage` writes and infinite-scroll `load-more` skip it.
	 */
	get beforePageChangeCallback(): ((ctx: BeforePageChangeContext<T>) => boolean | number | void | Promise<boolean | number | void>) | undefined { return this.engine.beforePageChangeCallback }
	set beforePageChangeCallback(value: ((ctx: BeforePageChangeContext<T>) => boolean | number | void | Promise<boolean | number | void>) | undefined) { this.engine.beforePageChangeCallback = value }

	get beforeFillCallback(): ((ctx: FillContext<T>) => boolean | void | Promise<boolean | void>) | undefined { return this.engine.beforeFillCallback }
	set beforeFillCallback(value: ((ctx: FillContext<T>) => boolean | void | Promise<boolean | void>) | undefined) { this.engine.beforeFillCallback = value }

	// Scroll behavior

	// Virtual scroll

	// Infinite scroll

	get hasMoreItems(): boolean { return this.engine.hasMoreItems }
	set hasMoreItems(value: boolean) {
		this.engine.hasMoreItems = value
		if (!value) {
			this.virtualScroll.setIsLoadingMore(false)
			this.shadow?.querySelector('.wg__loading-more-row')?.remove()
			if (this.shadow) syncLoadingMoreLoader(this)
		}
	}

	// Paste
	/** Before a multi-cell paste: `false` cancels; add "row-col" keys to `ctx.skipCells` to skip cells (async OK). */
	get beforePasteCallback(): ((ctx: BeforePasteContext<T>) => boolean | void | Promise<boolean | void>) | undefined { return this.engine.beforePasteCallback }
	set beforePasteCallback(value: ((ctx: BeforePasteContext<T>) => boolean | void | Promise<boolean | void>) | undefined) { this.engine.beforePasteCallback = value }

	/** New row for pasted data past the last row. */
	get createRowCallback(): CreateRowCallback<T> | undefined { return this.engine.createRowCallback }
	set createRowCallback(value: CreateRowCallback<T> | undefined) { this.engine.createRowCallback = value }

	// Computed properties
	get displayItems(): T[] { this.flush(); return this.engine.displayItems }
	get totalPages(): number { this.flush(); return this.engine.totalPages }
	get isNavigateMode(): boolean { this.flush(); return this.engine.isNavigateMode }

	// Draft row methods
	getRowDraft(rowIndex: number): T | undefined { this.flush(); return this.engine.getRowDraft(rowIndex) }
	hasRowDraft(rowIndex: number): boolean { this.flush(); return this.engine.hasRowDraft(rowIndex) }
	getDraftRowIndices(): number[] { this.flush(); return this.engine.getDraftRowIndices() }
	/**
	 * Every unsaved draft `{ row, draftRow, changedFields, isValid }` — incl. rows on other
	 * pages, filtered out, or not in the current `items` (drafts are never pruned; they
	 * leave via `replaceRowById`, `discardDraft`, `discardAllDrafts`).
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
	/** The row with this ID (`idMember` / `getIdCallback`), or null. */
	getRowById(id: unknown): T | null { this.flush(); return this.engine.getRowById(id) }
	/** The row's display index (the `rowIndex` of every ctx / event), or -1 when it isn't displayed. */
	getRowIndex(row: T): number { this.flush(); return this.engine.getRowIndex(row) }

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
		// Nothing renders before the first build (core `defer` / first connect) — connect() renders.
		if (!this.#isBuilt) return
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

		// Focus — capture-phase, drives handleCellFocus + always-edit-mode swap + focus-change (keyboard only)
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
				// Treat clicks inside our popovers (the datepicker, outside the table) as
				// inside the grid — otherwise outsideClick fires while the user
				// is interacting with the picker/menu and tears down editing.
				const isPathInOwnedScope = (path: EventTarget[]): boolean => {
					const dpEl = this.datepicker?.getElement() ?? null
					for (const node of path) {
						if (dpEl && dpEl === node) return true
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
	 * Scroll the displayed row `rowIndex` into view (centred; the grid itself is brought on
	 * screen too). Resolves `true` once it is in view (after a frame), `false` when the index is
	 * out of range, the row isn't rendered (not built yet) or `beforeScrollCallback` skipped it.
	 */
	scrollToRow(rowIndex: number): Promise<boolean> {
		this.flush()
		return scrollRowIntoView(this, rowIndex, 'scroll-to-row')
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
			const rowHeight = this.engine.virtualScrollItemHeight
			const buffer = this.engine.virtualScrollOverscan

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
			container.toggleAttribute('inert', this.engine.isDisabled)

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
				const maxScrollTop = Math.max(0, this.engine.displayItems.length * this.engine.virtualScrollItemHeight - sc.clientHeight)
				if (sc.scrollTop > maxScrollTop) sc.scrollTop = maxScrollTop
			}
		} else {
			// Full rebuild path: first render, or structure changed (isTableBorderOnly toggled).
			if (oldContainer) oldContainer.remove()

			container = document.createElement('div')
			container.className = getContainerClasses(this)
			if (useVirtualScroll) container.classList.add('wg--virtual-scroll')
			container.toggleAttribute('inert', this.engine.isDisabled)

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
				const maxScrollTop = Math.max(0, this.engine.displayItems.length * this.engine.virtualScrollItemHeight - scrollContainer.clientHeight)
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
		if (this.engine.selectedRowIndices.length > 0) {
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

		// The infinite-scroll row's loader (core renderLoader) — redrawn into the new row
		syncLoadingMoreLoader(this)

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
	openGoToRowDialog(colIndex: number): void {
		openGoToRowDialogModule(this, colIndex)
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

// Every input as a typed property (core docs/usage.md "Typing the properties", rulebook C-CA-16):
// core installs the accessors at runtime, this declaration merge types them.
export interface GridElement<T = unknown> extends GridElementConfig<T> {}

// ── Responsive rules (core SPEC §6.7) ────────────────────────────────────────

/** The `configKey`s of the grid's input table — the only keys a responsive rule can set. */
export type GridInputKey = (typeof GridElement.inputs)[number]['configKey']

/**
 * The grid's input config as a responsive rule sees it ({@link GridElementConfig}).
 * Complex properties — `columns`, `items`, callbacks, UI state — are not inputs,
 * so a rule cannot set them (core warns and skips the key).
 */
export type GridResponsiveConfig = GridElementConfig

/** Partial grid configs per `device` class / width `breakpoint` (`{ device?, breakpoint? }`) — `el.responsive`, `window.components['web-grid'].responsive`. */
export type GridResponsiveMap = ResponsiveMap<GridResponsiveConfig>

/** Computed responsive rule — `el.responsiveCallback`, `window.components['web-grid'].responsiveCallback`. */
export type GridResponsiveCallback = ResponsiveCallback<GridResponsiveConfig>

export default GridElement

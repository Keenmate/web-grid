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
	RenderResult,
	ToolbarPosition,
	GridLabels,
	GridLabelsInput,
	GridIcons,
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
	GridRenderContext as GridCallbackContext,
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
	Draft,
	BeforePageChangeContext,
	GridBeforeScrollContext,
	GridScrollOptions
} from './interaction.js'
import { createGridController } from './controller.js'
import { toBoolOrAuto, toBoolOrNullAuto, toNumberOrLength, toPipeList, AREA_POSITIONS, PAGINATION_PARTS } from './converters.js'

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
	reconcileDropdownPresentation,
	repaintOpenDropdown,
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
	handleComboboxBlur,
	reanchorOpenDropdown
} from './modules/dropdown/index.js'

import {
	GridTooltips
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
	reconcileTabStop,
	untabCellWidgets,
	captureEditorText,
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
	commitOrCancelEditOnTransition as commitOrCancelEditOnTransitionModule,
	commitEditorValue
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
	getActiveToolbarRowIndex,
	getConnectorState,
	updateConnector,
	ToolbarService,
	removeInlineShortcuts,
	closeToolbarAndReset,
	repaintOpenToolbarIcons,
	attachToolbarListeners,
	renderConnector as renderConnectorModule,
	type ConnectorState
} from './modules/toolbar/index.js'

import { scrollRowIntoView } from './modules/scroll/reveal.js'
import {
	VirtualScrollService,
	visibleRowRange,
	handleVirtualScroll,
	renderVirtualRows,
	handleInfiniteScroll
} from './modules/scroll/index.js'

import {
	FilterRowService,
	attachFilterRowListeners,
	watchFilterRowText,
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
import { createColumnResize } from './modules/resize/index.js'
import { createColumnReorder, isReordering } from './modules/reorder/index.js'
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
import { GRID_ENGINE } from './modules/grid-context.js'
import { registerEngine } from './modules/engine-registry.js'
import { reconcileLoadingMoreLoader, removeAllLoaders } from './modules/rendering/loader.js'
import { writeGridAria } from './modules/rendering/aria.js'

// Core: reactive base class + the input-table converters. web-grid keeps its
// rich data/state property API (columns, items, UI state stay properties);
// core owns the SSR-safe base, the §12.3 instance registry, and — via the
// `static inputs` table below — the declarative *attribute* layer for the
// scalar/enum config flags (callbacks: property-only rows). See ../../CLAUDE.md and core SPEC §6.
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
	adoptStyles,
	ICON_CSS,
	isIconMap,
	keepScrollAcrossMove,
	type PointerDrag,
	type CustomStylesHandle,
	type CustomStylesOptions,
	type LoadStateCallback,
	type SaveStateCallback,
	type InputDef,
	type EventDef,
	type RenderLoadingCallback,
	type RenderIconCallback,
	type ResponsiveMap,
	type ResponsiveCallback,
	type EnvironmentSnapshot,
	resolvePresentation,
} from '@keenmate/web-components-core'
import { createMenuPresentationInputs, getMenuPresentationOptions } from '@keenmate/web-components-core/menu'
import type { MenuDrawerSide, MenuHandle, MenuPresentation } from '@keenmate/web-components-core/menu'
import { createLayer, type Layer, type LayerOptions } from '@keenmate/web-components-core/positioning'
import type { ParseNumberCallback, TranslateCallback } from '@keenmate/web-components-core/locale'

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
 * input rows — `columns`, `items`, structured config (menus, toolbars, shortcuts) and UI state are
 * plain element properties, not inputs.
 */
export interface GridElementConfig<T = unknown> {
	// Filtering & pagination
	/** Show the filter row (an input under the header of every column with `isFilterable: true`) and apply `filters`. Default: `false`. */
	isFilteringEnabled: boolean
	/**
	 * Who filters the rows. Default: `client`.
	 *
	 * - `client` — the grid filters `items` itself
	 * - `server` — the grid does not filter — handle `filter-change` (`{ filters }`) and replace `items`
	 */
	filterMode: 'client' | 'server'
	/** Split the rows into pages and show the pager. Default: `false`. */
	isPagingEnabled: boolean
	/** Rows per page (at least 1). Default: `10`. */
	pageSize: number
	/**
	 * Who pages the rows. Default: `client`.
	 *
	 * - `client` — the grid slices `items` into pages
	 * - `server` — `items` already is the current page — handle `data-request` and set `totalItems`
	 */
	paginationMode: 'client' | 'server'
	/**
	 * When the pager is shown. Default: `true`.
	 *
	 * - `true` — always
	 * - `false` — never
	 * - `auto` — hidden while there is at most one page
	 */
	isPaginationShown: boolean | 'auto'
	/**
	 * Where the pager sits: one area or several `|`-separated ones (`top-right|bottom-right`); any other value is refused. Default: `bottom-center`.
	 *
	 * - `top-left` — above the table, left
	 * - `top-center` — above the table, centered
	 * - `top-right` — above the table, right
	 * - `bottom-left` — below the table, left
	 * - `bottom-center` — below the table, centered
	 * - `bottom-right` — below the table, right
	 */
	paginationPosition: string
	/**
	 * The pager parts in order, `|`-separated (`first|previous|page-info|next|last`). Default: `page-size|previous|page-info|next`.
	 *
	 * - `first` — go to the first page
	 * - `previous` — go one page back
	 * - `page-info` — the "page X of Y" text
	 * - `next` — go one page forward
	 * - `last` — go to the last page
	 * - `page-size` — the rows-per-page selector (options from `pageSizes`)
	 */
	paginationLayout: string
	// Appearance
	/** Alternate the row background colors. Default: `true`. */
	isStriped: boolean
	/** Highlight the row under the pointer. Default: `true`. */
	isHoverable: boolean
	/** Draw the border around the table only, not around the pager / summary areas. Default: `false`. */
	isTableBorderOnly: boolean
	/** Make the grid its own scroll container, capped at `scrollMaxHeight`. Default: `false`. */
	isScrollable: boolean
	/** Max height of the scroll container while `isScrollable` is on — a CSS length; a number means pixels (`240` → `240px`); an invalid length is refused. Default: `100vh`. */
	scrollMaxHeight: string | number
	// Editing
	/** Allow editing cells (columns opt in with `isEditable`). Default: `false`. */
	isEditingEnabled: boolean
	/**
	 * How editing a cell starts (a column’s own `editTrigger` wins). Default: `dblclick`.
	 *
	 * - `click` — a single click opens the editor
	 * - `dblclick` — a double click opens the editor
	 * - `button` — an edit button in editable cells (on hover and in the focused cell); F2 / Enter too
	 * - `always` — every editable cell is always an editor
	 * - `navigate` — Excel-like: arrows move the focus, typing starts editing the focused cell
	 */
	editTrigger: EditTrigger
	/** Icon of the edit button — markup (`<span class="lucide-pencil"></span>`) as is, a token name (`pencil` → `--base-icon-pencil`), else text. Shown in editable cells with `editTrigger: 'button'` (or `column.isEditButtonShown`); its accessible name is `labels['ariaLabels.editCell']`, its title `labels['tooltips.editCell']`. Default: `✎`. */
	editButtonIcon: string
	/**
	 * Where the caret goes when an editor opens. Default: `mouse-position`.
	 *
	 * - `mouse-position` — at the clicked character
	 * - `select-all` — the whole value selected
	 * - `cursor-at-start` — caret before the first character
	 * - `cursor-at-end` — caret after the last character
	 */
	editStartSelection: EditStartSelection
	/** Clicking another cell while editing commits the value (through `beforeCommitCallback` / `validateCallback`); `false` discards it. Default: `true`. */
	shouldCommitOnClickAway: boolean
	/**
	 * Sets editing / selection defaults in one go; inputs set explicitly in the same batch win. Default: `excel`.
	 *
	 * - `read-only` — no editing, a click selects cells; also sets `isReadonly`
	 * - `excel` — editing on, `editTrigger: navigate`, a drag selects a cell range
	 * - `input-matrix` — every cell is always an editor (`editTrigger: always`), Shift+click selects cells, dropdowns open on focus
	 */
	preset: GridPreset
	/** Values cannot change (no edit / paste / fill / row add-delete-move); the grid stays focusable, selectable and copyable. Attribute `readonly` — presence decides (`readonly="false"` is still read-only), reflects. Default: `false`. */
	isReadonly: boolean
	/** No interaction at all (not focusable, dimmed). Attribute `disabled` — presence decides, reflects. Default: `false`. */
	isDisabled: boolean
	/**
	 * How a cell range is selected. In every mode but `none`, Shift+Arrow grows / shrinks the range from the focused cell. Default: `click`.
	 *
	 * - `none` — no cell-range selection
	 * - `click` — a drag selects; Shift+click extends from the focused cell
	 * - `shift` — Shift+click twice or Shift+drag selects
	 */
	cellSelectionMode: CellSelectionMode
	// Dropdown editor
	/**
	 * When the ▼ toggle of a dropdown cell is shown (a column’s own setting wins). Default: `always`.
	 *
	 * - `always` — in every dropdown cell
	 * - `on-focus` — only in the focused cell
	 */
	dropdownToggleVisibility: ToggleVisibility
	/** Open a dropdown editor as soon as its cell gets focus. Default: `true`. */
	shouldOpenDropdownOnFocus: boolean
	/** Enter on a dropdown cell opens the dropdown (`true`) or moves to the next row (`false`); a column’s own setting wins. Default: `false`. */
	shouldOpenDropdownOnEnter: boolean
	/** Checkbox cells toggle with one click, even in `navigate` mode. Default: `false`. */
	isCheckboxAlwaysEditable: boolean
	// Row numbers & indicators
	/** Show the row-number column (a click / Ctrl / Shift / drag on it selects rows). Default: `false`. */
	isRowNumbersShown: boolean
	/** Mark cells with unsaved changes (drafts). Default: `true`. */
	isDirtyIndicatorShown: boolean
	/** Keep the row-number column in place while scrolling horizontally. Default: `false`. */
	isStickyRowNumbers: boolean
	/** Freeze the first N columns while scrolling horizontally (counted after the reorder by `column.isFrozen`). Default: `0`. */
	frozenColumnCount: number
	// Row toolbar
	/** Show the row toolbar (`rowToolbar` entries) next to the hovered / focused row. Default: `false`. */
	isRowToolbarShown: boolean
	/**
	 * Vertical alignment of the row toolbar in the `left` / `right` positions. Default: `bottom`.
	 *
	 * - `top` — aligned to the row top (extends upwards)
	 * - `center` — centered on the row
	 * - `bottom` — aligned to the row bottom (extends downwards)
	 */
	toolbarVerticalAlign: 'top' | 'center' | 'bottom'
	/**
	 * Horizontal alignment of the row toolbar in the `top` position. Default: `center`.
	 *
	 * - `start` — at the start of the row / `toolbarColumn`
	 * - `center` — centered
	 * - `end` — at the end
	 * - `cursor` — at the pointer position
	 */
	toolbarHorizontalAlign: 'start' | 'center' | 'end' | 'cursor'
	/**
	 * How the row toolbar opens. Default: `hover`.
	 *
	 * - `hover` — on row hover
	 * - `click` — on a click in the row
	 * - `button` — from a trigger button in the row
	 */
	toolbarTrigger: 'hover' | 'click' | 'button'
	/**
	 * Preferred position of the row toolbar. Default: `auto`.
	 *
	 * - `auto` — the side with room
	 * - `left` — left of the row
	 * - `right` — right of the row
	 * - `top` — above the row (see `toolbarHorizontalAlign`, `toolbarColumn`)
	 * - `inline` — inside the row
	 */
	toolbarPosition: ToolbarPosition
	/** The row toolbar follows the pointer horizontally. Default: `false`. */
	shouldToolbarFollowCursor: boolean
	/** Horizontal offset of the cell toolbar: a number 0–1 is a fraction of the cell width, a string any CSS length (`2rem`). Default: `0.2`. */
	cellToolbarOffset: number | string
	// Context menu
	/** Horizontal offset (px) of the context menu from the click point. Default: `8`. */
	contextMenuXOffset: number
	/** Vertical offset (px) of the context menu from the click point. Default: `0`. */
	contextMenuYOffset: number
	// Shortcuts help
	/** Show the keyboard-shortcuts help icon. Default: `false`. */
	isShortcutsHelpShown: boolean
	/**
	 * Corner of the keyboard-shortcuts help icon. Default: `top-right`.
	 *
	 * - `top-right` — top right corner
	 * - `top-left` — top left corner
	 */
	shortcutsHelpPosition: 'top-right' | 'top-left'
	// Columns
	/** Default `min-width` of every column without its own `minWidth` — a CSS length; a number means pixels. Unset = none. */
	columnMinWidth: string | number | undefined
	/** Let the user drag headers to reorder columns. Default: `false`. */
	isColumnReorderAllowed: boolean
	/**
	 * Header-click sorting. Default: `none`.
	 *
	 * - `none` — sorting off
	 * - `single` — one sorted column at a time
	 * - `multiple` — several sorted columns (Ctrl+click adds a column)
	 */
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
	/**
	 * Where the summary bar (`renderSummaryCallback`) sits: one area or several `|`-separated ones, like `paginationPosition`. Unset = no summary.
	 *
	 * - `top-left` — above the table, left
	 * - `top-center` — above the table, centered
	 * - `top-right` — above the table, right
	 * - `bottom-left` — below the table, left
	 * - `bottom-center` — below the table, centered
	 * - `bottom-right` — below the table, right
	 */
	summaryPosition: string | null
	/** The summary shares one line with the pager when both sit in the same area. Default: `true`. */
	isSummaryInline: boolean
	// Virtual & infinite scroll
	/**
	 * Render only the visible rows (give the grid a capped height). Three values:
	 * - `false` (default) — every row rendered
	 * - `true` — always virtual
	 * - `null` — automatic (attribute `enable-virtual-scroll="auto"`): virtual once the displayed row count
	 *   reaches `virtualScrollThreshold`, re-checked on every render (so `items` growing / shrinking across it switches)
	 *
	 * Automatic is opt-in. Removing the attribute (or setting `undefined`) returns to the default `false`. Default: `false`.
	 */
	isVirtualScrollEnabled: boolean | null
	/** Displayed row count from which automatic virtual scroll (`isVirtualScrollEnabled` `"auto"` / `null`) turns on. Default: `100`. */
	virtualScrollThreshold: number
	/** Fixed row height (px) virtual scroll computes with. Default: `38`. */
	virtualScrollItemHeight: number
	/** Extra rows rendered above / below the viewport in virtual scroll. Default: `10`. */
	virtualScrollOverscan: number
	/** Ask for more rows (`data-request`, `trigger: load-more`) when scrolled near the end, until `hasMoreItems` is `false`. Default: `false`. */
	isInfiniteScrollEnabled: boolean
	/** Distance (px) from the bottom that triggers the next infinite-scroll load. Default: `100`. */
	infiniteScrollThreshold: number
	// New empty row
	/** Experimental: an always-present empty row for entering a new record. Default: `false`. */
	isNewRowEnabled: boolean
	/**
	 * Experimental: where the empty new row sits. Default: `bottom`.
	 *
	 * - `top` — above the data rows
	 * - `bottom` — below the data rows
	 */
	newRowPosition: NewRowPosition
	/** Experimental: text shown in the row-number cell of the empty new row. Default: `+`. */
	newRowIndicator: string
	// Tree
	/** Tree data: trust the order of `items` (the grid never re-sorts — pair with `data-request` for sort changes); `false` sorts siblings depth-first. Default: `false`. */
	isTreeDataSorted: boolean
	/**
	 * What a double-click on a tree-column cell does. Default: `none`.
	 *
	 * - `none` — nothing tree-specific (editing may start)
	 * - `toggle` — expands / collapses the row
	 */
	treeDoubleClickBehavior: TreeDoubleClickBehavior
	/** HTML / text of the chevron of an expanded tree row. Equal to `treeCollapsedGlyph` → CSS rotates the glyph; different → the glyph is swapped. Default: `▶`. */
	treeExpandedGlyph: string
	/** HTML / text of the chevron of a collapsed tree row. Default: `▶`. */
	treeCollapsedGlyph: string
	// Paste / clipboard
	/** Copying a cell range also copies the column headers. Default: `false`. */
	shouldCopyWithHeaders: boolean
	/**
	 * How a multi-cell paste treats cells that are not editable. Default: `skip-non-editable`.
	 *
	 * - `skip-non-editable` — skips them, pastes the rest
	 * - `all-columns` — pastes into them anyway
	 * - `editable-only` — refuses them (reported as skipped and invalid)
	 */
	pasteMode: PasteMode
	/** Run `validateCallback` on every pasted cell. Default: `true`. */
	shouldValidateOnPaste: boolean
	/**
	 * Fill-handle drag direction for the whole grid; a column’s own `fillDirection` wins. Default: `vertical`.
	 *
	 * - `vertical` — fills the source column only
	 * - `all` — also fills across columns
	 */
	fillDirection: FillDirection
	/** UI strings (i18n) — a partial object (JSON attribute `labels`) of flat `<elementType>.<name>` keys (`messages.noData`, `buttons.nextPage`, `menuItems.deleteRow`, …; or full `web-grid.*` keys) merged per key over the page-wide `window.components.locale.labels` and the English defaults; a dynamic label reads the context of its spot: `{ctx.count}`, `{ctx.currentPage}`, … Reads back what was assigned. */
	labels: GridLabelsInput | undefined
	/** BCP-47 locale for the numbers in labels (`{ctx.count}` items, page info, number-range errors), `editor: 'number'` columns (display, editor text, typed / pasted parse, copy) the date picker's month / weekday names and the text sort order (`cs` puts `ch` after `h`), or unset (the page-wide `window.components.locale`, else the browser language). UI strings are `labels`. */
	locale: string | null
	/**
	 * This grid's own number reader (core `parseNumber`, SPEC §12.24) for `editor: 'number'` columns — typed and pasted
	 * text: `({ text, locale, decimalSeparator, thousandsSeparator, parseDefault }) => number | null | undefined`.
	 * `null` = not a number (the cell turns invalid), `undefined` = not mine (the page-wide
	 * `window.components.locale.parseNumberCallback`, then core's strict parse — `'1.5'` in `de` is invalid).
	 */
	parseNumberCallback: ParseNumberCallback | null
	/** CSS for the grid's shadow root, after the page-wide `window.components['web-grid'].customStyles`. */
	customStyles: string | null
	/** Computes the instance CSS from the grid context; wins over `customStyles`. */
	getCustomStylesCallback: ((ctx: GridCallbackContext<T>) => string | null | undefined) | null
	/** Custom render for the grid's loading states (`ctx.context`: 'row' | 'search'); beats `window.components.renderLoadingCallback`. */
	renderLoadingCallback: RenderLoadingCallback | null
	/**
	 * This grid's icon hook (core `renderIcon`, SPEC §12.33): `(name, ctx) => markup | null` for the toolbar / row-action
	 * / edit-button / dropdown-option icons. Asked after the built-in names (`check`, `close`, … never reach it) and
	 * before the page-wide `window.components.renderIconCallback`; `null` / `undefined` = not mine (the next rule decides),
	 * `''` = no icon. `ctx`: `{ component, element, prefix: 'wg' }` + `item` (toolbar / row action) or `option` (dropdown).
	 */
	renderIconCallback: RenderIconCallback | null
	/**
	 * Icon overrides by name (core `renderIcon`, SPEC §12.33) — like `labels`, for icons. The grid's own names
	 * ({@link GridIconName}): `add`, `delete`, `duplicate`, `move-up`, `move-down`, `expand`, `collapse`,
	 * `expand-subtree`, `collapse-subtree`, `expand-all`, `collapse-all`, `sort-asc`, `sort-desc`, `clear-sort`,
	 * `hide-column`, `freeze-column`, `unfreeze-column`, `column-visibility`, `calendar`, `prev-month`, `next-month`,
	 * `shortcuts-help`, `header-info`. Asked before `window.components.icons` and the built-in names; a change repaints in place.
	 */
	icons: GridIcons | undefined
	/**
	 * This grid's translation hook (core `createLabels`, SPEC §12.24): `({ component, key, template, params, locale })
	 * => string | null` for every label key this grid's own `labels` did not set (`key` is the full
	 * `web-grid.<elementType>.<name>`). Asked before the page-wide `window.components.locale.translateCallback`;
	 * `null` / `undefined` = not mine (the page hook, then the default `{ctx.*}` formatting). A change re-renders the texts.
	 */
	translateCallback: TranslateCallback | null
	/** Runs before the grid scrolls a cell / row into view on its own: `false` skips, a partial `options` replaces the defaults (synchronous). */
	beforeScrollCallback: ((ctx: GridBeforeScrollContext<T>) => false | Partial<GridScrollOptions> | void) | null
	/** Delay (ms) before a cell tooltip shows. Default: `200`. */
	tooltipShowDelay: number
	/** Delay (ms) before a cell tooltip hides. Default: `100`. */
	tooltipHideDelay: number
	/**
	 * Scope the "one overlay open at a time" coordination to a named group. Overlays
	 * (the cell dropdown, the row toolbar with a click / button trigger, multiselects, datepickers,
	 * external popovers) sharing a group dismiss each other when one opens; different groups are
	 * independent. Unset = the default (ungrouped) group, in which every ungrouped overlay
	 * coordinates. Read when the cell dropdown / date editor / row toolbar opens.
	 * (internal: overlayGroup)
	 */
	overlayGroup: string | null
	// Row identity & tree data
	/** Field that uniquely identifies a row (default `'id'`; `null` / `''` = none). `getIdCallback` wins when set. Attribute `id-member`. */
	idMember: string | null
	/** Tree data: the field holding a row’s path (`"1.2.3"`); setting it turns the grid into a tree. Attribute `path-member`. */
	pathMember: string | null
	/** Tree data: the field holding a row’s depth, when the data has levels instead of paths. Attribute `level-member`. */
	levelMember: string | null
	/** Tree data: the field holding the parent row’s path. Attribute `parent-path-member`. */
	parentPathMember: string | null
	/** Tree data: the path separator. `null` = auto-detect. Attribute `tree-path-separator`. */
	treePathSeparator: string | null
	/** Tree data: show the tree to this depth (`0` = only the roots, …), a whole number ≥ 0. `null` = everything expanded. Attribute `expand-level`. */
	expandLevel: number | null
	/** Static row editability for the whole grid (`getIsRowEditableCallback` decides per row). Attribute `row-editable`. */
	isRowEditable: boolean | null
	/** Min width (CSS length; a number = px) of the row toolbar buttons; overrides `--wg-toolbar-btn-min-width`. Attribute `toolbar-btn-min-width`. */
	toolbarBtnMinWidth: string | undefined
	// Callbacks (property-only)
	/** Decides editability per row: `(ctx: { row }) => boolean`. */
	getIsRowEditableCallback: ((ctx: RowDataContext<T>) => boolean) | null | undefined
	/** The row's id when `idMember` can't express it (`{ row }` → id). Wins over `idMember`. */
	getIdCallback: ((ctx: RowDataContext<T>) => unknown) | null | undefined
	/** Dynamic CSS class of a row: `(ctx: { row, rowIndex }) => string | null`. */
	getRowClassCallback: ((ctx: RowContext<T>) => string | null) | null | undefined
	/** Custom HTML of the validation-error tooltip (grid-level default; a column’s own wins): `(ctx: CellContext & { error }) => string | null`. */
	getValidationTooltipCallback: ((ctx: ValidationTooltipContext<T>) => string | null) | null | undefined
	/** Customize / translate the pager texts: `(ctx: { currentPage, totalPages, totalItems, pageSize, count }) => Partial<PaginationLabels>`. */
	getPaginationLabelsCallback: PaginationLabelsCallback<T> | null | undefined
	/** The summary bar HTML (`summaryPosition`): `(ctx: { items, allItems, totalItems, currentPage, pageSize, metadata, drafts }) => string`. */
	renderSummaryCallback: SummaryCallback<T> | null | undefined
	/** Custom HTML of a tree row’s chevron: `(ctx) => string`. */
	renderChevronCallback: ChevronCallback<T> | null | undefined
	/** Custom HTML shown alongside the keyboard-shortcuts list: `(ctx) => string`. */
	renderShortcutsHelpCallback: ((ctx: GridCallbackContext<T>) => RenderResult) | null | undefined
	/** Before the cell menu opens (sync): `false` → no grid menu; an entries array → shown instead. */
	beforeContextMenuOpenCallback: ((ctx: CellContext<T>) => false | GridMenuEntry<T>[] | void) | null | undefined
	/** Before the header menu opens (sync): `false` → no grid menu; an entries array → shown instead. */
	beforeHeaderMenuOpenCallback: ((ctx: HeaderMenuContext<T>) => false | GridHeaderMenuEntry<T>[] | void) | null | undefined
	/** Before any toolbar / menu / shortcut item activates: `false` cancels (async OK). */
	beforeActionCallback: ((detail: GridActionEventDetail<T>) => unknown) | null | undefined
	/**
	 * Runs before a user action swaps the displayed rows — pager buttons, page-size change,
	 * header sort and filter-row changes in server mode (`ctx.trigger`: `'page'` / `'page-size'` /
	 * `'sort'` / `'filter'`; `fromPage`, `toPage`, `drafts`). `false` → stay; a number → go to
	 * that page instead; may be async (the pager is disabled meanwhile). Programmatic
	 * `currentPage` writes and infinite-scroll `load-more` skip it.
	 */
	beforePageChangeCallback: ((ctx: BeforePageChangeContext<T>) => boolean | number | void | Promise<boolean | number | void>) | null | undefined
	/** Runs before a fill-handle drag applies: `(ctx: { sourceCell, targetCells, direction }) => boolean | void | Promise<…>`; `false` cancels (async OK). */
	beforeFillCallback: ((ctx: FillContext<T>) => boolean | void | Promise<boolean | void>) | null | undefined
	/** Before a multi-cell paste: `false` cancels; add "row-col" keys to `ctx.skipCells` to skip cells (async OK). */
	beforePasteCallback: ((ctx: BeforePasteContext<T>) => boolean | void | Promise<boolean | void>) | null | undefined
	/** New row for pasted data past the last row. */
	createRowCallback: CreateRowCallback<T> | null | undefined
	/** The row the `add` built-in (and the experimental new row) inserts: `(ctx) => T | Promise<T>`. Default: a blank row. */
	createEmptyRowCallback: ((ctx: GridCallbackContext<T>) => T | Promise<T>) | null | undefined
	/** The copy the `duplicate` built-in inserts (default: shallow copy, `idMember` cleared). */
	createDuplicateRowCallback: ((ctx: RowContext<T>) => T) | null | undefined
	// Menus (core createMenuPresentationInputs(), SPEC §12.13 — the same inputs on every menu host)
	/**
	 * How the cell and column-header menus open: `auto` (default — a bottom sheet on a phone,
	 * the floating menu elsewhere), `floating`, `sheet` (bottom sheet) or `drawer` (full-height
	 * side panel on `menuSide`). Read when a menu opens; per device / width through the
	 * responsive rules.
	 * (internal: menuPresentation)
	 */
	menuPresentation: MenuPresentation
	/**
	 * The edge a `drawer` menu slides in from: `start` (default — left in LTR, right in RTL) or `end`.
	 * (internal: menuSide)
	 */
	menuSide: MenuDrawerSide
}

/**
 * GridElement - the `<web-grid>` custom element
 *
 * Extends {@link BlissElement} (SSR-safe base + §12.3 registry) and composes
 * a private internal engine for the grid state.
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
export class GridElement<T = unknown> extends BlissElement<GridEventMap<T>, GridController<T>> {
	// ── Declarative attribute layer (core input table) ────────────────────────
	// Every row here is a scalar/enum config flag exposed as a kebab HTML
	// attribute AND a reactive property, or a property-only callback (core
	// installs the accessor; GridElementConfig types it). `default` mirrors the GridEngine field initializer so a fresh
	// element behaves identically. `on: 'update'` → each change is bridged into
	// `this.#engine` (see `update()`), whose setter re-renders. Structured config
	// (columns/items/menus/toolbars/shortcuts), self-mutated UI state (currentPage, sort,
	// filters, focusedRowIndex, totalItems, expandedPaths, hasMoreItems)
	// deliberately stay property-only.
	// `as const` keeps the configKey literals: they type GridResponsiveConfig.
	/** The core input table (read by BlissElement; `GridInputKey` is derived from it). @ignore */
	static inputs = [
		// Filtering & pagination
		{ configKey: 'isFilteringEnabled', attribute: 'enable-filtering', converter: toBool('default-false'), default: false, on: 'update', description: 'Show the filter row (an input under the header of every column with `isFilterable: true`) and apply `filters`. Default: `false`.' },
		{ configKey: 'filterMode', attribute: 'filter-mode', converter: toEnum(FILTER_MODES, { default: 'client' }), default: 'client', on: 'update', description: `Who filters the rows. Default: \`client\`.

- \`client\` — the grid filters \`items\` itself
- \`server\` — the grid does not filter — handle \`filter-change\` (\`{ filters }\`) and replace \`items\`` },
		{ configKey: 'isPagingEnabled', attribute: 'enable-paging', converter: toBool('default-false'), default: false, on: 'update', description: 'Split the rows into pages and show the pager. Default: `false`.' },
		{ configKey: 'pageSize', attribute: 'page-size', converter: toInt({ min: 1, default: 10 }), default: 10, on: 'update', description: 'Rows per page (at least 1). Default: `10`.' },
		{ configKey: 'paginationMode', attribute: 'pagination-mode', converter: toEnum(PAGINATION_MODES, { default: 'client' }), default: 'client', on: 'update', description: `Who pages the rows. Default: \`client\`.

- \`client\` — the grid slices \`items\` into pages
- \`server\` — \`items\` already is the current page — handle \`data-request\` and set \`totalItems\`` },
		{ configKey: 'isPaginationShown', attribute: 'show-pagination', converter: toBoolOrAuto(true), default: true, on: 'update', type: "boolean | 'auto'", description: `When the pager is shown. Default: \`true\`.

- \`true\` — always
- \`false\` — never
- \`auto\` — hidden while there is at most one page` },
		{ configKey: 'paginationPosition', attribute: 'pagination-position', converter: toPipeList(AREA_POSITIONS, { default: 'bottom-center' }), default: 'bottom-center', on: 'update', type: 'string', description: `Where the pager sits: one area or several \`|\`-separated ones (\`top-right|bottom-right\`); any other value is refused. Default: \`bottom-center\`.

- \`top-left\` — above the table, left
- \`top-center\` — above the table, centered
- \`top-right\` — above the table, right
- \`bottom-left\` — below the table, left
- \`bottom-center\` — below the table, centered
- \`bottom-right\` — below the table, right` },
		{ configKey: 'paginationLayout', attribute: 'pagination-layout', converter: toPipeList(PAGINATION_PARTS, { default: 'page-size|previous|page-info|next' }), default: 'page-size|previous|page-info|next', on: 'update', type: 'string', description: `The pager parts in order, \`|\`-separated (\`first|previous|page-info|next|last\`). Default: \`page-size|previous|page-info|next\`.

- \`first\` — go to the first page
- \`previous\` — go one page back
- \`page-info\` — the "page X of Y" text
- \`next\` — go one page forward
- \`last\` — go to the last page
- \`page-size\` — the rows-per-page selector (options from \`pageSizes\`)` },
		// Appearance
		{ configKey: 'isStriped', attribute: 'striped', converter: toBool('default-true'), default: true, on: 'update', description: 'Alternate the row background colors. Default: `true`.' },
		{ configKey: 'isHoverable', attribute: 'hoverable', converter: toBool('default-true'), default: true, on: 'update', description: 'Highlight the row under the pointer. Default: `true`.' },
		{ configKey: 'isTableBorderOnly', attribute: 'table-border-only', converter: toBool('default-false'), default: false, on: 'update', description: 'Draw the border around the table only, not around the pager / summary areas. Default: `false`.' },
		{ configKey: 'isScrollable', attribute: 'scrollable', converter: toBool('default-false'), default: false, on: 'update', description: 'Make the grid its own scroll container, capped at `scrollMaxHeight`. Default: `false`.' },
		{ configKey: 'scrollMaxHeight', attribute: 'scroll-max-height', converter: toCssLength({ default: '100vh' }), default: '100vh', on: 'update', type: 'string | number', description: 'Max height of the scroll container while `isScrollable` is on — a CSS length; a number means pixels (`240` → `240px`); an invalid length is refused. Default: `100vh`.' },
		// Editing
		{ configKey: 'isEditingEnabled', attribute: 'enable-editing', converter: toBool('default-false'), default: false, on: 'update', description: 'Allow editing cells (columns opt in with `isEditable`). Default: `false`.' },
		{ configKey: 'editTrigger', attribute: 'edit-trigger', converter: toEnum(EDIT_TRIGGERS, { default: 'dblclick' }), default: 'dblclick', on: 'update', description: `How editing a cell starts (a column’s own \`editTrigger\` wins). Default: \`dblclick\`.

- \`click\` — a single click opens the editor
- \`dblclick\` — a double click opens the editor
- \`button\` — an edit button in editable cells (on hover and in the focused cell); F2 / Enter too
- \`always\` — every editable cell is always an editor
- \`navigate\` — Excel-like: arrows move the focus, typing starts editing the focused cell` },
		// HTML of the edit button (editTrigger 'button'), e.g. '<span class="lucide-pencil"></span>'
		{ configKey: 'editButtonIcon', attribute: 'edit-button-icon', converter: toText({ default: '✎' }), default: '✎', on: 'update', description: 'Icon of the edit button — markup (`<span class="lucide-pencil"></span>`) as is, a token name (`pencil` → `--base-icon-pencil`), else text. Shown in editable cells with `editTrigger: \'button\'` (or `column.isEditButtonShown`); its accessible name is `labels[\'ariaLabels.editCell\']`, its title `labels[\'tooltips.editCell\']`. Default: `✎`.' },
		{ configKey: 'editStartSelection', attribute: 'edit-start-selection', converter: toEnum(EDIT_START_SELECTIONS, { default: 'mouse-position' }), default: 'mouse-position', on: 'update', description: `Where the caret goes when an editor opens. Default: \`mouse-position\`.

- \`mouse-position\` — at the clicked character
- \`select-all\` — the whole value selected
- \`cursor-at-start\` — caret before the first character
- \`cursor-at-end\` — caret after the last character` },
		{ configKey: 'shouldCommitOnClickAway', attribute: 'commit-on-click-away', converter: toBool('default-true'), default: true, on: 'update', description: 'Clicking another cell while editing commits the value (through `beforeCommitCallback` / `validateCallback`); `false` discards it. Default: `true`.' },
		// A preset: also sets isEditingEnabled / isReadonly / editTrigger / dropdown flags / cellSelectionMode
		// in the same batch; inputs set explicitly in that batch win (core getBatchValuesCallback).
		{ configKey: 'preset', attribute: 'preset', converter: toEnum(GRID_PRESETS_LIST, { default: 'excel' }), default: 'excel', on: 'update', description: `Sets editing / selection defaults in one go; inputs set explicitly in the same batch win. Default: \`excel\`.

- \`read-only\` — no editing, a click selects cells; also sets \`isReadonly\`
- \`excel\` — editing on, \`editTrigger: navigate\`, a drag selects a cell range
- \`input-matrix\` — every cell is always an editor (\`editTrigger: always\`), Shift+click selects cells, dropdowns open on focus`,
			getBatchValuesCallback: (preset) => GRID_PRESETS[preset as GridPreset] ?? null },
		// Values can't change; still focusable / selectable / copyable (the read-only preset sets it).
		// Native rule (core SPEC §6.4): the attribute's presence decides, `readonly="false"` is still read-only; reflects.
		{ configKey: 'isReadonly', attribute: 'readonly', converter: toBool('presence'), default: false, on: 'update', shouldReflect: true, description: 'Values cannot change (no edit / paste / fill / row add-delete-move); the grid stays focusable, selectable and copyable. Attribute `readonly` — presence decides (`readonly="false"` is still read-only), reflects. Default: `false`.' },
		// No interaction at all (applied via core disabledChanged(), not update()); presence rule, reflects
		{ configKey: 'isDisabled', attribute: 'disabled', converter: toBool('presence'), default: false, on: 'update', shouldReflect: true, description: 'No interaction at all (not focusable, dimmed). Attribute `disabled` — presence decides, reflects. Default: `false`.' },
		{ configKey: 'cellSelectionMode', attribute: 'cell-selection-mode', converter: toEnum(CELL_SELECTION_MODES, { default: 'click' }), default: 'click', on: 'update', description: `How a cell range is selected. In every mode but \`none\`, Shift+Arrow grows / shrinks the range from the focused cell. Default: \`click\`.

- \`none\` — no cell-range selection
- \`click\` — a drag selects; Shift+click extends from the focused cell
- \`shift\` — Shift+click twice or Shift+drag selects` },
		// Dropdown editor
		{ configKey: 'dropdownToggleVisibility', attribute: 'dropdown-toggle-visibility', converter: toEnum(TOGGLE_VISIBILITIES, { default: 'always' }), default: 'always', on: 'update', description: `When the ▼ toggle of a dropdown cell is shown (a column’s own setting wins). Default: \`always\`.

- \`always\` — in every dropdown cell
- \`on-focus\` — only in the focused cell` },
		{ configKey: 'shouldOpenDropdownOnFocus', attribute: 'open-dropdown-on-focus', converter: toBool('default-true'), default: true, on: 'update', description: 'Open a dropdown editor as soon as its cell gets focus. Default: `true`.' },
		{ configKey: 'shouldOpenDropdownOnEnter', attribute: 'open-dropdown-on-enter', converter: toBool('default-false'), default: false, on: 'update', description: 'Enter on a dropdown cell opens the dropdown (`true`) or moves to the next row (`false`); a column’s own setting wins. Default: `false`.' },
		{ configKey: 'isCheckboxAlwaysEditable', attribute: 'checkbox-always-editable', converter: toBool('default-false'), default: false, on: 'update', description: 'Checkbox cells toggle with one click, even in `navigate` mode. Default: `false`.' },
		// Row numbers & indicators
		{ configKey: 'isRowNumbersShown', attribute: 'show-row-numbers', converter: toBool('default-false'), default: false, on: 'update', description: 'Show the row-number column (a click / Ctrl / Shift / drag on it selects rows). Default: `false`.' },
		{ configKey: 'isDirtyIndicatorShown', attribute: 'show-dirty-indicator', converter: toBool('default-true'), default: true, on: 'update', description: 'Mark cells with unsaved changes (drafts). Default: `true`.' },
		{ configKey: 'isStickyRowNumbers', attribute: 'sticky-row-numbers', converter: toBool('default-false'), default: false, on: 'update', description: 'Keep the row-number column in place while scrolling horizontally. Default: `false`.' },
		{ configKey: 'frozenColumnCount', attribute: 'frozen-column-count', converter: toInt({ min: 0, default: 0 }), default: 0, on: 'update', description: 'Freeze the first N columns while scrolling horizontally (counted after the reorder by `column.isFrozen`). Default: `0`.' },
		// Row toolbar
		{ configKey: 'isRowToolbarShown', attribute: 'show-row-toolbar', converter: toBool('default-false'), default: false, on: 'update', description: 'Show the row toolbar (`rowToolbar` entries) next to the hovered / focused row. Default: `false`.' },
		{ configKey: 'toolbarVerticalAlign', attribute: 'toolbar-vertical-align', converter: toEnum(TOOLBAR_VERTICAL_ALIGNS, { default: 'bottom' }), default: 'bottom', on: 'update', description: `Vertical alignment of the row toolbar in the \`left\` / \`right\` positions. Default: \`bottom\`.

- \`top\` — aligned to the row top (extends upwards)
- \`center\` — centered on the row
- \`bottom\` — aligned to the row bottom (extends downwards)` },
		{ configKey: 'toolbarHorizontalAlign', attribute: 'toolbar-horizontal-align', converter: toEnum(TOOLBAR_HORIZONTAL_ALIGNS, { default: 'center' }), default: 'center', on: 'update', description: `Horizontal alignment of the row toolbar in the \`top\` position. Default: \`center\`.

- \`start\` — at the start of the row / \`toolbarColumn\`
- \`center\` — centered
- \`end\` — at the end
- \`cursor\` — at the pointer position` },
		{ configKey: 'toolbarTrigger', attribute: 'toolbar-trigger', converter: toEnum(TOOLBAR_TRIGGERS, { default: 'hover' }), default: 'hover', on: 'update', description: `How the row toolbar opens. Default: \`hover\`.

- \`hover\` — on row hover
- \`click\` — on a click in the row
- \`button\` — from a trigger button in the row` },
		{ configKey: 'toolbarPosition', attribute: 'toolbar-position', converter: toEnum(TOOLBAR_POSITIONS, { default: 'auto' }), default: 'auto', on: 'update', description: `Preferred position of the row toolbar. Default: \`auto\`.

- \`auto\` — the side with room
- \`left\` — left of the row
- \`right\` — right of the row
- \`top\` — above the row (see \`toolbarHorizontalAlign\`, \`toolbarColumn\`)
- \`inline\` — inside the row` },
		{ configKey: 'shouldToolbarFollowCursor', attribute: 'toolbar-follow-cursor', converter: toBool('default-false'), default: false, on: 'update', description: 'The row toolbar follows the pointer horizontally. Default: `false`.' },
		{ configKey: 'cellToolbarOffset', attribute: 'cell-toolbar-offset', converter: toNumberOrLength(0.2), default: 0.2, on: 'update', type: 'number | string', description: 'Horizontal offset of the cell toolbar: a number 0–1 is a fraction of the cell width, a string any CSS length (`2rem`). Default: `0.2`.' },
		// Context menu
		{ configKey: 'contextMenuXOffset', attribute: 'context-menu-x-offset', converter: toInt({ default: 8 }), default: 8, on: 'update', description: 'Horizontal offset (px) of the context menu from the click point. Default: `8`.' },
		{ configKey: 'contextMenuYOffset', attribute: 'context-menu-y-offset', converter: toInt({ default: 0 }), default: 0, on: 'update', description: 'Vertical offset (px) of the context menu from the click point. Default: `0`.' },
		// Shortcuts help
		{ configKey: 'isShortcutsHelpShown', attribute: 'show-shortcuts-help', converter: toBool('default-false'), default: false, on: 'update', description: 'Show the keyboard-shortcuts help icon. Default: `false`.' },
		{ configKey: 'shortcutsHelpPosition', attribute: 'shortcuts-help-position', converter: toEnum(SHORTCUTS_HELP_POSITIONS, { default: 'top-right' }), default: 'top-right', on: 'update', description: `Corner of the keyboard-shortcuts help icon. Default: \`top-right\`.

- \`top-right\` — top right corner
- \`top-left\` — top left corner` },
		// Columns
		{ configKey: 'columnMinWidth', attribute: 'column-min-width', converter: toCssLength(), on: 'update', type: 'string | number | undefined', description: 'Default `min-width` of every column without its own `minWidth` — a CSS length; a number means pixels. Unset = none.' },
		{ configKey: 'isColumnReorderAllowed', attribute: 'allow-column-reorder', converter: toBool('default-false'), default: false, on: 'update', description: 'Let the user drag headers to reorder columns. Default: `false`.' },
		{ configKey: 'sortMode', attribute: 'sort-mode', converter: toEnum(SORT_MODES, { default: 'none' }), default: 'none', on: 'update', description: `Header-click sorting. Default: \`none\`.

- \`none\` — sorting off
- \`single\` — one sorted column at a time
- \`multiple\` — several sorted columns (Ctrl+click adds a column)` },
		// Persisted UI state (core createStateStore(), SPEC §12.17 / rulebook C-CA-17): column widths / order
		// the user arranged, kept under `storage-key` (localStorage `km-state:web-grid:<key>`, or the callbacks).
		{ configKey: 'storageKey', attribute: 'storage-key', converter: toText({ isNullable: true }), default: null, on: 'update', type: 'string | null', description: 'Key of the persisted column state (widths / order the user arranged; core SPEC §12.17). Unset / empty = off; set = localStorage `km-state:web-grid:<key>`, or `loadStateCallback` / `saveStateCallback`.' },
		{ configKey: 'shouldPersistColumnWidths', attribute: 'persist-column-widths', converter: toBool('default-false'), default: false, on: 'update', description: 'Persist the column widths the user resized to (needs `storage-key`).' },
		{ configKey: 'shouldPersistColumnOrder', attribute: 'persist-column-order', converter: toBool('default-false'), default: false, on: 'update', description: 'Persist the column order the user dragged to (needs `storage-key`).' },
		{ configKey: 'loadStateCallback', converter: toFunction<LoadStateCallback<GridPersistenceState>>(), on: 'update', type: 'LoadStateCallback<GridPersistenceState> | null', description: 'Persisted column state source: `(ctx) => GridPersistenceState | null | Promise<…>`, `ctx`: `{ key }` + context. Set both callbacks; either one alone switches localStorage off.' },
		{ configKey: 'saveStateCallback', converter: toFunction<SaveStateCallback<GridPersistenceState>>(), on: 'none', type: 'SaveStateCallback<GridPersistenceState> | null', description: 'Persisted column state sink: `ctx`: `{ key, state }` + context, `state` = the WHOLE `GridPersistenceState` (`{ columnWidths?, columnOrder? }`). Set both callbacks; either one alone switches localStorage off.' },
		// Summary
		{ configKey: 'summaryPosition', attribute: 'summary-position', converter: toPipeList(AREA_POSITIONS, { isNullable: true }), default: null, on: 'update', type: 'string | null', description: `Where the summary bar (\`renderSummaryCallback\`) sits: one area or several \`|\`-separated ones, like \`paginationPosition\`. Unset = no summary.

- \`top-left\` — above the table, left
- \`top-center\` — above the table, centered
- \`top-right\` — above the table, right
- \`bottom-left\` — below the table, left
- \`bottom-center\` — below the table, centered
- \`bottom-right\` — below the table, right` },
		{ configKey: 'isSummaryInline', attribute: 'summary-inline', converter: toBool('default-true'), default: true, on: 'update', description: 'The summary shares one line with the pager when both sit in the same area. Default: `true`.' },
		// Virtual & infinite scroll
		{ configKey: 'isVirtualScrollEnabled', attribute: 'enable-virtual-scroll', converter: toBoolOrNullAuto(false), default: false, on: 'update', type: 'boolean | null', description: 'Render only the visible rows (give the grid a capped height). `true` / `false` force virtual scroll on / off; `"auto"` (property: `null`) opts in to automatic: virtual once the displayed rows reach `virtualScrollThreshold`. Default: `false`.' },
		{ configKey: 'virtualScrollThreshold', attribute: 'virtual-scroll-threshold', converter: toInt({ min: 0, default: 100 }), default: 100, on: 'update', description: 'Displayed row count from which automatic virtual scroll (`isVirtualScrollEnabled` `"auto"` / `null`) turns on. Default: `100`.' },
		{ configKey: 'virtualScrollItemHeight', attribute: 'virtual-scroll-item-height', converter: toInt({ min: 1, default: 38 }), default: 38, on: 'update', description: 'Fixed row height (px) virtual scroll computes with. Default: `38`.' },
		{ configKey: 'virtualScrollOverscan', attribute: 'virtual-scroll-overscan', converter: toInt({ min: 0, default: 10 }), default: 10, on: 'update', description: 'Extra rows rendered above / below the viewport in virtual scroll. Default: `10`.' },
		{ configKey: 'isInfiniteScrollEnabled', attribute: 'enable-infinite-scroll', converter: toBool('default-false'), default: false, on: 'update', description: 'Ask for more rows (`data-request`, `trigger: load-more`) when scrolled near the end, until `hasMoreItems` is `false`. Default: `false`.' },
		{ configKey: 'infiniteScrollThreshold', attribute: 'infinite-scroll-threshold', converter: toInt({ min: 0, default: 100 }), default: 100, on: 'update', description: 'Distance (px) from the bottom that triggers the next infinite-scroll load. Default: `100`.' },
		// New empty row
		{ configKey: 'isNewRowEnabled', attribute: 'enable-new-row', converter: toBool('default-false'), default: false, on: 'update', description: 'Experimental: an always-present empty row for entering a new record. Default: `false`.' },
		{ configKey: 'newRowPosition', attribute: 'new-row-position', converter: toEnum(NEW_ROW_POSITIONS, { default: 'bottom' }), default: 'bottom', on: 'update', description: `Experimental: where the empty new row sits. Default: \`bottom\`.

- \`top\` — above the data rows
- \`bottom\` — below the data rows` },
		{ configKey: 'newRowIndicator', attribute: 'new-row-indicator', converter: toText({ default: '+' }), default: '+', on: 'update', description: 'Experimental: text shown in the row-number cell of the empty new row. Default: `+`.' },
		// Tree
		{ configKey: 'isTreeDataSorted', attribute: 'tree-data-sorted', converter: toBool('default-false'), default: false, on: 'update', description: 'Tree data: trust the order of `items` (the grid never re-sorts — pair with `data-request` for sort changes); `false` sorts siblings depth-first. Default: `false`.' },
		{ configKey: 'treeDoubleClickBehavior', attribute: 'tree-double-click-behavior', converter: toEnum(TREE_DOUBLE_CLICK_BEHAVIORS, { default: 'none' }), default: 'none', on: 'update', description: `What a double-click on a tree-column cell does. Default: \`none\`.

- \`none\` — nothing tree-specific (editing may start)
- \`toggle\` — expands / collapses the row` },
		{ configKey: 'treeExpandedGlyph', attribute: 'tree-expanded-glyph', converter: toText({ default: '▶' }), default: '▶', on: 'update', description: 'HTML / text of the chevron of an expanded tree row. Equal to `treeCollapsedGlyph` → CSS rotates the glyph; different → the glyph is swapped. Default: `▶`.' },
		{ configKey: 'treeCollapsedGlyph', attribute: 'tree-collapsed-glyph', converter: toText({ default: '▶' }), default: '▶', on: 'update', description: 'HTML / text of the chevron of a collapsed tree row. Default: `▶`.' },
		// Paste / clipboard
		{ configKey: 'shouldCopyWithHeaders', attribute: 'copy-with-headers', converter: toBool('default-false'), default: false, on: 'update', description: 'Copying a cell range also copies the column headers. Default: `false`.' },
		{ configKey: 'pasteMode', attribute: 'paste-mode', converter: toEnum(PASTE_MODES, { default: 'skip-non-editable' }), default: 'skip-non-editable', on: 'update', description: `How a multi-cell paste treats cells that are not editable. Default: \`skip-non-editable\`.

- \`skip-non-editable\` — skips them, pastes the rest
- \`all-columns\` — pastes into them anyway
- \`editable-only\` — refuses them (reported as skipped and invalid)` },
		{ configKey: 'shouldValidateOnPaste', attribute: 'validate-on-paste', converter: toBool('default-true'), default: true, on: 'update', description: 'Run `validateCallback` on every pasted cell. Default: `true`.' },
		// Fill handle — grid-wide drag direction; a column's own `fillDirection` wins
		{ configKey: 'fillDirection', attribute: 'fill-direction', converter: toEnum(FILL_DIRECTIONS, { default: 'vertical' }), default: 'vertical', on: 'update', description: `Fill-handle drag direction for the whole grid; a column’s own \`fillDirection\` wins. Default: \`vertical\`.

- \`vertical\` — fills the source column only
- \`all\` — also fills across columns` },
		// UI strings (i18n): a partial object (also a JSON attribute) merged per key over the
		// English defaults — flat `<elementType>.<name>` keys: `messages.noData`, `buttons.nextPage`, `menuItems.*`, … (see labels.ts)
		{ configKey: 'labels', attribute: 'labels', converter: toObject(), on: 'update', type: 'GridLabelsInput', description: 'UI strings (i18n) — a partial object (JSON attribute `labels`) of flat `<elementType>.<name>` keys (`messages.noData`, `buttons.nextPage`, `menuItems.deleteRow`, …; or full `web-grid.*` keys) merged per key over the page-wide `window.components.locale.labels` and the English defaults; a dynamic label reads the context of its spot: `{ctx.count}`, `{ctx.currentPage}`, … Reads back what was assigned.' },
		{ configKey: 'locale', attribute: 'locale', converter: toText({ isNullable: true }), on: 'update', description: "BCP-47 locale for the numbers in labels (`{ctx.count}` items, page info, number-range errors), `editor: 'number'` columns (display, editor text, typed / pasted parse, copy) the date picker's month / weekday names and the text sort order (`cs` puts `ch` after `h`), or unset (the page-wide `window.components.locale`, else the browser language). UI strings are `labels`." },
		{ configKey: 'parseNumberCallback', converter: toFunction<ParseNumberCallback>(), default: null, on: 'update', type: 'ParseNumberCallback | null', description: "This grid's own number reader for `editor: 'number'` columns (typed + pasted text): `({ text, locale, decimalSeparator, thousandsSeparator, parseDefault }) => number | null | undefined`; `null` = not a number (the cell turns invalid), `undefined` = not mine (the page-wide `window.components.locale.parseNumberCallback`, then core's strict parse — `'1.5'` in `de` is invalid)." },
		// Custom CSS for the shadow root (core createCustomStyles(), rulebook C-CA-15): applied after the
		// page-wide `window.components['web-grid'].customStyles`; the callback wins over the string.
		{ configKey: 'customStyles', attribute: 'custom-styles', converter: toText({ isNullable: true }), on: 'update', type: 'string | null', description: "CSS injected into the grid's shadow root (after the page-wide `window.components['web-grid'].customStyles`); an `@import`ed font is also linked in the document head." },
		{ configKey: 'getCustomStylesCallback', converter: toFunction<(ctx: GridCallbackContext) => string | null | undefined>(), on: 'update', type: '((ctx: GridRenderContext) => string | null) | null', description: 'Computes the instance CSS from the grid context; wins over `customStyles`.' },
		// Loading states (core SPEC §12.14): draws every grid loader — `ctx.context` is 'row'
		// (infinite-scroll load-more row) or 'search' (async dropdown search). Beats the page-wide
		// `window.components.renderLoadingCallback`; may return a cleanup function.
		{ configKey: 'renderLoadingCallback', converter: toFunction<RenderLoadingCallback>(), default: null, on: 'update', type: 'RenderLoadingCallback | null', description: "Custom render for the grid's loading states (`ctx.context`: 'row' | 'search'); fills `ctx.containerElement`, may return a cleanup." },
		// Icons (core renderIcon, SPEC §12.33): core reads `host.renderIconCallback` — the element's own hook, asked
		// after the built-in names and before the page-wide `window.components.renderIconCallback`. A change re-renders.
		// Icon overrides by name (core renderIcon maps, SPEC §12.33, C-CA-42): like `labels`, for icons. Core reads
		// `host.icons` and calls iconsChanged() after a batch that changed it.
		{ configKey: 'icons', attribute: 'icons', converter: toObject({ validate: isIconMap }), on: 'update', type: 'GridIcons', description: "Icon overrides by name (core `renderIcon`, SPEC §12.33) — like `labels`, for icons. The grid's own icon names: row built-ins `add`, `delete`, `duplicate`, `move-up`, `move-down` (row toolbar / inline row actions); cell-menu tree items `expand-node`, `collapse-node`, `expand-subtree`, `collapse-subtree`, `expand-all`, `collapse-all`; header-menu items `sort-asc`, `sort-desc`, `clear-sort`, `hide-column`, `freeze-column`, `unfreeze-column`, `column-visibility`; chrome `calendar` (date cell trigger), `prev-month` / `next-month` (date picker), `shortcuts-help`, `header-info`. A value is an icon string: markup, a built-in name (`close`), icon-font classes (`fa-solid fa-trash`) or text; the map also applies to icon names in `rowToolbar` / menu items / dropdown options. Order: markup → this map → page-wide `window.components.icons` (`web-grid.<name>` before `<name>`) → built-in name → `renderIconCallback` → the page hook → the grid's own icons. `add` / `delete` are built-in names: they draw the theme's `--base-icon-*` glyph (the base-css-variables default without one) unless a map replaces them. Partial; property (object) or JSON attribute (`icons='{\"delete\":\"fa-solid fa-trash\"}'`). A change repaints the icons in place." },
		{ configKey: 'renderIconCallback', converter: toFunction<RenderIconCallback>(), default: null, on: 'update', type: 'RenderIconCallback | null', description: "This grid's icon hook: `(name, ctx) => markup | null` for the toolbar / row-action / edit-button / dropdown-option icons. Asked after the built-in names (never sent to it) and before the page-wide `window.components.renderIconCallback`; `null` / `undefined` = not mine (the next rule decides), `''` = no icon. `ctx`: `{ component, element, prefix }` + `item` (toolbar / row action) or `option` (dropdown option)." },
		// Labels (core createLabels, SPEC §12.24): core reads `host.translateCallback` — the element's own hook, asked
		// for every key the instance `labels` did not set, before `window.components.locale.translateCallback`. A change re-renders.
		{ configKey: 'translateCallback', converter: toFunction<TranslateCallback>(), default: null, on: 'update', type: 'TranslateCallback | null', description: "This grid's translation hook: `({ component, key, template, params, locale }) => string | null`, asked for every label key this grid's own `labels` did not set (`key` = the full `web-grid.<elementType>.<name>`), before the page-wide `window.components.locale.translateCallback`; `null` / `undefined` = not mine (the page hook, then the default `{ctx.*}` formatting). A change re-renders the texts." },
		// Gate of every scroll the grid makes on its own (keyboard moves, scrollToRow, go-to-row; rulebook
		// D-CA-5): `false` skips it, a partial `options` replaces the defaults. Element-local (not on the engine).
		{ configKey: 'beforeScrollCallback', converter: toFunction<(ctx: GridBeforeScrollContext) => unknown>(), on: 'update', type: '((ctx: GridBeforeScrollContext) => false | Partial<GridScrollOptions> | void) | null', description: 'Runs before the grid scrolls a cell / row into view on its own (`ctx.source`: keyboard | scroll-to-row | go-to-row); `false` skips, a partial `options` replaces the defaults. Synchronous.' },
		// Tooltip timing (element-local, not on the engine — the bridge's `in this.#engine`
		// guard skips them; readers use the input's getter)
		{ configKey: 'tooltipShowDelay', attribute: 'tooltip-show-delay', converter: toInt({ min: 0, default: 200 }), default: 200, on: 'update', description: 'Delay (ms) before a cell tooltip shows. Default: `200`.' },
		{ configKey: 'tooltipHideDelay', attribute: 'tooltip-hide-delay', converter: toInt({ min: 0, default: 100 }), default: 100, on: 'update', description: 'Delay (ms) before a cell tooltip hides. Default: `100`.' },
		// Overlay tree group of the cell dropdown + date editor (element-local, read at each open — so `update`, no rebuild)
		{ configKey: 'overlayGroup', attribute: 'overlay-group', converter: toText({ isNullable: true }), on: 'update', type: 'string | null', description: 'Scope the "one overlay open at a time" coordination to a named group. Overlays (the cell dropdown, the row toolbar with a click / button trigger, multiselects, datepickers, external popovers) sharing a group dismiss each other when one opens; different groups are independent. Unset = the default (ungrouped) group.' },
		// Row identity & tree data (bridged into the engine like every row; its setters
		// rebuild the tree state / expanded set and re-render). `''` = none on both paths.
		{ configKey: 'idMember', attribute: 'id-member', converter: toText({ isNullable: true, isEmptyAllowed: true, default: 'id' }), default: 'id', on: 'update', type: 'string | null', getLiveValue: (el) => (el as GridElement).#engine.idMember, description: "Field that uniquely identifies a row; `null` / `''` = none. The only row-id member: drafts, invalid-cell markers, `getRowId` / `getRowById` / `updateRowById` / `replaceRowById` / `lockRowById` use it (`getIdCallback` wins when set). Default: `id`." },
		{ configKey: 'pathMember', attribute: 'path-member', converter: toText({ isNullable: true }), default: null, on: 'update', type: 'string | null', description: 'Tree data: the field holding a row’s path (`"1.2.3"`); setting it turns the grid into a tree. Unset = flat data.' },
		{ configKey: 'levelMember', attribute: 'level-member', converter: toText({ isNullable: true }), default: null, on: 'update', type: 'string | null', description: 'Tree data: the field holding a row’s depth, when the data has levels instead of paths.' },
		{ configKey: 'parentPathMember', attribute: 'parent-path-member', converter: toText({ isNullable: true }), default: null, on: 'update', type: 'string | null', description: 'Tree data: the field holding the parent row’s path.' },
		{ configKey: 'treePathSeparator', attribute: 'tree-path-separator', converter: toText({ isNullable: true }), default: null, on: 'update', type: 'string | null', description: 'Tree data: the path separator. Unset = auto-detect.' },
		{ configKey: 'expandLevel', attribute: 'expand-level', converter: toInt({ min: 0, isNullable: true }), default: null, on: 'update', type: 'number | null', description: 'Tree data: show the tree to this depth (`0` = only the roots, `1` = the roots expanded, …), a whole number ≥ 0. Unset (`null`) = everything expanded. Ignored once `expandedPaths` is assigned.' },
		// Row editability (the static gate; `getIsRowEditableCallback` decides per row and wins)
		{ configKey: 'isRowEditable', attribute: 'row-editable', converter: toBool('tristate'), on: 'update', type: 'boolean | null', description: 'Static row editability for the whole grid: `false` makes every row read-only (a column with `isEditable: true` still opts in); unset (`null`) = no row gate. `getIsRowEditableCallback` decides per row and wins.' },
		// Row toolbar button width (CSS length; a number means pixels)
		{ configKey: 'toolbarBtnMinWidth', attribute: 'toolbar-btn-min-width', converter: toCssLength(), on: 'update', type: 'string | undefined', description: 'Min width of the row toolbar buttons — a CSS length; a number means pixels; overrides `--wg-toolbar-btn-min-width`. Unset = the CSS variable.' },
		// Callbacks (property-only, no attribute): bridged into the engine, read when they run.
		{ configKey: 'getIsRowEditableCallback', converter: toFunction<(ctx: RowDataContext) => boolean>(), on: 'update', type: '((ctx: RowDataContext<T>) => boolean) | null', description: 'Decides editability per row: `(ctx: { row }) => boolean`; wins over `isRowEditable`.' },
		{ configKey: 'getIdCallback', converter: toFunction<(ctx: RowDataContext) => unknown>(), on: 'update', type: '((ctx: RowDataContext<T>) => unknown) | null', description: 'The row’s id when `idMember` can’t express it (`{ row }` → id). Wins over `idMember`.' },
		{ configKey: 'getRowClassCallback', converter: toFunction<(ctx: RowContext) => string | null>(), on: 'update', type: '((ctx: RowContext<T>) => string | null) | null', description: 'Dynamic CSS class of a row: `(ctx: { row, rowIndex }) => string | null`.' },
		{ configKey: 'getValidationTooltipCallback', converter: toFunction<(ctx: ValidationTooltipContext) => string | null>(), on: 'update', type: '((ctx: ValidationTooltipContext<T>) => string | null) | null', description: 'Custom HTML of the validation-error tooltip (grid-level default; a column’s own wins): `(ctx: CellContext & { error }) => string | null`.' },
		{ configKey: 'getPaginationLabelsCallback', converter: toFunction<PaginationLabelsCallback>(), on: 'update', type: 'PaginationLabelsCallback<T> | null', description: 'Customize / translate the pager texts: `(ctx: { currentPage, totalPages, totalItems, pageSize, count }) => Partial<PaginationLabels>`.' },
		{ configKey: 'renderSummaryCallback', converter: toFunction<SummaryCallback>(), on: 'update', type: 'SummaryCallback<T> | null', description: 'The summary bar HTML (`summaryPosition`): `(ctx: { items, allItems, totalItems, currentPage, pageSize, metadata, drafts }) => string`.' },
		{ configKey: 'renderChevronCallback', converter: toFunction<ChevronCallback>(), on: 'update', type: 'ChevronCallback<T> | null', description: 'Custom HTML of a tree row’s chevron: `(ctx) => string`.' },
		{ configKey: 'renderShortcutsHelpCallback', converter: toFunction<(ctx: GridCallbackContext) => RenderResult>(), on: 'update', type: '((ctx: GridRenderContext<T>) => RenderResult) | null', description: 'Custom HTML shown alongside the keyboard-shortcuts list: `(ctx) => string`.' },
		{ configKey: 'beforeContextMenuOpenCallback', converter: toFunction<(ctx: CellContext) => false | GridMenuEntry[] | void>(), on: 'update', type: '((ctx: CellContext<T>) => false | GridMenuEntry<T>[] | void) | null', description: 'Before the cell menu opens (sync): `false` → no grid menu; an entries array → shown instead.' },
		{ configKey: 'beforeHeaderMenuOpenCallback', converter: toFunction<(ctx: HeaderMenuContext) => false | GridHeaderMenuEntry[] | void>(), on: 'update', type: '((ctx: HeaderMenuContext<T>) => false | GridHeaderMenuEntry<T>[] | void) | null', description: 'Before the header menu opens (sync): `false` → no grid menu; an entries array → shown instead.' },
		{ configKey: 'beforeActionCallback', converter: toFunction<(detail: GridActionEventDetail) => unknown>(), on: 'update', type: '((detail: GridActionEventDetail<T>) => unknown) | null', description: 'Before any toolbar / menu / shortcut item activates: `false` cancels (async OK).' },
		{ configKey: 'beforePageChangeCallback', converter: toFunction<(ctx: BeforePageChangeContext) => boolean | number | void | Promise<boolean | number | void>>(), on: 'update', type: '((ctx: BeforePageChangeContext<T>) => boolean | number | void | Promise<boolean | number | void>) | null', description: 'Runs before a user action swaps the displayed rows — pager buttons, page-size change, header sort and filter-row changes in server mode (`ctx.trigger`: `page` / `page-size` / `sort` / `filter`; `fromPage`, `toPage`, `drafts`). `false` → stay; a number → go to that page instead; may be async (the pager is disabled meanwhile). Programmatic `currentPage` writes and infinite-scroll `load-more` skip it.' },
		{ configKey: 'beforeFillCallback', converter: toFunction<(ctx: FillContext) => boolean | void | Promise<boolean | void>>(), on: 'update', type: '((ctx: FillContext<T>) => boolean | void | Promise<boolean | void>) | null', description: 'Runs before a fill-handle drag applies: `(ctx: { sourceCell, targetCells, direction }) => boolean | void | Promise<…>`; `false` cancels (async OK).' },
		{ configKey: 'beforePasteCallback', converter: toFunction<(ctx: BeforePasteContext) => boolean | void | Promise<boolean | void>>(), on: 'update', type: '((ctx: BeforePasteContext<T>) => boolean | void | Promise<boolean | void>) | null', description: 'Before a multi-cell paste: `false` cancels; add "row-col" keys to `ctx.skipCells` to skip cells (async OK).' },
		{ configKey: 'createRowCallback', converter: toFunction<CreateRowCallback>(), on: 'update', type: 'CreateRowCallback<T> | null', description: 'New row for pasted data past the last row.' },
		{ configKey: 'createEmptyRowCallback', converter: toFunction<(ctx: GridCallbackContext) => unknown>(), on: 'update', type: '((ctx: GridRenderContext<T>) => T | Promise<T>) | null', description: 'The row the `add` built-in (and the experimental new row) inserts: `(ctx) => T | Promise<T>`. Default: a blank row.' },
		{ configKey: 'createDuplicateRowCallback', converter: toFunction<(ctx: RowContext) => unknown>(), on: 'update', type: '((ctx: RowContext<T>) => T) | null', description: 'The copy the `duplicate` built-in inserts (default: shallow copy, `idMember` cleared).' },
		// Menus: menu-presentation / menu-side — core's standard menu-host rows (read at every open: on 'none')
		...createMenuPresentationInputs(),
	] as const satisfies readonly InputDef[]

	/** The core event table (read by BlissElement for the `on<Name>` twins). @ignore */
	static events = EVENTS

	// Type-only: core installs the `on<Name>` twins at runtime (§12.5); each is
	// called with the event detail (not the CustomEvent), right before the event.
	/** Twin of the `row-change` event: called with its detail, right before the event. */
	declare onRowChange: ((detail: GridEventMap<T>['row-change']) => void) | null
	/** Twin of the `cell-edit-start` event: called with its detail, right before the event. */
	declare onCellEditStart: ((detail: GridEventMap<T>['cell-edit-start']) => void) | null
	/** Twin of the `cell-edit-cancel` event: called with its detail, right before the event. */
	declare onCellEditCancel: ((detail: GridEventMap<T>['cell-edit-cancel']) => void) | null
	/** Twin of the `validation-error` event: called with its detail, right before the event. */
	declare onValidationError: ((detail: GridEventMap<T>['validation-error']) => void) | null
	/** Twin of the `focus-change` event: called with its detail, right before the event. */
	declare onFocusChange: ((detail: GridEventMap<T>['focus-change']) => void) | null
	/** Twin of the `row-delete` event: called with its detail, right before the event. */
	declare onRowDelete: ((detail: GridEventMap<T>['row-delete']) => void) | null
	/** Twin of the `cell-selection-change` event: called with its detail, right before the event. */
	declare onCellSelectionChange: ((detail: GridEventMap<T>['cell-selection-change']) => void) | null
	/** Twin of the `row-selection-change` event: called with its detail, right before the event. */
	declare onRowSelectionChange: ((detail: GridEventMap<T>['row-selection-change']) => void) | null
	/** Twin of the `column-selection-change` event: called with its detail, right before the event. */
	declare onColumnSelectionChange: ((detail: GridEventMap<T>['column-selection-change']) => void) | null
	/** Twin of the `data-request` event: called with its detail, right before the event. */
	declare onDataRequest: ((detail: GridEventMap<T>['data-request']) => void) | null
	/** Twin of the `filter-change` event: called with its detail, right before the event. */
	declare onFilterChange: ((detail: GridEventMap<T>['filter-change']) => void) | null
	/** Twin of the `column-resize` event: called with its detail, right before the event. */
	declare onColumnResize: ((detail: GridEventMap<T>['column-resize']) => void) | null
	/** Twin of the `column-reorder` event: called with its detail, right before the event. */
	declare onColumnReorder: ((detail: GridEventMap<T>['column-reorder']) => void) | null
	/** Twin of the `row-expand` event: called with its detail, right before the event. */
	declare onRowExpand: ((detail: GridEventMap<T>['row-expand']) => void) | null
	/** Twin of the `row-collapse` event: called with its detail, right before the event. */
	declare onRowCollapse: ((detail: GridEventMap<T>['row-collapse']) => void) | null
	/** Twin of the `expanded-change` event: called with its detail, right before the event. */
	declare onExpandedChange: ((detail: GridEventMap<T>['expanded-change']) => void) | null
	/** Twin of the `row-lock-change` event: called with its detail, right before the event. */
	declare onRowLockChange: ((detail: GridEventMap<T>['row-lock-change']) => void) | null
	/** Twin of the `cell-paste` event: called with its detail, right before the event. */
	declare onCellPaste: ((detail: GridEventMap<T>['cell-paste']) => void) | null
	/** Twin of the `action` event: called with its detail, right before the event. */
	declare onAction: ((detail: GridEventMap<T>['action']) => void) | null

	/**
	 * The internal state engine (composition). Truly private: the modules reach it through the module
	 * host's symbol-keyed `GRID_ENGINE` property (modules/grid-context.ts), never a member of the element.
	 */
	readonly #engine: GridEngine<T>

	/**
	 * The module host (`GridHost`, modules/grid-context.ts): a private object holding the grid's runtime
	 * services / UI state (dropdown, toolbar, filter row, datepicker, menu, virtual scroll, event managers,
	 * the action-pipeline adapter, …) plus the element calls the modules make. Not a member of `<web-grid>`:
	 * none of it is public API (no `el.dropdown`, `el.render()`, … in the .d.ts or at runtime).
	 */
	readonly #host: GridHost<T>

	/** Shadow root (open; `el.shadowRoot` is the platform's own accessor). */
	readonly #shadow: ShadowRoot

	// Update batching
	#updatePending = false

	// Click event manager (pub/sub for click inside/outside events) — element-only
	readonly #clickEvents: ClickEventManager

	/** function Object() { [native code] } */
	constructor() {
		super()
		this.#shadow = this.attachShadow({ mode: 'open' })
		this.#engine = new GridEngine<T>()
		// Test-only lookup (module-private WeakMap, not exported from the package) — no key on the element
		registerEngine(this, this.#engine)
		this.#host = this.#createHost()
		this.#engine.setStateStore(this.#stateStore)
		// Labels through core /locale: page-wide flat labels ('web-grid.<key>') + translateCallback, this element's logger
		this.#engine.setLabelHost(this)
		// Every ctx / detail carries `controller` + `element`; the engine's
		// notifications become events (emit → `on*` twin + DOM event).
		this.#engine.attachHost(this, () => this.controller, (name, detail) => {
			this.emit(name, detail as never)
			// Commits update cells surgically (no full render) — refresh the summary too
			if (name === 'row-change') this.#scheduleSummaryRefresh()
		})

		this.#clickEvents = createClickEventManager()

		// The grid's own CSS (all in @layer variables / component / overrides): one shared constructable
		// sheet per document (core adoptStyles), adopted before the first render — no FOUC; custom CSS
		// (unlayered <style> slots) still wins.
		adoptStyles(this.#shadow, styles, ICON_CSS)
		// A DOM move (dashboard reorder, re-parent) keeps the grid's state; this keeps its scroll position too
		// (core keepScrollAcrossMove — the browser resets a detached scroller to 0).
		keepScrollAcrossMove(this, () => [this.#shadow.querySelector('.wg')])

		// Override requestUpdate to invalidate the data-pipeline cache and trigger DOM render.
		// Every state-changing setter on GridEngine funnels through requestUpdate(), so this is
		// the single canonical point to drop cached paginatedItems / displayItems.
		// (A typed local, not `(this.#engine as …).x = …`: the CEM analyzer would list those as element fields.)
		const engineHooks = this.#engine as unknown as {
			requestUpdate: () => void
			_onInteractionChange: ((type: string, detail: { prev: unknown, current: unknown }) => void) | null
			_onCommitApplied: ((rowIndex: number, field: string) => void) | null
		}
		/** @ignore engine wiring, not an element member (the CEM analyzer reads constructor assignments) */
		engineHooks.requestUpdate = () => {
			this.#engine.invalidateDisplayCache()
			this.#requestUpdate()
		}

		// Handle interaction changes (cleanup dropdown when editing is cancelled externally)
		/** @ignore engine wiring, not an element member (the CEM analyzer reads constructor assignments) */
		engineHooks._onInteractionChange = (type, detail) => {
			if (type === 'editingCell' && detail.current === null) {
				// The edit ended (saved / cancelled, any path) - close its dropdown / date picker
				// ('api': whoever ended the edit already saved or cancelled it)
				removeDropdown(this.#host)
				if (this.#host.datepicker) {
					this.#host.datepicker.close()
					this.#host.datepicker = null
				}
			}
		}

		// An async validateCallback's result arrived after the edit ended: show it (the value, a
		// transform, the invalid mark). A cell being edited again keeps its editor.
		/** @ignore engine wiring, not an element member (the CEM analyzer reads constructor assignments) */
		engineHooks._onCommitApplied = (rowIndex, field) => {
			if (this.#engine.isEditing(rowIndex, field)) return
			const colIndex = this.#engine.columns.findIndex(c => String(c.field) === field)
			if (colIndex >= 0) renderCell(this.#host, rowIndex, colIndex)
		}
	}

	/** Build the module host (see `#host`). State lives on it; element calls delegate back here. */
	#createHost(): GridHost<T> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const el = this
		const engine = this.#engine
		const host: GridHost<T> = {
			[GRID_ENGINE]: engine,
			shadow: this.#shadow,
			setProperties: (values) => el.setProperties(values),
			dispatchEvent: (event) => el.dispatchEvent(event),
			dropdown: new DropdownService(),
			isCommittingFromKeyboard: false,
			isTransitioningCells: false,
			menu: null,
			getMenuPresentationOptions: () => getMenuPresentationOptions(el.config),
			datepicker: null,
			isPhoneSheet: false,
			autocomplete: new AutocompleteService(),
			tooltip: new GridTooltips(),
			get tooltipShowDelay() { return el.tooltipShowDelay },
			get tooltipHideDelay() { return el.tooltipHideDelay },
			get overlayGroup() { return el.overlayGroup },
			get beforeScrollCallback() { return el.beforeScrollCallback },
			virtualScroll: new VirtualScrollService(),
			toolbar: new ToolbarService(),
			filterRow: new FilterRowService(),
			filterInputText: (field) => host.filterRow.pendingText.get(field),
			render: () => el.#render(),
			renderConnector: () => renderConnectorModule(host),
			openLayer: (options) => el.#openLayer(options),
			pipelineAdapter: null,
			getCurrentEditingColumn: () => {
				const editingCell = engine.editingCell
				if (!editingCell) return null
				return engine.columns.find(c => String(c.field) === editingCell.field) || null
			},
			getCurrentEditorOptions: () => host.getCurrentEditingColumn()?.editorOptions || {},
			moveFocusAfterCommit: (rowIndex, field, direction) => moveFocusAfterCommit(host, rowIndex, field, direction),
			openCustomEditor: (rowIndex, colIndex) => el.openCustomEditor(rowIndex, colIndex),
			scrollToRow: (rowIndex) => el.scrollToRow(rowIndex),
			openGoToRowDialog: (colIndex) => openGoToRowDialogModule(host, colIndex),
			clearAllSelections: () => clearAllSelectionsModule(host),
			commitOrCancelEditOnTransition: () => commitOrCancelEditOnTransitionModule(host),
			updateRowFocusVisual: (prevRowIndex, newRowIndex) => {
				if (prevRowIndex === newRowIndex) return
				if (prevRowIndex !== null) {
					el.#shadow.querySelector(`tr[data-row-index="${prevRowIndex}"]`)?.classList.remove('wg__row--focused')
				}
				if (newRowIndex !== null) {
					el.#shadow.querySelector(`tr[data-row-index="${newRowIndex}"]`)?.classList.add('wg__row--focused')
				}
			},
			isMouseDown: false,
			scrollEvents: createScrollEventManager(),
			focusEvents: createFocusEventManager(
				() => ({
					isCommittingFromKeyboard: host.isCommittingFromKeyboard,
					isTransitioningCells: host.isTransitioningCells,
					isClosingViaToggle: host.dropdown.isClosingViaToggle,
					isOpeningDropdown: host.dropdown.isOpening
				}),
				() => { host.dropdown.setIsClosingViaToggle(false) }
			),
		}
		return host
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
	#writeConfigToEngine(cfg: Record<string, unknown>): void {
		const target = this.#engine as unknown as Record<string, unknown>
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
		getConfig: () => this.config,
		toContext: (data) => this.withContext(data),
	})

	/** First build done — before it, engine setters don't render (`defer` holds the first render). */
	#isBuilt = false

	/** `items` replaced without the edited row while focus was in the grid: the next render focuses the grid. */
	#isEditedRowGone = false

	/** The instance + page-wide custom CSS layers (core createCustomStyles(), rulebook C-CA-15). */
	#customStyles: CustomStylesHandle | null = null

	#reconcileCustomStyles(): void {
		if (this.#customStyles) return this.#customStyles.refresh()
		this.#customStyles = createCustomStyles(this, this.#shadow, this.#customStylesOptions())
	}

	#customStylesOptions(): CustomStylesOptions {
		return {
			cssClass: 'wg-custom-styles',
			getContext: () => this.#engine.ctx({}),
			getInstanceStyles: () => ({ css: this.config.customStyles as string | null, callback: this.config.getCustomStylesCallback as GridElementConfig<T>['getCustomStylesCallback'] }),
		}
	}

	/**
	 * A core createLayer() layer (the reorder ghost, the toolbar connector — modules/layers/index.ts) with the
	 * grid's custom CSS (page-wide + instance): core writes it into the layer's root and follows later
	 * instance / page changes while the layer is open (`customStylesOptions`, core G2).
	 */
	#openLayer(options: LayerOptions): Layer {
		return createLayer(this, { ...options, customStylesOptions: this.#customStylesOptions() })
	}

	protected reinit(): void {
		// First connect: seed the grid from the merged input config.
		this.#writeConfigToEngine(this.config as Record<string, unknown>)
		this.#engine.isDisabled = this.isEffectivelyDisabled
		this.#reconcileCustomStyles()
		// Persisted column widths / order (async; waits for `columns` when there are none yet)
		this.#engine.loadPersistedState()
		this.#isBuilt = true
	}

	/**
	 * Device / viewport / orientation changed (core §12.9; fires on connect with the current
	 * snapshot): on a phone the cell dropdown and the date editor are an edge-to-edge sheet
	 * (rulebook D-RO-3 = C — core resolvePresentation(), no width literal). An open one switches
	 * in place (same popover, anchored ⇄ un-anchored).
	 */
	protected override environmentChanged(env: EnvironmentSnapshot): void {
		const isPhoneSheet = resolvePresentation('auto', env) === 'fullscreen'
		if (isPhoneSheet === this.#host.isPhoneSheet) return
		this.#host.isPhoneSheet = isPhoneSheet
		reconcileDropdownPresentation(this.#host)
		this.#host.datepicker?.setSheet(isPhoneSheet)
	}

	/** The page-wide `window.components.locale` changed: re-resolve the labels and re-run the render callbacks in place (`ctx.labels`). */
	protected override localeChanged(): void {
		this.#engine.refreshLabels()
		repaintOpenDropdown(this.#host)
	}

	/**
	 * The icons changed — the page-wide `window.components.renderIconCallback` / `window.components.icons`
	 * (core C-CA-40) or this grid's `icons` map (core calls this after the batch): repaint the icons in
	 * place — the table (edit buttons, inline row actions, chevrons, cell renders, date triggers, header
	 * info, shortcuts help), the open row toolbar, the open dropdown's options and the open date picker's
	 * nav; nothing closes, nothing rebuilds. An open cell / header menu keeps its icons until reopened.
	 */
	protected override iconsChanged(): void {
		this.#repaintIcons()
	}

	#repaintIcons(): void {
		this.#engine.refreshIcons()
		repaintOpenToolbarIcons(this.#host)
		repaintOpenDropdown(this.#host)
		this.#host.datepicker?.repaintIcons()
	}

	protected override disabledChanged(isDisabled: boolean): void {
		this.#engine.isDisabled = isDisabled
		if (isDisabled) {
			closeGridMenu(this.#host)
			closeToolbarAndReset(this.#host)
		}
	}

	protected update(partial: Record<string, unknown>): void {
		// Later attribute/property changes: apply just the changed inputs.
		this.#writeConfigToEngine(partial)
		// A new key / persist flag / source: load its persisted column state
		if ('storageKey' in partial || 'shouldPersistColumnWidths' in partial || 'shouldPersistColumnOrder' in partial || 'loadStateCallback' in partial) {
			this.#engine.loadPersistedState()
		}
		if ('customStyles' in partial || 'getCustomStylesCallback' in partial) this.#customStyles?.refresh()
		// Icons are rendered with the table / toolbar / dropdown markup: a new icon hook redraws them
		if ('renderIconCallback' in partial) this.#repaintIcons()
		// Labels are resolved into the engine's labels object: a new translate hook re-resolves + re-renders them
		if ('translateCallback' in partial) this.#engine.refreshLabels()
		// `ctx.labels` of the render callbacks changed: the table re-runs them with the next render (engine
		// renderContextChanged); an open dropdown's options re-fill in place (renderOptionCallback, its texts)
		if ('labels' in partial || 'locale' in partial || 'translateCallback' in partial) repaintOpenDropdown(this.#host)
		// Core createTooltip reads its delays once: a new delay restarts the tooltips
		if ('tooltipShowDelay' in partial || 'tooltipHideDelay' in partial) this.#host.tooltip.start(this.#host)
	}

	#columnResize: PointerDrag | null = null
	#columnReorder: PointerDrag | null = null
	#stopFilterText: (() => void) | null = null

	protected connect(): void {
		initLogger.debug('connect — grid activated')
		// Initialize action pipeline adapter for 'always' editTrigger mode
		this.#host.pipelineAdapter = createActionPipelineAdapter(this.#host)
		this.#render()
		// Scroll / focus / click managers — disconnect() destroyed them, and a DOM move
		// keeps the shadow table (surgical render), so they're restarted on every connect
		this.#wireEventManagers()
		// Register paste handler for navigate mode
		this.addEventListener('paste', this.#handlePaste as EventListener)
		// A mouse button released anywhere ends the table press (see attachEventListeners)
		document.addEventListener('mouseup', this.#onDocumentMouseUp, true)
		// Column resize: core pointer drag on the host (mouse + touch; survives the table re-render)
		this.#columnResize = createColumnResize(this.#host, this)
		this.#columnReorder = createColumnReorder(this.#host, this)
		// Filter-row typing, IME-safe (delegated on the shadow root — survives the thead re-render)
		this.#stopFilterText = watchFilterRowText(this.#host, this.#shadow)
		// Tooltips: core createTooltip delegated over the shadow root (hover + keyboard focus)
		this.#host.tooltip.start(this.#host)
	}

	protected override destroyCallback(): void {
		// Loader render hooks may hold resources (their returned cleanup)
		removeAllLoaders(this.#host)
		// An open cell dropdown's popover (its document scroll listeners) goes too
		removeDropdown(this.#host)
		this.#customStyles?.destroy()
		this.#customStyles = null
	}

	protected disconnect(): void {
		initLogger.debug('disconnect — grid deactivated')
		// Cleanup event managers
		this.#host.scrollEvents.destroy()
		this.#host.focusEvents.destroy()
		this.#clickEvents.destroy()

		// Cleanup event listeners, observers, etc.
		this.removeEventListener('paste', this.#handlePaste as EventListener)
		document.removeEventListener('mouseup', this.#onDocumentMouseUp, true)
		this.#columnResize?.destroy()
		this.#columnResize = null
		this.#columnReorder?.destroy()
		this.#columnReorder = null
		this.#stopFilterText?.()
		this.#stopFilterText = null
		this.#host.tooltip.stop()
		if (this.#host.datepicker) {
			this.#host.datepicker.destroy()
			this.#host.datepicker = null
		}
		closeGridMenu(this.#host)
		// Close any open toolbar
		closeToolbarAndReset(this.#host)
		// Cleanup inline shortcuts
		removeInlineShortcuts(this.#host)
		// Cleanup selection borders
		removeAllSelectionBorders()
	}

	// ==========================================================================
	// Public API - Proxy to GridEngine
	// ==========================================================================

	/** Row data. Reading returns the live rows: after `insertRow` / `removeRows` / `moveRow`, the row built-ins and a committed new row (cell edits stay in drafts — `getDrafts()`). */
	get items(): T[] { return this.#engine.items }
	set items(value: T[]) {
		// Reset infinite scroll loading flag (before the re-render, so the
		// `messages.loading` row goes away with it)
		this.#host.virtualScroll.setIsLoadingMore(false)
		this.#shadow?.querySelector('.wg__loading-more-row')?.remove()
		if (this.#shadow) reconcileLoadingMoreLoader(this.#host)
		const wasEditing = !!this.#engine.editingCell
		const hadFocus = !!this.#shadow?.activeElement
		this.#engine.items = value
		// The edited row is gone (the engine cancelled the edit): its editor goes with the
		// render, so keyboard focus moves to the grid instead of falling to <body>
		if (wasEditing && !this.#engine.editingCell && hadFocus) this.#isEditedRowGone = true
	}

	/** Column definitions (`Column<T>[]`, at least a `field` each): title, width, alignment, editor, validation, tooltip, … */
	get columns(): Column<T>[] { return this.#engine.columns }
	set columns(value: Column<T>[]) { this.#engine.columns = value }

	/** Current filter text per field. Assigning is silent (no `filter-change`), like a native `input.value`; `setFilter()` fires it. */
	get filters(): Record<string, string> { this.flush(); return this.#engine.filters }
	/** Assignment is silent (no `filter-change`), like a native `input.value`; use `setFilter()` to fire it. */
	set filters(value: Record<string, string>) { this.#engine.filters = value }
	/** Set (or clear, with `''`) one column filter; fires `filter-change` unless `{ isSilent: true }`. */
	setFilter(field: string, value: string, options?: { isSilent?: boolean }): void { this.flush(); this.#engine.setFilter(field, value, options) }

	/** Options of the pager’s rows-per-page selector, e.g. `[10, 25, 50, 100]`. */
	get pageSizes(): number[] { return this.#engine.pageSizes }
	set pageSizes(value: number[]) { this.#engine.pageSizes = value }

	/** Whether the cell has an unsaved change (a draft value). */
	isCellDirty(rowIndex: number, field: string): boolean { this.flush(); return this.#engine.isCellDirty(rowIndex, field) }
	/** Whether the row has any unsaved change (a draft). */
	isRowDirty(rowIndex: number): boolean { this.flush(); return this.#engine.isRowDirty(rowIndex) }

	/** External validation state: `{ rowIndex, field, error }[]` marks cells invalid (with the tooltip). */
	get invalidCells(): CellValidationState[] { return this.#engine.invalidCells }
	set invalidCells(value: CellValidationState[]) { this.#engine.invalidCells = value }

	/** Row toolbar entries — built-in names (`add`, `delete`, `duplicate`, `move-up`, …), action items, dividers. Default: `['add', 'delete', 'duplicate']`. */
	get rowToolbar(): GridToolbarEntry<T>[] { return this.#engine.rowToolbar }
	set rowToolbar(value: GridToolbarEntry<T>[]) { this.#engine.rowToolbar = value }

	/** The column (field or index) the row toolbar is pinned over in the `top` position. */
	get toolbarColumn(): string | number | undefined { return this.#engine.toolbarColumn }
	set toolbarColumn(value: string | number | undefined) { this.#engine.toolbarColumn = value }

	/** Cell-specific toolbar items, merged over `rowToolbar` by `id` / `action`: `(ctx: CellContext) => entries | null`. */
	get getCellToolbarItemsCallback(): ((ctx: CellContext<T>) => GridToolbarEntry<T>[] | null | undefined) | undefined {
		return this.#engine.getCellToolbarItemsCallback
	}
	set getCellToolbarItemsCallback(value: ((ctx: CellContext<T>) => GridToolbarEntry<T>[] | null | undefined) | undefined) {
		this.#engine.getCellToolbarItemsCallback = value
	}


	/** Cell / row context menu entries: built-in names, menu items, dividers. Unset = no grid menu. */
	get contextMenu(): GridMenuEntry<T>[] | undefined { return this.#engine.contextMenu }
	set contextMenu(value: GridMenuEntry<T>[] | undefined) { this.#engine.contextMenu = value }

	// Header context menu
	/** Header context menu entries: built-in names (column visibility, sort, …), menu items, dividers. */
	get headerContextMenu(): GridHeaderMenuEntry<T>[] | undefined { return this.#engine.headerContextMenu }
	set headerContextMenu(value: GridHeaderMenuEntry<T>[] | undefined) { this.#engine.headerContextMenu = value }

	// Row keyboard shortcuts
	/** Action items bound to a key on the focused / hovered row. */
	get rowShortcuts(): GridShortcut<T>[] | undefined { return this.#engine.rowShortcuts }
	set rowShortcuts(value: GridShortcut<T>[] | undefined) { this.#engine.rowShortcuts = value }

	// Range shortcuts (selected rows / cell range)
	/** Action items bound to a key on the selected rows / cell range. */
	get rangeShortcuts(): GridRangeShortcut<T>[] { return this.#engine.rangeShortcuts }
	set rangeShortcuts(value: GridRangeShortcut<T>[]) { this.#engine.rangeShortcuts = value }

	// Row selection
	/** The selected row objects, in display order. */
	get selectedRows(): T[] { this.flush(); return this.#engine.selectedRows }
	/** Display indices of the selected rows, ascending. */
	get selectedRowIndices(): number[] { this.flush(); return this.#engine.selectedRowIndices }
	/** Select a row by display index: `replace` (default) the selection, `toggle` it in / out, or extend a `range` from the anchor. Fires `row-selection-change` on a real change. */
	selectRow(rowIndex: number, mode: 'replace' | 'toggle' | 'range' = 'replace'): void { this.flush(); this.#engine.selectRow(rowIndex, mode) }
	/** Select the rows between two display indices (inclusive). Fires `row-selection-change` on a real change. */
	selectRowRange(fromIndex: number, toIndex: number): void { this.flush(); this.#engine.selectRowRange(fromIndex, toIndex) }
	/** Clear every selection kind: rows, the cell range and columns. */
	clearSelection(): void { this.flush(); this.#engine.clearSelection() }
	/** Clear only the row selection. */
	clearRowSelection(): void { this.flush(); this.#engine.clearRowSelection() }
	/** Whether the row at this display index is selected. */
	isRowSelected(rowIndex: number): boolean { this.flush(); return this.#engine.isRowSelected(rowIndex) }
	/** Copy the selected rows (tab-separated) to the clipboard; resolves `false` when nothing was copied. */
	copySelectedRowsToClipboard(): Promise<boolean> { this.flush(); return this.#engine.copySelectedRowsToClipboard() }

	// Cell range selection

	/** The selected cell range (`startRowIndex` / `endRowIndex`, on-screen `startColIndex` / `endColIndex`, `startField` / `endField`) or `null`. */
	get selectedCellRange() { return this.#engine.selectedCellRange }
	/** Select a cell range (`{ startRowIndex, endRowIndex, startColIndex, endColIndex }`). Fires `cell-selection-change` on a real change. */
	selectCellRange(range: any): void { this.flush(); this.#engine.selectCellRange(range) }
	/** Clear only the cell range selection. */
	clearCellSelection(): void { this.flush(); this.#engine.clearCellSelection() }
	/** The cells of the selected range, as cell contexts (`row`, `rowIndex`, `column`, `field`, `value`, …). */
	getSelectedCells() { this.flush(); return this.#engine.getSelectedCells() }
	/** Copy the selected cell range (tab-separated, headers with `shouldCopyWithHeaders`) to the clipboard; resolves `false` when nothing was copied. */
	copyCellSelectionToClipboard(): Promise<boolean> { this.flush(); return this.#engine.copyCellSelectionToClipboard() }

	// New empty row (inline data entry) — EXPERIMENTAL: API may change

	// Tree / hierarchy

	/** The expanded tree paths (a copy). Assigning replaces the expanded state (no events); `null` → the `expandLevel` default. */
	get expandedPaths(): string[] { return this.#engine.expandedPaths }
	set expandedPaths(value: string[] | null | undefined) { this.#engine.expandedPaths = value }

	/** Whether the tree row with this path is expanded. */
	isPathExpanded(path: string): boolean { this.flush(); return this.#engine.isPathExpanded(path) }
	/** Expand / collapse one tree row (`row-expand` / `row-collapse` + `expanded-change`). */
	toggleRowExpanded(path: string, options?: ExpandOptions): void { this.flush(); this.#engine.toggleRowExpanded(path, options) }
	/** Expand the given tree rows one level, ancestors opening too (`row-expand` per row + `expanded-change`). */
	expandRows(paths: string | string[], options?: ExpandOptions): void { this.flush(); this.#engine.expandRows(paths, options) }
	/** Collapse the given tree rows (`row-collapse` per row + `expanded-change`). */
	collapseRows(paths: string | string[], options?: ExpandOptions): void { this.flush(); this.#engine.collapseRows(paths, options) }
	/** Expand the whole tree (`null`) — or the given rows and everything under them (`expanded-change` only). */
	expandAll(paths?: string | string[] | null, options?: ExpandOptions): void { this.flush(); this.#engine.expandAll(paths, options) }
	/** Collapse the whole tree (`null`) — or the given rows and everything under them (`expanded-change` only). */
	collapseAll(paths?: string | string[] | null, options?: ExpandOptions): void { this.flush(); this.#engine.collapseAll(paths, options) }

	/** The focused row (display index) or `null`. Assigning is silent (no `focus-change`), like a native `input.value`. */
	get focusedRowIndex(): number | null { return this.#engine.focusedRowIndex }
	/** Assignment is silent (no `focus-change`), like a native `input.value`. */
	set focusedRowIndex(value: number | null) { this.#engine.focusedRowIndex = value }

	// Sorting & Pagination
	/** Current sort state (`{ column, direction }[]`) — set it for an initial / server-side sort. */
	get sort(): SortState[] { return this.#engine.sort }
	set sort(value: SortState[]) { this.#engine.sort = value }

	/** Current page (1-based). A filter change resets it to 1; a shorter `items` clamps it. */
	get currentPage(): number { return this.#engine.currentPage }
	set currentPage(value: number) { this.#engine.currentPage = value }

	/** Total row count for server-side paging. `null` = `items.length`. */
	get totalItems(): number | null { return this.#engine.totalItems }
	set totalItems(value: number | null) { this.#engine.totalItems = value }

	/** Server-provided data passed to `renderSummaryCallback` as `ctx.metadata`. */
	get summaryMetadata(): unknown { return this.#engine.summaryMetadata }
	set summaryMetadata(value: unknown) { this.#engine.summaryMetadata = value }

	// Row identification (`idMember` above; this is its computed twin)

	// Row locking
	/** Row locking options (`isLockedMember`, `lockInfoMember`, `getIsLockedCallback`, `lockedEditBehavior`, …). */
	get rowLocking(): RowLockingOptions<T> | undefined { return this.#engine.rowLocking }
	set rowLocking(value: RowLockingOptions<T> | undefined) { this.#engine.rowLocking = value }


	// Fill handle: `false` cancels the fill (async OK)

	// Scroll behavior

	// Virtual scroll

	// Infinite scroll

	/** Infinite scroll: set `false` when the server has no more rows. Default: `true`. */
	get hasMoreItems(): boolean { return this.#engine.hasMoreItems }
	set hasMoreItems(value: boolean) {
		this.#engine.hasMoreItems = value
		if (!value) {
			this.#host.virtualScroll.setIsLoadingMore(false)
			this.#shadow?.querySelector('.wg__loading-more-row')?.remove()
			if (this.#shadow) reconcileLoadingMoreLoader(this.#host)
		}
	}

	// Paste

	// Computed properties
	/** The rows currently displayed (filtered, sorted, paged), read-only. */
	get displayItems(): T[] { this.flush(); return this.#engine.displayItems }
	/** Page count of the current rows, read-only. */
	get totalPages(): number { this.flush(); return this.#engine.totalPages }
	/** Whether the grid is in the Excel-like `navigate` editing mode, read-only. */
	get isNavigateMode(): boolean { this.flush(); return this.#engine.isNavigateMode }

	// Draft row methods
	/** The draft (unsaved copy) of the row at this display index, or `undefined`. */
	getRowDraft(rowIndex: number): T | undefined { this.flush(); return this.#engine.getRowDraft(rowIndex) }
	/** Whether the row at this display index has a draft. */
	hasRowDraft(rowIndex: number): boolean { this.flush(); return this.#engine.hasRowDraft(rowIndex) }
	/** Display indices of every displayed row with a draft. */
	getDraftRowIndices(): number[] { this.flush(); return this.#engine.getDraftRowIndices() }
	/**
	 * Every unsaved draft `{ row, draftRow, changedFields, isValid }` — incl. rows on other
	 * pages, filtered out, or not in the current `items` (drafts are never pruned; they
	 * leave via `replaceRowById`, `discardDraft`, `discardAllDrafts`).
	 */
	getDrafts(): Draft<T>[] { this.flush(); return this.#engine.getDrafts() }
	/** Drop the draft (and invalid-cell markers) of `row` — the row object, its id-equal copy, or the draft. */
	discardDraft(row: T): void { this.flush(); this.#engine.discardDraft(row) }
	/** Drop every draft and invalid-cell marker. */
	discardAllDrafts(): void { this.flush(); this.#engine.discardAllDrafts() }

	// Validation methods
	/** Whether the cell is marked invalid (validation or `invalidCells`). */
	isCellInvalid(rowIndex: number, field: string): boolean { this.flush(); return this.#engine.isCellInvalid(rowIndex, field) }
	/** The validation error of the cell, or `null`. */
	getCellValidationError(rowIndex: number, field: string): string | null { this.flush(); return this.#engine.getCellValidationError(rowIndex, field) }

	// Row identification methods
	/** The row’s id (`getIdCallback`, else `idMember`), or `undefined`. */
	getRowId(row: T): unknown | undefined { this.flush(); return this.#engine.getRowId(row) }
	/** The row with this ID (`idMember` / `getIdCallback`), or null. */
	getRowById(id: unknown): T | null { this.flush(); return this.#engine.getRowById(id) }
	/** The row's display index (the `rowIndex` of every ctx / event), or -1 when it isn't displayed. */
	getRowIndex(row: T): number { this.flush(); return this.#engine.getRowIndex(row) }

	// Row locking methods
	/** Whether the row (object or id) is locked. */
	isRowLocked(rowOrId: T | unknown): boolean { this.flush(); return this.#engine.isRowLocked(rowOrId) }
	/** The lock info (`RowLock`) of the row (object or id), or `null`. */
	getRowLockInfo(rowOrId: T | unknown): RowLock | null { this.flush(); return this.#engine.getRowLockInfo(rowOrId) }
	/** Lock a row by id from outside (e.g. another user edits it); fires `row-lock-change`. Returns `false` when no row has the id. */
	lockRowById(id: unknown, lockerInfo?: Partial<RowLock>): boolean { this.flush(); return this.#engine.lockRowById(id, lockerInfo) }
	/** Remove an external lock; fires `row-lock-change`. Returns `false` when the row was not locked externally. */
	unlockRowById(id: unknown): boolean { this.flush(); return this.#engine.unlockRowById(id) }
	/** Every external lock (`lockRowById`), id → `RowLock`. */
	getExternalLocks(): Map<unknown, RowLock> { this.flush(); return this.#engine.getExternalLocks() }
	/** Remove every external lock. */
	clearExternalLocks(): void { this.flush(); this.#engine.clearExternalLocks() }

	// Row update methods (for WebSocket/external updates)
	/** Merge `newData` into the row with this id (e.g. a WebSocket update). Returns `false` when no row has the id. */
	updateRowById(id: unknown, newData: Partial<T>): boolean { this.flush(); return this.#engine.updateRowById(id, newData) }
	/** Replace the row with this id by `newRow` (drops its draft). Returns `false` when no row has the id. */
	replaceRowById(id: unknown, newRow: T): boolean { this.flush(); return this.#engine.replaceRowById(id, newRow) }

	// Edit permission check
	/** Whether the cell is editable now (grid, column, row, lock and read-only rules). */
	canEditCell(rowIndex: number, field: string): boolean { this.flush(); return this.#engine.canEditCell(rowIndex, field) }

	// Column width methods
	/** Set one column’s width (CSS length). */
	setColumnWidth(field: string, width: string): void { this.flush(); this.#engine.setColumnWidth(field, width) }
	/** Set several column widths (`{ field, width }[]` — the `getColumnWidthsState()` format). */
	setColumnWidths(widths: ColumnWidthState[]): void { this.flush(); this.#engine.setColumnWidths(widths) }
	/** The current column widths, `{ field, width }[]` — save it, restore with `setColumnWidths()`. */
	getColumnWidthsState(): ColumnWidthState[] { this.flush(); return this.#engine.getColumnWidthsState() }

	// Column order methods
	/** Set the column order (`{ field, order }[]` — the `getColumnOrderState()` format). */
	setColumnOrder(order: ColumnOrderState[]): void { this.flush(); this.#engine.setColumnOrder(order) }
	/** The current column order, `{ field, order }[]` — save it, restore with `setColumnOrder()`. */
	getColumnOrderState(): ColumnOrderState[] { this.flush(); return this.#engine.getColumnOrderState() }

	// Public methods for focus and editing
	/**
	 * Programmatically focus a cell. Updates state and focuses the DOM element.
	 * State is updated immediately so pending renders use the correct position.
	 */
	focusCell(rowIndex: number, colIndex: number): void {
		this.flush()
		const columns = this.#engine.columns
		const displayItems = this.#engine.displayItems
		if (rowIndex < 0 || rowIndex >= displayItems.length) return
		if (colIndex < 0 || colIndex >= columns.length) return

		// Update state immediately so any pending render uses the correct position
		this.#engine.setFocusedCell(rowIndex, colIndex)

		// Schedule DOM focus for after any pending render completes
		requestAnimationFrame(() => {
			moveFocus(this.#host, rowIndex, colIndex)
		})
	}

	/**
	 * Programmatically start editing a cell.
	 * Uses surgical DOM update instead of full re-render.
	 * An edit open on another cell is saved first (Excel: leaving a cell saves; its dropdown
	 * closes) — one cell edits at a time; focus that was in the old editor moves to the new one.
	 */
	startEditing(rowIndex: number, colIndex: number): void {
		this.flush()
		const columns = this.#engine.columns
		if (colIndex < 0 || colIndex >= columns.length) return

		const column = columns[colIndex]
		const field = String(column.field)

		let shouldFocusEditor = false
		const old = this.#engine.editingCell
		const oldColIndex = old ? columns.findIndex(c => String(c.field) === old.field) : -1
		if (old && (old.rowIndex !== rowIndex || oldColIndex !== colIndex)) {
			if (!this.#engine.canEditCell(rowIndex, field)) return
			const oldCell = oldColIndex >= 0
				? this.#shadow.querySelector(`td[data-row="${old.rowIndex}"][data-col="${oldColIndex}"]`)
				: null
			const active = this.#shadow.activeElement
			shouldFocusEditor = !!active && !!oldCell?.contains(active)
			// Always saved, even with shouldCommitOnClickAway: false — the edit MOVES to another
			// cell (like Tab / Enter), it isn't a click-away discard.
			// The old editor goes away below: keep the blur handlers out of it
			this.#host.isTransitioningCells = true
			removeDropdown(this.#host)
			clearEditingVisual(this.#host)
			commitEditorValue(this.#host)
			if (oldColIndex >= 0) renderCell(this.#host, old.rowIndex, oldColIndex)
			requestAnimationFrame(() => { this.#host.isTransitioningCells = false })
		}

		// Update state (no longer triggers requestUpdate)
		this.#engine.startEdit(rowIndex, field)
		// The engine refuses read-only / locked cells — render an editor only when it started
		const editing = this.#engine.editingCell
		if (!editing || editing.rowIndex !== rowIndex || editing.field !== field) return

		// Surgical DOM update
		const cell = this.#shadow.querySelector(
			`td[data-row="${rowIndex}"][data-col="${colIndex}"]`
		) as HTMLElement
		if (cell) {
			cell.classList.remove('wg__cell--focused')
			cell.classList.add('wg__cell--editing')
			cell.innerHTML = renderCellEditor(this.#host, rowIndex, colIndex, column)
			if (shouldFocusEditor) {
				const editor = (cell.querySelector('.wg__combobox-input, .wg__autocomplete-input, .wg__date-input, .wg__select-trigger')
					?? cell.querySelector('.wg__editor')) as HTMLElement | null
				editor?.focus({ preventScroll: true })
			}
		}
	}

	// ==========================================================================
	// Update Mechanism
	// ==========================================================================

	#isSummaryRefreshPending = false

	/** Re-render the summary blocks (once per microtask burst) without a full render. */
	#scheduleSummaryRefresh(): void {
		if (!this.#engine.renderSummaryCallback || this.#isSummaryRefreshPending) return
		this.#isSummaryRefreshPending = true
		queueMicrotask(() => {
			this.#isSummaryRefreshPending = false
			if (this.#updatePending) return  // a full render is queued — it renders the summary
			const blocks = this.#shadow.querySelectorAll('.wg__summary')
			if (blocks.length === 0) return
			const content = renderSummaryContent(this.#host)
			blocks.forEach(block => { block.innerHTML = content })
		})
	}

	#requestUpdate(): void {
		// Nothing renders before the first build (core `defer` / first connect) — connect() renders.
		if (!this.#isBuilt) return
		if (this.#updatePending) return
		uiLogger.debug('requestUpdate: scheduling render')
		this.#updatePending = true
		const __reqT0 = performance.now()

		// Batch updates using microtask
		queueMicrotask(() => {
			this.#updatePending = false
			perfLogger.debug('microtask delay:', (performance.now() - __reqT0).toFixed(2), 'ms')
			gridPerf.measure('render() total', () => this.#render())
		})
	}

	// Cell-level keydown moved to modules/navigation/cell-keydown.ts —
	// see `handleCellKeyDown` import above.
	// Editor-input keydown moved to modules/editing/editor-keydown.ts —
	// see `handleEditorKeyDown` import above.

	// ==========================================================================
	// Event Listener Attachment
	// ==========================================================================

	/** One listener per element, added in connect() / removed in disconnect() — not one per rebuild. */
	#onDocumentMouseUp = (): void => { this.#host.isMouseDown = false }

	/**
	 * (Re)wires the scroll / focus / click event managers to the current DOM:
	 * virtual + infinite scroll, window-scroll repositioning, focusout + internal
	 * blur, outside click + sort click. disconnect() destroys the managers (their
	 * window / document listeners must not outlive the element), so this runs on
	 * every connect() — a DOM move keeps the shadow table (surgical render) and
	 * never reaches attachEventListeners() — and after every full rebuild (new
	 * table / container). Idempotent: tears down the previous wiring first.
	 */
	#wireEventManagers(): void {
		const { scrollEvents, focusEvents } = this.#host
		scrollEvents.destroy()
		focusEvents.destroy()
		this.#clickEvents.destroy()

		const table = this.#shadow.querySelector('.wg__table') as HTMLElement | null
		const container = this.#shadow.querySelector('.wg') as HTMLElement | null
		if (!table || !container) return

		focusEvents.init(table)
		// Focus out of the table
		focusEvents.subscribe('focusout', (_target, relatedTarget) => {
			if (!relatedTarget || !table.contains(relatedTarget)) {
				handleTableFocusOut(this.#host, { relatedTarget } as unknown as FocusEvent)
			}
		})
		// Blur events — internal focus change dispatch. Capture phase + skip guard
		// handled by focusEvents; outsideClick owns leaving-grid cleanup.
		focusEvents.subscribe('blur', (target, relatedTarget) => {
			if (focusEvents.shouldSkipBlur()) return
			const isLeavingGrid = !relatedTarget || !this.#shadow.contains(relatedTarget)
			if (isLeavingGrid) return
			// Into the cell's own phone sheet (dropdown / date editor): the edit goes on there
			if (relatedTarget.closest('.wg__dropdown, .wg-datepicker-container')) return
			handleInternalBlur(this.#host, target, relatedTarget)
		})

		// Scroll — close dropdown + virtual scroll + infinite scroll + connector update.
		// When isTableBorderOnly is enabled, the scroll container is .wg__table-container
		const scrollContainer = this.#engine.isTableBorderOnly
			? (this.#shadow.querySelector('.wg__table-container') as HTMLElement) || container
			: container
		scrollEvents.init(scrollContainer)
		scrollEvents.subscribe('container', () => handleContainerScroll(this.#host, container, scrollContainer))
		scrollEvents.subscribe('window', () => handleWindowScroll(this.#host))

		// Outside-click detection: a click whose composed path misses the host. The grid's overlays
		// (dropdown, date picker, menus, sheets) live in its shadow root, so they count as inside.
		this.#clickEvents.init(container, this)
		this.#clickEvents.subscribe('outsideClick', () => handleOutsideClick(this.#host))
		this.#clickEvents.subscribe('sortClick', (subCtx) => handleSortClickSubscription(this.#host, subCtx))
	}

	#attachEventListeners(): void {
		const table = this.#shadow.querySelector('.wg__table')
		if (!table) return

		// Track mouse button state so focus handler can distinguish mouse vs keyboard focus
		// (the document mouseup that clears it is added once in connect())
		table.addEventListener('mousedown', () => { this.#host.isMouseDown = true }, true)

		// Focus — capture-phase, drives handleCellFocus + always-edit-mode swap + focus-change (keyboard only)
		// Extracted to modules/events/table-focus.ts
		table.addEventListener('focus', (e: Event) => handleTableFocus(this.#host, e), true)

		// Keydown — tree shortcuts + pipeline + datepicker passthrough + editor/cell dispatch
		// Extracted to modules/events/table-keydown.ts
		table.addEventListener('keydown', (e: Event) => handleTableKeyDown(this.#host, e))

		// Double-click — pipeline + dblclick / navigate editTrigger paths.
		// Tree-column dblclick-to-toggle is handled in table-mousedown via
		// MouseEvent.detail === 2 because surgical render rebuilds the cell's
		// <td> between clicks and the browser drops the native dblclick when
		// the two click targets differ.
		// Extracted to modules/events/table-clicks.ts
		table.addEventListener('dblclick', (e: Event) => handleTableDblClick(this.#host, e))

		// Single click — tree chevron + pipeline + click editTrigger
		// Extracted to modules/events/table-clicks.ts
		table.addEventListener('click', (e: Event) => handleCellClickToEdit(this.#host, e))

		// Mousedown - tree dblclick / cell range selection / date trigger / dropdown switch
		// Extracted to modules/events/table-mousedown.ts
		table.addEventListener('mousedown', (e: Event) => handleTableMouseDown(this.#host, e))

		// Legacy click on .wg__select-trigger / .wg__select-value — toggles dropdown.
		// Skipped in 'always' mode (pipeline owns dropdown open there).
		// Extracted to modules/events/table-clicks.ts
		table.addEventListener('click', (e: Event) => handleSelectTriggerClick(this.#host, e))

		// Mousedown — column resize / reorder / column-select / row-select / clear-on-empty
		// Extracted to modules/events/header-mousedown.ts
		table.addEventListener('mousedown', (e: Event) => handleHeaderRowMouseDown(this.#host, e))

		// Header click → column selection (replace/range/toggle). Only fires when
		// isColumnReorderAllowed is on; otherwise mousedown handler does it.
		// Extracted to modules/events/table-clicks.ts
		table.addEventListener('click', (e: Event) => handleHeaderColumnSelectClick(this.#host, e))

		// Context menu (right-click)
		table.addEventListener('contextmenu', (e: Event) => {
			handleContextMenu(this.#host, e as MouseEvent)
		})

		// Change events (checkbox)
		table.addEventListener('change', (e: Event) => {
			const target = e.target as HTMLElement
			if (target.matches('.wg__editor--checkbox')) {
				handleCheckboxChange(this.#host, target as HTMLInputElement)
			}
		})

		// Input events (combobox/autocomplete)
		table.addEventListener('input', (e: Event) => {
			const target = e.target as HTMLElement
			if (target.matches('.wg__combobox-input')) {
				handleComboboxInput(this.#host, e)
			} else if (target.matches('.wg__autocomplete-input')) {
				handleAutocompleteInput(this.#host, e)
			}
		})

		// (scroll / focusout / blur / outside click: #wireEventManagers)
		const container = this.#shadow.querySelector('.wg') as HTMLElement
		if (container) {
			// Make container focusable for keyboard events when rows are selected
			container.setAttribute('tabindex', '-1')

			// Range shortcuts + Escape + Ctrl+C for active selections
			// Extracted to modules/events/container-keydown.ts
			container.addEventListener('keydown', (e: KeyboardEvent) => handleContainerKeyDown(this.#host, e))
		}

		// Row toolbar events — trigger / inline / hover / mousemove / click / outside click
		attachToolbarListeners(this.#host, table)

		// Pagination events (delegated on .wg container — see attachPaginationListeners)
		const wgContainer = this.#shadow.querySelector('.wg') as HTMLElement | null
		if (wgContainer) {
			attachPaginationListeners(this.#host, wgContainer)
			// Filter row (delegated too — the thead is rebuilt on every render)
			attachFilterRowListeners(this.#host, wgContainer)
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
		return scrollRowIntoView(this.#host, rowIndex, 'scroll-to-row')
	}

	// ==========================================================================
	// Rendering
	// ==========================================================================

	/** Shortcuts help icon + overlay — see modules/rendering/shortcuts-help.ts */
	#renderShortcutsHelpIcon(): string {
		return renderShortcutsHelpIconModule(this.#host)
	}

	#render(): void {
		// Drop any stale data-pipeline cache. Normally requestUpdate() has already
		// done this, but render() is also called directly in a few places.
		this.#engine.invalidateDisplayCache()
		gridPerf.clear()
		gridPerf.start('render() body')
		uiLogger.debug('render:', this.#engine.displayItems.length, 'rows,', this.#engine.visualColumns.length, 'columns')
		// Preserve scroll position before re-render
		// When isTableBorderOnly is enabled, scroll container is .wg__table-container
		const oldContainer = this.#shadow.querySelector('.wg') as HTMLElement
		// A focused filter-row input (+ caret) is restored after the thead is rebuilt
		const filterFocus = captureFilterFocus(this.#host)
		// The open editor's typed text (+ caret): the edit goes on through the re-render
		const editorText = captureEditorText(this.#host)
		const oldScrollContainer = this.#engine.isTableBorderOnly
			? (this.#shadow.querySelector('.wg__table-container') as HTMLElement) || oldContainer
			: oldContainer
		const scrollTop = oldScrollContainer?.scrollTop || 0
		const scrollLeft = oldScrollContainer?.scrollLeft || 0

		// Preserve focused cell position (for restoring after re-render)
		const focusedCell = this.#engine.focusedCell

		// Parse pagination positions (e.g., "bottom-center" or "top-right|bottom-right")
		const paginationPositions = this.#engine.paginationPosition.split('|').map(p => p.trim())

		// Parse summary positions (if set)
		const summaryPositions = this.#engine.summaryPosition
			? this.#engine.summaryPosition.split('|').map(p => p.trim())
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
			if (areaHasSummary && areaHasPagination && this.#engine.isSummaryInline) {
				const topClass = isTop ? ' wg__footer--top' : ''
				return `<div class="wg__footer${topClass}">
					${renderSummary(this.#host, areaSummaryPositions[0])}
					${renderPagination(this.#host, areaPaginationPositions[0])}
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
						${renderSummary(this.#host, pos)}
						${renderPagination(this.#host, pos)}
					</div>`
				} else if (hasSummary) {
					return renderSummary(this.#host, pos)
				} else {
					return renderPagination(this.#host, pos)
				}
			}).join('')
		}

		// Render top and bottom areas
		const topContent = renderPositionArea(paginationPositions, true)
		const bottomContent = renderPositionArea(paginationPositions, false)

		// Determine if we should use virtual scrolling
		const useVirtualScroll = this.#engine.shouldUseVirtualScroll()

		// Get data rows HTML (virtual or normal)
		let dataRowsHtml: string
		if (useVirtualScroll) {
			// The window for the stored scroll position (scrollTop from the old container)
			const items = this.#engine.displayItems
			const rowHeight = this.#engine.virtualScrollItemHeight
			const viewportHeight = oldContainer?.clientHeight || 400  // Default height if not available
			const { startIndex, endIndex } = visibleRowRange(this.#host, scrollTop, viewportHeight)

			// Store for later comparison
			this.#host.virtualScroll.setRange(startIndex, endIndex)

			const params: VirtualScrollParams = {
				startIndex,
				endIndex,
				rowHeight,
				totalItems: items.length
			}
			dataRowsHtml = renderDataRowsVirtual(this.#host, params)
		} else {
			dataRowsHtml = renderDataRows(this.#host)
		}

		// Render shortcuts help icon if enabled
		const shortcutsHelpHtml = this.#renderShortcutsHelpIcon()

		const headerRowHtml = renderHeaderRow(this.#host)

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
		const wantsTableContainer = !!this.#engine.isTableBorderOnly
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
			container.className = getContainerClasses(this.#host)
			if (useVirtualScroll) container.classList.add('wg--virtual-scroll')
			container.toggleAttribute('inert', this.#engine.isDisabled)

			if (this.#engine.isScrollable && this.#engine.scrollMaxHeight !== '100vh') {
				container.style.setProperty('--wg-scroll-max-height', this.#engine.scrollMaxHeight)
			} else {
				container.style.removeProperty('--wg-scroll-max-height')
			}

			existingTopArea!.innerHTML = `${shortcutsHelpHtml}${topContent}`
			existingThead!.innerHTML = headerRowHtml
			existingTbody!.innerHTML = dataRowsHtml
			existingBottomArea!.innerHTML = bottomContent

			// Virtual scroll may have changed visible window — clamp scrollTop if it's now out of range
			if (useVirtualScroll) {
				const sc = this.#engine.isTableBorderOnly
					? (container.querySelector('.wg__table-container') as HTMLElement) || container
					: container
				const maxScrollTop = Math.max(0, this.#engine.displayItems.length * this.#engine.virtualScrollItemHeight - sc.clientHeight)
				if (sc.scrollTop > maxScrollTop) sc.scrollTop = maxScrollTop
			}
		} else {
			// Full rebuild path: first render, or structure changed (isTableBorderOnly toggled).
			if (oldContainer) oldContainer.remove()

			container = document.createElement('div')
			container.className = getContainerClasses(this.#host)
			if (useVirtualScroll) container.classList.add('wg--virtual-scroll')
			container.toggleAttribute('inert', this.#engine.isDisabled)

			if (this.#engine.isScrollable && this.#engine.scrollMaxHeight !== '100vh') {
				container.style.setProperty('--wg-scroll-max-height', this.#engine.scrollMaxHeight)
			}

			const tableCore = `
				<table class="wg__table">
					<thead>${headerRowHtml}</thead>
					<tbody>${dataRowsHtml}</tbody>
				</table>
			`
			const tableWithContainer = this.#engine.isTableBorderOnly
				? `<div class="wg__table-container">${tableCore}</div>`
				: tableCore

			container.innerHTML = `
				<div class="wg__top-area">${shortcutsHelpHtml}${topContent}</div>
				${tableWithContainer}
				<div class="wg__bottom-area">${bottomContent}</div>
			`

			this.#shadow.appendChild(container)

			// Restore scroll position (only needed when container was replaced)
			const scrollContainer = this.#engine.isTableBorderOnly
				? (container.querySelector('.wg__table-container') as HTMLElement) || container
				: container

			if (useVirtualScroll) {
				const maxScrollTop = Math.max(0, this.#engine.displayItems.length * this.#engine.virtualScrollItemHeight - scrollContainer.clientHeight)
				scrollContainer.scrollTop = Math.min(scrollTop, maxScrollTop)
			} else {
				scrollContainer.scrollTop = scrollTop
			}
			scrollContainer.scrollLeft = scrollLeft

			// Wire up event listeners (only on full rebuild — surgical path keeps them alive)
			this.#attachEventListeners()
			// The managers follow the new table / container (connect() wires them while detached → active)
			if (this.isConnected) this.#wireEventManagers()
		}

		// role="grid" / "treegrid" + row / column counts (the surgical path keeps the <table>)
		const table = container.querySelector('.wg__table') as HTMLTableElement | null
		if (table) writeGridAria(this.#host, table)

		// Post-render focus restore (editor focus + selection / focused-cell restore)
		// Extracted to modules/navigation/post-render-focus.ts
		// (a focused filter-row input keeps the focus — the cell isn't re-focused)
		restoreFocusAfterRender(this.#host, container, filterFocus ? null : focusedCell, editorText)
		// An open dropdown follows its cell's new editor (the old one went with the table)
		reanchorOpenDropdown(this.#host)
		// Exactly one body cell is the tab stop (roving tabindex); controls inside cells are none
		untabCellWidgets(container.querySelector('.wg__table > tbody'))
		reconcileTabStop(this.#host)
		restoreFilterFocus(this.#host, filterFocus)
		if (this.#isEditedRowGone) {
			this.#isEditedRowGone = false
			if (!this.#shadow.activeElement) (this.#shadow.querySelector('.wg') as HTMLElement | null)?.focus({ preventScroll: true })
		}
		positionFilterRow(this.#host)

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
		this.#host.renderConnector()

		// Update fill handle after render
		updateFillHandle(this.#host)

		// Update cell range border after render
		if (this.#engine.selectedCellRange) {
			updateRangeBorder(this.#host)
		}

		// Update row selection borders after render
		if (this.#engine.selectedRowIndices.length > 0) {
			createRowSelectionBorders(this.#host)
		} else {
			removeRowSelectionBorders()
		}

		// Update column selection borders after render
		if (this.#engine.selectedColumns.length > 0) {
			createColumnSelectionBorders(this.#host)
		} else {
			removeColumnSelectionBorders()
		}

		// The infinite-scroll row's loader (core renderLoader) — redrawn into the new row
		reconcileLoadingMoreLoader(this.#host)

		gridPerf.end('render() body', this.#engine.displayItems.length)
		gridPerf.summary('render()')
	}

	/** Custom editor lifecycle — see modules/editing/custom-editor.ts */
	openCustomEditor(rowIndex: number, colIndex: number): void {
		openCustomEditorModule(this.#host, rowIndex, colIndex)
	}

	/** Paste event handler — see modules/paste/handlePasteEvent */
	#handlePaste = (e: ClipboardEvent): Promise<void> => handlePasteEvent(this.#host, e)

	/**
	 * The public facade (`el.controller`, and `controller` on every callback ctx and
	 * event detail).
	 */
	protected override createController(): GridController<T> {
		return createGridController<T>(this, this.#host)
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
 * Complex properties — `columns`, `items`, menus / toolbars / shortcuts, UI state — are not inputs,
 * so a rule cannot set them (core warns and skips the key).
 */
export type GridResponsiveConfig = GridElementConfig

/** Partial grid configs per `device` class / width `breakpoint` / the grid's own `container` width (`{ device?, breakpoint?, container? }`, core ResponsiveMap) — `el.responsive`, `window.components['web-grid'].responsive`. */
export type GridResponsiveMap = ResponsiveMap<GridResponsiveConfig>

/** Computed responsive rule — `el.responsiveCallback`, `window.components['web-grid'].responsiveCallback`. */
export type GridResponsiveCallback = ResponsiveCallback<GridResponsiveConfig>

export default GridElement

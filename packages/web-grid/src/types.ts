// =============================================================================
// QuickGrid Types - Ported from QuickGrid.svelte lines 17-245
// =============================================================================

import type {
	GridContext,
	HeaderMenuContext,
	RowContext,
	RowDataContext,
	CellContext,
	FilterContext,
	ValidateContext,
	PasteValueContext,
	EditorContext,
	ValidationTooltipContext,
	RowLockContext,
	OptionContext,
	OptionRenderContext,
	OptionSearchContext,
	OptionSelectContext,
	PaginationLabelsContext,
	SummaryContext,
	ChevronContext,
	FillContext,
	BeforePasteContext,
	CreateRowContext,
	GridToolbarEntry,
	GridMenuEntry,
	GridHeaderMenuEntry,
	GridShortcut,
	GridRangeShortcut,
	GridActionEventDetail,
	GridEventMap,
	BeforePageChangeContext
} from './interaction.js'

// Editor type options
export type Editor = "text" | "number" | "checkbox" | "select" | "combobox" | "date" | "autocomplete" | "custom"

/** @deprecated use `Editor` */
export type EditorType = Editor

// How editing is triggered
export type EditTrigger = "click" | "dblclick" | "button" | "always" | "navigate"

// Grid preset - sets sensible defaults for common use cases
export type GridPreset = "read-only" | "excel" | "input-matrix"

// When to show dropdown toggle (▼)
export type ToggleVisibility = "always" | "on-focus"

// Date output format options
export type DateOutputFormat = "date" | "iso" | "timestamp"

// How to position cursor/selection when entering edit mode
export type EditStartSelection = "mousePosition" | "selectAll" | "cursorAtStart" | "cursorAtEnd"

// Fill handle direction mode
export type FillDirection = "vertical" | "all"

// Cell selection mode - how cell ranges are selected
export type CellSelectionMode = "disabled" | "click" | "shift"

// Option for select/combobox/autocomplete editors
export type EditorOption = {
	value: string | number | boolean
	label: string
	[key: string]: unknown  // Allow extra properties
}

// Editor configuration options
export type EditorOptions<T = unknown> = {
	// === SHARED (select/combobox/autocomplete) ===
	options?: EditorOption[]

	// Member properties (string-based property access)
	valueMember?: string      // Property for value (default: "value")
	displayMember?: string    // Property for display text (default: "label")
	searchMember?: string     // Property for searchable text (falls back to displayMember)
	iconMember?: string       // Property for icon/emoji
	subtitleMember?: string   // Property for subtitle/description
	disabledMember?: string   // Property for disabled state
	groupMember?: string      // Property for grouping options

	// Callback alternatives (override member properties)
	getValueCallback?: (ctx: OptionContext<T>) => string | number
	getDisplayValueCallback?: (ctx: OptionContext<T>) => string
	getSearchValueCallback?: (ctx: OptionContext<T>) => string
	getIconCallback?: (ctx: OptionContext<T>) => string
	getSubtitleCallback?: (ctx: OptionContext<T>) => string
	getIsDisabledCallback?: (ctx: OptionContext<T>) => boolean
	getGroupCallback?: (ctx: OptionContext<T>) => string

	// Render callback (returns HTML string)
	renderOptionCallback?: (ctx: OptionRenderContext<T>) => string

	// An option was picked (select / combobox / autocomplete)
	onSelect?: (ctx: OptionSelectContext<T>) => void

	// Other shared options
	allowEmpty?: boolean    // Allow null/empty selection
	emptyLabel?: string     // Label for empty option (default: "-- Select --")
	noOptionsText?: string  // Override "No options" message (falls back to grid.labels.dropdownNoOptions)
	searchingText?: string  // Override "Searching..." message (falls back to grid.labels.dropdownSearching)
	dropdownMinWidth?: string  // Minimum width for dropdown (e.g., "300px") - useful when cell is narrow

	// === TEXT ===
	maxLength?: number
	placeholder?: string
	pattern?: string
	inputMode?: "text" | "numeric" | "email" | "tel" | "url"
	editStartSelection?: EditStartSelection  // Cursor position when entering edit (default: "selectAll")

	// === NUMBER ===
	min?: number
	max?: number
	step?: number
	decimalPlaces?: number
	allowNegative?: boolean

	// === CHECKBOX ===
	trueValue?: unknown     // Value to store when checked (default: true)
	falseValue?: unknown    // Value to store when unchecked (default: false)

	// === DATE ===
	minDate?: Date | string
	maxDate?: Date | string
	dateFormat?: string               // Display format: 'YYYY-MM-DD', 'DD.MM.YYYY', etc.
	outputFormat?: DateOutputFormat  // What to store: Date object, ISO string, or timestamp

	// === AUTOCOMPLETE ===
	initialOptions?: EditorOption[]  // Show before search (popular items)
	searchCallback?: (ctx: OptionSearchContext<T>) => Promise<EditorOption[]>
	minSearchLength?: number         // Min chars before search (default: 1)
	debounceMs?: number              // Debounce search calls (default: 300)
	multiple?: boolean               // Allow multiple selections
	maxSelections?: number           // Max items when multiple=true
}

// Validation state for a cell.
// `rowKey` is a stable id derived from `idMember` (preferred), `treePathMember` (tree mode),
// or the displayed-index fallback as a string. Keying by stable id (not displayed index) means
// invalid markers survive sort/filter/pagination/tree-toggle reorderings.
export type CellValidationState = {
	rowKey: string
	field: string
	error: string
}

// Validation result object from `column.validateCallback`
export type ValidationResult = {
	valid: boolean
	message?: string
	transformedValue?: unknown
}

// `column.validateCallback` can return:
// - ValidationResult object (`transformedValue` replaces the committed value)
// - boolean (true = valid, false = invalid with no message)
// - string (error message = invalid)
// - null/undefined (valid)
export type ValidateResult = ValidationResult | boolean | string | null | undefined

// Column definition
export type Column<T> = {
	field: keyof T | string
	title: string
	headerInfo?: string  // Info tooltip shown next to header title (displays ⓘ icon)
	isSortable?: boolean
	isFilterable?: boolean
	width?: string
	minWidth?: string
	maxWidth?: string
	textOverflow?: 'wrap' | 'ellipsis'
	maxLines?: number  // Maximum visible lines when textOverflow is 'wrap' (uses CSS line-clamp)
	// Body cells in this column never wrap (white-space: nowrap). Combine with `maxWidth` for
	// single-line cells with ellipsis truncation. Header mirrors the body's nowrap so a
	// body-nowrap column doesn't end up with a wrapping header above single-line cells.
	nowrap?: boolean
	// Custom filter predicate for this column. Replaces the built-in case-insensitive substring
	// match. Return true → row passes filter; false → row excluded; null → input is incomplete
	// (e.g. user typed `>` without a number) — grid ignores this filter (all rows pass) AND adds
	// a visual `.invalid` class to the input so the user gets a red border instead of an empty grid.
	filterCallback?: (ctx: FilterContext<T>) => boolean | null
	horizontalAlign?: "left" | "center" | "right" | "justify"  // Horizontal alignment for cells (default: "left", also used by dropdown options)
	verticalAlign?: "top" | "middle" | "bottom"  // Vertical alignment for cells (default: "middle")
	headerHorizontalAlign?: "left" | "center" | "right" | "justify"  // Header horizontal alignment (defaults to horizontalAlign)
	headerVerticalAlign?: "top" | "middle" | "bottom"  // Header vertical alignment (defaults to verticalAlign)
	cellClass?: string  // Custom CSS class(es) applied to all cells in this column
	getCellClassCallback?: (ctx: CellContext<T>) => string | null  // Dynamic CSS class based on value/row
	getDisplayValueCallback?: (ctx: CellContext<T>) => string  // Display text for the cell (escaped)
	renderCellCallback?: (ctx: CellContext<T>) => string  // Cell HTML (wins over getDisplayValueCallback)
	// Editing props
	// Static editability for the column. `getIsEditableCallback` decides per row instead
	// (e.g. column is editable only on employee rows in a teams + employees tree) and, when it
	// returns true, makes the cell editable even on a read-only grid.
	isEditable?: boolean
	getIsEditableCallback?: (ctx: RowDataContext<T>) => boolean
	editor?: Editor
	editTrigger?: EditTrigger  // Per-column override
	dropdownToggleVisibility?: ToggleVisibility  // Per-column override for toggle visibility
	shouldOpenDropdownOnEnter?: boolean  // Per-column override: Enter opens dropdown (true) or moves down (false)
	editorOptions?: EditorOptions<T>
	// Validates a commit (editor or paste) and may transform the value — see ValidateResult.
	// Async OK. Not a veto: an invalid value is kept as a draft and the cell marked invalid.
	validateCallback?: (ctx: ValidateContext<T>) => ValidateResult | Promise<ValidateResult>
	// Custom editor: render your editor and call ctx.commit(value) / ctx.cancel()
	renderEditorCallback?: (ctx: EditorContext<T>) => void
	// Show the edit button in this column's editable cells whatever the editTrigger
	// (editTrigger: 'button' shows it anyway)
	isEditButtonVisible?: boolean
	// Tooltip - displayed on cell hover
	tooltipMember?: string  // Property name in row data containing tooltip text
	getTooltipCallback?: (ctx: CellContext<T>) => string | null  // Dynamic tooltip (takes priority over tooltipMember)
	isTooltipHtml?: boolean  // Render tooltip content as HTML instead of plain text
	// Clipboard: per-cell value conversions (run once per copied / pasted cell; can't cancel)
	getCopyValueCallback?: (ctx: CellContext<T>) => string  // Text copied for this cell by a single-cell Ctrl+C (range / row / column copies use the raw values)
	getPasteValueCallback?: (ctx: PasteValueContext<T>) => unknown  // Value stored for the pasted text
	// Validation tooltip - return HTML string for rich error display
	getValidationTooltipCallback?: (ctx: ValidationTooltipContext<T>) => string | null
	// Freeze panes - column sticks to left side during horizontal scroll
	isFrozen?: boolean
	// Resizable - allow column width to be changed by dragging (default: true)
	isResizable?: boolean
	// Movable - allow column to be reordered by dragging (default: true)
	isMovable?: boolean
	// Fill direction - override grid-level fillDirection for this column
	fillDirection?: FillDirection
	// Hidden - column is not rendered but kept in columns array for visibility toggling
	isHidden?: boolean
	// Tree column - renders depth-based indentation and expand/collapse chevron
	// Only one column should be marked isTree per grid; behaves as plain column otherwise.
	isTree?: boolean
}

// Detail of the row-change event
export type RowChangeDetail<T> = {
	row: T                    // Original row (unchanged)
	draftRow: T              // Draft row with user's changes (including invalid)
	rowIndex: number
	field: string
	oldValue: unknown
	newValue: unknown
	isValid: boolean
	validationError?: string | null
}

// Detail of the row-focus event
export type RowFocusDetail<T> = {
	rowIndex: number
	row: T
	previousRowIndex: number | null
}

/**
 * Detail of the `cell-selection-change` event. Cleared selection:
 * `{ range: null, cellCount: 0, fields: [], rows: [] }`.
 */
export type CellSelectionChangeDetail<T = any> = {
	/**
	 * The selected rectangle. Its `startColIndex` / `endColIndex` are ON-SCREEN
	 * (visual) positions — not indices into `columns` (see {@link CellRange}).
	 */
	range: CellRange | null
	/** Number of cells in the range. */
	cellCount: number
	/** Fields of the range's columns, in on-screen order. */
	fields: string[]
	/** The row objects in the range, each once, in display order. */
	rows: T[]
}

/** Detail of the `row-selection-change` event (row-number clicks / drag, row selection API). */
export type RowSelectionChangeDetail<T = any> = {
	/** The selected row objects, in display order. */
	rows: T[]
	/** Their display row indices, ascending. */
	rowIndices: number[]
}

/** Detail of the `column-selection-change` event (header clicks / drag, column selection API). */
export type ColumnSelectionChangeDetail = {
	/** Fields of the selected columns, in on-screen order. */
	fields: string[]
}

// =============================================================================
// Row Toolbar Types
// =============================================================================

// Toolbar position options
export type ToolbarPosition = 'auto' | 'left' | 'right' | 'top' | 'inline'

// New empty row position
/** @experimental This type may change in future releases */
export type NewRowPosition = 'top' | 'bottom'

// =============================================================================
// Selection Types
// =============================================================================

/**
 * Selected cell range (rectangular region). `startColIndex` / `endColIndex` are
 * VISUAL positions — indices into the displayed column order (after reordering,
 * with hidden columns skipped), so the rectangle is contiguous on screen. They are
 * not the column index (`colIndex` / `data-col`) used by cell contexts; map with
 * `visualColumns[pos].originalIndex` (`getSelectedCells()` reports the column
 * index). `startField` / `endField` name the corner columns.
 */
export type CellRange = {
	startRowIndex: number
	startColIndex: number
	endRowIndex: number
	endColIndex: number
	startField: string
	endField: string
}

// Parsed key combination (internal use)
export type ParsedKeyCombo = {
	key: string
	ctrl: boolean
	shift: boolean
	alt: boolean
	meta: boolean
}

// =============================================================================
// Component Props
// =============================================================================

// Main QuickGrid props
export type QuickGridProps<T> = {
	items: T[]
	columns: Column<T>[]
	isFilterable?: boolean
	// Default `min-width` applied to every column header that doesn't specify its own `minWidth`.
	// Useful with `fillerColumn` so content-sized columns don't collapse too far when the filler
	// claims leftover space. Skipped on columns that opted into `autoWidth`.
	columnMinWidth?: string
	// 'client' (default) filters `items` in the grid. 'server': the grid only renders the filter
	// inputs and fires `filter-change` on every keystroke with a `{field: value}` map; the consumer
	// replaces `items`. Typical pattern: debounce, post the filter map to a backend, set `items`.
	filterMode?: 'client' | 'server'
	isPageable?: boolean
	pageSize?: number
	isStriped?: boolean
	isHoverable?: boolean
	isRowNumbersVisible?: boolean  // Show row number column on the left (default: false)
	isDirtyIndicatorVisible?: boolean  // Show visual indicator on cells with unsaved changes (default: true)
	isStickyRowNumbers?: boolean  // Make row number column sticky (freeze panes)
	freezeColumns?: number  // Freeze first N columns (after visual reorder from isFrozen: true)
	class?: string
	style?: string
	getCustomStylesCallback?: (ctx: GridContext<T>) => string  // Custom CSS to inject into shadow DOM
	getRowClassCallback?: (ctx: RowContext<T>) => string | null  // Dynamic CSS class for rows
	// Field on each row uniquely identifying it (default: 'id'; `null` = none). The only row-id
	// member: getRowId / findRowById / updateRowById / replaceRowById / lockRowById read it
	// (or `getIdCallback`). Internal state (drafts, invalid-cell markers)
	// is keyed by this value, so pagination, filter, sort, and tree expand/collapse no longer
	// cause an in-flight edit / invalid marker to land on the wrong row when the displayed
	// order changes. Falls back to `treePathMember` (tree mode) → for drafts, the row object
	// itself; for invalid-cell markers, the displayed-row index string.
	idMember?: keyof T | string
	// Sorting
	sort?: SortState[]  // Current sort state (can be set for initial/server-side sort)
	sortMode?: SortMode  // Sort mode: "none" (disabled), "single", or "multi" (default: "none")
	// Pagination state
	currentPage?: number  // Current page (1-based)
	totalItems?: number   // Total items for server-side pagination
	isPaginationVisible?: boolean | 'auto'  // true=always show, false=never, 'auto'=hide when ≤1 page
	/** @deprecated use `isPaginationVisible` */
	showPagination?: boolean | 'auto'
	pageSizes?: number[]  // Available page sizes for selector (e.g., [10, 25, 50, 100])
	paginationMode?: 'client' | 'server'  // 'client' = grid slices items, 'server' = items are already current page (default: 'client')
	paginationPosition?: string  // Position(s): "bottom-center" (default), "top-right|bottom-right" for multiple
	getPaginationLabelsCallback?: PaginationLabelsCallback<T>  // Customize/translate pagination text
	paginationLayout?: string  // Element order: "pageSize|previous|pageInfo|next" or "first|previous|pageInfo|next|last"
	// Summary
	summaryPosition?: string  // Position(s): "bottom-left", "top-right|bottom-right", etc.
	renderSummaryCallback?: SummaryCallback<T>  // Returns the summary HTML
	summaryMetadata?: unknown  // Passed to renderSummaryCallback as ctx.metadata
	isSummaryInline?: boolean  // Share row with pagination when in same area (default: true)
	// Editing props
	isEditable?: boolean
	// Row-level editability gate. Combined with grid-level `isEditable` and column-level `isEditable`:
	// all three must pass for a cell to be editable. Use when every editable column shares the same
	// row predicate — cheaper than repeating the predicate on every column.
	isRowEditable?: boolean
	getIsRowEditableCallback?: (ctx: RowDataContext<T>) => boolean
	editTrigger?: EditTrigger
	editButtonIcon?: string  // Edit button HTML for editTrigger 'button' (default '✎'; e.g. '<span class="lucide-pencil"></span>')
	editStartSelection?: EditStartSelection  // Default cursor position when entering edit via navigate mode (default: selectAll)
	shouldCommitOnClickAway?: boolean  // Commit the editor value (Excel-like) when clicking another cell; false discards. Default: true
	preset?: GridPreset  // Preset - sets sensible defaults (read-only, excel, input-matrix); read-only also sets isReadonly
	isReadonly?: boolean  // Values can't change (no edit / paste / fill / row add-delete-move); still focusable, selectable, copyable
	isDisabled?: boolean  // No interaction at all
	dropdownToggleVisibility?: ToggleVisibility  // When to show dropdown toggle (always, on-focus)
	shouldShowDropdownOnFocus?: boolean  // Auto-open dropdown when cell is focused
	shouldOpenDropdownOnEnter?: boolean  // Enter opens dropdown (true) or moves down (false, default)
	isCheckboxAlwaysEditable?: boolean  // Make checkboxes always interactive, even in navigate mode
	// Invalid cells state (for external tracking)
	invalidCells?: CellValidationState[]
	// Row toolbar (floating toolbar for row actions)
	isRowToolbarVisible?: boolean
	rowToolbar?: GridToolbarEntry<T>[]  // Built-in names, action items, dividers (default: ['add', 'delete', 'duplicate'])
	toolbarVerticalAlign?: 'top' | 'center' | 'bottom'  // Vertical alignment for left/right positions: top (rows above), center, bottom (default, rows below)
	toolbarHorizontalAlign?: 'start' | 'center' | 'end' | 'cursor'  // Horizontal alignment for top position (default: 'center')
	toolbarTrigger?: 'hover' | 'click' | 'button'  // How to show toolbar
	toolbarPosition?: ToolbarPosition  // Preferred position: auto (default), left, right, top, or inline
	toolbarColumn?: string | number  // Column to position toolbar over (field name or index) for 'top' position
	shouldToolbarFollowCursor?: boolean  // Toolbar follows mouse cursor horizontally (default: false)
	/** @deprecated use `shouldToolbarFollowCursor` */
	toolbarFollowsCursor?: boolean
	getCellToolbarItemsCallback?: (ctx: CellContext<T>) => GridToolbarEntry<T>[] | null | undefined  // Cell-specific toolbar items (merged over rowToolbar by id / action)
	cellToolbarOffset?: number | string  // Horizontal offset: number 0-1 as fraction of cell width, or CSS length string (e.g. '2rem'). Default: 0.2
	toolbarBtnMinWidth?: string  // Min-width for toolbar buttons (CSS value, e.g. '32px'). Overrides --wg-toolbar-btn-min-width
	inlineActionsTitle?: string | null  // Inline actions column header (toolbarPosition="inline"); absent → labels.inlineActionsHeader, '' → blank
	// Context menu (row/cell): built-in names, menu items (submenus via children /
	// getChildrenCallback), dividers.
	contextMenu?: GridMenuEntry<T>[]
	contextMenuXOffset?: number           // Horizontal offset from click (default: 8)
	contextMenuYOffset?: number           // Vertical offset from click (default: 0)
	// Runs before the cell menu opens (sync): `false` → no grid menu (the browser's shows),
	// an entries array → shown instead of `contextMenu`.
	beforeContextMenuOpenCallback?: (ctx: CellContext<T>) => false | GridMenuEntry<T>[] | void
	// Header context menu (column headers)
	headerContextMenu?: GridHeaderMenuEntry<T>[]
	beforeHeaderMenuOpenCallback?: (ctx: HeaderMenuContext<T>) => false | GridHeaderMenuEntry<T>[] | void
	// Runs before any toolbar / menu / shortcut item activates: `false` cancels (async OK).
	beforeActionCallback?: (detail: GridActionEventDetail<T>) => unknown
	// Keyboard shortcuts on the focused / hovered row, and on the selected rows / cell range
	rowShortcuts?: GridShortcut<T>[]
	rangeShortcuts?: GridRangeShortcut<T>[]
	isShortcutsHelpVisible?: boolean              // Show info icon (default: false)
	shortcutsHelpPosition?: 'top-right' | 'top-left'  // Icon position (default: 'top-right')
	renderShortcutsHelpCallback?: (ctx: GridContext<T>) => string   // Custom HTML shown with the shortcuts list
	// Scroll behavior
	isScrollable?: boolean               // Enable scroll container with max-height: 100vh (default: false)
	scrollMaxHeight?: string             // Custom max-height when isScrollable is true (default: '100vh')
	isTableBorderOnly?: boolean          // Border only around table, not pagination/toolbar (default: false)
	/** @deprecated use `isTableBorderOnly` */
	tableBorderOnly?: boolean
	// Virtual scroll
	isVirtualScrollEnabled?: boolean     // Enable virtual scroll (default: false)
	virtualScrollThreshold?: number      // Auto-enable when items >= threshold (default: 100)
	virtualScrollRowHeight?: number      // Fixed row height in px (default: 38)
	virtualScrollBuffer?: number         // Extra rows above/below viewport (default: 10)
	// Infinite scroll (load more)
	isInfiniteScrollEnabled?: boolean    // Enable infinite scroll (default: false)
	infiniteScrollThreshold?: number     // Distance from bottom to trigger load (default: 100px)
	hasMoreItems?: boolean               // Set to false when no more data (default: true)
	// Validation tooltip - return HTML string for rich error display (column-level overrides this)
	getValidationTooltipCallback?: (ctx: ValidationTooltipContext<T>) => string | null
	// Column resize & persistence
	gridName?: string                                    // Unique name for localStorage persistence
	shouldPersistColumnWidths?: boolean                  // Persist column widths to localStorage (requires gridName)

	// Column reorder & persistence
	isColumnReorderAllowed?: boolean                     // Enable drag-to-reorder columns (default: false)
	shouldPersistColumnOrder?: boolean                   // Persist column order to localStorage (requires gridName)

	// Fill handle (Excel-like autofill): `false` cancels the fill (async OK)
	beforeFillCallback?: (ctx: FillContext<T>) => boolean | void | Promise<boolean | void>
	// Before a user action swaps the rows (pager, page size, server-mode sort / filter row): false → stay, a number → that page (async OK)
	beforePageChangeCallback?: (ctx: BeforePageChangeContext<T>) => boolean | number | void | Promise<boolean | number | void>

	// Cell range selection
	cellSelectionMode?: CellSelectionMode  // How to select cell ranges: 'disabled', 'click' (default), 'shift'
	shouldCopyWithHeaders?: boolean  // Include column headers when copying cell selection to clipboard (default: false)

	// Multi-cell paste (Excel / TSV)
	pasteMode?: PasteMode
	shouldValidateOnPaste?: boolean
	// Runs before a multi-cell paste: `false` cancels; add "row-col" keys to ctx.skipCells to skip cells (async OK)
	beforePasteCallback?: (ctx: BeforePasteContext<T>) => boolean | void | Promise<boolean | void>
	createRowCallback?: CreateRowCallback<T>  // New row for pasted data past the last row

	// Row identity (drafts, row locking, findRowById / updateRowById): `idMember` (default 'id')
	getIdCallback?: (ctx: RowDataContext<T>) => unknown  // Computed id; wins over idMember
	rowLocking?: RowLockingOptions<T>

	labels?: Partial<GridLabels>

	// Event twins (each receives the event detail — see GridEventMap)
	onRowChange?: (detail: GridEventMap<T>['row-change']) => void
	onEditStart?: (detail: GridEventMap<T>['edit-start']) => void
	onEditCancel?: (detail: GridEventMap<T>['edit-cancel']) => void
	onValidationError?: (detail: GridEventMap<T>['validation-error']) => void
	onRowFocus?: (detail: GridEventMap<T>['row-focus']) => void
	onRowDelete?: (detail: GridEventMap<T>['row-delete']) => void
	onCellSelectionChange?: (detail: GridEventMap<T>['cell-selection-change']) => void
	onRowSelectionChange?: (detail: GridEventMap<T>['row-selection-change']) => void
	onColumnSelectionChange?: (detail: GridEventMap<T>['column-selection-change']) => void
	onDataRequest?: (detail: GridEventMap<T>['data-request']) => void
	onFilterChange?: (detail: GridEventMap<T>['filter-change']) => void
	onColumnResize?: (detail: GridEventMap<T>['column-resize']) => void
	onColumnReorder?: (detail: GridEventMap<T>['column-reorder']) => void
	onExpandChange?: (detail: GridEventMap<T>['expand-change']) => void
	onRowLockChange?: (detail: GridEventMap<T>['row-lock-change']) => void
	onPasteComplete?: (detail: GridEventMap<T>['paste-complete']) => void
	onAction?: (detail: GridEventMap<T>['action']) => void
	// Tree / hierarchy (ltree-style path strings: "1.2.3", "/dept/eng/team", "C:\\a\\b")
	treePathMember?: keyof T | string                  // Required to enable tree mode: field holding the path
	treeLevelMember?: keyof T | string                 // Optional pre-computed depth (0-based)
	treeParentMember?: keyof T | string                // Optional pre-computed parent path
	treeSeparator?: string                             // Path separator (auto-detected from first row when omitted)
	treeDataSorted?: boolean                           // true = trust caller order completely (grid never re-sorts; pair with data-request for sort changes). false = grid sorts siblings depth-first.
	expandedPaths?: Set<string>                        // Bindable set of expanded paths (mutated by grid; fires expand-change)
	defaultExpandDepth?: number                        // Tree depth to show initially: 0 = only roots, 1 = roots + their children, etc. (default: all expanded)
	treeDoubleClickBehavior?: TreeDoubleClickBehavior  // What happens when user double-clicks a tree-column cell (default: 'none')
	// Chevron customization (static glyphs are defaults; callback overrides per-row)
	treeExpandedGlyph?: string                         // HTML/text shown when node is expanded (default: '▶' — same glyph as collapsed; CSS rotates 90° via .wg__tree-chevron--expanded)
	treeCollapsedGlyph?: string                        // HTML/text shown when node is collapsed (default: '▶'). When expanded and collapsed glyphs are equal, CSS rotates the glyph; when they differ, the glyph is swapped (no rotation).
	renderChevronCallback?: ChevronCallback<T>         // Per-row chevron HTML; cached per (row, expanded)

	// New empty row (inline data entry) — EXPERIMENTAL: API may change in future releases
	isNewRowEnabled?: boolean                          // [Experimental] Enable always-visible empty row for data entry (default: false)
	newRowPosition?: NewRowPosition                    // [Experimental] Position of empty row: 'top' or 'bottom' (default: 'bottom')
	newRowIndicator?: string                           // [Experimental] Indicator shown in row number column (default: '+')
	createEmptyRowCallback?: (ctx: GridContext<T>) => T | Promise<T>  // [Experimental] New empty row (can be async); also the `add` built-in's row
	createDuplicateRowCallback?: (ctx: RowContext<T>) => T  // The copy the `duplicate` built-in inserts (default: shallow copy, idMember cleared)
}

// =============================================================================
// Internal Types (used within the component)
// =============================================================================

// Editing cell state
export type EditingCell = {
	rowIndex: number
	field: string
	initialSearchQuery?: string
	cursorPosition?: number
} | null

// Focused cell state (for navigate mode)
export type FocusedCell = {
	rowIndex: number
	colIndex: number
} | null

// Sort direction
export type SortDirection = "asc" | "desc"

// Sort mode - none (disabled), single column, or multi-column
export type SortMode = "none" | "single" | "multi"

// Popup position
export type PopupPosition = 'left' | 'right' | 'top'

// Connector arrow direction
export type ConnectorArrowDir = 'right' | 'left' | 'down'

// =============================================================================
// Sorting & Pagination Types
// =============================================================================

// Sort state for a single column
export type SortState = {
	column: string
	direction: SortDirection
}

// What triggered the data request
export type DataRequestTrigger = 'sort' | 'page' | 'pageSize' | 'filter' | 'init' | 'loadMore'

// How to handle the data response
export type DataRequestMode = 'replace' | 'append'

// Detail of the data-request event
export type DataRequestDetail = {
	sort: SortState[]
	page: number
	pageSize: number
	trigger: DataRequestTrigger
	mode: DataRequestMode    // 'replace' for normal ops, 'append' for loadMore
	skip: number             // Items to skip (offset for server)
}

// Pagination position (can combine with | for multiple, e.g., "top-right|bottom-right")
export type PaginationPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

// Pagination labels for translation/customization
export type PaginationLabels = {
	first: string
	previous: string
	next: string
	last: string
	pageInfo: string
	itemCount: string
	perPage: string
}

export type PaginationLabelsCallback<T = any> = (ctx: PaginationLabelsContext<T>) => Partial<PaginationLabels>

// Grid labels for translation/i18n
export type GridLabels = {
	// Toolbar
	rowActions: string              // Toolbar trigger button title
	inlineActionsHeader: string     // Default inline actions column header

	// Shortcuts help
	keyboardShortcuts: string       // Shortcuts help icon title
	rangeShortcuts: string          // Shortcuts help sub-heading above the rangeShortcuts (with rowShortcuts too)

	// Pagination (defaults, can be overridden by getPaginationLabelsCallback)
	paginationFirst: string
	paginationPrevious: string
	paginationNext: string
	paginationLast: string
	paginationPageInfo: string      // e.g., "Page {current} of {total}"
	paginationItemCount: string     // e.g., "{count} items"
	paginationPerPage: string       // e.g., "per page"

	// Dropdown
	dropdownNoOptions: string       // "No options" - shown when filter returns empty
	dropdownSearching: string       // "Searching..." - shown during async search

	// Row locking (row-number / row tooltip)
	rowLocked: string               // "This row is locked" - no lockedBy known
	rowLockedBy: string             // "Locked by {lockedBy}"

	// Go-to-row dialog (Ctrl/Cmd+G)
	goToRow: string                 // "Go to row (1-{max}):"
	goToRowGo: string               // "Go"
	goToRowCancel: string           // "Cancel"

	// Tree chevron aria-label
	treeExpand: string              // "Expand"
	treeCollapse: string            // "Collapse"

	// Edit button (editTrigger: 'button') — aria-label / title
	editCell: string                // "Edit"

	// Filter row
	filterColumn: string            // "Filter {column}" — aria-label of a filter-row input

	// Built-in value checks (number editor, paste typing) — the cell's validation error
	invalidNumber: string           // "Not a number"
	numberMin: string               // "Must be at least {min}"
	numberMax: string               // "Must be at most {max}"
	numberNegative: string          // "Must not be negative"
	invalidBoolean: string          // "Not a yes / no value" (pasted into a checkbox column)
	invalidDate: string             // "Not a valid date" (pasted into a date column)

	// Built-in row / tree action texts (toolbar, cell context menu, shortcuts help)
	actions: {
		add: string                  // "Add row"
		delete: string               // "Delete row"
		duplicate: string            // "Duplicate row"
		moveUp: string               // "Move up"
		moveDown: string             // "Move down"
		expandAll: string            // "Expand all"
		collapseAll: string          // "Collapse all"
		expandTree: string           // "Expand entire tree"
		collapseTree: string         // "Collapse entire tree"
	}

	// Header context menu
	contextMenu: {
		sortAsc: string              // "Sort Ascending"
		sortDesc: string             // "Sort Descending"
		clearSort: string            // "Clear Sort"
		hideColumn: string           // "Hide Column"
		freezeColumn: string         // "Freeze Column"
		unfreezeColumn: string       // "Unfreeze Column"
		columnVisibility: string     // "Column Visibility"
		showAll: string              // "Show all" - first option in column visibility submenu
	}
}

/** What `labels` accepts: any subset, including a subset of the nested `actions` / `contextMenu`
 * groups — everything not given keeps its default. */
export type GridLabelsInput = Partial<Omit<GridLabels, 'actions' | 'contextMenu'>> & {
	actions?: Partial<GridLabels['actions']>
	contextMenu?: Partial<GridLabels['contextMenu']>
}

// Summary content callback (returns HTML)
export type SummaryCallback<T = any> = (ctx: SummaryContext<T>) => string

// =============================================================================
// Row Locking Types
// =============================================================================

// Lock information for a row
export type RowLock = {
	isLocked: boolean
	lockedBy?: string        // Who locked (user name/ID)
	lockedAt?: Date | string // When locked
	reason?: string          // Why locked
	[key: string]: unknown   // Allow extra properties
}

/** @deprecated use `RowLock` */
export type RowLockInfo = RowLock

// Edit behavior for locked rows
export type LockedRowEditBehavior =
	| 'block'      // Cannot edit (default)
	| 'allow'      // Can edit, just show visual
	| 'callback'   // Consumer decides via callback

// Row locking configuration
export type RowLockingOptions<T> = {
	// Property-based sources
	lockedMember?: keyof T                    // Field with boolean
	lockInfoMember?: keyof T                  // Field with RowLock

	// Callback-based sources
	getIsLockedCallback?: (ctx: RowContext<T>) => boolean
	getLockInfoCallback?: (ctx: RowContext<T>) => RowLock | null

	// Edit behavior
	lockedEditBehavior?: LockedRowEditBehavior
	getCanEditLockedCallback?: (ctx: RowLockContext<T>) => boolean
}

// Event for lock changes
export type RowLockChangeDetail<T> = {
	rowId: unknown
	row: T | null
	rowIndex: number
	lockInfo: RowLock | null
	source: 'property' | 'callback' | 'external'
}

// =============================================================================
// Column Resize & Persistence Types
// =============================================================================

// Width state for a single column
export type ColumnWidthState = {
	field: string
	width: string
}

// Persisted grid state (stored in localStorage)
export type GridPersistenceState = {
	columnWidths?: ColumnWidthState[]
	columnOrder?: ColumnOrderState[]
}

// Detail of the column-resize event
export type ColumnResizeDetail = {
	field: string
	oldWidth: string
	newWidth: string
	allWidths: ColumnWidthState[]  // Same format as localStorage - can be sent to server
}

// Order state for a single column
export type ColumnOrderState = {
	field: string
	order: number
}

// Detail of the column-reorder event
export type ColumnReorderDetail = {
	field: string
	fromIndex: number
	toIndex: number
	allOrder: ColumnOrderState[]  // Same format as localStorage - can be sent to server
}

// =============================================================================
// Paste Types (Multi-cell paste from Excel/TSV)
// =============================================================================

/** Paste mode for handling non-editable columns */
export type PasteMode = 'skip-non-editable' | 'all-columns' | 'editable-only'

/** Column mapping when headers are detected in pasted data */
export type PasteColumnMapping = {
	pastedHeader: string    // Header value from clipboard
	gridField: string       // Matched field in grid column
	colIndex: number        // Column index in grid
}

/** Result for a single pasted cell */
export type PasteCellResult = {
	rowIndex: number
	field: string
	value: unknown
	isValid: boolean
	validationError?: string
	wasSkipped: boolean
	skipReason?: 'non-editable' | 'user-canceled' | 'out-of-bounds' | 'locked'
}

/** After paste event detail */
export type PasteDetail<T> = {
	totalCells: number
	successfulCells: number
	failedCells: number
	skippedCells: number
	newRowsCreated: number
	cellResults: PasteCellResult[]
	hadHeaders: boolean
}

/** Creates a new row from pasted data */
export type CreateRowCallback<T = any> = (ctx: CreateRowContext<T>) => T

// =============================================================================
// Tree / Hierarchy Types
// =============================================================================

/** What happens when the user double-clicks a tree-column cell */
export type TreeDoubleClickBehavior = 'none' | 'toggle'

/** Detail of `expand-change`: a node was toggled, or a bulk expand / collapse ran */
export type TreeExpandedChangeDetail = {
	path: string | null           // Toggled path / subtree root; null for expandAll / collapseAll
	isExpanded: boolean           // New state (true = expanded, false = collapsed)
	expandedPaths: Set<string>    // Full current set of expanded paths (after the change)
}

/**
 * Returns HTML for the chevron's inner content. Result is cached per (row, expanded) —
 * called at most twice per row. Invalidated when items or the callback change.
 */
export type ChevronCallback<T = any> = (ctx: ChevronContext<T>) => string

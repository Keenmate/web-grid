// =============================================================================
// QuickGrid Types - Ported from QuickGrid.svelte lines 17-245
// =============================================================================

// Editor type options
export type Editor = "text" | "number" | "checkbox" | "select" | "combobox" | "date" | "autocomplete" | "custom"

/** @deprecated use `Editor` */
export type EditorType = Editor

// How editing is triggered
export type EditTrigger = "click" | "dblclick" | "button" | "always" | "navigate"

// Grid mode - sets sensible defaults for common use cases
export type GridMode = "read-only" | "excel" | "input-matrix"

// When to show dropdown toggle (▼)
export type ToggleVisibility = "always" | "on-focus"

// When to load dynamic options
export type OptionsLoadTrigger = "immediate" | "oneditstart" | "ondropdownopen"

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

// Render context for custom option rendering
export type OptionRenderContext = {
	index: number
	isHighlighted: boolean
	isSelected: boolean
	isDisabled: boolean
}

// Editor configuration options
export type EditorOptions<T = unknown> = {
	// === SHARED (select/combobox/autocomplete) ===
	options?: EditorOption[]
	loadOptions?: (row: T, field: string) => Promise<EditorOption[]>
	optionsLoadTrigger?: OptionsLoadTrigger  // Default: "oneditstart"

	// Member properties (string-based property access)
	valueMember?: string      // Property for value (default: "value")
	displayMember?: string    // Property for display text (default: "label")
	searchMember?: string     // Property for searchable text (falls back to displayMember)
	iconMember?: string       // Property for icon/emoji
	subtitleMember?: string   // Property for subtitle/description
	disabledMember?: string   // Property for disabled state
	groupMember?: string      // Property for grouping options

	// Callback alternatives (override member properties)
	getValueCallback?: (option: EditorOption) => string | number
	getDisplayCallback?: (option: EditorOption) => string
	getSearchCallback?: (option: EditorOption) => string
	getIconCallback?: (option: EditorOption) => string
	getSubtitleCallback?: (option: EditorOption) => string
	getDisabledCallback?: (option: EditorOption) => boolean
	getGroupCallback?: (option: EditorOption) => string

	// Render callback (returns HTML string)
	renderOptionCallback?: (option: EditorOption, context: OptionRenderContext) => string

	// Selection event
	onselect?: (option: EditorOption, row: T) => void

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
	searchCallback?: (query: string, row: T, signal?: AbortSignal) => Promise<EditorOption[]>
	minSearchLength?: number         // Min chars before search (default: 1)
	debounceMs?: number              // Debounce search calls (default: 300)
	multiple?: boolean               // Allow multiple selections
	maxSelections?: number           // Max items when multiple=true
}

// Context passed to custom editor callback
export type CustomEditorContext<T> = {
	value: unknown
	row: T
	rowIndex: number
	field: string
	commit: (newValue: unknown) => void
	cancel: () => void
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

// Validation result from beforeCommitCallback
export type ValidationResult = {
	valid: boolean
	message?: string
	transformedValue?: unknown
}

// Context passed to beforeCommitCallback
export type BeforeCommitContext<T> = {
	value: unknown
	oldValue: unknown
	row: T
	rowIndex: number
	field: string
}

// beforeCommitCallback can return:
// - ValidationResult object
// - boolean (true = valid, false = invalid with no message)
// - string (error message = invalid)
// - null/undefined (valid)
export type BeforeCommitResult = ValidationResult | boolean | string | null | undefined

// Cell render callback (replaces Svelte snippet)
export type CellRenderCallback<T> = (row: T, element: HTMLElement) => void

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
	filter?: (filterValue: string, row: T) => boolean | null
	horizontalAlign?: "left" | "center" | "right" | "justify"  // Horizontal alignment for cells (default: "left", also used by dropdown options)
	verticalAlign?: "top" | "middle" | "bottom"  // Vertical alignment for cells (default: "middle")
	headerHorizontalAlign?: "left" | "center" | "right" | "justify"  // Header horizontal alignment (defaults to horizontalAlign)
	headerVerticalAlign?: "top" | "middle" | "bottom"  // Header vertical alignment (defaults to verticalAlign)
	cellClass?: string  // Custom CSS class(es) applied to all cells in this column
	cellClassCallback?: (value: unknown, row: T) => string | null  // Dynamic CSS class based on value/row
	formatCallback?: (value: unknown, row: T) => string
	templateCallback?: (row: T) => string
	// Render callback (replaces Svelte snippet)
	renderCallback?: CellRenderCallback<T>
	// Editing props
	// boolean = static editability for the column; (row) => boolean = per-row editability
	// (e.g. column is editable only on employee rows in a teams + employees tree)
	isEditable?: boolean | ((row: T) => boolean)
	editor?: Editor
	editTrigger?: EditTrigger  // Per-column override
	dropdownToggleVisibility?: ToggleVisibility  // Per-column override for toggle visibility
	shouldOpenDropdownOnEnter?: boolean  // Per-column override: Enter opens dropdown (true) or moves down (false)
	editorOptions?: EditorOptions<T>
	// Validation - can return error message or null (deprecated, use beforeCommitCallback)
	validateCallback?: (value: unknown, row: T) => string | null | Promise<string | null>
	// Before commit callback - validates and optionally transforms value
	beforeCommitCallback?: (context: BeforeCommitContext<T>) => BeforeCommitResult | Promise<BeforeCommitResult>
	// Custom editor callback
	cellEditCallback?: (context: CustomEditorContext<T>) => void
	// Show edit button in cell
	isEditButtonVisible?: boolean
	// Tooltip - displayed on cell hover
	tooltipMember?: string  // Property name in row data containing tooltip text
	tooltipCallback?: (value: unknown, row: T) => string | null  // Dynamic tooltip (takes priority over tooltipMember)
	isTooltipHtml?: boolean  // Render tooltip content as HTML instead of plain text
	// Clipboard callbacks
	beforeCopyCallback?: (value: unknown, row: T) => string  // Transform value before copying to clipboard
	beforePasteCallback?: (value: string, row: T) => unknown  // Process pasted value before applying
	// Validation tooltip - return HTML string for rich error display
	validationTooltipCallback?: (context: ValidationTooltipContext<T>) => string | null
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

// Context for validation tooltip callback
export type ValidationTooltipContext<T> = {
	field: string
	error: string
	value: unknown
	row: T
	rowIndex: number
}

// Detail passed to onrowchange callback
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

// Detail passed to onrowfocus callback
export type RowFocusDetail<T> = {
	rowIndex: number
	row: T
	previousRowIndex: number | null
}

// Detail passed to oncellselectionchange callback
export type CellSelectionChangeDetail = {
	range: CellRange | null
	cellCount: number
}

// =============================================================================
// Row Toolbar Types
// =============================================================================

// Predefined toolbar item types
export type PredefinedToolbarItem = 'add' | 'delete' | 'duplicate' | 'moveUp' | 'moveDown'

/** @deprecated use `PredefinedToolbarItem` */
export type PredefinedToolbarItemType = PredefinedToolbarItem

// Toolbar position options
export type ToolbarPosition = 'auto' | 'left' | 'right' | 'top' | 'inline'

// New empty row position
/** @experimental This type may change in future releases */
export type NewRowPosition = 'top' | 'bottom'

// Toolbar tooltip configuration
export type ToolbarTooltip = {
	description?: string   // Additional description text
	shortcut?: string      // Keyboard shortcut to display (e.g., "Ctrl+D")
}

// Custom toolbar item configuration
export type RowToolbarItem<T> = {
	// Identity
	id: string

	// Display
	icon: string
	title: string
	label?: string  // Optional text label next to icon

	// Layout
	row?: number    // Row number (1 = closest to grid row, default: 1)
	group?: number  // Group number for divider placement

	// Styling
	minWidth?: string  // Override min-width for this button (e.g. '40px')

	// Behavior
	type?: PredefinedToolbarItem  // If predefined, use built-in handler
	danger?: boolean                   // Red styling (like delete)
	disabled?: boolean | ((row: T, rowIndex: number) => boolean)
	hidden?: boolean | ((row: T, rowIndex: number) => boolean)  // Hide button for specific rows

	// Tooltip
	tooltip?: ToolbarTooltip  // Rich tooltip with description and shortcut
	tooltipCallback?: (row: T, rowIndex: number) => string  // Custom HTML tooltip

	// Custom handler (required if no type)
	onclick?: (detail: { row: T, rowIndex: number }) => void | Promise<void>
}

// Shorthand: string = predefined type, or full RowToolbarItem
export type RowToolbarConfig<T> = PredefinedToolbarItem | RowToolbarItem<T>

// Normalized toolbar item (after processing shorthand)
export type NormalizedToolbarItem<T> = Required<Pick<RowToolbarItem<T>, 'id' | 'icon' | 'title' | 'row' | 'group'>> & Omit<RowToolbarItem<T>, 'id' | 'icon' | 'title' | 'row' | 'group'> & {
	tooltip?: ToolbarTooltip
	tooltipCallback?: (row: T, rowIndex: number) => string
}

// Detail passed to ontoolbarclick callback
export type ToolbarClickDetail<T> = {
	item: NormalizedToolbarItem<T>
	rowIndex: number
	row: T
	event: MouseEvent              // Original click event
	triggerElement: HTMLElement     // The clicked button element (can be used as Floating UI anchor)
}

// Legacy type aliases for backwards compatibility
export type RowAction = PredefinedToolbarItem

/** @deprecated use `RowAction` */
export type RowActionType = RowAction
export type RowActionClickDetail<T> = {
	action: RowAction
	rowIndex: number
	row: T
}

// =============================================================================
// Context Menu Types
// =============================================================================

// Context passed to context menu callbacks
export type ContextMenuContext<T> = {
	row: T
	rowIndex: number
	colIndex: number
	column: Column<T>
	cellValue: unknown
}

// Predefined row/cell context-menu actions. Use these as plain strings in `contextMenu`
// to wire common tree commands without hand-rolling onclick / visibility logic.
//   - 'expand-all' / 'collapse-all': operate on the right-clicked row's branch
//     (file-explorer convention: per-row "collapse all" means "collapse everything *under here*",
//     not the entire dataset). Auto-hidden on leaf rows.
//   - 'expand-tree' / 'collapse-tree': operate on the entire dataset (the rarer power-user
//     "reset everything" action). Auto-hidden when there's nothing to do.
export type PredefinedContextMenuItem = 'expand-all' | 'collapse-all' | 'expand-tree' | 'collapse-tree'

/** @deprecated use `PredefinedContextMenuItem` */
export type PredefinedContextMenuItemType = PredefinedContextMenuItem

// Context menu item configuration. `label` becomes optional when `type` is supplied — the
// predefined action provides a default label.
export type ContextMenuItem<T> = {
	id: string
	label?: string | ((context: ContextMenuContext<T>) => string)
	icon?: string | ((context: ContextMenuContext<T>) => string)
	shortcut?: string  // Keyboard shortcut (e.g., "c", "Delete", "Ctrl+C")
	disabled?: boolean | ((context: ContextMenuContext<T>) => boolean)
	visible?: boolean | ((context: ContextMenuContext<T>) => boolean)
	danger?: boolean
	dividerBefore?: boolean
	type?: PredefinedContextMenuItem  // Use built-in handler/label/visibility
	onclick?: (context: ContextMenuContext<T>) => void | Promise<void>
}

// Context menu configuration shorthand: predefined string OR full item object.
export type ContextMenuConfig<T> = PredefinedContextMenuItem | ContextMenuItem<T>

// =============================================================================
// Header Context Menu Types
// =============================================================================

// Context passed to header context menu callbacks
export type HeaderMenuContext<T> = {
	column: Column<T>
	field: string
	columnIndex: number
	sortDirection: 'asc' | 'desc' | null
	isFrozen: boolean
	isTreeMode: boolean      // True when grid has treePathMember set (used to lock the tree column visible)
	allColumns: Column<T>[]  // All columns (including hidden) for visibility submenu
	labels: GridLabels       // Grid labels for translations
}

// Predefined header menu actions (string shorthand)
export type PredefinedHeaderMenuItem = 'sortAsc' | 'sortDesc' | 'clearSort' | 'hideColumn' | 'freezeColumn' | 'unfreezeColumn' | 'columnVisibility'

/** @deprecated use `PredefinedHeaderMenuItem` */
export type PredefinedHeaderMenuItemType = PredefinedHeaderMenuItem

// Header context menu item configuration
export type HeaderMenuItem<T> = {
	id: string
	label: string | ((context: HeaderMenuContext<T>) => string)
	icon?: string | ((context: HeaderMenuContext<T>) => string)
	shortcut?: string
	disabled?: boolean | ((context: HeaderMenuContext<T>) => boolean)
	visible?: boolean | ((context: HeaderMenuContext<T>) => boolean)
	danger?: boolean
	dividerBefore?: boolean
	onclick?: (context: HeaderMenuContext<T>) => void | Promise<void>
	// Submenu support
	children?: HeaderMenuItem<T>[]  // Static submenu items
	submenu?: (context: HeaderMenuContext<T>) => HeaderMenuItem<T>[]  // Dynamic submenu items
}

// Header context menu configuration (predefined string or full item)
export type HeaderMenuConfig<T> = PredefinedHeaderMenuItem | HeaderMenuItem<T>

// =============================================================================
// Row Keyboard Shortcuts Types
// =============================================================================

// Context passed to shortcut action callbacks
export type ShortcutContext<T> = {
	row: T
	rowIndex: number
	colIndex: number
	column: Column<T>
	cellValue: unknown
}

// Single shortcut definition (operates on one row)
export type RowShortcut<T> = {
	key: string                    // e.g., "Delete", "Ctrl+D", "F3", "Shift+Enter"
	id: string                     // Unique identifier
	label: string                  // Display label for help overlay
	action: (ctx: ShortcutContext<T>) => void | Promise<void>
	disabled?: boolean | ((ctx: ShortcutContext<T>) => boolean)
}

// Selected cell range (rectangular region)
export type CellRange = {
	startRowIndex: number
	startColIndex: number
	endRowIndex: number
	endColIndex: number
	startField: string
	endField: string
}

// Context for range shortcuts (multiple selected rows or cell range)
export type RangeShortcutContext<T> = {
	// Row selection mode
	rows: T[]                      // Selected rows (in display order)
	rowIndices: number[]           // Selected row indices (sorted ascending)
	
	// Cell range selection mode (optional, when cellRange is selected)
	cellRange?: CellRange          // Cell range if selected
	cells?: Array<{                // Individual cells in range
		row: T
		rowIndex: number
		colIndex: number
		field: string
		value: unknown
	}>
}

// Range shortcut definition (operates on multiple selected rows)
export type RangeShortcut<T> = {
	key: string                    // e.g., "Delete", "Ctrl+E"
	id: string                     // Unique identifier
	label: string                  // Display label for help overlay
	action: (ctx: RangeShortcutContext<T>) => void | Promise<void>
	disabled?: boolean | ((ctx: RangeShortcutContext<T>) => boolean)
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
	// Filter changed callback. When set, internal client-side filtering is bypassed entirely:
	// the grid still renders the filter inputs, fires this callback on every keystroke with a
	// `{field: value}` map of the current filters, and trusts the consumer to update `items`.
	// Typical pattern: debounce, post the filter map to a backend, replace `items` with the result.
	onfilterchange?: (filters: Record<string, string>) => void
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
	customStylesCallback?: () => string  // Callback returning custom CSS to inject into shadow DOM
	rowClassCallback?: (row: T, rowIndex: number) => string | null  // Dynamic CSS class for rows
	// Field on each row uniquely identifying it. Internal state (drafts, invalid-cell markers)
	// is keyed by this value, so pagination, filter, sort, and tree expand/collapse no longer
	// cause an in-flight edit / invalid marker to land on the wrong row when the displayed
	// order changes. Falls back to `treePathMember` (tree mode) → displayed-row index string.
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
	paginationLabelsCallback?: PaginationLabelsCallback  // Callback to customize/translate pagination text
	paginationLayout?: string  // Element order: "pageSize|previous|pageInfo|next" or "first|previous|pageInfo|next|last"
	// Summary
	summaryPosition?: string  // Position(s): "bottom-left", "top-right|bottom-right", etc.
	summaryContentCallback?: SummaryContentCallback<T>  // Callback returning HTML content
	isSummaryInline?: boolean  // Share row with pagination when in same area (default: true)
	// Editing props
	isEditable?: boolean
	// Row-level editability gate. Combined with grid-level `isEditable` and column-level `isEditable`:
	// all three must pass for a cell to be editable. Use when every editable column shares the same
	// row predicate — cheaper than repeating the predicate on every column.
	isRowEditable?: boolean | ((row: T) => boolean)
	editTrigger?: EditTrigger
	editStartSelection?: EditStartSelection  // Default cursor position when entering edit via navigate mode (default: selectAll)
	shouldCommitOnClickAway?: boolean  // Commit the editor value (Excel-like) when clicking another cell; false discards. Default: true
	mode?: GridMode  // Grid mode - sets sensible defaults (read-only, excel, input-matrix)
	dropdownToggleVisibility?: ToggleVisibility  // When to show dropdown toggle (always, on-focus)
	shouldShowDropdownOnFocus?: boolean  // Auto-open dropdown when cell is focused
	shouldOpenDropdownOnEnter?: boolean  // Enter opens dropdown (true) or moves down (false, default)
	isCheckboxAlwaysEditable?: boolean  // Make checkboxes always interactive, even in navigate mode
	// Invalid cells state (for external tracking)
	invalidCells?: CellValidationState[]
	// Row toolbar (floating toolbar for row actions)
	isRowToolbarVisible?: boolean
	rowToolbar?: RowToolbarConfig<T>[]  // Toolbar items (predefined strings or custom objects)
	toolbarVerticalAlign?: 'top' | 'center' | 'bottom'  // Vertical alignment for left/right positions: top (rows above), center, bottom (default, rows below)
	toolbarHorizontalAlign?: 'start' | 'center' | 'end' | 'cursor'  // Horizontal alignment for top position (default: 'center')
	toolbarTrigger?: 'hover' | 'click' | 'button'  // How to show toolbar
	toolbarPosition?: ToolbarPosition  // Preferred position: auto (default), left, right, top, or inline
	toolbarColumn?: string | number  // Column to position toolbar over (field name or index) for 'top' position
	shouldToolbarFollowCursor?: boolean  // Toolbar follows mouse cursor horizontally (default: false)
	/** @deprecated use `shouldToolbarFollowCursor` */
	toolbarFollowsCursor?: boolean
	cellToolbar?: (row: T, rowIndex: number, field: string, colIndex: number) => RowToolbarConfig<T>[] | undefined  // Cell-specific toolbar items
	cellToolbarOffset?: number | string  // Horizontal offset: number 0-1 as fraction of cell width, or CSS length string (e.g. '2rem'). Default: 0.2
	toolbarBtnMinWidth?: string  // Min-width for toolbar buttons (CSS value, e.g. '32px'). Overrides --wg-toolbar-btn-min-width
	inlineActionsTitle?: string  // Header title for inline actions column (when toolbarPosition="inline")
	// Context menu (row/cell). Items can be plain strings (predefined types) or full objects.
	contextMenu?: ContextMenuConfig<T>[]
	contextMenuXOffset?: number           // Horizontal offset from click (default: 0)
	contextMenuYOffset?: number           // Vertical offset from click (default: 4)
	oncontextmenuopen?: (context: ContextMenuContext<T>) => void
	// Header context menu (column headers)
	headerContextMenu?: HeaderMenuConfig<T>[]
	onheadercontextmenuopen?: (context: HeaderMenuContext<T>) => void
	// Row keyboard shortcuts
	rowShortcuts?: RowShortcut<T>[]              // Shortcut definitions
	isShortcutsHelpVisible?: boolean              // Show info icon (default: false)
	shortcutsHelpPosition?: 'top-right' | 'top-left'  // Icon position (default: 'top-right')
	shortcutsHelpContentCallback?: () => string   // Custom HTML to show with shortcuts list
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
	// Callbacks
	onrowchange?: (detail: RowChangeDetail<T>) => void
	onroweditstart?: (detail: { row: T, rowIndex: number, field: string }) => void
	onroweditcancel?: (detail: { row: T, rowIndex: number, field: string }) => void
	onvalidationerror?: (detail: { row: T, rowIndex: number, field: string, error: string }) => void
	// Validation tooltip - return HTML string for rich error display (column-level overrides this)
	validationTooltipCallback?: (context: ValidationTooltipContext<T>) => string | null
	ontoolbarclick?: (detail: ToolbarClickDetail<T>) => void
	ondatarequest?: (detail: DataRequestDetail) => void  // Fires when sort/page changes
	onrowdelete?: (detail: { rowIndex: number; row: T }) => void  // Ctrl+Delete pressed on a row
	onrowfocus?: (detail: RowFocusDetail<T>) => void  // Fires when a different row is focused via cell click/focus
	// Column resize & persistence
	gridName?: string                                    // Unique name for localStorage persistence
	shouldPersistColumnWidths?: boolean                  // Persist column widths to localStorage (requires gridName)
	oncolumnresize?: (detail: ColumnResizeDetail) => void  // Fired when column is resized

	// Column reorder & persistence
	isColumnReorderAllowed?: boolean                     // Enable drag-to-reorder columns (default: false)
	shouldPersistColumnOrder?: boolean                   // Persist column order to localStorage (requires gridName)
	oncolumnreorder?: (detail: ColumnReorderDetail) => void  // Fired when column is reordered

	// Fill handle (Excel-like autofill)
	fillDragCallback?: (detail: FillDragDetail) => boolean | void  // Return false to cancel fill operation
	
	// Cell range selection
	cellSelectionMode?: CellSelectionMode  // How to select cell ranges: 'disabled', 'click' (default), 'shift'
	shouldCopyWithHeaders?: boolean  // Include column headers when copying cell selection to clipboard (default: false)
	oncellselectionchange?: (detail: CellSelectionChangeDetail) => void  // Fired when cell selection changes

	// Tree / hierarchy (ltree-style path strings: "1.2.3", "/dept/eng/team", "C:\\a\\b")
	treePathMember?: keyof T | string                  // Required to enable tree mode: field holding the path
	treeLevelMember?: keyof T | string                 // Optional pre-computed depth (0-based)
	treeParentMember?: keyof T | string                // Optional pre-computed parent path
	treeSeparator?: string                             // Path separator (auto-detected from first row when omitted)
	treeDataSorted?: boolean                           // true = trust caller order completely (grid never re-sorts; pair with ondatarequest for sort changes). false = grid sorts siblings depth-first.
	expandedPaths?: Set<string>                        // Bindable set of expanded paths (mutated by grid; emits onexpandedpathschange)
	defaultExpandDepth?: number                        // Tree depth to show initially: 0 = only roots, 1 = roots + their children, etc. (default: all expanded)
	treeDoubleClickBehavior?: TreeDoubleClickBehavior  // What happens when user double-clicks a tree-column cell (default: 'none')
	onexpandedpathschange?: (detail: TreeExpandedChangeDetail) => void
	// Chevron customization (static glyphs are defaults; callback overrides per-row)
	treeExpandedGlyph?: string                         // HTML/text shown when node is expanded (default: '▶' — same glyph as collapsed; CSS rotates 90° via .wg__tree-chevron--expanded)
	treeCollapsedGlyph?: string                        // HTML/text shown when node is collapsed (default: '▶'). When expanded and collapsed glyphs are equal, CSS rotates the glyph; when they differ, the glyph is swapped (no rotation).
	treeChevronCallback?: TreeChevronCallback<T>       // Per-row override; cached per (row, expanded)

	// New empty row (inline data entry) — EXPERIMENTAL: API may change in future releases
	isNewRowEnabled?: boolean                          // [Experimental] Enable always-visible empty row for data entry (default: false)
	newRowPosition?: NewRowPosition                    // [Experimental] Position of empty row: 'top' or 'bottom' (default: 'bottom')
	newRowIndicator?: string                           // [Experimental] Indicator shown in row number column (default: '+')
	createEmptyRowCallback?: () => T | Promise<T>     // [Experimental] Factory function to create empty row (can be async)
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

// Toolbar row group (for grouped rendering)
export type ToolbarRowGroup<T> = {
	rowNum: number
	groups: { groupNum: number; items: NormalizedToolbarItem<T>[] }[]
}

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
export type DataRequestTrigger = 'sort' | 'page' | 'pageSize' | 'init' | 'loadMore'

// How to handle the data response
export type DataRequestMode = 'replace' | 'append'

// Detail passed to ondatarequest callback
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

export type PaginationLabelsContext = {
	currentPage: number
	totalPages: number
	totalItems: number
	pageSize: number
}

export type PaginationLabelsCallback = (context: PaginationLabelsContext) => Partial<PaginationLabels>

// Grid labels for translation/i18n
export type GridLabels = {
	// Toolbar
	rowActions: string              // Toolbar trigger button title
	inlineActionsHeader: string     // Default inline actions column header

	// Shortcuts help
	keyboardShortcuts: string       // Shortcuts help icon title

	// Pagination (defaults, can be overridden by paginationLabelsCallback)
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

	// Context menu
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

// Summary content callback
export type SummaryContext<T> = {
	items: T[]           // Current display items (paginated)
	allItems: T[]        // All items (before pagination)
	totalItems: number
	currentPage: number
	pageSize: number
	metadata: unknown    // Server-provided metadata (aggregates, etc.)
}

export type SummaryContentCallback<T> = (context: SummaryContext<T>) => string

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
	isLockedCallback?: (row: T, rowIndex: number) => boolean
	getLockInfoCallback?: (row: T, rowIndex: number) => RowLock | null

	// Edit behavior
	lockedEditBehavior?: LockedRowEditBehavior
	canEditLockedCallback?: (row: T, lockInfo: RowLock) => boolean

	// Visual options
	lockTooltipCallback?: (lockInfo: RowLock, row: T) => string | null
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

// Detail passed to oncolumnresize callback
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

// Detail passed to oncolumnreorder callback
export type ColumnReorderDetail = {
	field: string
	fromIndex: number
	toIndex: number
	allOrder: ColumnOrderState[]  // Same format as localStorage - can be sent to server
}

// Detail passed to fillDragCallback (Excel-like fill handle)
export type FillDragDetail = {
	sourceCell: { rowIndex: number; colIndex: number; field: string; value: unknown }
	targetCells: Array<{ rowIndex: number; colIndex: number; field: string }>
	direction: 'up' | 'down' | 'left' | 'right'
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

/** Before paste event detail - cancelable, can skip specific cells */
export type BeforePasteDetail<T> = {
	rawText: string                        // Original clipboard text
	parsedRows: string[][]                 // TSV parsed into 2D array
	hasHeaders: boolean                    // Whether first row was detected as headers
	headerMapping: PasteColumnMapping[] | null  // Mapping if headers detected
	targetRowIndex: number                 // Starting row index
	targetColIndex: number                 // Starting column index (ignored if headers detected)
	newRowsCount: number                   // Number of new rows that will be created
	cancel: boolean                        // Set to true to cancel entire paste
	skipCells: Set<string>                 // Add "row-col" keys to skip specific cells
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

/** Callback to create new rows from pasted data */
export type CreateRowCallback<T> = (pastedData: Record<string, unknown>, rowIndex: number) => T

// =============================================================================
// Tree / Hierarchy Types
// =============================================================================

/** What happens when the user double-clicks a tree-column cell */
export type TreeDoubleClickBehavior = 'none' | 'toggle'

/** Detail passed to onexpandedpathschange when user toggles a tree node */
export type TreeExpandedChangeDetail = {
	path: string                  // Path that was toggled
	expanded: boolean             // New state (true = expanded, false = collapsed)
	expandedPaths: Set<string>    // Full current set of expanded paths (after toggle)
}

/** Context passed to treeChevronCallback */
export type TreeChevronContext<T> = {
	expanded: boolean             // Whether this node is currently expanded
	hasChildren: boolean          // Whether this node has children (false = leaf)
	row: T
	level: number                 // Depth (0-based)
	path: string
}

/**
 * Callback that returns HTML for the chevron's inner content.
 * Result is cached per (row, expanded) — the callback is invoked at most twice
 * per row, once per expanded state. Invalidated when items or the callback change.
 */
export type TreeChevronCallback<T> = (context: TreeChevronContext<T>) => string

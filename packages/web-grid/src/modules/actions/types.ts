// =============================================================================
// Action Types for Event Pipeline
// Discriminated union of all actions that can flow through the pipeline
// =============================================================================

/**
 * Cell coordinates (row and column indices)
 */
export type CellCoordinates = {
	rowIndex: number
	colIndex: number
}

/**
 * Navigation direction for keyboard navigation
 */
export type NavigationDirection =
	| 'up'
	| 'down'
	| 'left'
	| 'right'
	| 'tab'
	| 'tab-back'
	| 'enter'
	| 'home'
	| 'end'
	| 'page-up'
	| 'page-down'

// =============================================================================
// State-Change Actions
// =============================================================================

/**
 * Focus a cell - set focused cell state and focus DOM element
 */
export type FocusCellAction = {
	type: 'focusCell'
	target: CellCoordinates
	/** Select all text in editor (default: true for 'always' mode) */
	selectText?: boolean
}

/**
 * Blur/unfocus the current cell
 */
export type BlurCellAction = {
	type: 'blurCell'
}

/**
 * Start editing a cell
 */
export type StartEditAction = {
	type: 'startEdit'
	target: CellCoordinates
	initialSearchQuery?: string
	cursorPosition?: number
}

/**
 * Commit current editor value
 */
export type CommitEditAction = {
	type: 'commitEdit'
	/** Commit empty row if applicable */
	commitEmptyRow?: boolean
	/** Target cell (for 'always' edit mode where editingCell isn't tracked) */
	target?: CellCoordinates
}

/**
 * Cancel editing and discard changes
 */
export type CancelEditAction = {
	type: 'cancelEdit'
}

/**
 * No-op action - consume the event but do nothing
 * Used to prevent keys from propagating to other handlers
 */
export type NoopAction = {
	type: 'noop'
}

/**
 * Escape key handling - two-phase behavior
 * Phase 'dropdown': Close dropdown, clear search text, stay in edit mode
 * Phase 'edit': Cancel edit entirely and return to display mode
 */
export type EscapeEditAction = {
	type: 'escapeEdit'
	/** Which phase of escape to execute */
	phase: 'dropdown' | 'edit'
}

/**
 * Select a range of cells
 */
export type SelectCellRangeAction = {
	type: 'selectCellRange'
	start: CellCoordinates
	end: CellCoordinates
}

/**
 * Clear all selections (row, column, cell)
 */
export type ClearSelectionAction = {
	type: 'clearSelection'
}

/**
 * Select a row
 */
export type SelectRowAction = {
	type: 'selectRow'
	rowIndex: number
	/** Add to existing selection (Ctrl+click) */
	addToSelection?: boolean
	/** Extend selection (Shift+click) */
	extendSelection?: boolean
}

/**
 * Select a column
 */
export type SelectColumnAction = {
	type: 'selectColumn'
	colIndex: number
	/** Add to existing selection (Ctrl+click) */
	addToSelection?: boolean
	/** Extend selection (Shift+click) */
	extendSelection?: boolean
}

/**
 * Delete/clear cell content
 */
export type DeleteCellAction = {
	type: 'deleteCell'
	target?: CellCoordinates
}

/**
 * Copy selection to clipboard
 */
export type CopyAction = {
	type: 'copy'
}

/**
 * Paste from clipboard
 */
export type PasteAction = {
	type: 'paste'
}

/**
 * Open context menu
 */
export type OpenContextMenuAction = {
	type: 'openContextMenu'
	position: { x: number; y: number }
	target?: CellCoordinates
}

/**
 * Close context menu
 */
export type CloseContextMenuAction = {
	type: 'closeContextMenu'
}

/**
 * Start fill handle drag
 */
export type StartFillDragAction = {
	type: 'startFillDrag'
	start: CellCoordinates
}

/**
 * Update fill handle drag extent
 */
export type UpdateFillDragAction = {
	type: 'updateFillDrag'
	end: CellCoordinates
}

/**
 * Complete fill handle drag and apply fill
 */
export type CompleteFillDragAction = {
	type: 'completeFillDrag'
}

/**
 * Navigate from current position in a direction
 */
export type NavigateAction = {
	type: 'navigate'
	direction: NavigationDirection
	/** Current position (if not provided, uses grid.focusedCell) */
	from?: CellCoordinates
	/** Hold Ctrl key (for Home/End to go to extremes) */
	ctrlKey?: boolean
}

// =============================================================================
// Effect Actions
// =============================================================================

/**
 * Open dropdown list for current editor
 */
export type OpenDropdownAction = {
	type: 'openDropdown'
}

/**
 * Close dropdown list
 */
export type CloseDropdownAction = {
	type: 'closeDropdown'
}

/**
 * Toggle dropdown open/closed
 */
export type ToggleDropdownAction = {
	type: 'toggleDropdown'
}

/**
 * Navigate within dropdown (up/down/page-up/page-down/home/end through options)
 */
export type DropdownNavigateAction = {
	type: 'dropdownNavigate'
	direction: 'up' | 'down' | 'page-up' | 'page-down' | 'home' | 'end'
}

/**
 * Select the highlighted dropdown option
 */
export type DropdownSelectAction = {
	type: 'dropdownSelect'
	/** Move to next cell after selection */
	moveAfterSelect?: boolean
	/** Commit empty row if applicable */
	commitEmptyRow?: boolean
	/** Navigate after selecting (for Tab) */
	thenNavigate?: NavigationDirection
}

/**
 * Open date picker for current date editor
 */
export type OpenDatePickerAction = {
	type: 'openDatePicker'
}

/**
 * Close date picker
 */
export type CloseDatePickerAction = {
	type: 'closeDatePicker'
}

/**
 * Toggle date picker open/closed
 */
export type ToggleDatePickerAction = {
	type: 'toggleDatePicker'
}

/**
 * Open custom editor (calls renderEditorCallback)
 */
export type OpenCustomEditorAction = {
	type: 'openCustomEditor'
	target: CellCoordinates
}

/**
 * Re-render a single cell's DOM
 */
export type RenderCellAction = {
	type: 'renderCell'
	target: CellCoordinates
	/** Focus editor after rendering */
	focusEditor?: boolean
	/** Cursor position for text inputs */
	cursorPosition?: number
	/** Initial search query for type-to-start */
	initialSearchQuery?: string
}

// =============================================================================
// Macro Actions (expand into primitive sub-actions)
// =============================================================================

/**
 * Reset grid state - macro that expands into primitive cleanup actions.
 * Each flag defaults to true (comprehensive cleanup) except focus which defaults to false.
 */
export type ResetStateAction = {
	type: 'resetState'
	/** Cancel active edit (default: true) */
	edit?: boolean
	/** Clear row/column/cell selections (default: true) */
	selections?: boolean
	/** Close dropdown, datepicker, context menu (default: true) */
	overlays?: boolean
	/** Clear focused cell (default: false) */
	focus?: boolean
}

// =============================================================================
// Compound Actions (produce child actions)
// =============================================================================

/**
 * Transition focus from one cell to another
 * Compound action that handles: render old cell -> focus new cell
 */
export type TransitionCellAction = {
	type: 'transitionCell'
	from: CellCoordinates
	to: CellCoordinates
	/** Select text in target editor */
	selectText?: boolean
}

// =============================================================================
// Union Type
// =============================================================================

/**
 * Toggle checkbox value
 */
export type ToggleCheckboxAction = {
	type: 'toggleCheckbox'
	target: CellCoordinates
}

/**
 * Start cell range selection (mousedown tracking for drag-to-select)
 */
export type StartCellSelectionAction = {
	type: 'startCellSelection'
	rowIndex: number
	colIndex: number
	clientX: number
	clientY: number
	shiftKey: boolean
}

/**
 * All possible actions in the grid event pipeline
 */
export type GridAction =
	// State-change actions
	| FocusCellAction
	| BlurCellAction
	| StartEditAction
	| CommitEditAction
	| CancelEditAction
	| EscapeEditAction
	| NoopAction
	| SelectCellRangeAction
	| SelectRowAction
	| SelectColumnAction
	| ClearSelectionAction
	| NavigateAction
	| ToggleCheckboxAction
	| DeleteCellAction
	| CopyAction
	| PasteAction
	| StartCellSelectionAction
	// Effect actions
	| OpenDropdownAction
	| CloseDropdownAction
	| ToggleDropdownAction
	| DropdownNavigateAction
	| DropdownSelectAction
	| OpenDatePickerAction
	| CloseDatePickerAction
	| ToggleDatePickerAction
	| OpenCustomEditorAction
	| RenderCellAction
	| OpenContextMenuAction
	| CloseContextMenuAction
	| StartFillDragAction
	| UpdateFillDragAction
	| CompleteFillDragAction
	// Compound actions
	| TransitionCellAction
	// Macro actions
	| ResetStateAction

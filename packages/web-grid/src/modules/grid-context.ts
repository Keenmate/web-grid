// =============================================================================
// GridContext - the GridElement subset that module functions consume
// =============================================================================

import type { WebGrid } from '../grid.js'
import type { Column, EditorOptions } from '../types.js'
import type { ScrollEventManager } from './scroll-events/index.js'
import type { FocusEventManager } from './focus-events/index.js'
import type { DatePicker } from './datepicker/datepicker.js'
import type { AutocompleteService } from './dropdown/autocomplete-service.js'
import type { DropdownService } from './dropdown/dropdown-service.js'
import type { TooltipService } from './tooltip/tooltip-service.js'
import type { ToolbarService } from './toolbar/toolbar-service.js'
import type { VirtualScrollService } from './scroll/virtual-scroll-service.js'
import type { ActionPipelineAdapter } from './actions/adapter.js'

/**
 * GridElement context interface for module functions
 * This is the subset of GridElement that modules need access to
 */
export interface GridContext<T = unknown> {
	// Shadow DOM
	readonly shadow: ShadowRoot

	// Grid logic
	readonly grid: WebGrid<T>

	// Dropdown runtime state — owned by DropdownService (open flag, options, highlight,
	// filter text, race-condition flags). The `isCommittingFromKeyboard` and
	// `isTransitioningCells` flags below are editing-state machine flags, distinct
	// from dropdown state, and remain on the Element for now.
	readonly dropdown: DropdownService
	isCommittingFromKeyboard: boolean
	isTransitioningCells: boolean

	// Context menu state (rendered to document.body)
	contextMenuElement: HTMLElement | null
	headerContextMenuElement: HTMLElement | null

	// Datepicker state
	datepicker: DatePicker | null

	// Autocomplete async state — owned by AutocompleteService.
	readonly autocomplete: AutocompleteService

	// Tooltip runtime state — owned by TooltipService (element, arrow, anchor, show/hide timers).
	readonly tooltip: TooltipService
	// Tooltip configuration (grid-level), exposed as accessors.
	readonly tooltipShowDelay: number
	readonly tooltipHideDelay: number

	// Virtual-scroll runtime state — owned by VirtualScrollService (visible range,
	// loading-more flag, programmatic-scroll guard).
	readonly virtualScroll: VirtualScrollService

	// Floating-toolbar runtime state — owned by ToolbarService (hide-timeout,
	// hover / move flags, hovered cell, cell-items JSON, document keydown handlers).
	readonly toolbar: ToolbarService

	// Re-render the whole grid (full table swap). Used by handlers that mutate
	// items / columns and need an immediate DOM refresh.
	render(): void

	// Re-render the SVG connector that ties the floating toolbar to its row.
	renderConnector(): void

	// Action pipeline adapter — handlers call `pipelineAdapter?.clearSelection()`
	// to drop row / cell-range / column selections through the pipeline. Null
	// when the pipeline isn't installed (non-'always' edit-trigger modes).
	readonly pipelineAdapter: ActionPipelineAdapter<T> | null

	// Utility methods
	escapeHtml(text: string): string

	// Helper methods that modules may need
	getCurrentEditingColumn(): Column<T> | null
	getCurrentEditorOptions(): EditorOptions

	// Focus/navigation methods
	moveFocusAfterCommit(rowIndex: number, field: string, direction: 'down' | 'up' | 'next' | 'prev'): void

	// Custom editor support
	openCustomEditor(rowIndex: number, colIndex: number): void

	// Scroll event manager (pub/sub for scroll events)
	readonly scrollEvents: ScrollEventManager

	// Focus event manager (pub/sub for blur/focusout events)
	readonly focusEvents: FocusEventManager
}

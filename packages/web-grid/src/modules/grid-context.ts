// =============================================================================
// GridHost - the GridElement subset that module functions consume
// =============================================================================

import type { GridEngine } from '../grid.js'
import type { Column, EditorOptions } from '../types.js'
import type { ScrollEventManager } from './scroll-events/index.js'
import type { FocusEventManager } from './focus-events/index.js'
import type { DatePicker } from './datepicker/datepicker.js'
import type { MenuHandle } from '@keenmate/web-components-core/menu'
import type { AutocompleteService } from './dropdown/autocomplete-service.js'
import type { DropdownService } from './dropdown/dropdown-service.js'
import type { TooltipService } from './tooltip/tooltip-service.js'
import type { ToolbarService } from './toolbar/toolbar-service.js'
import type { VirtualScrollService } from './scroll/virtual-scroll-service.js'
import type { FilterRowService } from './filter-row/index.js'
import type { ActionPipelineAdapter } from './actions/adapter.js'

/**
 * GridElement context interface for module functions
 * This is the subset of GridElement that modules need access to
 */
export interface GridHost<T = unknown> {
	// Shadow DOM
	readonly shadow: ShadowRoot

	// Grid logic
	readonly engine: GridEngine<T>

	/** Core: write inputs (`pageSize`, `frozenColumnCount`, …) through the property path and apply them now. */
	setAttributes(values: Record<string, unknown>): void

	// Dropdown runtime state — owned by DropdownService (open flag, options, highlight,
	// filter text, race-condition flags). The `isCommittingFromKeyboard` and
	// `isTransitioningCells` flags below are editing-state machine flags, distinct
	// from dropdown state, and remain on the Element for now.
	readonly dropdown: DropdownService
	isCommittingFromKeyboard: boolean
	isTransitioningCells: boolean

	// The open cell / header menu (core openMenu(), in the shadow root) — one at a time
	menu: MenuHandle | null

	// Datepicker state
	datepicker: DatePicker | null

	// Autocomplete async state — owned by AutocompleteService.
	readonly autocomplete: AutocompleteService

	// Tooltip runtime state — owned by TooltipService (element, arrow, anchor, show/hide timers).
	readonly tooltip: TooltipService
	// Tooltip configuration (grid-level), exposed as accessors.
	readonly tooltipShowDelay: number
	readonly tooltipHideDelay: number
	/** Overlay tree group of the cell dropdown (input `overlay-group`; null = the default group). */
	readonly overlayGroup: string | null

	/** Gate of every scroll the grid makes on its own (input; see modules/scroll/reveal.ts). */
	readonly beforeScrollCallback: ((ctx: import('../interaction.js').GridBeforeScrollContext<T>) => false | Partial<import('../interaction.js').GridScrollOptions> | void) | null

	// Virtual-scroll runtime state — owned by VirtualScrollService (visible range,
	// loading-more flag, programmatic-scroll guard).
	readonly virtualScroll: VirtualScrollService

	// Floating-toolbar runtime state — owned by ToolbarService (hide-timeout,
	// hover / move flags, hovered cell, cell-items JSON, document keydown handlers).
	readonly toolbar: ToolbarService

	// Filter row runtime state — typed-but-not-applied text + debounce timers.
	readonly filterRow: FilterRowService
	/** The filter-row text typed for `field` but not applied yet. */
	filterInputText(field: string): string | undefined

	// Re-render the whole grid (full table swap). Used by handlers that mutate
	// items / columns and need an immediate DOM refresh.
	render(): void

	// Re-render the SVG connector that ties the floating toolbar to its row.
	renderConnector(): void

	// Action pipeline adapter — handlers call `pipelineAdapter?.clearSelection()`
	// to drop row / cell-range / column selections through the pipeline. Null
	// when the pipeline isn't installed (non-'always' edit-trigger modes).
	readonly pipelineAdapter: ActionPipelineAdapter<T> | null

	// Helper methods that modules may need
	getCurrentEditingColumn(): Column<T> | null
	getCurrentEditorOptions(): EditorOptions<T>

	// Focus/navigation methods
	moveFocusAfterCommit(rowIndex: number, field: string, direction: 'down' | 'up' | 'next' | 'prev'): void

	// Custom editor support
	openCustomEditor(rowIndex: number, colIndex: number): void

	// Programmatic scroll-to-row used by keyboard navigation (Home/End/PageUp/PageDown
	// with Ctrl). Wraps virtual-scroll range update + scrollTop change behind a flag
	// so the scroll event listener doesn't double-render.
	scrollToRow(rowIndex: number): Promise<boolean>

	// Render the "Go to row" dialog. Triggered by Ctrl+G at the cell level —
	// the dialog handles its own focus return back to the originating column.
	openGoToRowDialog(colIndex: number): void

	// Dispatch a CustomEvent on the grid element. Handlers use this to fire
	// public events (row-delete, etc.) from module code without holding a
	// reference to the host element.
	dispatchEvent(event: Event): boolean

	// Surgically clear cell-range / row / column selections (state + classes +
	// borders) WITHOUT triggering requestUpdate. Used in cell-transition paths
	// where a subsequent renderCell handles its own DOM refresh, and a full
	// render would invalidate captured node references.
	clearAllSelections(): void

	// Excel-like "commit on click-away" — reads the in-progress editor value
	// (input.value / dataset.dateValue / numeric parse / dataset.value) and
	// fires `grid.commitEdit`. Falls back to `cancelEdit` when shouldCommitOnClickAway
	// is false or the editor DOM is unreadable. Must run BEFORE renderCell wipes
	// the editor element.
	commitOrCancelEditOnTransition(): void

	// Surgically toggle the `wg__row--focused` class between the previous
	// focused row and the new one. Used by click / focus handlers when the
	// state machine has already updated `grid.focusedRowIndex` and only the
	// DOM needs catching up.
	updateRowFocusVisual(prevRowIndex: number | null, newRowIndex: number | null): void

	// True between table-level mousedown and document-level mouseup. Focus
	// handlers consult this to distinguish keyboard-triggered focus (fire
	// focus-change immediately) from mouse-triggered focus (defer focus-change to
	// the click handler so it fires on mouseup, not mousedown).
	isMouseDown: boolean

	// Scroll event manager (pub/sub for scroll events)
	readonly scrollEvents: ScrollEventManager

	// Focus event manager (pub/sub for blur/focusout events)
	readonly focusEvents: FocusEventManager
}

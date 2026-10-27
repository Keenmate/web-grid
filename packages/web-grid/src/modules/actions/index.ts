// =============================================================================
// Actions Module - Event Pipeline for Grid
// =============================================================================

// Types
export type {
	CellCoordinates,
	NavigationDirection,
	FocusCellAction,
	BlurCellAction,
	StartEditAction,
	CommitEditAction,
	CancelEditAction,
	SelectCellRangeAction,
	SelectRowAction,
	SelectColumnAction,
	ClearSelectionAction,
	NavigateAction,
	ToggleCheckboxAction,
	DeleteCellAction,
	CopyAction,
	PasteAction,
	StartCellSelectionAction,
	OpenDropdownAction,
	CloseDropdownAction,
	ToggleDropdownAction,
	DropdownNavigateAction,
	DropdownSelectAction,
	OpenDatePickerAction,
	CloseDatePickerAction,
	ToggleDatePickerAction,
	RenderCellAction,
	CloseContextMenuAction,
	StartFillDragAction,
	UpdateFillDragAction,
	CompleteFillDragAction,
	TransitionCellAction,
	GridAction
} from './types.js'

// Pipeline
export { ActionPipeline, createActionPipeline } from './pipeline.js'
export type { ExecutorContext, ActionExecutor } from './pipeline.js'

// Adapter
export { ActionPipelineAdapter, createActionPipelineAdapter } from './adapter.js'

// Event mapper
export { mapKeyDownToAction, mapMouseDownToActions, isPipelineKey, isNavigationKey } from './event-mapper.js'
export type { EventMapperContext, MouseMapperContext } from './event-mapper.js'

// Executors (exported for testing or extension)
export { focusExecutor } from './executors/focus-executor.js'
export { navigateExecutor } from './executors/navigate-executor.js'
export { transitionExecutor } from './executors/transition-executor.js'
export { renderExecutor } from './executors/render-executor.js'
export { dropdownExecutor } from './executors/dropdown-executor.js'
export { checkboxExecutor } from './executors/checkbox-executor.js'
export { datepickerExecutor } from './executors/datepicker-executor.js'
export { editExecutor } from './executors/edit-executor.js'
export { selectionExecutor } from './executors/selection-executor.js'
export { clipboardExecutor } from './executors/clipboard-executor.js'
export { contextMenuExecutor } from './executors/context-menu-executor.js'
export { fillHandleExecutor } from './executors/fill-handle-executor.js'
export { cellSelectionExecutor } from './executors/cell-selection-executor.js'
export { noopExecutor } from './executors/noop-executor.js'

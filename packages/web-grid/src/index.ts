// =============================================================================
// @keenmate/web-grid - Main Entry Point
// =============================================================================

// Web component (auto-registers <web-grid>)
export { GridElement } from './web-component.js'

// Core state engine (standalone / advanced usage — not the element's public API)
export { GridEngine } from './grid.js'

// Divider factory for toolbar / menu entry lists (web-components-core /actions)
export { menuDivider } from '@keenmate/web-components-core/actions'

// Interaction model: controller, contexts, action items, event details
export type * from './interaction.js'

// All types
export type {
	// Editor types
	Editor,
	EditTrigger,
	DateOutputFormat,
	EditorOption,
	EditorOptions,

	// Validation types
	CellValidationState,
	ValidationResult,
	ValidateResult,

	// Column & rendering
	Column,
	RowChangeDetail,
	RowFocusDetail,

	// Toolbar types
	ToolbarPosition,
	NewRowPosition,

	// Props
	QuickGridProps,

	// Sorting & Pagination types
	SortState,
	SortMode,
	DataRequestDetail,
	DataRequestTrigger,
	PaginationLabels,
	PaginationLabelsCallback,
	SummaryCallback,

	// Labels/i18n
	GridLabels,
	GridLabelsInput,

	// Row locking types
	RowLock,
	RowLockingOptions,
	RowLockChangeDetail,
	LockedRowEditBehavior,

	// Column resize types
	ColumnWidthState,
	ColumnResizeDetail,

	// Column reorder types
	ColumnOrderState,
	ColumnReorderDetail,

	// Fill handle types
	FillDirection,

	// Cell range selection types
	CellSelectionMode,
	CellRange,
	CellSelectionChangeDetail,
	RowSelectionChangeDetail,
	ColumnSelectionChangeDetail,

	// Paste types
	PasteMode,
	PasteColumnMapping,
	PasteCellResult,
	PasteDetail,
	CreateRowCallback,

	// Tree types
	TreeExpandedChangeDetail,
	ChevronCallback,
	TreeDoubleClickBehavior,

	// Internal types (exposed for advanced usage)
	EditingCell,
	FocusedCell,
	SortDirection,
	PopupPosition,
	ConnectorArrowDir
} from './types.js'

// Default export
export { GridElement as default } from './web-component.js'

// Logging bundle (core /logging) + global registration (core §12.3)
import { registerComponent } from '@keenmate/web-components-core'
import { logging } from './logger.js'
import { GridElement as _GridElement } from './web-component.js'

// Build-time constants (injected by Vite define)
declare const __VERSION__: string
declare const __PACKAGE_NAME__: string
declare const __AUTHOR__: string
declare const __LICENSE__: string
declare const __REPOSITORY__: string
declare const __HOMEPAGE__: string

// Defines <web-grid> and publishes window.components['web-grid'] = { version, config,
// logging, register, getInstances }. The logging controls reach every GRID:* category:
//   window.components['web-grid'].logging.enableLogging()
registerComponent('web-grid', _GridElement as unknown as CustomElementConstructor, {
	config: {
		name: typeof __PACKAGE_NAME__ !== 'undefined' ? __PACKAGE_NAME__ : '@keenmate/web-grid',
		version: typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0',
		author: typeof __AUTHOR__ !== 'undefined' ? __AUTHOR__ : 'KeenMate',
		license: typeof __LICENSE__ !== 'undefined' ? __LICENSE__ : 'MIT',
		repository: typeof __REPOSITORY__ !== 'undefined' ? __REPOSITORY__ : '',
		homepage: typeof __HOMEPAGE__ !== 'undefined' ? __HOMEPAGE__ : ''
	},
	logging
})

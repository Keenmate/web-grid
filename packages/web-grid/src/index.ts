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
	ConnectorArrowDir,

	// Deprecated aliases retained for one release — drop in next major.
	/** @deprecated use `Editor` */
	EditorType,
	/** @deprecated use `RowLock` */
	RowLockInfo
} from './types.js'

// Default export
export { GridElement as default } from './web-component.js'

// Import logging functions for global API
import {
	setLogLevel,
	enableLogging,
	disableLogging,
	setCategoryLevel,
	LOGGING_CATEGORIES
} from './logger.js'

// Build-time constants (injected by Vite define)
declare const __VERSION__: string
declare const __PACKAGE_NAME__: string
declare const __AUTHOR__: string
declare const __LICENSE__: string
declare const __REPOSITORY__: string
declare const __HOMEPAGE__: string

// Register to window.components for runtime introspection
if (typeof window !== 'undefined') {
	(window as any).components = (window as any).components || {}
	;(window as any).components['web-grid'] = {
		version: () => __VERSION__,
		config: {
			name: __PACKAGE_NAME__,
			version: __VERSION__,
			author: __AUTHOR__,
			license: __LICENSE__,
			repository: __REPOSITORY__,
			homepage: __HOMEPAGE__
		},
		logging: {
			enableLogging,
			disableLogging,
			setLogLevel,
			setCategoryLevel,
			getCategories: () => [...LOGGING_CATEGORIES]
		}
	}
}

// =============================================================================
// Date Picker Types (Lightweight version for web-grid)
// =============================================================================

import type { PopoverCloseReason } from '@keenmate/web-components-core/positioning'

/**
 * Why the picker closed: core's popover reasons (`'escape'`, `'outside-click'`, `'scroll'`,
 * `'overlay'`, `'parent'`, `'reference-removed'`, `'api'` = close() / destroy() / a pick), or
 * `'dismiss'` — the picker's own close without a pick (dismiss(): the trigger toggled it, Tab with
 * no focused day).
 */
export type DatePickerCloseReason = PopoverCloseReason | 'dismiss'

/**
 * Date picker configuration options
 */
export interface DatePickerOptions {
	// Date constraints
	minDate?: Date | string
	maxDate?: Date | string

	// Display format
	dateFormat?: string  // e.g., 'YYYY-MM-DD', 'DD.MM.YYYY', 'MM/DD/YYYY'

	// UI options
	showTodayButton?: boolean  // Show "Today" button (default: true)

	// Locale
	locale?: string  // e.g., 'en', 'cs', 'de' (default: browser locale)

	// Rolling selector year range
	rollingYearRange?: string  // e.g., '2020-2030' (default: current year ± 10)

	// Where the picker mounts: the grid passes its shadow root, so the picker inherits the grid's
	// color-scheme (data-theme / data-context-theme) and --wg-* / --base-* (default: document.body)
	container?: ShadowRoot | HTMLElement

	// Close a scroll that moved the anchor (default false); a function is asked at each scroll
	shouldCloseOnScroll?: boolean | (() => boolean)

	// The page-wide overlay tree group (core createPopover overlayGroup; undefined = the default group)
	overlayGroup?: string

	// Callbacks
	onSelect?: (date: Date | null, direction?: 'down' | 'next' | 'prev') => void
	/** The picker closed — every close, with its reason (a pick reports 'api' after onSelect). */
	onClose?: (reason: DatePickerCloseReason) => void
}

/**
 * Internal state for the date picker
 */
export interface DatePickerState {
	// Currently displayed month/year
	viewMonth: number  // 0-11
	viewYear: number

	// Selected date
	selectedDate: Date | null

	// UI state
	isOpen: boolean
	rollingSelectorOpen: boolean
	rollingSelectorMode: 'month' | 'year'

	// Focused date for keyboard navigation
	focusedDate: Date | null
}

/**
 * Parsed format information
 */
export interface FormatSpec {
	format: string
	separator: string
	parts: {
		year?: { index: number; length: number }
		month?: { index: number; length: number }
		day?: { index: number; length: number }
	}
	maxLength: number
}

/** @deprecated use `FormatSpec` */
export type FormatInfo = FormatSpec

/**
 * Locale strings for UI
 */
export interface LocaleStrings {
	today: string
	clear: string
	monthNames: string[]
	monthNamesShort: string[]
	weekdayNames: string[]
	weekdayNamesShort: string[]
}

/**
 * Default locale strings (English)
 */
export const DEFAULT_LOCALE_STRINGS: LocaleStrings = {
	today: 'Today',
	clear: 'Clear',
	monthNames: [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	],
	monthNamesShort: [
		'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
		'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
	],
	weekdayNames: [
		'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
	],
	weekdayNamesShort: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
}

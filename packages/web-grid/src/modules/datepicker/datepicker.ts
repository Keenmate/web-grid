// =============================================================================
// DatePicker Class
// Main date picker implementation
// =============================================================================

import { adoptStyles } from '@keenmate/web-components-core'
import { createPopover, type PopoverCloseReason, type PopoverHandle } from '@keenmate/web-components-core/positioning'
import type { DatePickerOptions, DatePickerState, LocaleStrings, FormatSpec } from './types.js'
import { DEFAULT_LOCALE_STRINGS } from './types.js'
import { parseFormat, formatDate, normalizeDate, toISODateString } from './formatting.js'

// Datepicker styles (adopted into the mount root: the grid's shadow root, else document.head)
const DATEPICKER_STYLES = `
.wg-datepicker-container {
	/* The core popover's panel (placed by anchor()); the picker inside is in flow, so the panel has its size */
	position: absolute;
	top: 0;
	left: 0;
	z-index: var(--wg-dp-z-index, 9999);

	/* Colors — contract inputs with their defaults and the contract's formulas on them;
	   light-dark() follows the color-scheme of the mount root (the grid host in its shadow root). */
	--wg-dp-background: var(--base-main-bg, light-dark(#ffffff, #1e293b));
	--wg-dp-text-color: var(--base-text-color-1, light-dark(#334155, #f1f5f9));
	--wg-dp-accent-color: var(--base-primary-color, #3b82f6);
	--wg-dp-shadow-color: var(--base-shadow-color, light-dark(rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.4)));
	--wg-dp-border-color: var(--base-border-color, light-dark(oklch(from var(--wg-dp-background) calc(l - 0.096) c h), oklch(from var(--wg-dp-background) calc(l + 0.192) c h)));
	--wg-dp-text-secondary: var(--base-text-color-3, color-mix(in srgb, var(--wg-dp-text-color) 55%, var(--wg-dp-background)));
	--wg-dp-text-muted: var(--base-text-color-4, color-mix(in srgb, var(--wg-dp-text-color) 40%, var(--wg-dp-background)));
	--wg-dp-text-disabled: var(--base-text-color-4, var(--wg-dp-text-muted));
	--wg-dp-accent-hover: var(--base-primary-color-hover, light-dark(color-mix(in srgb, black 15%, var(--wg-dp-accent-color)), color-mix(in srgb, white 15%, var(--wg-dp-accent-color))));
	--wg-dp-hover-bg: var(--base-hover-bg, light-dark(color-mix(in oklch, oklch(from var(--wg-dp-background) calc(l - 0.45) c h) 14%, transparent), color-mix(in oklch, oklch(from var(--wg-dp-background) calc(l + 0.45) c h) 28%, transparent)));
	--wg-dp-hover-border: var(--base-border-color, var(--wg-dp-border-color));
	--wg-dp-selected-text: var(--base-on-primary-text-color, color(from color(from var(--wg-dp-accent-color) srgb calc(0.21 * r * r * (0.4 + r * (0.82 - 0.22 * r)) + 0.72 * g * g * (0.4 + g * (0.82 - 0.22 * g)) + 0.07 * b * b * (0.4 + b * (0.82 - 0.22 * b))) 0 0) srgb clamp(0, (0.34 - r) * 1e9, 1) clamp(0, (0.34 - r) * 1e9, 1) clamp(0, (0.34 - r) * 1e9, 1)));

	/* Typography */
	--wg-dp-font-family: var(--wg-font-family, var(--base-font-family, inherit));
	--wg-dp-font-size: var(--wg-font-size-base, 14px);
	--wg-dp-font-size-sm: var(--wg-font-size-sm, 12px);
	--wg-dp-font-size-xs: var(--wg-font-size-xs, 11px);
	--wg-dp-font-weight-normal: var(--wg-font-weight-normal, 400);
	--wg-dp-font-weight-medium: 500;
	--wg-dp-font-weight-semibold: var(--wg-font-weight-semibold, 600);

	/* Sizing */
	--wg-dp-padding: 8px;
	--wg-dp-min-width: 220px;
	--wg-dp-border-radius: var(--wg-border-radius-sm, 4px);
	--wg-dp-nav-size: 24px;
	--wg-dp-nav-icon-size: 14px;
	--wg-dp-rolling-list-height: 180px;

	/* Spacing */
	--wg-dp-gap: 6px;
	--wg-dp-gap-sm: 4px;
	--wg-dp-gap-xs: 1px;

	/* Shadow */
	--wg-dp-shadow: var(--wg-shadow-lg, 0 4px 16px var(--wg-dp-shadow-color));
	--wg-dp-disabled-opacity: var(--base-disabled-opacity, 0.65);

	/* Rolling month/year lists (auto under reduced motion) */
	--wg-dp-scroll-behavior: var(--base-scroll-behavior, smooth);
}

@media (prefers-reduced-motion: reduce) {
	.wg-datepicker-container {
		--wg-dp-scroll-behavior: var(--base-scroll-behavior, auto);
	}
}

.wg-datepicker {
	position: relative;
	background: var(--wg-dp-background);
	border: 1px solid var(--wg-dp-border-color);
	border-radius: var(--wg-dp-border-radius);
	box-shadow: var(--wg-dp-shadow);
	padding: var(--wg-dp-padding);
	min-width: var(--wg-dp-min-width);
	font-family: var(--wg-dp-font-family);
	font-size: var(--wg-dp-font-size);
	color: var(--wg-dp-text-color);
}

.wg-datepicker__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: var(--wg-dp-gap);
	gap: var(--wg-dp-gap-sm);
}

.wg-datepicker__month-year {
	flex: 1;
	text-align: center;
	font-weight: var(--wg-dp-font-weight-semibold);
	font-size: var(--wg-dp-font-size);
	color: var(--wg-dp-text-color);
	padding: var(--wg-dp-gap-sm) var(--wg-dp-padding);
	border: none;
	border-radius: var(--wg-dp-border-radius);
	background: transparent;
	cursor: pointer;
}

.wg-datepicker__month-year:hover {
	background-color: var(--wg-dp-hover-bg);
}

.wg-datepicker__nav {
	width: var(--wg-dp-nav-size);
	height: var(--wg-dp-nav-size);
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1px solid var(--wg-dp-border-color);
	border-radius: var(--wg-dp-border-radius);
	background: transparent;
	cursor: pointer;
	color: var(--wg-dp-text-secondary);
	padding: 0;
}

.wg-datepicker__nav:hover {
	background-color: var(--wg-dp-hover-bg);
	border-color: var(--wg-dp-hover-border);
}

.wg-datepicker__nav svg {
	width: var(--wg-dp-nav-icon-size);
	height: var(--wg-dp-nav-icon-size);
}

.wg-datepicker__rolling-selector {
	display: none;
	gap: var(--wg-dp-gap);
	margin-bottom: var(--wg-dp-gap);
}

.wg-datepicker__rolling-selector--visible {
	display: flex;
}

.wg-datepicker__calendar--hidden {
	display: none;
}

.wg-datepicker__rolling-lists {
	display: flex;
	gap: var(--wg-dp-gap);
	width: 100%;
}

.wg-datepicker__rolling-list {
	flex: 1;
	max-height: var(--wg-dp-rolling-list-height);
	overflow-y: auto;
	border: 1px solid var(--wg-dp-border-color);
	border-radius: var(--wg-dp-border-radius);
	scroll-behavior: var(--wg-dp-scroll-behavior);
}

.wg-datepicker__rolling-item {
	padding: 5px var(--wg-dp-padding);
	cursor: pointer;
	text-align: center;
	font-size: var(--wg-dp-font-size);
	color: var(--wg-dp-text-color);
}

.wg-datepicker__rolling-item:hover {
	background-color: var(--wg-dp-hover-bg);
}

.wg-datepicker__rolling-item--selected {
	background-color: var(--wg-dp-accent-color);
	color: var(--wg-dp-selected-text);
	font-weight: var(--wg-dp-font-weight-semibold);
}

.wg-datepicker__rolling-item--selected:hover {
	background-color: var(--wg-dp-accent-hover);
}

.wg-datepicker__weekdays {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: var(--wg-dp-gap-xs);
	margin-bottom: var(--wg-dp-gap-sm);
}

.wg-datepicker__weekday {
	text-align: center;
	font-size: var(--wg-dp-font-size-xs);
	font-weight: var(--wg-dp-font-weight-semibold);
	color: var(--wg-dp-text-secondary);
	padding: 2px;
	text-transform: uppercase;
}

.wg-datepicker__days {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: var(--wg-dp-gap-xs);
}

.wg-datepicker__day {
	aspect-ratio: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: var(--wg-dp-font-size-sm);
	color: var(--wg-dp-text-color);
	border-radius: var(--wg-dp-border-radius);
	cursor: pointer;
	border: 1px solid transparent;
}

.wg-datepicker__day:hover:not(.wg-datepicker__day--disabled):not(.wg-datepicker__day--other-month) {
	background-color: var(--wg-dp-hover-bg);
	border-color: var(--wg-dp-hover-border);
}

.wg-datepicker__day--other-month {
	color: var(--wg-dp-text-muted);
	cursor: default;
}

.wg-datepicker__day--today {
	border-color: var(--wg-dp-accent-color);
	font-weight: var(--wg-dp-font-weight-semibold);
}

.wg-datepicker__day--selected {
	background-color: var(--wg-dp-accent-color);
	color: var(--wg-dp-selected-text);
	font-weight: var(--wg-dp-font-weight-semibold);
	border-color: transparent;
}

.wg-datepicker__day--selected:hover {
	background-color: var(--wg-dp-accent-hover);
}

.wg-datepicker__day--focused {
	outline: 2px solid var(--wg-dp-accent-color);
	outline-offset: -2px;
}

.wg-datepicker__day--disabled {
	color: var(--wg-dp-text-disabled);
	opacity: var(--wg-dp-disabled-opacity);
	cursor: not-allowed;
}

.wg-datepicker__footer {
	margin-top: var(--wg-dp-padding);
	padding-top: var(--wg-dp-padding);
	border-top: 1px solid var(--wg-dp-border-color);
	display: flex;
	justify-content: center;
}

.wg-datepicker__today-btn {
	padding: var(--wg-dp-gap-sm) 12px;
	font-size: var(--wg-dp-font-size-sm);
	color: var(--wg-dp-accent-color);
	background: transparent;
	border: 1px solid var(--wg-dp-accent-color);
	border-radius: var(--wg-dp-border-radius);
	cursor: pointer;
	font-weight: var(--wg-dp-font-weight-medium);
}

.wg-datepicker__today-btn:hover {
	background-color: color-mix(in srgb, var(--wg-dp-accent-color) 10%, transparent);
}
`

// In a shadow root the picker sits next to the grid's own CSS: same `component` layer.
const LAYERED_DATEPICKER_STYLES = `@layer component {\n${DATEPICKER_STYLES}\n}`

let stylesInjected = false
import {
	renderDatePicker,
	updateDaysHtml,
	updateHeaderHtml,
	toggleRollingSelector,
	updateRollingSelectorSelection,
	scrollRollingSelectorToSelection
} from './rendering.js'
import { goToPrevMonth, goToNextMonth, goToMonth, goToYear, handleKeyDown, initializeFocus } from './navigation.js'
import {
	handleDayClick,
	handleTodayClick,
	handleMonthClick,
	handleYearClick,
	updateStateFromInput
} from './interaction.js'

/**
 * Lightweight date picker for web-grid
 */
export class DatePicker {
	private options: DatePickerOptions
	private state: DatePickerState
	private localeStrings: LocaleStrings
	private formatInfo: FormatSpec

	private element: HTMLElement | null = null
	private anchor: HTMLElement | null = null
	/** The open picker's core popover (positioning + Escape / outside click / scroll / overlay tree). */
	private popover: PopoverHandle | null = null
	/** Set while dismiss() closes the popover: its 'api' close is reported as 'dismiss'. */
	private isDismissing = false
	/** Stops following the cell's input (see followInput()). */
	private unfollowInput: (() => void) | null = null
	/** The followed input holds text that is not a date the picker accepts (see followInput()). */
	private followedInput: HTMLInputElement | null = null

	/** The picker's outer container (mounted in `options.container`, default document.body), or null when closed. */
	getElement(): HTMLElement | null { return this.element }

	private boundHandleKeyDown: (e: KeyboardEvent) => void

	constructor(options: DatePickerOptions = {}) {
		this.options = {
			dateFormat: 'YYYY-MM-DD',
			showTodayButton: true,
			...options
		}

		const today = new Date()
		this.state = {
			viewMonth: today.getMonth(),
			viewYear: today.getFullYear(),
			selectedDate: null,
			isOpen: false,
			rollingSelectorOpen: false,
			rollingSelectorMode: 'month',
			focusedDate: null
		}

		this.localeStrings = this.initLocaleStrings(options.locale)
		this.formatInfo = parseFormat(this.options.dateFormat || 'YYYY-MM-DD')

		this.boundHandleKeyDown = this.handleKeyDown.bind(this)
	}

	/**
	 * Initialize locale strings (use browser Intl API if available)
	 */
	private initLocaleStrings(locale?: string): LocaleStrings {
		const resolvedLocale = locale || navigator.language || 'en'

		try {
			const monthFormatter = new Intl.DateTimeFormat(resolvedLocale, { month: 'long' })
			const monthShortFormatter = new Intl.DateTimeFormat(resolvedLocale, { month: 'short' })
			const weekdayFormatter = new Intl.DateTimeFormat(resolvedLocale, { weekday: 'long' })
			const weekdayShortFormatter = new Intl.DateTimeFormat(resolvedLocale, { weekday: 'short' })

			const monthNames: string[] = []
			const monthNamesShort: string[] = []
			for (let i = 0; i < 12; i++) {
				const date = new Date(2024, i, 1)
				monthNames.push(monthFormatter.format(date))
				monthNamesShort.push(monthShortFormatter.format(date))
			}

			const weekdayNames: string[] = []
			const weekdayNamesShort: string[] = []
			// Start from Sunday (Jan 7, 2024 is a Sunday)
			for (let i = 0; i < 7; i++) {
				const date = new Date(2024, 0, 7 + i)
				weekdayNames.push(weekdayFormatter.format(date))
				// Take first 2 chars for short names
				const shortName = weekdayShortFormatter.format(date)
				weekdayNamesShort.push(shortName.substring(0, 2))
			}

			return {
				today: 'Today', // Could be localized too
				clear: 'Clear',
				monthNames,
				monthNamesShort,
				weekdayNames,
				weekdayNamesShort
			}
		} catch {
			return DEFAULT_LOCALE_STRINGS
		}
	}

	/**
	 * Styles for the mount root: adopted once per shadow root (core adoptStyles, in the grid's
	 * `component` layer so custom CSS still wins), else one <style> in document.head.
	 */
	private static injectStyles(root: ShadowRoot | HTMLElement): void {
		if (root instanceof ShadowRoot) {
			adoptStyles(root, LAYERED_DATEPICKER_STYLES)
			return
		}
		if (stylesInjected) return

		const style = document.createElement('style')
		style.id = 'wg-datepicker-styles'
		style.textContent = DATEPICKER_STYLES
		document.head.appendChild(style)
		stylesInjected = true
	}

	/**
	 * Open the date picker
	 */
	open(anchor: HTMLElement, value: Date | string | null = null): void {
		const root = this.options.container ?? document.body
		DatePicker.injectStyles(root)

		if (this.state.isOpen) {
			this.close()
		}

		this.anchor = anchor

		// Parse initial value
		const initialDate = normalizeDate(value)
		if (initialDate) {
			this.state.selectedDate = initialDate
			this.state.viewYear = initialDate.getFullYear()
			this.state.viewMonth = initialDate.getMonth()
		} else {
			const today = new Date()
			this.state.viewYear = today.getFullYear()
			this.state.viewMonth = today.getMonth()
		}

		initializeFocus(this.state)

		// Create picker element
		this.element = document.createElement('div')
		this.element.className = 'wg-datepicker-container'
		this.element.innerHTML = renderDatePicker(this.state, this.options, this.localeStrings)

		// Click handler for the picker's own controls
		this.element.addEventListener('click', (e) => this.handleClick(e))

		this.state.isOpen = true

		// Core popover: mounts the panel in `root`, places it under the cell (core anchor()), and
		// reports why it closed (options.onClose) — Escape, a click outside, a scroll that moved
		// the cell, another overlay opening, the cell removed, or close() / destroy() ('api').
		const popover = createPopover({
			reference: anchor,
			panel: this.element,
			container: root,
			// In a shadow root the panel already follows the grid's theme
			inheritThemeFrom: root instanceof ShadowRoot ? false : anchor,
			strategy: 'absolute',
			placement: 'bottom-start',
			// No `offset`: core's default is the page's field → panel gap `--base-dropdown-offset`
			fallbackPlacements: ['top-start', 'bottom-end', 'top-end'],
			shift: 8,
			shouldCloseOnEscape: true,
			shouldCloseOnOutsideClick: true,
			// The owner moves focus itself (to the cell)
			returnFocusTo: null,
			shouldCloseOnScroll: this.options.shouldCloseOnScroll ?? false,
			shouldCloseOnResize: false,
			overlayGroup: this.options.overlayGroup,
			onClose: (reason) => this.handlePopoverClose(popover, reason),
		})
		this.popover = popover
		popover.open()

		// Keyboard handler (calendar navigation, Enter / Tab pick; Escape is the popover's)
		document.addEventListener('keydown', this.boundHandleKeyDown)

		// Scroll rolling selector if needed
		if (this.state.rollingSelectorOpen) {
			scrollRollingSelectorToSelection(this.element)
		}
	}

	/**
	 * Close the date picker from code: `options.onClose('api')` (the caller saves / cancels).
	 */
	close(): void {
		this.popover?.destroy()
	}

	/**
	 * Close without a pick as the user's own dismissal (the trigger button toggled it, Tab with
	 * no focused day): `options.onClose('dismiss')`.
	 */
	dismiss(): void {
		if (!this.popover) return
		this.isDismissing = true
		try {
			this.popover.destroy()
		} finally {
			this.isDismissing = false
		}
	}

	/** The popover closed (any reason; core already unmounted the panel): tear down, tell the owner why. */
	private handlePopoverClose(popover: PopoverHandle, reason: PopoverCloseReason): void {
		if (this.popover !== popover) return
		this.popover = null
		popover.destroy()
		document.removeEventListener('keydown', this.boundHandleKeyDown)
		this.unfollowInput?.()
		this.unfollowInput = null
		this.element = null
		this.state.isOpen = false
		this.state.rollingSelectorOpen = false
		this.options.onClose?.(reason === 'api' && this.isDismissing ? 'dismiss' : reason)
	}

	/**
	 * Destroy the picker instance
	 */
	destroy(): void {
		this.close()
		this.anchor = null
	}

	/**
	 * Get the selected date
	 */
	getSelectedDate(): Date | null {
		return this.state.selectedDate
	}

	/**
	 * Get formatted value
	 */
	getFormattedValue(): string {
		return formatDate(this.state.selectedDate, this.formatInfo)
	}

	/**
	 * Handle click events within the picker
	 */
	private handleClick(e: Event): void {
		const target = e.target as HTMLElement
		const action = target.closest('[data-action]')?.getAttribute('data-action')

		if (action === 'prev-month') {
			e.preventDefault()
			goToPrevMonth(this.state)
			this.render()
			return
		}

		if (action === 'next-month') {
			e.preventDefault()
			goToNextMonth(this.state)
			this.render()
			return
		}

		if (action === 'toggle-rolling') {
			e.preventDefault()
			this.state.rollingSelectorOpen = !this.state.rollingSelectorOpen
			this.render()
			if (this.state.rollingSelectorOpen && this.element) {
				scrollRollingSelectorToSelection(this.element)
			}
			return
		}

		if (action === 'today') {
			e.preventDefault()
			const date = handleTodayClick(this.state, this.options)
			if (date) {
				this.selectDate(date)
			}
			return
		}

		// Day click
		const dayCell = target.closest('.wg-datepicker__day') as HTMLElement
		if (dayCell) {
			e.preventDefault()
			const date = handleDayClick(dayCell, this.state, this.options)
			if (date) {
				this.selectDate(date)
			}
			return
		}

		// Rolling selector: month click
		const monthItem = target.closest('[data-month]') as HTMLElement
		if (monthItem && this.state.rollingSelectorOpen) {
			e.preventDefault()
			handleMonthClick(monthItem, this.state)
			this.render()
			return
		}

		// Rolling selector: year click
		const yearItem = target.closest('[data-year]') as HTMLElement
		if (yearItem && this.state.rollingSelectorOpen) {
			e.preventDefault()
			handleYearClick(yearItem, this.state)
			this.render()
			return
		}
	}

	/**
	 * Handle keyboard events
	 */
	private handleKeyDown(e: KeyboardEvent): void {
		// The typed text is not a date (invalid / incomplete / out of range): Enter / Tab leave the
		// cell with that text — `onSelect(null)`, the owner saves it as invalid (Excel: leaving saves)
		const input = this.followedInput
		if (input && isTypedDateInvalid(input) && !this.state.rollingSelectorOpen && (e.key === 'Enter' || e.key === 'Tab')) {
			e.preventDefault()
			if (e.key === 'Enter') e.stopPropagation()
			this.selectDate(null, e.key === 'Enter' ? 'down' : e.shiftKey ? 'prev' : 'next')
			return
		}

		const handled = handleKeyDown(e, this.state, this.options, {
			onSelect: (date, direction) => this.selectDate(date, direction),
			onDismiss: () => this.dismiss()
		})

		if (handled) {
			// Calendar navigation: Enter / Tab now pick the navigated day, not the typed text
			if (input && e.key !== 'Enter' && e.key !== 'Tab') setTypedDateInvalid(input, false)
			this.render()
		}
	}

	/**
	 * Select a date and fire callback (`null`: leave with the typed text, which is not a date)
	 */
	private selectDate(date: Date | null, direction?: 'down' | 'next' | 'prev'): void {
		if (date) this.state.selectedDate = date
		this.options.onSelect?.(date, direction)
		// onSelect already handled the commit: the close reports 'api' (nothing to do)
		this.close()
	}

	/**
	 * Re-render the picker contents
	 */
	private render(): void {
		if (!this.element) return

		const picker = this.element.querySelector('.wg-datepicker')
		if (!picker) return

		// Update header
		updateHeaderHtml(picker as HTMLElement, this.state, this.localeStrings)

		// Toggle rolling selector
		toggleRollingSelector(picker as HTMLElement, this.state.rollingSelectorOpen)

		if (this.state.rollingSelectorOpen) {
			updateRollingSelectorSelection(picker as HTMLElement, this.state)
		} else {
			// Update days
			updateDaysHtml(picker as HTMLElement, this.state, this.options)
		}
	}

	/**
	 * Follow the cell's text input while open: a complete, valid typed date becomes the picker's
	 * selected + focused day (so Enter / Tab pick it) and the input's `data-date-value` (what
	 * leaving the cell saves); clearing the text clears both. Any other text (invalid, incomplete,
	 * out of min / max) marks the input `data-date-invalid` (isTypedDateInvalid()): leaving the
	 * cell — Enter / Tab included — saves that text as an invalid value.
	 */
	followInput(input: HTMLInputElement): void {
		this.unfollowInput?.()
		const onInput = () => {
			if (input.value.trim() === '') {
				this.state.selectedDate = null
				input.dataset.dateValue = ''
				setTypedDateInvalid(input, false)
			} else if (updateStateFromInput(input.value, this.formatInfo, this.state, this.options) && this.state.selectedDate) {
				input.dataset.dateValue = toISODateString(this.state.selectedDate)
				setTypedDateInvalid(input, false)
			} else {
				setTypedDateInvalid(input, true)
				return
			}
			this.render()
		}
		input.addEventListener('input', onInput)
		this.followedInput = input
		this.unfollowInput = () => {
			input.removeEventListener('input', onInput)
			this.followedInput = null
		}
	}
}

/**
 * Does the cell's date input hold typed text that is not a date (invalid, incomplete, out of
 * min / max)? Set while the picker follows the input (DatePicker.followInput()); leaving the
 * cell then saves that text with the `invalidDate` parse error (like a paste).
 */
export function isTypedDateInvalid(input: HTMLInputElement): boolean {
	return input.dataset.dateInvalid !== undefined
}

/** Mark / unmark the cell's date input as holding typed text that is not a date. */
export function setTypedDateInvalid(input: HTMLInputElement, isInvalid: boolean): void {
	if (isInvalid) input.dataset.dateInvalid = ''
	else delete input.dataset.dateInvalid
}

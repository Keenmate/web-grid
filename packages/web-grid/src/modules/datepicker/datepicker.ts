// =============================================================================
// DatePicker Class
// Main date picker implementation
// =============================================================================

import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom'
import type { DatePickerOptions, DatePickerState, LocaleStrings, FormatSpec } from './types.js'
import { DEFAULT_LOCALE_STRINGS } from './types.js'
import { parseFormat, formatDate, normalizeDate, toISODateString } from './formatting.js'

// Datepicker styles (injected into document.head)
const DATEPICKER_STYLES = `
.wg-datepicker-container {
	position: fixed;
	z-index: var(--wg-dp-z-index, 9999);

	/* Colors — the popup lives in the document (outside the grid's shadow root), so it
	   carries its own inputs (contract defaults) and the contract's formulas on them;
	   light-dark() follows the page's color-scheme. */
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
}

.wg-datepicker {
	position: absolute;
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
	scroll-behavior: smooth;
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
	opacity: 0.5;
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
	handleInputChange,
	handleInputKeyDown,
	handleInputPaste,
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
	private input: HTMLInputElement | null = null
	private cleanupAutoUpdate: (() => void) | null = null

	/** The picker's outer container (mounted in document.body), or null when closed. */
	getElement(): HTMLElement | null { return this.element }

	private previousInputValue = ''
	private boundHandleClickOutside: (e: MouseEvent) => void
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

		this.boundHandleClickOutside = this.handleClickOutside.bind(this)
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
	 * Inject datepicker styles into document head (once)
	 */
	private static injectStyles(): void {
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
		// Inject styles on first use
		DatePicker.injectStyles()

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

		// Append to body
		document.body.appendChild(this.element)

		// Position with Floating UI
		this.position()

		// Attach event listeners
		this.attachListeners()

		this.state.isOpen = true

		// Scroll rolling selector if needed
		if (this.state.rollingSelectorOpen) {
			scrollRollingSelectorToSelection(this.element)
		}
	}

	/**
	 * Close the date picker
	 * @param silent - If true, don't trigger onClose callback (used when switching cells)
	 */
	close(silent = false): void {
		if (!this.state.isOpen) return

		// Cleanup auto-update
		if (this.cleanupAutoUpdate) {
			this.cleanupAutoUpdate()
			this.cleanupAutoUpdate = null
		}

		// Remove event listeners
		document.removeEventListener('mousedown', this.boundHandleClickOutside)
		document.removeEventListener('keydown', this.boundHandleKeyDown)

		// Remove element
		if (this.element) {
			this.element.remove()
			this.element = null
		}

		this.state.isOpen = false
		this.state.rollingSelectorOpen = false

		if (!silent) {
			this.options.onClose?.()
		}
	}

	/**
	 * Destroy the picker instance
	 */
	destroy(): void {
		this.close()
		this.anchor = null
		this.input = null
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
	 * Position the picker using Floating UI
	 */
	private position(): void {
		if (!this.element || !this.anchor) return

		const picker = this.element.querySelector('.wg-datepicker') as HTMLElement
		if (!picker) return

		// Setup auto-update for repositioning
		this.cleanupAutoUpdate = autoUpdate(this.anchor, picker, () => {
			// Close datepicker silently if anchor is no longer valid
			// Silent because something else (cell transition) already handled the edit state
			if (!this.anchor!.isConnected) {
				this.close(true)
				return
			}

			computePosition(this.anchor!, picker, {
				placement: 'bottom-start',
				middleware: [
					offset(4),
					flip({ fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] }),
					shift({ padding: 8 })
				]
			}).then(({ x, y }) => {
				Object.assign(picker.style, {
					left: `${x}px`,
					top: `${y}px`
				})
			})
		})
	}

	/**
	 * Attach event listeners
	 */
	private attachListeners(): void {
		if (!this.element) return


		// Click handler for picker
		this.element.addEventListener('click', (e) => this.handleClick(e))

		// Global click-outside handler (with delay to avoid catching opening click)
		setTimeout(() => {
			document.addEventListener('mousedown', this.boundHandleClickOutside)
		}, 0)

		// Keyboard handler
		document.addEventListener('keydown', this.boundHandleKeyDown)
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
	 * Handle click outside the picker
	 */
	private handleClickOutside(e: MouseEvent): void {
		if (!this.element || !this.anchor) return

		// Use composedPath() to correctly detect clicks across shadow DOM boundaries.
		// e.target is retargeted to the shadow host at the document level, so
		// anchor.contains(e.target) would fail for clicks inside the shadow DOM.
		const path = e.composedPath()
		if (!path.includes(this.element) && !path.includes(this.anchor)) {
			this.close()
		}
	}

	/**
	 * Handle keyboard events
	 */
	private handleKeyDown(e: KeyboardEvent): void {
		const handled = handleKeyDown(e, this.state, this.options, {
			onSelect: (date, direction) => this.selectDate(date, direction),
			onClose: () => this.close()
		})

		if (handled) {
			this.render()
		}
	}

	/**
	 * Select a date and fire callback
	 */
	private selectDate(date: Date, direction?: 'down' | 'next'): void {
		this.state.selectedDate = date
		this.options.onSelect?.(date, direction)
		// Close silently - onSelect already handled the commit, don't trigger onClose
		this.close(true)
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
	 * Connect an input field for masked input
	 */
	connectInput(input: HTMLInputElement): void {
		this.input = input
		this.previousInputValue = input.value

		input.addEventListener('input', () => {
			this.previousInputValue = handleInputChange(input, this.formatInfo, this.previousInputValue)
			updateStateFromInput(input.value, this.formatInfo, this.state, this.options)
		})

		input.addEventListener('keydown', (e) => {
			handleInputKeyDown(e, this.formatInfo)
		})

		input.addEventListener('paste', (e) => {
			handleInputPaste(e, input, this.formatInfo)
		})

		input.addEventListener('focus', () => {
			if (!this.state.isOpen && this.anchor) {
				this.open(this.anchor, input.value)
			}
		})
	}
}

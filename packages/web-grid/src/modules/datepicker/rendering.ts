// =============================================================================
// Date Picker Rendering
// Calendar grid, header, rolling selector rendering
// =============================================================================

import type { DatePickerOptions, DatePickerState, LocaleStrings, FormatSpec } from './types.js'
import { DEFAULT_LOCALE_STRINGS } from './types.js'
import { toISODateString, isSameDay, isToday, getDaysInMonth, getFirstDayOfMonth, normalizeDate } from './formatting.js'

/**
 * Parse year range string to min/max values
 */
export function parseYearRange(range: string | undefined, currentYear: number): { min: number; max: number } {
	if (!range) {
		// Default: current year ± 10
		return { min: currentYear - 10, max: currentYear + 10 }
	}

	if (range.includes('-')) {
		const [minStr, maxStr] = range.split('-')
		return { min: parseInt(minStr, 10), max: parseInt(maxStr, 10) }
	}

	const year = parseInt(range, 10)
	return { min: year, max: year }
}

/**
 * Render the complete date picker structure
 */
export function renderDatePicker(
	state: DatePickerState,
	options: DatePickerOptions,
	localeStrings: LocaleStrings = DEFAULT_LOCALE_STRINGS
): string {
	const headerHtml = renderHeader(state, localeStrings)
	const rollingSelectorHtml = renderRollingSelector(state, options, localeStrings)
	const calendarHtml = renderCalendarGrid(state, options, localeStrings)
	const footerHtml = options.showTodayButton !== false ? renderFooter(localeStrings) : ''

	return `
		<div class="wg-datepicker">
			<div class="wg-datepicker__header">
				${headerHtml}
			</div>
			<div class="wg-datepicker__rolling-selector${state.rollingSelectorOpen ? ' wg-datepicker__rolling-selector--visible' : ''}">
				${rollingSelectorHtml}
			</div>
			<div class="wg-datepicker__calendar${state.rollingSelectorOpen ? ' wg-datepicker__calendar--hidden' : ''}">
				${calendarHtml}
			</div>
			${footerHtml}
		</div>
	`
}

/**
 * Render the header with month/year display and navigation
 */
export function renderHeader(
	state: DatePickerState,
	localeStrings: LocaleStrings
): string {
	const monthName = localeStrings.monthNames[state.viewMonth]

	return `
		<button type="button" class="wg-datepicker__nav wg-datepicker__nav--prev" data-action="prev-month">
			<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
		</button>
		<button type="button" class="wg-datepicker__month-year" data-action="toggle-rolling">
			${monthName} ${state.viewYear}
		</button>
		<button type="button" class="wg-datepicker__nav wg-datepicker__nav--next" data-action="next-month">
			<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
		</button>
	`
}

/**
 * Render the rolling month/year selector
 */
export function renderRollingSelector(
	state: DatePickerState,
	options: DatePickerOptions,
	localeStrings: LocaleStrings
): string {
	const yearRange = parseYearRange(options.rollingYearRange, new Date().getFullYear())

	// Render years
	let yearsHtml = ''
	for (let year = yearRange.min; year <= yearRange.max; year++) {
		const selected = year === state.viewYear ? ' wg-datepicker__rolling-item--selected' : ''
		yearsHtml += `<div class="wg-datepicker__rolling-item${selected}" data-year="${year}">${year}</div>`
	}

	// Render months
	let monthsHtml = ''
	for (let month = 0; month < 12; month++) {
		const selected = month === state.viewMonth ? ' wg-datepicker__rolling-item--selected' : ''
		monthsHtml += `<div class="wg-datepicker__rolling-item${selected}" data-month="${month}">${localeStrings.monthNamesShort[month]}</div>`
	}

	return `
		<div class="wg-datepicker__rolling-lists">
			<div class="wg-datepicker__rolling-list" data-list="months">
				${monthsHtml}
			</div>
			<div class="wg-datepicker__rolling-list" data-list="years">
				${yearsHtml}
			</div>
		</div>
	`
}

/**
 * Render the calendar grid (weekdays + days)
 */
export function renderCalendarGrid(
	state: DatePickerState,
	options: DatePickerOptions,
	localeStrings: LocaleStrings
): string {
	const weekdaysHtml = renderWeekdays(localeStrings)
	const daysHtml = renderDays(state, options)

	return `
		<div class="wg-datepicker__weekdays">
			${weekdaysHtml}
		</div>
		<div class="wg-datepicker__days">
			${daysHtml}
		</div>
	`
}

/**
 * Render weekday headers
 */
export function renderWeekdays(localeStrings: LocaleStrings): string {
	return localeStrings.weekdayNamesShort
		.map(day => `<div class="wg-datepicker__weekday">${day}</div>`)
		.join('')
}

/**
 * Render the day cells for the current month view
 */
export function renderDays(
	state: DatePickerState,
	options: DatePickerOptions
): string {
	const { viewYear, viewMonth, selectedDate, focusedDate } = state
	const minDate = options.minDate ? normalizeDate(options.minDate) : null
	const maxDate = options.maxDate ? normalizeDate(options.maxDate) : null

	const firstDayOfMonth = getFirstDayOfMonth(viewYear, viewMonth)
	const daysInMonth = getDaysInMonth(viewYear, viewMonth)
	const daysInPrevMonth = getDaysInMonth(viewYear, viewMonth - 1)

	// Previous month dates
	const prevMonthDate = new Date(viewYear, viewMonth - 1, 1)
	const prevYear = prevMonthDate.getFullYear()
	const prevMonth = prevMonthDate.getMonth()

	// Next month dates
	const nextMonthDate = new Date(viewYear, viewMonth + 1, 1)
	const nextYear = nextMonthDate.getFullYear()
	const nextMonth = nextMonthDate.getMonth()

	// Collect all days
	const days: Array<{
		date: Date
		day: number
		isOtherMonth: boolean
	}> = []

	// Previous month days (fill leading cells)
	for (let i = firstDayOfMonth - 1; i >= 0; i--) {
		const day = daysInPrevMonth - i
		days.push({
			date: new Date(prevYear, prevMonth, day),
			day,
			isOtherMonth: true
		})
	}

	// Current month days
	for (let day = 1; day <= daysInMonth; day++) {
		days.push({
			date: new Date(viewYear, viewMonth, day),
			day,
			isOtherMonth: false
		})
	}

	// Next month days (fill trailing cells to complete last row)
	const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7
	const remainingCells = totalCells - days.length
	for (let day = 1; day <= remainingCells; day++) {
		days.push({
			date: new Date(nextYear, nextMonth, day),
			day,
			isOtherMonth: true
		})
	}

	// Generate HTML
	let html = ''
	for (const dayData of days) {
		const classes = ['wg-datepicker__day']

		if (dayData.isOtherMonth) {
			classes.push('wg-datepicker__day--other-month')
		}

		// Check if disabled (outside min/max range)
		const isDisabled = isDateDisabled(dayData.date, minDate, maxDate)
		if (isDisabled) {
			classes.push('wg-datepicker__day--disabled')
		}

		// Today
		if (isToday(dayData.date)) {
			classes.push('wg-datepicker__day--today')
		}

		// Selected
		if (isSameDay(dayData.date, selectedDate)) {
			classes.push('wg-datepicker__day--selected')
		}

		// Focused (keyboard navigation)
		if (isSameDay(dayData.date, focusedDate)) {
			classes.push('wg-datepicker__day--focused')
		}

		const dateStr = toISODateString(dayData.date)
		html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${dayData.day}</div>`
	}

	return html
}

/**
 * Check if a date is outside the min/max range
 */
function isDateDisabled(date: Date, minDate: Date | null, maxDate: Date | null): boolean {
	if (minDate && date < minDate) return true
	if (maxDate && date > maxDate) return true
	return false
}

/**
 * Render the footer with Today button
 */
export function renderFooter(localeStrings: LocaleStrings): string {
	return `
		<div class="wg-datepicker__footer">
			<button type="button" class="wg-datepicker__today-btn" data-action="today">
				${localeStrings.today}
			</button>
		</div>
	`
}

/**
 * Re-render just the days portion (for month navigation)
 */
export function updateDaysHtml(
	container: HTMLElement,
	state: DatePickerState,
	options: DatePickerOptions
): void {
	const daysContainer = container.querySelector('.wg-datepicker__days')
	if (daysContainer) {
		daysContainer.innerHTML = renderDays(state, options)
	}
}

/**
 * Update header month/year display
 */
export function updateHeaderHtml(
	container: HTMLElement,
	state: DatePickerState,
	localeStrings: LocaleStrings
): void {
	const monthYearBtn = container.querySelector('.wg-datepicker__month-year')
	if (monthYearBtn) {
		const monthName = localeStrings.monthNames[state.viewMonth]
		monthYearBtn.textContent = `${monthName} ${state.viewYear}`
	}
}

/**
 * Toggle rolling selector visibility
 */
export function toggleRollingSelector(
	container: HTMLElement,
	visible: boolean
): void {
	const selector = container.querySelector('.wg-datepicker__rolling-selector')
	const calendar = container.querySelector('.wg-datepicker__calendar')

	if (selector) {
		selector.classList.toggle('wg-datepicker__rolling-selector--visible', visible)
	}
	if (calendar) {
		calendar.classList.toggle('wg-datepicker__calendar--hidden', visible)
	}
}

/**
 * Update rolling selector selection state
 */
export function updateRollingSelectorSelection(
	container: HTMLElement,
	state: DatePickerState
): void {
	// Update year selection
	const yearItems = container.querySelectorAll('[data-year]')
	yearItems.forEach(item => {
		const year = parseInt((item as HTMLElement).dataset.year || '0', 10)
		item.classList.toggle('wg-datepicker__rolling-item--selected', year === state.viewYear)
	})

	// Update month selection
	const monthItems = container.querySelectorAll('[data-month]')
	monthItems.forEach(item => {
		const month = parseInt((item as HTMLElement).dataset.month || '0', 10)
		item.classList.toggle('wg-datepicker__rolling-item--selected', month === state.viewMonth)
	})
}

/**
 * Scroll rolling selector to show selected items
 */
export function scrollRollingSelectorToSelection(container: HTMLElement): void {
	const selectedYear = container.querySelector('[data-year].wg-datepicker__rolling-item--selected') as HTMLElement
	const selectedMonth = container.querySelector('[data-month].wg-datepicker__rolling-item--selected') as HTMLElement

	if (selectedYear) {
		const list = selectedYear.parentElement
		if (list) {
			const scrollTop = selectedYear.offsetTop - list.clientHeight / 2 + selectedYear.clientHeight / 2
			list.scrollTop = scrollTop
		}
	}

	if (selectedMonth) {
		const list = selectedMonth.parentElement
		if (list) {
			const scrollTop = selectedMonth.offsetTop - list.clientHeight / 2 + selectedMonth.clientHeight / 2
			list.scrollTop = scrollTop
		}
	}
}

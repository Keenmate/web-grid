// =============================================================================
// Date Picker Navigation
// Month/year navigation, keyboard handling
// =============================================================================

import type { DatePickerState, DatePickerOptions } from './types.js'
import { getDaysInMonth, normalizeDate, isSameDay } from './formatting.js'

/**
 * Go to the previous month
 */
export function goToPrevMonth(state: DatePickerState): void {
	if (state.viewMonth === 0) {
		state.viewMonth = 11
		state.viewYear--
	} else {
		state.viewMonth--
	}
}

/**
 * Go to the next month
 */
export function goToNextMonth(state: DatePickerState): void {
	if (state.viewMonth === 11) {
		state.viewMonth = 0
		state.viewYear++
	} else {
		state.viewMonth++
	}
}

/**
 * Go to a specific month (0-11)
 */
export function goToMonth(state: DatePickerState, month: number): void {
	state.viewMonth = Math.max(0, Math.min(11, month))
}

/**
 * Go to a specific year
 */
export function goToYear(state: DatePickerState, year: number): void {
	state.viewYear = year
}

/**
 * Go to a specific date (updates view to show that month)
 */
export function goToDate(state: DatePickerState, date: Date): void {
	state.viewYear = date.getFullYear()
	state.viewMonth = date.getMonth()
}

/**
 * Handle keyboard navigation within the calendar
 * Returns true if the event was handled
 */
export function handleKeyDown(
	event: KeyboardEvent,
	state: DatePickerState,
	options: DatePickerOptions,
	callbacks: {
		onSelect?: (date: Date, direction?: 'down' | 'next' | 'prev') => void
		/** Close without a pick (Tab with no focused day). Escape is the popover's (core). */
		onDismiss?: () => void
	}
): boolean {
	const { key } = event

	// If rolling selector is open, handle differently
	if (state.rollingSelectorOpen) {
		return handleRollingSelectorKeyDown(event, state)
	}

	// Ctrl+Left/Right for month navigation (same as PageUp/PageDown)
	if ((key === 'ArrowLeft' || key === 'ArrowRight') && (event.ctrlKey || event.metaKey)) {
		event.preventDefault()
		if (key === 'ArrowLeft') {
			goToPrevMonth(state)
		} else {
			goToNextMonth(state)
		}
		// Keep focused date in new month
		if (state.focusedDate) {
			const day = Math.min(state.focusedDate.getDate(), getDaysInMonth(state.viewYear, state.viewMonth))
			state.focusedDate = new Date(state.viewYear, state.viewMonth, day)
		}
		return true
	}

	// Arrow key navigation within calendar
	if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
		event.preventDefault()
		navigateFocus(state, key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight', options)
		return true
	}

	// Enter selects the focused date (move down)
	if (key === 'Enter') {
		event.preventDefault()
		event.stopPropagation()
		if (state.focusedDate) {
			callbacks.onSelect?.(state.focusedDate, 'down')
		}
		return true
	}

	// Tab / Shift+Tab selects the focused date (move next / previous)
	if (key === 'Tab') {
		event.preventDefault()
		// Select focused date if available, otherwise just close
		if (state.focusedDate) {
			callbacks.onSelect?.(state.focusedDate, event.shiftKey ? 'prev' : 'next')
		} else {
			callbacks.onDismiss?.()
		}
		return true
	}

	// Home/End for quick navigation
	if (key === 'Home') {
		event.preventDefault()
		if (event.ctrlKey || event.metaKey) {
			// Ctrl+Home: January 1st - if already there, go to previous year
			let targetYear = state.viewYear
			const jan1 = new Date(targetYear, 0, 1)
			if (state.focusedDate && isSameDay(state.focusedDate, jan1)) {
				targetYear--  // Already at Jan 1, go to previous year
			}
			// Respect minDate constraint
			if (options.minDate) {
				const minDate = normalizeDate(options.minDate)
				if (minDate && targetYear < minDate.getFullYear()) {
					targetYear = minDate.getFullYear()
				}
			}
			state.viewMonth = 0  // January
			state.viewYear = targetYear
			state.focusedDate = new Date(targetYear, 0, 1)
		} else {
			// Plain Home: first day of current month
			state.focusedDate = new Date(state.viewYear, state.viewMonth, 1)
		}
		return true
	}

	if (key === 'End') {
		event.preventDefault()
		if (event.ctrlKey || event.metaKey) {
			// Ctrl+End: December 31st - if already there, go to next year
			let targetYear = state.viewYear
			const dec31 = new Date(targetYear, 11, 31)
			if (state.focusedDate && isSameDay(state.focusedDate, dec31)) {
				targetYear++  // Already at Dec 31, go to next year
			}
			// Respect maxDate constraint
			if (options.maxDate) {
				const maxDate = normalizeDate(options.maxDate)
				if (maxDate && targetYear > maxDate.getFullYear()) {
					targetYear = maxDate.getFullYear()
				}
			}
			state.viewMonth = 11  // December
			state.viewYear = targetYear
			state.focusedDate = new Date(targetYear, 11, 31)
		} else {
			// Plain End: last day of current month
			const lastDay = getDaysInMonth(state.viewYear, state.viewMonth)
			state.focusedDate = new Date(state.viewYear, state.viewMonth, lastDay)
		}
		return true
	}

	// PageUp/PageDown for month navigation
	if (key === 'PageUp') {
		event.preventDefault()
		goToPrevMonth(state)
		// Keep focused date in new month
		if (state.focusedDate) {
			const day = Math.min(state.focusedDate.getDate(), getDaysInMonth(state.viewYear, state.viewMonth))
			state.focusedDate = new Date(state.viewYear, state.viewMonth, day)
		}
		return true
	}

	if (key === 'PageDown') {
		event.preventDefault()
		goToNextMonth(state)
		// Keep focused date in new month
		if (state.focusedDate) {
			const day = Math.min(state.focusedDate.getDate(), getDaysInMonth(state.viewYear, state.viewMonth))
			state.focusedDate = new Date(state.viewYear, state.viewMonth, day)
		}
		return true
	}

	return false
}

/**
 * Navigate focus with arrow keys
 */
function navigateFocus(
	state: DatePickerState,
	direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
	options: DatePickerOptions
): void {
	// Initialize focused date if not set
	if (!state.focusedDate) {
		state.focusedDate = state.selectedDate
			? new Date(state.selectedDate)
			: new Date(state.viewYear, state.viewMonth, 1)
		return
	}

	const newDate = new Date(state.focusedDate)
	const minDate = options.minDate ? normalizeDate(options.minDate) : null
	const maxDate = options.maxDate ? normalizeDate(options.maxDate) : null

	switch (direction) {
		case 'ArrowLeft':
			newDate.setDate(newDate.getDate() - 1)
			break
		case 'ArrowRight':
			newDate.setDate(newDate.getDate() + 1)
			break
		case 'ArrowUp':
			newDate.setDate(newDate.getDate() - 7)
			break
		case 'ArrowDown':
			newDate.setDate(newDate.getDate() + 7)
			break
	}

	// Check date constraints
	if (minDate && newDate < minDate) return
	if (maxDate && newDate > maxDate) return

	state.focusedDate = newDate

	// Update view if focused date is in different month
	if (newDate.getMonth() !== state.viewMonth || newDate.getFullYear() !== state.viewYear) {
		state.viewMonth = newDate.getMonth()
		state.viewYear = newDate.getFullYear()
	}
}

/**
 * Handle keyboard navigation in rolling selector
 */
function handleRollingSelectorKeyDown(event: KeyboardEvent, state: DatePickerState): boolean {
	const { key } = event

	if (key === 'ArrowUp' || key === 'ArrowDown') {
		event.preventDefault()
		const delta = key === 'ArrowUp' ? -1 : 1

		if (state.rollingSelectorMode === 'month') {
			const newMonth = state.viewMonth + delta
			if (newMonth >= 0 && newMonth <= 11) {
				state.viewMonth = newMonth
			}
		} else {
			state.viewYear += delta
		}
		return true
	}

	if (key === 'ArrowLeft' || key === 'ArrowRight') {
		event.preventDefault()
		// Switch between month and year columns
		state.rollingSelectorMode = state.rollingSelectorMode === 'month' ? 'year' : 'month'
		return true
	}

	if (key === 'Enter') {
		event.preventDefault()
		// Close rolling selector and show calendar
		state.rollingSelectorOpen = false
		return true
	}

	if (key === 'Escape') {
		event.preventDefault()
		state.rollingSelectorOpen = false
		return true
	}

	return false
}

/**
 * Initialize focus state when picker opens
 */
export function initializeFocus(state: DatePickerState): void {
	if (state.selectedDate) {
		// Focus on selected date
		state.focusedDate = new Date(state.selectedDate)
		state.viewYear = state.selectedDate.getFullYear()
		state.viewMonth = state.selectedDate.getMonth()
	} else {
		// Focus on today or first day of current view
		const today = new Date()
		state.focusedDate = new Date(state.viewYear, state.viewMonth, today.getDate())
	}
}

/**
 * Check if date is in current view month
 */
export function isInCurrentView(date: Date, state: DatePickerState): boolean {
	return date.getFullYear() === state.viewYear && date.getMonth() === state.viewMonth
}

// =============================================================================
// Date Picker Interaction
// Click handlers, input masking, focus management
// =============================================================================

import type { DatePickerState, DatePickerOptions, FormatSpec } from './types.js'
import { parseDate, normalizeDate } from './formatting.js'

/**
 * Handle click on a day cell
 * Returns the selected date if valid, null otherwise
 */
export function handleDayClick(
	target: HTMLElement,
	state: DatePickerState,
	options: DatePickerOptions
): Date | null {
	const dateStr = target.dataset.date
	if (!dateStr) return null

	// Check if disabled
	if (target.classList.contains('wg-datepicker__day--disabled')) {
		return null
	}

	// Parse date from data attribute (YYYY-MM-DD)
	const [year, month, day] = dateStr.split('-').map(Number)
	const date = new Date(year, month - 1, day)

	// Validate against min/max
	const minDate = options.minDate ? normalizeDate(options.minDate) : null
	const maxDate = options.maxDate ? normalizeDate(options.maxDate) : null

	if (minDate && date < minDate) return null
	if (maxDate && date > maxDate) return null

	// Update state
	state.selectedDate = date
	state.focusedDate = date

	return date
}

/**
 * Handle click on Today button
 */
export function handleTodayClick(
	state: DatePickerState,
	options: DatePickerOptions
): Date | null {
	const today = new Date()
	today.setHours(0, 0, 0, 0)

	// Validate against min/max
	const minDate = options.minDate ? normalizeDate(options.minDate) : null
	const maxDate = options.maxDate ? normalizeDate(options.maxDate) : null

	if (minDate && today < minDate) return null
	if (maxDate && today > maxDate) return null

	// Update state
	state.selectedDate = today
	state.focusedDate = today
	state.viewYear = today.getFullYear()
	state.viewMonth = today.getMonth()

	return today
}

/**
 * Handle click on month in rolling selector
 */
export function handleMonthClick(target: HTMLElement, state: DatePickerState): void {
	const monthStr = target.dataset.month
	if (monthStr !== undefined) {
		state.viewMonth = parseInt(monthStr, 10)
	}
}

/**
 * Handle click on year in rolling selector
 */
export function handleYearClick(target: HTMLElement, state: DatePickerState): void {
	const yearStr = target.dataset.year
	if (yearStr !== undefined) {
		state.viewYear = parseInt(yearStr, 10)
	}
}

/**
 * Apply input mask to enforce date format
 */
export function applyInputMask(
	value: string,
	formatInfo: FormatSpec
): string {
	const { separator, parts, maxLength } = formatInfo

	// Remove existing separators for clean processing
	const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const digitsOnly = value.replace(new RegExp(escapedSep, 'g'), '')

	// Calculate segment lengths
	const yearLen = parts.year?.length ?? 4
	const segments = [
		{ type: 'year', pos: parts.year?.index ?? 0, length: yearLen },
		{ type: 'month', pos: parts.month?.index ?? 1, length: 2 },
		{ type: 'day', pos: parts.day?.index ?? 2, length: 2 }
	].sort((a, b) => a.pos - b.pos)

	let result = ''
	let digitIndex = 0

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i]
		const segmentValue = digitsOnly.substring(digitIndex, digitIndex + segment.length)

		if (!segmentValue) break

		result += segmentValue
		digitIndex += segmentValue.length

		// Add separator after segment (except after last)
		if (i < segments.length - 1 && segmentValue.length === segment.length) {
			result += separator
		}
	}

	// Limit to max length
	return result.substring(0, maxLength)
}

/**
 * Handle input change with masking
 */
export function handleInputChange(
	input: HTMLInputElement,
	formatInfo: FormatSpec,
	previousValue: string
): string {
	const currentValue = input.value
	const currentCursorPos = input.selectionStart || 0
	const wasDeleting = currentValue.length < previousValue.length

	const { separator } = formatInfo

	// Clean value: keep only digits and separators
	const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const cleanValue = currentValue.replace(new RegExp(`[^0-9${escapedSep}]`, 'g'), '')

	// Apply mask
	const formatted = applyInputMask(cleanValue, formatInfo)

	if (formatted !== currentValue) {
		input.value = formatted

		// Calculate new cursor position
		let newCursorPos = currentCursorPos

		if (wasDeleting) {
			newCursorPos = currentCursorPos
		} else if (formatted.length > currentValue.length && formatted[currentCursorPos] === separator) {
			newCursorPos = currentCursorPos + 1
		} else if (formatted.length > currentValue.length) {
			const escapedSepPattern = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			const oldSeparatorsBefore = (currentValue.substring(0, currentCursorPos).match(new RegExp(escapedSepPattern, 'g')) || []).length
			const newSeparatorsBefore = (formatted.substring(0, currentCursorPos).match(new RegExp(escapedSepPattern, 'g')) || []).length
			const separatorDiff = newSeparatorsBefore - oldSeparatorsBefore
			newCursorPos = currentCursorPos + separatorDiff
		}

		input.setSelectionRange(newCursorPos, newCursorPos)
	}

	return formatted
}

/**
 * Handle keydown in input field
 * Returns true if event was handled and should be prevented
 */
export function handleInputKeyDown(
	event: KeyboardEvent,
	formatInfo: FormatSpec
): boolean {
	const { key, ctrlKey, metaKey } = event
	const { separator } = formatInfo

	// Allow: Backspace, Delete, Tab, Escape, Enter, Arrows, Ctrl+A/C/V/X
	const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
		'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']

	if (allowedKeys.includes(key) || ctrlKey || metaKey) {
		return false // Don't prevent
	}

	// Auto-pad single digit when separator is pressed
	if (key === separator) {
		const input = event.target as HTMLInputElement
		const cursorPos = input.selectionStart || 0
		const currentValue = input.value

		// Find start of current segment
		let segmentStart = 0
		for (let i = cursorPos - 1; i >= 0; i--) {
			if (currentValue[i] === separator) {
				segmentStart = i + 1
				break
			}
		}

		// Extract segment
		const segment = currentValue.substring(segmentStart, cursorPos)

		// If single digit, prepend 0
		if (/^\d$/.test(segment)) {
			event.preventDefault()

			const newValue = currentValue.substring(0, segmentStart) +
				'0' + segment +
				separator +
				currentValue.substring(cursorPos)

			input.value = newValue

			// Position cursor after separator
			const newCursorPos = segmentStart + 2 + separator.length
			input.setSelectionRange(newCursorPos, newCursorPos)

			return true
		}
	}

	// Allow only digits and separator
	if (!/^\d$/.test(key) && key !== separator) {
		event.preventDefault()
		return true
	}

	return false
}

/**
 * Handle paste in input field
 */
export function handleInputPaste(
	event: ClipboardEvent,
	input: HTMLInputElement,
	formatInfo: FormatSpec
): void {
	event.preventDefault()

	const pastedText = event.clipboardData?.getData('text') || ''
	const { separator } = formatInfo

	// Clean pasted content
	const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const cleaned = pastedText.replace(new RegExp(`[^0-9${escapedSep}]`, 'g'), '')

	// Apply mask
	const formatted = applyInputMask(cleaned, formatInfo)

	// Insert at cursor
	const start = input.selectionStart || 0
	const end = input.selectionEnd || 0
	const currentValue = input.value

	const newValue = currentValue.substring(0, start) + formatted + currentValue.substring(end)
	input.value = applyInputMask(newValue, formatInfo)

	// Set cursor after pasted content
	const newCursorPos = start + formatted.length
	input.setSelectionRange(newCursorPos, newCursorPos)
}

/**
 * Parse input value and update state if valid
 */
export function updateStateFromInput(
	value: string,
	formatInfo: FormatSpec,
	state: DatePickerState,
	options: DatePickerOptions
): boolean {
	if (!value || value.length < formatInfo.maxLength) {
		return false
	}

	const date = parseDate(value, formatInfo)
	if (!date) return false

	// Validate against min/max
	const minDate = options.minDate ? normalizeDate(options.minDate) : null
	const maxDate = options.maxDate ? normalizeDate(options.maxDate) : null

	if (minDate && date < minDate) return false
	if (maxDate && date > maxDate) return false

	// Update state
	state.selectedDate = date
	state.focusedDate = date
	state.viewYear = date.getFullYear()
	state.viewMonth = date.getMonth()

	return true
}

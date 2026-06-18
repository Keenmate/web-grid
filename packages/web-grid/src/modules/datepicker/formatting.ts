// =============================================================================
// Date Formatting Utilities
// Parse, format, and validate dates for the date picker
// =============================================================================

import type { FormatSpec } from './types.js'

/**
 * Parse a format string like "YYYY-MM-DD" or "DD.MM.YYYY"
 * Returns structure with positions, separator, and max length
 */
export function parseFormat(formatString: string): FormatSpec {
	const parts: FormatSpec['parts'] = {}
	let separator = ''

	// Detect separator
	if (formatString.includes('-')) separator = '-'
	else if (formatString.includes('/')) separator = '/'
	else if (formatString.includes('.')) separator = '.'

	// Split by separator
	const segments = formatString.split(separator)

	segments.forEach((segment, index) => {
		if (segment === 'YYYY' || segment === 'YY') {
			parts.year = { index, length: segment.length }
		} else if (segment === 'MM' || segment === 'M') {
			parts.month = { index, length: 2 } // Always 2 digits for consistency
		} else if (segment === 'DD' || segment === 'D') {
			parts.day = { index, length: 2 } // Always 2 digits for consistency
		}
	})

	return {
		format: formatString,
		separator,
		parts,
		maxLength: formatString.length
	}
}

/**
 * Format a Date object to a string using the given format info
 */
export function formatDate(date: Date | null, formatInfo: FormatSpec): string {
	if (!date || isNaN(date.getTime())) return ''

	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')

	const { separator, parts } = formatInfo
	const values: (string | number)[] = []

	// Build array in correct order based on format positions
	for (let i = 0; i < 3; i++) {
		if (parts.year && parts.year.index === i) {
			values.push(parts.year.length === 2 ? String(year).slice(-2) : year)
		} else if (parts.month && parts.month.index === i) {
			values.push(month)
		} else if (parts.day && parts.day.index === i) {
			values.push(day)
		}
	}

	return values.join(separator)
}

/**
 * Parse a date string using the given format info
 * Returns null if parsing fails
 */
export function parseDate(value: string, formatInfo: FormatSpec): Date | null {
	if (!value) return null

	const { separator, parts } = formatInfo
	const segments = value.split(separator)

	let year: number | null = null
	let month: number | null = null
	let day: number | null = null

	segments.forEach((segment, index) => {
		if (!segment) return

		if (parts.year && parts.year.index === index) {
			const yearValue = parseInt(segment, 10)
			if (parts.year.length === 4 && segment.length === 4) {
				year = yearValue
			} else if (parts.year.length === 2 && segment.length === 2) {
				// Assume 2000s for 2-digit years
				year = yearValue < 100 ? yearValue + 2000 : yearValue
			}
		} else if (parts.month && parts.month.index === index) {
			const monthValue = parseInt(segment, 10)
			if (segment.length === 2 && monthValue >= 1 && monthValue <= 12) {
				month = monthValue
			}
		} else if (parts.day && parts.day.index === index) {
			const dayValue = parseInt(segment, 10)
			if (segment.length === 2 && dayValue >= 1 && dayValue <= 31) {
				day = dayValue
			}
		}
	})

	// Must have all parts
	if (year === null || month === null || day === null) {
		return null
	}

	// Create date (month is 0-indexed)
	const date = new Date(year, month - 1, day)

	// Validate date is correct (catches invalid dates like Feb 30)
	if (date.getMonth() !== month - 1 || date.getDate() !== day) {
		return null
	}

	return date
}

/**
 * Check if a date is valid
 */
export function isValidDate(date: Date | null): boolean {
	return date !== null && !isNaN(date.getTime())
}

/**
 * Normalize a Date or string to a Date object
 * Returns null if invalid
 */
export function normalizeDate(dateInput: Date | string | null | undefined): Date | null {
	if (!dateInput) return null

	let date: Date
	if (typeof dateInput === 'string') {
		// Parse YYYY-MM-DD format (avoid timezone issues)
		const [year, month, day] = dateInput.split('-').map(Number)
		if (!year || !month || !day) {
			// Try parsing as ISO string
			date = new Date(dateInput)
		} else {
			date = new Date(year, month - 1, day)
		}
	} else {
		date = new Date(dateInput)
	}

	// Set to midnight to avoid time comparison issues
	date.setHours(0, 0, 0, 0)

	return isNaN(date.getTime()) ? null : date
}

/**
 * Format date as YYYY-MM-DD for internal use (data attributes, etc.)
 */
export function toISODateString(date: Date): string {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date | null, date2: Date | null): boolean {
	if (!date1 || !date2) return false
	return date1.getFullYear() === date2.getFullYear() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getDate() === date2.getDate()
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
	return isSameDay(date, new Date())
}

/**
 * Get number of days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate()
}

/**
 * Get the first day of week (0-6) for a month
 */
export function getFirstDayOfMonth(year: number, month: number): number {
	return new Date(year, month, 1).getDay()
}

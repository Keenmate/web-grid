// =============================================================================
// Typed cell values — the one place editor / pasted text becomes a value
// =============================================================================
// Number columns: strict parse (`Number()` + `isFinite`, trimmed; blank → null),
// then the `editorOptions` rules (`decimalPlaces` rounds; `min` / `max` /
// `allowNegative: false` reject — never clamp). Checkbox / date columns: the
// paste typing (what text means true, which date formats are accepted).
//
// An unparseable / out-of-range value is NOT dropped: it comes back with an
// `error` and the caller runs the normal invalid flow (the draft keeps what was
// typed, the cell is marked invalid, `validation-error` fires).
//
// `parseNumberText` is the single number-parsing function — the swap point for
// a locale-aware parse (decimal / thousand separators) later.

import type { Column, EditorOptions, GridLabels } from '../../types.js'
import { parseFormat, parseDateInput, toISODateString } from '../datepicker/formatting.js'
import { formatLabel } from '../../labels.js'

export interface TypedValue {
	/** The typed value — or, when `error` is set, what to keep in the draft (the typed text / number). */
	value: unknown
	/** Why the value is invalid (a `labels` text), or `null`. */
	error: string | null
}

type ValueLabels = Pick<GridLabels, 'invalidNumber' | 'numberMin' | 'numberMax' | 'numberNegative' | 'invalidBoolean' | 'invalidDate'>

/**
 * Strict number parse: trimmed, `''` → `null`, `Number()` + `isFinite`, else
 * `undefined` (not a number — `'abc'`, `'12abc'`, `'Infinity'`).
 */
export function parseNumberText(text: string): number | null | undefined {
	const trimmed = text.trim()
	if (trimmed === '') return null
	const n = Number(trimmed)
	return Number.isFinite(n) ? n : undefined
}

function roundTo(n: number, decimalPlaces: number): number {
	const factor = 10 ** decimalPlaces
	return Math.round((n + Math.sign(n) * Number.EPSILON) * factor) / factor
}

/** Apply `decimalPlaces` (round) and check `allowNegative` / `min` / `max` (no clamping). */
export function checkNumber(n: number, opts: EditorOptions<any>, labels: ValueLabels): TypedValue {
	const value = opts.decimalPlaces != null && opts.decimalPlaces >= 0 ? roundTo(n, opts.decimalPlaces) : n
	if (opts.allowNegative === false && value < 0) return { value, error: labels.numberNegative }
	if (opts.min != null && value < opts.min) return { value, error: formatLabel(labels.numberMin, { min: opts.min }) }
	if (opts.max != null && value > opts.max) return { value, error: formatLabel(labels.numberMax, { max: opts.max }) }
	return { value, error: null }
}

/**
 * A number column's value from an editor / paste / programmatic commit: text is
 * parsed strictly, numbers are checked against the options; `null` / `undefined`
 * stay empty. Anything else is passed through untouched.
 */
export function typeNumberValue(raw: unknown, opts: EditorOptions<any>, labels: ValueLabels): TypedValue {
	if (raw === null || raw === undefined) return { value: null, error: null }
	if (typeof raw === 'number') {
		return Number.isFinite(raw) ? checkNumber(raw, opts, labels) : { value: raw, error: labels.invalidNumber }
	}
	if (typeof raw === 'string') {
		const n = parseNumberText(raw)
		if (n === null) return { value: null, error: null }
		if (n === undefined) return { value: raw, error: labels.invalidNumber }
		return checkNumber(n, opts, labels)
	}
	return { value: raw, error: null }
}

const TRUE_TEXTS = new Set(['true', '1', 'yes', 'x', '✓'])
const FALSE_TEXTS = new Set(['false', '0', 'no', ''])

/** Pasted text for a checkbox column → `trueValue` / `falseValue` (default `true` / `false`). */
export function typeCheckboxText(text: string, opts: EditorOptions<any>, labels: ValueLabels): TypedValue {
	const trueValue = opts.trueValue ?? true
	const falseValue = opts.falseValue ?? false
	const t = text.trim()
	const lower = t.toLowerCase()
	if (TRUE_TEXTS.has(lower) || t === String(trueValue)) return { value: trueValue, error: null }
	if (FALSE_TEXTS.has(lower) || t === String(falseValue)) return { value: falseValue, error: null }
	return { value: text, error: labels.invalidBoolean }
}

/** Digits + one separator, three parts — rejects `parseInt`-lenient text like `1x.2.2026`. */
function looksLikeDate(text: string, separator: string): boolean {
	const parts = text.split(separator)
	return parts.length === 3 && parts.every(p => /^\d{1,4}$/.test(p))
}

/**
 * Pasted text for a date column: the column's `dateFormat` first, then ISO
 * `YYYY-MM-DD`; stored per `outputFormat` (`'iso'` default, `'date'`, `'timestamp'`).
 */
export function typeDateText(text: string, opts: EditorOptions<any>, labels: ValueLabels): TypedValue {
	const t = text.trim()
	if (t === '') return { value: null, error: null }
	let date: Date | null = null
	for (const format of [opts.dateFormat || 'YYYY-MM-DD', 'YYYY-MM-DD']) {
		const info = parseFormat(format)
		if (looksLikeDate(t, info.separator)) date = parseDateInput(t, info)
		if (date) break
	}
	if (!date) return { value: text, error: labels.invalidDate }
	switch (opts.outputFormat) {
		case 'date': return { value: date, error: null }
		case 'timestamp': return { value: date.getTime(), error: null }
		default: return { value: toISODateString(date), error: null }
	}
}

/**
 * Pasted text typed for its column (when no `getPasteValueCallback` takes over):
 * number / checkbox / date columns get typed values; other editors keep the text.
 */
export function typePastedText<T>(column: Column<T>, text: string, labels: ValueLabels): TypedValue {
	const opts = column.editorOptions || {}
	switch (column.editor) {
		case 'number': return typeNumberValue(text, opts, labels)
		case 'checkbox': return typeCheckboxText(text, opts, labels)
		case 'date': return typeDateText(text, opts, labels)
		default: return { value: text, error: null }
	}
}

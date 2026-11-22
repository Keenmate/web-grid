// =============================================================================
// Typed cell values — the one place editor / pasted text becomes a value
// =============================================================================
// Number columns: strict, locale-aware parse (core `parseNumber` with the grid's
// `locale` settings — `1 234,5` in `cs`, `1.234,5` in `de`; blank → null), then the `editorOptions` rules (`decimalPlaces` rounds; `min` / `max` /
// `allowNegative: false` reject — never clamp). Checkbox / date columns: the
// paste typing (what text means true, which date formats are accepted).
//
// An unparseable / out-of-range value is NOT dropped: it comes back with an
// `error` and the caller runs the normal invalid flow (the draft keeps what was
// typed, the cell is marked invalid, `validation-error` fires).
//
// `parseNumberText` is the single number-parsing function (typed + pasted text).

import type { Column, EditorOptions, GridLabels } from '../../types.js'
import { parseFormat, parseDateInput, toISODateString } from '../datepicker/formatting.js'
import { findOptionValueByText } from '../dropdown/options.js'
import { defaultLabelFormat, type LabelFormat } from '../../labels.js'
import { parseNumber, type ParseNumberOptions } from '@keenmate/web-components-core/locale'

/**
 * How a number column reads typed / pasted text: the grid's locale settings (`engine.numberSettings`),
 * the grid's own `parseNumberCallback`, and `source` (the grid element — its page-wide settings + logger).
 */
export interface NumberParseOptions extends ParseNumberOptions {
	source?: unknown
}

/**
 * Can `key` START typing a number into a number cell (type-to-edit)? A digit, a minus, the locale's decimal
 * separator (`engine.numberSettings` — the same settings the typed text is parsed with: `,` in `cs` / `de`), or
 * `.` where it isn't the group separator (core `parseNumber` reads `.5` in `cs`, not in `de`). A group separator
 * can't start a number; any other key does nothing on a number cell.
 */
export function isNumberStartKey(key: string, settings: { decimalSeparator?: string; thousandsSeparator?: string }): boolean {
	if (/^[\d\-−]$/.test(key)) return true
	if (key === settings.decimalSeparator) return true
	return key === '.' && settings.thousandsSeparator !== '.'
}

export interface TypedValue {
	/** The typed value — or, when `error` is set, what to keep in the draft (the typed text / number). */
	value: unknown
	/** Why the value is invalid (a `labels` text), or `null`. */
	error: string | null
}

type ValueLabels = Pick<GridLabels, 'errors.invalidNumber' | 'errors.numberMin' | 'errors.numberMax' | 'errors.numberNegative' | 'errors.invalidBoolean' | 'errors.invalidDate'>

/**
 * Strict number parse with the locale's separators (core `parseNumber`: grouping
 * optional but only in real group positions — `'1.5'` in `de` is not a number):
 * trimmed `''` → `null`, not a number → `undefined` (`'abc'`, `'12abc'`, `'Infinity'`).
 * `options` = `engine.numberParseOptions` (the grid's locale settings + `parseNumberCallback`
 * + the element as `source`); `{}` = page-wide `window.components.locale` → browser.
 * The grid's `parseNumberCallback`, then the page-wide one, answer before core.
 */
export function parseNumberText(text: string, options: NumberParseOptions = {}): number | null | undefined {
	if (text.trim() === '') return null
	const { source, ...parseOptions } = options
	return parseNumber(text, parseOptions, source) ?? undefined
}

function roundTo(n: number, decimalPlaces: number): number {
	const factor = 10 ** decimalPlaces
	return Math.round((n + Math.sign(n) * Number.EPSILON) * factor) / factor
}

/** Apply `decimalPlaces` (round) and check `allowNegative` / `min` / `max` (no clamping). */
export function checkNumber(n: number, opts: EditorOptions<any>, labels: ValueLabels, format: LabelFormat = defaultLabelFormat): TypedValue {
	const value = opts.decimalPlaces != null && opts.decimalPlaces >= 0 ? roundTo(n, opts.decimalPlaces) : n
	if (opts.allowNegative === false && value < 0) return { value, error: labels['errors.numberNegative'] }
	if (opts.min != null && value < opts.min) return { value, error: format('errors.numberMin', labels['errors.numberMin'], { min: opts.min }) }
	if (opts.max != null && value > opts.max) return { value, error: format('errors.numberMax', labels['errors.numberMax'], { max: opts.max }) }
	return { value, error: null }
}

/**
 * A number column's value from an editor / paste / programmatic commit: text is
 * parsed strictly with `numberParse` (`engine.numberParseOptions`), numbers are checked against the options; `null` / `undefined`
 * stay empty. Anything else is passed through untouched.
 */
export function typeNumberValue(raw: unknown, opts: EditorOptions<any>, labels: ValueLabels, format: LabelFormat = defaultLabelFormat, numberParse: NumberParseOptions = {}): TypedValue {
	if (raw === null || raw === undefined) return { value: null, error: null }
	if (typeof raw === 'number') {
		return Number.isFinite(raw) ? checkNumber(raw, opts, labels, format) : { value: raw, error: labels['errors.invalidNumber'] }
	}
	if (typeof raw === 'string') {
		const n = parseNumberText(raw, numberParse)
		if (n === null) return { value: null, error: null }
		if (n === undefined) return { value: raw, error: labels['errors.invalidNumber'] }
		return checkNumber(n, opts, labels, format)
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
	return { value: text, error: labels['errors.invalidBoolean'] }
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
	if (!date) return { value: text, error: labels['errors.invalidDate'] }
	switch (opts.outputFormat) {
		case 'date': return { value: date, error: null }
		case 'timestamp': return { value: date.getTime(), error: null }
		default: return { value: toISODateString(date), error: null }
	}
}

/**
 * Pasted text typed for its column (when no `getPasteValueCallback` takes over):
 * number / checkbox / date columns get typed values; a dropdown column (select / combobox /
 * autocomplete) maps an option's shown label back to its value (copy = the label, Excel) — no
 * matching local option keeps the text; other editors keep the text.
 */
export function typePastedText<T>(column: Column<T>, text: string, labels: ValueLabels, format: LabelFormat = defaultLabelFormat, numberParse: NumberParseOptions = {}): TypedValue {
	const opts = column.editorOptions || {}
	switch (column.editor) {
		case 'number': return typeNumberValue(text, opts, labels, format, numberParse)
		case 'checkbox': return typeCheckboxText(text, opts, labels)
		case 'date': return typeDateText(text, opts, labels)
		case 'select': case 'combobox': case 'autocomplete': {
			const match = findOptionValueByText(text, opts.initialOptions || opts.options || [], opts)
			return { value: match ? match.value : text, error: null }
		}
		default: return { value: text, error: null }
	}
}

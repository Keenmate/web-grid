// =============================================================================
// value-parse — the one place editor / pasted text becomes a typed value
// =============================================================================

import { describe, it, expect } from 'vitest'
import { parseNumberText, typeNumberValue, typeCheckboxText, typeDateText, typePastedText } from './value-parse.js'
import '@keenmate/web-components-core/locale' // publishes window.components.locale

const labels = {
	'errors.invalidNumber': 'NaN', 'errors.numberMin': 'min {min}', 'errors.numberMax': 'max {max}', 'errors.numberNegative': 'neg',
	'errors.invalidBoolean': 'bool', 'errors.invalidDate': 'date'
}

describe('parseNumberText (strict)', () => {
	it('parses trimmed numbers, blank → null, garbage → undefined', () => {
		expect(parseNumberText(' 42 ')).toBe(42)
		expect(parseNumberText('-3.25')).toBe(-3.25)
		expect(parseNumberText('')).toBe(null)
		expect(parseNumberText('   ')).toBe(null)
		expect(parseNumberText('abc')).toBe(undefined)
		expect(parseNumberText('12abc')).toBe(undefined)
		expect(parseNumberText('Infinity')).toBe(undefined)
	})
})

describe('parseNumberText (locale)', () => {
	it('en-US: dot decimal, comma grouping optional', () => {
		expect(parseNumberText('1234.5', { locale: 'en-US' })).toBe(1234.5)
		expect(parseNumberText('1,234.5', { locale: 'en-US' })).toBe(1234.5)
	})

	it('de: comma decimal, dot grouping optional', () => {
		expect(parseNumberText('1234,5', { locale: 'de' })).toBe(1234.5)
		expect(parseNumberText('1.234,5', { locale: 'de' })).toBe(1234.5)
		// a group separator only in a real group position: never a silent 15
		expect(parseNumberText('1.5', { locale: 'de' })).toBe(undefined)
	})

	it('cs: comma decimal, space grouping (plain or no-break) optional', () => {
		expect(parseNumberText('1234,5', { locale: 'cs' })).toBe(1234.5)
		expect(parseNumberText('1 234,5', { locale: 'cs' })).toBe(1234.5)
		expect(parseNumberText('1 234,5', { locale: 'cs' })).toBe(1234.5)
	})

	it('stays strict in every locale', () => {
		for (const locale of ['en-US', 'de', 'cs']) {
			expect(parseNumberText('abc', { locale })).toBe(undefined)
			expect(parseNumberText('12abc', { locale })).toBe(undefined)
			expect(parseNumberText(' ', { locale })).toBe(null)
		}
	})

	it('page-wide window.components.locale separators win over the locale ones', () => {
		;(window as any).components.locale = { decimalSeparator: ',', thousandsSeparator: "'" }
		try {
			expect(parseNumberText("1'234,5", { locale: 'en-US' })).toBe(1234.5)
		} finally {
			;(window as any).components.locale = null
		}
	})

	it('typeNumberValue / typePastedText parse with the given settings', () => {
		expect(typeNumberValue('1.234,5', { decimalPlaces: 2 }, labels, undefined, { locale: 'de' })).toEqual({ value: 1234.5, error: null })
		expect(typePastedText({ field: 'n', editor: 'number' } as any, '1 234,5', labels, undefined, { locale: 'cs' })).toEqual({ value: 1234.5, error: null })
	})
})

describe('typeNumberValue', () => {
	it('rounds decimalPlaces; rejects min / max / negatives without clamping', () => {
		expect(typeNumberValue('1.239', { decimalPlaces: 2 }, labels)).toEqual({ value: 1.24, error: null })
		expect(typeNumberValue('1.005', { decimalPlaces: 2 }, labels)).toEqual({ value: 1.01, error: null })
		expect(typeNumberValue('500', { max: 100 }, labels)).toEqual({ value: 500, error: 'max 100' })
		expect(typeNumberValue(-1, { min: 0 }, labels)).toEqual({ value: -1, error: 'min 0' })
		expect(typeNumberValue('-3', { allowNegative: false }, labels)).toEqual({ value: -3, error: 'neg' })
	})

	it('keeps unparseable text with an error; null / undefined → null', () => {
		expect(typeNumberValue('12abc', {}, labels)).toEqual({ value: '12abc', error: 'NaN' })
		expect(typeNumberValue(null, {}, labels)).toEqual({ value: null, error: null })
		expect(typeNumberValue(undefined, {}, labels)).toEqual({ value: null, error: null })
	})
})

describe('typeCheckboxText', () => {
	it('maps true / false texts and the trueValue / falseValue text', () => {
		for (const t of ['true', '1', 'YES', 'x', '✓']) expect(typeCheckboxText(t, {}, labels).value).toBe(true)
		for (const t of ['false', '0', 'no', '']) expect(typeCheckboxText(t, {}, labels).value).toBe(false)
		expect(typeCheckboxText('Y', { trueValue: 'Y', falseValue: 'N' }, labels).value).toBe('Y')
		expect(typeCheckboxText('N', { trueValue: 'Y', falseValue: 'N' }, labels).value).toBe('N')
		expect(typeCheckboxText('maybe', {}, labels)).toEqual({ value: 'maybe', error: 'bool' })
	})
})

describe('typeDateText', () => {
	it('dateFormat first, then ISO; stored per outputFormat; else invalid', () => {
		expect(typeDateText('05.03.2026', { dateFormat: 'DD.MM.YYYY' }, labels)).toEqual({ value: '2026-03-05', error: null })
		expect(typeDateText('2026-04-01', { dateFormat: 'DD.MM.YYYY' }, labels)).toEqual({ value: '2026-04-01', error: null })
		expect(typeDateText('05.03.2026', { dateFormat: 'DD.MM.YYYY', outputFormat: 'timestamp' }, labels).value)
			.toBe(new Date(2026, 2, 5).getTime())
		expect(typeDateText('31.02.2026', { dateFormat: 'DD.MM.YYYY' }, labels).error).toBe('date')
		expect(typeDateText('1x.02.2026', { dateFormat: 'DD.MM.YYYY' }, labels).error).toBe('date')
		expect(typeDateText('', {}, labels)).toEqual({ value: null, error: null })
	})
})

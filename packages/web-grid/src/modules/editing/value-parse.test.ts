// =============================================================================
// value-parse — the one place editor / pasted text becomes a typed value
// =============================================================================

import { describe, it, expect } from 'vitest'
import { parseNumberText, typeNumberValue, typeCheckboxText, typeDateText } from './value-parse.js'

const labels = {
	invalidNumber: 'NaN', numberMin: 'min {min}', numberMax: 'max {max}', numberNegative: 'neg',
	invalidBoolean: 'bool', invalidDate: 'date'
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

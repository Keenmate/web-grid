import { describe, expect, it } from 'vitest'
import { createTextMatcher } from './text-match.js'

describe('createTextMatcher (core /search, dropdown option filtering)', () => {
	it('contains, case- and diacritics-insensitive', () => {
		const isMatch = createTextMatcher('ces')
		expect(isMatch('Česká republika')).toBe(true)
		expect(isMatch('PROCESS')).toBe(true)
		expect(isMatch('Slovakia')).toBe(false)
		expect(createTextMatcher('STRASSE')('Hauptstraße')).toBe(true)
	})

	it('null / undefined values are empty; an empty term matches everything', () => {
		expect(createTextMatcher('a')(null)).toBe(false)
		expect(createTextMatcher('')(undefined)).toBe(true)
		expect(createTextMatcher('4')(42)).toBe(true)
	})
})

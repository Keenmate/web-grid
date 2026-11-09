// =============================================================================
// Grid-specific input converters (core `Converter`s — core SPEC §4)
// =============================================================================
//
// The grid's inputs whose values aren't one of core's `to*` shapes. Each one
// validates both paths, so a refused value goes through core (warning +
// `input-rejected`, previous value kept) like every other input.

import { toCssLength, toCustom, type Converter } from '@keenmate/web-components-core'

const FALSE_WORDS = new Set(['false', '0', 'no', 'off'])

/**
 * Boolean-or-`'auto'` tri-state (used by `show-pagination`). Absent → `fallback`;
 * `auto` → `'auto'`; `false` / `0` / `no` / `off` → `false`; any other value → `true`.
 * Property path: a boolean or `'auto'`.
 */
export const toBoolOrAuto = (fallback: boolean): Converter<boolean | 'auto'> =>
	toCustom<boolean | 'auto'>((raw) => {
		if (raw === null) return fallback
		const v = raw.trim().toLowerCase()
		if (v === 'auto') return 'auto'
		return !FALSE_WORDS.has(v)
	}, {
		validate: (value): value is boolean | 'auto' => typeof value === 'boolean' || value === 'auto',
		toAttribute: (value) => String(value),
	})

const cssLength = toCssLength()

/**
 * Number-or-CSS-length (used by `cell-toolbar-offset`, default `0.2`). A bare
 * number is a fraction of the cell width (0–1, the engine clamps it); anything
 * else must be a CSS length (`'2rem'`, `'24px'`).
 */
export const toNumberOrLength = (fallback: number | string): Converter<number | string> =>
	toCustom<number | string>((raw, reportInvalid) => {
		if (raw === null || raw.trim() === '') return fallback
		const v = raw.trim()
		const n = Number(v)
		if (!Number.isNaN(n)) return n
		if (cssLength.validate!(v)) return v
		reportInvalid?.('expected a number (fraction of the cell width) or a CSS length like "2rem"')
		return fallback
	}, {
		validate: (value): value is number | string =>
			(typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && cssLength.validate!(value)),
		toAttribute: (value) => String(value),
	})

/**
 * A `|`-separated list whose every part is one of `allowed` (`'top-right|bottom-right'`,
 * `'page-size|previous|page-info|next'`). Parts are trimmed; an unknown or empty part
 * refuses the whole value. `isNullable`: absent / `null` = unset.
 */
export function toPipeList(
	allowed: readonly string[],
	opts: { default?: string; isNullable?: boolean } = {}
): Converter<string | null> {
	const set = new Set(allowed)
	const fallback = opts.isNullable ? (opts.default ?? null) : (opts.default as string)
	const isValid = (v: string): boolean => {
		const parts = v.split('|').map(p => p.trim())
		return parts.length > 0 && parts.every(p => set.has(p))
	}
	const normalize = (v: string): string => v.split('|').map(p => p.trim()).join('|')
	return toCustom<string | null>((raw, reportInvalid) => {
		if (raw === null) return fallback
		if (raw.trim() === '' && opts.isNullable) return null
		if (isValid(raw)) return normalize(raw)
		reportInvalid?.(`expected "|"-separated values from: ${allowed.join(', ')}`)
		return fallback
	}, {
		validate: (value): value is string | null =>
			(value === null && !!opts.isNullable) || (typeof value === 'string' && isValid(value)),
		toAttribute: (value) => value,
	})
}

/** Pager / summary positions (`paginationPosition`, `summaryPosition`). */
export const AREA_POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const

/** Pager parts (`paginationLayout`). */
export const PAGINATION_PARTS = ['first', 'previous', 'page-info', 'next', 'last', 'page-size'] as const

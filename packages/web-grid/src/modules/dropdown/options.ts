// =============================================================================
// Dropdown Option Helpers
// Pure functions for extracting values from EditorOption objects
// =============================================================================

import type { EditorOption, EditorOptions } from '../../types.js'
import type { OptionContext } from '../../interaction.js'

// editorOptions object → the owning grid's ctx factory (bound by the engine when
// columns are set), so option callbacks get `controller` / `element` too.
const optionHosts = new WeakMap<object, (fields: object) => object>()

/** Bind an `editorOptions` object to its grid's ctx factory. */
export function bindOptionContext(opts: EditorOptions<any>, ctx: (fields: object) => object): void {
	optionHosts.set(opts, ctx)
}

/** The ctx for an option callback (+ extra fields). */
export function optionCtx<F extends object>(opts: EditorOptions<any>, fields: F): F & OptionContext {
	const make = optionHosts.get(opts)
	return (make ? make(fields) : fields) as F & OptionContext
}

/**
 * Get display value for a selected value from options list
 * Fallback chain:
 * 1. Find option by value, then use getDisplayValueCallback if provided
 * 2. Find option by value, then use displayMember
 * 3. Find option by value, then use 'label' property
 * 4. If no option found, return raw value as string
 */
export function getOptionDisplayValue(
	value: unknown,
	options: EditorOption[],
	opts: EditorOptions<any>
): string {
	const valueMember = opts.valueMember || 'value'
	const opt = options.find(o => (o as Record<string, unknown>)[valueMember] === value)
	if (opt) {
		// Use the same logic as getOptionLabel for consistency
		return getOptionLabel(opt, opts)
	}
	// No matching option - return raw value
	return value != null ? String(value) : ''
}

// The synthetic first item of an `isEmptyAllowed` dropdown (value null)
const EMPTY_OPTION = Symbol('wg-empty-option')

/** Is this the synthetic empty item (`editorOptions.isEmptyAllowed`)? */
export function isEmptyOption(opt: EditorOption | undefined): boolean {
	return !!opt && (opt as Record<symbol, unknown>)[EMPTY_OPTION] === true
}

/**
 * The option list as shown: with `editorOptions.isEmptyAllowed`, an empty first
 * item (value `null`, text `labels.dropdownEmptyOption`) ahead of `options`.
 * Only for an unfiltered list — a typed filter / search shows its matches only.
 */
export function withEmptyOption(options: EditorOption[], opts: EditorOptions<any>, text: string): EditorOption[] {
	if (!opts.isEmptyAllowed) return options
	const empty = { value: null as unknown as string, label: text, [EMPTY_OPTION]: true } as EditorOption
	if (opts.valueMember) (empty as Record<string, unknown>)[opts.valueMember] = null
	if (opts.displayMember) (empty as Record<string, unknown>)[opts.displayMember] = text
	return [empty, ...options]
}

/**
 * Get display label from option object
 */
export function getOptionLabel(opt: EditorOption, opts: EditorOptions<any>): string {
	if (isEmptyOption(opt)) return opt.label
	if (opts.getDisplayValueCallback) return opts.getDisplayValueCallback(optionCtx(opts, { option: opt }))
	const displayMember = opts.displayMember || 'label'
	return String((opt as Record<string, unknown>)[displayMember] ?? opt.label ?? '')
}

/**
 * Get value from option object
 */
export function getOptionValue(opt: EditorOption, opts: EditorOptions<any>): unknown {
	if (isEmptyOption(opt)) return null
	if (opts.getValueCallback) return opts.getValueCallback(optionCtx(opts, { option: opt }))
	const valueMember = opts.valueMember || 'value'
	return (opt as Record<string, unknown>)[valueMember] ?? opt.value
}

/**
 * Get searchable text from option object (falls back to display)
 */
export function getOptionSearchText(opt: EditorOption, opts: EditorOptions<any>): string {
	if (opts.getSearchValueCallback) return opts.getSearchValueCallback(optionCtx(opts, { option: opt }))
	if (opts.searchMember) return String((opt as Record<string, unknown>)[opts.searchMember] ?? '')
	return getOptionLabel(opt, opts)
}

/**
 * Get icon from option object
 */
export function getOptionIcon(opt: EditorOption, opts: EditorOptions<any>): string | null {
	if (isEmptyOption(opt)) return null
	if (opts.getIconCallback) return opts.getIconCallback(optionCtx(opts, { option: opt }))
	if (opts.iconMember) return (opt as Record<string, unknown>)[opts.iconMember] as string || null
	return null
}

/**
 * Get subtitle from option object
 */
export function getOptionSubtitle(opt: EditorOption, opts: EditorOptions<any>): string | null {
	if (isEmptyOption(opt)) return null
	if (opts.getSubtitleCallback) return opts.getSubtitleCallback(optionCtx(opts, { option: opt }))
	if (opts.subtitleMember) return (opt as Record<string, unknown>)[opts.subtitleMember] as string || null
	return null
}

/**
 * Check if option is disabled
 */
export function isOptionDisabled(opt: EditorOption, opts: EditorOptions<any>): boolean {
	if (isEmptyOption(opt)) return false
	if (opts.getIsDisabledCallback) return opts.getIsDisabledCallback(optionCtx(opts, { option: opt }))
	if (opts.disabledMember) return Boolean((opt as Record<string, unknown>)[opts.disabledMember])
	return false
}

/**
 * Get group from option object
 */
export function getOptionGroup(opt: EditorOption, opts: EditorOptions<any>): string | null {
	if (opts.getGroupCallback) return opts.getGroupCallback(optionCtx(opts, { option: opt }))
	if (opts.groupMember) return (opt as Record<string, unknown>)[opts.groupMember] as string || null
	return null
}

// =============================================================================
// Dropdown Rendering
// Render dropdown overlay, placed by core anchor() (/positioning)
// =============================================================================

import { escapeHtml } from '@keenmate/web-components-core'
import { anchor as anchorTo, type AnchorHandle } from '@keenmate/web-components-core/positioning'
import type { EditorOption, EditorOptions } from '../../types.js'
import type { GridHost } from '../grid-context.js'
import { getOptionLabel, getOptionValue, getOptionIcon, getOptionSubtitle, isOptionDisabled, isEmptyOption, optionCtx } from './options.js'
import { removeFillHandle } from '../fill-handle/index.js'
import { syncLoader, pruneDetachedLoaders } from '../rendering/loader.js'

/** The core anchor() placing each open dropdown (destroyed in removeDropdown()). */
const placements = new WeakMap<Element, AnchorHandle>()

/**
 * Render dropdown overlay, placed by core anchor()
 * Returns the dropdown element so caller can attach listeners
 */
export function renderDropdown<T>(
	ctx: GridHost<T>,
	anchor: HTMLElement,
	options: EditorOption[],
	opts: EditorOptions<any>
): HTMLElement {
	// Remove existing dropdown
	removeDropdown(ctx)

	const dropdown = document.createElement('div')
	dropdown.className = 'wg__dropdown'

	// Set base styles (position will be set by anchor())
	dropdown.style.cssText = `
		position: absolute;
		top: 0;
		left: 0;
		max-height: 200px;
		overflow-y: auto;
		z-index: var(--wg-z-dropdown);
	`

	// Render options
	if (options.length === 0) {
		// Searching (typed async search in flight) / no results (there are options,
		// or a typed search, but nothing matched) / no data (no options at all)
		const typed = (anchor.querySelector('input') as HTMLInputElement | null)?.value.trim() ?? ''
		const hasSource = (opts.options?.length ?? 0) > 0 || (opts.initialOptions?.length ?? 0) > 0
		const isNoResults = hasSource || (!!opts.searchCallback && typed !== '')
		const key = ctx.autocomplete.isSearching ? 'dropdownSearching' : isNoResults ? 'dropdownNoResults' : 'dropdownNoData'
		const message = opts.labels?.[key] ?? ctx.engine.labels[key]
		if (key === 'dropdownSearching') {
			// Typed search in flight: the loader (core renderLoader, context 'search') + the text
			dropdown.innerHTML = `<div class="wg__dropdown-empty wg__dropdown-searching"><span class="wg__dropdown-searching-indicator"></span>${message ? `<span aria-hidden="true">${escapeHtml(message)}</span>` : ''}</div>`
			syncLoader(ctx, 'search-dropdown', dropdown.querySelector('.wg__dropdown-searching-indicator') as HTMLElement, message)
		} else {
			dropdown.innerHTML = message ? `<div class="wg__dropdown-empty">${escapeHtml(message)}</div>` : ''
		}
	} else {
		// Get current value for isSelected check
		const editingCell = ctx.engine.editingCell
		const currentValue = editingCell
			? (ctx.engine.displayItems[editingCell.rowIndex] as Record<string, unknown>)?.[editingCell.field]
			: undefined

		// Get column alignment for dropdown options
		const column = ctx.getCurrentEditingColumn()
		const dropdownAlign = column?.horizontalAlign || 'left'

		dropdown.innerHTML = options.map((opt, i) => {
			const isHighlighted = i === ctx.dropdown.highlightedIndex
			const isSelected = getOptionValue(opt, opts) === currentValue
			const disabled = isOptionDisabled(opt, opts)

			// Custom render callback
			const isEmpty = isEmptyOption(opt)
			if (opts.renderOptionCallback && !isEmpty) {
				return opts.renderOptionCallback(optionCtx(opts, { option: opt, optionIndex: i, isFocused: isHighlighted, isSelected, isDisabled: disabled }))
			}

			// Default rendering with icon/subtitle support
			const label = getOptionLabel(opt, opts)
			const icon = getOptionIcon(opt, opts)
			const subtitle = getOptionSubtitle(opt, opts)

			const classes = ['wg__dropdown-option', `wg__dropdown-option--align-${dropdownAlign}`]
			if (isHighlighted) classes.push('wg__dropdown-option--highlighted')
			if (isSelected) classes.push('wg__dropdown-option--selected')
			if (disabled) classes.push('wg__dropdown-option--disabled')
			if (isEmpty) classes.push('wg__dropdown-option--empty')

			const iconHtml = icon ? `<span class="wg__dropdown-option-icon">${escapeHtml(icon)}</span>` : ''
			const subtitleHtml = subtitle ? `<span class="wg__dropdown-option-subtitle">${escapeHtml(subtitle)}</span>` : ''

			return `<div class="${classes.join(' ')}" data-index="${i}" ${disabled ? 'data-disabled="true"' : ''}>
				${iconHtml}
				<div class="wg__dropdown-option-content">
					<span class="wg__dropdown-option-label">${escapeHtml(label)}</span>
					${subtitleHtml}
				</div>
			</div>`
		}).join('')
	}

	// Append to shadow DOM
	ctx.shadow.appendChild(dropdown)
	ctx.dropdown.setIsOpen(true)
	removeFillHandle()  // Hide fill handle when dropdown opens

	// Core anchor(): one placement below the cell (flip to above), at least the cell's width
	// unless the column sets `dropdownMinWidth`
	if (opts.dropdownMinWidth) dropdown.style.minWidth = opts.dropdownMinWidth
	placements.set(dropdown, anchorTo(dropdown, anchor, {
		strategy: 'absolute',
		placement: 'bottom-start',
		// No `offset`: core's default is the page's field → panel gap `--base-dropdown-offset`
		shift: false,
		fallbackPlacements: ['top-start'],
		matchWidth: opts.dropdownMinWidth ? false : 'min',
		shouldAutoUpdate: false,
	}))

	return dropdown
}

/**
 * Remove dropdown from DOM
 */
export function removeDropdown<T>(ctx: GridHost<T>): void {
	const existing = ctx.shadow.querySelector('.wg__dropdown')
	if (existing) {
		placements.get(existing)?.destroy()
		placements.delete(existing)
		existing.remove()
	}
	syncLoader(ctx, 'search-dropdown', null, '')
	pruneDetachedLoaders(ctx)  // e.g. the editor's search loader when the editor closed mid-search
	ctx.dropdown.setIsOpen(false)
	ctx.dropdown.setHighlightedIndex(-1)
	ctx.dropdown.setFilterText('')  // Clear filter when dropdown closes
	ctx.dropdown.setUserInteracted(false)
}

// =============================================================================
// Dropdown Rendering
// Render dropdown overlay using Floating UI for positioning
// =============================================================================

import { computePosition, flip, offset, size } from '@floating-ui/dom'
import type { EditorOption, EditorOptions } from '../../types.js'
import type { GridHost } from '../grid-context.js'
import { getOptionLabel, getOptionValue, getOptionIcon, getOptionSubtitle, isOptionDisabled, isEmptyOption, optionCtx } from './options.js'
import { removeFillHandle } from '../fill-handle/index.js'
import { syncLoader, pruneDetachedLoaders } from '../rendering/loader.js'

/**
 * Render dropdown overlay using Floating UI for positioning
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

	// Set base styles (position will be set by Floating UI)
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
			dropdown.innerHTML = `<div class="wg__dropdown-empty wg__dropdown-searching"><span class="wg__dropdown-searching-indicator"></span>${message ? `<span aria-hidden="true">${ctx.escapeHtml(message)}</span>` : ''}</div>`
			syncLoader(ctx, 'search-dropdown', dropdown.querySelector('.wg__dropdown-searching-indicator') as HTMLElement, message)
		} else {
			dropdown.innerHTML = message ? `<div class="wg__dropdown-empty">${ctx.escapeHtml(message)}</div>` : ''
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

			const iconHtml = icon ? `<span class="wg__dropdown-option-icon">${ctx.escapeHtml(icon)}</span>` : ''
			const subtitleHtml = subtitle ? `<span class="wg__dropdown-option-subtitle">${ctx.escapeHtml(subtitle)}</span>` : ''

			return `<div class="${classes.join(' ')}" data-index="${i}" ${disabled ? 'data-disabled="true"' : ''}>
				${iconHtml}
				<div class="wg__dropdown-option-content">
					<span class="wg__dropdown-option-label">${ctx.escapeHtml(label)}</span>
					${subtitleHtml}
				</div>
			</div>`
		}).join('')
	}

	// Append to shadow DOM
	ctx.shadow.appendChild(dropdown)
	ctx.dropdown.setIsOpen(true)
	removeFillHandle()  // Hide fill handle when dropdown opens

	// Use Floating UI to position the dropdown
	computePosition(anchor, dropdown, {
		strategy: 'absolute',
		placement: 'bottom-start',
		middleware: [
			// Add 1px gap to prevent sub-pixel overlap with cell border
			offset(1),
			flip({ fallbackPlacements: ['top-start'] }),
			size({
				apply({ rects }) {
					// Use minWidth to allow dropdown to be wider than anchor if needed
					Object.assign(dropdown.style, {
						minWidth: opts.dropdownMinWidth || `${rects.reference.width}px`
					})
				}
			})
		]
	}).then(({ x, y }) => {
		Object.assign(dropdown.style, {
			left: `${x}px`,
			top: `${y}px`
		})
	})

	return dropdown
}

/**
 * Remove dropdown from DOM
 */
export function removeDropdown<T>(ctx: GridHost<T>): void {
	const existing = ctx.shadow.querySelector('.wg__dropdown')
	existing?.remove()
	syncLoader(ctx, 'search-dropdown', null, '')
	pruneDetachedLoaders(ctx)  // e.g. the editor's search loader when the editor closed mid-search
	ctx.dropdown.setIsOpen(false)
	ctx.dropdown.setHighlightedIndex(-1)
	ctx.dropdown.setFilterText('')  // Clear filter when dropdown closes
	ctx.dropdown.setUserInteracted(false)
}

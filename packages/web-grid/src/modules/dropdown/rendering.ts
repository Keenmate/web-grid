// =============================================================================
// Dropdown Rendering
// Render dropdown overlay using Floating UI for positioning
// =============================================================================

import { computePosition, flip, offset, size } from '@floating-ui/dom'
import type { EditorOption, EditorOptions } from '../../types.js'
import type { GridHost } from '../grid-context.js'
import { getOptionLabel, getOptionValue, getOptionIcon, getOptionSubtitle, isOptionDisabled, optionCtx } from './options.js'
import { removeFillHandle } from '../fill-handle/index.js'

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
		const message = ctx.autocomplete.isSearching
			? (opts.searchingText || ctx.engine.labels.dropdownSearching)
			: (opts.noOptionsText || ctx.engine.labels.dropdownNoOptions)
		dropdown.innerHTML = `<div class="wg__dropdown-empty">${ctx.escapeHtml(message)}</div>`
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
			if (opts.renderOptionCallback) {
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
	ctx.dropdown.setIsOpen(false)
	ctx.dropdown.setHighlightedIndex(-1)
	ctx.dropdown.setFilterText('')  // Clear filter when dropdown closes
	ctx.dropdown.setUserInteracted(false)
}

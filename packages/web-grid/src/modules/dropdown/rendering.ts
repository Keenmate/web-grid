// =============================================================================
// Dropdown Rendering
// Render dropdown overlay — a core createPopover() (/positioning) in the grid's shadow root
// =============================================================================

import { escapeHtml } from '@keenmate/web-components-core'
import { createPopover, type PopoverCloseReason, type PopoverHandle } from '@keenmate/web-components-core/positioning'
import type { EditorOption, EditorOptions } from '../../types.js'
import type { GridHost } from '../grid-context.js'
import { getOptionLabel, getOptionValue, getOptionIcon, getOptionSubtitle, isOptionDisabled, isEmptyOption, optionCtx } from './options.js'
import { removeFillHandle } from '../fill-handle/index.js'
import { syncLoader, pruneDetachedLoaders } from '../rendering/loader.js'
import { clearEditingVisual } from '../navigation/focus.js'
import { renderCell } from '../rendering/cell.js'

/** The core popover of each open dropdown panel (closed in removeDropdown()). */
const popovers = new WeakMap<Element, PopoverHandle>()

/** The cell being edited when a dropdown opened (`null` in 'always' edit mode: no edit session). */
type EditedCell = { rowIndex: number; field: string } | null

/**
 * The one close handler of the dropdown popover. Each close path is wired ONCE: either the grid
 * drives it (and closes the popover itself → `'api'`) or core does (its reason below).
 *
 * | reason                 | close path                                              | result                                  |
 * |------------------------|---------------------------------------------------------|-----------------------------------------|
 * | 'api'                  | the grid closed it: option pick, Enter, Tab / Shift+Tab, | nothing: the caller already saved /     |
 * |                        | Escape, editor blur, outside click, another cell, edit  | cancelled (or the edit goes on: filter  |
 * |                        | ended, toggle, a filter re-render, grid destroyed        | re-render, toggle)                      |
 * | 'scroll'               | the page or the grid body scrolled and the cell moved   | CANCEL the edit (no save), re-render    |
 * |                        |                                                         | the cell captured at open               |
 * | 'reference-removed'    | never fires: the position isn't auto-updated            | nothing (state reset only)              |
 * | 'resize'               | off (`shouldCloseOnResize: false`; stays open, as before)| —                                       |
 * | 'escape' / 'outside-   | off: not in the overlay tree. Escape = the grid's key   | —                                       |
 * | click' / 'overlay' /   | pipeline; outside = the editor's blur / the grid's      |                                         |
 * | 'parent'               | outside-click                                           |                                         |
 *
 * For any reason but 'api', core has already removed the panel: reset the dropdown state.
 */
function onDropdownClose<T>(ctx: GridHost<T>, reason: PopoverCloseReason, edited: EditedCell): void {
	if (reason === 'api') return
	resetDropdownState(ctx)
	if (reason !== 'scroll') return
	clearEditingVisual(ctx)
	ctx.engine.cancelEdit()
	// Re-render the edited cell to remove the editor HTML (toggle, etc.)
	const colIndex = edited ? ctx.engine.columns.findIndex(c => String(c.field) === edited.field) : -1
	if (edited && colIndex >= 0) renderCell(ctx, edited.rowIndex, colIndex)
}

/**
 * Render dropdown overlay — a core createPopover() mounted in the grid's shadow root
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

	// The edited cell, captured at open (a scroll close cancels THIS edit)
	const editing = ctx.engine.editingCell
	const edited: EditedCell = editing ? { rowIndex: editing.rowIndex, field: editing.field } : null

	// Core popover in the shadow root (the grid's styles + theme apply): one placement below the
	// cell (flip to above), at least the cell's width unless the column sets `dropdownMinWidth`.
	// Closing stays grid-driven except scroll (see onDropdownClose()).
	if (opts.dropdownMinWidth) dropdown.style.minWidth = opts.dropdownMinWidth
	const popover = createPopover({
		reference: anchor,
		panel: dropdown,
		container: ctx.shadow,
		inheritThemeFrom: false,
		strategy: 'absolute',
		placement: 'bottom-start',
		// No `offset`: core's default is the page's field → panel gap `--base-dropdown-offset`
		shift: false,
		fallbackPlacements: ['top-start'],
		matchWidth: opts.dropdownMinWidth ? false : 'min',
		shouldAutoUpdate: false,
		// A scroll that moved the cell closes it: not while the grid moves the edit between cells,
		// nor while the grid is detached (a DOM move keeps it open, as before)
		shouldCloseOnScroll: () => !ctx.isTransitioningCells && ctx.shadow.host.isConnected,
		shouldCloseOnResize: false,
		onClose: (reason) => onDropdownClose(ctx, reason, edited),
	})
	popovers.set(dropdown, popover)
	popover.open()
	ctx.dropdown.setIsOpen(true)
	removeFillHandle()  // Hide fill handle when dropdown opens

	return dropdown
}

/**
 * Close the dropdown (its popover reports `'api'`: the caller does the save / cancel)
 */
export function removeDropdown<T>(ctx: GridHost<T>): void {
	const existing = ctx.shadow.querySelector('.wg__dropdown')
	if (existing) {
		const popover = popovers.get(existing)
		popovers.delete(existing)
		if (popover) popover.destroy()
		else existing.remove()
	}
	resetDropdownState(ctx)
}

/** Forget the closed dropdown: loaders, open flag, highlight, filter text. */
function resetDropdownState<T>(ctx: GridHost<T>): void {
	syncLoader(ctx, 'search-dropdown', null, '')
	pruneDetachedLoaders(ctx)  // e.g. the editor's search loader when the editor closed mid-search
	ctx.dropdown.setIsOpen(false)
	ctx.dropdown.setHighlightedIndex(-1)
	ctx.dropdown.setFilterText('')  // Clear filter when dropdown closes
	ctx.dropdown.setUserInteracted(false)
}

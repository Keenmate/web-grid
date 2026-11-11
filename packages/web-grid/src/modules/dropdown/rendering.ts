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
import { clearEditingVisual, returnFocusToCell } from '../navigation/focus.js'
import { commitEditorValue } from '../editing/commit-on-transition.js'
import { renderCell } from '../rendering/cell.js'
import { buildSheetHeader, setSheetSemantics, startSheetSession } from '../sheet/index.js'

/** The core popover of each open dropdown panel (closed in removeDropdown()). */
const popovers = new WeakMap<Element, PopoverHandle>()

/** The cell being edited when a dropdown opened (`null` in 'always' edit mode: no edit session). */
type EditedCell = { rowIndex: number; field: string } | null

/** What each open dropdown panel was opened for (its cell editor + the edit captured at open). */
type PanelInfo = { anchor: HTMLElement; edited: EditedCell; opts: EditorOptions<any> }
const panelInfos = new WeakMap<Element, PanelInfo>()

/** A dropdown panel presented as the phone sheet: its header and how to undo the sheet. */
type SheetState = { header: HTMLElement; savedStyle: string; endSession: () => void }
const sheets = new WeakMap<Element, SheetState>()

/** Whether the dropdown panel is currently the phone sheet (css/sheet.css `.wg__dropdown--sheet`). */
export function isDropdownSheet(panel: Element | null | undefined): boolean {
	return !!panel && sheets.has(panel)
}

/**
 * The one close handler of the dropdown popover. Each close path is wired ONCE: either the grid
 * drives it (and closes the popover itself → `'api'`) or core does (its reason below). Excel
 * model: leaving a cell any way but Escape SAVES (a select without a pick changes nothing).
 *
 * | reason                 | close path                                              | result                                  |
 * |------------------------|---------------------------------------------------------|-----------------------------------------|
 * | 'api'                  | the grid closed it: option pick, Enter, Tab / Shift+Tab, | nothing: the caller already saved /     |
 * |                        | Escape, editor blur, outside click, another cell, edit  | cancelled (or the edit goes on: filter  |
 * |                        | ended, toggle, a filter re-render, grid destroyed        | re-render, toggle)                      |
 * | 'overlay' / 'parent'   | another overlay opened (or dismissAllOverlays()), the   | SAVE the edit captured at open          |
 * |                        | overlay the grid lives in closed                        | (commitEditorValue), focus back to the  |
 * |                        |                                                         | cell if it was in the editor            |
 * | 'scroll'               | the page or the grid body scrolled and the cell moved   | CANCEL the edit (no save), re-render    |
 * |                        | (never for the phone sheet: it locks the page)          |                                         |
 * |                        |                                                         | the cell captured at open, focus to it  |
 * |                        |                                                         | (or to the grid when not rendered)      |
 * | (sheet close / Back)   | the phone sheet's close button, the phone Back gesture  | SAVE (closeDropdownSheet(); the grid    |
 * |                        |                                                         | closes the popover → 'api'), focus back |
 * |                        |                                                         | to the cell                             |
 * | 'reference-removed'    | never fires: the position isn't auto-updated            | nothing (state reset only)              |
 * | 'resize'               | off (`shouldCloseOnResize: false`; stays open, as before)| —                                       |
 * | 'escape' / 'outside-   | off: Escape = the grid's key pipeline; outside = the    | —                                       |
 * | click'                 | editor's blur / the grid's outside-click                |                                         |
 *
 * For any reason but 'api', core has already removed the panel: reset the dropdown state.
 */
function onDropdownClose<T>(ctx: GridHost<T>, panel: HTMLElement, reason: PopoverCloseReason, edited: EditedCell): void {
	if (reason === 'api') return
	endSheet(panel)
	resetDropdownState(ctx)
	if (reason !== 'scroll' && reason !== 'overlay' && reason !== 'parent') return
	// Only the edit this dropdown opened with (the grid may have moved on since)
	const editing = ctx.engine.editingCell
	if (!edited || !editing || editing.rowIndex !== edited.rowIndex || editing.field !== edited.field) return
	const colIndex = ctx.engine.columns.findIndex(c => String(c.field) === edited.field)
	const cell = colIndex >= 0
		? ctx.shadow.querySelector(`td[data-row="${edited.rowIndex}"][data-col="${colIndex}"]`)
		: null
	const active = ctx.shadow.activeElement
	const hadFocus = !!active && !!cell?.contains(active)
	clearEditingVisual(ctx)
	if (reason === 'scroll') ctx.engine.cancelEdit()
	else commitEditorValue(ctx)
	// Re-render the edited cell to remove the editor HTML (toggle, etc.)
	if (colIndex >= 0) renderCell(ctx, edited.rowIndex, colIndex)
	// Keyboard focus stays with the cell (the grid when its row is no longer rendered)
	if (colIndex >= 0 && (reason === 'scroll' || hadFocus)) returnFocusToCell(ctx, edited.rowIndex, colIndex)
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
	// The phone sheet open on this same editor: refresh its options in place, so the sheet's
	// header, its search field and the focus in it stay (typing re-renders the list each key)
	const open = ctx.shadow.querySelector('.wg__dropdown') as HTMLElement | null
	const sheet = open ? sheets.get(open) : undefined
	if (open && sheet && panelInfos.get(open)?.anchor === anchor && ctx.isPhoneSheet) {
		resetDropdownState(ctx)
		while (sheet.header.nextSibling) sheet.header.nextSibling.remove()
		fillDropdown(ctx, open, anchor, options, opts, sheet.header)
		ctx.dropdown.setIsOpen(true)
		return open
	}

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

	fillDropdown(ctx, dropdown, anchor, options, opts, null)

	// The edited cell, captured at open (a scroll close cancels THIS edit)
	const editing = ctx.engine.editingCell
	const edited: EditedCell = editing ? { rowIndex: editing.rowIndex, field: editing.field } : null
	panelInfos.set(dropdown, { anchor, edited, opts })

	// Core popover in the shadow root (the grid's styles + theme apply): one placement below the
	// cell (flip to above), at least the cell's width unless the column sets `dropdownMinWidth`.
	// Closing stays grid-driven except scroll and the overlay tree (see onDropdownClose()).
	// On a phone it opens un-anchored as the sheet (enterDropdownSheet(); css/sheet.css).
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
		isAnchored: !ctx.isPhoneSheet,
		// A scroll that moved the cell closes it: not while the grid moves the edit between cells,
		// nor while the grid is detached (a DOM move keeps it open, as before), nor as the phone
		// sheet (it locks the page; nothing under it moves)
		shouldCloseOnScroll: () => !ctx.isTransitioningCells && ctx.shadow.host.isConnected && !sheets.has(dropdown),
		shouldCloseOnResize: false,
		// Join the page-wide overlay tree (the `overlay-group` input; unset = the default group):
		// another overlay of the same group opening — or dismissAllOverlays() — closes it ('overlay'),
		// and so does the overlay the grid lives in ('parent'); both save the edit. Escape / outside
		// clicks stay the grid's own.
		overlayGroup: ctx.overlayGroup || undefined,
		onClose: (reason) => onDropdownClose(ctx, dropdown, reason, edited),
	})
	popovers.set(dropdown, popover)
	popover.open()
	if (ctx.isPhoneSheet) enterDropdownSheet(ctx, dropdown)
	ctx.dropdown.setIsOpen(true)
	removeFillHandle()  // Hide fill handle when dropdown opens

	return dropdown
}

/**
 * The panel's options (or its empty / no-results / searching message): after `after` (the
 * sheet header), else as its whole content.
 */
function fillDropdown<T>(
	ctx: GridHost<T>,
	dropdown: HTMLElement,
	anchor: HTMLElement,
	options: EditorOption[],
	opts: EditorOptions<any>,
	after: HTMLElement | null
): void {
	const put = (html: string) => {
		if (after) after.insertAdjacentHTML('afterend', html)
		else dropdown.innerHTML = html
	}
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
			put(`<div class="wg__dropdown-empty wg__dropdown-searching"><span class="wg__dropdown-searching-indicator"></span>${message ? `<span aria-hidden="true">${escapeHtml(message)}</span>` : ''}</div>`)
			syncLoader(ctx, 'search-dropdown', dropdown.querySelector('.wg__dropdown-searching-indicator') as HTMLElement, message)
		} else {
			put(message ? `<div class="wg__dropdown-empty">${escapeHtml(message)}</div>` : '')
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

		put(options.map((opt, i) => {
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
		}).join(''))
	}
}

/**
 * Close the dropdown (its popover reports `'api'`: the caller does the save / cancel)
 */
export function removeDropdown<T>(ctx: GridHost<T>): void {
	const existing = ctx.shadow.querySelector('.wg__dropdown')
	if (existing) {
		endSheet(existing)
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

// =============================================================================
// Phone sheet (rulebook C-RO / D-RO; css/sheet.css)
// =============================================================================
// On a phone (`ctx.isPhoneSheet`, core resolvePresentation()) the open dropdown is the SAME
// popover un-anchored (setAnchored(false)) and dressed as an edge-to-edge sheet: a header with
// the column title, a search field for a combobox / autocomplete (it types into the cell's own
// input, which the sheet covers) and a close button. Focus moves into the sheet and comes back
// to the cell on close. Keys pressed in the sheet go to the cell's editor (the grid's own key
// pipeline): arrows highlight, Enter picks, Escape CANCELS, Tab leaves. The close button and the
// phone Back gesture leave the cell → SAVE (closeDropdownSheet(); a select without a pick
// changes nothing). Crossing the line while open switches the presentation live.

/** The cell editor a dropdown panel belongs to: the select trigger or the combobox / autocomplete input. */
function cellEditorOf(anchor: HTMLElement): HTMLElement | null {
	const selector = '.wg__select-trigger, .wg__combobox-input, .wg__autocomplete-input'
	return anchor.matches(selector) ? anchor : anchor.querySelector(selector) as HTMLElement | null
}

/** The keys a sheet hands to the cell's editor (from its close button: only the leave-the-cell ones). */
const FORWARDED_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'])
const FORWARDED_KEYS_FROM_CLOSE = new Set(['Escape', 'Tab'])

/** Dress the open dropdown `panel` as the phone sheet (un-anchored), focus into it. */
function enterDropdownSheet<T>(ctx: GridHost<T>, panel: HTMLElement): void {
	const info = panelInfos.get(panel)
	const popover = popovers.get(panel)
	if (!info || !popover || sheets.has(panel)) return
	const editor = cellEditorOf(info.anchor)
	const field = info.edited?.field ?? editor?.dataset.field ?? ''
	const column = ctx.engine.columns.find(c => String(c.field) === field)
	const title = column?.title || field
	const typed = editor instanceof HTMLInputElement ? editor : null
	const header = buildSheetHeader({
		title,
		closeLabel: ctx.engine.labels.sheetClose,
		onClose: () => closeDropdownSheet(ctx, panel),
		search: typed ? { placeholder: ctx.engine.labels.sheetSearch, value: typed.value } : undefined,
	})
	// The sheet's search types into the cell's own input: the grid filters / searches as before
	const search = header.querySelector('.wg__sheet-search') as HTMLInputElement | null
	search?.addEventListener('input', () => {
		const input = cellEditorOf(info.anchor)
		if (!(input instanceof HTMLInputElement)) return
		input.value = search.value
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	// Un-anchored first (core puts back the inline position it found), then the anchored geometry
	// goes away: css/sheet.css places the sheet
	const savedStyle = panel.style.cssText
	popover.setAnchored(false)
	panel.style.cssText = ''
	panel.classList.add('wg__dropdown--sheet')
	setSheetSemantics(panel, title)
	panel.prepend(header)
	const endSession = startSheetSession(panel, () => closeDropdownSheet(ctx, panel))
	sheets.set(panel, { header, savedStyle, endSession })
	attachSheetKeys(ctx, panel)
	;(search ?? panel).focus({ preventScroll: true })
	if (search) search.setSelectionRange(search.value.length, search.value.length)
}

/** Undo the sheet on `panel` (no-op when it isn't one): session ended, header gone, inline geometry back. */
function endSheet(panel: Element): void {
	const sheet = sheets.get(panel)
	if (!sheet) return
	sheets.delete(panel)
	sheet.endSession()
	sheet.header.remove()
	const el = panel as HTMLElement
	el.classList.remove('wg__dropdown--sheet')
	setSheetSemantics(el, null)
	el.style.cssText = sheet.savedStyle
}

/** Keys pressed in the sheet go to the cell's editor (one listener per panel). */
const keyedPanels = new WeakSet<Element>()
function attachSheetKeys<T>(ctx: GridHost<T>, panel: HTMLElement): void {
	if (keyedPanels.has(panel)) return
	keyedPanels.add(panel)
	panel.addEventListener('keydown', (e) => {
		if (!sheets.has(panel)) return
		const isFromClose = !!(e.target as Element | null)?.closest?.('.wg__sheet-close')
		if (!(isFromClose ? FORWARDED_KEYS_FROM_CLOSE : FORWARDED_KEYS).has(e.key)) return
		const info = panelInfos.get(panel)
		const editor = info ? cellEditorOf(info.anchor) : null
		if (!editor?.isConnected) return
		e.preventDefault()
		e.stopPropagation()
		editor.dispatchEvent(new KeyboardEvent('keydown', {
			key: e.key, code: e.code, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey,
			bubbles: true, cancelable: true, composed: true,
		}))
		// The sheet closed (Escape / Enter / Tab) with focus in it: keep it with the grid
		if (!panel.isConnected && !ctx.shadow.activeElement) focusGridOrCell(ctx, info?.edited ?? null)
	})
}

/** Focus the edited cell when it is rendered, else the grid. */
function focusGridOrCell<T>(ctx: GridHost<T>, edited: EditedCell): void {
	const colIndex = edited ? ctx.engine.columns.findIndex(c => String(c.field) === edited.field) : -1
	if (edited && colIndex >= 0) returnFocusToCell(ctx, edited.rowIndex, colIndex)
	else (ctx.shadow.querySelector('.wg') as HTMLElement | null)?.focus({ preventScroll: true })
}

/**
 * The sheet's close button / the phone Back gesture: leave the cell → SAVE the edit the sheet
 * opened with (Excel rule; a select without a pick changes nothing), focus back to the cell.
 */
function closeDropdownSheet<T>(ctx: GridHost<T>, panel: HTMLElement): void {
	const info = panelInfos.get(panel)
	const edited = info?.edited ?? null
	removeDropdown(ctx)
	const editing = ctx.engine.editingCell
	if (edited && editing && editing.rowIndex === edited.rowIndex && editing.field === edited.field) {
		const colIndex = ctx.engine.columns.findIndex(c => String(c.field) === edited.field)
		clearEditingVisual(ctx)
		commitEditorValue(ctx)
		if (colIndex >= 0) {
			renderCell(ctx, edited.rowIndex, colIndex)
			returnFocusToCell(ctx, edited.rowIndex, colIndex)
		}
		return
	}
	// 'always' edit mode (no edit session) / the edit already ended: focus back to the cell
	const focused = ctx.engine.focusedCell
	if (focused) returnFocusToCell(ctx, focused.rowIndex, focused.colIndex)
	else focusGridOrCell(ctx, edited)
}

/**
 * The phone line was crossed (`ctx.isPhoneSheet` changed, core environment): switch the open
 * dropdown between the sheet and the anchored panel in place — same popover, setAnchored().
 */
export function applyDropdownPresentation<T>(ctx: GridHost<T>): void {
	const panel = ctx.shadow.querySelector('.wg__dropdown') as HTMLElement | null
	if (!panel || !popovers.has(panel)) return
	if (ctx.isPhoneSheet) {
		enterDropdownSheet(ctx, panel)
		return
	}
	if (!sheets.has(panel)) return
	const hadFocus = panel.contains(ctx.shadow.activeElement)
	endSheet(panel)
	popovers.get(panel)?.setAnchored(true)
	// Focus back into the cell's editor (the anchored panel keeps it there)
	const info = panelInfos.get(panel)
	const editor = info ? cellEditorOf(info.anchor) : null
	if (hadFocus && editor?.isConnected) editor.focus({ preventScroll: true })
}

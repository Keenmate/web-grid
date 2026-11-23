// =============================================================================
// Phone sheet — the cell dropdown and the date editor on a phone
// =============================================================================
// On a phone (core resolvePresentation(): the device class, D-RO-3 = C — no width
// literal) the two cell popups are an edge-to-edge sheet instead of a panel anchored
// under the cell: the same core createPopover(), un-anchored (setAnchored(false)) and
// placed by css/sheet.css (`.wg__dropdown--sheet`, `.wg-datepicker-container--sheet`).
// This module holds what both share: the sheet header — core's sheet chrome (createSheetHeader +
// SHEET_CHROME_CSS: `.km-sheet-header` / `-title` / `-close`, rulebook C-RO-17) with the grid's
// own `wg__sheet-*` classes kept for the search row — and the modal session around an open sheet
// (core startModalSession, SPEC §12.19, rulebook C-CA-19): the page behind inert, Tab kept inside,
// page scroll locked, the panel kept above the soft keyboard and the phone Back gesture closing the
// sheet instead of leaving the page (one history entry page-wide; rulebook C-RO-15). The panel is
// core's full-screen frame `.km-sheet` (+ `.km-sheet-body`, the scrolling column under the header).
//
// Edit semantics are the grid's own (Excel rule): the close button and Back leave the cell → SAVE;
// Escape CANCELS — so the session never closes on Escape (`shouldCloseOnEscape: false`): the key
// goes to the cell's editor (the dropdown) or the picker's popover (the date editor).

import {
	SHEET_CHROME_CSS,
	adoptStyles,
	createSheetHeader,
	startModalSession,
	type ModalSession,
} from '@keenmate/web-components-core'

export interface SheetHeaderOptions {
	/** The sheet's title (the column's title) — also its accessible name. */
	title: string
	/** Accessible name of the close button (`ariaLabels.closeSheet`). */
	closeLabel: string
	/** Close button pressed: leave the cell (save). */
	closeCallback: () => void
	/** A search field (combobox / autocomplete): its placeholder + initial text. */
	search?: { placeholder: string; value: string }
}

/**
 * Build the sheet header: core's `.km-sheet-header` (+ `.wg__sheet-header`) with the title
 * (`.km-sheet-title wg__sheet-title`), the close button (`.km-sheet-close wg__sheet-close`: no
 * text, the ✕ is core's masked `--base-icon-close`) and the optional `.wg__sheet-search` input
 * on its own row. Core's `SHEET_CHROME_CSS` is adopted when the session starts (`startSheetModal`).
 */
export function buildSheetHeader(options: SheetHeaderOptions): HTMLElement {
	const { header, title, close } = createSheetHeader({
		title: options.title,
		closeLabel: options.closeLabel,
		closeCallback: options.closeCallback,
	})
	header.classList.add('wg__sheet-header')
	title?.classList.add('wg__sheet-title')
	close.classList.add('wg__sheet-close')

	if (options.search) {
		const input = document.createElement('input')
		input.type = 'text'
		input.className = 'wg__sheet-search'
		input.autocomplete = 'off'
		input.spellcheck = false
		input.placeholder = options.search.placeholder
		input.setAttribute('aria-label', options.search.placeholder || options.title)
		input.value = options.search.value
		header.appendChild(input)
	}
	return header
}

/**
 * Mark `panel` as a sheet (a dialog named by its title, focusable) or back as a plain panel.
 * `aria-modal` is the modal session's (set while it runs, removed by its `end()`).
 */
export function setSheetSemantics(panel: HTMLElement, title: string | null): void {
	if (title !== null) {
		panel.setAttribute('role', 'dialog')
		panel.setAttribute('aria-label', title)
		panel.tabIndex = -1
	} else {
		panel.removeAttribute('role')
		panel.removeAttribute('aria-label')
		panel.removeAttribute('tabindex')
	}
}

/**
 * Start the modal session of an open sheet `panel` (already dressed as `.km-sheet`, the focus already
 * inside it — moving it in after the page went inert would blur the cell's editor first): core's
 * sheet chrome adopted into its root, the page inert + Tab trapped, scroll locked, the panel fitted
 * above the soft keyboard; the phone Back gesture calls `backCallback`. Escape is left to the grid
 * (Excel: it cancels). The grid moves the focus itself on close (to the cell): call
 * `end({ shouldReturnFocus: false })`.
 */
export function startSheetModal(panel: HTMLElement, backCallback: () => void): ModalSession {
	// Core's sheet chrome + frame into the root the sheet lives in (the grid's shadow root; once per root)
	const root = panel.getRootNode()
	if (root instanceof ShadowRoot || root instanceof Document) adoptStyles(root, SHEET_CHROME_CSS)
	return startModalSession(panel, {
		dismissCallback: (reason) => {
			// 'parent' / 'overlay': the popover the sheet dresses closed (its own close path ends the session)
			if (reason === 'back') backCallback()
		},
		shouldCloseOnEscape: false,
		shouldFitToVisibleViewport: true,
		// The popover the panel belongs to is the session's parent: page overlays close, never that one
		trigger: panel,
		initialFocus: false,
		returnFocusTo: null,
	})
}

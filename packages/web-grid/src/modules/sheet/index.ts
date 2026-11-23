// =============================================================================
// Phone sheet — the cell dropdown and the date editor on a phone
// =============================================================================
// On a phone (core resolvePresentation(): the device class, D-RO-3 = C — no width
// literal) the two cell popups are an edge-to-edge sheet instead of a panel anchored
// under the cell: the same core createPopover(), un-anchored (setAnchored(false)) and
// placed by css/sheet.css (`.wg__dropdown--sheet`, `.wg-datepicker-container--sheet`).
// This module holds what both share: the sheet header — core's sheet chrome (createSheetHeader +
// SHEET_CHROME_CSS: `.km-sheet-header` / `-title` / `-close`, rulebook C-RO-17) with the grid's
// own `wg__sheet-*` classes kept for the layout around it (sticky, the search row) — and the session around an open sheet — page scroll locked (core
// lockBodyScroll), the panel kept above the soft keyboard (core fitToVisibleViewport)
// and the phone Back gesture / button closing the sheet instead of leaving the page
// (core claimBackEntry — one history entry page-wide; rulebook C-RO-15).
//
// Edit semantics are the grid's own (Excel rule): the close button and Back leave the
// cell → SAVE; Escape cancels.

import {
	SHEET_CHROME_CSS,
	adoptStyles,
	claimBackEntry,
	createSheetHeader,
	lockBodyScroll,
	fitToVisibleViewport,
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
 * on its own row. Core's `SHEET_CHROME_CSS` is adopted when the session starts (`startSheetSession`).
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

/** Mark `panel` as a sheet (a modal dialog named by its title) or back as a plain panel. */
export function setSheetSemantics(panel: HTMLElement, title: string | null): void {
	if (title !== null) {
		panel.setAttribute('role', 'dialog')
		panel.setAttribute('aria-modal', 'true')
		panel.setAttribute('aria-label', title)
		panel.tabIndex = -1
	} else {
		panel.removeAttribute('role')
		panel.removeAttribute('aria-modal')
		panel.removeAttribute('aria-label')
		panel.removeAttribute('tabindex')
	}
}

/**
 * Start the session of an open sheet: page scroll locked, `panel` kept above the soft
 * keyboard, the Back gesture calls `back`. Returns the cleanup (idempotent).
 */
export function startSheetSession(panel: HTMLElement, back: () => void): () => void {
	// Core's sheet chrome into the root the sheet lives in (the grid's shadow root; once per root)
	const root = panel.getRootNode()
	if (root instanceof ShadowRoot || root instanceof Document) adoptStyles(root, SHEET_CHROME_CSS)
	const unlock = lockBodyScroll()
	const unobserve = fitToVisibleViewport(panel)
	// A sheet opening right after (the dropdown re-rendered for another cell, a reopened
	// date picker) adopts the entry; the page keeps its scroll position on close
	const releaseBack = claimBackEntry(back)
	let isActive = true
	return () => {
		if (!isActive) return
		isActive = false
		releaseBack()
		unobserve()
		unlock()
	}
}

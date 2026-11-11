// =============================================================================
// Phone sheet — the cell dropdown and the date editor on a phone
// =============================================================================
// On a phone (core resolvePresentation(): the device class, D-RO-3 = C — no width
// literal) the two cell popups are an edge-to-edge sheet instead of a panel anchored
// under the cell: the same core createPopover(), un-anchored (setAnchored(false)) and
// placed by css/sheet.css (`.wg__dropdown--sheet`, `.wg-datepicker-container--sheet`).
// This module holds what both share: the sheet header (title, optional search field,
// close button) and the session around an open sheet — page scroll locked (core
// lockBodyScroll), the panel kept above the soft keyboard (core observeKeyboardInset)
// and the phone Back gesture / button closing the sheet instead of leaving the page.
//
// Edit semantics are the grid's own (Excel rule): the close button and Back leave the
// cell → SAVE; Escape cancels.

import { lockBodyScroll, observeKeyboardInset } from '@keenmate/web-components-core'

/** The close glyph (✕) of the sheet's close button. */
const CLOSE_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'

export interface SheetHeaderOptions {
	/** The sheet's title (the column's title) — also its accessible name. */
	title: string
	/** Accessible name of the close button (`labels.sheetClose`). */
	closeLabel: string
	/** Close button pressed: leave the cell (save). */
	onClose: () => void
	/** A search field (combobox / autocomplete): its placeholder + initial text. */
	search?: { placeholder: string; value: string }
}

/**
 * Build the sheet header: `.wg__sheet-header` with the title, the optional
 * `.wg__sheet-search` input and the `.wg__sheet-close` button.
 */
export function buildSheetHeader(options: SheetHeaderOptions): HTMLElement {
	const header = document.createElement('div')
	header.className = 'wg__sheet-header'

	const title = document.createElement('span')
	title.className = 'wg__sheet-title'
	title.textContent = options.title
	header.appendChild(title)

	const close = document.createElement('button')
	close.type = 'button'
	close.className = 'wg__sheet-close'
	close.setAttribute('aria-label', options.closeLabel)
	close.title = options.closeLabel
	close.innerHTML = CLOSE_ICON
	close.addEventListener('click', (e) => {
		e.preventDefault()
		options.onClose()
	})
	header.appendChild(close)

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

// ── Back gesture ────────────────────────────────────────────────────────────────
// One history entry per open sheet (same URL): the phone Back gesture pops it, which
// closes the sheet instead of navigating away. A sheet closed any other way consumes its
// entry with history.back() — deferred one task, so a sheet opening right after (the
// dropdown re-rendered for another cell, a reopened date picker) adopts the entry
// instead of racing a back() against a new pushState(). Module-level: one sheet at a
// time page-wide.

let isEntryPushed = false
let pendingBack: ReturnType<typeof setTimeout> | null = null
let onBack: (() => void) | null = null

function handlePopstate(): void {
	// Our entry is gone (Back): close the sheet without popping again
	window.removeEventListener('popstate', handlePopstate)
	isEntryPushed = false
	const back = onBack
	onBack = null
	back?.()
}

function claimHistoryEntry(back: () => void): void {
	if (typeof window === 'undefined' || typeof history === 'undefined') return
	if (pendingBack !== null) {
		clearTimeout(pendingBack)
		pendingBack = null
	}
	if (!isEntryPushed) {
		history.pushState({ wgSheet: true }, '')
		isEntryPushed = true
	}
	onBack = back
	window.removeEventListener('popstate', handlePopstate)
	window.addEventListener('popstate', handlePopstate)
}

function releaseHistoryEntry(back: () => void): void {
	if (onBack !== back) return
	onBack = null
	window.removeEventListener('popstate', handlePopstate)
	if (!isEntryPushed || pendingBack !== null) return
	pendingBack = setTimeout(() => {
		pendingBack = null
		// Adopted by a sheet opened meanwhile, or popped by Back already
		if (onBack || !isEntryPushed) return
		isEntryPushed = false
		history.back()
	}, 0)
}

/**
 * Start the session of an open sheet: page scroll locked, `panel` kept above the soft
 * keyboard, the Back gesture calls `back`. Returns the cleanup (idempotent).
 */
export function startSheetSession(panel: HTMLElement, back: () => void): () => void {
	const unlock = lockBodyScroll()
	const unobserve = observeKeyboardInset(panel)
	claimHistoryEntry(back)
	let isActive = true
	return () => {
		if (!isActive) return
		isActive = false
		unobserve()
		unlock()
		releaseHistoryEntry(back)
	}
}

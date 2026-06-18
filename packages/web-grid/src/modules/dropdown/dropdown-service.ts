// =============================================================================
// DropdownService — owns the open-dropdown runtime state
// =============================================================================
// Extracted from GridElement so the Element layer no longer holds UI state.
// Tracks open-state, the visible option list, the highlighted index, the
// filter query, and the race-condition flags that gate blur / focus /
// scroll behavior while a dropdown is open or transitioning.
//
// Why the flags matter:
//   - isOpening      — true between "we're about to render the dropdown" and
//                      "Floating UI finished positioning it". Used by scroll
//                      event subscribers so an auto-triggered scroll during
//                      open doesn't immediately close the dropdown.
//   - isClosingViaToggle — true between mousedown-on-toggle and the next
//                      blur. The focus event manager uses it to skip the
//                      "blur → cancel edit" path so click-on-toggle closes
//                      cleanly without rolling back the edit.
//   - isUserFiltering / justSelected / userInteracted — gate the open/close
//                      and commit flow against the user's typing vs. the
//                      grid's programmatic state changes.

import type { EditorOption } from '../../types.js'

export class DropdownService {
	private _isOpen = false
	private _options: EditorOption[] = []
	private _highlightedIndex = -1
	private _filterText = ''
	private _isUserFiltering = false
	private _justSelected = false
	private _isOpening = false
	private _userInteracted = false
	private _isClosingViaToggle = false

	/** True while a dropdown is rendered and visible. */
	get isOpen(): boolean { return this._isOpen }
	setIsOpen(value: boolean): void { this._isOpen = value }

	/** The current option list (filtered or full, depending on user input). */
	get options(): EditorOption[] { return this._options }
	setOptions(value: EditorOption[]): void { this._options = value }

	/** Index of the highlighted option, or -1 when nothing is highlighted. */
	get highlightedIndex(): number { return this._highlightedIndex }
	setHighlightedIndex(value: number): void { this._highlightedIndex = value }

	/** Current filter text (combobox / autocomplete input value). */
	get filterText(): string { return this._filterText }
	setFilterText(value: string): void { this._filterText = value }

	/** True while the user is actively typing into the filter (vs. programmatic open). */
	get isUserFiltering(): boolean { return this._isUserFiltering }
	setIsUserFiltering(value: boolean): void { this._isUserFiltering = value }

	/** True for one tick after a selection commits, so a follow-up blur doesn't re-open. */
	get justSelected(): boolean { return this._justSelected }
	setJustSelected(value: boolean): void { this._justSelected = value }

	/** True between "starting to render" and "Floating UI positioned"; suppresses scroll-close. */
	get isOpening(): boolean { return this._isOpening }
	setIsOpening(value: boolean): void { this._isOpening = value }

	/** True after arrow keys / hover changed the highlight, so reopen restores the position. */
	get userInteracted(): boolean { return this._userInteracted }
	setUserInteracted(value: boolean): void { this._userInteracted = value }

	/** True between mousedown-on-toggle and the next blur; prevents blur from cancelling the edit. */
	get isClosingViaToggle(): boolean { return this._isClosingViaToggle }
	setIsClosingViaToggle(value: boolean): void { this._isClosingViaToggle = value }

	/**
	 * Reset to a fully-closed, nothing-staged state. Clears the option list,
	 * highlight, filter text, and all race-condition flags. The caller is
	 * responsible for tearing down the rendered DOM before calling this.
	 */
	reset(): void {
		this._isOpen = false
		this._options = []
		this._highlightedIndex = -1
		this._filterText = ''
		this._isUserFiltering = false
		this._justSelected = false
		this._isOpening = false
		this._userInteracted = false
		this._isClosingViaToggle = false
	}
}

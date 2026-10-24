// =============================================================================
// Blur event subscription body
// =============================================================================
// Body for `this.focusEvents.subscribe('blur', ...)`. The focusEvents
// manager already runs the capture-phase blur and applies its own skip
// guard (shouldSkipBlur). This function handles the surviving "internal
// focus change" cases — moving between cells / editors within the grid —
// and delegates to the editor-specific blur helpers.
//
// Cases:
//  - target is .wg__editor--text / --number → handleEditorBlur (commit on
//    blur if shouldCommitOnClickAway).
//  - target is .wg__date-input → commitDateEditor, but only if the
//    datepicker isn't open (the picker manages its own commit-on-pick).
//  - target is .wg__select-trigger → handleSelectBlur (cancel edit when
//    focus leaves the trigger).
//  - target is .wg__combobox-input / .wg__autocomplete-input →
//    handleComboboxBlur (commit-matched-option or raw-text fallback).

import type { GridHost } from '../grid-context.js'
import { handleSelectBlur, handleComboboxBlur } from '../dropdown/index.js'
import { handleEditorBlur } from '../editing/index.js'
import { commitDateEditor } from '../datepicker/index.js'

/**
 * Internal-blur dispatch. Caller guarantees that:
 *  - focusEvents.shouldSkipBlur already returned false
 *  - the new focus target is still inside ctx.shadow (i.e. NOT leaving the
 *    grid — outsideClick owns that cleanup path)
 *
 * Returns nothing; drives commit / cancel side effects via the editor-
 * specific helpers.
 */
export function handleInternalBlur<T>(
	ctx: GridHost<T>,
	target: HTMLElement,
	relatedTarget: HTMLElement | null
): void {
	// Text/number editors
	if (target.matches('.wg__editor--text, .wg__editor--number')) {
		handleEditorBlur(ctx, target as HTMLInputElement)
	}
	// Date input blur - commit if datepicker is not open
	else if (target.matches('.wg__date-input')) {
		if (!ctx.datepicker) {
			commitDateEditor(ctx, target as HTMLInputElement)
		}
	}
	// Select trigger
	else if (target.matches('.wg__select-trigger')) {
		handleSelectBlur(ctx, relatedTarget)
	}
	// Combobox/autocomplete
	else if (target.matches('.wg__combobox-input, .wg__autocomplete-input')) {
		handleComboboxBlur(ctx, target as HTMLInputElement)
	}
}

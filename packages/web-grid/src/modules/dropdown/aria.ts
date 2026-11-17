// =============================================================================
// Dropdown ARIA — combobox + listbox semantics for the cell dropdown
// =============================================================================
// The grid keeps its own keys (editor-keydown moves `highlightedIndex`); core
// createActiveDescendant in ARIA-only mode (`shouldHandleKeys: false`, SPEC §12.25)
// owns `aria-activedescendant`, the option ids and `aria-controls` on the focused
// field (the select trigger / the combobox / autocomplete input). Roles and
// `aria-selected` are the grid's. Scrolling stays scrollHighlightedIntoView().

import { createActiveDescendant, type ActiveDescendant } from '@keenmate/web-components-core/a11y'

interface DropdownAria {
	nav: ActiveDescendant
	field: HTMLElement
}

const wired = new WeakMap<HTMLElement, DropdownAria>()

const optionsOf = (dropdown: HTMLElement): HTMLElement[] => [...dropdown.querySelectorAll<HTMLElement>('.wg__dropdown-option')]

/** The field focus is in while the dropdown is open: the anchor itself, or the input inside it. */
function fieldOf(anchor: HTMLElement): HTMLElement {
	return anchor.matches('input, [role="combobox"]') ? anchor : (anchor.querySelector<HTMLElement>('input') ?? anchor)
}

/** After the options were (re)rendered: roles, `aria-selected`, and the active option. */
export function wireDropdownAria(dropdown: HTMLElement, anchor: HTMLElement, highlightedIndex: number): void {
	// The phone sheet is a dialog (header + options; setSheetSemantics) — not a listbox
	if (dropdown.getAttribute('role') === 'dialog') {
		unwireDropdownAria(dropdown)
		return
	}
	const field = fieldOf(anchor)
	let entry = wired.get(dropdown)
	if (!entry || entry.field !== field) {
		entry?.nav.destroy()
		entry = {
			field,
			nav: createActiveDescendant(field, dropdown, { getItems: () => optionsOf(dropdown), shouldHandleKeys: false, shouldScroll: false })
		}
		wired.set(dropdown, entry)
	}
	dropdown.setAttribute('role', 'listbox')
	field.setAttribute('role', 'combobox')
	field.setAttribute('aria-expanded', 'true')
	if (field instanceof HTMLInputElement) field.setAttribute('aria-autocomplete', 'list')
	for (const option of optionsOf(dropdown)) {
		option.setAttribute('role', 'option')
		option.setAttribute('aria-selected', String(option.classList.contains('wg__dropdown-option--selected')))
		if (option.classList.contains('wg__dropdown-option--disabled')) option.setAttribute('aria-disabled', 'true')
	}
	entry.nav.refresh()
	syncDropdownActive(dropdown, highlightedIndex)
}

/** The highlighted option changed: point `aria-activedescendant` at it (`-1` = none). */
export function syncDropdownActive(dropdown: HTMLElement, highlightedIndex: number): void {
	wired.get(dropdown)?.nav.setActive(highlightedIndex >= 0 ? highlightedIndex : null)
}

/** The dropdown closes: drop `aria-activedescendant`, `aria-expanded="false"`. */
export function unwireDropdownAria(dropdown: HTMLElement): void {
	const entry = wired.get(dropdown)
	if (!entry) return
	entry.nav.destroy()
	entry.field.setAttribute('aria-expanded', 'false')
	wired.delete(dropdown)
}

// =============================================================================
// Controls inside data cells are no tab stops (the grid is ONE tab stop)
// =============================================================================
// Keyboard access to them: navigation/widget-cell.ts (Enter / F2 on the cell).

/** Natively tabbable elements (the ones `tabindex="-1"` takes out of the tab order). */
const TABBABLE = ['a[href]', 'button', 'input', 'select', 'textarea', 'iframe', '[contenteditable="true"]', '[tabindex]']
const CELL_TABBABLE = TABBABLE.map(sel => `td.wg__cell[data-col] ${sel}`).join(', ')

/**
 * Take the controls a cell renderer put into data cells (`renderCellCallback`: links, buttons,
 * inputs) out of the tab order — `tabindex="-1"` + `data-wg-widget` (Enter / F2 on the cell
 * reaches them). The grid's own controls render with `tabindex="-1"` already. `root` = the
 * tbody after a render, or one re-rendered cell.
 */
export function untabCellWidgets(root: ParentNode | null): void {
	if (!root) return
	const isCell = root instanceof HTMLElement && root.matches('td.wg__cell[data-col]')
	const found = isCell ? root.querySelectorAll<HTMLElement>(TABBABLE.join(', ')) : root.querySelectorAll<HTMLElement>(CELL_TABBABLE)
	for (const el of found) {
		if (el.tabIndex < 0 || el.hasAttribute('data-wg-widget')) continue
		el.setAttribute('tabindex', '-1')
		el.setAttribute('data-wg-widget', '')
	}
}

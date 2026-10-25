// =============================================================================
// "Go to row" dialog (Ctrl+G)
// =============================================================================
// Self-contained dialog overlay rendered into the shadow root. Driven from
// cell-keydown's Ctrl+G branch; lets the user jump to a 1-indexed row
// number, validates the bounds, then either:
//
//  - Virtual-scroll mode: programmatic scroll to the target, then a double-
//    RAF focus on the new cell once the virtual range has rendered.
//  - Non-virtual: scrollIntoView({block:'nearest'}) + immediate focus +
//    surgical updateFocusVisual call.
//
// Cancel paths: Cancel button, Escape, click on the overlay backdrop.
// Validation: numeric, in-range, otherwise the input is refocused + selected.

import type { GridHost } from '../grid-context.js'
import { updateFocusVisual, moveFocus } from './focus.js'

/**
 * Render and open the Ctrl+G dialog. `colIndex` is the column the user was
 * in when they invoked the dialog — focus returns to the same column on
 * the target row.
 */
export function showGoToRowDialog<T>(ctx: GridHost<T>, colIndex: number): void {
	const displayItems = ctx.engine.displayItems
	if (displayItems.length === 0) return

	// Create dialog overlay
	const overlay = document.createElement('div')
	overlay.className = 'wg__goto-overlay'
	const labels = ctx.engine.labels
	overlay.innerHTML = `
		<div class="wg__goto-dialog">
			<label class="wg__goto-label">${ctx.escapeHtml(labels.goToRow.replace('{max}', String(displayItems.length)))}</label>
			<input type="number" class="wg__goto-input" min="1" max="${displayItems.length}" value="1" />
			<div class="wg__goto-buttons">
				<button type="button" class="wg__goto-btn wg__goto-btn--cancel">${ctx.escapeHtml(labels.goToRowCancel)}</button>
				<button type="button" class="wg__goto-btn wg__goto-btn--go">${ctx.escapeHtml(labels.goToRowGo)}</button>
			</div>
		</div>
	`

	const input = overlay.querySelector('.wg__goto-input') as HTMLInputElement
	const goBtn = overlay.querySelector('.wg__goto-btn--go') as HTMLButtonElement
	const cancelBtn = overlay.querySelector('.wg__goto-btn--cancel') as HTMLButtonElement

	// The cell focused when the dialog opened — Cancel / Escape / a backdrop click return to it
	const origin = ctx.engine.focusedCell

	const closeDialog = () => {
		overlay.remove()
	}

	const cancelDialog = () => {
		closeDialog()
		if (origin) moveFocus(ctx, origin.rowIndex, origin.colIndex)
	}

	const goToRow = () => {
		const rowNum = parseInt(input.value, 10)
		if (isNaN(rowNum) || rowNum < 1 || rowNum > displayItems.length) {
			input.focus()
			input.select()
			return
		}

		closeDialog()

		// Convert 1-based to 0-based index
		const targetRow = rowNum - 1
		const oldFocus = ctx.engine.focusedCell
		ctx.engine.setFocusedCell(targetRow, colIndex)

		if (ctx.engine.shouldUseVirtualScroll()) {
			// Virtual scroll: scroll to position (programmatic flag prevents redundant handleVirtualScroll)
			ctx.scrollToRowProgrammatically(targetRow)
			// After scroll settles, focus the cell
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					const cell = ctx.shadow.querySelector(
						`td[data-row="${targetRow}"][data-col="${colIndex}"]`
					) as HTMLElement
					cell?.focus()
				})
			})
		} else {
			// Non-virtual: scroll cell into view and focus it
			const cell = ctx.shadow.querySelector(
				`td[data-row="${targetRow}"][data-col="${colIndex}"]`
			) as HTMLElement
			if (cell) {
				cell.scrollIntoView({ block: 'nearest', behavior: 'auto' })
				cell.focus()
				updateFocusVisual(ctx, oldFocus, { rowIndex: targetRow, colIndex })
			}
		}
	}

	// Event handlers
	goBtn.addEventListener('click', goToRow)
	cancelBtn.addEventListener('click', cancelDialog)
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) cancelDialog()
	})
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			goToRow()
		} else if (e.key === 'Escape') {
			e.preventDefault()
			cancelDialog()
		}
	})

	ctx.shadow.appendChild(overlay)
	input.focus()
	input.select()
}

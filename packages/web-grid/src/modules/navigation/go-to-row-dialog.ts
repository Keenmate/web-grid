// =============================================================================
// "Go to row" dialog (Ctrl+G)
// =============================================================================
// Self-contained dialog overlay rendered into the shadow root. Driven from
// cell-keydown's Ctrl+G branch; lets the user jump to a 1-indexed row
// number, validates the bounds, then either:
//
//  - Virtual-scroll mode: programmatic scroll to the target, then a double-
//    RAF focus on the new cell once the virtual range has rendered.
//  - Non-virtual: core scrollIntoContainer (center, gated by beforeScrollCallback) + immediate focus +
//    surgical updateFocusVisual call.
//
// Modal through core startModalSession (SPEC §12.19): the page behind is inert, Tab stays in the dialog,
// the page doesn't scroll; Escape (overlay tree), the phone Back gesture and a click on the overlay
// backdrop cancel. Cancel paths also: the Cancel button. Focus is put back by this module (the origin
// cell, or the target cell), not by the session.
// Validation: numeric, in-range, otherwise the input is refocused + selected.

import { escapeHtml, startModalSession, type ModalSession } from '@keenmate/web-components-core'
import type { GridHost } from '../grid-context.js'
import { updateFocusVisual, moveFocus } from './focus.js'
import { revealElement, scrollRowIntoView, fieldAt, JUMP_SCROLL } from '../scroll/reveal.js'

/**
 * Render and open the Ctrl+G dialog. `colIndex` is the column the user was
 * in when they invoked the dialog — focus returns to the same column on
 * the target row.
 */
export function openGoToRowDialog<T>(ctx: GridHost<T>, colIndex: number): void {
	const displayItems = ctx.engine.displayItems
	if (displayItems.length === 0) return

	// Create dialog overlay
	const overlay = document.createElement('div')
	overlay.className = 'wg__goto-overlay'
	const labels = ctx.engine.labels
	overlay.innerHTML = `
		<div class="wg__goto-dialog">
			<label class="wg__goto-label">${escapeHtml(ctx.engine.labelText('labels.goToRow', { max: displayItems.length }))}</label>
			<input type="number" class="wg__goto-input" min="1" max="${displayItems.length}" value="1" />
			<div class="wg__goto-buttons">
				<button type="button" class="wg__goto-btn wg__goto-btn--cancel">${escapeHtml(labels['buttons.cancel'])}</button>
				<button type="button" class="wg__goto-btn wg__goto-btn--go">${escapeHtml(labels['buttons.go'])}</button>
			</div>
		</div>
	`

	const input = overlay.querySelector('.wg__goto-input') as HTMLInputElement
	const goBtn = overlay.querySelector('.wg__goto-btn--go') as HTMLButtonElement
	const cancelBtn = overlay.querySelector('.wg__goto-btn--cancel') as HTMLButtonElement

	// The cell focused when the dialog opened — Cancel / Escape / a backdrop click return to it
	const origin = ctx.engine.focusedCell

	let session: ModalSession | null = null
	const closeDialog = () => {
		session?.end({ shouldReturnFocus: false })
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
			void scrollRowIntoView(ctx, targetRow, 'go-to-row')
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
				revealElement(ctx, cell, { rowIndex: targetRow, field: fieldAt(ctx, colIndex) }, 'go-to-row', JUMP_SCROLL)
				cell.focus()
				updateFocusVisual(ctx, oldFocus, { rowIndex: targetRow, colIndex })
			}
		}
	}

	// Event handlers
	goBtn.addEventListener('click', goToRow)
	cancelBtn.addEventListener('click', cancelDialog)
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			goToRow()
		}
	})

	ctx.shadow.appendChild(overlay)
	const dialog = overlay.querySelector('.wg__goto-dialog') as HTMLElement
	session = startModalSession(dialog, {
		backdrop: overlay, // the grid's own full-viewport overlay (it centres the dialog)
		initialFocus: input,
		returnFocusTo: null,
		onDismiss: cancelDialog,
		logSource: ctx.shadow.host
	})
	input.select()
}

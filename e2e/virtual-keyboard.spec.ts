import { test, expect, Page, cell, onGrid, gridLocator } from './fixtures'

/**
 * Keyboard moves in a VIRTUAL grid past the rendered window (docs/test/virtual-scroll.html,
 * #editGrid: 1,000 rows x 38px, overscan 5, ~10 rows visible, Name editable).
 *
 * Excel rule: every move lands on its target cell — the grid renders the target's window
 * first, then focuses it. Focus never drops to <body> / the container, `focusedCell` never
 * goes null, and a held key (keydowns faster than frames) moves exactly one row per press.
 * Run in the default dblclick mode (cells get tabindex only when focused) and navigate mode.
 */

const PAGE = '/test/virtual-scroll.html'
const GRID = 'editGrid'

async function gotoGrid(page: Page, editTrigger: string) {
	await page.goto(`${PAGE}?editTrigger=${editTrigger}`)
	await expect(cell(page, GRID, 0, 0)).toBeVisible()
}

/** Focus a rendered cell by clicking it (a single click only focuses in both modes). */
async function focusCell(page: Page, row: number, col: number) {
	await cell(page, GRID, row, col).click()
	await expect(cell(page, GRID, row, col)).toBeFocused()
}

/** The focused cell as (row, col) from the DOM, or null when focus isn't on a body cell. */
async function activeCell(page: Page): Promise<[number, number] | null> {
	return onGrid(page, (el: any) => {
		const a = el.shadowRoot.activeElement as HTMLElement | null
		const td = a?.closest?.('td.wg__cell') as HTMLElement | null
		return td ? [Number(td.dataset.row), Number(td.dataset.col)] : null
	}, GRID)
}

/** The cell (row, col) has DOM focus, is the grid's focused cell and lies inside the scroller (below the header). */
async function expectFocusedInView(page: Page, row: number, col: number) {
	await expect.poll(() => activeCell(page)).toEqual([row, col])
	const state = await gridLocator(page, GRID).evaluate((el: any, [r, c]: number[]) => {
		const root = el.shadowRoot
		const td = root.querySelector(`td[data-row="${r}"][data-col="${c}"]`) as HTMLElement
		const scroller = root.querySelector('.wg') as HTMLElement
		const head = root.querySelector('thead') as HTMLElement
		const tr = td.getBoundingClientRect()
		const sr = scroller.getBoundingClientRect()
		const headBottom = head.getBoundingClientRect().bottom
		return {
			isFocusedClass: td.classList.contains('wg__cell--focused'),
			isInView: tr.top >= headBottom - 1 && tr.bottom <= sr.top + scroller.clientHeight + 1
		}
	}, [row, col])
	expect(state).toEqual({ isFocusedClass: true, isInView: true })
}

for (const editTrigger of ['dblclick', 'navigate']) test.describe(`virtual grid (${editTrigger}) — keyboard moves past the rendered window`, () => {
	test('ArrowDown pressed one by one walks past the window, focus stays on the target', async ({ page }) => {
		// Navigate mode: its cells are focusable by markup, so the late (scroll-event) render
		// refocused them — the held-key test below pins that mode
		test.skip(editTrigger === 'navigate', 'pinned by the held-key test in navigate mode')
		await gotoGrid(page, editTrigger)
		await focusCell(page, 0, 1)
		for (let i = 1; i <= 40; i++) {
			await page.keyboard.press('ArrowDown')
			await expect.poll(() => activeCell(page)).toEqual([i, 1])
		}
		await expectFocusedInView(page, 40, 1)
		// ...and back up past the top of the (now scrolled) window
		for (let i = 39; i >= 0; i--) {
			await page.keyboard.press('ArrowUp')
			await expect.poll(() => activeCell(page)).toEqual([i, 1])
		}
		await expectFocusedInView(page, 0, 1)
	})

	test('a held ArrowDown (keydowns faster than frames) moves exactly one row per press', async ({ page }) => {
		await gotoGrid(page, editTrigger)
		await focusCell(page, 0, 1)
		// 60 keydowns in one task — no frame, no scroll event in between
		await onGrid(page, (el: any) => {
			for (let i = 0; i < 60; i++) {
				const target = el.shadowRoot.activeElement as HTMLElement
				target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true }))
			}
		}, GRID)
		await expectFocusedInView(page, 60, 1)
		await onGrid(page, (el: any) => {
			for (let i = 0; i < 60; i++) {
				const target = el.shadowRoot.activeElement as HTMLElement
				target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true, cancelable: true }))
			}
		}, GRID)
		await expectFocusedInView(page, 0, 1)
	})

	test('PageDown / PageUp move 10 rows each, past the window', async ({ page }) => {
		await gotoGrid(page, editTrigger)
		await focusCell(page, 0, 2)
		for (let i = 1; i <= 5; i++) {
			await page.keyboard.press('PageDown')
			await expectFocusedInView(page, i * 10, 2)
		}
		await page.keyboard.press('PageUp')
		await expectFocusedInView(page, 40, 2)
	})

	test('Ctrl+End / Ctrl+Home jump to the last / first cell', async ({ page }) => {
		await gotoGrid(page, editTrigger)
		await focusCell(page, 2, 1)
		await page.keyboard.press('Control+End')
		await expectFocusedInView(page, 999, 3)
		await page.keyboard.press('Control+Home')
		await expectFocusedInView(page, 0, 0)
	})

	test('Home / End on a row scrolled out of the window keep the row', async ({ page }) => {
		await gotoGrid(page, editTrigger)
		await focusCell(page, 0, 1)
		await page.keyboard.press('Control+PageDown')
		await expectFocusedInView(page, 999, 1)
		await page.keyboard.press('Home')
		await expectFocusedInView(page, 999, 0)
		await page.keyboard.press('End')
		await expectFocusedInView(page, 999, 3)
	})

	test('Shift+ArrowDown extends the range past the window; the anchor keeps focus and the corner is shown', async ({ page }) => {
		await gotoGrid(page, editTrigger)
		await focusCell(page, 0, 1)
		for (let i = 0; i < 30; i++) await page.keyboard.press('Shift+ArrowDown')
		const range = await onGrid(page, (el: any) => el.selectedCellRange, GRID)
		expect(range).toMatchObject({ startRowIndex: 0, endRowIndex: 30 })
		// The free corner is rendered and in view
		await expect(cell(page, GRID, 30, 1)).toBeInViewport()
		await expect.poll(() => onGrid(page, (el: any) => {
			const root = el.shadowRoot
			const td = root.querySelector('td[data-row="30"][data-col="1"]') as HTMLElement | null
			const scroller = root.querySelector('.wg') as HTMLElement
			if (!td) return false
			const r = td.getBoundingClientRect()
			const s = scroller.getBoundingClientRect()
			return r.bottom <= s.top + scroller.clientHeight + 1 && r.top >= s.top
		}, GRID)).toBe(true)
		// The anchor still owns the keyboard: one more Shift+ArrowUp shrinks the range by one
		await page.keyboard.press('Shift+ArrowUp')
		await expect.poll(() => onGrid(page, (el: any) => el.selectedCellRange?.endRowIndex, GRID)).toBe(29)
	})

	test('Enter in edit mode saves and moves down past the window — focus lands on the next row', async ({ page }) => {
		test.skip(editTrigger === 'navigate', 'Enter-in-edit is mode independent; dblclick pins it')
		await gotoGrid(page, editTrigger)
		// F2, type, Enter (save + move down) x 25 — the rows past the window included; the saved
		// value is the row's draft
		await focusCell(page, 0, 1)
		let row = 0
		for (let i = 0; i < 25; i++) {
			await page.keyboard.press('F2')
			await page.keyboard.press('Control+A')
			await page.keyboard.type(`Edited ${row}`)
			await page.keyboard.press('Enter')
			row++
			await expectFocusedInView(page, row, 1)
		}
		const names = await onGrid(page, (el: any) => el.items.slice(0, 25).map((it: any, i: number) => (el.getRowDraft(i) ?? it).name), GRID)
		expect(names).toEqual(Array.from({ length: 25 }, (_, i) => `Edited ${i}`))
	})
})

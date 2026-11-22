import { test, expect, type Page, cell, onGrid, gridLocator, waitForRows } from './fixtures'

/**
 * The grid is ONE tab stop (ARIA grid pattern, roving tabindex) in EVERY editTrigger mode, and
 * controls inside body cells are no tab stops of their own: the inline row actions, the
 * row-toolbar trigger (actions column), `editTrigger: 'always'` editors and `renderCellCallback`
 * controls are `tabindex="-1"`; Enter / F2 on the cell moves into them, Tab / Shift+Tab cycle
 * them, Escape returns to the cell.
 *
 * Fixture: test/tab-stop.html — grids between buttons #b0 … #b6, 6 rows each
 * ({ id, name 'Row N', status 'open', qty }):
 *  - #widgetGrid (navigate): inline actions ping · pong; col 0=id 1=name 2=status ('always'
 *    select) 3=link (renderCellCallback: <a class="open"> + <button class="go">);
 *  - #buttonGrid (navigate): toolbarTrigger 'button' (actions column) ping · delete; col 0=id 1=name 2=qty;
 *  - #dblclickGrid / #clickGrid / #readonlyGrid (preset read-only) / #matrixGrid (preset input-matrix):
 *    col 0=id (read-only) 1=name 2=qty.
 */

const PAGE = '/test/tab-stop.html'

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	for (const id of ['widgetGrid', 'buttonGrid', 'dblclickGrid', 'clickGrid', 'readonlyGrid', 'matrixGrid']) await waitForRows(page, id)
})

/** Every element in the grid's tbody that Tab can land on (tabIndex >= 0), as a short description. */
const tabbables = (page: Page, id: string) => onGrid(page, (el: any) =>
	[...el.shadowRoot.querySelectorAll('tbody *')]
		.filter((n: HTMLElement) => n.tabIndex >= 0 && !(n as HTMLButtonElement).disabled)
		.map((n: HTMLElement) => n.matches('td') ? `td ${n.dataset.row ?? n.dataset.widgetRow},${n.dataset.col ?? 'lead'}` : n.tagName.toLowerCase()), id)

/** The grid's focused element, described: 'td r,c' / 'lead r' / 'button:<id|class>' / 'a' / 'editor r,c' / '' (focus not in the grid). */
const gridFocus = (page: Page, id: string) => onGrid(page, (el: any) => {
	const a = el.shadowRoot.activeElement as HTMLElement | null
	if (!a) return ''
	if (a.matches('td.wg__widget-cell')) return `lead ${a.dataset.widgetRow}`
	if (a.matches('td.wg__cell')) return `td ${a.dataset.row},${a.dataset.col}`
	const td = a.closest('td.wg__cell') as HTMLElement | null
	if (a.matches('.wg__select-trigger, .wg__editor, .wg__editor *')) return `editor ${td?.dataset.row},${td?.dataset.col}`
	if (a.tagName === 'BUTTON') return `button:${a.dataset.id ?? a.dataset.action ?? a.className.split(' ')[0]}`
	return a.tagName.toLowerCase()
}, id)

/** id of the focused light-DOM element ('' = none). */
const pageFocus = (page: Page) => page.evaluate(() => document.activeElement?.id ?? '')

const focusedCell = (page: Page, id: string) => onGrid(page, (el: any) => {
	const f = el.engine.focusedCell
	return f ? [f.rowIndex, f.colIndex] : null
}, id)

test.describe('controls inside cells are no tab stops (#widgetGrid, navigate)', () => {
	test('the tbody has exactly one tab stop; Tab enters on it and the next Tab leaves the grid', async ({ page }) => {
		expect(await tabbables(page, 'widgetGrid')).toEqual(['td 0,0'])
		const markup = await onGrid(page, (el: any) => ({
			inline: [...el.shadowRoot.querySelectorAll('.wg__inline-action-btn')].every((b: HTMLElement) => b.getAttribute('tabindex') === '-1'),
			always: [...el.shadowRoot.querySelectorAll('.wg__select-trigger')].every((b: HTMLElement) => b.getAttribute('tabindex') === '-1'),
			rendered: [...el.shadowRoot.querySelectorAll('td[data-col="3"] a, td[data-col="3"] button')]
				.every((b: HTMLElement) => b.getAttribute('tabindex') === '-1' && b.hasAttribute('data-wg-widget'))
		}), 'widgetGrid')
		expect(markup).toEqual({ inline: true, always: true, rendered: true })
		await page.locator('#b0').focus()
		await page.keyboard.press('Tab')
		expect(await gridFocus(page, 'widgetGrid')).toBe('td 0,0')
		await page.keyboard.press('Tab')
		expect(await pageFocus(page)).toBe('b1')
		await page.keyboard.press('Shift+Tab')
		expect(await gridFocus(page, 'widgetGrid')).toBe('td 0,0')
	})

	test('inline actions: ArrowLeft enters the actions cell, Enter / F2 into its buttons, Tab cycles them, Escape back to the cell', async ({ page }) => {
		await cell(page, 'widgetGrid', 1, 0).click()
		await page.keyboard.press('ArrowLeft')
		expect(await gridFocus(page, 'widgetGrid')).toBe('lead 1')
		expect(await tabbables(page, 'widgetGrid')).toEqual(['td 1,lead'])   // the actions cell is the stop now
		await page.keyboard.press('Enter')
		expect(await gridFocus(page, 'widgetGrid')).toBe('button:ping')
		await page.keyboard.press('Tab')
		expect(await gridFocus(page, 'widgetGrid')).toBe('button:pong')
		await page.keyboard.press('Tab')
		expect(await gridFocus(page, 'widgetGrid')).toBe('button:ping')   // cycles inside the cell
		await page.keyboard.press('Shift+Tab')
		expect(await gridFocus(page, 'widgetGrid')).toBe('button:pong')
		await page.keyboard.press('Enter')
		await expect.poll(() => page.evaluate(() => (window as any).__actions)).toEqual([['widgetGrid', 'pong', 2]])
		await page.keyboard.press('Escape')
		expect(await gridFocus(page, 'widgetGrid')).toBe('lead 1')
		await page.keyboard.press('F2')
		expect(await gridFocus(page, 'widgetGrid')).toBe('button:ping')
		await page.keyboard.press('Escape')
		// arrows through the actions column, ArrowRight back to the data cells
		await page.keyboard.press('ArrowDown')
		expect(await gridFocus(page, 'widgetGrid')).toBe('lead 2')
		await page.keyboard.press('ArrowRight')
		expect(await gridFocus(page, 'widgetGrid')).toBe('td 2,0')
		expect(await focusedCell(page, 'widgetGrid')).toEqual([2, 0])
	})

	test('Tab from the actions cell leaves the grid; Shift+Tab comes back to it', async ({ page }) => {
		await cell(page, 'widgetGrid', 3, 0).click()
		await page.keyboard.press('ArrowLeft')
		await page.keyboard.press('Tab')
		expect(await pageFocus(page)).toBe('b1')
		await page.keyboard.press('Shift+Tab')
		expect(await gridFocus(page, 'widgetGrid')).toBe('lead 3')
	})

	test("an 'always' editor: arrows land in it, Escape returns to the cell, Tab then leaves, Enter goes back in", async ({ page }) => {
		await cell(page, 'widgetGrid', 1, 1).click()
		await page.keyboard.press('ArrowRight')
		expect(await gridFocus(page, 'widgetGrid')).toBe('editor 1,2')
		await page.keyboard.press('Escape')   // closes the dropdown that opened on arrival (focus stays in the editor)
		expect(await gridFocus(page, 'widgetGrid')).toBe('editor 1,2')
		await page.keyboard.press('Escape')   // nothing left to close: back to the cell
		expect(await gridFocus(page, 'widgetGrid')).toBe('td 1,2')
		await page.keyboard.press('Tab')
		expect(await pageFocus(page)).toBe('b1')
		await page.keyboard.press('Shift+Tab')
		expect(await gridFocus(page, 'widgetGrid')).toBe('td 1,2')
		await page.keyboard.press('Enter')
		expect(await gridFocus(page, 'widgetGrid')).toBe('editor 1,2')
	})

	test('renderCellCallback controls: Enter on the (read-only) cell into the first, Tab cycles, Escape back', async ({ page }) => {
		await cell(page, 'widgetGrid', 1, 1).click()
		await page.keyboard.press('ArrowRight')   // the 'always' select (1,2) — its dropdown opens on arrival
		await page.keyboard.press('Escape')       // closes it
		await page.keyboard.press('ArrowRight')   // the link cell (1,3)
		expect(await gridFocus(page, 'widgetGrid')).toBe('td 1,3')
		await page.keyboard.press('Enter')
		expect(await gridFocus(page, 'widgetGrid')).toBe('a')
		await page.keyboard.press('Tab')
		expect(await gridFocus(page, 'widgetGrid')).toBe('button:2')   // the row's "go" button (data-id)
		await page.keyboard.press('Enter')
		await expect.poll(() => page.evaluate(() => (window as any).__widgets)).toEqual([2])
		await page.keyboard.press('Tab')
		expect(await gridFocus(page, 'widgetGrid')).toBe('a')
		await page.keyboard.press('Escape')
		expect(await gridFocus(page, 'widgetGrid')).toBe('td 1,3')
		expect(await focusedCell(page, 'widgetGrid')).toEqual([1, 3])
	})

	test('mouse: an inline action button still fires on click', async ({ page }) => {
		await gridLocator(page, 'widgetGrid').locator('td.wg__inline-actions-cell').nth(4).locator('[data-id="ping"]').click()
		await expect.poll(() => page.evaluate(() => (window as any).__actions)).toEqual([['widgetGrid', 'ping', 5]])
	})
})

test.describe('the row-toolbar trigger (#buttonGrid, actions column)', () => {
	test('not a tab stop; ArrowLeft → actions cell, Enter → the trigger, Enter opens the toolbar, Escape back', async ({ page }) => {
		expect(await tabbables(page, 'buttonGrid')).toEqual(['td 0,0'])
		await page.locator('#b1').focus()
		await page.keyboard.press('Tab')
		expect(await gridFocus(page, 'buttonGrid')).toBe('td 0,0')
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('ArrowLeft')
		expect(await gridFocus(page, 'buttonGrid')).toBe('lead 1')
		await page.keyboard.press('Enter')
		expect(await gridFocus(page, 'buttonGrid')).toBe('button:wg__toolbar-trigger')
		await page.keyboard.press('Enter')
		await expect(gridLocator(page, 'buttonGrid').locator('.wg__toolbar-container .wg__toolbar')).toHaveCount(1)
		await page.keyboard.press('Escape')   // closes the toolbar (focus stays on the trigger)
		await expect(gridLocator(page, 'buttonGrid').locator('.wg__toolbar-container .wg__toolbar')).toHaveCount(0)
		expect(await gridFocus(page, 'buttonGrid')).toBe('button:wg__toolbar-trigger')
		await page.keyboard.press('Escape')
		expect(await gridFocus(page, 'buttonGrid')).toBe('lead 1')
		await page.keyboard.press('Tab')
		expect(await pageFocus(page)).toBe('b2')
	})
})

for (const [id, before, after] of [
	['dblclickGrid', 'b2', 'b3'],
	['clickGrid', 'b3', 'b4'],
	['readonlyGrid', 'b4', 'b5']
] as const) {
	test.describe(`every editTrigger is navigable — #${id}`, () => {
		test('one tab stop: Tab enters on the first cell, arrows move it, Tab leaves, Shift+Tab comes back', async ({ page }) => {
			expect(await tabbables(page, id)).toEqual(['td 0,0'])
			await page.locator(`#${before}`).focus()
			await page.keyboard.press('Tab')
			expect(await gridFocus(page, id)).toBe('td 0,0')
			expect(await focusedCell(page, id)).toEqual([0, 0])
			await page.keyboard.press('ArrowDown')
			await page.keyboard.press('ArrowRight')
			expect(await gridFocus(page, id)).toBe('td 1,1')
			expect(await focusedCell(page, id)).toEqual([1, 1])
			expect(await tabbables(page, id)).toEqual(['td 1,1'])
			await expect(gridLocator(page, id).locator('tbody input')).toHaveCount(0)   // navigating opens no editor
			await page.keyboard.press('Tab')
			expect(await pageFocus(page)).toBe(after)
			await page.keyboard.press('Shift+Tab')
			expect(await gridFocus(page, id)).toBe('td 1,1')
			await page.keyboard.press('Shift+Tab')
			expect(await pageFocus(page)).toBe(before)
		})
	})
}

test.describe('every editTrigger is navigable — editor opening stays per trigger', () => {
	test('dblclick: F2 opens the editor on the keyboard-focused cell; Tab in the editor saves + moves (focus stays in the grid)', async ({ page }) => {
		await page.locator('#b2').focus()
		await page.keyboard.press('Tab')
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('F2')
		await expect(cell(page, 'dblclickGrid', 0, 1).locator('input')).toBeFocused()
		await page.keyboard.press('Tab')
		expect(await focusedCell(page, 'dblclickGrid')).toEqual([0, 2])
	})

	test('click: a single click still opens the editor', async ({ page }) => {
		await cell(page, 'clickGrid', 2, 1).click()
		await expect(cell(page, 'clickGrid', 2, 1).locator('input')).toBeFocused()
	})
})

test.describe("input-matrix (editTrigger 'always' everywhere — #matrixGrid)", () => {
	test('editors are no tab stops; arrows walk the editors, Escape → the cell, Tab leaves', async ({ page }) => {
		expect(await tabbables(page, 'matrixGrid')).toEqual(['td 0,0'])
		await page.locator('#b5').focus()
		await page.keyboard.press('Tab')
		expect(await gridFocus(page, 'matrixGrid')).toBe('td 0,0')
		await page.keyboard.press('ArrowRight')
		expect(await gridFocus(page, 'matrixGrid')).toBe('editor 0,1')
		await page.keyboard.press('ArrowDown')
		expect(await gridFocus(page, 'matrixGrid')).toBe('editor 1,1')
		await page.keyboard.press('Escape')
		expect(await gridFocus(page, 'matrixGrid')).toBe('td 1,1')
		await page.keyboard.press('Tab')
		expect(await pageFocus(page)).toBe('b6')
		await page.keyboard.press('Shift+Tab')
		expect(await gridFocus(page, 'matrixGrid')).toBe('td 1,1')
		await page.keyboard.press('F2')
		expect(await gridFocus(page, 'matrixGrid')).toBe('editor 1,1')
	})
})

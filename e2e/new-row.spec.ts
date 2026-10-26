import { test, expect, type Page, gridLocator, cell, onGrid, domEvents, clearEvents, waitForRows, editorIn } from './fixtures'

/**
 * New (empty) row — `isNewRowEnabled`, `newRowPosition`, `newRowIndicator`,
 * `createEmptyRowCallback` (the empty row's initial values), `createRowCallback`
 * (rows created by a paste past the last row).
 *
 * Fixture: docs/test/new-row.html — Alpha, Beta + the empty row (bottom);
 * cols 0=id (read-only), 1=name, 2=qty.
 */

const PAGE = '/test/new-row.html'

const rows = (page: Page) => gridLocator(page).locator('tbody tr.wg__row')
const emptyRow = (page: Page) => gridLocator(page).locator('tr.wg__row--empty-row')
const names = (page: Page) => onGrid(page, el => el.items.map((r: any) => r.name))

async function typeInto(page: Page, r: number, c: number, text: string, key: string) {
	await cell(page, r, c).click()
	await page.keyboard.press('F2')
	await expect(editorIn(cell(page, r, c))).toBeVisible()
	await editorIn(cell(page, r, c)).fill(text)
	await page.keyboard.press(key)
}

async function pasteText(page: Page, text: string) {
	await gridLocator(page).evaluate(async (el, txt) => {
		const dt = new DataTransfer()
		dt.setData('text', txt)
		const event = new Event('paste', { bubbles: true, cancelable: true })
		Object.defineProperty(event, 'clipboardData', { value: dt })
		el.dispatchEvent(event)
		await new Promise(r => setTimeout(r, 100))
	}, text)
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await clearEvents(page, 'new-row')
})

test('the empty row renders last with the "+" indicator; it is not in items', async ({ page }) => {
	await expect(rows(page)).toHaveCount(3)
	await expect(emptyRow(page)).toHaveAttribute('data-row-index', '2')
	await expect(emptyRow(page).locator('.wg__empty-row-indicator')).toHaveText('+')
	expect(await onGrid(page, el => [el.items.length, el.displayItems.length])).toEqual([2, 3])
})

test('newRowIndicator / newRowPosition (attributes) restyle and move the row', async ({ page }) => {
	await onGrid(page, el => { el.setAttribute('new-row-indicator', '*'); el.setAttribute('new-row-position', 'top') })
	await expect(emptyRow(page)).toHaveAttribute('data-row-index', '0')
	await expect(emptyRow(page).locator('.wg__empty-row-indicator')).toHaveText('*')
	await expect(cell(page, 1, 1)).toHaveText('Alpha')
})

test('isNewRowEnabled=false removes it (attribute removal)', async ({ page }) => {
	await onGrid(page, el => el.removeAttribute('is-new-row-enabled'))
	await expect(rows(page)).toHaveCount(2)
	await expect(emptyRow(page)).toHaveCount(0)
})

test('Tab within the empty row keeps a draft; Enter commits it into items with a row-change', async ({ page }) => {
	await typeInto(page, 2, 1, 'Gamma', 'Tab')
	expect(await names(page)).toEqual(['Alpha', 'Beta'])  // not yet committed
	await expect(cell(page, 2, 1)).toHaveText('Gamma')
	await typeInto(page, 2, 2, '30', 'Enter')
	await expect.poll(() => names(page)).toEqual(['Alpha', 'Beta', 'Gamma'])
	expect(await onGrid(page, el => el.items[2])).toEqual({ id: null, name: 'Gamma', qty: 30 })
	await expect(rows(page)).toHaveCount(4)  // a fresh empty row follows
	await expect(emptyRow(page)).toHaveAttribute('data-row-index', '3')
	const ev = (await domEvents(page, 'row-change')).at(-1)
	expect(ev).toMatchObject({ rowIndex: 2, field: 'qty', oldValue: null, newValue: 30, isValid: true, row: { name: 'Gamma', qty: 30 } })
})

test('after Enter commits the row, focus is on the fresh empty row (same column)', async ({ page }) => {
	await typeInto(page, 2, 1, 'Gamma', 'Enter')
	await expect.poll(() => names(page)).toEqual(['Alpha', 'Beta', 'Gamma'])
	await expect(cell(page, 3, 1)).toBeFocused()
	await page.keyboard.press('d')
	await expect(editorIn(cell(page, 3, 1))).toHaveValue('d')
})

test('Tab on the last editable cell commits the row too', async ({ page }) => {
	await typeInto(page, 2, 1, 'Gamma', 'Tab')
	await typeInto(page, 2, 2, '31', 'Tab')
	await expect.poll(() => names(page)).toEqual(['Alpha', 'Beta', 'Gamma'])
})

test('Enter on an untouched empty row adds nothing', async ({ page }) => {
	await typeInto(page, 2, 1, '', 'Enter')
	await page.waitForTimeout(100)
	expect(await names(page)).toEqual(['Alpha', 'Beta'])
})

test("newRowPosition 'top': a committed row is inserted at the top", async ({ page }) => {
	await onGrid(page, el => { el.newRowPosition = 'top' })
	await typeInto(page, 0, 1, 'Zero', 'Enter')
	await expect.poll(() => names(page)).toEqual(['Zero', 'Alpha', 'Beta'])
	await expect(emptyRow(page)).toHaveAttribute('data-row-index', '0')
})

test('createEmptyRowCallback seeds the empty row (and is used for the next one)', async ({ page }) => {
	await onGrid(page, el => {
		let n = 100
		el.createEmptyRowCallback = (ctx: any) => ({ id: ++n, name: '', qty: 1, hasController: !!ctx.controller })
		el.isNewRowEnabled = false
		el.isNewRowEnabled = true  // reset the cached empty row
	})
	await expect(cell(page, 2, 0)).toHaveText('101')
	await expect(cell(page, 2, 2)).toHaveText('1')
	await typeInto(page, 2, 1, 'Seeded', 'Enter')
	await expect.poll(() => onGrid(page, el => el.items[2])).toEqual({ id: 101, name: 'Seeded', qty: 1, hasController: true })
	await expect(cell(page, 3, 0)).toHaveText('102')
})

test('createRowCallback shapes rows created by a paste past the last row', async ({ page }) => {
	await onGrid(page, el => {
		el.isNewRowEnabled = false
		el.createRowCallback = (ctx: any) => ({ id: 900 + ctx.rowIndex, ...ctx.data, viaCallback: !!ctx.controller })
	})
	await cell(page, 1, 1).click()
	await pasteText(page, 'Beta2\t21\nGamma\t30\nDelta\t40')
	await expect.poll(() => onGrid(page, el => el.items.length)).toBe(4)
	const state = await onGrid(page, el => ({
		draft: el.getRowDraft(1),
		created: el.items.slice(2).map((r: any) => ({ id: r.id, name: r.name, via: r.viaCallback }))
	}))
	// the existing row is edited through its draft; the new rows come from createRowCallback
	expect(state.draft).toMatchObject({ id: 2, name: 'Beta2' })
	expect(state.created).toEqual([{ id: 902, name: 'Gamma', via: true }, { id: 903, name: 'Delta', via: true }])
	expect((await domEvents(page, 'paste-complete'))[0]).toMatchObject({ newRowsCreated: 2 })
})

test('rows created by a paste get typed values (number column → number)', async ({ page }) => {
	await onGrid(page, el => { el.isNewRowEnabled = false })
	await cell(page, 1, 1).click()
	await pasteText(page, 'Beta2\t21\nGamma\t30')
	await expect.poll(() => onGrid(page, el => el.items.length)).toBe(3)
	expect(await onGrid(page, el => [typeof el.getRowDraft(1).qty, typeof el.items[2].qty])).toEqual(['number', 'number'])
})

test('a single-cell paste into a number column is typed; non-numbers stay text (NOTES.md #18)', async ({ page }) => {
	await onGrid(page, el => { el.isNewRowEnabled = false })
	await cell(page, 0, 2).click()
	await pasteText(page, ' 42 ')
	await expect.poll(() => onGrid(page, el => el.getRowDraft(0)?.qty)).toBe(42)
	await pasteText(page, '1e3x')
	await expect.poll(() => onGrid(page, el => el.getRowDraft(0)?.qty)).toBe('1e3x')
})

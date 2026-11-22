import { test, expect, type Page, cell, gridLocator, waitForRows } from './fixtures'

/**
 * Excel parity in every editTrigger mode: a focused editable cell (not editing) takes
 *  - a printable key → editing starts with that key (an 'always' cell too, after Escape put focus on the cell)
 *  - a paste (Ctrl+V) → the pasted text is committed (a dropdown's option label → its value)
 * A read-only grid takes neither; a disabled grid has no focused cell.
 *
 * Fixture: test/type-paste.html — one grid per mode; cols 0 = id (read-only), 1 = name (text),
 * 2 = status (select a→Active / p→Paused); rows Alice / Bob. The spec never touches the real
 * clipboard: a paste is a dispatched `paste` event carrying a DataTransfer (as paste.spec.ts).
 */

const PAGE = '/test/type-paste.html'
const EDITABLE_MODES = ['navigate', 'click', 'dblclick', 'button'] as const

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page, 'navigateGrid')
})

/** Focus cell (row, col) WITHOUT starting an edit: click the read-only id cell, then arrow right. */
async function focusCell(page: Page, gridId: string, row: number, col: number) {
	await cell(page, gridId, row, 0).click()
	for (let c = 0; c < col; c++) await page.keyboard.press('ArrowRight')
	await expect(cell(page, gridId, row, col)).toBeFocused()
}

/** A paste event with `text` on the grid host (where the grid listens), settled. */
async function paste(page: Page, gridId: string, text: string) {
	await gridLocator(page, gridId).evaluate(async (el: any, txt) => {
		const dt = new DataTransfer()
		dt.setData('text', txt)
		const event = new Event('paste', { bubbles: true, cancelable: true })
		Object.defineProperty(event, 'clipboardData', { value: dt })
		el.dispatchEvent(event)
		await el.whenSettled()
	}, text)
}

const value = (page: Page, gridId: string, row: number, field: string) =>
	gridLocator(page, gridId).evaluate((el: any, [r, f]) => (el.getRowDraft(r) ?? el.items[r])[f], [row, field] as const)
/** The cell's shown text (without the button-mode ✎ edit button). */
const shown = (page: Page, gridId: string, row: number, col: number) => cell(page, gridId, row, col).locator('.wg__cell-text, .wg__select-value')

for (const mode of EDITABLE_MODES) {
	test.describe(`${mode} mode`, () => {
		const id = `${mode}Grid`

		test('typing on a focused cell starts editing with that key', async ({ page }) => {
			await focusCell(page, id, 0, 1)
			await page.keyboard.press('X')
			const editor = cell(page, id, 0, 1).locator('input.wg__editor')
			await expect(editor).toBeFocused()
			await expect(editor).toHaveValue('X')
			await page.keyboard.type('ena')
			await page.keyboard.press('Enter')
			await expect(shown(page, id, 0, 1)).toHaveText('Xena')
		})

		test('Ctrl+V pastes into the focused cell (a dropdown label → its value)', async ({ page }) => {
			await focusCell(page, id, 1, 1)
			await paste(page, id, 'Zed')
			await expect(shown(page, id, 1, 1)).toHaveText('Zed')

			await page.keyboard.press('ArrowRight')
			await expect(cell(page, id, 1, 2)).toBeFocused()
			await paste(page, id, 'Active')
			await expect(shown(page, id, 1, 2)).toHaveText('Active')
			expect(await value(page, id, 1, 'status')).toBe('a')
		})

		test('a read-only cell takes neither', async ({ page }) => {
			await focusCell(page, id, 0, 0)
			await page.keyboard.press('X')
			await paste(page, id, '99')
			await expect(cell(page, id, 0, 0)).toHaveText('1')
			expect(await page.evaluate(() => (window as any).__edits)).toEqual([])
		})
	})
}

test.describe("'always' mode", () => {
	test('Escape → the cell; a typed key goes back into the editor, replacing its text', async ({ page }) => {
		await cell(page, 'alwaysGrid', 0, 0).click()
		await expect(cell(page, 'alwaysGrid', 0, 0)).toBeFocused()  // a read-only 'always' cell takes the focus itself
		await page.keyboard.press('ArrowRight')
		const editor = cell(page, 'alwaysGrid', 0, 1).locator('.wg__editor')
		await expect(editor).toBeFocused()
		await page.keyboard.press('Escape')
		await expect(cell(page, 'alwaysGrid', 0, 1)).toBeFocused()
		await page.keyboard.press('Q')
		await expect(editor).toBeFocused()
		await expect(editor).toHaveValue('Q')
		await page.keyboard.press('Enter')
		expect(await value(page, 'alwaysGrid', 0, 'name')).toBe('Q')
	})

	test('a typed key on a select cell (after Escape) goes to its trigger: the dropdown opens', async ({ page }) => {
		await cell(page, 'alwaysGrid', 0, 0).click()
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('Escape')
		await expect(cell(page, 'alwaysGrid', 0, 2)).toBeFocused()
		await page.keyboard.press('p')
		await expect(gridLocator(page, 'alwaysGrid').locator('.wg__dropdown')).toBeVisible()
		await expect(cell(page, 'alwaysGrid', 0, 2).locator('.wg__select-trigger')).toBeFocused()
	})

	test('a paste on the cell (after Escape) commits; a paste inside the editor stays the editor\'s', async ({ page }) => {
		await cell(page, 'alwaysGrid', 1, 0).click()
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('Escape')
		await expect(cell(page, 'alwaysGrid', 1, 1)).toBeFocused()
		await paste(page, 'alwaysGrid', 'Zed')
		await expect.poll(() => value(page, 'alwaysGrid', 1, 'name')).toBe('Zed')
		await expect(cell(page, 'alwaysGrid', 1, 1).locator('.wg__editor')).toHaveValue('Zed')
	})
})

// The key that starts an edit on a number cell follows the grid's locale (the same settings the typed text
// is parsed with): its decimal separator, a digit, a minus; `.` only where it isn't the group separator.
test.describe('number cells: the locale decimal separator starts an edit', () => {
	test("cs: ',' starts editing; ',5' commits 0.5", async ({ page }) => {
		await focusCell(page, 'csNumbers', 0, 1)
		await page.keyboard.press(',')
		const editor = cell(page, 'csNumbers', 0, 1).locator('input.wg__editor')
		await expect(editor).toBeFocused()
		await expect(editor).toHaveValue(',')
		await page.keyboard.type('5')
		await page.keyboard.press('Enter')
		expect(await value(page, 'csNumbers', 0, 'qty')).toBe(0.5)
	})

	test("de: ',' starts editing; '.' (the group separator) and a letter do nothing", async ({ page }) => {
		await focusCell(page, 'deNumbers', 0, 1)
		await page.keyboard.press('.')
		await page.keyboard.press('x')
		await expect(cell(page, 'deNumbers', 0, 1)).toBeFocused()
		expect(await page.evaluate(() => (window as any).__edits)).toEqual([])
		await page.keyboard.press(',')
		await expect(cell(page, 'deNumbers', 0, 1).locator('input.wg__editor')).toHaveValue(',')
		expect(await page.evaluate(() => (window as any).__edits)).toEqual(['deNumbers:0.qty'])
	})

	test("en-US: '.' starts editing, ',' (the group separator) does nothing; '-' starts editing", async ({ page }) => {
		await focusCell(page, 'enNumbers', 0, 1)
		await page.keyboard.press(',')
		await expect(cell(page, 'enNumbers', 0, 1)).toBeFocused()
		expect(await page.evaluate(() => (window as any).__edits)).toEqual([])
		await page.keyboard.press('.')
		const editor = cell(page, 'enNumbers', 0, 1).locator('input.wg__editor')
		await expect(editor).toHaveValue('.')
		await page.keyboard.press('Escape')
		await expect(cell(page, 'enNumbers', 0, 1)).toBeFocused()
		await page.keyboard.press('-')
		await expect(editor).toHaveValue('-')
	})

	test("'always' + de: after Escape, ',' goes back into the editor", async ({ page }) => {
		await cell(page, 'deAlways', 0, 0).click()
		await page.keyboard.press('ArrowRight')
		const editor = cell(page, 'deAlways', 0, 1).locator('.wg__editor')
		await expect(editor).toBeFocused()
		await page.keyboard.press('Escape')
		await expect(cell(page, 'deAlways', 0, 1)).toBeFocused()
		await page.keyboard.press('.')
		await expect(cell(page, 'deAlways', 0, 1)).toBeFocused()  // the group separator: nothing
		await page.keyboard.press(',')
		await expect(editor).toBeFocused()
		await expect(editor).toHaveValue(',')
		await page.keyboard.type('25')
		await expect(editor).toHaveValue(',25')
		await page.keyboard.press('Enter')
		await expect.poll(() => value(page, 'deAlways', 0, 'qty')).toBe(0.25)
	})
})

test.describe('read-only / disabled grids', () => {
	test('a read-only grid: typing and paste change nothing', async ({ page }) => {
		await cell(page, 'readonlyGrid', 0, 1).click()
		await expect(cell(page, 'readonlyGrid', 0, 1)).toBeFocused()
		await page.keyboard.press('X')
		await paste(page, 'readonlyGrid', 'Zed')
		await expect(cell(page, 'readonlyGrid', 0, 1)).toHaveText('Alice')
		await expect(cell(page, 'readonlyGrid', 0, 1).locator('input')).toHaveCount(0)
	})

	test('a disabled grid: a paste changes nothing', async ({ page }) => {
		await paste(page, 'disabledGrid', 'Zed')
		await expect(cell(page, 'disabledGrid', 0, 1)).toHaveText('Alice')
		expect(await value(page, 'disabledGrid', 0, 'name')).toBe('Alice')
	})
})

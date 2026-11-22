import { test, expect, type Page, cell, gridLocator, waitForRows } from './fixtures'

/**
 * Excel parity: Enter in the editor of the LAST row commits the typed text and stays on
 * that cell (there's no row below to move to) — in every editTrigger mode, for text and
 * number columns, however the edit started (the mode's own trigger, or a typed key).
 *
 * Fixture: test/type-paste.html — one grid per mode; cols 0 = id (read-only), 1 = name
 * (text), 2 = status (select); rows Alice / Bob (row 1 = last; the 1-row cases trim `items`).
 * [data-numbers] grids: col 1 = qty (number), one row.
 */

const PAGE = '/test/type-paste.html'

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page, 'navigateGrid')
})

const value = (page: Page, gridId: string, row: number, field: string) =>
	gridLocator(page, gridId).evaluate((el: any, [r, f]) => (el.getRowDraft(r) ?? el.items[r])[f], [row, field] as const)
const shown = (page: Page, gridId: string, row: number, col: number) =>
	cell(page, gridId, row, col).locator('.wg__cell-text')

async function setRows(page: Page, gridId: string, count: number) {
	await gridLocator(page, gridId).evaluate(async (el: any, n) => {
		el.items = el.items.slice(0, n)
		await el.whenSettled()
	}, count)
}

/** Start editing (row, 1) through the mode's own trigger; resolves with the focused editor. */
async function startEdit(page: Page, gridId: string, mode: string, row: number) {
	const target = cell(page, gridId, row, 1)
	switch (mode) {
		case 'navigate':
			await cell(page, gridId, row, 0).click()
			await page.keyboard.press('ArrowRight')
			break
		case 'click':
			await target.click()
			break
		case 'dblclick':
			await target.dblclick()
			break
		case 'button':
			await target.hover()
			await target.locator('.wg__edit-button').click()
			break
		case 'always':
			await target.locator('.wg__editor').click()
			break
	}
	const editor = target.locator('input.wg__editor')
	if (mode === 'navigate') {
		await page.keyboard.press('F2')
	}
	await expect(editor).toBeFocused()
	return editor
}

for (const mode of ['navigate', 'click', 'dblclick', 'button', 'always'] as const) {
	const id = `${mode}Grid`
	test.describe(`${mode} mode — Enter on the last row`, () => {
		for (const rows of [2, 1]) {
			test(`${rows} row(s): the mode's trigger, typed text, Enter → committed, stays on the cell`, async ({ page }) => {
				await setRows(page, id, rows)
				const last = rows - 1
				const editor = await startEdit(page, id, mode, last)
				await editor.fill('Zoe')
				await page.keyboard.press('Enter')
				await expect.poll(() => value(page, id, last, 'name')).toBe('Zoe')
				if (mode === 'always') {
					await expect(cell(page, id, last, 1).locator('input.wg__editor')).toHaveValue('Zoe')
					await expect(cell(page, id, last, 1).locator('input.wg__editor')).toBeFocused()
				} else {
					await expect(shown(page, id, last, 1)).toHaveText('Zoe')
					await expect(cell(page, id, last, 1)).toBeFocused()
				}
			})
		}

		if (mode !== 'always') {
			test('a typed key starts the edit on the last row; Enter commits it', async ({ page }) => {
				await cell(page, id, 1, 0).click()
				await page.keyboard.press('ArrowRight')
				await expect(cell(page, id, 1, 1)).toBeFocused()
				await page.keyboard.type('Max')
				await page.keyboard.press('Enter')
				await expect.poll(() => value(page, id, 1, 'name')).toBe('Max')
				await expect(shown(page, id, 1, 1)).toHaveText('Max')
				await expect(cell(page, id, 1, 1)).toBeFocused()
			})
		}
	})
}

for (const id of ['enNumbers', 'deAlways'] as const) {
	test(`number column (${id}), ONE row: typed number, Enter → committed`, async ({ page }) => {
		const editorCell = cell(page, id, 0, 1)
		if (id === 'deAlways') {
			await editorCell.locator('.wg__editor').click()
		} else {
			await cell(page, id, 0, 0).click()
			await page.keyboard.press('ArrowRight')
			await page.keyboard.press('F2')
		}
		const editor = editorCell.locator('input.wg__editor')
		await expect(editor).toBeFocused()
		await editor.fill('42')
		await page.keyboard.press('Enter')
		await expect.poll(() => value(page, id, 0, 'qty')).toBe(42)
	})
}

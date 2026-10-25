import { test, expect, type Page, gridLocator, cell, onGrid, domEvents, clearEvents, waitForRows, editorIn } from './fixtures'

/**
 * Edit modes — number editor parsing + `editorOptions` (min / max / decimals /
 * negatives), `editTrigger` 'always' / 'button' / per-column override,
 * `editStartSelection` (grid + per-column).
 *
 * Fixture: docs/test/edit-modes.html — grid edit-trigger="dblclick"; cols 0=name
 * (text), 1=qty (number), 2=price (number, min 0 / max 100 / 2 decimals / no
 * negatives), 3=note (text, column editTrigger 'click'). Rows Alpha / Beta.
 */

const PAGE = '/test/edit-modes.html'

/** dblclick-edit a cell, type `text`, Enter; returns the committed draft value. */
async function commitTyped(page: Page, r: number, c: number, text: string) {
	await cell(page, r, c).dblclick()
	const ed = editorIn(cell(page, r, c))
	await expect(ed).toBeVisible()
	await ed.fill(text)
	await page.keyboard.press('Enter')
	await expect(ed).toHaveCount(0)
	const field = ['name', 'qty', 'price', 'note'][c]
	return page.evaluate(({ r, f }) => {
		const el = document.getElementById('grid') as any
		const d = el.getRowDraft(r)
		return d ? d[f] : el.items[r][f]
	}, { r, f: field })
}

/** The text selection inside the open editor of a cell. */
const selection = (page: Page, r: number, c: number) =>
	editorIn(cell(page, r, c)).evaluate((i: HTMLInputElement) => [i.selectionStart, i.selectionEnd, i.value.length])

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await clearEvents(page, 'edit-modes')
})

test.describe('number editor', () => {
	test('renders a numeric text input', async ({ page }) => {
		await cell(page, 0, 1).dblclick()
		await expect(editorIn(cell(page, 0, 1))).toHaveAttribute('inputmode', 'numeric')
		await expect(editorIn(cell(page, 0, 1))).toHaveValue('10')
	})

	test('parses integers / decimals / padded input to numbers; empty → null', async ({ page }) => {
		expect(await commitTyped(page, 0, 1, '42')).toBe(42)
		expect(await commitTyped(page, 0, 1, '3.25')).toBe(3.25)
		expect(await commitTyped(page, 0, 1, '  7 ')).toBe(7)
		expect(await commitTyped(page, 0, 1, '')).toBe(null)
		expect(await commitTyped(page, 0, 1, '-5')).toBe(-5)
	})

	test('non-numeric input is not stored as a string in a number column', async ({ page }) => {
		test.fail(true, 'NOTES.md #25')
		const v = await commitTyped(page, 0, 1, 'abc')
		expect(typeof v === 'number' || v === null || v === 10).toBe(true)
	})

	test('trailing garbage is not silently truncated ("12abc" ≠ 12)', async ({ page }) => {
		test.fail(true, 'NOTES.md #25')
		expect(await commitTyped(page, 0, 1, '12abc')).not.toBe(12)
	})

	test('editorOptions max / allowNegative / decimalPlaces are enforced', async ({ page }) => {
		test.fail(true, 'NOTES.md #25')
		const over = await commitTyped(page, 0, 2, '500')
		const neg = await commitTyped(page, 0, 2, '-3')
		const dec = await commitTyped(page, 0, 2, '1.239')
		expect(over === 100 || over === 9.5).toBe(true)   // clamped or rejected
		expect(neg === 0 || neg === 9.5 || neg === 1.24).toBe(true)
		expect(dec).toBe(1.24)
	})
})

test.describe('editTrigger', () => {
	test("grid 'dblclick': a single click does not edit, a double click does", async ({ page }) => {
		await cell(page, 0, 0).click()
		await expect(editorIn(cell(page, 0, 0))).toHaveCount(0)
		await cell(page, 0, 0).dblclick()
		await expect(editorIn(cell(page, 0, 0))).toBeVisible()
	})

	test("column editTrigger 'click' overrides the grid's 'dblclick'", async ({ page }) => {
		await cell(page, 0, 3).click()
		await expect(editorIn(cell(page, 0, 3))).toBeVisible()
		expect(await domEvents(page, 'edit-start')).toEqual([expect.objectContaining({ field: 'note', rowIndex: 0 })])
	})

	test("'always': every editable cell renders its editor; typing commits on blur / Tab", async ({ page }) => {
		await onGrid(page, el => el.setAttribute('edit-trigger', 'always'))
		await expect(editorIn(cell(page, 0, 0))).toBeVisible()
		await expect(editorIn(cell(page, 1, 1))).toBeVisible()
		// the column override still applies to its own column
		await expect(editorIn(cell(page, 0, 3))).toHaveCount(0)
		await editorIn(cell(page, 0, 0)).fill('Alpha!')
		await page.keyboard.press('Tab')
		await expect.poll(() => onGrid(page, el => el.getRowDraft(0)?.name)).toBe('Alpha!')
		await expect(editorIn(cell(page, 0, 0))).toHaveValue('Alpha!')
	})

	test("'button': an edit button in the cell starts editing", async ({ page }) => {
		test.fail(true, 'NOTES.md #26')
		await onGrid(page, el => { el.editTrigger = 'button' })
		const btn = cell(page, 0, 0).locator('button')
		await expect(btn).toHaveCount(1, { timeout: 1500 })
		await btn.click()
		await expect(editorIn(cell(page, 0, 0))).toBeVisible()
	})
})

test.describe('editStartSelection', () => {
	test("default 'mousePosition' places the caret where the editor was opened", async ({ page }) => {
		await cell(page, 0, 3).click({ position: { x: 4, y: 10 } })  // note column, click-to-edit, near the left edge
		const [s, e] = await selection(page, 0, 3)
		expect(s).toBe(e)
		expect(s).toBeLessThan(3)
	})

	test("'selectAll' selects the whole value", async ({ page }) => {
		await onGrid(page, el => el.setAttribute('edit-start-selection', 'selectAll'))
		await cell(page, 0, 3).click()
		expect(await selection(page, 0, 3)).toEqual([0, 11, 11])
	})

	test("'cursorAtStart' / 'cursorAtEnd'", async ({ page }) => {
		await onGrid(page, el => { el.editStartSelection = 'cursorAtStart' })
		await cell(page, 0, 3).click()
		expect(await selection(page, 0, 3)).toEqual([0, 0, 11])
		await page.keyboard.press('Escape')
		await onGrid(page, el => { el.editStartSelection = 'cursorAtEnd' })
		await cell(page, 1, 3).click()
		expect(await selection(page, 1, 3)).toEqual([6, 6, 6])
	})

	test('a column editorOptions.editStartSelection overrides the grid', async ({ page }) => {
		await onGrid(page, el => {
			el.editStartSelection = 'cursorAtStart'
			el.columns = el.columns.map((c: any) => c.field === 'note' ? { ...c, editorOptions: { editStartSelection: 'selectAll' } } : c)
		})
		await cell(page, 0, 3).click()
		expect(await selection(page, 0, 3)).toEqual([0, 11, 11])
	})

	test('an invalid edit-start-selection attribute is rejected (default kept)', async ({ page }) => {
		await onGrid(page, el => el.setAttribute('edit-start-selection', 'bogus'))
		expect(await onGrid(page, el => el.editStartSelection)).toBe('mousePosition')
	})
})

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

	test('non-numeric input marks the cell invalid ("Not a number"); the draft keeps the typed text', async ({ page }) => {
		expect(await commitTyped(page, 0, 1, 'abc')).toBe('abc')
		await expect(cell(page, 0, 1)).toHaveClass(/wg__cell--invalid/)
		expect(await onGrid(page, el => el.isCellInvalid(0, 'qty'))).toBe(true)
		expect(await domEvents(page, 'validation-error')).toEqual([expect.objectContaining({ field: 'qty', error: 'Not a number', source: 'edit' })])
		// a valid number clears it
		expect(await commitTyped(page, 0, 1, '11')).toBe(11)
		await expect(cell(page, 0, 1)).not.toHaveClass(/wg__cell--invalid/)
	})

	test('trailing garbage is not silently truncated ("12abc" is invalid, not 12)', async ({ page }) => {
		expect(await commitTyped(page, 0, 1, '12abc')).toBe('12abc')
		expect(await onGrid(page, el => el.isCellInvalid(0, 'qty'))).toBe(true)
	})

	test('editorOptions: max / allowNegative reject (no clamping), decimalPlaces rounds', async ({ page }) => {
		expect(await commitTyped(page, 0, 2, '500')).toBe(500)
		expect(await onGrid(page, el => el.isCellInvalid(0, 'price'))).toBe(true)
		expect(await commitTyped(page, 0, 2, '-3')).toBe(-3)
		expect(await onGrid(page, el => el.isCellInvalid(0, 'price'))).toBe(true)
		expect(await commitTyped(page, 0, 2, '1.239')).toBe(1.24)
		expect(await onGrid(page, el => el.isCellInvalid(0, 'price'))).toBe(false)
		const errors = (await domEvents(page, 'validation-error')).map((d: any) => d.error)
		expect(errors).toEqual(['Must be at most 100', 'Must not be negative'])
	})

	test('the editor carries the editorOptions as min / max / step', async ({ page }) => {
		await cell(page, 0, 2).dblclick()
		const ed = editorIn(cell(page, 0, 2))
		await expect(ed).toHaveAttribute('min', '0')
		await expect(ed).toHaveAttribute('max', '100')
		await expect(ed).toHaveAttribute('step', '0.01')
	})

	test('the error messages are labels (i18n)', async ({ page }) => {
		await onGrid(page, el => { el.labels = { invalidNumber: 'Není číslo' } })
		await commitTyped(page, 0, 1, 'x')
		expect((await domEvents(page, 'validation-error'))[0].error).toBe('Není číslo')
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
		expect(await domEvents(page, 'cell-edit-start')).toEqual([expect.objectContaining({ field: 'note', rowIndex: 0 })])
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
		await onGrid(page, el => { el.editTrigger = 'button' })
		const btn = cell(page, 0, 0).locator('button')
		await expect(btn).toHaveCount(1, { timeout: 1500 })
		await cell(page, 0, 0).hover()   // the button shows on hover (or in the focused cell)
		await btn.click()
		await expect(editorIn(cell(page, 0, 0))).toBeVisible()
	})

	test("'button': only editable cells get it; visible on hover and in the focused cell; labelled", async ({ page }) => {
		await onGrid(page, el => {
			el.editTrigger = 'button'
			el.columns = el.columns.map((c: any) => c.field === 'qty' ? { ...c, isEditable: false } : c)
		})
		const btn = cell(page, 0, 0).locator('.wg__edit-button')
		await expect(btn).toHaveCount(1)
		await expect(cell(page, 0, 1).locator('.wg__edit-button')).toHaveCount(0)   // read-only column
		await expect(btn).toHaveAttribute('aria-label', 'Edit')
		await expect(btn).toHaveAttribute('title', 'Edit')
		await page.mouse.move(0, 0)
		await expect(btn).toBeHidden()
		await cell(page, 0, 0).hover()
		await expect(btn).toBeVisible()
		// focused cell: visible without hover; F2 / Enter edit as usual
		await cell(page, 1, 0).click({ position: { x: 5, y: 5 } })
		await page.mouse.move(0, 0)
		await expect(cell(page, 1, 0)).toBeFocused()
		await expect(cell(page, 1, 0).locator('.wg__edit-button')).toBeVisible()
		await page.keyboard.press('F2')
		await expect(editorIn(cell(page, 1, 0))).toBeVisible()
		// the editing cell has no button
		await expect(cell(page, 1, 0).locator('.wg__edit-button')).toHaveCount(0)
	})

	test("'button': a single click on the cell does not edit", async ({ page }) => {
		await onGrid(page, el => { el.editTrigger = 'button' })
		await cell(page, 0, 0).click({ position: { x: 5, y: 5 } })
		await expect(editorIn(cell(page, 0, 0))).toHaveCount(0)
	})

	test("'button': locked rows get no button", async ({ page }) => {
		await onGrid(page, el => { el.editTrigger = 'button'; el.rowLocking = { getIsLockedCallback: ({ row }: any) => row.id === 1 } })
		await expect(cell(page, 0, 0).locator('.wg__edit-button')).toHaveCount(0)
		await expect(cell(page, 1, 0).locator('.wg__edit-button')).toHaveCount(1)
	})

	test('editButtonIcon is HTML (icon fonts / sprites); labels.editCell names it', async ({ page }) => {
		await onGrid(page, el => {
			el.editTrigger = 'button'
			el.editButtonIcon = '<span class="lucide-pencil" data-testid="pencil"></span>'
			el.labels = { editCell: 'Upravit' }
		})
		const btn = cell(page, 0, 0).locator('.wg__edit-button')
		await expect(btn.locator('span.lucide-pencil')).toHaveCount(1)
		await expect(btn).toHaveAttribute('aria-label', 'Upravit')
		// attribute form; removal → the default glyph
		await onGrid(page, el => el.setAttribute('edit-button-icon', '<b>E</b>'))
		await expect(btn.locator('b')).toHaveText('E')
		await onGrid(page, el => el.removeAttribute('edit-button-icon'))
		await expect(btn).toHaveText('✎')
	})

	test('column.isEditButtonShown shows the button whatever the editTrigger', async ({ page }) => {
		await onGrid(page, el => { el.columns = el.columns.map((c: any) => c.field === 'name' ? { ...c, isEditButtonShown: true } : c) })
		await expect(cell(page, 0, 0).locator('.wg__edit-button')).toHaveCount(1)
		await expect(cell(page, 0, 3).locator('.wg__edit-button')).toHaveCount(0)
		await cell(page, 0, 0).hover()
		await cell(page, 0, 0).locator('.wg__edit-button').click()
		await expect(editorIn(cell(page, 0, 0))).toBeVisible()
	})
})

test.describe('editStartSelection', () => {
	test("default 'mouse-position' places the caret where the editor was opened", async ({ page }) => {
		await cell(page, 0, 3).click({ position: { x: 4, y: 10 } })  // note column, click-to-edit, near the left edge
		const [s, e] = await selection(page, 0, 3)
		expect(s).toBe(e)
		expect(s).toBeLessThan(3)
	})

	test("'select-all' selects the whole value", async ({ page }) => {
		await onGrid(page, el => el.setAttribute('edit-start-selection', 'select-all'))
		await cell(page, 0, 3).click()
		expect(await selection(page, 0, 3)).toEqual([0, 11, 11])
	})

	test("'cursor-at-start' / 'cursor-at-end'", async ({ page }) => {
		await onGrid(page, el => { el.editStartSelection = 'cursor-at-start' })
		await cell(page, 0, 3).click()
		expect(await selection(page, 0, 3)).toEqual([0, 0, 11])
		await page.keyboard.press('Escape')
		await onGrid(page, el => { el.editStartSelection = 'cursor-at-end' })
		await cell(page, 1, 3).click()
		expect(await selection(page, 1, 3)).toEqual([6, 6, 6])
	})

	test('a column editorOptions.editStartSelection overrides the grid', async ({ page }) => {
		await onGrid(page, el => {
			el.editStartSelection = 'cursor-at-start'
			el.columns = el.columns.map((c: any) => c.field === 'note' ? { ...c, editorOptions: { editStartSelection: 'select-all' } } : c)
		})
		await cell(page, 0, 3).click()
		expect(await selection(page, 0, 3)).toEqual([0, 11, 11])
	})

	test('an invalid edit-start-selection attribute is rejected (default kept)', async ({ page }) => {
		await onGrid(page, el => el.setAttribute('edit-start-selection', 'bogus'))
		expect(await onGrid(page, el => el.editStartSelection)).toBe('mouse-position')
	})
})

import { test, expect, cell, onGrid, domEvents, clearEvents, waitForRows, editorIn, editCell } from './fixtures'

/**
 * Row API — identity (`idValueMember`, `getRowIdCallback`, `idMember` — see
 * NOTES.md #11), `getRowId`, `findRowById`, `updateRowById`, `replaceRowById`,
 * `focusCell`, `startEditing`.
 *
 * Fixture: docs/test/row-api.html — Alpha/Beta/Gamma (id 1-3, code A-1/B-2/G-3);
 * cols 0=id, 1=name, 2=qty, 3=code. idMember + idValueMember = 'id'.
 */

const PAGE = '/test/row-api.html'

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await clearEvents(page, 'row-api')
})

test.describe('identity', () => {
	test('idValueMember: getRowId / findRowById (index into items); unknown id → null', async ({ page }) => {
		expect(await onGrid(page, el => [el.getRowId(el.items[1]), el.findRowById(3), el.findRowById(99)])).toEqual([
			2, { row: { id: 3, name: 'Gamma', qty: 30, code: 'G-3' }, index: 2 }, null
		])
	})

	test('getRowIdCallback wins over idValueMember and gets { row } + context', async ({ page }) => {
		const r = await onGrid(page, el => {
			el.getRowIdCallback = (ctx: any) => { (window as any).__idCtx = !!ctx.controller; return ctx.row.code }
			return [el.getRowId(el.items[0]), el.findRowById('B-2')?.index, el.findRowById(2), (window as any).__idCtx]
		})
		expect(r).toEqual(['A-1', 1, null, true])
	})

	test('idMember alone identifies rows for the id APIs', async ({ page }) => {
		test.fail(true, 'NOTES.md #11')
		expect(await onGrid(page, el => { el.idValueMember = undefined; return el.findRowById(2)?.index })).toBe(1)
	})
})

test.describe('updateRowById / replaceRowById', () => {
	test('updateRowById merges into the row and re-renders; unknown id → false', async ({ page }) => {
		expect(await onGrid(page, el => el.updateRowById(2, { name: 'Beta*', qty: 21 }))).toBe(true)
		await expect(cell(page, 1, 1)).toHaveText('Beta*')
		await expect(cell(page, 1, 2)).toHaveText('21')
		expect(await onGrid(page, el => el.items[1])).toEqual({ id: 2, name: 'Beta*', qty: 21, code: 'B-2' })
		expect(await onGrid(page, el => el.updateRowById(42, { name: 'x' }))).toBe(false)
	})

	test('updateRowById also patches a pending draft (the user edit of other fields survives)', async ({ page }) => {
		await editCell(page, cell(page, 0, 1), 'Alpha edited')
		await onGrid(page, el => el.updateRowById(1, { qty: 11 }))
		await expect(cell(page, 0, 1)).toHaveText('Alpha edited')
		await expect(cell(page, 0, 2)).toHaveText('11')
		expect(await onGrid(page, el => el.getRowDraft(0))).toMatchObject({ name: 'Alpha edited', qty: 11 })
	})

	test('replaceRowById swaps the row object and drops its draft', async ({ page }) => {
		await editCell(page, cell(page, 2, 1), 'Gamma edited')
		const r = await onGrid(page, el => [el.replaceRowById(3, { id: 3, name: 'Gamma v2', qty: 33, code: 'G-3' }), el.replaceRowById(9, {})])
		expect(r).toEqual([true, false])
		await expect(cell(page, 2, 1)).toHaveText('Gamma v2')
		expect(await onGrid(page, el => [el.hasRowDraft(2), el.isCellDirty(2, 'name')])).toEqual([false, false])
	})
})

test.describe('focusCell / startEditing', () => {
	test('focusCell moves keyboard focus + row focus; out-of-range is ignored', async ({ page }) => {
		await onGrid(page, el => el.focusCell(2, 1))
		await expect(cell(page, 2, 1)).toBeFocused()
		await expect(cell(page, 2, 1)).toHaveClass(/wg__cell--focused/)
		await onGrid(page, el => { el.focusCell(9, 1); el.focusCell(0, 9) })
		await expect(cell(page, 2, 1)).toBeFocused()
		// arrows continue from the programmatic focus
		await page.keyboard.press('ArrowUp')
		await expect(cell(page, 1, 1)).toBeFocused()
	})

	test('startEditing opens the editor (edit-start), Enter commits', async ({ page }) => {
		await onGrid(page, el => el.startEditing(1, 2))
		const ed = editorIn(cell(page, 1, 2))
		await expect(ed).toBeVisible()
		expect(await domEvents(page, 'edit-start')).toEqual([{ row: { id: 2, name: 'Beta', qty: 20, code: 'B-2' }, rowIndex: 1, field: 'qty' }])
		await ed.focus()
		await ed.fill('25')
		await page.keyboard.press('Enter')
		await expect(cell(page, 1, 2)).toHaveText('25')
	})

	test('startEditing a read-only cell does nothing', async ({ page }) => {
		await onGrid(page, el => el.startEditing(0, 3))
		await page.waitForTimeout(100)
		expect(await domEvents(page, 'edit-start')).toEqual([])
		await expect(editorIn(cell(page, 0, 3))).toHaveCount(0)
	})
})

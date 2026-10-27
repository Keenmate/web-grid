import { test, expect, cell, onGrid, domEvents, clearEvents, waitForRows, editorIn, editCell } from './fixtures'

/**
 * Row API — identity (`idMember`, default `'id'`, and `getIdCallback` — NOTES.md #11), `getRowId`, `findRowById`, `updateRowById`, `replaceRowById`,
 * `focusCell`, `startEditing`.
 *
 * Fixture: docs/test/row-api.html — Alpha/Beta/Gamma (id 1-3, code A-1/B-2/G-3);
 * cols 0=id, 1=name, 2=qty, 3=code. idMember left at its default 'id'.
 */

const PAGE = '/test/row-api.html'

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await clearEvents(page, 'row-api')
})

test.describe('identity', () => {
	test('idMember (default id): getRowId / findRowById (index into items); unknown id → null', async ({ page }) => {
		expect(await onGrid(page, el => [el.getRowId(el.items[1]), el.findRowById(3), el.findRowById(99)])).toEqual([
			2, { row: { id: 3, name: 'Gamma', qty: 30, code: 'G-3' }, rowIndex: 2 }, null
		])
	})

	test('getIdCallback wins over idMember and gets { row } + context', async ({ page }) => {
		const r = await onGrid(page, el => {
			el.getIdCallback = (ctx: any) => { (window as any).__idCtx = !!ctx.controller; return ctx.row.code }
			return [el.getRowId(el.items[0]), el.findRowById('B-2')?.rowIndex, el.findRowById(2), (window as any).__idCtx]
		})
		expect(r).toEqual(['A-1', 1, null, true])
	})

	test('idMember defaults to id; another member re-keys the id APIs; null turns them off', async ({ page }) => {
		expect(await onGrid(page, el => el.idMember)).toBe('id')
		expect(await onGrid(page, el => { el.idMember = 'code'; return [el.findRowById('B-2')?.rowIndex, el.findRowById(2)] })).toEqual([1, null])
		expect(await onGrid(page, el => { el.idMember = null; return [el.getRowId(el.items[0]), el.findRowById(1)] })).toEqual([undefined, null])
	})

	test('the removed idValueMember / getRowIdCallback are not inputs any more', async ({ page }) => {
		expect(await onGrid(page, el => ['idValueMember' in el, 'getRowIdCallback' in el])).toEqual([false, false])
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

	test('startEditing opens the editor (cell-edit-start), Enter commits', async ({ page }) => {
		await onGrid(page, el => el.startEditing(1, 2))
		const ed = editorIn(cell(page, 1, 2))
		await expect(ed).toBeVisible()
		expect(await domEvents(page, 'cell-edit-start')).toEqual([{ row: { id: 2, name: 'Beta', qty: 20, code: 'B-2' }, rowIndex: 1, field: 'qty' }])
		await ed.focus()
		await ed.fill('25')
		await page.keyboard.press('Enter')
		await expect(cell(page, 1, 2)).toHaveText('25')
	})

	test('startEditing a read-only cell does nothing', async ({ page }) => {
		await onGrid(page, el => el.startEditing(0, 3))
		await page.waitForTimeout(100)
		expect(await domEvents(page, 'cell-edit-start')).toEqual([])
		await expect(editorIn(cell(page, 0, 3))).toHaveCount(0)
	})
})

test.describe('insertRows / removeRow / scrollToRow', () => {
	test('insertRows inserts in order after the anchor; removeRow removes one row (no row-delete)', async ({ page }) => {
		const names = await onGrid(page, el => {
			let deleted = 0
			el.addEventListener('row-delete', () => { deleted++ })
			el.controller.insertRows([{ id: 10, name: 'X' }, { id: 11, name: 'Y' }], el.items[0])
			const afterInsert = el.items.map((r: any) => r.name)
			el.controller.removeRow(el.items[1])
			return [afterInsert, el.items.map((r: any) => r.name), deleted]
		})
		expect(names[0].slice(0, 3)).toEqual([names[0][0], 'X', 'Y'])
		expect(names[1]).not.toContain('X')
		expect(names[1]).toContain('Y')
		expect(names[2]).toBe(0)
	})

	test('scrollToRow resolves true for a displayed row, false out of range', async ({ page }) => {
		expect(await onGrid(page, async el => [await el.scrollToRow(0), await el.controller.scrollToRow(el.displayItems.length - 1), await el.scrollToRow(9999), await el.scrollToRow(-1)]))
			.toEqual([true, true, false, false])
	})
})

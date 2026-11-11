import { test, expect, type Page, gridLocator, cell, header, onGrid, domEvents, eventsOf, clearEvents, waitForRows, editCell, editorIn } from './fixtures'

/**
 * Drafts — an edit writes to a per-row draft (the `items` stay untouched);
 * dirty indicator (`isDirtyIndicatorShown`), `isCellDirty` / `isRowDirty` /
 * `getRowDraft` / `hasRowDraft` / `getDraftRowIndices`, `getDrafts`,
 * `discardDraft` / `discardAllDrafts`, drafts never pruned by `items`, and the `row-change` detail.
 *
 * Fixture: test/drafts.html — rows Alpha/Beta/Gamma/Delta (id 1-4), qty
 * 10..40; columns 0=id (read-only), 1=name (text, sortable), 2=qty (number).
 */

const PAGE = '/test/drafts.html'
const NAME = 1
const QTY = 2

const rowNumber = (page: Page, r: number) => gridLocator(page).locator(`.wg__row-number[data-row-number="${r}"]`)

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await clearEvents(page, 'drafts')
})

test.describe('dirty state', () => {
	test('a committed edit marks the cell + row number dirty; items stay untouched', async ({ page }) => {
		await editCell(page, cell(page, 1, NAME), 'Beta 2')
		await expect(cell(page, 1, NAME)).toHaveText('Beta 2')
		await expect(cell(page, 1, NAME)).toHaveClass(/wg__cell--dirty/)
		await expect(cell(page, 1, QTY)).not.toHaveClass(/wg__cell--dirty/)

		expect(await onGrid(page, el => ({
			cell: el.isCellDirty(1, 'name'),
			other: el.isCellDirty(1, 'qty'),
			row: el.isRowDirty(1),
			clean: el.isRowDirty(0),
			has: el.hasRowDraft(1),
			draft: el.getRowDraft(1),
			indices: el.getDraftRowIndices(),
			item: el.items[1]
		}))).toEqual({
			cell: true, other: false, row: true, clean: false, has: true,
			draft: { id: 2, name: 'Beta 2', qty: 20 },
			indices: [1],
			item: { id: 2, name: 'Beta', qty: 20 }
		})
	})

	test('the row-number dirty marker appears right after the commit', async ({ page }) => {
		await editCell(page, cell(page, 1, NAME), 'Beta 2')
		await expect(rowNumber(page, 1)).toHaveClass(/wg__row-number--dirty/, { timeout: 2000 })
		await expect(rowNumber(page, 0)).not.toHaveClass(/wg__row-number--dirty/)
	})

	test('the row-number dirty marker shows after a full render', async ({ page }) => {
		await editCell(page, cell(page, 1, NAME), 'Beta 2')
		await onGrid(page, el => { el.isStriped = false })  // forces a full render
		await expect(rowNumber(page, 1)).toHaveClass(/wg__row-number--dirty/)
		await expect(rowNumber(page, 0)).not.toHaveClass(/wg__row-number--dirty/)
	})

	test('a number edit stores a number in the draft', async ({ page }) => {
		await editCell(page, cell(page, 0, QTY), '15')
		expect(await onGrid(page, el => el.getRowDraft(0).qty)).toBe(15)
		await expect(cell(page, 0, QTY)).toHaveClass(/wg__cell--dirty/)
	})

	test('several edits on one row accumulate in one draft', async ({ page }) => {
		await editCell(page, cell(page, 2, NAME), 'G')
		await editCell(page, cell(page, 2, QTY), '31')
		expect(await onGrid(page, el => [el.getRowDraft(2), el.getDraftRowIndices()])).toEqual([{ id: 3, name: 'G', qty: 31 }, [2]])
	})

	test('isDirtyIndicatorShown=false hides the indicator but keeps the draft', async ({ page }) => {
		await onGrid(page, el => el.setAttribute('show-dirty-indicator', 'false'))
		await editCell(page, cell(page, 0, NAME), 'A')
		await expect(cell(page, 0, NAME)).toHaveText('A')
		await expect(cell(page, 0, NAME)).not.toHaveClass(/wg__cell--dirty/)
		await expect(rowNumber(page, 0)).not.toHaveClass(/wg__row-number--dirty/)
		expect(await onGrid(page, el => el.isCellDirty(0, 'name'))).toBe(true)
		// removal → back to the default (visible)
		await onGrid(page, el => el.removeAttribute('show-dirty-indicator'))
		await expect(cell(page, 0, NAME)).toHaveClass(/wg__cell--dirty/)
	})

	test('opening an editor and cancelling leaves the row clean', async ({ page }) => {
		await cell(page, 0, NAME).click()
		await page.keyboard.press('F2')
		await expect(editorIn(cell(page, 0, NAME))).toBeVisible()
		await page.keyboard.press('Escape')
		await expect(editorIn(cell(page, 0, NAME))).toHaveCount(0)
		expect(await onGrid(page, el => [el.isRowDirty(0), el.hasRowDraft(0), el.getDraftRowIndices()])).toEqual([false, false, []])
		await expect(rowNumber(page, 0)).not.toHaveClass(/wg__row-number--dirty/)
	})

	test('a draft follows its row when the view is re-sorted', async ({ page }) => {
		await editCell(page, cell(page, 2, NAME), 'Zulu')   // Gamma (id 3, index 2) → Zulu (draft)
		await header(page, 'name').locator('.wg__sort-indicator').click()  // asc by the ORIGINAL names → Gamma moves to index 3
		// The edited row is id 3 wherever it lands; its draft must stay with it.
		const view = await onGrid(page, el => el.displayItems.map((r: any, i: number) => ({ id: r.id, shown: el.getRowDraft(i)?.name ?? r.name })))
		expect(view.find((v: any) => v.id === 3)!.shown).toBe('Zulu')
		expect(view.filter((v: any) => v.shown === 'Zulu')).toHaveLength(1)
	})

	test('without idMember a draft follows its row object (sort)', async ({ page }) => {
		await onGrid(page, el => { el.idMember = null })
		await editCell(page, cell(page, 2, NAME), 'Zulu')
		await header(page, 'name').locator('.wg__sort-indicator').click()
		const view = await onGrid(page, el => el.displayItems.map((r: any, i: number) => ({ id: r.id, shown: el.getRowDraft(i)?.name ?? r.name })))
		expect(view.filter((v: any) => v.shown === 'Zulu').map((v: any) => v.id)).toEqual([3])
	})

	test('a draft follows its row through a filter; getDraftRowIndices lists display indices', async ({ page }) => {
		await editCell(page, cell(page, 3, NAME), 'Delta 2')  // id 4
		await onGrid(page, el => { el.isFilteringEnabled = true; el.filters = { name: 'delta' } })
		await expect.poll(() => onGrid(page, el => el.displayItems.map((r: any) => r.id))).toEqual([4])
		expect(await onGrid(page, el => [el.getRowDraft(0)?.name, el.getDraftRowIndices(), el.isRowDirty(0)])).toEqual(['Delta 2', [0], true])
		await expect(cell(page, 0, NAME)).toHaveText('Delta 2')
	})
})

test.describe('discarding', () => {
	test('discardDraft(row) restores one row, keeps the others', async ({ page }) => {
		await editCell(page, cell(page, 0, NAME), 'A1')
		await editCell(page, cell(page, 3, NAME), 'D1')
		await onGrid(page, el => el.discardDraft(el.displayItems[0]))
		await expect(cell(page, 0, NAME)).toHaveText('Alpha')
		await expect(cell(page, 0, NAME)).not.toHaveClass(/wg__cell--dirty/)
		await expect(cell(page, 3, NAME)).toHaveText('D1')
		expect(await onGrid(page, el => el.getDraftRowIndices())).toEqual([3])
	})

	test('discardAllDrafts restores every row', async ({ page }) => {
		await editCell(page, cell(page, 0, NAME), 'A1')
		await editCell(page, cell(page, 1, QTY), '99')
		await onGrid(page, el => el.discardAllDrafts())
		await expect(cell(page, 0, NAME)).toHaveText('Alpha')
		await expect(cell(page, 1, QTY)).toHaveText('20')
		await expect(gridLocator(page).locator('.wg__cell--dirty')).toHaveCount(0)
		await expect(gridLocator(page).locator('.wg__row-number--dirty')).toHaveCount(0)
		expect(await onGrid(page, el => el.getDraftRowIndices())).toEqual([])
	})

	test('re-typing the original value clears the cell dirty flag', async ({ page }) => {
		await editCell(page, cell(page, 1, NAME), 'Beta X')
		await editCell(page, cell(page, 1, NAME), 'Beta')
		await expect(cell(page, 1, NAME)).not.toHaveClass(/wg__cell--dirty/)
		expect(await onGrid(page, el => el.isCellDirty(1, 'name'))).toBe(false)
		// the draft is back to the original → no phantom draft, the row-number marker clears too
		expect(await onGrid(page, el => [el.isRowDirty(1), el.hasRowDraft(1), el.getDraftRowIndices()])).toEqual([false, false, []])
		await expect(rowNumber(page, 1)).not.toHaveClass(/wg__row-number--dirty/)
	})
})

test.describe('row-change', () => {
	test('detail: { row, draftRow, rowIndex, field, oldValue, newValue, isValid, validationError }', async ({ page }) => {
		await editCell(page, cell(page, 1, NAME), 'Beta 2')
		const ev = await domEvents(page, 'row-change')
		expect(ev).toEqual([{
			row: { id: 2, name: 'Beta', qty: 20 },
			draftRow: { id: 2, name: 'Beta 2', qty: 20 },
			rowIndex: 1,
			field: 'name',
			oldValue: 'Beta',
			newValue: 'Beta 2',
			isValid: true,
			validationError: null
		}])
	})

	test('fires once per commit; the on* twin runs first with the same object', async ({ page }) => {
		await editCell(page, cell(page, 0, QTY), '11')
		const all = await eventsOf(page, 'row-change')
		expect(all.map(e => e.via)).toEqual(['twin', 'event'])
		expect(await page.evaluate(() => {
			const ev = (window as any).__events.filter((e: any) => e.type === 'row-change')
			return ev[0].detail === ev[1].detail
		})).toBe(true)
	})

	test('committing the unchanged value fires no row-change', async ({ page }) => {
		await editCell(page, cell(page, 2, NAME), 'Gamma')
		expect(await domEvents(page, 'row-change')).toEqual([])
	})
})

test.describe('getDrafts / never pruned (NOTES.md #7, #20)', () => {
	test('getDrafts lists { row, draftRow, changedFields, isValid } for every draft', async ({ page }) => {
		await editCell(page, cell(page, 1, NAME), 'Beta 2')
		await editCell(page, cell(page, 2, QTY), 'x')   // invalid number
		expect(await onGrid(page, el => el.getDrafts())).toEqual([
			{ row: { id: 2, name: 'Beta', qty: 20 }, draftRow: { id: 2, name: 'Beta 2', qty: 20 }, changedFields: ['name'], isValid: true },
			{ row: { id: 3, name: 'Gamma', qty: 30 }, draftRow: { id: 3, name: 'Gamma', qty: 'x' }, changedFields: ['qty'], isValid: false }
		])
	})

	test('setting items never drops drafts — also for rows that are no longer in items', async ({ page }) => {
		await editCell(page, cell(page, 1, NAME), 'Beta 2')
		// the row is gone (another server page) …
		await onGrid(page, el => { el.items = [{ id: 7, name: 'Eta', qty: 70 }] })
		expect(await onGrid(page, el => el.getDrafts().map((d: any) => d.draftRow.name))).toEqual(['Beta 2'])
		// … and comes back with fresh data: the draft follows it (by id)
		await onGrid(page, el => { el.items = (window as any).seed() })
		await expect(cell(page, 1, NAME)).toHaveText('Beta 2')
		expect(await onGrid(page, el => el.getDrafts()[0].row === el.items[1])).toBe(true)
	})

	test('discardDraft(row) drops one draft and its invalid markers (row or draft object)', async ({ page }) => {
		await editCell(page, cell(page, 1, NAME), 'Beta 2')
		await editCell(page, cell(page, 2, QTY), 'x')
		await onGrid(page, el => el.discardDraft(el.items[2]))
		await expect(cell(page, 2, QTY)).toHaveText('30')
		expect(await onGrid(page, el => [el.isCellInvalid(2, 'qty'), el.getDrafts().length])).toEqual([false, 1])
		await onGrid(page, el => el.discardDraft(el.getDrafts()[0].draftRow))
		await expect(cell(page, 1, NAME)).toHaveText('Beta')
		expect(await onGrid(page, el => el.getDrafts())).toEqual([])
	})

	test('replaceRowById and discardAllDrafts remove drafts', async ({ page }) => {
		await editCell(page, cell(page, 0, NAME), 'Alpha 2')
		await editCell(page, cell(page, 1, NAME), 'Beta 2')
		await onGrid(page, el => el.replaceRowById(1, { id: 1, name: 'Alpha (saved)', qty: 10 }))
		expect(await onGrid(page, el => el.getDrafts().map((d: any) => d.draftRow.name))).toEqual(['Beta 2'])
		await onGrid(page, el => el.discardAllDrafts())
		expect(await onGrid(page, el => el.getDrafts())).toEqual([])
	})

	test('server paging + editing without a usable id warns once', async ({ page }) => {
		const warnings: string[] = []
		page.on('console', m => { if (m.type() === 'warning' && m.text().includes('paginationMode="server"')) warnings.push(m.text()) })
		await onGrid(page, el => { el.paginationMode = 'server'; el.idMember = 'code' })
		await page.waitForTimeout(50)
		await onGrid(page, el => { el.items = [{ id: 9, name: 'Iota', qty: 1 }] })
		await page.waitForTimeout(50)
		expect(warnings).toHaveLength(1)
		expect(warnings[0]).toContain('[GRID:INIT]')
	})

	test('server paging with ids does not warn', async ({ page }) => {
		const warnings: string[] = []
		page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()) })
		await onGrid(page, el => { el.paginationMode = 'server'; el.items = (window as any).seed() })
		await page.waitForTimeout(50)
		expect(warnings).toEqual([])
	})
})

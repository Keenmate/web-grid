import { test, expect, type Page, gridLocator, cell, onGrid, domEvents, clearEvents, waitForRows } from './fixtures'

/**
 * Selection API + `cellSelectionMode` — `selectRow` (replace / toggle / range),
 * `selectRowRange`, `isRowSelected`, `selectedRows`, `clearSelection`, `clearRowSelection`,
 * `selectCellRange` / `getSelectedCells` / `clearCellSelection`, and the
 * 'none' / 'shift' cell-selection modes.
 *
 * Fixture: test/selection-api.html — 6 rows (id 1-6, name A-F, qty id*10),
 * navigate mode, row numbers; cols 0=id, 1=name, 2=qty. Default mode 'click'.
 */

const PAGE = '/test/selection-api.html'

const selectedRowEls = (page: Page) => gridLocator(page).locator('tr.wg__row--selected')
const inRange = (page: Page) => gridLocator(page).locator('.wg__cell--in-range')

/** Raw mouse drag between two cells, optionally holding Shift. */
async function drag(page: Page, from: [number, number], to: [number, number], shift = false) {
	const a = await cell(page, ...from).boundingBox()
	const b = await cell(page, ...to).boundingBox()
	if (!a || !b) throw new Error('no box')
	if (shift) await page.keyboard.down('Shift')
	await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
	await page.mouse.down()
	await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
	await page.mouse.up()
	if (shift) await page.keyboard.up('Shift')
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await clearEvents(page, 'selection-api')
})

test.describe('row selection API', () => {
	test('selectRow replace / toggle / range, isRowSelected, selectedRowIndices sorted', async ({ page }) => {
		const r = await onGrid(page, el => {
			const out: any[] = []
			el.selectRow(1); out.push([...el.selectedRowIndices])
			el.selectRow(3, 'toggle'); out.push([...el.selectedRowIndices])
			el.selectRow(1, 'toggle'); out.push([...el.selectedRowIndices])
			el.selectRow(5, 'range'); out.push([...el.selectedRowIndices])
			el.selectRow(0); out.push([...el.selectedRowIndices])
			out.push([el.isRowSelected(0), el.isRowSelected(1)])
			return out
		})
		// 'range' anchors on the last clicked / toggled row (1), even though it was toggled off
		expect(r).toEqual([[1], [1, 3], [3], [1, 2, 3, 4, 5], [0], [true, false]])
		await expect(selectedRowEls(page)).toHaveCount(1)
	})

	test('selectRowRange + selectedRows (objects) + clearSelection', async ({ page }) => {
		const data = await onGrid(page, el => { el.selectRowRange(4, 2); return el.selectedRows.map((r: any) => r.name) })
		expect(data).toEqual(['C', 'D', 'E'])
		await expect(selectedRowEls(page)).toHaveCount(3)
		await onGrid(page, el => el.clearSelection())
		await expect(selectedRowEls(page)).toHaveCount(0)
		expect(await onGrid(page, el => el.selectedRowIndices)).toEqual([])
	})

	test('element and controller expose the same selectedRows / selectedRowIndices', async ({ page }) => {
		const r = await onGrid(page, el => {
			el.selectRowRange(1, 2)
			return [el.selectedRowIndices, el.controller.selectedRowIndices, el.selectedRows.map((x: any) => x.name), el.controller.selectedRows.map((x: any) => x.name)]
		})
		expect(r).toEqual([[1, 2], [1, 2], ['B', 'C'], ['B', 'C']])
	})

	test('clearSelection clears rows + cells + columns; clearRowSelection only rows', async ({ page }) => {
		// clearRowSelection leaves a cell range alone
		expect(await onGrid(page, el => { el.selectCellRange({ startRowIndex: 0, startColIndex: 0, endRowIndex: 1, endColIndex: 1 }); el.clearRowSelection(); return el.selectedCellRange !== null })).toBe(true)
		// clearSelection clears each kind
		expect(await onGrid(page, el => { el.clearSelection(); return el.selectedCellRange })).toBe(null)
		expect(await onGrid(page, el => { el.controller.selectColumn(1); const n = el.controller.getSelectedColumns().length; el.clearSelection(); return [n, el.controller.getSelectedColumns().length] })).toEqual([1, 0])
		expect(await onGrid(page, el => { el.selectRowRange(0, 2); el.clearSelection(); return el.selectedRowIndices })).toEqual([])
		await expect(inRange(page)).toHaveCount(0)
		await expect(selectedRowEls(page)).toHaveCount(0)
	})
})

test.describe('cell range API', () => {
	test('selectCellRange marks the cells, getSelectedCells lists them, clearCellSelection clears', async ({ page }) => {
		await onGrid(page, el => el.selectCellRange({ startRowIndex: 1, startColIndex: 1, endRowIndex: 2, endColIndex: 2 }))
		await expect(inRange(page)).toHaveCount(4)
		const cells = await onGrid(page, el => el.getSelectedCells().map((c: any) => [c.rowIndex, c.colIndex, c.field, c.value, c.column.field, c.row.name]))
		expect(cells).toEqual([[1, 1, 'name', 'B', 'name', 'B'], [1, 2, 'qty', 20, 'qty', 'B'], [2, 1, 'name', 'C', 'name', 'C'], [2, 2, 'qty', 30, 'qty', 'C']])
		// full cell contexts: `column` is the column object, plus the non-enumerable component context
		expect(await onGrid(page, el => {
			const c = el.getSelectedCells()[0]
			return [c.column === el.columns[1], c.element === el, Array.isArray(c.controller?.items), Object.keys(c).sort()]
		})).toEqual([true, true, true, ['colIndex', 'column', 'field', 'row', 'rowIndex', 'value']])
		await onGrid(page, el => el.clearCellSelection())
		await expect(inRange(page)).toHaveCount(0)
		expect(await onGrid(page, el => [el.selectedCellRange, el.getSelectedCells()])).toEqual([null, []])
	})

	test('a reversed range (end before start) is normalised', async ({ page }) => {
		await onGrid(page, el => el.selectCellRange({ startRowIndex: 3, startColIndex: 2, endRowIndex: 2, endColIndex: 0 }))
		expect(await onGrid(page, el => el.getSelectedCells().length)).toBe(6)
	})
})

test.describe('cellSelectionMode', () => {
	test("'click' (default): a plain drag selects a range", async ({ page }) => {
		await drag(page, [0, 1], [2, 2])
		await expect(inRange(page)).toHaveCount(6)
	})

	test("'none': a drag selects nothing, no event", async ({ page }) => {
		await onGrid(page, el => el.setAttribute('cell-selection-mode', 'none'))
		await drag(page, [0, 1], [2, 2])
		await page.waitForTimeout(100)
		await expect(inRange(page)).toHaveCount(0)
		expect(await domEvents(page, 'cell-selection-change')).toEqual([])
	})

	test("'shift': a plain drag does not select, a Shift+drag does", async ({ page }) => {
		await onGrid(page, el => { el.cellSelectionMode = 'shift' })
		await drag(page, [0, 1], [2, 2])
		await page.waitForTimeout(100)
		await expect(inRange(page)).toHaveCount(0)
		await drag(page, [1, 0], [3, 1], true)
		await expect(inRange(page)).toHaveCount(6)
	})

	test('an invalid mode is rejected; attribute removal restores click', async ({ page }) => {
		await onGrid(page, el => el.setAttribute('cell-selection-mode', 'lasso'))
		expect(await onGrid(page, el => el.cellSelectionMode)).toBe('click')
		await onGrid(page, el => { el.setAttribute('cell-selection-mode', 'none'); el.removeAttribute('cell-selection-mode') })
		expect(await onGrid(page, el => el.cellSelectionMode)).toBe('click')
	})
})

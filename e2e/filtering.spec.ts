import { test, expect, type Page, gridLocator, cell, onGrid, domEvents, eventsOf, clearEvents, waitForRows } from './fixtures'

/**
 * Filtering through the API — `isFilteringEnabled`, `filters`, `setFilter`,
 * `filter-change` (+ `onFilterChange` twin), column `filterCallback`,
 * `filterMode: 'server'`.
 *
 * Fixture: docs/test/filtering.html — 6 rows (see the seed table there),
 * `enable-filtering` set in markup, salary column has a `>N` / `<N` / `N`
 * filterCallback. The columns aren't `isFilterable`, so no filter row renders —
 * filters are driven through the element API (the filter row: filter-row.spec.ts).
 */

const PAGE = '/test/filtering.html'

const rowCount = (page: Page) => gridLocator(page).locator('tbody tr.wg__row')
const names = (page: Page) => onGrid(page, el => el.displayItems.map((r: any) => r.name))

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await expect(rowCount(page)).toHaveCount(6)
})

test.describe('client filtering', () => {
	test('setFilter narrows rows with a case-insensitive substring match', async ({ page }) => {
		await onGrid(page, el => el.setFilter('name', 'SMITH'))
		await expect(rowCount(page)).toHaveCount(1)
		await expect(cell(page, 0, 1)).toHaveText('Bob Smith')
	})

	test('filters on several fields combine with AND', async ({ page }) => {
		await onGrid(page, el => { el.filters = { city: 'prague', name: 'a' } })
		expect(await names(page)).toEqual(['Alice Johnson', 'Carol Williams', 'Frank Lee'].filter(n => /a/i.test(n)))
		await onGrid(page, el => { el.filters = { city: 'prague', name: 'carol' } })
		expect(await names(page)).toEqual(['Carol Williams'])
		await expect(rowCount(page)).toHaveCount(1)
	})

	test('setFilter(field, "") removes that filter; filters = {} restores all rows', async ({ page }) => {
		await onGrid(page, el => { el.setFilter('city', 'brno'); el.setFilter('name', 'eva') })
		expect(await names(page)).toEqual(['Eva Martinez'])
		await onGrid(page, el => el.setFilter('name', ''))
		expect(await onGrid(page, el => el.filters)).toEqual({ city: 'brno' })
		expect(await names(page)).toEqual(['Bob Smith', 'Eva Martinez'])
		await onGrid(page, el => { el.filters = {} })
		await expect(rowCount(page)).toHaveCount(6)
	})

	test('no matches renders no body rows', async ({ page }) => {
		await onGrid(page, el => el.setFilter('name', 'zzz'))
		await expect(rowCount(page)).toHaveCount(0)
	})

	test('isFilteringEnabled=false ignores filters (they are kept, not applied)', async ({ page }) => {
		await onGrid(page, el => { el.isFilteringEnabled = false; el.setFilter('name', 'bob') })
		await expect(rowCount(page)).toHaveCount(6)
		expect(await onGrid(page, el => el.filters)).toEqual({ name: 'bob' })
		// turning it back on applies the kept filter
		await onGrid(page, el => { el.isFilteringEnabled = true })
		await expect(rowCount(page)).toHaveCount(1)
	})

	test('removing the enable-filtering attribute resets to the default (off)', async ({ page }) => {
		await onGrid(page, el => el.setFilter('name', 'bob'))
		await expect(rowCount(page)).toHaveCount(1)
		await onGrid(page, el => el.removeAttribute('enable-filtering'))
		await expect(rowCount(page)).toHaveCount(6)
		expect(await onGrid(page, el => el.isFilteringEnabled)).toBe(false)
	})

	test('a filter change while on a later page keeps rows visible (page resets / clamps)', async ({ page }) => {
		await onGrid(page, el => { el.isPagingEnabled = true; el.pageSize = 2; el.currentPage = 3 })
		expect(await names(page)).toEqual(['Eva Martinez', 'Frank Lee'])
		await onGrid(page, el => el.setFilter('city', 'brno'))  // 2 matches → 1 page
		await expect(rowCount(page)).toHaveCount(2)
		expect(await onGrid(page, el => el.currentPage)).toBe(1)
		await expect(gridLocator(page).locator('.wg__pagination-info')).toContainText('Page 1 of 1')
	})

	test('a later filter change goes back to page 1 even when the current page still exists', async ({ page }) => {
		await onGrid(page, el => { el.isPagingEnabled = true; el.pageSize = 1; el.currentPage = 2 })
		await onGrid(page, el => el.setFilter('city', 'brno'))  // 2 matches → 2 pages
		await expect(rowCount(page)).toHaveCount(1)
		expect(await onGrid(page, el => el.currentPage)).toBe(1)
		// the same filter again is no change → the page stays
		await onGrid(page, el => { el.currentPage = 2 })
		await onGrid(page, el => { el.filters = { city: 'brno' } })
		expect(await onGrid(page, el => el.currentPage)).toBe(2)
	})

	test('a page + filter restored together keep the page (either order)', async ({ page }) => {
		await onGrid(page, el => { el.isPagingEnabled = true; el.pageSize = 1; el.filters = { city: 'brno' }; el.currentPage = 2 })
		await expect(cell(page, 0, 1)).toHaveText('Eva Martinez')
		expect(await onGrid(page, el => el.currentPage)).toBe(2)
		await onGrid(page, el => { el.filters = {}; el.currentPage = 1 })
		await onGrid(page, el => { el.currentPage = 3; el.setFilter('city', 'prague') })
		expect(await onGrid(page, el => el.currentPage)).toBe(3)
	})

	test('items shrinking clamps the page (no reset)', async ({ page }) => {
		await onGrid(page, el => { el.isPagingEnabled = true; el.pageSize = 2; el.currentPage = 3 })
		await onGrid(page, el => { el.items = el.items.slice(0, 4) })
		await expect(rowCount(page)).toHaveCount(2)
		expect(await onGrid(page, el => el.currentPage)).toBe(2)
	})
})

test.describe('filter-change event', () => {
	test('fires once per change with { filters }; the on* twin gets the same detail first', async ({ page }) => {
		await clearEvents(page, 'filtering')
		await onGrid(page, el => el.setFilter('name', 'al'))
		const all = await eventsOf(page, 'filter-change')
		expect(all.map(e => e.via)).toEqual(['twin', 'event'])
		expect(all[0].detail).toEqual({ filters: { name: 'al' } })
		expect(all[1].detail).toEqual({ filters: { name: 'al' } })
		const same = await page.evaluate(() => {
			const ev = (window as any).__events.filter((e: any) => e.type === 'filter-change')
			return ev[0].detail === ev[1].detail
		})
		expect(same).toBe(true)
	})

	test('detail carries the controller + element (non-enumerable)', async ({ page }) => {
		await clearEvents(page, 'filtering')
		await onGrid(page, el => el.setFilter('city', 'brno'))
		const info = await page.evaluate(() => {
			const d = (window as any).__events.find((e: any) => e.type === 'filter-change' && e.via === 'event').detail
			return {
				keys: Object.keys(d),
				isHost: d.element === document.getElementById('grid'),
				filters: d.controller?.filters ?? null
			}
		})
		expect(info).toEqual({ keys: ['filters'], isHost: true, filters: { city: 'brno' } })
	})

	test('the detail is a snapshot — later changes do not mutate it', async ({ page }) => {
		await clearEvents(page, 'filtering')
		await onGrid(page, el => { el.setFilter('name', 'a'); el.setFilter('city', 'b') })
		expect((await domEvents(page, 'filter-change')).map(d => d.filters)).toEqual([
			{ name: 'a' },
			{ name: 'a', city: 'b' }
		])
	})

	test('assigning filters is silent (like input.value); setFilter { isSilent } too — UI / setFilter still fire', async ({ page }) => {
		await clearEvents(page, 'filtering')
		await onGrid(page, el => { el.filters = { city: 'brno' } })
		await expect(rowCount(page)).toHaveCount(2)
		await onGrid(page, el => { el.filters = {} })
		await onGrid(page, el => el.setFilter('name', 'bob', { isSilent: true }))
		await onGrid(page, el => el.controller.setFilter('name', 'al', { isSilent: true }))
		expect(await onGrid(page, el => el.filters)).toEqual({ name: 'al' })
		expect(await eventsOf(page, 'filter-change')).toEqual([])
		await onGrid(page, el => el.setFilter('name', 'bob'))
		expect(await domEvents(page, 'filter-change')).toEqual([{ filters: { name: 'bob' } }])
	})

	test('filter-change does not fire a data-request in client mode', async ({ page }) => {
		await clearEvents(page, 'filtering')
		await onGrid(page, el => el.setFilter('name', 'a'))
		expect(await domEvents(page, 'data-request')).toEqual([])
	})
})

test.describe('column filterCallback', () => {
	test('replaces the substring match for its column', async ({ page }) => {
		await onGrid(page, el => el.setFilter('salary', '>88000'))
		expect(await names(page)).toEqual(['Carol Williams', 'Eva Martinez'])
		await onGrid(page, el => el.setFilter('salary', '<70000'))
		expect(await names(page)).toEqual(['David Brown'])
		await onGrid(page, el => el.setFilter('salary', '72000'))
		expect(await names(page)).toEqual(['Bob Smith'])
	})

	test('receives { row, field, filterValue } + the grid context', async ({ page }) => {
		await page.evaluate(() => { (window as any).filterCalls = [] })
		await onGrid(page, el => el.setFilter('salary', '>90000'))
		const calls = await page.evaluate(() => (window as any).filterCalls)
		expect(calls.length).toBeGreaterThanOrEqual(6)
		expect(calls[0]).toMatchObject({ field: 'salary', filterValue: '>90000', hasController: true })
		expect(new Set(calls.map((c: any) => c.id))).toEqual(new Set([1, 2, 3, 4, 5, 6]))
	})

	test('returning null (incomplete input) ignores that filter — all rows pass', async ({ page }) => {
		await onGrid(page, el => el.setFilter('salary', '>'))
		await expect(rowCount(page)).toHaveCount(6)
		// combined with a normal filter only the normal one applies
		await onGrid(page, el => el.setFilter('city', 'ostrava'))
		expect(await names(page)).toEqual(['David Brown'])
	})
})

test.describe("filterMode 'server'", () => {
	test('fires filter-change but does not filter the items locally', async ({ page }) => {
		await onGrid(page, el => { el.filterMode = 'server' })
		await clearEvents(page, 'filtering')
		await onGrid(page, el => el.setFilter('name', 'bob'))
		await expect(rowCount(page)).toHaveCount(6)
		expect(await domEvents(page, 'filter-change')).toEqual([{ filters: { name: 'bob' } }])
		// the consumer answers by replacing items
		await onGrid(page, el => { el.items = el.items.filter((r: any) => /bob/i.test(r.name)) })
		await expect(rowCount(page)).toHaveCount(1)
		expect(await onGrid(page, el => el.filters)).toEqual({ name: 'bob' })
	})

	test('the filter-mode attribute switches the mode', async ({ page }) => {
		await onGrid(page, el => el.setAttribute('filter-mode', 'server'))
		expect(await onGrid(page, el => el.filterMode)).toBe('server')
		await onGrid(page, el => el.setFilter('name', 'bob'))
		await expect(rowCount(page)).toHaveCount(6)
		await onGrid(page, el => el.removeAttribute('filter-mode'))
		expect(await onGrid(page, el => el.filterMode)).toBe('client')
		await expect(rowCount(page)).toHaveCount(1)
	})
})

import { test, expect, type Page, gridLocator, header, onGrid, domEvents, clearEvents, waitForRows } from './fixtures'

/**
 * Column order — drag reorder + `column-reorder`, `storage-key` +
 * `persist-column-order` (core state store: localStorage
 * `km-state:web-grid:<key>`, restored on reload; or `loadStateCallback` /
 * `saveStateCallback`), `setColumnOrder` / `getColumnOrderState`,
 * `isColumnReorderAllowed` off → no drag.
 *
 * Fixture: test/column-order.html — #persist (storage-key 'co-test',
 * persist order, reorder allowed), #late (key set after the columns), #cb
 * (callbacks, in-memory sink), #nokey (no key) and #locked (reorder not
 * allowed); columns id / name / city / qty.
 */

const PAGE = '/test/column-order.html'
const KEY = 'km-state:web-grid:co-test'

async function order(page: Page, id: string): Promise<string[]> {
	return gridLocator(page, id)
		.locator('thead th.wg__header:not(.wg__row-number-header):not(.wg__inline-actions-header):not(.wg__actions-column):not(.wg__filler)')
		.evaluateAll(els => els.map(el => (el as HTMLElement).dataset.field || ''))
}

/** Drag header `field` onto the left edge of header `target` (inserts before it; past the 5 px threshold). */
async function dragHeader(page: Page, id: string, field: string, target: string) {
	const s = await header(page, id, field).boundingBox()
	const d = await header(page, id, target).boundingBox()
	if (!s || !d) throw new Error('no box')
	const sx = s.x + 20, sy = s.y + s.height / 2
	await page.mouse.move(sx, sy)
	await page.mouse.down()
	await page.mouse.move(sx + 10, sy, { steps: 4 })
	await page.mouse.move(d.x + 8, d.y + d.height / 2, { steps: 10 })  // left edge → insert before the target
	await page.mouse.up()
}

async function load(page: Page) {
	await waitForRows(page, 'persist')
	await waitForRows(page, 'late')
	await waitForRows(page, 'cb')
	await waitForRows(page, 'nokey')
	await waitForRows(page, 'locked')
	await clearEvents(page, 'column-order')
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await page.evaluate(() => localStorage.clear())
	await page.reload()
	await load(page)
})

test('dragging a header reorders, fires column-reorder, and persists to localStorage', async ({ page }) => {
	await dragHeader(page, 'persist', 'qty', 'name')
	await expect.poll(() => order(page, 'persist')).toEqual(['id', 'qty', 'name', 'city'])
	const ev = await domEvents(page, 'column-reorder', 'persist')
	expect(ev).toHaveLength(1)
	expect(ev[0]).toMatchObject({ field: 'qty', fromIndex: 3, toIndex: 1 })
	const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY)
	expect(stored.columnOrder.map((c: any) => c.field)).toEqual(['id', 'qty', 'name', 'city'])
})

test('the persisted order is restored after a reload (columns set before storageKey)', async ({ page }) => {
	await dragHeader(page, 'late', 'city', 'id')
	const after = await order(page, 'late')
	expect(after[0]).toBe('city')
	await page.reload()
	await load(page)
	expect(await order(page, 'late')).toEqual(after)
})

test('the persisted order is restored when storage-key is set before the columns', async ({ page }) => {
	await dragHeader(page, 'persist', 'city', 'id')
	const after = await order(page, 'persist')
	expect(after[0]).toBe('city')
	await page.reload()
	await load(page)
	expect(await order(page, 'persist')).toEqual(after)
})

test('setColumnOrder applies an order; getColumnOrderState reads it back', async ({ page }) => {
	await onGrid(page, el => el.setColumnOrder([
		{ field: 'city', order: 0 }, { field: 'qty', order: 1 }, { field: 'id', order: 2 }, { field: 'name', order: 3 }
	]), 'persist')
	await expect.poll(() => order(page, 'persist')).toEqual(['city', 'qty', 'id', 'name'])
	expect(await onGrid(page, el => el.getColumnOrderState().map((c: any) => c.field), 'persist')).toEqual(['city', 'qty', 'id', 'name'])
})

test('setColumnOrder is persisted too (survives a reload)', async ({ page }) => {
	await onGrid(page, el => el.setColumnOrder([
		{ field: 'qty', order: 0 }, { field: 'name', order: 1 }, { field: 'city', order: 2 }, { field: 'id', order: 3 }
	]), 'late')
	await expect.poll(() => order(page, 'late')).toEqual(['qty', 'name', 'city', 'id'])
	await page.reload()
	await load(page)
	expect(await order(page, 'late')).toEqual(['qty', 'name', 'city', 'id'])
})

test('a stored entry for a removed column is dropped on load', async ({ page }) => {
	await page.evaluate(() => localStorage.setItem('km-state:web-grid:co-late', JSON.stringify({
		columnOrder: [{ field: 'gone', order: 0 }, { field: 'qty', order: 1 }, { field: 'id', order: 2 }, { field: 'name', order: 3 }, { field: 'city', order: 4 }]
	})))
	await page.reload()
	await load(page)
	expect(await order(page, 'late')).toEqual(['qty', 'id', 'name', 'city'])
	const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('km-state:web-grid:co-late') || 'null'))
	expect(stored.columnOrder.map((c: any) => c.field)).not.toContain('gone')
})

test('no storage-key: persist-column-order stores nothing', async ({ page }) => {
	await dragHeader(page, 'nokey', 'qty', 'name')
	await expect.poll(() => order(page, 'nokey')).toEqual(['id', 'qty', 'name', 'city'])
	await page.waitForTimeout(100)
	expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])
})

test('loadStateCallback gets { key } (+ context) and its state orders the columns', async ({ page }) => {
	await expect.poll(() => order(page, 'cb')).toEqual(['city', 'id', 'name', 'qty'])
	expect(await page.evaluate(() => (window as any).__loadCalls[0])).toEqual({ key: 'co-cb', hasContext: true })
})

test('saveStateCallback gets { key, state } = the WHOLE state; localStorage untouched; a reload restores it', async ({ page }) => {
	await expect.poll(() => order(page, 'cb')).toEqual(['city', 'id', 'name', 'qty'])
	await dragHeader(page, 'cb', 'qty', 'city')
	await expect.poll(() => order(page, 'cb')).toEqual(['qty', 'city', 'id', 'name'])
	const last = await page.evaluate(() => (window as any).__saveCalls.at(-1))
	expect(last.key).toBe('co-cb')
	expect(last.state.note).toBe('kept')
	expect(last.state.columnOrder.map((c: any) => c.field)).toEqual(['qty', 'city', 'id', 'name'])
	expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])

	// the page's store survives the reload (seeded before the fixture script runs)
	await page.addInitScript((seed) => { (window as any).__seed = seed }, last.state)
	await page.reload()
	await load(page)
	await expect.poll(() => order(page, 'cb')).toEqual(['qty', 'city', 'id', 'name'])
})

test('isColumnReorderAllowed off: a header drag does not reorder (no event)', async ({ page }) => {
	await dragHeader(page, 'locked', 'qty', 'name')
	await page.waitForTimeout(150)
	expect(await order(page, 'locked')).toEqual(['id', 'name', 'city', 'qty'])
	expect(await domEvents(page, 'column-reorder', 'locked')).toEqual([])
})

test('removing allow-column-reorder turns drag reorder off', async ({ page }) => {
	await onGrid(page, el => el.removeAttribute('allow-column-reorder'), 'persist')
	await dragHeader(page, 'persist', 'qty', 'name')
	await page.waitForTimeout(150)
	expect(await order(page, 'persist')).toEqual(['id', 'name', 'city', 'qty'])
})

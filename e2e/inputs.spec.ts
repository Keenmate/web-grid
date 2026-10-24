import { test, expect, type Page } from './fixtures'

/**
 * Inputs go through core's property path (no grid-side proxies):
 *   - `mode` is a preset via core `getBatchValuesCallback` — it also sets the
 *     editing flags + cellSelectionMode in the same batch; inputs set explicitly
 *     in that batch win, whatever the order
 *   - property reads are synchronous; engine-derived getters / methods /
 *     `el.controller` flush pending writes, so derived state is current right
 *     after a write (the internal `el.engine` is fed on the flush)
 *   - invalid property values are rejected (warned, previous value kept)
 *   - UI-driven input changes (page-size selector) update the element property
 *
 * Fixture: docs/test/inputs.html (module only) — grids are created on the fly.
 */

const PAGE = '/test/inputs.html'

const ITEMS = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }))
const COLUMNS = [{ field: 'id', title: 'ID' }, { field: 'name', title: 'Name' }]

/** Create a fresh `<web-grid id="t">` from markup in a host div. */
async function mount(page: Page, attrs: string): Promise<void> {
	await page.evaluate(({ attrs, items, columns }) => {
		document.getElementById('t-host')?.remove()
		const host = document.createElement('div')
		host.id = 't-host'
		host.innerHTML = `<web-grid id="t" ${attrs}></web-grid>`
		const el = host.firstElementChild as any
		el.columns = columns
		el.items = items
		document.body.appendChild(host)
	}, { attrs, items: ITEMS, columns: COLUMNS })
}

const read = <R>(page: Page, fn: (el: any) => R) =>
	page.evaluate(`(${fn.toString()})(document.getElementById('t'))`) as Promise<R>

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await page.waitForFunction(() => !!customElements.get('web-grid'))
})

test.describe('mode preset (core getBatchValuesCallback)', () => {
	test('markup: an explicit attribute wins over the preset, the rest of the preset applies', async ({ page }) => {
		await mount(page, 'mode="input-matrix" edit-trigger="click"')
		expect(await read(page, el => [el.editTrigger, el.isEditable, el.cellSelectionMode, el.shouldShowDropdownOnFocus]))
			.toEqual(['click', true, 'shift', true])
		expect(await read(page, el => [el.engine.editTrigger, el.engine.cellSelectionMode])).toEqual(['click', 'shift'])
	})

	test('markup: the same result with the attributes in reverse order', async ({ page }) => {
		await mount(page, 'edit-trigger="click" mode="input-matrix"')
		expect(await read(page, el => [el.editTrigger, el.isEditable, el.cellSelectionMode]))
			.toEqual(['click', true, 'shift'])
		expect(await read(page, el => [el.engine.editTrigger, el.engine.cellSelectionMode])).toEqual(['click', 'shift'])
	})

	test('property: the preset is readable synchronously, on the element and the engine', async ({ page }) => {
		await mount(page, '')
		expect(await read(page, el => {
			el.mode = 'input-matrix'
			const sync = [el.editTrigger, el.cellSelectionMode]
			el.flush() // the engine (internal) is fed on the flush
			return [...sync, el.engine.editTrigger, el.engine.cellSelectionMode]
		})).toEqual(['always', 'shift', 'always', 'shift'])
	})

	test('property: an explicit write in the same tick wins, whatever the order', async ({ page }) => {
		await mount(page, '')
		expect(await read(page, el => {
			el.editTrigger = 'click'
			el.mode = 'excel'
			el.flush()
			return [el.editTrigger, el.engine.editTrigger, el.engine.isEditable]
		})).toEqual(['click', 'click', true])
	})

	test('across ticks the last write wins', async ({ page }) => {
		await mount(page, 'edit-trigger="click"')
		expect(await read(page, el => {
			el.mode = 'excel'
			el.flush()
			return [el.editTrigger, el.engine.editTrigger]
		})).toEqual(['navigate', 'navigate'])
	})
})

test.describe('property path', () => {
	test('engine-derived state is current right after a write', async ({ page }) => {
		await mount(page, 'is-pageable page-size="10"')
		expect(await read(page, el => {
			el.pageSize = 25
			return [el.totalPages, el.displayItems.length]
		})).toEqual([4, 25])
	})

	test('an invalid value is rejected and the previous value kept', async ({ page }) => {
		await mount(page, 'is-pageable')
		const warnings: string[] = []
		page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()) })
		expect(await read(page, el => {
			el.pageSize = 34
			el.pageSize = null
			el.pageSize = 0
			el.mode = 'bogus'
			return [el.pageSize, el.totalPages, el.engine.pageSize, el.mode]
		})).toEqual([34, 3, 34, 'excel'])
		expect(warnings.filter(w => w.includes('rejected invalid value'))).toHaveLength(3)
	})

	test('the page-size selector updates the element property', async ({ page }) => {
		await mount(page, 'is-pageable page-size="10"')
		const select = page.locator('web-grid#t .wg__pagination-select')
		await select.selectOption('25')
		expect(await read(page, el => [el.pageSize, el.engine.pageSize, el.totalPages])).toEqual([25, 25, 4])
	})
})

import { test, expect, type Page } from './fixtures'

/**
 * Responsive rules (web-components-core SPEC §6.7) on the grid's input table:
 * a page rule (`window.components['web-grid'].responsive`) applies to every grid,
 * an attribute written on the instance beats it, the instance's own rules beat
 * both. Overrides never reflect to attributes. Only input-table keys can be set
 * (columns / items are properties, not inputs).
 *
 * Fixture: docs/test/inputs.html (module only) — grids are created on the fly.
 * Viewport 1440 px, no touch → device class `desktop`, breakpoint `desktop`.
 * Maps have two axes: `device` (classifyDevice — touch capability, then short
 * side) and `breakpoint` (window width).
 */

const PAGE = '/test/inputs.html'

const ITEMS = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }))
const COLUMNS = [{ field: 'id', title: 'ID' }, { field: 'name', title: 'Name' }]

async function mount(page: Page, attrs: string): Promise<void> {
	await page.evaluate(({ attrs, items, columns }) => {
		document.getElementById('t-host')?.remove()
		const host = document.createElement('div')
		host.id = 't-host'
		host.innerHTML = `<web-grid id="t" enable-paging ${attrs}></web-grid>`
		const el = host.firstElementChild as any
		el.columns = columns
		el.items = items
		document.body.appendChild(host)
	}, { attrs, items: ITEMS, columns: COLUMNS })
	await page.evaluate(() => (document.getElementById('t') as any).whenSettled())
}

const read = <R>(page: Page, fn: (el: any) => R) =>
	page.evaluate(`(${fn.toString()})(document.getElementById('t'))`) as Promise<R>

const bodyRows = (page: Page) => page.locator('#t').locator('tbody tr[data-row-index]')

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await page.waitForFunction(() => !!customElements.get('web-grid'))
	await page.evaluate(() => {
		;(window as any).components['web-grid'].responsive = {
			device: { mobile: { pageSize: 3 }, desktop: { pageSize: 5, isStriped: false } },
		}
	})
})

test('a per-tag page rule applies to a grid without explicit values (no reflection)', async ({ page }) => {
	await mount(page, '')
	expect(await read(page, el => [el.pageSize, el.isStriped, el.engine.pageSize])).toEqual([5, false, 5])
	expect(await read(page, el => [el.hasAttribute('page-size'), el.hasAttribute('striped')])).toEqual([false, false])
	await expect(bodyRows(page)).toHaveCount(5)
})

test('an instance attribute beats the page rule; the rest of the rule still applies', async ({ page }) => {
	await mount(page, 'page-size="20"')
	expect(await read(page, el => [el.pageSize, el.isStriped, el.engine.pageSize])).toEqual([20, false, 20])
	await expect(bodyRows(page)).toHaveCount(20)
})

test('the instance map beats the attribute', async ({ page }) => {
	await mount(page, `page-size="20" responsive='{"device":{"desktop":{"pageSize":8}}}'`)
	expect(await read(page, el => [el.pageSize, el.isStriped, el.getAttribute('page-size')])).toEqual([8, false, '20'])
	await expect(bodyRows(page)).toHaveCount(8)
})

test('a breakpoint-axis map flips when a desktop window narrows; the device class stays desktop', async ({ page }) => {
	await page.evaluate(() => {
		;(window as any).components['web-grid'].responsive = { breakpoint: { mobile: { pageSize: 3 } } }
	})
	await mount(page, '')
	expect(await read(page, el => el.pageSize)).toBe(10)

	await page.setViewportSize({ width: 700, height: 900 })
	await expect.poll(() => read(page, el => el.pageSize)).toBe(3)
	await expect(bodyRows(page)).toHaveCount(3)

	await page.setViewportSize({ width: 1440, height: 1024 })
	await expect.poll(() => read(page, el => el.pageSize)).toBe(10)
})

test('a page callback keyed on ctx.breakpoint re-runs on a viewport change', async ({ page }) => {
	// Device class comes from classifyDevice (touch-primary + short side), so a
	// narrowed desktop browser stays `desktop` — width rules use the callback.
	await page.evaluate(() => {
		;(window as any).components['web-grid'].responsive = null
		;(window as any).components['web-grid'].responsiveCallback = (ctx: any) =>
			ctx.breakpoint === 'mobile' ? { pageSize: 3, isRowNumbersShown: false } : undefined
	})
	await mount(page, 'show-row-numbers')
	expect(await read(page, el => [el.pageSize, el.isRowNumbersShown])).toEqual([10, true])

	await page.setViewportSize({ width: 390, height: 844 })
	// pageSize follows the rule; the explicit show-row-numbers attribute beats it
	await expect.poll(() => read(page, el => [el.pageSize, el.isRowNumbersShown])).toEqual([3, true])
	await expect(bodyRows(page)).toHaveCount(3)

	await page.setViewportSize({ width: 1440, height: 1024 })
	await expect.poll(() => read(page, el => el.pageSize)).toBe(10)
})

test('a rule naming a non-input (columns) warns and skips that key only', async ({ page }) => {
	const warnings: string[] = []
	page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()) })
	await page.evaluate(() => {
		;(window as any).components['web-grid'].responsive = { device: { desktop: { columns: [], pageSize: 5 } } }
	})
	await mount(page, '')
	expect(await read(page, el => [el.pageSize, el.columns.length])).toEqual([5, 2])
	expect(warnings.some((w) => w.includes('columns'))).toBe(true)
})

test.describe('on a touch phone (device axis)', () => {
	test.skip(({ browserName }) => browserName === 'firefox', 'Firefox has no isMobile emulation (Playwright)')
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

	test('device.mobile applies and beats breakpoint.mobile on the same key', async ({ page }) => {
		await page.evaluate(() => {
			;(window as any).components['web-grid'].responsive = {
				device: { mobile: { pageSize: 3 } },
				breakpoint: { mobile: { pageSize: 7, isStriped: false } },
			}
		})
		await mount(page, '')
		expect(await read(page, el => [el.pageSize, el.isStriped])).toEqual([3, false])
		await expect(bodyRows(page)).toHaveCount(3)
	})
})

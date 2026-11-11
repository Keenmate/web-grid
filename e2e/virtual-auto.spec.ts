import { test, expect, Page, gridLocator, onGrid } from './fixtures'

/**
 * Virtual scroll modes (test/virtual-auto.html). Default OFF: no `enable-virtual-scroll` renders every
 * row, however many. Automatic is opt-in — `enable-virtual-scroll="auto"` (property `null`): virtual once
 * the displayed row count reaches `virtualScrollThreshold` (20 on #auto), re-checked when `items` grows /
 * shrinks across it. Explicit `true` / `false` (attribute or property) force it; removing the attribute /
 * `undefined` returns to the default (off).
 *
 * Virtual = the `.wg--virtual-scroll` container class; with many rows, spacer rows + only a window of real rows.
 */

const PAGE = '/test/virtual-auto.html'

async function setRows(page: Page, n: number, id = 'grid') {
	await page.evaluate(([n, id]) => (window as any).setRows(n, id), [n, id] as const)
}

/** Whether `#<id>` renders virtually, plus how many real body rows it has. */
async function state(page: Page, id = 'grid') {
	return onGrid(page, (el: any) => {
		const root = el.shadowRoot
		return {
			isVirtual: !!root.querySelector('.wg.wg--virtual-scroll'),
			hasSpacer: !!root.querySelector('tbody tr.wg__spacer-bottom, tbody tr.wg__spacer-top'),
			rows: root.querySelectorAll('tbody tr.wg__row').length,
		}
	}, id)
}

async function expectVirtual(page: Page, isVirtual: boolean, id = 'grid') {
	await expect.poll(async () => (await state(page, id)).isVirtual).toBe(isVirtual)
	// a normal render never has spacer rows (a virtual one has them only when rows are cut off)
	if (!isVirtual) expect((await state(page, id)).hasSpacer).toBe(false)
}

/** `#auto` took `enable-virtual-scroll="auto"` as a valid value: automatic (`null`), nothing refused. */
async function expectAutoAccepted(page: Page) {
	expect(await page.evaluate(() => (window as any).rejected)).toEqual([])
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled, 'auto')).toBeNull()
}

const activeRow = (page: Page, id = 'grid') => onGrid(page, (el: any) => el.shadowRoot.activeElement?.getAttribute('data-row') ?? null, id)

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	for (const id of ['grid', 'auto', 'forcedOn', 'forcedOff']) {
		await expect(gridLocator(page, id).locator('tbody tr.wg__row').first()).toBeVisible()
	}
})

test('default is off: 150 rows (above the default threshold 100) render normally', async ({ page }) => {
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled)).toBe(false)
	await setRows(page, 150)
	await expectVirtual(page, false)
	expect((await state(page)).rows).toBe(150)
})

test('"auto" opts in: below the threshold renders every row normally, above it virtually', async ({ page }) => {
	await expectAutoAccepted(page)
	await expectVirtual(page, false, 'auto')
	expect((await state(page, 'auto')).rows).toBe(10)

	await setRows(page, 500, 'auto')
	await expectVirtual(page, true, 'auto')
	expect((await state(page, 'auto')).rows).toBeLessThan(100)
	expect((await state(page, 'auto')).hasSpacer).toBe(true)
})

test('"auto" set later on a default grid switches it to automatic', async ({ page }) => {
	await setRows(page, 150)
	await expectVirtual(page, false)
	await onGrid(page, (el: any) => el.setAttribute('enable-virtual-scroll', 'auto'))
	await expectVirtual(page, true)
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled)).toBeNull()
	expect(await page.evaluate(() => (window as any).rejected)).toEqual([])
})

test('"auto": items growing / shrinking across the threshold switches', async ({ page }) => {
	await expectAutoAccepted(page)
	await setRows(page, 19, 'auto')
	await expectVirtual(page, false, 'auto')
	expect((await state(page, 'auto')).rows).toBe(19)

	// the engine's rule: virtual from `threshold` rows on (>=)
	await setRows(page, 20, 'auto')
	await expectVirtual(page, true, 'auto')

	await setRows(page, 1000, 'auto')
	await expectVirtual(page, true, 'auto')
	expect((await state(page, 'auto')).rows).toBeLessThan(100)

	await setRows(page, 5, 'auto')
	await expectVirtual(page, false, 'auto')
	expect((await state(page, 'auto')).rows).toBe(5)
})

test('"auto": shrinking out of virtual mode while scrolled down shows the rows from the top', async ({ page }) => {
	await expectAutoAccepted(page)
	await setRows(page, 1000, 'auto')
	await expectVirtual(page, true, 'auto')
	await onGrid(page, (el: any) => { el.shadowRoot.querySelector('.wg').scrollTop = 20_000 }, 'auto')
	await expect.poll(() => onGrid(page, (el: any) => el.shadowRoot.querySelector('tbody tr.wg__row')?.getAttribute('data-row-index'), 'auto')).not.toBe('0')

	await setRows(page, 3, 'auto')
	await expectVirtual(page, false, 'auto')
	await expect(gridLocator(page, 'auto').locator('tbody').getByText('Row 1', { exact: true })).toBeVisible()
	expect((await state(page, 'auto')).rows).toBe(3)
})

test('"auto": a threshold change re-evaluates automatic mode', async ({ page }) => {
	await expectAutoAccepted(page)
	await expectVirtual(page, false, 'auto')
	await onGrid(page, (el: any) => { el.virtualScrollThreshold = 5 }, 'auto')
	await expectVirtual(page, true, 'auto')
	await onGrid(page, (el: any) => { el.setAttribute('virtual-scroll-threshold', '50') }, 'auto')
	await expectVirtual(page, false, 'auto')
})

test('the attribute forces it: enable-virtual-scroll on below / ="false" off above the threshold', async ({ page }) => {
	await expectVirtual(page, true, 'forcedOn')
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled, 'forcedOn')).toBe(true)

	await setRows(page, 500, 'forcedOff')
	await expectVirtual(page, false, 'forcedOff')
	expect((await state(page, 'forcedOff')).rows).toBe(500)
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled, 'forcedOff')).toBe(false)
})

test('the property: true / false force it, null = automatic, undefined = back to the default (off)', async ({ page }) => {
	await onGrid(page, (el: any) => { el.isVirtualScrollEnabled = true })
	await expectVirtual(page, true)

	await setRows(page, 500)
	await onGrid(page, (el: any) => { el.isVirtualScrollEnabled = false })
	await expectVirtual(page, false)

	// null = automatic: 500 rows reach the default threshold (100)
	await onGrid(page, (el: any) => { el.isVirtualScrollEnabled = null })
	await expectVirtual(page, true)
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled)).toBeNull()

	await onGrid(page, (el: any) => { el.isVirtualScrollEnabled = undefined })
	await expectVirtual(page, false)
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled)).toBe(false)
	expect((await state(page)).rows).toBe(500)
})

test('removing the attribute returns to the default (off)', async ({ page }) => {
	// forcedOn: 10 rows, forced virtual → normal rendering
	await onGrid(page, (el: any) => el.removeAttribute('enable-virtual-scroll'), 'forcedOn')
	await expectVirtual(page, false, 'forcedOn')
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled, 'forcedOn')).toBe(false)

	// auto: 500 rows, above the threshold → virtual, then off once the attribute goes
	await setRows(page, 500, 'auto')
	await expectVirtual(page, true, 'auto')
	await onGrid(page, (el: any) => el.removeAttribute('enable-virtual-scroll'), 'auto')
	await expectVirtual(page, false, 'auto')
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled, 'auto')).toBe(false)
	expect((await state(page, 'auto')).rows).toBe(500)
})

test('"auto": the focused cell keeps focus when items grow into virtual mode', async ({ page }) => {
	await expectAutoAccepted(page)
	await gridLocator(page, 'auto').locator('.wg__cell[data-row="2"][data-col="1"]').click()
	await expect.poll(() => activeRow(page, 'auto')).toBe('2')

	await setRows(page, 500, 'auto')
	await expectVirtual(page, true, 'auto')
	await expect.poll(() => activeRow(page, 'auto')).toBe('2')
})

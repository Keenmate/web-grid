import { test, expect, Page, gridLocator, onGrid } from './fixtures'

/**
 * Automatic virtual scroll (test/virtual-auto.html): `isVirtualScrollEnabled` unset → the grid goes
 * virtual once the displayed row count reaches `virtualScrollThreshold` (20 in the fixture), re-checked
 * when `items` grows / shrinks across it. Explicit `true` / `false` (attribute or property) force it;
 * removing the attribute / `undefined` / `null` returns to automatic.
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

const activeRow = (page: Page) => onGrid(page, (el: any) => el.shadowRoot.activeElement?.getAttribute('data-row') ?? null)

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr.wg__row').first()).toBeVisible()
})

test('unset = automatic: below the threshold renders every row normally', async ({ page }) => {
	await expectVirtual(page, false)
	expect((await state(page)).rows).toBe(10)
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled)).toBeNull()
})

test('unset = automatic: above the threshold renders virtually', async ({ page }) => {
	await setRows(page, 500)
	await expectVirtual(page, true)
	expect((await state(page)).rows).toBeLessThan(100)
	expect((await state(page)).hasSpacer).toBe(true)
})

test('items growing / shrinking across the threshold switches', async ({ page }) => {
	await setRows(page, 19)
	await expectVirtual(page, false)
	expect((await state(page)).rows).toBe(19)

	// the engine's rule: virtual from `threshold` rows on (>=)
	await setRows(page, 20)
	await expectVirtual(page, true)

	await setRows(page, 1000)
	await expectVirtual(page, true)
	expect((await state(page)).rows).toBeLessThan(100)

	await setRows(page, 5)
	await expectVirtual(page, false)
	expect((await state(page)).rows).toBe(5)
})

test('shrinking out of virtual mode while scrolled down shows the rows from the top', async ({ page }) => {
	await setRows(page, 1000)
	await expectVirtual(page, true)
	await onGrid(page, (el: any) => { el.shadowRoot.querySelector('.wg').scrollTop = 20_000 })
	await expect.poll(() => onGrid(page, (el: any) => el.shadowRoot.querySelector('tbody tr.wg__row')?.getAttribute('data-row-index'))).not.toBe('0')

	await setRows(page, 3)
	await expectVirtual(page, false)
	await expect(gridLocator(page).locator('tbody').getByText('Row 1', { exact: true })).toBeVisible()
	expect((await state(page)).rows).toBe(3)
})

test('a threshold change re-evaluates automatic mode', async ({ page }) => {
	await expectVirtual(page, false)
	await onGrid(page, (el: any) => { el.virtualScrollThreshold = 5 })
	await expectVirtual(page, true)
	await onGrid(page, (el: any) => { el.setAttribute('virtual-scroll-threshold', '50') })
	await expectVirtual(page, false)
})

test('the attribute forces it: enable-virtual-scroll on below / ="false" off above the threshold', async ({ page }) => {
	await expectVirtual(page, true, 'forcedOn')
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled, 'forcedOn')).toBe(true)

	await setRows(page, 500, 'forcedOff')
	await expectVirtual(page, false, 'forcedOff')
	expect((await state(page, 'forcedOff')).rows).toBe(500)
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled, 'forcedOff')).toBe(false)
})

test('the property forces it; undefined / null return to automatic', async ({ page }) => {
	await onGrid(page, (el: any) => { el.isVirtualScrollEnabled = true })
	await expectVirtual(page, true)

	await setRows(page, 500)
	await onGrid(page, (el: any) => { el.isVirtualScrollEnabled = false })
	await expectVirtual(page, false)

	await onGrid(page, (el: any) => { el.isVirtualScrollEnabled = undefined })
	await expectVirtual(page, true)
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled)).toBeNull()

	await onGrid(page, (el: any) => { el.isVirtualScrollEnabled = false })
	await expectVirtual(page, false)
	await onGrid(page, (el: any) => { el.isVirtualScrollEnabled = null })
	await expectVirtual(page, true)
})

test('removing the attribute returns to automatic', async ({ page }) => {
	// forcedOn: 10 rows, below the threshold → normal rendering
	await onGrid(page, (el: any) => el.removeAttribute('enable-virtual-scroll'), 'forcedOn')
	await expectVirtual(page, false, 'forcedOn')
	expect(await onGrid(page, (el: any) => el.isVirtualScrollEnabled, 'forcedOn')).toBeNull()

	// forcedOff: 500 rows, above the threshold → virtual
	await setRows(page, 500, 'forcedOff')
	await expectVirtual(page, false, 'forcedOff')
	await onGrid(page, (el: any) => el.removeAttribute('enable-virtual-scroll'), 'forcedOff')
	await expectVirtual(page, true, 'forcedOff')
})

test('the focused cell keeps focus when items grow into virtual mode', async ({ page }) => {
	await gridLocator(page).locator('.wg__cell[data-row="2"][data-col="1"]').click()
	await expect.poll(() => activeRow(page)).toBe('2')

	await setRows(page, 500)
	await expectVirtual(page, true)
	await expect.poll(() => activeRow(page)).toBe('2')
})

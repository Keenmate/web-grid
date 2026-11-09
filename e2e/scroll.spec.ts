import { test, expect, gridLocator, cell, onGrid, type Page } from './fixtures'

/**
 * The grid's own scrolls (rulebook D-CA-5 = A): keyboard moves and `scrollToRow()` scroll
 * the one container around the cell / row through core `scrollIntoContainer()` (never the
 * page), and every such scroll runs `beforeScrollCallback` first — `false` skips it, a
 * partial `options` replaces the defaults.
 *
 * Fixture: docs/test/scroll.html — #grid (top, 200px container), #below (below the fold),
 * #virtual (virtual scroll); 60 rows each, columns id / name.
 */

const PAGE = '/test/scroll.html'

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	for (const id of ['grid', 'below', 'virtual']) await expect(gridLocator(page, id).locator('tbody tr').first()).toBeVisible()
})

/** Where the row sits inside its grid's scroll container (px from the container's top / bottom). */
async function rowOffset(page: Page, gridId: string, rowIndex: number): Promise<{ top: number; bottom: number } | null> {
	return gridLocator(page, gridId).evaluate((el: any, rowIndex: number) => {
		const wg = el.shadowRoot.querySelector('.wg') as HTMLElement
		const tr = el.shadowRoot.querySelector(`tr[data-row-index="${rowIndex}"]`) as HTMLElement | null
		if (!tr) return null
		const c = wg.getBoundingClientRect(), r = tr.getBoundingClientRect()
		return { top: r.top - c.top, bottom: c.bottom - r.bottom }
	}, rowIndex)
}

test.describe('scrollToRow — a jump', () => {
	test('centres the row in the grid and brings a grid below the fold on screen', async ({ page }) => {
		expect(await page.evaluate(() => window.scrollY)).toBe(0)
		expect(await onGrid(page, (el: any) => el.scrollToRow(40), 'below')).toBe(true)
		// the grid came into the viewport (shouldRevealContainer)
		const box = await gridLocator(page, 'below').boundingBox()
		const vh = page.viewportSize()!.height
		expect(box!.y).toBeGreaterThanOrEqual(-1)
		expect(box!.y + box!.height).toBeLessThanOrEqual(vh + 1)
		// the row sits in the middle of the container, not at an edge
		const off = await rowOffset(page, 'below', 40)
		expect(off).not.toBeNull()
		expect(Math.abs(off!.top - off!.bottom)).toBeLessThan(40)
	})

	test('beforeScrollCallback gets the row, the source, the container and the options; false skips', async ({ page }) => {
		const result = await onGrid(page, async (el: any) => {
			const seen: any[] = []
			el.beforeScrollCallback = (ctx: any) => {
				seen.push({ source: ctx.source, rowIndex: ctx.rowIndex, row: ctx.row?.name, field: ctx.field,
					isWg: !!ctx.container?.classList.contains('wg'), options: ctx.options, hasController: !!ctx.controller })
				return false
			}
			const wg = el.shadowRoot.querySelector('.wg') as HTMLElement
			const before = wg.scrollTop
			const resolved = await el.scrollToRow(45)
			return { seen, resolved, moved: wg.scrollTop !== before }
		})
		expect(result.resolved).toBe(false)
		expect(result.moved).toBe(false)
		expect(result.seen).toEqual([{ source: 'scroll-to-row', rowIndex: 45, row: 'Row 46', field: null, isWg: true,
			options: { block: 'center', inline: 'nearest', behavior: 'auto', shouldRevealContainer: true }, hasController: true }])
	})

	test('a partial options object replaces the defaults', async ({ page }) => {
		await onGrid(page, async (el: any) => {
			el.beforeScrollCallback = () => ({ block: 'end' })
			await el.scrollToRow(30)
		})
		const off = await rowOffset(page, 'grid', 30)
		// aligned to the bottom of the container
		expect(Math.abs(off!.bottom)).toBeLessThan(20)
	})

	test('virtual scroll: false skips the index jump too', async ({ page }) => {
		const r = await onGrid(page, async (el: any) => {
			const sources: string[] = []
			el.beforeScrollCallback = (ctx: any) => { sources.push(ctx.source); return false }
			const wg = el.shadowRoot.querySelector('.wg') as HTMLElement
			const resolved = await el.scrollToRow(50)
			return { sources, resolved, top: wg.scrollTop }
		}, 'virtual')
		expect(r).toEqual({ sources: ['scroll-to-row'], resolved: false, top: 0 })
	})

	test('virtual scroll: the index jump follows the block too, below the sticky header', async ({ page }) => {
		const header = await gridLocator(page, 'virtual').evaluate((el: any) =>
			(el.shadowRoot.querySelector('thead th') as HTMLElement).getBoundingClientRect().bottom
			- (el.shadowRoot.querySelector('.wg') as HTMLElement).getBoundingClientRect().top)
		// default (centre): the row sits in the middle of the area under the header
		expect(await onGrid(page, (el: any) => el.scrollToRow(40), 'virtual')).toBe(true)
		let off = (await rowOffset(page, 'virtual', 40))!
		expect(Math.abs((off.top - header) - off.bottom)).toBeLessThan(6)
		// 'start': right under the sticky header, not hidden behind it
		await onGrid(page, async (el: any) => {
			el.beforeScrollCallback = () => ({ block: 'start' })
			await el.scrollToRow(20)
		}, 'virtual')
		off = (await rowOffset(page, 'virtual', 20))!
		expect(Math.abs(off.top - header)).toBeLessThan(3)
	})
})

test.describe('keyboard moves', () => {
	test('scroll only the grid container (the page stays put) and run beforeScrollCallback with the cell', async ({ page }) => {
		await onGrid(page, (el: any) => {
			;(window as any).__seen = []
			el.beforeScrollCallback = (ctx: any) => {
				(window as any).__seen.push({ source: ctx.source, rowIndex: ctx.rowIndex, field: ctx.field, block: ctx.options.block })
			}
		})
		await cell(page, 0, 1).click()
		for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown')
		await expect(cell(page, 12, 1)).toBeFocused()
		expect(await page.evaluate(() => window.scrollY)).toBe(0)
		const off = await rowOffset(page, 'grid', 12)
		expect(off!.bottom).toBeGreaterThanOrEqual(-1)
		const seen = await page.evaluate(() => (window as any).__seen)
		expect(seen.length).toBeGreaterThan(0)
		expect(seen.at(-1)).toEqual({ source: 'keyboard', rowIndex: 12, field: 'name', block: 'nearest' })
	})

	test('false from beforeScrollCallback keeps the container where it is', async ({ page }) => {
		await onGrid(page, (el: any) => { el.beforeScrollCallback = () => false })
		await cell(page, 0, 1).click()
		for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown')
		expect(await onGrid(page, (el: any) => el.shadowRoot.querySelector('.wg').scrollTop)).toBe(0)
	})
})

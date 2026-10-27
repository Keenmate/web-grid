import { test, expect, type Page, gridLocator, cell, onGrid, domEvents, clearEvents, waitForRows } from './fixtures'

/**
 * Pagination — client + server `paginationMode`, `pageSizes` selector,
 * `paginationLayout` / `paginationPosition`, `isPaginationShown: 'auto'`,
 * `getPaginationLabelsCallback` / `labels`.
 *
 * Fixture: docs/test/pagination.html — #grid: 23 rows, page-size 5, pageSizes
 * [5,10,25]; #server: server mode, totalItems 47, answers `data-request` with a
 * slice.
 */

const PAGE = '/test/pagination.html'

const pag = (page: Page, id = 'grid') => gridLocator(page, id).locator('.wg__pagination')
const btn = (page: Page, action: string, id = 'grid') => pag(page, id).locator(`.wg__pagination-btn[data-action="${action}"]`)
const info = (page: Page, id = 'grid') => pag(page, id).locator('.wg__pagination-info')
const rows = (page: Page, id = 'grid') => gridLocator(page, id).locator('tbody tr.wg__row')

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await waitForRows(page, 'server')
	await clearEvents(page, 'pagination')
})

test.describe('client pagination', () => {
	test('next / prev buttons page through, disabled at the ends; data-request {trigger: page}', async ({ page }) => {
		await expect(info(page)).toContainText('Page 1 of 5')
		await expect(info(page)).toContainText('23 items')
		await expect(btn(page, 'prev')).toBeDisabled()
		await btn(page, 'next').click()
		await expect(info(page)).toContainText('Page 2 of 5')
		await expect(cell(page, 0, 1)).toHaveText('Row 06')
		const reqs = await domEvents(page, 'data-request', 'grid')
		expect(reqs).toHaveLength(1)
		expect(reqs[0]).toMatchObject({ trigger: 'page', page: 2, pageSize: 5, skip: 5, mode: 'replace' })
		await onGrid(page, el => { el.currentPage = 5 })
		await expect(rows(page)).toHaveCount(3)
		await expect(btn(page, 'next')).toBeDisabled()
	})

	test('the page-size selector lists pageSizes, resets to page 1, fires {trigger: pageSize}', async ({ page }) => {
		await btn(page, 'next').click()
		await clearEvents(page, 'pagination')
		const select = pag(page).locator('.wg__pagination-select')
		await expect(select.locator('option')).toHaveText(['5', '10', '25'])
		await select.selectOption('10')
		await expect(rows(page)).toHaveCount(10)
		await expect(info(page)).toContainText('Page 1 of 3')
		expect(await onGrid(page, el => [el.pageSize, el.currentPage])).toEqual([10, 1])
		expect(await domEvents(page, 'data-request', 'grid')).toEqual([
			expect.objectContaining({ trigger: 'page-size', page: 1, pageSize: 10, skip: 0 })
		])
	})

	test('empty pageSizes hides the selector', async ({ page }) => {
		await onGrid(page, el => { el.pageSizes = [] })
		await expect(pag(page).locator('.wg__pagination-select')).toHaveCount(0)
		await expect(info(page)).toBeVisible()
	})

	test('paginationLayout picks and orders the parts', async ({ page }) => {
		await onGrid(page, el => { el.paginationLayout = 'first|previous|next|last' })
		const actions = await pag(page).locator('.wg__pagination-btn').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.action))
		expect(actions).toEqual(['first', 'prev', 'next', 'last'])
		await expect(info(page)).toHaveCount(0)
		await btn(page, 'last').click()
		expect(await onGrid(page, el => el.currentPage)).toBe(5)
		await btn(page, 'first').click()
		expect(await onGrid(page, el => el.currentPage)).toBe(1)

		await onGrid(page, el => el.setAttribute('pagination-layout', 'page-info|page-size'))
		await expect(pag(page).locator('.wg__pagination-btn')).toHaveCount(0)
		await expect(pag(page).locator('.wg__pagination-info + .wg__pagination-pagesize')).toHaveCount(1)
	})

	test('paginationPosition: top-* goes to the top area, bottom-* to the bottom; "|" renders both', async ({ page }) => {
		const top = gridLocator(page).locator('.wg__top-area .wg__pagination')
		const bottom = gridLocator(page).locator('.wg__bottom-area .wg__pagination')
		await expect(bottom).toHaveCount(1)
		await expect(top).toHaveCount(0)

		await onGrid(page, el => { el.paginationPosition = 'top-right' })
		await expect(top).toHaveCount(1)
		await expect(top).toHaveClass(/wg__pagination--right/)
		await expect(top).toHaveClass(/wg__pagination--top/)
		await expect(bottom).toHaveCount(0)

		await onGrid(page, el => el.setAttribute('pagination-position', 'top-left|bottom-left'))
		await expect(top).toHaveClass(/wg__pagination--left/)
		await expect(bottom).toHaveClass(/wg__pagination--left/)

		await onGrid(page, el => el.removeAttribute('pagination-position'))
		await expect(top).toHaveCount(0)
		await expect(bottom).not.toHaveClass(/--left|--right/)
	})

	test("isPaginationShown: 'auto' hides the bar on a single page, false always hides", async ({ page }) => {
		await onGrid(page, el => el.setAttribute('show-pagination', 'auto'))
		expect(await onGrid(page, el => el.isPaginationShown)).toBe('auto')
		await expect(pag(page)).toHaveCount(1)  // 5 pages
		await onGrid(page, el => { el.pageSize = 25 })
		await expect(rows(page)).toHaveCount(23)
		await expect(pag(page)).toHaveCount(0)  // 1 page
		await onGrid(page, el => { el.pageSize = 5; el.isPaginationShown = false })
		await expect(rows(page)).toHaveCount(5)
		await expect(pag(page)).toHaveCount(0)
		await onGrid(page, el => el.removeAttribute('show-pagination'))
		await expect(pag(page)).toHaveCount(1)
	})

	test('isPageable=false shows all rows and no bar', async ({ page }) => {
		await onGrid(page, el => el.removeAttribute('pageable'))
		await expect(rows(page)).toHaveCount(23)
		await expect(pag(page)).toHaveCount(0)
	})
})

test.describe('labels', () => {
	test('getPaginationLabelsCallback overrides the texts and gets the paging context', async ({ page }) => {
		await onGrid(page, el => {
			el.paginationLayout = 'first|previous|page-info|next|last|page-size'
			el.getPaginationLabelsCallback = (ctx: any) => {
				;(window as any).__labelsCtx = { currentPage: ctx.currentPage, totalPages: ctx.totalPages, totalItems: ctx.totalItems, pageSize: ctx.pageSize, hasController: !!ctx.controller }
				return { pageInfo: `Strana ${ctx.currentPage} z ${ctx.totalPages}`, itemCount: `${ctx.totalItems} položek`, next: 'Další', perPage: 'na stránku' }
			}
		})
		await expect(info(page)).toContainText('Strana 1 z 5')
		await expect(info(page)).toContainText('23 položek')
		await expect(btn(page, 'next')).toHaveText('Další')
		await expect(btn(page, 'first')).toHaveText('⏮')  // not overridden → default
		await expect(pag(page).locator('.wg__pagination-label')).toHaveText('na stránku')
		expect(await page.evaluate(() => (window as any).__labelsCtx)).toEqual({ currentPage: 1, totalPages: 5, totalItems: 23, pageSize: 5, hasController: true })
	})

	test('grid labels (paginationPageInfo / paginationItemCount templates) apply', async ({ page }) => {
		await onGrid(page, el => { el.labels = { paginationPageInfo: '{current}/{total}', paginationItemCount: 'n={count}', paginationNext: 'NEXT' } })
		await expect(info(page)).toContainText('1/5')
		await expect(info(page)).toContainText('n=23')
		await expect(btn(page, 'next')).toHaveText('NEXT')
		await expect(btn(page, 'prev')).toHaveText('◀')
	})
})

test.describe("paginationMode 'server'", () => {
	test('the grid does not slice items; totalItems drives the page count', async ({ page }) => {
		await expect(rows(page, 'server')).toHaveCount(10)
		await expect(info(page, 'server')).toContainText('Page 1 of 5')
		await expect(info(page, 'server')).toContainText('47 items')
	})

	test('next fires data-request {page, pageSize, skip}; the consumer swaps items', async ({ page }) => {
		await btn(page, 'next', 'server').click()
		expect(await domEvents(page, 'data-request', 'server')).toEqual([
			expect.objectContaining({ trigger: 'page', page: 2, pageSize: 10, skip: 10, mode: 'replace', sort: [] })
		])
		await expect(cell(page, 'server', 0, 1)).toHaveText('Row 11')
		await expect(info(page, 'server')).toContainText('Page 2 of 5')
	})

	test('page size change fires {trigger: pageSize, page: 1}', async ({ page }) => {
		await btn(page, 'next', 'server').click()
		await clearEvents(page, 'pagination')
		await pag(page, 'server').locator('.wg__pagination-select').selectOption('20')
		expect(await domEvents(page, 'data-request', 'server')).toEqual([
			expect.objectContaining({ trigger: 'page-size', page: 1, pageSize: 20, skip: 0 })
		])
		await expect(rows(page, 'server')).toHaveCount(20)
		await expect(info(page, 'server')).toContainText('Page 1 of 3')
	})

	test('a sort click fires {trigger: sort} with the sort state', async ({ page }) => {
		await onGrid(page, el => { el.sortMode = 'single' }, 'server')
		await gridLocator(page, 'server').locator('thead th.wg__header[data-field="name"] .wg__sort-indicator').click()
		const reqs = await domEvents(page, 'data-request', 'server')
		expect(reqs).toHaveLength(1)
		expect(reqs[0]).toMatchObject({ trigger: 'sort', sort: [{ column: 'name', direction: 'asc' }] })
	})
})

test.describe('beforePageChangeCallback', () => {
	/** Installs a hook recording its ctx; `answer` is what it returns (a Promise for 'async'). */
	async function hook(page: Page, id: string, answer: unknown) {
		await onGrid(page, (el, ) => {
			const w = window as any
			w.__pc = []
			el.beforePageChangeCallback = (ctx: any) => {
				w.__pc.push({ trigger: ctx.trigger, fromPage: ctx.fromPage, toPage: ctx.toPage, drafts: ctx.drafts.length, hasController: !!ctx.controller })
				const a = w.__pcAnswer
				if (a === 'async') return new Promise(r => { w.__pcResolve = r })
				return a
			}
		}, id)
		await page.evaluate(a => { (window as any).__pcAnswer = a }, answer as any)
	}
	const calls = (page: Page) => page.evaluate(() => (window as any).__pc)

	test('pager buttons: ctx { trigger: page, fromPage, toPage, drafts }; nothing returned → continue', async ({ page }) => {
		await hook(page, 'grid', undefined)
		await btn(page, 'next').click()
		await expect(info(page)).toContainText('Page 2 of 5')
		expect(await calls(page)).toEqual([{ trigger: 'page', fromPage: 1, toPage: 2, drafts: 0, hasController: true }])
		await btn(page, 'prev').click()
		expect((await calls(page))[1]).toMatchObject({ fromPage: 2, toPage: 1 })
	})

	test('false → stay on the page (no data-request)', async ({ page }) => {
		await hook(page, 'grid', false)
		await clearEvents(page, 'pagination')
		await btn(page, 'next').click()
		await expect(info(page)).toContainText('Page 1 of 5')
		expect(await domEvents(page, 'data-request', 'grid')).toEqual([])
	})

	test('a number → go to that page instead', async ({ page }) => {
		await hook(page, 'grid', 4)
		await btn(page, 'next').click()
		await expect(info(page)).toContainText('Page 4 of 5')
	})

	test('page-size change: trigger pageSize, toPage 1; false keeps the size and the select', async ({ page }) => {
		await hook(page, 'grid', false)
		const select = pag(page).locator('.wg__pagination-select')
		await select.selectOption('10')
		expect(await calls(page)).toEqual([expect.objectContaining({ trigger: 'page-size', fromPage: 1, toPage: 1 })])
		expect(await onGrid(page, el => el.pageSize)).toBe(5)
		await expect(select).toHaveValue('5')
	})

	test('async: the pager is disabled while pending, a second click is ignored, then it continues', async ({ page }) => {
		await hook(page, 'grid', 'async')
		await btn(page, 'next').click()
		await expect(btn(page, 'next')).toBeDisabled()
		await expect(pag(page).locator('.wg__pagination-select')).toBeDisabled()
		await expect(pag(page)).toHaveAttribute('aria-busy', 'true')
		// even a forced click (disabled attribute removed) is ignored while pending
		await onGrid(page, el => { const b = el.shadowRoot.querySelector('.wg__pagination-btn[data-action="next"]'); b.disabled = false; b.click() })
		expect(await calls(page)).toHaveLength(1)
		await page.evaluate(() => (window as any).__pcResolve())
		await expect(info(page)).toContainText('Page 2 of 5')
		await expect(btn(page, 'next')).toBeEnabled()
		await expect(pag(page)).not.toHaveAttribute('aria-busy', 'true')
	})

	test('async false → stays and re-enables the pager', async ({ page }) => {
		await hook(page, 'grid', 'async')
		await btn(page, 'next').click()
		await page.evaluate(() => (window as any).__pcResolve(false))
		await expect(btn(page, 'next')).toBeEnabled()
		await expect(info(page)).toContainText('Page 1 of 5')
	})

	test('programmatic currentPage writes skip it; a client-mode sort skips it', async ({ page }) => {
		await hook(page, 'grid', false)
		await onGrid(page, el => { el.currentPage = 3; el.sortMode = 'single' })
		await expect(info(page)).toContainText('Page 3 of 5')
		await gridLocator(page).locator('thead th.wg__header[data-field="name"] .wg__sort-indicator').click()
		expect(await calls(page)).toEqual([])
	})

	test('server mode: a header sort runs it (trigger sort, toPage 1); false keeps the sort', async ({ page }) => {
		await hook(page, 'server', false)
		await onGrid(page, el => { el.sortMode = 'single' }, 'server')
		await btn(page, 'next', 'server').click()   // hook says false → stays on 1
		await page.evaluate(() => { (window as any).__pc = []; })
		await clearEvents(page, 'pagination')
		await gridLocator(page, 'server').locator('thead th.wg__header[data-field="name"] .wg__sort-indicator').click()
		expect(await calls(page)).toEqual([expect.objectContaining({ trigger: 'sort', fromPage: 1, toPage: 1 })])
		expect(await onGrid(page, el => el.sort, 'server')).toEqual([])
		expect(await domEvents(page, 'data-request', 'server')).toEqual([])
		// allowed → sorted + data-request
		await page.evaluate(() => { (window as any).__pcAnswer = undefined })
		await gridLocator(page, 'server').locator('thead th.wg__header[data-field="name"] .wg__sort-indicator').click()
		expect(await onGrid(page, el => el.sort, 'server')).toEqual([{ column: 'name', direction: 'asc' }])
		expect(await domEvents(page, 'data-request', 'server')).toEqual([expect.objectContaining({ trigger: 'sort' })])
	})

	test('ctx.drafts lists unsaved drafts (force "save before leaving the page")', async ({ page }) => {
		await onGrid(page, el => { el.isEditable = true; el.columns = el.columns.map((c: any) => c.field === 'name' ? { ...c, editor: 'text' } : c) })
		await hook(page, 'grid', undefined)
		await page.evaluate(() => {
			const el = document.getElementById('grid') as any
			el.beforePageChangeCallback = (ctx: any) => ctx.drafts.length === 0
		})
		await cell(page, 0, 1).dblclick()
		await page.keyboard.type('!')
		await page.keyboard.press('Enter')
		await expect.poll(() => onGrid(page, el => el.getDrafts().length)).toBe(1)
		await btn(page, 'next').click()
		await expect(info(page)).toContainText('Page 1 of 5')
		await onGrid(page, el => el.discardAllDrafts())
		await btn(page, 'next').click()
		await expect(info(page)).toContainText('Page 2 of 5')
	})
})

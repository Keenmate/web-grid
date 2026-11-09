import { test, expect, Page, gridLocator, cell } from './fixtures'

/**
 * Loading states draw through core renderLoader() (SPEC §12.14): the default
 * `<span class="wg__loader">`, the page-wide `window.components.renderLoadingCallback`,
 * the instance `renderLoadingCallback` (beats the page hook), and remove() cleans up.
 *
 * - 'row'    — the infinite-scroll load-more row (/test/tree-scroll.html, #isGrid)
 * - 'search' — the autocomplete editor's async search (/test/dropdowns.html, assignee)
 */

const ROW_GRID = 'web-grid#isGrid'

async function holdLoadMore(page: Page) {
	await page.goto('/test/tree-scroll.html')
	await expect(page.locator('[data-testid="vs-rendered-rows"]')).not.toHaveText('?')
	await expect(page.locator('[data-testid="vs-rendered-rows"]')).not.toHaveText('0')
	// Hold the request: no items appended until the test answers
	await page.locator(ROW_GRID).evaluate((el: any) => { el.onDataRequest = () => {} })
}

async function scrollToLoadMore(page: Page) {
	await page.locator(ROW_GRID).evaluate((el: any) => { el.shadowRoot.querySelector('.wg').scrollTop = 2800 })
}

const indicator = (page: Page) => page.locator(`${ROW_GRID} .wg__loading-more-indicator`)

test.describe('infinite-scroll row loader', () => {
	test('default loader with role=status + aria-label; gone when answered', async ({ page }) => {
		await holdLoadMore(page)
		await scrollToLoadMore(page)
		await expect(indicator(page)).toHaveAttribute('role', 'status')
		await expect(indicator(page)).toHaveAttribute('aria-label', 'Loading…')
		await expect(indicator(page).locator('.wg__loader')).toHaveCount(1)
		await expect(indicator(page).locator('.wg__loader')).toHaveAttribute('aria-hidden', 'true')
		const anim = await indicator(page).locator('.wg__loader').evaluate(el => {
			const cs = getComputedStyle(el)
			return { name: cs.animationName, duration: cs.animationDuration }
		})
		expect(anim).toEqual({ name: 'wg-loader-spin', duration: '0.8s' })
		await page.locator(ROW_GRID).evaluate((el: any) => { el.hasMoreItems = false })
		await expect(page.locator(`${ROW_GRID} .wg__loading-more-row`)).toHaveCount(0)
	})

	test('reduced motion slows the loader (never stops)', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' })
		await holdLoadMore(page)
		await scrollToLoadMore(page)
		await expect(indicator(page).locator('.wg__loader')).toHaveCSS('animation-duration', '1.5s')
	})

	test('page hook replaces it; instance renderLoadingCallback beats the page hook; cleanup runs', async ({ page }) => {
		await holdLoadMore(page)
		await page.evaluate(() => {
			const w = window as any
			w.__cleanups = []
			w.components.renderLoadingCallback = ({ component, context, containerElement, label }: any) => {
				containerElement.innerHTML = `<i class="page-loader" data-ctx="${component}|${context}|${label}"></i>`
				return () => w.__cleanups.push('page')
			}
		})
		await scrollToLoadMore(page)
		await expect(indicator(page).locator('.page-loader')).toHaveAttribute('data-ctx', 'web-grid|row|Loading…')
		await expect(indicator(page).locator('.wg__loader')).toHaveCount(0)
		// Answered → the row goes and the hook's cleanup runs
		await page.locator(ROW_GRID).evaluate((el: any) => { el.hasMoreItems = false })
		await expect(page.locator(`${ROW_GRID} .wg__loading-more-row`)).toHaveCount(0)
		expect(await page.evaluate(() => (window as any).__cleanups)).toEqual(['page'])

		// Instance hook wins over the page hook
		await page.locator(ROW_GRID).evaluate((el: any) => {
			el.renderLoadingCallback = ({ context, containerElement }: any) => {
				containerElement.innerHTML = `<b class="own-loader">${context}</b>`
			}
		})
		await page.locator(ROW_GRID).evaluate((el: any) => { el.hasMoreItems = true; el.shadowRoot.querySelector('.wg').scrollTop = 0 })
		await page.waitForTimeout(100)
		await scrollToLoadMore(page)
		await expect(indicator(page).locator('.own-loader')).toHaveText('row')
		await expect(indicator(page).locator('.page-loader')).toHaveCount(0)
	})
})

test.describe('async dropdown search loader', () => {
	const COL_ASSIGNEE = 4

	async function holdSearch(page: Page, setup?: () => Promise<void>) {
		await page.goto('/test/dropdowns.html')
		await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
		await setup?.()
		// Searches wait for window.__release()
		await page.locator('web-grid#grid').evaluate((el: any) => {
			const w = window as any
			el.columns = el.columns.map((c: any) => c.field !== 'assignee' ? c : {
				...c,
				editorOptions: {
					...c.editorOptions,
					searchCallback: () => new Promise(resolve => { w.__release = () => resolve([]) }),
				},
			})
		})
		await cell(page, 0, COL_ASSIGNEE).click()
		await page.keyboard.press('F2')
		await cell(page, 0, COL_ASSIGNEE).locator('.wg__autocomplete-input').pressSequentially('a')
	}

	const searchIndicator = (page: Page) => gridLocator(page).locator('.wg__loading-indicator')

	test('default loader in the editor while the search is in flight', async ({ page }) => {
		await holdSearch(page)
		await expect(searchIndicator(page)).toBeVisible()
		await expect(searchIndicator(page)).toHaveAttribute('role', 'status')
		await expect(searchIndicator(page)).toHaveAttribute('aria-label', 'Searching…')
		await expect(searchIndicator(page).locator('.wg__loader')).toHaveCount(1)
		await page.evaluate(() => (window as any).__release())
		await expect(searchIndicator(page)).toBeHidden()
		await expect(searchIndicator(page).locator('.wg__loader')).toHaveCount(0)
		await expect(searchIndicator(page)).not.toHaveAttribute('role', 'status')
	})

	test('instance renderLoadingCallback draws the search loader (context search)', async ({ page }) => {
		await holdSearch(page, async () => {
		await page.evaluate(() => {
			(window as any).components.renderLoadingCallback = ({ containerElement }: any) => {
				containerElement.innerHTML = '<i class="page-loader"></i>'
			}
		})
		await page.locator('web-grid#grid').evaluate((el: any) => {
			el.renderLoadingCallback = ({ context, containerElement }: any) => {
				containerElement.innerHTML = `<b class="own-loader">${context}</b>`
			}
		})
		})
		await expect(searchIndicator(page).locator('.own-loader')).toHaveText('search')
		await expect(searchIndicator(page).locator('.page-loader')).toHaveCount(0)
	})
})

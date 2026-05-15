import { test, expect, Page } from '@playwright/test'

/**
 * E2E coverage for virtual scrolling + infinite scrolling
 * (docs/test/virtual-scroll.html).
 *
 * #grid renders 1,000 rows with virtual scroll enabled — the body only
 * contains a small window of rendered <tr class="wg__row"> elements plus
 * `wg__spacer-top` / `wg__spacer-bottom` rows that account for the off-screen
 * height. Each rendered row carries `data-row-index` (the absolute item
 * index), so we can assert which rows are currently in the DOM.
 *
 * #infiniteGrid loads 200 items at a time up to 600 via ondatarequest
 * (trigger='loadMore', mode='append'); the state panel logs each request.
 */

const PAGE = '/test/virtual-scroll.html'

function gridLocator(page: Page) {
	return page.locator('web-grid#grid')
}

function infiniteGrid(page: Page) {
	return page.locator('web-grid#infiniteGrid')
}

async function gotoVirtualScroll(page: Page) {
	await page.goto(PAGE)
	// Wait for the first paint + the virtual-scroll resize-observer settle.
	await expect(page.locator('[data-testid="rendered-rows"]')).not.toHaveText('?')
	await expect(page.locator('[data-testid="rendered-rows"]')).not.toHaveText('0')
}

async function scrollInner(page: Page, gridSel: string, scrollTop: number) {
	await page.locator(gridSel).evaluate((el: any, top) => {
		el.shadowRoot.querySelector('.wg').scrollTop = top
	}, scrollTop)
	// Virtual-scroll repaints on scroll events; give the next frame time to render.
	await page.waitForTimeout(120)
}

// =============================================================================
// Virtual scroll (#grid)
// =============================================================================

test.describe('virtual scroll — 1,000 rows', () => {
	test('renders only a small window of rows (not all 1,000)', async ({ page }) => {
		await gotoVirtualScroll(page)

		// items.length is 1000 but rendered <tr.wg__row> count should be ~12–25,
		// depending on viewport height. Assert it's well under 100.
		const renderedText = await page.locator('[data-testid="rendered-rows"]').textContent()
		const rendered = parseInt(renderedText || '0', 10)
		expect(rendered).toBeGreaterThan(5)
		expect(rendered).toBeLessThan(100)
	})

	test('off-screen height lives in spacer rows, not real rows', async ({ page }) => {
		await gotoVirtualScroll(page)

		// At scrollTop=0 there's no top spacer, but bottom spacer covers the rest:
		// (1000 - rendered) * 38px.
		const bottomText = await page.locator('[data-testid="bottom-spacer"]').textContent()
		const bottom = parseInt(bottomText || '0', 10)
		expect(bottom).toBeGreaterThan(30_000) // 1000-ish rows of 38px ≈ 38_000

		// Top spacer is 0 at the start (we haven't scrolled).
		await expect(page.locator('[data-testid="top-spacer"]')).toHaveText('0')

		// First rendered row is item index 0.
		await expect(page.locator('[data-testid="first-rendered"]')).toHaveText('0')
	})

	test('scrolling shifts the rendered window forward', async ({ page }) => {
		await gotoVirtualScroll(page)

		await expect(page.locator('[data-testid="first-rendered"]')).toHaveText('0')

		// Scroll 5000px down → first rendered row should be around 5000/38 ≈ 131
		// (minus the 5-row buffer).
		await scrollInner(page, 'web-grid#grid', 5000)

		const firstText = await page.locator('[data-testid="first-rendered"]').textContent()
		const first = parseInt(firstText || '0', 10)
		expect(first).toBeGreaterThan(100)
		expect(first).toBeLessThan(150)

		// Top spacer should grow as we scroll down.
		const topText = await page.locator('[data-testid="top-spacer"]').textContent()
		expect(parseInt(topText || '0', 10)).toBeGreaterThan(3000)
	})

	test('scrolling to the bottom renders the last items', async ({ page }) => {
		await gotoVirtualScroll(page)

		// items[999] is "Employee 1000" — invisible until we scroll near the bottom.
		await expect(gridLocator(page).locator('tbody').getByText('Employee 1000')).toHaveCount(0)

		await scrollInner(page, 'web-grid#grid', 999 * 38)

		await expect(gridLocator(page).locator('tbody').getByText('Employee 1000')).toBeVisible()

		// Bottom spacer should be at or near zero.
		const bottomText = await page.locator('[data-testid="bottom-spacer"]').textContent()
		expect(parseInt(bottomText || '0', 10)).toBeLessThan(1000)
	})

	test('items off-screen are NOT in the DOM (sanity check)', async ({ page }) => {
		await gotoVirtualScroll(page)

		// At scrollTop=0, far-down items like "Employee 800" must not be rendered.
		await expect(gridLocator(page).locator('tbody').getByText('Employee 800')).toHaveCount(0)

		// Likewise after scrolling far down, items near the top drop out.
		await scrollInner(page, 'web-grid#grid', 30_000)
		await expect(gridLocator(page).locator('tbody').getByText('Employee 1', { exact: true })).toHaveCount(0)
	})
})

// =============================================================================
// Infinite scroll (#infiniteGrid)
// =============================================================================

test.describe('infinite scroll', () => {
	test('starts with one batch loaded', async ({ page }) => {
		await gotoVirtualScroll(page)

		await expect(page.locator('[data-testid="loaded-items"]')).toHaveText('200')
		await expect(page.locator('[data-testid="has-more"]')).toHaveText('true')
	})

	test('scrolling near the bottom triggers a loadMore append request', async ({ page }) => {
		await gotoVirtualScroll(page)

		// Scroll the infinite grid near the bottom of its current 200 items.
		// 200 * 38 = 7600, viewport ~380, threshold 100 → trigger around 7100.
		await scrollInner(page, 'web-grid#infiniteGrid', 7200)

		// First entry of the request log should be a loadMore append for skip=200.
		const firstReq = page.locator('[data-testid="datarequest-log"] .row').first()
		await expect(firstReq).toContainText('trigger=loadMore')
		await expect(firstReq).toContainText('mode=append')

		// After the handler appended a batch, item count should grow.
		await expect(page.locator('[data-testid="loaded-items"]')).toHaveText('400')
	})

	test('hasMoreItems flips to false at the cap', async ({ page }) => {
		await gotoVirtualScroll(page)

		// Walk the scroll position past each batch boundary until MAX=600 is reached.
		// We don't depend on exact pixel positions for the trigger; we just keep
		// scrolling to the new bottom until the handler stops appending.
		const grid = infiniteGrid(page)
		for (let pass = 0; pass < 5; pass++) {
			const loaded = parseInt((await page.locator('[data-testid="loaded-items"]').textContent()) || '0', 10)
			if (loaded >= 600) break
			await scrollInner(page, 'web-grid#infiniteGrid', loaded * 38 - 200)
		}

		await expect(page.locator('[data-testid="loaded-items"]')).toHaveText('600')
		await expect(page.locator('[data-testid="has-more"]')).toHaveText('false')
	})
})

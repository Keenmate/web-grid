import { test, expect, Page } from './fixtures'

/**
 * E2E coverage for tree-mode combined with virtual + infinite scroll
 * (docs/test/tree-scroll.html).
 *
 * #vsGrid: 850-row tree (50 roots × 4 subs × 3 teams), expandLevel=1,
 * virtual scroll on. Initial render shows roots + their subs (550 visible items)
 * but only a window (~22 rows) is in the DOM.
 *
 * #isGrid: infinite scroll appends batches of 5 root subtrees each, capped at
 * MAX=20 roots. data-request is awaited inside the handler so the batch
 * appears only after the simulated fetch resolves.
 */

const PAGE = '/test/tree-scroll.html'

function vsGrid(page: Page) {
	return page.locator('web-grid#vsGrid')
}

function isGrid(page: Page) {
	return page.locator('web-grid#isGrid')
}

async function gotoTreeScroll(page: Page) {
	await page.goto(PAGE)
	// Wait for the virtual-scroll first paint + tree expansion.
	await expect(page.locator('[data-testid="vs-rendered-rows"]')).not.toHaveText('?')
	await expect(page.locator('[data-testid="vs-rendered-rows"]')).not.toHaveText('0')
}

async function scrollInner(page: Page, gridSel: string, scrollTop: number) {
	await page.locator(gridSel).evaluate((el: any, top) => {
		el.shadowRoot.querySelector('.wg').scrollTop = top
	}, scrollTop)
	await page.waitForTimeout(150)
}

// =============================================================================
// Tree + virtual scroll
// =============================================================================

test.describe('tree + virtual scroll (#vsGrid)', () => {
	test('850-row tree renders only a small window of rows', async ({ page }) => {
		await gotoTreeScroll(page)

		await expect(page.locator('[data-testid="vs-total-items"]')).toHaveText('850')

		const rendered = parseInt(
			(await page.locator('[data-testid="vs-rendered-rows"]').textContent()) || '0',
			10
		)
		expect(rendered).toBeGreaterThan(5)
		expect(rendered).toBeLessThan(50)
	})

	test('expandLevel=1 expands all roots', async ({ page }) => {
		await gotoTreeScroll(page)

		// 50 roots are expanded on initial paint.
		await expect(page.locator('[data-testid="vs-expanded-count"]')).toHaveText('50')

		// Sub rows are visible (level 1, "Sub 1.1" comes after the first root).
		await expect(vsGrid(page).locator('tbody').getByText('Sub 1.1')).toBeVisible()
		// Team rows are level 2 and not yet expanded — first team isn't in DOM.
		await expect(vsGrid(page).locator('tbody').getByText('Team 1.1.1')).toHaveCount(0)
	})

	test('expand all reveals leaf rows; collapse all leaves only roots', async ({ page }) => {
		await gotoTreeScroll(page)

		await page.locator('#expand').click()
		// expandAll() adds every path (including leaves) to expandedPaths — 850.
		await expect(page.locator('[data-testid="vs-expanded-count"]')).toHaveText('850')

		// Leaf-level team rows now render in the DOM (Team 1.1.1 right after roots' subs).
		await expect(vsGrid(page).locator('tbody').getByText('Team 1.1.1')).toBeVisible()

		await page.locator('#collapse').click()
		// All expanded paths cleared.
		await expect(page.locator('[data-testid="vs-expanded-count"]')).toHaveText('0')

		// Only the 50 roots are visible now — no sub rows.
		await expect(vsGrid(page).locator('tbody').getByText('Sub 1.1')).toHaveCount(0)
	})

	test('clicking a root chevron collapses its subtree', async ({ page }) => {
		await gotoTreeScroll(page)

		// Sub 1.1 is visible initially (root r1 is expanded).
		await expect(vsGrid(page).locator('tbody').getByText('Sub 1.1')).toBeVisible()

		// Collapse r1.
		await vsGrid(page).locator('.wg__tree-chevron[data-tree-toggle="r1"]').first().click()

		// Sub 1.1 leaves the DOM.
		await expect(vsGrid(page).locator('tbody').getByText('Sub 1.1')).toHaveCount(0)
		// And the expanded-paths count dropped by one.
		await expect(page.locator('[data-testid="vs-expanded-count"]')).toHaveText('49')
	})

	test('scrolling reveals rows that were not in the DOM before', async ({ page }) => {
		await gotoTreeScroll(page)

		// Org 30 sits roughly at visible index 29 * 5 = 145, scrollTop ≈ 145 * 38 = 5510.
		// Before scrolling it's outside the rendered window.
		await expect(vsGrid(page).locator('tbody').getByText('Org 30', { exact: true })).toHaveCount(0)

		await scrollInner(page, 'web-grid#vsGrid', 5500)

		await expect(vsGrid(page).locator('tbody').getByText('Org 30', { exact: true })).toBeVisible()
	})
})

// =============================================================================
// Tree + infinite scroll
// =============================================================================

test.describe('tree + infinite scroll (#isGrid)', () => {
	test('starts with one batch of root subtrees', async ({ page }) => {
		await gotoTreeScroll(page)

		// BATCH=5 roots × (1 + 4*(1+3)) = 5 * 17 = 85 rows.
		await expect(page.locator('[data-testid="is-loaded-items"]')).toHaveText('85')
		await expect(page.locator('[data-testid="is-has-more"]')).toHaveText('true')
	})

	test('scrolling near the bottom appends another subtree batch', async ({ page }) => {
		await gotoTreeScroll(page)

		// 85 rows × 38px ≈ 3230px scrollable; viewport ~380; threshold 100.
		// Scrolling to ~2800 should trigger load-more.
		await scrollInner(page, 'web-grid#isGrid', 2800)

		// After fetch settles, items count goes 85 → 170 (one more batch of 5 roots).
		await expect(page.locator('[data-testid="is-loaded-items"]')).toHaveText('170')

		// Request log shows the load-more.
		await expect(page.locator('[data-testid="is-req-log"] .row').first())
			.toContainText('trigger=load-more')
	})

	test('a pending load-more shows the labels.loading row until the request is answered', async ({ page }) => {
		await gotoTreeScroll(page)
		// Hold the request: no items appended until the test sets them
		await page.locator('web-grid#isGrid').evaluate((el: any) => { el.onDataRequest = () => {} })
		await scrollInner(page, 'web-grid#isGrid', 2800)
		const row = page.locator('web-grid#isGrid .wg__loading-more')
		await expect(row).toHaveText('Loading…')
		await expect(row.locator('.wg__loading-more-indicator')).toHaveAttribute('role', 'status')
		// Answered with "nothing more" (an items assignment clears it the same way)
		await page.locator('web-grid#isGrid').evaluate((el: any) => { el.hasMoreItems = false })
		await expect(row).toHaveCount(0)
	})

	test('hasMore flips to false once MAX roots have been loaded', async ({ page }) => {
		await gotoTreeScroll(page)

		// MAX=20 roots / BATCH=5 per fetch → 4 batches total. We start with batch 1.
		// Keep scrolling to the new bottom until items.length reaches 20*17=340.
		for (let pass = 0; pass < 6; pass++) {
			const loaded = parseInt(
				(await page.locator('[data-testid="is-loaded-items"]').textContent()) || '0',
				10
			)
			if (loaded >= 340) break
			await scrollInner(page, 'web-grid#isGrid', loaded * 38 - 200)
		}

		await expect(page.locator('[data-testid="is-loaded-items"]')).toHaveText('340')
		await expect(page.locator('[data-testid="is-has-more"]')).toHaveText('false')
	})
})

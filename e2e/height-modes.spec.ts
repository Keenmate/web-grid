import { test, expect, Page, gridLocator } from './fixtures'

/**
 * E2E coverage for height modes (test/height-modes.html). Two grids:
 *   #containerGrid — host capped with `max-height: 200px`; the `.wg` scroll
 *                    container inherits the cap and scrolls internally (30 rows).
 *   #fullGrid      — host has no cap and `isTableBorderOnly = true`; the grid sizes
 *                    to its content, the scroll container moves to
 *                    `.wg__table-container`, and `.wg` gets the
 *                    `wg--table-border-only` class (6 rows, all fit).
 *
 * We assert on the structural / scroll consequences, not exact pixel heights —
 * the actual layout maths is browser-driven.
 */

const PAGE = '/test/height-modes.html'

async function gotoHeightModes(page: Page) {
	await page.goto(PAGE)
	await expect(gridLocator(page, 'containerGrid').locator('tbody tr').first()).toBeVisible()
	await expect(gridLocator(page, 'fullGrid').locator('tbody tr').first()).toBeVisible()
}

// =============================================================================
// #containerGrid — capped, internal scroll
// =============================================================================

test.describe('container mode — #containerGrid', () => {
	test('the .wg scroll container inherits the max-height cap', async ({ page }) => {
		await gotoHeightModes(page)

		const wg = gridLocator(page, 'containerGrid').locator('.wg')
		const clientHeight = await wg.evaluate(el => (el as HTMLElement).clientHeight)

		// Host cap is 200px; allow a little slop for borders.
		expect(clientHeight).toBeLessThanOrEqual(210)
		expect(clientHeight).toBeGreaterThan(100)
	})

	test('content past the cap makes .wg scroll internally', async ({ page }) => {
		await gotoHeightModes(page)

		const wg = gridLocator(page, 'containerGrid').locator('.wg')
		const { scrollHeight, clientHeight } = await wg.evaluate(el => ({
			scrollHeight: (el as HTMLElement).scrollHeight,
			clientHeight: (el as HTMLElement).clientHeight
		}))

		// 30 rows well exceed the 200px cap → there is overflow to scroll.
		expect(scrollHeight).toBeGreaterThan(clientHeight)
	})

	test('all 30 rows are rendered (capping scrolls, it does not paginate)', async ({ page }) => {
		await gotoHeightModes(page)
		await expect(gridLocator(page, 'containerGrid').locator('tbody tr')).toHaveCount(30)
	})

	test('the header is position:sticky and stays pinned when the body scrolls', async ({ page }) => {
		await gotoHeightModes(page)

		const wg = gridLocator(page, 'containerGrid').locator('.wg')
		const headerCell = gridLocator(page, 'containerGrid').locator('thead th.wg__header').first()

		// The header is sticky-positioned.
		const position = await headerCell.evaluate(el => getComputedStyle(el).position)
		expect(position).toBe('sticky')

		// Scroll the container down; the header must remain at the top of the
		// visible area (its top ≈ the container's top).
		await wg.evaluate(el => { (el as HTMLElement).scrollTop = 400 })

		const [wgBox, headerBox] = await Promise.all([
			wg.boundingBox(),
			headerCell.boundingBox()
		])
		if (!wgBox || !headerBox) throw new Error('Missing bounding box')
		expect(Math.abs(headerBox.y - wgBox.y)).toBeLessThan(4)
	})
})

// =============================================================================
// #fullGrid — isTableBorderOnly, sizes to content
// =============================================================================

test.describe('full-height mode — #fullGrid (isTableBorderOnly)', () => {
	test('the .wg container gets the wg--table-border-only modifier class', async ({ page }) => {
		await gotoHeightModes(page)

		await expect(gridLocator(page, 'fullGrid').locator('.wg'))
			.toHaveClass(/wg--table-border-only/)
	})

	test('with isTableBorderOnly the scroll container moves to .wg__table-container', async ({ page }) => {
		await gotoHeightModes(page)
		await expect(gridLocator(page, 'fullGrid').locator('.wg__table-container')).toHaveCount(1)
	})

	test('with no max-height cap the grid sizes to content — no internal scroll', async ({ page }) => {
		await gotoHeightModes(page)

		// 6 rows, no cap → the scroll container fits all content (no overflow).
		const container = gridLocator(page, 'fullGrid').locator('.wg__table-container')
		const { scrollHeight, clientHeight } = await container.evaluate(el => ({
			scrollHeight: (el as HTMLElement).scrollHeight,
			clientHeight: (el as HTMLElement).clientHeight
		}))
		expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 2)
	})
})

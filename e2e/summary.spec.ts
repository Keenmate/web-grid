import { test, expect, type Page, gridLocator, cell, onGrid, waitForRows, editCell } from './fixtures'

/**
 * Summary — `renderSummaryCallback` (ctx: items / allItems / totalItems /
 * currentPage / pageSize / metadata), `summaryPosition`, `isSummaryInline`,
 * `summaryMetadata`; re-rendered after paging and edits.
 *
 * Fixture: docs/test/summary.html — 7 rows (qty 1..7), page-size 3,
 * summary-position="bottom-right".
 */

const PAGE = '/test/summary.html'

const summary = (page: Page) => gridLocator(page).locator('.wg__summary')
const text = (page: Page) => gridLocator(page).getByTestId('sum')
const nextBtn = (page: Page) => gridLocator(page).locator('.wg__pagination-btn[data-action="next"]')

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
})

test('renders the callback HTML with the page context', async ({ page }) => {
	await expect(text(page)).toHaveText('page=1 size=3 shown=3 all=7 total=7 sum=6 meta=-')
	expect(await page.evaluate(() => (window as any).lastSummaryCtx)).toEqual({ hasController: true })
	await expect(summary(page)).toHaveClass(/wg__summary--right/)
	await expect(gridLocator(page).locator('.wg__bottom-area .wg__summary')).toHaveCount(1)
})

test('recomputes after paging', async ({ page }) => {
	await nextBtn(page).click()
	await expect(text(page)).toHaveText('page=2 size=3 shown=3 all=7 total=7 sum=15 meta=-')
})

test('summaryMetadata is passed through and re-renders when set', async ({ page }) => {
	await onGrid(page, el => { el.summaryMetadata = { serverSum: 28 } })
	await expect(text(page)).toContainText('meta={"serverSum":28}')
})

test('totalItems (server mode) feeds ctx.totalItems', async ({ page }) => {
	await onGrid(page, el => { el.paginationMode = 'server'; el.totalItems = 120 })
	await expect(text(page)).toContainText('total=120')
})

test('re-renders after an edit (the commit is surgical — no full render)', async ({ page }) => {
	const before = await page.evaluate(() => (window as any).summaryCalls)
	await editCell(page, cell(page, 0, 1), '10')
	await expect.poll(() => page.evaluate(() => (window as any).summaryCalls)).toBeGreaterThan(before)
	await expect(text(page)).toHaveCount(1)
})

test('ctx.drafts lets the sum see the edited (draft) value', async ({ page }) => {
	await editCell(page, cell(page, 0, 1), '10')
	await expect(text(page)).toContainText('sum=15', { timeout: 2000 })  // 10 + 2 + 3
	await expect(gridLocator(page).getByTestId('drafts')).toHaveText('drafts=1 delta=9')
})

test('ctx.drafts lists drafts on other pages too (server aggregates adjusted by the delta)', async ({ page }) => {
	await editCell(page, cell(page, 0, 1), '10')
	await nextBtn(page).click()
	await expect(text(page)).toContainText('page=2')
	await expect(gridLocator(page).getByTestId('drafts')).toHaveText('drafts=1 delta=9')
	// server paging: page 2's rows replace items — the page-1 draft is still listed
	await onGrid(page, el => { el.paginationMode = 'server'; el.totalItems = 7; el.items = [{ id: 4, qty: 4 }, { id: 5, qty: 5 }, { id: 6, qty: 6 }] })
	await expect(gridLocator(page).getByTestId('drafts')).toHaveText('drafts=1 delta=9')
	expect(await onGrid(page, el => el.getDrafts())).toEqual([
		{ row: { id: 1, qty: 1 }, draftRow: { id: 1, qty: 10 }, changedFields: ['qty'], isValid: true }
	])
})

test('summaryPosition: top-left goes to the top area; removal → no summary', async ({ page }) => {
	await onGrid(page, el => el.setAttribute('summary-position', 'top-left'))
	await expect(gridLocator(page).locator('.wg__top-area .wg__summary')).toHaveClass(/wg__summary--left/)
	await expect(gridLocator(page).locator('.wg__top-area .wg__summary')).toHaveClass(/wg__summary--top/)
	await onGrid(page, el => el.removeAttribute('summary-position'))
	await expect(summary(page)).toHaveCount(0)
})

test('isSummaryInline: same area as pagination → one shared footer; false → separate blocks', async ({ page }) => {
	// default: summary bottom-right + pagination bottom-center, inline → one .wg__footer
	await expect(gridLocator(page).locator('.wg__bottom-area .wg__footer')).toHaveCount(1)
	await expect(gridLocator(page).locator('.wg__footer .wg__summary')).toHaveCount(1)
	await expect(gridLocator(page).locator('.wg__footer .wg__pagination')).toHaveCount(1)

	await onGrid(page, el => el.setAttribute('summary-inline', 'false'))
	await expect(gridLocator(page).locator('.wg__footer')).toHaveCount(0)
	await expect(gridLocator(page).locator('.wg__bottom-area > .wg__summary')).toHaveCount(1)
	await expect(gridLocator(page).locator('.wg__bottom-area > .wg__pagination')).toHaveCount(1)
})

test('no renderSummaryCallback → no summary', async ({ page }) => {
	await onGrid(page, el => { el.renderSummaryCallback = undefined })
	await expect(summary(page)).toHaveCount(0)
})

import { test, expect, type Page, gridLocator, cell, header, onGrid, waitForRows, editCell } from './fixtures'

/**
 * Tooltips — column `getTooltipCallback` / `tooltipMember` / `isTooltipHtml`,
 * header `headerInfo`, validation tooltips (column and grid
 * `getValidationTooltipCallback`, plain error fallback), `tooltipShowDelay` /
 * `tooltipHideDelay`.
 *
 * Fixture: docs/test/tooltip.html — delays 0/0; cols 0=name, 1=note, 2=rich,
 * 3=code (validated, column validation tooltip), 4=qty (validated).
 */

const PAGE = '/test/tooltip.html'

const tip = (page: Page) => gridLocator(page).locator('.wg__tooltip')
const tipContent = (page: Page) => gridLocator(page).locator('.wg__tooltip .wg__tooltip-content')

/** Hover the centre of a locator via the mouse (the tooltip listens for capture-phase mouseenter). */
async function hover(page: Page, target: ReturnType<typeof cell>) {
	await page.mouse.move(0, 0)
	await target.hover()
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
})

test.describe('cell tooltips', () => {
	test('getTooltipCallback text (from the raw value), shown in the shadow root', async ({ page }) => {
		await expect(cell(page, 0, 0)).toHaveAttribute('data-tooltip', 'Name: Alpha')
		await hover(page, cell(page, 0, 0))
		await expect(tip(page)).toHaveClass(/wg__tooltip--visible/)
		await expect(tipContent(page)).toHaveText('Name: Alpha')
	})

	test('moving to another cell swaps the text; leaving hides it', async ({ page }) => {
		await hover(page, cell(page, 0, 0))
		await expect(tipContent(page)).toHaveText('Name: Alpha')
		await hover(page, cell(page, 1, 0))
		await expect(tipContent(page)).toHaveText('Name: Beta')
		await page.mouse.move(5, 5)
		await expect(tip(page)).toHaveCount(0)
	})

	test('tooltipMember reads the row field; no value → no tooltip', async ({ page }) => {
		await expect(cell(page, 0, 1)).toHaveAttribute('data-tooltip', 'Hint one')
		await expect(cell(page, 1, 1)).not.toHaveAttribute('data-tooltip', /./)
	})

	test('isTooltipHtml renders markup (data-tooltip-html)', async ({ page }) => {
		await hover(page, cell(page, 0, 2))
		await expect(tipContent(page).locator('b')).toHaveText('bold')
		await expect(tipContent(page)).toHaveText('bold r1')
	})

	test('tooltip text containing double quotes survives (attribute is escaped)', async ({ page }) => {
		await onGrid(page, el => { el.items = [{ ...el.items[0], name: 'Say "hi"' }, el.items[1]] })
		await expect(cell(page, 0, 0)).toHaveAttribute('data-tooltip', 'Name: Say "hi"', { timeout: 2000 })
	})

	test('row data cannot inject attributes through the tooltip (NOTES.md #21)', async ({ page }) => {
		await onGrid(page, el => { el.items = [{ ...el.items[0], name: `x" data-injected="1' onclick='1` }, el.items[1]] })
		await expect(cell(page, 0, 0)).toHaveAttribute('data-tooltip', `Name: x" data-injected="1' onclick='1`, { timeout: 2000 })
		await expect(gridLocator(page).locator('[data-injected], td[onclick]')).toHaveCount(0)
	})

	test('plain tooltips escape markup', async ({ page }) => {
		await onGrid(page, el => { el.items = [{ ...el.items[0], name: '<b>x</b>' }, el.items[1]] })
		await hover(page, cell(page, 0, 0))
		await expect(tipContent(page)).toHaveText('Name: <b>x</b>')
		await expect(tipContent(page).locator('b')).toHaveCount(0)
	})

	test('headerInfo shows an ⓘ icon with a tooltip', async ({ page }) => {
		const info = header(page, 'code').locator('.wg__header-info')
		await expect(info).toHaveAttribute('data-tooltip', 'Unique code')
		await hover(page, info)
		await expect(tipContent(page)).toHaveText('Unique code')
	})
})

test.describe('validation tooltips', () => {
	/** The validation tooltip attribute only appears on a full render (NOTES.md #22) — force one. */
	const fullRender = (page: Page) => onGrid(page, el => { el.isStriped = !el.isStriped })

	test('the error tooltip is there right after the failed commit', async ({ page }) => {
		test.fail(true, 'NOTES.md #22')
		await editCell(page, cell(page, 1, 4), '-5')
		await expect(cell(page, 1, 4)).toHaveClass(/wg__cell--invalid/)
		await expect(cell(page, 1, 4)).toHaveAttribute('data-tooltip', 'Must not be negative', { timeout: 2000 })
	})

	test('column getValidationTooltipCallback renders HTML for an invalid cell', async ({ page }) => {
		await editCell(page, cell(page, 0, 3), 'x1')
		await expect(cell(page, 0, 3)).toHaveClass(/wg__cell--invalid/)
		await fullRender(page)
		await hover(page, cell(page, 0, 3))
		await expect(tipContent(page).locator('i')).toHaveText('Fix: Code must be 3 capital letters')
	})

	test('without a callback the plain error message is the tooltip', async ({ page }) => {
		await editCell(page, cell(page, 1, 4), '-5')
		await fullRender(page)
		await expect(cell(page, 1, 4)).toHaveAttribute('data-tooltip', 'Must not be negative')
	})

	test('grid-level getValidationTooltipCallback applies to columns without their own', async ({ page }) => {
		await onGrid(page, el => { el.getValidationTooltipCallback = (ctx: any) => `<u>${ctx.field}: ${ctx.error}</u>` })
		await editCell(page, cell(page, 1, 4), '-5')
		await fullRender(page)
		await hover(page, cell(page, 1, 4))
		await expect(tipContent(page).locator('u')).toHaveText('qty: Must not be negative')
	})
})

test.describe('delays', () => {
	test('tooltipShowDelay postpones the tooltip', async ({ page }) => {
		await onGrid(page, el => el.setAttribute('tooltip-show-delay', '700'))
		expect(await onGrid(page, el => el.tooltipShowDelay)).toBe(700)
		await hover(page, cell(page, 0, 0))
		await page.waitForTimeout(300)
		await expect(tip(page)).toHaveCount(0)
		await expect(tip(page)).toHaveClass(/wg__tooltip--visible/, { timeout: 2000 })
	})

	test('tooltipHideDelay keeps it up after leaving', async ({ page }) => {
		test.fail(true, 'NOTES.md #23')
		await onGrid(page, el => { el.tooltipHideDelay = 700 })
		await hover(page, cell(page, 0, 0))
		await expect(tip(page)).toHaveClass(/wg__tooltip--visible/)
		await page.mouse.move(5, 5)
		await page.waitForTimeout(300)
		await expect(tip(page)).toHaveClass(/wg__tooltip--visible/)
		await expect(tip(page)).toHaveCount(0, { timeout: 2000 })
	})

	test('removing the delay attributes restores the defaults (200 / 100)', async ({ page }) => {
		await onGrid(page, el => { el.removeAttribute('tooltip-show-delay'); el.removeAttribute('tooltip-hide-delay') })
		expect(await onGrid(page, el => [el.tooltipShowDelay, el.tooltipHideDelay])).toEqual([200, 100])
	})
})

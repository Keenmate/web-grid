import { test, expect, type Page, gridLocator, cell, onGrid, waitForRows, header } from './fixtures'

/**
 * Row toolbar options — `toolbarTrigger` 'click' / 'button', `toolbarPosition`
 * 'left' / 'right' / 'top', `toolbarHorizontalAlign`, `toolbarColumn`,
 * `toolbarVerticalAlign`, attribute removal.
 *
 * Fixture: docs/test/toolbar-options.html — 4 rows inside a padded stage so
 * floating-ui keeps the preferred side; toolbar-trigger="click"; items
 * add / delete / ping.
 */

const PAGE = '/test/toolbar-options.html'

const toolbar = (page: Page) => gridLocator(page).locator('.wg__toolbar-container .wg__toolbar')
const row = (page: Page, r: number) => gridLocator(page).locator(`tr[data-row-index="${r}"]`)
const box = async (l: ReturnType<typeof row>) => {
	const b = await l.boundingBox()
	if (!b) throw new Error('no box')
	return b
}

/** Open the toolbar on a row by clicking its name cell (click trigger). */
async function openByClick(page: Page, r: number) {
	await cell(page, r, 1).click()
	await expect(toolbar(page)).toBeVisible()
	// floating-ui positions asynchronously — wait for the final placement
	await expect(toolbar(page)).toHaveCSS('visibility', 'visible')
	await page.waitForTimeout(50)
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
})

test.describe('toolbarTrigger', () => {
	test("'click': clicking a row opens its toolbar, clicking it again closes it; hover alone does nothing", async ({ page }) => {
		await cell(page, 2, 1).hover()
		await page.waitForTimeout(150)
		await expect(toolbar(page)).toHaveCount(0)
		await openByClick(page, 2)
		await toolbar(page).locator('[data-id="ping"]').click()
		await expect.poll(() => page.evaluate(() => (window as any).__pinged)).toBe(1)
		await expect(toolbar(page)).toBeVisible()  // a custom item keeps the toolbar open
		await cell(page, 2, 1).click()            // a second click on the row closes it
		await expect(toolbar(page)).toHaveCount(0)
	})

	test("'button': an actions column with a trigger per row toggles the toolbar", async ({ page }) => {
		await onGrid(page, el => el.setAttribute('toolbar-trigger', 'button'))
		await expect(gridLocator(page).locator('thead th.wg__actions-column')).toHaveCount(1)
		const trigger = gridLocator(page).locator('.wg__toolbar-trigger[data-toolbar-trigger="1"]')
		await expect(trigger).toBeVisible()
		await cell(page, 1, 1).click()  // a plain row click does not open it in button mode
		await page.waitForTimeout(100)
		await expect(toolbar(page)).toHaveCount(0)
		await trigger.click()
		await expect(toolbar(page)).toBeVisible()
		await trigger.click()
		await expect(toolbar(page)).toHaveCount(0)
	})

	test('removing toolbar-trigger restores hover', async ({ page }) => {
		await onGrid(page, el => el.removeAttribute('toolbar-trigger'))
		expect(await onGrid(page, el => el.toolbarTrigger)).toBe('hover')
	})
})

test.describe('toolbarPosition', () => {
	test("'left' / 'right' place the toolbar beside the row", async ({ page }) => {
		await onGrid(page, el => { el.toolbarPosition = 'left' })
		await openByClick(page, 1)
		let t = await box(toolbar(page))
		const r = await box(row(page, 1))
		expect(t.x + t.width).toBeLessThanOrEqual(r.x + 2)

		await cell(page, 1, 1).click()  // close
		await onGrid(page, el => { el.toolbarPosition = 'right' })
		await openByClick(page, 2)
		t = await box(toolbar(page))
		const r2 = await box(row(page, 2))
		expect(t.x).toBeGreaterThanOrEqual(r2.x + r2.width - 2)
	})

	test("'top' places it above the row; toolbarHorizontalAlign start / end", async ({ page }) => {
		await onGrid(page, el => { el.toolbarPosition = 'top'; el.toolbarHorizontalAlign = 'start' })
		await openByClick(page, 2)
		const r = await box(row(page, 2))
		let t = await box(toolbar(page))
		expect(t.y + t.height).toBeLessThanOrEqual(r.y + 2)
		expect(Math.abs(t.x - r.x)).toBeLessThan(40)

		await cell(page, 2, 1).click()
		await onGrid(page, el => el.setAttribute('toolbar-horizontal-align', 'end'))
		await openByClick(page, 2)
		t = await box(toolbar(page))
		expect(Math.abs((t.x + t.width) - (r.x + r.width))).toBeLessThan(40)
	})

	test("toolbarColumn pins a 'top' toolbar over that column (field or index)", async ({ page }) => {
		await onGrid(page, el => { el.toolbarPosition = 'top'; el.toolbarColumn = 'city' })
		await openByClick(page, 1)
		const city = await box(header(page, 'city'))
		const t = await box(toolbar(page))
		const centre = t.x + t.width / 2
		expect(centre).toBeGreaterThan(city.x - 40)
		expect(centre).toBeLessThan(city.x + city.width + 40)
	})

	test("toolbarPosition 'inline' renders an actions column instead of a floating toolbar", async ({ page }) => {
		await onGrid(page, el => el.setAttribute('toolbar-position', 'inline'))
		await expect(gridLocator(page).locator('thead th.wg__inline-actions-header')).toHaveCount(1)
		await expect(gridLocator(page).locator('tr[data-row-index="0"] .wg__inline-actions-cell [data-id="ping"]')).toHaveCount(1)
		await cell(page, 0, 1).click()
		await page.waitForTimeout(100)
		await expect(toolbar(page)).toHaveCount(0)
		// inlineActionsTitle relabels the header
		await onGrid(page, el => el.setAttribute('inline-actions-title', 'Ops'))
		await expect(gridLocator(page).locator('thead th.wg__inline-actions-header')).toHaveText('Ops')
	})
})

test('the inline actions header defaults to labels.inlineActionsHeader ("Actions")', async ({ page }) => {
	await onGrid(page, el => el.setAttribute('toolbar-position', 'inline'))
	await expect(gridLocator(page).locator('thead th.wg__inline-actions-header')).toHaveText('Actions', { timeout: 1500 })
	await onGrid(page, el => { el.labels = { inlineActionsHeader: 'Akce' } })
	await expect(gridLocator(page).locator('thead th.wg__inline-actions-header')).toHaveText('Akce')
})

test('an explicit empty inline-actions-title blanks the header; removing it restores the label', async ({ page }) => {
	await onGrid(page, el => { el.setAttribute('toolbar-position', 'inline'); el.setAttribute('inline-actions-title', '') })
	const th = gridLocator(page).locator('thead th.wg__inline-actions-header')
	await expect(th).toHaveCount(1)
	await expect(th).toHaveText('')
	await onGrid(page, el => { el.removeAttribute('inline-actions-title') })
	await expect(th).toHaveText('Actions')
	await onGrid(page, el => { el.inlineActionsTitle = '' })
	await expect(th).toHaveText('')
})

test('an invalid toolbar-position is rejected (previous kept)', async ({ page }) => {
	await onGrid(page, el => el.setAttribute('toolbar-position', 'diagonal'))
	expect(await onGrid(page, el => el.toolbarPosition)).toBe('auto')
})

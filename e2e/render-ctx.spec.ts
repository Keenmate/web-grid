import { test, expect, type Page, gridLocator, cell, waitForRows } from './fixtures'

/**
 * Render-callback ctx: every callback ctx the grid builds carries `labels` (core LabelsView), `isReadonly` and
 * `isDisabled` (the grid's disabled state); a change of labels / locale / translateCallback /
 * the page-wide locale / isReadonly / disabled re-runs the rendered callbacks IN PLACE (same table element,
 * selection + active cell kept; an open dropdown re-fills and stays open). The web-treeview aea0d30 model.
 *
 * Fixture: test/render-ctx.html (see its header).
 */

const L = 'Delete row'
const rendered = (page: Page, row = 0) => cell(page, row, 0).locator('span.r')
const summary = (page: Page) => gridLocator(page).locator('.wg__summary span.s')
const perPage = (page: Page) => gridLocator(page).locator('.wg__pagination-label')
const options = (page: Page) => gridLocator(page).locator('.wg__dropdown .wg__dropdown-option')

/** Tag the current table element so a later check proves it was kept (in-place re-render). */
async function tagTable(page: Page, id = 'grid'): Promise<void> {
	await page.evaluate((id) => { (window as any).__table = document.getElementById(id)!.shadowRoot!.querySelector('.wg__table') }, id)
}
async function isSameTable(page: Page, id = 'grid'): Promise<boolean> {
	return page.evaluate((id) => (window as any).__table === document.getElementById(id)!.shadowRoot!.querySelector('.wg__table'), id)
}

test.beforeEach(async ({ page }) => {
	await page.goto('/test/render-ctx.html')
	await waitForRows(page)
	await waitForRows(page, 'tree')
})

test('every render ctx carries labels / isReadonly / isDisabled', async ({ page }) => {
	await expect(rendered(page)).toHaveText(`${L}|ro=false|dis=false`)
	await expect(cell(page, 0, 0)).toHaveAttribute('data-tooltip', `T:${L}|ro=false|dis=false`)
	await expect(summary(page)).toHaveText(`S:${L}|ro=false|dis=false`)
	await expect(perPage(page)).toHaveText(`P:${L}|ro=false`)
	await expect(gridLocator(page, 'tree').locator('b.c').first()).toHaveText('ro=false:Expand')
})

test('isReadonly re-runs the callbacks in place (same table, selection kept)', async ({ page }) => {
	await page.evaluate(() => (document.getElementById('grid') as any).controller.selectRow(1))
	await tagTable(page)
	await page.evaluate(() => { (document.getElementById('grid') as any).isReadonly = true })
	await expect(rendered(page)).toHaveText(`${L}|ro=true|dis=false`)
	await expect(cell(page, 0, 0)).toHaveAttribute('data-tooltip', `T:${L}|ro=true|dis=false`)
	await expect(summary(page)).toHaveText(`S:${L}|ro=true|dis=false`)
	await expect(perPage(page)).toHaveText(`P:${L}|ro=true`)
	expect(await isSameTable(page)).toBe(true)
	expect(await page.evaluate(() => (document.getElementById('grid') as any).controller.selectedRowIndices)).toEqual([1])
})

test('labels re-run the callbacks in place and keep the active cell', async ({ page }) => {
	await cell(page, 1, 0).click()
	await expect(cell(page, 1, 0)).toBeFocused()
	await tagTable(page)
	await page.evaluate(() => { (document.getElementById('grid') as any).labels = { 'menuItems.deleteRow': 'Smazat' } })
	await expect(rendered(page)).toHaveText('Smazat|ro=false|dis=false')
	await expect(summary(page)).toHaveText('S:Smazat|ro=false|dis=false')
	await expect(perPage(page)).toHaveText('P:Smazat|ro=false')
	expect(await isSameTable(page)).toBe(true)
	await expect(cell(page, 1, 0)).toBeFocused()
})

test('isDisabled re-runs the callbacks (on and off)', async ({ page }) => {
	await page.evaluate(() => { (document.getElementById('grid') as any).isDisabled = true })
	await expect(rendered(page)).toHaveText(`${L}|ro=false|dis=true`)
	await expect(summary(page)).toHaveText(`S:${L}|ro=false|dis=true`)
	await page.evaluate(() => { (document.getElementById('grid') as any).isDisabled = false })
	await expect(rendered(page)).toHaveText(`${L}|ro=false|dis=false`)
})

test('translateCallback and the page-wide locale re-run the callbacks', async ({ page }) => {
	await page.evaluate(() => {
		(document.getElementById('grid') as any).translateCallback = ({ key }: { key: string }) => key === 'web-grid.menuItems.deleteRow' ? 'Löschen' : null
	})
	await expect(rendered(page)).toHaveText('Löschen|ro=false|dis=false')
	await page.evaluate(() => {
		(document.getElementById('grid') as any).translateCallback = null;
		(window as any).components.locale = { labels: { 'web-grid.menuItems.deleteRow': 'Odstranit' } }
	})
	await expect(rendered(page)).toHaveText('Odstranit|ro=false|dis=false')
	await expect(summary(page)).toHaveText('S:Odstranit|ro=false|dis=false')
	await page.evaluate(() => { (window as any).components.locale = null })
})

test('the cached tree chevrons re-run on a readonly / labels change', async ({ page }) => {
	const chevron = gridLocator(page, 'tree').locator('b.c').first()
	await expect(chevron).toHaveText('ro=false:Expand')
	await page.evaluate(() => { (document.getElementById('tree') as any).isReadonly = true })
	await expect(chevron).toHaveText('ro=true:Expand')
	await page.evaluate(() => { (document.getElementById('tree') as any).labels = { 'menuItems.expand': 'Rozbalit' } })
	await expect(chevron).toHaveText('ro=true:Rozbalit')
})

test('an open dropdown re-fills in place on a labels change; the option flag is isOptionDisabled', async ({ page }) => {
	await cell(page, 0, 1).click()
	await page.keyboard.press('F2')
	await expect(options(page)).toHaveCount(3)
	await expect(options(page).nth(0)).toHaveText(`${L}:Active:opt=false|dis=false`)
	await expect(options(page).nth(2)).toHaveText(`${L}:Gone:opt=true|dis=false`)
	await page.evaluate(() => { (document.getElementById('grid') as any).labels = { 'menuItems.deleteRow': 'Smazat' } })
	await expect(options(page).nth(0)).toHaveText('Smazat:Active:opt=false|dis=false')
	await expect(gridLocator(page).locator('.wg__dropdown')).toBeVisible()
	await expect(rendered(page)).toHaveText('Smazat|ro=false|dis=false')
})

test('an unrelated input keeps the ctx values (no stale or missing fields)', async ({ page }) => {
	await page.evaluate(() => { (document.getElementById('grid') as any).isReadonly = true })
	await expect(rendered(page)).toHaveText(`${L}|ro=true|dis=false`)
	await page.evaluate(() => { (document.getElementById('grid') as any).isStriped = true })
	await expect(rendered(page)).toHaveText(`${L}|ro=true|dis=false`)
})

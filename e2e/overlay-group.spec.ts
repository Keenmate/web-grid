import { test, expect, type Page, gridLocator, cell } from './fixtures'

/**
 * `overlay-group` (docs/test/overlay-group.html): the cell dropdown and the date editor (col 2)
 * join the core overlay tree in the grid's group. #ga = group "a", #gb = group "b", #gd = unset (the default group). The other
 * overlay is a page createPopover() per group (`window.__pop.a / .b / .default`) — it opens without
 * taking focus, so the grid's own close-on-blur stays out of the way (two GRID dropdowns are never
 * open together: focusing the second grid blurs the first one's editor, which closes it).
 */

const PAGE = '/test/overlay-group.html'

type Pop = 'a' | 'b' | 'default'
type Pops = { __pop: Record<string, { open(): void; isOpen: boolean }> }

async function load(page: Page): Promise<void> {
	await page.goto(PAGE)
	await expect(gridLocator(page, 'ga').locator('tbody tr.wg__row').first()).toBeVisible()
}

/** Focus row 0's status cell, F2 → its select dropdown is open. */
async function openDropdown(page: Page, id: string): Promise<void> {
	await cell(page, id, 0, 1).click()
	await page.keyboard.press('F2')
	await expect(gridLocator(page, id).locator('.wg__dropdown')).toBeVisible()
	await page.waitForTimeout(100)
}

const dropdowns = (page: Page, id: string) => gridLocator(page, id).locator('.wg__dropdown')
const openPop = (page: Page, key: Pop) => page.evaluate((key) => (window as unknown as Pops).__pop[key].open(), key)
const isPopOpen = (page: Page, key: Pop) => page.evaluate((key) => (window as unknown as Pops).__pop[key].isOpen, key)

test.describe('overlay-group', () => {
	test('the attribute sets the property; unset = null', async ({ page }) => {
		await load(page)
		const groups = await page.evaluate(() => ['ga', 'gb', 'gd'].map((id) => (document.getElementById(id) as unknown as { overlayGroup: string | null }).overlayGroup))
		expect(groups).toEqual(['a', 'b', null])
	})

	test('different group: another overlay opening leaves the dropdown open (both open together)', async ({ page }) => {
		await load(page)
		await openDropdown(page, 'ga')
		await openPop(page, 'b')
		await openPop(page, 'default')
		await page.waitForTimeout(100)
		await expect(dropdowns(page, 'ga')).toHaveCount(1)
		expect(await isPopOpen(page, 'b')).toBe(true)
		expect(await isPopOpen(page, 'default')).toBe(true)
	})

	test('different group: the dropdown opening leaves the other overlays open', async ({ page }) => {
		await load(page)
		await openPop(page, 'a')
		await openPop(page, 'default')
		await openDropdown(page, 'gb')
		expect(await isPopOpen(page, 'a')).toBe(true)
		expect(await isPopOpen(page, 'default')).toBe(true)
	})

	test('same group: another overlay opening closes the dropdown', async ({ page }) => {
		await load(page)
		await openDropdown(page, 'ga')
		await openPop(page, 'a')
		await expect(dropdowns(page, 'ga')).toHaveCount(0)
		expect(await isPopOpen(page, 'a')).toBe(true)
	})

	test('same group: the dropdown opening closes the other overlay', async ({ page }) => {
		await load(page)
		await openPop(page, 'b')
		await openDropdown(page, 'gb')
		expect(await isPopOpen(page, 'b')).toBe(false)
	})

	test('unset: the default group, as before', async ({ page }) => {
		await load(page)
		await openDropdown(page, 'gd')
		await openPop(page, 'a')
		await page.waitForTimeout(100)
		await expect(dropdowns(page, 'gd')).toHaveCount(1)
		await openPop(page, 'default')
		await expect(dropdowns(page, 'gd')).toHaveCount(0)
	})

	test('a changed group applies at the next open', async ({ page }) => {
		await load(page)
		await page.evaluate(() => { (document.getElementById('gd') as unknown as { overlayGroup: string }).overlayGroup = 'b' })
		await openDropdown(page, 'gd')
		await openPop(page, 'default')
		await page.waitForTimeout(100)
		await expect(dropdowns(page, 'gd')).toHaveCount(1)
		await openPop(page, 'b')
		await expect(dropdowns(page, 'gd')).toHaveCount(0)
	})

	test('the date editor: same group closes it (saved), another group leaves it open', async ({ page }) => {
		await load(page)
		await cell(page, 'ga', 0, 2).click()
		await page.keyboard.press('F2')
		const picker = gridLocator(page, 'ga').locator('.wg-datepicker')
		await expect(picker).toBeVisible()
		await page.waitForTimeout(100)
		await openPop(page, 'b')
		await openPop(page, 'default')
		await page.waitForTimeout(100)
		await expect(picker).toHaveCount(1)
		await openPop(page, 'a')
		await expect(picker).toHaveCount(0)
		await expect(gridLocator(page, 'ga').locator('.wg__cell--editing')).toHaveCount(0)
		await expect(cell(page, 'ga', 0, 2)).toContainText('2026-06-10')
	})

	test('the date editor opening closes a same-group overlay', async ({ page }) => {
		await load(page)
		await openPop(page, 'b')
		await cell(page, 'gb', 0, 2).click()
		await page.keyboard.press('F2')
		await expect(gridLocator(page, 'gb').locator('.wg-datepicker')).toBeVisible()
		expect(await isPopOpen(page, 'b')).toBe(false)
	})
})

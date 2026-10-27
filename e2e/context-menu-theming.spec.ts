import { test, expect, Page, gridLocator, cell, header, menuRoot } from './fixtures'

/**
 * The context menus' CSS-variable chain (web-components-core SPEC §12.13):
 *   --wg-context-menu-* (this grid) → --km-menu-* (every menu on the page) → --base-* → core default.
 * The grid maps --wg-context-menu-X onto core's private --_km-menu-X with no
 * fallback, so an unset grid variable falls through to a page-level --km-menu-X
 * on :root. One set themes both the cell and the header menu.
 * Fixture: /test/contextmenu.html (no --base-* theme loaded).
 */

const PAGE = '/test/contextmenu.html'
const COL_NAME = 1

async function openCellMenu(page: Page) {
	const target = cell(page, 'grid', 0, COL_NAME)
	await target.scrollIntoViewIfNeeded()
	const box = await target.boundingBox()
	if (!box) throw new Error('No box')
	// Let the scroll from scrollIntoViewIfNeeded land first — a scroll closes an open menu
	await page.mouse.move(box.x + 20, box.y + 10)
	await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
	await target.dispatchEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: box.x + 20, clientY: box.y + 10 })
	await expect(menuRoot(page)).toBeVisible()
}

async function openHeaderMenu(page: Page) {
	const target = header(page, 'gridHeader', 'name')
	await target.scrollIntoViewIfNeeded()
	const box = await target.boundingBox()
	if (!box) throw new Error('No box')
	// Let the scroll from scrollIntoViewIfNeeded land first — a scroll closes an open menu
	await page.mouse.move(box.x + 20, box.y + 10)
	await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
	await target.dispatchEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: box.x + 20, clientY: box.y + 10 })
	await expect(menuRoot(page)).toBeVisible()
}

async function closeMenu(page: Page) {
	await page.keyboard.press('Escape')
	await expect(menuRoot(page)).toHaveCount(0)
}

const setRoot = (page: Page, name: string, value: string) =>
	page.evaluate(([n, v]) => document.documentElement.style.setProperty(n!, v!), [name, value])
const setGrid = (page: Page, id: string, name: string, value: string) =>
	gridLocator(page, id).evaluate((el, [n, v]) => (el as HTMLElement).style.setProperty(n!, v!), [name, value])

test.describe('context menu — CSS variable chain', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(PAGE)
		await expect(gridLocator(page, 'grid').locator('tbody tr').first()).toBeVisible()
	})

	test('a page-level --km-menu-bg on :root themes the menu when --wg-context-menu-bg is unset', async ({ page }) => {
		await setRoot(page, '--km-menu-bg', 'rgb(10, 20, 30)')
		await setRoot(page, '--km-menu-item-padding', '9px 21px')
		await openCellMenu(page)
		await expect(menuRoot(page)).toHaveCSS('background-color', 'rgb(10, 20, 30)')
		await expect(menuRoot(page).locator('.km-menu__item').first()).toHaveCSS('padding', '9px 21px')
	})

	test('--wg-context-menu-bg on the grid wins over the page-level --km-menu-bg', async ({ page }) => {
		await setRoot(page, '--km-menu-bg', 'rgb(10, 20, 30)')
		await setGrid(page, 'grid', '--wg-context-menu-bg', 'rgb(1, 2, 3)')
		await openCellMenu(page)
		await expect(menuRoot(page)).toHaveCSS('background-color', 'rgb(1, 2, 3)')
	})

	test('the grid variable is per instance and themes the header menu too', async ({ page }) => {
		await setRoot(page, '--km-menu-bg', 'rgb(10, 20, 30)')
		await setGrid(page, 'gridHeader', '--wg-context-menu-bg', 'rgb(7, 8, 9)')
		await openCellMenu(page)  // #grid: no grid variable → the page value
		await expect(menuRoot(page)).toHaveCSS('background-color', 'rgb(10, 20, 30)')
		await closeMenu(page)
		await openHeaderMenu(page)  // #gridHeader
		await expect(menuRoot(page)).toHaveCSS('background-color', 'rgb(7, 8, 9)')
	})

	test('neither set → --base-dropdown-bg, then the core default', async ({ page }) => {
		await openCellMenu(page)
		await expect(menuRoot(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)')
		await closeMenu(page)
		await setRoot(page, '--base-dropdown-bg', 'rgb(4, 5, 6)')
		await openCellMenu(page)
		await expect(menuRoot(page)).toHaveCSS('background-color', 'rgb(4, 5, 6)')
	})

	test('--wg-context-menu-hover-color colours the hovered item text (unset → unchanged)', async ({ page }) => {
		const plain = (p: Page) => menuRoot(p).locator('[data-id="view"]')
		await openCellMenu(page)
		const before = await plain(page).evaluate((el) => getComputedStyle(el).color)
		await plain(page).hover()
		await expect(plain(page)).toHaveCSS('color', before)
		await closeMenu(page)
		await setGrid(page, 'grid', '--wg-context-menu-hover-color', 'rgb(200, 0, 100)')
		await openCellMenu(page)
		await plain(page).hover()
		await expect(plain(page)).toHaveCSS('color', 'rgb(200, 0, 100)')
	})

	test('z-index: core 10000 by default; page --km-menu-z-index reaches the grid; --wg-context-menu-z-index wins', async ({ page }) => {
		await openCellMenu(page)
		await expect(menuRoot(page)).toHaveCSS('z-index', '10000')
		await closeMenu(page)
		await setRoot(page, '--km-menu-z-index', '12345')
		await openCellMenu(page)
		await expect(menuRoot(page)).toHaveCSS('z-index', '12345')
		await closeMenu(page)
		await setGrid(page, 'grid', '--wg-context-menu-z-index', '777')
		await openCellMenu(page)
		await expect(menuRoot(page)).toHaveCSS('z-index', '777')
	})
})

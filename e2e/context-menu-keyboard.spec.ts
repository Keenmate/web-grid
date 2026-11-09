import { test, expect, Page, Locator, gridLocator, cell, header, menuRoot } from './fixtures'

/**
 * Keyboard, ARIA and dismiss behaviour of the cell / header menus (core
 * `openMenu()`, web-components-core `/menu`, rendered in the grid's shadow root).
 *
 * Fixtures:
 *   /test/contextmenu.html        — #grid cell menu. Row 0 (active) on the Name
 *                                   column: View Details, Copy "Product Name",
 *                                   Restock (+10), divider, Delete (DISABLED).
 *   /test/column-visibility.html  — header menu on `id`: Sort Ascending, Sort
 *                                   Descending, divider, Hide Column, Column
 *                                   Visibility (submenu: Show all + 6 toggles).
 */

const COL_NAME = 1

/** The menu item that has focus (inside the grid's shadow root), as `data-id` / `data-action`. */
const focusedItem = (page: Page, gridId: string) => gridLocator(page, gridId).evaluate((el: Element) => {
	const active = el.shadowRoot?.activeElement as HTMLElement | null
	const item = active?.closest('.km-menu__item') as HTMLElement | null
	return item ? (item.dataset.id ?? item.dataset.action ?? '') : null
})

/** What has focus in the grid's shadow root: `cell:row:col`, `item:<id>`, or the tag. */
const shadowFocus = (page: Page, gridId: string) => gridLocator(page, gridId).evaluate((el: Element) => {
	const active = el.shadowRoot?.activeElement as HTMLElement | null
	if (!active) return null
	if (active.matches('.wg__cell')) return `cell:${active.dataset.row}:${active.dataset.col}`
	const item = active.closest('.km-menu__item') as HTMLElement | null
	return item ? `item:${item.dataset.id ?? item.dataset.action}` : active.tagName.toLowerCase()
})

async function focusCellByClick(page: Page, gridId: string, row: number, col: number) {
	const target = cell(page, gridId, row, col)
	await target.click()
	await expect(target).toHaveClass(/wg__cell--focused/)
}

async function rightClick(page: Page, locator: Locator) {
	await locator.scrollIntoViewIfNeeded()
	const box = await locator.boundingBox()
	if (!box) throw new Error('No bounding box')
	const x = box.x + box.width / 2
	const y = box.y + box.height / 2
	await page.mouse.move(x, y)
	await locator.dispatchEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, buttons: 2, clientX: x, clientY: y })
}

test.describe('cell menu — keyboard (contextmenu.html #grid)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/test/contextmenu.html')
		await expect(gridLocator(page, 'grid').locator('tbody tr').first()).toBeVisible()
	})

	for (const key of ['Shift+F10', 'ContextMenu']) {
		test(`${key} on the focused cell opens its menu below the cell, first item focused`, async ({ page }) => {
			await focusCellByClick(page, 'grid', 0, COL_NAME)
			await page.keyboard.press(key)
			await expect(menuRoot(page)).toBeVisible()
			await expect(menuRoot(page)).toHaveClass(/wg-context-menu/)
			await expect(page.locator('[data-testid="cell-menu-open-log"]')).toContainText('open: name row=0 value=Laptop Pro')
			await expect.poll(() => focusedItem(page, 'grid')).toBe('view')
			// Below the cell, not at the viewport origin
			const cellBox = await cell(page, 'grid', 0, COL_NAME).boundingBox()
			const menuBox = await menuRoot(page).boundingBox()
			expect(menuBox!.y).toBeGreaterThanOrEqual(cellBox!.y + cellBox!.height - 2)
			expect(Math.abs(menuBox!.x - cellBox!.x)).toBeLessThan(cellBox!.width)
		})
	}

	test('arrows move between enabled items (the disabled Delete is skipped, wrap-around); Home / End', async ({ page }) => {
		await focusCellByClick(page, 'grid', 0, COL_NAME)
		await page.keyboard.press('Shift+F10')
		await expect.poll(() => focusedItem(page, 'grid')).toBe('view')
		await expect(menuRoot(page).locator('[data-id="delete"]')).toHaveAttribute('aria-disabled', 'true')

		await page.keyboard.press('ArrowDown')
		await expect.poll(() => focusedItem(page, 'grid')).toBe('copy-cell')
		await page.keyboard.press('ArrowDown')
		await expect.poll(() => focusedItem(page, 'grid')).toBe('restock')
		await page.keyboard.press('ArrowDown')  // Delete is disabled → wraps to the first item
		await expect.poll(() => focusedItem(page, 'grid')).toBe('view')
		await page.keyboard.press('ArrowUp')    // wraps back, skipping Delete
		await expect.poll(() => focusedItem(page, 'grid')).toBe('restock')
		await page.keyboard.press('Home')
		await expect.poll(() => focusedItem(page, 'grid')).toBe('view')
		await page.keyboard.press('End')        // last ENABLED item
		await expect.poll(() => focusedItem(page, 'grid')).toBe('restock')
	})

	test('Enter activates the focused item; focus returns to the cell', async ({ page }) => {
		await focusCellByClick(page, 'grid', 0, COL_NAME)
		await page.keyboard.press('Shift+F10')
		await expect.poll(() => focusedItem(page, 'grid')).toBe('view')
		await page.keyboard.press('Enter')
		await expect(page.locator('[data-testid="cell-menu-log"]')).toHaveText('View: Laptop Pro')
		await expect(menuRoot(page)).toHaveCount(0)
		await expect.poll(() => shadowFocus(page, 'grid')).toBe(`cell:0:${COL_NAME}`)
	})

	test('Space activates the focused item', async ({ page }) => {
		await focusCellByClick(page, 'grid', 2, 2)  // Office Chair, Category
		await page.keyboard.press('Shift+F10')
		await expect.poll(() => focusedItem(page, 'grid')).toBe('view')
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press(' ')
		await expect(page.locator('[data-testid="cell-menu-log"]')).toHaveText('Copied category=Furniture')
		await expect(menuRoot(page)).toHaveCount(0)
	})

	test('Escape closes the menu and returns focus to the cell; no item ran', async ({ page }) => {
		await focusCellByClick(page, 'grid', 0, COL_NAME)
		await page.keyboard.press('Shift+F10')
		await expect.poll(() => focusedItem(page, 'grid')).toBe('view')
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Escape')
		await expect(menuRoot(page)).toHaveCount(0)
		await expect.poll(() => shadowFocus(page, 'grid')).toBe(`cell:0:${COL_NAME}`)
		await expect(page.locator('[data-testid="cell-menu-log"]')).toHaveText('none')
		// The grid keyboard works again: ArrowDown moves the cell focus
		await page.keyboard.press('ArrowDown')
		await expect(cell(page, 'grid', 1, COL_NAME)).toHaveClass(/wg__cell--focused/)
	})

	test('keys handled by the open menu do not reach the grid (ArrowDown does not move the cell focus)', async ({ page }) => {
		await focusCellByClick(page, 'grid', 0, COL_NAME)
		await page.keyboard.press('Shift+F10')
		await expect.poll(() => focusedItem(page, 'grid')).toBe('view')
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('ArrowDown')
		await expect(cell(page, 'grid', 0, COL_NAME)).toHaveClass(/wg__cell--focused/)
		await expect(cell(page, 'grid', 1, COL_NAME)).not.toHaveClass(/wg__cell--focused/)
	})

	test('a page scroll closes the menu', async ({ page }) => {
		await rightClick(page, cell(page, 'grid', 0, COL_NAME))
		await expect(menuRoot(page)).toBeVisible()
		await page.evaluate(() => window.scrollBy(0, 40))
		await expect(menuRoot(page)).toHaveCount(0)
	})

	test("a scroll of the grid's own scroll container closes the menu", async ({ page }) => {
		// Core rc20 menu scroll rule: a POINT menu (right-click) watches scrollers around the host only,
		// so a scroll of the grid's inner container (which moves the clicked cell) no longer closes it.
		// Core finding C-1 in _agent-progress/web-grid-core-final-pass1.md — flips to a pass once core
		// lets a point menu name the element it belongs to.
		test.fail(true, 'core C-1: openMenu point menu ignores a scroller inside the host')
		const grid = gridLocator(page, 'grid')
		await grid.evaluate(async (el: any) => {
			el.style.maxHeight = '140px'
			await el.whenSettled?.()
		})
		await rightClick(page, cell(page, 'grid', 0, COL_NAME))
		await expect(menuRoot(page)).toBeVisible()
		const scrolled = await grid.evaluate((el: Element) => {
			const sc = Array.from(el.shadowRoot!.querySelectorAll('.wg, .wg__table-container'))
				.find(n => n.scrollHeight > n.clientHeight) as HTMLElement | undefined
			if (!sc) return false
			sc.scrollTop = 40
			return true
		})
		expect(scrolled).toBe(true)
		await expect(menuRoot(page)).toHaveCount(0)
	})
})

test.describe('header menu — keyboard, toggles, column-visibility submenu (column-visibility.html)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/test/column-visibility.html')
		await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
	})

	test('header menu carries wg-header-menu; arrows / submenu / Space toggle a column; ← closes the submenu', async ({ page }) => {
		await rightClick(page, header(page, 'id'))
		await expect(menuRoot(page)).toBeVisible()
		await expect(menuRoot(page)).toHaveClass(/wg-header-menu/)
		await expect(menuRoot(page)).not.toHaveClass(/wg-context-menu/)
		await expect(menuRoot(page).locator('.km-menu__item').first()).toHaveAttribute('role', 'menuitem')

		await page.keyboard.press('End')
		await expect.poll(() => focusedItem(page, 'grid')).toBe('column-visibility')
		await expect(menuRoot(page).locator('[data-action="column-visibility"]')).toHaveAttribute('aria-haspopup', 'menu')

		await page.keyboard.press('ArrowRight')
		const submenu = page.locator('.km-menu--submenu')
		await expect(submenu).toBeVisible()
		await expect(submenu).toHaveClass(/wg-header-menu/)
		await expect.poll(() => focusedItem(page, 'grid')).toBe('show-all-columns')

		const email = submenu.locator('[data-action="toggle-column"][data-id="email"]')
		await expect(email).toHaveAttribute('role', 'menuitemcheckbox')
		await expect(email).toHaveAttribute('aria-checked', 'true')
		await expect(email).toHaveClass(/wg-header-menu__column-toggle/)

		await page.keyboard.press('ArrowDown')  // id
		await page.keyboard.press('ArrowDown')  // name
		await page.keyboard.press('ArrowDown')  // email
		await expect.poll(() => focusedItem(page, 'grid')).toBe('email')
		await page.keyboard.press(' ')
		await expect(header(page, 'email')).toHaveCount(0)
		// Keep-open toggle: the submenu stays, re-rendered with the new state, focus kept
		await expect(submenu.locator('[data-id="email"]')).toHaveAttribute('aria-checked', 'false')
		await expect(submenu.locator('[data-action="show-all-columns"]')).toHaveAttribute('aria-checked', 'false')
		await expect.poll(() => focusedItem(page, 'grid')).toBe('email')

		await page.keyboard.press('Enter')
		await expect(header(page, 'email')).toHaveCount(1)
		await expect(submenu.locator('[data-id="email"]')).toHaveAttribute('aria-checked', 'true')

		await page.keyboard.press('ArrowLeft')
		await expect(submenu).toHaveCount(0)
		await expect.poll(() => focusedItem(page, 'grid')).toBe('column-visibility')
		await page.keyboard.press('Escape')
		await expect(menuRoot(page)).toHaveCount(0)
	})

	test('Enter on a header built-in (Sort Ascending) runs it and closes the menu', async ({ page }) => {
		await rightClick(page, header(page, 'name'))
		await expect(menuRoot(page)).toBeVisible()
		await page.keyboard.press('ArrowDown')
		await expect.poll(() => focusedItem(page, 'grid')).toBe('sort-asc')
		await page.keyboard.press('Enter')
		await expect(menuRoot(page)).toHaveCount(0)
		await expect.poll(() => gridLocator(page).evaluate((el: any) => el.sort)).toEqual([{ column: 'name', direction: 'asc' }])
	})
})

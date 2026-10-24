import { test, expect, Page, Locator, gridLocator, header, clickMenuItem } from './fixtures'

/**
 * E2E coverage for column visibility (docs/test/column-visibility.html).
 *
 * The fixture has one grid with six columns (id, name, email, department,
 * salary, phone). All initially visible. headerContextMenu includes the two
 * predefined items under test:
 *   - 'hide-column'        hides the right-clicked column
 *   - 'column-visibility'  submenu auto-built from grid.columns with a "Show
 *                          all" row plus one toggle per column
 *
 * Visible / hidden state is mirrored to two data-testid nodes by a
 * MutationObserver on the grid's shadow root — both API-driven reassignments
 * and menu-driven mutations update the panel.
 */

const PAGE = '/test/column-visibility.html'

async function visibleFields(page: Page): Promise<string[]> {
	const txt = (await page.locator('[data-testid="visible-fields"]').textContent()) || ''
	return txt === 'none' ? [] : txt.split(',').filter(Boolean)
}

async function hiddenFields(page: Page): Promise<string[]> {
	const txt = (await page.locator('[data-testid="hidden-fields"]').textContent()) || ''
	return txt === 'none' ? [] : txt.split(',').filter(Boolean)
}

/**
 * Right-click a header — uses dispatchEvent('contextmenu') rather than the
 * Playwright shortcut because the latter is flaky against web-grid's shadow
 * DOM + Floating UI (see memory feedback_playwright_right_click).
 */
async function rightClickHeader(page: Page, field: string) {
	await gridLocator(page).scrollIntoViewIfNeeded()
	const h = header(page, field)
	await h.scrollIntoViewIfNeeded()
	const box = await h.boundingBox()
	if (!box) throw new Error(`No box for header ${field}`)
	const x = box.x + box.width / 2
	const y = box.y + box.height / 2
	await page.mouse.move(x, y)
	await h.dispatchEvent('contextmenu', {
		bubbles: true, cancelable: true, button: 2, buttons: 2,
		clientX: x, clientY: y, screenX: x, screenY: y
	})
}

/**
 * Hover the "Column Visibility" parent item to reveal its submenu, then click
 * the submenu row by label. The submenu shows on parent-item mouseenter
 * (Floating UI positioned, display:none → block).
 */
async function clickSubmenuItem(page: Page, parentLabel: string, childLabel: string) {
	await page.evaluate(({ parent, child }) => {
		const menu = document.querySelector('.wg-context-menu')
		if (!menu) throw new Error('No context menu')
		const items = Array.from(menu.querySelectorAll('.wg-context-menu__item')) as HTMLElement[]
		const parentItem = items.find(it =>
			it.textContent?.includes(parent) &&
			it.classList.contains('wg-context-menu__item--has-submenu')
		)
		if (!parentItem) throw new Error(`Parent submenu item not found: ${parent}`)
		// Trigger the mouseenter handler that displays the submenu.
		parentItem.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
	}, { parent: parentLabel, child: childLabel })

	// Floating UI uses computePosition().then(...) to place the submenu — give
	// it a microtask flush before clicking the child.
	await page.waitForFunction((parent) => {
		const items = Array.from(document.querySelectorAll('.wg-context-menu__item')) as HTMLElement[]
		const parentItem = items.find(it =>
			it.textContent?.includes(parent) &&
			it.classList.contains('wg-context-menu__item--has-submenu')
		)
		const sub = parentItem?.querySelector(':scope > .wg-context-menu--submenu') as HTMLElement | null
		return !!sub && sub.style.display === 'block'
	}, parentLabel)

	await page.evaluate(({ parent, child }) => {
		const items = Array.from(document.querySelectorAll('.wg-context-menu__item')) as HTMLElement[]
		const parentItem = items.find(it =>
			it.textContent?.includes(parent) &&
			it.classList.contains('wg-context-menu__item--has-submenu')
		)
		const submenu = parentItem?.querySelector(':scope > .wg-context-menu--submenu')
		if (!submenu) throw new Error(`No submenu under ${parent}`)
		const childItems = Array.from(submenu.querySelectorAll('.wg-context-menu__item')) as HTMLElement[]
		const target = childItems.find(it => it.textContent?.includes(child))
		if (!target) throw new Error(`Submenu item not found: ${child}`)
		target.click()
	}, { parent: parentLabel, child: childLabel })
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
})

// =============================================================================
// Programmatic API — column.isHidden + reassignment
// =============================================================================

test.describe('column.isHidden via API', () => {
	test('initial state — all six columns rendered and visible-state panel matches', async ({ page }) => {
		await expect(header(page, 'id')).toHaveCount(1)
		await expect(header(page, 'name')).toHaveCount(1)
		await expect(header(page, 'email')).toHaveCount(1)
		await expect(header(page, 'department')).toHaveCount(1)
		await expect(header(page, 'salary')).toHaveCount(1)
		await expect(header(page, 'phone')).toHaveCount(1)

		expect(await visibleFields(page)).toEqual(['id', 'name', 'email', 'department', 'salary', 'phone'])
		expect(await hiddenFields(page)).toEqual([])
	})

	test('clicking "Hide email" removes the email header and updates the state panel', async ({ page }) => {
		await page.locator('[data-testid="hide-email"]').click()

		await expect(header(page, 'email')).toHaveCount(0)
		expect(await hiddenFields(page)).toEqual(['email'])
		// Sibling columns survive.
		await expect(header(page, 'name')).toHaveCount(1)
		await expect(header(page, 'department')).toHaveCount(1)
	})

	test('clicking "Show email" after a hide restores the column', async ({ page }) => {
		await page.locator('[data-testid="hide-email"]').click()
		await expect(header(page, 'email')).toHaveCount(0)

		await page.locator('[data-testid="show-email"]').click()
		await expect(header(page, 'email')).toHaveCount(1)
		expect(await hiddenFields(page)).toEqual([])
	})

	test('"Hide all but ID" leaves only the id column rendered', async ({ page }) => {
		await page.locator('[data-testid="hide-all"]').click()

		await expect(header(page, 'id')).toHaveCount(1)
		await expect(header(page, 'name')).toHaveCount(0)
		await expect(header(page, 'email')).toHaveCount(0)
		await expect(header(page, 'phone')).toHaveCount(0)
		expect(await visibleFields(page)).toEqual(['id'])
	})

	test('"Show all" after "Hide all but ID" restores every column', async ({ page }) => {
		await page.locator('[data-testid="hide-all"]').click()
		expect(await visibleFields(page)).toEqual(['id'])

		await page.locator('[data-testid="show-all"]').click()
		expect(await hiddenFields(page)).toEqual([])
		expect(await visibleFields(page)).toEqual(['id', 'name', 'email', 'department', 'salary', 'phone'])
	})
})

// =============================================================================
// Built-in 'hide-column' header context menu item
// =============================================================================

test.describe("'hide-column' header context menu item", () => {
	test('appears in the menu and hides the right-clicked column when clicked', async ({ page }) => {
		await rightClickHeader(page, 'salary')

		// `.wg-context-menu` matches both the top-level menu and its child
		// submenu (the submenu carries both classes). Scope to just the parent.
		const menu = page.locator('.wg-context-menu:not(.wg-context-menu--submenu)')
		await expect(menu).toBeVisible()
		await expect(menu).toContainText('Hide Column')

		await clickMenuItem(page, 'Hide Column')

		await expect(header(page, 'salary')).toHaveCount(0)
		expect(await hiddenFields(page)).toEqual(['salary'])
	})

	test('hides a different right-clicked column each time', async ({ page }) => {
		await rightClickHeader(page, 'name')
		await clickMenuItem(page, 'Hide Column')
		await expect(header(page, 'name')).toHaveCount(0)

		await rightClickHeader(page, 'phone')
		await clickMenuItem(page, 'Hide Column')
		await expect(header(page, 'phone')).toHaveCount(0)

		expect(await hiddenFields(page)).toEqual(['name', 'phone'])
	})
})

// =============================================================================
// Built-in 'column-visibility' submenu
// =============================================================================

test.describe("'column-visibility' submenu", () => {
	test('top-level submenu entry exists and is marked as having a submenu', async ({ page }) => {
		await rightClickHeader(page, 'name')
		const menu = page.locator('.wg-context-menu:not(.wg-context-menu--submenu)')
		await expect(menu).toBeVisible()

		const parent = menu.locator('.wg-context-menu__item--has-submenu', { hasText: 'Column Visibility' })
		await expect(parent).toHaveCount(1)
	})

	test('submenu lists "Show all" + one toggle per column, each marked ☑ when visible', async ({ page }) => {
		await rightClickHeader(page, 'id')

		// Reveal the submenu via mouseenter on the parent.
		await page.evaluate(() => {
			const items = Array.from(document.querySelectorAll('.wg-context-menu__item')) as HTMLElement[]
			const parent = items.find(it =>
				it.textContent?.includes('Column Visibility') &&
				it.classList.contains('wg-context-menu__item--has-submenu')
			)
			parent?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
		})

		const submenu = page.locator('.wg-context-menu--submenu').first()
		await expect(submenu).toBeVisible()

		// Seven rows: "Show all" + six column toggles.
		await expect(submenu.locator('.wg-context-menu__item')).toHaveCount(7)
		// Every per-column toggle should be active (aria-pressed) initially
		// (all columns visible). The icon character for checked is ☑.
		const checkedToggles = submenu.locator('.wg-context-menu__item--toggle.wg-context-menu__item--active[data-action="toggle-column"][aria-pressed="true"]')
		await expect(checkedToggles).toHaveCount(6)
	})

	test('clicking a column toggle in the submenu hides that column', async ({ page }) => {
		await rightClickHeader(page, 'id')
		await clickSubmenuItem(page, 'Column Visibility', 'Department')

		await expect(header(page, 'department')).toHaveCount(0)
		expect(await hiddenFields(page)).toEqual(['department'])
	})

	test('clicking the same toggle a second time shows the column again', async ({ page }) => {
		// First click — hide phone.
		await rightClickHeader(page, 'id')
		await clickSubmenuItem(page, 'Column Visibility', 'Phone')
		await expect(header(page, 'phone')).toHaveCount(0)

		// The header menu stays open after a toggle click; close it before
		// the next right-click so the helper opens a fresh one.
		await page.keyboard.press('Escape')
		await expect(page.locator('.wg-context-menu:not(.wg-context-menu--submenu)')).toHaveCount(0)

		// Second click — show phone.
		await rightClickHeader(page, 'id')
		await clickSubmenuItem(page, 'Column Visibility', 'Phone')

		await expect(header(page, 'phone')).toHaveCount(1)
		expect(await hiddenFields(page)).toEqual([])
	})

	test('"Show all" submenu row restores all hidden columns', async ({ page }) => {
		// Hide two columns first via the API toggle (fast + deterministic).
		await page.locator('[data-testid="hide-email"]').click()
		await page.locator('[data-testid="hide-all"]').click()
		expect(await visibleFields(page)).toEqual(['id'])

		await rightClickHeader(page, 'id')
		await clickSubmenuItem(page, 'Column Visibility', 'Show all')

		expect(await hiddenFields(page)).toEqual([])
		await expect(header(page, 'email')).toHaveCount(1)
		await expect(header(page, 'phone')).toHaveCount(1)
	})
})

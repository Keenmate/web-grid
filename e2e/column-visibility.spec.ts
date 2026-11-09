import { test, expect, Page, Locator, gridLocator, header, clickMenuItem, dispatchContextMenu } from './fixtures'

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
	await dispatchContextMenu(h, x, y)
}

/**
 * Hover the "Column Visibility" parent item to open its submenu (core
 * `openMenu()`: a sibling `.km-menu--submenu` level in the grid's shadow root),
 * then click the submenu row by label.
 */
async function openSubmenu(page: Page, parentLabel: string): Promise<Locator> {
	const parent = page.locator('.km-menu:not(.km-menu--submenu) .km-menu__item--has-submenu', { hasText: parentLabel })
	await expect(parent).toHaveCount(1)
	await parent.dispatchEvent('mouseenter')
	const submenu = page.locator('.km-menu--submenu')
	await expect(submenu).toBeVisible()
	return submenu
}

async function clickSubmenuItem(page: Page, parentLabel: string, childLabel: string) {
	const submenu = await openSubmenu(page, parentLabel)
	const target = submenu.locator('.km-menu__item', { hasText: childLabel }).first()
	await expect(target).toHaveCount(1)
	await target.evaluate((el: HTMLElement) => el.click())
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

		// `.km-menu` matches both the top-level menu and its submenu levels
		// (`.km-menu--submenu`). Scope to just the root.
		const menu = page.locator('.km-menu:not(.km-menu--submenu)')
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
		const menu = page.locator('.km-menu:not(.km-menu--submenu)')
		await expect(menu).toBeVisible()

		const parent = menu.locator('.km-menu__item--has-submenu', { hasText: 'Column Visibility' })
		await expect(parent).toHaveCount(1)
	})

	test('submenu lists "Show all" + one toggle per column, each marked ☑ when visible', async ({ page }) => {
		await rightClickHeader(page, 'id')

		const submenu = await openSubmenu(page, 'Column Visibility')

		// Seven rows: "Show all" + six column toggles.
		await expect(submenu.locator('.km-menu__item')).toHaveCount(7)
		// Every per-column toggle is toggled on initially (all columns visible): a
		// menuitemcheckbox with aria-checked="true". The icon character for checked is ☑.
		const checkedToggles = submenu.locator('.wg-header-menu__column-toggle.km-menu__item--toggled[role="menuitemcheckbox"][data-action="toggle-column"][aria-checked="true"]')
		await expect(checkedToggles).toHaveCount(6)
		await expect(submenu.locator('[data-action="show-all-columns"]')).toHaveAttribute('role', 'menuitemcheckbox')
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
		await expect(page.locator('.km-menu:not(.km-menu--submenu)')).toHaveCount(0)

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

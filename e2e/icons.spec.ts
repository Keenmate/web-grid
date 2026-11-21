import { test, expect, type Page, gridLocator, cell, waitForRows, openToolbarOn } from './fixtures'

/**
 * Icons through core renderIcon (SPEC §12.33) with the grid as host: the element's own
 * `renderIconCallback` beats the page-wide `window.components.renderIconCallback`, `null` falls
 * through to the page hook, a built-in name never reaches a hook, a class list renders
 * `<i class="wg__icon …">`; a hook change re-renders.
 *
 * Fixture: test/icons.html — col 0 name (edit button, editButtonIcon 'mine-edit'),
 * col 1 status (select; option icons check / mine / both / page / fa-solid fa-star / markup / emoji).
 */

const PAGE = '/test/icons.html'
const dropdown = (page: Page) => gridLocator(page).locator('.wg__dropdown')
const optionIcon = (page: Page, label: string) =>
	dropdown(page).locator('.wg__dropdown-option', { hasText: label }).locator('.wg__dropdown-option-icon')
type Call = { name: string; component: string; prefix?: string; option?: string | null; hasElement?: boolean }
const calls = (page: Page) => page.evaluate(() => ({
	element: (window as unknown as { __elementCalls: Call[] }).__elementCalls,
	page: (window as unknown as { __pageCalls: Call[] }).__pageCalls
}))

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
})

test.describe('dropdown option icons', () => {
	test.beforeEach(async ({ page }) => {
		await cell(page, 0, 1).click()
		await expect(dropdown(page)).toBeVisible()
	})

	test('built-in name → masked km-icon, never sent to a hook', async ({ page }) => {
		await expect(optionIcon(page, 'Built-in').locator('.km-icon.wg__icon.wg__icon--check')).toHaveCount(1)
		const c = await calls(page)
		expect(c.element.map(x => x.name)).not.toContain('check')
		expect(c.page.map(x => x.name)).not.toContain('check')
	})

	test('the element hook beats the page hook; its ctx carries the option + the grid', async ({ page }) => {
		await expect(optionIcon(page, 'Element').locator('b.from-element')).toHaveText('mine')
		await expect(optionIcon(page, 'Both').locator('b.from-element')).toHaveText('both')
		await expect(optionIcon(page, 'Both').locator('b.from-page')).toHaveCount(0)
		const c = await calls(page)
		expect(c.element).toContainEqual({ name: 'mine', component: 'web-grid', prefix: 'wg', option: 'element' })
		expect(c.page.map(x => x.name)).not.toContain('both')
	})

	test('element null → the page hook decides (it sees the grid as element)', async ({ page }) => {
		await expect(optionIcon(page, 'Page').locator('b.from-page')).toHaveText('page')
		const c = await calls(page)
		expect(c.element.map(x => x.name)).toContain('page')
		expect(c.page).toContainEqual({ name: 'page', component: 'web-grid', hasElement: true })
	})

	test('a class list (both hooks null) → <i class="wg__icon …">; markup raw; emoji text', async ({ page }) => {
		const font = optionIcon(page, 'Font').locator('i.wg__icon.fa-solid.fa-star')
		await expect(font).toHaveCount(1)
		await expect(font).toHaveAttribute('aria-hidden', 'true')
		await expect(font).toHaveCSS('flex-shrink', '0')
		await expect(optionIcon(page, 'Markup').locator('b.raw')).toHaveText('R')
		await expect(optionIcon(page, 'Emoji')).toHaveText('🙂')
	})
})

test.describe('edit button icon', () => {
	test('the element hook renders it; setting the hook to null re-renders through the next rule', async ({ page }) => {
		const btn = cell(page, 0, 0).locator('.wg__edit-button')
		await expect(btn.locator('b.from-element')).toHaveText('mine-edit')
		await page.evaluate(() => {
			(document.querySelector('web-grid') as unknown as { renderIconCallback: unknown }).renderIconCallback = null
		})
		// the page hook answers null for 'mine-edit' → a one-word class list
		await expect(btn.locator('i.wg__icon.mine-edit')).toHaveCount(1)
		await expect(btn.locator('b.from-element')).toHaveCount(0)
	})

	test('renderIconCallback is a function-only input (a string is refused, previous kept)', async ({ page }) => {
		const kept = await page.evaluate(() => {
			const grid = document.querySelector('web-grid') as unknown as { renderIconCallback: unknown }
			const before = grid.renderIconCallback
			grid.renderIconCallback = 'nope'
			return grid.renderIconCallback === before
		})
		expect(kept).toBe(true)
	})
})

/**
 * Changing the page-wide `window.components.renderIconCallback` after the grid rendered repaints
 * its icons in place (core `iconsChanged()`, C-CA-40) — the table, the open dropdown, the open
 * row toolbar, a cached chevron render — keeping the active cell / selection / open panels.
 */
test.describe('page-wide icon hook changed later → repaint in place', () => {
	const setPageHook = (page: Page, names: string[]) => page.evaluate((names) => {
		window.components.renderIconCallback = (name: string) => names.includes(name) ? '<b data-test-icon>x</b>' : null
	}, names)

	test.afterEach(async ({ page }) => {
		await page.evaluate(() => { window.components.renderIconCallback = null })
	})

	test('edit button repaints; the active cell stays', async ({ page }) => {
		const btn = cell(page, 1, 0).locator('.wg__edit-button')
		// the element hook would answer 'mine-edit' itself: drop it so the page hook decides
		await page.evaluate(() => {
			(document.querySelector('web-grid') as unknown as { renderIconCallback: unknown }).renderIconCallback = null
		})
		await expect(btn.locator('i.wg__icon.mine-edit')).toHaveCount(1)
		await cell(page, 1, 1).click()
		await page.keyboard.press('Escape')
		await expect(cell(page, 1, 1)).toHaveClass(/wg__cell--focused/)
		await setPageHook(page, ['mine-edit'])
		await expect(btn.locator('b[data-test-icon]')).toHaveCount(1)
		await expect(cell(page, 1, 1)).toHaveClass(/wg__cell--focused/)
	})

	test('open dropdown repaints its option icons, stays open and still selects', async ({ page }) => {
		await cell(page, 0, 1).click()
		await expect(dropdown(page)).toBeVisible()
		await expect(optionIcon(page, 'Font').locator('i.wg__icon')).toHaveCount(1)
		await setPageHook(page, ['fa-solid fa-star'])
		await expect(optionIcon(page, 'Font').locator('b[data-test-icon]')).toHaveCount(1)
		await expect(dropdown(page)).toBeVisible()
		await expect(dropdown(page).locator('.wg__dropdown-option')).toHaveCount(7)
		await dropdown(page).locator('.wg__dropdown-option', { hasText: 'Font' }).click()
		await expect(dropdown(page)).toHaveCount(0)
		await expect(cell(page, 0, 1)).toContainText('Font')
	})

	test('open row toolbar repaints in place (stays open)', async ({ page }) => {
		await page.evaluate(() => {
			const grid = document.querySelector('web-grid') as unknown as { rowToolbar: unknown; isHoverable: boolean; isRowToolbarShown: boolean }
			grid.isHoverable = true
			grid.isRowToolbarShown = true
			grid.rowToolbar = [{ id: 'mark', text: 'Mark', icon: 'tb-mark', onClick: () => {} }]
		})
		await openToolbarOn(page, gridLocator(page).locator('tr[data-row-index="0"]'))
		const toolbar = gridLocator(page).locator('.wg__toolbar-container .wg__toolbar')
		await expect(toolbar).toBeVisible()
		await expect(toolbar.locator('.wg__toolbar-btn i.wg__icon.tb-mark')).toHaveCount(1)
		await setPageHook(page, ['tb-mark'])
		await expect(toolbar.locator('.wg__toolbar-btn b[data-test-icon]')).toHaveCount(1)
		await expect(toolbar).toBeVisible()
	})

	test('a cached consumer chevron render that draws page icons is re-run', async ({ page }) => {
		await page.goto('/test/display-options.html')
		await expect(gridLocator(page, 'tree').locator('tbody tr').first()).toBeVisible()
		await page.evaluate(() => {
			const tree = document.getElementById('tree') as unknown as { renderChevronCallback: unknown }
			const hook = () => (window.components as unknown as { renderIconCallback?: ((n: string) => string | null) | null }).renderIconCallback
			tree.renderChevronCallback = ({ hasChildren }: { hasChildren: boolean }) => hasChildren ? (hook()?.('chev') ?? '<span class="plain-chev">&gt;</span>') : ''
		})
		const tree = gridLocator(page, 'tree')
		await expect(tree.locator('.plain-chev').first()).toBeVisible()
		await setPageHook(page, ['chev'])
		await expect(tree.locator('.plain-chev')).toHaveCount(0)
		await expect(tree.locator('b[data-test-icon]').first()).toBeVisible()
	})
})

import { test, expect, type Page, gridLocator, cell, onGrid, waitForRows } from './fixtures'

/**
 * Display options — container flags (`isHoverable`, `isStriped`,
 * `isScrollable` + `scrollMaxHeight`, `isTableBorderOnly`, `isStickyRowNumbers`),
 * shortcuts help (`shortcutsHelpPosition`, `renderShortcutsHelpCallback`), tree
 * chevrons (`treeExpandedGlyph`, `treeCollapsedGlyph`, `renderChevronCallback`).
 *
 * Fixture: test/display-options.html — #flat (30 rows, row numbers, a row
 * shortcut, help visible, 660px of columns in a 500px host) and #tree.
 */

const PAGE = '/test/display-options.html'

const wg = (page: Page, id = 'flat') => gridLocator(page, id).locator('.wg').first()
const help = (page: Page) => gridLocator(page, 'flat').locator('.wg__shortcuts-help')
const chevron = (page: Page, path: string) => gridLocator(page, 'tree').locator(`.wg__tree-chevron[data-tree-toggle="${path}"]`)

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page, 'flat')
	await waitForRows(page, 'tree')
})

test.describe('container flags', () => {
	test('isHoverable / isStriped default on; attributes turn them off, removal restores', async ({ page }) => {
		await expect(wg(page)).toHaveClass(/wg--hoverable/)
		await expect(wg(page)).toHaveClass(/wg--striped/)
		await onGrid(page, el => { el.setAttribute('hoverable', 'false'); el.setAttribute('striped', 'false') }, 'flat')
		await expect(wg(page)).not.toHaveClass(/wg--hoverable/)
		await expect(wg(page)).not.toHaveClass(/wg--striped/)
		await onGrid(page, el => { el.removeAttribute('hoverable'); el.removeAttribute('striped') }, 'flat')
		await expect(wg(page)).toHaveClass(/wg--hoverable/)
		await expect(wg(page)).toHaveClass(/wg--striped/)
	})

	test('isScrollable + scrollMaxHeight cap the grid height', async ({ page }) => {
		await onGrid(page, el => { el.setAttribute('scrollable', ''); el.setAttribute('scroll-max-height', '200px') }, 'flat')
		await expect(wg(page)).toHaveClass(/wg--scrollable/)
		await expect.poll(async () => (await wg(page).boundingBox())!.height).toBeLessThanOrEqual(202)
		expect(await wg(page).evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
	})

	test('resetting scrollMaxHeight to its default releases the custom cap', async ({ page }) => {
		// property path: back to the default value
		await onGrid(page, el => { el.isScrollable = true; el.scrollMaxHeight = '200px' }, 'flat')
		await expect.poll(async () => (await wg(page).boundingBox())!.height).toBeLessThanOrEqual(202)
		await onGrid(page, el => { el.scrollMaxHeight = '100vh' }, 'flat')
		await expect.poll(async () => (await wg(page).boundingBox())!.height, { timeout: 1500 }).toBeGreaterThan(400)
		// attribute path: removing the attribute resets to the default
		await onGrid(page, el => el.setAttribute('scroll-max-height', '200px'), 'flat')
		await expect.poll(async () => (await wg(page).boundingBox())!.height).toBeLessThanOrEqual(202)
		await onGrid(page, el => el.removeAttribute('scroll-max-height'), 'flat')
		await expect.poll(async () => (await wg(page).boundingBox())!.height, { timeout: 1500 }).toBeGreaterThan(400)
	})

	test('isTableBorderOnly adds the modifier and a separate table scroll container', async ({ page }) => {
		await onGrid(page, el => el.setAttribute('table-border-only', ''), 'flat')
		await expect(wg(page)).toHaveClass(/wg--table-border-only/)
		await expect(gridLocator(page, 'flat').locator('.wg__table-container')).toHaveCount(1)
	})

	test('isStickyRowNumbers keeps the row numbers visible while scrolling horizontally', async ({ page }) => {
		await onGrid(page, el => el.setAttribute('sticky-row-numbers', ''), 'flat')
		const rn = gridLocator(page, 'flat').locator('.wg__row-number[data-row-number="0"]')
		const before = (await rn.boundingBox())!.x
		await wg(page).evaluate(el => { el.scrollLeft = 150 })
		await page.waitForTimeout(50)
		expect(Math.abs((await rn.boundingBox())!.x - before)).toBeLessThan(2)
		await expect(rn).toHaveCSS('position', 'sticky')
	})
})

test.describe('shortcuts help', () => {
	test("default 'top-right'; 'top-left' adds the left modifier", async ({ page }) => {
		await expect(help(page)).toHaveCount(1)
		await expect(help(page)).not.toHaveClass(/wg__shortcuts-help--left/)
		await onGrid(page, el => el.setAttribute('shortcuts-help-position', 'top-left'), 'flat')
		await expect(help(page)).toHaveClass(/wg__shortcuts-help--left/)
	})

	test('renderShortcutsHelpCallback adds custom content above the list', async ({ page }) => {
		await onGrid(page, el => { el.renderShortcutsHelpCallback = (ctx: any) => `<p class="custom-help">Custom ${ctx.controller ? 'ok' : 'no-ctx'}</p>` }, 'flat')
		await expect(help(page).locator('.wg__shortcuts-help-custom .custom-help')).toHaveText('Custom ok')
		await expect(help(page).locator('.wg__shortcuts-help-item')).toHaveCount(1)
	})

	test('isShortcutsHelpShown removal hides it', async ({ page }) => {
		await onGrid(page, el => el.removeAttribute('show-shortcuts-help'), 'flat')
		await expect(help(page)).toHaveCount(0)
	})
})

test.describe('tree chevrons', () => {
	test('default: one rotating glyph; leaves get a spacer', async ({ page }) => {
		await expect(chevron(page, '1')).toHaveText('▶')
		await expect(chevron(page, '1')).toHaveClass(/wg__tree-chevron--expanded/)
		await expect(chevron(page, '1.1.1')).toHaveCount(0)
		await expect(cell(page, 'tree', 2, 0).locator('.wg__tree-leaf-spacer')).toHaveCount(1)
	})

	test('different expanded / collapsed glyphs (attributes) swap text instead of rotating', async ({ page }) => {
		await onGrid(page, el => { el.setAttribute('tree-expanded-glyph', '−'); el.setAttribute('tree-collapsed-glyph', '+') }, 'tree')
		await expect(chevron(page, '1')).toHaveText('−')
		await expect(chevron(page, '1')).not.toHaveClass(/wg__tree-chevron--expanded/)
		await chevron(page, '1.1').click()
		await expect(chevron(page, '1.1')).toHaveText('+')
	})

	test('renderChevronCallback renders per-row HTML with { row, isExpanded, hasChildren, level, path }', async ({ page }) => {
		await onGrid(page, el => {
			el.renderChevronCallback = (ctx: any) => `<i class="chev" data-l="${ctx.level}">${ctx.hasChildren ? (ctx.isExpanded ? 'open' : 'shut') : 'leaf'}:${ctx.path}:${ctx.row.name}</i>`
		}, 'tree')
		await expect(chevron(page, '1').locator('i.chev')).toHaveText('open:1:Root')
		await expect(chevron(page, '1.1').locator('i.chev')).toHaveAttribute('data-l', '1')
		await expect(cell(page, 'tree', 2, 0).locator('.wg__tree-leaf-spacer i.chev')).toHaveText('leaf:1.1.1:Leaf')
		await chevron(page, '1.1').click()
		await expect(chevron(page, '1.1').locator('i.chev')).toHaveText('shut:1.1:Child')
	})
})

import { test, expect, type Page, gridLocator, cell, header, onGrid, waitForRows, openToolbarOn, openContextMenu, menuRoot } from './fixtures'

/**
 * i18n — `labels` across the row toolbar, header context menu, pagination,
 * shortcuts help, dropdown "no options", and the go-to-row dialog.
 *
 * Fixture: test/i18n.html — toolbar built-ins, header-menu built-ins,
 * pagination (page-size 2, 3 rows), shortcuts help, a combobox.
 */

const PAGE = '/test/i18n.html'

const CS = {
	'tooltips.rowActions': 'Akce řádku',
	'tooltips.keyboardShortcuts': 'Klávesové zkratky',
	'headers.keyboardShortcuts': 'Klávesové zkratky',
	'buttons.nextPage': 'Další',
	'labels.pageInfo': 'Strana {current} z {total}',
	'labels.itemCount': '{count} položek',
	'labels.perPage': 'na stránku',
	'messages.noMatchingOptions': 'Žádné možnosti',
	'menuItems.addRow': 'Přidat řádek', 'menuItems.deleteRow': 'Smazat řádek', 'menuItems.duplicateRow': 'Duplikovat řádek',
	'menuItems.moveUp': 'Nahoru', 'menuItems.moveDown': 'Dolů',
	'menuItems.expand': 'Rozbalit', 'menuItems.collapse': 'Sbalit', 'menuItems.expandAll': 'Rozbalit vše', 'menuItems.collapseAll': 'Sbalit vše',
	'menuItems.sortAsc': 'Seřadit vzestupně', 'menuItems.sortDesc': 'Seřadit sestupně', 'menuItems.clearSort': 'Zrušit řazení',
	'menuItems.hideColumn': 'Skrýt sloupec', 'menuItems.freezeColumn': 'Ukotvit sloupec', 'menuItems.unfreezeColumn': 'Uvolnit sloupec',
	'menuItems.columnVisibility': 'Viditelnost sloupců', 'menuItems.showAllColumns': 'Zobrazit vše'
}

const toolbar = (page: Page) => gridLocator(page).locator('.wg__toolbar-container .wg__toolbar')
const pag = (page: Page) => gridLocator(page).locator('.wg__pagination')

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
})

test('defaults are English', async ({ page }) => {
	await expect(pag(page).locator('.wg__pagination-info')).toContainText('Page 1 of 2')
	await openToolbarOn(page, gridLocator(page).locator('tr[data-row-index="0"]'))
	await expect(toolbar(page).locator('[data-action="delete"]')).toHaveAttribute('aria-label', 'Delete row')
})

test('glyph-only buttons are named by ariaLabels; a customized twin names them too', async ({ page }) => {
	// Pagination: the visible text is a glyph (⏮ ◀ ▶ ⏭) — ariaLabels.<name>Page names the button
	await onGrid(page, el => el.setAttribute('pagination-layout', 'first|previous|page-info|next|last'))
	await expect(pag(page).locator('[data-action="first"]')).toHaveAccessibleName('First page')
	await expect(pag(page).locator('[data-action="prev"]')).toHaveAccessibleName('Previous page')
	await expect(pag(page).locator('[data-action="next"]')).toHaveAccessibleName('Next page')
	await expect(pag(page).locator('[data-action="last"]')).toHaveAccessibleName('Last page')
	// The row toolbar trigger shows only "⋮"
	await onGrid(page, el => el.setAttribute('toolbar-trigger', 'button'))
	const trigger = gridLocator(page).locator('.wg__toolbar-trigger[data-toolbar-trigger="0"]')
	await expect(trigger).toHaveAccessibleName('Row actions')

	// Customizing the twin (buttons.nextPage / tooltips.rowActions) renames the unset ariaLabels key (core fallback)
	await page.evaluate((cs) => { (document.getElementById('grid') as any).labels = cs }, CS)
	await expect(pag(page).locator('[data-action="next"]')).toHaveAccessibleName('Další')
	await expect(pag(page).locator('[data-action="first"]')).toHaveAccessibleName('First page')
	await expect(trigger).toHaveAccessibleName('Akce řádku')
	// A set ariaLabels key wins over the twin
	await page.evaluate((cs) => { (document.getElementById('grid') as any).labels = { ...cs, 'ariaLabels.nextPage': 'Další stránka' } }, CS)
	await expect(pag(page).locator('[data-action="next"]')).toHaveAccessibleName('Další stránka')
	await expect(pag(page).locator('[data-action="next"]')).toHaveText('Další')
})

test('a full labels object translates toolbar, header menu, pagination, shortcuts help', async ({ page }) => {
	await page.evaluate((cs) => { (document.getElementById('grid') as any).labels = cs }, CS)

	await expect(pag(page).locator('.wg__pagination-info')).toContainText('Strana 1 z 2')
	await expect(pag(page).locator('.wg__pagination-info')).toContainText('3 položek')
	await expect(pag(page).locator('[data-action="next"]')).toHaveText('Další')
	await expect(pag(page).locator('.wg__pagination-label')).toHaveText('na stránku')

	await expect(gridLocator(page).locator('.wg__shortcuts-help-title')).toHaveText('Klávesové zkratky')
	await expect(gridLocator(page).locator('.wg__shortcuts-help-label')).toHaveText('Duplikovat řádek')

	await openToolbarOn(page, gridLocator(page).locator('tr[data-row-index="1"]'))
	await expect(toolbar(page).locator('[data-action="delete"]')).toHaveAttribute('aria-label', 'Smazat řádek')
	await expect(toolbar(page).locator('[data-action="move-up"]')).toHaveAttribute('aria-label', 'Nahoru')

	await page.mouse.move(0, 0)
	await openContextMenu(page, header(page, 'name'))
	await expect(menuRoot(page)).toContainText('Seřadit vzestupně')
	await expect(menuRoot(page)).toContainText('Skrýt sloupec')
	await expect(menuRoot(page)).toContainText('Viditelnost sloupců')
	await expect(menuRoot(page)).not.toContainText('Sort Ascending')
})

test('the dropdown "no options" text is translatable', async ({ page }) => {
	await page.evaluate((cs) => { (document.getElementById('grid') as any).labels = cs }, CS)
	await cell(page, 0, 2).click()
	await page.keyboard.type('zzz')  // combobox: a non-matching filter → the "no options" row
	await expect(gridLocator(page).locator('.wg__dropdown')).toContainText('Žádné možnosti')
})

test('a partial labels object keeps the other defaults', async ({ page }) => {
	await onGrid(page, el => { el.labels = { 'buttons.nextPage': 'NEXT' } })
	await expect(pag(page).locator('[data-action="next"]')).toHaveText('NEXT')
	await expect(pag(page).locator('[data-action="prev"]')).toHaveText('◀')
	await expect(pag(page).locator('.wg__pagination-info')).toContainText('Page 1 of 2')
})

test('one menuItems key keeps the other action labels', async ({ page }) => {
	await onGrid(page, el => { el.labels = { 'menuItems.deleteRow': 'Smazat' } })
	await openToolbarOn(page, gridLocator(page).locator('tr[data-row-index="1"]'))
	await expect(toolbar(page).locator('[data-action="delete"]')).toHaveAttribute('aria-label', 'Smazat')
	await expect(toolbar(page).locator('[data-action="add"]')).toHaveAttribute('aria-label', 'Add row', { timeout: 1500 })
})

test('the go-to-row dialog texts are translatable through labels', async ({ page }) => {
	await onGrid(page, el => { el.labels = { 'labels.goToRow': 'Přejít na řádek', 'buttons.cancel': 'Zrušit', 'buttons.go': 'Přejít' } })
	await cell(page, 0, 1).click()
	await page.keyboard.press('Control+g')
	const dlg = gridLocator(page).locator('.wg__goto-dialog')
	await expect(dlg).toBeVisible()
	await expect(dlg.locator('.wg__goto-label')).toContainText('Přejít na řádek', { timeout: 1500 })
	await expect(dlg.locator('.wg__goto-btn--cancel')).toHaveText('Zrušit')
	await expect(dlg.locator('.wg__goto-btn--go')).toHaveText('Přejít')
})

test('a partial labels object resolves per key; a full web-grid.* key works too', async ({ page }) => {
	expect(await onGrid(page, el => {
		el.labels = { 'menuItems.hideColumn': 'Skrýt', 'web-grid.menuItems.sortDesc': 'Sestupně' }
		el.flush()
		const l = el.engine.labels  // the resolved (merged) texts; el.labels reads back what was assigned
		return [l['menuItems.hideColumn'], l['menuItems.sortDesc'], l['menuItems.sortAsc'], l['menuItems.addRow'], l['buttons.nextPage'], el.labels]
	})).toEqual(['Skrýt', 'Sestupně', 'Sort Ascending', 'Add row', '▶', { 'menuItems.hideColumn': 'Skrýt', 'web-grid.menuItems.sortDesc': 'Sestupně' }])
})

test('labels is also a JSON attribute', async ({ page }) => {
	await onGrid(page, el => el.setAttribute('labels', '{"buttons.nextPage":"Dál"}'))
	await expect(pag(page).locator('[data-action="next"]')).toHaveText('Dál')
})

test('messages.noData is the empty-table text', async ({ page }) => {
	await onGrid(page, el => { el.items = [] })
	await expect(gridLocator(page).locator('.wg__empty')).toHaveText('No items to display')
	await onGrid(page, el => { el.labels = { 'messages.noData': 'Žádná data' } })
	await expect(gridLocator(page).locator('.wg__empty')).toHaveText('Žádná data')
})

test('messages.noResults when rows exist but the filter matched nothing', async ({ page }) => {
	await onGrid(page, el => { el.isFilteringEnabled = true; el.filters = { [el.columns[0].field]: 'zzz-no-match' } })
	await expect(gridLocator(page).locator('.wg__empty')).toHaveText('No matching items')
	await expect(gridLocator(page).locator('.wg__empty')).toHaveAttribute('data-empty', 'no-results')
	await onGrid(page, el => { el.labels = { 'messages.noResults': 'Nic nenalezeno' } })
	await expect(gridLocator(page).locator('.wg__empty')).toHaveText('Nic nenalezeno')
})

test("labels: '' renders nothing, undefined falls back to the default", async ({ page }) => {
	await onGrid(page, el => { el.items = []; el.labels = { 'messages.noData': '' } })
	await expect(gridLocator(page).locator('.wg__empty')).toHaveText('')
	await onGrid(page, el => { el.labels = { 'messages.noData': undefined } })
	await expect(gridLocator(page).locator('.wg__empty')).toHaveText('No items to display')
})

test('a combobox with no options at all shows messages.noOptions', async ({ page }) => {
	await onGrid(page, el => {
		el.columns = el.columns.map((c: any) => c.field === 'kind' ? { ...c, editorOptions: { ...c.editorOptions, options: [] } } : c)
	})
	await cell(page, 0, 2).click()
	await page.keyboard.type('z')
	await expect(gridLocator(page).locator('.wg__dropdown')).toContainText('No options')
})

test('a column editorOptions.labels overrides the grid dropdown texts for that column', async ({ page }) => {
	await onGrid(page, el => {
		el.labels = { 'messages.noMatchingOptions': 'Grid-level' }
		el.columns = el.columns.map((c: any) => c.field === 'kind' ? { ...c, editorOptions: { ...c.editorOptions, labels: { 'messages.noMatchingOptions': 'Column-level' } } } : c)
	})
	await cell(page, 0, 2).click()
	await page.keyboard.type('zzz')
	await expect(gridLocator(page).locator('.wg__dropdown')).toContainText('Column-level')
})

test.describe('page-wide labels (core /locale: window.components.locale)', () => {
	test.afterEach(async ({ page }) => {
		await page.evaluate(() => { (window as any).components.locale = null })
	})

	test("the flat page dictionary ('web-grid.<key>') re-renders a live grid; an instance label still wins", async ({ page }) => {
		await onGrid(page, el => { el.labels = { 'labels.perPage': 'per page (mine)' } })
		await page.evaluate(() => {
			(window as any).components.locale = { labels: { 'web-grid.labels.pageInfo': 'Strana {current} z {total}', 'web-grid.labels.perPage': 'na stránku', 'web-grid.menuItems.deleteRow': 'Smazat' } }
		})
		await expect(pag(page).locator('.wg__pagination-info')).toContainText('Strana 1 z 2')
		await expect(pag(page).locator('.wg__pagination-label')).toHaveText('per page (mine)')
		await openToolbarOn(page, gridLocator(page).locator('tr[data-row-index="1"]'))
		await expect(toolbar(page).locator('[data-action="delete"]')).toHaveAttribute('aria-label', 'Smazat')
		await expect(toolbar(page).locator('[data-action="add"]')).toHaveAttribute('aria-label', 'Add row')
	})

	test('translateCallback gets the full key of every label (an i18n library plugs in here)', async ({ page }) => {
		await page.evaluate(() => {
			(window as any).components.locale = {
				translateCallback: ({ component, key, params }: { component: string; key: string; params: Record<string, unknown> }) =>
					key === 'web-grid.labels.pageInfo' ? `${component}:${params.current}/${params.total}` : key === 'web-grid.labels.perPage' ? `[${key}]` : undefined
			}
		})
		await expect(pag(page).locator('.wg__pagination-info')).toContainText('web-grid:1/2')
		await expect(pag(page).locator('.wg__pagination-label')).toHaveText('[web-grid.labels.perPage]')
		await expect(pag(page).locator('.wg__pagination-info')).toContainText('3 items') // undefined → the default formatting
	})

	test("the grid's own translateCallback beats the page one; null → the page's; instance labels beat both", async ({ page }) => {
		await page.evaluate(() => {
			(window as any).components.locale = {
				translateCallback: ({ key }: { key: string }) =>
					key === 'web-grid.labels.perPage' || key === 'web-grid.buttons.nextPage' || key === 'web-grid.labels.pageInfo' ? `page:${key}` : null
			}
		})
		await onGrid(page, el => {
			el.labels = { 'buttons.nextPage': 'NEXT (mine)' }
			el.translateCallback = ({ component, key, params }: { component: string; key: string; params: Record<string, unknown> }) =>
				key === 'web-grid.labels.pageInfo' ? `element:${component}:${params.current}/${params.total}`
					: key === 'web-grid.buttons.nextPage' ? 'element:next'
						: null
		})
		// The element hook wins over the page hook
		await expect(pag(page).locator('.wg__pagination-info')).toContainText('element:web-grid:1/2')
		// The element hook says null → the page hook decides
		await expect(pag(page).locator('.wg__pagination-label')).toHaveText('page:web-grid.labels.perPage')
		// A key the instance labels set is never sent to a hook
		await expect(pag(page).locator('[data-action="next"]')).toHaveText('NEXT (mine)')
		// Neither hook answers → the English default
		await expect(pag(page).locator('[data-action="prev"]')).toHaveText('◀')
		// Removing the element hook re-renders: the page hook takes over
		await onGrid(page, el => { el.translateCallback = null })
		await expect(pag(page).locator('.wg__pagination-info')).toContainText('page:web-grid.labels.pageInfo')
	})

	test('a translateCallback assigned before the grid connects is used by the first render', async ({ page }) => {
		const perPage = await page.evaluate(async () => {
			const el = document.createElement('web-grid') as any
			el.translateCallback = ({ key }: { key: string }) => (key === 'web-grid.labels.perPage' ? 'early' : null)
			document.body.append(el)
			await el.whenReady()
			const text = el.engine.labels['labels.perPage']
			el.remove()
			return text
		})
		expect(perPage).toBe('early')
	})
})

test.describe('escaping (core /locale split: content → labels.html, attributes → labels.text)', () => {
	test.afterEach(async ({ page }) => {
		await page.evaluate(() => { (window as any).components.security = null })
	})

	test('a pager label template is markup: <b> renders bold', async ({ page }) => {
		await onGrid(page, el => { el.labels = { 'labels.pageInfo': 'Page <b>{current}</b> of {total}', 'buttons.nextPage': '<b>Next</b>' } })
		await expect(pag(page).locator('.wg__pagination-info b')).toHaveText('1')
		await expect(pag(page).locator('.wg__pagination-info')).toContainText('Page 1 of 2')
		await expect(pag(page).locator('[data-action="next"] b')).toHaveText('Next')
	})

	test('a {param} value with markup is escaped (it is data)', async ({ page }) => {
		const html = await onGrid(page, el => {
			el.labels = { 'labels.pageInfo': '<b>{current}</b> / {total}' }
			el.flush()
			return el.engine.labelHtml('labels.pageInfo', { current: '<img src=x>', total: 2 })
		})
		expect(html).toBe('<b>&lt;img src=x&gt;</b> / 2')
	})

	test('shouldEscapeLabels: true escapes the template too (pager + empty message)', async ({ page }) => {
		await onGrid(page, el => { el.labels = { 'labels.pageInfo': 'Page <b>{current}</b> of {total}' } })
		await expect(pag(page).locator('.wg__pagination-info b')).toHaveCount(1)
		// Flipping the page-wide switch alone re-renders the live grid (localeChanged)
		await page.evaluate(() => { (window as any).components.security = { shouldEscapeLabels: true } })
		await expect(pag(page).locator('.wg__pagination-info')).toContainText('Page <b>1</b> of 2')
		await expect(pag(page).locator('.wg__pagination-info b')).toHaveCount(0)
		await onGrid(page, el => { el.labels = { 'messages.noData': '<i>Nothing</i>' }; el.items = [] })
		await expect(gridLocator(page).locator('.wg__empty')).toHaveText('<i>Nothing</i>')
		await expect(gridLocator(page).locator('.wg__empty i')).toHaveCount(0)
	})

	test('the empty-table message follows the same rule: markup renders by default', async ({ page }) => {
		await onGrid(page, el => { el.items = []; el.labels = { 'messages.noData': '<i>Nothing</i> here' } })
		await expect(gridLocator(page).locator('.wg__empty i')).toHaveText('Nothing')
		await expect(gridLocator(page).locator('.wg__empty')).toHaveText('Nothing here')
	})
})

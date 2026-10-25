import { test, expect, type Page, gridLocator, cell, header, onGrid, waitForRows, openToolbarOn, openContextMenu, menuRoot } from './fixtures'

/**
 * i18n — `labels` across the row toolbar, header context menu, pagination,
 * shortcuts help, dropdown "no options", and the go-to-row dialog.
 *
 * Fixture: docs/test/i18n.html — toolbar built-ins, header-menu built-ins,
 * pagination (page-size 2, 3 rows), shortcuts help, a combobox.
 */

const PAGE = '/test/i18n.html'

const CS = {
	rowActions: 'Akce řádku',
	keyboardShortcuts: 'Klávesové zkratky',
	paginationNext: 'Další',
	paginationPageInfo: 'Strana {current} z {total}',
	paginationItemCount: '{count} položek',
	paginationPerPage: 'na stránku',
	dropdownNoOptions: 'Žádné možnosti',
	actions: {
		add: 'Přidat řádek', delete: 'Smazat řádek', duplicate: 'Duplikovat řádek', moveUp: 'Nahoru', moveDown: 'Dolů',
		expandAll: 'Rozbalit vše', collapseAll: 'Sbalit vše', expandTree: 'Rozbalit strom', collapseTree: 'Sbalit strom'
	},
	contextMenu: {
		sortAsc: 'Seřadit vzestupně', sortDesc: 'Seřadit sestupně', clearSort: 'Zrušit řazení', hideColumn: 'Skrýt sloupec',
		freezeColumn: 'Ukotvit sloupec', unfreezeColumn: 'Uvolnit sloupec', columnVisibility: 'Viditelnost sloupců', showAll: 'Zobrazit vše'
	}
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
	await onGrid(page, el => { el.labels = { paginationNext: 'NEXT' } })
	await expect(pag(page).locator('[data-action="next"]')).toHaveText('NEXT')
	await expect(pag(page).locator('[data-action="prev"]')).toHaveText('◀')
	await expect(pag(page).locator('.wg__pagination-info')).toContainText('Page 1 of 2')
})

test('a partial nested labels.actions keeps the other action labels', async ({ page }) => {
	test.fail(true, 'NOTES.md #31')
	await onGrid(page, el => { el.labels = { actions: { delete: 'Smazat' } } })
	await openToolbarOn(page, gridLocator(page).locator('tr[data-row-index="1"]'))
	await expect(toolbar(page).locator('[data-action="delete"]')).toHaveAttribute('aria-label', 'Smazat')
	await expect(toolbar(page).locator('[data-action="add"]')).toHaveAttribute('aria-label', 'Add row', { timeout: 1500 })
})

test('the go-to-row dialog texts are translatable through labels', async ({ page }) => {
	test.fail(true, 'NOTES.md #32')
	await onGrid(page, el => { el.labels = { goToRow: 'Přejít na řádek', goToRowCancel: 'Zrušit', goToRowGo: 'Přejít' } })
	await cell(page, 0, 1).click()
	await page.keyboard.press('Control+g')
	const dlg = gridLocator(page).locator('.wg__goto-dialog')
	await expect(dlg).toBeVisible()
	await expect(dlg.locator('.wg__goto-label')).toContainText('Přejít na řádek', { timeout: 1500 })
	await expect(dlg.locator('.wg__goto-btn--cancel')).toHaveText('Zrušit')
})

import { test, expect, Page, gridLocator, header } from './fixtures'

/**
 * ARIA grid semantics (test/aria.html). Navigation stays the grid's own (Excel
 * model, VALIDATION-NOTES C-CA-25); these checks cover the structure a screen
 * reader reads: roles, aria-rowcount / -rowindex over virtual rows (1-based, the
 * header row counts), aria-colindex, aria-sort, aria-selected, aria-readonly,
 * treegrid levels.
 */

const PAGE = '/test/aria.html'

async function gotoAria(page: Page) {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr.wg__row').first()).toBeVisible()
}

function row(page: Page, rowIndex: number, id = 'grid') {
	return gridLocator(page, id).locator(`tbody tr.wg__row[data-row-index="${rowIndex}"]`)
}

test.describe('ARIA grid semantics', () => {
	test('roles: grid / row / columnheader / rowheader / gridcell; counts on the table', async ({ page }) => {
		await gotoAria(page)
		const table = gridLocator(page).locator('table.wg__table')
		await expect(table).toHaveAttribute('role', 'grid')
		// 1 header row + 1000 data rows; row-number column + 4 data columns
		await expect(table).toHaveAttribute('aria-rowcount', '1001')
		await expect(table).toHaveAttribute('aria-colcount', '5')
		await expect(table).toHaveAttribute('aria-multiselectable', 'true')
		await expect(table).not.toHaveAttribute('aria-readonly', /.*/)

		const headerRow = gridLocator(page).locator('thead tr').first()
		await expect(headerRow).toHaveAttribute('role', 'row')
		await expect(headerRow).toHaveAttribute('aria-rowindex', '1')
		await expect(header(page, 'id')).toHaveAttribute('role', 'columnheader')
		await expect(header(page, 'id')).toHaveAttribute('aria-colindex', '2')
		await expect(gridLocator(page).locator('thead th.wg__row-number-header')).toHaveAttribute('role', 'columnheader')

		await expect(row(page, 0)).toHaveAttribute('role', 'row')
		await expect(row(page, 0)).toHaveAttribute('aria-rowindex', '2')
		await expect(row(page, 0).locator('td.wg__row-number')).toHaveAttribute('role', 'rowheader')
		await expect(row(page, 0).locator('td.wg__row-number')).toHaveAttribute('aria-colindex', '1')
		const nameCell = row(page, 0).locator('td[data-col="1"]')
		await expect(nameCell).toHaveAttribute('role', 'gridcell')
		await expect(nameCell).toHaveAttribute('aria-colindex', '3')
		// Name is editable; ID is not → aria-readonly only on the latter
		await expect(nameCell).not.toHaveAttribute('aria-readonly', /.*/)
		await expect(row(page, 0).locator('td[data-col="0"]')).toHaveAttribute('aria-readonly', 'true')
		// Layout-only parts are hidden from AT
		await expect(row(page, 0).locator('td.wg__filler')).toHaveAttribute('aria-hidden', 'true')
	})

	test('aria-rowindex matches the data row after scrolling the virtual window', async ({ page }) => {
		await gotoAria(page)
		await gridLocator(page).evaluate((el: any) => { el.shadowRoot.querySelector('.wg').scrollTop = 38 * 500 })
		await expect(row(page, 500)).toBeAttached()
		// Only the window is in the DOM — the count stays the full one
		await expect(gridLocator(page).locator('tbody tr.wg__row[data-row-index="0"]')).toHaveCount(0)
		await expect(gridLocator(page).locator('table.wg__table')).toHaveAttribute('aria-rowcount', '1001')

		const rows = gridLocator(page).locator('tbody tr.wg__row')
		const pairs = await rows.evaluateAll(els => els.map(el => ({
			dataRow: Number(el.getAttribute('data-row-index')),
			ariaRow: Number(el.getAttribute('aria-rowindex')),
			text: el.querySelector('td[data-col="1"]')?.textContent?.trim()
		})))
		expect(pairs.length).toBeGreaterThan(5)
		for (const p of pairs) {
			expect(p.ariaRow).toBe(p.dataRow + 2)
			expect(p.text).toBe(`Employee ${p.dataRow + 1}`)
		}
		// Spacer rows carry no row semantics
		await expect(gridLocator(page).locator('tbody tr.wg__spacer-top')).toHaveAttribute('aria-hidden', 'true')
	})

	test('aria-sort follows a sort click (only the sorted column carries it)', async ({ page }) => {
		await gotoAria(page)
		await expect(header(page, 'name')).not.toHaveAttribute('aria-sort', /.*/)

		await header(page, 'name').locator('.wg__sort-indicator').click()
		await expect(header(page, 'name')).toHaveAttribute('aria-sort', 'ascending')
		await expect(header(page, 'id')).not.toHaveAttribute('aria-sort', /.*/)

		await header(page, 'name').locator('.wg__sort-indicator').click()
		await expect(header(page, 'name')).toHaveAttribute('aria-sort', 'descending')

		await header(page, 'id').locator('.wg__sort-indicator').click()
		await expect(header(page, 'id')).toHaveAttribute('aria-sort', 'ascending')
		await expect(header(page, 'name')).not.toHaveAttribute('aria-sort', /.*/)
	})

	test('aria-selected follows row and column selection', async ({ page }) => {
		await gotoAria(page)
		await expect(row(page, 1)).toHaveAttribute('aria-selected', 'false')

		await row(page, 1).locator('td.wg__row-number').click()
		await expect(row(page, 1)).toHaveAttribute('aria-selected', 'true')
		await expect(row(page, 2)).toHaveAttribute('aria-selected', 'false')

		await row(page, 3).locator('td.wg__row-number').click({ modifiers: ['Control'] })
		await expect(row(page, 1)).toHaveAttribute('aria-selected', 'true')
		await expect(row(page, 3)).toHaveAttribute('aria-selected', 'true')

		await page.keyboard.press('Escape')
		await expect(row(page, 1)).toHaveAttribute('aria-selected', 'false')
		await expect(row(page, 3)).toHaveAttribute('aria-selected', 'false')

		// Column selection (Shift+click a header) selects that column's cells
		const emailCell = row(page, 0).locator('td[data-col="2"]')
		await expect(emailCell).toHaveAttribute('aria-selected', 'false')
		await header(page, 'email').click({ modifiers: ['Shift'] })
		await expect(emailCell).toHaveAttribute('aria-selected', 'true')
		await expect(row(page, 0).locator('td[data-col="3"]')).toHaveAttribute('aria-selected', 'false')
	})

	test('a read-only grid says so once on the table', async ({ page }) => {
		await gotoAria(page)
		const table = gridLocator(page, 'readonlyGrid').locator('table.wg__table')
		await expect(table).toHaveAttribute('aria-readonly', 'true')
		await expect(table).toHaveAttribute('aria-rowcount', '6')
		await expect(table).toHaveAttribute('aria-colcount', '4')
		await expect(row(page, 0, 'readonlyGrid').locator('td[data-col="1"]')).not.toHaveAttribute('aria-readonly', /.*/)
	})

	test('tree mode: treegrid with aria-level / aria-expanded, kept in step with a toggle', async ({ page }) => {
		await gotoAria(page)
		const table = gridLocator(page, 'treeGrid').locator('table.wg__table')
		await expect(table).toHaveAttribute('role', 'treegrid')
		await expect(row(page, 0, 'treeGrid')).toHaveAttribute('aria-level', '1')
		await expect(row(page, 0, 'treeGrid')).toHaveAttribute('aria-expanded', 'true')
		// Engineering (level 2) is collapsed; Sales (level 2) is a leaf → no aria-expanded
		const engineering = gridLocator(page, 'treeGrid').locator('tbody tr.wg__row', { hasText: 'Engineering' })
		const sales = gridLocator(page, 'treeGrid').locator('tbody tr.wg__row', { hasText: 'Sales' })
		await expect(engineering).toHaveAttribute('aria-level', '2')
		await expect(engineering).toHaveAttribute('aria-expanded', 'false')
		await expect(sales).toHaveAttribute('aria-level', '2')
		await expect(sales).not.toHaveAttribute('aria-expanded', /.*/)

		await engineering.locator('.wg__tree-chevron').click()
		await expect(engineering).toHaveAttribute('aria-expanded', 'true')
		const platform = gridLocator(page, 'treeGrid').locator('tbody tr.wg__row', { hasText: 'Platform Team' })
		await expect(platform).toHaveAttribute('aria-level', '3')
		await expect(table).toHaveAttribute('aria-rowcount', '5')
	})
})

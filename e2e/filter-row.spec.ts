import { test, expect, type Page, gridLocator, cell, onGrid, domEvents, clearEvents, waitForRows } from './fixtures'

/**
 * Built-in filter row (NOTES.md #4) — grid `isFilterable` + `column.isFilterable`
 * text inputs; debounced `setFilter` → page 1; Enter / Escape; invalid
 * `filterCallback` input (`.wg__filter-input--invalid`); focus survives the re-render; frozen +
 * sticky cells; server pagination → `beforePageChangeCallback` (trigger 'filter')
 * + `data-request` (trigger 'filter').
 *
 * Fixture: test/filter-row.html — #grid (13 rows, page-size 4, row numbers,
 * 1 frozen column; name / city / salary filterable) and #server (server paging +
 * server filtering).
 */

const PAGE = '/test/filter-row.html'

const filterRow = (page: Page, id = 'grid') => gridLocator(page, id).locator('thead tr.wg__filter-row')
const input = (page: Page, field: string, id = 'grid') => filterRow(page, id).locator(`input.wg__filter-input[data-field="${field}"]`)
const rowCount = (page: Page, id = 'grid') => gridLocator(page, id).locator('tbody tr.wg__row')
const pageInfo = (page: Page, id = 'grid') => gridLocator(page, id).locator('.wg__pagination-info')

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await waitForRows(page, 'server')
	await clearEvents(page, 'filter-row')
})

test.describe('rendering', () => {
	test('a filter row under the header; inputs only for isFilterable columns, labelled by the column', async ({ page }) => {
		await expect(filterRow(page)).toHaveCount(1)
		await expect(filterRow(page).locator('input')).toHaveCount(3)
		await expect(input(page, 'name')).toHaveAttribute('aria-label', 'Filter Name')
		await expect(input(page, 'salary')).toHaveAttribute('aria-label', 'Filter Salary')
		// one filter cell per header cell (row number + 4 columns + filler)
		const counts = await gridLocator(page).locator('thead tr').evaluateAll(trs => trs.map(tr => tr.children.length))
		expect(counts[0]).toBe(counts[1])
	})

	test('no row without grid isFilteringEnabled, or when no column is filterable', async ({ page }) => {
		await onGrid(page, el => el.removeAttribute('enable-filtering'))
		await expect(filterRow(page)).toHaveCount(0)
		await onGrid(page, el => { el.isFilteringEnabled = true; el.columns = el.columns.map((c: any) => ({ ...c, isFilterable: false })) })
		await expect(filterRow(page)).toHaveCount(0)
	})

	test('the input label follows labels.filterColumn', async ({ page }) => {
		await onGrid(page, el => { el.labels = { filterColumn: 'Filtrovat {column}' } })
		await expect(input(page, 'city')).toHaveAttribute('aria-label', 'Filtrovat City')
	})
})

test.describe('typing', () => {
	test('typing filters after the debounce, resets to page 1 and keeps focus + caret', async ({ page }) => {
		await gridLocator(page).locator('.wg__pagination-btn[data-action="next"]').click()
		await expect(pageInfo(page)).toContainText('Page 2 of 4')
		await input(page, 'city').click()
		await page.keyboard.type('pr')
		expect(await onGrid(page, el => el.filters)).toEqual({})          // debounced
		await expect.poll(() => onGrid(page, el => el.filters)).toEqual({ city: 'pr' })
		await expect(rowCount(page)).toHaveCount(4)
		await expect(pageInfo(page)).toContainText('Page 1 of 2')     // 5 Prague rows
		// focus + caret survived the re-render: keep typing
		await expect(input(page, 'city')).toBeFocused()
		await page.keyboard.type('ague')
		await expect.poll(() => onGrid(page, el => el.filters)).toEqual({ city: 'prague' })
		await expect(input(page, 'city')).toHaveValue('prague')
		expect((await domEvents(page, 'filter-change', 'grid')).at(-1)).toEqual({ filters: { city: 'prague' } })
	})

	test('Enter applies at once; Escape clears the input and the filter', async ({ page }) => {
		await input(page, 'name').click()
		await page.keyboard.type('smith')
		await page.keyboard.press('Enter')
		expect(await onGrid(page, el => el.filters)).toEqual({ name: 'smith' })
		await expect(rowCount(page)).toHaveCount(1)
		await page.keyboard.press('Escape')
		expect(await onGrid(page, el => el.filters)).toEqual({})
		await expect(input(page, 'name')).toHaveValue('')
		await expect(rowCount(page)).toHaveCount(4)
	})

	test('typing in a filter does not reach the grid keys (no type-to-edit, no cell navigation)', async ({ page }) => {
		await cell(page, 0, 1).click()
		await input(page, 'name').click()
		await page.keyboard.type('a')
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Home')
		await expect(input(page, 'name')).toBeFocused()
		expect(await onGrid(page, el => el.editingCell ?? null)).toBe(null)
	})

	test('a programmatic setFilter shows in the input', async ({ page }) => {
		await onGrid(page, el => el.setFilter('city', 'Ostrava'))
		await expect(input(page, 'city')).toHaveValue('Ostrava')
	})

	test('typed text survives an unrelated re-render before the debounce applies it', async ({ page }) => {
		await input(page, 'name').click()
		await page.keyboard.type('gin')
		await onGrid(page, el => { el.isStriped = !el.isStriped })   // re-render
		await expect(input(page, 'name')).toHaveValue('gin')
		await expect(input(page, 'name')).toBeFocused()
		await expect.poll(() => onGrid(page, el => el.filters)).toEqual({ name: 'gin' })
	})

	test('Tab moves between the filter inputs (keyboard reachable)', async ({ page }) => {
		await input(page, 'name').focus()
		await page.keyboard.press('Tab')
		await expect(input(page, 'city')).toBeFocused()
		await page.keyboard.press('Tab')
		await expect(input(page, 'salary')).toBeFocused()
	})
})

test.describe('filterCallback', () => {
	test('null (incomplete input) → .wg__filter-input--invalid red border, the filter is ignored', async ({ page }) => {
		await input(page, 'salary').fill('>')
		await page.keyboard.press('Enter')
		await expect(input(page, 'salary')).toHaveClass(/wg__filter-input--invalid/)
		await expect(input(page, 'salary')).toHaveAttribute('aria-invalid', 'true')
		await expect(pageInfo(page)).toContainText('13 items')
		const color = await input(page, 'salary').evaluate(el => getComputedStyle(el).borderTopColor)
		const danger = await gridLocator(page).locator('.wg').evaluate(el => {
			const probe = document.createElement('span')
			probe.style.color = 'var(--wg-danger-color)'
			el.appendChild(probe)
			const c = getComputedStyle(probe).color
			probe.remove()
			return c
		})
		expect(color).toBe(danger)
		await input(page, 'salary').fill('>90000')
		await page.keyboard.press('Enter')
		await expect(input(page, 'salary')).not.toHaveClass(/wg__filter-input--invalid/)
		await expect(pageInfo(page)).toContainText('2 items')
	})
})

test.describe('layout', () => {
	test('the frozen column keeps its filter cell sticky; the row sticks under the header', async ({ page }) => {
		const cellInfo = await filterRow(page).locator('th').evaluateAll(ths => ths.map(th => {
			const s = getComputedStyle(th)
			return { position: s.position, top: s.top, frozen: th.classList.contains('wg__filter-cell--frozen') }
		}))
		const headerHeight = await gridLocator(page).locator('thead tr').first().evaluate(tr => (tr as HTMLElement).offsetHeight)
		expect(cellInfo.every(c => c.position === 'sticky' && c.top === `${headerHeight}px`)).toBe(true)
		expect(cellInfo.filter(c => c.frozen)).toHaveLength(1)   // the id column (frozen-column-count=1)
	})
})

test.describe('server pagination', () => {
	test("a filter change runs beforePageChangeCallback (trigger 'filter') and data-request (trigger 'filter')", async ({ page }) => {
		await gridLocator(page, 'server').locator('.wg__pagination-btn[data-action="next"]').click()
		await expect(pageInfo(page, 'server')).toContainText('Page 2 of 4')
		await clearEvents(page, 'filter-row')
		await input(page, 'city', 'server').fill('prague')
		await page.keyboard.press('Enter')
		expect(await page.evaluate(() => (window as any).lastPageChange)).toEqual({ trigger: 'filter', fromPage: 2, toPage: 1 })
		expect(await domEvents(page, 'data-request', 'server')).toEqual([expect.objectContaining({ trigger: 'filter', page: 1 })])
		await expect(pageInfo(page, 'server')).toContainText('Page 1 of 2')
		await expect(pageInfo(page, 'server')).toContainText('5 items')
	})

	test('beforePageChangeCallback false → the filter is not applied, the input reverts', async ({ page }) => {
		await page.locator('#block-server').check()
		await input(page, 'city', 'server').fill('brno')
		await page.keyboard.press('Enter')
		expect(await onGrid(page, el => el.filters, 'server')).toEqual({})
		await expect(input(page, 'city', 'server')).toHaveValue('')
		expect(await domEvents(page, 'data-request', 'server')).toEqual([])
	})
})

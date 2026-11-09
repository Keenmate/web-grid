import { test, expect, Page, gridLocator, cell } from './fixtures'

/**
 * E2E coverage for custom styling (docs/test/custom-styling.html) — a 6-row grid
 * exercising:
 *   - static `cellClass` on a column (name)
 *   - `getCellClassCallback` bucketing values into classes (salary)
 *   - `getRowClassCallback` tagging whole rows (row-inactive on Inactive rows)
 *   - `renderCellCallback` rendering custom cell HTML (flag)
 *   - `getCustomStylesCallback` injecting the CSS so those classes actually paint
 *
 * Column indices: 0=id, 1=name, 2=salary, 3=status, 4=flag.
 * See custom-styling.html for the seed table.
 */

const PAGE = '/test/custom-styling.html'
const GRID = 'web-grid#grid'

function bodyRow(page: Page, rowIndex: number) {
	return gridLocator(page).locator('tbody tr').nth(rowIndex)
}

async function gotoCustomStyling(page: Page) {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
}

// =============================================================================
// Static cellClass
// =============================================================================

test.describe('static cellClass on a column', () => {
	test('every cell in the name column carries the configured class', async ({ page }) => {
		await gotoCustomStyling(page)

		await expect(cell(page, 0, 1)).toHaveClass(/(^|\s)name-cell(\s|$)/)
		await expect(cell(page, 5, 1)).toHaveClass(/(^|\s)name-cell(\s|$)/)
		// Other columns don't get it.
		await expect(cell(page, 0, 2)).not.toHaveClass(/(^|\s)name-cell(\s|$)/)
	})

	test('getCustomStylesCallback makes the name-cell rule take effect', async ({ page }) => {
		await gotoCustomStyling(page)

		// The injected rule sets font-weight: 700 on .name-cell.
		const weight = await cell(page, 0, 1).evaluate(el => getComputedStyle(el).fontWeight)
		expect(weight).toBe('700')
	})
})

// =============================================================================
// getCellClassCallback
// =============================================================================

test.describe('getCellClassCallback buckets values into classes', () => {
	test('each salary cell gets the class for its value bucket', async ({ page }) => {
		await gotoCustomStyling(page)

		// High: Alice (row 0, 95000), Eve (row 4, 105000).
		await expect(cell(page, 0, 2)).toHaveClass(/(^|\s)salary-high(\s|$)/)
		await expect(cell(page, 4, 2)).toHaveClass(/(^|\s)salary-high(\s|$)/)
		// Mid: Carol (row 2, 78000), David (row 3, 88000).
		await expect(cell(page, 2, 2)).toHaveClass(/(^|\s)salary-mid(\s|$)/)
		await expect(cell(page, 3, 2)).toHaveClass(/(^|\s)salary-mid(\s|$)/)
		// Low: Bob (row 1, 62000), Frank (row 5, 67000).
		await expect(cell(page, 1, 2)).toHaveClass(/(^|\s)salary-low(\s|$)/)
		await expect(cell(page, 5, 2)).toHaveClass(/(^|\s)salary-low(\s|$)/)
	})

	test('the injected styles paint each bucket its own background colour', async ({ page }) => {
		await gotoCustomStyling(page)

		const bg = (rowIndex: number) =>
			cell(page, rowIndex, 2).evaluate(el => getComputedStyle(el).backgroundColor)

		expect(await bg(0)).toBe('rgb(209, 250, 229)')  // salary-high (Alice)
		expect(await bg(2)).toBe('rgb(254, 249, 195)')  // salary-mid  (Carol)
		expect(await bg(1)).toBe('rgb(254, 226, 226)')  // salary-low  (Bob)
	})
})

// =============================================================================
// getRowClassCallback
// =============================================================================

test.describe('getRowClassCallback tags whole rows', () => {
	test('Inactive rows get the row-inactive class, Active rows do not', async ({ page }) => {
		await gotoCustomStyling(page)

		// Carol (row 2) and Frank (row 5) are Inactive.
		await expect(bodyRow(page, 2)).toHaveClass(/(^|\s)row-inactive(\s|$)/)
		await expect(bodyRow(page, 5)).toHaveClass(/(^|\s)row-inactive(\s|$)/)
		// Alice (row 0) is Active.
		await expect(bodyRow(page, 0)).not.toHaveClass(/(^|\s)row-inactive(\s|$)/)
	})

	test('the injected row-inactive rule dims the row (opacity 0.5)', async ({ page }) => {
		await gotoCustomStyling(page)

		const opacity = await bodyRow(page, 2).evaluate(el => getComputedStyle(el).opacity)
		expect(opacity).toBe('0.5')
	})
})

// =============================================================================
// renderCellCallback
// =============================================================================

test.describe('renderCellCallback renders custom cell HTML', () => {
	test('the flag column renders the star span only for flag === "star"', async ({ page }) => {
		await gotoCustomStyling(page)

		// Alice (row 0) and David (row 3) have flag 'star'.
		await expect(cell(page, 0, 4).locator('.flag-star')).toBeVisible()
		await expect(cell(page, 0, 4).locator('.flag-star')).toContainText('★')
		await expect(cell(page, 3, 4).locator('.flag-star')).toBeVisible()

		// Bob (row 1) has flag 'none' — no star span.
		await expect(cell(page, 1, 4).locator('.flag-star')).toHaveCount(0)
	})

	test('getCustomStylesCallback colours the renderCellCallback markup', async ({ page }) => {
		await gotoCustomStyling(page)

		const color = await cell(page, 0, 4).locator('.flag-star')
			.evaluate(el => getComputedStyle(el).color)
		expect(color).toBe('rgb(245, 158, 11)')
	})
})

// =============================================================================
// customStyles / getCustomStylesCallback — core createCustomStyles() (C-CA-15)
// =============================================================================

/** A second grid on the custom-styling page, with the given attributes. */
async function addGrid(page: Page, id: string, attrs = ''): Promise<void> {
	await page.evaluate(({ id, attrs }) => {
		const host = document.createElement('div')
		host.innerHTML = `<web-grid id="${id}" ${attrs}></web-grid>`
		const el = host.firstElementChild as any
		el.columns = [{ field: 'name', title: 'Name' }]
		el.items = [{ name: 'Zed' }]
		document.body.appendChild(host)
	}, { id, attrs })
	await expect(gridLocator(page, id).locator('tbody tr').first()).toBeVisible()
}

/** The text of the grid's custom-style slots, in shadow-root order. */
async function styleSlots(page: Page, id: string): Promise<{ cls: string; css: string }[]> {
	return gridLocator(page, id).evaluate((el: Element) =>
		Array.from(el.shadowRoot!.querySelectorAll('style[class*="wg-custom-styles"]'))
			.map(s => ({ cls: s.className, css: s.textContent ?? '' })))
}

test.describe('customStyles (instance + page-wide layers)', () => {
	test('the custom-styles attribute / customStyles property style the shadow root', async ({ page }) => {
		await gotoCustomStyling(page)
		await addGrid(page, 'cs', 'custom-styles=".wg__cell { color: rgb(1, 2, 3); }"')
		const name = gridLocator(page, 'cs').locator('td.wg__cell').first()
		await expect(name).toHaveCSS('color', 'rgb(1, 2, 3)')
		await gridLocator(page, 'cs').evaluate((el: any) => { el.customStyles = '.wg__cell { color: rgb(4, 5, 6); }' })
		await expect(name).toHaveCSS('color', 'rgb(4, 5, 6)')
		await gridLocator(page, 'cs').evaluate((el: any) => { el.customStyles = undefined })
		await expect(name).not.toHaveCSS('color', 'rgb(4, 5, 6)')
	})

	test('getCustomStylesCallback wins over customStyles and gets the grid context', async ({ page }) => {
		await gotoCustomStyling(page)
		await addGrid(page, 'cs', 'custom-styles=".wg__cell { color: rgb(1, 2, 3); }"')
		const hasController = await gridLocator(page, 'cs').evaluate((el: any) => {
			let seen = false
			el.getCustomStylesCallback = (ctx: any) => { seen = !!ctx.controller && ctx.element === el; return '.wg__cell { color: rgb(7, 8, 9); }' }
			return el.whenSettled().then(() => seen)
		})
		expect(hasController).toBe(true)
		await expect(gridLocator(page, 'cs').locator('td.wg__cell').first()).toHaveCSS('color', 'rgb(7, 8, 9)')
	})

	test('page-wide window.components["web-grid"].customStyles styles every grid; an instance overrides it', async ({ page }) => {
		await gotoCustomStyling(page)
		await page.evaluate(() => { (window as any).components['web-grid'].customStyles = '.wg__cell { color: rgb(10, 20, 30); }' })
		await addGrid(page, 'p1')
		await addGrid(page, 'p2', 'custom-styles=".wg__cell { color: rgb(40, 50, 60); }"')
		await expect(gridLocator(page, 'p1').locator('td.wg__cell').first()).toHaveCSS('color', 'rgb(10, 20, 30)')
		await expect(gridLocator(page, 'p2').locator('td.wg__cell').first()).toHaveCSS('color', 'rgb(40, 50, 60)')
		// the page layer sits before the instance layer
		expect((await styleSlots(page, 'p2')).map(s => s.cls)).toEqual(['wg-custom-styles--page', 'wg-custom-styles'])
		// a later page assignment reaches live grids
		await page.evaluate(() => { (window as any).components['web-grid'].customStyles = '.wg__cell { color: rgb(11, 21, 31); }' })
		await expect(gridLocator(page, 'p1').locator('td.wg__cell').first()).toHaveCSS('color', 'rgb(11, 21, 31)')
	})

	test('an @import is linked once in the document head; destroy() releases it', async ({ page }) => {
		await gotoCustomStyling(page)
		const href = 'data:text/css,.x%7Bcolor:red%7D'
		await addGrid(page, 'i1', `custom-styles="@import url('${href}');"`)
		await addGrid(page, 'i2', `custom-styles="@import url('${href}');"`)
		await expect(page.locator('head link[data-km-custom-styles]')).toHaveCount(1)
		await page.evaluate(() => { (document.getElementById('i1') as any).destroy(); (document.getElementById('i2') as any).destroy() })
		await expect(page.locator('head link[data-km-custom-styles]')).toHaveCount(0)
		expect(await styleSlots(page, 'i1')).toEqual([])
	})
})

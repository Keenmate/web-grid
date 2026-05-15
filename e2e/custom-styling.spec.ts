import { test, expect, Page } from '@playwright/test'

/**
 * E2E coverage for custom styling (docs/test/custom-styling.html) — a 6-row grid
 * exercising:
 *   - static `cellClass` on a column (name)
 *   - `cellClassCallback` bucketing values into classes (salary)
 *   - `rowClassCallback` tagging whole rows (row-inactive on Inactive rows)
 *   - `templateCallback` rendering custom cell HTML (flag)
 *   - `customStylesCallback` injecting the CSS so those classes actually paint
 *
 * Column indices: 0=id, 1=name, 2=salary, 3=status, 4=flag.
 * See custom-styling.html for the seed table.
 */

const PAGE = '/test/custom-styling.html'
const GRID = 'web-grid#grid'

function gridLocator(page: Page) {
	return page.locator(GRID)
}

function cell(page: Page, rowIndex: number, colIndex: number) {
	return gridLocator(page).locator(`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`)
}

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

	test('customStylesCallback makes the name-cell rule take effect', async ({ page }) => {
		await gotoCustomStyling(page)

		// The injected rule sets font-weight: 700 on .name-cell.
		const weight = await cell(page, 0, 1).evaluate(el => getComputedStyle(el).fontWeight)
		expect(weight).toBe('700')
	})
})

// =============================================================================
// cellClassCallback
// =============================================================================

test.describe('cellClassCallback buckets values into classes', () => {
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
// rowClassCallback
// =============================================================================

test.describe('rowClassCallback tags whole rows', () => {
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
// templateCallback
// =============================================================================

test.describe('templateCallback renders custom cell HTML', () => {
	test('the flag column renders the star span only for flag === "star"', async ({ page }) => {
		await gotoCustomStyling(page)

		// Alice (row 0) and David (row 3) have flag 'star'.
		await expect(cell(page, 0, 4).locator('.flag-star')).toBeVisible()
		await expect(cell(page, 0, 4).locator('.flag-star')).toContainText('★')
		await expect(cell(page, 3, 4).locator('.flag-star')).toBeVisible()

		// Bob (row 1) has flag 'none' — no star span.
		await expect(cell(page, 1, 4).locator('.flag-star')).toHaveCount(0)
	})

	test('customStylesCallback colours the templateCallback markup', async ({ page }) => {
		await gotoCustomStyling(page)

		const color = await cell(page, 0, 4).locator('.flag-star')
			.evaluate(el => getComputedStyle(el).color)
		expect(color).toBe('rgb(245, 158, 11)')
	})
})

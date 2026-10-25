import { test, expect, type Page, gridLocator, cell, onGrid, domEvents, clearEvents, waitForRows } from './fixtures'

/**
 * Dropdown / checkbox flags — `dropdownToggleVisibility` (grid + column),
 * `shouldShowDropdownOnFocus`, `shouldOpenDropdownOnEnter` (grid + column),
 * checkbox toggling in navigate mode, `isCheckboxAlwaysEditable`.
 *
 * Fixture: docs/test/dropdown-flags.html — navigate mode,
 * should-show-dropdown-on-focus="false"; cols 0=name, 1=status (select),
 * 2=done (checkbox), 3=owner (select, column shouldOpenDropdownOnEnter: true).
 */

const PAGE = '/test/dropdown-flags.html'
const dropdown = (page: Page) => gridLocator(page).locator('.wg__dropdown')
const display = (page: Page, r: number, c: number) => cell(page, r, c).locator('.wg__cell-dropdown-display')

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await clearEvents(page, 'dropdown-flags')
})

test.describe('dropdownToggleVisibility', () => {
	test("default 'always': the ▼ toggle is rendered without the on-focus modifier", async ({ page }) => {
		await expect(display(page, 0, 1).locator('.wg__select-toggle')).toHaveText('▼')
		await expect(display(page, 0, 1)).not.toHaveClass(/--toggle-on-focus/)
	})

	test("'on-focus' (attribute) adds the on-focus modifier; a column value overrides the grid", async ({ page }) => {
		await onGrid(page, el => el.setAttribute('dropdown-toggle-visibility', 'on-focus'))
		await expect(display(page, 0, 1)).toHaveClass(/wg__cell-dropdown-display--toggle-on-focus/)
		await onGrid(page, el => { el.columns = el.columns.map((c: any) => c.field === 'owner' ? { ...c, dropdownToggleVisibility: 'always' } : c) })
		await expect(display(page, 0, 3)).not.toHaveClass(/--toggle-on-focus/)
		await expect(display(page, 0, 1)).toHaveClass(/--toggle-on-focus/)
	})

	test('an invalid value is rejected (previous kept)', async ({ page }) => {
		await onGrid(page, el => el.setAttribute('dropdown-toggle-visibility', 'sometimes'))
		expect(await onGrid(page, el => el.dropdownToggleVisibility)).toBe('always')
	})
})

test.describe('shouldShowDropdownOnFocus', () => {
	test('false (markup): focusing a select cell does not open the dropdown', async ({ page }) => {
		await cell(page, 0, 1).click()
		await expect(cell(page, 0, 1)).toBeFocused()
		await page.waitForTimeout(150)
		await expect(dropdown(page)).toHaveCount(0)
	})

	test('true: focusing a select cell opens its dropdown', async ({ page }) => {
		await onGrid(page, el => el.removeAttribute('should-show-dropdown-on-focus'))  // default true
		expect(await onGrid(page, el => el.shouldShowDropdownOnFocus)).toBe(true)
		await cell(page, 1, 1).click()
		await expect(dropdown(page)).toBeVisible()
		await expect(dropdown(page).locator('.wg__dropdown-option')).toHaveText(['To do', 'Doing', 'Done'])
	})
})

test.describe('shouldOpenDropdownOnEnter', () => {
	test('grid default false: Enter on a select cell does not open it', async ({ page }) => {
		await cell(page, 0, 1).click()
		await page.keyboard.press('Enter')
		await page.waitForTimeout(150)
		await expect(dropdown(page)).toHaveCount(0)
	})

	test('column true: Enter opens that column\'s dropdown', async ({ page }) => {
		await cell(page, 0, 3).click()
		await page.keyboard.press('Enter')
		await expect(dropdown(page)).toBeVisible()
		await expect(dropdown(page).locator('.wg__dropdown-option')).toHaveText(['Ann', 'Bob'])
	})

	test('grid attribute true opens on Enter for every select column', async ({ page }) => {
		await onGrid(page, el => el.setAttribute('should-open-dropdown-on-enter', ''))
		await cell(page, 1, 1).click()
		await page.keyboard.press('Enter')
		await expect(dropdown(page)).toBeVisible()
	})
})

test.describe('checkbox', () => {
	test('Space on a focused checkbox cell toggles it (row-change)', async ({ page }) => {
		await cell(page, 0, 2).click()
		await page.keyboard.press(' ')
		await expect.poll(() => onGrid(page, el => el.getRowDraft(0)?.done)).toBe(true)
		expect(await domEvents(page, 'row-change')).toEqual([expect.objectContaining({ field: 'done', oldValue: false, newValue: true })])
	})

	test('isCheckboxAlwaysEditable: one click on the checkbox toggles it', async ({ page }) => {
		test.fail(true, 'NOTES.md #27')
		await onGrid(page, el => el.setAttribute('is-checkbox-always-editable', ''))
		await cell(page, 1, 2).locator('input[type="checkbox"]').click({ force: true })
		await expect.poll(() => onGrid(page, el => el.getRowDraft(1)?.done), { timeout: 1500 }).toBe(false)
	})
})

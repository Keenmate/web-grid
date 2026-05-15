import { test, expect, Page } from '@playwright/test'

/**
 * E2E coverage for dropdown editors (docs/test/dropdowns.html) — a 5-row grid
 * in navigate mode with four dropdown columns:
 *   country  — select with custom member mapping (code/name/flag/region) + a
 *              disabled option
 *   priority — select with a renderOptionCallback emitting custom option HTML
 *   product  — combobox (text input + dropdown)
 *   assignee — autocomplete with an async searchCallback
 *
 * Column indices: 0=id, 1=country, 2=priority, 3=product, 4=assignee.
 * See dropdowns.html for the seed table.
 */

const PAGE = '/test/dropdowns.html'
const GRID = 'web-grid#grid'

const COL = { id: 0, country: 1, priority: 2, product: 3, assignee: 4 } as const

function gridLocator(page: Page) {
	return page.locator(GRID)
}

function cell(page: Page, rowIndex: number, colIndex: number) {
	return gridLocator(page).locator(`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`)
}

function dropdown(page: Page) {
	return gridLocator(page).locator('.wg__dropdown')
}

function dropdownOptions(page: Page) {
	return dropdown(page).locator('.wg__dropdown-option')
}

async function gotoDropdowns(page: Page) {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
}

/** Focus a cell and open its editor with F2. */
async function openEditor(page: Page, rowIndex: number, colIndex: number) {
	await cell(page, rowIndex, colIndex).click()
	await page.keyboard.press('F2')
}

// =============================================================================
// select — custom member mapping
// =============================================================================

test.describe('select editor with custom member mapping (country)', () => {
	test('the dropdown renders options by displayMember and marks the disabled one', async ({ page }) => {
		await gotoDropdowns(page)
		await openEditor(page, 0, COL.country)

		await expect(dropdown(page)).toBeVisible()
		// displayMember='name' → options show full country names.
		await expect(dropdownOptions(page)).toHaveCount(7)
		await expect(dropdownOptions(page).filter({ hasText: 'United States' })).toBeVisible()
		await expect(dropdownOptions(page).filter({ hasText: 'Germany' })).toBeVisible()

		// disabledMember='disabled' → Australia is disabled.
		await expect(dropdownOptions(page).filter({ hasText: 'Australia' }))
			.toHaveClass(/wg__dropdown-option--disabled/)
	})

	test('clicking an option commits the value and closes the dropdown', async ({ page }) => {
		await gotoDropdowns(page)
		await openEditor(page, 0, COL.country)

		await dropdownOptions(page).filter({ hasText: 'France' }).click({ force: true })

		await expect(dropdown(page)).toHaveCount(0)
		await expect(cell(page, 0, COL.country)).toContainText('France')
	})

	test('keyboard ArrowDown + Enter selects the next option', async ({ page }) => {
		await gotoDropdowns(page)

		// Row 1 starts on Germany. The options list order is US, CA, UK, DE, FR, JP, AU.
		await openEditor(page, 1, COL.country)
		await expect(dropdown(page)).toBeVisible()

		// From Germany (index 3), ArrowDown highlights France (index 4); Enter commits.
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Enter')

		await expect(cell(page, 1, COL.country)).toContainText('France')
	})

	test('Escape closes the dropdown without committing', async ({ page }) => {
		await gotoDropdowns(page)

		const original = (await cell(page, 2, COL.country).textContent())?.trim() ?? ''
		await openEditor(page, 2, COL.country)
		await expect(dropdown(page)).toBeVisible()

		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Escape')

		await expect(dropdown(page)).toHaveCount(0)
		await expect(cell(page, 2, COL.country)).toContainText(original)
	})
})

// =============================================================================
// select — renderOptionCallback
// =============================================================================

test.describe('select editor with renderOptionCallback (priority)', () => {
	test('options are rendered with the custom callback HTML', async ({ page }) => {
		await gotoDropdowns(page)
		await openEditor(page, 0, COL.priority)

		await expect(dropdown(page)).toBeVisible()

		// The renderOptionCallback emits one <div class="wg__dropdown-option" data-index="N">
		// per option — four priority options, each carrying a data-index.
		await expect(dropdownOptions(page)).toHaveCount(4)
		await expect(dropdown(page).locator('.wg__dropdown-option[data-index]')).toHaveCount(4)
		await expect(dropdownOptions(page).filter({ hasText: 'Critical' })).toBeVisible()
	})

	test('clicking a custom-rendered option commits it', async ({ page }) => {
		await gotoDropdowns(page)
		await openEditor(page, 2, COL.priority)  // row 2 starts on Low

		await dropdownOptions(page).filter({ hasText: 'Critical' }).click({ force: true })

		await expect(dropdown(page)).toHaveCount(0)
		await expect(cell(page, 2, COL.priority)).toContainText('Critical')
	})
})

// =============================================================================
// combobox
// =============================================================================

test.describe('combobox editor (product)', () => {
	test('F2 opens a combobox with a text input and the full option list', async ({ page }) => {
		await gotoDropdowns(page)
		await openEditor(page, 0, COL.product)

		const input = cell(page, 0, COL.product).locator('.wg__combobox-input')
		await expect(input).toBeVisible()
		await expect(dropdown(page)).toBeVisible()
		await expect(dropdownOptions(page)).toHaveCount(6)
	})

	test('typing in the combobox filters the option list', async ({ page }) => {
		await gotoDropdowns(page)
		await openEditor(page, 0, COL.product)

		const input = cell(page, 0, COL.product).locator('.wg__combobox-input')
		await input.fill('phon')

		// Only "Smartphone" matches.
		await expect(dropdownOptions(page)).toHaveCount(1)
		await expect(dropdownOptions(page).first()).toContainText('Smartphone')
	})

	test('picking a filtered option commits its display value', async ({ page }) => {
		await gotoDropdowns(page)
		await openEditor(page, 4, COL.product)  // row 4 starts on Monitor

		const input = cell(page, 4, COL.product).locator('.wg__combobox-input')
		await input.fill('keyb')
		await dropdownOptions(page).filter({ hasText: 'Keyboard' }).click({ force: true })

		await expect(dropdown(page)).toHaveCount(0)
		await expect(cell(page, 4, COL.product)).toContainText('Keyboard')
	})
})

// =============================================================================
// autocomplete — async search
// =============================================================================

test.describe('autocomplete editor with async searchCallback (assignee)', () => {
	test('typing triggers the async search and renders matching results', async ({ page }) => {
		await gotoDropdowns(page)
		await openEditor(page, 0, COL.assignee)

		const input = cell(page, 0, COL.assignee).locator('.wg__autocomplete-input')
		await expect(input).toBeVisible()

		// Type character-by-character so the autocomplete's input handler debounces
		// and fires the searchCallback (~100ms debounce + ~150ms simulated network).
		await input.pressSequentially('ali')

		await expect(dropdown(page)).toBeVisible()
		await expect(dropdownOptions(page).filter({ hasText: 'Alice Johnson' })).toBeVisible()
	})

	test('selecting an async result commits it', async ({ page }) => {
		await gotoDropdowns(page)
		await openEditor(page, 1, COL.assignee)

		const input = cell(page, 1, COL.assignee).locator('.wg__autocomplete-input')
		await input.pressSequentially('carol')

		await expect(dropdownOptions(page).filter({ hasText: 'Carol Williams' })).toBeVisible()
		await dropdownOptions(page).filter({ hasText: 'Carol Williams' }).click({ force: true })

		await expect(dropdown(page)).toHaveCount(0)
		await expect(cell(page, 1, COL.assignee)).toContainText('Carol Williams')
	})

	test('a single bubbling input event (paste / fill) also triggers the search', async ({ page }) => {
		// Regression: handleAutocompleteInput used to lose ctx.filterText when
		// renderDropdown -> removeDropdown reset it, so a single `input` event
		// (paste, fill, programmatic value set) bailed the minLength check and
		// no search ever ran. Real per-character typing masked the bug because
		// keystrokes 2+ skipped the dropdown-render branch.
		await gotoDropdowns(page)
		await openEditor(page, 0, COL.assignee)

		const input = cell(page, 0, COL.assignee).locator('.wg__autocomplete-input')
		await expect(input).toBeVisible()

		// fill() dispatches one bubbling `input` event — same shape as a real
		// clipboard paste at the DOM level.
		await input.fill('ali')

		await expect(dropdown(page)).toBeVisible()
		await expect(dropdownOptions(page).filter({ hasText: 'Alice Johnson' })).toBeVisible()
	})

	test('a query shorter than minSearchLength does not open a results list', async ({ page }) => {
		await gotoDropdowns(page)
		await openEditor(page, 0, COL.assignee)

		const input = cell(page, 0, COL.assignee).locator('.wg__autocomplete-input')
		// minSearchLength is 1 — an empty input never produces option results.
		await expect(input).toBeVisible()
		await expect(dropdownOptions(page)).toHaveCount(0)
	})
})

import { test, expect, Page, gridLocator, cell } from './fixtures'

/**
 * E2E coverage for the `preset` input (docs/test/grid-modes.html). One grid +
 * three preset buttons. `preset` is a convenience setter that applies a bundle of
 * property defaults; the fixture reads the resolved properties back into
 * [data-testid="resolved"] after each switch.
 *
 * Modes (see grid.ts applyModeDefaults):
 *   read-only    — isEditable=false, dropdownToggleVisibility='on-focus'
 *   excel        — isEditable=true, editTrigger='navigate'
 *   input-matrix — isEditable=true, editTrigger='always', cellSelectionMode='shift'
 *
 * Column indices: 0=id (read-only), 1=name (text), 2=score (number).
 */

const PAGE = '/test/grid-modes.html'
const GRID = 'web-grid#grid'

const resolved = (page: Page) => page.locator('[data-testid="resolved"]')
const modeLabel = (page: Page) => page.locator('[data-testid="mode"]')

function modeButton(page: Page, mode: string) {
	return page.locator(`button[data-mode="${mode}"]`)
}

async function gotoGridModes(page: Page) {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
}

// =============================================================================
// Resolved property bundles
// =============================================================================

test.describe('mode preset applies the right property bundle', () => {
	test('the grid starts in excel mode with excel defaults', async ({ page }) => {
		await gotoGridModes(page)

		await expect(modeLabel(page)).toHaveText('excel')
		await expect(resolved(page)).toContainText('isEditable=true')
		await expect(resolved(page)).toContainText('editTrigger=navigate')
		await expect(resolved(page)).toContainText('cellSelectionMode=click')
		await expect(resolved(page)).toContainText('dropdownToggleVisibility=always')
		await expect(resolved(page)).toContainText('shouldShowDropdownOnFocus=false')
	})

	test('switching to read-only applies the read-only bundle', async ({ page }) => {
		await gotoGridModes(page)
		await modeButton(page, 'read-only').click()

		await expect(modeLabel(page)).toHaveText('read-only')
		await expect(resolved(page)).toContainText('isEditable=false')
		await expect(resolved(page)).toContainText('isReadonly=true')
		await expect(resolved(page)).toContainText('dropdownToggleVisibility=on-focus')
		await expect(resolved(page)).toContainText('cellSelectionMode=click')
	})

	test('switching to input-matrix applies the input-matrix bundle', async ({ page }) => {
		await gotoGridModes(page)
		await modeButton(page, 'input-matrix').click()

		await expect(modeLabel(page)).toHaveText('input-matrix')
		await expect(resolved(page)).toContainText('isEditable=true')
		await expect(resolved(page)).toContainText('isReadonly=false')
		await expect(resolved(page)).toContainText('editTrigger=always')
		await expect(resolved(page)).toContainText('cellSelectionMode=shift')
		await expect(resolved(page)).toContainText('shouldShowDropdownOnFocus=true')
	})
})

// =============================================================================
// Behavioural consequences of each mode
// =============================================================================

test.describe('mode preset changes editing behaviour', () => {
	test('excel mode: a single click only focuses; F2 opens the editor', async ({ page }) => {
		await gotoGridModes(page)
		// Already in excel mode.

		const nameCell = cell(page, 0, 1)
		await nameCell.click()
		await expect(nameCell).toHaveClass(/wg__cell--focused/)
		await expect(nameCell.locator('input')).toHaveCount(0)

		await page.keyboard.press('F2')
		await expect(nameCell.locator('input')).toBeVisible()
	})

	test('read-only mode: F2 does not open an editor', async ({ page }) => {
		await gotoGridModes(page)
		await modeButton(page, 'read-only').click()

		const nameCell = cell(page, 0, 1)
		await nameCell.click()
		await page.keyboard.press('F2')

		await expect(nameCell.locator('input')).toHaveCount(0)
	})

	test('input-matrix mode: cells are always in edit mode', async ({ page }) => {
		await gotoGridModes(page)
		await modeButton(page, 'input-matrix').click()

		// editTrigger='always' → editor inputs are mounted without any interaction.
		await expect(cell(page, 0, 1).locator('input')).toBeVisible()
		await expect(cell(page, 1, 2).locator('input')).toBeVisible()
	})
})

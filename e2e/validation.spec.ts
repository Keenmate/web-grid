import { test, expect, Page } from '@playwright/test'

/**
 * E2E coverage for cell validation (docs/test/validation.html) — a 5-row grid
 * in navigate mode with four validated columns:
 *   name  — beforeCommitCallback returns a STRING error when empty
 *   email — beforeCommitCallback returns a ValidationResult object when no '@'
 *   code  — beforeCommitCallback returns { valid, transformedValue } (uppercase)
 *   score — legacy validateCallback returns an error string when > 100
 *
 * web-grid validation is lenient: an invalid commit is NOT blocked — the value
 * still lands in the draft, the cell gets `wg__cell--invalid`, and
 * `onvalidationerror` fires (surfaced via [data-testid="validation-log"]).
 * See validation.html for the seed table.
 */

const PAGE = '/test/validation.html'
const GRID = 'web-grid#grid'

// Column indices: 0=id, 1=name, 2=email, 3=code, 4=score.
const COL = { id: 0, name: 1, email: 2, code: 3, score: 4 } as const

function gridLocator(page: Page) {
	return page.locator(GRID)
}

function cell(page: Page, rowIndex: number, colIndex: number) {
	return gridLocator(page).locator(`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`)
}

const validationLog = (page: Page) => page.locator('[data-testid="validation-log"]')

async function gotoValidation(page: Page) {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
}

/**
 * Edit a cell in navigate mode: focus it, F2 to open the editor, replace the
 * value, Enter to commit. Returns after the editor has closed.
 */
async function editCell(page: Page, rowIndex: number, colIndex: number, value: string) {
	const target = cell(page, rowIndex, colIndex)
	await target.click()
	await page.keyboard.press('F2')
	const editor = target.locator('input, textarea').first()
	await expect(editor).toBeVisible()
	await editor.selectText()
	await editor.fill(value)
	await page.keyboard.press('Enter')
}

// =============================================================================
// beforeCommitCallback — string error form (name)
// =============================================================================

test.describe('beforeCommitCallback returning a string (name column)', () => {
	test('committing an empty name marks the cell invalid and fires onvalidationerror', async ({ page }) => {
		await gotoValidation(page)

		const nameCell = cell(page, 0, COL.name)
		await expect(nameCell).not.toHaveClass(/wg__cell--invalid/)

		await editCell(page, 0, COL.name, '')

		await expect(nameCell).toHaveClass(/wg__cell--invalid/)
		await expect(validationLog(page)).toHaveText('name: Name is required')
	})

	test('committing a valid name afterwards clears the invalid state', async ({ page }) => {
		await gotoValidation(page)

		await editCell(page, 0, COL.name, '')
		await expect(cell(page, 0, COL.name)).toHaveClass(/wg__cell--invalid/)

		await editCell(page, 0, COL.name, 'Alice Renamed')

		await expect(cell(page, 0, COL.name)).not.toHaveClass(/wg__cell--invalid/)
		await expect(cell(page, 0, COL.name)).toContainText('Alice Renamed')
	})
})

// =============================================================================
// beforeCommitCallback — ValidationResult object form (email)
// =============================================================================

test.describe('beforeCommitCallback returning a ValidationResult (email column)', () => {
	test('an email without "@" is marked invalid', async ({ page }) => {
		await gotoValidation(page)

		await editCell(page, 1, COL.email, 'not-an-email')

		await expect(cell(page, 1, COL.email)).toHaveClass(/wg__cell--invalid/)
		await expect(validationLog(page)).toHaveText('email: Invalid email')
	})

	test('a well-formed email commits cleanly', async ({ page }) => {
		await gotoValidation(page)

		await editCell(page, 1, COL.email, 'bob.new@example.com')

		await expect(cell(page, 1, COL.email)).not.toHaveClass(/wg__cell--invalid/)
		await expect(cell(page, 1, COL.email)).toContainText('bob.new@example.com')
	})
})

// =============================================================================
// beforeCommitCallback — transformedValue (code)
// =============================================================================

test.describe('beforeCommitCallback transforming the value (code column)', () => {
	test('a lowercase code is uppercased on commit via transformedValue', async ({ page }) => {
		await gotoValidation(page)

		await editCell(page, 2, COL.code, 'xyz9')

		// Valid (never blocked) and rewritten to uppercase.
		await expect(cell(page, 2, COL.code)).not.toHaveClass(/wg__cell--invalid/)
		await expect(cell(page, 2, COL.code)).toContainText('XYZ9')
	})
})

// =============================================================================
// Legacy validateCallback (score)
// =============================================================================

test.describe('legacy validateCallback (score column)', () => {
	test('a score above 100 is marked invalid', async ({ page }) => {
		await gotoValidation(page)

		await editCell(page, 3, COL.score, '150')

		await expect(cell(page, 3, COL.score)).toHaveClass(/wg__cell--invalid/)
		await expect(validationLog(page)).toHaveText('score: Max 100')
	})

	test('a score within range commits cleanly', async ({ page }) => {
		await gotoValidation(page)

		await editCell(page, 3, COL.score, '95')

		await expect(cell(page, 3, COL.score)).not.toHaveClass(/wg__cell--invalid/)
		await expect(cell(page, 3, COL.score)).toContainText('95')
	})
})

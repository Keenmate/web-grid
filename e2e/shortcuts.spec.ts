import { test, expect, Page, gridLocator, cell } from './fixtures'

/**
 * E2E coverage for rowShortcuts (docs/test/shortcuts.html) — a 6-row grid in
 * navigate mode. rowShortcuts fire against the currently focused row:
 *   Ctrl+K  — delete the focused row
 *   Ctrl+D  — duplicate the focused row
 *   Ctrl+U  — move the focused row up; `disabled` when rowIndex === 0
 *   Ctrl+E  — "export" the focused row (logs only)
 *
 * The bindings deliberately avoid Delete / arrow keys: the action pipeline
 * consumes those by key name (ignoring modifiers) before rowShortcuts run, so
 * a Delete- or arrow-bound rowShortcut would silently never fire.
 *
 * Every shortcut writes "<id> row <rowIndex>" to [data-testid="shortcut-log"].
 * isShortcutsHelpVisible is on, so the .wg__shortcuts-help overlay renders.
 * See shortcuts.html for the seed table.
 */

const PAGE = '/test/shortcuts.html'
const GRID = 'web-grid#grid'

function rows(page: Page) {
	return gridLocator(page).locator('tbody tr')
}

const shortcutLog = (page: Page) => page.locator('[data-testid="shortcut-log"]')

async function gotoShortcuts(page: Page) {
	await page.goto(PAGE)
	await expect(rows(page).first()).toBeVisible()
}

/** Focus a row by clicking its Name cell (col 1) — puts the grid in navigate
 * focus on that row without entering edit mode. */
async function focusRow(page: Page, rowIndex: number) {
	const nameCell = cell(page, rowIndex, 1)
	await nameCell.click()
	await expect(nameCell).toHaveClass(/wg__cell--focused/)
}

// =============================================================================
// Delete / duplicate / export
// =============================================================================

test.describe('rowShortcuts fire against the focused row', () => {
	test('Ctrl+K removes the focused row', async ({ page }) => {
		await gotoShortcuts(page)
		await expect(rows(page)).toHaveCount(6)

		// Focus row 2 (Chair) and delete it.
		await focusRow(page, 2)
		await page.keyboard.press('Control+k')

		await expect(rows(page)).toHaveCount(5)
		await expect(shortcutLog(page)).toHaveText('delete row 2')
		// Row 2's slot is now taken by what was row 3 (Desk).
		await expect(cell(page, 2, 1)).toContainText('Desk')
	})

	test('Ctrl+D duplicates the focused row, inserting the copy below it', async ({ page }) => {
		await gotoShortcuts(page)
		await expect(rows(page)).toHaveCount(6)

		// Focus row 1 (Mouse) and duplicate it.
		await focusRow(page, 1)
		await page.keyboard.press('Control+d')

		await expect(rows(page)).toHaveCount(7)
		await expect(shortcutLog(page)).toHaveText('duplicate row 1')
		// The copy lands at row 2.
		await expect(cell(page, 2, 1)).toContainText('Mouse')
	})

	test('Ctrl+E fires the export shortcut without changing the row set', async ({ page }) => {
		await gotoShortcuts(page)

		await focusRow(page, 3)
		await page.keyboard.press('Control+e')

		await expect(shortcutLog(page)).toHaveText('export row 3')
		await expect(rows(page)).toHaveCount(6)
	})
})

// =============================================================================
// Move up + the disabled callback
// =============================================================================

test.describe('Ctrl+U move + disabled callback', () => {
	test('Ctrl+U moves a non-first row up', async ({ page }) => {
		await gotoShortcuts(page)

		// Row 2 is Chair, row 1 is Mouse. Move Chair up.
		await focusRow(page, 2)
		await page.keyboard.press('Control+u')

		await expect(shortcutLog(page)).toHaveText('moveUp row 2')
		await expect(cell(page, 1, 1)).toContainText('Chair')
		await expect(cell(page, 2, 1)).toContainText('Mouse')
	})

	test('Ctrl+U is a no-op on row 0 (disabled callback returns true)', async ({ page }) => {
		await gotoShortcuts(page)

		await focusRow(page, 0)
		await page.keyboard.press('Control+u')

		// The shortcut never fired — log stays at its initial value and row 0 is
		// still Laptop.
		await expect(shortcutLog(page)).toHaveText('none')
		await expect(cell(page, 0, 1)).toContainText('Laptop')
	})
})

// =============================================================================
// No focused row
// =============================================================================

test.describe('rowShortcuts require a focused row', () => {
	test('pressing a shortcut with no focused row does nothing', async ({ page }) => {
		await gotoShortcuts(page)

		// Nothing focused on load — Ctrl+K has no target row.
		await gridLocator(page).press('Control+k')

		await expect(rows(page)).toHaveCount(6)
		await expect(shortcutLog(page)).toHaveText('none')
	})
})

// =============================================================================
// Shortcuts help overlay
// =============================================================================

test.describe('shortcuts help overlay (isShortcutsHelpVisible)', () => {
	test('renders the .wg__shortcuts-help overlay with one item per shortcut', async ({ page }) => {
		await gotoShortcuts(page)

		const help = gridLocator(page).locator('.wg__shortcuts-help')
		await expect(help).toHaveCount(1)

		// Four rowShortcuts → four help items.
		await expect(help.locator('.wg__shortcuts-help-item')).toHaveCount(4)
		await expect(help).toContainText('Delete row')
		await expect(help).toContainText('Duplicate row')
		await expect(help).toContainText('Move row up')
		await expect(help).toContainText('Export row')
	})
})

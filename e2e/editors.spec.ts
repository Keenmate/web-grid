import { test, expect, Page, Locator, gridLocator, cell } from './fixtures'

/**
 * E2E coverage for the editors fixture (docs/test/editors.html), which exercises:
 *  - text editor       (Name, col 1)
 *  - select editor     (Department, col 2; Status, col 3)
 *  - custom editor     (Notes, col 4 — opens a native prompt via renderEditorCallback)
 *  - checkbox editor   (Protected, col 5)
 *  - contextMenu       (right-click → array-driven custom items with callbacks)
 *
 * The grid is in navigate mode + isEditable=true, so editing starts on F2/Space
 * (or dblclick for the custom one). The page surfaces an event log through the
 * [data-testid="event-log"] node — it gets a new line for every custom-editor
 * open/commit/cancel and every context-menu interaction. See the comment block
 * in editors.html for the full seed-data table.
 */

const PAGE = '/test/editors.html'
const GRID = 'web-grid#grid'

function eventLog(page: Page) {
	return page.locator('[data-testid="event-log"]')
}

async function gotoDemo(page: Page) {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
}

/**
 * Right-click helper. dispatchEvent('contextmenu') is the only reliable way to
 * pop the menu in Playwright; the shortcut variants race against shadow-DOM
 * re-renders. See memory feedback_playwright_right_click.
 */
async function openContextMenuOn(locator: Locator, page: Page) {
	await locator.evaluate((el: Element) => el.scrollIntoView({ block: 'center' }))
	const box = await locator.boundingBox()
	if (!box) throw new Error('Could not get bounding box')
	const x = box.x + box.width / 2
	const y = box.y + box.height / 2
	await page.mouse.move(x, y)
	await locator.dispatchEvent('contextmenu', {
		bubbles: true, cancelable: true, button: 2, buttons: 2,
		clientX: x, clientY: y, screenX: x, screenY: y
	})
}

// =============================================================================
// Text editor
// =============================================================================

test.describe('text editor (Name)', () => {
	test('F2 + Enter commits a new text value', async ({ page }) => {
		await gotoDemo(page)

		const nameCell = cell(page, 0, 1)
		await nameCell.click()
		await page.keyboard.press('F2')

		const editor = nameCell.locator('input.wg__editor--text, input.wg__editor').first()
		await expect(editor).toBeVisible()
		await editor.fill('Alice Renamed')
		await page.keyboard.press('Enter')

		await expect(nameCell).toContainText('Alice Renamed')
	})

	test('Escape discards the edit', async ({ page }) => {
		await gotoDemo(page)

		const nameCell = cell(page, 0, 1)
		const original = (await nameCell.textContent())?.trim() ?? ''

		await nameCell.click()
		await page.keyboard.press('F2')
		const editor = nameCell.locator('input').first()
		await editor.fill('SHOULD NOT STICK')
		await page.keyboard.press('Escape')

		await expect(nameCell).toContainText(original)
	})
})

// =============================================================================
// Select editor
// =============================================================================

test.describe('select editor (Department / Status)', () => {
	test('F2 opens the dropdown and clicking an option commits the value', async ({ page }) => {
		await gotoDemo(page)

		// Alice starts in Engineering.
		const deptCell = cell(page, 0, 2)
		await expect(deptCell).toContainText('Engineering')

		await deptCell.click()
		await page.keyboard.press('F2')

		// Dropdown lives in the shadow root; use the grid host as scope so
		// Playwright pierces correctly.
		const dropdown = gridLocator(page).locator('.wg__dropdown')
		await expect(dropdown).toBeVisible()

		await dropdown.locator('.wg__dropdown-option', { hasText: 'Marketing' }).click({ force: true })

		await expect(deptCell).toContainText('Marketing')
		await expect(dropdown).toHaveCount(0)
	})

	test('keyboard: ArrowDown + Enter selects the next option', async ({ page }) => {
		await gotoDemo(page)

		const statusCell = cell(page, 0, 3)
		await expect(statusCell).toContainText('Active')

		await statusCell.click()
		await page.keyboard.press('F2')

		// Status options are Active, Inactive, On Leave; ArrowDown twice from Active
		// → On Leave.
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Enter')

		await expect(statusCell).toContainText('On Leave')
	})

	test('Escape closes the dropdown without changing the value', async ({ page }) => {
		await gotoDemo(page)

		const deptCell = cell(page, 0, 2)
		const original = (await deptCell.textContent())?.trim() ?? ''

		await deptCell.click()
		await page.keyboard.press('F2')
		await expect(gridLocator(page).locator('.wg__dropdown')).toBeVisible()

		await page.keyboard.press('ArrowDown')  // would land on Marketing if committed
		await page.keyboard.press('Escape')

		await expect(gridLocator(page).locator('.wg__dropdown')).toHaveCount(0)
		await expect(deptCell).toContainText(original)
	})
})

// =============================================================================
// Checkbox editor
// =============================================================================

test.describe('checkbox editor (Protected)', () => {
	test('Space toggles the draft, Enter commits — cell flips ❌ → ✅', async ({ page }) => {
		await gotoDemo(page)

		// Row 0 (Alice) starts unprotected → cell shows ❌.
		const protectedCell = cell(page, 0, 5)
		await expect(protectedCell).toContainText('❌')

		await protectedCell.click()
		// Space puts the cell in checkbox-edit mode and toggles the draft. With
		// getDisplayValueCallback defined the cell renders the editor widget (no emoji)
		// until commit, so we have to commit before asserting the new glyph.
		await page.keyboard.press('Space')
		await page.keyboard.press('Enter')

		await expect(protectedCell).toContainText('✅')
	})

	test('Escape after Space discards the draft', async ({ page }) => {
		await gotoDemo(page)

		const protectedCell = cell(page, 0, 5)
		await expect(protectedCell).toContainText('❌')

		await protectedCell.click()
		await page.keyboard.press('Space')   // toggles draft, enters edit mode
		await page.keyboard.press('Escape')  // discards draft

		await expect(protectedCell).toContainText('❌')
	})
})

// =============================================================================
// Custom editor (Notes column with native prompt)
// =============================================================================

test.describe('custom editor (Notes)', () => {
	// Override window.prompt to return a known value so the renderEditorCallback's
	// commit/cancel branch is deterministic. Playwright's page.on('dialog') flow
	// for prompts is finicky — overriding the JS function is more reliable.
	async function stubPrompt(page: Page, returnValue: string | null) {
		await page.evaluate((value) => {
			(window as unknown as { prompt: (msg?: string, def?: string) => string | null }).prompt =
				() => value
		}, returnValue)
	}

	test('F2 opens the custom editor; accepted prompt commits the new value', async ({ page }) => {
		await gotoDemo(page)
		await stubPrompt(page, 'NEW NOTES')

		const notesCell = cell(page, 0, 4)
		await notesCell.click()
		await page.keyboard.press('F2')

		await expect(notesCell).toContainText('NEW NOTES')
		await expect(eventLog(page)).toContainText('Custom Editor')
		await expect(eventLog(page)).toContainText('Commit')
	})

	test('a null prompt result cancels and leaves the value unchanged', async ({ page }) => {
		await gotoDemo(page)
		await stubPrompt(page, null)

		const notesCell = cell(page, 0, 4)
		const original = (await notesCell.textContent())?.trim() ?? ''

		await notesCell.click()
		await page.keyboard.press('F2')

		await expect(notesCell).toContainText(original)
		await expect(eventLog(page)).toContainText('Cancel')
	})

	test('Space also opens the custom editor', async ({ page }) => {
		await gotoDemo(page)
		await stubPrompt(page, 'SPACE OPENED')

		const notesCell = cell(page, 0, 4)
		await notesCell.click()
		await page.keyboard.press('Space')

		await expect(notesCell).toContainText('SPACE OPENED')
	})

	test('double-click also opens the custom editor', async ({ page }) => {
		await gotoDemo(page)
		await stubPrompt(page, 'DBLCLICK OPENED')

		await cell(page, 1, 4).dblclick()  // Bob's notes cell
		await expect(cell(page, 1, 4)).toContainText('DBLCLICK OPENED')
	})
})

// =============================================================================
// Context menu (array-driven custom items)
// =============================================================================

test.describe('contextMenu — custom items', () => {
	test('right-click opens the menu and renders all custom items', async ({ page }) => {
		await gotoDemo(page)

		await openContextMenuOn(cell(page, 0, 1), page)

		const menu = page.locator('.wg-context-menu')
		await expect(menu).toBeVisible()

		// All five items configured in the fixture.
		await expect(menu.locator('.wg-context-menu__item', { hasText: 'Copy value' })).toBeVisible()
		await expect(menu.locator('.wg-context-menu__item', { hasText: 'Edit name' })).toBeVisible()       // label callback uses ctx.column.field
		await expect(menu.locator('.wg-context-menu__item', { hasText: 'View row details' })).toBeVisible()
		await expect(menu.locator('.wg-context-menu__item', { hasText: 'Protect row' })).toBeVisible()      // Alice (row 0) is unprotected
		await expect(menu.locator('.wg-context-menu__item', { hasText: 'Delete row' })).toBeVisible()
	})

	test('label callback reflects per-cell context (column.field)', async ({ page }) => {
		await gotoDemo(page)

		// Right-click on the Department cell → 'Edit department'.
		await openContextMenuOn(cell(page, 0, 2), page)
		await expect(page.locator('.wg-context-menu__item', { hasText: 'Edit department' })).toBeVisible()
	})

	test('protected row: Protect/Unprotect label flips and Delete is disabled', async ({ page }) => {
		await gotoDemo(page)

		// Eva (row 4) is protected:true in the seed.
		await openContextMenuOn(cell(page, 4, 1), page)

		const menu = page.locator('.wg-context-menu')
		await expect(menu).toBeVisible()

		// Label uses the callback form — for a protected row it flips to "Unprotect row".
		await expect(menu.locator('.wg-context-menu__item', { hasText: 'Unprotect row' })).toBeVisible()

		// Delete is disabled when the row is protected.
		const deleteItem = menu.locator('.wg-context-menu__item', { hasText: 'Delete row' })
		await expect(deleteItem).toHaveClass(/wg-context-menu__item--disabled/)
	})

	test('clicking "Copy value" fires onClick (event log captures the action)', async ({ page }) => {
		await gotoDemo(page)

		// Bob Smith's name cell.
		await openContextMenuOn(cell(page, 1, 1), page)
		await expect(page.locator('.wg-context-menu')).toBeVisible()

		// Playwright's `{ force: true }` still trips on "Element outside of viewport"
		// for Floating UI popovers in some chromium builds. Dispatch the click via
		// JS directly to bypass all actionability checks.
		await page.locator('.wg-context-menu__item', { hasText: 'Copy value' })
			.evaluate((el) => (el as HTMLElement).click())

		// The handler writes to clipboard AND logs to the event log.
		await expect(eventLog(page)).toContainText('"Bob Smith" copied to clipboard')
	})

	test('beforeContextMenuOpenCallback event fires with the right field name', async ({ page }) => {
		await gotoDemo(page)

		await openContextMenuOn(cell(page, 0, 2), page)  // department cell
		await expect(page.locator('.wg-context-menu')).toBeVisible()

		// Fixture wires beforeContextMenuOpenCallback to log:
		//   'opened at row N, column "<field>"'
		await expect(eventLog(page)).toContainText('opened at row 1, column "department"')
	})

	test('danger item carries the danger modifier class', async ({ page }) => {
		await gotoDemo(page)
		await openContextMenuOn(cell(page, 0, 1), page)

		const deleteItem = page.locator('.wg-context-menu__item', { hasText: 'Delete row' })
		await expect(deleteItem).toHaveClass(/wg-context-menu__item--danger/)
	})

	test('a divider is rendered before the divider-flagged items', async ({ page }) => {
		await gotoDemo(page)
		await openContextMenuOn(cell(page, 0, 1), page)

		// Divider entries precede 'view-row' and 'delete' → expect two
		// .wg-context-menu__divider elements inside the open menu.
		const dividers = page.locator('.wg-context-menu .wg-context-menu__divider')
		await expect(dividers).toHaveCount(2)
	})
})

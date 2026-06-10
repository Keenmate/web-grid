import { test, expect, Page, Locator } from '@playwright/test'

/**
 * E2E coverage for editTrigger modes (docs/test/edit-trigger.html). The page
 * hosts three identical 5-row grids, one per mode:
 *   #clickGrid    — editTrigger='click': a single click opens the editor;
 *                   editStartSelection='selectAll' selects the whole value.
 *   #dblclickGrid — editTrigger='dblclick': a single click only focuses;
 *                   a double-click opens the editor.
 *   #navigateGrid — editTrigger='navigate': a single click only focuses;
 *                   F2 (or typing) opens the editor.
 *
 * Column indices: 0=id (read-only), 1=name (text), 2=score (number).
 */

const PAGE = '/test/edit-trigger.html'

function gridLocator(page: Page, id: string) {
	return page.locator(`web-grid#${id}`)
}

function cell(page: Page, gridId: string, rowIndex: number, colIndex: number): Locator {
	return gridLocator(page, gridId).locator(`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`)
}

function editorIn(locator: Locator): Locator {
	return locator.locator('input, textarea').first()
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await expect(gridLocator(page, 'clickGrid').locator('tbody tr').first()).toBeVisible()
})

// =============================================================================
// editTrigger = 'click'
// =============================================================================

test.describe("editTrigger='click' — #clickGrid", () => {
	test('a single click opens the editor', async ({ page }) => {
		const nameCell = cell(page, 'clickGrid', 0, 1)
		await nameCell.click()

		await expect(editorIn(nameCell)).toBeVisible()
	})

	test('editStartSelection="selectAll" mounts the editor with the whole value selected', async ({ page }) => {
		const nameCell = cell(page, 'clickGrid', 1, 1)  // Bob
		await nameCell.click()

		const editor = editorIn(nameCell)
		await expect(editor).toBeVisible()

		// The whole value ("Bob") should be selected: selectionStart at 0, end at length.
		const selection = await editor.evaluate((el: HTMLInputElement) => ({
			start: el.selectionStart,
			end: el.selectionEnd,
			length: el.value.length
		}))
		expect(selection.start).toBe(0)
		expect(selection.end).toBe(selection.length)
		expect(selection.length).toBeGreaterThan(0)
	})

	test('clicking a read-only cell does not open an editor', async ({ page }) => {
		const idCell = cell(page, 'clickGrid', 0, 0)
		await idCell.click()
		await expect(editorIn(idCell)).toHaveCount(0)
	})
})

// =============================================================================
// editTrigger = 'dblclick'
// =============================================================================

test.describe("editTrigger='dblclick' — #dblclickGrid", () => {
	test('a single click only focuses the cell — no editor', async ({ page }) => {
		const nameCell = cell(page, 'dblclickGrid', 0, 1)
		await nameCell.click()

		await expect(nameCell).toHaveClass(/wg__cell--focused/)
		await expect(editorIn(nameCell)).toHaveCount(0)
	})

	test('a double-click opens the editor', async ({ page }) => {
		const nameCell = cell(page, 'dblclickGrid', 0, 1)
		await nameCell.dblclick()

		await expect(editorIn(nameCell)).toBeVisible()
	})
})

// =============================================================================
// editTrigger = 'navigate'
// =============================================================================

test.describe("editTrigger='navigate' — #navigateGrid", () => {
	test('a single click only focuses the cell — no editor', async ({ page }) => {
		const nameCell = cell(page, 'navigateGrid', 0, 1)
		await nameCell.click()

		await expect(nameCell).toHaveClass(/wg__cell--focused/)
		await expect(editorIn(nameCell)).toHaveCount(0)
	})

	test('F2 opens the editor on the focused cell', async ({ page }) => {
		const nameCell = cell(page, 'navigateGrid', 0, 1)
		await nameCell.click()
		await page.keyboard.press('F2')

		await expect(editorIn(nameCell)).toBeVisible()
	})

	test('typing a character opens the editor with that character', async ({ page }) => {
		const nameCell = cell(page, 'navigateGrid', 2, 1)  // Carol
		await nameCell.click()
		await page.keyboard.press('Z')

		const editor = editorIn(nameCell)
		await expect(editor).toBeVisible()
		await expect(editor).toHaveValue('Z')
	})

	test('a double-click also opens the editor in navigate mode', async ({ page }) => {
		const nameCell = cell(page, 'navigateGrid', 1, 1)
		await nameCell.dblclick()

		await expect(editorIn(nameCell)).toBeVisible()
	})
})

// =============================================================================
// shouldCommitOnClickAway (Excel-like commit when clicking another cell)
// =============================================================================

test.describe('shouldCommitOnClickAway', () => {
	test('default (true) — clicking another cell commits the in-progress value', async ({ page }) => {
		// dblclickGrid: shouldCommitOnClickAway defaults to true
		const nameCell = cell(page, 'dblclickGrid', 0, 1)  // Alice
		await nameCell.dblclick()
		const editor = editorIn(nameCell)
		await expect(editor).toBeVisible()
		await editor.selectText()
		await editor.fill('Alice CHANGED')

		// Click a different cell — should commit, not discard
		await cell(page, 'dblclickGrid', 1, 1).click()

		await expect(nameCell).toContainText('Alice CHANGED')
		await expect(nameCell).toHaveClass(/wg__cell--dirty/)
	})

	test('false — clicking another cell discards the in-progress value', async ({ page }) => {
		await page.evaluate(() => {
			const g = document.getElementById('dblclickGrid') as unknown as { shouldCommitOnClickAway: boolean }
			g.shouldCommitOnClickAway = false
		})

		const nameCell = cell(page, 'dblclickGrid', 2, 1)  // Carol
		await nameCell.dblclick()
		const editor = editorIn(nameCell)
		await expect(editor).toBeVisible()
		await editor.selectText()
		await editor.fill('SHOULD NOT STICK')

		await cell(page, 'dblclickGrid', 3, 1).click()

		await expect(nameCell).toContainText('Carol')
		await expect(nameCell).not.toHaveClass(/wg__cell--dirty/)
	})
})

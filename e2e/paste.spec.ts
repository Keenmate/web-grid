import { test, expect, Page } from '@playwright/test'

/**
 * E2E coverage for clipboard paste (docs/test/paste.html).
 *
 * The fixture is a 4×5 grid in navigate mode. id (col 0) is non-editable, email
 * (col 2) lowercases pasted text via beforePasteCallback, age (col 3) rejects
 * negatives via validateCallback. Controls toggle pasteMode,
 * shouldValidateOnPaste, and an beforePasteCallback cancel flag.
 *
 * Paste is triggered by dispatching a real paste event on the <web-grid> host.
 * page.keyboard Ctrl+V won't carry clipboardData, and the web-component
 * registers its `paste` listener on the host (web-component.ts:381). Chromium
 * drops `clipboardData` from the ClipboardEvent constructor for synthetic
 * events, so we set it via Object.defineProperty after constructing the event.
 *
 * Pasted values land in the draft row (grid._draftRows), not grid.items, so
 * assertions read the rendered cell text (which falls back to the draft via
 * getCellRawValue) rather than items JSON.
 */

const PAGE = '/test/paste.html'
const GRID = 'web-grid#grid'

const COL = { id: 0, name: 1, email: 2, age: 3, role: 4 } as const

function gridLocator(page: Page) {
	return page.locator(GRID)
}

function cell(page: Page, rowIndex: number, colIndex: number) {
	return gridLocator(page).locator(`.wg__cell[data-row="${rowIndex}"][data-col="${colIndex}"]`)
}

function summary(page: Page) {
	return page.locator('[data-testid="paste-summary"]')
}

function beforePasteInfo(page: Page) {
	return page.locator('[data-testid="beforepaste-info"]')
}

async function gotoPaste(page: Page) {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
}

async function focusCell(page: Page, rowIndex: number, colIndex: number) {
	await cell(page, rowIndex, colIndex).click()
}

/**
 * Dispatch a synthetic paste event with clipboardData. The 500ms tail allows
 * the async commitEdit chain to settle before assertions read.
 */
async function pasteText(page: Page, text: string) {
	await gridLocator(page).evaluate(async (el, txt) => {
		const dt = new DataTransfer()
		dt.setData('text', txt)
		const event = new Event('paste', { bubbles: true, cancelable: true })
		Object.defineProperty(event, 'clipboardData', { value: dt })
		el.dispatchEvent(event)
		await new Promise(r => setTimeout(r, 50))
	}, text)
}

// =============================================================================
// Single-cell paste
// =============================================================================

test.describe('single-cell paste', () => {
	test('plain text commits into the focused cell', async ({ page }) => {
		await gotoPaste(page)
		await focusCell(page, 0, COL.name)

		await pasteText(page, 'Alice Renamed')

		await expect(cell(page, 0, COL.name)).toContainText('Alice Renamed')
	})

	test('beforePasteCallback transforms the value (email lowercased)', async ({ page }) => {
		await gotoPaste(page)
		await focusCell(page, 0, COL.email)

		await pasteText(page, 'NEW@EXAMPLE.COM')

		await expect(cell(page, 0, COL.email)).toContainText('new@example.com')
	})

	test('paste into a non-editable column is ignored', async ({ page }) => {
		await gotoPaste(page)
		await focusCell(page, 0, COL.id)

		await pasteText(page, '999')

		await expect(cell(page, 0, COL.id)).toContainText('1')
	})
})

// =============================================================================
// Multi-cell TSV paste
// =============================================================================

test.describe('multi-cell paste', () => {
	test('2x2 TSV commits four cells starting at the focused cell', async ({ page }) => {
		await gotoPaste(page)
		await focusCell(page, 0, COL.name)

		// Two rows × two columns starting at (0, name) → name + email of rows 0 and 1.
		await pasteText(page, 'Aaron\tneo@x\nBea\tnova@x')

		await expect(cell(page, 0, COL.name)).toContainText('Aaron')
		await expect(cell(page, 1, COL.name)).toContainText('Bea')
		await expect(cell(page, 0, COL.email)).toContainText('neo@x')
		await expect(cell(page, 1, COL.email)).toContainText('nova@x')

		await expect(summary(page))
			.toContainText('total=4 ok=4 fail=0 skip=0 newRows=0 headers=false')
	})

	test('first row matching column titles is treated as a header row', async ({ page }) => {
		await gotoPaste(page)
		await focusCell(page, 0, COL.name)

		// First row matches column titles → headers detected; data routes by header.
		// Order intentionally reversed (Role first, then Name) to prove it's not positional.
		await pasteText(page, 'Role\tName\nLead\tNico\nAnalyst\tPaige')

		await expect(cell(page, 0, COL.name)).toContainText('Nico')
		await expect(cell(page, 0, COL.role)).toContainText('Lead')
		await expect(cell(page, 1, COL.name)).toContainText('Paige')
		await expect(cell(page, 1, COL.role)).toContainText('Analyst')

		await expect(summary(page)).toContainText('headers=true')
	})

	test('first row that does NOT match titles is treated as data', async ({ page }) => {
		await gotoPaste(page)
		await focusCell(page, 0, COL.name)

		// "foo"/"bar" don't match column titles → all 4 cells should be data.
		await pasteText(page, 'foo\tbar\nbaz\tqux')

		await expect(cell(page, 0, COL.name)).toContainText('foo')
		await expect(cell(page, 0, COL.email)).toContainText('bar')
		await expect(cell(page, 1, COL.name)).toContainText('baz')
		await expect(cell(page, 1, COL.email)).toContainText('qux')

		await expect(summary(page)).toContainText('headers=false')
	})

	test('paste that extends beyond items creates new rows', async ({ page }) => {
		await gotoPaste(page)
		await focusCell(page, 3, COL.name) // last row

		// Three data rows starting at row 3 → row 3 overwritten + 2 new rows appended.
		await pasteText(page, 'Row3\tnew3@x\nRow4\tnew4@x\nRow5\tnew5@x')

		await expect(summary(page)).toContainText('newRows=2')
		await expect(gridLocator(page).locator('tbody tr')).toHaveCount(6)
		await expect(cell(page, 4, COL.name)).toContainText('Row4')
		await expect(cell(page, 5, COL.name)).toContainText('Row5')
	})
})

// =============================================================================
// Paste modes
// =============================================================================

test.describe('paste modes', () => {
	test('skip-non-editable (default): id column is skipped, others land', async ({ page }) => {
		await gotoPaste(page)
		await focusCell(page, 0, COL.id) // start at id so the first TSV column targets id

		// Two columns: id + name. id should skip; name should land.
		await pasteText(page, '999\tIgnoredId\n888\tStillName')

		// id is untouched.
		await expect(cell(page, 0, COL.id)).toContainText('1')
		await expect(cell(page, 1, COL.id)).toContainText('2')
		// name landed.
		await expect(cell(page, 0, COL.name)).toContainText('IgnoredId')
		await expect(cell(page, 1, COL.name)).toContainText('StillName')

		// Two id cells skipped → skip=2.
		await expect(summary(page)).toContainText('skip=2')
	})

	test('all-columns: non-editable id cells are overwritten', async ({ page }) => {
		await gotoPaste(page)
		await page.locator('#paste-mode').selectOption('all-columns')
		await focusCell(page, 0, COL.id)

		await pasteText(page, '999\tOverwriteOne\n888\tOverwriteTwo')

		// id IS overwritten in all-columns mode.
		await expect(cell(page, 0, COL.id)).toContainText('999')
		await expect(cell(page, 1, COL.id)).toContainText('888')
		await expect(cell(page, 0, COL.name)).toContainText('OverwriteOne')
		await expect(summary(page)).toContainText('skip=0')
	})
})

// =============================================================================
// Events
// =============================================================================

test.describe('events', () => {
	test('paste-complete fires with an accurate summary', async ({ page }) => {
		await gotoPaste(page)
		await focusCell(page, 0, COL.name)

		await pasteText(page, 'A\tone@x\nB\ttwo@x\nC\tthree@x')

		await expect(summary(page))
			.toContainText('total=6 ok=6 fail=0 skip=0 newRows=0 headers=false')
	})

	test('beforePasteCallback cancel blocks the entire paste', async ({ page }) => {
		await gotoPaste(page)
		await page.locator('#cancel-next').check()
		await focusCell(page, 0, COL.name)

		await pasteText(page, 'Wont\tStick\nNo\tWay')

		// beforePasteCallback still fires (beforepaste-info gets populated). When cancel
		// is set, executePaste returns early and never fires paste-complete — so the
		// summary stays at its initial "none" value.
		await expect(beforePasteInfo(page)).toContainText('rows=2')
		await expect(summary(page)).toHaveText('none')

		// Cells unchanged.
		await expect(cell(page, 0, COL.name)).toContainText('Alice Johnson')
		await expect(cell(page, 1, COL.name)).toContainText('Bob Smith')
	})
})

// =============================================================================
// Web-component proxies (regression — paste-complete / beforePasteCallback / pasteMode /
// shouldValidateOnPaste must route through the GridElement, not just the core)
// =============================================================================

test.describe('web-component paste proxies', () => {
	test('el.pasteMode round-trips through to the core', async ({ page }) => {
		await gotoPaste(page)

		const result = await gridLocator(page).evaluate((el: any) => {
			el.pasteMode = 'all-columns'
			return { hostRead: el.pasteMode, coreRead: el.engine.pasteMode }
		})

		expect(result.hostRead).toBe('all-columns')
		expect(result.coreRead).toBe('all-columns')
	})

	test('el.shouldValidateOnPaste round-trips through to the core', async ({ page }) => {
		await gotoPaste(page)

		const result = await gridLocator(page).evaluate((el: any) => {
			el.shouldValidateOnPaste = false
			return { hostRead: el.shouldValidateOnPaste, coreRead: el.engine.shouldValidateOnPaste }
		})

		expect(result.hostRead).toBe(false)
		expect(result.coreRead).toBe(false)
	})

	test('el.onPasteComplete (the paste-complete twin) receives the PasteDetail', async ({ page }) => {
		await gotoPaste(page)

		await gridLocator(page).evaluate((el: any) => {
			(window as any).__pasteDetails = []
			el.onPasteComplete = (detail: any) => {
				(window as any).__pasteDetails.push({
					totalCells: detail.totalCells,
					successfulCells: detail.successfulCells,
					hadHeaders: detail.hadHeaders,
					isClipboardEvent: detail instanceof Event,
					hasController: typeof detail.controller?.getItems === 'function'
				})
			}
		})

		await focusCell(page, 0, COL.name)
		await pasteText(page, 'X\ty@x\nZ\tz@x')

		const details = await page.evaluate(() => (window as any).__pasteDetails)
		expect(details.length).toBe(1)
		expect(details[0].totalCells).toBe(4)
		expect(details[0].successfulCells).toBe(4)
		expect(details[0].isClipboardEvent).toBe(false)
		expect(details[0].hasController).toBe(true)
	})

	test('el.beforePasteCallback gets the parsed paste; returning false cancels it', async ({ page }) => {
		await gotoPaste(page)

		await gridLocator(page).evaluate((el: any) => {
			(window as any).__beforeDetails = []
			el.beforePasteCallback = (ctx: any) => {
				(window as any).__beforeDetails.push({
					parsedRows: ctx.parsedRows.length,
					hasHeaders: ctx.hasHeaders
				})
				return false
			}
		})

		const before = await cell(page, 0, COL.name).textContent()
		await focusCell(page, 0, COL.name)
		await pasteText(page, 'A\tone@x\nB\ttwo@x')

		const details = await page.evaluate(() => (window as any).__beforeDetails)
		expect(details.length).toBe(1)
		expect(details[0].parsedRows).toBe(2)
		await expect(cell(page, 0, COL.name)).toHaveText(before ?? '')
	})

	test('a pasted value that fails validateCallback fires validation-error (source: paste)', async ({ page }) => {
		await gotoPaste(page)

		await gridLocator(page).evaluate((el: any) => {
			(window as any).__validationErrors = []
			el.onValidationError = (d: any) => {
				(window as any).__validationErrors.push({ field: d.field, error: d.error, source: d.source })
			}
		})

		await focusCell(page, 0, COL.name)
		await pasteText(page, 'X\ty@x\t-5')

		const errors = await page.evaluate(() => (window as any).__validationErrors)
		expect(errors).toHaveLength(1)
		expect(errors[0]).toMatchObject({ field: 'age', source: 'paste' })
	})

	test('el.pasteMode change via the proxy affects paste behavior', async ({ page }) => {
		await gotoPaste(page)

		// Switch through the host proxy directly (no UI control).
		await gridLocator(page).evaluate((el: any) => {
			el.pasteMode = 'all-columns'
		})

		await focusCell(page, 0, COL.id)
		await pasteText(page, '999\tOverwriteOne\n888\tOverwriteTwo')

		// 'all-columns' lets the non-editable id column be overwritten.
		await expect(cell(page, 0, COL.id)).toContainText('999')
		await expect(cell(page, 1, COL.id)).toContainText('888')
	})
})

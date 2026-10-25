import { test, expect, type Page, cell, header, onGrid, waitForRows } from './fixtures'

/**
 * Logging — silent by default; `window.components['web-grid'].logging`
 * (enableLogging / disableLogging / setLogLevel / setCategoryLevel /
 * getCategories) switches it at runtime.
 *
 * Fixture: docs/test/logging.html — sortable, editable 2-row grid.
 */

const PAGE = '/test/logging.html'

/** Console lines carrying a GRID:* category prefix. */
function gridLogs(page: Page): string[] {
	const lines: string[] = []
	page.on('console', m => { if (/\[GRID:[A-Z]+\]/.test(m.text())) lines.push(m.text()) })
	return lines
}

const logging = (page: Page, fn: string, ...args: string[]) =>
	page.evaluate(({ fn, args }) => (window as any).components['web-grid'].logging[fn](...args), { fn, args })

/** Interactions that hit several categories: data (sort), interaction (focus / edit). */
async function interact(page: Page) {
	await header(page, 'name').locator('.wg__sort-indicator').click()
	await cell(page, 0, 1).click()
	await page.keyboard.press('ArrowDown')
	await onGrid(page, el => { el.items = [...el.items, { id: 3, name: 'Gamma' }] })
	await page.waitForTimeout(100)
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await page.evaluate(() => localStorage.clear())  // loglevel persists levels in localStorage
	await page.reload()
	await waitForRows(page)
})

test('silent by default — no GRID:* console output while interacting', async ({ page }) => {
	const lines = gridLogs(page)
	await interact(page)
	expect(lines).toEqual([])
})

test('the registry exposes the logging API and its categories', async ({ page }) => {
	expect(await logging(page, 'getCategories')).toEqual(['GRID:INIT', 'GRID:DATA', 'GRID:UI', 'GRID:INTERACTION', 'GRID:PERF'])
})

test('enableLogging turns output on at runtime; disableLogging silences it again', async ({ page }) => {
	test.fail(true, 'NOTES.md #33')
	const lines = gridLogs(page)
	await logging(page, 'enableLogging')
	await interact(page)
	expect(lines.length).toBeGreaterThan(0)
	expect(lines.some(l => l.includes('[GRID:DATA]'))).toBe(true)

	lines.length = 0
	await logging(page, 'disableLogging')
	await interact(page)
	expect(lines).toEqual([])
})

test('setLogLevel("debug") turns every category on at runtime', async ({ page }) => {
	test.fail(true, 'NOTES.md #33')
	const lines = gridLogs(page)
	await logging(page, 'setLogLevel', 'debug')
	await interact(page)
	expect(lines.length).toBeGreaterThan(0)
})

test('setCategoryLevel enables a single category', async ({ page }) => {
	const lines = gridLogs(page)
	await logging(page, 'setCategoryLevel', 'GRID:DATA', 'debug')
	await interact(page)
	expect(lines.length).toBeGreaterThan(0)
	expect(lines.every(l => l.includes('[GRID:DATA]'))).toBe(true)
})

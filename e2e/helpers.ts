/**
 * Shared e2e helpers (re-exported from ./fixtures). Only helpers used by
 * several specs live here; spec-specific helpers stay local.
 *
 * Grid-id convention: fixture pages with a single grid use `<web-grid id="grid">`,
 * so the grid id is optional everywhere — `cell(page, 0, 1)` targets `#grid`,
 * `cell(page, 'otherGrid', 0, 1)` a named grid.
 */
import { expect, type Locator, type Page } from '@playwright/test'

// =============================================================================
// Locators
// =============================================================================

export function gridLocator(page: Page, id = 'grid'): Locator {
	return page.locator(`web-grid#${id}`)
}

/** Body cell by visual row index + column index (`.wg__cell[data-row][data-col]`). */
export function cell(page: Page, rowIndex: number, colIndex: number): Locator
export function cell(page: Page, gridId: string, rowIndex: number, colIndex: number): Locator
export function cell(page: Page, a: string | number, b: number, c?: number): Locator {
	const [id, row, col] = typeof a === 'string' ? [a, b, c as number] : ['grid', a, b]
	return gridLocator(page, id).locator(`.wg__cell[data-row="${row}"][data-col="${col}"]`)
}

/** Header cell by column field (`thead th.wg__header[data-field]`). */
export function header(page: Page, field: string): Locator
export function header(page: Page, gridId: string, field: string): Locator
export function header(page: Page, a: string, b?: string): Locator {
	const [id, field] = b === undefined ? ['grid', a] : [a, b]
	return gridLocator(page, id).locator(`thead th.wg__header[data-field="${field}"]`)
}

/** Event-log `<pre data-testid="<area>-log">` of a fixture page. */
export function logOf(page: Page, area: string): Locator {
	return page.getByTestId(`${area}-log`)
}

/** Lines of an event log (`type:detail` per line). */
export async function logLines(page: Page, area: string): Promise<string[]> {
	const txt = (await logOf(page, area).textContent()) ?? ''
	return txt.split('\n').filter(Boolean)
}

/** Wait until the grid has rendered at least one body row. */
export async function waitForRows(page: Page, gridId = 'grid'): Promise<void> {
	await expect(gridLocator(page, gridId).locator('tbody tr').first()).toBeVisible()
}

// =============================================================================
// Interactions
// =============================================================================

/**
 * Click a top-level context-menu item by (partial) label. The menu (core
 * `openMenu()`) lives in the grid's shadow root; the locator pierces it, and the
 * click is dispatched via JS — a menu flipped near the viewport edge can trip
 * Playwright's "outside of viewport" check.
 */
export async function clickMenuItem(page: Page, label: string): Promise<void> {
	const item = menuRoot(page).locator('.km-menu__item', { hasText: label }).first()
	await expect(item).toHaveCount(1)
	await item.evaluate((el: HTMLElement) => el.click())
}

/**
 * Hover a toolbar trigger (row/cell) so the floating row toolbar opens. The
 * toolbar listens for mouseenter (non-bubbling) + mousemove, which
 * `page.mouse.move` alone doesn't reliably deliver into shadow DOM.
 */
export async function openToolbarOn(page: Page, locator: Locator): Promise<void> {
	await locator.evaluate((el: Element) => el.scrollIntoView({ block: 'center' }))
	const box = await locator.boundingBox()
	if (!box) throw new Error('Could not get bounding box for toolbar trigger')
	const x = box.x + box.width / 2
	const y = box.y + box.height / 2
	await page.mouse.move(x, y)
	const init = { cancelable: true, clientX: x, clientY: y, screenX: x, screenY: y, buttons: 0 }
	await locator.dispatchEvent('mouseenter', { ...init, bubbles: false })
	await locator.dispatchEvent('mousemove', { ...init, bubbles: true })
}

// =============================================================================
// Color math — runs in the test runner (not in the browser)
// =============================================================================

export interface RGBA {
	r: number
	g: number
	b: number
	a: number
}

export function parseColor(s: string): RGBA {
	// Handles:
	//   rgb(r, g, b)              0-255 channels
	//   rgba(r, g, b, a)          0-255 channels, alpha 0-1
	//   rgb(r g b / a)            modern syntax, 0-255 channels
	//   color(srgb r g b)         modern color() notation, 0-1 channels
	//   color(srgb r g b / a)     modern color() notation with alpha
	//   transparent               special keyword
	if (s === 'transparent' || s === 'rgba(0, 0, 0, 0)') {
		return { r: 0, g: 0, b: 0, a: 0 }
	}
	const colorFnMatch = s.match(/color\(\s*srgb\s+([^)]+)\)/i)
	if (colorFnMatch) {
		const parts = colorFnMatch[1].split(/[\s/]+/).filter(Boolean).map(Number)
		const [r, g, b] = parts
		const a = parts.length >= 4 ? parts[3] : 1
		return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a }
	}
	const rgbMatch = s.match(/rgba?\(([^)]+)\)/i)
	if (rgbMatch) {
		const parts = rgbMatch[1].split(/[\s,/]+/).filter(Boolean).map(Number)
		const [r, g, b] = parts
		const a = parts.length >= 4 ? parts[3] : 1
		return { r, g, b, a }
	}
	throw new Error(`Unparseable color: ${s}`)
}

/** Standard alpha-over composite. bg is assumed opaque (a=1). */
export function composite(fg: RGBA, bg: RGBA): RGBA {
	const a = fg.a
	return {
		r: Math.round(fg.r * a + bg.r * (1 - a)),
		g: Math.round(fg.g * a + bg.g * (1 - a)),
		b: Math.round(fg.b * a + bg.b * (1 - a)),
		a: 1
	}
}

/** sRGB → linear → relative luminance (WCAG 2.1 formula). */
export function relativeLuminance({ r, g, b }: RGBA): number {
	const toLin = (c: number) => {
		const cs = c / 255
		return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
	}
	return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
}

export function contrastRatio(a: RGBA, b: RGBA): number {
	const la = relativeLuminance(a)
	const lb = relativeLuminance(b)
	const lighter = Math.max(la, lb)
	const darker = Math.min(la, lb)
	return (lighter + 0.05) / (darker + 0.05)
}

// =============================================================================
// Event log (fixtures that use docs/test/event-log.js)
// =============================================================================

export type LoggedEvent = { type: string; via: 'event' | 'twin'; grid: string; detail: any }

/** Events recorded by `installEventLog` (JSON-safe copies), optionally filtered by type. */
export async function eventsOf(page: Page, type?: string): Promise<LoggedEvent[]> {
	return page.evaluate((t) => (window as any).__eventsJson(t), type)
}

/** Only the DOM-event copies (`via: 'event'`) of a type, optionally from one grid. */
export async function domEvents(page: Page, type: string, gridId?: string): Promise<any[]> {
	return (await eventsOf(page, type))
		.filter(e => e.via === 'event' && (!gridId || e.grid === gridId))
		.map(e => e.detail)
}

/** Reset the event log of a fixture page. */
export async function clearEvents(page: Page, area: string): Promise<void> {
	await page.evaluate((a) => (window as any).clearEventLog(a), area)
}

/** Run `fn(grid)` in the page against `web-grid#<id>` and return its (serializable) result. */
export async function onGrid<R>(page: Page, fn: (el: any) => R, gridId = 'grid'): Promise<R> {
	return gridLocator(page, gridId).evaluate(fn as any) as Promise<R>
}

/** The inline editor (`input` / `textarea`) inside a cell. */
export function editorIn(target: Locator): Locator {
	return target.locator('input, textarea').first()
}

/**
 * Navigate-mode edit: click the cell, F2, replace the text, commit with `commitKey`
 * (Enter by default). Use only on text / number columns.
 */
export async function editCell(page: Page, target: Locator, value: string, commitKey = 'Enter'): Promise<void> {
	await target.click()
	await page.keyboard.press('F2')
	const ed = editorIn(target)
	await expect(ed).toBeVisible()
	await ed.fill(value)
	await page.keyboard.press(commitKey)
	await expect(ed).toHaveCount(0)
}

/**
 * Drag-select a cell range with mouse primitives — the cell-selection module
 * listens for mousemove / mouseup at document level, so page.mouse works without
 * shadow piercing. Intermediate steps keep the drag continuous.
 */
export async function dragSelect(page: Page, fromRow: number, fromCol: number, toRow: number, toCol: number, gridId = 'grid'): Promise<void> {
	const from = await cell(page, gridId, fromRow, fromCol).boundingBox()
	const to = await cell(page, gridId, toRow, toCol).boundingBox()
	if (!from || !to) throw new Error('Cell bounding box missing')
	const sx = from.x + from.width / 2
	const sy = from.y + from.height / 2
	const dx = to.x + to.width / 2
	const dy = to.y + to.height / 2
	await page.mouse.move(sx, sy)
	await page.mouse.down()
	await page.mouse.move((sx + dx) / 2, (sy + dy) / 2, { steps: 5 })
	await page.mouse.move(dx, dy, { steps: 5 })
	await page.mouse.up()
	// The grid moves focus into its shadow root after a double rAF — wait for it so
	// a following key press (Ctrl+C, Escape, range shortcut) reaches the grid.
	await expect.poll(() => gridLocator(page, gridId).evaluate(el => !!el.shadowRoot?.activeElement)).toBe(true)
}

/** Read the system clipboard (needs `permissions: ['clipboard-read', 'clipboard-write']`). */
export async function readClipboard(page: Page): Promise<string> {
	// Windows clipboards hand back CRLF line breaks — normalise to the grid's LF.
	return (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')
}

/** The top-level context menu (core `openMenu()`, in a grid's shadow root; `.km-menu` also matches submenus). */
export function menuRoot(page: Page): Locator {
	return page.locator('.km-menu:not(.km-menu--submenu)')
}

/**
 * Open a cell / header context menu: move the mouse there, then dispatch a full
 * `contextmenu` event (Playwright's right-click was flaky through shadow DOM).
 */
export async function openContextMenu(page: Page, target: Locator): Promise<void> {
	await target.scrollIntoViewIfNeeded()
	const box = await target.boundingBox()
	if (!box) throw new Error('No bounding box for contextmenu target')
	const x = box.x + box.width / 2
	const y = box.y + box.height / 2
	await page.mouse.move(x, y)
	await target.dispatchEvent('contextmenu', {
		bubbles: true, cancelable: true, button: 2, buttons: 2,
		clientX: x, clientY: y, screenX: x, screenY: y
	})
	await expect(menuRoot(page)).toBeVisible()
}

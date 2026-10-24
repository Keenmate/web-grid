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
 * Click a top-level context-menu item by (partial) label. Dispatched via JS —
 * Floating-UI menus can trip Playwright's "outside of viewport" check.
 */
export async function clickMenuItem(page: Page, label: string): Promise<void> {
	await page.evaluate((text) => {
		const menu = document.querySelector('.wg-context-menu:not(.wg-context-menu--submenu)')
		if (!menu) throw new Error('No context menu')
		const items = Array.from(menu.querySelectorAll('.wg-context-menu__item')) as HTMLElement[]
		const item = items.find(it =>
			it.textContent?.includes(text) && !it.closest('.wg-context-menu--submenu')
		)
		if (!item) throw new Error(`Menu item not found: ${text}`)
		item.click()
	}, label)
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

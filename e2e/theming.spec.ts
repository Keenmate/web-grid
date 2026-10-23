import { test, expect, Page, Locator } from '@playwright/test'

/**
 * E2E coverage for /test/theming.html — one card per dark-mode signal,
 * the same <web-grid> in each card, the spec asserts the rendered cell
 * background colour matches the expected mode (light vs dark).
 *
 * Mirrors the pattern in svelte-treeview/e2e/theming.spec.ts. The Tree
 * variant relied on a "Debug" brand theme with stark red/green surfaces;
 * web-grid's shadow-DOM dark-mode rules set --wg-* with hardcoded literals
 * that bypass --base-*, so brand themes can't fully recolour the grid
 * under per-instance / ancestor signals. Instead of asserting custom
 * colours, this spec asserts the grid renders in LIGHT or DARK mode using
 * a luminance threshold — robust to the specific shade (#1f1f1f from the
 * explicit selectors vs #1a1a1a from the light-dark() branch).
 *
 * Covered signals:
 *   1. baseline (no signal)              → LIGHT
 *   2. per-instance data-theme="dark"    → DARK
 *   3. per-instance data-theme="light"   → LIGHT
 *   4. ancestor [data-theme="dark"]      → DARK
 *   5. ancestor [data-bs-theme="dark"]   → DARK
 *   6. ancestor .dark (Tailwind)         → DARK
 *   7. ancestor [data-theme="light"]     → LIGHT
 *   8. page color-scheme="dark"          → DARK   (set via spec evaluate)
 *   9. OS prefers-color-scheme="dark"    → DARK   (new browser context)
 */

const PAGE = '/test/theming.html'

// ── helpers ─────────────────────────────────────────────────────────────────

function scenarioCard(page: Page, scenario: string): Locator {
	return page.locator(`.scenario-card[data-scenario="${scenario}"]`)
}

function firstCell(card: Locator): Locator {
	// Pick a non-row-number, non-striped (row 0) body cell so the bg we read
	// is the grid's surface colour, not the striped-row tint.
	return card.locator('web-grid').locator('.wg__cell[data-row="0"][data-col="1"]')
}

interface RGBA { r: number; g: number; b: number; a: number }

function parseColor(s: string): RGBA {
	if (s === 'transparent' || s === 'rgba(0, 0, 0, 0)') return { r: 0, g: 0, b: 0, a: 0 }
	// modern color(srgb r g b / a) — emitted by some color-mix() results
	const cm = s.match(/color\(\s*srgb\s+([^)]+)\)/i)
	if (cm) {
		const parts = cm[1].split(/[\s/]+/).filter(Boolean).map(Number)
		const [r, g, b] = parts
		const a = parts.length >= 4 ? parts[3] : 1
		return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a }
	}
	const rm = s.match(/rgba?\(([^)]+)\)/i)
	if (!rm) throw new Error(`Unparseable color: ${s}`)
	const parts = rm[1].split(/[\s,/]+/).filter(Boolean).map(Number)
	const [r, g, b] = parts
	const a = parts.length >= 4 ? parts[3] : 1
	return { r, g, b, a }
}

function composite(fg: RGBA, bg: RGBA): RGBA {
	const a = fg.a
	return {
		r: Math.round(fg.r * a + bg.r * (1 - a)),
		g: Math.round(fg.g * a + bg.g * (1 - a)),
		b: Math.round(fg.b * a + bg.b * (1 - a)),
		a: 1
	}
}

function relativeLuminance({ r, g, b }: RGBA): number {
	const toLin = (c: number) => {
		const cs = c / 255
		return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
	}
	return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
}

/**
 * Walk up the cell's ancestry (crossing the shadow boundary) collecting every
 * background-color, then composite bottom-up. Web-grid cells are transparent —
 * their visible colour comes from the row / tbody / .wg container behind them.
 */
async function cellLuminance(card: Locator): Promise<number> {
	const cell = firstCell(card)
	await cell.waitFor()
	const bgStack = await cell.evaluate(el => {
		const stack: string[] = []
		let node: Node | null = el
		while (node) {
			if (node instanceof HTMLElement) {
				stack.push(getComputedStyle(node).backgroundColor)
				if (node === document.body) break
			}
			if (node instanceof ShadowRoot) { node = node.host; continue }
			node = node.parentNode
		}
		return stack
	})

	// Composite from the bottom (body / outermost) upward to the cell.
	let bg: RGBA = { r: 0, g: 0, b: 0, a: 1 }
	for (const s of bgStack.slice().reverse()) {
		const layer = parseColor(s)
		if (layer.a === 0) continue
		bg = layer.a >= 1 ? layer : composite(layer, bg)
	}
	return relativeLuminance(bg)
}

async function expectLight(card: Locator, label: string): Promise<void> {
	const l = await cellLuminance(card)
	// Light surfaces sit well above 0.5; web-grid's #ffffff = 1.0.
	expect.soft(l, `${label}: expected LIGHT cell bg, luminance=${l.toFixed(3)}`).toBeGreaterThan(0.5)
}

async function expectDark(card: Locator, label: string): Promise<void> {
	const l = await cellLuminance(card)
	// Dark surfaces sit well below 0.5; web-grid's dark shades:
	//   #1f1f1f (explicit dark-mode block) ≈ 0.013
	//   #1a1a1a (light-dark dark branch)   ≈ 0.009
	expect.soft(l, `${label}: expected DARK cell bg, luminance=${l.toFixed(3)}`).toBeLessThan(0.2)
}

// ── tests ───────────────────────────────────────────────────────────────────

test.describe('Theming — dark-mode signals on <web-grid>', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(PAGE)
		// First card's tbody must be visible before any assertion (ensures all
		// custom elements have upgraded).
		await scenarioCard(page, 'baseline-light').locator('tbody tr').first().waitFor()
	})

	test('1. baseline — no signal → cell renders LIGHT', async ({ page }) => {
		await expectLight(scenarioCard(page, 'baseline-light'), 'baseline-light')
	})

	test('2. per-instance data-theme="dark" → cell renders DARK', async ({ page }) => {
		const card = scenarioCard(page, 'per-instance-dark')
		await expect(card.locator('web-grid')).toHaveAttribute('data-theme', 'dark')
		await expectDark(card, 'per-instance-dark')
	})

	test('3. per-instance data-theme="light" → cell renders LIGHT', async ({ page }) => {
		const card = scenarioCard(page, 'per-instance-light')
		await expect(card.locator('web-grid')).toHaveAttribute('data-theme', 'light')
		await expectLight(card, 'per-instance-light')
	})

	test('4. ancestor [data-theme="dark"] + theme-source="closest" → cell renders DARK', async ({ page }) => {
		await expectDark(scenarioCard(page, 'ancestor-data-theme-dark'), 'ancestor-data-theme-dark')
	})

	test('5. ancestor [data-bs-theme="dark"] + theme-source="closest" → cell renders DARK', async ({ page }) => {
		await expectDark(scenarioCard(page, 'ancestor-data-bs-theme-dark'), 'ancestor-data-bs-theme-dark')
	})

	test('6. ancestor .dark (Tailwind) + theme-source="closest" → cell renders DARK', async ({ page }) => {
		await expectDark(scenarioCard(page, 'ancestor-dark-class'), 'ancestor-dark-class')
	})

	test('7. ancestor [data-theme="light"] + theme-source="closest" → cell renders LIGHT', async ({ page }) => {
		await expectLight(scenarioCard(page, 'ancestor-data-theme-light'), 'ancestor-data-theme-light')
	})

	test('8. page color-scheme="dark" on <html> → baseline card renders DARK', async ({ page }) => {
		// Set color-scheme on the document root. light-dark() in web-grid's
		// fallbacks should resolve to the dark branch via inheritance.
		await page.evaluate(() => { document.documentElement.style.colorScheme = 'dark' })
		const card = scenarioCard(page, 'baseline-light')
		// Force a style recalc before reading.
		await firstCell(card).evaluate(el => void el.getBoundingClientRect())
		await expect
			.poll(async () => await cellLuminance(card), { timeout: 5000 })
			.toBeLessThan(0.2)
	})

	test('9. OS prefers-color-scheme="dark" → baseline card renders DARK', async ({ browser }) => {
		// Playwright emulates OS preference via the browser context.
		const context = await browser.newContext({ colorScheme: 'dark' })
		const page = await context.newPage()
		await page.goto(PAGE)
		const card = scenarioCard(page, 'baseline-light')
		await card.locator('tbody tr').first().waitFor()
		await expectDark(card, 'baseline-light under OS dark')
		await context.close()
	})

	test('per-instance overrides ancestor — even when wrapped in [data-theme="dark"], data-theme="light" on the grid forces LIGHT', async ({ page }) => {
		// This is the precedence rule: per-instance beats ancestor. We
		// synthesize the scenario by setting both at runtime.
		await page.evaluate(() => {
			const card = document.querySelector('.scenario-card[data-scenario="baseline-light"]')!
			const wrapper = card.querySelector('.wrapper') as HTMLElement
			const grid = card.querySelector('web-grid') as HTMLElement
			wrapper.setAttribute('data-theme', 'dark')   // ancestor says dark
			grid.setAttribute('data-theme', 'light')     // per-instance says light
		})
		const card = scenarioCard(page, 'baseline-light')
		await expect.poll(() => cellLuminance(card), { timeout: 5000 }).toBeGreaterThan(0.5)
	})
})

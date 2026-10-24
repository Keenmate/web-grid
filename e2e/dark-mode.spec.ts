import { test, expect, Page, Locator, gridLocator, cell, parseColor, relativeLuminance, composite, contrastRatio, type RGBA } from './fixtures'

/**
 * E2E contrast suite for dark-mode rendering (docs/test/dark-mode.html).
 *
 * Three grids stack on a dark page:
 *   #fullyThemed — full --base-* palette override
 *   #minimal     — overrides only --base-text-color-1 + --base-main-bg
 *   #zero        — no overrides; relies entirely on the light-dark() fallbacks
 *                  in variables.css resolving the dark branch off the page's
 *                  body { color-scheme: dark }.
 *
 * For each grid, we sample the rendered text color and the composited
 * background color of representative cells (default, hover, focus, selected,
 * editing) and assert that the WCAG contrast ratio is >= 3:1. The 3:1 threshold
 * is the WCAG AA bar for non-text UI elements; we use it here because grid
 * cells are dense UI rather than blocks of body copy, and we want a low rate of
 * false positives.
 */

const PAGE = '/test/dark-mode.html'
const GRID_IDS = ['fullyThemed', 'minimal', 'zero'] as const
type GridId = (typeof GRID_IDS)[number]

const MIN_CONTRAST = 3.0

// =============================================================================
// Color math — runs in the test runner (not in the browser)
// =============================================================================

// =============================================================================
// DOM helpers
// =============================================================================

/**
 * Read the cell's effective text color and the composited background color
 * (walking up through any transparent ancestors until we hit an opaque surface
 * or the document body). Returned strings are computed-style rgb()/rgba().
 */
async function readCellColors(locator: Locator): Promise<{ color: string; background: string }> {
	return locator.evaluate(el => {
		const target = el as HTMLElement
		const color = getComputedStyle(target).color

		// Walk up until we find a non-transparent background. Body's bg is the
		// final stop. Includes shadow-DOM ancestors via composedPath logic, but
		// since the cell lives inside the shadow root, we walk via parentNode
		// crossing the shadow boundary explicitly.
		let node: Node | null = target
		const stack: HTMLElement[] = []
		while (node) {
			if (node instanceof HTMLElement) {
				stack.push(node)
				if (node === document.body) break
			}
			// Cross shadow boundary: from shadow root, jump to host.
			if (node instanceof ShadowRoot) {
				node = node.host
				continue
			}
			node = node.parentNode
		}

		// Find first opaque background in the stack. Browsers may return either
		// rgba(...) or color(srgb ...) depending on the resolved value origin
		// (color-mix() in particular emits color(srgb ...)).
		for (const ancestor of stack) {
			const bg = getComputedStyle(ancestor).backgroundColor
			const cm = bg.match(/color\(\s*srgb\s+([^)]+)\)/i)
			if (cm) {
				const parts = cm[1].split(/[\s/]+/).filter(Boolean).map(Number)
				const alpha = parts.length >= 4 ? parts[3] : 1
				if (alpha > 0) return { color, background: bg }
				continue
			}
			const rm = bg.match(/rgba?\(([^)]+)\)/i)
			if (!rm) continue
			const parts = rm[1].split(/[\s,/]+/).filter(Boolean).map(Number)
			const alpha = parts.length >= 4 ? parts[3] : 1
			if (alpha > 0) return { color, background: bg }
		}
		return { color, background: 'rgb(0, 0, 0)' }
	})
}

/**
 * Sample all cell ancestors' backgrounds (each with its own alpha) so we can
 * composite the full stack and get the true rendered color. The cell may have
 * its own translucent background (selection tint, dirty tint, etc.) over a
 * row background over a table background, etc.
 */
async function readCompositedColors(locator: Locator): Promise<{ textRGBA: RGBA; bgRGBA: RGBA }> {
	const raw = await locator.evaluate(el => {
		const target = el as HTMLElement
		const color = getComputedStyle(target).color

		const stack: string[] = []
		let node: Node | null = target
		while (node) {
			if (node instanceof HTMLElement) {
				stack.push(getComputedStyle(node).backgroundColor)
				if (node === document.body) break
			}
			if (node instanceof ShadowRoot) {
				node = node.host
				continue
			}
			node = node.parentNode
		}
		return { color, bgStack: stack }
	})

	const textRGBA = parseColor(raw.color)
	// Composite the bg stack from the bottom (body) up to the cell.
	// Start with an opaque assumption for the deepest element (body bg).
	let bgRGBA: RGBA = { r: 0, g: 0, b: 0, a: 1 }
	const stack = raw.bgStack.slice().reverse() // bottom-up
	for (const bgStr of stack) {
		const layer = parseColor(bgStr)
		if (layer.a === 0) continue
		if (layer.a >= 1) {
			bgRGBA = layer
		} else {
			bgRGBA = composite(layer, bgRGBA)
		}
	}
	return { textRGBA, bgRGBA }
}

async function assertCellReadable(locator: Locator, label: string): Promise<void> {
	const { textRGBA, bgRGBA } = await readCompositedColors(locator)
	const ratio = contrastRatio(textRGBA, bgRGBA)
	expect.soft(
		ratio,
		`${label}: text rgb(${textRGBA.r},${textRGBA.g},${textRGBA.b}) on bg rgb(${bgRGBA.r},${bgRGBA.g},${bgRGBA.b}) — ratio ${ratio.toFixed(2)} below ${MIN_CONTRAST}`
	).toBeGreaterThanOrEqual(MIN_CONTRAST)
}

// =============================================================================
// Suite
// =============================================================================

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	for (const id of GRID_IDS) {
		await expect(gridLocator(page, id).locator('tbody tr').first()).toBeVisible()
	}
})

for (const gridId of GRID_IDS) {
	test.describe(`#${gridId}`, () => {
		test('header text is readable against header background', async ({ page }) => {
			const header = gridLocator(page, gridId).locator('thead th').nth(1)
			await assertCellReadable(header, `${gridId} header[1]`)
		})

		test('body cell text is readable against cell/row background', async ({ page }) => {
			await assertCellReadable(cell(page, gridId, 0, 1), `${gridId} cell[0,1]`)
			await assertCellReadable(cell(page, gridId, 2, 2), `${gridId} cell[2,2]`)
			// Striped row (odd index) — verify the alt-row tint doesn't kill contrast.
			await assertCellReadable(cell(page, gridId, 1, 1), `${gridId} cell[1,1] striped`)
		})

		test('hover state stays readable', async ({ page }) => {
			const c = cell(page, gridId, 2, 1)
			// Dispatch real mouse events for hover. locator.hover() works on shadow DOM cells.
			await c.hover()
			// Give the hover state a moment to paint.
			await page.waitForTimeout(50)
			await assertCellReadable(c, `${gridId} cell[2,1] hovered`)
		})

		test('focused cell stays readable', async ({ page }) => {
			const c = cell(page, gridId, 1, 2)
			await c.click()
			await expect(c).toHaveClass(/wg__cell--focused/)
			await assertCellReadable(c, `${gridId} cell[1,2] focused`)
		})

		test('selected row number stays readable', async ({ page }) => {
			// Click the row number cell to select the whole row.
			const rowNumber = gridLocator(page, gridId).locator('tbody tr').nth(3).locator('.wg__row-number')
			await rowNumber.click()
			// Row number when selected uses --wg-selection-row-number-bg / --wg-selection-row-number-color.
			await assertCellReadable(rowNumber, `${gridId} row[3] number selected`)
		})

		test('editing cell stays readable', async ({ page }) => {
			const c = cell(page, gridId, 0, 1)
			await c.dblclick()
			const editor = c.locator('input, textarea').first()
			await expect(editor).toBeVisible()
			// Contrast on the editor input itself (its bg vs its text).
			const raw = await editor.evaluate(el => {
				const s = getComputedStyle(el as HTMLElement)
				return { color: s.color, bg: s.backgroundColor }
			})
			const text = parseColor(raw.color)
			let bg = parseColor(raw.bg)
			if (bg.a < 1) {
				// Fall back to compositing through ancestors.
				const composited = await readCompositedColors(c)
				bg = composited.bgRGBA
			}
			const ratio = contrastRatio(text, bg)
			expect.soft(
				ratio,
				`${gridId} editor[0,1] — text rgb(${text.r},${text.g},${text.b}) on bg rgb(${bg.r},${bg.g},${bg.b}) — ratio ${ratio.toFixed(2)} below ${MIN_CONTRAST}`
			).toBeGreaterThanOrEqual(MIN_CONTRAST)
		})
	})
}

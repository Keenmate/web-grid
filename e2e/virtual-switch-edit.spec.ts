import { test, expect, type Page, gridLocator, cell } from './fixtures'

/**
 * An open cell edit while `items` changes so the grid switches between normal and virtual rendering
 * (automatic virtual scroll, threshold 20 — test/virtual-switch-edit.html). The switch is a full
 * re-render; it follows the same rules as any `items` replace (`_agent-progress/grid-overlay-wp1-dropdown.md`,
 * `grid-overlay-wp2-datepicker.md`): the edited row still there → the edit goes on (the dropdown stays
 * open, the date picker reopens on the re-rendered cell, the typed text is kept); the edited row gone →
 * the edit is cancelled once (`cell-edit-cancel`), focus on the grid. Enter afterwards saves (Excel rule).
 *
 * Columns: 0 id · 1 note (text) · 2 tag (select) · 3 due (date). Each test edits row 3 with F2.
 */

const PAGE = '/test/virtual-switch-edit.html'
const ROW = 3

type Snap = { virtual: boolean; editing: string[]; focus: string; dropdown: number; picker: number; value: string; events: string[] }

async function snap(page: Page, col: number): Promise<Snap> {
	return page.evaluate(([row, col]) => {
		const g = document.getElementById('grid') as HTMLElement
		const root = g.shadowRoot as ShadowRoot
		let a: Element | null = document.activeElement
		while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement
		const td = a?.closest('td.wg__cell') as HTMLElement | null
		const focus = td
			? `${td.dataset.row}:${td.dataset.col}${a === td ? '' : '/editor'}`
			: a?.classList.contains('wg') ? 'grid' : `${a?.tagName.toLowerCase()}`
		const pending = (g as unknown as { engine: { editingCell: { rowIndex: number; field: string } | null } }).engine.editingCell
		const target = root.querySelector(`td.wg__cell[data-row="${row}"][data-col="${col}"]`)
		const input = target?.querySelector('input') as HTMLInputElement | null
		type Logged = { type: string; via: string; grid: string; detail: { rowIndex: number; field: string; newValue?: unknown } }
		return {
			virtual: !!root.querySelector('.wg.wg--virtual-scroll'),
			editing: [...root.querySelectorAll<HTMLElement>('.wg__cell--editing')].map((c) => `${c.dataset.row}:${c.dataset.col}`)
				.concat(pending && !root.querySelector('.wg__cell--editing') ? [`pending:${pending.rowIndex}.${pending.field}`] : []),
			focus,
			dropdown: root.querySelectorAll('.wg__dropdown').length,
			picker: root.querySelectorAll('.wg-datepicker').length,
			value: input ? `input:${input.value}` : (target?.textContent ?? '').replace('▼', '').trim(),
			events: (((window as unknown as { __events?: Logged[] }).__events) ?? [])
				.filter((e) => e.via === 'event')
				.map((e) => e.type === 'row-change'
					? `${e.type}(${e.detail.rowIndex}.${e.detail.field}=${e.detail.newValue})`
					: `${e.type}(${e.detail.rowIndex}.${e.detail.field})`)
		}
	}, [ROW, col] as const)
}

const setRows = (page: Page, n: number) => page.evaluate((n) => (window as unknown as { setRows(n: number): void }).setRows(n), n)

/** Load with `rows` rows, F2 on row 3's `col`, optionally type `text` into its input. */
async function openEdit(page: Page, rows: number, col: number, text?: string): Promise<void> {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr.wg__row').first()).toBeVisible()
	if (rows !== 10) await setRows(page, rows)
	await expect.poll(async () => (await snap(page, col)).virtual).toBe(rows >= 20)
	await cell(page, ROW, col).click()
	await page.keyboard.press('F2')
	await expect(cell(page, ROW, col)).toHaveClass(/wg__cell--editing/)
	if (col === 2) await expect(gridLocator(page).locator('.wg__dropdown')).toHaveCount(1)
	if (col === 3) await expect(gridLocator(page).locator('.wg-datepicker')).toHaveCount(1)
	if (text !== undefined) await cell(page, ROW, col).locator('input').fill(text)
	await page.waitForTimeout(100)
}

const FIELD: Record<number, string> = { 1: 'note', 2: 'tag', 3: 'due' }
const ORIGINAL: Record<number, string> = { 1: 'n3', 2: 'Open', 3: '2026-06-13' }
const TYPED: Record<number, string> = { 1: 'edited', 3: '2026-06-25' }

for (const [from, to] of [[10, 40], [40, 10]] as const) {
	const label = from < to ? 'normal → virtual' : 'virtual → normal'
	test.describe(`open edit across ${label} (${from} → ${to} rows)`, () => {
		for (const col of [1, 2, 3]) {
			const field = FIELD[col]
			test(`${field}: the edit goes on, its overlay with it`, async ({ page }) => {
				await openEdit(page, from, col)
				await setRows(page, to)
				await page.waitForTimeout(300)
				const s = await snap(page, col)
				expect(s.virtual).toBe(to >= 20)
				expect(s.editing).toEqual([`${ROW}:${col}`])
				expect(s.focus).toBe(`${ROW}:${col}/editor`)
				expect(s.dropdown).toBe(col === 2 ? 1 : 0)
				expect(s.picker).toBe(col === 3 ? 1 : 0)
				expect(s.events).toEqual([`cell-edit-start(${ROW}.${field})`])
			})

			if (col === 2) {
				test(`${field}: a pick after the switch saves`, async ({ page }) => {
					await openEdit(page, from, col)
					await setRows(page, to)
					await page.waitForTimeout(300)
					await gridLocator(page).locator('.wg__dropdown-option', { hasText: 'Done' }).click()
					await page.waitForTimeout(200)
					const s = await snap(page, col)
					expect(s.editing).toEqual([])
					expect(s.value).toBe('Done')
					expect(s.focus).toBe(`${ROW}:${col}`)
					expect(s.events).toEqual([`cell-edit-start(${ROW}.tag)`, `row-change(${ROW}.tag=done)`])
				})
				continue
			}

			test(`${field}: typed text survives the switch, Enter saves it`, async ({ page }) => {
				await openEdit(page, from, col, TYPED[col])
				await setRows(page, to)
				await page.waitForTimeout(300)
				const before = await snap(page, col)
				expect(before.editing).toEqual([`${ROW}:${col}`])
				expect(before.value).toBe(`input:${TYPED[col]}`)
				await page.keyboard.press('Enter')
				await page.waitForTimeout(200)
				const s = await snap(page, col)
				expect(s.editing).toEqual([])
				expect(s.value).toBe(TYPED[col])
				expect(s.events).toEqual([`cell-edit-start(${ROW}.${field})`, `row-change(${ROW}.${field}=${TYPED[col]})`])
			})
		}
	})
}

test.describe('open edit, virtual → normal without the edited row (40 → 2 rows)', () => {
	for (const col of [1, 2, 3]) {
		const field = FIELD[col]
		test(`${field}: the edit is cancelled once, its overlay closed, focus on the grid`, async ({ page }) => {
			await openEdit(page, 40, col)
			await setRows(page, 2)
			await page.waitForTimeout(300)
			const s = await snap(page, col)
			expect(s.virtual).toBe(false)
			expect(s.editing).toEqual([])
			expect(s.dropdown).toBe(0)
			expect(s.picker).toBe(0)
			expect(s.focus).toBe('grid')
			expect(s.events).toEqual([`cell-edit-start(${ROW}.${field})`, `cell-edit-cancel(${ROW}.${field})`])
		})
	}
})

test('the original values are untouched by a switch alone', async ({ page }) => {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr.wg__row').first()).toBeVisible()
	await setRows(page, 40)
	for (const col of [1, 2, 3]) expect((await snap(page, col)).value).toBe(ORIGINAL[col])
})

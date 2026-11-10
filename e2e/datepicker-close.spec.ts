import { test, expect, type Page, gridLocator, cell } from './fixtures'

/**
 * Characterization of every way an open date editor (the cell datepicker) closes
 * (docs/test/datepicker-close.html): a scrolling grid and a virtual-scroll grid. Pins the result
 * of each close path — value saved or not (the cell's display text), edit mode, the cell holding
 * focus, the picker gone, and the exact `cell-edit-start` / `cell-edit-cancel` / `row-change`
 * events (names + count). Excel model: leaving a cell any way but Escape SAVES, Escape cancels,
 * focus stays on / returns to the cell; a scroll that moves the cell cancels.
 *
 * Grid columns: 0 id (read-only) · 1 due (date, YYYY-MM-DD, iso out) · 2 note (text,
 * click-to-edit) · 3 tag (select, click-to-edit). Navigate mode; each test opens row 3's date
 * editor with F2 (#vgrid: row 1). Row 3's date is 2026-06-13 (#vgrid row 1: 2026-06-11).
 * `typed:<path>` = replace the editor's text with 2026-06-25 first.
 *
 * Rows marked `D<n>` changed when the picker moved onto core createPopover() (overlay WP2,
 * `_agent-progress/grid-overlay-wp2-datepicker.md`): D1 a typed date saves on leave (was: lost) ·
 * D2 Shift+Tab moves back (was: forward) · D3 outside click saves (was: cancel) · D4 clicking another
 * cell focuses it (was: focus stayed on the edited cell) · D5 a scroll that moves the cell cancels
 * (was: stayed open; vgrid: closed silently, the edit went on) · D6 in the overlay tree: another
 * overlay saves · D7 (unchanged) a re-render closes the picker, the edit goes on · D8 `destroy()`
 * leaves the edit alone (was: cancel + `cell-edit-cancel`).
 */

const PAGE = '/test/datepicker-close.html'
const TYPED = '2026-06-25'

type Expected = { picker: number; editing: string[]; focus: string; value: string; events: string[] }

/** The state after a close path: picker count, editing cells, focused cell (`/editor` = inside its editor), cell text, events. */
async function snap(page: Page, id: string, row: number, col: number): Promise<Expected> {
	return page.evaluate(([id, row, col]) => {
		const g = document.getElementById(id as string) as HTMLElement
		const root = g.shadowRoot as ShadowRoot | null
		let a: Element | null = document.activeElement
		while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement
		const td = a?.closest('td.wg__cell') as HTMLElement | null
		const focus = td
			? `${td.dataset.row}:${td.dataset.col}${a === td ? '' : '/editor'}`
			: a?.classList.contains('wg') ? 'grid' : `${a?.tagName.toLowerCase()}${a?.id ? '#' + a.id : ''}`
		type Logged = { type: string; via: string; grid: string; detail: { rowIndex: number; field: string; newValue?: unknown } }
		const td2 = root?.querySelector(`td.wg__cell[data-row="${row}"][data-col="${col}"]`)
		const input = td2?.querySelector('input') as HTMLInputElement | null
		return {
			picker: document.querySelectorAll('.wg-datepicker').length + (root?.querySelectorAll('.wg-datepicker').length ?? 0),
			editing: [...(root?.querySelectorAll<HTMLElement>('.wg__cell--editing') ?? [])].map((c) => `${c.dataset.row}:${c.dataset.col}`),
			focus,
			value: input ? `input:${input.value}` : (td2?.textContent ?? '').trim(),
			events: (((window as unknown as { __events?: Logged[] }).__events) ?? [])
				.filter((e) => e.via === 'event' && e.grid === id)
				.map((e) => e.type === 'row-change'
					? `${e.type}(${e.detail.rowIndex}.${e.detail.field}=${e.detail.newValue})`
					: `${e.type}(${e.detail.rowIndex}.${e.detail.field})`)
		}
	}, [id, row, col] as const)
}

/** Load the page, focus the cell, F2 → its date editor + picker are open. */
async function openEditor(page: Page, id: string, row: number, col: number): Promise<void> {
	await page.goto(PAGE)
	await expect(gridLocator(page, id).locator('tbody tr.wg__row').first()).toBeVisible()
	await cell(page, id, row, col).click()
	await expect.poll(async () => (await snap(page, id, row, col)).focus).toMatch(new RegExp(`^${row}:${col}(/editor)?$`))
	await page.keyboard.press('F2')
	await expect(gridLocator(page, id).locator('.wg-datepicker')).toHaveCount(1)
	await expect(gridLocator(page, id).locator('.wg-datepicker')).toBeVisible()
	// Let the opening frames pass (scroll-into-view, rAF flags, the deferred outside-press listener)
	await page.waitForTimeout(100)
}

/** The close paths. */
const ACTIONS: Record<string, (page: Page, id: string) => Promise<void>> = {
	/** A day in the picker (2026-06-18; the picker shows June 2026). */
	dayClick: async (page, id) => { await gridLocator(page, id).locator('.wg-datepicker__day[data-date="2026-06-18"]').click() },
	/** ArrowRight (the focused day +1) → Enter. */
	arrowEnter: async (page) => { await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter') },
	enter: async (page) => { await page.keyboard.press('Enter') },
	tab: async (page) => { await page.keyboard.press('Tab') },
	shiftTab: async (page) => { await page.keyboard.press('Shift+Tab') },
	escape: async (page) => { await page.keyboard.press('Escape') },
	outsideClick: async (page) => { await page.locator('#outside').click() },
	/** Another cell, read-only (id column): just moves focus. */
	otherCell: async (page, id) => { await cell(page, id, 5, 0).click() },
	/** Another cell that starts its own edit on click: a text editor (note). */
	otherCellEdits: async (page, id) => { await cell(page, id, 5, 2).click() },
	/** Another cell that starts its own edit on click: a select, its dropdown opens (tag). */
	otherDropdownCellEdits: async (page, id) => { await cell(page, id, 5, 3).click() },
	/** The grid body scrolls (#vgrid: 2000px — the edited row leaves the rendered window). */
	gridScroll: async (page, id) => {
		await page.evaluate((id) => {
			const scroller = document.getElementById(id)!.shadowRoot!.querySelector('.wg') as HTMLElement
			scroller.scrollTop += id === 'vgrid' ? 2000 : 120
		}, id)
	},
	pageScroll: async (page) => { await page.evaluate(() => window.scrollBy(0, 120)) },
	resize: async (page) => { await page.setViewportSize({ width: 1300, height: 900 }) },
	/** Re-render: `el.items` replaced (same data, new objects) while open. */
	itemsReplaced: async (page, id) => {
		await page.evaluate((id) => {
			const g = document.getElementById(id) as unknown as { items: unknown[] }
			g.items = (window as unknown as { __seed(n: number): unknown[] }).__seed(id === 'grid' ? 40 : 1000)
		}, id)
	},
	/** Another overlay opens (core overlay tree, default group) — what `dismissAllOverlays()` / a page popover does. */
	overlayDismiss: async (page) => {
		await page.evaluate(() => document.dispatchEvent(new CustomEvent('km-overlay-activate', { detail: { source: 'page-popover', group: undefined } })))
	},
	/** API: `el.startEditing()` on another cell while open. */
	startEditingApi: async (page, id) => {
		await page.evaluate((id) => { (document.getElementById(id) as unknown as { startEditing(r: number, c: number): void }).startEditing(6, 2) }, id)
	},
	/** API: `el.destroy()` while open. */
	destroy: async (page, id) => {
		await page.evaluate((id) => { (document.getElementById(id) as unknown as { destroy(): void }).destroy() }, id)
	},
}

/**
 * [grid, close path, expected]. `focus: 'OUTSIDE'` = the page button (WebKit doesn't focus a
 * clicked button → <body>).
 */
const CASES: [string, string, Expected][] = [
	['grid', 'arrowEnter', { picker: 0, editing: [], focus: '4:1', value: '2026-06-14', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-14)'] }],
	['grid', 'dayClick', { picker: 0, editing: [], focus: '3:1', value: '2026-06-18', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-18)'] }],
	['grid', 'destroy', { picker: 0, editing: ['3:1'], focus: '3:1/editor', value: 'input:2026-06-13', events: ['cell-edit-start(3.due)'] }], // D8 'api' = nothing: no cancel from a destroyed grid (was: cell-edit-cancel)
	['grid', 'enter', { picker: 0, editing: [], focus: '4:1', value: '2026-06-13', events: ['cell-edit-start(3.due)'] }],
	['grid', 'escape', { picker: 0, editing: [], focus: '3:1', value: '2026-06-13', events: ['cell-edit-start(3.due)', 'cell-edit-cancel(3.due)'] }],
	['grid', 'gridScroll', { picker: 0, editing: [], focus: '3:1', value: '2026-06-13', events: ['cell-edit-start(3.due)', 'cell-edit-cancel(3.due)'] }], // D5 a scroll that moves the cell cancels (was: stayed open)
	['grid', 'itemsReplaced', { picker: 0, editing: ['3:1'], focus: '3:1/editor', value: 'input:2026-06-13', events: ['cell-edit-start(3.due)'] }], // D7 (unchanged) the picker closes, the edit goes on
	['grid', 'otherCell', { picker: 0, editing: [], focus: '5:0', value: '2026-06-13', events: ['cell-edit-start(3.due)'] }], // D4 focus on the clicked cell (was: stayed on the edited one)
	['grid', 'otherCellEdits', { picker: 0, editing: ['5:2'], focus: '5:2/editor', value: '2026-06-13', events: ['cell-edit-start(3.due)', 'cell-edit-start(5.note)'] }],
	['grid', 'otherDropdownCellEdits', { picker: 0, editing: ['5:3'], focus: '5:3/editor', value: '2026-06-13', events: ['cell-edit-start(3.due)', 'cell-edit-start(5.tag)'] }],
	['grid', 'outsideClick', { picker: 0, editing: [], focus: 'OUTSIDE', value: '2026-06-13', events: ['cell-edit-start(3.due)'] }], // D3 saves (was: cancel); unchanged value: no event
	['grid', 'overlayDismiss', { picker: 0, editing: [], focus: '3:1', value: '2026-06-13', events: ['cell-edit-start(3.due)'] }], // D6 in the overlay tree: another overlay saves (unchanged: no event), focus on the cell
	['grid', 'pageScroll', { picker: 0, editing: [], focus: '3:1', value: '2026-06-13', events: ['cell-edit-start(3.due)', 'cell-edit-cancel(3.due)'] }], // D5
	['grid', 'resize', { picker: 1, editing: ['3:1'], focus: '3:1/editor', value: 'input:2026-06-13', events: ['cell-edit-start(3.due)'] }],
	['grid', 'shiftTab', { picker: 0, editing: [], focus: '2:3', value: '2026-06-13', events: ['cell-edit-start(3.due)'] }], // D2 Shift+Tab moves to the previous editable cell (was: forward)
	['grid', 'startEditingApi', { picker: 0, editing: ['6:2'], focus: '6:2/editor', value: '2026-06-13', events: ['cell-edit-start(3.due)', 'cell-edit-start(6.note)'] }],
	['grid', 'tab', { picker: 0, editing: [], focus: '3:2', value: '2026-06-13', events: ['cell-edit-start(3.due)'] }],
	['grid', 'typed:dayClick', { picker: 0, editing: [], focus: '3:1', value: '2026-06-18', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-18)'] }],
	['grid', 'typed:enter', { picker: 0, editing: [], focus: '4:1', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)'] }], // D1 the typed date is the picked day (was: lost)
	['grid', 'typed:escape', { picker: 0, editing: [], focus: '3:1', value: '2026-06-13', events: ['cell-edit-start(3.due)', 'cell-edit-cancel(3.due)'] }],
	['grid', 'typed:gridScroll', { picker: 0, editing: [], focus: '3:1', value: '2026-06-13', events: ['cell-edit-start(3.due)', 'cell-edit-cancel(3.due)'] }], // D5 cancels the typed date too
	['grid', 'typed:otherCell', { picker: 0, editing: [], focus: '5:0', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)'] }], // D1 + D4
	['grid', 'typed:otherCellEdits', { picker: 0, editing: ['5:2'], focus: '5:2/editor', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)', 'cell-edit-start(5.note)'] }], // D1
	['grid', 'typed:outsideClick', { picker: 0, editing: [], focus: 'OUTSIDE', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)'] }], // D1 + D3 the typed date saves
	['grid', 'typed:overlayDismiss', { picker: 0, editing: [], focus: '3:1', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)'] }], // D6 + D1
	['grid', 'typed:shiftTab', { picker: 0, editing: [], focus: '2:3', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)'] }], // D1 + D2
	['grid', 'typed:startEditingApi', { picker: 0, editing: ['6:2'], focus: '6:2/editor', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)', 'cell-edit-start(6.note)'] }], // D1
	['grid', 'typed:tab', { picker: 0, editing: [], focus: '3:2', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)'] }], // D1
	['vgrid', 'dayClick', { picker: 0, editing: [], focus: '1:1', value: '2026-06-18', events: ['cell-edit-start(1.due)', 'row-change(1.due=2026-06-18)'] }],
	['vgrid', 'enter', { picker: 0, editing: [], focus: '2:1', value: '2026-06-11', events: ['cell-edit-start(1.due)'] }],
	['vgrid', 'escape', { picker: 0, editing: [], focus: '1:1', value: '2026-06-11', events: ['cell-edit-start(1.due)', 'cell-edit-cancel(1.due)'] }],
	['vgrid', 'gridScroll', { picker: 0, editing: [], focus: 'grid', value: '', events: ['cell-edit-start(1.due)', 'cell-edit-cancel(1.due)'] }], // D5 the row scrolled out: cancel, focus on the grid (was: the edit went on)
	['vgrid', 'itemsReplaced', { picker: 0, editing: ['1:1'], focus: '1:1/editor', value: 'input:2026-06-11', events: ['cell-edit-start(1.due)'] }], // D7
	['vgrid', 'otherCell', { picker: 0, editing: [], focus: '5:0', value: '2026-06-11', events: ['cell-edit-start(1.due)'] }], // D4
	['vgrid', 'outsideClick', { picker: 0, editing: [], focus: 'OUTSIDE', value: '2026-06-11', events: ['cell-edit-start(1.due)'] }], // D3
	['vgrid', 'overlayDismiss', { picker: 0, editing: [], focus: '1:1', value: '2026-06-11', events: ['cell-edit-start(1.due)'] }], // D6
	['vgrid', 'pageScroll', { picker: 0, editing: [], focus: '1:1', value: '2026-06-11', events: ['cell-edit-start(1.due)', 'cell-edit-cancel(1.due)'] }], // D5
	['vgrid', 'resize', { picker: 1, editing: ['1:1'], focus: '1:1/editor', value: 'input:2026-06-11', events: ['cell-edit-start(1.due)'] }],
	['vgrid', 'tab', { picker: 0, editing: [], focus: '1:2', value: '2026-06-11', events: ['cell-edit-start(1.due)'] }],
]

test.describe('date editor close paths (characterization)', () => {
	for (const [id, path, expected] of CASES) {
		test(`${id}: ${path}`, async ({ page, browserName }) => {
			const row = id === 'vgrid' ? 1 : 3
			const col = 1
			await openEditor(page, id, row, col)
			const action = path.replace(/^typed:/, '')
			if (action !== path) {
				await gridLocator(page, id).locator('.wg__date-input').fill(TYPED)
				await page.waitForTimeout(100)
			}
			await ACTIONS[action](page, id)
			await page.waitForTimeout(300)
			const want = expected.focus === 'OUTSIDE'
				? { ...expected, focus: browserName === 'webkit' ? 'body' : 'button#outside' }
				: expected
			expect(await snap(page, id, row, col)).toEqual(want)
		})
	}
})

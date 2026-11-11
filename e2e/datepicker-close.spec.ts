import { test, expect, type Page, gridLocator, cell } from './fixtures'

/**
 * Characterization of every way an open date editor (the cell datepicker) closes
 * (test/datepicker-close.html): a scrolling grid and a virtual-scroll grid. Pins the result
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
 * overlay saves · D7 a re-render (`items` replaced) reopens the picker on the re-rendered cell with the
 * typed text kept (was: closed, the edit went on without it); the edited row gone → no reopen · D8
 * `destroy()` leaves the edit alone (was: cancel + `cell-edit-cancel`) · D9 an invalid / incomplete typed date
 * (`bad:` / `partial:` paths) is saved on leave like a paste: the text kept, the cell marked invalid,
 * `validation-error` (was: the old date stayed).
 */

const PAGE = '/test/datepicker-close.html'
const TYPED = '2026-06-25'
/** What a `bad:` path types (not a date) and a `partial:` path types (incomplete). */
const BAD = '2026-02-31'
const PARTIAL = '2026-06'

/** `invalid` = the cells marked `wg__cell--invalid` (left out of the snapshot when none). */
type Expected = { picker: number; editing: string[]; focus: string; value: string; events: string[]; invalid?: string[] }

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
		type Logged = { type: string; via: string; grid: string; detail: { rowIndex: number; field: string; newValue?: unknown; error?: string } }
		const pending = (g as unknown as { engine: { editingCell: { rowIndex: number; field: string } | null } }).engine.editingCell
		const invalid = [...(root?.querySelectorAll<HTMLElement>('.wg__cell--invalid') ?? [])].map((c) => `${c.dataset.row}:${c.dataset.col}`)
		const td2 = root?.querySelector(`td.wg__cell[data-row="${row}"][data-col="${col}"]`)
		const input = td2?.querySelector('input') as HTMLInputElement | null
		const state: Expected = {
			picker: document.querySelectorAll('.wg-datepicker').length + (root?.querySelectorAll('.wg-datepicker').length ?? 0),
			editing: [...(root?.querySelectorAll<HTMLElement>('.wg__cell--editing') ?? [])].map((c) => `${c.dataset.row}:${c.dataset.col}`)
				// an edit the engine still holds with no editor rendered for it (a dangling edit)
				.concat(pending && !root?.querySelector('.wg__cell--editing') ? [`pending:${pending.rowIndex}.${pending.field}`] : []),
			focus,
			value: input ? `input:${input.value}` : (td2?.textContent ?? '').trim(),
			events: (((window as unknown as { __events?: Logged[] }).__events) ?? [])
				.filter((e) => e.via === 'event' && e.grid === id)
				.map((e) => e.type === 'row-change'
					? `${e.type}(${e.detail.rowIndex}.${e.detail.field}=${e.detail.newValue})`
					: e.type === 'validation-error'
						? `${e.type}(${e.detail.rowIndex}.${e.detail.field}: ${e.detail.error})`
						: `${e.type}(${e.detail.rowIndex}.${e.detail.field})`)
		}
		if (invalid.length) state.invalid = invalid
		return state
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
	/**
	 * Another cell that starts its own edit on click: a text editor (note). Clicked at its right edge:
	 * the picker (below row 3) covers the cell's centre, and Playwright's actionability retry then
	 * SCROLLED the grid before clicking — a scroll with no move yet, which cancels (the old flake).
	 */
	otherCellEdits: async (page, id) => {
		const box = (await cell(page, id, 5, 2).boundingBox())!
		await cell(page, id, 5, 2).click({ position: { x: box.width - 6, y: box.height / 2 } })
	},
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
	/** Re-render, then Enter: the reopened picker picks the (typed) date. */
	itemsReplacedEnter: async (page, id) => {
		await ACTIONS.itemsReplaced(page, id)
		await page.waitForTimeout(300)
		await page.keyboard.press('Enter')
	},
	/** `el.items` replaced by 2 rows (#vgrid: 1) while open: the edited row (index 3 / 1) no longer exists. */
	itemsShrunk: async (page, id) => {
		await page.evaluate((id) => {
			const g = document.getElementById(id) as unknown as { items: unknown[] }
			g.items = (window as unknown as { __seed(n: number): unknown[] }).__seed(id === 'vgrid' ? 1 : 2)
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
	['grid', 'itemsReplaced', { picker: 1, editing: ['3:1'], focus: '3:1/editor', value: 'input:2026-06-13', events: ['cell-edit-start(3.due)'] }], // D7 the picker reopens on the re-rendered cell, the edit goes on (was: closed)
	['grid', 'itemsShrunk', { picker: 0, editing: [], focus: 'grid', value: '', events: ['cell-edit-start(3.due)', 'cell-edit-cancel(3.due)'] }], // the edited row is gone: the edit is cancelled, focus on the grid (was: a dangling edit in the engine, no cancel event, focus on <body>)
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
	['grid', 'typed:itemsReplaced', { picker: 1, editing: ['3:1'], focus: '3:1/editor', value: 'input:2026-06-25', events: ['cell-edit-start(3.due)'] }], // D7 the reopened picker keeps the typed text (was: closed, the text lost)
	['grid', 'typed:itemsReplacedEnter', { picker: 0, editing: [], focus: '4:1', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)'] }], // D7 + D1 Enter picks the typed date
	['grid', 'typed:outsideClick', { picker: 0, editing: [], focus: 'OUTSIDE', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)'] }], // D1 + D3 the typed date saves
	['grid', 'typed:overlayDismiss', { picker: 0, editing: [], focus: '3:1', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)'] }], // D6 + D1
	['grid', 'typed:shiftTab', { picker: 0, editing: [], focus: '2:3', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)'] }], // D1 + D2
	['grid', 'typed:startEditingApi', { picker: 0, editing: ['6:2'], focus: '6:2/editor', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)', 'cell-edit-start(6.note)'] }], // D1
	['grid', 'typed:tab', { picker: 0, editing: [], focus: '3:2', value: '2026-06-25', events: ['cell-edit-start(3.due)', 'row-change(3.due=2026-06-25)'] }], // D1
	['vgrid', 'dayClick', { picker: 0, editing: [], focus: '1:1', value: '2026-06-18', events: ['cell-edit-start(1.due)', 'row-change(1.due=2026-06-18)'] }],
	['vgrid', 'enter', { picker: 0, editing: [], focus: '2:1', value: '2026-06-11', events: ['cell-edit-start(1.due)'] }],
	['vgrid', 'escape', { picker: 0, editing: [], focus: '1:1', value: '2026-06-11', events: ['cell-edit-start(1.due)', 'cell-edit-cancel(1.due)'] }],
	['vgrid', 'gridScroll', { picker: 0, editing: [], focus: 'grid', value: '', events: ['cell-edit-start(1.due)', 'cell-edit-cancel(1.due)'] }], // D5 the row scrolled out: cancel, focus on the grid (was: the edit went on)
	['vgrid', 'itemsShrunk', { picker: 0, editing: [], focus: 'grid', value: '', events: ['cell-edit-start(1.due)', 'cell-edit-cancel(1.due)'] }], // the edited row is gone: cancelled (was: dangling)
	['grid', 'typed:itemsShrunk', { picker: 0, editing: [], focus: 'grid', value: '', events: ['cell-edit-start(3.due)', 'cell-edit-cancel(3.due)'] }], // the typed date goes with the row (was: dangling)
	['vgrid', 'itemsReplaced', { picker: 1, editing: ['1:1'], focus: '1:1/editor', value: 'input:2026-06-11', events: ['cell-edit-start(1.due)'] }], // D7 reopens (was: closed)
	['vgrid', 'otherCell', { picker: 0, editing: [], focus: '5:0', value: '2026-06-11', events: ['cell-edit-start(1.due)'] }], // D4
	['vgrid', 'outsideClick', { picker: 0, editing: [], focus: 'OUTSIDE', value: '2026-06-11', events: ['cell-edit-start(1.due)'] }], // D3
	['vgrid', 'overlayDismiss', { picker: 0, editing: [], focus: '1:1', value: '2026-06-11', events: ['cell-edit-start(1.due)'] }], // D6
	['vgrid', 'pageScroll', { picker: 0, editing: [], focus: '1:1', value: '2026-06-11', events: ['cell-edit-start(1.due)', 'cell-edit-cancel(1.due)'] }], // D5
	['vgrid', 'resize', { picker: 1, editing: ['1:1'], focus: '1:1/editor', value: 'input:2026-06-11', events: ['cell-edit-start(1.due)'] }],
	['vgrid', 'tab', { picker: 0, editing: [], focus: '1:2', value: '2026-06-11', events: ['cell-edit-start(1.due)'] }],
	// D9: an invalid / incomplete typed date is saved on leave like a paste — the text kept, the cell marked invalid
	// (`validation-error` 'Not a valid date'), the edit ends (was: the old date stayed / Enter / Tab picked it). Escape still cancels.
	['grid', 'bad:enter', { picker: 0, editing: [], focus: '4:1', value: BAD, invalid: ['3:1'], events: ['cell-edit-start(3.due)', 'validation-error(3.due: Not a valid date)', `row-change(3.due=${BAD})`] }],
	['grid', 'bad:tab', { picker: 0, editing: [], focus: '3:2', value: BAD, invalid: ['3:1'], events: ['cell-edit-start(3.due)', 'validation-error(3.due: Not a valid date)', `row-change(3.due=${BAD})`] }],
	['grid', 'bad:shiftTab', { picker: 0, editing: [], focus: '2:3', value: BAD, invalid: ['3:1'], events: ['cell-edit-start(3.due)', 'validation-error(3.due: Not a valid date)', `row-change(3.due=${BAD})`] }],
	['grid', 'bad:outsideClick', { picker: 0, editing: [], focus: 'OUTSIDE', value: BAD, invalid: ['3:1'], events: ['cell-edit-start(3.due)', 'validation-error(3.due: Not a valid date)', `row-change(3.due=${BAD})`] }],
	['grid', 'bad:otherCell', { picker: 0, editing: [], focus: '5:0', value: BAD, invalid: ['3:1'], events: ['cell-edit-start(3.due)', 'validation-error(3.due: Not a valid date)', `row-change(3.due=${BAD})`] }],
	['grid', 'bad:otherCellEdits', { picker: 0, editing: ['5:2'], focus: '5:2/editor', value: BAD, invalid: ['3:1'], events: ['cell-edit-start(3.due)', 'validation-error(3.due: Not a valid date)', `row-change(3.due=${BAD})`, 'cell-edit-start(5.note)'] }],
	['grid', 'bad:overlayDismiss', { picker: 0, editing: [], focus: '3:1', value: BAD, invalid: ['3:1'], events: ['cell-edit-start(3.due)', 'validation-error(3.due: Not a valid date)', `row-change(3.due=${BAD})`] }],
	['grid', 'bad:startEditingApi', { picker: 0, editing: ['6:2'], focus: '6:2/editor', value: BAD, invalid: ['3:1'], events: ['cell-edit-start(3.due)', 'validation-error(3.due: Not a valid date)', `row-change(3.due=${BAD})`, 'cell-edit-start(6.note)'] }],
	['grid', 'bad:itemsReplacedEnter', { picker: 0, editing: [], focus: '4:1', value: BAD, invalid: ['3:1'], events: ['cell-edit-start(3.due)', 'validation-error(3.due: Not a valid date)', `row-change(3.due=${BAD})`] }],
	['grid', 'partial:enter', { picker: 0, editing: [], focus: '4:1', value: PARTIAL, invalid: ['3:1'], events: ['cell-edit-start(3.due)', 'validation-error(3.due: Not a valid date)', `row-change(3.due=${PARTIAL})`] }],
	['grid', 'partial:otherCell', { picker: 0, editing: [], focus: '5:0', value: PARTIAL, invalid: ['3:1'], events: ['cell-edit-start(3.due)', 'validation-error(3.due: Not a valid date)', `row-change(3.due=${PARTIAL})`] }],
	['vgrid', 'bad:tab', { picker: 0, editing: [], focus: '1:2', value: BAD, invalid: ['1:1'], events: ['cell-edit-start(1.due)', 'validation-error(1.due: Not a valid date)', `row-change(1.due=${BAD})`] }],
]

test.describe('date editor close paths (characterization)', () => {
	for (const [id, path, expected] of CASES) {
		test(`${id}: ${path}`, async ({ page, browserName }) => {
			const row = id === 'vgrid' ? 1 : 3
			const col = 1
			await openEditor(page, id, row, col)
			const [, typing, action] = /^(?:(typed|bad|partial):)?(.+)$/.exec(path)!
			if (typing) {
				await gridLocator(page, id).locator('.wg__date-input').fill(typing === 'bad' ? BAD : typing === 'partial' ? PARTIAL : TYPED)
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

/**
 * A scroll caused by moving to another cell doesn't cancel: the move SAVES the edit (Excel rule) and
 * closes the picker before the grid / browser scrolls the target into view; a user scroll with no move
 * still cancels. The clicks hit the visible part of a partly visible cell with `page.mouse` (no
 * Playwright scroll-into-view); `scrolled` proves the move scrolled.
 */
test.describe("date editor: a move's scroll saves, a user scroll cancels", () => {
	/** Open row `row`'s date editor (F2) in #grid after `setup` (grid scrollTop / max-width), type TYPED. */
	async function openTyped(page: Page, row: number, setup: { scrollTop?: number; maxWidth?: string }): Promise<void> {
		await page.goto(PAGE)
		await expect(gridLocator(page, 'grid').locator('tbody tr.wg__row').first()).toBeVisible()
		await page.evaluate(({ scrollTop, maxWidth }) => {
			const g = document.getElementById('grid')!
			if (maxWidth) g.style.maxWidth = maxWidth
			if (scrollTop) (g.shadowRoot!.querySelector('.wg') as HTMLElement).scrollTop = scrollTop
		}, setup)
		await page.waitForTimeout(100)
		await cell(page, 'grid', row, 1).click()
		await page.keyboard.press('F2')
		await expect(gridLocator(page, 'grid').locator('.wg-datepicker')).toBeVisible()
		await page.waitForTimeout(100)
		await gridLocator(page, 'grid').locator('.wg__date-input').fill(TYPED)
		await page.waitForTimeout(100)
	}

	/** The grid body's scroll position. */
	const scrollPos = (page: Page) => page.evaluate(() => {
		const sc = document.getElementById('grid')!.shadowRoot!.querySelector('.wg') as HTMLElement
		return { top: sc.scrollTop, left: sc.scrollLeft }
	})

	/** Click the visible part of a partly visible cell (asserts it IS partly visible). */
	async function clickVisiblePart(page: Page, row: number, col: number): Promise<void> {
		const at = await page.evaluate(([row, col]) => {
			const root = document.getElementById('grid')!.shadowRoot!
			const view = (root.querySelector('.wg') as HTMLElement).getBoundingClientRect()
			const r = root.querySelector(`td[data-row="${row}"][data-col="${col}"]`)!.getBoundingClientRect()
			const top = Math.max(r.top, view.top), bottom = Math.min(r.bottom, view.bottom)
			return { x: (r.left + r.right) / 2, y: (top + bottom) / 2, visible: (bottom - top) / r.height }
		}, [row, col])
		expect(at.visible).toBeGreaterThan(0.2)
		expect(at.visible).toBeLessThan(0.8)
		await page.mouse.click(at.x, at.y)
	}

	test('clicking a partly visible cell that starts its own edit saves, the grid scrolls it in', async ({ page }) => {
		await openTyped(page, 3, { scrollTop: 18 }) // row 7 half visible
		await clickVisiblePart(page, 7, 3) // tag: a select, its dropdown opens
		await page.waitForTimeout(300)
		expect((await scrollPos(page)).top).toBeGreaterThan(18)
		expect(await snap(page, 'grid', 3, 1)).toEqual({ picker: 0, editing: ['7:3'], focus: '7:3/editor', value: TYPED, events: ['cell-edit-start(3.due)', `row-change(3.due=${TYPED})`, 'cell-edit-start(7.tag)'] })
	})

	test('clicking a partly visible read-only cell saves, the grid scrolls it in', async ({ page }) => {
		await openTyped(page, 3, { scrollTop: 18 })
		await clickVisiblePart(page, 7, 0)
		await page.waitForTimeout(300)
		expect((await scrollPos(page)).top).toBeGreaterThan(18)
		expect(await snap(page, 'grid', 3, 1)).toEqual({ picker: 0, editing: [], focus: '7:0', value: TYPED, events: ['cell-edit-start(3.due)', `row-change(3.due=${TYPED})`] })
	})

	test('Tab into a column out of view saves, the grid scrolls it in', async ({ page }) => {
		await openTyped(page, 3, { maxWidth: '280px' }) // the note column is cut off
		await page.keyboard.press('Tab')
		await page.waitForTimeout(300)
		expect((await scrollPos(page)).left).toBeGreaterThan(0)
		expect(await snap(page, 'grid', 3, 1)).toEqual({ picker: 0, editing: [], focus: '3:2', value: TYPED, events: ['cell-edit-start(3.due)', `row-change(3.due=${TYPED})`] })
	})

	test('Enter into a row out of view saves, the grid scrolls it in', async ({ page }) => {
		await openTyped(page, 6, {}) // row 7 is below the fold
		await page.keyboard.press('Enter')
		await page.waitForTimeout(300)
		expect((await scrollPos(page)).top).toBeGreaterThan(0)
		expect(await snap(page, 'grid', 6, 1)).toEqual({ picker: 0, editing: [], focus: '7:1', value: TYPED, events: ['cell-edit-start(6.due)', `row-change(6.due=${TYPED})`] })
	})

	test('a user wheel scroll with no move cancels', async ({ page }) => {
		await openTyped(page, 3, {})
		const box = (await cell(page, 'grid', 2, 3).boundingBox())!
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
		await page.mouse.wheel(0, 150)
		await page.waitForTimeout(300)
		expect((await scrollPos(page)).top).toBeGreaterThan(0)
		expect(await snap(page, 'grid', 3, 1)).toEqual({ picker: 0, editing: [], focus: '3:1', value: '2026-06-13', events: ['cell-edit-start(3.due)', 'cell-edit-cancel(3.due)'] })
	})
})

/**
 * A click on ANOTHER cell's in-cell button (the date trigger, a select toggle) is a move: the open
 * edit (any editor) is SAVED, then the clicked cell starts its edit with its picker / dropdown open
 * (Excel rule; was: `cell-edit-cancel`, the typed text lost).
 */
test.describe('date editor: another cell\'s in-cell button saves the open edit', () => {
	/** Load, start an edit on (row, col) and type `text` into it. */
	async function openTypedEdit(page: Page, row: number, col: number, text: string): Promise<void> {
		await page.goto(PAGE)
		await expect(gridLocator(page, 'grid').locator('tbody tr.wg__row').first()).toBeVisible()
		await cell(page, 'grid', row, col).click()
		if (col === 1) {
			await page.keyboard.press('F2')
			await expect(gridLocator(page, 'grid').locator('.wg-datepicker')).toBeVisible()
			await page.waitForTimeout(100)
			await gridLocator(page, 'grid').locator('.wg__date-input').fill(text)
		} else {
			const input = cell(page, 'grid', row, col).locator('input')
			await expect(input).toBeFocused()
			await input.fill(text)
		}
		await page.waitForTimeout(100)
	}

	/** The open dropdowns (the grid's cell dropdown panel). */
	const dropdowns = (page: Page) => gridLocator(page, 'grid').locator('.wg__dropdown:visible').count()

	test('text edit → another cell\'s date trigger: saves the text, opens the picker there', async ({ page }) => {
		await openTypedEdit(page, 3, 2, 'typed')
		await cell(page, 'grid', 5, 1).locator('.wg__date-trigger').click()
		await page.waitForTimeout(300)
		expect(await snap(page, 'grid', 3, 2)).toEqual({ picker: 1, editing: ['5:1'], focus: '5:1/editor', value: 'typed', events: ['cell-edit-start(3.note)', 'row-change(3.note=typed)', 'cell-edit-start(5.due)'] })
	})

	test('text edit → another cell\'s select toggle: saves the text, opens the dropdown there', async ({ page }) => {
		await openTypedEdit(page, 3, 2, 'typed')
		await cell(page, 'grid', 5, 3).locator('.wg__select-toggle').click()
		await page.waitForTimeout(300)
		expect(await snap(page, 'grid', 3, 2)).toEqual({ picker: 0, editing: ['5:3'], focus: '5:3/editor', value: 'typed', events: ['cell-edit-start(3.note)', 'row-change(3.note=typed)', 'cell-edit-start(5.tag)'] })
		expect(await dropdowns(page)).toBe(1)
	})

	test('typed date → another cell\'s date trigger: saves the date, opens the picker there', async ({ page }) => {
		await openTypedEdit(page, 3, 1, TYPED)
		// row 2: above the picker. Row 6's trigger is under the open picker: no user can click it, and
		// Playwright's actionability retry would scroll the grid first (a scroll with no move: cancel)
		await cell(page, 'grid', 2, 1).locator('.wg__date-trigger').click()
		await page.waitForTimeout(300)
		expect(await snap(page, 'grid', 3, 1)).toEqual({ picker: 1, editing: ['2:1'], focus: '2:1/editor', value: TYPED, events: ['cell-edit-start(3.due)', `row-change(3.due=${TYPED})`, 'cell-edit-start(2.due)'] })
	})

	test('typed date → another cell\'s select toggle: saves the date, opens the dropdown there', async ({ page }) => {
		await openTypedEdit(page, 3, 1, TYPED)
		await cell(page, 'grid', 2, 3).locator('.wg__select-toggle').click() // row 2: above the picker
		await page.waitForTimeout(300)
		expect(await snap(page, 'grid', 3, 1)).toEqual({ picker: 0, editing: ['2:3'], focus: '2:3/editor', value: TYPED, events: ['cell-edit-start(3.due)', `row-change(3.due=${TYPED})`, 'cell-edit-start(2.tag)'] })
		expect(await dropdowns(page)).toBe(1)
	})
})

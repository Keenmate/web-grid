import { test, expect, type Page, gridLocator, cell } from './fixtures'

/**
 * Characterization of every way an open cell dropdown closes (docs/test/dropdown-close.html):
 * select / combobox / autocomplete on a scrolling grid, plus a virtual-scroll grid. Pins the
 * result of each close path — value saved or not (the cell's display text), edit mode, the cell
 * holding focus, the dropdown gone, and the exact `cell-edit-start` / `cell-edit-cancel` /
 * `row-change` events (names + count). Excel model: leaving a cell any way but Escape SAVES the
 * editor's value (a select without a pick changes nothing → `cell-edit-cancel`), Escape cancels,
 * focus stays on / returns to the cell. A scroll that moves the cell still cancels.
 *
 * Grid columns: 0 id (read-only) · 1 status (select) · 2 product (combobox) · 3 assignee
 * (autocomplete) · 4 note (text, click-to-edit) · 5 tag (select, click-to-edit). Navigate mode;
 * each test opens row 3's editor with F2 (#vgrid: row 1, status).
 *
 * Rows marked `Q<n>` changed with the WP1b decisions (`_agent-progress/grid-overlay-wp1-dropdown.md`):
 * Q1 combobox commits the option VALUE · Q2 select without a pick → `cell-edit-cancel` · Q3 outside
 * click saves · Q4 focus returns to the cell (the grid when it scrolled away) · Q5 `startEditing()`
 * saves the open edit first · Q7 the dropdown is in the overlay tree (another overlay → save) · Q8 Tab /
 * Shift+Tab without arrowing saves a combobox / autocomplete (was: cancel).
 * `typed:<path>` = type into the editor first (product 'Tablet' → value 'tablet'; assignee 'Zed', free-form).
 */

const PAGE = '/test/dropdown-close.html'

type Expected = { dropdown: number; editing: string[]; focus: string; value: string; events: string[] }

/** The state after a close path: dropdown count, editing cells, focused cell (`/editor` = inside its editor), cell text, events. */
async function snap(page: Page, id: string, row: number, col: number): Promise<Expected> {
	return page.evaluate(([id, row, col]) => {
		const g = document.getElementById(id as string) as HTMLElement
		const root = g.shadowRoot as ShadowRoot
		let a: Element | null = document.activeElement
		while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement
		const td = a?.closest('td.wg__cell') as HTMLElement | null
		const focus = td
			? `${td.dataset.row}:${td.dataset.col}${a === td ? '' : '/editor'}`
			: a?.classList.contains('wg') ? 'grid' : `${a?.tagName.toLowerCase()}${a?.id ? '#' + a.id : ''}`
		type Logged = { type: string; via: string; grid: string; detail: { rowIndex: number; field: string; newValue?: unknown } }
		const pending = (g as unknown as { engine: { editingCell: { rowIndex: number; field: string } | null } }).engine.editingCell
		return {
			dropdown: root.querySelectorAll('.wg__dropdown').length,
			editing: [...root.querySelectorAll<HTMLElement>('.wg__cell--editing')].map((c) => `${c.dataset.row}:${c.dataset.col}`)
				// an edit the engine still holds with no editor rendered for it (a dangling edit)
				.concat(pending && !root.querySelector('.wg__cell--editing') ? [`pending:${pending.rowIndex}.${pending.field}`] : []),
			focus,
			value: (root.querySelector(`td.wg__cell[data-row="${row}"][data-col="${col}"]`)?.textContent ?? '').replace('▼', '').trim(),
			events: (((window as unknown as { __events?: Logged[] }).__events) ?? [])
				.filter((e) => e.via === 'event' && e.grid === id)
				.map((e) => e.type === 'row-change'
					? `${e.type}(${e.detail.rowIndex}.${e.detail.field}=${e.detail.newValue})`
					: `${e.type}(${e.detail.rowIndex}.${e.detail.field})`)
		}
	}, [id, row, col] as const)
}

const COL: Record<string, number> = { status: 1, product: 2, assignee: 3 }

/** What a `typed:` path types into the editor (all of its text replaced). */
const TYPED: Record<string, string> = { product: 'Tablet', assignee: 'Zed' }

/** Load the page, focus the cell, F2 → its dropdown is open. */
async function openEditor(page: Page, id: string, row: number, col: number): Promise<void> {
	await page.goto(PAGE)
	await expect(gridLocator(page, id).locator('tbody tr.wg__row').first()).toBeVisible()
	await cell(page, id, row, col).click()
	await expect.poll(async () => (await snap(page, id, row, col)).focus).toMatch(new RegExp(`^${row}:${col}(/editor)?$`))
	await page.keyboard.press('F2')
	await expect(gridLocator(page, id).locator('.wg__dropdown')).toHaveCount(1)
	await expect(gridLocator(page, id).locator('.wg__dropdown')).toBeVisible()
	// Let the opening frames pass (scroll-into-view, rAF flags) before the close path runs
	await page.waitForTimeout(100)
}

/** The close paths. */
const ACTIONS: Record<string, (page: Page, id: string) => Promise<void>> = {
	optionClick: async (page, id) => { await gridLocator(page, id).locator('.wg__dropdown-option').nth(2).click({ force: true }) },
	arrowEnter: async (page) => { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') },
	tab: async (page) => { await page.keyboard.press('Tab') },
	shiftTab: async (page) => { await page.keyboard.press('Shift+Tab') },
	escape: async (page) => { await page.keyboard.press('Escape') },
	outsideClick: async (page) => { await page.locator('#outside').click() },
	/** Another cell, read-only (id column): just moves focus. */
	otherCell: async (page, id) => { await cell(page, id, 5, 0).click() },
	/** Another cell that starts its own edit on click: a text editor (note). */
	otherCellEdits: async (page, id) => { await cell(page, id, 5, 4).click() },
	/** Another cell that starts its own edit on click: a select, its dropdown opens (tag). */
	otherDropdownCellEdits: async (page, id) => { await cell(page, id, 5, 5).click() },
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
	/** API: `el.startEditing()` on another cell while open (the grid has no public commit / cancel). */
	startEditingApi: async (page, id) => {
		await page.evaluate((id) => { (document.getElementById(id) as unknown as { startEditing(r: number, c: number): void }).startEditing(6, 1) }, id)
	},
}

/**
 * [grid, field, close path, expected]. `focus: 'OUTSIDE'` = the page button (WebKit doesn't focus
 * a clicked button → <body>). Sorted by grid / field / path; the WP1b typed / overlay rows follow.
 */
const CASES: [string, string, string, Expected][] = [
	['grid', 'assignee', 'arrowEnter', { dropdown: 0, editing: [], focus: '4:3', value: 'Bob', events: ['cell-edit-start(3.assignee)', 'row-change(3.assignee=Bob)'] }],
	['grid', 'assignee', 'escape', { dropdown: 0, editing: [], focus: '3:3', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-cancel(3.assignee)'] }],
	['grid', 'assignee', 'gridScroll', { dropdown: 0, editing: [], focus: '3:3', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-cancel(3.assignee)'] }], // Q4 focus back on the cell
	['grid', 'assignee', 'itemsReplaced', { dropdown: 1, editing: ['3:3'], focus: '3:3/editor', value: '', events: ['cell-edit-start(3.assignee)'] }],
	['grid', 'assignee', 'optionClick', { dropdown: 0, editing: [], focus: '3:3', value: 'Carol', events: ['cell-edit-start(3.assignee)', 'row-change(3.assignee=Carol)'] }], // Q4 focus on the cell
	['grid', 'assignee', 'otherCell', { dropdown: 0, editing: [], focus: '5:0', value: 'Alice', events: ['cell-edit-start(3.assignee)'] }],
	['grid', 'assignee', 'otherCellEdits', { dropdown: 0, editing: ['5:4'], focus: '5:4/editor', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-start(5.note)'] }],
	['grid', 'assignee', 'otherDropdownCellEdits', { dropdown: 1, editing: ['5:5'], focus: '5:5/editor', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-start(5.tag)'] }],
	['grid', 'assignee', 'outsideClick', { dropdown: 0, editing: [], focus: 'OUTSIDE', value: 'Alice', events: ['cell-edit-start(3.assignee)'] }], // Q3 saves (unchanged value: no row-change, no cancel)
	['grid', 'assignee', 'pageScroll', { dropdown: 0, editing: [], focus: '3:3', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-cancel(3.assignee)'] }], // Q4 focus back on the cell
	['grid', 'assignee', 'resize', { dropdown: 1, editing: ['3:3'], focus: '3:3/editor', value: '', events: ['cell-edit-start(3.assignee)'] }],
	['grid', 'assignee', 'shiftTab', { dropdown: 1, editing: ['3:2'], focus: '3:2/editor', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-start(3.product)'] }], // Q8 saves (unchanged: no event)
	['grid', 'assignee', 'startEditingApi', { dropdown: 0, editing: ['6:1'], focus: '6:1/editor', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-start(6.status)'] }], // Q5 saves first, one editing cell
	['grid', 'assignee', 'tab', { dropdown: 0, editing: [], focus: '3:4', value: 'Alice', events: ['cell-edit-start(3.assignee)'] }], // Q8 saves (unchanged: no event)
	['grid', 'product', 'arrowEnter', { dropdown: 0, editing: [], focus: '4:2', value: 'Tablet', events: ['cell-edit-start(3.product)', 'row-change(3.product=tablet)'] }],
	['grid', 'product', 'escape', { dropdown: 0, editing: [], focus: '3:2', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-cancel(3.product)'] }],
	['grid', 'product', 'gridScroll', { dropdown: 0, editing: [], focus: '3:2', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-cancel(3.product)'] }], // Q4 focus back on the cell
	['grid', 'product', 'itemsReplaced', { dropdown: 1, editing: ['3:2'], focus: '3:2/editor', value: '', events: ['cell-edit-start(3.product)'] }],
	['grid', 'product', 'optionClick', { dropdown: 0, editing: [], focus: '3:2', value: 'Tablet', events: ['cell-edit-start(3.product)', 'row-change(3.product=tablet)'] }], // Q4 focus on the cell
	['grid', 'product', 'otherCell', { dropdown: 0, editing: [], focus: '5:0', value: 'Phone', events: ['cell-edit-start(3.product)'] }], // Q1 saves the value 'phone' (unchanged: no row-change)
	['grid', 'product', 'otherCellEdits', { dropdown: 0, editing: ['5:4'], focus: '5:4/editor', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-start(5.note)'] }], // Q1 saves the value 'phone' (unchanged)
	['grid', 'product', 'otherDropdownCellEdits', { dropdown: 1, editing: ['5:5'], focus: '5:5/editor', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-start(5.tag)'] }], // Q1 saves the value 'phone' (unchanged)
	['grid', 'product', 'outsideClick', { dropdown: 0, editing: [], focus: 'OUTSIDE', value: 'Phone', events: ['cell-edit-start(3.product)'] }], // Q3 saves (unchanged value: no row-change, no cancel)
	['grid', 'product', 'pageScroll', { dropdown: 0, editing: [], focus: '3:2', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-cancel(3.product)'] }], // Q4 focus back on the cell
	['grid', 'product', 'resize', { dropdown: 1, editing: ['3:2'], focus: '3:2/editor', value: '', events: ['cell-edit-start(3.product)'] }],
	['grid', 'product', 'shiftTab', { dropdown: 1, editing: ['3:1'], focus: '3:1/editor', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-start(3.status)'] }], // Q8 saves (unchanged: no event)
	['grid', 'product', 'startEditingApi', { dropdown: 0, editing: ['6:1'], focus: '6:1/editor', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-start(6.status)'] }], // Q5 saves first, one editing cell
	['grid', 'product', 'tab', { dropdown: 1, editing: ['3:3'], focus: '3:3/editor', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-start(3.assignee)'] }], // Q8 saves (unchanged: no event)
	['grid', 'status', 'arrowEnter', { dropdown: 0, editing: [], focus: '4:1', value: 'Done', events: ['cell-edit-start(3.status)', 'row-change(3.status=done)'] }],
	['grid', 'status', 'escape', { dropdown: 0, editing: [], focus: '3:1', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)'] }],
	['grid', 'status', 'gridScroll', { dropdown: 0, editing: [], focus: '3:1', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)'] }], // Q4 focus back on the cell
	['grid', 'status', 'itemsReplaced', { dropdown: 1, editing: ['3:1'], focus: '3:1/editor', value: 'Open', events: ['cell-edit-start(3.status)'] }],
	['grid', 'status', 'optionClick', { dropdown: 0, editing: [], focus: '3:1', value: 'On hold', events: ['cell-edit-start(3.status)', 'row-change(3.status=hold)'] }], // Q4 focus on the cell
	['grid', 'status', 'otherCell', { dropdown: 0, editing: [], focus: '5:0', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)'] }], // Q2 no pick: cell-edit-cancel
	['grid', 'status', 'otherCellEdits', { dropdown: 0, editing: ['5:4'], focus: '5:4/editor', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)', 'cell-edit-start(5.note)'] }], // Q2 no pick: cell-edit-cancel
	['grid', 'status', 'otherDropdownCellEdits', { dropdown: 1, editing: ['5:5'], focus: '5:5/editor', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)', 'cell-edit-start(5.tag)'] }], // Q2 no pick: cell-edit-cancel
	['grid', 'status', 'outsideClick', { dropdown: 0, editing: [], focus: 'OUTSIDE', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)'] }],
	['grid', 'status', 'pageScroll', { dropdown: 0, editing: [], focus: '3:1', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)'] }], // Q4 focus back on the cell
	['grid', 'status', 'resize', { dropdown: 1, editing: ['3:1'], focus: '3:1/editor', value: 'Open', events: ['cell-edit-start(3.status)'] }],
	['grid', 'status', 'shiftTab', { dropdown: 0, editing: [], focus: '2:5', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)'] }],
	['grid', 'status', 'startEditingApi', { dropdown: 0, editing: ['6:1'], focus: '6:1/editor', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)', 'cell-edit-start(6.status)'] }], // Q5 + Q2 the open edit ends first (no pick: cancel), one editing cell
	['grid', 'status', 'tab', { dropdown: 1, editing: ['3:2'], focus: '3:2/editor', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)', 'cell-edit-start(3.product)'] }],
	['vgrid', 'status', 'escape', { dropdown: 0, editing: [], focus: '1:1', value: 'Done', events: ['cell-edit-start(1.status)', 'cell-edit-cancel(1.status)'] }],
	['vgrid', 'status', 'gridScroll', { dropdown: 0, editing: [], focus: 'grid', value: '', events: ['cell-edit-start(1.status)', 'cell-edit-cancel(1.status)'] }], // Q4 the row scrolled away: focus on the grid
	['vgrid', 'status', 'itemsReplaced', { dropdown: 1, editing: ['1:1'], focus: '1:1/editor', value: 'Done', events: ['cell-edit-start(1.status)'] }],
	['vgrid', 'status', 'optionClick', { dropdown: 0, editing: [], focus: '1:1', value: 'On hold', events: ['cell-edit-start(1.status)', 'row-change(1.status=hold)'] }], // Q4 focus on the cell
	['vgrid', 'status', 'otherCell', { dropdown: 0, editing: [], focus: '5:0', value: 'Done', events: ['cell-edit-start(1.status)', 'cell-edit-cancel(1.status)'] }], // Q2 no pick: cell-edit-cancel
	['vgrid', 'status', 'pageScroll', { dropdown: 0, editing: [], focus: '1:1', value: 'Done', events: ['cell-edit-start(1.status)', 'cell-edit-cancel(1.status)'] }], // Q4 focus back on the cell
	['vgrid', 'status', 'resize', { dropdown: 1, editing: ['1:1'], focus: '1:1/editor', value: 'Done', events: ['cell-edit-start(1.status)'] }],
	['vgrid', 'status', 'tab', { dropdown: 0, editing: [], focus: '1:2', value: 'Done', events: ['cell-edit-start(1.status)', 'cell-edit-cancel(1.status)'] }],
	['grid', 'assignee', 'typed:outsideClick', { dropdown: 0, editing: [], focus: 'OUTSIDE', value: 'Zed', events: ['cell-edit-start(3.assignee)', 'row-change(3.assignee=Zed)'] }], // Q3 saves the free-form text
	['grid', 'product', 'overlayDismiss', { dropdown: 0, editing: [], focus: '3:2', value: 'Phone', events: ['cell-edit-start(3.product)'] }], // Q7 saves (unchanged), focus on the cell
	['grid', 'product', 'typed:otherCell', { dropdown: 0, editing: [], focus: '5:0', value: 'Tablet', events: ['cell-edit-start(3.product)', 'row-change(3.product=tablet)'] }], // Q1 the typed label saves its VALUE
	['grid', 'product', 'typed:outsideClick', { dropdown: 0, editing: [], focus: 'OUTSIDE', value: 'Tablet', events: ['cell-edit-start(3.product)', 'row-change(3.product=tablet)'] }], // Q3 + Q1
	['grid', 'product', 'typed:overlayDismiss', { dropdown: 0, editing: [], focus: '3:2', value: 'Tablet', events: ['cell-edit-start(3.product)', 'row-change(3.product=tablet)'] }], // Q7 another overlay: save
	['grid', 'product', 'typed:startEditingApi', { dropdown: 0, editing: ['6:1'], focus: '6:1/editor', value: 'Tablet', events: ['cell-edit-start(3.product)', 'row-change(3.product=tablet)', 'cell-edit-start(6.status)'] }], // Q5 saves first
	['grid', 'assignee', 'typed:tab', { dropdown: 0, editing: [], focus: '3:4', value: 'Zed', events: ['cell-edit-start(3.assignee)', 'row-change(3.assignee=Zed)'] }], // Q8 Tab saves the free-form text
	['grid', 'product', 'typed:shiftTab', { dropdown: 1, editing: ['3:1'], focus: '3:1/editor', value: 'Tablet', events: ['cell-edit-start(3.product)', 'row-change(3.product=tablet)', 'cell-edit-start(3.status)'] }], // Q8 Shift+Tab saves the option value
	['grid', 'product', 'typed:tab', { dropdown: 1, editing: ['3:3'], focus: '3:3/editor', value: 'Tablet', events: ['cell-edit-start(3.product)', 'row-change(3.product=tablet)', 'cell-edit-start(3.assignee)'] }], // Q8 Tab saves the option value
	['grid', 'status', 'overlayDismiss', { dropdown: 0, editing: [], focus: '3:1', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)'] }], // Q7 + Q2 no pick: cancel, focus on the cell
	['vgrid', 'status', 'overlayDismiss', { dropdown: 0, editing: [], focus: '1:1', value: 'Done', events: ['cell-edit-start(1.status)', 'cell-edit-cancel(1.status)'] }], // Q7 + Q2
	// The edited row gone (`items` replaced without it): the edit is cancelled once, the dropdown closed, focus on the
	// grid (was: a dangling edit kept by the engine, no `cell-edit-cancel`, focus on <body>)
	['grid', 'status', 'itemsShrunk', { dropdown: 0, editing: [], focus: 'grid', value: '', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)'] }],
	['grid', 'product', 'typed:itemsShrunk', { dropdown: 0, editing: [], focus: 'grid', value: '', events: ['cell-edit-start(3.product)', 'cell-edit-cancel(3.product)'] }],
	['grid', 'assignee', 'itemsShrunk', { dropdown: 0, editing: [], focus: 'grid', value: '', events: ['cell-edit-start(3.assignee)', 'cell-edit-cancel(3.assignee)'] }],
	['vgrid', 'status', 'itemsShrunk', { dropdown: 0, editing: [], focus: 'grid', value: '', events: ['cell-edit-start(1.status)', 'cell-edit-cancel(1.status)'] }],
]

test.describe('dropdown close paths (characterization)', () => {
	for (const [id, field, path, expected] of CASES) {
		test(`${id} ${field}: ${path}`, async ({ page, browserName }) => {
			const row = id === 'vgrid' ? 1 : 3
			const col = id === 'vgrid' ? 1 : COL[field]
			await openEditor(page, id, row, col)
			const action = path.replace(/^typed:/, '')
			if (action !== path) {
				await page.keyboard.press('ControlOrMeta+a')
				await page.keyboard.type(TYPED[field])
				await page.waitForTimeout(150)
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

test.describe('the edited row gone, any editor', () => {
	test('grid note (text editor): items replaced without its row cancels the edit, focus on the grid', async ({ page }) => {
		await page.goto(PAGE)
		await expect(gridLocator(page, 'grid').locator('tbody tr.wg__row').first()).toBeVisible()
		await cell(page, 'grid', 3, 4).click() // note: click-to-edit
		await expect(gridLocator(page, 'grid').locator('.wg__cell--editing')).toHaveCount(1)
		await page.keyboard.type('xyz')
		await ACTIONS.itemsShrunk(page, 'grid')
		await page.waitForTimeout(300)
		expect(await snap(page, 'grid', 3, 4)).toEqual({ dropdown: 0, editing: [], focus: 'grid', value: '', events: ['cell-edit-start(3.note)', 'cell-edit-cancel(3.note)'] })
	})
})

/**
 * A scroll caused by moving to another cell doesn't cancel: the move SAVES the edit (Excel rule) and
 * closes the dropdown before the grid / browser scrolls the target into view; a user scroll with no
 * move still cancels. The clicks hit the visible part of a partly visible cell with `page.mouse` (no
 * Playwright scroll-into-view); the scroll position proves the move scrolled. Combobox `product`
 * with 'Tablet' typed (saves the value 'tablet').
 */
test.describe("dropdown: a move's scroll saves, a user scroll cancels", () => {
	/** Open row `row`'s product combobox (F2) in #grid after `setup` (grid scrollTop / max-width), type 'Tablet'. */
	async function openTyped(page: Page, row: number, setup: { scrollTop?: number; maxWidth?: string }): Promise<void> {
		await page.goto(PAGE)
		await expect(gridLocator(page, 'grid').locator('tbody tr.wg__row').first()).toBeVisible()
		await page.evaluate(({ scrollTop, maxWidth }) => {
			const g = document.getElementById('grid')!
			if (maxWidth) g.style.maxWidth = maxWidth
			if (scrollTop) (g.shadowRoot!.querySelector('.wg') as HTMLElement).scrollTop = scrollTop
		}, setup)
		await page.waitForTimeout(100)
		await cell(page, 'grid', row, COL.product).click()
		await page.keyboard.press('F2')
		await expect(gridLocator(page, 'grid').locator('.wg__dropdown')).toBeVisible()
		await page.waitForTimeout(100)
		await page.keyboard.press('ControlOrMeta+a')
		await page.keyboard.type(TYPED.product)
		await page.waitForTimeout(150)
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
		await clickVisiblePart(page, 7, 5) // tag: a select, its dropdown opens
		await page.waitForTimeout(300)
		expect((await scrollPos(page)).top).toBeGreaterThan(18)
		expect(await snap(page, 'grid', 3, COL.product)).toEqual({ dropdown: 1, editing: ['7:5'], focus: '7:5/editor', value: 'Tablet', events: ['cell-edit-start(3.product)', 'row-change(3.product=tablet)', 'cell-edit-start(7.tag)'] })
	})

	test('clicking a partly visible read-only cell saves, the grid scrolls it in', async ({ page }) => {
		await openTyped(page, 3, { scrollTop: 18 })
		await clickVisiblePart(page, 7, 0)
		await page.waitForTimeout(300)
		expect((await scrollPos(page)).top).toBeGreaterThan(18)
		expect(await snap(page, 'grid', 3, COL.product)).toEqual({ dropdown: 0, editing: [], focus: '7:0', value: 'Tablet', events: ['cell-edit-start(3.product)', 'row-change(3.product=tablet)'] })
	})

	test('Tab into a column out of view saves, the grid scrolls it in (its dropdown stays open)', async ({ page }) => {
		await openTyped(page, 3, { maxWidth: '420px' }) // the assignee column is cut off
		await page.keyboard.press('Tab')
		await page.waitForTimeout(300)
		expect((await scrollPos(page)).left).toBeGreaterThan(0)
		expect(await snap(page, 'grid', 3, COL.product)).toEqual({ dropdown: 1, editing: ['3:3'], focus: '3:3/editor', value: 'Tablet', events: ['cell-edit-start(3.product)', 'row-change(3.product=tablet)', 'cell-edit-start(3.assignee)'] })
	})

	test('Enter into a row out of view saves, the grid scrolls it in', async ({ page }) => {
		await openTyped(page, 6, {}) // row 7 is below the fold
		await page.keyboard.press('Enter')
		await page.waitForTimeout(300)
		expect((await scrollPos(page)).top).toBeGreaterThan(0)
		expect(await snap(page, 'grid', 6, COL.product)).toEqual({ dropdown: 0, editing: [], focus: '7:2', value: 'Tablet', events: ['cell-edit-start(6.product)', 'row-change(6.product=tablet)'] })
	})

	test('a user wheel scroll with no move cancels', async ({ page }) => {
		await openTyped(page, 3, {})
		const box = (await cell(page, 'grid', 2, 4).boundingBox())!
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
		await page.mouse.wheel(0, 150)
		await page.waitForTimeout(300)
		expect((await scrollPos(page)).top).toBeGreaterThan(0)
		expect(await snap(page, 'grid', 3, COL.product)).toEqual({ dropdown: 0, editing: [], focus: '3:2', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-cancel(3.product)'] })
	})
})

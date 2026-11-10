import { test, expect, type Page, gridLocator, cell } from './fixtures'

/**
 * Characterization of every way an open cell dropdown closes (docs/test/dropdown-close.html):
 * select / combobox / autocomplete on a scrolling grid, plus a virtual-scroll grid. Pins TODAY's
 * result of each close path — value saved or not (the cell's display text), edit mode, the cell
 * holding focus, the dropdown gone, and the exact `cell-edit-start` / `cell-edit-cancel` /
 * `row-change` events (names + count) — so moving the dropdown onto core `createPopover()` can't
 * change any of them unnoticed.
 *
 * Grid columns: 0 id (read-only) · 1 status (select) · 2 product (combobox) · 3 assignee
 * (autocomplete) · 4 note (text, click-to-edit) · 5 tag (select, click-to-edit). Navigate mode;
 * each test opens row 3's editor with F2 (#vgrid: row 1, status).
 *
 * Rows marked `Q<n>` look questionable today (see "Questions" in
 * `_agent-progress/grid-overlay-wp1-dropdown.md`) — pinned as they are, not endorsed.
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
			: `${a?.tagName.toLowerCase()}${a?.id ? '#' + a.id : ''}`
		type Logged = { type: string; via: string; grid: string; detail: { rowIndex: number; field: string; newValue?: unknown } }
		return {
			dropdown: root.querySelectorAll('.wg__dropdown').length,
			editing: [...root.querySelectorAll<HTMLElement>('.wg__cell--editing')].map((c) => `${c.dataset.row}:${c.dataset.col}`),
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
	/** API: `el.startEditing()` on another cell while open (the grid has no public commit / cancel). */
	startEditingApi: async (page, id) => {
		await page.evaluate((id) => { (document.getElementById(id) as unknown as { startEditing(r: number, c: number): void }).startEditing(6, 1) }, id)
	},
}

/**
 * [grid, field, close path, expected]. `focus: 'OUTSIDE'` = the page button (WebKit doesn't focus
 * a clicked button → <body>). Sorted by grid / field / path.
 */
const CASES: [string, string, string, Expected][] = [
	['grid', 'assignee', 'arrowEnter', { dropdown: 0, editing: [], focus: '4:3', value: 'Bob', events: ['cell-edit-start(3.assignee)', 'row-change(3.assignee=Bob)'] }],
	['grid', 'assignee', 'escape', { dropdown: 0, editing: [], focus: '3:3', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-cancel(3.assignee)'] }],
	['grid', 'assignee', 'gridScroll', { dropdown: 0, editing: [], focus: 'body', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-cancel(3.assignee)'] }], // Q4 focus lost to <body>
	['grid', 'assignee', 'itemsReplaced', { dropdown: 1, editing: ['3:3'], focus: '3:3/editor', value: '', events: ['cell-edit-start(3.assignee)'] }],
	['grid', 'assignee', 'optionClick', { dropdown: 0, editing: [], focus: 'body', value: 'Carol', events: ['cell-edit-start(3.assignee)', 'row-change(3.assignee=Carol)'] }], // Q4 focus lost to <body>
	['grid', 'assignee', 'otherCell', { dropdown: 0, editing: [], focus: '5:0', value: 'Alice', events: ['cell-edit-start(3.assignee)'] }],
	['grid', 'assignee', 'otherCellEdits', { dropdown: 0, editing: ['5:4'], focus: '5:4/editor', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-start(5.note)'] }],
	['grid', 'assignee', 'otherDropdownCellEdits', { dropdown: 1, editing: ['5:5'], focus: '5:5/editor', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-start(5.tag)'] }],
	['grid', 'assignee', 'outsideClick', { dropdown: 0, editing: [], focus: 'OUTSIDE', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-cancel(3.assignee)'] }], // Q3 cancels; a click on another cell commits
	['grid', 'assignee', 'pageScroll', { dropdown: 0, editing: [], focus: 'body', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-cancel(3.assignee)'] }], // Q4 focus lost to <body>
	['grid', 'assignee', 'resize', { dropdown: 1, editing: ['3:3'], focus: '3:3/editor', value: '', events: ['cell-edit-start(3.assignee)'] }],
	['grid', 'assignee', 'shiftTab', { dropdown: 1, editing: ['3:2'], focus: '3:2/editor', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-cancel(3.assignee)', 'cell-edit-start(3.product)'] }],
	['grid', 'assignee', 'startEditingApi', { dropdown: 1, editing: ['3:3', '6:1'], focus: '3:3/editor', value: '', events: ['cell-edit-start(3.assignee)', 'cell-edit-start(6.status)'] }], // Q5 two cells in edit mode
	['grid', 'assignee', 'tab', { dropdown: 0, editing: [], focus: '3:4', value: 'Alice', events: ['cell-edit-start(3.assignee)', 'cell-edit-cancel(3.assignee)'] }],
	['grid', 'product', 'arrowEnter', { dropdown: 0, editing: [], focus: '4:2', value: 'Tablet', events: ['cell-edit-start(3.product)', 'row-change(3.product=tablet)'] }],
	['grid', 'product', 'escape', { dropdown: 0, editing: [], focus: '3:2', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-cancel(3.product)'] }],
	['grid', 'product', 'gridScroll', { dropdown: 0, editing: [], focus: 'body', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-cancel(3.product)'] }], // Q4 focus lost to <body>
	['grid', 'product', 'itemsReplaced', { dropdown: 1, editing: ['3:2'], focus: '3:2/editor', value: '', events: ['cell-edit-start(3.product)'] }],
	['grid', 'product', 'optionClick', { dropdown: 0, editing: [], focus: 'body', value: 'Tablet', events: ['cell-edit-start(3.product)', 'row-change(3.product=tablet)'] }], // Q4 focus lost to <body>
	['grid', 'product', 'otherCell', { dropdown: 0, editing: [], focus: '5:0', value: 'Phone', events: ['cell-edit-start(3.product)', 'row-change(3.product=Phone)'] }], // Q1 commits the label 'Phone', not the value 'phone'
	['grid', 'product', 'otherCellEdits', { dropdown: 0, editing: ['5:4'], focus: '5:4/editor', value: 'Phone', events: ['cell-edit-start(3.product)', 'row-change(3.product=Phone)', 'cell-edit-start(5.note)'] }], // Q1 commits the label 'Phone', not the value 'phone'
	['grid', 'product', 'otherDropdownCellEdits', { dropdown: 1, editing: ['5:5'], focus: '5:5/editor', value: 'Phone', events: ['cell-edit-start(3.product)', 'row-change(3.product=Phone)', 'cell-edit-start(5.tag)'] }], // Q1 commits the label 'Phone', not the value 'phone'
	['grid', 'product', 'outsideClick', { dropdown: 0, editing: [], focus: 'OUTSIDE', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-cancel(3.product)'] }], // Q3 cancels; a click on another cell commits
	['grid', 'product', 'pageScroll', { dropdown: 0, editing: [], focus: 'body', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-cancel(3.product)'] }], // Q4 focus lost to <body>
	['grid', 'product', 'resize', { dropdown: 1, editing: ['3:2'], focus: '3:2/editor', value: '', events: ['cell-edit-start(3.product)'] }],
	['grid', 'product', 'shiftTab', { dropdown: 1, editing: ['3:1'], focus: '3:1/editor', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-cancel(3.product)', 'cell-edit-start(3.status)'] }],
	['grid', 'product', 'startEditingApi', { dropdown: 1, editing: ['3:2', '6:1'], focus: '3:2/editor', value: '', events: ['cell-edit-start(3.product)', 'cell-edit-start(6.status)'] }], // Q5 two cells in edit mode
	['grid', 'product', 'tab', { dropdown: 1, editing: ['3:3'], focus: '3:3/editor', value: 'Phone', events: ['cell-edit-start(3.product)', 'cell-edit-cancel(3.product)', 'cell-edit-start(3.assignee)'] }],
	['grid', 'status', 'arrowEnter', { dropdown: 0, editing: [], focus: '4:1', value: 'Done', events: ['cell-edit-start(3.status)', 'row-change(3.status=done)'] }],
	['grid', 'status', 'escape', { dropdown: 0, editing: [], focus: '3:1', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)'] }],
	['grid', 'status', 'gridScroll', { dropdown: 0, editing: [], focus: 'body', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)'] }], // Q4 focus lost to <body>
	['grid', 'status', 'itemsReplaced', { dropdown: 1, editing: ['3:1'], focus: '3:1/editor', value: 'Open', events: ['cell-edit-start(3.status)'] }],
	['grid', 'status', 'optionClick', { dropdown: 0, editing: [], focus: 'body', value: 'On hold', events: ['cell-edit-start(3.status)', 'row-change(3.status=hold)'] }], // Q4 focus lost to <body>
	['grid', 'status', 'otherCell', { dropdown: 0, editing: [], focus: '5:0', value: 'Open', events: ['cell-edit-start(3.status)'] }], // Q2 edit ends, no cell-edit-cancel
	['grid', 'status', 'otherCellEdits', { dropdown: 0, editing: ['5:4'], focus: '5:4/editor', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-start(5.note)'] }], // Q2 edit ends, no cell-edit-cancel
	['grid', 'status', 'otherDropdownCellEdits', { dropdown: 1, editing: ['5:5'], focus: '5:5/editor', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-start(5.tag)'] }], // Q2 edit ends, no cell-edit-cancel
	['grid', 'status', 'outsideClick', { dropdown: 0, editing: [], focus: 'OUTSIDE', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)'] }],
	['grid', 'status', 'pageScroll', { dropdown: 0, editing: [], focus: 'body', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)'] }], // Q4 focus lost to <body>
	['grid', 'status', 'resize', { dropdown: 1, editing: ['3:1'], focus: '3:1/editor', value: 'Open', events: ['cell-edit-start(3.status)'] }],
	['grid', 'status', 'shiftTab', { dropdown: 0, editing: [], focus: '2:5', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)'] }],
	['grid', 'status', 'startEditingApi', { dropdown: 1, editing: ['3:1', '6:1'], focus: '3:1/editor', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-start(6.status)'] }], // Q5 two cells in edit mode
	['grid', 'status', 'tab', { dropdown: 1, editing: ['3:2'], focus: '3:2/editor', value: 'Open', events: ['cell-edit-start(3.status)', 'cell-edit-cancel(3.status)', 'cell-edit-start(3.product)'] }],
	['vgrid', 'status', 'escape', { dropdown: 0, editing: [], focus: '1:1', value: 'Done', events: ['cell-edit-start(1.status)', 'cell-edit-cancel(1.status)'] }],
	['vgrid', 'status', 'gridScroll', { dropdown: 0, editing: [], focus: 'body', value: '', events: ['cell-edit-start(1.status)', 'cell-edit-cancel(1.status)'] }], // Q4 focus lost to <body>
	['vgrid', 'status', 'itemsReplaced', { dropdown: 1, editing: ['1:1'], focus: '1:1/editor', value: 'Done', events: ['cell-edit-start(1.status)'] }],
	['vgrid', 'status', 'optionClick', { dropdown: 0, editing: [], focus: 'body', value: 'On hold', events: ['cell-edit-start(1.status)', 'row-change(1.status=hold)'] }], // Q4 focus lost to <body>
	['vgrid', 'status', 'otherCell', { dropdown: 0, editing: [], focus: '5:0', value: 'Done', events: ['cell-edit-start(1.status)'] }], // Q2 edit ends, no cell-edit-cancel
	['vgrid', 'status', 'pageScroll', { dropdown: 0, editing: [], focus: 'body', value: 'Done', events: ['cell-edit-start(1.status)', 'cell-edit-cancel(1.status)'] }], // Q4 focus lost to <body>
	['vgrid', 'status', 'resize', { dropdown: 1, editing: ['1:1'], focus: '1:1/editor', value: 'Done', events: ['cell-edit-start(1.status)'] }],
	['vgrid', 'status', 'tab', { dropdown: 0, editing: [], focus: '1:2', value: 'Done', events: ['cell-edit-start(1.status)', 'cell-edit-cancel(1.status)'] }],
]

test.describe('dropdown close paths (characterization)', () => {
	for (const [id, field, path, expected] of CASES) {
		test(`${id} ${field}: ${path}`, async ({ page, browserName }) => {
			const row = id === 'vgrid' ? 1 : 3
			const col = id === 'vgrid' ? 1 : COL[field]
			await openEditor(page, id, row, col)
			await ACTIONS[path](page, id)
			await page.waitForTimeout(300)
			const want = expected.focus === 'OUTSIDE'
				? { ...expected, focus: browserName === 'webkit' ? 'body' : 'button#outside' }
				: expected
			expect(await snap(page, id, row, col)).toEqual(want)
		})
	}
})

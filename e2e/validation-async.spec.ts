import { test, expect, type Page, gridLocator, cell } from './fixtures'

/**
 * Moving between cells while an async `validateCallback` is pending (test/validation-async.html).
 * Excel rule: each move SAVES the edit exactly once (one `row-change`, no `cell-edit-cancel`), the edit
 * ends at the move (the next cell is never caught by the old commit), the cell shows the typed value at
 * once, and the validation result marks the cell when it arrives (invalid → `wg__cell--invalid` +
 * `validation-error`; a transform → the transformed value). Results apply in commit order, so a fast
 * sequence of moves (Tab, Tab, Tab) with slower earlier validations keeps the last write.
 *
 * Grid: 0 id (read-only) · 1 a · 2 b · 3 c (text, ASYNC validate: `__delays[value]` ms, default 150) ·
 * 4 s (text, SYNC validate). 'bad…' → 'Not allowed'; 'up:x' → 'X'. Navigate mode.
 */

const PAGE = '/test/validation-async.html'

type State = { editing: string[]; focus: string; values: string[]; invalid: string[]; events: string[] }

/** Editing cells (+ a dangling engine edit), focused cell, row `row`'s cell texts (cols 1-4), invalid cells, events. */
async function snap(page: Page, row: number): Promise<State> {
	return page.evaluate((row) => {
		const g = document.getElementById('grid') as HTMLElement
		const root = g.shadowRoot as ShadowRoot
		let a: Element | null = document.activeElement
		while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement
		const td = a?.closest('td.wg__cell') as HTMLElement | null
		const focus = td
			? `${td.dataset.row}:${td.dataset.col}${a === td ? '' : '/editor'}`
			: a?.classList.contains('wg') ? 'grid' : `${a?.tagName.toLowerCase()}${a?.id ? '#' + a.id : ''}`
		const pending = (g as unknown as { engine: { editingCell: { rowIndex: number; field: string } | null } }).engine.editingCell
		const editingTds = [...root.querySelectorAll<HTMLElement>('.wg__cell--editing')].map((c) => `${c.dataset.row}:${c.dataset.col}`)
		const editingTd = root.querySelector<HTMLElement>('.wg__cell--editing')
		const editing = editingTds.concat(
			// the engine's edit when it isn't the rendered editor (a dangling / mismatched edit)
			pending && !(editingTd && editingTd.dataset.row === String(pending.rowIndex) && editingTd.dataset.field === pending.field)
				? [`pending:${pending.rowIndex}.${pending.field}`] : [])
		const values = [1, 2, 3, 4].map((col) => {
			const c = root.querySelector(`td.wg__cell[data-row="${row}"][data-col="${col}"]`)
			const input = c?.querySelector('input') as HTMLInputElement | null
			return input ? `input:${input.value}` : (c?.textContent ?? '').trim()
		})
		const invalid = [...root.querySelectorAll<HTMLElement>('.wg__cell--invalid')].map((c) => `${c.dataset.row}:${c.dataset.col}`)
		type Logged = { type: string; via: string; detail: { rowIndex: number; field: string; newValue?: unknown; isValid?: boolean; error?: string } }
		const events = (((window as unknown as { __events?: Logged[] }).__events) ?? [])
			.filter((e) => e.via === 'event')
			.map((e) => e.type === 'row-change'
				? `${e.type}(${e.detail.rowIndex}.${e.detail.field}=${e.detail.newValue}${e.detail.isValid ? '' : ' INVALID'})`
				: e.type === 'validation-error'
					? `${e.type}(${e.detail.rowIndex}.${e.detail.field}: ${e.detail.error})`
					: `${e.type}(${e.detail.rowIndex}.${e.detail.field})`)
		return { editing, focus, values, invalid, events }
	}, row)
}

/** Load the page; optional per-value validation delays. */
async function load(page: Page, delays: Record<string, number> = {}): Promise<void> {
	await page.goto(PAGE)
	await expect(gridLocator(page, 'grid').locator('tbody tr.wg__row').first()).toBeVisible()
	await page.evaluate((delays) => { (window as unknown as { __delays: Record<string, number> }).__delays = delays }, delays)
}

/** F2 on the focused cell (row, col) → its text editor, replace the text with `text`. */
async function editFocused(page: Page, row: number, col: number, text: string): Promise<void> {
	await page.keyboard.press('F2')
	const input = cell(page, 'grid', row, col).locator('input')
	await expect(input).toBeFocused()
	await input.fill(text)
}

/** Focus (row, col) by click, then edit it. */
async function edit(page: Page, row: number, col: number, text: string): Promise<void> {
	await cell(page, 'grid', row, col).click()
	await editFocused(page, row, col, text)
}

/** Wait until every validation settled (the longest delay used is 400 ms). */
const settle = (page: Page) => page.waitForTimeout(600)

test.describe('async validateCallback: moving between cells', () => {
	test('Tab saves once, the cell shows the typed value at once', async ({ page }) => {
		await load(page, { x: 400 })
		await edit(page, 1, 1, 'x')
		await page.keyboard.press('Tab')
		await page.waitForTimeout(100) // validation still pending
		const early = await snap(page, 1)
		expect({ editing: early.editing, focus: early.focus, a: early.values[0] }).toEqual({ editing: [], focus: '1:2', a: 'x' })
		await settle(page)
		expect(await snap(page, 1)).toEqual({ editing: [], focus: '1:2', values: ['x', 'b1', 'c1', 's1'], invalid: [], events: ['cell-edit-start(1.a)', 'row-change(1.a=x)'] })
	})

	test('Enter saves once, the cell shows the typed value at once', async ({ page }) => {
		await load(page, { x: 400 })
		await edit(page, 1, 1, 'x')
		await page.keyboard.press('Enter')
		await page.waitForTimeout(100) // validation still pending
		const early = await snap(page, 1)
		expect({ editing: early.editing, focus: early.focus, a: early.values[0] }).toEqual({ editing: [], focus: '2:1', a: 'x' })
		await settle(page)
		expect(await snap(page, 1)).toEqual({ editing: [], focus: '2:1', values: ['x', 'b1', 'c1', 's1'], invalid: [], events: ['cell-edit-start(1.a)', 'row-change(1.a=x)'] })
	})

	test('a click on another cell saves once, the edit ends at the click', async ({ page }) => {
		await load(page, { x: 400 })
		await edit(page, 1, 1, 'x')
		await cell(page, 'grid', 3, 0).click()
		await page.waitForTimeout(100) // validation still pending
		const early = await snap(page, 1)
		expect({ editing: early.editing, focus: early.focus, a: early.values[0] }).toEqual({ editing: [], focus: '3:0', a: 'x' })
		await settle(page)
		expect(await snap(page, 1)).toEqual({ editing: [], focus: '3:0', values: ['x', 'b1', 'c1', 's1'], invalid: [], events: ['cell-edit-start(1.a)', 'row-change(1.a=x)'] })
	})

	test('a click outside saves once', async ({ page }) => {
		await load(page)
		await edit(page, 1, 1, 'x')
		await page.locator('#outside').click()
		await settle(page)
		const s = await snap(page, 1)
		expect({ ...s, focus: undefined }).toEqual({ editing: [], focus: undefined, values: ['x', 'b1', 'c1', 's1'], invalid: [], events: ['cell-edit-start(1.a)', 'row-change(1.a=x)'] })
	})

	test('Tab then F2 on the next cell: the pending commit never ends the new edit', async ({ page }) => {
		await load(page, { x: 300 })
		await edit(page, 1, 1, 'x')
		await page.keyboard.press('Tab')
		await editFocused(page, 1, 2, 'y') // the new edit opens while 'x' is still validating
		await settle(page)
		expect(await snap(page, 1)).toEqual({ editing: ['1:2'], focus: '1:2/editor', values: ['x', 'input:y', 'c1', 's1'], invalid: [], events: ['cell-edit-start(1.a)', 'cell-edit-start(1.b)', 'row-change(1.a=x)'] })
	})

	test('an invalid async result marks the cell when it arrives', async ({ page }) => {
		await load(page)
		await edit(page, 1, 1, 'bad')
		await page.keyboard.press('Tab')
		await settle(page)
		expect(await snap(page, 1)).toEqual({ editing: [], focus: '1:2', values: ['bad', 'b1', 'c1', 's1'], invalid: ['1:1'], events: ['cell-edit-start(1.a)', 'validation-error(1.a: Not allowed)', 'row-change(1.a=bad INVALID)'] })
	})

	test('an async transform replaces the shown value when it arrives', async ({ page }) => {
		await load(page)
		await edit(page, 1, 1, 'up:q')
		await page.keyboard.press('Tab')
		await settle(page)
		expect(await snap(page, 1)).toEqual({ editing: [], focus: '1:2', values: ['Q', 'b1', 'c1', 's1'], invalid: [], events: ['cell-edit-start(1.a)', 'row-change(1.a=Q)'] })
	})

	test('Tab, Tab, Tab with pending validations (slower first): each saves once, in order', async ({ page }) => {
		await load(page, { p: 400, q: 200, r: 0 })
		await cell(page, 'grid', 1, 1).click()
		for (const [col, text] of [[1, 'p'], [2, 'q'], [3, 'r']] as const) {
			await editFocused(page, 1, col, text)
			await page.keyboard.press('Tab')
		}
		await settle(page)
		const s = await snap(page, 1)
		expect({ ...s, events: s.events.filter((e) => !e.startsWith('cell-edit-start')) }).toEqual({
			editing: [], focus: '1:4', values: ['p', 'q', 'r', 's1'], invalid: [],
			events: ['row-change(1.a=p)', 'row-change(1.b=q)', 'row-change(1.c=r)']
		})
		expect(s.events.filter((e) => e.startsWith('cell-edit-start'))).toEqual(['cell-edit-start(1.a)', 'cell-edit-start(1.b)', 'cell-edit-start(1.c)'])
	})

	test('the same cell re-edited while its first validation is pending: the last write wins', async ({ page }) => {
		await load(page, { p: 400, q: 0 })
		await edit(page, 1, 1, 'p')
		await page.keyboard.press('Tab')
		await page.keyboard.press('Shift+Tab')
		await editFocused(page, 1, 1, 'q')
		await page.keyboard.press('Tab')
		await settle(page)
		expect(await snap(page, 1)).toEqual({ editing: [], focus: '1:2', values: ['q', 'b1', 'c1', 's1'], invalid: [], events: ['cell-edit-start(1.a)', 'cell-edit-start(1.a)', 'row-change(1.a=p)', 'row-change(1.a=q)'] })
	})

	test('async then sync validateCallback: each saves once, in commit order', async ({ page }) => {
		// c (async) is still pending when s (sync) commits: s's result waits for c's (commit order)
		await load(page)
		await cell(page, 'grid', 1, 3).click()
		await editFocused(page, 1, 3, 'r')
		await page.keyboard.press('Tab')
		await editFocused(page, 1, 4, 'bad')
		await page.keyboard.press('Tab')
		await settle(page)
		expect(await snap(page, 1)).toEqual({ editing: [], focus: '2:1', values: ['a1', 'b1', 'r', 'bad'], invalid: ['1:4'], events: ['cell-edit-start(1.c)', 'cell-edit-start(1.s)', 'row-change(1.c=r)', 'validation-error(1.s: Not allowed)', 'row-change(1.s=bad INVALID)'] })
	})

	test('a sync validateCallback alone: applied at once, Tab saves once', async ({ page }) => {
		await load(page)
		await edit(page, 1, 4, 'bad')
		await page.keyboard.press('Tab')
		expect(await snap(page, 1)).toEqual({ editing: [], focus: '2:1', values: ['a1', 'b1', 'c1', 'bad'], invalid: ['1:4'], events: ['cell-edit-start(1.s)', 'validation-error(1.s: Not allowed)', 'row-change(1.s=bad INVALID)'] })
	})
})

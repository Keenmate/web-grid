import { test, expect, devices, type Page, gridLocator, cell } from './fixtures'

/**
 * Phone presentation of the cell popups (test/phone-sheet.html; rulebook C-RO-*, D-RO-*): on a phone
 * (core resolvePresentation(): touch-primary + a short viewport side) the cell dropdown and the date
 * editor are an edge-to-edge sheet — the same core popover, un-anchored — with the column title, a
 * search field (combobox / autocomplete) and a close button. Edit semantics are the grid's (Excel
 * rule): the close button and the phone Back gesture leave the cell → SAVE (a select without a pick
 * changes nothing); Escape cancels; a pick saves. Focus moves into the sheet and back to the cell.
 *
 * Columns: 0 id · 1 status (select) · 2 product (combobox) · 3 assignee (autocomplete) · 4 due (date).
 * Navigate mode: a tap on a dropdown cell opens its editor; the date cell: tap, then F2. Row 3: status 'open', product 'phone', due 2026-06-13.
 */

const PAGE = '/test/phone-sheet.html'
const ROW = 3

// Chromium only (the e2e rule): a phone = the Pixel 7 descriptor (isMobile + hasTouch → coarse pointer)
const { defaultBrowserType: _ignored, ...PHONE } = devices['Pixel 7']

type Snap = { sheet: number; dropdown: number; picker: number; editing: string[]; focus: string; value: string; events: string[] }

async function snap(page: Page, col: number): Promise<Snap> {
	return page.evaluate(([row, col]) => {
		const g = document.getElementById('grid') as HTMLElement
		const root = g.shadowRoot as ShadowRoot
		let a: Element | null = document.activeElement
		while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement
		const td = a?.closest('td.wg__cell') as HTMLElement | null
		const focus = td
			? `${td.dataset.row}:${td.dataset.col}${a === td ? '' : '/editor'}`
			: a?.closest('.wg__dropdown--sheet, .wg-datepicker-container--sheet') ? 'sheet'
				: a?.classList.contains('wg') ? 'grid' : `${a?.tagName.toLowerCase()}`
		const target = root.querySelector(`td.wg__cell[data-row="${row}"][data-col="${col}"]`)
		const input = target?.querySelector('input') as HTMLInputElement | null
		type Logged = { type: string; via: string; detail: { rowIndex: number; field: string; newValue?: unknown } }
		return {
			sheet: root.querySelectorAll('.wg__dropdown--sheet, .wg-datepicker-container--sheet').length,
			dropdown: root.querySelectorAll('.wg__dropdown').length,
			picker: root.querySelectorAll('.wg-datepicker').length,
			editing: [...root.querySelectorAll<HTMLElement>('.wg__cell--editing')].map((c) => `${c.dataset.row}:${c.dataset.col}`),
			focus,
			value: input ? `input:${input.value}` : (target?.textContent ?? '').replace('▼', '').trim(),
			events: (((window as unknown as { __events?: Logged[] }).__events) ?? [])
				.filter((e) => e.via === 'event')
				.map((e) => e.type === 'row-change'
					? `${e.type}(${e.detail.rowIndex}.${e.detail.field}=${e.detail.newValue})`
					: `${e.type}(${e.detail.rowIndex}.${e.detail.field})`)
		}
	}, [ROW, col] as const)
}

/** Tap row 3's `col`, F2: its editor + popup open. */
async function openEditor(page: Page, col: number): Promise<void> {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr.wg__row').first()).toBeVisible()
	// A tap focuses the cell — a dropdown cell (navigate mode) opens its editor right away, else F2
	await cell(page, ROW, col).tap()
	await page.waitForTimeout(150)
	if ((await snap(page, col)).editing.length === 0) {
		await expect.poll(async () => (await snap(page, col)).focus).toBe(`${ROW}:${col}`)
		await page.keyboard.press('F2')
	}
	await expect(cell(page, ROW, col)).toHaveClass(/wg__cell--editing/)
	await page.waitForTimeout(150)
}

const sheetOf = (page: Page) => gridLocator(page).locator('.wg__dropdown--sheet, .wg-datepicker-container--sheet')
const settle = (page: Page) => page.waitForTimeout(250)

test.describe('phone: the cell popups are a full-screen sheet', () => {
	test.use(PHONE)

	for (const [col, kind] of [[1, 'select'], [2, 'combobox'], [3, 'autocomplete'], [4, 'date']] as const) {
		test(`${kind}: an edge-to-edge sheet with the column title and a close button, focus inside, page locked`, async ({ page }) => {
			await openEditor(page, col)
			await expect(sheetOf(page)).toHaveCount(1)
			const viewport = page.viewportSize()!
			const geo = await sheetOf(page).evaluate((el) => {
				const r = el.getBoundingClientRect()
				const close = el.querySelector('.wg__sheet-close')!.getBoundingClientRect()
				return {
					x: r.x, y: r.y, w: r.width, h: r.height,
					position: getComputedStyle(el).position,
					inlineLeft: (el as HTMLElement).style.left,
					title: el.querySelector('.wg__sheet-title')?.textContent,
					role: el.getAttribute('role'),
					close: { w: close.width, h: close.height },
					bodyLocked: getComputedStyle(document.body).position === 'fixed',
				}
			})
			expect(geo.position).toBe('fixed')
			expect(geo.inlineLeft).toBe('')
			expect(geo.x).toBe(0)
			expect(geo.y).toBe(0)
			expect(Math.round(geo.w)).toBe(viewport.width)
			expect(Math.round(geo.h)).toBe(viewport.height)
			expect(geo.title).toBe({ 1: 'Status', 2: 'Product', 3: 'Assignee', 4: 'Due date' }[col])
			expect(geo.role).toBe('dialog')
			expect(geo.close.w).toBeGreaterThanOrEqual(44)
			expect(geo.close.h).toBeGreaterThanOrEqual(44)
			expect(geo.bodyLocked).toBe(true)
			expect((await snap(page, col)).focus).toBe('sheet')
			// a search field only for the typing editors
			await expect(sheetOf(page).locator('.wg__sheet-search')).toHaveCount(col === 2 || col === 3 ? 1 : 0)
		})
	}

	test('select: a picked option saves, the sheet closes, focus back on the cell, the page unlocked', async ({ page }) => {
		await openEditor(page, 1)
		await sheetOf(page).locator('.wg__dropdown-option', { hasText: 'Done' }).tap()
		await settle(page)
		const s = await snap(page, 1)
		expect(s).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:1`, value: 'Done', events: [`cell-edit-start(${ROW}.status)`, `row-change(${ROW}.status=done)`] })
		expect(await page.evaluate(() => getComputedStyle(document.body).position)).not.toBe('fixed')
	})

	test('select: the close button without a pick changes nothing (cell-edit-cancel), focus on the cell', async ({ page }) => {
		await openEditor(page, 1)
		await sheetOf(page).locator('.wg__sheet-close').tap()
		await settle(page)
		expect(await snap(page, 1)).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:1`, value: 'Open', events: [`cell-edit-start(${ROW}.status)`, `cell-edit-cancel(${ROW}.status)`] })
	})

	test('select: arrow keys + Enter in the sheet pick (the grid keys)', async ({ page }) => {
		await openEditor(page, 1)
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Enter')
		await settle(page)
		const s = await snap(page, 1)
		expect(s.sheet).toBe(0)
		expect(s.events).toEqual([`cell-edit-start(${ROW}.status)`, `row-change(${ROW}.status=done)`])
	})

	test('select: Escape cancels, focus on the cell', async ({ page }) => {
		await openEditor(page, 1)
		await page.keyboard.press('Escape')
		await settle(page)
		expect(await snap(page, 1)).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:1`, value: 'Open', events: [`cell-edit-start(${ROW}.status)`, `cell-edit-cancel(${ROW}.status)`] })
	})

	test('combobox: typing in the sheet filters; the close button SAVES the typed value (Excel rule)', async ({ page }) => {
		await openEditor(page, 2)
		const search = sheetOf(page).locator('.wg__sheet-search')
		await expect(search).toBeFocused()
		await expect(search).toHaveValue('Phone')
		await search.fill('Tab')
		await expect(sheetOf(page).locator('.wg__dropdown-option')).toHaveText(['Tablet'])
		// the sheet stayed the same element (its search kept the focus)
		await expect(search).toBeFocused()
		await sheetOf(page).locator('.wg__sheet-close').tap()
		await settle(page)
		const s = await snap(page, 2)
		expect(s).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:2`, value: 'Tab', events: [`cell-edit-start(${ROW}.product)`, `row-change(${ROW}.product=Tab)`] })
	})

	test('combobox: a typed option label saves its value; Escape works like in the cell (typed → restored, again → cancel)', async ({ page }) => {
		await openEditor(page, 2)
		await sheetOf(page).locator('.wg__sheet-search').fill('Tablet')
		await sheetOf(page).locator('.wg__dropdown-option', { hasText: 'Tablet' }).tap()
		await settle(page)
		expect((await snap(page, 2)).events).toEqual([`cell-edit-start(${ROW}.product)`, `row-change(${ROW}.product=tablet)`])

		await openEditor(page, 2)
		await sheetOf(page).locator('.wg__sheet-search').fill('Laptop')
		// the first Escape restores the cell's text (the grid's two-phase Escape), the sheet stays
		await page.keyboard.press('Escape')
		await settle(page)
		await expect(sheetOf(page).locator('.wg__sheet-search')).toHaveValue('Phone')
		await expect(sheetOf(page).locator('.wg__sheet-search')).toBeFocused()
		await page.keyboard.press('Escape')
		await settle(page)
		expect(await snap(page, 2)).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:2`, value: 'Phone', events: [`cell-edit-start(${ROW}.product)`, `cell-edit-cancel(${ROW}.product)`] })
	})

	test('autocomplete: a search in the sheet, Enter picks the first match', async ({ page }) => {
		await openEditor(page, 3)
		await sheetOf(page).locator('.wg__sheet-search').fill('car')
		await expect(sheetOf(page).locator('.wg__dropdown-option')).toHaveText(['Carol'])
		await page.keyboard.press('Enter')
		await settle(page)
		const s = await snap(page, 3)
		expect(s.sheet).toBe(0)
		expect(s.value).toBe('Carol')
		expect(s.events).toEqual([`cell-edit-start(${ROW}.assignee)`, `row-change(${ROW}.assignee=Carol)`])
	})

	test('the phone Back gesture closes the sheet and SAVES (like the close button)', async ({ page }) => {
		await openEditor(page, 2)
		await sheetOf(page).locator('.wg__sheet-search').fill('Laptop')
		await page.evaluate(() => history.back())
		await settle(page)
		const s = await snap(page, 2)
		expect(s.sheet).toBe(0)
		expect(s.editing).toEqual([])
		expect(s.value).toBe('Laptop')
		expect(s.events).toEqual([`cell-edit-start(${ROW}.product)`, `row-change(${ROW}.product=laptop)`])
		expect(page.url()).toContain(PAGE)
	})

	test('closing consumes its history entry (Back afterwards leaves the page as usual)', async ({ page }) => {
		const before = await page.goto(PAGE).then(() => page.evaluate(() => history.length))
		await cell(page, ROW, 1).tap()
		await expect(sheetOf(page)).toHaveCount(1)
		await sheetOf(page).locator('.wg__dropdown-option', { hasText: 'Done' }).tap()
		await settle(page)
		// pushState + back(): the entry is popped (history.length keeps it as a forward entry)
		expect(await page.evaluate(() => (history.state as { wgSheet?: boolean } | null)?.wgSheet ?? false)).toBe(false)
		expect(await page.evaluate(() => history.length)).toBeGreaterThanOrEqual(before)
	})

	test('date: a tapped day saves, focus back on the cell', async ({ page }) => {
		await openEditor(page, 4)
		await sheetOf(page).locator('.wg-datepicker__day[data-date="2026-06-18"]').tap()
		await settle(page)
		expect(await snap(page, 4)).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:4`, value: '2026-06-18', events: [`cell-edit-start(${ROW}.due)`, `row-change(${ROW}.due=2026-06-18)`] })
	})

	test('date: the close button saves (unchanged: no event), focus on the cell; Escape cancels', async ({ page }) => {
		await openEditor(page, 4)
		await sheetOf(page).locator('.wg__sheet-close').tap()
		await settle(page)
		expect(await snap(page, 4)).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:4`, value: '2026-06-13', events: [`cell-edit-start(${ROW}.due)`] })

		await openEditor(page, 4)
		await page.keyboard.press('Escape')
		await settle(page)
		expect(await snap(page, 4)).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:4`, value: '2026-06-13', events: [`cell-edit-start(${ROW}.due)`, `cell-edit-cancel(${ROW}.due)`] })
	})

	test('date: a typed date (cell input) is saved by the close button', async ({ page }) => {
		await openEditor(page, 4)
		await cell(page, ROW, 4).locator('input').evaluate((input: HTMLInputElement) => {
			input.value = '2026-06-25'
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		await sheetOf(page).locator('.wg__sheet-close').tap()
		await settle(page)
		const s = await snap(page, 4)
		expect(s.value).toBe('2026-06-25')
		expect(s.events).toEqual([`cell-edit-start(${ROW}.due)`, `row-change(${ROW}.due=2026-06-25)`])
	})

	test('rotating to a tablet-size viewport switches the open sheet to the anchored panel in place', async ({ page }) => {
		await openEditor(page, 1)
		const panel = gridLocator(page).locator('.wg__dropdown')
		await expect(panel).toHaveClass(/wg__dropdown--sheet/)
		await panel.evaluate((el) => { (el as unknown as { __marker: number }).__marker = 1 })
		await page.setViewportSize({ width: 1024, height: 1366 })
		await expect(panel).not.toHaveClass(/wg__dropdown--sheet/)
		// the same panel element (the same popover, anchored now), placed under the cell
		expect(await panel.evaluate((el) => (el as unknown as { __marker?: number }).__marker)).toBe(1)
		await expect(panel.locator('.wg__sheet-header')).toHaveCount(0)
		const [p, c] = await Promise.all([panel.boundingBox(), cell(page, ROW, 1).boundingBox()])
		expect(Math.abs(p!.y - (c!.y + c!.height))).toBeLessThan(12)
		expect(await page.evaluate(() => getComputedStyle(document.body).position)).not.toBe('fixed')
		// back to the phone size: the sheet again
		await page.setViewportSize({ width: 412, height: 839 })
		await expect(panel).toHaveClass(/wg__dropdown--sheet/)
		await sheetOf(page).locator('.wg__dropdown-option', { hasText: 'On hold' }).tap()
		await settle(page)
		expect((await snap(page, 1)).events).toEqual([`cell-edit-start(${ROW}.status)`, `row-change(${ROW}.status=hold)`])
	})
})

test.describe('desktop: the anchored panels are unchanged', () => {
	test('select dropdown and date picker anchor under the cell, no sheet', async ({ page }) => {
		await page.goto(PAGE)
		await expect(gridLocator(page).locator('tbody tr.wg__row').first()).toBeVisible()
		for (const col of [1, 4]) {
			await cell(page, ROW, col).click()
			await page.keyboard.press('F2')
			const panel = gridLocator(page).locator(col === 1 ? '.wg__dropdown' : '.wg-datepicker-container')
			await expect(panel).toBeVisible()
			await expect(sheetOf(page)).toHaveCount(0)
			await expect(panel.locator('.wg__sheet-header')).toHaveCount(0)
			expect(await panel.evaluate((el) => getComputedStyle(el).position)).toBe('absolute')
			const [p, c] = await Promise.all([panel.boundingBox(), cell(page, ROW, col).boundingBox()])
			expect(Math.abs(p!.y - (c!.y + c!.height))).toBeLessThan(12)
			expect(await page.evaluate(() => getComputedStyle(document.body).position)).not.toBe('fixed')
			await page.keyboard.press('Escape')
			await settle(page)
		}
	})
})

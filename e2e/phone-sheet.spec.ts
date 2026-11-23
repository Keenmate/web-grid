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

const sheetOf = (page: Page) => gridLocator(page).locator('.wg__dropdown--sheet, .wg-datepicker-container--sheet')

/** Two animation frames: scroll events / rAF work queued so far (the sheet's page lock, focus moves) have run. */
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))

/** No sheet history entry left (core claimBackEntry: a deferred history.back(), its popstate, then the page's scrollRestoration). */
const historySettled = (page: Page) => page.evaluate(() =>
	!(history.state as { kmBackEntry?: boolean } | null)?.kmBackEntry && history.scrollRestoration === 'auto')

/** Tap row 3's `col` (the date cell: then F2): its editor + sheet are open, the focus inside the sheet. */
async function openEditor(page: Page, col: number): Promise<void> {
	await page.goto(PAGE)
	await expect(gridLocator(page).locator('tbody tr.wg__row').first()).toBeVisible()
	// A tap focuses the cell — a dropdown cell (navigate mode) opens its editor right away, the date cell needs F2
	await cell(page, ROW, col).tap()
	if (col === 4) {
		await expect.poll(async () => (await snap(page, col)).focus).toBe(`${ROW}:${col}`)
		await page.keyboard.press('F2')
	}
	await expect(cell(page, ROW, col)).toHaveClass(/wg__cell--editing/)
	await expect(sheetOf(page)).toHaveCount(1)
	await expect.poll(async () => (await snap(page, col)).focus).toBe('sheet')
	await frames(page)
}

/** The popup closed and the close is over: no sheet / panel, no cell editing, its history entry gone, two frames. */
async function closed(page: Page): Promise<void> {
	await expect(gridLocator(page).locator('.wg__dropdown, .wg-datepicker-container')).toHaveCount(0)
	await expect(gridLocator(page).locator('.wg__cell--editing')).toHaveCount(0)
	await expect.poll(() => historySettled(page)).toBe(true)
	await frames(page)
}

test.describe('phone: the cell popups are a full-screen sheet', () => {
	test.use(PHONE)

	for (const [col, kind] of [[1, 'select'], [2, 'combobox'], [3, 'autocomplete'], [4, 'date']] as const) {
		test(`${kind}: an edge-to-edge sheet with the column title and a close button, focus inside, page locked`, async ({ page }) => {
			await openEditor(page, col)
			await expect(sheetOf(page)).toHaveCount(1)
			const viewport = page.viewportSize()!
			// core's .km-sheet enter animation (a short slide-up) is over
			await sheetOf(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
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
					// core's sheet chrome (createSheetHeader): the ✕ is a CSS mask, no text
					closeChrome: {
						isCore: el.querySelector('.wg__sheet-close')!.classList.contains('km-sheet-close'),
						text: el.querySelector('.wg__sheet-close')!.textContent,
						label: el.querySelector('.wg__sheet-close')!.getAttribute('aria-label'),
						isCoreHeader: !!el.querySelector('.km-sheet-header.wg__sheet-header > .km-sheet-title.wg__sheet-title'),
					},
					// core's full-screen frame (.km-sheet): the header, then the scrolling body; the grid's background on it
					isCoreFrame: el.classList.contains('km-sheet') && el.querySelector(':scope > .km-sheet-header + .km-sheet-body') !== null,
					bodyOverflow: getComputedStyle(el.querySelector(':scope > .km-sheet-body')!).overflowY,
					sheetBg: getComputedStyle(el).backgroundColor,
					ariaModal: el.getAttribute('aria-modal'),
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
			expect(geo.isCoreFrame).toBe(true)
			expect(geo.bodyOverflow).toBe('auto')
			expect(geo.sheetBg).not.toBe('rgba(0, 0, 0, 0)')
			expect(geo.ariaModal).toBe('true')
			expect(geo.closeChrome).toEqual({ isCore: true, text: '', label: 'Close', isCoreHeader: true })
			expect(geo.bodyLocked).toBe(true)
			expect((await snap(page, col)).focus).toBe('sheet')
			// a search field only for the typing editors
			await expect(sheetOf(page).locator('.wg__sheet-search')).toHaveCount(col === 2 || col === 3 ? 1 : 0)
		})
	}

	test('select: a picked option saves, the sheet closes, focus back on the cell, the page unlocked', async ({ page }) => {
		await openEditor(page, 1)
		await sheetOf(page).locator('.wg__dropdown-option', { hasText: 'Done' }).tap()
		await closed(page)
		const s = await snap(page, 1)
		expect(s).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:1`, value: 'Done', events: [`cell-edit-start(${ROW}.status)`, `row-change(${ROW}.status=done)`] })
		expect(await page.evaluate(() => getComputedStyle(document.body).position)).not.toBe('fixed')
	})

	test('select: the close button without a pick changes nothing (cell-edit-cancel), focus on the cell', async ({ page }) => {
		await openEditor(page, 1)
		await sheetOf(page).locator('.wg__sheet-close').tap()
		await closed(page)
		expect(await snap(page, 1)).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:1`, value: 'Open', events: [`cell-edit-start(${ROW}.status)`, `cell-edit-cancel(${ROW}.status)`] })
	})

	test('select: arrow keys + Enter in the sheet pick (the grid keys)', async ({ page }) => {
		await openEditor(page, 1)
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Enter')
		await closed(page)
		const s = await snap(page, 1)
		expect(s.sheet).toBe(0)
		expect(s.events).toEqual([`cell-edit-start(${ROW}.status)`, `row-change(${ROW}.status=done)`])
	})

	test('select: Escape cancels, focus on the cell', async ({ page }) => {
		await openEditor(page, 1)
		await page.keyboard.press('Escape')
		await closed(page)
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
		await closed(page)
		const s = await snap(page, 2)
		expect(s).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:2`, value: 'Tab', events: [`cell-edit-start(${ROW}.product)`, `row-change(${ROW}.product=Tab)`] })
	})

	test('combobox: a typed option label saves its value; Escape works like in the cell (typed → restored, again → cancel)', async ({ page }) => {
		await openEditor(page, 2)
		await sheetOf(page).locator('.wg__sheet-search').fill('Tablet')
		await sheetOf(page).locator('.wg__dropdown-option', { hasText: 'Tablet' }).tap()
		await closed(page)
		expect((await snap(page, 2)).events).toEqual([`cell-edit-start(${ROW}.product)`, `row-change(${ROW}.product=tablet)`])

		await openEditor(page, 2)
		await sheetOf(page).locator('.wg__sheet-search').fill('Laptop')
		// the first Escape restores the cell's text (the grid's two-phase Escape), the sheet stays
		await page.keyboard.press('Escape')
		await expect(sheetOf(page).locator('.wg__sheet-search')).toHaveValue('Phone')
		await expect(sheetOf(page).locator('.wg__sheet-search')).toBeFocused()
		await page.keyboard.press('Escape')
		await closed(page)
		expect(await snap(page, 2)).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:2`, value: 'Phone', events: [`cell-edit-start(${ROW}.product)`, `cell-edit-cancel(${ROW}.product)`] })
	})

	test('autocomplete: a search in the sheet, Enter picks the first match', async ({ page }) => {
		await openEditor(page, 3)
		await sheetOf(page).locator('.wg__sheet-search').fill('car')
		await expect(sheetOf(page).locator('.wg__dropdown-option')).toHaveText(['Carol'])
		await page.keyboard.press('Enter')
		await closed(page)
		const s = await snap(page, 3)
		expect(s.sheet).toBe(0)
		expect(s.value).toBe('Carol')
		expect(s.events).toEqual([`cell-edit-start(${ROW}.assignee)`, `row-change(${ROW}.assignee=Carol)`])
	})

	test('the phone Back gesture closes the sheet and SAVES (like the close button)', async ({ page }) => {
		await openEditor(page, 2)
		await sheetOf(page).locator('.wg__sheet-search').fill('Laptop')
		await page.evaluate(() => history.back())
		await closed(page)
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
		await closed(page)
		// pushState + back(): the entry is popped (history.length keeps it as a forward entry)
		expect(await page.evaluate(() => (history.state as { kmBackEntry?: boolean } | null)?.kmBackEntry ?? false)).toBe(false)
		expect(await page.evaluate(() => history.length)).toBeGreaterThanOrEqual(before)
	})

	test('closing keeps the page scrolled where it was, without a jump to the top (close button, Back) — core claimBackEntry', async ({ page }) => {
		await page.goto(PAGE)
		await expect(gridLocator(page).locator('tbody tr.wg__row').first()).toBeVisible()
		// A tall page with the grid well below the top
		await page.evaluate(() => {
			const spacer = document.createElement('div')
			spacer.style.height = '1500px'
			document.body.prepend(spacer)
			document.body.style.minHeight = '4000px'
		})
		await cell(page, ROW, 1).evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
		const scrollY = () => page.evaluate(() => Math.round(window.scrollY))
		const before = await scrollY()
		expect(before).toBeGreaterThan(1000)
		// Scroll events are dispatched at the next rendering step, not when the position changes: two
		// animation frames flush the ones already queued (the open's scroll lock) before / after a check.
		// Every scroll position from the close on (the browser's own restore would flash to 0)
		const track = () => page.evaluate(() => {
			const w = window as unknown as { __ys: number[]; __track?: () => void }
			w.__ys = []
			if (w.__track) removeEventListener('scroll', w.__track)
			w.__track = () => w.__ys.push(Math.round(scrollY))
			addEventListener('scroll', w.__track)
		})
		const seen = () => page.evaluate(() => (window as unknown as { __ys: number[] }).__ys)

		for (const close of ['close button', 'Back'] as const) {
			await cell(page, ROW, 1).tap()
			await expect(sheetOf(page)).toHaveCount(1)
			await frames(page)  // the open's own scroll events (the page lock) are not the close's
			await track()
			if (close === 'Back') await page.evaluate(() => history.back())
			else await sheetOf(page).locator('.wg__sheet-close').tap()
			await expect(sheetOf(page)).toHaveCount(0)
			await expect.poll(() => historySettled(page), { message: close }).toBe(true)
			await frames(page)  // any scroll the traversal caused is dispatched by now
			expect(await scrollY(), close).toBe(before)
			expect((await seen()).filter((y) => y !== before), close).toEqual([])
		}
		expect(await page.evaluate(() => history.scrollRestoration)).toBe('auto') // the page's own mode is back
	})

	test('date: a tapped day saves, focus back on the cell', async ({ page }) => {
		await openEditor(page, 4)
		await sheetOf(page).locator('.wg-datepicker__day[data-date="2026-06-18"]').tap()
		await closed(page)
		expect(await snap(page, 4)).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:4`, value: '2026-06-18', events: [`cell-edit-start(${ROW}.due)`, `row-change(${ROW}.due=2026-06-18)`] })
	})

	test('date: the close button saves (unchanged: no event), focus on the cell; Escape cancels', async ({ page }) => {
		await openEditor(page, 4)
		await sheetOf(page).locator('.wg__sheet-close').tap()
		await closed(page)
		expect(await snap(page, 4)).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:4`, value: '2026-06-13', events: [`cell-edit-start(${ROW}.due)`] })

		await openEditor(page, 4)
		await page.keyboard.press('Escape')
		await closed(page)
		expect(await snap(page, 4)).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:4`, value: '2026-06-13', events: [`cell-edit-start(${ROW}.due)`, `cell-edit-cancel(${ROW}.due)`] })
	})

	test('date: a typed date (cell input) is saved by the close button', async ({ page }) => {
		await openEditor(page, 4)
		await cell(page, ROW, 4).locator('input').evaluate((input: HTMLInputElement) => {
			input.value = '2026-06-25'
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		await sheetOf(page).locator('.wg__sheet-close').tap()
		await closed(page)
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
		await closed(page)
		expect((await snap(page, 1)).events).toEqual([`cell-edit-start(${ROW}.status)`, `row-change(${ROW}.status=hold)`])
	})
})

test.describe('phone: the sheet is modal (core startModalSession — rulebook C-CA-19)', () => {
	test.use(PHONE)

	/** The page and the grid behind the sheet are inert; the sheet (and its ancestors) are not. */
	const inertState = (page: Page) => page.evaluate(() => {
		const g = document.getElementById('grid') as HTMLElement
		const root = g.shadowRoot as ShadowRoot
		const sheet = root.querySelector('.wg__dropdown--sheet, .wg-datepicker-container--sheet')
		return {
			heading: document.querySelector('h1')!.closest('[inert]') !== null,
			table: root.querySelector('.wg')?.closest('[inert]') !== null,
			host: g.closest('[inert]') !== null,
			sheet: sheet?.closest('[inert]') !== null && sheet !== null,
			any: document.querySelectorAll('[inert]').length + root.querySelectorAll('[inert]').length,
		}
	})

	for (const [col, kind] of [[1, 'select'], [4, 'date']] as const) {
		test(`${kind}: the page behind is inert while open, interactive again after the close`, async ({ page }) => {
			await openEditor(page, col)
			expect(await inertState(page)).toMatchObject({ heading: true, table: true, host: false, sheet: false })
			await sheetOf(page).locator('.wg__sheet-close').tap()
			await closed(page)
			expect((await inertState(page)).any).toBe(0)
			expect(await sheetOf(page).count()).toBe(0)
		})
	}

	test('select: Escape stays with the grid (cancel, Excel rule), not a modal dismiss — the page is live again, focus on the cell', async ({ page }) => {
		await openEditor(page, 1)
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Escape')
		await closed(page)
		expect(await snap(page, 1)).toEqual({ sheet: 0, dropdown: 0, picker: 0, editing: [], focus: `${ROW}:1`, value: 'Open', events: [`cell-edit-start(${ROW}.status)`, `cell-edit-cancel(${ROW}.status)`] })
		expect((await inertState(page)).any).toBe(0)
	})

	test('select: Tab never reaches the page behind — it leaves the cell (the grid key): the next cell sheet opens, modal in turn', async ({ page }) => {
		await openEditor(page, 1)
		await sheetOf(page).locator('.wg__sheet-close').focus()
		await page.keyboard.press('Tab')
		// the status edit ended unchanged; navigate mode opened the next cell's (product, combobox) sheet
		await expect(cell(page, ROW, 1)).not.toHaveClass(/wg__cell--editing/)
		await expect(cell(page, ROW, 2)).toHaveClass(/wg__cell--editing/)
		await expect(sheetOf(page)).toHaveCount(1)
		await expect(sheetOf(page).locator('.wg__sheet-title')).toHaveText('Product')
		await expect(sheetOf(page).locator('.wg__sheet-search')).toBeFocused()
		expect(await inertState(page)).toMatchObject({ heading: true, table: true, host: false, sheet: false })
		await page.keyboard.press('Escape')
		await page.keyboard.press('Escape')
		await closed(page)
		expect((await inertState(page)).any).toBe(0)
	})

	test('date: Tab inside the sheet stays inside it or leaves the cell — never the page behind', async ({ page }) => {
		await openEditor(page, 4)
		// a focusable outside the grid: inert while the sheet is open
		await page.evaluate(() => {
			const b = document.createElement('button')
			b.id = 'outside'
			b.textContent = 'outside'
			document.body.append(b)
		})
		await sheetOf(page).locator('.wg__sheet-close').focus()
		await page.keyboard.press('Shift+Tab')
		const where = await page.evaluate(() => {
			let a: Element | null = document.activeElement
			while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement
			// the date sheet, a cell, or the next editor's sheet (the edit moved on) — all in the grid
			return a?.id === 'outside' ? 'outside' : a?.closest('.km-sheet') ? 'sheet' : a?.closest('td.wg__cell') ? 'cell' : a?.tagName
		})
		expect(['sheet', 'cell']).toContain(where)
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
			await closed(page)
		}
	})
})

test.describe('phone: the sheet header theming', () => {
	test.use(PHONE)

	test('--wg-sheet-close-size on the grid resizes the close chip (core --_km-sheet-close-size)', async ({ page }) => {
		await openEditor(page, 1)
		const close = sheetOf(page).locator('.wg__sheet-close')
		expect(Math.round((await close.boundingBox())!.width)).toBe(44)
		await gridLocator(page).evaluate((el) => (el as HTMLElement).style.setProperty('--wg-sheet-close-size', '60px'))
		const box = await sheetOf(page).locator('.wg__sheet-close').boundingBox()
		expect(Math.round(box!.width)).toBe(60)
		expect(Math.round(box!.height)).toBe(60)
	})
})

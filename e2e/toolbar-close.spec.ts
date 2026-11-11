import { test, expect, type Page, gridLocator, cell, openToolbarOn } from './fixtures'

/**
 * Characterization of every way the floating row toolbar opens and closes
 * (docs/test/toolbar-close.html), per `toolbarTrigger`: #gh hover (default), #gc click, #gb button.
 * Pins: toolbar open or gone, the row it is next to, the focused element, the `action` events.
 * Columns: 0 id (read-only) · 1 name (text) · 2 status (select) · 3 qty. Items: ping (custom, keeps
 * it open) · move-down · delete. Each test opens row 2's toolbar first.
 */

const PAGE = '/test/toolbar-close.html'

type Mode = 'gh' | 'gc' | 'gb'
const MODES: Mode[] = ['gh', 'gc', 'gb']

type Snap = { toolbar: number; row: number | null; focus: string; actions: string[]; connector: number }

/** The state: toolbar count in the grid, the row it sits next to, focus, `action` events, connector. */
async function snap(page: Page, id: string): Promise<Snap> {
	return page.evaluate((id) => {
		const g = document.getElementById(id) as HTMLElement
		const root = g.shadowRoot as ShadowRoot
		let a: Element | null = document.activeElement
		while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement
		const host = a?.getRootNode() instanceof ShadowRoot ? ((a.getRootNode() as ShadowRoot).host as HTMLElement).id + ' ' : ''
		const td = a?.closest('td.wg__cell') as HTMLElement | null
		const btn = a?.closest('.wg__toolbar-btn') as HTMLElement | null
		const trigger = a?.closest('.wg__toolbar-trigger') as HTMLElement | null
		const focus = btn ? `${host}toolbar:${btn.dataset.id ?? btn.dataset.action}`
			: trigger ? `${host}trigger:${trigger.dataset.toolbarTrigger}`
			: td ? `${host}${td.dataset.row}:${td.dataset.col}`
			: a?.classList.contains('wg') ? `${host}grid`
			: `${a?.tagName.toLowerCase()}${a?.id ? '#' + a.id : ''}`
		const tb = root.querySelector('.wg__toolbar-container .wg__toolbar') as HTMLElement | null
		let row: number | null = null
		if (tb && tb.style.visibility === 'visible') {
			const top = tb.getBoundingClientRect().top
			let best = Infinity
			for (const tr of root.querySelectorAll<HTMLElement>('tr.wg__row')) {
				const d = Math.abs(tr.getBoundingClientRect().top - top)
				if (d < best) { best = d; row = Number(tr.dataset.rowIndex) }
			}
			if (best > 3) row = -1
		}
		type Logged = { type: string; via: string; grid: string; detail: { action: string; id?: string; rowIndex?: number } }
		return {
			toolbar: root.querySelectorAll('.wg__toolbar-container').length,
			row,
			focus,
			actions: (((window as unknown as { __events?: Logged[] }).__events) ?? [])
				.filter((e) => e.via === 'event' && e.grid === id && e.type === 'action')
				.map((e) => `${e.detail.id ?? e.detail.action}:${e.detail.rowIndex}`),
			connector: root.querySelectorAll('.wg__connector').length
		}
	}, id)
}

const toolbar = (page: Page, id: string) => gridLocator(page, id).locator('.wg__toolbar-container .wg__toolbar')
const trigger = (page: Page, id: string, r: number) => gridLocator(page, id).locator(`.wg__toolbar-trigger[data-toolbar-trigger="${r}"]`)
const button = (page: Page, id: string, key: string) =>
	toolbar(page, id).locator(`.wg__toolbar-btn[data-id="${key}"], .wg__toolbar-btn[data-action="${key}"]`).first()

/** Open row `r`'s toolbar the way the mode does it. */
async function open(page: Page, id: Mode, r = 2): Promise<void> {
	if (id === 'gh') await openToolbarOn(page, cell(page, id, r, 1))
	else if (id === 'gc') await cell(page, id, r, 1).click()
	else await trigger(page, id, r).click()
	await expect(toolbar(page, id)).toHaveCSS('visibility', 'visible')
	await page.waitForTimeout(50)
}

async function load(page: Page, id: Mode): Promise<void> {
	await page.goto(PAGE)
	await expect(gridLocator(page, id).locator('tbody tr.wg__row').first()).toBeVisible()
	await gridLocator(page, id).evaluate((el) => el.scrollIntoView({ block: 'center' })) // core-adoption: allow — the test positions the page
	await open(page, id)
}

/** Hover a cell like `openToolbarOn()`, without scrolling it into view first (a scroll closes a cell dropdown). */
async function hoverNoScroll(page: Page, locator: ReturnType<typeof cell>): Promise<void> {
	const box = await locator.boundingBox()
	if (!box) throw new Error('no box')
	const x = box.x + box.width / 2
	const y = box.y + box.height / 2
	await page.mouse.move(x, y)
	const init = { cancelable: true, clientX: x, clientY: y, screenX: x, screenY: y, buttons: 0 }
	await locator.dispatchEvent('mouseenter', { ...init, bubbles: false })
	await locator.dispatchEvent('mousemove', { ...init, bubbles: true })
}

/** Click a toolbar button with a real pointer (the hover toolbar stays: the pointer is over it). */
async function clickButton(page: Page, id: string, key: string): Promise<void> {
	await button(page, id, key).click()
}

// The focus a mode's opener leaves: hover moves nothing, a row click focuses the cell, a trigger click the trigger
const OPEN_FOCUS: Record<Mode, string> = { gh: 'body', gc: 'gc 2:1', gb: 'gb trigger:2' }

for (const id of MODES) {
	test.describe(`toolbar close paths — #${id}`, () => {
		test('open: next to row 2', async ({ page }) => {
			await load(page, id)
			expect(await snap(page, id)).toEqual({ toolbar: 1, row: 2, focus: OPEN_FOCUS[id], actions: [], connector: 0 })
		})

		test('action ping: stays open, one action event', async ({ page }) => {
			await load(page, id)
			await clickButton(page, id, 'ping')
			await page.waitForTimeout(100)
			expect(await snap(page, id)).toEqual({ toolbar: 1, row: 2, focus: EXPECT.pingFocus[id], actions: ['ping:2'], connector: 0 })
		})

		test('action delete: closes, the row is gone', async ({ page }) => {
			await load(page, id)
			await clickButton(page, id, 'delete')
			await expect(toolbar(page, id)).toHaveCount(0)
			const s = await snap(page, id)
			expect(s.actions).toEqual(['delete:2'])
			expect(await gridLocator(page, id).locator('tbody tr.wg__row').count()).toBe(7)
		})

		test('action move-down: stays open, connector drawn', async ({ page }) => {
			await load(page, id)
			await clickButton(page, id, 'move-down')
			await page.waitForTimeout(100)
			const s = await snap(page, id)
			expect(s).toMatchObject({ toolbar: 1, row: 2, actions: ['move-down:2'], connector: 1 })
		})

		test('outside click on the page: closes, focus on the clicked button', async ({ page }) => {
			await load(page, id)
			// hover: after a move the toolbar no longer closes on mouseleave, so the click decides
			if (id === 'gh') { await clickButton(page, id, 'move-down'); await page.waitForTimeout(100) }
			await page.locator('#outside').click()
			await page.waitForTimeout(250)
			expect(await snap(page, id)).toMatchObject({ toolbar: 0, focus: 'button#outside', connector: EXPECT.outsideConnector[id] })
			expect(await page.evaluate(() => (window as unknown as { __outsideClicks: number }).__outsideClicks)).toBe(1)
		})

		test('keyboard click on a page button (Enter): pinned', async ({ page }) => {
			await load(page, id)
			await page.locator('#outside').focus()
			await page.keyboard.press('Enter')
			await page.waitForTimeout(250)
			// today: the document click listener closes it on any click event, a keyboard one too
			expect((await snap(page, id)).toolbar).toBe(EXPECT.keyboardClick[id])
		})

		test('click on another row', async ({ page }) => {
			await load(page, id)
			if (id === 'gh') await openToolbarOn(page, cell(page, id, 4, 1))
			else await cell(page, id, 4, 1).click()
			await page.waitForTimeout(150)
			const s = await snap(page, id)
			expect({ toolbar: s.toolbar, row: s.row }).toEqual(EXPECT.otherRow[id])
		})

		test('click on the same row (cell / trigger) again', async ({ page }) => {
			await load(page, id)
			if (id === 'gb') await trigger(page, id, 2).click()
			else await cell(page, id, 2, 1).click()
			await page.waitForTimeout(150)
			const s = await snap(page, id)
			expect({ toolbar: s.toolbar, row: s.row }).toEqual(EXPECT.sameRow[id])
		})

		test('click on a header (inside the grid, not a row)', async ({ page }) => {
			await load(page, id)
			await gridLocator(page, id).locator('thead th.wg__header[data-field="qty"]').click()
			await page.waitForTimeout(150)
			expect((await snap(page, id)).toolbar).toBe(EXPECT.header[id])
		})

		test('Escape with focus where the opener left it', async ({ page }) => {
			await load(page, id)
			await page.keyboard.press('Escape')
			await page.waitForTimeout(100)
			expect(await snap(page, id)).toMatchObject(EXPECT.escape[id])
		})

		test('Escape with focus on a toolbar button (keyboard focus)', async ({ page }) => {
			await load(page, id)
			await button(page, id, 'ping').focus()
			await page.keyboard.press('Escape')
			await page.waitForTimeout(100)
			expect(await snap(page, id)).toMatchObject(EXPECT.escapeInToolbar[id])
		})

		test('page scroll: closes', async ({ page }) => {
			await load(page, id)
			await page.evaluate(() => window.scrollBy(0, 40))
			await page.waitForTimeout(150)
			expect((await snap(page, id)).toolbar).toBe(0)
		})

		test('grid body scroll: stays open', async ({ page }) => {
			await load(page, id)
			await gridLocator(page, id).evaluate((g) => { (g.shadowRoot!.querySelector('.wg') as HTMLElement).scrollTop += 30 })
			await page.waitForTimeout(150)
			expect((await snap(page, id)).toolbar).toBe(1)
		})

		test('items replaced (same rows, new objects): stays open', async ({ page }) => {
			await load(page, id)
			await gridLocator(page, id).evaluate((g) => { const el = g as unknown as { items: object[] }; el.items = el.items.map((r) => ({ ...r })) })
			await page.waitForTimeout(150)
			expect((await snap(page, id)).toolbar).toBe(1)
		})

		test('its row removed through the API: pinned', async ({ page }) => {
			await load(page, id)
			await gridLocator(page, id).evaluate((g) => { const el = g as unknown as { items: { id: number }[] }; el.items = el.items.filter((r) => r.id !== 3) })
			await page.waitForTimeout(150)
			expect((await snap(page, id)).toolbar).toBe(EXPECT.rowRemoved[id])
		})

		test('another overlay opens (default group)', async ({ page }) => {
			await load(page, id)
			await page.evaluate(() => (window as unknown as { __pop: Record<string, { open(): void }> }).__pop.default.open())
			await page.waitForTimeout(100)
			expect((await snap(page, id)).toolbar).toBe(EXPECT.otherOverlay[id])
		})

		test('dismissAllOverlays()', async ({ page }) => {
			await load(page, id)
			await page.evaluate(() => document.dispatchEvent(new CustomEvent('km-overlay-activate', { detail: { source: 'x', group: Symbol.for('km-overlay-all-groups') } })))
			await page.waitForTimeout(100)
			expect((await snap(page, id)).toolbar).toBe(EXPECT.dismissAll[id])
		})

		test('the toolbar opening leaves a page overlay (default group)', async ({ page }) => {
			await page.goto(PAGE)
			await expect(gridLocator(page, id).locator('tbody tr.wg__row').first()).toBeVisible()
			await gridLocator(page, id).evaluate((el) => el.scrollIntoView({ block: 'center' })) // core-adoption: allow — the test positions the page
			await page.evaluate(() => (window as unknown as { __pop: Record<string, { open(): void }> }).__pop.default.open())
			await open(page, id)
			expect(await page.evaluate(() => (window as unknown as { __pop: Record<string, { isOpen: boolean }> }).__pop.default.isOpen)).toBe(EXPECT.leavesPop[id])
		})

		test('isDisabled: closes', async ({ page }) => {
			await load(page, id)
			await gridLocator(page, id).evaluate((g) => { (g as unknown as { isDisabled: boolean }).isDisabled = true })
			await page.waitForTimeout(100)
			expect((await snap(page, id)).toolbar).toBe(0)
		})
	})
}

// Mode-specific expectations (today's behaviour).
const EXPECT = {
	// the toolbar button never keeps focus: the re-render after the action restores the focused cell, else <body>
	pingFocus: { gh: 'body', gc: 'gc 2:1', gb: 'body' } as Record<Mode, string>,
	// BUG (pinned): a toolbar closed after a move leaves its connector line on screen
	outsideConnector: { gh: 1, gc: 0, gb: 0 } as Record<Mode, number>,
	keyboardClick: { gh: 0, gc: 0, gb: 0 } as Record<Mode, number>,
	otherRow: { gh: { toolbar: 1, row: 4 }, gc: { toolbar: 1, row: 4 }, gb: { toolbar: 0, row: null } } as Record<Mode, { toolbar: number; row: number | null }>,
	sameRow: { gh: { toolbar: 1, row: 2 }, gc: { toolbar: 0, row: null }, gb: { toolbar: 0, row: null } } as Record<Mode, { toolbar: number; row: number | null }>,
	// a header click stops propagation (sort): the document listener never sees it
	header: { gh: 1, gc: 1, gb: 1 } as Record<Mode, number>,
	// Escape on a focused cell (no edit) blurs it to <body> (the grid's own Escape)
	escape: { gh: { toolbar: 1 }, gc: { toolbar: 1, focus: 'body' }, gb: { toolbar: 1, focus: 'gb trigger:2' } } as Record<Mode, Partial<Snap>>,
	escapeInToolbar: { gh: { toolbar: 1, focus: 'gh toolbar:ping' }, gc: { toolbar: 1, focus: 'gc toolbar:ping' }, gb: { toolbar: 1, focus: 'gb toolbar:ping' } } as Record<Mode, Partial<Snap>>,
	rowRemoved: { gh: 1, gc: 1, gb: 1 } as Record<Mode, number>,
	otherOverlay: { gh: 1, gc: 1, gb: 1 } as Record<Mode, number>,
	dismissAll: { gh: 1, gc: 1, gb: 1 } as Record<Mode, number>,
	leavesPop: { gh: true, gc: true, gb: true } as Record<Mode, boolean>
}

test.describe('toolbar close paths — hover only (#gh)', () => {
	test('the pointer leaves the grid: closes', async ({ page }) => {
		await load(page, 'gh')
		await page.mouse.move(5, 5)
		await page.waitForTimeout(400)
		expect((await snap(page, 'gh')).toolbar).toBe(0)
	})

	test('after a move action the pointer leaving keeps it open', async ({ page }) => {
		await load(page, 'gh')
		await clickButton(page, 'gh', 'move-down')
		await page.mouse.move(5, 5)
		await page.waitForTimeout(400)
		expect((await snap(page, 'gh')).toolbar).toBe(1)
	})

	test('a cell dropdown opened in the row leaves the toolbar open', async ({ page }) => {
		await load(page, 'gh')
		await cell(page, 'gh', 2, 2).click()
		await openToolbarOn(page, cell(page, 'gh', 2, 2))
		await page.keyboard.press('F2')
		await expect(gridLocator(page, 'gh').locator('.wg__dropdown')).toBeVisible()
		await page.waitForTimeout(100)
		expect((await snap(page, 'gh')).toolbar).toBe(1)
	})

	test('hovering another row while a cell dropdown is open: the dropdown stays, the edit goes on', async ({ page }) => {
		await load(page, 'gh')
		await cell(page, 'gh', 2, 2).click()
		await page.keyboard.press('F2')
		await expect(gridLocator(page, 'gh').locator('.wg__dropdown')).toBeVisible()
		await page.waitForTimeout(100)
		await hoverNoScroll(page, cell(page, 'gh', 5, 1))
		await page.waitForTimeout(100)
		await expect(gridLocator(page, 'gh').locator('.wg__dropdown')).toHaveCount(1)
		await expect(gridLocator(page, 'gh').locator('.wg__cell--editing')).toHaveCount(1)
		expect((await snap(page, 'gh')).row).toBe(5)
	})
})

test.describe('toolbar close paths — click mode with an edit (#gc)', () => {
	test('F2 on a select cell of the toolbar row: the dropdown opens', async ({ page }) => {
		await load(page, 'gc')
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('F2')
		await expect(gridLocator(page, 'gc').locator('.wg__dropdown')).toBeVisible()
		await page.waitForTimeout(100)
		expect((await snap(page, 'gc')).toolbar).toBe(EXPECT_EDIT.dropdownOpens)
	})

	test('Escape in an open cell dropdown cancels the edit (the toolbar does not take the Escape)', async ({ page }) => {
		await load(page, 'gc')
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('F2')
		await expect(gridLocator(page, 'gc').locator('.wg__dropdown')).toBeVisible()
		await page.waitForTimeout(100)
		await page.keyboard.press('Escape')
		await expect(gridLocator(page, 'gc').locator('.wg__dropdown')).toHaveCount(0)
		await expect(gridLocator(page, 'gc').locator('.wg__cell--editing')).toHaveCount(0)
		expect((await snap(page, 'gc')).focus).toBe('gc 2:2')
	})

	test('Escape in a text editor cancels the edit (the toolbar does not take the Escape)', async ({ page }) => {
		await load(page, 'gc')
		await page.keyboard.press('F2')
		await expect(gridLocator(page, 'gc').locator('.wg__cell--editing')).toHaveCount(1)
		await page.keyboard.type('X')
		await page.keyboard.press('Escape')
		await expect(gridLocator(page, 'gc').locator('.wg__cell--editing')).toHaveCount(0)
		await expect(cell(page, 'gc', 2, 1)).toHaveText('Row 3')
	})
})

const EXPECT_EDIT = { dropdownOpens: 1 }

test.describe('toolbar close paths — two grids', () => {
	test('a second grid opening its toolbar closes the first one (default group)', async ({ page }) => {
		await load(page, 'gc')
		await trigger(page, 'gb', 1).click()
		await expect(toolbar(page, 'gb')).toHaveCSS('visibility', 'visible')
		expect((await snap(page, 'gc')).toolbar).toBe(0)
	})

	test('another grid leaving the page: pinned', async ({ page }) => {
		await load(page, 'gc')
		await page.evaluate(() => document.getElementById('gh')!.remove())
		await page.waitForTimeout(100)
		expect((await snap(page, 'gc')).toolbar).toBe(TWO_GRIDS.otherRemoved)
	})
})

const TWO_GRIDS = { otherRemoved: 0 }

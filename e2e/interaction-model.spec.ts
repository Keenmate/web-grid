import { test, expect, type Page, type Locator } from './fixtures'
import { openToolbarOn as hoverToolbarTrigger } from './helpers'

/**
 * The core interaction model (web-components-core `/actions`, SPEC §12.5 / §12.12):
 *   - toolbar / menu / shortcut entries are core action items: built-ins by name
 *     (`'delete'`, `'sort-asc'`, …), custom items by `id`, dividers, get*Callbacks
 *   - one `action` event (+ `onAction`) per activation, in the order
 *     beforeActionCallback → onClick → built-in → onAction → action event
 *   - the row built-ins do the work (add / delete / duplicate / move-up / move-down)
 *   - ctx / details carry `controller` / `element` (non-enumerable)
 *   - camelCase `on*` twins receive the detail
 *
 * Fixture: docs/test/interaction-model.html.
 */

const PAGE = '/test/interaction-model.html'

const grid = (page: Page) => page.locator('web-grid#grid')
const tree = (page: Page) => page.locator('web-grid#tree')
const row = (page: Page, i: number) => grid(page).locator(`tr[data-row-index="${i}"]`)
const cell = (page: Page, r: number, c: number, g = grid(page)) => g.locator(`.wg__cell[data-row="${r}"][data-col="${c}"]`)
const toolbar = (page: Page) => grid(page).locator('.wg__toolbar-container .wg__toolbar')
const menu = (page: Page) => page.locator('.wg-context-menu:not(.wg-context-menu--submenu)')
const log = (page: Page) => page.evaluate(() => (window as any).__log as string[])
const clearLog = (page: Page) => page.evaluate(() => { (window as any).__log = []; (window as any).__details = [] })
const names = (page: Page) => grid(page).evaluate((el: any) => el.items.map((r: any) => r.name))

async function openToolbarOn(page: Page, locator: Locator): Promise<void> {
	await hoverToolbarTrigger(page, locator)
	await expect(toolbar(page)).toBeVisible()
}

async function contextMenuOn(page: Page, locator: Locator): Promise<void> {
	await locator.scrollIntoViewIfNeeded()
	const box = await locator.boundingBox()
	if (!box) throw new Error('no box')
	const x = box.x + box.width / 2
	const y = box.y + box.height / 2
	await page.mouse.move(x, y)
	await locator.dispatchEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: x, clientY: y })
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await expect(row(page, 0)).toBeVisible()
	await clearLog(page)
})

test.describe('row toolbar — core action items', () => {
	test('renders built-ins with defaults, custom items, dividers; hidden items dropped', async ({ page }) => {
		await openToolbarOn(page, row(page, 0))
		const actions = await toolbar(page).locator('.wg__toolbar-btn').evaluateAll(els =>
			els.map(el => `${(el as HTMLElement).dataset.action}${(el as HTMLElement).dataset.id ? ':' + (el as HTMLElement).dataset.id : ''}`))
		expect(actions).toEqual(['move-up', 'move-down', 'add', 'duplicate', 'delete', 'custom:flag'])
		await expect(toolbar(page).locator('.wg__toolbar-divider')).toHaveCount(1)
		await expect(toolbar(page).locator('[data-action="delete"]')).toHaveClass(/wg__toolbar-btn--danger/)
		await expect(toolbar(page).locator('[data-action="delete"]')).toHaveAttribute('aria-label', 'Delete row')
		// move-up is disabled on the first row (built-in default state)
		await expect(toolbar(page).locator('[data-action="move-up"]')).toBeDisabled()
		// getIsToggledCallback → aria-pressed (row 0 qty 10 → not toggled)
		await expect(toolbar(page).locator('[data-id="flag"]')).not.toHaveAttribute('aria-pressed', 'true')
	})

	test('a custom item: before → onClick → onAction → event, with the row on the detail', async ({ page }) => {
		await openToolbarOn(page, row(page, 2))
		await expect(toolbar(page).locator('[data-id="flag"]')).toHaveAttribute('aria-pressed', 'true')
		await expect(toolbar(page).locator('[data-id="flag"]')).toHaveClass(/wg__toolbar-btn--toggled/)
		await toolbar(page).locator('[data-id="flag"]').click()
		await expect.poll(() => log(page)).toEqual(['before:custom:flag:row-toolbar', 'onClick:flag:Gamma', 'onAction:custom', 'event:custom'])
		const [d] = await page.evaluate(() => (window as any).__details)
		expect(d.json).toMatchObject({ action: 'custom', id: 'flag', source: 'row-toolbar', rowIndex: 2 })
		expect(d.rowName).toBe('Gamma')
		expect(d.hasController).toBe(true)
		expect(d.elementIsHost).toBe(true)
		expect(d.json).not.toHaveProperty('controller')
		expect(d.composed).toBe(false)
	})

	test('built-in delete removes the row before the event', async ({ page }) => {
		await openToolbarOn(page, row(page, 1))
		await toolbar(page).locator('[data-action="delete"]').click()
		await expect.poll(() => names(page)).toEqual(['Alpha', 'Gamma', 'Delta'])
		expect(await log(page)).toEqual(['before:delete:row-toolbar', 'onAction:delete', 'event:delete'])
	})

	test('built-in duplicate / add / move-down change items', async ({ page }) => {
		await openToolbarOn(page, row(page, 0))
		await toolbar(page).locator('[data-action="duplicate"]').click()
		await expect.poll(() => names(page)).toEqual(['Alpha', 'Alpha', 'Beta', 'Gamma', 'Delta'])
		// the duplicate's idMember field is cleared
		expect(await grid(page).evaluate((el: any) => 'id' in el.items[1])).toBe(false)

		await openToolbarOn(page, row(page, 3))
		await toolbar(page).locator('[data-action="add"]').click()
		await expect.poll(() => names(page)).toEqual(['Alpha', 'Alpha', 'Beta', 'Gamma', 'New', 'Delta'])

		await openToolbarOn(page, row(page, 2))
		await toolbar(page).locator('[data-action="move-down"]').click()
		await expect.poll(() => names(page)).toEqual(['Alpha', 'Alpha', 'Gamma', 'Beta', 'New', 'Delta'])
	})

	test('beforeActionCallback returning false cancels the event and the built-in', async ({ page }) => {
		await page.evaluate(() => { (window as any).__vetoBuiltIns = true })
		await openToolbarOn(page, row(page, 1))
		await toolbar(page).locator('[data-action="delete"]').click()
		await page.waitForTimeout(50)
		expect(await log(page)).toEqual(['before:delete:row-toolbar'])
		expect(await names(page)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta'])
	})
})

test.describe('cell context menu', () => {
	test('custom item: detail carries the cell; the menu closes', async ({ page }) => {
		await contextMenuOn(page, cell(page, 1, 1))
		await expect(menu(page)).toBeVisible()
		expect(await log(page)).toEqual(['menu-open:name:1'])
		await menu(page).locator('[data-id="rename"]').click()
		await expect.poll(() => log(page)).toEqual(['menu-open:name:1', 'before:custom:rename:context-menu', 'onClick:rename:Beta:name', 'onAction:custom', 'event:custom'])
		const [d] = await page.evaluate(() => (window as any).__details)
		expect(d.json).toMatchObject({ source: 'context-menu', field: 'name', colIndex: 1, rowIndex: 1, value: 'Beta' })
		await expect(menu(page)).toHaveCount(0)
	})

	test('labelled divider, built-in delete acts on the row', async ({ page }) => {
		await contextMenuOn(page, cell(page, 0, 1))
		await expect(menu(page).locator('.wg-context-menu__divider-label')).toHaveText('Rows')
		await menu(page).locator('[data-action="delete"]').click()
		await expect.poll(() => names(page)).toEqual(['Beta', 'Gamma', 'Delta'])
	})

	test('shouldCloseOnClick: false keeps the menu open', async ({ page }) => {
		await contextMenuOn(page, cell(page, 0, 1))
		await menu(page).locator('[data-id="keep"]').click()
		await expect.poll(() => log(page)).toContain('onClick:keep')
		await expect(menu(page)).toBeVisible()
	})

	test('getChildrenCallback loads a submenu lazily with the cell ctx', async ({ page }) => {
		await contextMenuOn(page, cell(page, 2, 1))
		await menu(page).locator('[data-id="more"]').hover()
		const sub = page.locator('.wg-context-menu--submenu')
		await expect(sub.locator('[data-id="lazy"]')).toHaveText('Lazy Gamma')
		await sub.locator('[data-id="lazy"]').click()
		await expect.poll(() => log(page)).toContain('onClick:lazy')
	})

	test('beforeContextMenuOpenCallback: false → no grid menu; an array → shown instead', async ({ page }) => {
		await page.evaluate(() => { (window as any).__menuMode = 'cancel' })
		await contextMenuOn(page, cell(page, 0, 1))
		await page.waitForTimeout(50)
		await expect(menu(page)).toHaveCount(0)

		await page.evaluate(() => { (window as any).__menuMode = 'replace' })
		await contextMenuOn(page, cell(page, 0, 1))
		await expect(menu(page).locator('.wg-context-menu__item')).toHaveCount(1)
		await expect(menu(page)).toContainText('Only item')
	})
})

test.describe('header context menu', () => {
	const header = (page: Page, field: string) => grid(page).locator(`thead th.wg__header[data-field="${field}"]`)

	test('built-in sort-asc sorts and fires data-request', async ({ page }) => {
		await contextMenuOn(page, header(page, 'qty'))
		expect(await log(page)).toEqual(['header-open:qty:2'])
		await menu(page).locator('[data-action="sort-asc"]').click()
		await expect.poll(() => log(page)).toContain('onDataRequest:sort:qty-asc')
		await expect.poll(() => log(page)).toContain('event:sort-asc')
		expect(await log(page)).toEqual(['header-open:qty:2', 'before:sort-asc:header-menu', 'onDataRequest:sort:qty-asc', 'onAction:sort-asc', 'event:sort-asc'])
	})

	test('a custom item with a built-in name as id runs only its onClick', async ({ page }) => {
		await contextMenuOn(page, header(page, 'name'))
		await menu(page).locator('[data-action="custom"][data-id="sort-asc"]').click()
		await expect.poll(() => log(page)).toContain('onClick:custom-sort-asc')
		expect(await grid(page).evaluate((el: any) => el.sort)).toEqual([])
	})

	test("a static submenu child's onClick runs", async ({ page }) => {
		await contextMenuOn(page, header(page, 'name'))
		await menu(page).locator('[data-id="sub"]').hover()
		await page.locator('.wg-context-menu--submenu [data-id="child"]').click()
		await expect.poll(() => log(page)).toContain('onClick:child')
	})
})

test.describe('shortcuts', () => {
	test('a row shortcut naming a built-in runs it (source: keyboard)', async ({ page }) => {
		await cell(page, 1, 1).click()
		await clearLog(page)
		await page.keyboard.press('Control+d')
		await expect.poll(() => names(page)).toEqual(['Alpha', 'Beta', 'Beta', 'Gamma', 'Delta'])
		expect(await log(page)).toEqual(['before:duplicate:keyboard', 'onAction:duplicate', 'event:duplicate'])
	})

	test('a custom row shortcut runs its onClick with the row', async ({ page }) => {
		await cell(page, 2, 1).click()
		await clearLog(page)
		await page.keyboard.press('Control+e')
		await expect.poll(() => log(page)).toEqual(['before:custom:export:keyboard', 'onClick:export:Gamma', 'onAction:custom', 'event:custom'])
	})

	test('a configured shortcut wins over a built-in key (F2 = start edit)', async ({ page }) => {
		await cell(page, 1, 1).click()
		await clearLog(page)
		await page.keyboard.press('F2')
		await expect.poll(() => log(page)).toEqual(['before:custom:f2:keyboard', 'onClick:f2:Beta', 'onAction:custom', 'event:custom'])
		await expect(grid(page).locator('.wg__cell--editing')).toHaveCount(0)
	})

	test('Ctrl+Delete fires row-delete (a request — the row stays)', async ({ page }) => {
		await cell(page, 0, 1).click()
		await clearLog(page)
		await page.keyboard.press('Control+Delete')
		await expect.poll(() => log(page)).toEqual(['onRowDelete:Alpha:false', 'row-delete:Alpha'])
		expect(await names(page)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta'])
	})
})

test.describe('contexts, twins, controller', () => {
	test('per-cell callbacks get one ctx with a non-enumerable controller + element', async ({ page }) => {
		const seen = await page.evaluate(() => (window as any).__cellCtx)
		expect(seen.hasController).toBe(true)
		expect(seen.elementIsHost).toBe(true)
		expect(seen.keys).toEqual(['row', 'rowIndex', 'column', 'colIndex', 'field', 'value'])
		await expect(cell(page, 2, 2)).toHaveClass(/qty-high/)
	})

	test('tree built-ins + expand-change on bulk operations', async ({ page }) => {
		await contextMenuOn(page, cell(page, 0, 0, tree(page)))
		await menu(page).locator('[data-action="collapse-tree"]').click()
		await expect.poll(() => log(page)).toContain('expand:null:false')
		await contextMenuOn(page, cell(page, 0, 0, tree(page)))
		await menu(page).locator('[data-action="expand-all"]').click()
		await expect.poll(() => log(page)).toContain('expand:1:true')
	})

	test('el.controller is the public facade; the engine is not el.grid', async ({ page }) => {
		const r = await grid(page).evaluate((el: any) => {
			el.controller.moveRow(el.items[0], 1)
			return {
				order: el.controller.getItems().map((x: any) => x.name),
				noGrid: typeof el.grid,
				sameController: el.controller === el.controller
			}
		})
		expect(r.order).toEqual(['Beta', 'Alpha', 'Gamma', 'Delta'])
		expect(r.noGrid).toBe('undefined')
		expect(r.sameController).toBe(true)
	})
})

// Open gaps listed in core docs/interaction-model-plan.md ("grid (from phase 5)").
// The lock-tooltip i18n gap lives in row-locking.spec.ts (NOTES.md #10).
test.describe('open gaps (interaction-model-plan follow-ups)', () => {
	test('a move-down built-in keeps keyboard focus on the moved row', async ({ page }) => {
		await cell(page, 1, 1).click()  // Beta, name column
		await expect(cell(page, 1, 1)).toBeFocused()
		await page.evaluate(() => {
			(document.getElementById('grid') as any).rowShortcuts = [{ shortcut: 'Alt+ArrowDown', action: 'move-down' }]
		})
		await cell(page, 1, 1).focus()
		await page.keyboard.press('Alt+ArrowDown')
		await expect.poll(() => names(page)).toEqual(['Alpha', 'Gamma', 'Beta', 'Delta'])
		await expect(cell(page, 2, 1)).toBeFocused({ timeout: 1500 })
		expect(await grid(page).evaluate((el: any) => el.engine.focusedCell)).toMatchObject({ rowIndex: 2, colIndex: 1 })
		// repeated: the same row keeps moving
		await page.keyboard.press('Alt+ArrowDown')
		await expect.poll(() => names(page)).toEqual(['Alpha', 'Gamma', 'Delta', 'Beta'])
		await expect(cell(page, 3, 1)).toBeFocused({ timeout: 1500 })
	})

	test('the shortcuts help lists the range shortcuts too', async ({ page }) => {
		await page.evaluate(() => {
			const g = document.getElementById('grid') as any
			g.rangeShortcuts = [{ id: 'sum', text: 'Sum selection', shortcut: 'Ctrl+Shift+S', onClick: () => {} }]
			g.isShortcutsHelpVisible = true
		})
		const help = grid(page).locator('.wg__shortcuts-help')
		await expect(help).toHaveCount(1)
		await expect(help).toContainText('Duplicate row')
		await expect(help).toContainText('Sum selection', { timeout: 1500 })
		await expect(help.locator('.wg__shortcuts-help-title').nth(1)).toHaveText('Selection shortcuts')
	})

	test('the shortcuts help shows with range shortcuts only', async ({ page }) => {
		await page.evaluate(() => {
			const g = document.getElementById('grid') as any
			g.rowShortcuts = []
			g.rangeShortcuts = [{ id: 'sum', text: 'Sum selection', shortcut: 'Ctrl+Shift+S', onClick: () => {} }]
			g.isShortcutsHelpVisible = true
		})
		const help = grid(page).locator('.wg__shortcuts-help')
		await expect(help).toContainText('Sum selection')
		await expect(help.locator('.wg__shortcuts-help-title')).toHaveCount(1)
	})
})

// Core #15: runAction runs the built-in BEFORE the `action` event — the event is a
// notification after the fact, so a listener sees the new `items`.
test.describe('action event after the built-in (listener sees the result)', () => {
	async function recordInAction(page: Page): Promise<void> {
		await page.evaluate(() => {
			const g = document.getElementById('grid') as any
			;(window as any).__seenInAction = []
			g.addEventListener('action', (e: CustomEvent) => {
				;(window as any).__seenInAction.push({ action: e.detail.action, names: g.items.map((r: any) => r.name) })
			})
		})
	}
	const seen = (page: Page) => page.evaluate(() => (window as any).__seenInAction)

	test('add: the new row is already in items', async ({ page }) => {
		await recordInAction(page)
		await openToolbarOn(page, row(page, 1))
		await toolbar(page).locator('[data-action="add"]').click()
		await expect.poll(() => seen(page)).toEqual([{ action: 'add', names: ['Alpha', 'Beta', 'New', 'Gamma', 'Delta'] }])
	})

	test('delete: items is already shorter', async ({ page }) => {
		await recordInAction(page)
		await openToolbarOn(page, row(page, 1))
		await toolbar(page).locator('[data-action="delete"]').click()
		await expect.poll(() => seen(page)).toEqual([{ action: 'delete', names: ['Alpha', 'Gamma', 'Delta'] }])
	})

	test('move-down / move-up: the new order is in place', async ({ page }) => {
		await recordInAction(page)
		await openToolbarOn(page, row(page, 1))
		await toolbar(page).locator('[data-action="move-down"]').click()
		await expect.poll(() => seen(page)).toEqual([{ action: 'move-down', names: ['Alpha', 'Gamma', 'Beta', 'Delta'] }])
		await openToolbarOn(page, row(page, 2))
		await toolbar(page).locator('[data-action="move-up"]').click()
		await expect.poll(() => seen(page)).toEqual([
			{ action: 'move-down', names: ['Alpha', 'Gamma', 'Beta', 'Delta'] },
			{ action: 'move-up', names: ['Alpha', 'Beta', 'Gamma', 'Delta'] }
		])
	})
})

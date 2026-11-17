import { test, expect, gridLocator, cell, readClipboard } from './fixtures'

/**
 * Core helpers the grid goes through (core-adoption pass, core 1.0.0-rc25): what the grid gets
 * from them that it didn't have before.
 *
 * The clipboard is an in-page stub (never the developer's real system clipboard).
 */

test.describe('copyText fallback (test/copy.html)', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			let text = ''
			Object.defineProperty(navigator, 'clipboard', {
				configurable: true,
				value: { writeText: () => Promise.reject(new Error('denied')), readText: async () => text }
			})
			document.execCommand = ((command: string) => {
				if (command !== 'copy') return false
				const area = document.activeElement as HTMLTextAreaElement
				text = area.value.slice(area.selectionStart, area.selectionEnd)
				return true
			}) as typeof document.execCommand
		})
		await page.goto('/test/copy.html')
		await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
	})

	test('a refused Clipboard API falls back to execCommand — Ctrl+C still copies', async ({ page }) => {
		await cell(page, 0, 1).click()
		await page.keyboard.press('Control+c')
		await expect.poll(() => readClipboard(page)).toBe('Apple')
	})

	// Core gap (reported for core rc25): copyText's textarea fallback puts focus back on
	// document.activeElement — the grid host — not on the focused cell inside its shadow root.
	test.fixme('after the fallback copy the focused cell keeps focus', async ({ page }) => {
		await cell(page, 0, 1).click()
		await page.keyboard.press('Control+c')
		await expect.poll(() => readClipboard(page)).toBe('Apple')
		await expect(cell(page, 0, 1)).toBeFocused()
	})
})

test.describe('page-wide locale (test/datepicker.html)', () => {
	test('the date editor names months in window.components.locale', async ({ page }) => {
		await page.goto('/test/datepicker.html')
		await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
		await page.evaluate(() => { (window as unknown as { components: { locale: unknown } }).components.locale = { locale: 'de-DE' } })
		await cell(page, 0, 2).click()
		await page.keyboard.press('F2')
		await expect(page.locator('.wg-datepicker')).toContainText('Juni')
	})
})

test.describe('autocomplete search through createAsyncRunner (test/dropdowns.html)', () => {
	test('only the latest answer is shown; the replaced request is aborted', async ({ page }) => {
		await page.goto('/test/dropdowns.html')
		await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
		// The first term answers late (and would win a naive race); the second answers at once.
		await page.evaluate(() => {
			const grid = document.querySelector('web-grid') as unknown as { columns: Array<Record<string, any>> }
			const w = window as unknown as { __aborted: string[] }
			w.__aborted = []
			grid.columns = grid.columns.map((c) => c.field !== 'assignee' ? c : {
				...c,
				editorOptions: {
					...c.editorOptions,
					debounceMs: 0,
					searchCallback: ({ term, signal }: { term: string; signal: AbortSignal }) => {
						signal.addEventListener('abort', () => w.__aborted.push(term))
						const delay = term === 'x' ? 600 : 10
						return new Promise((r) => setTimeout(() => r([{ value: `${term}-result`, label: `${term}-result` }]), delay))
					}
				}
			})
		})
		await cell(page, 0, 4).click()
		await page.keyboard.press('F2')
		const input = cell(page, 0, 4).locator('.wg__autocomplete-input')
		await input.pressSequentially('xy', { delay: 50 })
		const options = gridLocator(page).locator('.wg__dropdown .wg__dropdown-option')
		await expect(options.filter({ hasText: 'xy-result' })).toBeVisible()
		await page.waitForTimeout(800) // the late 'x' answer arrives — and is dropped
		await expect(options.filter({ hasText: 'x-result' }).filter({ hasNotText: 'xy' })).toHaveCount(0)
		expect(await page.evaluate(() => (window as unknown as { __aborted: string[] }).__aborted)).toContain('x')
	})
})

test.describe('shortcuts through core /actions (test/shortcuts.html)', () => {
	test('Mod+… is Ctrl off Apple; the help shows core-formatted keys', async ({ page }) => {
		await page.goto('/test/shortcuts.html')
		await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
		await page.evaluate(() => {
			const grid = document.querySelector('web-grid') as unknown as { rowShortcuts: unknown[] }
			const w = window as unknown as { __hits: number[] }
			w.__hits = []
			grid.rowShortcuts = [{ shortcut: 'Mod+Shift+Delete', id: 'x', text: 'Mod row', onClick: (ctx: { rowIndex: number }) => w.__hits.push(ctx.rowIndex) }]
		})
		await expect(gridLocator(page).locator('.wg__shortcuts-help-key')).toHaveText('Ctrl+Shift+Del')
		await cell(page, 1, 1).click()
		await page.keyboard.press('Control+Shift+Delete')
		await expect.poll(() => page.evaluate(() => (window as unknown as { __hits: number[] }).__hits)).toEqual([1])
	})
})

test.describe('icons through core renderIcon (test/edit-modes.html)', () => {
	test('editButtonIcon: a token name is a masked glyph, markup is raw, anything else is text', async ({ page }) => {
		await page.goto('/test/edit-modes.html')
		await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
		const btn = cell(page, 0, 0).locator('.wg__edit-button')
		const set = (icon: string) => page.evaluate((i) => {
			const grid = document.querySelector('web-grid') as unknown as { editTrigger: string; editButtonIcon: string }
			grid.editTrigger = 'button'
			grid.editButtonIcon = i
		}, icon)
		await set('pencil')
		await expect(btn.locator('.km-icon.wg__icon--pencil')).toHaveCount(1)
		await set('<i class="my-icon"></i>')
		await expect(btn.locator('i.my-icon')).toHaveCount(1)
		await set('✎ <b>')
		await expect(btn).toHaveText('✎ <b>')
	})
})

test.describe('render callbacks through core renderSlotHtml (test/basic.html)', () => {
	test('renderCellCallback: a string is HTML, null = the built-in (escaped) text, false = empty, a node is serialized', async ({ page }) => {
		await page.goto('/test/basic.html')
		await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
		await page.evaluate(() => {
			const grid = document.querySelector('web-grid') as unknown as { columns: Array<Record<string, any>>; items: Array<Record<string, any>> }
			grid.items = grid.items.map((r, i) => i === 1 ? { ...r, name: '<i>raw</i>' } : r)
			grid.columns = grid.columns.map((c) => c.field !== 'name' ? c : {
				...c,
				renderCellCallback: ({ rowIndex, value }: { rowIndex: number; value: unknown }) => {
					if (rowIndex === 0) return `<b class="custom">${String(value).toUpperCase()}</b>`
					if (rowIndex === 1) return null
					if (rowIndex === 2) return false
					const el = document.createElement('em')
					el.className = 'from-node'
					el.textContent = String(value)
					return el
				}
			})
		})
		await expect(cell(page, 0, 1).locator('b.custom')).toHaveCount(1)
		await expect(cell(page, 1, 1)).toHaveText('<i>raw</i>') // the built-in display, escaped
		await expect(cell(page, 2, 1)).toHaveText('')
		await expect(cell(page, 3, 1).locator('em.from-node')).toHaveCount(1)
	})
})

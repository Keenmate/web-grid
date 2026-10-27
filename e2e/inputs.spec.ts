import { test, expect, type Page } from './fixtures'

/**
 * Inputs go through core's property path (no grid-side proxies):
 *   - `preset` is a preset via core `getBatchValuesCallback` — it also sets the
 *     editing flags + cellSelectionMode in the same batch; inputs set explicitly
 *     in that batch win, whatever the order
 *   - property reads are synchronous; engine-derived getters / methods /
 *     `el.controller` flush pending writes, so derived state is current right
 *     after a write (the internal `el.engine` is fed on the flush)
 *   - invalid property values are rejected (warned, previous value kept)
 *   - UI-driven input changes (page-size selector) update the element property
 *
 * Fixture: docs/test/inputs.html (module only) — grids are created on the fly.
 */

const PAGE = '/test/inputs.html'

const ITEMS = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }))
const COLUMNS = [{ field: 'id', title: 'ID' }, { field: 'name', title: 'Name' }]

/** Create a fresh `<web-grid id="t">` from markup in a host div. */
async function mount(page: Page, attrs: string): Promise<void> {
	await page.evaluate(({ attrs, items, columns }) => {
		document.getElementById('t-host')?.remove()
		const host = document.createElement('div')
		host.id = 't-host'
		host.innerHTML = `<web-grid id="t" ${attrs}></web-grid>`
		const el = host.firstElementChild as any
		el.columns = columns
		el.items = items
		document.body.appendChild(host)
	}, { attrs, items: ITEMS, columns: COLUMNS })
}

const read = <R>(page: Page, fn: (el: any) => R) =>
	page.evaluate(`(${fn.toString()})(document.getElementById('t'))`) as Promise<R>

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await page.waitForFunction(() => !!customElements.get('web-grid'))
})

test.describe('preset (core getBatchValuesCallback)', () => {
	test('markup: an explicit attribute wins over the preset, the rest of the preset applies', async ({ page }) => {
		await mount(page, 'preset="input-matrix" edit-trigger="click"')
		expect(await read(page, el => [el.editTrigger, el.isEditable, el.cellSelectionMode, el.shouldOpenDropdownOnFocus]))
			.toEqual(['click', true, 'shift', true])
		expect(await read(page, el => [el.engine.editTrigger, el.engine.cellSelectionMode])).toEqual(['click', 'shift'])
	})

	test('markup: the same result with the attributes in reverse order', async ({ page }) => {
		await mount(page, 'edit-trigger="click" preset="input-matrix"')
		expect(await read(page, el => [el.editTrigger, el.isEditable, el.cellSelectionMode]))
			.toEqual(['click', true, 'shift'])
		expect(await read(page, el => [el.engine.editTrigger, el.engine.cellSelectionMode])).toEqual(['click', 'shift'])
	})

	test('property: the preset is readable synchronously, on the element and the engine', async ({ page }) => {
		await mount(page, '')
		expect(await read(page, el => {
			el.preset = 'input-matrix'
			const sync = [el.editTrigger, el.cellSelectionMode]
			el.flush() // the engine (internal) is fed on the flush
			return [...sync, el.engine.editTrigger, el.engine.cellSelectionMode]
		})).toEqual(['always', 'shift', 'always', 'shift'])
	})

	test('property: an explicit write in the same tick wins, whatever the order', async ({ page }) => {
		await mount(page, '')
		expect(await read(page, el => {
			el.editTrigger = 'click'
			el.preset = 'excel'
			el.flush()
			return [el.editTrigger, el.engine.editTrigger, el.engine.isEditable]
		})).toEqual(['click', 'click', true])
	})

	test('across ticks the last write wins', async ({ page }) => {
		await mount(page, 'edit-trigger="click"')
		expect(await read(page, el => {
			el.preset = 'excel'
			el.flush()
			return [el.editTrigger, el.engine.editTrigger]
		})).toEqual(['navigate', 'navigate'])
	})
})

test.describe('property path', () => {
	test('engine-derived state is current right after a write', async ({ page }) => {
		await mount(page, 'pageable page-size="10"')
		expect(await read(page, el => {
			el.pageSize = 25
			return [el.totalPages, el.displayItems.length]
		})).toEqual([4, 25])
	})

	test('an invalid value is rejected and the previous value kept', async ({ page }) => {
		await mount(page, 'pageable')
		const warnings: string[] = []
		page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()) })
		expect(await read(page, el => {
			el.pageSize = 34
			el.pageSize = null
			el.pageSize = 0
			el.preset = 'bogus'
			return [el.pageSize, el.totalPages, el.engine.pageSize, el.preset]
		})).toEqual([34, 3, 34, 'excel'])
		expect(warnings.filter(w => w.includes('rejected invalid value'))).toHaveLength(3)
	})

	test('the page-size selector updates the element property', async ({ page }) => {
		await mount(page, 'pageable page-size="10"')
		const select = page.locator('web-grid#t .wg__pagination-select')
		await select.selectOption('25')
		expect(await read(page, el => [el.pageSize, el.engine.pageSize, el.totalPages])).toEqual([25, 25, 4])
	})
})

// =============================================================================
// Table-driven: every input in GridElement.inputs (attribute → property →
// removal → default, and property writes). Samples are derived from the input's
// default / converter so new inputs are covered automatically.
// =============================================================================

test.describe('every input (table-driven)', () => {
	test('attribute → property, removal → default, property write → read-back', async ({ page }) => {
		await mount(page, '')
		const results = await page.evaluate(() => {
			const SPECIAL: Record<string, [string, unknown]> = {
				isPaginationShown: ['auto', 'auto'],
				paginationLayout: ['previous|next', 'previous|next'],
				paginationPosition: ['top-left', 'top-left'],
				scrollMaxHeight: ['300px', '300px'],
				columnMinWidth: ['50px', '50px'],
				summaryPosition: ['top-left', 'top-left'],
				cellToolbarOffset: ['0.5', 0.5],
				inlineActionsTitle: ['Ops', 'Ops'],
				editButtonIcon: ['<b>E</b>', '<b>E</b>'],
				newRowIndicator: ['*', '*'],
				treeExpandedGlyph: ['-', '-'],
				treeCollapsedGlyph: ['+', '+']
			}
			const sample = (d: any): [string, unknown] | null => {
				if (SPECIAL[d.configKey]) return SPECIAL[d.configKey]
				const values = d.converter.values as string[] | undefined
				if (values) {
					const v = values.find(x => x !== d.default)!
					return [v, v]
				}
				if (typeof d.default === 'boolean') return d.default ? ['false', false] : ['', true]
				if (typeof d.default === 'number') return [String(d.default + 3), d.default + 3]
				return null
			}
			const el = document.getElementById('t') as any
			const out: any[] = []
			for (const d of (customElements.get('web-grid') as any).inputs) {
				const s = sample(d)
				if (!s) { out.push({ key: d.configKey, skipped: true }); continue }
				const [raw, parsed] = s
				el.setAttribute(d.attribute, raw)
				el.flush()
				const afterAttr = el[d.configKey]
				el.removeAttribute(d.attribute)
				el.flush()
				const afterRemove = el[d.configKey]
				el[d.configKey] = parsed
				el.flush()
				const afterProp = el[d.configKey]
				el[d.configKey] = d.default
				el.flush()
				out.push({ key: d.configKey, parsed, afterAttr, def: d.default, afterRemove, afterProp })
			}
			return out
		})
		expect(results.filter((r: any) => r.skipped)).toEqual([])
		for (const r of results) {
			expect.soft(r.afterAttr, `${r.key}: attribute → property`).toEqual(r.parsed)
			// nullable text inputs (default undefined) come back as null after removal —
			// both mean "unset", so compare them loosely
			expect.soft(r.afterRemove ?? undefined, `${r.key}: removal → default`).toEqual(r.def ?? undefined)
			expect.soft(r.afterProp, `${r.key}: property write → read-back`).toEqual(r.parsed)
		}
		expect(results.length).toBeGreaterThan(55)
	})

	test('every enum input rejects an unknown attribute value (previous value kept)', async ({ page }) => {
		await mount(page, '')
		const results = await page.evaluate(() => {
			const el = document.getElementById('t') as any
			return (customElements.get('web-grid') as any).inputs
				.filter((d: any) => d.converter.values)
				.map((d: any) => {
					el.setAttribute(d.attribute, 'definitely-not-valid')
					el.flush()
					const v = el[d.configKey]
					el.removeAttribute(d.attribute)
					el.flush()
					return { key: d.configKey, v, def: d.default }
				})
		})
		for (const r of results) expect.soft(r.v, `${r.key}: invalid attribute`).toEqual(r.def)
	})
})

test.describe('readonly / disabled (C5)', () => {
	test('readonly: nothing is editable, the grid stays focusable', async ({ page }) => {
		await mount(page, 'editable')
		expect(await read(page, el => el.canEditCell(0, 'name'))).toBe(true)
		await page.evaluate(() => { (document.getElementById('t') as any).setAttribute('readonly', '') })
		expect(await read(page, el => [el.isReadonly, el.canEditCell(0, 'name')])).toEqual([true, false])
		const cell = page.locator('web-grid#t .wg__cell[data-row="0"][data-col="1"]')
		await cell.click()
		await expect(cell).toHaveClass(/wg__cell--focused/)
		await page.keyboard.press('F2')
		await expect(cell.locator('input')).toHaveCount(0)
		await page.evaluate(() => { (document.getElementById('t') as any).removeAttribute('readonly') })
		expect(await read(page, el => [el.isReadonly, el.canEditCell(0, 'name')])).toEqual([false, true])
	})

	test('disabled: the container is inert and dimmed; removing it restores interaction', async ({ page }) => {
		await mount(page, 'disabled')
		const container = page.locator('web-grid#t .wg')
		await expect(container).toHaveAttribute('inert', '')
		await expect(container).toHaveClass(/wg--disabled/)
		await page.evaluate(() => { (document.getElementById('t') as any).isDisabled = false })
		await expect(container).not.toHaveAttribute('inert', '')
		await expect(container).not.toHaveClass(/wg--disabled/)
	})
})

test.describe('defer / release / ready (core)', () => {
	test('defer holds the first render until release(); then ready fires once', async ({ page }) => {
		await mount(page, 'defer')
		expect(await read(page, el => [el.isReady, !!el.shadowRoot.querySelector('.wg__table'), el.hasAttribute('ready')]))
			.toEqual([false, false, false])
		const result = await read(page, el => {
			let readyCount = 0
			el.addEventListener('ready', () => { readyCount++ })
			el.items = el.items.slice(0, 5)
			el.release()
			return [readyCount, el.isReady, el.shadowRoot.querySelectorAll('tbody tr').length, el.hasAttribute('ready')]
		})
		expect(result).toEqual([1, true, 5, true])
	})
})

// =============================================================================
// The `locale` input (rulebook C-CA-38): BCP-47 locale for the numbers in labels
// (`{count}` items, page info, …) and the date picker's month / weekday names;
// unset = the page-wide `window.components.locale`, else the browser.
// =============================================================================

import { describe, it, expect, afterEach, vi } from 'vitest'
import './index.js'
import { renderNumberEditor } from './modules/editing/renderers.js'
import { GRID_ENGINE } from './modules/grid-context.js'

const items = Array.from({ length: 1234 }, (_, i) => ({ id: i, name: `Row ${i}` }))
const columns = [{ field: 'name', title: 'Name' }]

let el: any
afterEach(() => {
	el?.remove()
	el = undefined
	;(window as any).components.locale = null
})

async function mount(attrs: Record<string, string> = {}) {
	el = document.createElement('web-grid')
	el.setAttribute('enable-paging', '')
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
	el.columns = columns
	el.items = items
	document.body.appendChild(el)
	await el.whenReady()
	await el.whenSettled()
	return el
}

const countText = () => el.shadowRoot.querySelector('.wg__pagination-count')?.textContent?.trim()

describe('web-grid locale input', () => {
	it('input row: attribute `locale`, nullable text, unset by default', async () => {
		await mount()
		expect(el.locale).toBeNull()
		el.setAttribute('locale', 'cs')
		await el.whenSettled()
		expect(el.locale).toBe('cs')
	})

	it('locale="de" formats the numbers in labels (1234 → 1.234)', async () => {
		await mount({ locale: 'de' })
		expect(countText()).toBe('1.234 items')
		expect(el[GRID_ENGINE].labelText('errors.numberMax', { max: 5000 })).toBe('Must be at most 5.000')
	})

	it('a locale change re-renders the pager (update path)', async () => {
		await mount({ locale: 'en' })
		expect(countText()).toBe('1,234 items')
		el.locale = 'de'
		await el.whenSettled()
		expect(countText()).toBe('1.234 items')
	})

	it('unset follows window.components.locale.locale; the instance wins', async () => {
		;(window as any).components.locale = { locale: 'de' }
		await mount()
		expect(countText()).toBe('1.234 items')
		el.locale = 'en'
		await el.whenSettled()
		expect(countText()).toBe('1,234 items')
	})

	it("'auto' = unset (core resolveLocale)", async () => {
		;(window as any).components.locale = { locale: 'de' }
		await mount({ locale: 'auto' })
		expect(countText()).toBe('1.234 items')
	})
})

// =============================================================================
// Number columns follow the locale, Excel-style (2026-11-21): display with the
// locale's separators + grouping (`decimalPlaces` digits), the editor opens with
// the locale decimal separator and no grouping, typed / pasted text parses with
// the locale, copy = the displayed text. The stored value stays a number.
// =============================================================================

describe('web-grid number columns by locale', () => {
	const NBSP = ' '
	const numberColumns = [{ field: 'amount', title: 'Amount', editor: 'number', editorOptions: { decimalPlaces: 2 } }]

	async function mountNumbers(attrs: Record<string, string> = {}, extra: Record<string, unknown> = {}) {
		el = document.createElement('web-grid')
		for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
		el.columns = [{ ...numberColumns[0], ...extra }]
		el.items = [{ id: 1, amount: 1234.5 }]
		document.body.appendChild(el)
		await el.whenReady()
		await el.whenSettled()
		return el
	}
	const cellText = () => el.shadowRoot.querySelector('td[data-field="amount"]')?.textContent?.trim()
	/** The draft-aware value (a commit lands in the row's draft, `el.items` stays untouched). */
	const amount = () => el[GRID_ENGINE].getCellRawValue(el[GRID_ENGINE].displayItems[0], 0, 'amount')
	const copyText = () => el[GRID_ENGINE].clipboardCellText(el[GRID_ENGINE].displayItems[0], 0, el[GRID_ENGINE].columns[0])
	const editorText = async () => {
		const box = document.createElement('div')
		box.innerHTML = renderNumberEditor(el, 0, 'amount', el.items[0].amount, el[GRID_ENGINE].columns[0])
		return (box.querySelector('input') as HTMLInputElement).value
	}

	it.each([
		['en-US', '1,234.50', '1234.50'],
		['de', '1.234,50', '1234,50'],
		['cs', `1${NBSP}234,50`, '1234,50'],
	])('%s: display %s, copy = display, editor opens with %s', async (locale, display, editor) => {
		await mountNumbers({ locale })
		expect(cellText()).toBe(display)
		expect(copyText()).toBe(display)
		expect(await editorText()).toBe(editor)
	})

	it.each([
		['en-US', '9,876.5'],
		['de', '9.876,5'],
		['cs', '9 876,5'],
	])('%s: typed text commits as a number (%s → 9876.5)', async (locale, typed) => {
		await mountNumbers({ locale })
		el[GRID_ENGINE].startEdit(0, 'amount')
		await el[GRID_ENGINE].commitEdit(0, 'amount', typed)
		await el.whenSettled()
		expect(amount()).toBe(9876.5)
	})

	it('invalid text stays strict (12abc → invalid, kept as typed)', async () => {
		await mountNumbers({ locale: 'de' })
		el[GRID_ENGINE].startEdit(0, 'amount')
		await el[GRID_ENGINE].commitEdit(0, 'amount', '12abc')
		await el.whenSettled()
		expect(el[GRID_ENGINE].isCellInvalid(0, 'amount')).toBe(true)
		expect(el.items[0].amount).toBe(1234.5)
	})

	it('no decimalPlaces: the value as-is (no rounding to 3 digits)', async () => {
		await mountNumbers({ locale: 'de' }, { editorOptions: {} })
		el.items = [{ id: 1, amount: 1234.56789 }]
		await el.whenSettled()
		expect(cellText()).toBe('1.234,56789')
	})

	it('a locale change and a page-wide locale change re-render the cells', async () => {
		await mountNumbers()
		expect(cellText()).toBe('1,234.50')
		el.locale = 'de'
		await el.whenSettled()
		expect(cellText()).toBe('1.234,50')
		el.locale = null
		;(window as any).components.locale = { locale: 'cs' }
		await el.whenSettled()
		expect(cellText()).toBe(`1${NBSP}234,50`)
	})

	it('page-wide decimalSeparator / thousandsSeparator override the locale', async () => {
		;(window as any).components.locale = { decimalSeparator: ',', thousandsSeparator: "'" }
		await mountNumbers({ locale: 'en-US' })
		expect(cellText()).toBe("1'234,50")
		expect(await editorText()).toBe('1234,50')
	})

	it('getDisplayValueCallback still wins over the locale display', async () => {
		await mountNumbers({ locale: 'de' }, { getDisplayValueCallback: ({ value }: any) => `${value} EUR` })
		expect(cellText()).toBe('1234.5 EUR')
	})

	it("'1.5' typed in a de grid is an invalid number (never a silent 15)", async () => {
		await mountNumbers({ locale: 'de' })
		el[GRID_ENGINE].startEdit(0, 'amount')
		await el[GRID_ENGINE].commitEdit(0, 'amount', '1.5')
		await el.whenSettled()
		expect(el[GRID_ENGINE].isCellInvalid(0, 'amount')).toBe(true)
		expect(el.items[0].amount).toBe(1234.5)
	})

	it('parseNumberCallback: the element wins over the page-wide one; undefined = the next rule', async () => {
		const seen: any[] = []
		;(window as any).components.locale = { parseNumberCallback: () => 2 }
		await mountNumbers({ locale: 'de' })
		el.parseNumberCallback = (ctx: any) => { seen.push(ctx); return ctx.text === 'seven' ? 7 : undefined }
		await el.whenSettled()
		el[GRID_ENGINE].startEdit(0, 'amount')
		await el[GRID_ENGINE].commitEdit(0, 'amount', 'seven')
		await el.whenSettled()
		expect(amount()).toBe(7)
		expect(seen[0]).toMatchObject({ text: 'seven', locale: 'de', decimalSeparator: ',' })
		// The element's callback answers undefined → the page-wide one decides
		el[GRID_ENGINE].startEdit(0, 'amount')
		await el[GRID_ENGINE].commitEdit(0, 'amount', 'other')
		await el.whenSettled()
		expect(amount()).toBe(2)
		// Pasted text goes through the same chain
		expect(el[GRID_ENGINE].numberParseOptions.source).toBe(el)
	})

	it('parseNumberCallback returning null marks the cell invalid', async () => {
		await mountNumbers({ locale: 'en-US' })
		el.parseNumberCallback = () => null
		await el.whenSettled()
		el[GRID_ENGINE].startEdit(0, 'amount')
		await el[GRID_ENGINE].commitEdit(0, 'amount', '5')
		await el.whenSettled()
		expect(el[GRID_ENGINE].isCellInvalid(0, 'amount')).toBe(true)
	})

	it('copy = what the cell shows: getDisplayValueCallback text, single-cell and range copy', async () => {
		const writeText = vi.fn(() => Promise.resolve())
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
		try {
			await mountNumbers({ locale: 'de' }, { getDisplayValueCallback: ({ value }: any) => `${value} EUR` })
			expect(copyText()).toBe('1234.5 EUR')
			el[GRID_ENGINE].selectCellRange({ startRowIndex: 0, startColIndex: 0, endRowIndex: 0, endColIndex: 0 })
			expect(await el[GRID_ENGINE].copyCellSelectionToClipboard()).toBe(true)
			expect(writeText).toHaveBeenLastCalledWith('1234.5 EUR')
		} finally {
			delete (navigator as any).clipboard
		}
	})

	it('getCopyValueCallback wins over the display text, in range copy too', async () => {
		const writeText = vi.fn(() => Promise.resolve())
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
		try {
			await mountNumbers({ locale: 'de' }, { getDisplayValueCallback: () => 'shown', getCopyValueCallback: ({ value }: any) => `raw:${value}` })
			expect(copyText()).toBe('raw:1234.5')
			el[GRID_ENGINE].selectCellRange({ startRowIndex: 0, startColIndex: 0, endRowIndex: 0, endColIndex: 0 })
			await el[GRID_ENGINE].copyCellSelectionToClipboard()
			expect(writeText).toHaveBeenLastCalledWith('raw:1234.5')
		} finally {
			delete (navigator as any).clipboard
		}
	})
})

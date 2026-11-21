// =============================================================================
// The `locale` input (rulebook C-CA-38): BCP-47 locale for the numbers in labels
// (`{count}` items, page info, …) and the date picker's month / weekday names;
// unset = the page-wide `window.components.locale`, else the browser.
// =============================================================================

import { describe, it, expect, afterEach } from 'vitest'
import './index.js'

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
		expect(el.engine.labelText('errors.numberMax', { max: 5000 })).toBe('Must be at most 5.000')
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

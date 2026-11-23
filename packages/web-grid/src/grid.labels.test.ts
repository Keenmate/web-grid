// =============================================================================
// The engine on its own (no element — GridLabelsResolver host-less): core
// createLabels(null, …, { tag: 'web-grid' }) — same chain and escaping as with the element.
// =============================================================================

import { describe, it, expect, afterEach } from 'vitest'
import { GridEngine } from './grid.js'

afterEach(() => {
	;(window as any).components = (window as any).components ?? {}
	;(window as any).components.locale = null
	;(window as any).components.security = null
})

describe('GridEngine labels without a host', () => {
	it('instance labels → page-wide dictionary (web-grid.*) → English', () => {
		const r = new GridEngine()
		expect(r.labelText('menuItems.deleteRow')).toBe('Delete row')
		;(window as any).components.locale = { labels: { 'web-grid.menuItems.deleteRow': 'Smazat řádek' } }
		expect(r.labelText('menuItems.deleteRow')).toBe('Smazat řádek')
		r.labels = { 'menuItems.deleteRow': 'Pryč' }
		expect(r.labelText('menuItems.deleteRow')).toBe('Pryč')
	})

	it('html(): template markup kept, {ctx.*} params escaped; shouldEscapeLabels escapes all', () => {
		const r = new GridEngine()
		r.labels = { 'labels.pageInfo': '<b>{ctx.currentPage}</b>' }
		expect(r.labelHtml('labels.pageInfo', { ctx: { currentPage: '<i>2</i>' } })).toBe('<b>&lt;i&gt;2&lt;/i&gt;</b>')
		;(window as any).components.security = { shouldEscapeLabels: true }
		expect(r.labelHtml('labels.pageInfo', { ctx: { currentPage: 2 } })).toBe('&lt;b&gt;2&lt;/b&gt;')
	})
})

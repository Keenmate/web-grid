// =============================================================================
// Persisted UI state (core createStateStore(), SPEC §12.17 / rulebook C-CA-17):
// storage-key + persist-column-widths / persist-column-order, the default
// localStorage store `km-state:web-grid:<key>`, the load / save callbacks
// (whole state), orphan pruning and the "wait for columns" load.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './index.js'

const columns = () => [
	{ field: 'name', title: 'Name' },
	{ field: 'qty', title: 'Qty' }
]
const tick = () => new Promise((r) => setTimeout(r, 0))

let el: any
beforeEach(() => localStorage.clear())
afterEach(() => { el?.remove(); el = undefined })

async function mount(attrs: Record<string, string>, props: Record<string, unknown> = {}) {
	el = document.createElement('web-grid')
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
	Object.assign(el, props)
	document.body.appendChild(el)
	await el.whenReady()
	await tick()
	return el
}

describe('web-grid persisted column state', () => {
	it('input rows: storage-key / persist-column-widths / persist-column-order', async () => {
		await mount({ 'storage-key': 'g1', 'persist-column-widths': '', 'persist-column-order': '' }, { columns: columns() })
		expect(el.storageKey).toBe('g1')
		expect(el.shouldPersistColumnWidths).toBe(true)
		expect(el.shouldPersistColumnOrder).toBe(true)
		expect('gridName' in el).toBe(false)
	})

	it('setColumnWidths saves to localStorage km-state:web-grid:<key>; a new grid loads it', async () => {
		await mount({ 'storage-key': 'g2', 'persist-column-widths': '' }, { columns: columns() })
		el.engine.setColumnWidths([{ field: 'name', width: '210px' }])
		await tick()
		const saved = JSON.parse(localStorage.getItem('km-state:web-grid:g2')!)
		expect(saved.columnWidths).toContainEqual({ field: 'name', width: '210px' })
		el.remove()
		await mount({ 'storage-key': 'g2', 'persist-column-widths': '' }, { columns: columns() })
		expect(el.engine._columnWidths.get('name')).toBe('210px')
	})

	it('no storage-key: nothing is stored', async () => {
		await mount({ 'persist-column-widths': '' }, { columns: columns() })
		el.engine.setColumnWidths([{ field: 'name', width: '210px' }])
		await tick()
		expect(localStorage.length).toBe(0)
	})

	it('callbacks replace localStorage: load gets { key }, save gets { key, state } = the WHOLE state', async () => {
		const loads: any[] = []
		const saves: any[] = []
		await mount({ 'storage-key': 'cb', 'persist-column-widths': '' }, {
			columns: columns(),
			loadStateCallback: (ctx: any) => { loads.push(ctx); return { columnWidths: [{ field: 'qty', width: '90px' }], columnOrder: [{ field: 'name', order: 1 }] } },
			saveStateCallback: (ctx: any) => { saves.push(ctx) },
		})
		expect(loads[0].key).toBe('cb')
		expect(loads[0].element).toBe(el)
		expect(el.engine._columnWidths.get('qty')).toBe('90px')
		el.engine.setColumnWidths([{ field: 'name', width: '120px' }])
		await tick()
		const last = saves.at(-1)
		expect(last.key).toBe('cb')
		expect(last.state.columnOrder).toEqual([{ field: 'name', order: 1 }])  // kept: the whole state
		expect(last.state.columnWidths).toContainEqual({ field: 'name', width: '120px' })
		expect(localStorage.length).toBe(0)
	})

	it('orphaned entries are pruned and saved back; the load waits for columns', async () => {
		localStorage.setItem('km-state:web-grid:orph', JSON.stringify({ columnWidths: [{ field: 'name', width: '150px' }, { field: 'gone', width: '50px' }] }))
		await mount({ 'storage-key': 'orph', 'persist-column-widths': '' })
		// no columns yet: nothing pruned
		expect(JSON.parse(localStorage.getItem('km-state:web-grid:orph')!).columnWidths).toHaveLength(2)
		el.columns = columns()
		await tick()
		expect(el.engine._columnWidths.get('name')).toBe('150px')
		expect(JSON.parse(localStorage.getItem('km-state:web-grid:orph')!).columnWidths).toEqual([{ field: 'name', width: '150px' }])
	})
})

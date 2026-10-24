/*
 * Shared event-log helper for e2e fixture pages.
 *
 * installEventLog(grid, area, names) — for every event name, listens on the grid
 * AND wires the camelCase `on*` twin; appends `type:<json detail>` lines to
 * `<pre data-testid="<area>-log">` (created if missing) and pushes
 * `{ type, via: 'event' | 'twin', detail }` to `window.__events`.
 *
 * JSON.stringify skips the non-enumerable `controller` / `element` context keys;
 * the raw detail objects stay in `window.__events` for identity checks.
 */
const ALL_EVENTS = [
	'row-change', 'edit-start', 'edit-cancel', 'validation-error', 'row-focus', 'row-delete',
	'cell-selection-change', 'data-request', 'filter-change', 'column-resize', 'column-reorder',
	'expand-change', 'row-lock-change', 'paste-complete', 'action'
]

const camel = (name) => 'on' + name.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())

/** JSON-safe deep copy: drops functions / DOM nodes / events, Sets → arrays, true cycles → undefined. */
function toPlain(v, ancestors = []) {
	if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v
	if (v instanceof Event || v instanceof Node) return undefined
	if (ancestors.includes(v) || ancestors.length > 12) return undefined
	const next = [...ancestors, v]
	if (v instanceof Set || Array.isArray(v)) return [...v].map((x) => toPlain(x, next))
	if (v instanceof Map) return Object.fromEntries([...v].map(([k, x]) => [k, toPlain(x, next)]))
	const out = {}
	for (const k of Object.keys(v)) {
		const x = toPlain(v[k], next)
		if (x !== undefined) out[k] = x
	}
	return out
}

function safeJson(detail) {
	try {
		return JSON.stringify(toPlain(detail))
	} catch {
		return String(detail)
	}
}

export function installEventLog(grid, area, names = ALL_EVENTS) {
	window.__events = window.__events || []
	let pre = document.querySelector(`[data-testid="${area}-log"]`)
	if (!pre) {
		pre = document.createElement('pre')
		pre.dataset.testid = `${area}-log`
		document.body.appendChild(pre)
	}
	for (const name of names) {
		grid.addEventListener(name, (e) => {
			window.__events.push({ type: name, via: 'event', detail: e.detail, grid: grid.id })
			pre.textContent += `${name}:${safeJson(e.detail)}\n`
		})
		grid[camel(name)] = (detail) => {
			window.__events.push({ type: name, via: 'twin', detail, grid: grid.id })
		}
	}
}

export function clearEventLog(area) {
	window.__events = []
	const pre = document.querySelector(`[data-testid="${area}-log"]`)
	if (pre) pre.textContent = ''
}

window.clearEventLog = clearEventLog

/** `[{ type, via, detail }]` (JSON-safe) for the given event type, or all when omitted. */
window.__eventsJson = (type) => (window.__events || [])
	.filter((e) => !type || e.type === type)
	.map(({ type, via, detail, grid }) => ({ type, via, grid, detail: toPlain(detail) }))

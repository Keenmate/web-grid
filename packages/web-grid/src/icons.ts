// =============================================================================
// The grid's own icons — a name → icon table (core renderIcon `defaults`, SPEC §12.33)
// =============================================================================
// Every icon the grid draws is rendered by NAME through core `renderIcon(name, { prefix: 'wg',
// host, defaults: GRID_ICONS })` (menus: openMenu `iconDefaults: GRID_ICONS`), so an app swaps any
// of them through `el.icons` / `window.components.icons` ('web-grid.<name>' before '<name>') or a
// `renderIconCallback`. Order: markup → el.icons → page map → built-in name → element hook → page
// hook → this table → class list → text.
//
// `add` / `delete` are core built-in names: they draw the theme's `--base-icon-<name>` glyph (core carries the
// base-css-variables default when the page has none), so this table has no entry for them — it would never be
// reached. The tree items use their own names (`expand-node` / `collapse-node`) to keep the grid's ▾ / ▸.

import type { GridIconName } from './types.js'

const svg16 = (attrs: string, body: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" ${attrs}>${body}</svg>`

const CALENDAR = '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>'
const INFO = (size: number) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`

/** The grid's icons by name (see `GridIconName` for where each one shows). */
export const GRID_ICONS: Readonly<Record<Exclude<GridIconName, 'add' | 'delete'>, string>> = Object.freeze({
	// Row built-ins (row toolbar / inline row actions; `add` / `delete` = core built-in names)
	'duplicate': svg16('stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"', '<rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V4a1 1 0 011-1h7"/>'),
	'move-up': svg16('stroke-width="2" stroke-linecap="round" stroke-linejoin="round"', '<path d="M8 13V3M4 7l4-4 4 4"/>'),
	'move-down': svg16('stroke-width="2" stroke-linecap="round" stroke-linejoin="round"', '<path d="M8 3v10M4 9l4 4 4-4"/>'),
	// Cell menu — tree built-ins
	'expand-node': '▾',
	'collapse-node': '▸',
	'expand-subtree': '⇊',
	'collapse-subtree': '⇈',
	'expand-all': '⤓',
	'collapse-all': '⤒',
	// Header menu built-ins
	'sort-asc': '↑',
	'sort-desc': '↓',
	'clear-sort': '✕',
	'hide-column': '👁',
	'freeze-column': '❄',
	'unfreeze-column': '☀',
	'column-visibility': '👁',
	// Chrome
	'calendar': CALENDAR,
	'prev-month': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
	'next-month': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>',
	'shortcuts-help': INFO(16),
	'header-info': INFO(14)
})

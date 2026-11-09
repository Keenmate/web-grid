// =============================================================================
// Context Menu Module
// =============================================================================
// The cell and column-header menus are core `openMenu()`
// (web-components-core `/menu`): rendering, submenus (static `children` or a
// lazy `getChildrenCallback`), positioning, dismiss (outside press, scroll —
// of the page or a scroller around the opener once it has moved — core's
// shared scroll rule —, blur, another overlay) and
// the WAI-ARIA keyboard. The grid only builds the entries (built-in defaults,
// the `column-visibility` submenu via `prepareItemCallback`) and runs activations.
//
// The menu is appended to the grid's shadow root, so the `--wg-context-menu-*`
// → `--_km-menu-*` mapping on `:host` reaches it (css/variables.css). One menu
// is open per grid at a time (`host.menu`).

import { openMenu, type MenuPoint } from '@keenmate/web-components-core/menu'
import type { MenuEntry, MenuItem, ResolvedActionItem } from '@keenmate/web-components-core/actions'
import type { GridHost } from '../grid-context.js'

/** Which grid menu — its scoping class on every menu level (root and submenus). */
export type GridMenuKind = 'cell' | 'header'

const MENU_CLASS: Record<GridMenuKind, string> = {
	cell: 'wg-context-menu',
	header: 'wg-header-menu'
}

/** What a menu shows and how its items behave. */
export type GridMenuSpec<Ctx> = {
	kind: GridMenuKind
	entries: readonly (MenuEntry<Ctx, any> | string)[]
	ctx: Ctx
	/** A viewport point (pointer) or an element (keyboard-opened, below the cell). */
	at: MenuPoint | Element
	/** `contextMenuXOffset` / `contextMenuYOffset` (cell menu). */
	offset?: { x: number; y: number }
	/** Built-in defaults for an item (text / icon / visibility / disabled / danger / toggled). */
	defaults?: (item: MenuItem<Ctx, any>) => Partial<ResolvedActionItem<any>> | undefined
	/** Fill in built-in submenus (e.g. `column-visibility`) before resolving. */
	prepareItem?: (item: MenuItem<Ctx, any>) => MenuItem<Ctx, any>
	/** Run an activated leaf (beforeActionCallback → onClick → built-in → `action` event). */
	activate: (item: MenuItem<Ctx, any>, triggerElement: HTMLElement, event: Event) => unknown
	/** Where focus returns when the menu closes while holding it (Escape, an item ran). */
	returnFocusTo?: HTMLElement | null
	/** Focus the first item on open — the menu was opened from the keyboard. */
	shouldFocusFirst?: boolean
}

/**
 * Open a grid menu (closing the one already open). Returns `false` when no item
 * is visible — nothing is shown then.
 */
export function openGridMenu<T, Ctx>(host: GridHost<T>, spec: GridMenuSpec<Ctx>): boolean {
	closeGridMenu(host)
	const menu = openMenu(spec.entries, spec.ctx, {
		at: spec.at,
		host: host.shadow,
		cssClass: MENU_CLASS[spec.kind],
		offset: spec.offset ? { mainAxis: spec.offset.y, alignmentAxis: spec.offset.x } : undefined,
		defaults: spec.defaults,
		prepareItemCallback: spec.prepareItem,
		runAction: (item, { triggerElement, sourceEvent }) => spec.activate(item, triggerElement, sourceEvent),
		returnFocusTo: spec.returnFocusTo ?? null,
		shouldFocusFirst: spec.shouldFocusFirst,
		onClose: () => {
			if (host.menu === menu) host.menu = null
		}
	})
	if (!menu.isOpen) return false
	host.menu = menu
	return true
}

/** Close the grid's open menu, if any. */
export function closeGridMenu<T>(host: GridHost<T>): void {
	const menu = host.menu
	host.menu = null
	menu?.close()
}

/** Is `node` inside one of this grid's menu levels (root or submenu)? */
export function isInGridMenu<T>(host: GridHost<T>, node: Node | null): boolean {
	if (!node || !host.menu) return false
	const el = node.nodeType === 1 ? (node as Element) : node.parentElement
	return !!el && host.shadow.contains(el) && !!el.closest('.km-menu')
}

// Element handlers (extracted from GridElement)
export { handleContextMenu, handleHeaderContextMenu, handleFillerContextMenu, openCellMenuFromKeyboard } from './element-handlers.js'

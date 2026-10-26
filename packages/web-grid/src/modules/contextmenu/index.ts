// =============================================================================
// Context Menu Module
// =============================================================================
// One menu renderer for the cell, header and header-filler context menus.
// Entries are core menu items (web-components-core `/actions`): resolved with
// `resolveMenuEntries` (hidden items dropped, dividers trimmed), submenus from
// `children` / `getChildrenCallback` (`getMenuChildren` — lazy; a loading row
// shows while an async one resolves), activation through the surface's
// `activate` (core `runAction` order). A leaf closes the menu unless it sets
// `shouldCloseOnClick: false` — then its menu level re-renders in place (so a
// toggle shows its new state).

import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import {
	resolveMenuEntries,
	getMenuChildren,
	type MenuEntry,
	type MenuItem,
	type ResolvedActionItem
} from '@keenmate/web-components-core/actions'
import type { GridHost } from '../grid-context.js'

type AnyEntry = MenuEntry<any, any> | string
type EntriesSource = () => readonly AnyEntry[] | Promise<readonly AnyEntry[]>

/** What a menu shows and how its items behave. */
export type MenuSpec<Ctx> = {
	entries: readonly (MenuEntry<Ctx, any> | string)[]
	ctx: Ctx
	/** Built-in defaults for an item (text / icon / visibility / disabled / danger). */
	defaults?: (item: MenuItem<Ctx, any>) => Partial<ResolvedActionItem<any>> | undefined
	/** Fill in built-in submenus (e.g. `column-visibility`) before resolving. */
	prepare?: (item: MenuItem<Ctx, any>) => MenuItem<Ctx, any>
	/** Run an activated leaf (beforeActionCallback → onClick → built-in → `action` event). */
	activate: (item: MenuItem<Ctx, any>, triggerElement: HTMLElement, event: Event) => Promise<unknown> | void
}

type ItemRecord = { item: MenuItem<any, any>; isDisabled: boolean; hasChildren: boolean; shortcut?: string }

// Rendered item element → its item (click / keyboard lookup)
const itemOf = new WeakMap<HTMLElement, ItemRecord>()
// Rendered menu level → its entries (re-read to refresh after a keep-open item)
const levelOf = new WeakMap<HTMLElement, EntriesSource>()

// Context menu styles (injected into document.head)
const CONTEXT_MENU_STYLES = `
.wg-context-menu-container {
	position: fixed;
	z-index: var(--wg-cm-z-index, 10000);

	/* Colors */
	--wg-cm-background: var(--base-dropdown-bg, var(--base-main-bg, #fff));
	--wg-cm-border-color: var(--base-border-color, #e0e0e0);
	--wg-cm-text-color: var(--base-text-color-1, #1a1a1a);
	--wg-cm-text-secondary: var(--base-text-color-2, #666);
	--wg-cm-text-danger: var(--base-danger-color, #d32f2f);
	--wg-cm-hover-bg: var(--base-hover-bg, #f5f5f5);
	--wg-cm-toggled-color: var(--base-accent-color, var(--base-primary-color, #1a73e8));
	--wg-cm-disabled-opacity: 0.5;

	/* Typography */
	--wg-cm-font-family: var(--base-font-family, inherit);
	--wg-cm-font-size: 13px;

	/* Sizing */
	--wg-cm-padding: 4px;
	--wg-cm-item-padding: 8px 12px;
	--wg-cm-min-width: 160px;
	--wg-cm-border-radius: 4px;
	--wg-cm-icon-size: 16px;
	--wg-cm-icon-gap: 8px;

	/* Shadow */
	--wg-cm-shadow: var(--base-dropdown-box-shadow, 0 4px 16px var(--base-shadow-color, rgba(0, 0, 0, 0.15)));
}

.wg-context-menu {
	position: fixed;
	background: var(--wg-cm-background, #fff);
	border: 1px solid var(--wg-cm-border-color);
	border-radius: var(--wg-cm-border-radius);
	box-shadow: var(--wg-cm-shadow);
	padding: var(--wg-cm-padding) 0;
	min-width: var(--wg-cm-min-width);
	font-family: var(--wg-cm-font-family);
	font-size: var(--wg-cm-font-size);
	color: var(--wg-cm-text-color);
}

.wg-context-menu__item {
	display: flex;
	align-items: center;
	gap: var(--wg-cm-icon-gap);
	padding: var(--wg-cm-item-padding);
	cursor: pointer;
	white-space: nowrap;
}

.wg-context-menu__item:hover {
	background: var(--wg-cm-hover-bg);
}

.wg-context-menu__item--disabled {
	opacity: var(--wg-cm-disabled-opacity);
	cursor: not-allowed;
	pointer-events: none;
}

.wg-context-menu__item--danger {
	color: var(--wg-cm-text-danger);
}

.wg-context-menu__item--danger:hover {
	background: color-mix(in srgb, var(--wg-cm-text-danger) 10%, transparent);
}

.wg-context-menu__item--toggled {
	color: var(--wg-cm-toggled-color);
}

.wg-context-menu__icon {
	width: var(--wg-cm-icon-size);
	height: var(--wg-cm-icon-size);
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.wg-context-menu__label {
	flex: 1;
}

.wg-context-menu__shortcut {
	margin-left: auto;
	padding-left: 16px;
	color: var(--wg-cm-text-secondary);
	font-size: 0.9em;
}

.wg-context-menu__divider {
	height: 1px;
	background: var(--wg-cm-border-color);
	margin: var(--wg-cm-padding) 0;
}

.wg-context-menu__divider-label {
	padding: 2px 12px;
	color: var(--wg-cm-text-secondary);
	font-size: 0.85em;
	text-transform: uppercase;
	letter-spacing: 0.03em;
}

.wg-context-menu__loading {
	padding: var(--wg-cm-item-padding);
	color: var(--wg-cm-text-secondary);
	font-style: italic;
}

/* Submenu support */
.wg-context-menu__item--has-submenu {
	position: relative;
}

.wg-context-menu__item--has-submenu::after {
	content: '▶';
	margin-left: auto;
	padding-left: 16px;
	font-size: 0.65em;
	opacity: 0.6;
}

.wg-context-menu--submenu {
	position: fixed;
	display: none;
}

/* Column-visibility toggles: the checkbox glyph dims when the column is hidden */
.wg-context-menu__item--toggle .wg-context-menu__icon {
	opacity: 0.4;
}

.wg-context-menu__item--toggle.wg-context-menu__item--toggled {
	color: inherit;
}

.wg-context-menu__item--toggle.wg-context-menu__item--toggled .wg-context-menu__icon {
	opacity: 1;
}
`

let stylesInjected = false

function injectStyles(): void {
	if (stylesInjected) return

	const style = document.createElement('style')
	style.id = 'wg-context-menu-styles'
	style.textContent = CONTEXT_MENU_STYLES
	document.head.appendChild(style)
	stylesInjected = true
}

function escapeText(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Fill a menu level element with the resolved entries. */
function fillLevel<Ctx>(level: HTMLElement, spec: MenuSpec<Ctx>, entries: readonly AnyEntry[]): void {
	level.textContent = ''
	// Expand the string shorthand first so `prepare` sees built-ins as items
	const prepared = entries.map(raw => {
		const e = typeof raw === 'string' ? { action: raw } : raw
		return e && !('divider' in e) && spec.prepare ? spec.prepare(e as MenuItem<Ctx, any>) : e
	})
	const resolved = resolveMenuEntries(prepared as readonly (MenuEntry<Ctx, any> | string)[], spec.ctx, spec.defaults)
	for (const entry of resolved) {
		if (entry.kind === 'divider') {
			const divider = document.createElement('div')
			divider.className = 'wg-context-menu__divider'
			divider.setAttribute('role', 'separator')
			level.appendChild(divider)
			if (entry.text) {
				const label = document.createElement('div')
				label.className = 'wg-context-menu__divider-label'
				label.textContent = entry.text
				level.appendChild(label)
			}
			continue
		}
		const r = entry.resolved
		const isToggle = r.action === 'toggle-column' || r.action === 'show-all-columns'
		const el = document.createElement('div')
		el.className = [
			'wg-context-menu__item',
			r.isDisabled ? 'wg-context-menu__item--disabled' : '',
			r.isDanger ? 'wg-context-menu__item--danger' : '',
			r.isToggled ? 'wg-context-menu__item--toggled' : '',
			entry.hasChildren ? 'wg-context-menu__item--has-submenu' : '',
			isToggle ? 'wg-context-menu__item--toggle' : '',
			r.cssClass
		].filter(Boolean).join(' ')
		// An item that defines its toggle state is a menuitemcheckbox (core /menu convention)
		const item = entry.item
		const isToggleItem = item.isToggled !== undefined
			|| typeof item.getIsToggledCallback === 'function'
			|| spec.defaults?.(item)?.isToggled !== undefined
		el.setAttribute('role', isToggleItem ? 'menuitemcheckbox' : 'menuitem')
		if (isToggleItem) el.setAttribute('aria-checked', String(r.isToggled))
		el.dataset.action = r.action
		if (r.id !== undefined) el.dataset.id = r.id
		if (r.isDisabled) el.setAttribute('aria-disabled', 'true')
		if (r.tooltip) el.title = r.tooltip
		el.innerHTML = `${r.icon ? `<span class="wg-context-menu__icon">${r.icon}</span>` : ''}<span class="wg-context-menu__label">${escapeText(r.text)}</span>${r.shortcut ? `<span class="wg-context-menu__shortcut">${escapeText(r.shortcut)}</span>` : ''}`
		itemOf.set(el, { item: entry.item, isDisabled: r.isDisabled, hasChildren: entry.hasChildren, shortcut: r.shortcut })
		if (entry.hasChildren && !r.isDisabled) attachSubmenu(el, entry.item, spec)
		level.appendChild(el)
	}
}

function createLevel(isSubmenu: boolean): HTMLElement {
	const level = document.createElement('div')
	level.className = isSubmenu ? 'wg-context-menu wg-context-menu--submenu' : 'wg-context-menu'
	level.setAttribute('role', 'menu')
	return level
}

function showSubmenu(parentItem: HTMLElement, submenu: HTMLElement): void {
	submenu.style.display = 'block'
	computePosition(parentItem, submenu, {
		placement: 'right-start',
		strategy: 'fixed',
		middleware: [
			flip({ fallbackPlacements: ['left-start', 'right-end', 'left-end'] }),
			shift({ padding: 8 })
		]
	}).then(({ x, y }) => {
		submenu.style.left = `${x}px`
		submenu.style.top = `${y}px`
	})
}

/** Lazy submenu: built on first hover (a loading row while an async getChildrenCallback resolves). */
function attachSubmenu<Ctx>(parentItem: HTMLElement, item: MenuItem<Ctx, any>, spec: MenuSpec<Ctx>): void {
	let submenu: HTMLElement | null = null
	let hideTimer: number | null = null

	const cancelHide = () => {
		if (hideTimer !== null) {
			clearTimeout(hideTimer)
			hideTimer = null
		}
	}
	// Delay hide so the cursor has time to cross the gap from parent item to submenu
	const scheduleHide = () => {
		hideTimer = window.setTimeout(() => {
			if (submenu) submenu.style.display = 'none'
			hideTimer = null
		}, 150)
	}

	const build = (): HTMLElement => {
		const level = createLevel(true)
		const source: EntriesSource = () => getMenuChildren(item, spec.ctx)
		levelOf.set(level, source)
		const loading = document.createElement('div')
		loading.className = 'wg-context-menu__loading'
		loading.textContent = '…'
		level.appendChild(loading)
		void Promise.resolve(source()).then(children => {
			fillLevel(level, spec, children)
			if (level.style.display === 'block') showSubmenu(parentItem, level)
		})
		level.addEventListener('mouseenter', cancelHide)
		level.addEventListener('mouseleave', scheduleHide)
		parentItem.appendChild(level)
		return level
	}

	parentItem.addEventListener('mouseenter', () => {
		cancelHide()
		submenu ??= build()
		showSubmenu(parentItem, submenu)
	})
	parentItem.addEventListener('mouseleave', scheduleHide)
}

/** Re-render a menu level in place (after a keep-open item ran). */
async function refreshLevel<Ctx>(level: HTMLElement, spec: MenuSpec<Ctx>): Promise<void> {
	const source = levelOf.get(level)
	if (!source) return
	fillLevel(level, spec, await source())
}

/**
 * Open a context menu at viewport coordinates. Returns the container (on
 * document.body), or null when no item is visible. `onClose` runs when it
 * closes on its own (outside click, Escape, scroll, a leaf activated).
 */
export function openContextMenu<T, Ctx>(
	host: GridHost<T>,
	x: number,
	y: number,
	xOffset: number,
	yOffset: number,
	spec: MenuSpec<Ctx>,
	onClose: () => void
): HTMLElement | null {
	injectStyles()

	const root = createLevel(false)
	levelOf.set(root, () => spec.entries)
	fillLevel(root, spec, spec.entries)
	if (!root.querySelector('.wg-context-menu__item')) return null

	const container = document.createElement('div')
	container.className = 'wg-context-menu-container'
	container.appendChild(root)
	document.body.appendChild(container)

	// Position using a virtual element at the click coordinates; offsets are applied
	// via the offset middleware so they flip sign along with the placement near edges
	const virtualEl = {
		getBoundingClientRect: () => ({ width: 0, height: 0, x, y, top: y, left: x, right: x, bottom: y })
	}
	computePosition(virtualEl, root, {
		placement: 'bottom-start',
		strategy: 'fixed',
		middleware: [
			offset({ mainAxis: yOffset, alignmentAxis: xOffset }),
			flip({ fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] }),
			shift({ padding: 8 })
		]
	}).then(({ x: posX, y: posY }) => {
		Object.assign(root.style, { left: `${posX}px`, top: `${posY}px` })
	})

	let isClosed = false
	const close = () => {
		if (isClosed) return
		cleanup()
		onClose()
	}

	/** Activate a leaf: close first (unless it keeps the menu open), then run it. */
	const activate = (el: HTMLElement, event: Event) => {
		const record = itemOf.get(el)
		if (!record || record.isDisabled || record.hasChildren) return
		const isKeptOpen = record.item.shouldCloseOnClick === false
		if (!isKeptOpen) close()
		const ran = spec.activate(record.item, el, event)
		if (isKeptOpen) {
			const level = el.closest('.wg-context-menu') as HTMLElement | null
			void Promise.resolve(ran).then(() => {
				if (level && !isClosed) void refreshLevel(level, spec)
			})
		}
	}

	container.addEventListener('click', (e) => {
		const el = (e.target as HTMLElement).closest('.wg-context-menu__item') as HTMLElement | null
		if (el) activate(el, e)
	})

	// Close on scroll from either the grid's internal scroll container or the page
	// (scroll events aren't composed, so a window capture listener can't see shadow-DOM scrolls)
	const windowScrollSub = host.scrollEvents.subscribe('window', close)
	const containerScrollSub = host.scrollEvents.subscribe('container', close)

	const handleOutsideClick = (e: MouseEvent) => {
		if (!container.contains(e.target as Node)) close()
	}

	// Escape closes; an item's `shortcut` activates it while the menu is open
	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			e.preventDefault()
			close()
			return
		}
		const key = e.key.toLowerCase()
		for (const el of container.querySelectorAll('.wg-context-menu__item') as NodeListOf<HTMLElement>) {
			const record = itemOf.get(el)
			if (!record?.shortcut || record.isDisabled) continue
			// Case-insensitive match for single letters, exact match for others
			if (record.shortcut.toLowerCase() === key || record.shortcut === e.key) {
				e.preventDefault()
				activate(el, e)
				return
			}
		}
	}

	const cleanup = () => {
		isClosed = true
		windowScrollSub.unsubscribe()
		containerScrollSub.unsubscribe()
		document.removeEventListener('mousedown', handleOutsideClick)
		document.removeEventListener('keydown', handleKeyDown)
		container.remove()
	}

	// Attach listeners with delay to avoid catching the opening click
	setTimeout(() => {
		if (isClosed) return
		document.addEventListener('mousedown', handleOutsideClick)
		document.addEventListener('keydown', handleKeyDown)
	}, 0)

	// Store cleanup function on container for later removal
	;(container as any)._cleanup = cleanup

	return container
}

/**
 * Close context menu and cleanup
 */
export function closeContextMenu(container: HTMLElement): void {
	const cleanup = (container as any)._cleanup
	if (typeof cleanup === 'function') {
		cleanup()
		return
	}
	container.remove()
}

// Element handlers (extracted from GridElement)
export { handleContextMenu, handleHeaderContextMenu, handleFillerContextMenu } from './element-handlers.js'

// =============================================================================
// Row Toolbar Module
// Floating toolbar with row actions
// =============================================================================

import type { GridHost } from '../grid-context.js'
import type { GridAction, GridToolbarEntry, GridToolbarItem } from '../../interaction.js'
import { computePosition, flip, shift, type Placement } from '@floating-ui/dom'
import { isMenuDivider, resolveActionItem, type ResolvedActionItem } from '@keenmate/web-components-core/actions'
import { normalizeEntry, rowActionDefaults } from '../items/index.js'

// =============================================================================
// Offset Helpers
// =============================================================================

/**
 * Resolve cellToolbarOffset to a pixel X position relative to a cell.
 * - number (0-1): fraction of cell width (e.g. 0.2 = 20% from left)
 * - string: CSS length (e.g. '2rem', '24px') resolved against the cell
 */
export function resolveToolbarOffset(cellRect: DOMRect, offset: number | string): number {
	if (typeof offset === 'number') {
		return cellRect.left + cellRect.width * offset
	}
	// CSS length string — measure with a temp element
	const measurer = document.createElement('div')
	measurer.style.cssText = `position:fixed;left:0;top:0;width:${offset};height:0;visibility:hidden;pointer-events:none`
	document.body.appendChild(measurer)
	const px = measurer.getBoundingClientRect().width
	measurer.remove()
	return cellRect.left + px
}

// =============================================================================
// Connector Arrow Types and State
// =============================================================================

export type ConnectorState = {
	path: string | null
	arrowPos: { x: number; y: number } | null
	arrowDir: 'left' | 'right' | 'down' | 'up'
}

// State for the connector arrow that tracks row movement
let connectorState: ConnectorState = {
	path: null,
	arrowPos: null,
	arrowDir: 'right'
}

// =============================================================================
// Toolbar buttons (core action items)
// =============================================================================

/** One resolved toolbar button. */
export type ToolbarButton<T> = {
	item: GridToolbarItem<T>
	resolved: ResolvedActionItem<GridAction>
	/** Toolbar row, 1 = closest to the grid row. */
	row: number
	/** A divider entry precedes it in its toolbar row. */
	isDividerBefore: boolean
}

/**
 * Resolve `rowToolbar`-style entries against a row / cell ctx: string shorthand
 * expanded, built-in defaults applied, hidden items dropped. A divider marks the
 * next visible item of the same toolbar row.
 */
export function resolveToolbar<T>(
	host: GridHost<T>,
	entries: readonly GridToolbarEntry<T>[] | null | undefined,
	ctx: { row?: T }
): ToolbarButton<T>[] {
	const out: ToolbarButton<T>[] = []
	let pendingDivider = false
	for (const raw of entries ?? []) {
		const entry = normalizeEntry<GridToolbarItem<T> | { divider: true }>(raw as string | GridToolbarItem<T>)
		if (isMenuDivider(entry)) {
			pendingDivider = true
			continue
		}
		const item = entry as GridToolbarItem<T>
		const resolved = resolveActionItem(item, ctx as never, rowActionDefaults(host, item.action, ctx))
		if (!resolved.isVisible) continue
		const row = item.row ?? 1
		const prev = [...out].reverse().find(b => b.row === row)
		out.push({ item, resolved, row, isDividerBefore: pendingDivider && !!prev })
		pendingDivider = false
	}
	return out
}

/** The key cell items override base items by: `id`, else the built-in `action`. */
export function toolbarEntryKey<T>(entry: GridToolbarEntry<T>): string | null {
	const e = normalizeEntry<GridToolbarItem<T> | { divider: true }>(entry as string | GridToolbarItem<T>)
	if (isMenuDivider(e)) return null
	const item = e as GridToolbarItem<T>
	return item.id ?? item.action ?? null
}

/** Max button count of any toolbar row (static — for sizing the inline actions column). */
export function maxToolbarRowLength<T>(entries: readonly GridToolbarEntry<T>[] | null | undefined): number {
	const perRow = new Map<number, number>()
	for (const raw of entries ?? []) {
		const e = normalizeEntry<GridToolbarItem<T> | { divider: true }>(raw as string | GridToolbarItem<T>)
		if (isMenuDivider(e)) continue
		const row = (e as GridToolbarItem<T>).row ?? 1
		perRow.set(row, (perRow.get(row) ?? 0) + 1)
	}
	return Math.max(0, ...perRow.values())
}

function escapeAttr(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * One button. `data-action` (built-in name or `custom`) + `data-id` identify the item;
 * `data-wg-index` points into the resolved list the click handler holds.
 */
export function renderToolbarButton<T>(button: ToolbarButton<T>, index: number, baseClass: string): string {
	const r = button.resolved
	const classes = [
		baseClass,
		r.isDanger ? `${baseClass}--danger` : '',
		r.isToggled ? `${baseClass}--toggled` : '',
		r.isDisabled ? `${baseClass}--disabled` : '',
		r.cssClass
	].filter(Boolean).join(' ')
	const text = escapeAttr(r.text)
	const showText = !r.icon || button.item.isTextVisible === true
	const labelHtml = showText && r.text ? `<span class="wg__toolbar-label">${text}</span>` : ''
	const idAttr = r.id !== undefined ? ` data-id="${escapeAttr(r.id)}"` : ''
	const pressed = r.isToggled ? ' aria-pressed="true"' : ''
	return `<button type="button" class="${classes}" data-action="${escapeAttr(r.action)}"${idAttr} data-wg-index="${index}" title="${text}" aria-label="${text}"${pressed}${r.isDisabled ? ' disabled' : ''}>${r.icon ?? ''}${labelHtml}</button>`
}

/**
 * Format a keyboard shortcut for display (e.g., "Ctrl+D" -> "Ctrl + D")
 */
function formatShortcut(key: string): string {
	return key.replace(/\+/g, ' + ')
}

/**
 * Rich tooltip for a toolbar button: the text as heading, `tooltip` as the
 * description, and the shortcut (the item's, or a row shortcut's with the same id / action).
 */
export function buildToolbarTooltipHtml<T>(button: ToolbarButton<T>, shortcutKey?: string): string {
	const r = button.resolved
	const lines: string[] = [`<span class="wg__tooltip-title">${escapeAttr(r.text)}</span>`]
	if (r.tooltip) lines.push(`<div class="wg__tooltip-desc">${r.tooltip}</div>`)
	const shortcut = r.shortcut || shortcutKey
	if (shortcut) lines.push(`<div class="wg__tooltip-shortcut">${formatShortcut(shortcut)}</div>`)
	return lines.join('')
}

/**
 * Render the floating toolbar for resolved buttons.
 * @param reverseRows - If true, reverse row order so Row 1 ends up at top visually
 *                      (CSS column-reverse makes last HTML row appear at top)
 */
export function renderToolbarHTML<T>(buttons: ToolbarButton<T>[], reverseRows: boolean = false): string {
	const rowNums = [...new Set(buttons.map(b => b.row))].sort((a, b) => a - b)
	if (reverseRows) rowNums.reverse()
	const rowsHtml = rowNums.map(rowNum => {
		const html = buttons.map((b, i) => {
			if (b.row !== rowNum) return ''
			const divider = b.isDividerBefore ? '<div class="wg__toolbar-divider"></div>' : ''
			return divider + renderToolbarButton(b, i, 'wg__toolbar-btn')
		}).join('')
		return `<div class="wg__toolbar-row">${html}</div>`
	}).join('')
	return `<div class="wg__toolbar">${rowsHtml}</div>`
}

// =============================================================================
// Open/Close Toolbar
// =============================================================================

let activeToolbar: {
	container: HTMLElement
	toolbar: HTMLElement
	rowIndex: number
	rowItem: unknown  // Reference to the actual data item
	buttons: ToolbarButton<any>[]  // The rendered buttons (swapped by a cell toolbar)
	position: 'left' | 'right' | 'top'
	hasRowMoved: boolean
	cursorX?: number  // Store cursor X for connector in 'cursor' mode
	cleanup: () => void
} | null = null

/**
 * Open toolbar for a specific row
 */
export function openToolbar<T>(
	ctx: GridHost<T>,
	rowElement: HTMLElement,
	rowIndex: number,
	buttons: ToolbarButton<T>[],
	row: T,
	onItemClick: (button: ToolbarButton<T>, event: MouseEvent, triggerElement: HTMLElement) => void,
	cursorX?: number  // For 'cursor' mode positioning
): void {
	// Close any existing toolbar
	closeToolbar()

	// CSS uses column-reverse, so Row 1 in HTML ends up at BOTTOM visually
	// For 'bottom' (toolbar top at row level), we need Row 1 at TOP → reverse
	// For 'top' (toolbar bottom at row level), Row 1 at BOTTOM is correct → no reverse
	const reverseRows = ctx.engine.toolbarVerticalAlign !== 'top'
	const html = renderToolbarHTML(buttons, reverseRows)

	// Create container - append to shadow root to stay in same DOM context as rowElement
	const container = document.createElement('div')
	container.className = 'wg__toolbar-container'
	if (ctx.engine.toolbarBtnMinWidth) {
		container.style.setProperty('--wg-toolbar-btn-min-width', ctx.engine.toolbarBtnMinWidth)
	}
	container.innerHTML = html
	ctx.shadow.appendChild(container)

	const toolbar = container.querySelector('.wg__toolbar') as HTMLElement
	// Initialize position based on preferred position (will be updated by computePosition if it flips)
	const preferredPos = ctx.engine.toolbarPosition
	let toolbarPosition: 'left' | 'right' | 'top' =
		preferredPos === 'top' ? 'top' :
		preferredPos === 'right' ? 'right' : 'left'

	// Set initial fixed positioning (will be updated by computePosition)
	toolbar.style.position = 'fixed'
	toolbar.style.visibility = 'hidden'  // Hide until positioned

	// Position toolbar using floating-ui
	requestAnimationFrame(() => {
		// Re-query row element fresh from shadow DOM (original might be stale)
		const freshRow = ctx.shadow.querySelector(`tr[data-row-index="${rowIndex}"]`) as HTMLElement
		if (!freshRow) {
			closeToolbar()
			return
		}

		// Determine placement based on toolbarPosition preference
		const preferredPosition = ctx.engine.toolbarPosition
		const verticalAlign = ctx.engine.toolbarVerticalAlign
		const horizontalAlign = ctx.engine.toolbarHorizontalAlign

		// Build placement string for floating-ui
		// For left/right: suffix determines vertical alignment
		//   -start = toolbar top at row level (rows stack below) = verticalAlign 'bottom'
		//   -end = toolbar bottom at row level (rows stack above) = verticalAlign 'top'
		//   none = toolbar centered on row = verticalAlign 'center'
		// For top: suffix determines horizontal alignment (-start = left, -end = right, none = center)
		let placement: Placement
		let fallbacks: Placement[]

		// Determine vertical alignment suffix for left/right positions
		let alignSuffix = ''
		if (verticalAlign === 'top') {
			alignSuffix = '-end'    // Toolbar bottom at row level, stacks upward
		} else if (verticalAlign === 'bottom') {
			alignSuffix = '-start'  // Toolbar top at row level, stacks downward
		}
		// 'center' uses no suffix (default floating-ui behavior)

		// Map toolbarHorizontalAlign to placement suffix for 'top' position
		const getTopPlacement = (): Placement => {
			if (horizontalAlign === 'start') return 'top-start'
			if (horizontalAlign === 'end') return 'top-end'
			return 'top'  // center is default
		}

		// Set preferred placement and fallbacks based on toolbarPosition
		if (preferredPosition === 'left') {
			placement = `left${alignSuffix}` as Placement
			fallbacks = [`right${alignSuffix}` as Placement, getTopPlacement()]
		} else if (preferredPosition === 'right') {
			placement = `right${alignSuffix}` as Placement
			fallbacks = [`left${alignSuffix}` as Placement, getTopPlacement()]
		} else if (preferredPosition === 'top') {
			placement = getTopPlacement()
			fallbacks = [`left${alignSuffix}` as Placement, `right${alignSuffix}` as Placement]
		} else {
			// 'auto' - prefer left, then right, then top
			placement = `left${alignSuffix}` as Placement
			fallbacks = [`right${alignSuffix}` as Placement, getTopPlacement()]
		}

		// Handle column-based or cursor-based positioning for top position
		// Only apply these anchor modes when toolbarPosition is explicitly 'top'
		let anchor: Element | { getBoundingClientRect: () => DOMRect } = freshRow
		const toolbarColumn = ctx.engine.toolbarColumn

		if (preferredPosition === 'top') {
			// Priority 1: toolbarColumn - position over a specific column
			if (toolbarColumn !== undefined) {
				const cells = freshRow.querySelectorAll('.wg__cell:not(.wg__row-number):not(.wg__inline-actions-cell)')
				let targetCell: HTMLElement | null = null

				if (typeof toolbarColumn === 'number') {
					// Column index
					targetCell = cells[toolbarColumn] as HTMLElement || null
				} else {
					// Column field name - find matching cell
					for (let i = 0; i < cells.length; i++) {
						const cell = cells[i] as HTMLElement
						if (cell.dataset.field === toolbarColumn) {
							targetCell = cell
							break
						}
					}
				}

				if (targetCell) {
					const cellRect = targetCell.getBoundingClientRect()
					anchor = {
						getBoundingClientRect: () => ({
							x: cellRect.left + cellRect.width / 2,
							y: cellRect.top,
							top: cellRect.top,
							left: cellRect.left + cellRect.width / 2,
							bottom: cellRect.bottom,
							right: cellRect.left + cellRect.width / 2,
							width: 0,
							height: cellRect.height,
							toJSON: () => ({})
						}) as DOMRect
					}
				}
			}
			// Priority 2: cursor mode - position at cursor X
			else if (horizontalAlign === 'cursor' && cursorX !== undefined) {
				const rowRect = freshRow.getBoundingClientRect()
				anchor = {
					getBoundingClientRect: () => ({
						x: cursorX,
						y: rowRect.top,
						top: rowRect.top,
						left: cursorX,
						bottom: rowRect.bottom,
						right: cursorX,
						width: 0,
						height: rowRect.height,
						toJSON: () => ({})
					}) as DOMRect
				}
			}
		}

		computePosition(anchor, toolbar, {
			strategy: 'fixed',
			placement,
			middleware: [
				flip({ fallbackPlacements: fallbacks }),
				shift({ padding: 8 })  // Keep within viewport
			]
		}).then(({ x, y, placement: finalPlacement }) => {
			let initialX = x

			// When followsCursor or a cell toolbar is active with top placement,
			// compute cell-based X position to avoid flash on row boundaries.
			// Skip when toolbarColumn is set — floating-ui already computed correct X from the column anchor.
			if ((ctx.engine.shouldToolbarFollowCursor || ctx.engine.getCellToolbarItemsCallback) && finalPlacement.startsWith('top') && cursorX !== undefined && ctx.engine.toolbarColumn === undefined) {
				const cells = freshRow.querySelectorAll('.wg__cell:not(.wg__row-number):not(.wg__inline-actions-cell)')
				for (const cell of cells) {
					const cellRect = cell.getBoundingClientRect()
					if (cursorX >= cellRect.left && cursorX <= cellRect.right) {
						initialX = resolveToolbarOffset(cellRect, ctx.engine.cellToolbarOffset)
						break
					}
				}
			}

			Object.assign(toolbar.style, {
				left: `${initialX}px`,
				top: `${y}px`,
				visibility: 'visible'
			})

			// Extract position from placement (e.g., 'left-start' -> 'left')
			toolbarPosition = finalPlacement.split('-')[0] as 'left' | 'right' | 'top'

			// Store position for connector calculations
			if (activeToolbar) {
				activeToolbar.position = toolbarPosition
			}
		}).catch(() => {
			// Fallback if computePosition fails
			toolbar.style.visibility = 'visible'
		})
	})

	// Handle button clicks — reads the CURRENT buttons (a cell toolbar swaps them)
	const handleClick = (e: MouseEvent) => {
		const btn = (e.target as HTMLElement).closest('.wg__toolbar-btn') as HTMLButtonElement
		if (btn && !btn.disabled && activeToolbar) {
			const button = activeToolbar.buttons[Number(btn.dataset.wgIndex)] as ToolbarButton<T> | undefined
			if (button) onItemClick(button, e, btn)
		}
	}

	container.addEventListener('click', handleClick)

	// Store cleanup and row reference for connector tracking
	activeToolbar = {
		container,
		toolbar,
		rowIndex,
		rowItem: row,
		buttons,
		position: toolbarPosition,
		hasRowMoved: false,
		cursorX,
		cleanup: () => {
			container.removeEventListener('click', handleClick)
			container.remove()
		}
	}

	// Reset connector state
	connectorState = { path: null, arrowPos: null, arrowDir: 'right' }
}

/**
 * Close the active toolbar
 */
export function closeToolbar(): void {
	if (activeToolbar) {
		activeToolbar.cleanup()
		activeToolbar = null
	}
	// Reset connector state
	connectorState = { path: null, arrowPos: null, arrowDir: 'right' }
}

/**
 * Get currently active toolbar row index
 */
export function getActiveToolbarRowIndex(): number | null {
	return activeToolbar?.rowIndex ?? null
}

/**
 * Check if active toolbar belongs to a specific shadow root
 */
export function isToolbarOwnedBy(shadow: ShadowRoot): boolean {
	return activeToolbar?.container.getRootNode() === shadow
}

/**
 * Check if toolbar is open for a specific row
 */
export function isToolbarOpenForRow(rowIndex: number): boolean {
	return activeToolbar?.rowIndex === rowIndex
}

/**
 * Get the row item reference for the active toolbar
 */
export function getActiveToolbarRowItem<T>(): T | null {
	return activeToolbar?.rowItem as T ?? null
}

/**
 * Get the current connector state for rendering
 */
export function getConnectorState(): ConnectorState {
	return connectorState
}

/**
 * Get the active toolbar element (for position updates)
 */
export function getActiveToolbar(): { toolbar: HTMLElement; container: HTMLElement } | null {
	if (!activeToolbar) return null
	return { toolbar: activeToolbar.toolbar, container: activeToolbar.container }
}

/** Replace the active toolbar's buttons (a cell toolbar swapped its items in). */
export function setActiveToolbarButtons<T>(buttons: ToolbarButton<T>[]): void {
	if (activeToolbar) activeToolbar.buttons = buttons
}

/**
 * Update toolbar position (for mouse-following mode)
 * @param targetX - Target X position
 * @param rowElement - The row element for Y position reference
 * @param align - How to align toolbar: 'center' (default) or 'start' (left edge at targetX)
 */
export function updateToolbarPosition(targetX: number, rowElement: HTMLElement, align: 'center' | 'start' = 'center'): void {
	if (!activeToolbar || activeToolbar.position !== 'top') {
		return
	}

	const toolbar = activeToolbar.toolbar
	const toolbarRect = toolbar.getBoundingClientRect()

	// Position toolbar based on alignment
	let newX: number
	if (align === 'start') {
		// Toolbar left edge at targetX
		newX = targetX
	} else {
		// Center toolbar on targetX
		newX = targetX - toolbarRect.width / 2
	}

	// Keep within viewport
	const minX = 8  // Padding from viewport edge
	const maxX = window.innerWidth - toolbarRect.width - 8
	newX = Math.max(minX, Math.min(maxX, newX))

	toolbar.style.left = `${newX}px`

	// Update cursorX for connector
	activeToolbar.cursorX = targetX
}

/**
 * Update connector path after row has moved
 * Call this after a moveUp/moveDown action to draw the bracket-shaped connector
 * The connector is clipped at grid container boundaries
 */
export function updateConnector<T>(
	ctx: GridHost<T>,
	displayItems: T[]
): void {
	if (!activeToolbar) {
		connectorState = { path: null, arrowPos: null, arrowDir: 'right' }
		return
	}

	const { toolbar, rowItem, position } = activeToolbar

	// Find current index of the row item (it may have moved)
	const currentIndex = displayItems.findIndex(item => item === rowItem)
	if (currentIndex === -1) {
		connectorState = { path: null, arrowPos: null, arrowDir: 'right' }
		return
	}

	// Get the current row element
	const currentRowEl = ctx.shadow.querySelector(`tr[data-row-index="${currentIndex}"]`) as HTMLElement
	if (!currentRowEl) {
		connectorState = { path: null, arrowPos: null, arrowDir: 'right' }
		return
	}

	// Check if row is at its original position
	const isAdjacent = currentIndex === activeToolbar.rowIndex

	// Track if row has ever moved
	if (!isAdjacent) {
		activeToolbar.hasRowMoved = true
	}

	// If row has never moved, no connector needed
	if (!activeToolbar.hasRowMoved) {
		connectorState = { path: null, arrowPos: null, arrowDir: 'right' }
		return
	}

	const popupRect = toolbar.getBoundingClientRect()
	const rowRect = currentRowEl.getBoundingClientRect()
	const table = ctx.shadow.querySelector('.wg__table') as HTMLElement
	const tableRect = table?.getBoundingClientRect()

	// Get grid container bounds for clipping
	const container = ctx.shadow.querySelector('.wg') as HTMLElement
	const containerRect = container?.getBoundingClientRect()

	if (!tableRect || !containerRect) {
		connectorState = { path: null, arrowPos: null, arrowDir: 'right' }
		return
	}

	const isRTL = document.dir === 'rtl' || document.documentElement.dir === 'rtl'

	// Check row visibility within container
	// Row is only "not visible" when COMPLETELY outside the container
	const rowCenterY = rowRect.top + rowRect.height / 2
	const isRowAbove = rowRect.bottom <= containerRect.top  // Row completely above
	const isRowBelow = rowRect.top >= containerRect.bottom  // Row completely below
	const isRowVisible = !isRowAbove && !isRowBelow

	// Clamp endY to container bounds
	let endY: number
	let arrowDir: 'left' | 'right' | 'down' | 'up' = 'right'

	if (isRowAbove) {
		// Row is above visible area - point to top edge
		endY = containerRect.top + 8
		arrowDir = 'up'
	} else if (isRowBelow) {
		// Row is below visible area - point to bottom edge
		endY = containerRect.bottom - 8
		arrowDir = 'down'
	} else {
		// Row is visible - point to actual row center
		endY = rowCenterY
	}

	if (position === 'left') {
		// Popup is to the left - connect from right side of popup to left side of row
		const startX = popupRect.right
		const startY = popupRect.top + popupRect.height / 2
		const cornerX = isRTL ? containerRect.right + 15 : containerRect.left - 15

		if (!isRowVisible) {
			// Row out of view - L-shape to corner, then vertical down/up
			const path = `M ${startX} ${startY} H ${cornerX} V ${endY}`
			connectorState = { path, arrowPos: { x: cornerX, y: endY }, arrowDir }
			return
		}

		// Row visible - full bracket shape to left side of row
		const endX = isRTL ? containerRect.right - 8 : containerRect.left + 8
		arrowDir = isRTL ? 'left' : 'right'
		const path = `M ${startX} ${startY} H ${cornerX} V ${endY} H ${endX}`
		connectorState = { path, arrowPos: { x: endX, y: endY }, arrowDir }
		return
	} else if (position === 'right') {
		// Popup is to the right - connect from left side of popup to right side of row
		const startX = popupRect.left
		const startY = popupRect.top + popupRect.height / 2
		const cornerX = isRTL ? containerRect.left - 15 : containerRect.right + 15

		if (!isRowVisible) {
			// Row out of view - L-shape to corner, then vertical down/up
			const path = `M ${startX} ${startY} H ${cornerX} V ${endY}`
			connectorState = { path, arrowPos: { x: cornerX, y: endY }, arrowDir }
			return
		}

		// Row visible - full bracket shape to right side of row
		const endX = isRTL ? containerRect.left + 8 : containerRect.right - 8
		arrowDir = isRTL ? 'right' : 'left'
		const path = `M ${startX} ${startY} H ${cornerX} V ${endY} H ${endX}`
		connectorState = { path, arrowPos: { x: endX, y: endY }, arrowDir }
		return
	} else {
		// Position: 'top' - L-shaped connector from right side of toolbar
		const horizontalLength = 48  // 3rem at 16px base

		// Start from center-right of toolbar
		const startX = popupRect.right
		const startY = popupRect.top + popupRect.height / 2
		const turnX = startX + horizontalLength

		// Calculate length: current row index - original toolbar row index
		const length = currentIndex - activeToolbar.rowIndex

		const arrowSize = 8  // Arrow head size

		if (length === 0) {
			// Row at same position - simple L pointing down at top edge of row
			let targetY = rowRect.top - arrowSize
			// Clip to container if needed
			if (isRowBelow) {
				targetY = containerRect.bottom - arrowSize
			}
			const path = `M ${startX} ${startY} H ${turnX} V ${targetY}`
			connectorState = { path, arrowPos: { x: turnX, y: targetY }, arrowDir: 'down' }
			return
		} else if (length === -1) {
			// Row one position above (behind toolbar) - U-turn loop on right side
			const loopWidth = 24  // 1.5rem
			const startLoopY = popupRect.top + popupRect.height * 0.25
			const endLoopY = popupRect.top + popupRect.height * 0.75
			const loopX = popupRect.right + loopWidth
			const endX = popupRect.right + arrowSize  // Leave space for arrow
			const path = `M ${popupRect.right} ${startLoopY} H ${loopX} V ${endLoopY} H ${endX}`
			connectorState = { path, arrowPos: { x: endX, y: endLoopY }, arrowDir: 'left' }
			return
		} else if (length < 0) {
			// Row above toolbar - L goes UP, arrow points UP
			let targetY = rowRect.bottom + arrowSize
			// Clip to container top if row is scrolled out
			if (isRowAbove) {
				targetY = containerRect.top + arrowSize
			}
			const path = `M ${startX} ${startY} H ${turnX} V ${targetY}`
			connectorState = { path, arrowPos: { x: turnX, y: targetY }, arrowDir: 'up' }
			return
		} else {
			// Row below toolbar - L goes DOWN, arrow points DOWN
			let targetY = rowRect.top - arrowSize
			// Clip to container bottom if row is scrolled out
			if (isRowBelow) {
				targetY = containerRect.bottom - arrowSize
			}
			const path = `M ${startX} ${startY} H ${turnX} V ${targetY}`
			connectorState = { path, arrowPos: { x: turnX, y: targetY }, arrowDir: 'down' }
			return
		}
	}
}

// =============================================================================
// Render Trigger Button (for button mode)
// =============================================================================

/**
 * Render the toolbar trigger button HTML
 */
export function renderTriggerButton(rowIndex: number, isActive: boolean, title: string = 'Row actions'): string {
	const activeClass = isActive ? 'wg__toolbar-trigger--active' : ''
	return `<button
		class="wg__toolbar-trigger ${activeClass}"
		data-toolbar-trigger="${rowIndex}"
		title="${title}"
	>⋮</button>`
}

export { ToolbarService, type ToolbarHoveredCell, type ToolbarShortcutHandler } from './toolbar-service.js'

export {
	setupToolbarShortcuts,
	setupInlineShortcuts,
	removeInlineShortcuts,
	setupToolbarTooltips,
	showToolbarForRow,
	closeToolbarAndReset,
	updateToolbarWithCellItems,
	handleToolbarItemClick,
	handleInlineActionClick
} from './element-handlers.js'

export { attachToolbarListeners } from './event-listeners.js'

export { renderConnector } from './connector-renderer.js'

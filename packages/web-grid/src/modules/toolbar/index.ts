// =============================================================================
// Row Toolbar Module
// Floating toolbar with row actions
// =============================================================================

import type {
	PredefinedToolbarItem,
	RowToolbarConfig,
	NormalizedToolbarItem,
	ToolbarClickDetail
} from '../../types.js'
import type { GridContext } from '../grid-context.js'
import { computePosition, flip, shift, type Placement } from '@floating-ui/dom'

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
// Predefined Action Definitions
// =============================================================================

// SVG icons for toolbar buttons (16x16 viewBox, stroke-based)
const TOOLBAR_ICONS = {
	add: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
	delete: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>',
	duplicate: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V4a1 1 0 011-1h7"/></svg>',
	moveUp: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V3M4 7l4-4 4 4"/></svg>',
	moveDown: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v10M4 9l4 4 4-4"/></svg>'
} as const

const PREDEFINED_ACTIONS: Record<PredefinedToolbarItem, {
	icon: string
	title: string
	danger?: boolean
}> = {
	add: { icon: TOOLBAR_ICONS.add, title: 'Add row' },
	delete: { icon: TOOLBAR_ICONS.delete, title: 'Delete row', danger: true },
	duplicate: { icon: TOOLBAR_ICONS.duplicate, title: 'Duplicate row' },
	moveUp: { icon: TOOLBAR_ICONS.moveUp, title: 'Move up' },
	moveDown: { icon: TOOLBAR_ICONS.moveDown, title: 'Move down' }
}

// =============================================================================
// Normalize Toolbar Items
// =============================================================================

/**
 * Convert toolbar config (strings or objects) to normalized items
 */
export function normalizeToolbarItems<T>(
	config: RowToolbarConfig<T>[]
): NormalizedToolbarItem<T>[] {
	return config.map((item, index) => {
		if (typeof item === 'string') {
			// Predefined action shorthand
			const predefined = PREDEFINED_ACTIONS[item]
			if (!predefined) {
				console.warn(`Unknown predefined toolbar action: ${item}`)
				return null
			}
			return {
				id: item,
				icon: predefined.icon,
				title: predefined.title,
				row: 1,
				group: 1,
				type: item,
				danger: predefined.danger
			} as NormalizedToolbarItem<T>
		}

		// Full item object
		return {
			id: item.id || `toolbar-item-${index}`,
			icon: item.icon,
			title: item.title,
			label: item.label,
			row: item.row ?? 1,
			group: item.group ?? 1,
			type: item.type,
			danger: item.danger,
			disabled: item.disabled,
			hidden: item.hidden,
			onclick: item.onclick,
			tooltip: item.tooltip,
			tooltipCallback: item.tooltipCallback
		} as NormalizedToolbarItem<T>
	}).filter((item): item is NormalizedToolbarItem<T> => item !== null)
}

// =============================================================================
// Group Items by Row and Group
// =============================================================================

type GroupedItems<T> = {
	rowNum: number
	groups: { groupNum: number; items: NormalizedToolbarItem<T>[] }[]
}[]

function groupToolbarItems<T>(items: NormalizedToolbarItem<T>[]): GroupedItems<T> {
	// Group by row number
	const byRow = new Map<number, NormalizedToolbarItem<T>[]>()
	for (const item of items) {
		const row = item.row
		if (!byRow.has(row)) byRow.set(row, [])
		byRow.get(row)!.push(item)
	}

	// Sort rows ascending: row 1 first, row 2 second, etc.
	// With CSS column-reverse, row 1 ends up at bottom (aligned with data row)
	// and higher rows expand upward
	const result: GroupedItems<T> = []
	const sortedRows = [...byRow.keys()].sort((a, b) => a - b)

	for (const rowNum of sortedRows) {
		const rowItems = byRow.get(rowNum)!
		const byGroup = new Map<number, NormalizedToolbarItem<T>[]>()

		for (const item of rowItems) {
			const group = item.group
			if (!byGroup.has(group)) byGroup.set(group, [])
			byGroup.get(group)!.push(item)
		}

		const sortedGroups = [...byGroup.keys()].sort((a, b) => a - b)
		result.push({
			rowNum,
			groups: sortedGroups.map(groupNum => ({
				groupNum,
				items: byGroup.get(groupNum)!
			}))
		})
	}

	return result
}

// =============================================================================
// Build Tooltip HTML
// =============================================================================

/**
 * Format a keyboard shortcut for display (e.g., "Ctrl+D" -> "Ctrl + D")
 */
function formatShortcut(key: string): string {
	// Add spaces around + for readability
	return key.replace(/\+/g, ' + ')
}

/**
 * Build rich tooltip HTML for a toolbar item
 * @param item - The toolbar item
 * @param shortcutKey - Optional keyboard shortcut from rowShortcuts
 */
export function buildToolbarTooltipHtml<T>(
	item: NormalizedToolbarItem<T>,
	shortcutKey?: string
): string {
	const lines: string[] = []

	// Title (always shown)
	lines.push(`<span class="wg__tooltip-title">${item.title}</span>`)

	// Description (if configured)
	if (item.tooltip?.description) {
		lines.push(`<div class="wg__tooltip-desc">${item.tooltip.description}</div>`)
	}

	// Keyboard shortcut (from tooltip config or rowShortcuts)
	const shortcut = item.tooltip?.shortcut || shortcutKey
	if (shortcut) {
		lines.push(`<div class="wg__tooltip-shortcut">${formatShortcut(shortcut)}</div>`)
	}

	return lines.join('')
}

// =============================================================================
// Render Toolbar HTML
// =============================================================================

/**
 * Render toolbar HTML for a specific row
 * @param reverseRows - If true, reverse row order so Row 1 ends up at top visually
 *                      (CSS column-reverse makes last HTML row appear at top)
 */
export function renderToolbarHTML<T>(
	items: NormalizedToolbarItem<T>[],
	row: T,
	rowIndex: number,
	reverseRows: boolean = false
): string {
	let grouped = groupToolbarItems(items)

	// CSS uses column-reverse, so last row in HTML appears at top visually
	// Reverse when we want Row 1 at top (for 'bottom' and 'center' alignments)
	if (reverseRows) {
		grouped = grouped.reverse()
	}

	const rowsHtml = grouped.map(({ groups }) => {
		const groupsHtml = groups.map(({ items: groupItems }, groupIdx) => {
			const divider = groupIdx > 0 ? '<div class="wg__toolbar-divider"></div>' : ''

			const buttonsHtml = groupItems.map(item => {
				const isDisabled = typeof item.disabled === 'function'
					? item.disabled(row, rowIndex)
					: item.disabled

				const classes = [
					'wg__toolbar-btn',
					item.danger ? 'wg__toolbar-btn--danger' : ''
				].filter(Boolean).join(' ')

				const labelHtml = item.label
					? `<span class="wg__toolbar-label">${item.label}</span>`
					: ''

				const styleAttr = item.minWidth ? ` style="min-width: ${item.minWidth}"` : ''

				return `<button
					class="${classes}"
					data-toolbar-item="${item.id}"
					title="${item.title}"
					${isDisabled ? 'disabled' : ''}${styleAttr}
				>${item.icon}${labelHtml}</button>`
			}).join('')

			return divider + buttonsHtml
		}).join('')

		return `<div class="wg__toolbar-row">${groupsHtml}</div>`
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
	position: 'left' | 'right' | 'top'
	hasRowMoved: boolean
	cursorX?: number  // Store cursor X for connector in 'cursor' mode
	cleanup: () => void
} | null = null

/**
 * Open toolbar for a specific row
 */
export function openToolbar<T>(
	ctx: GridContext<T>,
	rowElement: HTMLElement,
	rowIndex: number,
	items: NormalizedToolbarItem<T>[],
	row: T,
	onItemClick: (item: NormalizedToolbarItem<T>, event: MouseEvent, triggerElement: HTMLElement) => void,
	cursorX?: number  // For 'cursor' mode positioning
): void {
	// Close any existing toolbar
	closeToolbar()

	// CSS uses column-reverse, so Row 1 in HTML ends up at BOTTOM visually
	// For 'bottom' (toolbar top at row level), we need Row 1 at TOP → reverse
	// For 'top' (toolbar bottom at row level), Row 1 at BOTTOM is correct → no reverse
	const reverseRows = ctx.grid.toolbarVerticalAlign !== 'top'
	const html = renderToolbarHTML(items, row, rowIndex, reverseRows)

	// Create container - append to shadow root to stay in same DOM context as rowElement
	const container = document.createElement('div')
	container.className = 'wg__toolbar-container'
	if (ctx.grid.toolbarBtnMinWidth) {
		container.style.setProperty('--wg-toolbar-btn-min-width', ctx.grid.toolbarBtnMinWidth)
	}
	container.innerHTML = html
	ctx.shadow.appendChild(container)

	const toolbar = container.querySelector('.wg__toolbar') as HTMLElement
	// Initialize position based on preferred position (will be updated by computePosition if it flips)
	const preferredPos = ctx.grid.toolbarPosition
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
		const preferredPosition = ctx.grid.toolbarPosition
		const verticalAlign = ctx.grid.toolbarVerticalAlign
		const horizontalAlign = ctx.grid.toolbarHorizontalAlign

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
		const toolbarColumn = ctx.grid.toolbarColumn

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

			// When followsCursor or cellToolbar is active with top placement,
			// compute cell-based X position to avoid flash on row boundaries.
			// Skip when toolbarColumn is set — floating-ui already computed correct X from the column anchor.
			if ((ctx.grid.shouldToolbarFollowCursor || ctx.grid.cellToolbar) && finalPlacement.startsWith('top') && cursorX !== undefined && ctx.grid.toolbarColumn === undefined) {
				const cells = freshRow.querySelectorAll('.wg__cell:not(.wg__row-number):not(.wg__inline-actions-cell)')
				for (const cell of cells) {
					const cellRect = cell.getBoundingClientRect()
					if (cursorX >= cellRect.left && cursorX <= cellRect.right) {
						initialX = resolveToolbarOffset(cellRect, ctx.grid.cellToolbarOffset)
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

	// Handle button clicks
	const handleClick = (e: MouseEvent) => {
		const btn = (e.target as HTMLElement).closest('.wg__toolbar-btn') as HTMLButtonElement
		if (btn && !btn.disabled) {
			const itemId = btn.dataset.toolbarItem || ''
			const item = items.find(i => i.id === itemId)
			if (item) {
				onItemClick(item, e, btn)
			}
		}
	}

	container.addEventListener('click', handleClick)

	// Store cleanup and row reference for connector tracking
	activeToolbar = {
		container,
		toolbar,
		rowIndex,
		rowItem: row,
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
 * Update toolbar items without closing/reopening
 * @returns true if items changed and were updated
 */
export function updateToolbarItems<T>(
	items: NormalizedToolbarItem<T>[],
	row: T,
	rowIndex: number,
	reverseRows: boolean,
	onItemClick: (item: NormalizedToolbarItem<T>) => void
): boolean {
	if (!activeToolbar) return false

	const container = activeToolbar.container
	const oldToolbar = activeToolbar.toolbar

	// Generate new HTML
	const html = renderToolbarHTML(items, row, rowIndex, reverseRows)

	// Create temporary element to parse new content
	const temp = document.createElement('div')
	temp.innerHTML = html
	const newToolbar = temp.querySelector('.wg__toolbar') as HTMLElement

	if (!newToolbar) return false

	// Copy position styles from old toolbar
	newToolbar.style.position = oldToolbar.style.position
	newToolbar.style.left = oldToolbar.style.left
	newToolbar.style.top = oldToolbar.style.top
	newToolbar.style.visibility = oldToolbar.style.visibility

	// Replace old toolbar with new one
	oldToolbar.replaceWith(newToolbar)

	// Update click handler
	const handleClick = (e: MouseEvent) => {
		const btn = (e.target as HTMLElement).closest('.wg__toolbar-btn') as HTMLButtonElement
		if (btn && !btn.disabled) {
			const itemId = btn.dataset.toolbarItem || ''
			const item = items.find(i => i.id === itemId)
			if (item) {
				onItemClick(item)
			}
		}
	}

	// Remove old click listener and add new one
	container.replaceWith(container.cloneNode(true) as HTMLElement)
	const newContainer = activeToolbar.container.getRootNode() === document
		? document.querySelector('.wg__toolbar-container') as HTMLElement
		: (activeToolbar.container.getRootNode() as ShadowRoot).querySelector('.wg__toolbar-container') as HTMLElement

	if (newContainer) {
		newContainer.addEventListener('click', handleClick)

		// Update activeToolbar reference
		activeToolbar.toolbar = newContainer.querySelector('.wg__toolbar') as HTMLElement
		activeToolbar.container = newContainer
		activeToolbar.cleanup = () => {
			newContainer.removeEventListener('click', handleClick)
			newContainer.remove()
		}
	}

	return true
}

/**
 * Update connector path after row has moved
 * Call this after a moveUp/moveDown action to draw the bracket-shaped connector
 * The connector is clipped at grid container boundaries
 */
export function updateConnector<T>(
	ctx: GridContext<T>,
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

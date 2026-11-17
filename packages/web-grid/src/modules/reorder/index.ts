// =============================================================================
// Column Reorder Module
// =============================================================================
// Drag a header to a new place — core createPointerDrag (SPEC §12.28) on the grid host:
// mouse past a 5 px threshold, or a finger after a long press (a quick swipe scrolls);
// the grid scrolls sideways near its edge; Escape cancels. A ghost follows the pointer
// and a drop indicator marks the slot; the drop moves the column (`column-reorder`).

import { createPointerDrag, type PointerDrag } from '@keenmate/web-components-core'
import type { Layer } from '@keenmate/web-components-core/positioning'
import type { GridHost } from '../grid-context.js'
import { openGridLayer } from '../layers/index.js'

/** An active (or armed) reorder of one grid. */
interface ReorderState {
	field: string
	headerCell: HTMLElement
	/** The ghost's core layer (modules/layers/index.ts): outside the grid, so no overflow clips it. */
	ghost: Layer | null
	dropIndicator: HTMLElement | null
	fromIndex: number
	currentDropIndex: number
}

// Drags in progress anywhere (the click that ends one must not sort)
let activeDrags = 0
// Flag to track if a drag was just completed (to block click-to-sort)
let dragJustCompleted = false

/**
 * Check if reorder is currently active or was just completed.
 * This is used to block click-to-sort after a drag operation.
 * The dragJustCompleted flag is reset after being checked.
 */
export function isReordering(): boolean {
	if (dragJustCompleted) {
		dragJustCompleted = false
		return true
	}
	return activeDrags > 0
}

/** The header a press on `target` would drag, or `null` (frozen, not reorderable, a resize handle, …). */
function reorderableHeader<T>(ctx: GridHost<T>, target: Element | undefined, event: PointerEvent): { headerCell: HTMLElement; field: string; fromIndex: number } | null {
	if (!ctx.engine.isColumnReorderAllowed || event.ctrlKey || event.metaKey || event.shiftKey) return null
	if (!target?.closest || target.closest('.wg__resize-handle')) return null
	const headerCell = target.closest('.wg__header') as HTMLElement | null
	if (!headerCell || headerCell.classList.contains('wg__header--frozen') || headerCell.classList.contains('wg__row-number-header')) return null
	const field = headerCell.dataset.field
	if (!field) return null
	const visualCols = ctx.engine.visualColumns
	const frozenCount = ctx.engine.totalFrozenColumns
	const visualIndex = visualCols.findIndex(vc => String(vc.column.field) === field)
	if (visualIndex < frozenCount) return null  // a frozen column
	if (visualCols[visualIndex]?.column.isReorderable === false) return null
	return { headerCell, field, fromIndex: visualIndex - frozenCount }
}

/** Drag-to-reorder for one grid; attach in connect(), `destroy()` in disconnect(). */
export function createColumnReorder<T>(ctx: GridHost<T>, host: HTMLElement): PointerDrag {
	let state: ReorderState | null = null
	let isActive = false

	const cleanup = (): void => {
		if (!state) return
		state.ghost?.destroy()
		state.dropIndicator?.remove()
		ctx.shadow.querySelector('.wg')?.classList.remove('wg--reordering')
		state.headerCell.classList.remove('wg__header--dragging')
		state = null
		if (isActive) activeDrags = Math.max(0, activeDrags - 1)
		isActive = false
	}

	const placeGhost = (x: number, y: number): void => {
		if (!state?.ghost) return
		// Viewport coordinates; the ghost sizes to its title inside the 0 × 0 layer
		state.ghost.place({ left: x + 10, top: y - 10, width: 0, height: 0 })
	}

	return createPointerDrag(host, {
		threshold: 5,
		longPressMs: 300,
		getSource: (_target, event) => {
			const found = reorderableHeader(ctx, event.composedPath()[0] as Element | undefined, event)
			if (!found) return null
			state = { ...found, ghost: null, dropIndicator: null, currentDropIndex: found.fromIndex }
			return found.headerCell
		},
		onStart: ({ x, y }) => {
			if (!state) return false
			isActive = true
			activeDrags++
			ctx.shadow.querySelector('.wg')?.classList.add('wg--reordering')
			state.headerCell.classList.add('wg__header--dragging')
			// Ghost in a core layer outside the grid (no overflow clips it; the hit test sees through it)
			const ghost = openGridLayer(ctx, 'wg__reorder-ghost', '--wg-z-reorder-ghost')
			ghost.element.textContent = state.headerCell.querySelector('.wg__header-title')?.textContent || ''
			state.ghost = ghost
			placeGhost(x, y)
			const indicator = document.createElement('div')
			indicator.className = 'wg__drop-indicator'
			ctx.shadow.querySelector('.wg')?.appendChild(indicator)
			state.dropIndicator = indicator
		},
		onMove: ({ x, y }) => {
			if (!state) return
			placeGhost(x, y)
			const dropIndex = findDropIndex(ctx, x)
			if (dropIndex !== state.currentDropIndex && state.dropIndicator) {
				state.currentDropIndex = dropIndex
				updateDropIndicator(ctx, state.dropIndicator, dropIndex)
			}
		},
		onDrop: () => {
			if (!state) return
			const { field, fromIndex, currentDropIndex: toIndex } = state
			cleanup()
			// Apply the reorder if position changed
			if (fromIndex !== toIndex && toIndex !== fromIndex + 1) {
				// Adjust toIndex if moving right (since we remove from original position first)
				const adjustedToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex
				ctx.engine.moveColumn(field, adjustedToIndex)
				ctx.engine.notify('column-reorder', {
					field,
					fromIndex,
					toIndex: adjustedToIndex,
					allOrder: ctx.engine.getColumnOrderState()
				})
				// Persisted UI state (storage-key + persist-column-order; core state store)
				if (ctx.engine.shouldPersistColumnOrder) ctx.engine.savePersistedState()
			}
			// Block the click that ends the drag from sorting (cleared after this frame)
			dragJustCompleted = true
			requestAnimationFrame(() => {
				dragJustCompleted = false
			})
		},
		onCancel: () => cleanup()
	})
}

/**
 * Find the minimum valid drop index (respects isReorderable: false columns)
 * Dropping before a non-movable column would shift it, so we must drop after all non-movable columns.
 */
function getMinDropIndex<T>(ctx: GridHost<T>): number {
	const visualCols = ctx.engine.visualColumns
	const frozenCount = ctx.engine.totalFrozenColumns
	const nonFrozenCols = visualCols.slice(frozenCount)

	// Find the highest index of any non-movable column
	let minDropIndex = 0
	for (let i = 0; i < nonFrozenCols.length; i++) {
		if (nonFrozenCols[i].column.isReorderable === false) {
			minDropIndex = i + 1  // Must drop AFTER this column
		}
	}
	return minDropIndex
}

/**
 * Find the drop index based on cursor X position
 * Returns index relative to non-frozen columns (0 = first position after frozen columns)
 */
function findDropIndex<T>(ctx: GridHost<T>, mouseX: number): number {
	const visualCols = ctx.engine.visualColumns
	const frozenCount = ctx.engine.totalFrozenColumns
	const nonFrozenCols = visualCols.slice(frozenCount)

	if (nonFrozenCols.length === 0) return 0

	// Get minimum valid drop position (after all non-movable columns)
	const minDropIndex = getMinDropIndex(ctx)

	// Get the first non-frozen column to check if mouse is in frozen area
	const firstNonFrozenField = String(nonFrozenCols[0].column.field)
	const firstNonFrozenHeader = ctx.shadow.querySelector(`th[data-field="${firstNonFrozenField}"]`) as HTMLElement

	// If mouse is to the left of the first non-frozen column, clamp to minimum valid position
	if (firstNonFrozenHeader) {
		const firstRect = firstNonFrozenHeader.getBoundingClientRect()
		if (mouseX < firstRect.left) {
			return minDropIndex
		}
	}

	// Get header cells for non-frozen columns
	for (let i = 0; i < nonFrozenCols.length; i++) {
		const field = String(nonFrozenCols[i].column.field)
		const header = ctx.shadow.querySelector(`th[data-field="${field}"]`) as HTMLElement
		if (header) {
			const rect = header.getBoundingClientRect()
			const midpoint = rect.left + rect.width / 2
			if (mouseX < midpoint) {
				// Clamp to minimum valid drop position
				return Math.max(i, minDropIndex)
			}
		}
	}

	// If past all columns, return last position
	return nonFrozenCols.length
}

/**
 * Update drop indicator position
 */
function updateDropIndicator<T>(ctx: GridHost<T>, indicator: HTMLElement, dropIndex: number): void {

	const visualCols = ctx.engine.visualColumns
	const frozenCount = ctx.engine.totalFrozenColumns
	const nonFrozenCols = visualCols.slice(frozenCount)
	const container = ctx.shadow.querySelector('.wg') as HTMLElement
	const containerRect = container?.getBoundingClientRect()
	if (!containerRect || !container) return

	let targetX: number

	if (dropIndex >= nonFrozenCols.length) {
		// After last column
		const lastField = String(nonFrozenCols[nonFrozenCols.length - 1].column.field)
		const lastHeader = ctx.shadow.querySelector(`th[data-field="${lastField}"]`) as HTMLElement
		if (lastHeader) {
			const rect = lastHeader.getBoundingClientRect()
			targetX = rect.right - containerRect.left + container.scrollLeft
		} else {
			return
		}
	} else {
		// Before column at dropIndex
		const field = String(nonFrozenCols[dropIndex].column.field)
		const header = ctx.shadow.querySelector(`th[data-field="${field}"]`) as HTMLElement
		if (header) {
			const rect = header.getBoundingClientRect()
			targetX = rect.left - containerRect.left + container.scrollLeft
		} else {
			return
		}
	}

	// Position indicator at visible area (accounting for scroll)
	const scrollTop = container.scrollTop
	const visibleHeight = container.clientHeight

	indicator.style.left = `${targetX}px`
	indicator.style.top = `${scrollTop}px`
	indicator.style.height = `${visibleHeight}px`
	indicator.style.display = 'block'
}

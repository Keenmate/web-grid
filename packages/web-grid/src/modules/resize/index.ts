// =============================================================================
// Column Resize Module
// =============================================================================

import { createPointerDrag, type PointerDrag } from '@keenmate/web-components-core'
import type { GridHost } from '../grid-context.js'
import { GRID_ENGINE } from '../grid-context.js'

/** An active resize (the pointer drag's state). */
interface ResizeState {
	originX: number
	startWidth: number
	field: string
	headerCell: HTMLElement
	minWidth: number
	maxWidth: number | null
}

/**
 * Parse a CSS width string (e.g., "100px") to a number
 */
function parseWidth(width: string | undefined, defaultValue: number): number {
	if (!width) return defaultValue
	const parsed = parseFloat(width)
	return isNaN(parsed) ? defaultValue : parsed
}

/** The width for a pointer at `x`, clamped to the column's min / max. */
function widthAt(state: ResizeState, x: number): number {
	let width = Math.max(state.startWidth + (x - state.originX), state.minWidth)
	if (state.maxWidth !== null) width = Math.min(width, state.maxWidth)
	return width
}

/** Show `width` on the header and body cells (and the frozen offsets) while dragging. */
function previewWidth<T>(ctx: GridHost<T>, state: ResizeState, width: number): void {
	state.headerCell.style.width = `${width}px`
	state.headerCell.style.maxWidth = `${width}px`
	updateAllColumnCells(ctx, state.field, `${width}px`)
	if (ctx[GRID_ENGINE].frozenColumnCount > 0 || ctx[GRID_ENGINE].isStickyRowNumbers) updateFrozenColumnOffsets(ctx)
}

/** Drop the resizing classes. */
function endResizeVisuals<T>(ctx: GridHost<T>): void {
	ctx.shadow.querySelector('.wg')?.classList.remove('wg--resizing')
	ctx.shadow.querySelector('.wg__resize-handle--active')?.classList.remove('wg__resize-handle--active')
}

/**
 * Column resize by dragging a header's `.wg__resize-handle` — core createPointerDrag (SPEC §12.28) on the
 * grid host: mouse, pen and touch (a finger drags the handle at once — it is `touch-action: none`),
 * Escape restores the old width. Commit: `setColumnWidth`, the `<col>`, `column-resize`, persistence.
 */
export function createColumnResize<T>(ctx: GridHost<T>, host: HTMLElement): PointerDrag {
	let state: ResizeState | null = null
	return createPointerDrag(host, {
		threshold: 0,
		longPressMs: 0,
		autoScroll: false,
		getSource: (_target, event) => {
			const handle = (event.composedPath()[0] as Element | undefined)?.closest?.('.wg__resize-handle') as HTMLElement | null
			const field = handle?.dataset.field
			const headerCell = handle?.closest('.wg__header') as HTMLElement | null
			const column = field ? ctx[GRID_ENGINE].columns.find(c => String(c.field) === field) : undefined
			if (!handle || !field || !headerCell || !column || column.isResizable === false) return null
			state = {
				originX: event.clientX,
				startWidth: headerCell.getBoundingClientRect().width,
				field,
				headerCell,
				minWidth: parseWidth(column.minWidth, 30),
				maxWidth: column.maxWidth ? parseWidth(column.maxWidth, Infinity) : null
			}
			return handle
		},
		beforeStartCallback: ({ source }) => {
			if (!state) return false
			// The header may shrink below its initial width down to the column's own minimum
			state.headerCell.style.minWidth = `${state.minWidth}px`
			ctx.shadow.querySelector('.wg')?.classList.add('wg--resizing')
			source.classList.add('wg__resize-handle--active')
		},
		moveCallback: ({ x }) => {
			if (state) previewWidth(ctx, state, widthAt(state, x))
		},
		dropCallback: ({ x }) => {
			if (!state) return
			const { field, startWidth } = state
			const newWidthStr = `${widthAt(state, x)}px`
			state = null
			// Store the width in grid state (skip re-render since we already updated inline styles)
			ctx[GRID_ENGINE].setColumnWidth(field, newWidthStr, true)
			// Update the <col> element in colgroup for table-layout: fixed
			const col = ctx.shadow.querySelector(`col[data-field="${field}"]`) as HTMLElement | null
			if (col) col.style.width = newWidthStr
			endResizeVisuals(ctx)
			ctx[GRID_ENGINE].notify('column-resize', {
				field,
				oldWidth: `${startWidth}px`,
				newWidth: newWidthStr,
				allWidths: ctx[GRID_ENGINE].getColumnWidthsState()
			})
			// Persisted UI state (storage-key + persist-column-widths; core state store)
			if (ctx[GRID_ENGINE].shouldPersistColumnWidths) ctx[GRID_ENGINE].savePersistedState()
		},
		cancelCallback: () => {
			// Escape / a cancelled pointer: back to the width it had
			if (state) previewWidth(ctx, state, state.startWidth)
			state = null
			endResizeVisuals(ctx)
		}
	})
}

/**
 * Update all cells in a column during resize for visual feedback
 */
function updateAllColumnCells<T>(ctx: GridHost<T>, field: string, width: string): void {
	// Update all body cells with this field
	const cells = ctx.shadow.querySelectorAll(`td[data-field="${field}"]`) as NodeListOf<HTMLElement>
	cells.forEach(cell => {
		cell.style.width = width
		cell.style.maxWidth = width
	})
}

// Row number column width (must match CSS)
const ROW_NUMBER_COLUMN_WIDTH = 40

/**
 * Update frozen column left offsets during resize
 * Recalculates cumulative offsets based on current widths
 */
function updateFrozenColumnOffsets<T>(ctx: GridHost<T>): void {
	const frozenCount = ctx[GRID_ENGINE].frozenColumnCount
	const hasRowNumbers = ctx[GRID_ENGINE].isRowNumbersShown && ctx[GRID_ENGINE].isStickyRowNumbers
	let offset = hasRowNumbers ? ROW_NUMBER_COLUMN_WIDTH : 0

	// Get visual columns (already sorted with frozen first)
	const visualColumns = ctx[GRID_ENGINE].visualColumns

	// Update each frozen column's left position
	for (let i = 0; i < frozenCount && i < visualColumns.length; i++) {
		const { column } = visualColumns[i]
		const field = String(column.field)

		// Update header and body cells with same offset
		const header = ctx.shadow.querySelector(`th[data-field="${field}"]`) as HTMLElement
		if (header) {
			header.style.left = `${offset}px`

			// Update all body cells in this column
			const cells = ctx.shadow.querySelectorAll(`td[data-field="${field}"]`) as NodeListOf<HTMLElement>
			cells.forEach(cell => {
				cell.style.left = `${offset}px`
			})

			// Increment offset for next column
			offset += header.getBoundingClientRect().width
		}
	}
}

/**
 * Apply all stored column widths (called after render)
 */
export function applyStoredColumnWidths<T>(ctx: GridHost<T>): void {
	const colgroup = ctx.shadow.querySelector('.wg__colgroup')
	if (!colgroup) return

	for (const column of ctx[GRID_ENGINE].columns) {
		const fieldStr = String(column.field)
		const storedWidth = ctx[GRID_ENGINE].getColumnWidth(fieldStr)
		if (storedWidth) {
			const col = colgroup.querySelector(`col[data-field="${fieldStr}"]`) as HTMLElement
			if (col) {
				col.style.width = storedWidth
			}
		}
	}
}

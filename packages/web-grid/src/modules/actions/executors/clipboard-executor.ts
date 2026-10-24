// =============================================================================
// Clipboard Executor
// Handles copy and paste actions
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction } from '../types.js'

/**
 * Clipboard executor - handles copy and paste actions
 */
export const clipboardExecutor: ActionExecutor = {
	handles: ['copy', 'paste'],

	execute(ctx: ExecutorContext, action: GridAction): GridAction[] | void {
		switch (action.type) {
			case 'copy':
				executeCopy(ctx)
				break
			case 'paste':
				// Paste is handled via the paste event on the component
				// This is a placeholder for potential future use
				break
		}
	}
}

/**
 * Copy selected cells/range to clipboard
 */
async function executeCopy(ctx: ExecutorContext): Promise<void> {
	// Get the content to copy based on current selection
	let textToCopy = ''

	// Check for cell range selection first
	if (ctx.engine.selectedCellRange) {
		const range = ctx.engine.selectedCellRange
		const { startRowIndex, endRowIndex, startColIndex, endColIndex } = range
		const minRow = Math.min(startRowIndex, endRowIndex)
		const maxRow = Math.max(startRowIndex, endRowIndex)
		const minCol = Math.min(startColIndex, endColIndex)
		const maxCol = Math.max(startColIndex, endColIndex)

		const rows: string[] = []
		for (let r = minRow; r <= maxRow; r++) {
			const cells: string[] = []
			for (let c = minCol; c <= maxCol; c++) {
				const item = ctx.engine.displayItems[r]
				const column = ctx.engine.visualColumns[c]?.column
				if (item && column) {
					const value = (item as Record<string, unknown>)[String(column.field)]
					cells.push(formatCellValue(value))
				} else {
					cells.push('')
				}
			}
			rows.push(cells.join('\t'))
		}
		textToCopy = rows.join('\n')
	}
	// Check for column selection
	else if (ctx.engine.selectedColumns.length > 0) {
		const rows: string[] = []
		const displayItems = ctx.engine.displayItems
		for (let r = 0; r < displayItems.length; r++) {
			const cells: string[] = []
			for (const colIndex of ctx.engine.selectedColumns) {
				const item = displayItems[r]
				const column = ctx.engine.visualColumns[colIndex]?.column
				if (item && column) {
					const value = (item as Record<string, unknown>)[String(column.field)]
					cells.push(formatCellValue(value))
				} else {
					cells.push('')
				}
			}
			rows.push(cells.join('\t'))
		}
		textToCopy = rows.join('\n')
	}
	// Check for row selection
	else if (ctx.engine.selectedRows.length > 0) {
		const rows: string[] = []
		const columns = ctx.engine.visualColumns
		for (const rowIndex of ctx.engine.selectedRows) {
			const item = ctx.engine.displayItems[rowIndex]
			if (item) {
				const cells: string[] = []
				for (const vc of columns) {
					const value = (item as Record<string, unknown>)[String(vc.column.field)]
					cells.push(formatCellValue(value))
				}
				rows.push(cells.join('\t'))
			}
		}
		textToCopy = rows.join('\n')
	}
	// Single focused cell
	else if (ctx.engine.focusedCell) {
		const { rowIndex, colIndex } = ctx.engine.focusedCell
		const item = ctx.engine.displayItems[rowIndex]
		const column = ctx.engine.columns[colIndex]
		if (item && column) {
			const value = (item as Record<string, unknown>)[String(column.field)]
			textToCopy = formatCellValue(value)
		}
	}

	if (textToCopy) {
		try {
			await navigator.clipboard.writeText(textToCopy)
		} catch {
			// Fallback for browsers that don't support clipboard API
			console.warn('Failed to copy to clipboard')
		}
	}
}

/**
 * Format a cell value for clipboard
 */
function formatCellValue(value: unknown): string {
	if (value === null || value === undefined) {
		return ''
	}
	if (typeof value === 'object') {
		return JSON.stringify(value)
	}
	return String(value)
}

// =============================================================================
// Paste Module (Excel/TSV multi-cell paste)
// =============================================================================

import type { GridHost } from '../grid-context.js'
import type {
	Column,
	PasteColumnMapping,
	PasteCellResult,
	PasteDetail
} from '../../types.js'
import type { BeforePasteContext } from '../../interaction.js'
import { runBeforeCallback } from '@keenmate/web-components-core'
import { typePastedText } from '../editing/value-parse.js'

/**
 * Parse TSV/CSV clipboard text into 2D array
 * Handles Excel's quoting rules for cells containing tabs/newlines
 */
export function parseTSV(text: string): string[][] {
	const rows: string[][] = []
	let currentRow: string[] = []
	let currentCell = ''
	let inQuotes = false

	for (let i = 0; i < text.length; i++) {
		const char = text[i]
		const nextChar = text[i + 1]

		if (inQuotes) {
			if (char === '"') {
				if (nextChar === '"') {
					// Escaped quote
					currentCell += '"'
					i++ // Skip next quote
				} else {
					// End of quoted section
					inQuotes = false
				}
			} else {
				currentCell += char
			}
		} else {
			if (char === '"') {
				inQuotes = true
			} else if (char === '\t') {
				currentRow.push(currentCell)
				currentCell = ''
			} else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
				currentRow.push(currentCell)
				if (currentRow.some(cell => cell !== '')) {
					rows.push(currentRow)
				}
				currentRow = []
				currentCell = ''
				if (char === '\r') i++ // Skip \n in \r\n
			} else if (char !== '\r') {
				currentCell += char
			}
		}
	}

	// Handle last cell/row
	if (currentCell !== '' || currentRow.length > 0) {
		currentRow.push(currentCell)
		if (currentRow.some(cell => cell !== '')) {
			rows.push(currentRow)
		}
	}

	return rows
}

/**
 * Detect if first row of pasted data matches column titles/fields
 * Returns mapping if match found (>50% cells match), null otherwise
 */
export function detectHeaders<T>(
	firstRow: string[],
	columns: Column<T>[]
): PasteColumnMapping[] | null {
	// Build lookup maps for both titles and field names
	const titleMap = new Map<string, { field: string; colIndex: number }>()
	const fieldMap = new Map<string, { field: string; colIndex: number }>()

	columns.forEach((col, index) => {
		if (col.isHidden) return // Skip hidden columns

		const field = String(col.field)
		const title = col.title?.toLowerCase().trim() || ''

		if (title) titleMap.set(title, { field, colIndex: index })
		fieldMap.set(field.toLowerCase(), { field, colIndex: index })
	})

	// Check how many cells match column titles/fields
	const mappings: PasteColumnMapping[] = []
	let matchCount = 0

	for (const cellValue of firstRow) {
		const normalized = cellValue.trim().toLowerCase()
		if (!normalized) continue

		// Try title match first, then field match
		const match = titleMap.get(normalized) || fieldMap.get(normalized)

		if (match) {
			matchCount++
			mappings.push({
				pastedHeader: cellValue,
				gridField: match.field,
				colIndex: match.colIndex
			})
		}
	}

	// Consider it a header row if >50% of non-empty cells match AND at least 2 matches
	const nonEmptyCells = firstRow.filter(c => c.trim() !== '').length
	const threshold = Math.max(2, Math.floor(nonEmptyCells * 0.5))

	if (matchCount >= threshold) {
		return mappings
	}

	return null
}

/**
 * Execute multi-cell paste operation
 */
export async function executePaste<T>(
	ctx: GridHost<T>,
	clipboardText: string,
	targetRowIndex: number,
	targetColIndex: number
): Promise<PasteDetail<T>> {
	const grid = ctx.engine
	const parsedRows = parseTSV(clipboardText)

	// Empty result for empty clipboard
	if (parsedRows.length === 0) {
		return {
			totalCells: 0,
			successfulCells: 0,
			failedCells: 0,
			skippedCells: 0,
			newRowsCreated: 0,
			cellResults: [],
			hadHeaders: false
		}
	}

	// Detect headers in first row
	const headerMapping = detectHeaders(parsedRows[0], grid.columns)
	const hasHeaders = headerMapping !== null
	const dataRows = hasHeaders ? parsedRows.slice(1) : parsedRows

	// Handle empty data (only had headers)
	if (dataRows.length === 0) {
		return {
			totalCells: 0,
			successfulCells: 0,
			failedCells: 0,
			skippedCells: 0,
			newRowsCreated: 0,
			cellResults: [],
			hadHeaders: hasHeaders
		}
	}

	// Get visual columns for position-based mapping
	const visualCols = grid.visualColumns

	// Check if pasting into the empty row - if so, ALL rows become new rows
	const isPastingIntoEmptyRow = grid.isEmptyRowIndex(targetRowIndex)

	// Calculate how many new rows are needed
	const existingRowCount = grid.items.length
	let newRowsCount: number
	if (isPastingIntoEmptyRow) {
		// All paste rows become new rows when pasting into empty row
		newRowsCount = dataRows.length
	} else {
		const lastDataRowIndex = targetRowIndex + dataRows.length - 1
		newRowsCount = Math.max(0, lastDataRowIndex - existingRowCount + 1)
	}

	// ctx for beforePasteCallback — `false` cancels, `skipCells` skips cells
	const beforeDetail: BeforePasteContext<T> = grid.ctx({
		rawText: clipboardText,
		parsedRows,
		hasHeaders,
		headerMapping,
		targetRowIndex,
		targetColIndex,
		newRowsCount,
		skipCells: new Set<string>()
	})

	{
		const gate = await runBeforeCallback(grid.beforePasteCallback, beforeDetail, 'beforePasteCallback')
		if (gate.isCancelled) {
			return {
				totalCells: dataRows.reduce((sum, row) => sum + row.length, 0),
				successfulCells: 0,
				failedCells: 0,
				skippedCells: dataRows.reduce((sum, row) => sum + row.length, 0),
				newRowsCreated: 0,
				cellResults: [],
				hadHeaders: hasHeaders
			}
		}
	}

	// Create new rows if needed
	let createdRowsCount = 0
	// Track the starting index for new rows (used for paste loop when pasting into empty row)
	let newRowsStartIndex = existingRowCount

	if (newRowsCount > 0) {
		const newRows: T[] = []

		for (let i = 0; i < newRowsCount; i++) {
			// When pasting into empty row, all rows are new (relativeRowIndex = i)
			// Otherwise, calculate which paste row this new row corresponds to
			const relativeRowIndex = isPastingIntoEmptyRow
				? i
				: (existingRowCount + i) - targetRowIndex
			const pastedRowData = dataRows[relativeRowIndex]

			// Collect pasted values for this row
			const pastedData: Record<string, unknown> = {}

			if (hasHeaders && headerMapping) {
				// Map by headers
				pastedRowData?.forEach((value, cellIndex) => {
					const mapping = headerMapping[cellIndex]
					if (mapping) {
						const column = grid.columns.find(c => String(c.field) === mapping.gridField)
						pastedData[mapping.gridField] = column ? typePastedText(column, value, grid.labels).value : value
					}
				})
			} else {
				// Map by position
				pastedRowData?.forEach((value, cellIndex) => {
					const colIndex = targetColIndex + cellIndex
					if (colIndex < visualCols.length) {
						const column = visualCols[colIndex].column
						pastedData[String(column.field)] = typePastedText(column, value, grid.labels).value
					}
				})
			}

			// Create the row using createRowCallback or just the pasted data
			// Note: We intentionally DON'T use createEmptyRowCallback here because
			// that would assign IDs to potentially invalid rows. IDs should only
			// be assigned when rows are validated and saved.
			let newRow: T
			if (grid.createRowCallback) {
				newRow = grid.createRowCallback(grid.ctx({ data: pastedData, rowIndex: existingRowCount + i }))
			} else {
				newRow = pastedData as T
			}

			newRows.push(newRow)
			createdRowsCount++
		}

		// Insert new rows at correct position
		if (isPastingIntoEmptyRow && grid.newRowPosition === 'top') {
			// Insert at beginning
			grid.items = [...newRows, ...grid.items]
			newRowsStartIndex = 0
		} else {
			// Append at end
			grid.items = [...grid.items, ...newRows]
			newRowsStartIndex = existingRowCount
		}
	}

	// Now paste values into cells (run validation)
	const cellResults: PasteCellResult[] = []
	const pasteMode = grid.pasteMode

	for (let relRowIndex = 0; relRowIndex < dataRows.length; relRowIndex++) {
		const row = dataRows[relRowIndex]
		// Calculate both items index (for data access) and display index (for invalid cell tracking)
		const itemsRowIndex = isPastingIntoEmptyRow
			? newRowsStartIndex + relRowIndex
			: targetRowIndex + relRowIndex
		// Display index accounts for the virtual empty row
		const displayRowIndex = isPastingIntoEmptyRow
			? (grid.newRowPosition === 'top'
				? 1 + relRowIndex  // Empty row at display[0], new rows at display[1, 2, ...]
				: grid.items.length - dataRows.length + relRowIndex)  // New rows at end, before empty row
			: targetRowIndex + relRowIndex
		// Use itemsRowIndex for data access, displayRowIndex for invalid cell tracking
		const absoluteRowIndex = itemsRowIndex

		for (let relColIndex = 0; relColIndex < row.length; relColIndex++) {
			const value = row[relColIndex]

			// Determine target field and column index
			let field: string
			let absoluteColIndex: number

			if (hasHeaders && headerMapping) {
				const mapping = headerMapping[relColIndex]
				if (!mapping) {
					// No mapping for this column - skip
					continue
				}
				field = mapping.gridField
				absoluteColIndex = mapping.colIndex
			} else {
				absoluteColIndex = targetColIndex + relColIndex
				if (absoluteColIndex >= visualCols.length) {
					// Out of bounds - skip
					cellResults.push({
						rowIndex: displayRowIndex,
						field: '',
						value,
						isValid: false,
						wasSkipped: true,
						skipReason: 'out-of-bounds'
					})
					continue
				}
				field = String(visualCols[absoluteColIndex].column.field)
			}

			// Check if user wants to skip this cell
			const cellKey = `${relRowIndex}-${relColIndex}`
			if (beforeDetail.skipCells.has(cellKey)) {
				cellResults.push({
					rowIndex: displayRowIndex,
					field,
					value,
					isValid: true,
					wasSkipped: true,
					skipReason: 'user-canceled'
				})
				continue
			}

			// Find the column
			const column = grid.columns.find(c => String(c.field) === field)
			if (!column) {
				continue
			}

			// Check editability based on paste mode
			const pasteRow = grid.displayItems[displayRowIndex]
			const isEditable = grid.isCellEditable(column, pasteRow)

			if (!isEditable) {
				if (pasteMode === 'editable-only') {
					// Block entire paste - but we're already iterating, so skip remaining
					cellResults.push({
						rowIndex: displayRowIndex,
						field,
						value,
						isValid: false,
						wasSkipped: true,
						skipReason: 'non-editable'
					})
					continue
				} else if (pasteMode === 'skip-non-editable') {
					cellResults.push({
						rowIndex: displayRowIndex,
						field,
						value,
						isValid: true,
						wasSkipped: true,
						skipReason: 'non-editable'
					})
					continue
				}
				// 'all-columns' falls through - paste anyway
			}

			// Check row locking
			// For empty row paste, use items directly (new rows); otherwise use displayItems
			const rowData = isPastingIntoEmptyRow
				? grid.items[absoluteRowIndex]
				: grid.displayItems[absoluteRowIndex]
			if (rowData && grid.isRowLocked(rowData)) {
				cellResults.push({
					rowIndex: displayRowIndex,
					field,
					value,
					isValid: true,
					wasSkipped: true,
					skipReason: 'locked'
				})
				continue
			}

			// Convert the pasted text through the column's getPasteValueCallback
			// (else the built-in typing: number / checkbox / date — an unparseable text is
			// kept and the cell marked invalid with `parseError`)
			const typed = typePastedText(column, value, grid.labels)
			let processedValue: unknown = typed.value
			let parseError: string | null = typed.error
			if (column.getPasteValueCallback && rowData) {
				processedValue = column.getPasteValueCallback(Object.assign(
					grid.cellCtx(rowData, displayRowIndex, column),
					{ text: value }
				))
				parseError = null
			}

			// Commit the value and run validation
			if (isPastingIntoEmptyRow) {
				// For empty row paste, data is already in items - just run validation
				const item = grid.items[absoluteRowIndex]
				if (item && grid.shouldValidateOnPaste && parseError) {
					grid.addInvalidCell(displayRowIndex, field, parseError)
					grid.notify('validation-error', { row: item, rowIndex: displayRowIndex, field, error: parseError, source: 'paste' })
					cellResults.push({
						rowIndex: displayRowIndex,
						field,
						value: processedValue,
						isValid: false,
						validationError: parseError,
						wasSkipped: false
					})
				} else if (item && grid.shouldValidateOnPaste && column.validateCallback) {
					const context = grid.ctx({
						row: item,
						rowIndex: absoluteRowIndex,
						column,
						colIndex: grid.columns.indexOf(column),
						field,
						value: processedValue,
						oldValue: undefined,
						source: 'paste' as const
					})
					// Same result contract as an editor commit (null / undefined / true = valid)
					const result = await Promise.resolve(column.validateCallback(context))
					const normalized = grid.normalizeValidationResult(result, processedValue)
					const isValid = normalized.valid
					const errorMsg = normalized.message

					if (!isValid) {
						// Use displayRowIndex for invalid cell tracking (render uses display indices)
						grid.addInvalidCell(displayRowIndex, field, errorMsg || 'Invalid value')
						grid.notify('validation-error', { row: item, rowIndex: displayRowIndex, field, error: errorMsg || 'Invalid value', source: 'paste' })
					}

					cellResults.push({
						rowIndex: displayRowIndex,
						field,
						value: processedValue,
						isValid,
						validationError: isValid ? undefined : errorMsg,
						wasSkipped: false
					})
				} else {
					cellResults.push({
						rowIndex: displayRowIndex,
						field,
						value: processedValue,
						isValid: true,
						wasSkipped: false
					})
				}
			} else if (grid.shouldValidateOnPaste) {
				// Use commitEdit which handles validation
				await grid.commitEdit(displayRowIndex, field, processedValue, false, 'paste', parseError)

				// Check if cell is now invalid (rowKey, not displayRowIndex — invalidCells
				// are keyed by stable id post-rc15)
				const pasteRowKey = grid.displayItems[displayRowIndex] !== undefined
					? grid.getStableRowKey(grid.displayItems[displayRowIndex], displayRowIndex)
					: null
				const invalidCell = pasteRowKey !== null
					? grid.invalidCells.find(c => c.rowKey === pasteRowKey && c.field === field)
					: undefined

				cellResults.push({
					rowIndex: displayRowIndex,
					field,
					value: processedValue,
					isValid: !invalidCell,
					validationError: invalidCell?.error,
					wasSkipped: false
				})
			} else {
				// Skip validation - update items directly
				const item = grid.items[absoluteRowIndex]
				if (item) {
					(item as Record<string, unknown>)[field] = processedValue
				}

				cellResults.push({
					rowIndex: displayRowIndex,
					field,
					value: processedValue,
					isValid: true,
					wasSkipped: false
				})
			}
		}
	}

	// Calculate summary
	const successfulCells = cellResults.filter(r => !r.wasSkipped && r.isValid).length
	const failedCells = cellResults.filter(r => !r.wasSkipped && !r.isValid).length
	const skippedCells = cellResults.filter(r => r.wasSkipped).length

	const pasteDetail: PasteDetail<T> = {
		totalCells: cellResults.length,
		successfulCells,
		failedCells,
		skippedCells,
		newRowsCreated: createdRowsCount,
		cellResults,
		hadHeaders: hasHeaders
	}

	grid.notify('paste-complete', pasteDetail)

	return pasteDetail
}

/**
 * Top-level paste event handler — wired on the GridElement itself so it
 * fires for any paste while the grid has focus. Only does work in navigate
 * mode with a focused cell and no in-progress edit; the editor's own
 * default paste handles edit-mode pasting.
 *
 * Multi-cell detection: presence of tab or newline. Multi-cell goes through
 * executePaste (TSV parse + header detection + per-cell validation + new-
 * row creation). Single-cell takes the direct path: column.getPasteValueCallback
 * converts, then grid.commitEdit. Both paths render after.
 */
export async function handlePasteEvent<T>(ctx: GridHost<T>, e: ClipboardEvent): Promise<void> {
	// Only in navigate mode with focused cell, not while editing
	if (!ctx.engine.isNavigateMode || ctx.engine.editingCell || !ctx.engine.focusedCell) return

	const { rowIndex, colIndex } = ctx.engine.focusedCell
	const text = e.clipboardData?.getData('text') || ''
	if (!text) return

	// Check if this is multi-cell paste (contains tabs or multiple lines)
	const isMultiCell = text.includes('\t') || text.includes('\n')

	if (isMultiCell) {
		// Multi-cell paste - use paste module
		e.preventDefault()
		await executePaste(ctx, text, rowIndex, colIndex)
		ctx.render()
	} else {
		// Single cell paste - original behavior
		const column = ctx.engine.columns[colIndex]
		const row = ctx.engine.displayItems[rowIndex]
		if (!column || !row) return

		// Check if cell is editable
		if (!ctx.engine.isCellEditable(column, row)) return

		e.preventDefault()

		const typed = typePastedText(column, text, ctx.engine.labels)
		let processedText: unknown = typed.value
		let parseError: string | null = typed.error
		if (column.getPasteValueCallback) {
			processedText = column.getPasteValueCallback(Object.assign(ctx.engine.cellCtx(row, rowIndex, column, colIndex), { text }))
			parseError = null
		}

		// Commit the pasted value
		const field = String(column.field)
		await ctx.engine.commitEdit(rowIndex, field, processedText, false, 'paste', parseError)
		ctx.render()
	}
}

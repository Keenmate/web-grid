// =============================================================================
// Dropdown Executor
// Handles openDropdown, closeDropdown, toggleDropdown, dropdownNavigate, dropdownSelect actions
// =============================================================================

import type { ActionExecutor, ExecutorContext } from '../pipeline.js'
import type { GridAction, DropdownNavigateAction, DropdownSelectAction, NavigateAction } from '../types.js'
import {
	openDropdownForCurrentEditor,
	removeDropdown,
	selectDropdownOption,
	updateDropdownHighlight,
	scrollHighlightedIntoView,
	isOptionDisabled,
	getOptionValue
} from '../../dropdown/index.js'
import { renderCell } from '../../rendering/index.js'

/**
 * Dropdown executor - handles dropdown open/close/toggle/navigate/select actions
 */
export const dropdownExecutor: ActionExecutor = {
	handles: ['openDropdown', 'closeDropdown', 'toggleDropdown', 'dropdownNavigate', 'dropdownSelect'],

	execute(ctx: ExecutorContext, action: GridAction): GridAction[] | void {
		switch (action.type) {
			case 'openDropdown':
				openDropdownForCurrentEditor(ctx)
				break
			case 'closeDropdown':
				removeDropdown(ctx)
				break
			case 'toggleDropdown':
				if (ctx.dropdown.isOpen) {
					removeDropdown(ctx)
				} else {
					openDropdownForCurrentEditor(ctx)
				}
				break
			case 'dropdownNavigate':
				return executeDropdownNavigate(ctx, action)
			case 'dropdownSelect':
				return executeDropdownSelect(ctx, action)
		}
	}
}

/** Number of items to jump for page-up/page-down */
const PAGE_JUMP_SIZE = 10

/**
 * Execute dropdown navigate action (up/down/page-up/page-down through options)
 */
function executeDropdownNavigate(ctx: ExecutorContext, action: DropdownNavigateAction): void {
	if (!ctx.dropdown.isOpen) return

	const opts = ctx.getCurrentEditorOptions()
	let newIndex = ctx.dropdown.highlightedIndex
	const optionsCount = ctx.dropdown.options.length

	switch (action.direction) {
		case 'up':
			newIndex = ctx.dropdown.highlightedIndex - 1
			// Find previous non-disabled option
			while (newIndex >= 0 && isOptionDisabled(ctx.dropdown.options[newIndex], opts)) {
				newIndex--
			}
			if (newIndex < 0) return // No valid option above
			break

		case 'down':
			newIndex = ctx.dropdown.highlightedIndex + 1
			// Find next non-disabled option
			while (newIndex < optionsCount && isOptionDisabled(ctx.dropdown.options[newIndex], opts)) {
				newIndex++
			}
			if (newIndex >= optionsCount) return // No valid option below
			break

		case 'page-up':
			newIndex = Math.max(0, ctx.dropdown.highlightedIndex - PAGE_JUMP_SIZE)
			// Find nearest non-disabled option at or after target
			while (newIndex < ctx.dropdown.highlightedIndex && isOptionDisabled(ctx.dropdown.options[newIndex], opts)) {
				newIndex++
			}
			// If all options up to current are disabled, stay put
			if (newIndex >= ctx.dropdown.highlightedIndex) return
			break

		case 'page-down':
			newIndex = Math.min(optionsCount - 1, ctx.dropdown.highlightedIndex + PAGE_JUMP_SIZE)
			// Find nearest non-disabled option at or before target
			while (newIndex > ctx.dropdown.highlightedIndex && isOptionDisabled(ctx.dropdown.options[newIndex], opts)) {
				newIndex--
			}
			// If all options down to current are disabled, stay put
			if (newIndex <= ctx.dropdown.highlightedIndex) return
			break

		case 'home':
			newIndex = 0
			// Find first non-disabled option
			while (newIndex < optionsCount && isOptionDisabled(ctx.dropdown.options[newIndex], opts)) {
				newIndex++
			}
			if (newIndex >= optionsCount) return // All options disabled
			break

		case 'end':
			newIndex = optionsCount - 1
			// Find last non-disabled option
			while (newIndex >= 0 && isOptionDisabled(ctx.dropdown.options[newIndex], opts)) {
				newIndex--
			}
			if (newIndex < 0) return // All options disabled
			break
	}

	ctx.dropdown.setHighlightedIndex(newIndex)
	ctx.dropdown.setUserInteracted(true)
	updateDropdownHighlight(ctx)
	scrollHighlightedIntoView(ctx)
}

/**
 * Execute dropdown select action (select highlighted option)
 * Works with both editingCell (normal edit mode) and focusedCell ('always' edit mode)
 */
function executeDropdownSelect(ctx: ExecutorContext, action: DropdownSelectAction): GridAction[] | void {
	if (!ctx.dropdown.isOpen || ctx.dropdown.highlightedIndex < 0) {
		// No dropdown or nothing highlighted - just close and maybe navigate
		removeDropdown(ctx)
		if (action.thenNavigate) {
			const navigateAction: NavigateAction = {
				type: 'navigate',
				direction: action.thenNavigate
			}
			return [navigateAction]
		}
		return
	}

	const option = ctx.dropdown.options[ctx.dropdown.highlightedIndex]
	if (!option) return

	// Get cell info - prefer editingCell, fall back to focusedCell for 'always' mode
	const editingCell = ctx.engine.editingCell
	const focusedCell = ctx.engine.focusedCell
	const cellInfo = editingCell
		? { rowIndex: editingCell.rowIndex, field: editingCell.field, colIndex: ctx.engine.columns.findIndex(c => String(c.field) === editingCell.field) }
		: focusedCell
			? { rowIndex: focusedCell.rowIndex, field: String(ctx.engine.columns[focusedCell.colIndex]?.field), colIndex: focusedCell.colIndex }
			: null

	if (!cellInfo) return

	const { rowIndex, field, colIndex } = cellInfo

	// Get column for editorOptions
	const column = ctx.engine.columns[colIndex]
	const opts = column?.editorOptions || {}

	if (isOptionDisabled(option, opts)) return

	const value = getOptionValue(option, opts)
	const row = ctx.engine.displayItems[rowIndex]

	// Notify editorOptions.onSelect
	if (opts.onSelect && row && column) {
		opts.onSelect({ ...ctx.engine.cellCtx(row, rowIndex, column, colIndex), option })
	}

	ctx.dropdown.setJustSelected(true)
	ctx.isCommittingFromKeyboard = true
	removeDropdown(ctx)
	ctx.engine.commitEdit(rowIndex, field, value, action.commitEmptyRow ?? false)

	// If thenNavigate is specified (Tab key), navigate after select
	if (action.thenNavigate) {
		// Re-render current cell first to show new value
		renderCell(ctx, rowIndex, colIndex)

		// Reset justSelected synchronously before navigating.
		// The flag was needed to prevent dropdown re-opening during commit on
		// the current cell, but the commit is done and the cell is re-rendered.
		// The NEXT cell's dropdown must be able to open normally.
		ctx.dropdown.setJustSelected(false)

		// Return navigate action
		const navigateAction: NavigateAction = {
			type: 'navigate',
			direction: action.thenNavigate,
			from: { rowIndex, colIndex }
		}
		return [navigateAction]
	}

	if (action.moveAfterSelect) {
		// Move focus to next row in same column (like Enter does)
		ctx.moveFocusAfterCommit(rowIndex, field, 'down')
	} else {
		// Stay on current cell - re-render to show new value
		renderCell(ctx, rowIndex, colIndex)
	}

	// Reset justSelected after focus moves
	requestAnimationFrame(() => {
		ctx.dropdown.setJustSelected(false)
	})
}

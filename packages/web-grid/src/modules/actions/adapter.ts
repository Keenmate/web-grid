// =============================================================================
// Action Pipeline Adapter
// Bridge between DOM events and the action pipeline
// Enables incremental migration by checking mode before using pipeline
// =============================================================================

import type { GridHost } from '../grid-context.js'
import { ActionPipeline, createActionPipeline, ActionExecutor } from './pipeline.js'
import { focusExecutor } from './executors/focus-executor.js'
import { navigateExecutor } from './executors/navigate-executor.js'
import { transitionExecutor } from './executors/transition-executor.js'
import { renderExecutor } from './executors/render-executor.js'
import { dropdownExecutor } from './executors/dropdown-executor.js'
import { noopExecutor } from './executors/noop-executor.js'
import { checkboxExecutor } from './executors/checkbox-executor.js'
import { datepickerExecutor } from './executors/datepicker-executor.js'
import { editExecutor } from './executors/edit-executor.js'
import { selectionExecutor } from './executors/selection-executor.js'
import { clipboardExecutor } from './executors/clipboard-executor.js'
import { contextMenuExecutor } from './executors/context-menu-executor.js'
import { fillHandleExecutor } from './executors/fill-handle-executor.js'
import { cellSelectionExecutor } from './executors/cell-selection-executor.js'
import { macroExecutor } from './executors/macro-executor.js'
import { customEditorExecutor } from './executors/custom-editor-executor.js'
import { mapKeyDownToAction, isPipelineKey, mapMouseDownToActions } from './event-mapper.js'
import { getCursorPositionFromClick } from '../navigation/focus.js'
import type { CellCoordinates } from './types.js'
import { extendCellRangeTo, extendCellRangeByKey, isRangeExtensionKey } from '../cell-selection/index.js'

/**
 * Adapter that bridges GridElement event handlers with the action pipeline.
 * Handles all editTrigger modes: always, navigate, click, dblclick
 */
export class ActionPipelineAdapter<T = unknown> {
	private pipeline: ActionPipeline<T>
	private ctx: GridHost<T>

	constructor(ctx: GridHost<T>) {
		this.ctx = ctx
		this.pipeline = createActionPipeline(ctx)

		// Register all executors (cast needed as executors are type-agnostic)
		this.pipeline.registerExecutor(focusExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(navigateExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(transitionExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(renderExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(dropdownExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(checkboxExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(datepickerExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(editExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(selectionExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(clipboardExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(contextMenuExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(fillHandleExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(cellSelectionExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(macroExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(customEditorExecutor as ActionExecutor<T>)
		this.pipeline.registerExecutor(noopExecutor as ActionExecutor<T>)
	}

	/**
	 * Get the effective editTrigger for a column
	 */
	private getEditTrigger(colIndex: number): 'always' | 'navigate' | 'click' | 'dblclick' {
		const column = this.ctx.engine.columns[colIndex]
		if (!column) return 'navigate'
		return (column.editTrigger ?? this.ctx.engine.editTrigger) as 'always' | 'navigate' | 'click' | 'dblclick'
	}

	/**
	 * Check if a cell is in 'always' editTrigger mode
	 */
	private isAlwaysMode(colIndex: number): boolean {
		// Not "always" mode if grid isn't editable
		if (!this.ctx.engine.isEditable) {
			return false
		}
		return this.getEditTrigger(colIndex) === 'always'
	}

	/**
	 * Check if a specific cell is currently being edited
	 */
	private isEditingCell(rowIndex: number, colIndex: number): boolean {
		const editingCell = this.ctx.engine.editingCell
		if (!editingCell) return false
		const column = this.ctx.engine.columns[colIndex]
		if (!column) return false
		return editingCell.rowIndex === rowIndex && editingCell.field === String(column.field)
	}

	/**
	 * Check if a column has a dropdown editor (select, combobox, autocomplete)
	 */
	private isDropdownEditor(colIndex: number): boolean {
		const column = this.ctx.engine.columns[colIndex]
		if (!column) return false
		const editor = column.editor
		return editor === 'select' || editor === 'combobox' || editor === 'autocomplete'
	}

	/**
	 * Check if a column has a checkbox editor
	 */
	private isCheckboxEditor(colIndex: number): boolean {
		const column = this.ctx.engine.columns[colIndex]
		if (!column) return false
		return column.editor === 'checkbox'
	}

	/**
	 * Check if a column has a date editor
	 */
	private isDateEditor(colIndex: number): boolean {
		const column = this.ctx.engine.columns[colIndex]
		if (!column) return false
		return column.editor === 'date'
	}

	/**
	 * Check if a column has a custom editor
	 */
	private isCustomEditor(colIndex: number): boolean {
		const column = this.ctx.engine.columns[colIndex]
		if (!column) return false
		return column.editor === 'custom'
	}

	/**
	 * Get the dropdown editor type for a column
	 */
	private getDropdownEditorType(colIndex: number): 'select' | 'combobox' | 'autocomplete' | undefined {
		const column = this.ctx.engine.columns[colIndex]
		if (!column) return undefined
		const editor = column.editor
		if (editor === 'select' || editor === 'combobox' || editor === 'autocomplete') {
			return editor
		}
		return undefined
	}

	/**
	 * Get the current cell coordinates from the event target
	 */
	private getCellFromTarget(target: HTMLElement): CellCoordinates | null {
		// Target could be an editor inside a cell, or the cell itself
		const cell = target.closest('.wg__cell') as HTMLElement
		if (!cell) return null

		const rowIndex = parseInt(cell.dataset.row || '', 10)
		const colIndex = parseInt(cell.dataset.col || '', 10)

		if (isNaN(rowIndex) || isNaN(colIndex)) return null

		return { rowIndex, colIndex }
	}

	/**
	 * Try to handle a keydown event via the pipeline.
	 * Returns true if the event was handled, false to fall through to existing handlers.
	 */
	tryHandleKeyDown(e: KeyboardEvent): boolean {
		const target = e.target as HTMLElement
		const cell = this.getCellFromTarget(target)


		if (!cell) return false

		// If datepicker is open, let navigation keys pass through to datepicker
		// The datepicker has its own document-level keyboard handler
		if (this.ctx.datepicker) {
			const datepickerKeys = [
				'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
				'PageUp', 'PageDown', 'Home', 'End',
				'Enter', 'Escape', 'Tab'
			]
			if (datepickerKeys.includes(e.key)) {
				return false  // Let datepicker handle it
			}
		}

		const editTrigger = this.getEditTrigger(cell.colIndex)
		const isAlways = this.isAlwaysMode(cell.colIndex)
		const isEditing = this.isEditingCell(cell.rowIndex, cell.colIndex)
		const dropdownOpen = this.ctx.dropdown.isOpen
		const isDropdown = this.isDropdownEditor(cell.colIndex)
		const isCheckbox = this.isCheckboxEditor(cell.colIndex)
		const isDate = this.isDateEditor(cell.colIndex)

		// For 'always' mode, use full pipeline key handling
		if (isAlways) {
			if (!isPipelineKey(e.key, dropdownOpen, isDropdown, isCheckbox)) return false

			const action = mapKeyDownToAction(e, {
				currentCell: cell,
				dropdownOpen,
				isDropdownEditor: isDropdown,
				isCheckboxEditor: isCheckbox,
				editorType: this.getDropdownEditorType(cell.colIndex)
			})
			if (!action) return false

			e.preventDefault()
			e.stopPropagation()
			this.pipeline.dispatch(action)
			return true
		}

		// For other modes, behavior depends on whether we're editing
		if (isEditing) {
			const isHorizontalArrow = e.key === 'ArrowLeft' || e.key === 'ArrowRight'

			// In navigate mode, Left/Right on dropdown editors cancel edit and navigate
			// (allows quick traversal between cells even when dropdown is auto-opened)
			if (isHorizontalArrow && editTrigger === 'navigate' && isDropdown) {
				e.preventDefault()
				e.stopPropagation()
				this.pipeline.dispatch({ type: 'cancelEdit' })
				this.pipeline.dispatch({
					type: 'navigate',
					direction: e.key === 'ArrowLeft' ? 'left' : 'right',
					from: cell
				})
				return true
			}

			// In navigate mode with dropdown open, Tab/Shift+Tab behavior depends on
			// whether the user actively navigated within the dropdown
			if (e.key === 'Tab' && editTrigger === 'navigate' && dropdownOpen) {
				e.preventDefault()
				e.stopPropagation()
				if (this.ctx.dropdown.userInteracted) {
					// User navigated the dropdown — select highlighted option and move
					this.pipeline.dispatch({
						type: 'dropdownSelect',
						moveAfterSelect: false,
						thenNavigate: e.shiftKey ? 'tab-back' : 'tab'
					})
				} else {
					// Dropdown auto-opened, user didn't interact — just traverse
					this.pipeline.dispatch({ type: 'cancelEdit' })
					this.pipeline.dispatch({
						type: 'navigate',
						direction: e.shiftKey ? 'tab-back' : 'tab',
						from: cell
					})
				}
				return true
			}

			// While editing: handle navigation/commit/cancel keys
			const isPipeline = isPipelineKey(e.key, dropdownOpen, isDropdown, isCheckbox)
			if (!isPipeline) return false

			// For text inputs (not dropdown editors), let horizontal arrows pass through for cursor movement
			// Exception: if dropdown is open, capture arrows for option navigation
			const isTextEditor = !isDropdown && !isCheckbox && !isDate
			if (isTextEditor && isHorizontalArrow && !dropdownOpen) {
				return false  // Let browser handle cursor movement
			}

			const action = mapKeyDownToAction(e, {
				currentCell: cell,
				dropdownOpen,
				isDropdownEditor: isDropdown,
				isCheckboxEditor: isCheckbox,
				editorType: this.getDropdownEditorType(cell.colIndex)
			})
			if (!action) return false

			e.preventDefault()
			e.stopPropagation()
			this.pipeline.dispatch(action)
			return true
		}

		// Not editing: Shift+Arrow / Shift+Home/End / Ctrl+Shift+Arrow grow or shrink the
		// cell range from the focused cell (the anchor keeps focus)
		if (isRangeExtensionKey(e) && this.ctx.engine.cellSelectionMode !== 'disabled') {
			e.preventDefault()
			e.stopPropagation()
			extendCellRangeByKey(this.ctx, e)
			return true
		}

		// Not editing (navigate mode): handle navigation and edit-start keys
		// Navigation keys move focus between cells
		const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'PageUp', 'PageDown']
		if (navKeys.includes(e.key)) {
			const action = mapKeyDownToAction(e, {
				currentCell: cell,
				dropdownOpen: false,
				isDropdownEditor: false,
				isCheckboxEditor: false
			})
			if (!action) return false

			e.preventDefault()
			e.stopPropagation()
			this.pipeline.dispatch(action)
			return true
		}

		// F2 starts edit
		if (e.key === 'F2') {
			const isCustom = this.isCustomEditor(cell.colIndex)
			e.preventDefault()
			e.stopPropagation()
			this.pipeline.dispatch({
				type: 'startEdit',
				target: cell
			})
			// Open dropdown/datepicker/custom editor
			if (isDropdown) {
				this.pipeline.dispatch({ type: 'openDropdown' })
			} else if (isDate) {
				this.pipeline.dispatch({ type: 'openDatePicker' })
			} else if (isCustom) {
				this.pipeline.dispatch({ type: 'openCustomEditor', target: cell })
			}
			return true
		}

		// Enter starts edit for dropdown/date editors, or moves down for others
		if (e.key === 'Enter') {
			if (isDate) {
				// Date always starts edit + opens picker on Enter
				e.preventDefault()
				e.stopPropagation()
				this.pipeline.dispatch({ type: 'startEdit', target: cell })
				this.pipeline.dispatch({ type: 'openDatePicker' })
				return true
			}
			// Checkbox: Enter navigates down (Space toggles), so fall through
			if (isDropdown) {
				const column = this.ctx.engine.columns[cell.colIndex]
				if (column && this.ctx.engine.getEffectiveShouldOpenDropdownOnEnter(column)) {
					e.preventDefault()
					e.stopPropagation()
					this.pipeline.dispatch({ type: 'startEdit', target: cell })
					this.pipeline.dispatch({ type: 'openDropdown' })
					return true
				}
				// shouldOpenDropdownOnEnter is false: fall through to move down
				return false
			}
			// Text editors: fall through to move down
			return false
		}

		// Space starts edit for dropdown/date/checkbox/custom editors
		if (e.key === ' ') {
			const isCustom = this.isCustomEditor(cell.colIndex)
			if (isDropdown || isDate || isCheckbox || isCustom) {
				e.preventDefault()
				e.stopPropagation()
				if (isCheckbox) {
					this.pipeline.dispatch({ type: 'toggleCheckbox', target: cell })
				} else {
					this.pipeline.dispatch({ type: 'startEdit', target: cell })
					if (isDropdown) {
						this.pipeline.dispatch({ type: 'openDropdown' })
					} else if (isDate) {
						this.pipeline.dispatch({ type: 'openDatePicker' })
					} else if (isCustom) {
						this.pipeline.dispatch({ type: 'openCustomEditor', target: cell })
					}
				}
				return true
			}
		}

		// Delete clears cell content (Ctrl/Cmd+Delete is the row-delete request — cell keydown)
		if (e.key === 'Delete' && !e.ctrlKey && !e.metaKey) {
			e.preventDefault()
			e.stopPropagation()
			this.pipeline.dispatch({ type: 'deleteCell', target: cell })
			return true
		}

		// Ctrl+C copies selection
		if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
			e.preventDefault()
			e.stopPropagation()
			this.pipeline.dispatch({ type: 'copy' })
			return true
		}

		// Printable character starts edit with initial value
		if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
			// Don't dispatch startEdit if we're already editing this cell
			// (Let native input handle subsequent keystrokes)
			if (this.isEditingCell(cell.rowIndex, cell.colIndex)) {
				return false  // Already editing, let native input handle it
			}

			// Number columns: only a digit / minus / decimal point starts editing
			if (this.ctx.engine.columns[cell.colIndex]?.editor === 'number' && !/[\d.\-]/.test(e.key)) {
				return true  // consumed: a letter on a number cell does nothing
			}

			e.preventDefault()
			e.stopPropagation()

			const isCustom = this.isCustomEditor(cell.colIndex)

			this.pipeline.dispatch({
				type: 'startEdit',
				target: cell,
				initialSearchQuery: e.key
			})
			if (isDropdown) {
				this.pipeline.dispatch({ type: 'openDropdown' })
			} else if (isCustom) {
				this.pipeline.dispatch({ type: 'openCustomEditor', target: cell })
			}
			return true
		}

		return false
	}

	/** True when the pointer is over an enabled (isCheckboxAlwaysEditable) display checkbox. */
	private isClickOnEnabledDisplayCheckbox(e: MouseEvent, target: HTMLElement): boolean {
		if (!this.ctx.engine.isCheckboxAlwaysEditable) return false
		const checkbox = target.closest('.wg__cell')?.querySelector('.wg__checkbox-display') as HTMLInputElement | null
		if (!checkbox || checkbox.disabled) return false
		const r = checkbox.getBoundingClientRect()
		return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
	}

	/**
	 * Try to handle a focus event via the pipeline.
	 * Returns true if the event was handled.
	 */
	tryHandleFocus(e: FocusEvent): boolean {
		const target = e.target as HTMLElement
		const cell = this.getCellFromTarget(target)

		if (!cell) return false

		// Only handle 'always' mode cells for Phase 1
		if (!this.isAlwaysMode(cell.colIndex)) {
			return false
		}

		// Check if focus is on an editor element
		const isEditorFocus = target.matches(
			'.wg__editor, .wg__combobox-input, .wg__autocomplete-input, .wg__date-input, .wg__select-trigger'
		)

		if (!isEditorFocus) {
			return false
		}

		// Update focus state if cell changed
		const currentFocus = this.ctx.engine.focusedCell
		if (!currentFocus || currentFocus.rowIndex !== cell.rowIndex || currentFocus.colIndex !== cell.colIndex) {
			this.pipeline.dispatch({
				type: 'focusCell',
				target: cell,
				selectText: false  // Don't re-select on focus events (already focused)
			})
		}

		return true
	}

	/**
	 * Try to handle a mousedown event via the pipeline.
	 * Returns true if the event was handled, false to fall through to existing handlers.
	 */
	tryHandleMouseDown(e: MouseEvent): boolean {
		const target = e.target as HTMLElement

		// Check what kind of click this is
		const isToggleClick = target.matches('.wg__combobox-toggle, .wg__select-toggle')
		const isDateTriggerClick = !!target.closest('.wg__date-trigger')
		const isCheckboxClick = target.matches('.wg__checkbox-input, input[type="checkbox"]')
		const isCellClick = !isToggleClick && !isDateTriggerClick && !isCheckboxClick && (
			target.matches('.wg__cell') ||
			target.closest('.wg__cell') !== null
		)

		// Get cell coordinates
		let cell: CellCoordinates | null = null

		if (isToggleClick) {
			// For toggle clicks, get cell info from editor or display container
			const container = (
				target.closest('.wg__editor--select, .wg__editor--combobox, .wg__editor--autocomplete') ||
				target.closest('.wg__cell-dropdown-display')
			) as HTMLElement
			if (container) {
				const rowIndex = parseInt(container.dataset.row || '', 10)
				const field = container.dataset.field || ''
				const colIndex = this.ctx.engine.columns.findIndex(c => String(c.field) === field)
				if (!isNaN(rowIndex) && colIndex >= 0) {
					cell = { rowIndex, colIndex }
				}
			}
		} else if (isDateTriggerClick) {
			// For date trigger clicks, get cell info from date editor or display container
			const container = (target.closest('.wg__editor--date') || target.closest('.wg__cell-date-display')) as HTMLElement
			if (container) {
				const rowIndex = parseInt(container.dataset.row || '', 10)
				const field = container.dataset.field || ''
				const colIndex = this.ctx.engine.columns.findIndex(c => String(c.field) === field)
				if (!isNaN(rowIndex) && colIndex >= 0) {
					cell = { rowIndex, colIndex }
				}
			}
		} else {
			cell = this.getCellFromTarget(target)
		}

		if (!cell) return false

		// Clear tab traversal tracking on mouse click
		this.ctx.engine.tabTraversalStartColIndex = null

		const isAlways = this.isAlwaysMode(cell.colIndex)
		const isEditing = this.isEditingCell(cell.rowIndex, cell.colIndex)

		// Handle toggle clicks, date trigger clicks, checkbox clicks, and cell clicks
		if (!isToggleClick && !isDateTriggerClick && !isCheckboxClick && !isCellClick) {
			return false
		}

		// Check for shift+click cell selection BEFORE 'always' mode handling
		// In 'shift' selection mode, shift+click should select cells, not edit
		const selectionMode = this.ctx.engine.cellSelectionMode
		const isShiftClick = e.shiftKey
		if (selectionMode === 'shift' && isShiftClick && isCellClick) {
			this.pipeline.dispatch({
				type: 'startCellSelection',
				rowIndex: cell.rowIndex,
				colIndex: cell.colIndex,
				clientX: e.clientX,
				clientY: e.clientY,
				shiftKey: true
			})
			e.preventDefault()
			return true
		}

		// 'click' mode: Shift+click extends the range from the focused cell (the anchor
		// keeps focus — no default mousedown focus move, no edit start)
		if (selectionMode === 'click' && isShiftClick && isCellClick && !isAlways && !isEditing && this.ctx.engine.focusedCell) {
			e.preventDefault()
			e.stopPropagation()
			extendCellRangeTo(this.ctx, cell.rowIndex, cell.colIndex)
			return true
		}

		// isCheckboxAlwaysEditable: the display checkbox is enabled — one click on it toggles
		// it (the same toggle as Space on a focused checkbox cell). The display checkbox has
		// `pointer-events: none` (clicks land on the cell), so hit-test its box.
		if (!isAlways && !isEditing && this.isClickOnEnabledDisplayCheckbox(e, target)) {
			e.preventDefault()
			this.pipeline.dispatch({ type: 'focusCell', target: cell, selectText: false })
			this.pipeline.dispatch({ type: 'toggleCheckbox', target: cell })
			return true
		}

		// For 'always' mode or when editing: use full mouse handling
		if (isAlways || isEditing) {
			// For text-like inputs in the same editing cell, let native behavior handle
			// cursor repositioning. Don't dispatch focusCell (which would call cell.focus()
			// and trigger focusout on the input — closing the datepicker for date editors).
			const isTextInput = target.matches('.wg__editor--text, .wg__editor--number, .wg__date-input')
			// Also treat combobox/autocomplete inputs as text inputs for cursor repositioning
			const isComboboxInput = target.matches('.wg__combobox-input, .wg__autocomplete-input')

			// Check if clicking on already-focused cell (for cursor repositioning)
			const currentFocus = this.ctx.engine.focusedCell
			const isAlreadyFocused = currentFocus &&
				currentFocus.rowIndex === cell.rowIndex &&
				currentFocus.colIndex === cell.colIndex

			// Let native handle cursor repositioning for text/combobox inputs on already-focused cells
			if ((isTextInput || isComboboxInput) && isAlreadyFocused && isCellClick) {
				return true
			}

			// Clear any active selections when clicking on a cell (shift+click is handled above)
			// Set transitioning flag to prevent focusout handler from clearing focus
			const hadCellRangeSelection = isCellClick && this.ctx.engine.selectedCellRange
			const hadAnySelection = isCellClick && (
				hadCellRangeSelection ||
				this.ctx.engine.selectedRows.length > 0 ||
				this.ctx.engine.selectedColumns.length > 0
			)
			if (hadAnySelection) {
				if (hadCellRangeSelection) {
					this.ctx.isTransitioningCells = true
				}
				this.pipeline.dispatch({ type: 'clearSelection' })
			}

			const dropdownOpen = this.ctx.dropdown.isOpen
			const isDropdown = this.isDropdownEditor(cell.colIndex)

			const actions = mapMouseDownToActions(e, {
				cell,
				dropdownOpen,
				isDropdownEditor: isDropdown,
				isDateEditor: this.isDateEditor(cell.colIndex),
				isCheckboxEditor: this.isCheckboxEditor(cell.colIndex),
				isToggleClick,
				isDateTriggerClick,
				isCheckboxClick,
				isCellClick
			})

			if (actions.length === 0) {
				if (hadCellRangeSelection) {
					this.ctx.isTransitioningCells = false
				}
				return false
			}

			if (!isTextInput) {
				e.preventDefault()
				e.stopPropagation()
			}

			for (const action of actions) {
				this.pipeline.dispatch(action)
			}

			// Clear transitioning flag after focus has settled
			if (hadCellRangeSelection) {
				requestAnimationFrame(() => {
					this.ctx.isTransitioningCells = false
				})
			}

			return true
		}

		// Toggle click in non-editing mode: start edit and open dropdown via pipeline
		if (isToggleClick) {
			e.preventDefault()
			e.stopPropagation()

			if (this.ctx.engine.editingCell) {
				this.pipeline.dispatch({ type: 'cancelEdit' })
			}

			this.pipeline.dispatch({
				type: 'focusCell',
				target: cell,
				selectText: false
			})

			this.pipeline.dispatch({
				type: 'startEdit',
				target: cell
			})

			this.pipeline.dispatch({ type: 'openDropdown' })

			return true
		}

		// Date trigger click in non-editing mode: start edit and open datepicker via pipeline
		if (isDateTriggerClick) {
			e.preventDefault()
			e.stopPropagation()

			if (this.ctx.engine.editingCell) {
				this.pipeline.dispatch({ type: 'cancelEdit' })
			}

			this.pipeline.dispatch({
				type: 'focusCell',
				target: cell,
				selectText: false
			})

			this.pipeline.dispatch({
				type: 'startEdit',
				target: cell
			})

			this.pipeline.dispatch({ type: 'openDatePicker' })

			return true
		}

		// For non-always modes when not editing: focus the cell and optionally start cell selection
		// (Click/dblclick modes handle edit start separately)
		if (isCellClick && !isToggleClick && !isCheckboxClick) {
			// Must preventDefault to stop browser from stealing focus after our programmatic focus
			// Note: Don't stopPropagation() - it can interfere with dblclick detection
			e.preventDefault()

			// Commit (or cancel) any active edit on a different cell before focusing.
			// Excel-like commit-on-click-away is the default; shouldCommitOnClickAway=false
			// preserves the legacy discard-on-click behaviour.
			if (this.ctx.engine.editingCell) {
				// Set transition flag to prevent focusout handler from clearing focus
				// (commit/cancel re-renders the old cell, removing its editor → triggers
				// focusout which would undo the focusCell we dispatch next)
				this.ctx.isTransitioningCells = true
				this.pipeline.dispatch({
					type: this.ctx.engine.shouldCommitOnClickAway ? 'commitEdit' : 'cancelEdit'
				})
			}

			// Clear row/column/cell selections when clicking on a cell
			if (this.ctx.engine.selectedRows.length > 0 ||
				this.ctx.engine.selectedColumns.length > 0 ||
				this.ctx.engine.selectedCellRange) {
				this.pipeline.dispatch({ type: 'clearSelection' })
			}

			// Focus the cell
			this.pipeline.dispatch({
				type: 'focusCell',
				target: cell,
				selectText: false
			})

			// Start cell selection tracking (for drag-to-select)
			const selectionMode = this.ctx.engine.cellSelectionMode
			const isShiftClick = e.shiftKey
			const shouldSelectRange =
				selectionMode !== 'disabled' && (
					(selectionMode === 'click' && !isShiftClick) ||
					(selectionMode === 'shift' && isShiftClick)
				)

			if (shouldSelectRange) {
				this.pipeline.dispatch({
					type: 'startCellSelection',
					rowIndex: cell.rowIndex,
					colIndex: cell.colIndex,
					clientX: e.clientX,
					clientY: e.clientY,
					shiftKey: e.shiftKey
				})
			}

			// Clear transitioning flag after focus has settled
			if (this.ctx.isTransitioningCells) {
				requestAnimationFrame(() => {
					this.ctx.isTransitioningCells = false
				})
			}

			return true
		}

		// Map the event to actions for other cases
		const dropdownOpen = this.ctx.dropdown.isOpen
		const isDropdown = this.isDropdownEditor(cell.colIndex)

		const actions = mapMouseDownToActions(e, {
			cell,
			dropdownOpen,
			isDropdownEditor: isDropdown,
			isDateEditor: this.isDateEditor(cell.colIndex),
			isCheckboxEditor: this.isCheckboxEditor(cell.colIndex),
			isToggleClick,
			isDateTriggerClick,
			isCheckboxClick,
			isCellClick
		})

		if (actions.length === 0) return false

		// Prevent default and dispatch all actions
		e.preventDefault()
		e.stopPropagation()

		for (const action of actions) {
			this.pipeline.dispatch(action)
		}

		return true
	}

	/**
	 * Try to handle a click event via the pipeline (for 'click' editTrigger mode).
	 * Returns true if the event was handled, false to fall through.
	 */
	tryHandleClick(e: MouseEvent): boolean {
		const target = e.target as HTMLElement
		const cell = this.getCellFromTarget(target)

		if (!cell) return false

		const editTrigger = this.getEditTrigger(cell.colIndex)
		if (editTrigger !== 'click') return false

		// Already editing this cell - don't re-start
		if (this.isEditingCell(cell.rowIndex, cell.colIndex)) return false

		// Start edit on click
		e.preventDefault()

		const isDropdown = this.isDropdownEditor(cell.colIndex)
		const isDate = this.isDateEditor(cell.colIndex)
		const isCustom = this.isCustomEditor(cell.colIndex)

		// Stop immediate propagation for dropdown/date/custom editors to prevent
		// other click listeners on the same table from calling toggleDropdown/toggleDatePicker
		if (isDropdown || isDate || isCustom) {
			e.stopImmediatePropagation()
		}

		// Calculate cursor position from click for editStartSelection: 'mousePosition'
		const cellElement = target.closest('.wg__cell') as HTMLElement
		const cursorPosition = cellElement ? getCursorPositionFromClick(e, cellElement) : null

		this.pipeline.dispatch({
			type: 'startEdit',
			target: cell,
			cursorPosition: cursorPosition ?? undefined
		})

		// Open dropdown/datepicker/custom editor for those editor types
		// Note: Always open on click regardless of showOnFocus setting.
		// showOnFocus: false only prevents auto-open on Tab/focus navigation,
		// not on explicit edit actions like click.
		if (isDropdown) {
			this.pipeline.dispatch({ type: 'openDropdown' })
		} else if (isDate) {
			this.pipeline.dispatch({ type: 'openDatePicker' })
		} else if (isCustom) {
			this.pipeline.dispatch({ type: 'openCustomEditor', target: cell })
		}

		return true
	}

	/**
	 * Try to handle a dblclick event via the pipeline (for 'dblclick' or 'navigate' editTrigger mode).
	 * Returns true if the event was handled, false to fall through.
	 */
	tryHandleDblClick(e: MouseEvent): boolean {
		const target = e.target as HTMLElement
		const cell = this.getCellFromTarget(target)

		if (!cell) return false

		const editTrigger = this.getEditTrigger(cell.colIndex)
		// dblclick starts edit for both 'dblclick' and 'navigate' modes
		if (editTrigger !== 'dblclick' && editTrigger !== 'navigate') return false

		// Already editing this cell - don't re-start
		if (this.isEditingCell(cell.rowIndex, cell.colIndex)) return false

		// Start edit on double-click
		e.preventDefault()

		const isDropdown = this.isDropdownEditor(cell.colIndex)
		const isDate = this.isDateEditor(cell.colIndex)
		const isCustom = this.isCustomEditor(cell.colIndex)

		// Calculate cursor position from click for editStartSelection: 'mousePosition'
		const cellElement = target.closest('.wg__cell') as HTMLElement
		const cursorPosition = cellElement ? getCursorPositionFromClick(e, cellElement) : null

		this.pipeline.dispatch({
			type: 'startEdit',
			target: cell,
			cursorPosition: cursorPosition ?? undefined
		})

		// Open dropdown/datepicker/custom editor for those editor types
		// Note: Always open on double-click regardless of showOnFocus setting.
		// showOnFocus: false only prevents auto-open on Tab/focus navigation,
		// not on explicit edit actions like double-click.
		if (isDropdown) {
			this.pipeline.dispatch({ type: 'openDropdown' })
		} else if (isDate) {
			this.pipeline.dispatch({ type: 'openDatePicker' })
		} else if (isCustom) {
			this.pipeline.dispatch({ type: 'openCustomEditor', target: cell })
		}

		return true
	}

	/**
	 * Check if datepicker is currently open
	 * Note: This checks the original context, not the Object.create'd executor context
	 */
	isDatepickerOpen(): boolean {
		return !!this.ctx.datepicker
	}

	/**
	 * Clear all selections (row, cell range, column) through the pipeline
	 */
	clearSelection(): void {
		this.pipeline.dispatch({ type: 'clearSelection' })
	}
}

/**
 * Create an action pipeline adapter for a grid context
 */
export function createActionPipelineAdapter<T>(ctx: GridHost<T>): ActionPipelineAdapter<T> {
	return new ActionPipelineAdapter(ctx)
}

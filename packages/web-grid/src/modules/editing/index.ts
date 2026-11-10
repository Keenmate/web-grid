// =============================================================================
// Editing Module - Barrel Export
// =============================================================================

// Lifecycle
export {
	commitCurrentEditor,
	handleCheckboxChange,
	toggleCheckboxAndMove,
	handleEditorBlur,
	moveFocusAfterCommit,
	focusCellAfterCancel,
	restoreCellToDisplayMode
} from './lifecycle.js'

// Renderers
export {
	renderCellEditor,
	renderTextEditor,
	renderNumberEditor,
	renderCheckboxEditor,
	renderSelectEditor,
	renderComboboxEditor,
	renderAutocompleteEditor
} from './renderers.js'

// Editor keydown handler
export { handleEditorKeyDown } from './editor-keydown.js'

// Custom editor lifecycle
export { openCustomEditor } from './custom-editor.js'

// Excel-like commit-on-click-away
export { commitOrCancelEditOnTransition, commitEditorValue, resolveComboboxValue } from './commit-on-transition.js'

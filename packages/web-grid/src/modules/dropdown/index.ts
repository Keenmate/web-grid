// =============================================================================
// Dropdown Module - Barrel Export
// =============================================================================

// Option helpers
export {
	getOptionDisplayValue,
	getOptionLabel,
	getOptionValue,
	getOptionSearchText,
	getOptionIcon,
	getOptionSubtitle,
	isOptionDisabled,
	getOptionGroup,
	isEmptyOption,
	withEmptyOption
} from './options.js'

// Rendering
export {
	renderDropdown,
	removeDropdown,
	applyDropdownPresentation,
	isDropdownSheet
} from './rendering.js'

// Interaction
export {
	selectDropdownOption,
	updateDropdownHighlight,
	scrollHighlightedIntoView,
	updateLoadingIndicator,
	openDropdownForCurrentEditor,
	toggleDropdown,
	attachDropdownListeners,
	updateSelectFilter
} from './interaction.js'

// Input handlers
export {
	handleComboboxInput,
	handleAutocompleteInput,
	performAutocompleteSearch
} from './input-handlers.js'

// Services
export { AutocompleteService } from './autocomplete-service.js'
export { DropdownService } from './dropdown-service.js'

// Blur handlers
export { handleSelectBlur, handleComboboxBlur } from './blur-handlers.js'

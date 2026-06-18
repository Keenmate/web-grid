// =============================================================================
// Focus Event Manager (Pub/Sub Pattern)
// =============================================================================
// Centralizes focus-out/blur event handling to avoid duplicate listeners
// and consolidate guard flag checking.

export type FocusEventKind = 'blur' | 'focusout'

/** @deprecated use `FocusEventKind` */
export type FocusEventType = FocusEventKind
export type FocusHandler = (target: HTMLElement, relatedTarget: HTMLElement | null) => void

export interface FocusSubscription {
	unsubscribe: () => void
}

export interface FocusEventManager {
	/**
	 * Subscribe to focus events
	 * @param type - 'blur' for editor blur (capture phase), 'focusout' for table focusout
	 * @param handler - Callback with target and relatedTarget
	 * @returns Subscription object with unsubscribe method
	 */
	subscribe(type: FocusEventKind, handler: FocusHandler): FocusSubscription

	/**
	 * Unified guard check - returns true if blur should be skipped
	 * Checks: isCommittingFromKeyboard, isTransitioningCells, isClosingViaToggle, isOpeningDropdown
	 */
	shouldSkipBlur(): boolean

	/**
	 * Initialize focus listeners on the table element
	 */
	init(table: HTMLElement): void

	/**
	 * Remove all listeners and subscriptions
	 */
	destroy(): void
}

/**
 * Guard state for blur handling
 */
export interface BlurGuardState {
	isCommittingFromKeyboard: boolean
	isTransitioningCells: boolean
	isClosingViaToggle: boolean
	isOpeningDropdown: boolean
}

/**
 * Create a focus event manager for a single grid instance
 * @param getGuardState - Callback to get current guard flag state
 * @param resetClosingViaToggle - Callback to reset the isClosingViaToggle flag
 */
export function createFocusEventManager(
	getGuardState: () => BlurGuardState,
	resetClosingViaToggle: () => void
): FocusEventManager {
	const blurHandlers = new Set<FocusHandler>()
	const focusoutHandlers = new Set<FocusHandler>()

	let tableElement: HTMLElement | null = null

	// Single blur handler (capture phase)
	const handleBlur = (e: FocusEvent) => {
		const target = e.target as HTMLElement
		const relatedTarget = e.relatedTarget as HTMLElement | null
		blurHandlers.forEach(handler => handler(target, relatedTarget))
	}

	// Single focusout handler (bubbling)
	const handleFocusOut = (e: FocusEvent) => {
		const target = e.target as HTMLElement
		const relatedTarget = e.relatedTarget as HTMLElement | null
		focusoutHandlers.forEach(handler => handler(target, relatedTarget))
	}

	return {
		subscribe(type: FocusEventKind, handler: FocusHandler): FocusSubscription {
			const handlers = type === 'blur' ? blurHandlers : focusoutHandlers
			handlers.add(handler)

			return {
				unsubscribe: () => {
					handlers.delete(handler)
				}
			}
		},

		shouldSkipBlur(): boolean {
			const state = getGuardState()

			// Handle toggle close flag (reset it and skip)
			if (state.isClosingViaToggle) {
				resetClosingViaToggle()
				return true
			}

			return state.isCommittingFromKeyboard ||
			       state.isTransitioningCells ||
			       state.isOpeningDropdown
		},

		init(table: HTMLElement) {
			tableElement = table
			table.addEventListener('blur', handleBlur, true)  // capture phase
			table.addEventListener('focusout', handleFocusOut)
		},

		destroy() {
			if (tableElement) {
				tableElement.removeEventListener('blur', handleBlur, true)
				tableElement.removeEventListener('focusout', handleFocusOut)
				tableElement = null
			}

			blurHandlers.clear()
			focusoutHandlers.clear()
		}
	}
}

// =============================================================================
// Click Event Manager (Pub/Sub Pattern)
// =============================================================================
// Centralizes click event handling for inside/outside grid detection.
// Single listener per scope (container, document), modules subscribe/unsubscribe.

export type ClickEventKind =
	| 'outsideClick'      // Document click outside the grid
	| 'cellClick'         // Click on data cell (not row number, not header)
	| 'rowNumberClick'    // Click on row number cell
	| 'headerClick'       // Click on column header
	| 'sortClick'         // Click on sort indicator in column header
	| 'emptyAreaClick'    // Click in grid but not on interactive element

/** @deprecated use `ClickEventKind` */
export type ClickEventType = ClickEventKind

export interface ClickContext {
	target: HTMLElement
	event: MouseEvent
	rowIndex?: number    // For cell/rowNumber clicks
	colIndex?: number    // For cell/header clicks
	field?: string       // For header clicks
}

export type ClickHandler = (ctx: ClickContext) => boolean | void
// Return true to stop other handlers from running (like stopPropagation)

export interface ClickSubscription {
	unsubscribe: () => void
}

export interface ClickEventManager {
	/**
	 * Subscribe to click events of a specific type
	 * @param type - The type of click event to subscribe to
	 * @param handler - Callback function, return true to stop other handlers
	 * @returns Subscription object with unsubscribe method
	 */
	subscribe(type: ClickEventKind, handler: ClickHandler): ClickSubscription

	/**
	 * Initialize click listeners
	 * @param container - The grid container element (.wg)
	 * @param hostElement - The custom element host (<web-grid>) for outside detection
	 * @param isPathInOwnedScope - Optional predicate; when it returns true for a
	 *   click's composed path, the click is treated as inside the grid (used for
	 *   document.body-hosted popovers like the datepicker
	 *   that need to extend the grid's "inside" scope beyond the host element).
	 */
	init(
		container: HTMLElement,
		hostElement: HTMLElement,
		isPathInOwnedScope?: (path: EventTarget[]) => boolean
	): void

	/**
	 * Remove all listeners and subscriptions (called in disconnectedCallback)
	 */
	destroy(): void
}

/**
 * Create a click event manager for a single grid instance
 */
export function createClickEventManager(): ClickEventManager {
	const handlers: Record<ClickEventKind, Set<ClickHandler>> = {
		outsideClick: new Set(),
		cellClick: new Set(),
		rowNumberClick: new Set(),
		headerClick: new Set(),
		sortClick: new Set(),
		emptyAreaClick: new Set()
	}

	let containerElement: HTMLElement | null = null
	let hostElementRef: HTMLElement | null = null
	let documentListenerAttached = false
	let isPathInOwnedScopeFn: ((path: EventTarget[]) => boolean) | null = null
	// Track if current click originated inside the grid (set on mousedown, checked on click)
	// This handles cases where render() rebuilds DOM between mousedown and click
	let insideGridClickInProgress = false

	// Dispatch to handlers, stop if any returns true
	const dispatch = (type: ClickEventKind, ctx: ClickContext): boolean => {
		for (const handler of handlers[type]) {
			if (handler(ctx) === true) {
				return true // Handler requested stop
			}
		}
		return false
	}

	// Host element mouseup handler - clears the flag if no click follows (e.g., after drag)
	const handleHostMouseup = () => {
		// Clear the flag after a very short delay to allow click event to fire first
		// Click fires within ~5ms of mouseup, so 10ms is safe
		// If it was a drag (no click), this ensures the flag gets cleared
		setTimeout(() => {
			if (insideGridClickInProgress) {
				insideGridClickInProgress = false
			}
		}, 10)
	}

	// Host element mousedown handler - detects clicks inside the grid
	// Uses host element (not container) so it survives render() calls
	const handleHostMousedown = (e: Event) => {
		// Mark that this click started inside the grid
		insideGridClickInProgress = true

		const mouseEvent = e as MouseEvent
		// Use composedPath to get actual target inside shadow DOM
		// event.target is retargeted to host element when crossing shadow boundary
		const path = mouseEvent.composedPath()
		const target = (path[0] || mouseEvent.target) as HTMLElement

		const ctx: ClickContext = {
			target,
			event: mouseEvent
		}

		// Check what was clicked (most specific first)
		const cell = target.closest('.wg__cell') as HTMLElement
		const rowNumberCell = target.closest('.wg__row-number[data-row-number]') as HTMLElement
		const header = target.closest('.wg__header:not(.wg__row-number-header)') as HTMLElement

		// Check for sort indicator click first (most specific)
		const sortIndicator = target.closest('.wg__sort-indicator') as HTMLElement
		if (sortIndicator) {
			const sortHeader = sortIndicator.closest('.wg__header--sortable') as HTMLElement
			if (sortHeader) {
				ctx.field = sortHeader.dataset.field
				ctx.colIndex = parseInt(sortHeader.dataset.colIndex || '-1', 10)
				dispatch('sortClick', ctx)
				return  // Don't also dispatch headerClick
			}
		}

		if (rowNumberCell) {
			// Click on row number cell
			ctx.rowIndex = parseInt(rowNumberCell.dataset.rowNumber || '-1', 10)
			dispatch('rowNumberClick', ctx)
		} else if (header && !target.closest('.wg__resize-handle')) {
			// Click on header (not resize handle, not sort indicator)
			ctx.field = header.dataset.field
			ctx.colIndex = parseInt(header.dataset.colIndex || '-1', 10)
			dispatch('headerClick', ctx)
		} else if (cell && !cell.classList.contains('wg__row-number')) {
			// Click on data cell (not row number)
			ctx.rowIndex = parseInt(cell.dataset.row || '-1', 10)
			ctx.colIndex = parseInt(cell.dataset.col || '-1', 10)
			dispatch('cellClick', ctx)
		} else if (!target.closest('.wg__toolbar, button, input, select, textarea')) {
			// Click in empty area (not on interactive elements)
			dispatch('emptyAreaClick', ctx)
		}
	}

	// Document click handler - detects clicks outside the grid
	const handleDocumentClick = (e: Event) => {
		if (!hostElementRef) return

		// If mousedown happened inside the grid, this is not an outside click
		// This flag handles cases where render() rebuilds DOM between mousedown and click
		if (insideGridClickInProgress) {
			insideGridClickInProgress = false
			return
		}

		const mouseEvent = e as MouseEvent
		const target = mouseEvent.target as HTMLElement

		// Check if click is inside the grid by looking for host element in composed path
		// composedPath() includes all elements through shadow DOM boundaries
		const path = mouseEvent.composedPath ? mouseEvent.composedPath() : []
		const clickedInGrid = path.includes(hostElementRef)
		// Clicks on document.body-hosted popovers we own (datepicker, context
		// menus) should also count as inside — otherwise the outside-click
		// handler tears down editing state while the user is just operating the
		// popover.
		const clickedInOwnedScope = !clickedInGrid && isPathInOwnedScopeFn?.(path) === true

		if (!clickedInGrid && !clickedInOwnedScope) {
			dispatch('outsideClick', {
				target,
				event: mouseEvent
			})
		}
	}

	return {
		subscribe(type: ClickEventKind, handler: ClickHandler): ClickSubscription {
			handlers[type].add(handler)

			return {
				unsubscribe: () => {
					handlers[type].delete(handler)
				}
			}
		},

		init(
			container: HTMLElement,
			hostElement: HTMLElement,
			isPathInOwnedScope?: (path: EventTarget[]) => boolean
		) {
			containerElement = container
			hostElementRef = hostElement
			isPathInOwnedScopeFn = isPathInOwnedScope ?? null

			// Listen for mousedown on HOST element (not container)
			// This survives render() calls which replace the container
			hostElement.addEventListener('mousedown', handleHostMousedown)
			hostElement.addEventListener('mouseup', handleHostMouseup)

			// Listen for clicks on document (for outside-grid detection)
			if (!documentListenerAttached) {
				document.addEventListener('click', handleDocumentClick, true)
				documentListenerAttached = true
			}
		},

		destroy() {
			if (hostElementRef) {
				hostElementRef.removeEventListener('mousedown', handleHostMousedown)
				hostElementRef.removeEventListener('mouseup', handleHostMouseup)
			}

			if (documentListenerAttached) {
				document.removeEventListener('click', handleDocumentClick, true)
				documentListenerAttached = false
			}

			containerElement = null
			hostElementRef = null
			isPathInOwnedScopeFn = null
			insideGridClickInProgress = false

			// Clear all handlers
			Object.values(handlers).forEach(set => set.clear())
		}
	}
}

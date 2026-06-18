// =============================================================================
// ToolbarService — owns the floating-toolbar runtime state
// =============================================================================
// Extracted from GridElement so the Element layer no longer holds UI state.
// Tracks the hover hide-timeout, hover / move-in-progress flags, the last
// hovered cell, the JSON snapshot used to detect cell-specific toolbar item
// changes, and the document-level keydown handler the toolbar registers when
// open.

export type ToolbarHoveredCell = {
	rowIndex: number
	colIndex: number
	field: string
}

export type ToolbarShortcutHandler = (e: KeyboardEvent) => void

export class ToolbarService {
	private _hideTimeout: ReturnType<typeof setTimeout> | null = null
	private _isHovered = false
	private _isMoveInProgress = false
	private _hoveredCell: ToolbarHoveredCell | null = null
	private _currentCellItemsJson: string | null = null
	private _shortcutHandler: ToolbarShortcutHandler | null = null

	/** Pending hide-timeout handle, or null if no hide is scheduled. */
	get hideTimeout(): ReturnType<typeof setTimeout> | null { return this._hideTimeout }

	/** Replace the current hide-timeout with a new one. */
	setHideTimeout(handle: ReturnType<typeof setTimeout> | null): void {
		this._hideTimeout = handle
	}

	/** Cancel any pending hide-timeout. No-op when none is scheduled. */
	clearHideTimeout(): void {
		if (this._hideTimeout !== null) {
			clearTimeout(this._hideTimeout)
			this._hideTimeout = null
		}
	}

	/** True while the user's pointer is over the toolbar (suppresses hide). */
	get isHovered(): boolean { return this._isHovered }
	setIsHovered(value: boolean): void { this._isHovered = value }

	/** True while the toolbar is mid-reposition (suppresses hide). */
	get isMoveInProgress(): boolean { return this._isMoveInProgress }
	setIsMoveInProgress(value: boolean): void { this._isMoveInProgress = value }

	/** The last cell the pointer hovered, used to decide whether to refresh the toolbar. */
	get hoveredCell(): ToolbarHoveredCell | null { return this._hoveredCell }
	setHoveredCell(cell: ToolbarHoveredCell | null): void { this._hoveredCell = cell }

	/** JSON snapshot of the current cell-specific toolbar items, used for diff/equality checks. */
	get currentCellItemsJson(): string | null { return this._currentCellItemsJson }
	setCurrentCellItemsJson(json: string | null): void { this._currentCellItemsJson = json }

	/** The keydown handler registered on document while the toolbar is open. */
	get shortcutHandler(): ToolbarShortcutHandler | null { return this._shortcutHandler }
	setShortcutHandler(handler: ToolbarShortcutHandler | null): void { this._shortcutHandler = handler }

	/**
	 * Reset hover / move-in-progress flags, clear the hovered-cell cache, drop the
	 * cell-items JSON snapshot, and cancel any pending hide-timeout. The shortcut
	 * handler is left in place — the caller is responsible for unregistering it
	 * from `document` and then calling `setShortcutHandler(null)`.
	 */
	reset(): void {
		this.clearHideTimeout()
		this._isHovered = false
		this._isMoveInProgress = false
		this._hoveredCell = null
		this._currentCellItemsJson = null
	}
}

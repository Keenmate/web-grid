// =============================================================================
// AutocompleteService — owns the autocomplete search runtime state
// =============================================================================
// Tracks the debounce timer, the in-flight AbortController for the search
// request, and the "search in progress" flag the dropdown uses to switch its
// "Searching…" placeholder on and off.

export class AutocompleteService {
	private _debounceTimer: ReturnType<typeof setTimeout> | null = null
	private _abortController: AbortController | null = null
	private _isSearching = false

	/** True between the moment a search fires and its resolution (or its abort). */
	get isSearching(): boolean { return this._isSearching }
	setIsSearching(value: boolean): void { this._isSearching = value }

	/** Pending debounce timeout for the next search trigger, or null. */
	get debounceTimer(): ReturnType<typeof setTimeout> | null { return this._debounceTimer }

	setDebounceTimer(handle: ReturnType<typeof setTimeout> | null): void {
		this._debounceTimer = handle
	}

	/** Cancel any pending debounce. No-op when none is scheduled. */
	clearDebounceTimer(): void {
		if (this._debounceTimer !== null) {
			clearTimeout(this._debounceTimer)
			this._debounceTimer = null
		}
	}

	/** AbortController for the current in-flight search, or null. */
	get abortController(): AbortController | null { return this._abortController }

	setAbortController(controller: AbortController | null): void {
		this._abortController = controller
	}

	/** Abort any in-flight search and clear the controller reference. */
	abort(): void {
		if (this._abortController !== null) {
			this._abortController.abort()
			this._abortController = null
		}
	}

	/**
	 * Cancel debounce + abort in-flight search + clear isSearching. Used when
	 * the editor loses focus or the user cancels.
	 */
	reset(): void {
		this.clearDebounceTimer()
		this.abort()
		this._isSearching = false
	}
}

// =============================================================================
// VirtualScrollService — owns the virtual-scroll runtime state
// =============================================================================
// Extracted from GridElement so the Element layer no longer holds UI state.
// Tracks the visible row range, the load-more in-flight flag, and the
// programmatic-scroll guard that suppresses re-render during keyboard nav.

export class VirtualScrollService {
	private _start = 0
	private _end = 0
	private _isLoadingMore = false
	private _isProgrammatic = false

	/** Current visible-range start index (inclusive). */
	get start(): number { return this._start }
	/** Current visible-range end index (exclusive). */
	get end(): number { return this._end }
	/** True between an infinite-scroll trigger and the items-array update. */
	get isLoadingMore(): boolean { return this._isLoadingMore }
	/** True during a programmatic scroll (e.g. keyboard nav); the scroll handler skips re-render while set. */
	get isProgrammatic(): boolean { return this._isProgrammatic }

	/**
	 * Update the visible range. Returns `true` iff the range actually changed —
	 * call sites use this to gate the `renderVirtualRows` call.
	 */
	setRange(start: number, end: number): boolean {
		if (start === this._start && end === this._end) return false
		this._start = start
		this._end = end
		return true
	}

	setIsLoadingMore(value: boolean): void {
		this._isLoadingMore = value
	}

	beginProgrammaticScroll(): void {
		this._isProgrammatic = true
	}

	endProgrammaticScroll(): void {
		this._isProgrammatic = false
	}
}

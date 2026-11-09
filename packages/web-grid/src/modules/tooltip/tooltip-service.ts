// =============================================================================
// TooltipService — owns the in-flight tooltip runtime state
// =============================================================================
// Tracks the rendered tooltip + arrow elements, the current anchor (for
// reposition skips when the same anchor re-fires), and the show/hide timers
// that drive the open/close delay. Configuration delays (showDelay /
// hideDelay) live on GridElement as accessors and are passed in by callers.

import type { AnchorHandle } from '@keenmate/web-components-core/positioning'

export class TooltipService {
	private _element: HTMLElement | null = null
	private _positioning: AnchorHandle | null = null
	private _arrowElement: HTMLElement | null = null
	private _anchor: HTMLElement | null = null
	private _showTimer: ReturnType<typeof setTimeout> | null = null
	private _hideTimer: ReturnType<typeof setTimeout> | null = null

	/** The rendered tooltip element, or null when no tooltip is mounted. */
	get element(): HTMLElement | null { return this._element }
	setElement(value: HTMLElement | null): void { this._element = value }

	/** The core `anchor()` placing the rendered tooltip (destroyed with it). */
	setPositioning(value: AnchorHandle | null): void {
		this._positioning?.destroy()
		this._positioning = value
	}

	/** The arrow element inside the rendered tooltip, or null. */
	get arrowElement(): HTMLElement | null { return this._arrowElement }
	setArrowElement(value: HTMLElement | null): void { this._arrowElement = value }

	/** The element the tooltip is anchored to. Used to skip reposition when the same anchor re-fires hover. */
	get anchor(): HTMLElement | null { return this._anchor }
	setAnchor(value: HTMLElement | null): void { this._anchor = value }

	/** Pending show-delay timer, or null. */
	get showTimer(): ReturnType<typeof setTimeout> | null { return this._showTimer }
	setShowTimer(handle: ReturnType<typeof setTimeout> | null): void { this._showTimer = handle }

	/** Cancel any pending show timer. No-op when none is scheduled. */
	clearShowTimer(): void {
		if (this._showTimer !== null) {
			clearTimeout(this._showTimer)
			this._showTimer = null
		}
	}

	/** Pending hide-delay timer, or null. */
	get hideTimer(): ReturnType<typeof setTimeout> | null { return this._hideTimer }
	setHideTimer(handle: ReturnType<typeof setTimeout> | null): void { this._hideTimer = handle }

	/** Cancel any pending hide timer. No-op when none is scheduled. */
	clearHideTimer(): void {
		if (this._hideTimer !== null) {
			clearTimeout(this._hideTimer)
			this._hideTimer = null
		}
	}

	/**
	 * Clear the rendered-tooltip handles (element, arrow, anchor) after the DOM
	 * node has been removed by the caller. Does not touch timers.
	 */
	clearMounted(): void {
		this.setPositioning(null)
		this._element = null
		this._arrowElement = null
		this._anchor = null
	}
}

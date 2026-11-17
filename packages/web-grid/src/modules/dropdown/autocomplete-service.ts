// =============================================================================
// AutocompleteService — the autocomplete search runtime, on core createAsyncRunner
// =============================================================================
// One "latest request wins" runner per grid: the debounce, the AbortSignal of the
// in-flight `searchCallback`, the stale-answer drop and the "Searching…" state
// (core createAsyncRunner, SPEC §12.22) — they used to be a hand-written timer,
// AbortController and flag here.

import { createAsyncRunner, type AsyncRunner } from '@keenmate/web-components-core'

/** Per-search hooks: what the dropdown does when the searching state changes / the search fails. */
export interface AutocompleteHooks {
	onLoadingChange(isLoading: boolean): void
	onError(error: unknown): void
}

export class AutocompleteService {
	#debounceMs = 300
	#hooks: AutocompleteHooks | null = null
	readonly #runner: AsyncRunner = createAsyncRunner({
		debounceMs: () => this.#debounceMs,
		onLoadingChange: (isLoading) => this.#hooks?.onLoadingChange(isLoading),
		onError: (error) => this.#hooks?.onError(error)
	})

	/** True while an async search is running — the dropdown shows "Searching…". */
	get isSearching(): boolean { return this.#runner.isLoading }

	/**
	 * Run `task` after `debounceMs`, replacing the previous search: its debounce is dropped, its
	 * signal aborts, a late answer from it is ignored. A synchronous task (local filtering) never
	 * shows the searching state.
	 */
	search<R>(debounceMs: number, task: (signal: AbortSignal) => R | PromiseLike<R>, onResult: (result: R) => void, hooks: AutocompleteHooks): void {
		this.#debounceMs = debounceMs
		this.#hooks = hooks
		this.#runner.run(task, onResult)
	}

	/** Drop the pending / running search and leave the searching state — another cell, blur, cancel. */
	reset(): void {
		this.#runner.cancel()
	}
}

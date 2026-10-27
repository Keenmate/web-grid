// =============================================================================
// beforePageChangeCallback guard
// =============================================================================
// User actions that swap the displayed rows — pager buttons, page-size change,
// header sort in server mode, a filter-row change in server mode — run through
// `guardPageChange`. It asks `beforePageChangeCallback(ctx)` first:
//
//   false        → stay (nothing changes; the pager re-renders its old state)
//   nothing      → continue to `toPage`
//   a number     → continue, but to that page instead
//
// The hook may be async: while it is pending the pager is disabled and a second
// navigation is ignored. A sync hook keeps the flow synchronous (core's
// runBeforeCallbackEager). Programmatic `currentPage` writes and infinite-scroll
// `load-more` don't go through here.

import { runBeforeCallbackEager } from '@keenmate/web-components-core'
import type { GridHost } from '../grid-context.js'
import type { BeforePageChangeContext, PageChangeTrigger } from '../../interaction.js'

/** Disable / re-enable the rendered pager controls in place (no re-render). */
function setPagerBusy<T>(ctx: GridHost<T>, isBusy: boolean): void {
	ctx.shadow.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('.wg__pagination-btn, .wg__pagination-select')
		.forEach(el => { if (isBusy) el.disabled = true })
	ctx.shadow.querySelectorAll<HTMLElement>('.wg__pagination')
		.forEach(el => { if (isBusy) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy') })
}

/**
 * Run `apply(page)` for a user page change, after `beforePageChangeCallback`
 * allowed it. Returns `true` when it was applied synchronously, `false` when it
 * was cancelled, ignored (another change pending) or deferred (async hook — it
 * applies + renders itself when the hook resolves).
 */
export function guardPageChange<T>(
	ctx: GridHost<T>,
	trigger: PageChangeTrigger,
	toPage: number,
	apply: (page: number) => void
): boolean {
	const engine = ctx.engine
	if (engine.isPageChangePending) return false
	const hook = engine.beforePageChangeCallback
	if (!hook) {
		apply(toPage)
		return true
	}

	const detail: BeforePageChangeContext<T> = engine.ctx({
		trigger,
		fromPage: engine.currentPage,
		toPage,
		drafts: engine.getDrafts()
	})
	const clamp = (page: number) => Math.max(1, Math.min(Math.trunc(page), Math.max(1, engine.totalPages)))
	const finish = (result: { isRejected: boolean; hasValue?: boolean; value?: unknown }): boolean => {
		if (result.isRejected) return false
		const page = result.hasValue && typeof result.value === 'number' && Number.isFinite(result.value)
			? clamp(result.value)
			: toPage
		apply(page)
		return true
	}

	const result = runBeforeCallbackEager(hook, detail, 'beforePageChangeCallback', ctx)
	if (!(result instanceof Promise)) {
		const isApplied = finish(result)
		if (!isApplied) ctx.render()  // restore the pager (e.g. the page-size select)
		return isApplied
	}

	engine.isPageChangePending = true
	setPagerBusy(ctx, true)
	void result.then(r => {
		engine.isPageChangePending = false
		finish(r)
		setPagerBusy(ctx, false)
		ctx.render()
	})
	return false
}

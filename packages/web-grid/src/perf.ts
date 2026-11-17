/**
 * The grid's perf logger — core `createPerfLogger` (SPEC §12.1) over the same
 * `GRID:PERF` logger as `perfLogger` in `logger.ts` (loggers are registered by
 * name), so one category level switches both:
 *
 * ```js
 * window.components['web-grid'].logging.setCategoryLevel('PERF', 'debug')
 * ```
 *
 * Silent (the default `warn`) records nothing: `count()` and the spans are no-ops
 * until PERF is at `debug`. `render()` clears it, times its body as a span and
 * logs `summary('render()')` — the span plus the data-pipeline counters
 * (`displayItems`, `paginatedItems`, `treeSorted`, `treeVisible`, with their
 * time, and `cellDisplayItemsLookup`).
 */
import { createPerfLogger } from '@keenmate/web-components-core'

export const gridPerf = createPerfLogger('GRID')

/** `performance.now()` only while the perf logger records — the hot getters skip the clock otherwise. */
export function perfNow(): number {
	return gridPerf.isEnabled ? performance.now() : 0
}

/** Count one call of `label` with the time since `t0` (from {@link perfNow}). */
export function perfCount(label: string, t0: number): void {
	if (gridPerf.isEnabled) gridPerf.count(label, performance.now() - t0)
}

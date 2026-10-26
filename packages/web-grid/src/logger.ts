/**
 * Categorized loggers for @keenmate/web-grid — a thin shim over the core logging
 * module (`@keenmate/web-components-core`, SPEC §12.1). Core owns the vendored
 * `loglevel` engine and the colour-coded `%c` prefix; the grid's private copy
 * under `src/vendor/loglevel` is gone.
 *
 * Categories (`GRID:*`):
 * - INIT        — component initialization and configuration
 * - DATA        — data loading, sorting, filtering, pagination, persistence
 * - UI          — rendering, scroll, resize
 * - INTERACTION — clicks, selections, keyboard
 * - PERF        — render / tree-toggle timings
 *
 * Every category defaults to `warn` (core's `DEFAULT_LOG_LEVEL`; a persisted
 * `km-log:*` level wins). Switch at runtime from the console:
 *
 * ```js
 * window.components['web-grid'].logging.enableLogging()          // every category → debug
 * window.components['web-grid'].logging.setLogLevel('info')      // every category → info
 * window.components['web-grid'].logging.setCategoryLevel('DATA', 'debug')
 * window.components.logging                                      // page-wide switch (all components)
 * ```
 */
import { createLoggers, type Logger, type LogLevelDesc } from '@keenmate/web-components-core'

const CATEGORIES = ['INIT', 'DATA', 'UI', 'INTERACTION', 'PERF'] as const
type Category = (typeof CATEGORIES)[number]

/**
 * The grid's core logger bundle. Registered with `registerComponent` (which
 * publishes it on `window.components['web-grid'].logging` and lets `BlissElement`
 * build the per-instance `this.log`).
 */
export const logging = createLoggers('GRID', CATEGORIES)

export const initLogger: Logger = logging.loggers.INIT
export const dataLogger: Logger = logging.loggers.DATA
export const uiLogger: Logger = logging.loggers.UI
export const interactionLogger: Logger = logging.loggers.INTERACTION
export const perfLogger: Logger = logging.loggers.PERF

/** The category names (bare, as `setCategoryLevel` takes them). */
export const LOGGING_CATEGORIES: readonly Category[] = CATEGORIES

/** Enable every category (default level `debug`). */
export function enableLogging(level?: LogLevelDesc): void {
	logging.enableLogging(level)
}

/** Silence every category. */
export function disableLogging(): void {
	logging.disableLogging()
}

/** Set the same level on every category. */
export function setLogLevel(level: LogLevelDesc): void {
	logging.setLogLevel(level)
}

/** Set the level of one category (`'DATA'`; the prefixed `'GRID:DATA'` is accepted too). */
export function setCategoryLevel(category: string, level: LogLevelDesc = 'debug'): void {
	const bare = (category.includes(':') ? category.split(':').pop()! : category) as Category
	logging.setCategoryLevel(bare, level)
}

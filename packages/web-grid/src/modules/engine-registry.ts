// =============================================================================
// Engine registry - the test-only way from a <web-grid> element to its GridEngine
// =============================================================================

import type { GridEngine } from '../grid.js'

/**
 * element → its internal {@link GridEngine}. Module-private and NOT re-exported from the package
 * entry: in the published bundle nothing outside can read it (no symbol or string key on the
 * element). Unit tests import {@link engineOf} from this module; e2e fixture pages load
 * `test/engine-handle.js`, which imports it from the served source and sets `window.__wgEngineOf`.
 */
const engines = new WeakMap<object, GridEngine<any>>()

/** @internal Called once by the element's constructor. */
export function registerEngine(el: object, engine: GridEngine<any>): void {
	engines.set(el, engine)
}

/** @internal Test-only: the element's engine (`undefined` for a non-grid). Not API. */
export function engineOf<T = any>(el: object): GridEngine<T> | undefined {
	return engines.get(el) as GridEngine<T> | undefined
}

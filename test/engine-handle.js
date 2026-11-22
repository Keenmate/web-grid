// Test-only: exposes `window.__wgEngineOf(el)` (the element's internal GridEngine) to the e2e specs.
// Fixture pages that need it load this module; the published package has no such handle — the
// registry is module-private and not exported from the package entry.
import { engineOf } from '../packages/web-grid/src/modules/engine-registry.ts'

window.__wgEngineOf = engineOf

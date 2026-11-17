// =============================================================================
// Grid layers — the column-reorder ghost and the row-toolbar connector
// =============================================================================
// Core `createLayer()` layers (SPEC §12.29): mounted in the overlay container outside the grid,
// so the grid's (or a scroll parent's) `overflow` can't clip them, with their own shadow root
// holding css/layers.css. The `--wg-*` tokens that sheet reads are copied from the host
// (`cssVars`), so an instance override on the host reaches the layer; core copies the host's
// font, colour and writing direction. `GridHost.openLayer()` also writes the grid's custom CSS
// (page-wide + `customStyles`) into the layer root.

import type { Layer } from '@keenmate/web-components-core/positioning'
import layerCss from '../../css/layers.css?inline'
import type { GridHost } from '../grid-context.js'

/** Every `--wg-*` token the layer sheet reads. */
const LAYER_VARS: readonly string[] = [...new Set(layerCss.match(/--wg-[\w-]+/g) ?? [])]

/**
 * Open a non-interactive grid layer (`pointer-events: none`: the hit test sees through it) stacked at
 * `zIndexToken` (+ `zIndexOffset`).
 */
export function openGridLayer<T>(ctx: GridHost<T>, className: string, zIndexToken: string, zIndexOffset = 0): Layer {
	return ctx.openLayer({
		css: layerCss,
		className,
		isInteractive: false,
		zIndex: zIndexOffset ? `calc(var(${zIndexToken}) + ${zIndexOffset})` : `var(${zIndexToken})`,
		cssVars: [...LAYER_VARS, zIndexToken],
	})
}

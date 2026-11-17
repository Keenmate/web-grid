// =============================================================================
// SVG connector renderer
// =============================================================================
// Paints the SVG line + arrow head that visually ties the floating row
// toolbar to its anchor row. The path geometry + arrow position + direction
// are produced upstream by `updateConnector` and exposed via
// `getConnectorState`. This file just turns that state into actual SVG DOM.
//
// The SVG lives in a core `createLayer()` layer (modules/layers/index.ts) covering the
// viewport — outside the grid, pointer-events: none, one below the toolbar's tier.
// The layer stays while the connector shows; each paint replaces its SVG.

import type { Layer } from '@keenmate/web-components-core/positioning'
import type { GridHost } from '../grid-context.js'
import { openGridLayer } from '../layers/index.js'
import { getConnectorState } from './index.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Each grid's open connector layer. */
const connectorLayers = new WeakMap<GridHost<any>, Layer>()

/** Take the grid's connector line down (its layer destroyed). */
export function removeConnector<T>(ctx: GridHost<T>): void {
	connectorLayers.get(ctx)?.destroy()
	connectorLayers.delete(ctx)
}

/**
 * Re-paint the SVG connector. Removes the connector when the upstream state
 * doesn't have a path or arrow position — i.e. the toolbar isn't anchored to a row.
 */
export function renderConnector<T>(ctx: GridHost<T>): void {
	const state = getConnectorState(ctx)
	if (!state.path || !state.arrowPos) {
		removeConnector(ctx)
		return
	}

	let layer = connectorLayers.get(ctx)
	if (!layer) {
		layer = openGridLayer(ctx, 'wg__connector', '--wg-z-toolbar', -1)
		connectorLayers.set(ctx, layer)
	}
	// The path is in viewport coordinates: the layer covers the viewport
	layer.place({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight })

	const svg = document.createElementNS(SVG_NS, 'svg')

	const path = document.createElementNS(SVG_NS, 'path')
	path.setAttribute('d', state.path)
	svg.appendChild(path)

	// Arrow head
	const arrow = document.createElementNS(SVG_NS, 'polygon')
	const points = state.arrowDir === 'down' ? '-4,0 4,0 0,8' :
		state.arrowDir === 'up' ? '-4,0 4,0 0,-8' :
		state.arrowDir === 'left' ? '0,-4 -8,0 0,4' :
		'0,-4 8,0 0,4'
	arrow.setAttribute('points', points)
	arrow.setAttribute('transform', `translate(${state.arrowPos.x}, ${state.arrowPos.y})`)
	svg.appendChild(arrow)

	layer.element.replaceChildren(svg)
}

// =============================================================================
// SVG connector renderer
// =============================================================================
// Paints the SVG line + arrow head that visually ties the floating row
// toolbar to its anchor row. The path geometry + arrow position + direction
// are produced upstream by `updateConnector` and exposed via
// `getConnectorState`. This file just turns that state into actual SVG DOM.
//
// The SVG is appended to the shadow root as a fullscreen `position: fixed`
// overlay (pointer-events: none, z-index: 999). Previous connector elements
// are removed before re-painting so repeated render calls don't pile up.

import type { GridContext } from '../grid-context.js'
import { getConnectorState } from './index.js'

/**
 * Re-paint the SVG connector. No-op (after removing any previous connector)
 * when the upstream state doesn't have a path or arrow position — i.e.
 * the toolbar isn't anchored to a row.
 */
export function renderConnector<T>(ctx: GridContext<T>): void {
	// Remove any existing connector
	const existingConnector = ctx.shadow.querySelector('.wg__connector')
	if (existingConnector) {
		existingConnector.remove()
	}

	const state = getConnectorState()
	if (!state.path || !state.arrowPos) {
		return
	}

	// Create SVG overlay
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
	svg.setAttribute('class', 'wg__connector')
	svg.setAttribute('style', 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 999;')

	// Create path
	const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
	path.setAttribute('d', state.path)
	path.setAttribute('stroke', 'var(--wg-accent-color, #0078d4)')
	path.setAttribute('stroke-width', '2')
	path.setAttribute('fill', 'none')
	svg.appendChild(path)

	// Create arrow head
	const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
	const points = state.arrowDir === 'down' ? '-4,0 4,0 0,8' :
		state.arrowDir === 'up' ? '-4,0 4,0 0,-8' :
		state.arrowDir === 'left' ? '0,-4 -8,0 0,4' :
		'0,-4 8,0 0,4'
	arrow.setAttribute('points', points)
	arrow.setAttribute('fill', 'var(--wg-accent-color, #0078d4)')
	arrow.setAttribute('transform', `translate(${state.arrowPos.x}, ${state.arrowPos.y})`)
	svg.appendChild(arrow)

	ctx.shadow.appendChild(svg)
}

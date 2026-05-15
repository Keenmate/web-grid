// =============================================================================
// Tree Cell Rendering
// Wraps cell content with indent + expand/collapse chevron when column.isTree
// =============================================================================

import type { Column } from '../../types.js'
import type { GridContext } from '../types.js'

/**
 * Wrap cell content with tree indent + chevron when column is the tree column.
 * Returns the original innerHtml unchanged when tree mode is off or column isn't isTree.
 *
 * Layout: inline-flex wrapper with `padding-inline-start: level * --wg-tree-indent`.
 * Inside the wrapper sits either a chevron <button> (branch) or an empty
 * <span class="wg__tree-leaf-spacer"> (leaf, keeps alignment with branches).
 *
 * Chevron rotation: when treeExpandedGlyph === treeCollapsedGlyph (the default
 * setup) we add `.wg__tree-chevron--expanded` and CSS rotates the glyph 90°.
 * When the glyphs differ, the glyph is swapped on state change instead.
 *
 * Used by both the full-table render (table.ts) and the surgical single-cell
 * render (cell.ts), so both paths keep the chevron after focus/edit transitions.
 */
export function wrapTreeCell<T>(
	ctx: GridContext<T>,
	column: Column<T>,
	item: T,
	innerHtml: string
): string {
	if (!column.isTree || !ctx.grid.isTreeMode) return innerHtml
	const info = ctx.grid.getRowTreeInfo(item)
	if (!info) return innerHtml
	const isExpanded = ctx.grid.isPathExpanded(info.path)
	const indentStyle = `padding-inline-start: calc(${info.level} * var(--wg-tree-indent))`
	const chevronInner = ctx.grid.getTreeChevronHtml(item, isExpanded, info.hasChildren, info.level, info.path)
	const shouldRotate = !ctx.grid.treeChevronCallback && ctx.grid.treeExpandedGlyph === ctx.grid.treeCollapsedGlyph
	let chevron: string
	if (info.hasChildren) {
		const expandedClass = shouldRotate && isExpanded ? ' wg__tree-chevron--expanded' : ''
		chevron = `<button type="button" class="wg__tree-chevron${expandedClass}" data-tree-toggle="${ctx.escapeHtml(info.path)}" tabindex="-1" aria-label="${isExpanded ? 'Collapse' : 'Expand'}">${chevronInner}</button>`
	} else {
		chevron = `<span class="wg__tree-leaf-spacer" aria-hidden="true">${chevronInner}</span>`
	}
	return `<div class="wg__tree-cell" style="${indentStyle}">${chevron}<div class="wg__tree-cell-body">${innerHtml}</div></div>`
}

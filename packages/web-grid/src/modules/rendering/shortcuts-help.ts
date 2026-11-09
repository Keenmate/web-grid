// =============================================================================
// Shortcuts help icon renderer
// =============================================================================
// Renders the floating "?" icon + hover-overlay that lists the user-defined
// rowShortcuts and rangeShortcuts (key combo + label). Empty string is returned
// when the feature is off or when no shortcuts exist — the caller splices the result
// straight into the top-area HTML without any further branching.
//
// Custom content from `renderShortcutsHelpCallback` is prepended to the
// list when provided, so consumers can add prose / images above the
// generated keymap.

import { escapeHtml } from '@keenmate/web-components-core'
import type { GridHost } from '../grid-context.js'
import type { GridLabels } from '../../types.js'
import { formatKeyCombo } from '../keyboard/index.js'

/**
 * Build the shortcuts-help icon + overlay HTML string. Returns '' when the
 * feature is disabled or there are no row / range shortcuts.
 */
// Built-in action → its `labels.actions` key
const ACTION_LABEL_KEYS: Record<string, keyof GridLabels['actions']> = {
	'add': 'add', 'delete': 'delete', 'duplicate': 'duplicate', 'move-up': 'moveUp', 'move-down': 'moveDown'
}

export function renderShortcutsHelpIcon<T>(ctx: GridHost<T>): string {
	const rowShortcuts = ctx.engine.rowShortcuts ?? []
	const rangeShortcuts = ctx.engine.rangeShortcuts ?? []
	if (!ctx.engine.isShortcutsHelpShown || (rowShortcuts.length === 0 && rangeShortcuts.length === 0)) {
		return ''
	}

	const position = ctx.engine.shortcutsHelpPosition
	const positionClass = position === 'top-left' ? 'wg__shortcuts-help--left' : ''
	const labels = ctx.engine.labels

	const itemHtml = (shortcut: string, text: string | undefined) => `<div class="wg__shortcuts-help-item">
			<span class="wg__shortcuts-help-key">${formatKeyCombo(shortcut)}</span>
			<span class="wg__shortcuts-help-label">${escapeHtml(text ?? '')}</span>
		</div>`
	const rowItemsHtml = rowShortcuts.map(s =>
		itemHtml(s.shortcut, s.text ?? (s.action ? labels.actions[ACTION_LABEL_KEYS[s.action]] : ''))
	).join('')
	const rangeItemsHtml = rangeShortcuts.map(s => itemHtml(s.shortcut, s.text)).join('')

	// Row shortcuts under the main title; range shortcuts get their own sub-heading
	// when both lists are present.
	const listsHtml = rowItemsHtml && rangeItemsHtml
		? `<div class="wg__shortcuts-help-list">${rowItemsHtml}</div>
				<div class="wg__shortcuts-help-title">${escapeHtml(labels.rangeShortcuts)}</div>
				<div class="wg__shortcuts-help-list">${rangeItemsHtml}</div>`
		: `<div class="wg__shortcuts-help-list">${rowItemsHtml || rangeItemsHtml}</div>`

	// Get custom content if callback is provided
	const customContent = ctx.engine.renderShortcutsHelpCallback?.(ctx.engine.ctx({})) || ''

	return `
		<div class="wg__shortcuts-help ${positionClass}">
			<button class="wg__shortcuts-help-icon" type="button" title="${escapeHtml(labels.keyboardShortcuts)}">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<path d="M12 16v-4"></path>
					<path d="M12 8h.01"></path>
				</svg>
			</button>
			<div class="wg__shortcuts-help-overlay">
				${customContent ? `<div class="wg__shortcuts-help-custom">${customContent}</div>` : ''}
				<div class="wg__shortcuts-help-title">${escapeHtml(labels.keyboardShortcuts)}</div>
				${listsHtml}
			</div>
		</div>
	`
}

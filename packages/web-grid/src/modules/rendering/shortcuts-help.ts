// =============================================================================
// Shortcuts help icon renderer
// =============================================================================
// Renders the floating "?" icon + hover-overlay that lists the user-defined
// rowShortcuts (key combo + label). Empty string is returned when the
// feature is off or when no shortcuts exist — the caller splices the result
// straight into the top-area HTML without any further branching.
//
// Custom content from `renderShortcutsHelpCallback` is prepended to the
// list when provided, so consumers can add prose / images above the
// generated keymap.

import type { GridHost } from '../grid-context.js'
import type { GridLabels } from '../../types.js'
import { formatKeyCombo } from '../keyboard/index.js'

/**
 * Build the shortcuts-help icon + overlay HTML string. Returns '' when the
 * feature is disabled or there are no rowShortcuts.
 */
// Built-in action → its `labels.actions` key
const ACTION_LABEL_KEYS: Record<string, keyof GridLabels['actions']> = {
	'add': 'add', 'delete': 'delete', 'duplicate': 'duplicate', 'move-up': 'moveUp', 'move-down': 'moveDown'
}

export function renderShortcutsHelpIcon<T>(ctx: GridHost<T>): string {
	if (!ctx.engine.isShortcutsHelpVisible || !ctx.engine.rowShortcuts?.length) {
		return ''
	}

	const position = ctx.engine.shortcutsHelpPosition
	const positionClass = position === 'top-left' ? 'wg__shortcuts-help--left' : ''

	// Build shortcuts list HTML
	const shortcutsHtml = ctx.engine.rowShortcuts.map(shortcut => {
		const formattedKey = formatKeyCombo(shortcut.shortcut)
		const text = shortcut.text ?? (shortcut.action ? ctx.engine.labels.actions[ACTION_LABEL_KEYS[shortcut.action]] : '')
		return `<div class="wg__shortcuts-help-item">
			<span class="wg__shortcuts-help-key">${formattedKey}</span>
			<span class="wg__shortcuts-help-label">${ctx.escapeHtml(text)}</span>
		</div>`
	}).join('')

	// Get custom content if callback is provided
	const customContent = ctx.engine.renderShortcutsHelpCallback?.(ctx.engine.ctx({})) || ''

	return `
		<div class="wg__shortcuts-help ${positionClass}">
			<button class="wg__shortcuts-help-icon" type="button" title="${ctx.engine.labels.keyboardShortcuts}">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<path d="M12 16v-4"></path>
					<path d="M12 8h.01"></path>
				</svg>
			</button>
			<div class="wg__shortcuts-help-overlay">
				${customContent ? `<div class="wg__shortcuts-help-custom">${customContent}</div>` : ''}
				<div class="wg__shortcuts-help-title">${ctx.engine.labels.keyboardShortcuts}</div>
				<div class="wg__shortcuts-help-list">
					${shortcutsHtml}
				</div>
			</div>
		</div>
	`
}

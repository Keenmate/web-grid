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

import { escapeHtml, renderIcon, renderSlotHtml } from '@keenmate/web-components-core'
import { GRID_ICONS } from '../../icons.js'
import type { GridHost } from '../grid-context.js'
import type { GridLabels } from '../../types.js'
import { formatShortcut } from '@keenmate/web-components-core/actions'
import { GRID_ENGINE } from '../grid-context.js'

/**
 * Build the shortcuts-help icon + overlay HTML string. Returns '' when the
 * feature is disabled or there are no row / range shortcuts.
 */
// Built-in action → its `menuItems.*` label key
const ACTION_LABEL_KEYS: Record<string, keyof GridLabels> = {
	'add': 'menuItems.addRow', 'delete': 'menuItems.deleteRow', 'duplicate': 'menuItems.duplicateRow', 'move-up': 'menuItems.moveUp', 'move-down': 'menuItems.moveDown'
}

export function renderShortcutsHelpIcon<T>(ctx: GridHost<T>): string {
	const rowShortcuts = ctx[GRID_ENGINE].rowShortcuts ?? []
	const rangeShortcuts = ctx[GRID_ENGINE].rangeShortcuts ?? []
	if (!ctx[GRID_ENGINE].isShortcutsHelpShown || (rowShortcuts.length === 0 && rangeShortcuts.length === 0)) {
		return ''
	}

	const position = ctx[GRID_ENGINE].shortcutsHelpPosition
	const positionClass = position === 'top-left' ? 'wg__shortcuts-help--left' : ''
	const labels = ctx[GRID_ENGINE].labels

	const itemHtml = (shortcut: string, text: string | undefined) => `<div class="wg__shortcuts-help-item">
			<span class="wg__shortcuts-help-key">${escapeHtml(formatShortcut(shortcut))}</span>
			<span class="wg__shortcuts-help-label">${escapeHtml(text ?? '')}</span>
		</div>`
	// A built-in action's `menuItems.*` label stays TEXT (escaped): core openMenu() writes the same key as textContent
	const rowItemsHtml = rowShortcuts.map(s =>
		itemHtml(s.shortcut, s.text ?? (s.action ? labels[ACTION_LABEL_KEYS[s.action]!] : ''))
	).join('')
	const rangeItemsHtml = rangeShortcuts.map(s => itemHtml(s.shortcut, s.text)).join('')

	// Row shortcuts under the main title; range shortcuts get their own sub-heading
	// when both lists are present.
	const listsHtml = rowItemsHtml && rangeItemsHtml
		? `<div class="wg__shortcuts-help-list">${rowItemsHtml}</div>
				<div class="wg__shortcuts-help-title">${ctx[GRID_ENGINE].labelHtml('headers.rangeShortcuts')}</div>
				<div class="wg__shortcuts-help-list">${rangeItemsHtml}</div>`
		: `<div class="wg__shortcuts-help-list">${rowItemsHtml || rangeItemsHtml}</div>`

	// Get custom content if callback is provided
	const callback = ctx[GRID_ENGINE].renderShortcutsHelpCallback
	const customContent = callback ? renderSlotHtml(() => callback(ctx[GRID_ENGINE].ctx({}))).html : ''

	return `
		<div class="wg__shortcuts-help ${positionClass}">
			<button class="wg__shortcuts-help-icon" type="button" title="${escapeHtml(labels['tooltips.keyboardShortcuts'])}">
				${renderIcon('shortcuts-help', { prefix: 'wg', host: ctx.shadow.host, defaults: GRID_ICONS })}
			</button>
			<div class="wg__shortcuts-help-overlay">
				${customContent ? `<div class="wg__shortcuts-help-custom">${customContent}</div>` : ''}
				<div class="wg__shortcuts-help-title">${ctx[GRID_ENGINE].labelHtml('headers.keyboardShortcuts')}</div>
				${listsHtml}
			</div>
		</div>
	`
}

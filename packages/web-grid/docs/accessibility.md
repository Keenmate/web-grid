# Accessibility

`<web-grid>` is designed to be navigable from the keyboard alone and to work with assistive technologies via standard HTML semantics. This document covers what's currently shipped — keyboard model, ARIA labels, focus behavior, contrast targets — and any known gaps.

## Keyboard navigation

Spreadsheet-like key bindings drive all navigation. Most are active in **navigate mode** (`editTrigger: 'navigate'` or `mode: 'excel'`), where Arrow keys move the focused cell without entering edit mode.

### Cell navigation

| Key | Action |
|---|---|
| **↑ / ↓ / ← / →** | Move focused cell one step in the arrow's direction |
| **Tab / Shift + Tab** | Move to next / previous editable cell. Skips read-only cells in heterogeneous grids; auto-opens the editor on the destination cell when committing |
| **Home / End** | Jump to first / last cell of the current row |
| **Ctrl + Home / End** | Jump to top-left / bottom-right of the grid |
| **Page Up / Page Down** | Move focus one page-height of cells up / down |
| **Enter** | Move down (or open dropdown if `shouldOpenDropdownOnEnter` is `true`) |
| **Escape** | Cancel an in-progress edit; close an open dropdown |

### Editing

| Key | Action |
|---|---|
| **F2** | Open the editor on the focused cell |
| **Space** | Toggle a checkbox cell; open a dropdown editor |
| **Enter** | Commit the edit and move down |
| **Tab** | Commit the edit and move right |
| **Escape** | Cancel the edit, restore the original value |
| **Type any character** | Start editing the focused cell with that character as the first input (navigate mode) |

The cursor position on cell-edit-start is configurable via `editStartSelection`: `'select-all'` (default), `'mouse-position'`, `'cursor-at-start'`, `'cursor-at-end'`.

### Selection

| Key | Action |
|---|---|
| **Shift + click / Shift + Arrow** | Extend cell selection range |
| **Ctrl + click** | Toggle selection on a row |
| **Ctrl + A** | Select all cells (where supported) |
| **Ctrl + C** | Copy the selected range as TSV (Excel-compatible) |
| **Ctrl + V** | Paste TSV at the focused cell (runs the paste pipeline) |
| **Ctrl + Delete** | Request deleting the current row — fires the `row-delete` event (`onRowDelete`); the grid itself doesn't delete |

### Tree mode

| Key | Action |
|---|---|
| **→** on a collapsed tree node | Expand the node |
| **←** on an expanded tree node | Collapse the node |
| **Enter** on a tree row (with `treeDoubleClickBehavior` set) | Triggers the configured behavior |

### Custom shortcuts

Per-row and per-range custom shortcuts are registered via `rowShortcuts` and `rangeShortcuts`:

```javascript
grid.rowShortcuts = [
  {
    shortcut: 'Ctrl+S',
    id: 'save',
    text: 'Save row',
    onClick: ({ row, rowIndex }) => saveRow(row)
  }
]
grid.isShortcutsHelpShown = true     // surfaces a ⓘ icon with the full key list
```

The help overlay surfaces the registered shortcuts to the user — set `isShortcutsHelpShown` so the binding is discoverable, not buried in code.

## ARIA roles & labels

The grid relies on **standard HTML semantics** (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`) plus a small set of explicit ARIA additions on interactive controls:

| Control | Attributes | Purpose |
|---|---|---|
| Tree expand / collapse button | `aria-label="Expand"` / `aria-label="Collapse"`, `tabindex="-1"` | The chevron `<button>` is visible to screen readers with state-appropriate label |
| Tree leaf spacer | `aria-hidden="true"` | Invisible decorative spacer skipped by AT |
| Select / combobox editor wrapper | `role="combobox"`, `aria-haspopup="listbox"` | Announces the combobox pattern |
| Cells in navigate mode | `tabindex="0"` on the active cell, `tabindex="-1"` on others | Single tab stop in the grid; arrow keys move within |

Standard `<table>` semantics are sufficient for read-only display grids — VoiceOver, NVDA, and JAWS all announce table structure (column header / row / cell), so theirs is the announcement of record.

## Focus management

- Cells in **navigate mode** receive DOM focus when navigated to (via arrow keys, click, or `focusCell()`). The host element is *not* itself focusable; focus lives at the cell level.
- Cells in **click / dblclick mode** receive `tabindex="-1"` only when they are programmatically focused — the cell becomes the focus target so subsequent keyboard input lands on the right element.
- The grid container has `tabindex="-1"` so it can receive focus programmatically (for instance after a dialog closes) without being a tab stop itself.
- Opening an editor moves focus to the editor input. Committing or cancelling returns focus to the cell.
- Opening the cell or header context menu moves focus to the first menu item; closing returns focus to the originating cell / header.
- Opening the datepicker keeps focus inside the picker until a date is committed or Escape is pressed.

## Contrast targets

The default palette honors **WCAG AA contrast for non-text UI (3:1)** on every interactive surface (header, body, hover, focused, selected-row, editing-cell) in both light and dark modes. The Playwright suite at `<repo-root>/e2e/dark-mode.spec.ts` runs 18 contrast assertions to keep this true across theme changes.

If you override the palette via `--base-*` or `--wg-*` variables, re-run the contrast suite (or the [WebAIM contrast checker](https://webaim.org/resources/contrastchecker/)) on your override values — the library cannot guarantee thresholds for palettes it doesn't ship.

See the [color-scheme contract](./theming.md#color-scheme-contract) for the dark / light flip mechanism.

## Form integration

`<web-grid>` is not a form control in the HTML sense — it does not synthesize a hidden input, does not participate in `FormData` submission, and does not fire `change` / `invalid` events on the host. Consumers wire row data into their forms manually via the `row-change` event and the [paste API](./usage.md#paste-api).

If you need form participation, wrap the grid in a controller that flattens `grid.items` into hidden inputs at submit time.

## Known gaps

The grid does **not** currently declare the full ARIA grid pattern (`role="grid"`, `role="row"`, `role="gridcell"`, `aria-rowindex`, `aria-colindex`, `aria-rowcount`, `aria-colcount`, `aria-selected`, `aria-readonly`). Native `<table>` semantics carry most of the information AT needs; the formal ARIA grid pattern would add row / column index announcements and selection-state announcements that the native pattern lacks.

If you need WCAG 2.2 AA compliance for a grid with explicit cell-selection or virtual-scroll announcements, please open an issue on the GitHub repo with your use case so we can prioritize the pattern correctly.

## See also

- [Usage / API reference](./usage.md) — `isShortcutsHelpShown`, `rowShortcuts`, `editStartSelection`, the `row-delete` event.
- [Theming → color-scheme contract](./theming.md#color-scheme-contract) — contrast and dark-mode flips.
- [`examples-shortcuts.html`](../../../docs/examples-shortcuts.html) — interactive demo of custom shortcuts + help overlay.

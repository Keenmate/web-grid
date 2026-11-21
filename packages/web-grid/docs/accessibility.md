# Accessibility

`<web-grid>` is designed to be navigable from the keyboard alone and to work with assistive technologies via standard HTML semantics. This document covers what's currently shipped — keyboard model, ARIA labels, focus behavior, contrast targets — and any known gaps.

## Keyboard navigation

Spreadsheet-like key bindings drive all navigation. Most are active in **navigate mode** (`editTrigger: 'navigate'` or `mode: 'excel'`), where Arrow keys move the focused cell without entering edit mode.

### Cell navigation

| Key | Action |
|---|---|
| **↑ / ↓ / ← / →** | Move focused cell one step in the arrow's direction |
| **Tab / Shift + Tab** | Leave the grid to the next / previous focusable on the page (pager, toolbar, …). Navigate mode is **one tab stop** (ARIA grid pattern): Tab enters on the active cell — the last focused one, else the first cell — and the next Tab leaves. With an editor open, Tab commits and moves (see Editing) |
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
| **Tab / Shift + Tab** | Commit the edit and move to the next / previous editable cell (Excel; skips read-only cells in heterogeneous grids) — focus stays in the grid |
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

### The grid pattern

The `<table>` declares the [ARIA grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) on top of its native semantics, so a screen reader announces the cell's real position even with virtual scrolling (only the visible window of rows exists in the DOM):

| Element | Attributes |
|---|---|
| `<table>` | `role="grid"` (`role="treegrid"` in tree mode), `aria-rowcount` (header rows + data rows on the current page), `aria-colcount`, `aria-multiselectable="true"`; `aria-readonly="true"` when the grid isn't editable (`readonly`, editing off, `disabled`); `aria-disabled="true"` when disabled |
| Header row / filter row | `role="row"`, `aria-rowindex="1"` / `"2"` |
| Column header | `role="columnheader"`, `aria-colindex`; `aria-sort="ascending"` / `"descending"` on the **primary** sort column (ARIA allows one sorted header at a time; the other columns of a multi-sort show their priority visually) |
| Data row | `role="row"`, `aria-rowindex` (1-based, the header row(s) count: with one header row, data row 0 is `2`), `aria-selected` (row selection); tree mode: `aria-level` (root = 1), `aria-expanded` on rows with children |
| Row number cell | `role="rowheader"`, `aria-colindex="1"` |
| Data cell | `role="gridcell"`, `aria-colindex`; `aria-readonly="true"` on a non-editable cell of an editable grid (read-only column, locked row, `getIsEditableCallback`); `aria-selected` while cell selection is on (`cellSelectionMode` not `'none'`): `true` inside the selected range or a selected column |
| Virtual-scroll spacer rows, filler cells | `aria-hidden="true"` |

Indexes are 1-based and count the rendered lead columns (row numbers, row-actions column) before the data columns. With pagination the counts and indexes are those of the current page (the row number column shows the same numbers).

The focused cell holds real DOM focus (see [Focus management](#focus-management)); there is no `aria-activedescendant` on the grid. Cell navigation is the grid's own Excel model (virtual rows, frozen columns, Tab to the next editable cell), not core `/a11y` roving focus — the rest of the pattern is unchanged.

### Controls

Interactive controls inside the grid carry their own ARIA:

| Control | Attributes | Purpose |
|---|---|---|
| Tree expand / collapse button | `aria-label="Expand"` / `aria-label="Collapse"`, `tabindex="-1"` | The chevron `<button>` is visible to screen readers with state-appropriate label |
| Tree leaf spacer | `aria-hidden="true"` | Invisible decorative spacer skipped by AT |
| Select / combobox editor wrapper | `role="combobox"`, `aria-haspopup="listbox"` | Announces the combobox pattern |
| Open cell dropdown | field: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant` (+ `aria-autocomplete="list"` on an input); panel `role="listbox"`, options `role="option"` + `aria-selected` / `aria-disabled` | Focus stays in the field; the screen reader follows the highlighted option (core `createActiveDescendant`, ARIA-only mode). The phone sheet stays a `role="dialog"` |
| Go-to-row dialog (Ctrl+G) | `role="dialog"`, `aria-modal="true"`; the page behind is `inert` | A real modal (core `startModalSession`): Tab stays inside, Escape / Back / backdrop cancel |
| Cells in navigate mode | Roving tabindex: `tabindex="0"` on the active cell only, `tabindex="-1"` on every other body cell | The grid is ONE tab stop (ARIA grid pattern): Tab enters on the active cell, the next Tab leaves the grid; Arrow keys / Home / End / Page Up / Down / Ctrl+Home move the active cell and the tab stop with it. A re-render or a virtual-scroll window swap keeps exactly one stop (the first rendered cell when the active row isn't rendered). Header cells are not focusable; the filter-row inputs are separate widgets and stay tab stops of their own |

## Focus management

- Cells in **navigate mode** receive DOM focus when navigated to (via arrow keys, click, or `focusCell()`). The host element is *not* itself focusable; focus lives at the cell level. Only the active cell is in the page's tab order (it stays the stop after the focus leaves the grid, so Shift+Tab comes back to it).
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

- `aria-rowcount` / `aria-rowindex` describe the current page, not the position in the whole (server-side) data set; with infinite scroll the count is the rows loaded so far.

## See also

- [Usage / API reference](./usage.md) — `isShortcutsHelpShown`, `rowShortcuts`, `editStartSelection`, the `row-delete` event.
- [Theming → color-scheme contract](./theming.md#color-scheme-contract) — contrast and dark-mode flips.
- [`examples-shortcuts.html`](../../../examples-shortcuts.html) — interactive demo of custom shortcuts + help overlay.

# @keenmate/web-grid

A feature-rich, framework-agnostic data grid web component built with TypeScript. Sorting, filtering, pagination, inline editing (8 editor types), cell range selection, clipboard support, row toolbar, context menus, frozen columns, column reorder/resize, fill handle, virtual scroll, dark mode, and full CSS variable theming — all in a Shadow DOM encapsulated `<web-grid>` element.

## What's New in v2.0.0-rc01

A major release — see the CHANGELOG for every rename (no aliases).

- **Shared interaction model** (`@keenmate/web-components-core`): every callback takes one `ctx` (with `controller` + `element`), every event has an `on*` twin, the row toolbar / cell and header menus / shortcuts are core action items, and both menus run on core `openMenu()`.
- **Suite-wide naming**: boolean attributes in the short HTML form (`enable-filtering`, `enable-editing`, `show-row-numbers`, `enable-virtual-scroll`, …), kebab-case enum values, `preset` (was `mode`), tree API with web-treeview names (`toggleRowExpanded`, `expandRows` / `expandAll(paths?)` with `ExpandOptions`, `expandedPaths: string[]`, `row-expand` / `row-collapse` / `expanded-change`), `cell-edit-start` / `cell-paste` / `focus-change` events, state as same-named properties on the element and `el.controller` (`selectedRows`, `selectedRowIndices`, `items`, …).
- **`readonly` and `disabled`**: `readonly` blocks edits, paste, fill and row add / delete / move but keeps selection and copy; `disabled` makes the grid inert. The `read-only` preset sets `readonly`.
- **Ctrl+Delete deletes**: the `delete` built-in removes the row (veto with `beforeActionCallback`) and `row-delete` reports it after the fact.
- **Core lifecycle**: `defer` / `release()` hold the first render, then `ready` / `:state(ready)` / `whenReady()`; `destroy()`.
- **`labels`** is also a JSON attribute, with `labels.noData` / `labels.noResults` for the empty table (`''` = blank), `labels.loading` for a pending infinite-scroll load; `scrollToRow(rowIndex)` resolves when the row is in view.
- **Dropdowns**: `editorOptions.isEmptyAllowed` adds an empty first item (→ `null`); "no options" vs "no matching options" texts.
- **Shared loader**: the infinite-scroll row and async dropdown search draw one loader (`--base-loader-*` tokens); swap it with `renderLoadingCallback` or page-wide `window.components.renderLoaderCallback`.
- **Lookups**: `getRowById(id)` → row or `null`, `getRowIndex(row)` → display index or `-1`.

## What's New in v1.2.0-rc02

- **Excel-like commit-on-click-away** — new `shouldCommitOnClickAway` property (defaults to `true`). Clicking a different cell while editing now commits the in-progress value through `beforeCommitCallback` / `validateCallback` instead of silently discarding it. Set to `false` to keep the legacy discard behavior. Companion fix: row focus (`.wg__row--focused`) now applies on the first cell click — previously it only landed on the second.
- **CSS surface taxonomy aligned with pure-admin's `--base-*` names** — `--wg-surface-1/2/3` renamed to `--wg-main-bg` / `--wg-elevated-bg`, `--wg-surface-floating` → `--wg-dropdown-bg` (`--wg-surface-3` merged into `--wg-hover-bg`). Consumer overrides of the old names need to migrate; see the CHANGELOG mapping table.
- **Dark mode reworked to respect consumer themes** — the dark-mode override blocks used to set `--wg-*` to hardcoded literals, silently overriding pure-admin / theme-designer values. They now just flip `color-scheme` and let `light-dark()` in `variables.css` do the work. The consumer's `--base-*` chain stays the source of truth.
- **OS-aware dark mode via `light-dark()` fallbacks** — every hardcoded fallback in `variables.css` is wrapped in `light-dark(<light>, <dark>)`. A consumer who only sets `body { color-scheme: dark }` (no overrides, no framework class) now gets a sensible dark palette automatically.
- **CSS architecture refactor: `@layer` cascade + canonical file set** — `main.css` now declares `@layer variables, component, overrides;` so consumer rules beat library defaults without `!important`. CSS filenames dropped the underscore prefix (pure-CSS doesn't use SASS-partial convention). New canonical Tier-2 files (`controls.css` / `floating.css` / `states.css` / `animations.css`) match the cross-component pattern.
- **`--base-active-bg` + `--base-inverse-bg`** — two new cross-component theming hooks. `--base-active-bg` distinguishes pressed from hover; `--base-inverse-bg` covers tooltip and future inverse UI surfaces. Both are optional and additive.
- **Context menu was leaking through stale `--base-*` names** — was referencing `--base-layer-01` / `--base-stroke-default` / `--base-error-color` (all long-removed in pure-admin). Now uses the canonical names; consumers loading a pure-admin theme finally get themed context menus instead of silent fallbacks.
- **WCAG contrast e2e suite** — 18 assertions check header / body / hover / focused / selected-row / editing-cell contrast against the 3:1 threshold (WCAG AA for non-text UI). Catches theme regressions invisible to visual smoke tests.

## Installation

```bash
npm install @keenmate/web-grid
```

Or via CDN (no bundler):

```html
<script type="module" src="https://unpkg.com/@keenmate/web-grid"></script>
```

## Getting Started

### Step 1 — Import the component

Importing the package registers the `<web-grid>` custom element globally. You only need to import it once anywhere in your app.

```javascript
import '@keenmate/web-grid'
```

For vanilla HTML without a bundler:

```html
<script type="module" src="https://unpkg.com/@keenmate/web-grid"></script>
```

### Step 2 — Drop the element into your markup

```html
<web-grid id="grid" style="max-height: 400px"></web-grid>
```

`max-height` (or `height`) on the host is how you control sizing — see [Height Modes](#height-modes).

### Step 3 — Assign data and columns

The grid reads its configuration from properties on the element, not attributes. Grab a reference and set what you need:

```javascript
const grid = document.getElementById('grid')

grid.items = [
  { id: 1, name: 'Alice', age: 28, department: 'Engineering' },
  { id: 2, name: 'Bob',   age: 34, department: 'Marketing' }
]

grid.columns = [
  { field: 'id',         title: 'ID',         width: '60px' },
  { field: 'name',       title: 'Name',       width: '160px' },
  { field: 'age',        title: 'Age',        width: '80px', horizontalAlign: 'right' },
  { field: 'department', title: 'Department', width: '160px' }
]
```

That's the minimum — a read-only grid with the headers, rows, and columns you defined.

### Step 4 — Enable the features you need

Turn on whatever the page calls for. Everything is off by default:

```javascript
grid.isStriped = true            // alternating row backgrounds
grid.isHoverable = true          // hover highlight
grid.isRowNumbersShown = true  // leftmost # column
grid.sortMode = 'multiple'          // click headers to sort, Ctrl+click to add
grid.isPagingEnabled = true
grid.pageSize = 25
grid.isEditingEnabled = true
grid.editTrigger = 'navigate'    // Excel-like: type to edit the focused cell
```

### Essential Properties

| Property | Type | Purpose |
|----------|------|---------|
| `items` | `T[]` | Row data — the only required "content" property |
| `columns` | `Column<T>[]` | Column definitions with at least a `field` each |
| `isStriped` / `isHoverable` / `isRowNumbersShown` | `boolean` | Cosmetic toggles |
| `sortMode` | `'none' \| 'single' \| 'multiple'` | Column sort behavior |
| `isPagingEnabled` + `pageSize` | `boolean` + `number` | Pagination |
| `isEditingEnabled` + `editTrigger` | `boolean` + `EditTrigger` | Enable inline editing and how it starts |
| `isFilteringEnabled` | `boolean` | Per-column filter row under the headers |
| `preset` | `'read-only' \| 'excel' \| 'input-matrix'` | Presets that set several of the above together |
| `isReadonly` / `isDisabled` | `boolean` | `readonly` (values can't change, still selectable / copyable) / `disabled` (no interaction) |

## Common Configurations

Short recipes for common setups. Each sets only what's necessary on top of the Step 3 minimum.

### Sortable grid

```javascript
grid.sortMode = 'multiple'   // or 'single'
```

### Paginated grid with top + bottom pager

```javascript
grid.isPagingEnabled = true
grid.pageSize = 25
grid.paginationPosition = 'top-center|bottom-center'
```

### Editable grid (Excel-like navigation)

```javascript
grid.preset = 'excel'   // isEditingEnabled + editTrigger='navigate' + cellSelectionMode='click'
```

Or opt in manually for finer control:

```javascript
grid.isEditingEnabled = true
grid.editTrigger = 'navigate'
```

### Per-column editors

```javascript
grid.columns = [
  { field: 'name',       title: 'Name',  editor: 'text' },
  { field: 'salary',     title: 'Salary', editor: 'number', editorOptions: { min: 0, step: 1000 } },
  { field: 'department', title: 'Dept',  editor: 'select',
    editorOptions: {
      options: [
        { value: 'eng', label: 'Engineering' },
        { value: 'sal', label: 'Sales' }
      ]
    }
  }
]
```

### Height modes

The grid's shadow DOM uses `max-height: inherit`, so setting `max-height` on the host controls its internal scroll container:

```html
<!-- Container: grid caps at 400px, scrolls internally -->
<web-grid style="max-height: 400px"></web-grid>

<!-- Full height: grid expands with content, page handles scrolling -->
<web-grid style="height: 100%"></web-grid>
```

For full-height mode, also set `isTableBorderOnly = true` so the grid doesn't capture wheel events:

```javascript
grid.isTableBorderOnly = true
```

### Header context menu with column hide + visibility submenu

```javascript
grid.headerContextMenu = [
  'sort-asc', 'sort-desc', 'clear-sort',
  { divider: true },
  'hide-column',        // hide the right-clicked column
  'column-visibility'   // submenu with a toggle per column
]
```

### Hide a column programmatically

```javascript
grid.columns.find(c => c.field === 'email').isHidden = true
grid.columns = [...grid.columns]   // reassign to trigger re-render
```

### Row toolbar

```javascript
grid.isRowToolbarShown = true
grid.rowToolbar = ['add', 'delete', 'duplicate', 'move-up', 'move-down']   // the built-ins do the work
```

### Master/detail — react to row focus

```javascript
grid.addEventListener('focus-change', (e) => showDetailsFor(e.detail.row))
// or the camelCase property twin:
grid.onFocusChange = ({ row }) => showDetailsFor(row)
```

### Validate a cell before commit

```javascript
grid.columns = [{
  field: 'email',
  title: 'Email',
  editor: 'text',
  validateCallback: ({ value }) => {
    if (!/^[^@]+@[^@]+$/.test(String(value))) {
      return { valid: false, message: 'Invalid email address' }
    }
    return { valid: true }
  }
}]
```

### TypeScript

Full type definitions ship with the package. Import types from the root:

```typescript
import '@keenmate/web-grid'
import type { Column, RowChangeDetail } from '@keenmate/web-grid'

interface Employee {
  id: number
  name: string
  salary: number
}

const columns: Column<Employee>[] = [
  { field: 'id',     title: 'ID',     width: '60px' },
  { field: 'name',   title: 'Name',   width: '200px' },
  { field: 'salary', title: 'Salary', editor: 'number' }
]
```

## Features

- **Sorting** — Single or multi-column with visual indicators
- **Filtering** — Per-column text input filters
- **Pagination** — Client-side or server-side, configurable layout and labels
- **Inline Editing** — 8 editor types: `text`, `number`, `checkbox`, `select`, `combobox`, `autocomplete`, `date`, `custom`
- **Grid Modes** — `read-only`, `excel`, `input-matrix` — each sets sensible defaults
- **Keyboard Navigation** — Spreadsheet-like Arrow/Tab/Home/End/PageUp/PageDown navigation
- **Cell Range Selection** — Click+drag, Shift+click (extends from the focused cell) or Shift+Arrow / Shift+Home/End / Ctrl+Shift+Arrow to select rectangular ranges
- **Clipboard** — Copy/paste TSV data (Excel-compatible), per-column transform callbacks
- **Row Toolbar** — Floating, inline, or cell-specific action buttons
- **Context Menu** — Right-click menu for cells and column headers (with predefined actions)
- **Keyboard Shortcuts** — Per-row and per-range custom shortcuts with help overlay
- **Column Reordering** — Drag-to-reorder with optional localStorage persistence
- **Column Resizing** — Drag column borders with min/max constraints and persistence
- **Frozen Columns** — Stick columns to the left during horizontal scroll
- **Fill Handle** — Excel-like autofill by dragging a cell's corner
- **Row Locking** — Optimistic locking with external lock management (WebSocket-ready)
- **Row Identification** — `idMember` (default `'id'`) / `getIdCallback` for drafts, `getRowById`, `getRowIndex`, `updateRowById`, `replaceRowById`, row locking
- **Virtual Scroll** — Render only visible rows for large datasets
- **Infinite Scroll** — Load-more pattern triggered near bottom of scroll
- **Dark Mode** — Auto-detects OS/attribute/class preferences
- **CSS Variable Theming** — 120+ `--wg-*` variables with `--base-*` fallback for cross-component themes
- **Shadow DOM** — Encapsulated styles, no CSS leakage
- **Summary Bar** — Configurable summary content at any corner position
- **Validation** — `validateCallback` (editor commits and paste) with tooltip display (custom HTML supported)
- **Row Focus Tracking** — the `focus-change` event for master/detail patterns
- **Events** — real DOM events (`row-change`, `action`, …) plus camelCase `on*` twin properties
- **i18n** — All UI labels customizable via `labels` property
- **TypeScript** — Full type definitions exported

## Architecture

The grid uses an **action pipeline** pattern for user interactions. DOM events are captured by the `ActionPipelineAdapter`, which translates them into typed action objects (34 action types). These actions flow through a pipeline that dispatches them to specialized executors (16 executors covering focus, editing, navigation, selection, clipboard, dropdown, fill-handle, etc.). Executors can emit child actions for composability — e.g., committing an edit can trigger a focus-move.

```
DOM Event → Adapter → Action → Pipeline → Executor → State Change → Render
```

This architecture separates mode detection (the adapter decides *what* action a click means based on grid mode, edit trigger, cell state) from business logic (executors handle *how* to focus, edit, select). It also allows incremental migration from legacy event handlers.

## Properties

### Core Data

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `items` | `T[]` | `[]` | Data array to display. Reading it returns the live rows: after `insertRow` / `removeRows` / `moveRow`, the row built-ins and a committed new row (cell edits stay in drafts — `getDrafts()`). |
| `columns` | `Column<T>[]` | `[]` | Column definitions (see [Column Definition](#column-definition)) |

### Display

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isFilteringEnabled` | `boolean` | `false` | Show the filter row (inputs for columns with `isFilterable: true`) and apply `filters` |
| `isStriped` | `boolean` | `false` | Alternate row background colors |
| `isHoverable` | `boolean` | `false` | Highlight row on hover |
| `isRowNumbersShown` | `boolean` | `false` | Show row number column |
| `isStickyRowNumbers` | `boolean` | `false` | Freeze row number column during horizontal scroll |
| `frozenColumnCount` | `number` | `0` | Freeze first N columns (applied after visual reorder from `isFrozen`) |
| `preset` | `GridPreset` | `'excel'` | Preset: `'read-only'`, `'excel'`, `'input-matrix'` (see [Presets](#presets)) |
| `isReadonly` | `boolean` | `false` | Attribute `readonly`. Values can't change (no edit / paste / fill / row add-delete-move); still focusable, selectable, copyable. The `read-only` preset sets it |
| `isDisabled` | `boolean` | `false` | Attribute `disabled`. No interaction at all (container `inert`, dimmed) |
| `focusedRowIndex` | `number \| null` | `null` | Currently focused row index (readable/writable; assigning it is silent — no `focus-change`) |

### Editing

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isEditingEnabled` | `boolean` | `false` | Enable cell editing |
| `isRowEditable` | `boolean` | — | Static per-grid row editability |
| `getIsRowEditableCallback` | `(ctx: { row }) => boolean` | — | Decides editability per row |
| `editTrigger` | `EditTrigger` | `'dblclick'` | How editing starts: `'click'`, `'dblclick'`, `'button'` (an edit button in editable cells — on hover and in the focused cell; F2 / Enter too), `'always'`, `'navigate'` |
| `editButtonIcon` | `string` (HTML) | `'✎'` | Content of the edit button (`editTrigger: 'button'` / `column.isEditButtonShown`) — HTML, e.g. `'<span class="lucide-pencil"></span>'`. Attribute `edit-button-icon`. Accessible name: `labels.editCell` |
| `editStartSelection` | `EditStartSelection` | `'select-all'` | Cursor position when entering edit via navigate: `'mouse-position'`, `'select-all'`, `'cursor-at-start'`, `'cursor-at-end'` |
| `dropdownToggleVisibility` | `ToggleVisibility` | `'on-focus'` | When to show dropdown toggle button: `'always'`, `'on-focus'` |
| `shouldOpenDropdownOnFocus` | `boolean` | `false` | Auto-open dropdown when cell is focused |
| `shouldOpenDropdownOnEnter` | `boolean` | `false` | Enter key opens dropdown (`true`) or moves to next row (`false`) |
| `isCheckboxAlwaysEditable` | `boolean` | `false` | Checkboxes are always clickable, even in navigate mode |

### Sorting

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sort` | `SortState[]` | `[]` | Current sort state (set for initial/server-side sort) |
| `sortMode` | `SortMode` | `'none'` | Sort mode: `'none'` (disabled), `'single'`, `'multiple'` |

### Pagination

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isPagingEnabled` | `boolean` | `false` | Enable pagination |
| `pageSize` | `number` | `10` | Rows per page |
| `pageSizes` | `number[]` | — | Available page sizes for selector (e.g., `[10, 25, 50, 100]`) |
| `paginationMode` | `'client' \| 'server'` | `'client'` | `'client'` = grid slices items; `'server'` = items are already current page |
| `currentPage` | `number` | `1` | Current page (1-based). A filter change resets it to 1 (unless set in the same task — a restored page + filter keep the page); a shorter `items` clamps it |
| `beforePageChangeCallback` | `(ctx: { trigger, fromPage, toPage, drafts }) => boolean \| number \| void \| Promise<…>` | — | Runs before a user action swaps the rows — pager buttons, page-size change, header sort / filter-row change in server mode (`trigger`: `'page'` / `'page-size'` / `'sort'` / `'filter'`). `false` → stay, a number → go to that page instead; async OK (the pager is disabled meanwhile). Programmatic `currentPage` writes and `load-more` skip it |
| `totalItems` | `number \| null` | `null` | Total item count for server-side pagination |
| `isPaginationShown` | `boolean \| 'auto'` | `'auto'` | `true` = always show, `false` = never, `'auto'` = hide when ≤1 page (`showPagination` is a deprecated alias) |
| `paginationPosition` | `string` | `'bottom-center'` | Position(s): `'bottom-center'`, `'top-right\|bottom-right'` for multiple |
| `getPaginationLabelsCallback` | `(ctx: { currentPage, totalPages, totalItems, pageSize }) => Partial<PaginationLabels>` | — | Customize/translate pagination text |
| `paginationLayout` | `string` | — | Element order: `'page-size\|previous\|page-info\|next'` or `'first\|previous\|page-info\|next\|last'` |

### Row Toolbar

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isRowToolbarShown` | `boolean` | `false` | Show row action toolbar |
| `rowToolbar` | `GridToolbarEntry<T>[]` | `['add', 'delete', 'duplicate']` | Toolbar entries: built-in names, action items, dividers (see [Row Toolbar](#row-toolbar-1)) |
| `toolbarTrigger` | `'hover' \| 'click' \| 'button'` | `'hover'` | How to show toolbar |
| `toolbarPosition` | `ToolbarPosition` | `'auto'` | Preferred position: `'auto'`, `'left'`, `'right'`, `'top'`, `'inline'` |
| `toolbarVerticalAlign` | `'top' \| 'center' \| 'bottom'` | `'bottom'` | Vertical alignment for left/right position |
| `toolbarHorizontalAlign` | `'start' \| 'center' \| 'end' \| 'cursor'` | `'center'` | Horizontal alignment for top position |
| `toolbarColumn` | `string \| number` | — | Column to pin toolbar over (field name or index) for `'top'` position |
| `shouldToolbarFollowCursor` | `boolean` | `false` | Toolbar follows mouse cursor horizontally |
| `getCellToolbarItemsCallback` | `(ctx: CellContext<T>) => GridToolbarEntry<T>[] \| null \| undefined` | — | Cell-specific toolbar items, merged over `rowToolbar` by `id` / `action` |
| `cellToolbarOffset` | `number \| string` | `0.2` | Horizontal offset: `0`–`1` as fraction of cell width, or CSS length (e.g., `'2rem'`) |
| `toolbarBtnMinWidth` | `string` | — | Min-width for toolbar buttons (CSS value). Overrides `--wg-toolbar-btn-min-width` |

| `createEmptyRowCallback` | `(ctx) => T \| Promise<T>` | — | The row the `add` built-in inserts (default: a blank row) |
| `createDuplicateRowCallback` | `(ctx: { row, rowIndex }) => T` | — | The copy the `duplicate` built-in inserts (default: shallow copy with `idMember` cleared) |
| `beforeActionCallback` | `(detail: GridActionEventDetail<T>) => unknown` | — | Runs before any toolbar / menu / shortcut item activates; return `false` to cancel (async OK) |

> **Deprecated aliases:** `toolbarAlign` → use `toolbarVerticalAlign`; `toolbarTopPosition` → use `toolbarHorizontalAlign`; `toolbarFollowsCursor` → use `shouldToolbarFollowCursor`.

### Context Menu

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `contextMenu` | `GridMenuEntry<T>[]` | — | Cell/row context menu entries: built-in names, menu items, dividers (see [Context Menu](#context-menu-1)) |
| `contextMenuXOffset` | `number` | `8` | Horizontal offset from click position |
| `contextMenuYOffset` | `number` | `0` | Vertical offset from click position |
| `headerContextMenu` | `GridHeaderMenuEntry<T>[]` | — | Header context menu entries: built-in names, menu items, dividers |
| `beforeContextMenuOpenCallback` | `(ctx: CellContext<T>) => false \| GridMenuEntry<T>[] \| void` | — | Runs before the cell menu opens (sync). `false` → no grid menu (the browser's shows); an entries array → shown instead of `contextMenu` |
| `beforeHeaderMenuOpenCallback` | `(ctx: HeaderMenuContext<T>) => false \| GridHeaderMenuEntry<T>[] \| void` | — | Same for the header menu |

### Cell Selection

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `cellSelectionMode` | `CellSelectionMode` | `'click'` | How to select cell ranges: `'none'`, `'click'` (drag; Shift+click extends from the focused cell), `'shift'` (Shift+click twice / Shift+drag). In every mode but `'disabled'`, Shift+Arrow grows / shrinks the range from the focused cell (the anchor keeps focus), Shift+Home / End go to the row start / end, Ctrl+Shift+Arrow to the data edge; while editing, Shift+Arrow selects text in the editor |
| `shouldCopyWithHeaders` | `boolean` | `false` | Include column headers when copying cell selection to clipboard |

### Keyboard Shortcuts

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rowShortcuts` | `GridShortcut<T>[]` | — | Action items bound to a key on the focused / hovered row (see [Keyboard Shortcuts](#keyboard-shortcuts-1)) |
| `rangeShortcuts` | `GridRangeShortcut<T>[]` | — | Action items bound to a key on the selected rows / cell range |
| `isShortcutsHelpShown` | `boolean` | `false` | Show keyboard shortcuts help icon |
| `shortcutsHelpPosition` | `'top-right' \| 'top-left'` | `'top-right'` | Help icon position |
| `renderShortcutsHelpCallback` | `(ctx) => string` | — | Custom HTML shown alongside the shortcuts list |

### Column Management

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `gridName` | `string \| null` | `null` | Unique name for localStorage persistence |
| `shouldPersistColumnWidths` | `boolean` | `false` | Persist column widths to localStorage (requires `gridName`) |
| `isColumnReorderAllowed` | `boolean` | `false` | Enable drag-to-reorder columns |
| `shouldPersistColumnOrder` | `boolean` | `false` | Persist column order to localStorage (requires `gridName`) |

### Fill Handle

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `fillDirection` (`fill-direction`) | `'vertical' \| 'all'` | `'vertical'` | Grid-wide fill-handle direction: `'vertical'` fills the source column only, `'all'` also across columns. A column's own `fillDirection` wins |
| `beforeFillCallback` | `(ctx: { sourceCell, targetCells, direction }) => boolean \| void \| Promise<…>` | — | Runs before a fill-handle drag applies. Return `false` to cancel (async OK) |

### Row Identification

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `idMember` | `string \| null` | `'id'` | Field containing the row's unique ID — the only row-id member: drafts, invalid-cell markers, `getRowId`, `getRowById`, `getRowIndex`, `updateRowById`, `replaceRowById`, row locking. `null` = rows have no id |
| `getIdCallback` | `(ctx: { row }) => unknown` | — | Callback returning the row's unique ID (wins over `idMember`) |

### Row Locking

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rowLocking` | `RowLockingOptions<T>` | — | Row locking configuration (see [RowLockingOptions](#row-locking-options)) |

#### RowLockingOptions

| Field | Type | Description |
|-------|------|-------------|
| `isLockedMember` | `keyof T` | Property with boolean lock state |
| `lockInfoMember` | `keyof T` | Property with `RowLock` object |
| `getIsLockedCallback` | `(ctx: { row, rowIndex }) => boolean` | Callback-based lock check |
| `getLockInfoCallback` | `(ctx: { row, rowIndex }) => RowLock \| null` | Callback-based lock info |
| `lockedEditBehavior` | `'block' \| 'allow' \| 'callback'` | Edit behavior for locked rows (default: `'block'`) |
| `getCanEditLockedCallback` | `(ctx: { row, rowIndex, lockInfo }) => boolean` | Per-row edit decision (when `'callback'`) |

### Scroll

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isScrollable` | `boolean` | `false` | Enable scroll container with max-height |
| `scrollMaxHeight` | `string` | `'100vh'` | Max-height when `isScrollable` is `true` |
| `isTableBorderOnly` | `boolean` | `false` | Border only around table, not pagination/toolbar (`tableBorderOnly` is a deprecated alias) |

### Virtual Scroll

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isVirtualScrollEnabled` | `boolean` | `false` | Enable virtual scroll |
| `virtualScrollThreshold` | `number` | `100` | Auto-enable when items ≥ threshold |
| `virtualScrollItemHeight` | `number` | `38` | Fixed row height in pixels |
| `virtualScrollOverscan` | `number` | `10` | Extra rows rendered above/below viewport |

### Infinite Scroll

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isInfiniteScrollEnabled` | `boolean` | `false` | Enable infinite scroll |
| `infiniteScrollThreshold` | `number` | `100` | Distance from bottom (px) to trigger load |
| `hasMoreItems` | `boolean` | `true` | Set to `false` when no more data |

While a `load-more` request is pending, a row at the bottom shows the loader + `labels.loading` (see [Loading states](#loading-states)).

### Loading states

Every loader draws through one shared hook (core `renderLoader`): the infinite-scroll row
(`context: 'row'`, label `labels.loading`) and the autocomplete's async search (`context: 'search'`,
label `labels.dropdownSearching` — in the editor and in the dropdown). The container gets
`role="status"` + `aria-label`.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `renderLoadingCallback` | `(ctx: LoaderRenderContext) => void \| (() => void)` | `null` | Draws the grid's loaders: fill `ctx.containerElement` (`ctx`: `{ component, context, containerElement, element, label }`); may return a cleanup. Beats the page-wide `window.components.renderLoaderCallback` |

Precedence: `renderLoadingCallback` > `window.components.renderLoaderCallback` (one hook for every
KeenMate component on the page) > the default `<span class="wg-loader">`, a mask drawn in
`currentColor` from `--wg-loader-icon` / `-rotate` / `-duration` / `-size` (→ `--base-loader-*`).
Change the shape page-wide with `--base-loader-icon`; reduced motion slows it (1.5s), it never stops.

```js
window.components.renderLoaderCallback = ({ context, containerElement }) => {
  containerElement.innerHTML = '<span class="my-dots"></span>'
}
```

### Tooltip

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `tooltipShowDelay` | `number` | `200` | Delay in ms before showing tooltip |
| `tooltipHideDelay` | `number` | `100` | Delay in ms before hiding tooltip |

### Summary

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `summaryPosition` | `string` | — | Position(s): `'bottom-left'`, `'top-right\|bottom-right'`, etc. |
| `renderSummaryCallback` | `(ctx: { items, allItems, totalItems, currentPage, pageSize, metadata, drafts }) => string` | — | Returns the summary bar HTML |
| `isSummaryInline` | `boolean` | `true` | Share row with pagination when in same area |
| `summaryMetadata` | `unknown` | — | Server-provided metadata passed to `renderSummaryCallback` as `ctx.metadata` (adjust server aggregates by `ctx.drafts` — every unsaved draft, also on other pages) |

### Filtering

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `filters` | `Record<string, string>` | `{}` | Current filter value per field. Assigning it is silent (no `filter-change`, like a native `input.value`); `setFilter(field, text, { isSilent? })` fires it |
| `filterMode` | `'client' \| 'server'` | `'client'` | `'server'`: the grid doesn't filter `items` — listen to `filter-change` (`{ filters }`) and load the rows. Attribute `filter-mode` |

**Filter row.** With `isFilteringEnabled`, a row under the header gets a text input for every column with `isFilterable: true` (labelled "Filter &lt;column&gt;" via `labels.filterColumn`; Tab-reachable). Typing is debounced (300 ms; Enter applies at once, Escape clears) → `setFilter(field, text)` → page 1. A `filterCallback` returning `null` marks the input `.invalid` (red border, `aria-invalid`) and ignores that filter. In server pagination a filter change runs `beforePageChangeCallback` (trigger `'filter'`) and fires `data-request` (trigger `'filter'`). Styled by the `--wg-filter-*` variables. A filter change (UI or `setFilter` / `filters`) resets `currentPage` to 1.

### Styling

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `getCustomStylesCallback` | `(ctx) => string` | — | Returns CSS string injected into shadow DOM |
| `getRowClassCallback` | `(ctx: { row, rowIndex }) => string \| null` | — | Dynamic CSS class for rows |
| `labels` | `GridLabelsInput` (partial `GridLabels`, nested groups too) | — | Override UI labels for i18n (see [i18n](#i18n)) |
| `getValidationTooltipCallback` | `(ctx: CellContext<T> & { error }) => string \| null` | — | Custom HTML for validation error tooltip (grid-level default) |
| `invalidCells` | `CellValidationState[]` | `[]` | External validation state for cells |

### Responsive rules

Partial configs per device class or window-width breakpoint, applied by
`@keenmate/web-components-core` ([SPEC §6.7](https://github.com/KeenMate/web-components-core/blob/main/docs/SPEC.md#67-responsive-rules--partial-configs-per-device-class-page--tag--instance)).
A rule is a **map** with two axes — `{ device: { mobile: { … } }, breakpoint: { mobile: { … } } }` —
or a **callback** (`(ctx) => partial | undefined`), set at three levels:

- `device` — the kind of device (`classifyDevice`: touch capability first, then the short side):
  `mobile` = a phone, `tablet` = a touch tablet; a mouse / trackpad machine is `desktop` at any width.
- `breakpoint` — the window width (`mobile` < 768 px ≤ `tablet` < 1024 px ≤ `desktop`), so a narrowed
  desktop window counts too. Within one map the breakpoint entry applies first, the device entry over
  it (device wins on the same key).
- Your own widths or combinations (device class AND width, orientation, …) go in `responsiveCallback`.

```js
// page — every KeenMate component (keys a component doesn't have are skipped)
window.components.responsive = { device: { mobile: { pageSize: 10 } } }
// tag — every <web-grid>
window.components['web-grid'].responsive = {
  device: {
    mobile: { pageSize: 10, isRowNumbersShown: false, editTrigger: 'click', isRowToolbarShown: false },
    tablet: { pageSize: 20 },
  },
  breakpoint: { mobile: { frozenColumnCount: 0 } },
}
window.components['web-grid'].responsiveCallback = ({ env }) =>
  env.viewportWidth < 600 ? { isRowToolbarShown: false } : undefined
// instance — property, or the JSON attribute `responsive`
grid.responsive = { breakpoint: { mobile: { pageSize: 5 } } }
grid.responsiveCallback = ({ deviceClass }) => (deviceClass === 'tablet' ? { isStriped: false } : undefined)
```

```html
<web-grid page-size="25" responsive='{"breakpoint":{"mobile":{"pageSize":5}}}'></web-grid>
```

**Precedence** (later wins, key by key): page map → page callback → tag map → tag callback →
**instance attributes / properties** → instance map → instance callback. A value written on the
grid always beats a page rule; the grid's own rules beat everything. An instance rule returning
`null` ignores all page rules. Overrides never reflect to attributes; a key a rule stops returning
goes back to its base value. Rules re-run on a device class / breakpoint / orientation change and
when any rule changes.

- The pre-1.0.0-rc15 core shape (`{ mobile: { … } }` without an axis) warns and is ignored.
  `ctx.config` in a callback is the base config.
- Only the grid's **inputs** (the attribute flags above, plus `labels` and `renderLoadingCallback`)
  can be set. `columns`, `items`, the other callbacks and UI state (`currentPage`, `sort`,
  `filters`, …) are properties, not inputs — a tag / instance rule naming them warns and skips the key.
- Types: `GridResponsiveMap`, `GridResponsiveCallback` (over `GridResponsiveConfig` /
  `GridInputKey`), `ResponsiveContext`.

## Column Definition

The `Column<T>` interface defines how each column renders, edits, and behaves.

### Basic

| Field | Type | Description |
|-------|------|-------------|
| `field` | `keyof T \| string` | Data field name (**required**) |
| `title` | `string` | Column header title |
| `headerInfo` | `string` | Info tooltip shown next to header (displays ⓘ icon) |
| `width` | `string` | Column width (e.g., `'100px'`, `'20%'`) |
| `minWidth` | `string` | Minimum width during resize |
| `maxWidth` | `string` | Maximum width during resize |

### Display

| Field | Type | Description |
|-------|------|-------------|
| `horizontalAlign` | `'left' \| 'center' \| 'right' \| 'justify'` | Cell horizontal alignment (default: `'left'`) |
| `verticalAlign` | `'top' \| 'middle' \| 'bottom'` | Cell vertical alignment (default: `'middle'`) |
| `headerHorizontalAlign` | `'left' \| 'center' \| 'right' \| 'justify'` | Header horizontal alignment (defaults to `horizontalAlign`) |
| `headerVerticalAlign` | `'top' \| 'middle' \| 'bottom'` | Header vertical alignment (defaults to `verticalAlign`) |
| `textOverflow` | `'wrap' \| 'ellipsis'` | Text overflow behavior |
| `maxLines` | `number` | Maximum visible lines when `textOverflow` is `'wrap'` (CSS line-clamp) |
| `cellClass` | `string` | Static CSS class applied to all cells in this column |
| `getCellClassCallback` | `(ctx: CellContext<T>) => string \| null` | Dynamic CSS class based on value/row |

Every column callback takes one `ctx`. The cell ctx (`CellContext<T>`) is `{ row, rowIndex, column, colIndex, field, value }`, plus the non-enumerable `controller` and `element`.

### Content

| Field | Type | Description |
|-------|------|-------------|
| `getDisplayValueCallback` | `(ctx: CellContext<T>) => string` | Display text for the cell (escaped) |
| `renderCellCallback` | `(ctx: CellContext<T>) => string` | Custom cell HTML (wins over `getDisplayValueCallback`) |

### Filtering

| Field | Type | Description |
|-------|------|-------------|
| `filterCallback` | `(ctx: { filterValue, row, column, field }) => boolean \| null` | Custom filter predicate; `null` = incomplete input (ignored, input marked invalid) |

### Editing

| Field | Type | Description |
|-------|------|-------------|
| `isEditable` | `boolean` | Enable editing for this column |
| `getIsEditableCallback` | `(ctx: { row }) => boolean` | Per-row editability for this column (when it returns `true`, the cell is editable even on a read-only grid) |
| `editor` | `EditorType` | Editor type: `'text'`, `'number'`, `'checkbox'`, `'select'`, `'combobox'`, `'autocomplete'`, `'date'`, `'custom'` |
| `editTrigger` | `EditTrigger` | Per-column override for edit trigger |
| `editorOptions` | `EditorOptions<T>` | Editor-specific configuration (see [Editor Types](#editor-types)) |
| `dropdownToggleVisibility` | `ToggleVisibility` | Per-column override: `'always'` or `'on-focus'` |
| `shouldOpenDropdownOnEnter` | `boolean` | Per-column override: Enter opens dropdown or moves down |
| `renderEditorCallback` | `(ctx: EditorContext<T>) => void` | Handler for `'custom'` editor type — the cell ctx + `commit(value)` / `cancel()` |
| `isEditButtonShown` | `boolean` | Show the edit button in this column's editable cells whatever the `editTrigger` (`'button'` shows it anyway) |

### Validation

| Field | Type | Description |
|-------|------|-------------|
| `validateCallback` | `(ctx: ValidateContext<T>) => ValidateResult \| Promise<ValidateResult>` | Validates and optionally transforms a value — runs for editor commits and pasted cells |
| `getValidationTooltipCallback` | `(ctx: CellContext<T> & { error }) => string \| null` | Custom HTML for this column's validation error tooltip |

`validateCallback` receives `{ value, oldValue, row, rowIndex, column, colIndex, field, source: 'edit' | 'paste' }` and can return:
- `{ valid: true }` or `{ valid: true, transformedValue: ... }` — accept (optionally transform)
- `{ valid: false, message: 'Error text' }` — reject with message
- `true` / `null` / `undefined` — accept
- `false` — reject (no message)
- `string` — reject with that string as error message

An invalid value is not a veto: it stays as a draft, the cell is marked invalid and the `validation-error` event fires.

### Tooltip

| Field | Type | Description |
|-------|------|-------------|
| `tooltipMember` | `string` | Property name in row data containing tooltip text |
| `getTooltipCallback` | `(ctx: CellContext<T>) => string \| null` | Dynamic tooltip (takes priority over `tooltipMember`) |
| `isTooltipHtml` | `boolean` | Render tooltip content as HTML |

### Clipboard

| Field | Type | Description |
|-------|------|-------------|
| `getCopyValueCallback` | `(ctx: CellContext<T>) => string` | Text copied for this cell |
| `getPasteValueCallback` | `(ctx: CellContext<T> & { text }) => unknown` | Value stored for the pasted text |

Without `getPasteValueCallback`, pasted text is typed for the column: **number** — the editor's strict parse; **checkbox** — `true` / `1` / `yes` / `x` / `✓` or the text of `trueValue` → `trueValue`, `false` / `0` / `no` / blank or the text of `falseValue` → `falseValue`; **date** — the column's `dateFormat`, then ISO `YYYY-MM-DD`, stored per `outputFormat`. Text that doesn't parse is kept and the cell marked invalid (`labels.invalidNumber` / `invalidBoolean` / `invalidDate`).

Grid-level paste hooks: `beforePasteCallback(ctx)` runs before a multi-cell paste (`false` cancels, async OK; add `"rowIndex-colIndex"` keys to `ctx.skipCells` to skip cells) and `createRowCallback({ data, rowIndex })` builds rows for pasted data past the last row. `pasteMode` and `shouldValidateOnPaste` control what gets pasted; `cell-paste` reports the result.

### Layout

| Field | Type | Description |
|-------|------|-------------|
| `isFrozen` | `boolean` | Column sticks to left side during horizontal scroll |
| `isResizable` | `boolean` | Allow column width to be changed by dragging (default: `true`) |
| `isReorderable` | `boolean` | Allow column to be reordered by dragging (default: `true`) |
| `isHidden` | `boolean` | Column is not rendered but kept in array for visibility toggling |
| `isSortable` | `boolean` | Enable sorting for this column (when grid has `sortMode` enabled) |
| `isFilterable` | `boolean` | This column gets a filter-row input (opt-in) |

### Fill

| Field | Type | Description |
|-------|------|-------------|
| `fillDirection` | `FillDirection` | Override the grid-level `fillDirection` (`fill-direction`) for this column: `'vertical'` or `'all'` |

## Editor Types

| Type | Description |
|------|-------------|
| `text` | Text input |
| `number` | Numeric input with step/min/max |
| `checkbox` | Boolean toggle |
| `select` | Dropdown list |
| `combobox` | Filterable dropdown |
| `autocomplete` | Async search dropdown |
| `date` | Date picker |
| `custom` | Consumer-controlled via `renderEditorCallback` |

### Text Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxLength` | `number` | — | Maximum character count |
| `placeholder` | `string` | — | Placeholder text |
| `pattern` | `string` | — | Input pattern attribute |
| `inputMode` | `'text' \| 'numeric' \| 'email' \| 'tel' \| 'url'` | — | Virtual keyboard hint |
| `editStartSelection` | `EditStartSelection` | `'select-all'` | Cursor position when entering edit |

### Number Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `min` | `number` | — | Minimum value |
| `max` | `number` | — | Maximum value |
| `step` | `number` | — | Step increment |
| `decimalPlaces` | `number` | — | Round the value to this many decimals |
| `allowNegative` | `boolean` | — | `false` → a negative value is invalid |

The typed text is parsed strictly (`Number()` + `isFinite`, trimmed; blank → `null`): `abc` or `12abc` mark the cell invalid (`labels.invalidNumber`, "Not a number"), as do values outside `min` / `max` or a negative with `allowNegative: false` — **no clamping**; the draft keeps what was typed and `validation-error` fires. `decimalPlaces` rounds (`1.239` → `1.24`). Pasted text goes through the same parse.

### Checkbox Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `trueValue` | `unknown` | `true` | Value to store when checked |
| `falseValue` | `unknown` | `false` | Value to store when unchecked |

### Date Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minDate` | `Date \| string` | — | Minimum selectable date |
| `maxDate` | `Date \| string` | — | Maximum selectable date |
| `dateFormat` | `string` | — | Display format: `'YYYY-MM-DD'`, `'DD.MM.YYYY'`, etc. |
| `outputFormat` | `DateOutputFormat` | — | What to store: `'date'` (Date object), `'iso'` (ISO string), `'timestamp'` |

### Shared Dropdown Options (select, combobox, autocomplete)

These options are shared across `select`, `combobox`, and `autocomplete` editor types.

#### Providing Options

| Option | Type | Description |
|--------|------|-------------|
| `options` | `EditorOption[]` | Static array of options: `{ value, label, ...extra }` |

#### Display Mapping

By default, options use `value` and `label` properties. Override with member strings or callback functions (each callback takes `({ option })`):

| Member Property | Callback Alternative | Description |
|-----------------|---------------------|-------------|
| `valueMember` | `getValueCallback` | Property/callback for the option value |
| `displayMember` | `getDisplayValueCallback` | Property/callback for display text |
| `searchMember` | `getSearchValueCallback` | Property/callback for searchable text (falls back to display) |
| `iconMember` | `getIconCallback` | Property/callback for icon/emoji |
| `subtitleMember` | `getSubtitleCallback` | Property/callback for subtitle/description |
| `disabledMember` | `getIsDisabledCallback` | Property/callback for disabled state |
| `groupMember` | `getGroupCallback` | Property/callback for grouping options |

#### Rendering & Behavior

| Option | Type | Description |
|--------|------|-------------|
| `renderOptionCallback` | `(ctx: { option, optionIndex, isFocused, isSelected, isDisabled }) => string` | Custom HTML for each option |
| `onSelect` | `(ctx: { option, row, rowIndex, column, field, … }) => void` | Fires when an option is selected |
| `isEmptyAllowed` | `boolean` | An empty first item (`labels.dropdownEmptyOption`, "—") that sets the value to `null` (default `false`) |
| `labels` | `{ dropdownNoData?, dropdownNoResults?, dropdownSearching?, dropdownEmptyOption? }` | This column's dropdown texts, per key over the grid `labels` |
| `dropdownMinWidth` | `string` | Minimum width for dropdown (e.g., `'300px'`) |
| `placeholder` | `string` | Placeholder text (combobox/autocomplete) |

### Autocomplete-Specific Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `searchCallback` | `(ctx: { term, row, rowIndex, column, field, signal }) => Promise<EditorOption[]>` | — | Async search function (`signal` aborts when a newer search starts) |
| `initialOptions` | `EditorOption[]` | — | Options shown before user starts typing |
| `minSearchLength` | `number` | `1` | Minimum characters before triggering search |
| `debounceMs` | `number` | `300` | Debounce delay for search calls |
| `multiple` | `boolean` | `false` | Allow multiple selections |
| `maxSelections` | `number` | — | Maximum items when `multiple` is `true` |

### Custom Editor

Set `editor: 'custom'` and provide a `renderEditorCallback` on the column:

```javascript
{
  field: 'color',
  editor: 'custom',
  renderEditorCallback: ({ value, row, rowIndex, field, commit, cancel }) => {
    // Open your own UI (modal, popover, etc.)
    // Call commit(newValue) to save, cancel() to discard
  }
}
```

## Presets

The `preset` property (attribute `preset`; `mode` before v2) sets sensible defaults for common use cases:

| Preset | `isEditingEnabled` | `editTrigger` | `cellSelectionMode` | `dropdownToggleVisibility` | `shouldOpenDropdownOnFocus` |
|------|-------------|--------------|--------------------|--------------------------|-----------------------------|
| `'read-only'` (+ `isReadonly = true`) | `false` | — | `'click'` | `'on-focus'` | `false` |
| `'excel'` | `true` | `'navigate'` | `'click'` | `'always'` | `false` |
| `'input-matrix'` | `true` | `'always'` | `'shift'` | `'always'` | `true` |

- **`read-only`** — No editing. Click to select cells. Useful for display grids with copy support.
- **`excel`** — Navigate cells with arrows, type to start editing, Escape to cancel. Click+drag for cell selection.
- **`input-matrix`** — All cells are always in edit mode. Shift+click for cell selection. Tab to navigate between fields.

Setting `preset` applies these defaults, but you can override individual properties afterward. `isReadonly` (`readonly`) and `isDisabled` (`disabled`) also work on their own, with any preset.


## Interaction Model

Callbacks, events and clickable items follow the shared KeenMate interaction model (`@keenmate/web-components-core`):

- **Every callback takes one `ctx` object.** Every ctx and every event detail also carries `controller` (the public `GridController`, same as `el.controller`) and `element` (the `<web-grid>` host) — both non-enumerable, so `JSON.stringify` and logs see only the data.
- **`*Callback` properties affect behavior** (return a value, or `false` to cancel a `before*Callback`); **events** only notify.
- **Toolbar buttons, context-menu items and shortcuts are action items** with one shape (below). Activating any of them fires the `action` event.

### Action items

| Field | Type | Description |
|-------|------|-------------|
| `action` | built-in name | Runs a built-in (see the tables below). Omit for a custom item |
| `id` | `string` | Identifies a custom item; reported back in the `action` event |
| `text` | `string` | Label. On icon toolbar buttons it's the accessible name + tooltip heading (shown as a label only without an `icon` or with `isTextVisible`) |
| `icon` | `string` | Icon (glyph / markup) |
| `tooltip` | `string` | Tooltip description line |
| `shortcut` | `string` | Key chord hint (`'Ctrl+D'`); on `rowShortcuts` / `rangeShortcuts` it's the binding |
| `isDanger` | `boolean` | Destructive styling |
| `isDisabled` / `getIsDisabledCallback(ctx)` | `boolean` | Greyed out |
| `isVisible` / `getIsVisibleCallback(ctx)` | `boolean` | Default `true` |
| `isToggled` / `getIsToggledCallback(ctx)` | `boolean` | Toggle state — the thing it toggles is ON (`aria-pressed` on buttons, `role="menuitemcheckbox"` + `aria-checked` in menus, `--toggled` class) |
| `getTextCallback(ctx)` / `getIconCallback(ctx)` / `getTooltipCallback(ctx)` | `string` | Dynamic text / icon / tooltip |
| `cssClass` | `string` | Extra CSS classes |
| `onClick(detail)` | `(detail) => void \| Promise<void>` | Runs on activation with the same detail the `action` event carries |
| `row` | `number` | Toolbar only — toolbar row, 1 = closest to the grid row |
| `isTextVisible` | `boolean` | Toolbar only — show `text` next to the icon |
| `children` / `getChildrenCallback(ctx)` | entries | Menus only — static / lazy (sync or async) submenu |
| `shouldCloseOnClick` | `boolean` | Menus only — default `true` |

A **divider** is an entry `{ divider: true, text? }` (a labelled one is a group heading), or `menuDivider(text)` exported from the package.

`beforeActionCallback(detail)` runs before any item activates (toolbar, menu, shortcut, built-in or custom) — return `false` to cancel (async OK, e.g. a confirm dialog). Then the item's `onClick` runs, then the built-in does its work, then the `action` event fires — so an `action` listener sees the result (the deleted row gone, the added row present, the new order).

## Row Toolbar

### Basic Setup

```javascript
grid.isRowToolbarShown = true
grid.rowToolbar = ['add', 'delete', 'duplicate', 'move-up', 'move-down']
```

### Built-in Row Actions

The row built-ins **do the work** — they run *before* the `action` event (order: `beforeActionCallback` → item `onClick` → built-in → `action` event), so an `action` listener already sees the new `items`. Don't also insert / remove rows in an `action` listener, or the row changes twice:

| `action` | What it does |
|----------|--------------|
| `'add'` | Inserts `createEmptyRowCallback(ctx)`'s row (else a blank row) after the row |
| `'delete'` | Removes the target rows |
| `'duplicate'` | Inserts `createDuplicateRowCallback({ row })`'s copy (else a shallow copy with `idMember` cleared) after each target row |
| `'move-up'` | Moves the target rows one displayed position up, as a block (disabled when the block is at the top) |
| `'move-down'` | Moves the target rows one displayed position down, as a block (disabled at the bottom) |

**Targets** (same rule as the tree actions): the whole row selection when the clicked / focused row is in it, else just that row (a range shortcut: its `rows`). `add` always inserts after the clicked row. The row selection follows its rows afterwards (deleted rows drop out). A row toolbar opened on a selected row keeps the selection.

Use a string (`'add'`) for the default look, or an object to restyle it: `{ action: 'delete', icon: '🗑️', text: 'Remove' }`. Built-in texts come from `labels.actions`. To veto one (e.g. confirm a delete), return `false` from `beforeActionCallback`.

```javascript
grid.createEmptyRowCallback = () => ({ id: nextId(), name: '', status: 'new' })
grid.createDuplicateRowCallback = ({ row }) => ({ ...row, id: nextId(), name: `${row.name} (copy)` })
grid.beforeActionCallback = async ({ action, row }) => {
  if (action === 'delete') return confirm(`Delete ${row.name}?`)   // false cancels
}
grid.addEventListener('action', (e) => {
  if (e.detail.action === 'delete') toast(`Deleted ${e.detail.row.name}`)   // notify only
})
```

### Custom Items

```javascript
grid.rowToolbar = [
  'add',
  { divider: true },
  {
    id: 'edit',
    icon: '✏️',
    text: 'Edit Record',                       // accessible name + tooltip heading
    tooltip: 'Open the editor',                // tooltip description
    shortcut: 'Enter',                         // tooltip key hint
    isTextVisible: true,                       // show "Edit Record" next to the icon
    row: 1,                                    // row in a multi-row toolbar (1 = closest to the grid row)
    getIsDisabledCallback: ({ row }) => row.locked,
    getIsVisibleCallback: ({ row }) => !row.archived,
    onClick: ({ row, rowIndex }) => openEditor(row)
  }
]
```

### Positioning

| Property | Values | Description |
|----------|--------|-------------|
| `toolbarPosition` | `'auto'`, `'left'`, `'right'`, `'top'`, `'inline'` | Where the toolbar appears relative to the row |
| `toolbarVerticalAlign` | `'top'`, `'center'`, `'bottom'` | Vertical alignment for `left`/`right` positions |
| `toolbarHorizontalAlign` | `'start'`, `'center'`, `'end'`, `'cursor'` | Horizontal alignment for `top` position |
| `shouldToolbarFollowCursor` | `boolean` | Toolbar tracks mouse position horizontally |
| `toolbarColumn` | `string \| number` | Pin toolbar above a specific column (for `top` position) |

### Cell-Specific Toolbar

```javascript
grid.getCellToolbarItemsCallback = ({ row, field }) => {
  if (field === 'status') {
    return [
      { id: 'approve', icon: '✅', text: 'Approve', onClick: ({ row }) => approve(row) }
    ]
  }
  return undefined  // No cell-specific items — the rowToolbar is used
}
```

Cell items are merged over `rowToolbar` by `id` / `action`.

## Context Menu

### Cell Context Menu

```javascript
grid.contextMenu = [
  {
    id: 'view',
    text: 'View Details',                          // or getTextCallback: (ctx) => `View ${ctx.row.name}`
    icon: '👁️',                                    // or getIconCallback: (ctx) => ctx.row.active ? '🟢' : '🔴'
    shortcut: 'Enter',                             // display-only hint
    getIsVisibleCallback: (ctx) => true,           // or isVisible: boolean
    getIsDisabledCallback: (ctx) => ctx.row.locked,// or isDisabled: boolean
    isDanger: false,
    onClick: (detail) => { /* detail: { row, rowIndex, column, colIndex, field, value, action, id, source, … } */ }
  },
  { divider: true, text: 'Rows' },                 // labelled divider
  'duplicate',                                     // row built-ins work here too
  'delete',
  {
    id: 'more',
    text: 'More',
    getChildrenCallback: async (ctx) => loadMoreItems(ctx.row)   // lazy submenu (a loading row shows meanwhile)
  }
]
```

Cell menu built-ins (by `action` or string): the row built-ins (`add`, `delete`, `duplicate`, `move-up`, `move-down`) and, in tree mode, `expand` / `collapse` (one level), `expand-subtree` / `collapse-subtree` (the row and everything under it), `expand-all` / `collapse-all` (the whole tree); the row built-ins (except `add`) and the per-row tree items act on the whole selection when the clicked row is in it.

`beforeContextMenuOpenCallback(ctx)` runs (sync) before the menu opens with the cell ctx: return `false` to show no grid menu (the browser's own menu shows), or an entries array to show instead of `contextMenu`.

### Header Context Menu

```javascript
grid.headerContextMenu = [
  'sort-asc',                   // Built-in: sort ascending
  'sort-desc',                  // Built-in: sort descending
  'clear-sort',                 // Built-in: clear sort
  { divider: true },
  'hide-column',                // Built-in: hide this column
  'freeze-column',              // Built-in: freeze column
  'unfreeze-column',            // Built-in: unfreeze column
  'column-visibility',          // Built-in: submenu to toggle column visibility
  {
    id: 'custom',
    text: 'Custom Action',
    icon: '⚙️',
    children: [...],                          // static submenu, or
    getChildrenCallback: (ctx) => [...],      // dynamic submenu (sync or async)
    onClick: (detail) => { /* detail: { column, field, colIndex, sortDirection, isFrozen, isTreeMode, allColumns, labels, … } */ }
  }
]
```

Column-visibility toggles report `action: 'toggle-column'` (with `id` = the field) and `'show-all-columns'`. On the filler area right of the last column, `ctx.column` is `null` and `colIndex` is `-1`. `beforeHeaderMenuOpenCallback(ctx)` works like `beforeContextMenuOpenCallback`.

### Menu keyboard, markup and theming

Both menus are the shared KeenMate menu (`@keenmate/web-components-core/menu`), rendered in the grid's shadow root:

- **Keyboard:** Shift+F10 or the ContextMenu key on the focused cell opens the cell menu below it with the first item focused. In the menu: ↑ / ↓ (disabled items are skipped), Home / End, → / Enter / Space open a submenu, ← / Escape close it, Enter / Space activate, Escape closes and returns focus to the cell, Tab closes. An item's `shortcut` letter activates it while the menu is open.
- **Dismiss:** outside press, scroll (page or grid), window blur, another KeenMate overlay opening.
- **Markup:** `.km-menu` levels (`.km-menu--submenu` for submenus) with `.km-menu__item` (`--disabled`, `--danger`, `--toggled`, `--has-submenu`), `__icon`, `__label`, `__shortcut`, `__divider`. The cell menu's levels also carry `wg-context-menu`, the header menu's `wg-header-menu`. Items are `role="menuitem"`; an item that defines its toggle state (`isToggled` / `getIsToggledCallback`, e.g. the column-visibility toggles, class `wg-header-menu__column-toggle`) is `role="menuitemcheckbox"` + `aria-checked`.
- **Theming:** `--wg-context-menu-*` on `web-grid` themes both menus of that grid; unset (the default), the page-wide `--km-menu-*` on `:root` applies (every KeenMate menu), then `--base-*`, then the core default:

```css
:root { --km-menu-bg: #fafafa; }                 /* every menu on the page */
web-grid.orders { --wg-context-menu-bg: #eef; }  /* just this grid's menus */
```

| Variable | Falls back to | Description |
|---|---|---|
| `--wg-context-menu-bg` | `--km-menu-bg` | Menu background |
| `--wg-context-menu-bg-hover` | `--km-menu-hover-bg` | Item hover / focus background |
| `--wg-context-menu-hover-color` | `--km-menu-hover-color` | Item text color on hover (default unchanged) |
| `--wg-context-menu-text-color` | `--km-menu-text-color` | Menu text color |
| `--wg-context-menu-border` | `--km-menu-border` | Menu border |
| `--wg-context-menu-border-radius` | `--km-menu-border-radius` | Menu border radius |
| `--wg-context-menu-shadow` | `--km-menu-shadow` | Menu shadow |
| `--wg-context-menu-min-width` | `--km-menu-min-width` | Menu min width |
| `--wg-context-menu-padding` | `--km-menu-padding` | Menu padding |
| `--wg-context-menu-font-size` | `--km-menu-font-size` | Menu font size |
| `--wg-context-menu-item-padding` | `--km-menu-item-padding` | Item padding |
| `--wg-context-menu-item-gap` | `--km-menu-item-gap` | Gap between icon, label, shortcut |
| `--wg-context-menu-toggled-color` | `--km-menu-toggled-color` | Toggled-on item color |
| `--wg-context-menu-icon-width` | `--km-menu-icon-size` | Icon column width |
| `--wg-context-menu-icon-font-size` | `--km-menu-icon-font-size` | Icon font size |
| `--wg-context-menu-arrow-font-size` | `--km-menu-arrow-font-size` | Submenu arrow font size |
| `--wg-context-menu-shortcut-color` | `--km-menu-shortcut-color` | Shortcut hint color |
| `--wg-context-menu-danger-color` | `--km-menu-danger-color` | Danger item text color |
| `--wg-context-menu-danger-bg-hover` | `--km-menu-danger-hover-bg` | Danger item hover background |
| `--wg-context-menu-divider-color` | `--km-menu-divider-color` | Divider line color |
| `--wg-context-menu-divider-margin` | `--km-menu-divider-margin` | Divider margin |
| `--wg-context-menu-disabled-opacity` | `--km-menu-disabled-opacity` | Disabled item opacity |
| `--wg-context-menu-z-index` | `--km-menu-z-index` (10000) | Menu stacking order |

## Keyboard Shortcuts

```javascript
grid.rowShortcuts = [
  { shortcut: 'Ctrl+D', action: 'duplicate' },                     // a row built-in
  { shortcut: 'F2', id: 'details', text: 'Details', onClick: ({ row }) => openDetails(row) },
  { shortcut: 'Delete', id: 'archive', text: 'Archive', getIsDisabledCallback: ({ row }) => row.locked }
]

grid.rangeShortcuts = [
  { shortcut: 'Ctrl+E', id: 'export', text: 'Export selection', onClick: ({ rows, rowIndices, cellRange }) => exportRows(rows) }
]
```

Row shortcuts act on the focused / hovered row with the cell ctx; range shortcuts act on the selection with `{ rows, rowIndices, cellRange?, cells? }` (custom only). Both fire the `action` event with `source: 'keyboard'`. With `isShortcutsHelpShown`, the shortcuts are listed in a help popover.

## Events

Every event is a real DOM event (bubbles, not composed) **and** a camelCase `on*` property twin called with the same detail first. Every detail carries the non-enumerable `controller` and `element`.

```javascript
grid.addEventListener('row-change', (e) => save(e.detail.draftRow))
// or
grid.onRowChange = (detail) => save(detail.draftRow)
```

| Event | Twin | Detail |
|-------|------|--------|
| `row-change` | `onRowChange` | A cell value was committed (editor, checkbox, paste, new row): `{ row, draftRow, rowIndex, field, oldValue, newValue, isValid, validationError }` |
| `cell-edit-start` | `onCellEditStart` | A cell editor opened: `{ row, rowIndex, field }` |
| `cell-edit-cancel` | `onCellEditCancel` | A cell edit was cancelled: `{ row, rowIndex, field }` |
| `validation-error` | `onValidationError` | `validateCallback` rejected a value: `{ row, rowIndex, field, error, source: 'edit' \| 'paste' }` |
| `focus-change` | `onFocusChange` | The user focused a different row (click / keyboard): `{ row, rowIndex, oldRowIndex }`. Assigning `focusedRowIndex` is silent |
| `row-delete` | `onRowDelete` | The `delete` built-in removed rows (menu / toolbar / Ctrl+Delete) — after the fact; veto with `beforeActionCallback`: `{ rows, rowIndices }` |
| `cell-selection-change` | `onCellSelectionChange` | The selected cell range changed: `{ range, cellCount, fields, rows }` — `range.startColIndex` / `endColIndex` are on-screen (visual) positions, not `columns` indices; `fields` = the range's columns in on-screen order; `rows` = the row objects in the range (display order). Cleared: `{ range: null, cellCount: 0, fields: [], rows: [] }` |
| `row-selection-change` | `onRowSelectionChange` | The row selection changed (row-number click / Ctrl / Shift / drag, `selectRow` / `selectRowRange` / `clearSelection`, or cleared by a cell / column selection): `{ rows, rowIndices }` |
| `column-selection-change` | `onColumnSelectionChange` | The column selection changed (header click / Ctrl / Shift / drag, `controller.selectColumn` / `selectColumnRange` / `clearColumnSelection`, or cleared by another selection): `{ fields }` (on-screen order) |
| `data-request` | `onDataRequest` | Sort / page / page size changed or more rows are needed (server-side data): `{ sort, page, pageSize, trigger, mode, skip }` |
| `filter-change` | `onFilterChange` | A column filter changed via the filter row or `setFilter()` (not `{ isSilent: true }`): `{ filters }`. Assigning `filters` is silent. With `filterMode: 'server'` the consumer filters |
| `column-resize` | `onColumnResize` | A column was resized: `{ field, oldWidth, newWidth, allWidths }` |
| `column-reorder` | `onColumnReorder` | A column was moved: `{ field, fromIndex, toIndex, allOrder }` |
| `row-expand` / `row-collapse` | `onRowExpand` / `onRowCollapse` | One tree row expanded / collapsed (chevron, keyboard, `toggleRowExpanded`, `expandRows` / `collapseRows`; not `expandAll` / `collapseAll`): `{ row, path }` |
| `expanded-change` | `onExpandedChange` | The expanded set changed (every expand / collapse, incl. `expandAll` / `collapseAll`): `{ paths }` |
| `row-lock-change` | `onRowLockChange` | A row was locked / unlocked by id: `{ rowId, row, rowIndex, lockInfo, source }` |
| `cell-paste` | `onCellPaste` | A multi-cell paste finished: `{ totalCells, successfulCells, failedCells, skippedCells, newRowsCreated, cellResults, hadHeaders }` |
| `action` | `onAction` | A toolbar / menu / shortcut item was activated: `{ action, id, item, source, sourceEvent, triggerElement, dataset }` + the surface fields (see below) |

`action` detail: `action` is the built-in name or `'custom'`; `source` is `'row-toolbar'`, `'cell-toolbar'`, `'context-menu'`, `'header-menu'` or `'keyboard'`. Row surfaces add `row` / `rowIndex` (cell surfaces also `column` / `colIndex` / `field` / `value`), the header menu its `HeaderMenuContext` fields, range shortcuts `rows` / `rowIndices`. It fires after the item's `onClick` and after the built-in has run — a notification after the fact: after `delete` the row is already gone from `items`, after `add` the new row is present, after `move-up` / `move-down` the new order is in place. To prevent a built-in, return `false` from `beforeActionCallback`.

## Controller

`el.controller` is the public `GridController` facade — the same object every ctx / detail carries as `controller`. It covers state as read-only properties named like the element's (`items`, `displayItems`, `columns`, `sort`, `filters`, `invalidCells`, `selectedRows`, `selectedRowIndices`, `selectedCellRange`, `expandedPaths`), rows (`insertRow`, `insertRows`, `removeRow`, `removeRows`, `duplicateRow`, `moveRow`, `getRowById`, `getRowIndex`, `updateRowById`, …), drafts and validation, row locking, row / cell / column selection, tree (`expandRows`, `collapseRows`, `expandAll(paths?)`, `collapseAll(paths?)`, `toggleRowExpanded` — all take `ExpandOptions { isExclusive?, isSilent? }`, …), columns (widths, order), focus / editing (`focusCell`, `startEditing`) and menus (`closeContextMenu`, `closeToolbar`). Most of these are also methods on the element itself (below).

## Public Methods

### Focus & Editing

| Method | Description |
|--------|-------------|
| `focusCell(rowIndex, colIndex)` | Programmatically focus a cell |
| `scrollToRow(rowIndex)` | Scroll a displayed row into view; `Promise<boolean>` (`false` when out of range) |
| `startEditing(rowIndex, colIndex)` | Programmatically start editing a cell |
| `openCustomEditor(rowIndex, colIndex)` | Open the custom editor for a cell with `editor: 'custom'` |

### Draft Management

| Method | Returns | Description |
|--------|---------|-------------|
| `getRowDraft(rowIndex)` | `T \| undefined` | Get the draft (uncommitted changes) for a row |
| `hasRowDraft(rowIndex)` | `boolean` | Check if a row has uncommitted changes |
| `getDraftRowIndices()` | `number[]` | Get display indices of the displayed rows with drafts |
| `getDrafts()` | `{ row, draftRow, changedFields, isValid }[]` | Every draft — incl. rows on other pages, filtered out, or not in `items` |
| `discardDraft(row)` | `void` | Discard one row's draft (the row, its id-equal copy, or the draft object) |
| `discardAllDrafts()` | `void` | Discard all draft changes across all rows |

### Validation

| Method | Returns | Description |
|--------|---------|-------------|
| `isCellInvalid(rowIndex, field)` | `boolean` | Check if a cell has a validation error |
| `getCellValidationError(rowIndex, field)` | `string \| null` | Get the validation error message for a cell |
| `canEditCell(rowIndex, field)` | `boolean` | Check if a cell can be edited (considers row locking, column editability) |

### Row Identification

| Method | Returns | Description |
|--------|---------|-------------|
| `getRowId(row)` | `unknown \| undefined` | Get the ID of a row using `getIdCallback` / `idMember` |
| `getRowById(id)` | `T \| null` | Find a row by its ID |
| `getRowIndex(row)` | `number` | The row's display index (the `rowIndex` of every ctx / event), `-1` when not displayed |

### Row Updates

| Method | Returns | Description |
|--------|---------|-------------|
| `updateRowById(id, newData)` | `boolean` | Merge partial data into a row (for WebSocket/live updates) |
| `replaceRowById(id, newRow)` | `boolean` | Replace an entire row by ID |

### Row Locking

| Method | Returns | Description |
|--------|---------|-------------|
| `isRowLocked(rowOrId)` | `boolean` | Check if a row is locked |
| `getRowLockInfo(rowOrId)` | `RowLock \| null` | Get lock information for a row |
| `lockRowById(id, lockerInfo?)` | `boolean` | Lock a row externally (e.g., from WebSocket message) |
| `unlockRowById(id)` | `boolean` | Unlock an externally locked row |
| `getExternalLocks()` | `Map<unknown, RowLock>` | Get all external locks |
| `clearExternalLocks()` | `void` | Remove all external locks |

### Row Selection

| Method | Returns | Description |
|--------|---------|-------------|
| `selectRow(rowIndex, mode?)` | `void` | Select a row. Mode: `'replace'` (default), `'toggle'`, `'range'` |
| `selectRowRange(fromIndex, toIndex)` | `void` | Select a range of rows |
| `clearSelection()` | `void` | Clear every selection kind (rows, cell range, columns) |
| `clearRowSelection()` | `void` | Clear only the row selection |
| `isRowSelected(rowIndex)` | `boolean` | Check if a row is selected |
| `selectedRows` | `T[]` | Property: the selected row objects (display order) |
| `selectedRowIndices` | `number[]` | Property: display indices of the selected rows |
| `copySelectedRowsToClipboard()` | `Promise<boolean>` | Copy selected rows as TSV to clipboard |

### Cell Selection

| Method | Returns | Description |
|--------|---------|-------------|
| `selectCellRange(range)` | `void` | Select a cell range programmatically |
| `clearCellSelection()` | `void` | Clear cell selection |
| `getSelectedCells()` | `CellContext<T>[]` | The selected cells (`{ row, rowIndex, column, colIndex, field, value }`, `colIndex` = index in `columns`), row by row in on-screen column order |
| `copyCellSelectionToClipboard()` | `Promise<boolean>` | Copy selected cells as TSV to clipboard |

### Column Selection (`el.controller`)

| Method | Returns | Description |
|--------|---------|-------------|
| `selectColumn(colIndex, mode?)` | `void` | Select a column (`colIndex` = index in `columns`); `mode`: `'replace'` / `'toggle'` / `'range'` |
| `selectColumnRange(from, to)` | `void` | Select the on-screen span between two columns (indices in `columns`) |
| `getSelectedColumns()` | `{ colIndex, field, column }[]` | The selected columns in on-screen order (`colIndex` = index in `columns`, like a selected cell's) |
| `isColumnSelected(colIndex)` | `boolean` | Is the column selected |
| `clearColumnSelection()` | `void` | Clear the column selection |

### Column Width

| Method | Returns | Description |
|--------|---------|-------------|
| `setColumnWidth(field, width)` | `void` | Set width of a single column |
| `setColumnWidths(widths)` | `void` | Set widths for multiple columns. `widths`: `ColumnWidthState[]` |
| `getColumnWidthsState()` | `ColumnWidthState[]` | Get current widths of all columns |

### Column Order

| Method | Returns | Description |
|--------|---------|-------------|
| `setColumnOrder(order)` | `void` | Set column order. `order`: `ColumnOrderState[]` |
| `getColumnOrderState()` | `ColumnOrderState[]` | Get current column order |

## Styling

### CSS Variable Architecture

The grid uses a two-level CSS variable system:

```css
web-grid {
  /* Override component variables directly */
  --wg-accent-color: #10b981;
  --wg-header-bg: #f5f5f5;
}

/* Or set base variables for all KeenMate components */
:root {
  --base-primary-color: #10b981;
  --base-main-bg: #ffffff;
}
```

Each `--wg-*` variable falls back to a `--base-*` variable, then to a standalone default — the
contract's default value for inputs, the contract's formula on the `--wg-*` input for derived
colors (so the grid looks the same with or without `@keenmate/base-css-variables`):

```css
:host {
  --wg-accent-color: var(--base-primary-color, #3b82f6);
}
```

This means:
1. Setting `--base-primary-color` on `:root` themes all KeenMate components at once
2. Setting `--wg-accent-color` on `web-grid` overrides just the grid
3. Without either, the component uses its built-in defaults

### Key Variables

| Variable | Description |
|----------|-------------|
| `--wg-accent-color` | Primary accent color |
| `--wg-text-color-1` | Primary text color |
| `--wg-main-bg` | Background color (table body, cells) |
| `--wg-elevated-bg` | Alternate row/header background |
| `--wg-hover-bg` | Hover background (rows, buttons) |
| `--wg-dropdown-bg` | Floating surfaces (toolbar, dropdowns); the context menus use `--wg-context-menu-*` ([Context Menu](#menu-keyboard-markup-and-theming)) |
| `--wg-border-color` | Border color |

### Motion and disabled dimming

Motion uses the contract's speeds and easing only: `--wg-transition-fast`
(`--base-duration-fast`, 0.1s), `--wg-transition-normal` (`--base-duration-normal`, 0.15s),
`--wg-easing` (`--base-ease-standard`). To turn motion off:

```css
web-grid { --wg-transition-fast: 0s; --wg-transition-normal: 0s; }
:root { --base-duration-fast: 0s; --base-duration-normal: 0s; --base-duration-medium: 0s; --base-duration-slow: 0s; } /* page-wide */
```

`prefers-reduced-motion: reduce` does the same; the loader slows to 1.5s instead of stopping
([Loading states](#loading-states)). Disabled parts (the disabled grid, toolbar and
pagination buttons, dropdown options) fade by `--wg-disabled-opacity`
(`--base-disabled-opacity`, 0.65).

### Component Variables Manifest

A machine-readable manifest documenting all CSS variables is included in the package:

```javascript
import manifest from '@keenmate/web-grid/manifest'

console.log(manifest.prefix)              // "wg"
console.log(manifest.baseVariables)       // 43 --base-* variables consumed
console.log(manifest.componentVariables)  // 214 --wg-* variables exposed
```

The manifest follows the [component-variables schema](https://raw.githubusercontent.com/keenmate/schemas/main/component-variables.schema.json) and contains:

- **baseVariables** — Theme variables (`--base-*`) the component consumes from `@keenmate/theme-designer`
- **componentVariables** — Component-specific variables (`--wg-*`) with category and usage descriptions

### Dark Mode

Dark mode follows the page:
- Page signal: `data-theme="dark"`, `data-bs-theme="dark"` or `.dark` (Tailwind) on `<html>` or `<body>` — detected once per page by `@keenmate/web-components-core` and mirrored onto the grid as `data-context-theme`, so it works in Firefox and Safari too. For a themed section, add `theme-source="closest"` (or a selector) to the grid.
- Per instance: `data-theme="dark"` / `data-bs-theme="dark"` on the `<web-grid>` itself (wins).
- OS preference: only through the page — declare `html { color-scheme: light dark }` and the grid follows the OS, live. There is no `prefers-color-scheme` rule in the component, so a grid never turns dark on a light page.

The `light` versions of the same signals force light mode, e.g. for an app toggle that overrides the OS.

### Dynamic Cell & Row Styling

```javascript
// Per-cell styling via column callback
grid.columns = [{
  field: 'salary',
  cellClass: 'salary-cell',                                    // Static class
  getCellClassCallback: ({ value }) => value > 90000 ? 'high-value' : null  // Dynamic class
}]

// Per-row styling
grid.getRowClassCallback = ({ row }) => row.status === 'inactive' ? 'row-inactive' : null

// Inject custom CSS into shadow DOM
grid.getCustomStylesCallback = () => `
  .high-value { background: #d1fae5 !important; }
  .row-inactive { opacity: 0.5; }
`
```

### i18n

All UI strings are customized via `labels` — a partial object (also a JSON attribute: `labels='{"empty":"Nothing here"}'`) merged per key over the built-in English texts; nested groups (`actions`, `contextMenu`) merge per key too. `{name}` placeholders are filled in. A column can override its dropdown texts with `editorOptions.labels`.

```javascript
grid.labels = {
  rowActions: 'Actions',
  keyboardShortcuts: 'Keyboard shortcuts',
  rangeShortcuts: 'Selection shortcuts',  // shortcuts-help sub-heading for rangeShortcuts
  paginationFirst: 'First',
  paginationPrevious: 'Previous',
  paginationNext: 'Next',
  paginationLast: 'Last',
  paginationPageInfo: 'Page {current} of {total}',
  paginationItemCount: '{count} items',
  paginationPerPage: 'per page',
  noData: 'No items to display',        // the grid has no rows
  noResults: 'No matching items',       // rows exist, the filter matched nothing
  loading: 'Loading…',                  // infinite-scroll load-more row
  dropdownNoData: 'No options',          // the editor has no options at all
  dropdownNoResults: 'No matching options',  // a typed filter / search matched nothing
  dropdownSearching: 'Searching…',
  dropdownEmptyOption: '—',              // the empty first item (editorOptions.isEmptyAllowed)
  rowLocked: 'This row is locked',
  rowLockedBy: 'Locked by {lockedBy}',
  goToRow: 'Go to row (1-{max}):',  // Ctrl/Cmd+G dialog
  goToRowGo: 'Go',
  goToRowCancel: 'Cancel',
  editCell: 'Edit',              // edit button aria-label / title (editTrigger: 'button')
  treeExpand: 'Expand',          // tree chevron aria-label
  treeCollapse: 'Collapse',
  filterColumn: 'Filter {column}',           // aria-label of a filter-row input
  invalidNumber: 'Not a number',              // built-in value checks (number editor, paste)
  numberMin: 'Must be at least {min}',
  numberMax: 'Must be at most {max}',
  numberNegative: 'Must not be negative',
  invalidBoolean: 'Not a yes / no value',     // text pasted into a checkbox column
  invalidDate: 'Not a valid date',            // text pasted into a date column
  actions: {                       // built-in row / tree action texts
    add: 'Add row',
    delete: 'Delete row',
    duplicate: 'Duplicate row',
    moveUp: 'Move up',
    moveDown: 'Move down',
    expand: 'Expand',
    collapse: 'Collapse',
    expandSubtree: 'Expand subtree',
    collapseSubtree: 'Collapse subtree',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all'
  },
  contextMenu: {                   // header-menu built-in texts
    sortAsc: 'Sort Ascending',
    sortDesc: 'Sort Descending',
    clearSort: 'Clear Sort',
    hideColumn: 'Hide Column',
    freezeColumn: 'Freeze Column',
    unfreezeColumn: 'Unfreeze Column',
    columnVisibility: 'Column Visibility',
    showAll: 'Show all'
  }
}
```

## Runtime API

The component registers itself at `window.components['web-grid']` for runtime introspection:

```javascript
// Check version
window.components['web-grid'].version()  // "1.0.3"

// Package info
window.components['web-grid'].config  // { name, version, author, license, repository, homepage }

// Logging (core /logging — every GRID:* category defaults to 'warn')
window.components['web-grid'].logging.enableLogging()         // Every category at debug level
window.components['web-grid'].logging.setLogLevel('info')     // Set level: trace|debug|info|warn|error|silent
window.components['web-grid'].logging.disableLogging()        // Silence every category
window.components['web-grid'].logging.setCategoryLevel('UI', 'debug')  // Per-category
window.components['web-grid'].logging.getCategories()         // ['INIT', 'DATA', 'UI', 'INTERACTION', 'PERF']
window.components.logging                                     // Page-wide switch for all KeenMate components
window.components['web-grid'].getInstances()                  // Live <web-grid> elements
```

## Browser Support

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+

## License

MIT

# @keenmate/web-grid

A feature-rich, framework-agnostic data grid web component built with TypeScript. Sorting, filtering, pagination, inline editing (8 editor types), cell range selection, clipboard support, row toolbar, context menus, frozen columns, column reorder/resize, fill handle, virtual scroll, dark mode, and full CSS variable theming — all in a Shadow DOM encapsulated `<web-grid>` element.

## What's New in v1.4.0

- **CSS files now follow the canonical web-component structure** documented at `BlissFramework/guidelines/web-components/css-structure.md`. Three observable changes for consumers: (1) underscore prefix dropped from every CSS filename (`_variables.css` → `variables.css`, etc.) — if you imported individual CSS files by path, update those imports; (2) `main.css` now declares `@layer variables, component, overrides;` so any unlayered consumer CSS automatically beats the component's rules — `!important` is no longer needed to override default styling; (3) new Tier-2 files `controls.css`, `floating.css`, `states.css`, `animations.css` sit between base and feature files for cross-component consistency.
- **Cascade-layer override contract**: consumers' unlayered CSS always wins over `@layer component`. Consumers' `:root` `--base-*` declarations still beat the `@layer variables` block via custom-property inheritance (layer-agnostic). Read the layer-contract comment at the top of `main.css` for the full rule set.
- **Mixed-bag files split for clarity**: tooltip rules moved from `dialogs.css` (which now owns only the Go-to-row dialog) into `floating.css`. Modifier rules from `modifiers.css` (striped/hover/empty/loading) moved into `states.css`; `modifiers.css` deleted.
- **`@keyframes` centralized in `animations.css`** — currently just `wg-pulse` (loading indicator on autocomplete/combobox editors).
- **No behavioral changes**, no API changes, no DOM-class renames. 275 e2e tests still pass; library bundle size is essentially unchanged (~493 kB / 109 kB gzipped).

## What's New in v1.3.0

- **`--base-*` taxonomy aligned with KeenMate components**: Two additive fallback chains so theme-designer's unified cross-component palette covers floating UI without per-component overrides. `--base-dropdown-bg` now chains through `--base-elevated-bg` (toolbar / context menu / dropdown panel backgrounds inherit from elevated surface when no dropdown-specific value is set), and `--base-tooltip-bg` chains through the new `--base-inverse-bg` (tooltip background falls back to the cross-component inverse surface). Existing `--base-dropdown-bg` / `--base-tooltip-bg` overrides keep working exactly as before — these chains are second-tier fallbacks only.
- **OS-aware dark mode via `light-dark()` in fallbacks**: Hardcoded fallbacks for text / surface / border / input / hover / tooltip variables are now wrapped in `light-dark(<light>, <dark>)`. Consumers who do nothing but set `body { color-scheme: dark }` now get a sensible dark palette — no theme overrides, no framework class, no media-query selector required. The explicit `dark-mode.css` selectors (`data-theme="dark"`, `data-bs-theme="dark"`, `.dark`, `@media (prefers-color-scheme: dark)`) remain intact for framework-driven theme switches that don't set `color-scheme` themselves (Bootstrap 5.3+, Tailwind, etc.).
- **Adaptive hover via `color-mix`**: `--wg-hover-bg` and `--wg-active-bg` now fall back to `color-mix(in srgb, var(--wg-text-color-1) 8%/14%, <main-bg>)` instead of flat surface colors. The mix always steps toward the text color, so hover/active highlights stay visible in both light and dark modes without consumer tuning. `--wg-active-bg` is now also separately overridable via the new `--base-active-bg` (was previously sharing `--base-hover-bg`).
- **WCAG contrast tested in CI**: New `e2e/dark-mode.spec.ts` mounts three grids on a dark page (fully themed, minimal-override, zero-override) and asserts WCAG contrast ratio ≥ 3:1 for header / body / hover / focused / selected-row-number / editing-cell states. 18 contrast assertions catch theming regressions before they ship. Fixture: `docs/test/dark-mode.html`.
- **Manifest updated**: `component-variables.manifest.json` lists the new `--base-active-bg` and `--base-inverse-bg`, and refreshed descriptions for `--base-hover-bg`, `--base-dropdown-bg`, `--base-elevated-bg` to reflect the new chain semantics.

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
grid.isRowNumbersVisible = true  // leftmost # column
grid.sortMode = 'multi'          // click headers to sort, Ctrl+click to add
grid.isPageable = true
grid.pageSize = 25
grid.isEditable = true
grid.editTrigger = 'navigate'    // Excel-like: type to edit the focused cell
```

### Essential Properties

| Property | Type | Purpose |
|----------|------|---------|
| `items` | `T[]` | Row data — the only required "content" property |
| `columns` | `Column<T>[]` | Column definitions with at least a `field` each |
| `isStriped` / `isHoverable` / `isRowNumbersVisible` | `boolean` | Cosmetic toggles |
| `sortMode` | `'none' \| 'single' \| 'multi'` | Column sort behavior |
| `isPageable` + `pageSize` | `boolean` + `number` | Pagination |
| `isEditable` + `editTrigger` | `boolean` + `EditTrigger` | Enable inline editing and how it starts |
| `isFilterable` | `boolean` | Per-column filter row under the headers |
| `mode` | `'read-only' \| 'excel' \| 'input-matrix'` | Presets that set several of the above together |

## Common Configurations

Short recipes for common setups. Each sets only what's necessary on top of the Step 3 minimum.

### Sortable grid

```javascript
grid.sortMode = 'multi'   // or 'single'
```

### Paginated grid with top + bottom pager

```javascript
grid.isPageable = true
grid.pageSize = 25
grid.paginationPosition = 'top-center|bottom-center'
```

### Editable grid (Excel-like navigation)

```javascript
grid.mode = 'excel'   // isEditable + editTrigger='navigate' + cellSelectionMode='click'
```

Or opt in manually for finer control:

```javascript
grid.isEditable = true
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

For full-height mode, also set `tableBorderOnly = true` so the grid doesn't capture wheel events:

```javascript
grid.tableBorderOnly = true
```

### Header context menu with column hide + visibility submenu

```javascript
grid.headerContextMenu = [
  'sortAsc', 'sortDesc', 'clearSort',
  { dividerBefore: true },
  'hideColumn',         // hide the right-clicked column
  'columnVisibility'    // submenu with a toggle per column
]
```

### Hide a column programmatically

```javascript
grid.columns.find(c => c.field === 'email').isHidden = true
grid.columns = [...grid.columns]   // reassign to trigger re-render
```

### Row toolbar

```javascript
grid.isRowToolbarVisible = true
grid.rowToolbar = ['add', 'delete', 'duplicate', 'moveUp', 'moveDown']
```

### Master/detail — react to row focus

```javascript
grid.onrowfocus = ({ row, rowIndex }) => {
  showDetailsFor(row)
}
```

### Validate a cell before commit

```javascript
grid.columns = [{
  field: 'email',
  title: 'Email',
  editor: 'text',
  beforeCommitCallback: ({ value }) => {
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
- **Cell Range Selection** — Click+drag or Shift+click to select rectangular ranges
- **Clipboard** — Copy/paste TSV data (Excel-compatible), per-column transform callbacks
- **Row Toolbar** — Floating, inline, or cell-specific action buttons
- **Context Menu** — Right-click menu for cells and column headers (with predefined actions)
- **Keyboard Shortcuts** — Per-row and per-range custom shortcuts with help overlay
- **Column Reordering** — Drag-to-reorder with optional localStorage persistence
- **Column Resizing** — Drag column borders with min/max constraints and persistence
- **Frozen Columns** — Stick columns to the left during horizontal scroll
- **Fill Handle** — Excel-like autofill by dragging a cell's corner
- **Row Locking** — Optimistic locking with external lock management (WebSocket-ready)
- **Row Identification** — `idValueMember`/`idValueCallback` for `updateRowById`, `replaceRowById`
- **Virtual Scroll** — Render only visible rows for large datasets
- **Infinite Scroll** — Load-more pattern triggered near bottom of scroll
- **Dark Mode** — Auto-detects OS/attribute/class preferences
- **CSS Variable Theming** — 120+ `--wg-*` variables with `--base-*` fallback for cross-component themes
- **Shadow DOM** — Encapsulated styles, no CSS leakage
- **Summary Bar** — Configurable summary content at any corner position
- **Validation** — `beforeCommitCallback` with tooltip display (custom HTML supported)
- **Row Focus Tracking** — `onrowfocus` for master/detail patterns
- **i18n** — All UI labels customizable via `labels` property
- **TypeScript** — Full type definitions exported

## Architecture

WebGrid uses an **action pipeline** pattern for user interactions. DOM events are captured by the `ActionPipelineAdapter`, which translates them into typed action objects (34 action types). These actions flow through a pipeline that dispatches them to specialized executors (16 executors covering focus, editing, navigation, selection, clipboard, dropdown, fill-handle, etc.). Executors can emit child actions for composability — e.g., committing an edit can trigger a focus-move.

```
DOM Event → Adapter → Action → Pipeline → Executor → State Change → Render
```

This architecture separates mode detection (the adapter decides *what* action a click means based on grid mode, edit trigger, cell state) from business logic (executors handle *how* to focus, edit, select). It also allows incremental migration from legacy event handlers.

## Properties

### Core Data

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `items` | `T[]` | `[]` | Data array to display |
| `columns` | `Column<T>[]` | `[]` | Column definitions (see [Column Definition](#column-definition)) |

### Display

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isFilterable` | `boolean` | `false` | Show per-column filter inputs |
| `isStriped` | `boolean` | `false` | Alternate row background colors |
| `isHoverable` | `boolean` | `false` | Highlight row on hover |
| `isRowNumbersVisible` | `boolean` | `false` | Show row number column |
| `isStickyRowNumbers` | `boolean` | `false` | Freeze row number column during horizontal scroll |
| `freezeColumns` | `number` | `0` | Freeze first N columns (applied after visual reorder from `isFrozen`) |
| `mode` | `GridMode` | — | Grid mode: `'read-only'`, `'excel'`, `'input-matrix'` (see [Grid Modes](#grid-modes)) |
| `focusedRowIndex` | `number \| null` | `null` | Currently focused row index (readable/writable) |

### Editing

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isEditable` | `boolean` | `false` | Enable cell editing |
| `editTrigger` | `EditTrigger` | `'dblclick'` | How editing starts: `'click'`, `'dblclick'`, `'button'`, `'always'`, `'navigate'` |
| `editStartSelection` | `EditStartSelection` | `'selectAll'` | Cursor position when entering edit via navigate: `'mousePosition'`, `'selectAll'`, `'cursorAtStart'`, `'cursorAtEnd'` |
| `dropdownToggleVisibility` | `ToggleVisibility` | `'on-focus'` | When to show dropdown toggle button: `'always'`, `'on-focus'` |
| `shouldShowDropdownOnFocus` | `boolean` | `false` | Auto-open dropdown when cell is focused |
| `shouldOpenDropdownOnEnter` | `boolean` | `false` | Enter key opens dropdown (`true`) or moves to next row (`false`) |
| `isCheckboxAlwaysEditable` | `boolean` | `false` | Checkboxes are always clickable, even in navigate mode |

### Sorting

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sort` | `SortState[]` | `[]` | Current sort state (set for initial/server-side sort) |
| `sortMode` | `SortMode` | `'none'` | Sort mode: `'none'` (disabled), `'single'`, `'multi'` |

### Pagination

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isPageable` | `boolean` | `false` | Enable pagination |
| `pageSize` | `number` | `10` | Rows per page |
| `pageSizes` | `number[]` | — | Available page sizes for selector (e.g., `[10, 25, 50, 100]`) |
| `paginationMode` | `'client' \| 'server'` | `'client'` | `'client'` = grid slices items; `'server'` = items are already current page |
| `currentPage` | `number` | `1` | Current page (1-based) |
| `totalItems` | `number \| null` | `null` | Total item count for server-side pagination |
| `showPagination` | `boolean \| 'auto'` | `'auto'` | `true` = always show, `false` = never, `'auto'` = hide when ≤1 page |
| `paginationPosition` | `string` | `'bottom-center'` | Position(s): `'bottom-center'`, `'top-right\|bottom-right'` for multiple |
| `paginationLabelsCallback` | `PaginationLabelsCallback` | — | Callback to customize/translate pagination text |
| `paginationLayout` | `string` | — | Element order: `'pageSize\|previous\|pageInfo\|next'` or `'first\|previous\|pageInfo\|next\|last'` |

### Row Toolbar

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isRowToolbarVisible` | `boolean` | `false` | Show row action toolbar |
| `rowToolbar` | `RowToolbarConfig<T>[]` | `[]` | Toolbar items (predefined strings or custom objects) |
| `toolbarTrigger` | `'hover' \| 'click' \| 'button'` | `'hover'` | How to show toolbar |
| `toolbarPosition` | `ToolbarPosition` | `'auto'` | Preferred position: `'auto'`, `'left'`, `'right'`, `'top'`, `'inline'` |
| `toolbarVerticalAlign` | `'top' \| 'center' \| 'bottom'` | `'bottom'` | Vertical alignment for left/right position |
| `toolbarHorizontalAlign` | `'start' \| 'center' \| 'end' \| 'cursor'` | `'center'` | Horizontal alignment for top position |
| `toolbarColumn` | `string \| number` | — | Column to pin toolbar over (field name or index) for `'top'` position |
| `toolbarFollowsCursor` | `boolean` | `false` | Toolbar follows mouse cursor horizontally |
| `cellToolbar` | `(row, rowIndex, field, colIndex) => RowToolbarConfig[] \| undefined` | — | Cell-specific toolbar items |
| `cellToolbarOffset` | `number \| string` | `0.2` | Horizontal offset: `0`–`1` as fraction of cell width, or CSS length (e.g., `'2rem'`) |
| `toolbarBtnMinWidth` | `string` | — | Min-width for toolbar buttons (CSS value). Overrides `--wg-toolbar-btn-min-width` |
| `inlineActionsTitle` | `string` | `'Actions'` | Header title for inline actions column (when `toolbarPosition='inline'`). Set to `''` for no title |

> **Deprecated aliases:** `toolbarAlign` → use `toolbarVerticalAlign`; `toolbarTopPosition` → use `toolbarHorizontalAlign`.

### Context Menu

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `contextMenu` | `ContextMenuItem<T>[]` | — | Cell/row context menu items |
| `contextMenuXOffset` | `number` | `0` | Horizontal offset from click position |
| `contextMenuYOffset` | `number` | `4` | Vertical offset from click position |
| `headerContextMenu` | `HeaderMenuConfig<T>[]` | — | Header context menu items (predefined strings or custom objects) |

### Cell Selection

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `cellSelectionMode` | `CellSelectionMode` | `'click'` | How to select cell ranges: `'disabled'`, `'click'`, `'shift'` |
| `shouldCopyWithHeaders` | `boolean` | `false` | Include column headers when copying cell selection to clipboard |

### Keyboard Shortcuts

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rowShortcuts` | `RowShortcut<T>[]` | — | Row-level shortcut definitions |
| `rangeShortcuts` | `RangeShortcut<T>[]` | — | Multi-row/range shortcut definitions |
| `isShortcutsHelpVisible` | `boolean` | `false` | Show keyboard shortcuts help icon |
| `shortcutsHelpPosition` | `'top-right' \| 'top-left'` | `'top-right'` | Help icon position |
| `shortcutsHelpContentCallback` | `() => string` | — | Custom HTML content to display alongside shortcuts list |

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
| `fillDragCallback` | `(detail: FillDragDetail) => boolean \| void` | — | Called when fill handle is dragged. Return `false` to cancel. |

### Row Identification

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `idValueMember` | `keyof T` | — | Property name containing the row's unique ID |
| `idValueCallback` | `(row: T) => unknown` | — | Callback returning the row's unique ID |

### Row Locking

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rowLocking` | `RowLockingOptions<T>` | — | Row locking configuration (see [RowLockingOptions](#row-locking-options)) |

#### RowLockingOptions

| Field | Type | Description |
|-------|------|-------------|
| `lockedMember` | `keyof T` | Property with boolean lock state |
| `lockInfoMember` | `keyof T` | Property with `RowLockInfo` object |
| `isLockedCallback` | `(row, rowIndex) => boolean` | Callback-based lock check |
| `getLockInfoCallback` | `(row, rowIndex) => RowLockInfo \| null` | Callback-based lock info |
| `lockedEditBehavior` | `'block' \| 'allow' \| 'callback'` | Edit behavior for locked rows (default: `'block'`) |
| `canEditLockedCallback` | `(row, lockInfo) => boolean` | Per-row edit decision (when `'callback'`) |
| `lockTooltipCallback` | `(lockInfo, row) => string \| null` | Custom tooltip HTML for locked rows |

### Scroll

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isScrollable` | `boolean` | `false` | Enable scroll container with max-height |
| `scrollMaxHeight` | `string` | `'100vh'` | Max-height when `isScrollable` is `true` |
| `tableBorderOnly` | `boolean` | `false` | Border only around table, not pagination/toolbar |

### Virtual Scroll

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isVirtualScrollEnabled` | `boolean` | `false` | Enable virtual scroll |
| `virtualScrollThreshold` | `number` | `100` | Auto-enable when items ≥ threshold |
| `virtualScrollRowHeight` | `number` | `38` | Fixed row height in pixels |
| `virtualScrollBuffer` | `number` | `10` | Extra rows rendered above/below viewport |

### Infinite Scroll

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isInfiniteScrollEnabled` | `boolean` | `false` | Enable infinite scroll |
| `infiniteScrollThreshold` | `number` | `100` | Distance from bottom (px) to trigger load |
| `hasMoreItems` | `boolean` | `true` | Set to `false` when no more data |

### Tooltip

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `tooltipShowDelay` | `number` | `200` | Delay in ms before showing tooltip |
| `tooltipHideDelay` | `number` | `100` | Delay in ms before hiding tooltip |

### Summary

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `summaryPosition` | `string` | — | Position(s): `'bottom-left'`, `'top-right\|bottom-right'`, etc. |
| `summaryContentCallback` | `SummaryContentCallback<T>` | — | Callback returning HTML content for the summary bar |
| `isSummaryInline` | `boolean` | `true` | Share row with pagination when in same area |
| `summaryMetadata` | `unknown` | — | Server-provided metadata passed to `summaryContentCallback` |

### Styling

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `customStylesCallback` | `() => string` | — | Returns CSS string injected into shadow DOM |
| `rowClassCallback` | `(row, rowIndex) => string \| null` | — | Dynamic CSS class for rows |
| `labels` | `Partial<GridLabels>` | — | Override UI labels for i18n (see [i18n](#i18n)) |
| `validationTooltipCallback` | `(context) => string \| null` | — | Custom HTML for validation error tooltip (grid-level default) |
| `invalidCells` | `CellValidationState[]` | `[]` | External validation state for cells |

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
| `cellClassCallback` | `(value, row) => string \| null` | Dynamic CSS class based on value/row |

### Content

| Field | Type | Description |
|-------|------|-------------|
| `formatCallback` | `(value, row) => string` | Format value for display (text only) |
| `templateCallback` | `(row) => string` | Custom cell HTML string |
| `renderCallback` | `(row, element) => void` | Imperative cell rendering (receives the `<td>` element) |

### Editing

| Field | Type | Description |
|-------|------|-------------|
| `isEditable` | `boolean` | Enable editing for this column |
| `editor` | `EditorType` | Editor type: `'text'`, `'number'`, `'checkbox'`, `'select'`, `'combobox'`, `'autocomplete'`, `'date'`, `'custom'` |
| `editTrigger` | `EditTrigger` | Per-column override for edit trigger |
| `editorOptions` | `EditorOptions<T>` | Editor-specific configuration (see [Editor Types](#editor-types)) |
| `dropdownToggleVisibility` | `ToggleVisibility` | Per-column override: `'always'` or `'on-focus'` |
| `shouldOpenDropdownOnEnter` | `boolean` | Per-column override: Enter opens dropdown or moves down |
| `cellEditCallback` | `(context: CustomEditorContext<T>) => void` | Handler for `'custom'` editor type |
| `isEditButtonVisible` | `boolean` | Show an edit button in the cell |

### Validation

| Field | Type | Description |
|-------|------|-------------|
| `beforeCommitCallback` | `(context: BeforeCommitContext<T>) => BeforeCommitResult \| Promise<...>` | Validates and optionally transforms value before commit |
| `validateCallback` | `(value, row) => string \| null \| Promise<...>` | **Deprecated** — use `beforeCommitCallback` instead |
| `validationTooltipCallback` | `(context) => string \| null` | Custom HTML for this column's validation error tooltip |

`beforeCommitCallback` receives `{ value, oldValue, row, rowIndex, field }` and can return:
- `{ valid: true }` or `{ valid: true, transformedValue: ... }` — accept (optionally transform)
- `{ valid: false, message: 'Error text' }` — reject with message
- `true` / `null` / `undefined` — accept
- `false` — reject (no message)
- `string` — reject with that string as error message

### Tooltip

| Field | Type | Description |
|-------|------|-------------|
| `tooltipMember` | `string` | Property name in row data containing tooltip text |
| `tooltipCallback` | `(value, row) => string \| null` | Dynamic tooltip (takes priority over `tooltipMember`) |

### Clipboard

| Field | Type | Description |
|-------|------|-------------|
| `beforeCopyCallback` | `(value, row) => string` | Transform value before copying to clipboard |
| `beforePasteCallback` | `(value, row) => unknown` | Process pasted value before applying to cell |

### Layout

| Field | Type | Description |
|-------|------|-------------|
| `isFrozen` | `boolean` | Column sticks to left side during horizontal scroll |
| `isResizable` | `boolean` | Allow column width to be changed by dragging (default: `true`) |
| `isMovable` | `boolean` | Allow column to be reordered by dragging (default: `true`) |
| `isHidden` | `boolean` | Column is not rendered but kept in array for visibility toggling |
| `isSortable` | `boolean` | Enable sorting for this column (when grid has `sortMode` enabled) |
| `isFilterable` | `boolean` | Enable filtering for this column |

### Fill

| Field | Type | Description |
|-------|------|-------------|
| `fillDirection` | `FillDirection` | Override grid-level fill direction for this column: `'vertical'` or `'all'` |

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
| `custom` | Consumer-controlled via `cellEditCallback` |

### Text Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxLength` | `number` | — | Maximum character count |
| `placeholder` | `string` | — | Placeholder text |
| `pattern` | `string` | — | Input pattern attribute |
| `inputMode` | `'text' \| 'numeric' \| 'email' \| 'tel' \| 'url'` | — | Virtual keyboard hint |
| `editStartSelection` | `EditStartSelection` | `'selectAll'` | Cursor position when entering edit |

### Number Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `min` | `number` | — | Minimum value |
| `max` | `number` | — | Maximum value |
| `step` | `number` | — | Step increment |
| `decimalPlaces` | `number` | — | Fixed decimal places |
| `allowNegative` | `boolean` | — | Allow negative values |

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
| `loadOptions` | `(row, field) => Promise<EditorOption[]>` | Async option loader |
| `optionsLoadTrigger` | `OptionsLoadTrigger` | When to call `loadOptions`: `'immediate'`, `'oneditstart'` (default), `'ondropdownopen'` |

#### Display Mapping

By default, options use `value` and `label` properties. Override with member strings or callback functions:

| Member Property | Callback Alternative | Description |
|-----------------|---------------------|-------------|
| `valueMember` | `getValueCallback` | Property/callback for the option value |
| `displayMember` | `getDisplayCallback` | Property/callback for display text |
| `searchMember` | `getSearchCallback` | Property/callback for searchable text (falls back to display) |
| `iconMember` | `getIconCallback` | Property/callback for icon/emoji |
| `subtitleMember` | `getSubtitleCallback` | Property/callback for subtitle/description |
| `disabledMember` | `getDisabledCallback` | Property/callback for disabled state |
| `groupMember` | `getGroupCallback` | Property/callback for grouping options |

#### Rendering & Behavior

| Option | Type | Description |
|--------|------|-------------|
| `renderOptionCallback` | `(option, context) => string` | Custom HTML for each option. `context` has `{ index, isHighlighted, isSelected, isDisabled }` |
| `onselect` | `(option, row) => void` | Fires when an option is selected |
| `allowEmpty` | `boolean` | Allow null/empty selection |
| `emptyLabel` | `string` | Label for empty option (default: `'-- Select --'`) |
| `noOptionsText` | `string` | Override "No options" message |
| `searchingText` | `string` | Override "Searching..." message |
| `dropdownMinWidth` | `string` | Minimum width for dropdown (e.g., `'300px'`) |
| `placeholder` | `string` | Placeholder text (combobox/autocomplete) |

### Autocomplete-Specific Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `searchCallback` | `(query, row, signal?) => Promise<EditorOption[]>` | — | Async search function (receives `AbortSignal` for cancellation) |
| `initialOptions` | `EditorOption[]` | — | Options shown before user starts typing |
| `minSearchLength` | `number` | `1` | Minimum characters before triggering search |
| `debounceMs` | `number` | `300` | Debounce delay for search calls |
| `multiple` | `boolean` | `false` | Allow multiple selections |
| `maxSelections` | `number` | — | Maximum items when `multiple` is `true` |

### Custom Editor

Set `editor: 'custom'` and provide a `cellEditCallback` on the column:

```javascript
{
  field: 'color',
  editor: 'custom',
  cellEditCallback: ({ value, row, rowIndex, field, commit, cancel }) => {
    // Open your own UI (modal, popover, etc.)
    // Call commit(newValue) to save, cancel() to discard
  }
}
```

## Grid Modes

The `mode` property sets sensible defaults for common use cases:

| Mode | `isEditable` | `editTrigger` | `cellSelectionMode` | `dropdownToggleVisibility` | `shouldShowDropdownOnFocus` |
|------|-------------|--------------|--------------------|--------------------------|-----------------------------|
| `'read-only'` | `false` | — | `'click'` | `'on-focus'` | `false` |
| `'excel'` | `true` | `'navigate'` | `'click'` | `'always'` | `false` |
| `'input-matrix'` | `true` | `'always'` | `'shift'` | `'always'` | `true` |

- **`read-only`** — No editing. Click to select cells. Useful for display grids with copy support.
- **`excel`** — Navigate cells with arrows, type to start editing, Escape to cancel. Click+drag for cell selection.
- **`input-matrix`** — All cells are always in edit mode. Shift+click for cell selection. Tab to navigate between fields.

Setting `mode` applies these defaults, but you can override individual properties afterward.

## Row Toolbar

### Basic Setup

```javascript
grid.isRowToolbarVisible = true
grid.rowToolbar = ['add', 'delete', 'duplicate', 'moveUp', 'moveDown']
```

### Predefined Items

| String | Action |
|--------|--------|
| `'add'` | Insert a new row after the current row |
| `'delete'` | Delete the current row |
| `'duplicate'` | Duplicate the current row |
| `'moveUp'` | Move row up |
| `'moveDown'` | Move row down |

### Custom Items

```javascript
grid.rowToolbar = [
  'add',
  {
    id: 'edit',
    icon: '✏️',
    title: 'Edit Record',
    label: 'Edit',          // Optional text label next to icon
    row: 1,                  // Row in multi-row toolbar (1 = closest to grid row)
    group: 1,                // Group number for visual dividers
    danger: false,
    disabled: (row, rowIndex) => row.locked,
    hidden: (row, rowIndex) => row.archived,
    tooltip: { description: 'Open editor', shortcut: 'Enter' },
    onclick: ({ row, rowIndex }) => { /* ... */ }
  }
]
```

### Positioning

| Property | Values | Description |
|----------|--------|-------------|
| `toolbarPosition` | `'auto'`, `'left'`, `'right'`, `'top'`, `'inline'` | Where the toolbar appears relative to the row |
| `toolbarVerticalAlign` | `'top'`, `'center'`, `'bottom'` | Vertical alignment for `left`/`right` positions |
| `toolbarHorizontalAlign` | `'start'`, `'center'`, `'end'`, `'cursor'` | Horizontal alignment for `top` position |
| `toolbarFollowsCursor` | `boolean` | Toolbar tracks mouse position horizontally |
| `toolbarColumn` | `string \| number` | Pin toolbar above a specific column (for `top` position) |

### Cell-Specific Toolbar

```javascript
grid.cellToolbar = (row, rowIndex, field, colIndex) => {
  if (field === 'status') {
    return [
      { id: 'approve', icon: '✅', title: 'Approve', onclick: ({ row }) => approve(row) }
    ]
  }
  return undefined  // No cell-specific toolbar
}
```

## Context Menu

### Cell Context Menu

```javascript
grid.contextMenu = [
  {
    id: 'view',
    label: 'View Details',                         // or (context) => `View ${context.row.name}`
    icon: '👁️',                                    // or (context) => context.row.active ? '🟢' : '🔴'
    shortcut: 'Enter',                             // Display-only shortcut hint
    visible: (context) => true,                    // or static boolean
    disabled: (context) => context.row.locked,     // or static boolean
    danger: false,
    dividerBefore: false,
    onclick: (context) => { /* context: { row, rowIndex, colIndex, column, cellValue } */ }
  }
]
```

### Header Context Menu

```javascript
grid.headerContextMenu = [
  'sortAsc',                    // Predefined: sort ascending
  'sortDesc',                   // Predefined: sort descending
  'clearSort',                  // Predefined: clear sort
  'hideColumn',                 // Predefined: hide this column
  'freezeColumn',               // Predefined: freeze/unfreeze column
  'unfreezeColumn',
  'columnVisibility',           // Predefined: submenu to toggle column visibility
  {
    id: 'custom',
    label: 'Custom Action',
    icon: '⚙️',
    children: [...],             // Static submenu items
    submenu: (context) => [...], // Dynamic submenu items
    onclick: (context) => { /* context: { column, field, columnIndex, sortDirection, isFrozen, allColumns, labels } */ }
  }
]
```

## Callbacks

These are **callback properties** set on the grid element, not DOM events. Use the naming convention: `on*` callbacks are fire-and-forget notifications; `*Callback` properties return a value that affects behavior (see column-level callbacks above).

| Callback | Signature | Description |
|----------|-----------|-------------|
| `onrowchange` | `(detail: RowChangeDetail<T>) => void` | Cell value changed. Detail includes `row`, `draftRow`, `rowIndex`, `field`, `oldValue`, `newValue`, `isValid`, `validationError` |
| `onroweditstart` | `(detail: { row, rowIndex, field }) => void` | Editing started on a cell |
| `onroweditcancel` | `(detail: { row, rowIndex, field }) => void` | Edit was cancelled (Escape) |
| `onvalidationerror` | `(detail: { row, rowIndex, field, error }) => void` | Validation failed on commit |
| `ontoolbarclick` | `(detail: ToolbarClickDetail<T>) => void` | Toolbar button clicked. Detail: `{ item, rowIndex, row, event, triggerElement }` |
| `onrowaction` | `(detail: { action, rowIndex, row }) => void` | *Legacy* — use `ontoolbarclick` |
| `oncontextmenuopen` | `(context: ContextMenuContext<T>) => void` | Cell context menu opened |
| `onheadercontextmenuopen` | `(context: HeaderMenuContext<T>) => void` | Header context menu opened |
| `ondatarequest` | `(detail: DataRequestDetail) => void` | Sort/page/pageSize changed. Detail: `{ sort, page, pageSize, trigger, mode, skip }` |
| `onrowdelete` | `(detail: { rowIndex, row }) => void` | Ctrl+Delete pressed on a row. Also dispatched as a DOM `CustomEvent` |
| `onrowfocus` | `(detail: RowFocusDetail<T>) => void` | Different row was focused. Detail: `{ rowIndex, row, previousRowIndex }` |
| `onrowlockchange` | `(detail: RowLockChangeDetail<T>) => void` | Row lock state changed |
| `oncolumnresize` | `(detail: ColumnResizeDetail) => void` | Column resized. Detail: `{ field, oldWidth, newWidth, allWidths }` |
| `oncolumnreorder` | `(detail: ColumnReorderDetail) => void` | Column reordered. Detail: `{ field, fromIndex, toIndex, allOrder }` |
| `oncellselectionchange` | `(detail: CellSelectionChangeDetail) => void` | Cell selection changed. Detail: `{ range, cellCount }` |

> **Note:** Only `rowdelete` is also dispatched as a DOM `CustomEvent`. All other callbacks are property-based only.

## Public Methods

### Focus & Editing

| Method | Description |
|--------|-------------|
| `focusCell(rowIndex, colIndex)` | Programmatically focus a cell |
| `startEditing(rowIndex, colIndex)` | Programmatically start editing a cell |
| `openCustomEditor(rowIndex, colIndex)` | Open the custom editor for a cell with `editor: 'custom'` |

### Draft Management

| Method | Returns | Description |
|--------|---------|-------------|
| `getRowDraft(rowIndex)` | `T \| undefined` | Get the draft (uncommitted changes) for a row |
| `hasRowDraft(rowIndex)` | `boolean` | Check if a row has uncommitted changes |
| `discardRowDraft(rowIndex)` | `void` | Discard all draft changes for a row |
| `getDraftRowIndices()` | `number[]` | Get indices of all rows with drafts |
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
| `getRowId(row)` | `unknown \| undefined` | Get the ID of a row using `idValueMember`/`idValueCallback` |
| `findRowById(id)` | `{ row, index } \| null` | Find a row by its ID |

### Row Updates

| Method | Returns | Description |
|--------|---------|-------------|
| `updateRowById(id, newData)` | `boolean` | Merge partial data into a row (for WebSocket/live updates) |
| `replaceRowById(id, newRow)` | `boolean` | Replace an entire row by ID |

### Row Locking

| Method | Returns | Description |
|--------|---------|-------------|
| `isRowLocked(rowOrId)` | `boolean` | Check if a row is locked |
| `getRowLockInfo(rowOrId)` | `RowLockInfo \| null` | Get lock information for a row |
| `lockRowById(id, lockerInfo?)` | `boolean` | Lock a row externally (e.g., from WebSocket message) |
| `unlockRowById(id)` | `boolean` | Unlock an externally locked row |
| `getExternalLocks()` | `Map<unknown, RowLockInfo>` | Get all external locks |
| `clearExternalLocks()` | `void` | Remove all external locks |

### Row Selection

| Method | Returns | Description |
|--------|---------|-------------|
| `selectRow(rowIndex, mode?)` | `void` | Select a row. Mode: `'replace'` (default), `'toggle'`, `'range'` |
| `selectRowRange(fromIndex, toIndex)` | `void` | Select a range of rows |
| `clearSelection()` | `void` | Clear row selection |
| `isRowSelected(rowIndex)` | `boolean` | Check if a row is selected |
| `getSelectedRowsData()` | `T[]` | Get data for all selected rows |
| `copySelectedRowsToClipboard()` | `Promise<boolean>` | Copy selected rows as TSV to clipboard |

### Cell Selection

| Method | Returns | Description |
|--------|---------|-------------|
| `selectCellRange(range)` | `void` | Select a cell range programmatically |
| `clearCellSelection()` | `void` | Clear cell selection |
| `getSelectedCells()` | `Array<{ row, rowIndex, colIndex, field, value }>` | Get data for all selected cells |
| `copyCellSelectionToClipboard()` | `Promise<boolean>` | Copy selected cells as TSV to clipboard |

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

WebGrid uses a two-level CSS variable system:

```css
web-grid {
  /* Override component variables directly */
  --wg-accent-color: #10b981;
  --wg-header-bg: #f5f5f5;
}

/* Or set base variables for all KeenMate components */
:root {
  --base-accent-color: #10b981;
  --base-layer-1: #ffffff;
}
```

Each `--wg-*` variable falls back to a `--base-*` variable, then to a hardcoded default:

```css
:host {
  --wg-accent-color: var(--base-accent-color, #0078d4);
}
```

This means:
1. Setting `--base-accent-color` on `:root` themes all KeenMate components at once
2. Setting `--wg-accent-color` on `web-grid` overrides just the grid
3. Without either, the component uses its built-in defaults

### Key Variables

| Variable | Description |
|----------|-------------|
| `--wg-accent-color` | Primary accent color |
| `--wg-text-color-1` | Primary text color |
| `--wg-surface-1` | Background color |
| `--wg-surface-2` | Alternate row/header background |
| `--wg-border-color` | Border color |

### Component Variables Manifest

A machine-readable manifest documenting all CSS variables is included in the package:

```javascript
import manifest from '@keenmate/web-grid/manifest'

console.log(manifest.prefix)              // "wg"
console.log(manifest.baseVariables)       // 37 --base-* variables consumed
console.log(manifest.componentVariables)  // 178 --wg-* variables exposed
```

The manifest follows the [component-variables schema](https://raw.githubusercontent.com/keenmate/schemas/main/component-variables.schema.json) and contains:

- **baseVariables** — Theme variables (`--base-*`) the component consumes from `@keenmate/theme-designer`
- **componentVariables** — Component-specific variables (`--wg-*`) with category and usage descriptions

### Dark Mode

Dark mode is triggered automatically by:
- OS preference: `@media (prefers-color-scheme: dark)`
- Attribute: `data-theme="dark"` on any ancestor or host element
- Bootstrap: `data-bs-theme="dark"` on any ancestor or host element
- Class: `.dark` on any ancestor (Tailwind CSS)

To **force light mode** when the OS is in dark mode, set one of:
- Attribute: `data-theme="light"` on any ancestor or host element
- Bootstrap: `data-bs-theme="light"` on any ancestor or host element
- Class: `.light` on any ancestor (Tailwind CSS)

This is useful when your app manages its own theme (e.g. via a toggle) and needs to override the OS preference. The light mode selectors restore the `--base-*` fallback chain so theme-designer values are respected.

Ancestor detection uses `:host-context()` to cross shadow DOM boundaries (Chrome 88+, Firefox 128+, Safari 15.4+).

### Dynamic Cell & Row Styling

```javascript
// Per-cell styling via column callback
grid.columns = [{
  field: 'salary',
  cellClass: 'salary-cell',                                    // Static class
  cellClassCallback: (value, row) => value > 90000 ? 'high-value' : null  // Dynamic class
}]

// Per-row styling
grid.rowClassCallback = (row, index) => row.status === 'inactive' ? 'row-inactive' : null

// Inject custom CSS into shadow DOM
grid.customStylesCallback = () => `
  .high-value { background: #d1fae5 !important; }
  .row-inactive { opacity: 0.5; }
`
```

### i18n

All UI labels can be customized via the `labels` property:

```javascript
grid.labels = {
  rowActions: 'Actions',
  keyboardShortcuts: 'Keyboard shortcuts',
  paginationFirst: 'First',
  paginationPrevious: 'Previous',
  paginationNext: 'Next',
  paginationLast: 'Last',
  paginationPageInfo: 'Page {current} of {total}',
  paginationItemCount: '{count} items',
  paginationPerPage: 'per page',
  dropdownNoOptions: 'No options',
  dropdownSearching: 'Searching...',
  contextMenu: {
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

// Logging (silent by default)
window.components['web-grid'].logging.enableLogging()         // Enable all at debug level
window.components['web-grid'].logging.setLogLevel('info')     // Set level: trace|debug|info|warn|error|silent
window.components['web-grid'].logging.disableLogging()        // Back to silent
window.components['web-grid'].logging.setCategoryLevel('GRID:UI', 'debug')  // Per-category
window.components['web-grid'].logging.getCategories()         // ['GRID:INIT', 'GRID:DATA', 'GRID:UI', 'GRID:INTERACTION']
```

## Browser Support

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+

## License

MIT

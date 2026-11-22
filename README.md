# @keenmate/web-grid

## Demos & docs

- 📘 [Usage / API reference](./packages/web-grid/docs/usage.md) — every attribute, property, event, method and column field.
- 🎨 [Theming](./packages/web-grid/docs/theming.md) — the `--wg-*` variables, dark mode, the `--base-*` contract.
- 📚 [Examples / cookbook](./packages/web-grid/docs/examples.md) — recipes matching the example pages.
- ♿ [Accessibility](./packages/web-grid/docs/accessibility.md) — keyboard model, ARIA, focus.
- 📝 [Changelog](https://github.com/KeenMate/web-grid/blob/prod/CHANGELOG.md)
- 📦 [Package README](./packages/web-grid/README.md) — the short README published to npm.

## What is it

A feature-rich, framework-agnostic data grid web component built with TypeScript. Sorting, filtering, pagination, inline editing (8 editor types), cell range selection, clipboard support, row toolbar, context menus, frozen columns, column reorder/resize, fill handle, virtual scroll, dark mode, and full CSS variable theming — all in a Shadow DOM encapsulated `<web-grid>` element.

## What's New in v2.0.0-rc01

Upgrade guide: the [2.0.0-rc01 release notes](packages/web-grid/release-notes/2.0.0-rc01.md); full list: the
[CHANGELOG 2.0.0-rc01 section](CHANGELOG.md). A major release — breaking, with no aliases.

- **Core — every option is an attribute and a validated input** — 1.x observed no attributes, so `<web-grid is-striped>` was dead markup. `<web-grid>` now extends `@keenmate/web-components-core`'s `BlissElement`: every scalar / enum option is one input row — an HTML attribute (`enable-paging`, `page-size`, `striped`, `preset`), a typed property (`GridElementConfig`) and a validated value. An invalid value warns, fires `input-rejected` and keeps the previous one; removing an attribute resets the default. The element gains core's lifecycle (`defer` / `release()`, `ready` / `whenReady()`, `destroy()`), responsive rules per device or breakpoint, `customStyles` (page-wide too) and `readonly` / `disabled` with native semantics.
- **Interaction model — one `ctx`, DOM events, action items** — every callback takes one `ctx` carrying `controller` and `element` (`formatCallback(value, row)` → `getDisplayValueCallback(ctx)`), every event is a DOM event with an `on*` twin (`onrowchange` → `row-change` / `onRowChange`), and the row toolbar, the cell / header menus and the shortcuts share core's action-item shape with one `action` event. The built-ins (`add`, `delete`, `duplicate`, `move-up`, `move-down`) now do the work — veto them with `beforeActionCallback`. `el.grid` is replaced by the frozen `el.controller`; the engine and the module plumbing are private.
- **Naming — suite-wide renames** — properties follow the Keenmate naming rules (`isFilterable` → `isFilteringEnabled`, `isEditable` → `isEditingEnabled`, `mode` → `preset`, `freezeColumns` → `frozenColumnCount`, `*Visible` → `*Shown`), enum values are kebab-case (`'mouse-position'`, `sortMode: 'multiple'`), the tree API uses web-treeview's names (`pathMember`, `expandLevel`, `expandedPaths: string[]`, `row-expand` / `expanded-change`) and `idMember` (default `'id'`) is the one row-id member. The release notes carry every old → new table.
- **Keyboard and accessibility — an ARIA grid with one tab stop** — the table is `role="grid"` (`treegrid` in tree mode) with row / column counts and indexes that stay right in a virtual grid, `aria-selected`, `aria-readonly` and `aria-sort`. Like Excel, the grid is one tab stop in every edit mode: only the active cell has `tabindex="0"`, Tab leaves the grid, Enter / F2 reach the controls inside a cell. Shift+Arrow builds cell ranges, Shift+F10 opens the cell menu, tooltips show on keyboard focus, and the cell dropdown is an ARIA combobox.
- **Editing and clipboard — the Excel rules** — leaving a cell saves the edit (a click outside, another overlay, `startEditing()` elsewhere), Escape cancels. Copy takes what the cell shows — option labels, formatted dates, locale numbers, `getDisplayValueCallback` — and a pasted option label maps back to its value. Ctrl+V and type-to-edit work in every edit mode, pasted text is typed per column, the number editor validates strictly, and `renderCellCallback` wins in every column type (`null` = the built-in look).
- **Localization — labels, locale, number formats** — UI strings go through core `/locale`: flat `<elementType>.<name>` keys (`labels.pageInfo`, `menuItems.sortAsc`), a page-wide dictionary in `window.components.locale`, and a `translateCallback` per grid or per page. The new `locale` input formats number columns Excel-style (`1.234,50` in `de`) and parses typed text with the same separators; `parseNumberCallback` reads text your own way.
- **Phone, touch and overlays — sheets and finger drags** — on a phone the cell dropdown and the date editor are an edge-to-edge sheet and the menus a bottom sheet (`menu-presentation`), with core's sheet chrome and the Back gesture. Column resize and reorder work with a finger. The menus run on core `/menu`, the dropdown and date editor on core `createPopover()` in the grid's shadow root, so they follow the grid's theme; the filter row matches case- and accent-insensitively.
- **Theming and icons — the shared contract** — standalone colours follow `@keenmate/base-css-variables` 2.0 (derived steps from `--wg-accent-color`), motion chains to `--base-duration-*`, layers sit on the core `--base-z-*` tiers and the context menus theme through `--wg-context-menu-*` → `--km-menu-*`. Icons render through core `renderIcon` (markup, built-in names, the grid's or the page's `renderIconCallback`, icon-font classes) and repaint when the page hook changes; loaders draw core's shared loader (`renderLoadingCallback`).

## What's New in v1.2.0-rc02

- **Excel-like commit-on-click-away** — new `shouldCommitOnClickAway` property (defaults to `true`). Clicking a different cell while editing now commits the in-progress value through `beforeCommitCallback` / `validateCallback` instead of silently discarding it. Set to `false` to keep the legacy discard behavior. Companion fix: row focus (`.wg__row--focused`) now applies on the first cell click — previously it only landed on the second.
- **CSS surface taxonomy aligned with pure-admin's `--base-*` names** — `--wg-surface-1/2/3` renamed to `--wg-main-bg` / `--wg-elevated-bg`, `--wg-surface-floating` → `--wg-dropdown-bg` (`--wg-surface-3` merged into `--wg-hover-bg`). Consumer overrides of the old names need to migrate; see the CHANGELOG mapping table.
- **Dark mode reworked to respect consumer themes** — the dark-mode override blocks used to set `--wg-*` to hardcoded literals, silently overriding pure-admin / theme-designer values. They now just flip `color-scheme` and let `light-dark()` in `variables.css` do the work. The consumer's `--base-*` chain stays the source of truth.
- **OS-aware dark mode via `light-dark()` fallbacks** — every hardcoded fallback in `variables.css` is wrapped in `light-dark(<light>, <dark>)`. A consumer who only sets `body { color-scheme: dark }` (no overrides, no framework class) now gets a sensible dark palette automatically.
- **CSS architecture refactor: `@layer` cascade + canonical file set** — `main.css` now declares `@layer variables, component, overrides;` so consumer rules beat library defaults without `!important`. CSS filenames dropped the underscore prefix (pure-CSS doesn't use SASS-partial convention). New canonical Tier-2 files (`controls.css` / `floating.css` / `states.css` / `animations.css`) match the cross-component pattern.
- **`--base-active-bg` + `--base-inverse-bg`** — two new cross-component theming hooks. `--base-active-bg` distinguishes pressed from hover; `--base-inverse-bg` covers tooltip and future inverse UI surfaces. Both are optional and additive.
- **Context menu was leaking through stale `--base-*` names** — was referencing `--base-layer-01` / `--base-stroke-default` / `--base-error-color` (all long-removed in pure-admin). Now uses the canonical names; consumers loading a pure-admin theme finally get themed context menus instead of silent fallbacks.
- **WCAG contrast e2e suite** — 18 assertions check header / body / hover / focused / selected-row / editing-cell contrast against the 3:1 threshold (WCAG AA for non-text UI). Catches theme regressions invisible to visual smoke tests.

Earlier releases: [CHANGELOG](CHANGELOG.md) (no release notes before 2.0.0-rc01).

## Installation

```bash
npm install @keenmate/web-grid
```

Or via CDN (no bundler):

```html
<script type="module" src="https://unpkg.com/@keenmate/web-grid"></script>
```

### Editor IntelliSense

The package ships a Custom Elements Manifest (`custom-elements.json`) and editor metadata, so you get
autocomplete and hover docs for `<web-grid>`'s attributes, events and `--wg-*` CSS custom properties.
All of it is generated from the component's source on every build.

- **JetBrains** (WebStorm / IntelliJ) — works automatically via the `web-types` field in `package.json`.
- **VS Code** — point your workspace at the data files once, in `.vscode/settings.json`, then reload the window:

  ```json
  {
    "html.customData": ["./node_modules/@keenmate/web-grid/vscode.html-custom-data.json"],
    "css.customData": ["./node_modules/@keenmate/web-grid/vscode.css-custom-data.json"]
  }
  ```

## Quick start

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
- **Column Reordering** — Drag-to-reorder with optional persistence (`storage-key`)
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
| `isReadonly` | `boolean` | `false` | Attribute `readonly` (presence: `readonly="false"` is still read-only; reflects). Values can't change (no edit / paste / fill / row add-delete-move); still focusable, selectable, copyable. The `read-only` preset sets it |
| `isDisabled` | `boolean` | `false` | Attribute `disabled` (presence; reflects). No interaction at all (container `inert`, dimmed) |
| `focusedRowIndex` | `number \| null` | `null` | Currently focused row index (readable/writable; assigning it is silent — no `focus-change`) |

### Editing

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isEditingEnabled` | `boolean` | `false` | Enable cell editing |
| `isRowEditable` | `boolean` | — | Static per-grid row editability |
| `getIsRowEditableCallback` | `(ctx: { row }) => boolean` | — | Decides editability per row |
| `editTrigger` | `EditTrigger` | `'dblclick'` | How editing starts: `'click'`, `'dblclick'`, `'button'` (an edit button in editable cells — on hover and in the focused cell; F2 / Enter too), `'always'`, `'navigate'` |
| `editButtonIcon` | `string` (icon) | `'✎'` | Icon of the edit button (`editTrigger: 'button'` / `column.isEditButtonShown`), read like every icon (see [Icons](#icons)) — markup (`'<span class="lucide-pencil"></span>'`), a built-in name (`'edit'`), icon-font classes or text. Attribute `edit-button-icon`. Accessible name: `ariaLabels.editCell` (title `tooltips.editCell`) |
| `editStartSelection` | `EditStartSelection` | `'select-all'` | Cursor position when entering edit via navigate: `'mouse-position'`, `'select-all'`, `'cursor-at-start'`, `'cursor-at-end'` |
| `dropdownToggleVisibility` | `ToggleVisibility` | `'on-focus'` | When to show dropdown toggle button: `'always'`, `'on-focus'` |
| `shouldOpenDropdownOnFocus` | `boolean` | `false` | Auto-open dropdown when cell is focused |
| `shouldOpenDropdownOnEnter` | `boolean` | `false` | Enter key opens dropdown (`true`) or moves to next row (`false`) |
| `overlayGroup` (`overlay-group`) | `string \| null` | `null` | Scope the "one overlay open at a time" coordination of the cell dropdown, the date editor and the row toolbar (`toolbar-trigger` click / button) to a named group: overlays (multiselects, datepickers, external popovers) sharing a group dismiss each other when one opens; different groups are independent. Unset = the default (ungrouped) group |
| `menuPresentation` (`menu-presentation`) | `'auto' \| 'floating' \| 'sheet' \| 'drawer'` | `'auto'` | How the cell / header menus open: `auto` — a bottom sheet on a phone, the floating menu elsewhere; `sheet`, `drawer` (full-height side panel) or `floating` always. Per device / width through the responsive rules |
| `menuSide` (`menu-side`) | `'start' \| 'end'` | `'start'` | The edge a `drawer` menu slides in from |
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
| `paginationPosition` | `string` | `'bottom-center'` | Position(s): `'bottom-center'`, `'top-right\|bottom-right'` for multiple (`top-` / `bottom-` + `left` / `center` / `right`; anything else is refused) |
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
| `cellSelectionMode` | `CellSelectionMode` | `'click'` | How to select cell ranges: `'none'`, `'click'` (drag; Shift+click extends from the focused cell), `'shift'` (Shift+click twice / Shift+drag). In every mode but `'none'`, Shift+Arrow grows / shrinks the range from the focused cell (the anchor keeps focus), Shift+Home / End go to the row start / end, Ctrl+Shift+Arrow to the data edge; while editing, Shift+Arrow selects text in the editor |
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
| `storageKey` (`storage-key`) | `string \| null` | `null` | Key of the persisted column state (core state store, SPEC §12.17); unset = off. Default store: localStorage `km-state:web-grid:<key>` |
| `shouldPersistColumnWidths` (`persist-column-widths`) | `boolean` | `false` | Persist the column widths the user resized to (needs `storageKey`) |
| `isColumnReorderAllowed` | `boolean` | `false` | Enable drag-to-reorder columns |
| `shouldPersistColumnOrder` (`persist-column-order`) | `boolean` | `false` | Persist the column order the user dragged to (needs `storageKey`) |
| `loadStateCallback` | `LoadStateCallback<GridPersistenceState>` | — | `(ctx) => GridPersistenceState \| null` (may be async), `ctx`: `{ key }` + context — the page keeps the state |
| `saveStateCallback` | `SaveStateCallback<GridPersistenceState>` | — | `ctx`: `{ key, state }` + context, `state` = the WHOLE `{ columnWidths?, columnOrder? }`. Set both callbacks; either one alone switches localStorage off |

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
| `scrollMaxHeight` | `string \| number` | `'100vh'` | Max-height when `isScrollable` is `true` — a CSS length; a number means pixels (`240` → `'240px'`); an invalid length is refused |
| `beforeScrollCallback` | `(ctx: GridBeforeScrollContext) => false \| Partial<GridScrollOptions> \| void` | `null` | Runs before every scroll the grid makes on its own: `ctx.source` `'keyboard'` / `'scroll-to-row'` / `'go-to-row'`, `row`, `rowIndex`, `field` (`null` for a whole row), `container` (the scroller core found, `null` = page), `options` (`block` / `inline` / `behavior` / `shouldRevealContainer`). `false` skips the scroll, a partial `options` replaces the defaults. Synchronous. With virtual scroll a jump scrolls by index, so only `false` applies |
| `isTableBorderOnly` | `boolean` | `false` | Border only around table, not pagination/toolbar (`tableBorderOnly` is a deprecated alias) |

### Virtual Scroll

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isVirtualScrollEnabled` | `boolean \| null` | `false` | `true` / `false` force virtual scroll on / off; `null` (attribute `enable-virtual-scroll="auto"`) opts in to automatic by `virtualScrollThreshold` |
| `virtualScrollThreshold` | `number` | `100` | Automatic mode only (`isVirtualScrollEnabled` `null` / `"auto"`): virtual once the displayed rows (after filtering / paging) reach the threshold; re-checked when `items` changes |
| `virtualScrollItemHeight` | `number` | `38` | Fixed row height in pixels |
| `virtualScrollOverscan` | `number` | `10` | Extra rows rendered above/below viewport |

### Infinite Scroll

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isInfiniteScrollEnabled` | `boolean` | `false` | Enable infinite scroll |
| `infiniteScrollThreshold` | `number` | `100` | Distance from bottom (px) to trigger load |
| `hasMoreItems` | `boolean` | `true` | Set to `false` when no more data |

While a `load-more` request is pending, a row at the bottom shows the loader + `messages.loading` (see [Loading states](#loading-states)).

### Loading states

Every loader draws through one shared hook (core `renderLoader`): the infinite-scroll row
(`context: 'row'`, label `ariaLabels.loading`) and the autocomplete's async search (`context: 'search'`,
label `ariaLabels.searching` — in the editor and in the dropdown). The container gets
`role="status"` + `aria-label`.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `renderLoadingCallback` | `(ctx: LoaderRenderContext) => void \| (() => void)` | `null` | Draws the grid's loaders: fill `ctx.containerElement` (`ctx`: `{ component, context, containerElement, element, label }`); may return a cleanup. Beats the page-wide `window.components.renderLoadingCallback` |

Precedence: `renderLoadingCallback` > `window.components.renderLoadingCallback` (one hook for every
Keenmate component on the page) > the default `<span class="wg__loader">`, a mask drawn in
`currentColor` from `--wg-loader-icon` / `-rotate` / `-duration` / `-size` (→ `--base-loader-*`).
Change the shape page-wide with `--base-loader-icon`; reduced motion slows it (1.5s), it never stops.

```js
window.components.renderLoadingCallback = ({ context, containerElement }) => {
  containerElement.innerHTML = '<span class="my-dots"></span>'
}
```

### Icons

Toolbar / row-action icons, the edit button (`editButtonIcon`) and the dropdown option icons all go through core
`renderIcon` — first match wins: markup (`<svg …>`) as is → a built-in name (`add`, `check`, `close`, `delete`,
`edit`, `settings`, … the `--base-icon-*` glyphs; reserved, never sent to a hook) → this grid's `renderIconCallback`
→ the page-wide `window.components.renderIconCallback` → icon-font classes (`'fa-solid fa-folder'` →
`<i class="wg__icon fa-solid fa-folder">`) → anything else (an emoji) as text.
Changing `window.components.renderIconCallback` later repaints the icons (in place — the active cell, selection, an
open editor / dropdown / row toolbar and the scroll stay). Icon-font classes render inside the grid's shadow root, so
the font's CSS must reach it: pass it through `customStyles` (or the page-wide
`window.components['web-grid'].customStyles`) — page CSS alone does not style it.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `renderIconCallback` | `(name, ctx) => string \| null \| undefined` | `null` | This grid's icon hook (`ctx`: `{ component, element, prefix: 'wg' }` + `item` or `option`); markup, `''` = no icon, `null` = not mine (the page-wide hook decides). Property only |

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

**Filter row.** With `isFilteringEnabled`, a row under the header gets a text input for every column with `isFilterable: true` (labelled "Filter &lt;column&gt;" via `ariaLabels.filterColumn`; Tab-reachable). Typing is debounced (300 ms; Enter applies at once, Escape clears) → `setFilter(field, text)` → page 1. A `filterCallback` returning `null` marks the input `.wg__filter-input--invalid` (red border, `aria-invalid`) and ignores that filter. In server pagination a filter change runs `beforePageChangeCallback` (trigger `'filter'`) and fires `data-request` (trigger `'filter'`). Styled by the `--wg-filter-*` variables. A filter change (UI or `setFilter` / `filters`) resets `currentPage` to 1.

### Styling

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `customStyles` | `string \| null` | `null` | Attribute `custom-styles`. CSS for the grid's shadow root (raw — never pass user input). Applied after the page-wide layer, so it overrides it |
| `getCustomStylesCallback` | `(ctx: GridContext) => string \| null` | `null` | Computes the instance CSS from the grid context; wins over `customStyles` |
| `getRowClassCallback` | `(ctx: { row, rowIndex }) => string \| null` | — | Dynamic CSS class for rows |
| `labels` | `GridLabelsInput` (partial `GridLabels`: flat `<elementType>.<name>` keys, or full `web-grid.*` keys) | — | Override UI labels for i18n (see [i18n](#i18n)) |
| `locale` | `string \| null` | `null` | BCP-47 locale for the numbers in labels (`{count}` items, page info, number-range errors), `editor: 'number'` columns (display, editor text, typed / pasted parse, copy) and the date editor's month / weekday names; unset (or `'auto'`) = the page-wide `window.components.locale.locale`, else the browser language. UI strings are `labels`; other cell values are not formatted (use `getDisplayValueCallback`). Attribute `locale` |
| `parseNumberCallback` | `(ctx: { text, locale, decimalSeparator, thousandsSeparator, parseDefault }) => number \| null \| undefined` | `null` | This grid's number reader for `editor: 'number'` columns (typed + pasted text); `null` = not a number (invalid cell), `undefined` = not mine (the page-wide `window.components.locale.parseNumberCallback`, then core's strict parse). Property only |
| `translateCallback` | `(ctx: { component, key, template, params, locale }) => string \| null \| undefined` | `null` | This grid's label hook — asked for every key `labels` didn't set, before the page-wide `window.components.locale.translateCallback`; `null` = not mine. Property only |
| `getValidationTooltipCallback` | `(ctx: CellContext<T> & { error }) => string \| null` | — | Custom HTML for validation error tooltip (grid-level default) |
| `invalidCells` | `CellValidationState[]` | `[]` | External validation state for cells |

**Page-wide custom CSS.** `window.components['web-grid'].customStyles` (or `.getCustomStylesCallback(ctx)`, which wins) styles every grid on the page from one place; it sits in its own `<style>` before the instance's `customStyles` / `getCustomStylesCallback`, so an instance still overrides it, and assigning it updates live grids. An `@import` (an icon font) in either layer is also linked once in the document `<head>` — Chromium ignores `@font-face` inside a shadow root; `window.components['web-grid'].shouldHoistImports = false` turns that off.

```js
window.components['web-grid'].customStyles = `.wg__cell.price { font-variant-numeric: tabular-nums; }`
grid.customStyles = `.wg__cell.price { color: var(--base-success-color); }`   // this grid only, wins
```

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
// page — every Keenmate component (keys a component doesn't have are skipped)
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
| `getDisplayValueCallback` | `(ctx: CellContext<T>) => string` | Display text for the cell (escaped); in dropdown / date / number cells too (wins over the option label / formatted date / locale number) — copy takes the same text |
| `renderCellCallback` | `(ctx: CellContext<T>) => string` | Custom cell HTML, in every column type (text, number, date, dropdown, checkbox) — wins over `getDisplayValueCallback`, which wins over the built-in text (option label / formatted date / locale number / the checkbox); `null` / `undefined` = the built-in display, `false` = empty. Copy never scrapes the HTML: it takes `getCopyValueCallback`, else `getDisplayValueCallback`, else the built-in text |

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

An async `validateCallback` (a promise) never holds the edit: leaving the cell ends the edit at once and the cell shows the typed value; the result (transform, invalid mark, `validation-error`, `row-change`) is applied when the promise settles, in commit order.

### Tooltip

| Field | Type | Description |
|-------|------|-------------|
| `tooltipMember` | `string` | Property name in row data containing tooltip text |
| `getTooltipCallback` | `(ctx: CellContext<T>) => string \| null` | Dynamic tooltip (takes priority over `tooltipMember`) |
| `isTooltipHtml` | `boolean` | Render tooltip content as HTML |

### Clipboard

| Field | Type | Description |
|-------|------|-------------|
| `getCopyValueCallback` | `(ctx: CellContext<T>) => string` | Text copied for this cell (single-cell, range, row and column copy); unset = what the cell shows (`getDisplayValueCallback`, else a dropdown's option label, a date's formatted date, the formatted number, else the raw value); a pasted option label maps back to its value |
| `getPasteValueCallback` | `(ctx: CellContext<T> & { text }) => unknown` | Value stored for the pasted text |

Without `getPasteValueCallback`, pasted text is typed for the column: **number** — the editor's strict parse; **checkbox** — `true` / `1` / `yes` / `x` / `✓` or the text of `trueValue` → `trueValue`, `false` / `0` / `no` / blank or the text of `falseValue` → `falseValue`; **date** — the column's `dateFormat`, then ISO `YYYY-MM-DD`, stored per `outputFormat`; **select / combobox / autocomplete** — an option's shown label (exact, then case-insensitive) or its value's text → that option's value. Text that doesn't parse is kept and the cell marked invalid (`errors.invalidNumber` / `errors.invalidBoolean` / `errors.invalidDate`).

Ctrl+V pastes at the focused cell in every `editTrigger` mode (Excel; read-only / disabled grids and non-editable cells take nothing); inside an always-on editor a one-cell text is the editor's own paste.

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

A number column follows the grid's effective `locale` (the `locale` input → page-wide `window.components.locale` → browser), Excel-style: the cell shows the locale's separators and grouping (`1,234.50` en-US, `1.234,50` de, `1 234,50` cs) with `decimalPlaces` digits when set (else the value's own digits); the editor opens with the locale decimal separator and no grouping (`1234,50`); copy (no `getCopyValueCallback`) is the shown text. Typed and pasted text is read with core `parseNumber`: grouping is optional but a group separator must sit in a real group position (`1.234,5` → 1234.5, while `1.5` in `de` is an invalid number, never a silent 15); the grid's `parseNumberCallback` (then the page-wide `window.components.locale.parseNumberCallback`) can read numbers your own way — return the number, `null` = invalid, `undefined` = core's parse. Page-wide `window.components.locale.decimalSeparator` / `thousandsSeparator` override the locale's. The stored value stays a number (sort, filter, events, form value unchanged); `getDisplayValueCallback` / `renderCellCallback` / `getCopyValueCallback` still win. Typing on a focused number cell starts an edit on a digit, a minus or the locale's decimal separator (`,5` in `cs` / `de`; `.` too where it isn't the group separator); other keys do nothing. To force one format, set `locale="en-US"` on the grid (or `window.components.locale`).

The typed text is parsed strictly with the locale's separators (core `parseNumber`; grouping optional, blank → `null`: `1234,5` and `1.234,5` in de, `1 234,5` in cs): `abc` or `12abc` mark the cell invalid (`errors.invalidNumber`, "Not a number"), as do values outside `min` / `max` or a negative with `allowNegative: false` — **no clamping**; the draft keeps what was typed and `validation-error` fires. `decimalPlaces` rounds (`1.239` → `1.24`). Pasted text goes through the same parse.

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
| `iconMember` | `getIconCallback` | Property/callback for the option icon — read like every icon (see [Icons](#icons)) |
| `subtitleMember` | `getSubtitleCallback` | Property/callback for subtitle/description |
| `disabledMember` | `getIsDisabledCallback` | Property/callback for disabled state |
| `groupMember` | `getGroupCallback` | Property/callback for grouping options |

#### Rendering & Behavior

| Option | Type | Description |
|--------|------|-------------|
| `renderOptionCallback` | `(ctx: { option, optionIndex, isFocused, isSelected, isDisabled }) => string` | Custom HTML for each option |
| `onSelect` | `(ctx: { option, row, rowIndex, column, field, … }) => void` | Fires when an option is selected |
| `isEmptyAllowed` | `boolean` | An empty first item (`labels.emptyOption`, "—") that sets the value to `null` (default `false`) |
| `labels` | `{ 'messages.noOptions'?, 'messages.noMatchingOptions'?, 'messages.searching'?, 'ariaLabels.searching'?, 'labels.emptyOption'? }` | This column's dropdown texts, per key over the grid `labels` |
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

Callbacks, events and clickable items follow the shared Keenmate interaction model (`@keenmate/web-components-core`):

- **Every callback takes one `ctx` object.** Every ctx and every event detail also carries `controller` (the public `GridController`, same as `el.controller`) and `element` (the `<web-grid>` host) — both non-enumerable, so `JSON.stringify` and logs see only the data.
- **`*Callback` properties affect behavior** (return a value, or `false` to cancel a `before*Callback`); **events** only notify.
- **Toolbar buttons, context-menu items and shortcuts are action items** with one shape (below). Activating any of them fires the `action` event.

### Action items

| Field | Type | Description |
|-------|------|-------------|
| `action` | built-in name | Runs a built-in (see the tables below). Omit for a custom item |
| `id` | `string` | Identifies a custom item; reported back in the `action` event |
| `text` | `string` | Label. On icon toolbar buttons it's the accessible name + tooltip heading (shown as a label only without an `icon` or with `isTextVisible`) |
| `icon` | `string` | Icon — markup, a built-in name, `renderIconCallback`, icon-font classes or an emoji (see [Icons](#icons)) |
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

A **divider** is an entry `{ divider: true, text? }` (a labelled one is a group heading), or `createMenuDivider(text)` exported from the package.

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

Use a string (`'add'`) for the default look, or an object to restyle it: `{ action: 'delete', icon: '🗑️', text: 'Remove' }`. Built-in texts come from the `menuItems.*` labels (`menuItems.deleteRow`, …). To veto one (e.g. confirm a delete), return `false` from `beforeActionCallback`.

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
    onClick: (detail) => { /* detail: { column, field, colIndex, sortDirection, isFrozen, isTreeMode, allColumns, labels: { text(key, params?), html(key, params?) }, … } */ }
  }
]
```

Column-visibility toggles report `action: 'toggle-column'` (with `id` = the field) and `'show-all-columns'`. On the filler area right of the last column, `ctx.column` is `null` and `colIndex` is `-1`. `beforeHeaderMenuOpenCallback(ctx)` works like `beforeContextMenuOpenCallback`.

### Menu keyboard, markup and theming

Both menus are the shared Keenmate menu (`@keenmate/web-components-core/menu`), rendered in the grid's shadow root:

- **Keyboard:** Shift+F10 or the ContextMenu key on the focused cell opens the cell menu below it with the first item focused. In the menu: ↑ / ↓ (disabled items are skipped), Home / End, → / Enter / Space open a submenu, ← / Escape close it, Enter / Space activate, Escape closes and returns focus to the cell, Tab closes. An item's `shortcut` letter activates it while the menu is open.
- **Dismiss:** outside press, scroll (page or grid), window blur, another Keenmate overlay opening.
- **Markup:** `.km-menu` levels (`.km-menu--submenu` for submenus) with `.km-menu__item` (`--disabled`, `--danger`, `--toggled`, `--has-submenu`), `__icon`, `__label`, `__shortcut`, `__divider`. The cell menu's levels also carry `wg-context-menu`, the header menu's `wg-header-menu`. Items are `role="menuitem"`; an item that defines its toggle state (`isToggled` / `getIsToggledCallback`, e.g. the column-visibility toggles, class `wg-header-menu__column-toggle`) is `role="menuitemcheckbox"` + `aria-checked`.
- **Theming:** `--wg-context-menu-*` on `web-grid` themes both menus of that grid; unset (the default), the page-wide `--km-menu-*` on `:root` applies (every Keenmate menu), then `--base-*`, then the core default:

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
| `--wg-context-menu-z-index` | `--km-menu-z-index` (9001 = `--base-z-tooltip` + 1) | Menu stacking order |

#### Phone sheet header

A **sheet** is a panel that covers the page on a phone — a bottom sheet, a side drawer, a full-screen picker. These variables style its top bar: the strip (`header-*`), its title (`title-*`) and the round close button (`close-*`).

The cell dropdown / date editor sheet header (title + close button) is core's shared sheet chrome. `--wg-sheet-*` on `web-grid` themes it for that grid; unset (the default), the page-wide `--km-sheet-*` on `:root` applies (every Keenmate sheet), then `--base-*`, then the core default. `--wg-sheet-header-bg` unset = the sheet's own background.

| Variable | Falls back to | Description |
|---|---|---|
| `--wg-sheet-header-gap` | `--km-sheet-header-gap` | Gap between the header's title / fields and the close button (→ --base-space-sm, default 8px) |
| `--wg-sheet-header-padding-block` | `--km-sheet-header-padding-block` | Header top / bottom padding; the close button's tap area reaches it (→ --base-space-sm, default 8px) |
| `--wg-sheet-header-padding-inline` | `--km-sheet-header-padding-inline` | Header start / end padding (lines the title up with the sheet rows); the close button's tap area reaches it (→ --base-space-base, default 16px) |
| `--wg-sheet-header-min-height` | `--km-sheet-header-min-height` | Header minimum height (default 5.6 × --base-rem = 56px) |
| `--wg-sheet-header-bg` | `--km-sheet-header-bg` | Header background (default transparent: the sheet's) |
| `--wg-sheet-header-border` | `--km-sheet-header-border` | Header bottom border (default 1px solid --base-border-color) |
| `--wg-sheet-title-color` | `--km-sheet-title-color` | Title colour (default inherit) |
| `--wg-sheet-title-font-size` | `--km-sheet-title-font-size` | Title font size (→ --base-font-size-lg, default 18px) |
| `--wg-sheet-title-font-weight` | `--km-sheet-title-font-weight` | Title font weight (→ --base-font-weight-semibold, default 600) |
| `--wg-sheet-close-size` | `--km-sheet-close-size` | Close button chip size (→ --base-touch-target-min, default 44px) |
| `--wg-sheet-close-icon-size` | `--km-sheet-close-icon-size` | Close icon size (default 2 × --base-rem = 20px) |
| `--wg-sheet-close-icon` | `--km-sheet-close-icon` | Close icon, a mask image (→ --base-icon-close, default the base ✕) |
| `--wg-sheet-close-color` | `--km-sheet-close-color` | Close icon colour (default inherit) |
| `--wg-sheet-close-bg` | `--km-sheet-close-bg` | Close chip background (default transparent) |
| `--wg-sheet-close-bg-hover` | `--km-sheet-close-bg-hover` | Close chip hover background (→ --base-hover-bg) |
| `--wg-sheet-close-border` | `--km-sheet-close-border` | Close chip border (default none; with a radius and a bg it reads as a bordered button) |
| `--wg-sheet-close-border-radius` | `--km-sheet-close-border-radius` | Close chip radius (default 50%) |
| `--wg-sheet-close-edge-nudge` | `--km-sheet-close-edge-nudge` | How far the close button slides past the header padding toward the edge (→ --base-space-sm, default 8px) |
| `--wg-sheet-close-focus-color` | `--km-sheet-close-focus-color` | Close button keyboard focus ring (→ --base-primary-color) |

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
| `scrollToRow(rowIndex)` | Scroll a displayed row into view — centred in the grid's container, the grid brought on screen; `Promise<boolean>` (`false` when out of range or `beforeScrollCallback` skipped it) |
| `startEditing(rowIndex, colIndex)` | Programmatically start editing a cell (an edit open on another cell is saved first) |
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

/* Or set base variables for all Keenmate components */
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
1. Setting `--base-primary-color` on `:root` themes all Keenmate components at once
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
console.log(manifest.baseVariables)       // 51 --base-* variables consumed
console.log(manifest.componentVariables)  // 242 --wg-* variables exposed
```

The manifest follows the [component-variables schema](https://schemas.keenmate.dev/component-variables/v1.schema.json) and contains:

- **baseVariables** — Theme variables (`--base-*`) the component consumes from `@keenmate/theme-designer`
- **componentVariables** — Component-specific variables (`--wg-*`) with category and usage descriptions

### Dark Mode

Dark mode follows the page:
- Page signal: `data-theme="dark"`, `data-bs-theme="dark"` or `.dark` (Tailwind) on `<html>` or `<body>` — detected once per page by `@keenmate/web-components-core` and mirrored onto the grid as `data-context-theme`, so it works in Firefox and Safari too. For a themed section, add `theme-source="closest"` (or a selector) to the grid.
- Per instance: `data-theme="dark"` / `"light"` on the `<web-grid>` itself (wins).
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

All UI strings are customized via `labels` — a partial object of flat `<elementType>.<name>` keys (also a JSON attribute: `labels='{"messages.noData":"Nothing here"}'`; a full `web-grid.*` key works too) merged per key over the page-wide labels and the built-in English texts. `{name}` placeholders are filled in. A column can override its dropdown texts with `editorOptions.labels`.

```javascript
grid.labels = {
  // Row toolbar / inline actions column
  'tooltips.rowActions': 'Row actions',          // the toolbar trigger button's title
  'ariaLabels.rowActions': 'Row actions',        // its accessible name (the button shows only ⋮)
  'columnHeaders.inlineActions': 'Actions',      // the inline actions column header ('' = blank)
  // Shortcuts help
  'tooltips.keyboardShortcuts': 'Keyboard shortcuts',  // the help icon's title
  'headers.keyboardShortcuts': 'Keyboard shortcuts',   // the help overlay's title
  'headers.rangeShortcuts': 'Selection shortcuts',     // sub-heading for rangeShortcuts
  // Pagination (getPaginationLabelsCallback still wins)
  'buttons.firstPage': '⏮',
  'buttons.previousPage': '◀',
  'buttons.nextPage': '▶',
  'buttons.lastPage': '⏭',
  'ariaLabels.firstPage': 'First page',          // the buttons' accessible names (their text is a glyph;
  'ariaLabels.previousPage': 'Previous page',    //  a customized buttons.* text names them while these are unset)
  'ariaLabels.nextPage': 'Next page',
  'ariaLabels.lastPage': 'Last page',
  'labels.pageInfo': 'Page {current} of {total}',
  'labels.itemCount': '{count} items',
  'labels.perPage': 'per page',
  // Empty table / loading
  'messages.noData': 'No items to display',      // the grid has no rows
  'messages.noResults': 'No matching items',     // rows exist, the filter matched nothing
  'messages.loading': 'Loading…',                // infinite-scroll load-more row ('' = no row)
  'ariaLabels.loading': 'Loading…',              // its loader's accessible name
  // Dropdown editors (a column can override these with editorOptions.labels)
  'messages.noOptions': 'No options',            // the editor has no options at all
  'messages.noMatchingOptions': 'No matching options',  // a typed filter / search matched nothing
  'messages.searching': 'Searching…',            // a typed async search is in flight
  'ariaLabels.searching': 'Searching…',          // the search loader's accessible name
  'labels.emptyOption': '—',                     // the empty first item (editorOptions.isEmptyAllowed)
  // Phone sheet / menu sheet
  'ariaLabels.closeSheet': 'Close',              // the sheet's close button (leaves the cell: saves)
  'placeholders.search': 'Search…',              // the sheet's search field (combobox / autocomplete)
  'menuItems.back': 'Back',                      // a submenu level's back row
  // Row locking
  'tooltips.rowLocked': 'This row is locked',
  'tooltips.rowLockedBy': 'Locked by {lockedBy}',
  // Go-to-row dialog (Ctrl/Cmd+G)
  'labels.goToRow': 'Go to row (1-{max}):',
  'buttons.go': 'Go',
  'buttons.cancel': 'Cancel',
  // Cells
  'ariaLabels.editCell': 'Edit',                 // edit button (editTrigger: 'button')
  'tooltips.editCell': 'Edit',
  'ariaLabels.expand': 'Expand',                 // tree chevron
  'ariaLabels.collapse': 'Collapse',
  'ariaLabels.filterColumn': 'Filter {column}',  // a filter-row input
  // Built-in value checks (number editor, paste)
  'errors.invalidNumber': 'Not a number',
  'errors.numberMin': 'Must be at least {min}',
  'errors.numberMax': 'Must be at most {max}',
  'errors.numberNegative': 'Must not be negative',
  'errors.invalidBoolean': 'Not a yes / no value',  // text pasted into a checkbox column
  'errors.invalidDate': 'Not a valid date',         // text pasted / typed into a date column
  // Built-in row / tree actions (the item text: toolbar, cell menu, shortcuts help)
  'menuItems.addRow': 'Add row',
  'menuItems.deleteRow': 'Delete row',
  'menuItems.duplicateRow': 'Duplicate row',
  'menuItems.moveUp': 'Move up',
  'menuItems.moveDown': 'Move down',
  'menuItems.expand': 'Expand',                  // one level
  'menuItems.collapse': 'Collapse',
  'menuItems.expandSubtree': 'Expand subtree',   // the row + everything under it
  'menuItems.collapseSubtree': 'Collapse subtree',
  'menuItems.expandAll': 'Expand all',           // the whole tree
  'menuItems.collapseAll': 'Collapse all',
  // Header menu built-ins
  'menuItems.sortAsc': 'Sort Ascending',
  'menuItems.sortDesc': 'Sort Descending',
  'menuItems.clearSort': 'Clear Sort',
  'menuItems.hideColumn': 'Hide Column',
  'menuItems.freezeColumn': 'Freeze Column',
  'menuItems.unfreezeColumn': 'Unfreeze Column',
  'menuItems.columnVisibility': 'Column Visibility',
  'menuItems.showAllColumns': 'Show all'         // first item of the column-visibility submenu
}
```

Every grid on the page can be translated at once through core's page-wide locale (`@keenmate/web-components-core`
`/locale`): per key the instance `labels` wins, then the page-wide flat dictionary
`window.components.locale.labels['web-grid.<key>']`, then English. Assigning it re-renders every live grid.
`translateCallback` (ICU / i18next / the app's own lookup) gets the full key (`web-grid.labels.pageInfo`), the
resolved template and the params of every label the instance didn't set; `null` / `undefined` = "not mine" (the
default `{name}` replacement).

```javascript
window.components.locale = {
  locale: 'cs-CZ',                       // also the date editor's month / weekday names
  labels: { 'web-grid.messages.noData': 'Žádné položky', 'web-grid.menuItems.deleteRow': 'Smazat řádek' },
  translateCallback: ({ key, params }) => i18next.exists(key) ? i18next.t(key, params) : null,
}
```

One grid can use another locale than the page: its `locale` input (attribute `locale="de"` or `grid.locale = 'de'`)
wins over `window.components.locale.locale` for this grid's label numbers ("1.234 items") and its date editor; unset
(`null`, or `'auto'`) follows the page, else the browser. A change re-renders the texts.

One grid needs no page setup: its own `translateCallback` property (same signature) is asked first for every key its
`labels` didn't set, then the page-wide one; `null` / `undefined` = "not mine" (the page hook decides). Keys the
instance `labels` set never reach either hook. Assigning it re-renders the texts.

```javascript
grid.translateCallback = ({ key, params }) => i18next.exists(key) ? i18next.t(key, params) : null
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
window.components.logging                                     // Page-wide switch for all Keenmate components
window.components['web-grid'].getInstances()                  // Live <web-grid> elements
```

## Browser Support

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+

## About

Authored and maintained by [Keenmate s.r.o.](https://keenmate.com/).
The component ships standalone with sensible light/dark defaults;
when mounted inside [Pure Admin](https://pureadmin.io/) — or any
host that publishes the `--base-*` taxonomy via
[`@keenmate/theme-designer`](https://www.npmjs.com/package/@keenmate/theme-designer) — it adopts the host's colors,
typography, and sizing automatically. There is no runtime
dependency on Pure Admin; the integration is opt-in via CSS
variables.

## Built with BlissFramework

Follows the [BlissFramework component guidelines](https://blissframework.dev/) for structure, theming, color-scheme, and accessibility.

## License

MIT

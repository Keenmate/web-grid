# Usage & API reference

This document covers the public surface of `<web-grid>` — how to mount it, every attribute / property / event / method / column field, and the data shapes.

For a quick mental model: the grid reads its configuration from **properties on the element** (scalar flags also have kebab-case attributes, e.g. `striped`, `page-size`, `filter-mode`). Drop the custom element into your markup, grab a reference, assign `items` and `columns`, and turn on what you need.

## Mounting the component

Importing the package registers `<web-grid>` as a custom element globally. Do it once anywhere in your app:

```javascript
import '@keenmate/web-grid'
```

For vanilla HTML without a bundler:

```html
<script type="module" src="https://unpkg.com/@keenmate/web-grid"></script>
```

Then drop it into your markup and bind data:

```html
<web-grid id="grid" style="max-height: 400px"></web-grid>

<script>
  const grid = document.getElementById('grid')

  grid.items = [
    { id: 1, name: 'Alice', age: 28 },
    { id: 2, name: 'Bob',   age: 34 }
  ]

  grid.columns = [
    { field: 'id',   title: 'ID',   width: '60px' },
    { field: 'name', title: 'Name', width: '160px' },
    { field: 'age',  title: 'Age',  width: '80px', horizontalAlign: 'right' }
  ]
</script>
```

`max-height` (or `height`) on the host controls sizing — see [Height & scroll](#height--scroll).

## Presets

The `preset` property (attribute `preset`; `mode` before v2) sets sensible defaults for common use cases:

| Preset | `isEditingEnabled` | `editTrigger` | `cellSelectionMode` | `dropdownToggleVisibility` | `shouldOpenDropdownOnFocus` |
|------|-------------|--------------|--------------------|--------------------------|-----------------------------|
| `'read-only'` (+ `isReadonly`) | `false` | —             | `'click'` | `'on-focus'` | `false` |
| `'excel'`        | `true`  | `'navigate'`  | `'click'` | `'always'`   | `false` |
| `'input-matrix'` | `true`  | `'always'`    | `'shift'` | `'always'`   | `true`  |

- **`read-only`** — No editing. Click to select cells. Useful for display grids with copy support.
- **`excel`** — Arrow keys to move, type to start editing, Escape to cancel. Click+drag for cell selection.
- **`input-matrix`** — All cells are always in edit mode. Shift+click for cell selection. Tab to navigate between fields.

Setting `preset` applies these defaults; you can override individual properties afterward.

`isReadonly` (attribute `readonly`) — values can't change (no edit / paste / fill / row add-delete-move), the grid stays focusable, selectable and copyable; the `read-only` preset sets it. `isDisabled` (attribute `disabled`) — no interaction at all (the container is `inert`, dimmed).

## Properties

The `QuickGridProps<T>` type defined in `src/types.ts` is the canonical source of truth. The tables below mirror that surface, grouped for readability.

### Core data

| Property | Type | Default | Description |
|---|---|---|---|
| `items` | `T[]` | `[]` | Row data — the only required "content" property. Reading it returns the live rows: after `insertRow` / `removeRows` / `moveRow`, the row built-ins and a committed new row (cell edits stay in drafts — `getDrafts()`). |
| `columns` | `Column<T>[]` | `[]` | Column definitions (see [Column definition](#column-definition)) |
| `idMember` | `keyof T \| string \| null` | `'id'` | Field that uniquely identifies a row — the only row-id member (`getRowId`, `getRowById`, `getRowIndex`, `updateRowById`, `replaceRowById`, row locking; `getIdCallback` wins). Internal state (drafts, invalid-cell markers) is keyed by this value; falls back to `pathMember` or displayed-row index |

### Display

| Property | Type | Default | Description |
|---|---|---|---|
| `isFilteringEnabled` | `boolean` | `false` | Show the filter row (inputs for columns with `isFilterable: true`) and apply `filters` |
| `isStriped` | `boolean` | `false` | Alternate row backgrounds |
| `isHoverable` | `boolean` | `false` | Highlight row on hover |
| `isRowNumbersShown` | `boolean` | `false` | Show leftmost row-number column |
| `isStickyRowNumbers` | `boolean` | `false` | Freeze row-number column during horizontal scroll |
| `isDirtyIndicatorShown` | `boolean` | `true` | Visual indicator on cells with unsaved changes |
| `frozenColumnCount` | `number` | `0` | Freeze first N columns (applied after visual reorder from `isFrozen`) |
| `preset` | `GridPreset` | `'excel'` | `'read-only'`, `'excel'`, or `'input-matrix'` (see [Presets](#presets)) |
| `isReadonly` | `boolean` | `false` | Attribute `readonly` — values can't change; still focusable / selectable / copyable |
| `isDisabled` | `boolean` | `false` | Attribute `disabled` — no interaction |
| `columnMinWidth` | `string` | — | Default min-width applied to every column header that doesn't set its own `minWidth` |
| `focusedRowIndex` | `number \| null` | `null` | Currently focused row index (readable/writable) |
| `class` / `style` | `string` | — | Pass-through host element class and inline style |

### Editing

| Property | Type | Default | Description |
|---|---|---|---|
| `isEditingEnabled` | `boolean` | `false` | Enable cell editing |
| `isRowEditable` | `boolean` | — | Row-level editability gate; combined with grid-level `isEditingEnabled` and column-level `isEditable` (all three must pass) |
| `getIsRowEditableCallback` | `(ctx: { row }) => boolean` | — | Decides row editability per row (wins over `isRowEditable`) |
| `editTrigger` | `EditTrigger` | `'dblclick'` | How editing starts: `'click'`, `'dblclick'`, `'button'` (an edit button in editable cells — on hover and in the focused cell; F2 / Enter too), `'always'`, `'navigate'` |
| `editButtonIcon` | `string` (HTML) | `'✎'` | Content of the edit button (`editTrigger: 'button'` / `column.isEditButtonShown`) — HTML, e.g. `'<span class="lucide-pencil"></span>'`. Attribute `edit-button-icon`. Accessible name: `labels.editCell` |
| `editStartSelection` | `EditStartSelection` | `'select-all'` | Cursor position when entering edit via navigate: `'mouse-position'`, `'select-all'`, `'cursor-at-start'`, `'cursor-at-end'` |
| `shouldCommitOnClickAway` | `boolean` | `true` | Excel-like commit on click-away. `false` discards the in-progress value |
| `dropdownToggleVisibility` | `ToggleVisibility` | `'on-focus'` | When to show dropdown toggle: `'always'`, `'on-focus'` |
| `shouldOpenDropdownOnFocus` | `boolean` | `false` | Auto-open dropdown when cell is focused |
| `shouldOpenDropdownOnEnter` | `boolean` | `false` | Enter opens dropdown (`true`) or moves down (`false`) |
| `isCheckboxAlwaysEditable` | `boolean` | `false` | Checkboxes stay clickable, even in navigate mode |
| `invalidCells` | `CellValidationState[]` | `[]` | External validation state for cells |

### Sorting

| Property | Type | Default | Description |
|---|---|---|---|
| `sort` | `SortState[]` | `[]` | Current sort state (set for initial / server-side sort) |
| `sortMode` | `SortMode` | `'none'` | `'none'` (disabled), `'single'`, `'multiple'` |

### Pagination

| Property | Type | Default | Description |
|---|---|---|---|
| `isPagingEnabled` | `boolean` | `false` | Enable pagination |
| `page-size` | `number` | `10` | Rows per page |
| `pageSizes` | `number[]` | — | Available page sizes for the page-size selector |
| `paginationMode` | `'client' \| 'server'` | `'client'` | Client slices `items`; server treats `items` as the current page |
| `currentPage` | `number` | `1` | Current page (1-based). A filter change resets it to 1 (unless set in the same task — a restored page + filter keep the page); a shorter `items` clamps it |
| `beforePageChangeCallback` | `(ctx: { trigger, fromPage, toPage, drafts }) => boolean \| number \| void \| Promise<…>` | — | Runs before a user action swaps the rows — pager buttons, page-size change, header sort / filter-row change in server mode (`trigger`: `'page'` / `'page-size'` / `'sort'` / `'filter'`). `false` → stay, a number → go to that page instead; async OK (the pager is disabled meanwhile). Programmatic `currentPage` writes and `load-more` skip it |
| `totalItems` | `number \| null` | `null` | Total item count for server-side pagination |
| `isPaginationShown` | `boolean \| 'auto'` | `'auto'` | `'auto'` hides the pager when there is ≤ 1 page |
| `paginationPosition` | `string` | `'bottom-center'` | Position(s): e.g. `'top-right\|bottom-right'` for multiple |
| `getPaginationLabelsCallback` | `(ctx: { currentPage, totalPages, totalItems, pageSize }) => Partial<PaginationLabels>` | — | Customize/translate pagination text |
| `paginationLayout` | `string` | — | Element order: `'pageSize\|previous\|pageInfo\|next'` or `'first\|previous\|pageInfo\|next\|last'` |

### Row toolbar

| Property | Type | Default | Description |
|---|---|---|---|
| `isRowToolbarShown` | `boolean` | `false` | Show row action toolbar |
| `rowToolbar` | `GridToolbarEntry<T>[]` | `['add', 'delete', 'duplicate']` | Built-in names, action items, dividers (see [Action items](#action-items)) |
| `toolbarTrigger` | `'hover' \| 'click' \| 'button'` | `'hover'` | How to show the toolbar |
| `toolbarPosition` | `ToolbarPosition` | `'auto'` | Preferred position: `'auto'`, `'left'`, `'right'`, `'top'`, `'inline'` |
| `toolbarVerticalAlign` | `'top' \| 'center' \| 'bottom'` | `'bottom'` | Vertical alignment for `left` / `right` position |
| `toolbarHorizontalAlign` | `'start' \| 'center' \| 'end' \| 'cursor'` | `'center'` | Horizontal alignment for `top` position |
| `toolbarColumn` | `string \| number` | — | Column to pin toolbar over (field name or index), for `'top'` position |
| `shouldToolbarFollowCursor` | `boolean` | `false` | Toolbar follows mouse cursor horizontally |
| `getCellToolbarItemsCallback` | `(ctx: CellContext<T>) => GridToolbarEntry<T>[] \| null \| undefined` | — | Cell-specific toolbar items, merged over `rowToolbar` by `id` / `action` |
| `cellToolbarOffset` | `number \| string` | `0.2` | Horizontal offset: `0`–`1` as fraction of cell width, or CSS length (e.g. `'2rem'`) |
| `toolbarBtnMinWidth` | `string` | — | Min-width for toolbar buttons; overrides `--wg-toolbar-btn-min-width` |
| `createEmptyRowCallback` | `(ctx) => T \| Promise<T>` | — | The row the `add` built-in inserts (default: a blank row); also the new-empty-row factory |
| `createDuplicateRowCallback` | `(ctx: { row, rowIndex }) => T` | — | The copy the `duplicate` built-in inserts (default: shallow copy with `idMember` cleared) |
| `beforeActionCallback` | `(detail: GridActionEventDetail<T>) => unknown` | — | Runs before any toolbar / menu / shortcut item activates — return `false` to cancel (async OK) |

> **Deprecated aliases:** `toolbarAlign` → `toolbarVerticalAlign`; `toolbarTopPosition` → `toolbarHorizontalAlign`; `toolbarFollowsCursor` → `shouldToolbarFollowCursor`.

#### Action items

Toolbar buttons, context-menu items and shortcuts share one shape (web-components-core action items):

| Field | Description |
|---|---|
| `action` | A built-in name — the item runs the built-in. Omit for a custom item |
| `id` | Identifies a custom item; reported in the `action` event |
| `text` / `getTextCallback(ctx)` | Label. On icon toolbar buttons: the accessible name + tooltip heading (shown only without an `icon` or with `isTextVisible`) |
| `icon` / `getIconCallback(ctx)` | Icon (glyph / markup) |
| `tooltip` / `getTooltipCallback(ctx)` | Tooltip description |
| `shortcut` | Key hint (`'Ctrl+D'`); the binding on `rowShortcuts` / `rangeShortcuts` |
| `isDanger` | Destructive styling |
| `isDisabled` / `getIsDisabledCallback(ctx)` | Greyed out |
| `isVisible` / `getIsVisibleCallback(ctx)` | Default `true` |
| `isToggled` / `getIsToggledCallback(ctx)` | Toggle state (`aria-pressed` on buttons, `menuitemcheckbox` + `aria-checked` in menus, `--toggled`) |
| `cssClass` | Extra classes |
| `onClick(detail)` | Runs on activation with the `action` detail (awaited) |
| `row`, `isTextVisible` | Toolbar only — toolbar row (1 = closest to the grid row); show the text next to the icon |
| `children` / `getChildrenCallback(ctx)`, `shouldCloseOnClick` | Menus only — submenu (static / lazy, sync or async); keep the menu open |

A divider is an entry `{ divider: true, text? }` — or `menuDivider(text)`, exported from the package.

#### Built-in row actions

Usable as a string (`'add'`) or by `action` on an item (`{ action: 'delete', icon: '🗑️', text: 'Remove' }`) in `rowToolbar`, cell toolbars, `contextMenu` and `rowShortcuts`. They **do the work** after the `action` event — don't also add / remove the row in an `action` listener, or it changes twice. Texts come from `labels.actions`.

| `action` | What it does |
|---|---|
| `'add'` | Inserts `createEmptyRowCallback(ctx)`'s row (else a blank row) after the row |
| `'delete'` | Removes the target rows |
| `'duplicate'` | Inserts `createDuplicateRowCallback({ row })`'s copy (else a shallow copy with `idMember` cleared) after each target row |
| `'move-up'` / `'move-down'` | Moves the target rows one displayed position, as a block (disabled when the block is at the edge) |

Targets: the whole row selection when the clicked / focused row is in it, else just that row (range shortcuts: their `rows`) — the same rule as the tree actions. `add` always inserts after the clicked row. The row selection follows its rows afterwards; a row toolbar opened on a selected row keeps the selection.

Veto any of them (e.g. confirm a delete) with `beforeActionCallback` → `false`.

#### Custom row toolbar item

```javascript
grid.rowToolbar = [
  'move-up', 'move-down',
  { divider: true },                            // dividers replace the old `group` numbers
  'add', 'delete',
  {
    id: 'edit',
    icon: '✏️',
    text: 'Edit Record',                        // accessible name + tooltip heading
    tooltip: 'Open the editor',                 // tooltip description
    shortcut: 'Enter',                          // tooltip key hint
    isTextVisible: true,                        // show the text next to the icon
    row: 1,                                     // row in a multi-row toolbar (1 = closest to the grid row)
    isDanger: false,
    getIsDisabledCallback: ({ row }) => row.locked,   // or isDisabled: boolean
    getIsVisibleCallback: ({ row }) => !row.archived, // or isVisible: boolean
    getIsToggledCallback: ({ row }) => row.flagged,   // toggle state (aria-pressed)
    onClick: ({ row, rowIndex }) => openEditor(row)
  }
]
```

### Context menu

| Property | Type | Default | Description |
|---|---|---|---|
| `contextMenu` | `GridMenuEntry<T>[]` | — | Cell / row context menu: built-in names, menu items, dividers |
| `contextMenuXOffset` | `number` | `8` | Horizontal offset from click position |
| `contextMenuYOffset` | `number` | `0` | Vertical offset from click position |
| `headerContextMenu` | `GridHeaderMenuEntry<T>[]` | — | Header context menu: built-in names, menu items, dividers |
| `beforeContextMenuOpenCallback` | `(ctx: CellContext<T>) => false \| GridMenuEntry<T>[] \| void` | — | Runs (sync) before the cell menu opens: `false` → no grid menu (the browser's shows); an entries array → shown instead of `contextMenu` |
| `beforeHeaderMenuOpenCallback` | `(ctx: HeaderMenuContext<T>) => false \| GridHeaderMenuEntry<T>[] \| void` | — | Same for the header menu |

#### Built-in header menu items

| `action` | What it does |
|---|---|
| `'sort-asc'`, `'sort-desc'`, `'clear-sort'` | Sort controls (also fire `data-request`) |
| `'hide-column'` | Hide the right-clicked column |
| `'freeze-column'`, `'unfreeze-column'` | Freeze / unfreeze this column |
| `'column-visibility'` | Submenu with a toggle per column (toggles report `action: 'toggle-column'` with `id` = the field, and `'show-all-columns'`) |

#### Built-in cell menu items

| `action` | What it does |
|---|---|
| `'add'`, `'delete'`, `'duplicate'`, `'move-up'`, `'move-down'` | The row built-ins (above) |
| `'expand'` / `'collapse'` | Expand (one level) / collapse the row — the whole row selection when the row is in it |
| `'expand-subtree'` / `'collapse-subtree'` | The row (or selection) and everything under it |
| `'expand-all'` / `'collapse-all'` | The whole tree |

#### Menu item shape

```javascript
grid.contextMenu = [
  {
    id: 'view',
    text: 'View Details',                        // or getTextCallback: (ctx) => `View ${ctx.row.name}`
    icon: '👁️',                                  // or getIconCallback: (ctx) => ctx.row.active ? '🟢' : '🔴'
    shortcut: 'Enter',                           // display-only hint
    getIsVisibleCallback: (ctx) => true,         // or isVisible: boolean
    getIsDisabledCallback: (ctx) => ctx.row.locked, // or isDisabled: boolean
    isDanger: false,
    onClick: (detail) => { /* { row, rowIndex, column, colIndex, field, value, action, id, source, … } */ }
  },
  { divider: true, text: 'Rows' },               // a (labelled) divider — replaces dividerBefore
  'duplicate',
  {
    id: 'more',
    text: 'More',
    getChildrenCallback: async (ctx) => [        // lazy submenu (sync or async; a loading row shows meanwhile)
      { id: 'archive', text: 'Archive', onClick: ({ row }) => archive(row) }
    ]
  },
  { id: 'pin', text: 'Keep open', shouldCloseOnClick: false }
]
```

Cell menu items get the cell ctx `{ row, rowIndex, column, colIndex, field, value }`; header items get `HeaderMenuContext` `{ column, field, colIndex, sortDirection, isFrozen, isTreeMode, allColumns, labels }` (`column` is `null` and `colIndex` `-1` on the filler right of the last column). Both menus support `children` (static) or `getChildrenCallback(ctx)` (dynamic) submenus; every child activates like a top-level item.

#### Menu keyboard, markup and theming

Both menus are the shared KeenMate menu (core `openMenu()`, `@keenmate/web-components-core/menu`) in the grid's shadow root.

- **Keyboard:** Shift+F10 / the ContextMenu key on the focused cell opens the cell menu below it, first item focused. ↑ / ↓ skip disabled items, Home / End, → / Enter / Space open a submenu, ← / Escape close it, Enter / Space activate, Escape closes and returns focus to the cell, Tab closes; an item's `shortcut` letter activates it.
- **Dismiss:** outside press, page or grid scroll, window blur, another KeenMate overlay opening.
- **Markup:** `.km-menu` (`.km-menu--submenu`), `.km-menu__item` (`--disabled` / `--danger` / `--toggled` / `--has-submenu`), `__icon`, `__label`, `__shortcut`, `__divider`. Cell menu levels also carry `wg-context-menu`, header menu levels `wg-header-menu`. A toggle item (`isToggled` / `getIsToggledCallback`; the column-visibility toggles, class `wg-header-menu__column-toggle`) is `role="menuitemcheckbox"` + `aria-checked`.
- **Theming:** one public set `--wg-context-menu-*` on `web-grid` themes both menus — `bg`, `bg-hover`, `hover-color`, `text-color`, `border`, `border-radius`, `shadow`, `min-width`, `padding`, `font-size`, `item-padding`, `item-gap`, `toggled-color`, `icon-width`, `icon-font-size`, `arrow-font-size`, `shortcut-color`, `danger-color`, `danger-bg-hover`, `divider-color`, `divider-margin`, `disabled-opacity`, `z-index`. All unset by default: a value resolves `--wg-context-menu-*` (this grid) → `--km-menu-*` (page-wide, on `:root`) → `--base-*` → core default.

### Cell selection

| Property | Type | Default | Description |
|---|---|---|---|
| `cellSelectionMode` | `CellSelectionMode` | `'click'` | `'disabled'`, `'click'` (drag; Shift+click extends from the focused cell), `'shift'` (Shift+click twice). Except `'disabled'`: Shift+Arrow / Shift+Home/End / Ctrl+Shift+Arrow grow the range from the focused cell |
| `shouldCopyWithHeaders` | `boolean` | `false` | Include column headers when copying cell selection to clipboard |

### Keyboard shortcuts

| Property | Type | Default | Description |
|---|---|---|---|
| `rowShortcuts` | `GridShortcut<T>[]` | — | Action items bound to a key on the focused / hovered row (see [Keyboard shortcuts](#keyboard-shortcuts-1)) |
| `rangeShortcuts` | `GridRangeShortcut<T>[]` | — | Action items bound to a key on the selected rows / cell range |
| `isShortcutsHelpShown` | `boolean` | `false` | Show keyboard-shortcuts help icon |
| `shortcutsHelpPosition` | `'top-right' \| 'top-left'` | `'top-right'` | Help icon position |
| `renderShortcutsHelpCallback` | `(ctx) => string` | — | Custom HTML alongside the shortcuts list |

### Column management & persistence

| Property | Type | Default | Description |
|---|---|---|---|
| `gridName` | `string \| null` | `null` | Unique name for localStorage persistence |
| `shouldPersistColumnWidths` | `boolean` | `false` | Persist column widths (requires `gridName`) |
| `isColumnReorderAllowed` | `boolean` | `false` | Enable drag-to-reorder columns |
| `shouldPersistColumnOrder` | `boolean` | `false` | Persist column order (requires `gridName`) |

### Fill handle

| Property | Type | Default | Description |
|---|---|---|---|
| `fillDirection` (`fill-direction`) | `'vertical' \| 'all'` | `'vertical'` | Grid-wide fill-handle direction: `'vertical'` fills the source column only, `'all'` also across columns. A column's own `fillDirection` wins |
| `beforeFillCallback` | `(ctx: { sourceCell, targetCells, direction }) => boolean \| void \| Promise<…>` | — | Runs before a fill-handle drag applies. Return `false` to cancel (async OK) |

### Row locking

| Property | Type | Default | Description |
|---|---|---|---|
| `rowLocking` | `RowLockingOptions<T>` | — | Row locking configuration (see below) |

`RowLockingOptions`:

| Field | Type | Description |
|---|---|---|
| `isLockedMember` | `keyof T` | Property with boolean lock state |
| `lockInfoMember` | `keyof T` | Property with `RowLock` info object |
| `getIsLockedCallback` | `(ctx: { row, rowIndex }) => boolean` | Callback-based lock check |
| `getLockInfoCallback` | `(ctx: { row, rowIndex }) => RowLock \| null` | Callback-based lock info |
| `lockedEditBehavior` | `'block' \| 'allow' \| 'callback'` | Edit behavior for locked rows (default: `'block'`) |
| `getCanEditLockedCallback` | `(ctx: { row, rowIndex, lockInfo }) => boolean` | Per-row edit decision (when `'callback'`) |

### Tree / hierarchy

Path-string driven (ltree-style: `"1.2.3"`, `"/dept/eng/team"`, `"C:\\a\\b"`).

| Property | Type | Default | Description |
|---|---|---|---|
| `pathMember` | `keyof T \| string` | — | **Required** to enable tree mode; field holding the path |
| `levelMember` | `keyof T \| string` | — | Pre-computed depth (0-based) |
| `parentPathMember` | `keyof T \| string` | — | Pre-computed parent path |
| `treePathSeparator` | `string` | auto | Auto-detected from first row when omitted |
| `isTreeDataSorted` | `boolean` | `false` | `true` = grid never re-sorts (pair with the `data-request` event); `false` = grid sorts siblings depth-first |
| `expandedPaths` | `string[]` | — | The expanded paths: reading returns a copy, assigning replaces the state (no events); `null` → the `expandLevel` default |
| `expandLevel` | `number` | all | `0` = roots only; `1` = roots + children; etc. |
| `treeDoubleClickBehavior` | `TreeDoubleClickBehavior` | `'none'` | Action when double-clicking a tree-column cell |
| `treeExpandedGlyph` / `treeCollapsedGlyph` | `string` | `'▶'` | Static glyphs. When equal, CSS rotates 90°; when different, glyph swaps |
| `renderChevronCallback` | `(ctx: { row, isExpanded, hasChildren, level, path }) => string` | — | Per-row chevron HTML; cached per `(row, expanded)` |

Methods: `toggleRowExpanded(path, options?)`, `expandRows(paths, options?)` / `collapseRows(paths, options?)` (one level; collapsed ancestors open too), `expandAll(paths?, options?)` / `collapseAll(paths?, options?)` (`null` = whole tree, else those rows and everything under them), `isPathExpanded(path)`. `paths` is a `string | string[]`; `options` is `ExpandOptions { isExclusive?, isSilent? }` (`isExclusive`: expanding collapses every other branch; `isSilent`: no events). A single-row expand / collapse fires `row-expand` / `row-collapse` `{ row, path }`; every change fires `expanded-change` `{ paths }` (the whole set). Cell-menu built-ins: `expand` / `collapse` (one level), `expand-subtree` / `collapse-subtree` (the row + everything under it), `expand-all` / `collapse-all` (whole tree); the per-row ones act on the selection when the clicked row is in it.

### Height & scroll

| Property | Type | Default | Description |
|---|---|---|---|
| `isScrollable` | `boolean` | `false` | Enable scroll container with max-height |
| `scrollMaxHeight` | `string` | `'100vh'` | Max-height when `isScrollable` is `true` |
| `isTableBorderOnly` | `boolean` | `false` | Border only around the table (not pagination/toolbar) |

The grid's shadow DOM uses `max-height: inherit`, so setting `max-height` on the host controls its internal scroll container:

```html
<!-- Capped at 400px, scrolls internally -->
<web-grid style="max-height: 400px"></web-grid>

<!-- Full height: page handles scrolling, grid does not capture the wheel -->
<web-grid style="height: 100%"></web-grid>
```

For full-height mode, also set `isTableBorderOnly = true`.

### Virtual scroll

| Property | Type | Default | Description |
|---|---|---|---|
| `isVirtualScrollEnabled` | `boolean` | `false` | Enable virtual scroll |
| `virtualScrollThreshold` | `number` | `100` | Auto-enable when `items.length >= threshold` |
| `virtualScrollItemHeight` | `number` | `38` | Fixed row height in pixels |
| `virtualScrollOverscan` | `number` | `10` | Extra rows rendered above/below the viewport |

### Infinite scroll

| Property | Type | Default | Description |
|---|---|---|---|
| `isInfiniteScrollEnabled` | `boolean` | `false` | Enable infinite scroll |
| `infiniteScrollThreshold` | `number` | `100` | Distance from bottom (px) to trigger load |
| `hasMoreItems` | `boolean` | `true` | Set to `false` when no more data |

### Tooltip

| Property | Type | Default | Description |
|---|---|---|---|
| `tooltipShowDelay` | `number` | `200` | Delay (ms) before showing |
| `tooltipHideDelay` | `number` | `100` | Delay (ms) before hiding |

### Summary

| Property | Type | Default | Description |
|---|---|---|---|
| `summaryPosition` | `string` | — | E.g. `'bottom-left'`, `'top-right\|bottom-right'` |
| `renderSummaryCallback` | `(ctx: { items, allItems, totalItems, currentPage, pageSize, metadata, drafts }) => string` | — | Returns HTML content for the summary bar |
| `isSummaryInline` | `boolean` | `true` | Share row with pagination in same area |
| `summaryMetadata` | `unknown` | — | Server-provided metadata passed to `renderSummaryCallback` as `ctx.metadata` |

### Filtering

| Property | Type | Default | Description |
|---|---|---|---|
| `filters` | `Record<string, string>` | `{}` | Current filter value per field |
| `filterMode` | `'client' \| 'server'` | `'client'` | `'server'` (attribute `filter-mode`): the grid doesn't filter `items` — listen to `filter-change` (`{ filters }`) and load the rows |

**Filter row.** With `isFilteringEnabled`, a row under the header gets a text input for every column with `isFilterable: true` (labelled "Filter &lt;column&gt;" via `labels.filterColumn`; Tab-reachable). Typing is debounced (300 ms; Enter applies at once, Escape clears) → `setFilter(field, text)` → page 1. A `filterCallback` returning `null` marks the input `.invalid` (red border, `aria-invalid`) and ignores that filter. In server pagination a filter change runs `beforePageChangeCallback` (trigger `'filter'`) and fires `data-request` (trigger `'filter'`). Styled by the `--wg-filter-*` variables. A filter change (UI or `setFilter` / `filters`) resets `currentPage` to 1.

### Styling

| Property | Type | Default | Description |
|---|---|---|---|
| `getCustomStylesCallback` | `(ctx) => string` | — | CSS string injected into shadow DOM |
| `getRowClassCallback` | `(ctx: { row, rowIndex }) => string \| null` | — | Dynamic CSS class for rows |
| `labels` | `GridLabelsInput` (partial `GridLabels`, nested groups too) | — | Override UI labels for i18n (see [Labels / i18n](#labels--i18n)) |
| `getValidationTooltipCallback` | `(ctx: CellContext<T> & { error }) => string \| null` | — | Custom HTML for the validation error tooltip (grid-level default) |
| `invalidCells` | `CellValidationState[]` | `[]` | External validation state for cells |

### Experimental: new empty row

Inline data entry — API may change.

| Property | Type | Default | Description |
|---|---|---|---|
| `isNewRowEnabled` | `boolean` | `false` | Always-visible empty row for data entry |
| `newRowPosition` | `NewRowPosition` | `'bottom'` | `'top'` or `'bottom'` |
| `newRowIndicator` | `string` | `'+'` | Indicator shown in row-number column |
| `createEmptyRowCallback` | `(ctx) => T \| Promise<T>` | — | Factory function (can be async); also the row the `add` built-in inserts |

## Column definition

The `Column<T>` interface defines how each column renders, edits, and behaves.

### Basic

| Field | Type | Description |
|---|---|---|
| `field` | `keyof T \| string` | Data field name (**required**) |
| `title` | `string` | Column header title |
| `headerInfo` | `string` | Info tooltip shown next to header (ⓘ icon) |
| `width` | `string` | Column width (e.g. `'100px'`, `'20%'`) |
| `minWidth` / `maxWidth` | `string` | Resize bounds |

### Display

| Field | Type | Description |
|---|---|---|
| `horizontalAlign` | `'left' \| 'center' \| 'right' \| 'justify'` | Cell horizontal alignment |
| `verticalAlign` | `'top' \| 'middle' \| 'bottom'` | Cell vertical alignment |
| `headerHorizontalAlign` / `headerVerticalAlign` | same as above | Defaults to the cell alignment |
| `textOverflow` | `'wrap' \| 'ellipsis'` | Text overflow behavior |
| `maxLines` | `number` | Max visible lines when `textOverflow` is `'wrap'` (CSS line-clamp) |
| `cellClass` | `string` | Static CSS class applied to all cells in this column |
| `getCellClassCallback` | `(ctx: CellContext<T>) => string \| null` | Dynamic class based on value / row |

Every column callback takes one `ctx`; the cell ctx (`CellContext<T>`) is `{ row, rowIndex, column, colIndex, field, value }` (+ non-enumerable `controller`, `element`).

### Content

| Field | Type | Description |
|---|---|---|
| `getDisplayValueCallback` | `(ctx: CellContext<T>) => string` | Display text for the cell (escaped) |
| `renderCellCallback` | `(ctx: CellContext<T>) => string` | Custom cell HTML (wins over `getDisplayValueCallback`) |
| `filterCallback` | `(ctx: { filterValue, row, column, field }) => boolean \| null` | Custom filter predicate; `null` = incomplete input (ignored, input marked invalid) |

### Editing

| Field | Type | Description |
|---|---|---|
| `isEditable` | `boolean` | Enable editing for this column |
| `getIsEditableCallback` | `(ctx: { row }) => boolean` | Per-row editability for this column (when `true`, editable even on a read-only grid) |
| `editor` | `Editor` | `'text'`, `'number'`, `'checkbox'`, `'select'`, `'combobox'`, `'autocomplete'`, `'date'`, `'custom'` |
| `editTrigger` | `EditTrigger` | Per-column override |
| `editorOptions` | `EditorOptions<T>` | Editor-specific configuration (see [Editor options](#editor-options)) |
| `dropdownToggleVisibility` | `ToggleVisibility` | Per-column override |
| `shouldOpenDropdownOnEnter` | `boolean` | Per-column override |
| `renderEditorCallback` | `(ctx: EditorContext<T>) => void` | Handler for `editor: 'custom'` — the cell ctx + `commit(value)` / `cancel()` |
| `isEditButtonShown` | `boolean` | Show the edit button in this column's editable cells whatever the `editTrigger` |

### Validation

| Field | Type | Description |
|---|---|---|
| `validateCallback` | `(ctx: ValidateContext<T>) => ValidateResult \| Promise<ValidateResult>` | Validates / transforms a value — editor commits and pasted cells |
| `getValidationTooltipCallback` | `(ctx: CellContext<T> & { error }) => string \| null` | Custom HTML for this column's validation error tooltip |

`validateCallback` receives `{ value, oldValue, row, rowIndex, column, colIndex, field, source: 'edit' | 'paste' }` and returns one of:

- `{ valid: true }` or `{ valid: true, transformedValue: … }` — accept (optionally transform)
- `{ valid: false, message: 'Error text' }` — reject with message
- `true` / `null` / `undefined` — accept
- `false` — reject (no message)
- `string` — reject with that string as message

Not a veto: an invalid value is kept as a draft, the cell is marked invalid and `validation-error` fires.

### Tooltip

| Field | Type | Description |
|---|---|---|
| `tooltipMember` | `string` | Property name in row data containing tooltip text |
| `getTooltipCallback` | `(ctx: CellContext<T>) => string \| null` | Dynamic tooltip (takes priority over `tooltipMember`) |
| `isTooltipHtml` | `boolean` | Render the tooltip as HTML |

### Clipboard

| Field | Type | Description |
|---|---|---|
| `getCopyValueCallback` | `(ctx: CellContext<T>) => string` | Text copied for this cell |
| `getPasteValueCallback` | `(ctx: CellContext<T> & { text }) => unknown` | Value stored for the pasted text |

### Layout

| Field | Type | Description |
|---|---|---|
| `isFrozen` | `boolean` | Column sticks to the left during horizontal scroll |
| `isResizable` | `boolean` | Allow column-width drag (default: `true`) |
| `isReorderable` | `boolean` | Allow drag-reorder (default: `true`) |
| `isHidden` | `boolean` | Not rendered but kept in array for visibility toggling |
| `isSortable` | `boolean` | Enable sorting for this column (when grid has `sortMode`) |
| `isFilterable` | `boolean` | This column gets a filter-row input (opt-in) |
| `isTree` | `boolean` | Mark this column as the tree column (renders chevron + indent) |

### Fill

| Field | Type | Description |
|---|---|---|
| `fillDirection` | `FillDirection` | Override the grid-level `fillDirection` (`fill-direction`): `'vertical'` or `'all'` |

## Editor options

Per-editor configuration, set via `editorOptions` on the column.

### Text

| Option | Type | Default | Description |
|---|---|---|---|
| `maxLength` | `number` | — | Maximum character count |
| `placeholder` | `string` | — | Placeholder text |
| `pattern` | `string` | — | `input` pattern attribute |
| `inputMode` | `'text' \| 'numeric' \| 'email' \| 'tel' \| 'url'` | — | Virtual-keyboard hint |
| `editStartSelection` | `EditStartSelection` | `'select-all'` | Cursor position when entering edit |

### Number

| Option | Type | Default | Description |
|---|---|---|---|
| `min` / `max` / `step` | `number` | — | Standard numeric bounds |
| `decimalPlaces` | `number` | — | Round the value to this many decimals |
| `allowNegative` | `boolean` | — | `false` → a negative value is invalid |

The typed text is parsed strictly (`Number()` + `isFinite`, trimmed; blank → `null`): `abc` or `12abc` mark the cell invalid (`labels.invalidNumber`, "Not a number"), as do values outside `min` / `max` or a negative with `allowNegative: false` — **no clamping**; the draft keeps what was typed and `validation-error` fires. `decimalPlaces` rounds (`1.239` → `1.24`). Pasted text goes through the same parse.

### Checkbox

| Option | Type | Default | Description |
|---|---|---|---|
| `trueValue` / `falseValue` | `unknown` | `true` / `false` | Value to store when (un)checked |

### Date

| Option | Type | Default | Description |
|---|---|---|---|
| `minDate` / `maxDate` | `Date \| string` | — | Selection bounds |
| `dateFormat` | `string` | — | Display format: `'YYYY-MM-DD'`, `'DD.MM.YYYY'`, etc. |
| `outputFormat` | `DateOutputFormat` | — | What to store: `'date'` (Date object), `'iso'` (ISO string), `'timestamp'` (number) |

### Shared dropdown options

Used by `select`, `combobox`, and `autocomplete`.

**Providing options:**

| Option | Type | Description |
|---|---|---|
| `options` | `EditorOption[]` | Static array: `{ value, label, …extra }` |

**Display mapping** — by default, options use `value` and `label`. Override with member strings or callbacks (each takes `({ option })`):

| Member property | Callback alternative | Description |
|---|---|---|
| `valueMember` | `getValueCallback` | Option value |
| `displayMember` | `getDisplayValueCallback` | Display text |
| `searchMember` | `getSearchValueCallback` | Searchable text (falls back to display) |
| `iconMember` | `getIconCallback` | Icon / emoji |
| `subtitleMember` | `getSubtitleCallback` | Subtitle / description |
| `disabledMember` | `getIsDisabledCallback` | Disabled state |
| `groupMember` | `getGroupCallback` | Grouping |

**Rendering & behavior:**

| Option | Type | Description |
|---|---|---|
| `renderOptionCallback` | `(ctx: { option, optionIndex, isFocused, isSelected, isDisabled }) => string` | Custom HTML per option |
| `onSelect` | `(ctx: { option, row, rowIndex, column, field, … }) => void` | Notification when an option is selected |
| `isEmptyAllowed` | `boolean` | An empty first item (`labels.dropdownEmptyOption`, "—") that sets the value to `null` (default `false`) |
| `labels` | `{ dropdownNoData?, dropdownNoResults?, dropdownSearching?, dropdownEmptyOption? }` | This column's dropdown texts, per key over the grid `labels` |
| `dropdownMinWidth` | `string` | Minimum dropdown width (e.g. `'300px'`) |
| `placeholder` | `string` | Combobox / autocomplete placeholder |

### Autocomplete-specific

| Option | Type | Default | Description |
|---|---|---|---|
| `searchCallback` | `(ctx: { term, row, rowIndex, column, field, signal }) => Promise<EditorOption[]>` | — | Async search; `signal` aborts when a newer search starts |
| `initialOptions` | `EditorOption[]` | — | Options shown before user types |
| `minSearchLength` | `number` | `1` | Minimum characters before triggering search |
| `debounceMs` | `number` | `300` | Debounce delay for search calls |
| `multiple` | `boolean` | `false` | Allow multiple selections |
| `maxSelections` | `number` | — | Cap when `multiple: true` |

### Custom editor

Set `editor: 'custom'` and provide `renderEditorCallback`:

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

## Callbacks, events and the controller

The grid follows the shared KeenMate interaction model (`@keenmate/web-components-core`):

- **`*Callback` properties** return a value that affects behavior (`get*Callback`, `render*Callback`, `create*Callback`; a `before*Callback` returning `false` cancels). **Every callback takes one `ctx` object.**
- **Events** are real DOM events (bubble, not composed), each with a camelCase `on*` property twin that is called with the same detail first.
- Every ctx and every event detail carries `controller` (the public `GridController`, also `el.controller`) and `element` (the `<web-grid>` host) — both non-enumerable, so `JSON.stringify` / logs see only the data.

```javascript
grid.addEventListener('row-change', (e) => save(e.detail.draftRow))
grid.onFocusChange = ({ row }) => showDetails(row)          // property twin
grid.getRowClassCallback = ({ row, controller }) =>
  controller.isRowDirty(row) ? 'is-dirty' : null
```

### Grid-level callbacks

| Callback | ctx | Returns |
|---|---|---|
| `getRowClassCallback` | `{ row, rowIndex }` | CSS class for the row, or `null` |
| `getCustomStylesCallback` | `{}` | CSS injected into the shadow DOM |
| `getPaginationLabelsCallback` | `{ currentPage, totalPages, totalItems, pageSize }` | `Partial<PaginationLabels>` |
| `renderSummaryCallback` | `{ items, allItems, totalItems, currentPage, pageSize, metadata, drafts }` | Summary HTML |
| `renderShortcutsHelpCallback` | `{}` | HTML shown with the shortcuts list |
| `getValidationTooltipCallback` | cell ctx + `error` | Validation tooltip HTML (column-level wins) |
| `getIsRowEditableCallback` | `{ row }` | `boolean` — per-row editability |
| `getIdCallback` | `{ row }` | The row's id (wins over `idMember`) |
| `renderChevronCallback` | `{ row, isExpanded, hasChildren, level, path }` | Chevron HTML (tree) |
| `createEmptyRowCallback` | `{}` | New row (`add` built-in, new-row entry); may be async |
| `createDuplicateRowCallback` | `{ row, rowIndex }` | The copy the `duplicate` built-in inserts |
| `createRowCallback` | `{ data, rowIndex }` | Row for pasted data past the last row |
| `beforeActionCallback` | the `action` detail | `false` cancels the item (async OK) |
| `beforeContextMenuOpenCallback` / `beforeHeaderMenuOpenCallback` | cell ctx / `HeaderMenuContext` | `false` → no grid menu; an entries array → shown instead (sync) |
| `beforeFillCallback` | `{ sourceCell, targetCells, direction }` | `false` cancels the fill (async OK) |
| `beforePageChangeCallback` | `{ trigger, fromPage, toPage, drafts }` | `false` stays, a number goes to that page instead (async OK) |
| `beforePasteCallback` | `{ rawText, parsedRows, hasHeaders, headerMapping, targetRowIndex, targetColIndex, newRowsCount, skipCells }` | `false` cancels the paste (async OK); add `"rowIndex-colIndex"` keys to `skipCells` to skip cells |

### Events

| Event | Twin | Fires when / detail |
|---|---|---|
| `row-change` | `onRowChange` | A cell value was committed (editor, checkbox, paste, new row). `{ row, draftRow, rowIndex, field, oldValue, newValue, isValid, validationError }` |
| `cell-edit-start` | `onCellEditStart` | A cell editor opened. `{ row, rowIndex, field }` |
| `cell-edit-cancel` | `onCellEditCancel` | A cell edit was cancelled. `{ row, rowIndex, field }` |
| `validation-error` | `onValidationError` | `validateCallback` rejected a value. `{ row, rowIndex, field, error, source: 'edit' \| 'paste' }` |
| `focus-change` | `onFocusChange` | The focused row changed. `{ row, rowIndex, oldRowIndex }` |
| `row-delete` | `onRowDelete` | The `delete` built-in removed rows (menu / toolbar / Ctrl+Delete) — after the fact; veto with `beforeActionCallback`. `{ rows, rowIndices }` |
| `cell-selection-change` | `onCellSelectionChange` | The selected cell range changed. `{ range, cellCount, fields, rows }` — `range.startColIndex` / `endColIndex` are on-screen (visual) positions, not `columns` indices; `fields` = the range's columns in on-screen order; `rows` = the row objects in the range. Cleared: `{ range: null, cellCount: 0, fields: [], rows: [] }` |
| `row-selection-change` | `onRowSelectionChange` | The row selection changed (row numbers, `selectRow` / `selectRowRange` / `clearSelection`, or cleared by another selection). `{ rows, rowIndices }` |
| `column-selection-change` | `onColumnSelectionChange` | The column selection changed (headers, `controller.selectColumn` / `selectColumnRange` / `clearColumnSelection`, or cleared by another selection). `{ fields }` (on-screen order) |
| `data-request` | `onDataRequest` | Sort / page / page size changed or more rows are needed (server-side data, incl. header-menu sorts). `{ sort, page, pageSize, trigger, mode, skip }` |
| `filter-change` | `onFilterChange` | A column filter changed. `{ filters }`. With `filterMode: 'server'` (attribute `filter-mode`) the grid doesn't filter — replace `items` yourself |
| `column-resize` | `onColumnResize` | A column was resized. `{ field, oldWidth, newWidth, allWidths }` |
| `column-reorder` | `onColumnReorder` | A column was moved. `{ field, fromIndex, toIndex, allOrder }` |
| `row-expand` / `row-collapse` | `onRowExpand` / `onRowCollapse` | One tree row expanded / collapsed (not `expandAll` / `collapseAll`). `{ row, path }` |
| `expanded-change` | `onExpandedChange` | The expanded set changed (every change). `{ paths }` |
| `row-lock-change` | `onRowLockChange` | A row was locked / unlocked by id. `{ rowId, row, rowIndex, lockInfo, source }` |
| `cell-paste` | `onCellPaste` | A multi-cell paste finished. `{ totalCells, successfulCells, failedCells, skippedCells, newRowsCreated, cellResults, hadHeaders }` |
| `action` | `onAction` | A toolbar / menu / shortcut item was activated (see below) |

### The `action` event

Every row-toolbar, inline, cell-toolbar, context-menu, header-menu and shortcut item fires `action` (and `onAction`). Order: `beforeActionCallback` (`false` cancels) → the item's `onClick(detail)` → the built-in (if `action` names one) → `action` event. The event is a notification after the fact: a listener sees `items` after the built-in (row added / removed / moved).

| Detail field | Description |
|---|---|
| `action` | The built-in name (`'add'`, `'move-up'`, `'sort-asc'`, …) or `'custom'` |
| `id` | The item's `id` (custom items; `toggle-column` uses the field) |
| `item` | The item object |
| `source` | `'row-toolbar'`, `'cell-toolbar'`, `'context-menu'`, `'header-menu'` or `'keyboard'` |
| `sourceEvent` / `triggerElement` | The DOM event and the clicked element (when any) |
| `dataset` | The trigger element's `data-*` attributes |
| `row`, `rowIndex` (+ `column`, `colIndex`, `field`, `value`) | Row / cell surfaces |
| `HeaderMenuContext` fields | Header menu |
| `rows`, `rowIndices` (+ `cellRange`, `cells`) | Range shortcuts |

```javascript
grid.onAction = ({ action, id, row }) => {
  if (action === 'delete') toast(`Deleted ${row.name}`)   // the built-in already removed it
  else if (id === 'archive') archive(row)                 // a custom item
}
```

### `el.controller`

`el.controller` (also `ctx.controller` / `detail.controller`) is the public `GridController` facade:

| Area | Methods |
|---|---|
| State (read-only, same names as the element) | `items`, `displayItems`, `columns`, `sort`, `filters`, `invalidCells`, `selectedRows`, `selectedRowIndices`, `selectedCellRange`, `expandedPaths`; `setFilter(field, value)` |
| Rows | `insertRow(row, afterRow?)`, `insertRows(rows, afterRow?)`, `removeRow(row)`, `removeRows(rows)`, `duplicateRow(row)`, `moveRow(row, -1 \| 1)`, `getRowId(row)`, `getRowById(id)`, `getRowIndex(row)`, `updateRowById(id, data)`, `replaceRowById(id, row)` |
| Drafts / validation | `getRowDraft`, `hasRowDraft`, `getDraftRowIndices`, `getDrafts`, `discardDraft`, `discardAllDrafts`, `isCellDirty`, `isRowDirty`, `isCellInvalid`, `getCellValidationError`, `canEditCell` |
| Row locking | `isRowLocked`, `getRowLockInfo`, `lockRowById`, `unlockRowById`, `getExternalLocks`, `clearExternalLocks` |
| Selection | `selectRow`, `selectRowRange`, `clearSelection` (all kinds), `clearRowSelection`, `isRowSelected`, `copySelectedRowsToClipboard`, `selectCellRange`, `clearCellSelection`, `getSelectedCells`, `copyCellSelectionToClipboard`, `selectColumn`, `selectColumnRange`, `clearColumnSelection`, `getSelectedColumns`, `isColumnSelected`, `select-all` |

Every selection output lists entries in **on-screen order** and identifies a column by its index in `columns` (`colIndex`) + `field`: `getSelectedCells()` → `CellContext[]`, `getSelectedColumns()` → `[{ colIndex, field, column }]`. Column selection inputs (`selectColumn(colIndex)`, `selectColumnRange`, `isColumnSelected`) take the index in `columns`.
| Tree | `isPathExpanded`, `toggleRowExpanded`, `expandRows`, `collapseRows`, `expandAll(paths?, options?)`, `collapseAll(paths?, options?)`, `getRowTreeInfo` |
| Columns | `setColumnWidth`, `setColumnWidths`, `getColumnWidthsState`, `setColumnOrder`, `getColumnOrderState` |
| Focus / editing | `focusCell`, `startEditing`, `scrollToRow(rowIndex)` → `Promise<boolean>` |
| Menus | `closeContextMenu`, `closeToolbar` |

## Keyboard shortcuts

`rowShortcuts` and `rangeShortcuts` are action items bound to a key (`shortcut`):

```javascript
grid.rowShortcuts = [
  { shortcut: 'Ctrl+D', action: 'duplicate' },               // a row built-in
  { shortcut: 'F2', id: 'details', text: 'Details', onClick: ({ row }) => openDetails(row) },
  { shortcut: 'Ctrl+L', id: 'lock', text: 'Lock', getIsDisabledCallback: ({ row }) => row.locked }
]
grid.rangeShortcuts = [
  { shortcut: 'Ctrl+E', id: 'export', text: 'Export selection', onClick: ({ rows }) => exportRows(rows) }
]
```

Row shortcuts run on the focused / hovered row with the cell ctx; range shortcuts on the selected rows / cell range with `{ rows, rowIndices, cellRange?, cells? }` (custom items only). Both fire `action` with `source: 'keyboard'`. A toolbar item with the same `id` shows the shortcut in its tooltip.

## Paste API

| Property | Type | Description |
|---|---|---|
| `pasteMode` | `'skip-non-editable' \| 'all-columns' \| 'editable-only'` | How non-editable columns are handled |
| `shouldValidateOnPaste` | `boolean` | Run `validateCallback` (with `source: 'paste'`) on each pasted cell |
| `beforePasteCallback` | `(ctx) => boolean \| void \| Promise<…>` | Return `false` to cancel; add `"rowIndex-colIndex"` keys to `ctx.skipCells` to skip cells |
| `createRowCallback` | `(ctx: { data, rowIndex }) => T` | Builds a row for pasted data past the last row |

After a paste, the `cell-paste` event (`onCellPaste`) reports `{ totalCells, successfulCells, failedCells, skippedCells, newRowsCreated, cellResults, hadHeaders }`. Per-cell conversion is the column's `getPasteValueCallback({ …cell, text })`; without it, number / checkbox / date columns type the text (number: strict parse; checkbox: `true/1/yes/x/✓` or the `trueValue` text → `trueValue`, `false/0/no/''` or the `falseValue` text → `falseValue`; date: `dateFormat`, then ISO, stored per `outputFormat`) — unparseable text is kept and the cell marked invalid.


## Public methods

### Focus & editing

| Method | Description |
|---|---|
| `focusCell(rowIndex, colIndex)` | Programmatically focus a cell |
| `startEditing(rowIndex, colIndex)` | Programmatically start editing a cell |
| `openCustomEditor(rowIndex, colIndex)` | Open the custom editor for a cell with `editor: 'custom'` |

### Draft management

| Method | Returns | Description |
|---|---|---|
| `getRowDraft(rowIndex)` | `T \| undefined` | Get the draft for a row |
| `hasRowDraft(rowIndex)` | `boolean` | Check if a row has uncommitted changes |
| `getDraftRowIndices()` | `number[]` | Display indices of the displayed rows with drafts |
| `getDrafts()` | `{ row, draftRow, changedFields, isValid }[]` | Every draft — incl. rows on other pages, filtered out, or not in `items` |
| `discardDraft(row)` | `void` | Discard one row's draft (the row, its id-equal copy, or the draft object) |
| `discardAllDrafts()` | `void` | Discard all draft changes across all rows |

### Validation

| Method | Returns | Description |
|---|---|---|
| `isCellInvalid(rowIndex, field)` | `boolean` | Check if a cell has a validation error |
| `getCellValidationError(rowIndex, field)` | `string \| null` | Get the validation error message |
| `canEditCell(rowIndex, field)` | `boolean` | Check if a cell can be edited (considers row locking and column editability) |

### Row identification

| Method | Returns | Description |
|---|---|---|
| `getRowId(row)` | `unknown \| undefined` | Get the ID using `getIdCallback` / `idMember` (default `'id'`) |
| `getRowById(id)` | `T \| null` | Find a row by its ID |
| `getRowIndex(row)` | `number` | The row's display index (the `rowIndex` of every ctx / event), `-1` when not displayed |

### Row updates

| Method | Returns | Description |
|---|---|---|
| `updateRowById(id, newData)` | `boolean` | Merge partial data into a row (for WebSocket / live updates) |
| `replaceRowById(id, newRow)` | `boolean` | Replace an entire row by ID |

### Row locking

| Method | Returns | Description |
|---|---|---|
| `isRowLocked(rowOrId)` | `boolean` | Check if a row is locked |
| `getRowLockInfo(rowOrId)` | `RowLock \| null` | Get lock information |
| `lockRowById(id, lockerInfo?)` | `boolean` | Lock a row externally (e.g. from a WebSocket message) |
| `unlockRowById(id)` | `boolean` | Unlock an externally locked row |
| `getExternalLocks()` | `Map<unknown, RowLock>` | Get all external locks |
| `clearExternalLocks()` | `void` | Remove all external locks |

### Row selection

| Method | Returns | Description |
|---|---|---|
| `selectRow(rowIndex, mode?)` | `void` | Select a row. Mode: `'replace'` (default), `'toggle'`, `'range'` |
| `selectRowRange(fromIndex, toIndex)` | `void` | Select a range |
| `clearSelection()` | `void` | Clear every selection kind (rows, cell range, columns) |
| `clearRowSelection()` | `void` | Clear only the row selection |
| `isRowSelected(rowIndex)` | `boolean` | Selection check |
| `selectedRows` | `T[]` | Property: the selected row objects |
| `selectedRowIndices` | `number[]` | Property: their display indices |
| `copySelectedRowsToClipboard()` | `Promise<boolean>` | Copy selected rows as TSV |

### Cell selection

| Method | Returns | Description |
|---|---|---|
| `selectCellRange(range)` | `void` | Select a cell range programmatically |
| `clearCellSelection()` | `void` | Clear cell selection |
| `getSelectedCells()` | `CellContext<T>[]` | The selected cells `{ row, rowIndex, column, colIndex, field, value }` (`colIndex` = index in `columns`), on-screen column order |
| `copyCellSelectionToClipboard()` | `Promise<boolean>` | Copy selected cells as TSV |

### Column width & order

| Method | Returns | Description |
|---|---|---|
| `setColumnWidth(field, width)` | `void` | Width for a single column |
| `setColumnWidths(widths)` | `void` | Widths for multiple columns (`ColumnWidthState[]`) |
| `getColumnWidthsState()` | `ColumnWidthState[]` | Current widths |
| `setColumnOrder(order)` | `void` | Column order (`ColumnOrderState[]`) |
| `getColumnOrderState()` | `ColumnOrderState[]` | Current column order |

## Labels / i18n

All UI strings are customizable via `labels` — a partial object (also a JSON attribute) merged per key over the English defaults; a column can override its dropdown texts with `editorOptions.labels`:

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
    add: 'Add row', delete: 'Delete row', duplicate: 'Duplicate row',
    moveUp: 'Move up', moveDown: 'Move down',
    expand: 'Expand', collapse: 'Collapse',          // one level
    expandSubtree: 'Expand subtree', collapseSubtree: 'Collapse subtree',  // row + everything under it
    expandAll: 'Expand all', collapseAll: 'Collapse all'  // whole tree
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
// Version + package info
window.components['web-grid'].version()
window.components['web-grid'].config

// Logging (silent by default)
window.components['web-grid'].logging.enableLogging()
window.components['web-grid'].logging.setLogLevel('info')          // trace | debug | info | warn | error | silent
window.components['web-grid'].logging.setCategoryLevel('GRID:UI', 'debug')
window.components['web-grid'].logging.getCategories()              // ['GRID:INIT', 'GRID:DATA', 'GRID:UI', 'GRID:INTERACTION', 'GRID:PERF']
window.components['web-grid'].logging.disableLogging()
```

## TypeScript

Full type definitions ship with the package. Import types from the root:

```typescript
import '@keenmate/web-grid'
import type { Column, GridToolbarEntry, GridActionEventDetail, GridEventMap } from '@keenmate/web-grid'

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

## Architecture note

The grid uses an **action pipeline** pattern for user interactions. DOM events are captured by `ActionPipelineAdapter`, translated into typed action objects (34 action kinds), and dispatched through a pipeline to specialized executors (16 executors: focus, editing, navigation, selection, clipboard, dropdown, fill-handle, etc.). Executors can emit child actions for composability — e.g. committing an edit triggers a focus-move.

```
DOM Event → Adapter → Action → Pipeline → Executor → State Change → Render
```

This separates mode detection (the adapter decides *what* action a click means based on grid mode, edit trigger, cell state) from business logic (executors handle *how* to focus, edit, select). It also enables incremental migration from legacy event handlers.

## See also

- [Theming](./theming.md) — `--wg-*` variables, dark-mode signals, cascade layers, `--base-*` integration.
- [Examples](./examples.md) — cookbook of recipes pointing at the runnable demos.
- [Accessibility](./accessibility.md) — keyboard model, ARIA, focus management.

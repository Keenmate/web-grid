# Usage & API reference

This document covers the public surface of `<web-grid>` — how to mount it, every attribute / property / event / method / column field, and the data shapes.

For a quick mental model: the grid reads its configuration from **properties on the element**, not attributes. Drop the custom element into your markup, grab a reference, assign `items` and `columns`, and turn on what you need.

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

## Grid modes

The `mode` property sets sensible defaults for common use cases:

| Mode | `isEditable` | `editTrigger` | `cellSelectionMode` | `dropdownToggleVisibility` | `shouldShowDropdownOnFocus` |
|------|-------------|--------------|--------------------|--------------------------|-----------------------------|
| `'read-only'`    | `false` | —             | `'click'` | `'on-focus'` | `false` |
| `'excel'`        | `true`  | `'navigate'`  | `'click'` | `'always'`   | `false` |
| `'input-matrix'` | `true`  | `'always'`    | `'shift'` | `'always'`   | `true`  |

- **`read-only`** — No editing. Click to select cells. Useful for display grids with copy support.
- **`excel`** — Arrow keys to move, type to start editing, Escape to cancel. Click+drag for cell selection.
- **`input-matrix`** — All cells are always in edit mode. Shift+click for cell selection. Tab to navigate between fields.

Setting `mode` applies these defaults; you can override individual properties afterward.

## Properties

The `QuickGridProps<T>` type defined in `src/types.ts` is the canonical source of truth. The tables below mirror that surface, grouped for readability.

### Core data

| Property | Type | Default | Description |
|---|---|---|---|
| `items` | `T[]` | `[]` | Row data — the only required "content" property |
| `columns` | `Column<T>[]` | `[]` | Column definitions (see [Column definition](#column-definition)) |
| `idMember` | `keyof T \| string` | — | Field that uniquely identifies a row. Internal state (drafts, invalid-cell markers) is keyed by this value; falls back to `treePathMember` or displayed-row index |

### Display

| Property | Type | Default | Description |
|---|---|---|---|
| `isFilterable` | `boolean` | `false` | Show per-column filter inputs |
| `isStriped` | `boolean` | `false` | Alternate row backgrounds |
| `isHoverable` | `boolean` | `false` | Highlight row on hover |
| `isRowNumbersVisible` | `boolean` | `false` | Show leftmost row-number column |
| `isStickyRowNumbers` | `boolean` | `false` | Freeze row-number column during horizontal scroll |
| `isDirtyIndicatorVisible` | `boolean` | `true` | Visual indicator on cells with unsaved changes |
| `freezeColumns` | `number` | `0` | Freeze first N columns (applied after visual reorder from `isFrozen`) |
| `mode` | `GridMode` | — | `'read-only'`, `'excel'`, or `'input-matrix'` (see [Grid modes](#grid-modes)) |
| `columnMinWidth` | `string` | — | Default min-width applied to every column header that doesn't set its own `minWidth` |
| `focusedRowIndex` | `number \| null` | `null` | Currently focused row index (readable/writable) |
| `class` / `style` | `string` | — | Pass-through host element class and inline style |

### Editing

| Property | Type | Default | Description |
|---|---|---|---|
| `isEditable` | `boolean` | `false` | Enable cell editing |
| `isRowEditable` | `boolean \| (row: T) => boolean` | — | Row-level editability gate; combined with grid- and column-level `isEditable` (all three must pass) |
| `editTrigger` | `EditTrigger` | `'dblclick'` | How editing starts: `'click'`, `'dblclick'`, `'button'`, `'always'`, `'navigate'` |
| `editStartSelection` | `EditStartSelection` | `'selectAll'` | Cursor position when entering edit via navigate: `'mousePosition'`, `'selectAll'`, `'cursorAtStart'`, `'cursorAtEnd'` |
| `shouldCommitOnClickAway` | `boolean` | `true` | Excel-like commit on click-away. `false` discards the in-progress value |
| `dropdownToggleVisibility` | `ToggleVisibility` | `'on-focus'` | When to show dropdown toggle: `'always'`, `'on-focus'` |
| `shouldShowDropdownOnFocus` | `boolean` | `false` | Auto-open dropdown when cell is focused |
| `shouldOpenDropdownOnEnter` | `boolean` | `false` | Enter opens dropdown (`true`) or moves down (`false`) |
| `isCheckboxAlwaysEditable` | `boolean` | `false` | Checkboxes stay clickable, even in navigate mode |
| `invalidCells` | `CellValidationState[]` | `[]` | External validation state for cells |

### Sorting

| Property | Type | Default | Description |
|---|---|---|---|
| `sort` | `SortState[]` | `[]` | Current sort state (set for initial / server-side sort) |
| `sortMode` | `SortMode` | `'none'` | `'none'` (disabled), `'single'`, `'multi'` |

### Pagination

| Property | Type | Default | Description |
|---|---|---|---|
| `isPageable` | `boolean` | `false` | Enable pagination |
| `pageSize` | `number` | `10` | Rows per page |
| `pageSizes` | `number[]` | — | Available page sizes for the page-size selector |
| `paginationMode` | `'client' \| 'server'` | `'client'` | Client slices `items`; server treats `items` as the current page |
| `currentPage` | `number` | `1` | Current page (1-based) |
| `totalItems` | `number \| null` | `null` | Total item count for server-side pagination |
| `isPaginationVisible` | `boolean \| 'auto'` | `'auto'` | `'auto'` hides the pager when there is ≤ 1 page |
| `paginationPosition` | `string` | `'bottom-center'` | Position(s): e.g. `'top-right\|bottom-right'` for multiple |
| `paginationLabelsCallback` | `PaginationLabelsCallback` | — | Customize/translate pagination text |
| `paginationLayout` | `string` | — | Element order: `'pageSize\|previous\|pageInfo\|next'` or `'first\|previous\|pageInfo\|next\|last'` |

### Row toolbar

| Property | Type | Default | Description |
|---|---|---|---|
| `isRowToolbarVisible` | `boolean` | `false` | Show row action toolbar |
| `rowToolbar` | `RowToolbarConfig<T>[]` | `[]` | Toolbar items (predefined strings or custom objects) |
| `toolbarTrigger` | `'hover' \| 'click' \| 'button'` | `'hover'` | How to show the toolbar |
| `toolbarPosition` | `ToolbarPosition` | `'auto'` | Preferred position: `'auto'`, `'left'`, `'right'`, `'top'`, `'inline'` |
| `toolbarVerticalAlign` | `'top' \| 'center' \| 'bottom'` | `'bottom'` | Vertical alignment for `left` / `right` position |
| `toolbarHorizontalAlign` | `'start' \| 'center' \| 'end' \| 'cursor'` | `'center'` | Horizontal alignment for `top` position |
| `toolbarColumn` | `string \| number` | — | Column to pin toolbar over (field name or index), for `'top'` position |
| `shouldToolbarFollowCursor` | `boolean` | `false` | Toolbar follows mouse cursor horizontally |
| `cellToolbar` | `(row, rowIndex, field, colIndex) => RowToolbarConfig[] \| undefined` | — | Cell-specific toolbar items |
| `cellToolbarOffset` | `number \| string` | `0.2` | Horizontal offset: `0`–`1` as fraction of cell width, or CSS length (e.g. `'2rem'`) |
| `toolbarBtnMinWidth` | `string` | — | Min-width for toolbar buttons; overrides `--wg-toolbar-btn-min-width` |
| `inlineActionsTitle` | `string` | `'Actions'` | Header title for inline actions column (`toolbarPosition='inline'`). Use `''` for no title |

> **Deprecated aliases:** `toolbarAlign` → `toolbarVerticalAlign`; `toolbarTopPosition` → `toolbarHorizontalAlign`.

#### Predefined row toolbar items

| String | Action |
|---|---|
| `'add'` | Insert a new row after the current row |
| `'delete'` | Delete the current row |
| `'duplicate'` | Duplicate the current row |
| `'moveUp'` / `'moveDown'` | Move row up / down |

#### Custom row toolbar item

```javascript
{
  id: 'edit',
  icon: '✏️',
  title: 'Edit Record',
  label: 'Edit',                                // Optional text label next to icon
  row: 1,                                       // Row in multi-row toolbar (1 = closest to grid row)
  group: 1,                                     // Group number for visual dividers
  danger: false,
  disabled: (row, rowIndex) => row.locked,      // Boolean or callback
  hidden: (row, rowIndex) => row.archived,
  tooltip: { description: 'Open editor', shortcut: 'Enter' },
  onclick: ({ row, rowIndex }) => { /* … */ }
}
```

### Context menu

| Property | Type | Default | Description |
|---|---|---|---|
| `contextMenu` | `ContextMenuConfig<T>[]` | — | Cell / row context menu items |
| `contextMenuXOffset` | `number` | `0` | Horizontal offset from click position |
| `contextMenuYOffset` | `number` | `4` | Vertical offset from click position |
| `headerContextMenu` | `HeaderMenuConfig<T>[]` | — | Header context menu items |

#### Predefined header menu items

| String | Action |
|---|---|
| `'sortAsc'`, `'sortDesc'`, `'clearSort'` | Sort controls |
| `'hideColumn'` | Hide the right-clicked column |
| `'freezeColumn'`, `'unfreezeColumn'` | Freeze / unfreeze this column |
| `'columnVisibility'` | Submenu with a toggle per column |

#### Predefined cell menu items

| String | Action |
|---|---|
| `'expand-all'` / `'collapse-all'` | Expand / collapse every tree node |
| `'expand-tree'` / `'collapse-tree'` | Expand / collapse the current subtree |

#### Cell context menu item shape

```javascript
{
  id: 'view',
  label: 'View Details',                       // Or (context) => `View ${context.row.name}`
  icon: '👁️',                                  // Or (context) => context.row.active ? '🟢' : '🔴'
  shortcut: 'Enter',                           // Display-only hint
  visible: (context) => true,                  // Or static boolean
  disabled: (context) => context.row.locked,
  danger: false,
  dividerBefore: false,
  onclick: (context) => { /* { row, rowIndex, colIndex, column, cellValue } */ }
}
```

Header items can also include `children` (static submenu) or `submenu: (context) => […]` (dynamic submenu).

### Cell selection

| Property | Type | Default | Description |
|---|---|---|---|
| `cellSelectionMode` | `CellSelectionMode` | `'click'` | `'disabled'`, `'click'`, `'shift'` |
| `shouldCopyWithHeaders` | `boolean` | `false` | Include column headers when copying cell selection to clipboard |

### Keyboard shortcuts

| Property | Type | Default | Description |
|---|---|---|---|
| `rowShortcuts` | `RowShortcut<T>[]` | — | Row-level shortcut definitions |
| `rangeShortcuts` | `RangeShortcut<T>[]` | — | Multi-row / range shortcut definitions |
| `isShortcutsHelpVisible` | `boolean` | `false` | Show keyboard-shortcuts help icon |
| `shortcutsHelpPosition` | `'top-right' \| 'top-left'` | `'top-right'` | Help icon position |
| `shortcutsHelpContentCallback` | `() => string` | — | Custom HTML alongside the shortcuts list |

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
| `fillDragCallback` | `(detail: FillDragDetail) => boolean \| void` | — | Called on fill-handle drag. Return `false` to cancel |

### Row locking

| Property | Type | Default | Description |
|---|---|---|---|
| `rowLocking` | `RowLockingOptions<T>` | — | Row locking configuration (see below) |

`RowLockingOptions`:

| Field | Type | Description |
|---|---|---|
| `lockedMember` | `keyof T` | Property with boolean lock state |
| `lockInfoMember` | `keyof T` | Property with `RowLock` info object |
| `isLockedCallback` | `(row, rowIndex) => boolean` | Callback-based lock check |
| `getLockInfoCallback` | `(row, rowIndex) => RowLock \| null` | Callback-based lock info |
| `lockedEditBehavior` | `'block' \| 'allow' \| 'callback'` | Edit behavior for locked rows (default: `'block'`) |
| `canEditLockedCallback` | `(row, lockInfo) => boolean` | Per-row edit decision (when `'callback'`) |
| `lockTooltipCallback` | `(lockInfo, row) => string \| null` | Custom tooltip HTML for locked rows |

### Tree / hierarchy

Path-string driven (ltree-style: `"1.2.3"`, `"/dept/eng/team"`, `"C:\\a\\b"`).

| Property | Type | Default | Description |
|---|---|---|---|
| `treePathMember` | `keyof T \| string` | — | **Required** to enable tree mode; field holding the path |
| `treeLevelMember` | `keyof T \| string` | — | Pre-computed depth (0-based) |
| `treeParentMember` | `keyof T \| string` | — | Pre-computed parent path |
| `treeSeparator` | `string` | auto | Auto-detected from first row when omitted |
| `treeDataSorted` | `boolean` | `false` | `true` = grid never re-sorts (pair with `ondatarequest`); `false` = grid sorts siblings depth-first |
| `expandedPaths` | `Set<string>` | — | Bindable set of expanded paths; mutated by grid |
| `defaultExpandDepth` | `number` | all | `0` = roots only; `1` = roots + children; etc. |
| `treeDoubleClickBehavior` | `TreeDoubleClickBehavior` | `'none'` | Action when double-clicking a tree-column cell |
| `treeExpandedGlyph` / `treeCollapsedGlyph` | `string` | `'▶'` | Static glyphs. When equal, CSS rotates 90°; when different, glyph swaps |
| `treeChevronCallback` | `TreeChevronCallback<T>` | — | Per-row override; cached per `(row, expanded)` |

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
| `virtualScrollRowHeight` | `number` | `38` | Fixed row height in pixels |
| `virtualScrollBuffer` | `number` | `10` | Extra rows rendered above/below the viewport |

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
| `summaryContentCallback` | `SummaryContentCallback<T>` | — | Returns HTML content for the summary bar |
| `isSummaryInline` | `boolean` | `true` | Share row with pagination in same area |
| `summaryMetadata` | `unknown` | — | Server-provided metadata passed to `summaryContentCallback` |

### Styling

| Property | Type | Default | Description |
|---|---|---|---|
| `customStylesCallback` | `() => string` | — | CSS string injected into shadow DOM |
| `rowClassCallback` | `(row, rowIndex) => string \| null` | — | Dynamic CSS class for rows |
| `labels` | `Partial<GridLabels>` | — | Override UI labels for i18n (see [Labels / i18n](#labels--i18n)) |
| `validationTooltipCallback` | `(context) => string \| null` | — | Custom HTML for the validation error tooltip (grid-level default) |
| `invalidCells` | `CellValidationState[]` | `[]` | External validation state for cells |

### Experimental: new empty row

Inline data entry — API may change.

| Property | Type | Default | Description |
|---|---|---|---|
| `isNewRowEnabled` | `boolean` | `false` | Always-visible empty row for data entry |
| `newRowPosition` | `NewRowPosition` | `'bottom'` | `'top'` or `'bottom'` |
| `newRowIndicator` | `string` | `'+'` | Indicator shown in row-number column |
| `createEmptyRowCallback` | `() => T \| Promise<T>` | — | Factory function (can be async) |

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
| `cellClassCallback` | `(value, row) => string \| null` | Dynamic class based on value / row |

### Content

| Field | Type | Description |
|---|---|---|
| `formatCallback` | `(value, row) => string` | Format value for display (text only) |
| `templateCallback` | `(row) => string` | Custom cell HTML string |
| `renderCallback` | `(row, element) => void` | Imperative cell rendering (receives the `<td>`) |

### Editing

| Field | Type | Description |
|---|---|---|
| `isEditable` | `boolean` | Enable editing for this column |
| `editor` | `Editor` | `'text'`, `'number'`, `'checkbox'`, `'select'`, `'combobox'`, `'autocomplete'`, `'date'`, `'custom'` |
| `editTrigger` | `EditTrigger` | Per-column override |
| `editorOptions` | `EditorOptions<T>` | Editor-specific configuration (see [Editor options](#editor-options)) |
| `dropdownToggleVisibility` | `ToggleVisibility` | Per-column override |
| `shouldOpenDropdownOnEnter` | `boolean` | Per-column override |
| `cellEditCallback` | `(context: CustomEditorContext<T>) => void` | Handler for `editor: 'custom'` |
| `isEditButtonVisible` | `boolean` | Show an edit button in the cell |

### Validation

| Field | Type | Description |
|---|---|---|
| `beforeCommitCallback` | `(context: BeforeCommitContext<T>) => BeforeCommitResult \| Promise<…>` | Validates / transforms before commit |
| `validateCallback` | `(value, row) => string \| null \| Promise<…>` | **Deprecated** — use `beforeCommitCallback` |
| `validationTooltipCallback` | `(context) => string \| null` | Custom HTML for this column's validation error tooltip |

`beforeCommitCallback` receives `{ value, oldValue, row, rowIndex, field }` and returns one of:

- `{ valid: true }` or `{ valid: true, transformedValue: … }` — accept (optionally transform)
- `{ valid: false, message: 'Error text' }` — reject with message
- `true` / `null` / `undefined` — accept
- `false` — reject (no message)
- `string` — reject with that string as message

### Tooltip

| Field | Type | Description |
|---|---|---|
| `tooltipMember` | `string` | Property name in row data containing tooltip text |
| `tooltipCallback` | `(value, row) => string \| null` | Dynamic tooltip (takes priority over `tooltipMember`) |

### Clipboard

| Field | Type | Description |
|---|---|---|
| `beforeCopyCallback` | `(value, row) => string` | Transform value before copying to clipboard |
| `beforePasteCallback` | `(value, row) => unknown` | Process pasted value before applying to cell |

### Layout

| Field | Type | Description |
|---|---|---|
| `isFrozen` | `boolean` | Column sticks to the left during horizontal scroll |
| `isResizable` | `boolean` | Allow column-width drag (default: `true`) |
| `isMovable` | `boolean` | Allow drag-reorder (default: `true`) |
| `isHidden` | `boolean` | Not rendered but kept in array for visibility toggling |
| `isSortable` | `boolean` | Enable sorting for this column (when grid has `sortMode`) |
| `isFilterable` | `boolean` | Enable filtering for this column |
| `isTree` | `boolean` | Mark this column as the tree column (renders chevron + indent) |

### Fill

| Field | Type | Description |
|---|---|---|
| `fillDirection` | `FillDirection` | Override grid-level fill direction: `'vertical'` or `'all'` |

## Editor options

Per-editor configuration, set via `editorOptions` on the column.

### Text

| Option | Type | Default | Description |
|---|---|---|---|
| `maxLength` | `number` | — | Maximum character count |
| `placeholder` | `string` | — | Placeholder text |
| `pattern` | `string` | — | `input` pattern attribute |
| `inputMode` | `'text' \| 'numeric' \| 'email' \| 'tel' \| 'url'` | — | Virtual-keyboard hint |
| `editStartSelection` | `EditStartSelection` | `'selectAll'` | Cursor position when entering edit |

### Number

| Option | Type | Default | Description |
|---|---|---|---|
| `min` / `max` / `step` | `number` | — | Standard numeric bounds |
| `decimalPlaces` | `number` | — | Fixed decimal places |
| `allowNegative` | `boolean` | — | Allow negative values |

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
| `loadOptions` | `(row, field) => Promise<EditorOption[]>` | Async option loader |
| `optionsLoadTrigger` | `OptionsLoadTrigger` | `'immediate'`, `'oneditstart'` (default), `'ondropdownopen'` |

**Display mapping** — by default, options use `value` and `label`. Override with member strings or callbacks:

| Member property | Callback alternative | Description |
|---|---|---|
| `valueMember` | `getValueCallback` | Option value |
| `displayMember` | `getDisplayCallback` | Display text |
| `searchMember` | `getSearchCallback` | Searchable text (falls back to display) |
| `iconMember` | `getIconCallback` | Icon / emoji |
| `subtitleMember` | `getSubtitleCallback` | Subtitle / description |
| `disabledMember` | `getDisabledCallback` | Disabled state |
| `groupMember` | `getGroupCallback` | Grouping |

**Rendering & behavior:**

| Option | Type | Description |
|---|---|---|
| `renderOptionCallback` | `(option, context) => string` | Custom HTML per option. `context` has `{ index, isHighlighted, isSelected, isDisabled }` |
| `onselect` | `(option, row) => void` | Notification when an option is selected |
| `allowEmpty` | `boolean` | Allow null / empty selection |
| `emptyLabel` | `string` | Default: `'-- Select --'` |
| `noOptionsText` | `string` | Override "No options" |
| `searchingText` | `string` | Override "Searching…" |
| `dropdownMinWidth` | `string` | Minimum dropdown width (e.g. `'300px'`) |
| `placeholder` | `string` | Combobox / autocomplete placeholder |

### Autocomplete-specific

| Option | Type | Default | Description |
|---|---|---|---|
| `searchCallback` | `(query, row, signal?) => Promise<EditorOption[]>` | — | Async search; receives `AbortSignal` for cancellation |
| `initialOptions` | `EditorOption[]` | — | Options shown before user types |
| `minSearchLength` | `number` | `1` | Minimum characters before triggering search |
| `debounceMs` | `number` | `300` | Debounce delay for search calls |
| `multiple` | `boolean` | `false` | Allow multiple selections |
| `maxSelections` | `number` | — | Cap when `multiple: true` |

### Custom editor

Set `editor: 'custom'` and provide `cellEditCallback`:

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

## Callbacks

These are **callback properties** set on the grid element, not DOM events. Naming convention:

- `on*` callbacks — fire-and-forget notifications. The return value is ignored.
- `*Callback` properties — return a value that affects behavior (see column-level callbacks).

| Callback | Signature | Fires when |
|---|---|---|
| `onrowchange` | `(detail: RowChangeDetail<T>) => void` | Cell value changed. Detail: `{ row, draftRow, rowIndex, field, oldValue, newValue, isValid, validationError }` |
| `onroweditstart` | `(detail: { row, rowIndex, field }) => void` | Editing started on a cell |
| `onroweditcancel` | `(detail: { row, rowIndex, field }) => void` | Edit was cancelled (Escape) |
| `onvalidationerror` | `(detail: { row, rowIndex, field, error }) => void` | Validation failed on commit |
| `ontoolbarclick` | `(detail: ToolbarClickDetail<T>) => void` | Toolbar button clicked. Detail: `{ item, rowIndex, row, event, triggerElement }` |
| `oncontextmenuopen` | `(context: ContextMenuContext<T>) => void` | Cell context menu opened |
| `onheadercontextmenuopen` | `(context: HeaderMenuContext<T>) => void` | Header context menu opened |
| `ondatarequest` | `(detail: DataRequestDetail) => void` | Sort / page / page-size changed. Detail: `{ sort, page, pageSize, trigger, mode, skip }` |
| `onrowdelete` | `(detail: { rowIndex, row }) => void` | Ctrl+Delete pressed. Also dispatched as a DOM `CustomEvent` |
| `onrowfocus` | `(detail: RowFocusDetail<T>) => void` | Different row was focused. Detail: `{ rowIndex, row, previousRowIndex }` |
| `onrowlockchange` | `(detail: RowLockChangeDetail<T>) => void` | Row lock state changed |
| `oncolumnresize` | `(detail: ColumnResizeDetail) => void` | Column resized. Detail: `{ field, oldWidth, newWidth, allWidths }` |
| `oncolumnreorder` | `(detail: ColumnReorderDetail) => void` | Column reordered. Detail: `{ field, fromIndex, toIndex, allOrder }` |
| `oncellselectionchange` | `(detail: CellSelectionChangeDetail) => void` | Cell selection changed. Detail: `{ range, cellCount }` |
| `onfilterchange` | `(filters: Record<string, string>) => void` | A filter input changed. When set, internal client-side filtering is **bypassed** — replace `items` yourself |
| `onexpandedpathschange` | `(detail: TreeExpandedChangeDetail) => void` | Tree expand / collapse changed |

> **DOM events:** Only `rowdelete` is also dispatched as a `CustomEvent`. All other callbacks are property-based only.

## Paste API

The paste pipeline is exposed directly on the grid element:

| Property | Type | Description |
|---|---|---|
| `pasteMode` | `'replace' \| 'merge'` | Default behavior when content is pasted |
| `shouldValidateOnPaste` | `boolean` | Run `beforeCommitCallback` on each pasted cell |
| `onbeforepaste` | `(detail: BeforePasteDetail<T>) => boolean \| Promise<boolean>` | Returns `false` to cancel the paste |
| `onpaste` | `(detail: PasteDetail<T>) => void` | Fires after a paste lands. Delivers a `PasteDetail`, not a raw `ClipboardEvent` |

> `onpaste` shadows the native `HTMLElement.onpaste` property. TypeScript consumers should cast on assignment or use `el.grid.onpaste = fn` for full type fidelity; JS consumers have no friction.

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
| `discardRowDraft(rowIndex)` | `void` | Discard all draft changes for a row |
| `getDraftRowIndices()` | `number[]` | All row indices with drafts |
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
| `getRowId(row)` | `unknown \| undefined` | Get the ID using `idMember` / `idValueCallback` |
| `findRowById(id)` | `{ row, index } \| null` | Find a row by its ID |

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
| `clearSelection()` | `void` | Clear row selection |
| `isRowSelected(rowIndex)` | `boolean` | Selection check |
| `getSelectedRowsData()` | `T[]` | Data for all selected rows |
| `copySelectedRowsToClipboard()` | `Promise<boolean>` | Copy selected rows as TSV |

### Cell selection

| Method | Returns | Description |
|---|---|---|
| `selectCellRange(range)` | `void` | Select a cell range programmatically |
| `clearCellSelection()` | `void` | Clear cell selection |
| `getSelectedCells()` | `Array<{ row, rowIndex, colIndex, field, value }>` | Data for all selected cells |
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

All UI labels are customizable via the `labels` property:

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

## Architecture note

WebGrid uses an **action pipeline** pattern for user interactions. DOM events are captured by `ActionPipelineAdapter`, translated into typed action objects (34 action kinds), and dispatched through a pipeline to specialized executors (16 executors: focus, editing, navigation, selection, clipboard, dropdown, fill-handle, etc.). Executors can emit child actions for composability — e.g. committing an edit triggers a focus-move.

```
DOM Event → Adapter → Action → Pipeline → Executor → State Change → Render
```

This separates mode detection (the adapter decides *what* action a click means based on grid mode, edit trigger, cell state) from business logic (executors handle *how* to focus, edit, select). It also enables incremental migration from legacy event handlers.

## See also

- [Theming](./theming.md) — `--wg-*` variables, dark-mode signals, cascade layers, `--base-*` integration.
- [Examples](./examples.md) — cookbook of recipes pointing at the runnable demos.
- [Accessibility](./accessibility.md) — keyboard model, ARIA, focus management.

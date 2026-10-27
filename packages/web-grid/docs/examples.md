# Examples & cookbook

Runnable examples live in the monorepo `docs/` folder and each focuses on one feature surface. The recipes below are tight code snippets that match those examples — use them as starting points to drop into your own page.

To run any example locally:

```bash
make dev
# Then visit http://localhost:12500/examples-<feature>.html
```

## Runnable demos

| Example | What it shows |
|---|---|
| [`examples-basic.html`](../../../docs/examples-basic.html) | Minimum viable grid — `items` + `columns` + nothing else |
| [`examples-sorting-paging.html`](../../../docs/examples-sorting-paging.html) | Single / multi-column sort, pagination, page-size selector |
| [`examples-editable-full.html`](../../../docs/examples-editable-full.html) | Inline editing across all 8 editor types |
| [`examples-editors.html`](../../../docs/examples-editors.html) | Editor configuration: select, combobox, autocomplete options |
| [`examples-edit-trigger.html`](../../../docs/examples-edit-trigger.html) | Click / dblclick / button / always / navigate triggers |
| [`examples-grid-modes.html`](../../../docs/examples-grid-modes.html) | `read-only` / `excel` / `input-matrix` mode comparison |
| [`examples-dropdowns.html`](../../../docs/examples-dropdowns.html) | Dropdown rendering, group headers, custom option HTML |
| [`examples-selection.html`](../../../docs/examples-selection.html) | Row selection, cell range selection, multi-select |
| [`examples-fill-handle.html`](../../../docs/examples-fill-handle.html) | Excel-like autofill by dragging the cell corner |
| [`examples-freeze-panes.html`](../../../docs/examples-freeze-panes.html) | Frozen columns with horizontal scroll |
| [`examples-resizable-columns.html`](../../../docs/examples-resizable-columns.html) | Drag-to-resize with min/max and localStorage persistence |
| [`examples-column-visibility.html`](../../../docs/examples-column-visibility.html) | Hide / show columns from the header context menu |
| [`examples-toolbar.html`](../../../docs/examples-toolbar.html) | Floating, inline, cell-specific toolbars; positioning options |
| [`examples-contextmenu.html`](../../../docs/examples-contextmenu.html) | Cell + header context menus, predefined and custom items |
| [`examples-shortcuts.html`](../../../docs/examples-shortcuts.html) | Row + range custom keyboard shortcuts, help overlay |
| [`examples-row-locking.html`](../../../docs/examples-row-locking.html) | Optimistic locking with external `RowLock` info |
| [`examples-tree.html`](../../../docs/examples-tree.html) | ltree-style hierarchical data with chevron + expand-all |
| [`examples-tree-scroll.html`](../../../docs/examples-tree-scroll.html) | Tree with virtual / infinite scroll |
| [`examples-virtual-scroll.html`](../../../docs/examples-virtual-scroll.html) | Virtual scroll for 10k+ row datasets |
| [`examples-product-search.html`](../../../docs/examples-product-search.html) | End-to-end pattern: filterable, editable product catalog |
| [`examples-height-modes.html`](../../../docs/examples-height-modes.html) | Capped container vs. full-page height vs. `isTableBorderOnly` |
| [`examples-theming.html`](../../../docs/examples-theming.html) | `--base-*` overrides, custom palette, dark-mode toggling |
| [`examples-custom-styling.html`](../../../docs/examples-custom-styling.html) | `getCustomStylesCallback`, `getRowClassCallback`, `getCellClassCallback` |

## Cookbook

### Sortable grid

```javascript
grid.sortMode = 'multiple'              // or 'single'; click headers to sort, Ctrl+click to add
```

See [`examples-sorting-paging.html`](../../../docs/examples-sorting-paging.html).

### Paginated grid with top + bottom pager

```javascript
grid.isPageable = true
grid.pageSize = 25
grid.paginationPosition = 'top-center|bottom-center'
```

### Editable grid (Excel-like)

```javascript
grid.preset = 'excel'                // sets isEditable + editTrigger='navigate' + cellSelectionMode='click'
```

Or opt in manually for finer control:

```javascript
grid.isEditable = true
grid.editTrigger = 'navigate'
```

See [`examples-edit-trigger.html`](../../../docs/examples-edit-trigger.html) for the 5 triggers compared.

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

See [`examples-editors.html`](../../../docs/examples-editors.html).

### Async autocomplete with cancellation

```javascript
grid.columns = [{
  field: 'assignee',
  title: 'Assignee',
  editor: 'autocomplete',
  editorOptions: {
    minSearchLength: 2,
    debounceMs: 300,
    searchCallback: async ({ term, signal }) => {
      const r = await fetch(`/api/users?q=${encodeURIComponent(term)}`, { signal })
      return (await r.json()).map(u => ({ value: u.id, label: u.name }))
    }
  }
}]
```

`ctx.signal` aborts in-flight requests when the user types again.

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

Return `{ valid: true, transformedValue: … }` to also normalize the input. `validateCallback` runs for pasted cells too (`ctx.source === 'paste'`).

### Custom editor

```javascript
grid.columns = [{
  field: 'color',
  editor: 'custom',
  renderEditorCallback: ({ value, commit, cancel }) => {
    // Open your own UI — modal, popover, color picker, etc.
    myColorPicker.open(value, {
      onPick:   (next) => commit(next),
      onCancel: ()     => cancel()
    })
  }
}]
```

### Header context menu with column hide + visibility submenu

```javascript
grid.headerContextMenu = [
  'sort-asc', 'sort-desc', 'clear-sort',
  { divider: true },
  'hide-column',
  'column-visibility'
]
```

See [`examples-column-visibility.html`](../../../docs/examples-column-visibility.html).

### Hide a column programmatically

```javascript
grid.columns.find(c => c.field === 'email').isHidden = true
grid.columns = [...grid.columns]     // reassign to trigger re-render
```

### Floating row toolbar

```javascript
grid.isRowToolbarShown = true
grid.rowToolbar = ['move-up', 'move-down', { divider: true }, 'add', 'duplicate', 'delete']
grid.toolbarPosition = 'right'        // or 'left' / 'top' / 'inline' / 'auto'
grid.toolbarTrigger = 'hover'

// The built-ins do the work — shape the rows they insert, and only notify in `action`:
grid.createEmptyRowCallback = () => ({ id: nextId(), title: 'New task' })
grid.createDuplicateRowCallback = ({ row }) => ({ ...row, id: nextId() })
grid.beforeActionCallback = async ({ action, row }) => action !== 'delete' || confirm(`Delete ${row.title}?`)
grid.addEventListener('action', (e) => {
  if (e.detail.action === 'delete') toast(`Deleted ${e.detail.row.title}`)
})
```

Don't insert / remove rows yourself in an `action` listener for `add` / `delete` / `duplicate` / `move-up` / `move-down` — the row would change twice. For consumer-side handling, use a custom item (`id`, no `action`).

See [`examples-toolbar.html`](../../../docs/examples-toolbar.html).

### Cell-specific toolbar

```javascript
grid.getCellToolbarItemsCallback = ({ row, field }) => {
  if (field === 'status') {
    return [
      { id: 'approve', icon: '✅', text: 'Approve', onClick: ({ row }) => approve(row) }
    ]
  }
  return undefined
}
```

### Master / detail — react to row focus

```javascript
grid.addEventListener('focus-change', (e) => showDetailsFor(e.detail.row))
// or the camelCase twin: grid.onFocusChange = ({ row, rowIndex, oldRowIndex }) => …
```

### Cell range selection + clipboard copy

```javascript
grid.cellSelectionMode = 'click'      // or 'shift'
grid.shouldCopyWithHeaders = true     // include header row when copying

// Programmatic copy:
await grid.copyCellSelectionToClipboard()
```

See [`examples-selection.html`](../../../docs/examples-selection.html).

### Excel-like fill handle

```javascript
grid.columns = [
  { field: 'qty', title: 'Qty', editor: 'number' }
]
grid.beforeFillCallback = ({ sourceCell, targetCells, direction }) => {
  // Return false (or a Promise resolving to false) to cancel the fill
  return targetCells.length <= 50
}
```

See [`examples-fill-handle.html`](../../../docs/examples-fill-handle.html).

### Row locking with external locks (WebSocket pattern)

```javascript
grid.rowLocking = {
  isLockedMember: 'isLocked',
  lockInfoMember: 'lockInfo',
  lockedEditBehavior: 'callback',
  getCanEditLockedCallback: ({ row, lockInfo }) => lockInfo.lockedBy === currentUser
}

// External lock from a WebSocket message:
socket.on('row-locked', ({ id, userName }) => {
  grid.lockRowById(id, { lockedBy: userName, lockedAt: new Date() })
})
socket.on('row-unlocked', ({ id }) => grid.unlockRowById(id))
```

See [`examples-row-locking.html`](../../../docs/examples-row-locking.html).

### Live row updates (WebSocket / live data)

```javascript
grid.idMember = 'id'                  // tell the grid how to identify rows

socket.on('row-updated', ({ id, changes }) => {
  grid.updateRowById(id, changes)     // merge partial data; drafts on this row preserved
})

socket.on('row-replaced', ({ id, row }) => {
  grid.replaceRowById(id, row)        // full replace
})
```

### Tree / hierarchy

```javascript
grid.items = [
  { path: '1',     name: 'Engineering' },
  { path: '1.1',   name: 'Frontend' },
  { path: '1.1.1', name: 'Alice' },
  { path: '1.2',   name: 'Backend' },
  { path: '1.2.1', name: 'Bob' }
]

grid.columns = [
  { field: 'name', title: 'Name', isTree: true }
]

grid.pathMember = 'path'
grid.expandLevel = 1           // show roots + first level on load
```

The `isTree: true` column renders the chevron + indent. See [`examples-tree.html`](../../../docs/examples-tree.html).

### Server-side pagination + sort

```javascript
grid.paginationMode = 'server'
grid.isPageable = true
grid.pageSize = 25
grid.totalItems = 0                   // unknown until first response
grid.sortMode = 'multiple'

grid.onDataRequest = async ({ sort, page, pageSize }) => {   // or addEventListener('data-request', …)
  const r = await fetch('/api/rows', {
    method: 'POST',
    body: JSON.stringify({ sort, page, pageSize })
  })
  const { items, total } = await r.json()
  grid.items = items                  // already the current page
  grid.totalItems = total
}
```

The grid does **not** slice `items` itself in `paginationMode: 'server'` — you're responsible for swapping `items` whenever sort or page changes.

### Filter changes (server-side filtering)

```javascript
grid.isFilterable = true
grid.filterMode = 'server'            // or <web-grid filter-mode="server">
grid.addEventListener('filter-change', async (e) => {
  // e.detail.filters: { fieldName: 'typed text', ... }
  const r = await fetch('/api/rows?' + new URLSearchParams(e.detail.filters))
  grid.items = await r.json()
})
```

With `filterMode: 'server'` the grid bypasses internal client-side filtering — it renders the filter inputs, fires `filter-change`, and trusts you to replace `items`. In the default `'client'` mode `filter-change` still fires, as a notification.

### Virtual scroll for large datasets

```javascript
grid.isVirtualScrollEnabled = true
grid.virtualScrollItemHeight = 38      // must be fixed
grid.virtualScrollThreshold = 1000    // auto-enable when items >= threshold
```

See [`examples-virtual-scroll.html`](../../../docs/examples-virtual-scroll.html).

### Infinite scroll (load-more pattern)

```javascript
grid.isInfiniteScrollEnabled = true
grid.infiniteScrollThreshold = 200    // px from bottom that triggers load
grid.hasMoreItems = true

grid.addEventListener('data-request', async (e) => {
  if (e.detail.trigger !== 'load-more') return       // mode: 'append', skip: rows already loaded
  const next = await fetch(`/api/rows?skip=${e.detail.skip}&take=${e.detail.pageSize}`)
  const { items, hasMore } = await next.json()
  grid.items = [...grid.items, ...items]
  grid.hasMoreItems = hasMore
})
```

### Keyboard shortcuts

```javascript
grid.rowShortcuts = [
  {
    shortcut: 'Ctrl+S',
    id: 'save',
    text: 'Save row',
    onClick: ({ row, rowIndex }) => saveRow(row)
  },
  { shortcut: 'Ctrl+D', action: 'duplicate' }    // a row built-in
]
grid.isShortcutsHelpShown = true    // shows help icon top-right
```

See [`examples-shortcuts.html`](../../../docs/examples-shortcuts.html).

### TypeScript

```typescript
import '@keenmate/web-grid'
import type { Column, GridElement, GridEventMap } from '@keenmate/web-grid'

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

const grid = document.querySelector('web-grid') as GridElement<Employee>
grid.columns = columns
grid.items = []

grid.onRowChange = (detail: GridEventMap<Employee>['row-change']) => {
  console.log(detail.field, detail.oldValue, '→', detail.newValue)
}
```

### Theming with `--base-*`

```html
<style>
  :root {
    --base-primary-color: #10b981;
    --base-main-bg: #fff;
    --base-elevated-bg: #f9fafb;
    --base-border-color: #e5e7eb;
  }
</style>

<web-grid id="grid"></web-grid>
```

Every KeenMate component on the page picks up the theme. See [`examples-theming.html`](../../../docs/examples-theming.html) and the [theming contract](./theming.md).

### Per-instance dark mode

```html
<!-- Page is light, this grid is dark -->
<web-grid data-theme="dark"></web-grid>
```

See [color-scheme contract in theming.md](./theming.md#color-scheme-contract) for all 5 signals.

## See also

- [Usage / API reference](./usage.md) — full property / event / method tables.
- [Theming](./theming.md) — variables, dark mode, cascade layers.
- [Accessibility](./accessibility.md) — keyboard model, ARIA, focus.

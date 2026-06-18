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
| [`examples-custom-styling.html`](../../../docs/examples-custom-styling.html) | `customStylesCallback`, `rowClassCallback`, `cellClassCallback` |

## Cookbook

### Sortable grid

```javascript
grid.sortMode = 'multi'              // or 'single'; click headers to sort, Ctrl+click to add
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
grid.mode = 'excel'                  // sets isEditable + editTrigger='navigate' + cellSelectionMode='click'
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
    searchCallback: async (query, row, signal) => {
      const r = await fetch(`/api/users?q=${encodeURIComponent(query)}`, { signal })
      return (await r.json()).map(u => ({ value: u.id, label: u.name }))
    }
  }
}]
```

The `AbortSignal` cancels in-flight requests when the user types again.

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

Return `{ valid: true, transformedValue: … }` to also normalize the input.

### Custom editor

```javascript
grid.columns = [{
  field: 'color',
  editor: 'custom',
  cellEditCallback: ({ value, commit, cancel }) => {
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
  'sortAsc', 'sortDesc', 'clearSort',
  { dividerBefore: true },
  'hideColumn',
  'columnVisibility'
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
grid.isRowToolbarVisible = true
grid.rowToolbar = ['add', 'delete', 'duplicate', 'moveUp', 'moveDown']
grid.toolbarPosition = 'right'        // or 'left' / 'top' / 'inline' / 'auto'
grid.toolbarTrigger = 'hover'
```

See [`examples-toolbar.html`](../../../docs/examples-toolbar.html).

### Cell-specific toolbar

```javascript
grid.cellToolbar = (row, rowIndex, field, colIndex) => {
  if (field === 'status') {
    return [
      { id: 'approve', icon: '✅', title: 'Approve', onclick: ({ row }) => approve(row) }
    ]
  }
  return undefined
}
```

### Master / detail — react to row focus

```javascript
grid.onrowfocus = ({ row, rowIndex, previousRowIndex }) => {
  showDetailsFor(row)
}
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
grid.fillDragCallback = ({ sourceValue, targetCells, direction }) => {
  // Return false to cancel
  // Mutate targetCells.map(c => grid.updateRowById(c.rowId, { [c.field]: sourceValue })) inside
}
```

See [`examples-fill-handle.html`](../../../docs/examples-fill-handle.html).

### Row locking with external locks (WebSocket pattern)

```javascript
grid.rowLocking = {
  lockedMember: 'isLocked',
  lockInfoMember: 'lockInfo',
  lockedEditBehavior: 'block',
  lockTooltipCallback: (lockInfo, row) => `Locked by ${lockInfo.userName}`
}

// External lock from a WebSocket message:
socket.on('row-locked', ({ id, userName }) => {
  grid.lockRowById(id, { userName, lockedAt: new Date() })
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

grid.treePathMember = 'path'
grid.defaultExpandDepth = 1           // show roots + first level on load
```

The `isTree: true` column renders the chevron + indent. See [`examples-tree.html`](../../../docs/examples-tree.html).

### Server-side pagination + sort

```javascript
grid.paginationMode = 'server'
grid.isPageable = true
grid.pageSize = 25
grid.totalItems = 0                   // unknown until first response
grid.sortMode = 'multi'

grid.ondatarequest = async ({ sort, page, pageSize }) => {
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
grid.onfilterchange = async (filters) => {
  // filters: { fieldName: 'typed text', ... }
  const r = await fetch('/api/rows?' + new URLSearchParams(filters))
  grid.items = await r.json()
}
```

When `onfilterchange` is set, the grid bypasses internal client-side filtering — render filter inputs, fire the callback, trust you to replace `items`.

### Virtual scroll for large datasets

```javascript
grid.isVirtualScrollEnabled = true
grid.virtualScrollRowHeight = 38      // must be fixed
grid.virtualScrollThreshold = 1000    // auto-enable when items >= threshold
```

See [`examples-virtual-scroll.html`](../../../docs/examples-virtual-scroll.html).

### Infinite scroll (load-more pattern)

```javascript
grid.isInfiniteScrollEnabled = true
grid.infiniteScrollThreshold = 200    // px from bottom that triggers load
grid.hasMoreItems = true

window.addEventListener('wg-load-more', async () => {
  const next = await fetch('/api/rows?after=' + grid.items[grid.items.length - 1].id)
  const { items, hasMore } = await next.json()
  grid.items = [...grid.items, ...items]
  grid.hasMoreItems = hasMore
})
```

### Keyboard shortcuts

```javascript
grid.rowShortcuts = [
  {
    keys: 'Ctrl+S',
    label: 'Save row',
    handler: ({ row, rowIndex }) => saveRow(row)
  }
]
grid.isShortcutsHelpVisible = true    // shows help icon top-right
```

See [`examples-shortcuts.html`](../../../docs/examples-shortcuts.html).

### TypeScript

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

const grid = document.querySelector<HTMLElement & { columns: Column<Employee>[]; items: Employee[] }>('web-grid')!
grid.columns = columns
grid.items = []

grid.onrowchange = (detail: RowChangeDetail<Employee>) => {
  console.log(detail.field, detail.oldValue, '→', detail.newValue)
}
```

### Theming with `--base-*`

```html
<style>
  :root {
    --base-accent-color: #10b981;
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

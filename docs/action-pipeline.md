# Action Pipeline Architecture

The action pipeline is the centralized system for handling user interactions in the grid. Instead of scattering DOM manipulation across event handlers, interactions are modeled as **actions** that flow through a **pipeline** of **executors**.

## Why a Pipeline?

The grid has many interacting features: cell editing, dropdowns, navigation, selection, copy/paste, fill handle, context menus, datepickers, custom editors. Without a central system, each event handler would need to know about every other feature to avoid conflicts (e.g., "if dropdown is open, close it before starting navigation").

The pipeline solves this by:
1. **Decoupling events from effects** — DOM events map to abstract actions, executors handle effects
2. **Making state changes explicit** — every interaction is a named action with typed parameters
3. **Enabling composition** — actions can produce child actions, building complex flows from simple parts
4. **Surgical DOM updates** — executors update only the affected DOM elements, avoiding full re-renders

## Architecture Overview

```
DOM Event (keydown, click, mousedown, dblclick)
    │
    ▼
ActionPipelineAdapter (adapter.ts)
    │  Maps DOM events to GridAction objects
    │  Calls tryHandleKeyDown(), tryHandleClick(), etc.
    │
    ▼
EventMapper (event-mapper.ts)
    │  Pure function: (event, context) → GridAction | null
    │  No side effects, no DOM access
    │
    ▼
ActionPipeline (pipeline.ts)
    │  Routes actions to the correct executor
    │  Processes child actions depth-first
    │
    ▼
Executors (executors/*.ts)
    │  Each handles specific action types
    │  Can return child actions for composition
    │  Has access to ExecutorContext (GridContext + dispatch)
    │
    ▼
DOM / Grid State
```

## Key Components

### ActionPipelineAdapter (`adapter.ts`)

The bridge between the web component's event listeners and the pipeline. The web component's `attachEventListeners()` delegates to the adapter's `tryHandle*` methods:

- `tryHandleKeyDown(event)` — keyboard events in the table
- `tryHandleClick(event)` — single clicks on cells
- `tryHandleDblClick(event)` — double clicks on cells
- `tryHandleMouseDown(event)` — mousedown for toggle clicks, cell selection
- `clearSelection()` — public method to clear all selections through the pipeline

The adapter:
1. Determines the current cell, edit trigger mode, editor type
2. Calls the event mapper to get an action
3. Dispatches the action through the pipeline
4. Returns `true` if the event was handled (caller should `preventDefault`)

**Important:** The adapter contains mode-specific logic. For `editTrigger: 'always'`, clicks need different handling than `editTrigger: 'navigate'`. The adapter resolves these differences before dispatching.

### EventMapper (`event-mapper.ts`)

Pure mapping functions with no side effects:

- `mapKeyDownToAction(event, context)` — maps keyboard events to actions based on current state (dropdown open? editing? which editor type?)
- `mapMouseDownToActions(event, context)` — maps mousedown to action sequences
- `isPipelineKey(key)` — checks if a key should be handled by the pipeline

The mapper returns `null` when the event should NOT be handled by the pipeline (e.g., typing text into an input).

### ActionPipeline (`pipeline.ts`)

The core dispatcher. Simple but important design choices:

- **Executor registry** — each executor declares which action types it handles
- **Depth-first child processing** — when an executor returns child actions, they're processed before any remaining queued actions
- **Proxy-based context** — executors receive an `ExecutorContext` that extends `GridContext` with a `dispatch()` method, implemented via Proxy so property reads/writes go directly to the real context

```typescript
dispatch(action: GridAction): void {
    const queue: GridAction[] = [action]
    while (queue.length > 0) {
        const current = queue.shift()!
        const executor = this.executors.get(current.type)
        const childActions = executor.execute(execCtx, current)
        if (childActions?.length > 0) {
            queue.unshift(...childActions)  // depth-first
        }
    }
}
```

### Executors (`executors/*.ts`)

Each executor is a module that handles one or more related action types. An executor implements:

```typescript
interface ActionExecutor<T> {
    readonly handles: GridAction['type'][]
    execute(ctx: ExecutorContext<T>, action: GridAction): GridAction[] | void
}
```

Returning an array of `GridAction` produces child actions. Returning `void` or `[]` means no children.

#### Registered Executors

| Executor | Handles | Responsibility |
|----------|---------|---------------|
| `focusExecutor` | `focusCell`, `blurCell` | Set focused cell state, move DOM focus, update focus visual |
| `navigateExecutor` | `navigate` | Arrow keys, Tab, Enter, Home/End, Page Up/Down — resolves target cell and dispatches `transitionCell` |
| `transitionExecutor` | `transitionCell` | Compound: commit old cell → render old cell → focus new cell → start edit if needed |
| `editExecutor` | `startEdit`, `commitEdit`, `cancelEdit`, `escapeEdit` | Start/commit/cancel cell editing, handle escape (two-phase: close dropdown first, then cancel edit) |
| `renderExecutor` | `renderCell` | Re-render a single cell's DOM, optionally focus editor and set cursor position |
| `dropdownExecutor` | `openDropdown`, `closeDropdown`, `toggleDropdown`, `dropdownNavigate`, `dropdownSelect` | All dropdown lifecycle and interaction |
| `datepickerExecutor` | `openDatePicker`, `closeDatePicker`, `toggleDatePicker` | Date picker lifecycle |
| `customEditorExecutor` | `openCustomEditor` | Invoke `renderEditorCallback` for custom editor implementations |
| `checkboxExecutor` | `toggleCheckbox` | Toggle boolean cell value |
| `selectionExecutor` | `selectRow`, `selectColumn`, `clearSelection` | Row/column/cell selection state and visual updates (surgical DOM, no re-render) |
| `cellSelectionExecutor` | `startCellSelection` | Initiate cell range selection drag tracking |
| `clipboardExecutor` | `copy`, `paste`, `deleteCell` | Clipboard operations and cell clearing |
| `contextMenuExecutor` | `closeContextMenu` | Closes the cell / header menus (opening runs on core `openMenu()`, not the pipeline) |
| `fillHandleExecutor` | `startFillDrag`, `updateFillDrag`, `completeFillDrag` | Fill handle drag operations |
| `macroExecutor` | `resetState` | Expands into multiple primitive actions (cancel edit, clear selections, close overlays) |
| `noopExecutor` | `noop` | Consumes the event, does nothing (prevents propagation) |

## Action Categories

### State-change actions
Modify grid state (focused cell, editing cell, selections). Examples: `focusCell`, `startEdit`, `commitEdit`, `selectRow`, `clearSelection`.

### Effect actions
Trigger side effects (open/close UI elements). Examples: `openDropdown`, `closeDropdown`, `renderCell`.

### Compound actions
Produce child actions to build complex flows. Example: `transitionCell` commits the old cell, renders it, focuses the new cell, and optionally starts editing — all by dispatching child actions.

### Macro actions
Expand into multiple primitive actions for bulk operations. Example: `resetState` with default flags expands into `cancelEdit` + `clearSelection` + `closeDropdown` + `closeDatePicker` + `closeContextMenu`.

## Surgical DOM Updates

A critical design principle: **executors update only the affected DOM elements, avoiding full re-renders.**

When a cell gains focus, only that cell (and the previously focused cell) are re-rendered — the rest of the table stays untouched. This is why many grid methods have `_noRender` variants (e.g., `clearSelection_noRender()`). The executors handle the visual updates surgically, then use the `_noRender` variant to update state without triggering `requestUpdate()`.

Full re-renders (`requestUpdate()`) are reserved for structural changes: adding/removing rows, changing columns, sorting, filtering, pagination.

## Flow Example: Arrow Down Key

1. User presses Arrow Down
2. `attachEventListeners` captures keydown on table → calls `pipelineAdapter.tryHandleKeyDown(event)`
3. Adapter builds `EventMapperContext` (current cell, dropdown state, editor type)
4. `mapKeyDownToAction(event, context)` returns `{ type: 'navigate', direction: 'down' }`
5. Pipeline dispatches to `navigateExecutor`
6. Navigator calculates target cell (row + 1, same column, wrapping if needed)
7. Navigator returns `[{ type: 'transitionCell', from: {0,1}, to: {1,1} }]`
8. Pipeline dispatches child action to `transitionExecutor`
9. Transition executor returns:
   - `{ type: 'commitEdit' }` (if old cell was editing)
   - `{ type: 'renderCell', target: from }` (re-render old cell to remove edit state)
   - `{ type: 'focusCell', target: to }` (focus new cell)
   - `{ type: 'startEdit', target: to }` (if navigate mode, auto-start edit)
10. Pipeline processes each child action depth-first

## When NOT to Use the Pipeline

The pipeline handles interactions that originate from cells within the table. Some interactions are handled outside the pipeline:

- **Row selection drag** (`modules/selection/`) — uses its own mousedown/mousemove/mouseup tracking with document-level listeners
- **Cell range selection drag** (`modules/cell-selection/`) — same pattern, direct DOM manipulation during drag for performance
- **Column resize drag** (`modules/resize/`) — direct DOM manipulation
- **Column reorder drag** (`modules/reorder/`) — direct DOM manipulation
- **Toolbar clicks** — handled by `handleToolbarItemClick`/`handleInlineActionClick` in the web component, but uses `pipelineAdapter.clearSelection()` for selection cleanup
- **Tooltip hover** — purely visual, no state changes

The general rule: **mouse drag operations** with document-level listeners bypass the pipeline for performance (60fps mousemove handling). **Discrete interactions** (key presses, clicks) go through the pipeline.

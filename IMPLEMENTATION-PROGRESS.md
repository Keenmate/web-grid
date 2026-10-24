# Web-Grid-4 Implementation Progress

## Overview

Porting QuickGrid.svelte (web-grid-3) to TypeScript web component (web-grid-4).

**Status: ~90% complete**

> **API names below are historical.** The 2.0 interaction model (see `CHANGELOG.md` → Unreleased) renamed the callbacks, events and item shapes: lowercase `on*` properties became DOM events + camelCase twins (`row-change` / `onRowChange`, `action` / `onAction`, `data-request` / `onDataRequest`, …), every callback takes one `ctx` (`formatCallback` → `getDisplayValueCallback`, `beforeCommitCallback` → `validateCallback`, `cellEditCallback` → `renderEditorCallback`, …), toolbar / menu / shortcut items are core action items (`text`, `onClick`, `{ divider: true }`), built-ins are kebab-case (`move-up`, `sort-asc`) and do the work, and `el.grid` became `el.controller`. The "IMPLEMENTED" checklist uses the current names.

---

## Recent Changes (January 2026)

### Row Toolbar Top Position Enhancements
- **`toolbarTopPosition` property** - control horizontal alignment when toolbar is above row
  - `'start'` - align to left edge of row
  - `'center'` (default) - center horizontally on row
  - `'end'` - align to right edge of row
  - `'cursor'` - position at mouse cursor location
- **L-shaped connector arrows for top position** - vertical connectors when toolbar appears above row
  - Horizontal line from toolbar, then vertical line to target row
  - Arrow direction adapts based on row position relative to toolbar:
    - `length = 0` (row at same position): L pointing down to row's top edge
    - `length = -1` (row behind toolbar): U-turn loop on right side with left arrow
    - `length < -1` (row above): L going up with up-arrow to row's bottom edge
    - `length > 0` (row below): L going down with down-arrow to row's top edge
- **Arrow head spacing** - connector line stops 8px short of target to leave room for arrow head
- **Removed toolbar gap** - toolbar now touches row edge for reliable hover interaction

---

## Recent Changes (December 2025)

### Multi-Column Sorting & Server-Side Pagination
- **Multi-column sort** - Ctrl+Click to add columns to sort order
  - Click header: single-column sort (replaces all) - cycles none → asc → desc → none
  - Ctrl+Click: multi-column sort - adds column, toggles direction, or removes
  - Visual indicators: ▲¹ ▼² show direction and priority
- **Sort state property**: `grid.sort = [{ column: 'name', direction: 'asc' }, ...]`
- **Server-side pagination**:
  - `grid.totalItems = 500` - total items (for calculating pages)
  - `grid.currentPage = 1` - current page (1-based)
  - `grid.showPagination = false` - hide built-in pager
- **Data request event**: `grid.ondatarequest = (detail) => { ... }`
  - Fires on sort change (resets page to 1) or page change
  - `detail`: `{ sort: SortState[], page, pageSize, trigger: 'sort'|'page'|'init' }`

### Row Toolbar Trigger Modes
- **Click mode**: Click on row to show/toggle toolbar
- **Button mode**: Click ⋮ button in actions column to show toolbar
- **Hover mode**: Hover over row to show toolbar (existing)
- Fixed multi-grid issue: each grid's outside-click handler now only closes its own toolbar
- Added `isToolbarOwnedBy()` helper to check toolbar ownership by shadow root
- Button trigger: narrower actions column (24px), larger invisible hitbox for easy clicking
- localStorage persistence for toolbar settings (`wg-toolbar-trigger`, `wg-toolbar-align`)

### Row Toolbar Dividers
- Darker divider color (`#c0c0c0`) for better visibility
- Increased divider margin (`0 4px`) for clearer separation
- Added `flex-shrink: 0` to prevent divider collapse

### New Example Files
- `examples-contextmenu.html` - Context menu with dynamic items, currency converter dialog
- `examples-editable-full.html` - Comprehensive editing: validation, all editor types, custom JSON editor
- Updated `index.html` landing page with new example cards

### Row Toolbar Connector Arrow
- Connector arrow shows where a row moved to after moveUp/moveDown actions
- Bracket-shaped SVG path connects toolbar to current row position
- Arrow direction adapts to toolbar position (left/right/top)
- Connector clears when switching to a different row
- Ported from QuickGrid with proper row tracking by data reference (not index)

### Row Toolbar Positioning
- Left/right/top positioning based on available space (100px minimum threshold)
- `toolbarAlign` property: `'center'` or `'top'` for vertical alignment
- `toolbarTopPosition` property: `'start'`, `'center'`, `'end'`, or `'cursor'` for horizontal alignment when above row
- Toolbar touches row edge (no gap) for reliable hover interaction
- Viewport clamping keeps toolbar within visible area

### Date Editor - Calendar Picker
- Lightweight datepicker module extracted from web-daterangepicker (~1,200 lines)
- Rolling month/year selector for quick navigation
- Configurable date formats (YYYY-MM-DD, DD.MM.YYYY, etc.)
- Min/max date constraints
- Keyboard navigation (arrows, Enter, Escape, Tab, Home/End, PageUp/PageDown, Ctrl+arrows)
- Calendar button visible in read mode (same as dropdown toggle)
- Calendar button has same invisible hitbox as dropdown toggle
- Respects `dropdownToggleVisibility` setting
- Space key opens datepicker from focused cell
- Tab selects date and moves to next column
- Enter selects date and moves down
- Escape closes picker and cancels edit
- Type-to-edit replaces existing date value (not append)
- Direct typing in date input supports Enter/Tab commit
- Fixed positioning bug when switching between date cells
- Compact styling (reduced padding, margins, font sizes)
- All CSS values exposed as variables (`--wg-dp-*`) with `--base-*` fallbacks

### Editor Enhancements
- New `editStartSelection` property in EditorOptions
  - `'selectAll'` (default) - select all text on edit start
  - `'cursorAtStart'` - position cursor at beginning
  - `'cursorAtEnd'` - position cursor at end
- Click still positions cursor at click location (override)
- Type-to-start still puts cursor at end (override)

### Custom Editor
- `editor: "custom"` with `cellEditCallback` for dialog-based editing
- Callback receives context with `value`, `row`, `rowIndex`, `field`, `commit()`, `cancel()`
- Triggered by F2, Space, double-click, or navigate mode
- `commit()` saves value and returns focus to cell
- `cancel()` discards changes and returns focus to cell

### Context Menu
- Right-click on cells shows custom context menu
- Floating UI positioning with flip/shift for viewport boundaries
- Dynamic `label`, `visible`, `disabled` via callbacks
- `dividerBefore` for visual grouping
- `danger` styling for destructive actions
- `icon` support for menu items
- `oncontextmenuopen` event fires before menu renders
- Closes on outside click or Escape
- CSS variables with `--base-*` fallbacks

### Dropdown Navigation
- Arrow keys skip disabled options (ArrowUp/ArrowDown)
- Tab key does not commit disabled options
- Enter already handled via `selectDropdownOption()` which checks disabled

### Bug Fixes
- **Editor text alignment**: Fixed text shifting down 1-3px when entering edit mode
  - Added `line-height: inherit` to `.wg__editor`
  - Removed `height: 100%` and `bottom: 0` to let input size naturally
- **Sticky header scroll**: Fixed navigation with sticky header
  - First row was hidden under header on PageUp
  - Ctrl+Home/End only scrolled one axis at a time
  - Solution: `scrollIntoView` handles both axes, then `scrollBy` adjusts for header
- **Number field type-to-edit**: Fixed characters appearing in wrong order
  - Typing "54321" on number field resulted in "43215"
  - Root cause: `<input type="number">` doesn't support `setSelectionRange()`
  - Solution: Changed to `type="text" inputmode="numeric"` for cursor control
  - Value parsing now uses CSS class `.wg__editor--number` instead of input type
- **tooltipCallback receives raw value**: Fixed double formatting in tooltips
  - Was receiving formatted value (e.g., "$85,000") instead of raw value (85000)
  - User's tooltip formatting would double-apply (e.g., "$$85,000")
- **Datepicker Enter/Tab now saves calendar selection**: Fixed keyboard navigation
  - Arrow keys to navigate calendar, then Enter/Tab now correctly saves focused date
  - Grid handler delegates to datepicker when it's open (lets event bubble)
  - Datepicker handles Enter/Tab via document listener, calls onSelect with focused date
- **Datepicker Ctrl+Home/End shortcuts**: Added year navigation
  - Ctrl+Home jumps to January 1st of current year (repeat to go to previous year)
  - Ctrl+End jumps to December 31st of current year (repeat to go to next year)
  - Respects minDate/maxDate constraints
- **Datepicker Ctrl+Left/Right shortcuts**: Added month navigation alternatives
  - Ctrl+Left same as PageUp (previous month, maintains day position)
  - Ctrl+Right same as PageDown (next month, maintains day position)
- **Context menu fixes**: Fixed property names and rendering
  - Property is `contextMenu` (not `contextMenuItems`)
  - Context uses `cellValue` and `column.field` (not `value`/`field`)
  - Icon can now be a function: `icon: (ctx) => ctx.row.protected ? '🔓' : '🔒'`
  - Fixed opaque background fallback
- **Copy/paste support**: Ctrl+C/V in navigate mode
  - Ctrl+C copies focused cell value to clipboard
  - Ctrl+V pastes into focused cell (editable cells only)
  - `beforeCopyCallback` - transform value before copying
  - `beforePasteCallback` - process pasted value before applying

### Examples Restructure
- Landing page (`index.html`) with cards linking to examples
- Shared styles (`examples-shared.css`)
- `examples-basic.html` - Core grid with all editor types
- `examples-dropdowns.html` - Dropdown customization demo
- `examples-editors.html` - Custom editor and context menu demo

---

## IMPLEMENTED

### Core Grid
- [x] Display with column configuration
- [x] **Multi-column sorting** - click header for single, Ctrl+click for multi-column sort
- [ ] **Filterable columns** - logic exists but filter row UI NOT RENDERED
- [x] **Server-side pagination** - totalItems, currentPage, isPaginationVisible, data-request event
- [x] Striped/hoverable rows
- [x] Column alignment (left, center, right)
- [x] Column sizing (width, minWidth, maxWidth)
- [x] Text overflow (wrap, ellipsis)
- [x] Empty state messaging

### Editing Infrastructure
- [x] Edit triggers: click, dblclick, button, always, navigate
- [x] Per-column edit trigger override
- [x] Grid modes: read-only, excel, input-matrix
- [x] Draft row tracking (preserves dirty values)
- [x] Focus-based cell navigation
- [x] Type-to-edit (pressing key starts editing with that character)

### Editor Types
- [x] **Text** - maxLength, placeholder, pattern, inputMode
- [x] **Number** - min, max, step, decimalPlaces, allowNegative
- [x] **Checkbox** - trueValue/falseValue, always-editable mode
- [x] **Select** - static options, toggle rendering
- [x] **Combobox** - filterable dropdown, type-to-filter
- [x] **Autocomplete** - async search, debounce, min length
- [x] **Date** - calendar picker, minDate, maxDate, dateFormat, outputFormat (date/iso/timestamp)

### Validation
- [x] validateCallback - full ctx, async, transform value; runs for editor commits and paste
- [x] Invalid cells tracking (invalidCells array)
- [x] validation-error event (onValidationError)
- [x] Cell-level invalid CSS class

### Formatting & Rendering
- [x] getDisplayValueCallback - transform value to display string
- [x] renderCellCallback - return HTML string for cell
- [x] getTooltipCallback - dynamic tooltip per cell
- [x] tooltipMember - static tooltip from row property

### Dropdown Options
- [x] Static options array
- [x] Member properties: valueMember, displayMember, searchMember, iconMember, subtitleMember, disabledMember, groupMember
- [x] Callback overrides ({ option } ctx): getValueCallback, getDisplayValueCallback, getSearchValueCallback, getIconCallback, getSubtitleCallback, getIsDisabledCallback, getGroupCallback
- [x] renderOptionCallback - custom HTML for options
- [x] onSelect notification
- [x] allowEmpty/emptyLabel

### Row Toolbar
- [x] Built-in actions (do the work): add, delete, duplicate, move-up, move-down
- [x] Custom toolbar items (action items) with onClick
- [x] Toolbar positioning: left/right/top based on available space
- [x] toolbarVerticalAlign: top / center / bottom (vertical alignment)
- [x] toolbarHorizontalAlign: start/center/end/cursor (horizontal position when above row)
- [x] Toolbar triggers: hover, click, button
- [x] Disabled state (isDisabled or getIsDisabledCallback)
- [x] Danger styling (isDanger)
- [x] Divider entries ({ divider: true })
- [x] action event (onAction)
- [x] Connector arrow for move-up/move-down tracking (bracket-style for left/right, L-shaped for top)

### Tooltips
- [x] Cell tooltips (getTooltipCallback, tooltipMember)
- [x] Header info tooltips (headerInfo property, displays info icon)
- [x] Floating UI positioning with arrows
- [x] Configurable show/hide delays

### Events
- [x] row-change / onRowChange - fires with full RowChangeDetail
- [x] edit-start / onEditStart - fires when editing begins
- [x] edit-cancel / onEditCancel - fires when editing cancelled
- [x] validation-error / onValidationError - fires on validation failure
- [x] action / onAction - fires on any toolbar / menu / shortcut item
- [x] beforeContextMenuOpenCallback - runs before the context menu renders (false / replacement entries)

### Custom Editor
- [x] `editor: "custom"` with `renderEditorCallback`
- [x] Context with value, row, rowIndex, field, commit, cancel
- [x] Triggered by F2, Space, double-click, navigate mode

### Context Menu
- [x] Right-click opens context menu
- [x] Floating UI positioning
- [x] Dynamic getTextCallback / getIsVisibleCallback / getIsDisabledCallback
- [x] Divider entries, isDanger styling, icons
- [x] Close on outside click / Escape
- [x] CSS variables with --base-* fallbacks

---

## NOT IMPLEMENTED

### High Priority (Core Grid Features)

#### 1. Multi-Column Sorting - ✅ IMPLEMENTED
**Status:** FULLY WORKING
**Location:** `src/web-component.ts:1041-1100`, `src/grid.ts`

**Features:**
- Click header: single-column sort (replaces all), cycles none → asc → desc → none
- Ctrl+Click: multi-column sort - adds column, toggles direction, or removes
- Visual indicators: ▲¹ ▼² show direction and priority
- `grid.sort` property: `[{ column: 'name', direction: 'asc' }, ...]`
- `ondatarequest` event fires on sort change (resets page to 1)

#### 2. Filtering - Filter Row UI
**Status:** LOGIC EXISTS, UI NOT RENDERED
**Location:** `src/modules/rendering/table.ts`, `src/web-component.ts`
**Notes:** Filter logic works in grid.ts but no filter input row is rendered

**What exists:**
- `grid._filters` state (Record<string, string>)
- `grid._filterable` flag
- `filteredItems` getter applies filter logic
- CSS styles for `.wg__filter-row` and `.wg__filter-input`

**Tasks:**
- [ ] Add `renderFilterRow()` function in table.ts
- [ ] Render filter inputs for each filterable column
- [ ] Add input handler to update `grid._filters`
- [ ] Call `grid.requestUpdate()` on filter change

#### 3. Server-Side Pagination - ✅ IMPLEMENTED
**Status:** FULLY WORKING
**Location:** `src/web-component.ts:1348-1375`, `src/grid.ts`

**Features:**
- `grid.totalItems` - set total for server-side paging (null = client-side)
- `grid.currentPage` - get/set current page (1-based)
- `grid.showPagination` - show/hide built-in pager
- `ondatarequest` event fires on page change
- Prev/Next buttons, page info display

---

### Medium Priority

#### 4. renderCallback
**Status:** TYPE DEFINED, NOT IMPLEMENTED
**Location:** `src/types.ts:162`, needs `src/modules/rendering/table.ts`
**Notes:** CellRenderCallback type exists but never called

```typescript
// Column definition:
renderCallback?: (row: T, element: HTMLElement) => void
```

**Tasks:**
- [ ] After cell HTML is inserted, call renderCallback if defined
- [ ] Pass the cell element for DOM manipulation

#### 2. showEditButton
**Status:** TYPE DEFINED, NOT RENDERED
**Location:** `src/types.ts:177`, needs `src/modules/rendering/display.ts`
**Notes:** Property exists but no button appears in cells

```typescript
// Column definition:
showEditButton?: boolean
```

**Tasks:**
- [ ] Render edit button (pencil icon) in cell when showEditButton=true
- [ ] Add click handler to start editing
- [ ] Style button appropriately

### Low Priority

#### 3. Dropdown Width Customization
**Status:** NOT IMPLEMENTED
**Location:** `src/types.ts` (EditorOptions), `src/modules/dropdown/rendering.ts`
**Notes:** Dropdown always matches anchor width

```typescript
// EditorOptions (to add):
dropdownWidth?: string | number    // Custom width
dropdownMinWidth?: string | number // Minimum width
```

**Tasks:**
- [ ] Add types to EditorOptions
- [ ] Modify Floating UI size middleware in renderDropdown
- [ ] Convert number to px, pass string as-is

#### 4. Custom CSS Classes
**Status:** NOT IMPLEMENTED
**Location:** `src/types.ts` (Column), `src/modules/rendering/table.ts`

```typescript
// Column (to add):
cellClass?: string                              // Static class for all cells
cellClassCallback?: (value, row) => string|null // Dynamic class per cell
headerClass?: string                            // Class for header cell
```

**Tasks:**
- [ ] Add types to Column<T>
- [ ] Apply cellClass in renderDataRows
- [ ] Call cellClassCallback and apply result
- [ ] Apply headerClass in renderHeaderRow

#### 5. Custom Styles Injection
**Status:** NOT IMPLEMENTED
**Location:** `src/types.ts` (QuickGridProps), `src/web-component.ts`

```typescript
// QuickGridProps (to add):
customStylesCallback?: () => string  // CSS to inject into shadow DOM
```

**Tasks:**
- [ ] Add type to QuickGridProps
- [ ] Add property/setter to GridElement
- [ ] In render(), inject <style class="wg-custom-styles"> with callback result
- [ ] Remove old custom styles before re-render

---

## File Locations

| Area | Files |
|------|-------|
| Types | `src/types.ts` |
| Grid logic | `src/grid.ts` |
| Web component | `src/web-component.ts` |
| Editor rendering | `src/modules/editing/renderers.ts` |
| Table rendering | `src/modules/rendering/table.ts` |
| Cell display | `src/modules/rendering/display.ts` |
| Dropdown | `src/modules/dropdown/rendering.ts` |
| Demo | `index.html` |

---

## Next Steps

1. **renderCallback** - DOM manipulation after cell render
2. **showEditButton** - Pencil icon in cells to start editing
3. Then: Dropdown width customization, CSS classes, custom styles injection

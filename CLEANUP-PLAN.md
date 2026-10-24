# Web-Grid Library Cleanup Plan

## Overview
Clean up property names, CSS variables, and event/callback naming to align with web-multiselect and web-daterangepicker patterns.

**Status:** Complete (Published as 1.0.0-rc10)

> Historical (1.0). Several names below were renamed again by the 2.0 interaction model — e.g. `fillDragCallback` → `beforeFillCallback`, `cellClassCallback` → `getCellClassCallback`, the lowercase `on*` callbacks → DOM events + camelCase twins. See `CHANGELOG.md` → Unreleased for the current API.
**Scope:** Breaking changes (new library, no backwards compatibility needed)

---

## Progress Tracking

- [x] **Phase 1:** CSS Variable Cleanup
- [x] **Phase 2:** Event/Callback Renames
- [x] **Phase 3:** Boolean Property Renames
- [x] **Phase 4:** Update Examples/Docs
- [x] **Phase 5:** Verification

---

## 1. Events vs Callbacks Renames

Per CLAUDE.md: Events (`on*`) = fire-and-forget, Callbacks (`*Callback`) = return value affects behavior.

### Tasks

- [x] `onfilldrag` → `fillDragCallback` (returns boolean to cancel fill)
  - types.ts:509
  - grid.ts
  - fill-handle module
- [x] `onSearchCallback` → `searchCallback` (returns results, remove `on` prefix)
  - types.ts:107
  - dropdown modules

---

## 2. Boolean Property Renames

Per web-multiselect pattern: Boolean properties use `is*` prefix.

### Grid-Level Properties

- [x] `filterable` → `isFilterable`
- [x] `pageable` → `isPageable`
- [x] `striped` → `isStriped`
- [x] `hoverable` → `isHoverable`
- [x] `editable` → `isEditable`
- [x] `showRowNumbers` → `isRowNumbersVisible`
- [x] `stickyRowNumbers` → `isStickyRowNumbers`
- [x] `showRowToolbar` → `isRowToolbarVisible`
- [x] `showShortcutsHelp` → `isShortcutsHelpVisible`
- [x] `virtualScroll` → `isVirtualScrollEnabled`
- [x] `infiniteScroll` → `isInfiniteScrollEnabled`
- [x] `persistColumnWidths` → `shouldPersistColumnWidths`
- [x] `persistColumnOrder` → `shouldPersistColumnOrder`
- [x] `allowColumnReorder` → `isColumnReorderAllowed`
- [x] `checkboxAlwaysEditable` → `isCheckboxAlwaysEditable`
- [x] `dropdownShowOnFocus` → `shouldShowDropdownOnFocus`
- [x] `openDropdownOnEnter` → `shouldOpenDropdownOnEnter`
- [x] `summaryInline` → `isSummaryInline`

### Column-Level Properties

- [x] `sortable` → `isSortable`
- [x] `filterable` → `isFilterable`
- [x] `editable` → `isEditable`
- [x] `frozen` → `isFrozen`
- [x] `resizable` → `isResizable`
- [x] `hidden` → `isHidden`
- [x] `showEditButton` → `isEditButtonVisible`
- [x] `openDropdownOnEnter` → `shouldOpenDropdownOnEnter`

---

## 3. CSS Variable Cleanup

### 3.1 Add Component-Specific Variables

- [x] Add to `_variables.css`:
  ```css
  /* Dropdown */
  --wg-dropdown-option-gap: var(--wg-spacing-sm);
  --wg-dropdown-option-padding: calc(0.6 * var(--wg-rem)) calc(1.2 * var(--wg-rem));
  --wg-dropdown-empty-padding: calc(0.8 * var(--wg-rem)) calc(1.2 * var(--wg-rem));

  /* Inline Actions */
  --wg-inline-actions-padding: var(--wg-spacing-xs) var(--wg-spacing-sm);

  /* Toolbar */
  --wg-toolbar-row-gap: calc(0.2 * var(--wg-rem));
  --wg-toolbar-label-font-size: var(--wg-font-size-xs);

  /* Tooltip */
  --wg-tooltip-padding: calc(0.6 * var(--wg-rem)) calc(1.0 * var(--wg-rem));
  --wg-tooltip-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  ```

### 3.2 Replace Hardcoded Values

- [x] `_dropdown.css`: Replace generic spacing with component-specific variables
- [x] `_toolbar.css`: Replace hardcoded gap and font-size
- [x] `_dialogs.css`: Replace hardcoded padding and box-shadow

---

## 4. Files to Modify

### Core Files
- `packages/web-grid/src/types.ts` - Type definitions
- `packages/web-grid/src/grid.ts` - Property implementation
- `packages/web-grid/src/web-component.ts` - Attribute mapping

### CSS Files
- `packages/web-grid/src/css/_variables.css`
- `packages/web-grid/src/css/_dropdown.css`
- `packages/web-grid/src/css/_toolbar.css`
- `packages/web-grid/src/css/_dialogs.css`

### Module Files
- `packages/web-grid/src/modules/fill-handle/index.ts`
- `packages/web-grid/src/modules/dropdown/` (multiple files)
- All other modules referencing renamed properties

### Docs/Examples
- `docs/examples-*.html` (all example files)

---

## 5. Verification Checklist

- [x] Run `make build` - no TypeScript errors
- [x] Run `make dev` and test:
  - [x] Filtering with `isFilterable`
  - [x] Pagination with `isPageable`
  - [x] Fill handle with `fillDragCallback`
  - [x] Autocomplete search with `searchCallback`
  - [x] Column sorting with `isSortable`
  - [x] Row toolbar with `isRowToolbarVisible`
- [x] Test all example pages

---

## Summary Stats

| Category | Count |
|----------|-------|
| Event/Callback Renames | 2 |
| Grid Boolean Renames | 18 |
| Column Boolean Renames | 8 |
| CSS Variables to Add | ~8 |
| CSS Files to Update | 4 |

---

## Recent Changes (Session Work)

### Completed

- [x] **dropdownMinWidth option** - Added to EditorOptions for dropdowns wider than anchor cell
  - `types.ts` - Added `dropdownMinWidth?: string`
  - `modules/dropdown/rendering.ts` - Changed `width` to `minWidth` in Floating UI size middleware

- [x] **Dropdown highlight visibility** - Fixed for custom background colors
  - `css/_dropdown.css` - Added `box-shadow: inset 0 0 0 2px var(--wg-accent-color)` to highlighted state
  - Works with select, combobox, and autocomplete

- [x] **Product autocomplete example** - Added to examples-custom-styling.html
  - Custom `renderOptionCallback` with group-based colors (Electronics/Clothing/Food)
  - `cellClassCallback` for cell styling by product group
  - CSS variables for light/dark mode product colors
  - `editStartSelection: 'selectAll'`

- [x] **Theme toggle fix** - Prevents dropdown state corruption
  - `examples-custom-styling.html` - Calls `grid.cancelEdit()` before theme switch

- [x] **Comprehensive alignment support** - Cell, header, and dropdown alignment
  - `types.ts` - Added `horizontalAlign`, `verticalAlign`, `headerHorizontalAlign`, `headerVerticalAlign` to Column type
  - `modules/rendering/table.ts` - Headers and cells now apply both horizontal and vertical alignment
  - `modules/dropdown/rendering.ts` - Dropdown options inherit column alignment
  - `css/_header.css` - Removed hardcoded `text-align: left` (now from inline style)
  - `css/_dropdown.css` - Added `.wg__dropdown-option--align-{left|center|right}` modifiers

- [x] **Min row height CSS variable** - Configurable row height
  - `css/_variables.css` - Added `--wg-row-min-height: auto`
  - `css/_cells.css` - Added `height: var(--wg-row-min-height)` (height acts as min-height in tables)
  - `examples-custom-styling.html` - Added row height slider control

- [x] **Min header height CSS variable** - Configurable header height
  - `css/_variables.css` - Added `--wg-header-min-height: auto`
  - `css/_header.css` - Added `height: var(--wg-header-min-height)` (height acts as min-height in tables)
  - `examples-custom-styling.html` - Added header height slider control

- [x] **Renamed `align` to `horizontalAlign`** - Consistent with `verticalAlign`
  - `types.ts` - Changed `align` → `horizontalAlign`, `headerAlign` → `headerHorizontalAlign`
  - `modules/rendering/table.ts` - Updated all `column.align` → `column.horizontalAlign`
  - `modules/dropdown/rendering.ts` - Updated alignment reference
  - All example files updated

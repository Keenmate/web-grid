# E2E Test Coverage Checklist

Tracks which features of `web-grid` have end-to-end coverage in `e2e/`. Each row
is one user-observable feature. Status legend:

- `✗` — no coverage
- `△` — partial coverage (some paths)
- `✓` — covered
- `✗ fail` — pinned by a `test.fail` test (component bug, see `NOTES.md`)

When a row is `✓`/`△`, **Spec** points at the file under `e2e/` and **Fixture**
at the dedicated page under `docs/test/` (specs hit fixture pages only, never the
docs example pages). Known component bugs are tracked in `NOTES.md`; tests that
pin one are `test.fail(true, 'NOTES.md #N')`.

Run: `npx playwright test -c node_modules/.pw-12530.config.mjs --workers=2`
(private port 12530; the default config uses the dev server on 12400).
Every spec imports `test`/`expect` from `e2e/fixtures.ts`, which fails a test on
any uncaught page error; shared helpers live in `e2e/helpers.ts`.

---

## 1. Rendering & layout

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Initial render (headers, rows, formatted values) | ✓ | `basic.spec.ts` | `basic.html` |
| `isStriped`, `isSortable`, `isEditable`, `isPageable` toggles | ✓ | `basic.spec.ts` | `basic.html` |
| Row numbers (`isRowNumbersVisible`) | ✓ | `basic.spec.ts` | `basic.html` |
| `formatCallback` / cell class callbacks | ✓ | `basic.spec.ts`, `custom-styling.spec.ts` | `basic.html`, `custom-styling.html` |
| `cellClass`, `getCellClassCallback`, `getRowClassCallback`, `renderCellCallback` | ✓ | `custom-styling.spec.ts` | `custom-styling.html` |
| Container (max-height) vs full-height (`isTableBorderOnly`) | ✓ | `height-modes.spec.ts` | `height-modes.html` |
| `isHoverable`, `isStriped`, `isScrollable` + `scrollMaxHeight`, `isTableBorderOnly`, `isStickyRowNumbers` | ✓ | `display-options.spec.ts`, `freeze-panes.spec.ts` | `display-options.html`, `freeze-panes.html` |
| `scrollMaxHeight` reset to default (#34) | ✗ fail | `display-options.spec.ts` | `display-options.html` |
| Freeze panes (`freezeColumns`, column `isFrozen`) | ✓ | `freeze-panes.spec.ts` | `freeze-panes.html` |
| Column visibility (`isHidden`, hide-column / column-visibility menu) | ✓ | `column-visibility.spec.ts` | `column-visibility.html` |
| Virtual scroll (1,000 rows) + infinite scroll | ✓ | `virtual-scroll.spec.ts` | `virtual-scroll.html` |

## 2. Sorting, filtering, pagination

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Single sort, sort cycle, multi-sort | ✓ | `basic.spec.ts` | `basic.html` |
| Local pagination (page size, next/prev) | ✓ | `basic.spec.ts` | `basic.html` |
| Page-size selector updates the property | ✓ | `inputs.spec.ts` | `inputs.html` |
| `isFilterable` / `filters` / `setFilter` narrows rows (API only — no filter-row UI, NOTES #4) | ✓ | `filtering.spec.ts` | `filtering.html` |
| `filter-change` event detail + `onFilterChange` twin | ✓ | `filtering.spec.ts` | `filtering.html` |
| Filter change clamps the page (NOTES #5 fixed) | ✓ | `filtering.spec.ts` | `filtering.html` |
| Column `filterCallback` (incl. null = incomplete) | ✓ | `filtering.spec.ts` | `filtering.html` |
| Server `filterMode` → `filter-change`, no local filtering (no `data-request` — by design per the event table) | ✓ | `filtering.spec.ts` | `filtering.html` |
| Server `paginationMode` → `data-request` {page,pageSize,skip,trigger} | ✓ | `pagination.spec.ts` | `pagination.html` |
| Client paging buttons, disabled ends, `data-request` trigger page / pageSize | ✓ | `pagination.spec.ts` | `pagination.html` |
| `pageSizes`, `paginationLayout`, `paginationPosition` | ✓ | `pagination.spec.ts` | `pagination.html` |
| `isPaginationVisible: 'auto'` hides on one page | ✓ | `pagination.spec.ts` | `pagination.html` |
| `getPaginationLabelsCallback`, pagination `labels` | ✓ | `pagination.spec.ts` | `pagination.html` |

## 3. Editing

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Text / select / checkbox / custom editors | ✓ | `editors.spec.ts` | `editors.html` |
| Select / combobox / autocomplete in depth | ✓ | `dropdowns.spec.ts` | `dropdowns.html` |
| Date editor (open, select, keyboard, min/max, months) | ✓ | `datepicker.spec.ts` | `datepicker.html` |
| `editTrigger` click / dblclick / navigate, `shouldCommitOnClickAway` | ✓ | `edit-trigger.spec.ts` | `edit-trigger.html` |
| `editTrigger` 'always', column override, `editStartSelection` (grid + column, all 4 modes) | ✓ | `edit-modes.spec.ts` | `edit-modes.html` |
| `editTrigger: 'button'` has no button (#26, question) | ✗ fail | `edit-modes.spec.ts` | `edit-modes.html` |
| Number editor parsing (ints, decimals, padding, empty → null, negatives) | ✓ | `edit-modes.spec.ts` | `edit-modes.html` |
| Number editor rejects non-numbers / honours `editorOptions` min/max/decimals (#25) | ✗ fail | `edit-modes.spec.ts` | `edit-modes.html` |
| `dropdownToggleVisibility`, `shouldShowDropdownOnFocus`, `shouldOpenDropdownOnEnter` (grid + column), checkbox Space toggle | ✓ | `dropdown-flags.spec.ts` | `dropdown-flags.html` |
| `isCheckboxAlwaysEditable` (#27, dead flag) | ✗ fail | `dropdown-flags.spec.ts` | `dropdown-flags.html` |
| `mode` preset (read-only / excel / input-matrix) | ✓ | `grid-modes.spec.ts`, `inputs.spec.ts` | `grid-modes.html`, `inputs.html` |
| `validateCallback` (string / result / transform) | ✓ | `validation.spec.ts` | `validation.html` |
| `invalidCells` (read + assign) + `isCellInvalid` / `getCellValidationError` | ✓ | `validation.spec.ts` | `validation.html` |
| Fill handle (drag, cancel, direction constraint) | ✓ | `fill-handle.spec.ts` | `fill-handle.html` |
| Paste (single / multi-cell, modes, events, proxies) | ✓ | `paste.spec.ts` | `paste.html` |
| Drafts: dirty marking, indicator, `isCellDirty/isRowDirty/getRowDraft` | ✓ | `drafts.spec.ts` | `drafts.html` |
| Drafts follow their row through sort / filter, with and without `idMember` (#7 fixed) | ✓ | `drafts.spec.ts` | `drafts.html` |
| Cancel leaves no draft (#6 fixed), row-number marker right after the commit (#8 fixed) | ✓ | `drafts.spec.ts` | `drafts.html` |
| `discardRowDraft` / `discardAllDrafts`, `row-change` detail + twin | ✓ | `drafts.spec.ts` | `drafts.html` |
| New row: `isNewRowEnabled`, `newRowPosition`, `newRowIndicator`, empty-row draft, `createRowCallback` (paste) | ✓ | `new-row.spec.ts` | `new-row.html` |
| New row committed by Enter / Tab (focus stays on the fresh empty row), `createEmptyRowCallback` row lands (#17 fixed) | ✓ | `new-row.spec.ts` | `new-row.html` |
| Pasted numbers typed (#18) | ✗ fail | `new-row.spec.ts` | `new-row.html` |

## 4. Selection, copy, keyboard

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Row / column / cell-range selection, row focus | ✓ | `selection.spec.ts` | `selection.html` |
| `cellSelectionMode` click / disabled / shift; row + cell-range selection API | ✓ | `selection-api.spec.ts` | `selection-api.html` |
| Arrow navigation in navigate mode | ✓ | `basic.spec.ts` | `basic.html` |
| Home/End/PageUp/PageDown + Ctrl variants, Delete commits null, typing starts edit, Ctrl+G dialog | ✓ | `keyboard.spec.ts` | `keyboard.html` |
| Go-to-row Escape keeps focus (#24) | ✗ fail | `keyboard.spec.ts` | `keyboard.html` |
| Meta+G go-to-row (#3 fixed), Cmd+Delete row-delete | ✓ | `keyboard.spec.ts`, `events.spec.ts` | `keyboard.html`, `events.html` |
| Shift+Arrow range extension (#13, feature gap) | ✗ fail | `keyboard.spec.ts` | `keyboard.html` |
| `rangeShortcuts` on a range / row selection, disabled shortcut | ✓ | `keyboard.spec.ts` | `keyboard.html` |
| Number column ignores letters (GRID-1, #1 fixed) | ✓ | `keyboard.spec.ts` | `keyboard.html` |
| Ctrl+C cell / range / row / column TSV, `shouldCopyWithHeaders` | ✓ | `copy.spec.ts` | `copy.html` |
| Ctrl+C honours `getCopyValueCallback` (#1 fixed) and drafts (#9 fixed); clipboard rejection handled (GRID-2) | ✓ | `copy.spec.ts` | `copy.html` |
| `copySelectedRowsToClipboard`, `copyCellSelectionToClipboard`, failure → false | ✓ | `copy.spec.ts` | `copy.html` |
| `rowShortcuts`, Ctrl+U move, disabled callback, help overlay | ✓ | `shortcuts.spec.ts` | `shortcuts.html` |

## 5. Rows API & locking

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Row locking sources (`getLockInfoCallback`, `getIsLockedCallback`, `lockedMember`, `lockInfoMember`), marker + tooltip | ✓ | `row-locking.spec.ts`, `basic.spec.ts` | `row-locking.html`, `basic.html` |
| Lock tooltip i18n (#10) | ✗ fail | `row-locking.spec.ts` | `row-locking.html` |
| `lockRowById/unlockRowById/isRowLocked/getRowLockInfo/clearExternalLocks`, `row-lock-change` | ✓ | `row-locking.spec.ts` | `row-locking.html` |
| Lock blocks F2 / typing / paste; `lockedEditBehavior` allow / callback + `getCanEditLockedCallback` | ✓ | `row-locking.spec.ts` | `row-locking.html` |
| `getRowIdCallback` / `idValueMember`, `getRowId`, `updateRowById`, `replaceRowById`, `findRowById` | ✓ | `row-api.spec.ts` | `row-api.html` |
| `idMember` alone identifies rows (#11, question) | ✗ fail | `row-api.spec.ts` | `row-api.html` |
| `focusCell`, `startEditing` | ✓ | `row-api.spec.ts` | `row-api.html` |
| `startEditing` on a read-only cell (#19) | ✗ fail | `row-api.spec.ts` | `row-api.html` |

## 6. Menus, toolbar, interaction model

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Cell context menu (labels, visible/disabled/danger/divider/shortcut, offsets) | ✓ | `contextmenu.spec.ts`, `editors.spec.ts` | `contextmenu.html`, `editors.html` |
| Header context menu (predefined + custom) | ✓ | `contextmenu.spec.ts`, `resize-reorder.spec.ts` | `contextmenu.html`, `resize-reorder.html` |
| Row toolbar (floating / multi-row / inline / cell-aware) | ✓ | `toolbar.spec.ts` | `toolbar.html` |
| `toolbarTrigger` click / button, `toolbarPosition` left / right / top / inline, `toolbarHorizontalAlign`, `toolbarColumn`, `inlineActionsTitle` | ✓ | `toolbar-options.spec.ts` | `toolbar-options.html` |
| Inline actions header default label (#28) | ✗ fail | `toolbar-options.spec.ts` | `toolbar-options.html` |
| Core action items, contexts, `on*` twins, controller | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| Interaction-model open gaps: move-row focus (#14), range shortcuts in help (#16) | ✗ fail | `interaction-model.spec.ts` | `interaction-model.html` |
| Built-in order: `action` before the built-in (pinned; question #15); lock tooltip i18n → `row-locking.spec.ts` (#10) | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |

## 7. Columns

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Resize, persistence, `isResizable` opt-out | ✓ | `resize-reorder.spec.ts` | `resize-reorder.html` |
| Reorder, `isMovable` opt-out | ✓ | `resize-reorder.spec.ts` | `resize-reorder.html` |
| `gridName` + `shouldPersistColumnOrder` (save, restore, orphan cleanup), `setColumnOrder`, `isColumnReorderAllowed` off | ✓ | `column-order.spec.ts` | `column-order.html` |
| Persisted state with gridName set before columns (#29), `setColumnOrder` persisted (#30) | ✗ fail | `column-order.spec.ts` | `column-order.html` |

## 8. Tree

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Tree mode expand/collapse, Ctrl+Arrow, Tab nav, `isRowEditable`, tree column locked | ✓ | `tree.spec.ts` | `tree.html` |
| Predefined tree context-menu items (incl. clicking through) | ✓ | `tree.spec.ts` | `tree.html` |
| Tree + virtual / infinite scroll | ✓ | `tree-scroll.spec.ts` | `tree-scroll.html` |
| `treeExpandedGlyph` / `treeCollapsedGlyph` / `renderChevronCallback` | ✓ | `display-options.spec.ts` | `display-options.html` |

## 9. Events

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Row focus event | ✓ | `basic.spec.ts`, `selection.spec.ts` | `basic.html`, `selection.html` |
| Paste events | ✓ | `paste.spec.ts` | `paste.html` |
| `edit-start`, `edit-cancel`, `cell-selection-change`, `row-delete`, `expand-change` — once each, twin first, same detail | ✓ | `events.spec.ts` | `events.html` |
| `expand-change` detail is a snapshot (#12) | ✗ fail | `events.spec.ts` | `events.html` |

## 10. Theming, inputs, i18n, logging

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Dark-mode signals (per-instance, ancestor + theme-source, color-scheme, OS) | ✓ | `theming.spec.ts` | `theming.html` |
| Core theme context (page signal → `data-context-theme`), `--base-*` chain | ✓ | `theme-context.spec.ts` | `theme-context.html` |
| Contrast in dark mode (3 theme depths) | ✓ | `dark-mode.spec.ts` | `dark-mode.html` |
| Inputs: mode preset batch, sync property reads, invalid values rejected | ✓ | `inputs.spec.ts` | `inputs.html` |
| Table-driven attribute → property → removal → property loop over all 63 inputs; enum inputs reject unknown values | ✓ | `inputs.spec.ts` | `inputs.html` |
| `labels` across toolbar / header menu / pagination / shortcuts help / dropdown | ✓ | `i18n.spec.ts` | `i18n.html` |
| Nested `labels` merge (#31), go-to-row + chevron texts (#32) | ✗ fail | `i18n.spec.ts` | `i18n.html` |
| Logging silent by default, `getCategories`, `setCategoryLevel` | ✓ | `logging.spec.ts` | `logging.html` |
| `enableLogging` / `setLogLevel` reach the categories (#33) | ✗ fail | `logging.spec.ts` | `logging.html` |
| Summary row (`renderSummaryCallback` ctx, `summaryPosition`, `isSummaryInline`, `summaryMetadata`, totalItems) | ✓ | `summary.spec.ts` | `summary.html` |
| Summary refresh after an edit, draft-aware (#20) | ✗ fail | `summary.spec.ts` | `summary.html` |
| Tooltips: `getTooltipCallback`, `tooltipMember`, `isTooltipHtml`, `headerInfo`, validation tooltip (column / grid callback), `tooltipShowDelay` | ✓ | `tooltip.spec.ts` | `tooltip.html` |
| Tooltip / editor attribute escaping, no attribute injection from row data (#21 fixed) | ✓ | `tooltip.spec.ts`, `editors.spec.ts` | `tooltip.html`, `editors.html` |
| Validation tooltip without re-render (#22), `tooltipHideDelay` (#23) | ✗ fail | `tooltip.spec.ts` | `tooltip.html` |
| `shortcutsHelpPosition`, `renderShortcutsHelpCallback`, help visibility | ✓ | `display-options.spec.ts` | `display-options.html` |

## Not covered yet

- `cellToolbarOffset` (cell-aware toolbar offset) and `toolbarVerticalAlign` beyond the default.
- `shouldToolbarFollowCursor` positioning (only via the existing cell-aware toolbar tests).
- DOM move (disconnect → connect) state preservation — not in the grid WP; D1 applies to drp / dropzone / editor / cp.
- Async `createEmptyRowCallback` (Promise) and `beforeFillCallback` vetoes beyond `fill-handle.spec.ts`.
- `treeDoubleClickBehavior` / `defaultExpandDepth` are only exercised through `tree.spec.ts`.

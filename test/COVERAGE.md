# E2E Test Coverage Checklist

Tracks which features of `web-grid` have end-to-end coverage in `e2e/`. Each row
is one user-observable feature. Status legend:

- `✗` — no coverage
- `△` — partial coverage (some paths)
- `✓` — covered
- `✗ fail` — pinned by a `test.fail` test (component bug, see `NOTES.md`)

When a row is `✓`/`△`, **Spec** points at the file under `e2e/` and **Fixture**
at the dedicated page under `test/` (specs hit fixture pages only, never the
example pages). Known component bugs are tracked in `NOTES.md`; tests that
pin one are `test.fail(true, 'NOTES.md #N')`.

Run: `npm run test:e2e` (the devkit preset starts `npm run dev` on 12600, `package.json#kmwc.ports.dev`;
a scratch run on a private port overrides `use.baseURL` + `webServer`). Projects: chromium,
firefox, webkit (run webkit in its own invocation on Windows). `copy.spec.ts` uses the real
clipboard in Chromium only (Playwright grants `clipboard-read` only there); Firefox / WebKit get an
in-page `navigator.clipboard`. Platform skip: the responsive phone describe in Firefox (no `isMobile`).
Every spec imports `test`/`expect` from `e2e/fixtures.ts`, which fails a test on
any uncaught page error; shared helpers live in `e2e/helpers.ts`.

---

## 1. Rendering & layout

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Initial render (headers, rows, formatted values) | ✓ | `basic.spec.ts` | `basic.html` |
| `isStriped`, `isSortable`, `isEditingEnabled`, `isPagingEnabled` toggles | ✓ | `basic.spec.ts` | `basic.html` |
| Row numbers (`isRowNumbersShown`) | ✓ | `basic.spec.ts` | `basic.html` |
| `formatCallback` / cell class callbacks | ✓ | `basic.spec.ts`, `custom-styling.spec.ts` | `basic.html`, `custom-styling.html` |
| `cellClass`, `getCellClassCallback`, `getRowClassCallback`, `renderCellCallback` | ✓ | `custom-styling.spec.ts` | `custom-styling.html` |
| Container (max-height) vs full-height (`isTableBorderOnly`) | ✓ | `height-modes.spec.ts` | `height-modes.html` |
| `isHoverable`, `isStriped`, `isScrollable` + `scrollMaxHeight`, `isTableBorderOnly`, `isStickyRowNumbers` | ✓ | `display-options.spec.ts`, `freeze-panes.spec.ts` | `display-options.html`, `freeze-panes.html` |
| `scrollMaxHeight` reset to default — property and attribute paths (#34, test fixed) | ✓ | `display-options.spec.ts` | `display-options.html` |
| Freeze panes (`frozenColumnCount`, column `isFrozen`) | ✓ | `freeze-panes.spec.ts` | `freeze-panes.html` |
| Column visibility (`isHidden`, hide-column / column-visibility menu) | ✓ | `column-visibility.spec.ts` | `column-visibility.html` |
| Virtual scroll (1,000 rows) + infinite scroll | ✓ | `virtual-scroll.spec.ts` | `virtual-scroll.html` |
| Automatic virtual scroll (`isVirtualScrollEnabled` unset): below / above `virtualScrollThreshold`, `items` growing / shrinking across it, threshold change, explicit `true` / `false` (attribute + property) force, removing the attribute / `undefined` / `null` → automatic, focus kept | ✓ | `virtual-auto.spec.ts` | `virtual-auto.html` |
| An open edit (text, select dropdown, date picker) while `items` switches the grid between normal and virtual rendering: the edit goes on with its overlay and typed text, Enter / a pick saves; the edited row gone → cancelled once, focus on the grid | ✓ | `virtual-switch-edit.spec.ts` | `virtual-switch-edit.html` |
| Phone presentation (Pixel 7 descriptor): the cell dropdown (select / combobox / autocomplete) and the date editor as an edge-to-edge sheet (title, close button ≥ 44px, search field, focus inside, page locked); pick / close (saves) / Back (saves) / Escape (cancels) / keys; history entry consumed; live switch to the anchored panel on a tablet-size viewport and back; desktop unchanged | ✓ | `phone-sheet.spec.ts` | `phone-sheet.html` |
| Virtual grid keyboard moves past the rendered window (arrows one by one + held, Page Up / Down, Home / End, Ctrl+Home / End, Shift+Arrow range, Enter saving an edit) — focus lands on the target, dblclick + navigate modes | ✓ | `virtual-keyboard.spec.ts` | `virtual-scroll.html` (`#editGrid`, `?editTrigger=`) |

## 2. Sorting, filtering, pagination

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Single sort, sort cycle, multi-sort | ✓ | `basic.spec.ts` | `basic.html` |
| Local pagination (page size, next/prev) | ✓ | `basic.spec.ts` | `basic.html` |
| Page-size selector updates the property | ✓ | `inputs.spec.ts` | `inputs.html` |
| `isFilteringEnabled` / `filters` / `setFilter` narrows rows (API) | ✓ | `filtering.spec.ts` | `filtering.html` |
| Filter row (#4): inputs for `column.isFilterable`, label i18n, debounce / Enter / Escape → page 1, focus + caret + typed text survive re-renders, grid keys not reached, Tab order, `.invalid` for `filterCallback` null, sticky + frozen cells, server pagination → `beforePageChangeCallback` / `data-request` trigger `'filter'` | ✓ | `filter-row.spec.ts` | `filter-row.html` |
| `filter-change` event detail + `onFilterChange` twin | ✓ | `filtering.spec.ts` | `filtering.html` |
| Assigning `filters` / `setFilter(…, { isSilent: true })` is silent (no `filter-change`) | ✓ | `filtering.spec.ts` | `filtering.html` |
| Filter change → page 1, same-task page + filter keep the page, shorter `items` clamps (NOTES #5) | ✓ | `filtering.spec.ts` | `filtering.html` |
| `beforePageChangeCallback`: pager / page size / server sort, ctx, `false` / number / async (pager disabled, 2nd click ignored), skipped by programmatic page + client sort, `ctx.drafts` | ✓ | `pagination.spec.ts` | `pagination.html` |
| Column `filterCallback` (incl. null = incomplete) | ✓ | `filtering.spec.ts` | `filtering.html` |
| Server `filterMode` → `filter-change`, no local filtering (no `data-request` — by design per the event table) | ✓ | `filtering.spec.ts` | `filtering.html` |
| Server `paginationMode` → `data-request` {page,pageSize,skip,trigger} | ✓ | `pagination.spec.ts` | `pagination.html` |
| Client paging buttons, disabled ends, `data-request` trigger page / pageSize | ✓ | `pagination.spec.ts` | `pagination.html` |
| `pageSizes`, `paginationLayout`, `paginationPosition` | ✓ | `pagination.spec.ts` | `pagination.html` |
| `isPaginationShown: 'auto'` hides on one page | ✓ | `pagination.spec.ts` | `pagination.html` |
| `getPaginationLabelsCallback`, pagination `labels` | ✓ | `pagination.spec.ts` | `pagination.html` |

## 3. Editing

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Text / select / checkbox / custom editors | ✓ | `editors.spec.ts` | `editors.html` |
| Select / combobox / autocomplete in depth | ✓ | `dropdowns.spec.ts` | `dropdowns.html` |
| Date editor (open, select, keyboard, min/max, months) | ✓ | `datepicker.spec.ts` | `datepicker.html` |
| `editTrigger` click / dblclick / navigate, `shouldCommitOnClickAway` | ✓ | `edit-trigger.spec.ts` | `edit-trigger.html` |
| `editTrigger` 'always', column override, `editStartSelection` (grid + column, all 4 modes) | ✓ | `edit-modes.spec.ts` | `edit-modes.html` |
| `editTrigger: 'button'` edit button: editable / locked cells, hover + focused visibility, click edits, F2, `editButtonIcon` HTML + attribute, `labels.editCell`, `column.isEditButtonShown` (#26 fixed) | ✓ | `edit-modes.spec.ts` | `edit-modes.html` |
| Number editor parsing (ints, decimals, padding, empty → null, negatives) | ✓ | `edit-modes.spec.ts` | `edit-modes.html` |
| Number editor: strict parse, non-numbers / min / max / negatives invalid (no clamping), decimals round, min/max/step attributes, label i18n (#25 fixed) | ✓ | `edit-modes.spec.ts` | `edit-modes.html` |
| `dropdownToggleVisibility`, `shouldOpenDropdownOnFocus`, `shouldOpenDropdownOnEnter` (grid + column), checkbox Space toggle | ✓ | `dropdown-flags.spec.ts` | `dropdown-flags.html` |
| `isCheckboxAlwaysEditable` one-click toggle, off by default (#27 fixed) | ✓ | `dropdown-flags.spec.ts` | `dropdown-flags.html` |
| Every way an open dropdown closes (option click, Enter, Tab / Shift+Tab, Escape, outside click, another cell incl. one that starts its own edit, grid / page scroll, resize, virtual row scrolled out, items replaced, `startEditing()`, another overlay opening) + typed values — value, edit mode, focus, events pinned (Excel rule: leaving saves, Escape cancels; overlay WP1 / WP1b) | ✓ | `dropdown-close.spec.ts` | `dropdown-close.html` |
| Every way an open date editor (cell datepicker) closes (day click, Enter, Tab / Shift+Tab, Escape, outside click, another cell incl. one that starts its own edit, grid / page scroll, resize, virtual row scrolled out, items replaced, another overlay opening, `startEditing()`, `destroy()`) + a typed date before each — value, edit mode, focus, events pinned (overlay WP2) | ✓ | `datepicker-close.spec.ts` | `datepicker-close.html` |
| `overlayGroup` (`overlay-group`): the cell dropdown and the date editor join the core overlay tree in their group — a same-group overlay closes it / is closed by it, another group (incl. the default) stays open alongside, unset = default group, a change applies at the next open | ✓ | `overlay-group.spec.ts` | `overlay-group.html` |
| `preset` (read-only / excel / input-matrix; read-only sets `isReadonly`) | ✓ | `grid-modes.spec.ts`, `inputs.spec.ts` | `grid-modes.html`, `inputs.html` |
| `validateCallback` (string / result / transform) | ✓ | `validation.spec.ts` | `validation.html` |
| `invalidCells` (read + assign) + `isCellInvalid` / `getCellValidationError` | ✓ | `validation.spec.ts` | `validation.html` |
| Async `validateCallback` while moving between cells (one save per move, result applied in commit order) | ✓ | `validation-async.spec.ts` | `validation-async.html` |
| Fill handle (drag, cancel, direction constraint, `fill-direction` input — attribute / property / invalid value / column override; reordered + hidden columns — handle editability, filled field, horizontal span, `sourceCell` / `targetCells` column indices) | ✓ | `fill-handle.spec.ts` | `fill-handle.html` |
| Paste (single / multi-cell, modes, events, proxies) | ✓ | `paste.spec.ts` | `paste.html` |
| Drafts: dirty marking, indicator, `isCellDirty/isRowDirty/getRowDraft` | ✓ | `drafts.spec.ts` | `drafts.html` |
| Drafts follow their row through sort / filter, with and without `idMember` (#7 fixed) | ✓ | `drafts.spec.ts` | `drafts.html` |
| `getDrafts()` (incl. rows not in `items`), never pruned by `items`, `discardDraft(row)`, `replaceRowById` / `discardAllDrafts`, server-paging-without-id warning | ✓ | `drafts.spec.ts` | `drafts.html` |
| Cancel leaves no draft (#6 fixed), row-number marker right after the commit (#8 fixed) | ✓ | `drafts.spec.ts` | `drafts.html` |
| `discardDraft(row)` / `discardAllDrafts`, `row-change` detail + twin | ✓ | `drafts.spec.ts` | `drafts.html` |
| New row: `isNewRowEnabled`, `newRowPosition`, `newRowIndicator`, empty-row draft, `createRowCallback` (paste) | ✓ | `new-row.spec.ts` | `new-row.html` |
| New row committed by Enter / Tab (focus stays on the fresh empty row), `createEmptyRowCallback` row lands (#17 fixed) | ✓ | `new-row.spec.ts` | `new-row.html` |
| Pasted numbers typed (#18 fixed) | ✓ | `new-row.spec.ts` | `new-row.html` |
| Paste typing: number strict parse, checkbox texts / trueValue, date `dateFormat` → ISO → `outputFormat`, invalid text marked, `getPasteValueCallback` wins | ✓ | `paste.spec.ts` | `paste.html` |

## 4. Selection, copy, keyboard

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Row / column / cell-range selection, row focus; cell range with reordered + hidden columns (drag, Shift+Arrow — highlight, border, `getSelectedCells` agree); column selection with reordered + hidden columns (controller API by column index, `getSelectedColumns()` → `{ colIndex, field, column }` in on-screen order, header Shift+click, `column-selection-change` fields) | ✓ | `selection.spec.ts` | `selection.html` |
| `cellSelectionMode` click / disabled / shift; row + cell-range selection API | ✓ | `selection-api.spec.ts` | `selection-api.html` |
| Arrow navigation in navigate mode | ✓ | `basic.spec.ts` | `basic.html` |
| Home/End/PageUp/PageDown + Ctrl variants, Delete commits null, typing starts edit, Ctrl+G dialog | ✓ | `keyboard.spec.ts` | `keyboard.html` |
| Go-to-row Escape / Cancel keeps focus (#24 fixed) | ✓ | `keyboard.spec.ts` | `keyboard.html` |
| Meta+G go-to-row (#3 fixed), Cmd+Delete row-delete | ✓ | `keyboard.spec.ts`, `events.spec.ts` | `keyboard.html`, `events.html` |
| Shift+Arrow / Shift+Home/End / Ctrl+Shift+Arrow range from the focused cell, Shift+click in `click` mode, `disabled`, editing = text selection (#13 fixed) | ✓ | `keyboard.spec.ts` | `keyboard.html` |
| `rangeShortcuts` on a range / row selection, disabled shortcut | ✓ | `keyboard.spec.ts` | `keyboard.html` |
| Number column ignores letters (GRID-1, #1 fixed) | ✓ | `keyboard.spec.ts` | `keyboard.html` |
| Ctrl+C cell / range / row / column TSV, `shouldCopyWithHeaders` | ✓ | `copy.spec.ts` | `copy.html` |
| Ctrl+C honours `getCopyValueCallback` (#1 fixed) and drafts (#9 fixed); clipboard rejection handled (GRID-2) | ✓ | `copy.spec.ts` | `copy.html` |
| `copySelectedRowsToClipboard`, `copyCellSelectionToClipboard`, failure → false | ✓ | `copy.spec.ts` | `copy.html` |
| `rowShortcuts`, Ctrl+U move, disabled callback, help overlay | ✓ | `shortcuts.spec.ts` | `shortcuts.html` |

## 5. Rows API & locking

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| `insertRows` / `removeRow` (no `row-delete`), `scrollToRow(rowIndex)` → `Promise<boolean>` | ✓ | `row-api.spec.ts` | `row-api.html` |
| `clearSelection()` (all kinds) / `clearRowSelection()`, `selectedRows` (objects) / `selectedRowIndices` on element + controller | ✓ | `selection-api.spec.ts` | `selection-api.html` |
| Row locking sources (`getLockInfoCallback`, `getIsLockedCallback`, `isLockedMember`, `lockInfoMember`), marker + tooltip | ✓ | `row-locking.spec.ts`, `basic.spec.ts` | `row-locking.html`, `basic.html` |
| Lock tooltip i18n (#10 fixed) | ✓ | `row-locking.spec.ts` | `row-locking.html` |
| `lockRowById/unlockRowById/isRowLocked/getRowLockInfo/clearExternalLocks`, `row-lock-change` | ✓ | `row-locking.spec.ts` | `row-locking.html` |
| Lock blocks F2 / typing / paste; `lockedEditBehavior` allow / callback + `getCanEditLockedCallback` | ✓ | `row-locking.spec.ts` | `row-locking.html` |
| `getIdCallback` / `idMember`, `getRowId`, `updateRowById`, `replaceRowById`, `getRowById`, `getRowIndex` | ✓ | `row-api.spec.ts` | `row-api.html` |
| `idMember` is the only row-id member, default `'id'`; `idValueMember` / `getRowIdCallback` removed (#11 fixed) | ✓ | `row-api.spec.ts` | `row-api.html` |
| `focusCell`, `startEditing` | ✓ | `row-api.spec.ts` | `row-api.html` |
| `startEditing` on a read-only cell (#19 fixed) | ✓ | `row-api.spec.ts` | `row-api.html` |

## 6. Menus, toolbar, interaction model

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Cell context menu (labels, visible/disabled/danger/divider/shortcut, offsets) | ✓ | `contextmenu.spec.ts`, `editors.spec.ts` | `contextmenu.html`, `editors.html` |
| Header context menu (predefined + custom) | ✓ | `contextmenu.spec.ts`, `resize-reorder.spec.ts` | `contextmenu.html`, `resize-reorder.html` |
| Menu keyboard on core `openMenu()` (Shift+F10 / ContextMenu key on the focused cell, arrows skip disabled, Home/End, Enter/Space, Escape returns focus, submenu → / ←), `menuitemcheckbox` + `aria-checked` column toggles, `wg-context-menu` / `wg-header-menu` hooks, dismiss on page scroll and on the grid container's scroll (right-click menu: core rc21 point-menu rule) | ✓ | `context-menu-keyboard.spec.ts` | `contextmenu.html`, `column-visibility.html` |
| Menu CSS-variable chain (`--wg-context-menu-*` → `--km-menu-*` → `--base-*` → default; per instance, both menus; hover colour; z-index) | ✓ | `context-menu-theming.spec.ts` | `contextmenu.html` |
| Row toolbar (floating / multi-row / inline / cell-aware) | ✓ | `toolbar.spec.ts` | `toolbar.html` |
| `toolbarTrigger` click / button, `toolbarPosition` left / right / top / inline, `toolbarHorizontalAlign`, `toolbarColumn`, `labels.inlineActionsHeader` | ✓ | `toolbar-options.spec.ts` | `toolbar-options.html` |
| Row toolbar close paths per `toolbarTrigger` (hover / click / button): action click, outside click (pointer / keyboard), another row, same row, header, Escape, page / body scroll, items replaced, row removed, other overlays, `isDisabled`, a cell dropdown in the row, two grids | ✓ | `toolbar-close.spec.ts` | `toolbar-close.html` |
| Inline actions header default label (#28 fixed), explicit `""` → blank header | ✓ | `toolbar-options.spec.ts` | `toolbar-options.html` |
| Core action items, contexts, `on*` twins, controller | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| Range shortcuts in the shortcuts help (#16 fixed) | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| Row built-ins target the selection when the clicked row is in it (delete / duplicate / move as a block, selection follows; row toolbar keeps the selection) | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| Move-row built-in keeps focus on the moved row (#14 fixed) | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |
| Built-in order: built-in before the `action` event — listener sees add / delete / move results (#15 resolved); lock tooltip i18n → `row-locking.spec.ts` (#10) | ✓ | `interaction-model.spec.ts` | `interaction-model.html` |

## 7. Columns

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Resize, persistence, `isResizable` opt-out | ✓ | `resize-reorder.spec.ts` | `resize-reorder.html` |
| Reorder, `isReorderable` opt-out | ✓ | `resize-reorder.spec.ts` | `resize-reorder.html` |
| `storage-key` + `persist-column-order` (save to `km-state:web-grid:<key>`, restore, orphan cleanup, no key = nothing stored), `loadStateCallback` / `saveStateCallback` (whole state, reload), `setColumnOrder`, `isColumnReorderAllowed` off | ✓ | `column-order.spec.ts` | `column-order.html` |
| Persisted state with storage-key set before columns (#29 fixed), `setColumnOrder` persisted (#30 fixed) | ✓ | `column-order.spec.ts` | `column-order.html` |

## 8. Tree

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Tree mode expand/collapse, Ctrl+Arrow, Tab nav, `isRowEditable`, tree column locked | ✓ | `tree.spec.ts` | `tree.html` |
| Predefined tree context-menu items (incl. clicking through) | ✓ | `tree.spec.ts` | `tree.html` |
| Tree + virtual / infinite scroll | ✓ | `tree-scroll.spec.ts` | `tree-scroll.html` |
| Tree API `toggleRowExpanded` / `expandRows` / `collapseRows` / `expandAll(paths?)` / `collapseAll(paths?)` + `ExpandOptions` (`isExclusive`, `isSilent`), `expandedPaths` string[], menu `expand` (one level) / `expand-subtree` / selection targeting, `row-expand` / `row-collapse` / `expanded-change { paths }`, `controller.expandedPaths` | ✓ | `events.spec.ts`, `grid.tree.test.ts` (unit) | `events.html` |
| `treeExpandedGlyph` / `treeCollapsedGlyph` / `renderChevronCallback` | ✓ | `display-options.spec.ts` | `display-options.html` |

## 9. Events

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| Row focus event (`focus-change`) | ✓ | `basic.spec.ts`, `selection.spec.ts` | `basic.html`, `selection.html` |
| Assigning `focusedRowIndex` is silent; a cell click fires `focus-change` | ✓ | `events.spec.ts` | `events.html` |
| Paste events | ✓ | `paste.spec.ts` | `paste.html` |
| `cell-edit-start`, `cell-edit-cancel`, `cell-selection-change`, `row-delete`, `expanded-change` — once each, twin first, same detail | ✓ | `events.spec.ts` | `events.html` |
| `row-delete` after the fact: Ctrl/Cmd+Delete runs the `delete` built-in `{ rows, rowIndices }`; `beforeActionCallback` veto | ✓ | `events.spec.ts`, `interaction-model.spec.ts` | `events.html`, `interaction-model.html` |
| `cell-selection-change` `{ range, cellCount, fields, rows }`; `row-selection-change` `{ rows, rowIndices }` (row-number click / Ctrl / Shift / drag, API, cleared by a range); `column-selection-change` `{ fields }` (header click / Ctrl / Shift / drag, controller API, cleared by rows) — once per gesture (drag → on mouseup), silent on a no-op | ✓ | `events.spec.ts` | `events.html` |
| `getSelectedCells()` returns full cell contexts (`column`, `colIndex`, controller / element) | ✓ | `selection-api.spec.ts` | `selection-api.html` |
| `expanded-change` detail is a snapshot (#12 fixed) | ✓ | `events.spec.ts` | `events.html` |

## 10. Theming, inputs, i18n, logging

| Feature | Status | Spec | Fixture |
| --- | :-: | --- | --- |
| `readonly` (nothing editable, still focusable) / `disabled` (container inert) | ✓ | `inputs.spec.ts` | `inputs.html` |
| Core `defer` / `release()` / `ready` event / `ready` attribute | ✓ | `inputs.spec.ts` | `inputs.html` |
| `labels` JSON attribute, `labels.noData` / `noResults` / `''` blank, column `editorOptions.labels`, dropdown no-data / no-results | ✓ | `i18n.spec.ts` | `i18n.html` |
| Dark-mode signals (per-instance, ancestor + theme-source, color-scheme, OS) | ✓ | `theming.spec.ts` | `theming.html` |
| Core theme context (page signal → `data-context-theme`), `--base-*` chain | ✓ | `theme-context.spec.ts` | `theme-context.html` |
| Contrast in dark mode (3 theme depths) | ✓ | `dark-mode.spec.ts` | `dark-mode.html` |
| Inputs: mode preset batch, sync property reads, invalid values rejected | ✓ | `inputs.spec.ts` | `inputs.html` |
| Table-driven attribute → property → removal → property loop over all inputs; enum inputs reject unknown values | ✓ | `inputs.spec.ts` | `inputs.html` |
| `labels` across toolbar / header menu / pagination / shortcuts help / dropdown | ✓ | `i18n.spec.ts` | `i18n.html` |
| Nested `labels` merge (#31 fixed), go-to-row + chevron texts (#32 fixed) | ✓ | `i18n.spec.ts` | `i18n.html` |
| Logging quiet by default (`warn`), `getCategories`, `setCategoryLevel` | ✓ | `logging.spec.ts` | `logging.html` |
| `enableLogging` / `setLogLevel` reach the categories (#33 fixed — core `/logging`) | ✓ | `logging.spec.ts` | `logging.html` |
| Summary row (`renderSummaryCallback` ctx, `summaryPosition`, `isSummaryInline`, `summaryMetadata`, totalItems) | ✓ | `summary.spec.ts` | `summary.html` |
| Summary refresh after an edit (#20 refresh fixed) | ✓ | `summary.spec.ts` | `summary.html` |
| Summary `ctx.drafts` (draft values, other pages, server items swapped) (#20 fixed) | ✓ | `summary.spec.ts` | `summary.html` |
| Tooltips: `getTooltipCallback`, `tooltipMember`, `isTooltipHtml`, `headerInfo`, validation tooltip (column / grid callback), `tooltipShowDelay` | ✓ | `tooltip.spec.ts` | `tooltip.html` |
| Tooltip / editor attribute escaping, no attribute injection from row data (#21 fixed) | ✓ | `tooltip.spec.ts`, `editors.spec.ts` | `tooltip.html`, `editors.html` |
| Validation tooltip right after the commit, cleared by a valid one (#22 fixed) | ✓ | `tooltip.spec.ts` | `tooltip.html` |
| `tooltipHideDelay` (#23 fixed) | ✓ | `tooltip.spec.ts` | `tooltip.html` |
| Tooltip content resolved on show (no stale callback text); `--wg-tooltip-width` / `-min-width` / `-max-width` on an open tooltip | ✓ | `tooltip.spec.ts` | `tooltip.html` |
| `shortcutsHelpPosition`, `renderShortcutsHelpCallback`, help visibility | ✓ | `display-options.spec.ts` | `display-options.html` |
| `readonly` / `disabled`: presence rule (`="false"` still counts), reflected, the read-only preset reflects `readonly` | ✓ | `inputs.spec.ts` | `inputs.html` |
| Validated inputs: pagination / summary positions + pager layout (pipe lists), CSS lengths (`scrollMaxHeight`, `columnMinWidth`; number = px), `cellToolbarOffset`, `show-pagination` → `input-rejected` | ✓ | `inputs.spec.ts` | `inputs.html` |
| Typed inputs: every input an own core accessor, no input-table warning (C-CA-16) | ✓ | `inputs.spec.ts` | `inputs.html` |
| `customStyles` / `getCustomStylesCallback` (core `createCustomStyles`): attribute + property, callback wins + ctx, page-wide `window.components['web-grid'].customStyles` (order, live update, instance override), `@import` linked once in head and released by `destroy()` | ✓ | `custom-styling.spec.ts` | `custom-styling.html` |
| Properties set before `<web-grid>` is defined (`columns`, `items`, `pageSize`) applied at upgrade (core rc20) | ✓ | `pre-upgrade.spec.ts` | `pre-upgrade.html` |
| Self-initiated scrolls via core `scrollIntoContainer` + `beforeScrollCallback` (keyboard: `nearest`, page stays put; `scrollToRow`: centre + reveal; `false` skips, partial options replace; virtual-scroll jump) | ✓ | `scroll.spec.ts` | `scroll.html` |

## Not covered yet

- `cellToolbarOffset` (cell-aware toolbar offset) and `toolbarVerticalAlign` beyond the default.
- `shouldToolbarFollowCursor` positioning (only via the existing cell-aware toolbar tests).
- DOM move (disconnect → connect) state preservation — not in the grid WP; D1 applies to drp / dropzone / editor / cp.
- Async `createEmptyRowCallback` (Promise) and `beforeFillCallback` vetoes beyond `fill-handle.spec.ts`.
- `treeDoubleClickBehavior` / `expandLevel` are only exercised through `tree.spec.ts`.

# Test infrastructure notes

Running notes from building the e2e harness (`e2e/` + fixtures in `docs/test/`).
Each entry is something noticed while writing fixtures + specs that looks like a
bug, friction point, or worth-revisiting design decision in the **component** —
not a problem with the tests. Tests that pin a bug are marked
`test.fail(true, 'NOTES.md #N')`; when the bug is fixed the test starts passing,
Playwright reports it as an unexpected pass, and the marker should be removed.

IDs `GRID-n` come from the cross-repo plan
(`web-components-core/docs/e2e-coverage-plan.md`).

---

## 1. GRID-1 — duplicated cell key handling; the cell-keydown copy is dead code — FIXED

**Fixed:** one key path — the action pipeline adapter owns every built-in cell / editor key; the dead branches in `cell-keydown.ts` (Ctrl+C, arrows, Tab, Home/End/PageUp/PageDown, F2, Space, Delete, type-to-edit) and `editor-keydown.ts` (Enter, Tab, Escape, F2, closed-dropdown arrows) are gone. The number-column digit filter now lives in the adapter's type-to-edit branch; single-cell Ctrl+C goes through `engine.copyFocusedCellToClipboard()`, which honours `getCopyValueCallback`. Tests un-pinned.

**Where:** `packages/web-grid/src/modules/navigation/cell-keydown.ts:71-93`
(Ctrl+C) and `:394-410` (printable-key → start edit, with the number-column digit
filter) vs `packages/web-grid/src/modules/actions/adapter.ts:362-400`.

**Symptom:** the actions adapter runs first and `stopPropagation()`s Delete,
Ctrl+C and printable keys, so the matching branches in `cell-keydown.ts` never
run. The only place that filters non-numeric keys on a `editor: 'number'` column
is in the dead path — typing a letter on a number cell starts editing with that
letter.

**Repro:** focus a number cell in navigate mode, press `a` → the editor opens
with `a` in it.

**Suggested fix:** delete the dead branches from `cell-keydown.ts` and move the
number-column digit filter into the adapter's printable-key branch (or into the
`startEdit` executor).

**Test:** `keyboard.spec.ts` "a letter on a number column does not start editing"
(`test.fail`).

## 2. GRID-2 — `navigator.clipboard.writeText` rejection is unhandled — FIXED

**Fixed:** deleted with #1; every copy (keyboard and API) goes through the engine's `writeClipboardText`, which catches the rejection (API methods resolve false). `copy.spec.ts` "a clipboard rejection on Ctrl+C is handled".

**Where:** `cell-keydown.ts:90` (`navigator.clipboard.writeText(textValue)` — not
awaited, no `.catch`). Dead today because of #1, so no current e2e trips it; it
becomes live the moment the dead branch is revived instead of deleted. The live
path (`modules/actions/executors/clipboard-executor.ts:111`) awaits inside a
`try/catch` and is fine.

**Suggested fix:** delete with #1, or `.catch(() => {})` / route through the
clipboard executor.

**Note (WP0):** the pageerror guard surfaced an *unhandled* clipboard rejection
in the existing suite, but it came from the fixture page
(`docs/test/editors.html`, a context-menu `onClick` writing to the clipboard
without permission), not the component — fixed in the fixture with `.catch`.

## 3. GRID-3 — Ctrl+G go-to-row ignores `metaKey` — FIXED

**Fixed:** `ctrlKey || metaKey` (Cmd+Delete row-delete request too — `events.spec.ts`).

**Where:** `cell-keydown.ts:271-276` checks `e.ctrlKey` only; every other grid
shortcut accepts `ctrlKey || metaKey`.

**Symptom:** Cmd+G on macOS does nothing.

**Suggested fix:** `if (e.ctrlKey || e.metaKey)`.

**Test:** `keyboard.spec.ts` "Meta+G opens the go-to-row dialog" (`test.fail`).

## 4. No built-in filter UI — `isFilterable` is API-only (open question)

**Where:** `packages/web-grid/src/grid.ts:2034-2095` (`filteredItems`, `filters`,
`setFilter`, `getInvalidFilterFields`); `src/css/header.css:146-160`
(`.wg__filter-row`, `.wg__filter-input`); `types.ts:169` (`Column.isFilterable`).

**Observation:** nothing renders a filter row. `isFilterable` only gates whether
`filters` / `setFilter()` are applied; `Column.isFilterable` is never read;
`getInvalidFilterFields()` (meant to put an `.invalid` red border on the input
when `filterCallback` returns null, per the `filterCallback` JSDoc) has no caller;
the `.wg__filter-*` CSS and `--wg-filter-*` variables are orphaned. The README
advertises "per-column filtering".

**Question for the maintainer:** is a filter row planned (port from web-grid-3),
or should the dead option / CSS / JSDoc be removed and filtering documented as
API-only? `filtering.spec.ts` covers the API path only.

## 5. A filter change does not reset / clamp `currentPage` — FIXED

**Fixed:** client pagination clamps `currentPage` to the last page when the view shrinks (a filter, or a shorter `items`) — clamp rather than reset, so a page that still exists is kept and a restored page + filter set at init survives until the items arrive.

**Where:** `grid.ts:2087` (`setFilter`) and `:2081` (`filters` setter) — neither
touches `_currentPage`; `paginatedItems` (`:2130`) then slices past the end.

**Symptom:** on page 3 of a client-paginated grid, a filter that leaves one page
of matches renders an **empty grid** with "Page 3 of 1".

**Repro:** `isPageable = true; pageSize = 2; currentPage = 3; setFilter('city', 'brno')`.

**Suggested fix:** reset `_currentPage = 1` when the filters change (client mode),
or clamp `currentPage` to `totalPages` in `paginatedItems`.

**Test:** `filtering.spec.ts` "a filter change while on a later page keeps rows
visible" (`test.fail`).

## 6. Opening an editor and cancelling leaves a phantom draft — FIXED

**Fixed:** `startEdit` no longer clones the row into a draft (commitEdit / updateDraftValue create it lazily); a commit that brings the draft back to the original values (with no invalid cell) drops the draft; `isRowDirty` is value-based.

**Where:** `grid.ts` `startEdit()` (~`:2662`) clones the row into `_draftRows`
before anything is typed; `cancelEdit()` never removes it.

**Symptom:** F2 → Escape on a clean row makes `isRowDirty(i)` / `hasRowDraft(i)`
true and adds `i` to `getDraftRowIndices()` (so a "save all drafts" loop picks up
an unchanged row; the row-number dirty marker shows after the next full render).
`isCellDirty` stays false because it compares values.

**Suggested fix:** create the draft lazily in `commitEdit` / `updateDraftValue`
(already done there), or drop the draft in `cancelEdit` when it equals the item;
make `isRowDirty` value-based like `isCellDirty`.

**Test:** `drafts.spec.ts` "opening an editor and cancelling leaves the row clean"
(`test.fail`).

## 7. Drafts are keyed by display index — they jump rows on sort / page / filter — FIXED

**Fixed:** drafts are keyed by row identity — the `idMember` / `treePathMember` value, else the row object itself (never the display index). The index-based API (`getRowDraft(i)`, `isRowDirty(i)`, …) resolves the displayed row first; `getDraftRowIndices()` lists the display indices of displayed rows with a draft. `updateRowById` / `replaceRowById` also looked drafts up by the `items` index — fixed with it. New tests: no-`idMember` sort, filter.

**Where:** `grid.ts` `_draftRows: Map<number, T>` keyed by `rowIndex` (the
*display* index); `getCellRawValue`, `isCellDirty`, `isRowDirty`,
`getRowDraft` all look up by display index. (Invalid cells already use a stable
`rowKey`.)

**Symptom:** edit Gamma (index 2) → sort by name → Gamma moves to index 3 but
its draft stays at index 2, so **Delta's row now shows Gamma's draft**
(`{ id: 3, name: 'Zulu' }`) and is marked dirty; Gamma shows its original value.
Same on paging / filtering / tree collapse.

The `idMember` JSDoc (`types.ts:322`) already *claims* drafts are keyed by it
("pagination, filter, sort … no longer cause an in-flight edit to land on the
wrong row") — the fixture sets `idMember = 'id'` and the draft still jumps.

**Suggested fix:** key drafts by the stable row key (`getStableRowKey` / id),
like `_invalidCells`.

**Test:** `drafts.spec.ts` "a draft follows its row when the view is re-sorted"
(`test.fail`).

## 8. Row-number dirty marker is not refreshed after a commit — FIXED

**Fixed:** the surgical `renderCell` keeps the row-number `wg__row-number--dirty` marker in step.

**Where:** commit paths use the surgical cell update; the row-number cell
(`modules/rendering/table.ts:246/527`, `wg__row-number--dirty`) is only rebuilt
on a full render.

**Symptom:** with `is-row-numbers-visible`, editing a cell marks the cell
`wg__cell--dirty` immediately, but the row number only turns dirty after some
unrelated full render (sort, toggling a flag, …).

**Suggested fix:** update the row-number cell's class in the surgical commit path.

**Test:** `drafts.spec.ts` "the row-number dirty marker appears right after the
commit" (`test.fail`).

## 9. Copy ignores drafts (copies the original values) — FIXED

**Fixed:** the clipboard executor delegates to the engine copy methods (range / columns / rows / focused cell), which read `getCellRawValue` (draft-aware); objects copy as JSON on every path; a range copied with a cell focused now honours `shouldCopyWithHeaders`.

**Where:** `modules/actions/executors/clipboard-executor.ts:50,70,90,101` and
`grid.ts` `copySelectedRowsToClipboard` / `copySelectedColumnsToClipboard` /
`copyCellSelectionToClipboard` read `item[field]`, not `getCellRawValue()`.

**Symptom:** edit Apple → Apricot (draft, shown in the cell), Ctrl+C on the cell
copies `Apple`. Same for ranges / rows / columns. What you see is not what you copy.

**Suggested fix:** read through `engine.getCellRawValue(row, rowIndex, field)`
(draft-aware) everywhere a copy is built.

**Test:** `copy.spec.ts` "a focused cell copies its draft (edited) value" (`test.fail`).

**Related (#1):** single-cell Ctrl+C goes through the clipboard executor, which
ignores `column.getCopyValueCallback` (only the dead `cell-keydown.ts` path
honours it) — `copy.spec.ts` "a focused cell with getCopyValueCallback copies the
callback text" is `test.fail('NOTES.md #1')`. The executor also ignores
`shouldCopyWithHeaders` for a range copied while a cell (not the container) has
focus; the container-focus path (`modules/events/container-keydown.ts`) honours it.

## 10. Lock tooltip text is hard-coded English — FIXED

**Fixed:** `labels.rowLocked` / `labels.rowLockedBy` (`{lockedBy}`) via `engine.getLockTooltip()` in all four render sites.

**Where:** `modules/rendering/table.ts:239-241`, `:410`, `:520-522` —
`'Locked by ${lockedBy}'` / `'This row is locked'`; no `labels` key.

**Suggested fix:** add `labels.rowLocked` + `labels.rowLockedBy` (template with
`{lockedBy}`) to `GridLabels` / `DEFAULT_LABELS` and use them in all three places.
The key names in the test are a suggestion — adjust the test with the fix.
(Listed as an open gap in core `docs/interaction-model-plan.md`.)

**Test:** `row-locking.spec.ts` "the lock tooltip text is translatable through
labels" (`test.fail`).

## 11. Two row-identity inputs: `idMember` vs `idValueMember` (open question)

**Where:** `grid.ts:3174` `getRowId()` reads `getRowIdCallback` → `idValueMember`
only; `idMember` (`types.ts:322-326`) is used for the stable row key, built-ins
and duplicate.

**Observation:** a grid configured with just `idMember = 'id'` (what the
`idMember` JSDoc recommends) gets `findRowById` → null, `lockRowById` locks
nothing visible (row-lock-change with `row: null, rowIndex: -1`),
`updateRowById` / `replaceRowById` → false. You must also set
`idValueMember`. Two inputs for one concept is easy to get wrong.

**Question:** should `getRowId()` fall back to `idMember` (and `idValueMember` be
deprecated)? Fixtures set both for now.

## 12. `expand-change` hands out the grid's live `expandedPaths` Set — FIXED

**Fixed:** `expandedPaths: new Set(this._expandedPaths)` in all five `expand-change` notifications.

**Where:** `grid.ts:1420, 1429, 1436, 1457, 1475` —
`notify('expand-change', { …, expandedPaths: this._expandedPaths })`.

**Symptom:** a stored detail changes after later toggles (collapse 1.1 → detail
shows `['1']`; collapse 1 → the *same* earlier detail now shows `[]`). A consumer
that mutates `detail.expandedPaths` mutates the grid's state without a render.
Every other event detail is a snapshot (`filter-change` copies `filters`).

**Suggested fix:** `expandedPaths: new Set(this._expandedPaths)`.

**Test:** `events.spec.ts` "an earlier detail.expandedPaths is a snapshot"
(`test.fail`).

## 13. No keyboard range extension (Shift+Arrow) — feature gap (open question)

**Where:** `modules/navigation/cell-keydown.ts:96-125` — arrows ignore `shiftKey`;
ranges can only be made with the mouse (drag, or Shift+click twice in
`cell-selection-mode="shift"`) or `selectCellRange()`.

**Observation:** spreadsheet users expect Shift+Arrow (and Shift+Home/End,
Ctrl+Shift+Arrow) to grow a range from the focused cell; `rangeShortcuts` and
range copy are therefore mouse-only workflows. The README says "Click+drag or
Shift+click to select rectangular ranges", but in the default `click` mode a
Shift+click on a cell does *not* extend (only `shift` mode handles Shift+click).

**Question:** add Shift+Arrow range extension (and make Shift+click extend in
`click` mode)? `keyboard.spec.ts` "Shift+Arrow extends a range from the focused
cell" is `test.fail` until decided.

## 14. Focus is lost after a move-up / move-down built-in — FIXED

**Fixed:** the move-up / move-down built-in moves the focused cell with its row (the moved one or the swapped neighbour); the post-render restore then focuses it — repeated Alt+ArrowDown keeps moving the same row.

**Where:** `modules/items/index.ts` row built-ins (`moveRow`) re-render the rows;
nothing restores the focused cell.

**Symptom:** focus Beta's name cell, run `move-down` (row shortcut / toolbar) →
Beta moves to index 2 but no cell is focused, so repeated Alt+↓ (a typical
"move row" shortcut) stops after one step.

**Suggested fix:** after `moveRow`, `setFocusedCell(newIndex, colIndex)` and focus
the cell element when the source was the keyboard / the focused row.
(Open gap in core `docs/interaction-model-plan.md`.)

**Test:** `interaction-model.spec.ts` "a move-down built-in keeps keyboard focus on
the moved row" (`test.fail`).

## 15. `action` fires before the built-in — no "after" signal (open question)

`activateGridItem` → core `runAction`: beforeActionCallback → onClick → `action`
event → built-in. A listener on `action` for `delete` / `add` / `move-*` sees the
old `items`; there is no event (or awaited promise) after the built-in has
applied. The plan lists "built-ins run after the `action` event" as an open gap
without saying what the target is. `interaction-model.spec.ts` pins the current
order (passing test). **Question:** keep as is (consumers watch `items` /
`row-change`), add an `action-complete` style event, or pass a `done` promise on
the detail?

## 16. Shortcuts help omits `rangeShortcuts` — FIXED

**Fixed:** the help lists `rangeShortcuts` too (sub-heading `labels.rangeShortcuts`, "Selection shortcuts", when both lists exist) and shows when either list is non-empty; setting `rangeShortcuts` re-renders.

**Where:** `modules/rendering/shortcuts-help.ts` — renders only
`engine.rowShortcuts` (and returns '' when there are none, even with range
shortcuts configured).

**Suggested fix:** list `rangeShortcuts` too (own sub-heading, e.g.
`labels.rangeShortcuts`), and show the help when either list is non-empty.

**Test:** `interaction-model.spec.ts` "the shortcuts help lists the range
shortcuts too" (`test.fail`).

## 17. The new (empty) row can't be committed from the keyboard — FIXED

**Fixed:** the navigate executor turns Enter (and Tab on the empty row's last editable cell) while editing the empty row into `commitEdit { commitEmptyRow: true }`, then focuses the fresh empty row (Enter: same / Tab-start column, Tab: first editable column); the dead editor-keydown branches are deleted. Also fixed on the way: an empty row built before `columns` existed was cached without fields (the committed row lacked `id: null`). `new-row.spec.ts` + "after Enter commits the row, focus is on the fresh empty row".

**Where:** `modules/events/table-keydown.ts:98` runs the action pipeline before
`handleEditorKeyDown`; the pipeline maps editor Enter / Tab to a plain `navigate`
→ `commitEdit` **without** `commitEmptyRow` (`modules/actions/event-mapper.ts:118-170`,
`executors/navigate-executor.ts:38-45`). The empty-row commit logic in
`modules/editing/editor-keydown.ts:160-215` (Enter, Tab on the last editable
cell) is never reached — the same duplicated-handler pattern as GRID-1 (#1).

**Symptom:** with `is-new-row-enabled`, typing into the empty row and pressing
Enter / Tab-on-last-cell keeps the values in the empty-row draft forever; no row
is added to `items`, no `row-change` for the new row, `createEmptyRowCallback`'s
row never lands. (Only a dropdown Enter, `dropdownSelect` with
`commitEmptyRow: true`, can commit.)

**Suggested fix:** in the pipeline's navigate/commit path pass
`commitEmptyRow: true` for Enter, and for Tab when on the empty row's last
editable cell; then delete the dead editor-keydown branches.

**Tests:** `new-row.spec.ts` — 4 commit tests (`test.fail`).

## 18. Pasted values into `editor: 'number'` columns stay strings

**Where:** `modules/paste/index.ts` — pasted text is committed as-is; the number
editor path converts (`drafts.spec.ts` shows a typed `15` stored as a number).

**Symptom:** pasting `21` into a number column → draft `qty: "21"`; rows created
by a paste past the end get `"30"`. Sorting / summing / validation then see
strings.

**Suggested fix:** run pasted text through the column editor's parse step
(number → `Number()`, checkbox → boolean, date → the configured output format)
before `commitEdit` / `createRowCallback`.

**Test:** `new-row.spec.ts` "rows created by a paste get typed values" (`test.fail`).

## 19. `startEditing()` renders an editor into a cell the engine refused to edit — FIXED

**Fixed:** `startEditing` swaps in the editor only when the engine actually started editing that cell.

**Where:** `web-component.ts:1167-1187` — calls `engine.startEdit()` (which
silently returns for read-only / locked cells, `grid.ts:2653`) and then
unconditionally swaps the cell's DOM to `renderCellEditor(...)`.

**Symptom:** `startEditing(0, 3)` on a read-only column: no `edit-start`, the
engine is not editing, but an `<input>` appears in the cell (orphaned — Enter /
blur don't commit). Same for a locked row.

**Suggested fix:** only do the DOM swap when
`engine.editingCell?.rowIndex === rowIndex && field matches` after `startEdit`.

**Test:** `row-api.spec.ts` "startEditing a read-only cell does nothing" (`test.fail`).

## 20. Summary is not refreshed after a cell edit (and can't see drafts)

**Where:** commits use the surgical cell update (no full `render()`), and
`renderSummary` (`modules/rendering/table.ts:~810`) passes `displayItems` — the
original rows, not the drafts.

**Symptom:** edit qty 1 → 10 on page 1: the summary keeps `sum=6` (the callback
isn't even called again) until an unrelated full render; and after that render
it still sums the original `items` because the edit lives in a draft.

**Suggested fix:** re-render the summary area after `commitEdit` /
`row-change`; give the callback draft-aware rows (or a `getCellValue(row, field)`
helper on the ctx) so totals reflect what the user sees.

**Test:** `summary.spec.ts` "re-renders after an edit, and the sum sees the
edited (draft) value" (`test.fail`).

## 21. Tooltip attributes are not quote-escaped — FIXED

**Fixed:** `escapeHtml` (the one escape every template uses, text and attribute values) now escapes `" '` too — tooltips, editor `value="…"`, `data-value`, … can no longer be closed / injected by row data. Tests: quoted tooltip, attribute-injection attempt, quoted value in the text editor.

**Where:** `web-component.ts:1193` `escapeHtml()` (textContent → innerHTML)
escapes `& < >` but not `"`; the result is interpolated into `data-tooltip="…"`
/ `data-tooltip-html="…"` (`modules/rendering/table.ts:158, 347-372, 410, 627`).

**Symptom:** a tooltip text with a double quote (`Say "hi"`) is cut at the quote;
HTML tooltips with quoted attributes (`<b class="x">`) lose everything after the
first `"` — and the remainder is parsed as extra attributes on the `<td>`
(attribute injection from row data via `getTooltipCallback` / `tooltipMember`).

**Suggested fix:** an attribute-safe escape (`&quot;` / `&#39;` too) for every
attribute interpolation.

**Test:** `tooltip.spec.ts` "tooltip text containing double quotes survives"
(`test.fail`). The fixture's HTML tooltips avoid quoted attributes.

## 22. Validation tooltip only appears after a full render — FIXED

**Fixed:** the tooltip logic moved into one `getCellTooltip()` (`modules/rendering/table.ts`) used by both full row renderers and the surgical `renderCell`, which now sets / clears `data-tooltip` / `data-tooltip-html`.

**Where:** the commit path updates the cell surgically (adds
`wg__cell--invalid`) but not the `data-tooltip` / `data-tooltip-html` attribute,
which is only written by the full row renderer (`modules/rendering/table.ts:360-372`).

**Symptom:** after a failed commit the cell is red but hovering shows no error
until something re-renders the grid.

**Test:** `tooltip.spec.ts` "the error tooltip is there right after the failed
commit" (`test.fail`); the other validation-tooltip tests force a full render.

## 23. `tooltipHideDelay` is not honoured — FIXED

**Fixed:** root cause: leaving the grid closes the hover row toolbar, and `closeToolbarAndReset` / `showToolbarForRow` called `hideTooltip(ctx, 0)` to drop a toolbar-button tooltip — killing the cell tooltip immediately. They now hide only a tooltip anchored to a `.wg__toolbar-btn`.

**Where:** `modules/tooltip/event-listeners.ts:51` passes `ctx.tooltipHideDelay`
(reads back as 700 via property and attribute), yet the tooltip is gone ~350 ms
after the pointer leaves the cell. Not root-caused — something else removes the
tooltip (another `hideTooltip` / re-render path) before the hide timer fires.
`tooltipShowDelay` works.

**Test:** `tooltip.spec.ts` "tooltipHideDelay keeps it up after leaving" (`test.fail`).

## 24. Go-to-row Escape / Cancel loses the grid focus — FIXED

**Fixed:** Escape / Cancel / a backdrop click re-focus the cell that was focused when the dialog opened (`moveFocus`).

**Where:** `modules/navigation/go-to-row-dialog.ts:46-48` — `closeDialog()` just
removes the overlay; the focused `<input>` disappears, focus falls to `<body>`,
and the focus-out check (`modules/navigation/focus.ts:~540`) then clears
`focusedCell` a frame later.

**Symptom:** Ctrl+G → Escape: no cell is focused, arrow keys do nothing until the
user clicks back into the grid. (Go / Enter is fine — it focuses the target.)

**Suggested fix:** on cancel, re-focus the cell that was focused when the dialog
opened (`moveFocus(ctx, oldRow, colIndex)`).

**Test:** `keyboard.spec.ts` "Escape closes the dialog and returns focus to the
cell" (`test.fail`). Before this split the old combined test was flaky because it
read `focusedCell` before the deferred clear.

## 25. Number editor: no validation, documented options ignored

**Where:** `modules/editing/renderers.ts:86-108` (`renderNumberEditor` reads
`editorOptions` into `opts` and never uses it), parse in
`modules/actions/executors/edit-executor.ts:110-118` (`parseFloat`, falling back
to the raw string).

**Symptoms:**
- `abc` in a number column is committed as the **string** `"abc"`;
- `12abc` is silently truncated to `12` (`parseFloat`);
- `editorOptions.min / max / step / decimalPlaces / allowNegative` (`types.ts:113-118`)
  have no effect (500 with `max: 100` is stored as 500, `-3` with
  `allowNegative: false` as -3, `1.239` with `decimalPlaces: 2` as 1.239).

**Suggested fix:** strict parse (`Number()` + `isFinite`), reject / mark invalid
non-numbers, and apply the options (clamp or validation error — decide which),
or drop the options from the type.

**Tests:** `edit-modes.spec.ts` — 3 number-editor tests (`test.fail`).

## 26. `editTrigger: 'button'` has no button (open question)

**Where:** `types.ts:43` lists `'button'`; nothing renders an edit button —
only `modules/editing/lifecycle.ts:216` treats it like `click`/`dblclick` for
Tab auto-open. With `'button'` a cell can't be put into edit mode with the mouse
at all.

**Question:** implement the button (icon in editable cells, like the toolbar's
`toolbarTrigger: 'button'`), or remove the value?

**Test:** `edit-modes.spec.ts` "'button': an edit button in the cell starts
editing" (`test.fail`).

## 27. `isCheckboxAlwaysEditable` has no effect

**Where:** declared in the input table (`web-component.ts:376`), stored by the
engine (`grid.ts:566-570`), documented in `types.ts:360` ("Make checkboxes
always interactive, even in navigate mode") — never read anywhere.

**Symptom:** in navigate mode a click on a checkbox only focuses the cell (the
display checkbox is `disabled`, `modules/rendering/display.ts:41`); toggling
needs Space. Setting the flag changes nothing.

**Suggested fix:** when the flag (or `editTrigger: 'always'`) is on, render the
display checkbox enabled and toggle on click (dispatch `toggleCheckbox`).

**Test:** `dropdown-flags.spec.ts` "isCheckboxAlwaysEditable: one click on the
checkbox toggles it" (`test.fail`).

## 28. Inline actions header is blank by default — FIXED

**Fixed:** `inlineActionsTitle || labels.inlineActionsHeader` (an empty title falls back to the label).

**Where:** `modules/rendering/table.ts:85` —
`inlineActionsTitle ?? labels.inlineActionsHeader`; the input default for
`inline-actions-title` is `''` (`web-component.ts`, `toText({ default: '', isEmptyAllowed: true })`),
and `''` is not nullish, so the "Actions" label is never used.

**Suggested fix:** `inlineActionsTitle || labels.inlineActionsHeader` (or make the
input default `undefined`).

**Test:** `toolbar-options.spec.ts` "the inline actions header defaults to
labels.inlineActionsHeader" (`test.fail`).

## 29. Persisted column state is wiped when `gridName` is set before `columns` — FIXED

**Fixed:** `loadPersistedState()` with no columns yet defers (no pruning) and runs when `columns` is assigned.

**Where:** `web-component.ts:1001-1035` — the `gridName` /
`shouldPersistColumn*` setters call `loadPersistedState()` immediately;
`grid.ts:3522-3563` builds `validFields` from the *current* columns. With no
columns yet every stored entry is "orphaned", nothing is applied, and the
cleanup branch re-saves an **empty** state — the user's saved layout is lost.

**Symptom:** the natural setup order (config first, then `columns` / `items`)
never restores a persisted order / widths. Works only when `columns` are
assigned first (the `resize-reorder.html` fixture happens to do that).

**Suggested fix:** defer the load until columns exist (load on the `columns`
setter / first render when `gridName` is set), and never prune when the column
list is empty.

**Test:** `column-order.spec.ts` "the persisted order is restored when gridName
is set before the columns" (`test.fail`); `#late` covers the working order.

## 30. `setColumnOrder()` is not persisted — FIXED

**Fixed:** `setColumnOrder` / `setColumnWidths` save when the matching persist flag is on.

**Where:** `grid.ts:3602-3610` — updates `_columnOrder` and re-renders but never
calls `savePersistedState()` (a drag reorder does).

**Symptom:** with `shouldPersistColumnOrder`, an order applied through the API (e.g. a
"reset columns" button) is lost on reload / the previous drag order comes back.

**Suggested fix:** save in `setColumnOrder` (and `setColumnWidths`) when the
persist flag is on.

**Test:** `column-order.spec.ts` "setColumnOrder is persisted too" (`test.fail`).

## 31. `labels` merge is shallow — a partial `actions` / `contextMenu` wipes the rest — FIXED

**Fixed:** the `labels` setter deep-merges `actions` and `contextMenu`; new `GridLabelsInput` type (partial nested groups) for the setter.

**Where:** `grid.ts:904` — `this._labels = { ...DEFAULT_LABELS, ...value }`.

**Symptom:** `labels = { actions: { delete: 'Smazat' } }` → every other built-in
action label (`add`, `duplicate`, `move-up`, …, tree items) becomes `undefined`
(toolbar buttons lose their `aria-label`, menu items render empty). Same for
`labels.contextMenu`.

**Suggested fix:** deep-merge the nested `actions` / `contextMenu` groups.

**Test:** `i18n.spec.ts` "a partial nested labels.actions keeps the other action
labels" (`test.fail`).

## 32. Hard-coded English outside `labels` — FIXED

**Fixed:** `labels.goToRow` (`{max}`), `goToRowGo`, `goToRowCancel`, `treeExpand`, `treeCollapse` (+ #10's lock texts).

Not translatable today (no `labels` keys):
- go-to-row dialog — "Go to row (1-N):", "Cancel", "Go"
  (`modules/navigation/go-to-row-dialog.ts:33-37`);
- tree chevron `aria-label` "Expand" / "Collapse" (`modules/rendering/tree-render.ts:40`);
- lock tooltips (#10).

**Suggested fix:** `labels.goToRow` (template with `{max}`), `labels.goToRowGo`,
`labels.goToRowCancel`, `labels.treeExpand`, `labels.treeCollapse` — key names
in the test are a suggestion.

**Test:** `i18n.spec.ts` "the go-to-row dialog texts are translatable through
labels" (`test.fail`).

## 33. `enableLogging()` / `setLogLevel()` don't reach the category loggers

**Where:** `packages/web-grid/src/logger.ts` — a vendored `loglevel`
(`src/vendor/loglevel`), not core's `/logging`. `enableLogging()` /
`setLogLevel()` call `log.setLevel()` on the **root** logger; the `GRID:*`
child loggers were created (with the then-silent level) at module load and
don't follow. Only `setCategoryLevel()` produces output.

**Symptom:** the documented `window.components['web-grid'].logging.enableLogging()`
(see the `logger.ts` header) prints nothing.

**Suggested fix:** move to core `@keenmate/web-components-core/logging` like
dropzone (its `setLogLevel` re-levels every registered category), or loop over
`LOGGING_CATEGORIES` in `enableLogging` / `disableLogging` / `setLogLevel`.
**Question:** is the grid's logging migration to core `/logging` planned? (It is
the only migrated component still on a private loglevel copy.)

**Tests:** `logging.spec.ts` — 2 tests (`test.fail`).

## 34. `scrollMaxHeight` can't be reset to the default — FIXED

**Fixed:** not a component bug — the surgical render path already calls `removeProperty('--wg-scroll-max-height')`. The pinned test set the *property* and then removed an attribute that was never there (a DOM no-op, no attributeChangedCallback). Test rewritten to cover both real paths (property back to `'100vh'`, attribute set → removed); it passes without a code change.

**Where:** `web-component.ts:1603-1604, 1630-1631` — `--wg-scroll-max-height` is
only *set* when `scrollMaxHeight !== '100vh'`; nothing removes it.

**Symptom:** `scrollMaxHeight = '200px'` then back to `'100vh'` (or removing the
`scroll-max-height` attribute) keeps the 200px cap until the element is rebuilt.

**Suggested fix:** `removeProperty('--wg-scroll-max-height')` in the else branch.

**Test:** `display-options.spec.ts` "resetting scrollMaxHeight to its default
releases the custom cap" (`test.fail`).

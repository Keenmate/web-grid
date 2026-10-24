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

## 1. GRID-1 — duplicated cell key handling; the cell-keydown copy is dead code

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

## 2. GRID-2 — `navigator.clipboard.writeText` rejection is unhandled

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

## 3. GRID-3 — Ctrl+G go-to-row ignores `metaKey`

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

## 5. A filter change does not reset / clamp `currentPage`

**Where:** `grid.ts:2087` (`setFilter`) and `:2081` (`filters` setter) — neither
touches `_currentPage`; `paginatedItems` (`:2130`) then slices past the end.

**Symptom:** on page 3 of a client-paginated grid, a filter that leaves one page
of matches renders an **empty grid** with "Page 3 of 1".

**Repro:** `isPageable = true; pageSize = 2; currentPage = 3; setFilter('city', 'brno')`.

**Suggested fix:** reset `_currentPage = 1` when the filters change (client mode),
or clamp `currentPage` to `totalPages` in `paginatedItems`.

**Test:** `filtering.spec.ts` "a filter change while on a later page keeps rows
visible" (`test.fail`).

## 6. Opening an editor and cancelling leaves a phantom draft

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

## 7. Drafts are keyed by display index — they jump rows on sort / page / filter

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

## 8. Row-number dirty marker is not refreshed after a commit

**Where:** commit paths use the surgical cell update; the row-number cell
(`modules/rendering/table.ts:246/527`, `wg__row-number--dirty`) is only rebuilt
on a full render.

**Symptom:** with `is-row-numbers-visible`, editing a cell marks the cell
`wg__cell--dirty` immediately, but the row number only turns dirty after some
unrelated full render (sort, toggling a flag, …).

**Suggested fix:** update the row-number cell's class in the surgical commit path.

**Test:** `drafts.spec.ts` "the row-number dirty marker appears right after the
commit" (`test.fail`).

## 9. Copy ignores drafts (copies the original values)

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

## 10. Lock tooltip text is hard-coded English

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

## 12. `expand-change` hands out the grid's live `expandedPaths` Set

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

## 14. Focus is lost after a move-up / move-down built-in

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

## 16. Shortcuts help omits `rangeShortcuts`

**Where:** `modules/rendering/shortcuts-help.ts` — renders only
`engine.rowShortcuts` (and returns '' when there are none, even with range
shortcuts configured).

**Suggested fix:** list `rangeShortcuts` too (own sub-heading, e.g.
`labels.rangeShortcuts`), and show the help when either list is non-empty.

**Test:** `interaction-model.spec.ts` "the shortcuts help lists the range
shortcuts too" (`test.fail`).

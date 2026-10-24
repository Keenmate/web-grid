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

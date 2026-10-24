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

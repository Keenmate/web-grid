# Validation notes — accepted deviations

This file records intentional deviations from the BlissFramework
web-component validation script
(`C:\Git\BlissFramework\guidelines\web-components\`). Each entry
explains *why* the rule does not apply or why the canonical fix
would do more harm than good. Auto-check failures listed here
should be treated as expected.

## C-CS-5 — Monorepo Playwright fixture layout

The dark-mode contrast suite (and every other e2e spec) lives at the
**monorepo root** `e2e/`, not at `packages/web-grid/e2e/`, because
`playwright.config.ts` and the chromium browser install are shared
across the workspace. The C-CS-5 auto-script inspects the per-package
`e2e/` folder and reports the fixture missing — that's a false
negative.

- Config: `<repo-root>/playwright.config.ts`
- Suite: `<repo-root>/e2e/dark-mode.spec.ts`
- Run: `npx playwright test e2e/dark-mode.spec.ts` from the repo
  root.

## C-NC-9 — Action-pipeline `tryHandle*` idiom

The `ActionPipelineAdapter` uses `tryHandle*` (e.g. `tryHandleKeyDown`,
`tryHandleClick`) for its dispatch entrypoints in
`src/modules/actions/adapter.ts:161, 412, 449, 746, 800`. The
canonical naming convention is `handle*` for internal DOM handlers,
but the `try` prefix here signals the boolean return contract:

- `true` — the action pipeline owned the event; legacy handler skipped.
- `false` — pass through to the legacy handler.

The 4 call sites in `src/web-component.ts` (around lines 1900, 1942,
1996, 2081) are written as
`if (this.pipelineAdapter?.tryHandleX(e)) { ... }`. The boolean is
load-bearing — renaming to `handleX` would erase the visual cue that
the return value gates dispatch.

## C-NC-3 — Data-model booleans inherit HTML conventions

Two boolean fields the C-NC-3 auto-script flags as missing the
`is*` / `should*` / `has*` / `can*` prefix sit on **data-model**
interfaces rather than the component's Config / Props surface, and
follow HTML conventions on purpose:

- `multiple?: boolean` on the combobox / autocomplete editor option
  (`src/types.ts:114`) — mirrors `<select multiple>`.
- `nowrap?: boolean` on the column definition (`src/types.ts:179`) —
  mirrors the HTML `nowrap` attribute.

C-NC-3 explicitly carves out a "data-model interface" exemption for
this exact reason: a config field controls *the component*; a
data-model field describes *one item* and should match the HTML
shape consumers already know. The auto-script's regex can't tell
the two contexts apart, so it flags them every run; the verdict
should be ✅ Pass with this note as the citation.

Other boolean fields the script catches on data-model interfaces
(`disabled`, `selected`, `hidden`, `expanded`, `danger`, `cancel`,
`wasSkipped`, etc.) follow the same rule and are covered by the
same exemption — they're not individually listed here because they
match the canonical HTML names that C-NC-3's data-model exception
explicitly endorses.

## C-NC-6 / D-NC-7 = C — Member-only data extractors

Six `*Member` fields are intentionally **member-only** — they read
a property name off the row data, with no paired `get*Callback`:

- `idMember` (`src/grid.ts:320,1279`)
- `lockedMember` (`src/grid.ts`)
- `tooltipMember` (`src/types.ts:213`)
- `treeLevelMember` (`src/grid.ts:318`)
- `treeParentMember` (`src/grid.ts:319`)
- `treePathMember` (`src/grid.ts:317`)

No `get*Callback` pairs because:

- Tree identity / locking / row-tooltip text are 1:1 with a row
  property in every consumer scenario the grid has seen; a function
  override would be ceremony with no use case.
- Adding `getIdCallback` / `getLockedCallback` / `getTooltipCallback`
  / etc. would double the public surface (12 fields instead of 6)
  for a feature nobody asked for.

If a real use case appears (computed tree paths, derived row
identity, formatted tooltip text), add the matching `get*Callback`
field then — the design isn't closed, just intentionally lean.
This matches D-NC-7 = C ("Member only") in
`naming-conventions.decisions.md`. The C-NC-6 auto-script doesn't
know the team picked C, so it re-promotes the absence to a Fail
every run; the verdict should be ✅ Pass with this note as the
citation.

## C-NC-7 / D-NC-9 = No — Property-based config, no ATTRIBUTE_TABLE

`@keenmate/web-grid` configures itself through **JavaScript
properties** on the custom element, not HTML attributes. The
README's quick start makes this explicit:

```js
grid.items = [...]
grid.columns = [...]
grid.isStriped = true
grid.sortMode = 'multi'
grid.mode = 'excel'
```

There is no `ATTRIBUTE_TABLE` constant, no `observedAttributes`
getter, no `attributeChangedCallback` — `src/web-component.ts`
deliberately omits the full custom-elements attribute lifecycle.
The only HTML attributes the component honors are the universal
ones (`data-theme`, `data-bs-theme`) handled entirely in CSS via
`:host([data-theme="dark"])` etc.

This matches D-NC-9 = No: the data the grid takes (rows × columns,
each with callbacks, type tags, validation policies) doesn't fit a
flat attribute-string surface, and serializing a `QuickGridProps<T>`
through HTML attributes would lose its type safety. Consumers who
need declarative HTML use a single tag with no attributes and wire
properties via JavaScript on `connectedCallback`.

C-NC-7 expects the `ATTRIBUTE_TABLE` source-of-truth idiom; without
it the auto-script flags the file every run. The verdict should be
✅ Pass with this note as the citation: D-NC-9 was answered "No"
intentionally; the grid's config surface is JavaScript properties,
not HTML attributes.

## C-CST-8 / C-NC-11 — `@deprecated` *Type / *Info aliases retained for one release

The closed-set TS suffix rule (no `Type`, `Info`, `Data`, `Object`,
`Model`) was honored in this release: every canonical type was
renamed to drop the forbidden suffix. The originals were retained as
`@deprecated` type aliases so consumers can migrate at their own
pace, and dropped in the next major.

| Old name (`@deprecated`) | New canonical name |
|---|---|
| `EditorType` | `Editor` |
| `PredefinedToolbarItemType` | `PredefinedToolbarItem` |
| `RowActionType` | `RowAction` |
| `PredefinedContextMenuItemType` | `PredefinedContextMenuItem` |
| `PredefinedHeaderMenuItemType` | `PredefinedHeaderMenuItem` |
| `RowLockInfo` | `RowLock` |
| `ClickEventType` | `ClickEventKind` |
| `FocusEventType` | `FocusEventKind` |
| `FormatInfo` | `FormatSpec` |

Each `@deprecated` alias is a single one-liner — `export type
EditorType = Editor` — placed immediately after the canonical
declaration. The auto-script `^export\s+(type|interface)\s+\w+(Type|Info|…)`
regex matches these aliases and reports 9 violations every run; the
verdict for those 9 should be ✅ Pass with this note as the
citation. After the next major drops the aliases, the script will
read clean unaided and this section can be removed.

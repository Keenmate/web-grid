# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Target: **2.0.0-rc01** — a major: the callback, event and item API below is breaking, so
`^1.x` consumers (web-grid-showcase `^1.0.0`) must not auto-pull it.

### Date editor on core `createPopover()` (overlay WP2, 2026-11-10)
- **Internal:** the date cell editor's picker is a core `createPopover()` in the grid's shadow root (was a
  bare `anchor()` + its own document `mousedown` outside-click and Escape handling). One close handler
  maps each reason to save / cancel / nothing (`modules/datepicker/element-handlers.ts`), shared by both
  openers (F2 / Enter and the calendar button); the edit ending any other way closes the picker. The
  picker's outer `.wg-datepicker-container` is now the positioned panel (the calendar inside is in flow).
  Every close path is pinned by `e2e/datepicker-close.spec.ts`.
- **Changed: a click outside the picker saves the edit** (was: cancel), like every other editor since WP1b.
- **Changed: a scroll that moves the edited cell cancels the edit** (was: the picker stayed open; in a
  virtual grid it vanished and the edit went on), like the cell dropdown.
- **Changed: the date editor joins the page-wide overlay tree** in the `overlay-group` group: another
  overlay of the group opening (or `dismissAllOverlays()`) closes it and saves the edit; it opening closes
  the others.
- **Changed:** `destroy()` with the picker open no longer cancels the edit / fires `cell-edit-cancel`.
- **Fixed:** a date typed into the editor was lost when leaving the cell (Enter / Tab / another cell /
  click outside / `startEditing()` saved the old value); the typed date is now the picked day and is saved.
- **Fixed:** Shift+Tab in the picker moved to the NEXT cell; it moves to the previous one.
- **Fixed:** clicking another (read-only) cell while the picker was open left focus on the edited cell.
- **Changed: `items` replaced while the picker is open reopens it on the re-rendered cell** (D7), with the
  text typed so far, the date it stands for and the caret kept (was: the picker closed, the typed text was
  lost and the edit went on without a picker). When the edited row no longer exists, the edit is
  cancelled (below).
- Unchanged: a window resize keeps it open (placed).
- **Fixed: `items` replaced without the edited row cancels the edit** — any editor (text, number, select,
  combobox, autocomplete, date): `cell-edit-cancel` fires once (with the row it was on), its dropdown / date
  picker closes and keyboard focus moves to the grid. Was: the engine kept a dangling edit with no editor
  (no event, an open dropdown stayed on the vanished cell, focus fell to `<body>`, and a later `items`
  bringing the index back showed the editor again).
- **Changed: an invalid or incomplete typed date is saved on leave, marked invalid** (D9), like a pasted
  one: leaving the cell any way but Escape (Enter / Tab / Shift+Tab, another cell, a click outside,
  another overlay, `startEditing()`) keeps the typed text in the draft with the parse error
  `labels.invalidDate` ('Not a valid date'): the cell gets `wg__cell--invalid` + its tooltip,
  `validation-error` and `row-change` fire, the edit ends. Was: the old date stayed (Enter / Tab picked
  the old day). Text outside the column's `minDate` / `maxDate` counts as not a date. Arrow-key calendar
  navigation after typing makes Enter / Tab pick the navigated day again. Escape still cancels.
- **Fixed:** a date cell holding invalid text (typed or pasted) showed a rolled-over date
  ('2026-02-31' as 2026-03-03); it shows the text as typed.

### Added — `overlay-group` (2026-11-10)
- **`overlay-group` attribute / `overlayGroup` property** (`string | null`, default unset): scopes the
  cell dropdown's "one overlay open at a time" coordination to a named group, like web-multiselect and
  web-daterangepicker. Overlays sharing a group dismiss each other when one opens; different groups are
  independent. Unset = the default (ungrouped) group, as before. Read when the dropdown opens (a change
  applies at the next open, no rebuild). Pinned by `e2e/overlay-group.spec.ts`.

### Cell dropdown on core `createPopover()` (overlay WP1, 2026-11-10)
- **Internal:** the select / combobox / autocomplete dropdown is a core `createPopover()` in the grid's
  shadow root (was a bare `anchor()` + the grid's own scroll listeners). One close handler maps each
  reason to save / cancel / nothing (`modules/dropdown/rendering.ts`); the grid's private scroll-close
  (`handleScrollCloseDropdown`, the dropdown branches of the container / window scroll handlers) is gone.
  Every other close path (option pick, Enter, Tab, Escape, blur, outside click, another cell) is the
  grid's as before; the result of each is pinned by `e2e/dropdown-close.spec.ts`.
- **Changed (visible timing):** the panel stays hidden until its first placement (core), instead of
  showing at the shadow root's top-left for a frame. A scroll closes it (cancelling the edit, as before)
  only once the cell has actually moved: a scroll of under 3px, a horizontal scroll that leaves a frozen
  (sticky) cell in place, or the browser's own scroll-into-view while it opens no longer closes it.
- `destroy()` closes an open dropdown.

### Leaving a cell saves, Escape cancels — the Excel rule (overlay WP1b, 2026-11-10)
- **Changed: a click outside the grid saves the edit** (was: cancel) — for every editor, as a click on
  another cell already did: combobox / autocomplete commit what the input shows, text / number / date
  their typed value; a select with no new pick changes nothing. `shouldCommitOnClickAway: false` keeps
  discarding (both paths).
- **Changed: `startEditing(r, c)` saves an edit open on another cell first** (its dropdown closes), so
  only one cell is ever in edit mode; focus that was in the old editor moves to the new one.
- **Changed: the cell dropdown joins the page-wide overlay tree** (core, default group): another overlay
  opening (a multiselect / date picker / menu, `dismissAllOverlays()`), or the overlay the grid lives in
  closing, closes it and saves the edit.
- **Fixed:** a combobox left by a click on another cell saved the option's LABEL (`'Phone'`) instead of
  its value (`'phone'`).
- **Fixed:** a select left without a pick by a click on another cell ended the edit with no
  `cell-edit-cancel`; every no-pick close now fires it.
- **Fixed:** focus fell to `<body>` after an option click or a scroll close; it stays on the cell (on
  the grid when the cell's row scrolled out of view).
- **Fixed:** Tab / Shift+Tab on a combobox / autocomplete without arrowing through the options
  cancelled the edit, losing the typed text; it now saves it (a matching label → that option's value,
  else the raw text — as on blur), then moves as before.
- Unchanged: a scroll that moves the edited cell still cancels the edit.

### Theme (2026-11-10)
- **Fixed: the date cell editor follows the grid's scheme.** It mounted in `document.body` with its styles in
  `<head>`, so a dark grid (`data-theme="dark"`, a page signal, a `theme-source` section) opened a light
  calendar, and `--wg-*` / `--base-*` set on the grid didn't reach it. It now mounts in the grid's shadow root like
  the cell dropdown (styles adopted there, in the `component` layer).
- **BREAKING:** `data-bs-theme` on the `<web-grid>` element itself no longer forces its scheme; use `data-theme`
  (the switch every KeenMate component shares). `data-bs-theme` on `<html>`, `<body>` or a `theme-source`
  section is unchanged.
- Theming playground: the ancestor-signal radios did nothing (the demo grid lacked `theme-source="closest"`), and the
  precedence text still named `:host-context()`.

### Persisted UI state the core way (SPEC §12.17, rulebook C-CA-17)

#### Changed — BREAKING

- **`gridName` is gone → `storage-key` / `storageKey`** (an input row, nullable text; unset = off). It
  only ever scoped persistence.
- **`shouldPersistColumnWidths` / `shouldPersistColumnOrder` are input rows** — attributes
  `persist-column-widths` / `persist-column-order` (`toBool('default-false')`), reactive like every
  other input (they were plain properties).
- **localStorage key `wg-<gridName>-state` → `km-state:web-grid:<storage-key>`** (core
  `createStateStore()`): saved widths / orders are not carried over.
- **New `loadStateCallback` / `saveStateCallback`** (core `LoadStateCallback` /
  `SaveStateCallback<GridPersistenceState>`): the page keeps the state (per user, on the server);
  `saveStateCallback` gets the WHOLE `{ columnWidths?, columnOrder? }`. Set both callbacks; either
  one alone switches localStorage off.
- Loading is asynchronous (the store may be a server callback): saved widths / order apply on the
  render after the first one. Orphan pruning and the "wait for `columns`" load are unchanged.
- Internal: the engine's own localStorage code and `loadPersistedWidths()` / `savePersistedWidths()`
  are gone; the element makes the store and injects it (`engine.setStateStore()`).

### Core 1.0.0-rc20 / rc21 alignment

#### Changed — BREAKING

- **Requires `@keenmate/web-components-core` `^1.0.0-rc21`** from npm (was a `file:` link); the direct
  `@floating-ui/dom` dependency is gone (positioning goes through core `/positioning`).
- **`readonly` / `disabled` follow the native presence rule and reflect** (core SPEC §6.4):
  `readonly="false"` / `disabled="false"` now mean read-only / disabled; `el.isReadonly = true`
  writes `readonly=""`, `false` removes it. The `read-only` preset reflects `readonly` too.
- **`menuDivider()` is `createMenuDivider()`** (core rc18 rename, re-exported by the package).
- **Page-wide loader hook `window.components.renderLoadingCallback`** (was `renderLoaderCallback`),
  default loader class **`.wg__loader`** (was `.wg-loader`; the `--wg-loader-*` tokens keep their names).
- **Validated inputs** — a refused value warns, fires `input-rejected` and keeps the previous one:
  - `pagination-position` / `summary-position`: `|`-separated `top-` / `bottom-` + `left` / `center` /
    `right`; `pagination-layout`: `|`-separated `first`, `previous`, `page-info`, `next`, `last`,
    `page-size` (an unknown part used to render nothing silently).
  - `scroll-max-height`, `column-min-width`: CSS lengths (core `toCssLength`) — a number means pixels
    (`el.scrollMaxHeight = 240` → `'240px'`); `null` is refused (`undefined` / removing the attribute
    resets). `summaryPosition` is `null` when unset (was `undefined`).
  - `cell-toolbar-offset`: a number or a CSS length; `show-pagination`: a boolean or `'auto'` on the
    property path.
- **`scrollToRow(rowIndex)` centres the row** in the grid's container and brings the grid itself on
  screen (was `nearest`), and resolves `false` when `beforeScrollCallback` skipped it.
- **The grid's own scrolls no longer move the page**: keyboard moves, `scrollToRow()` and the go-to-row
  dialog scroll the one container around the cell (core `scrollIntoContainer()`), not every ancestor
  (`scrollIntoView()`); a grid without its own scroller still has the page brought to the cell.
- **The cell / header menu closes on scroll by core's shared rule** (core rc20 `/menu`): only a scroll
  of the page or of a scroller around what the menu belongs to, once it has moved; never a wheel over
  nothing or an unrelated scroller. A right-click menu belongs to the cell under the pointer (core
  rc21), so a scroll of the grid's own container closes it too, like a keyboard-opened one.

#### Added

- **Every input is a typed property**: `GridElementConfig` (exported) lists the input rows and is
  merged into `GridElement`, so `el.pageSize`, `el.editTrigger`, … type-check; `GridResponsiveConfig`
  is the same type.
- **`customStyles` / `custom-styles`** next to `getCustomStylesCallback` (core `createCustomStyles()`):
  the callback wins; **page-wide** `window.components['web-grid'].customStyles` /
  `.getCustomStylesCallback(ctx)` style every grid and are applied first (an instance overrides them;
  assigning updates live grids); an `@import` (an icon font) is also linked once in `<head>`
  (`shouldHoistImports = false` opts out). `destroy()` releases both layers.
- **`beforeScrollCallback(ctx)`** — runs before every scroll the grid makes on its own: `ctx.source`
  (`'keyboard'` | `'scroll-to-row'` | `'go-to-row'`), `row`, `rowIndex`, `field`, `container`,
  `options` (`block`, `inline`, `behavior`, `shouldRevealContainer`). `false` skips the scroll, a
  partial `options` replaces the defaults. Types `GridBeforeScrollContext`, `GridScrollOptions`,
  `GridScrollSource`.
- `columns` / `items` / inputs assigned before `<web-grid>` is defined are applied at upgrade (core rc20).

#### Fixed

- **Two quick Shift+Arrows grew the cell range by one**: after a render the focused cell was
  re-focused on a timer, and a key pressed in between went nowhere. It is focused at once now.
- **A fast drag selected a stale range** (WebKit: 6 cells dragged, 2 selected): the rAF-throttled
  drag now applies its release point on mouseup.
- The cell / header menu's close hook never ran (`closeCallback` was renamed `onClose` in core rc18),
  so `el.menu` kept a closed menu until the next open.
- **The column resize handle had a dead outer half**: it straddled the column border, but the header
  clips overflow and the next header paints over it, so grabbing it right of the border started a
  reorder / sort on the next column (Firefox drags failed outright). It sits inside its header cell now
  (`--wg-resize-handle-offset` defaults to `0px`, was `-6px`); the line stays on the border.
- 64 property accessors on the element were dead code (core's input accessors replaced them, rc20
  warned about each); removed — reads and writes already went through core.
- **Virtual scroll: `scrollToRow()` / the go-to-row dialog now honour the block** — they centre the row as
  documented (and as without virtual scroll); they used to always put it second from the top and ignored a
  `block` from `beforeScrollCallback`. The keyboard / edit moves that bring an unrendered row into view (`nearest`)
  measure the row where it really sits — below the sticky header — so it lands flush under the header / at the
  bottom edge (it used to stop one header height short going up, and could stay one header height below the
  view going down). A `scroll-padding` on the container is honoured.

#### Changed (visual) — editor panel gap is `--base-dropdown-offset`

- **The cell editor's dropdown opens 4px below the cell instead of 1px** (the datepicker stays at 4px): both
  gaps are now the page token `--base-dropdown-offset` (`@keenmate/base-css-variables` ^2.0.1), the one
  field → panel gap of every KeenMate component; core's anchor reads it on the cell (no hard-coded offset
  left). To set it: `web-grid { --base-dropdown-offset: 1px; }` (page-wide, per section or per element).
  The row toolbar (0), tooltips and right-click menus keep their own spacing.

#### Internal

- Tooltip, dropdown, row toolbar and datepicker are placed by core `anchor()`; one core
  `escapeHtml()` replaces the grid's `escapeHtml` / toolbar `escapeAttr` copies.
- e2e runs in chromium, firefox and webkit (`playwright.config.ts`); platform skips carry the reason.
- Virtual-scroll index → `scrollTop` math is core's `getScrollTopForBox()` (core rc21, SPEC §12.15) with the
  sticky header as `insetTop` (`virtualRowScrollTop()` in `modules/scroll/reveal.ts`); still computed before the
  window renders, then applied. `calculateScrollToRow()` and the unused `scrollToRowPosition()` (PageUp/PageDown
  helper nothing called) are gone. e2e: the virtual index jump follows the block, below the sticky header.

### Changed — BREAKING (assigning state is silent)

Suite rule: assigning a value / selection / state property never fires the component's events
(like a native `input.value`); methods and user interaction do.

- **`el.filters = …` no longer fires `filter-change`.** The filter row and `setFilter()` still
  do; `setFilter(field, text, { isSilent: true })` (also on `el.controller`) skips it.
- **`el.focusedRowIndex = n` no longer fires `focus-change`.** Clicking / keyboard-focusing a
  row still does.

### Changed — standalone colors follow `@keenmate/base-css-variables`

Without the contract on the page the grid's fallbacks were a palette of their own (Fluent blue
`#0078d4` accent with fixed `#106ebe` / `#005a9e` steps, `#242424` text, `#1a1a1a` dark surface,
text-mixed hover). Standalone it now looks the same as with the contract:

- **Inputs fall back to the contract's defaults:** `--wg-accent-color` `#3b82f6` (was
  `#0078d4`), main bg `#ffffff` / `#1e293b`, text `#334155` / `#f1f5f9`, danger `#dc2626`.
- **Derived colors fall back to the contract's formula on the `--wg-*` input**, so overriding
  `--wg-accent-color` standalone brings its steps along: accent hover / active (15% / 30%
  toward black or white), accent tint 10% / 20% (was 15%), text levels 2 / 3, elevated /
  disabled surfaces, border, hover / active overlays, danger tint, tooltip, text on the accent
  (black or white by APCA).
- **New tokens:** `--wg-shadow-color` (one shadow tone; dialog, tooltip, toolbar and frozen-column
  shadows read it — before, each had its own black alpha), `--wg-disabled-bg` (read-only cells
  and locked rows, was the elevated surface), `--wg-input-border-color` (the filter / editor
  outline, stronger than the divider).
- `--wg-dropdown-bg` falls back to the main bg (the contract's `--base-dropdown-bg`), no longer
  through `--base-elevated-bg`. The toolbar shadow fallback is the contract's
  `0 8px 16px` dropdown shadow. `--wg-font-size-xs` fallback multiplier 1 (was 1.1), as
  `--base-font-size-2xs`.
- The datepicker popup (rendered outside the shadow root) carries the same inputs and formulas
  in its `--wg-dp-*` tokens and follows the page's `color-scheme`.
- **Checked:** `npm run check:contract` (`base-contract-check`, devDependency
  `@keenmate/base-css-variables` ^2.0.0-rc05) runs in the build; `contract-check.json` allows the
  inherited font. `e2e/contract-parity.spec.ts` compares every color token standalone vs. with
  the contract (light, dark, custom accent). The e2e color parser reads `oklch()`.

### Changed (visual) — column-reorder drop indicator uses the drop-target look

- The column-reorder **drop indicator** (line + arrow) draws in the new `--wg-drop-indicator-color` =
  `var(--base-drop-target-border-color, var(--base-success-color, #10b981))` — **green (success role),
  was the accent blue**, one drop-target look with the treeviews and the dropzone. The dashed outline
  of the dragged header (the source, not a target) and the ghost keep the accent.

### Changed (visual) — tree indent and scrolling follow the contract

- **Tree indent:** `--wg-tree-indent` is `calc(var(--base-tree-indent, 1.6) * var(--wg-rem))` —
  **16px per level (was `1.25rem` = 20px)**, one step with both treeviews and the multiselect tree.
- **Datepicker rolling lists:** `scroll-behavior` reads the new `--wg-dp-scroll-behavior`
  (`var(--base-scroll-behavior, smooth)`; `auto` under `prefers-reduced-motion: reduce`, was always
  `smooth`). The popup lives outside the grid's shadow root, so it chains straight to the contract.
- `contract-check.json` no longer needs the `--base-loader-duration` allowance (the checker knows the
  reduced-motion value since base-css-variables rc06).

### Changed — BREAKING (loading states draw through the shared loader)

- **One loader, core `renderLoader()`** (web-components-core SPEC §12.14): the infinite-scroll
  load-more row (`context: 'row'`, `labels.loading`) and the autocomplete's async search
  (`context: 'search'`, `labels.dropdownSearching` — the editor indicator in the toggle's place and
  the dropdown's "Searching…" message) draw the default `<span class="wg-loader">`; its container
  carries `role="status"` + `aria-label` (the load-more row's text is now `aria-hidden`, the
  `role="status"` moved from the `td` to `.wg__loading-more-indicator`).
- **New `renderLoadingCallback`** property (`(ctx: LoaderRenderContext) => void | cleanup`, `ctx`:
  `{ component, context, containerElement, element, label }`) — draws every grid loader; beats the
  page-wide `window.components.renderLoaderCallback`. `RenderLoaderCallback` / `LoaderRenderContext`
  types are re-exported.
- **New `--wg-loader-icon` / `-rotate` / `-duration` / `-size`** chained to `--base-loader-*`
  (manifest category `loader`); reduced motion slows the loader to 1.5s, it never stops.
- **Removed:** the ⏳ pulse of the autocomplete search indicator, `@keyframes wg-pulse` and
  `--wg-loading-pulse-duration`.
- **Dependency:** requires `@keenmate/base-css-variables` `^2.0.0-rc06`.

### Changed — BREAKING (motion and disabled dimming follow the contract)

- **Durations chain to `--base-duration-*`:** `--wg-transition-fast: var(--base-duration-fast, 0.1s)`,
  `--wg-transition-normal: var(--base-duration-normal, 0.15s)`. They are durations only now (were
  `0.1s ease` / `0.15s ease`); the easing is the new `--wg-easing`
  (`var(--base-ease-standard, cubic-bezier(0.4, 0, 0.2, 1))`, was `ease`).
- **No hard-coded durations left:** the resize handle and toolbar button fades (`0.1s`) and the tree
  chevron (`0.12s` rotation → `0.1s`, snapped to the fast speed) go through `--wg-transition-fast`.
- **Motion off is CSS only:** `--wg-transition-*: 0s` on the grid, or `--base-duration-*: 0s` page-wide.
  `prefers-reduced-motion: reduce` sets them to `0s`; the loader slows instead (see Loading states).
- **One disabled fade:** new `--wg-disabled-opacity: var(--base-disabled-opacity, 0.65)` dims the
  disabled grid (was `0.6`), disabled dropdown options and toolbar / inline action buttons (were
  `0.5`), and the pagination buttons (`--wg-pagination-btn-disabled-opacity` now defaults to it, was
  `0.4`). The datepicker popup (outside the shadow root) reads `--base-disabled-opacity` for its
  disabled days (`--wg-dp-disabled-opacity`, was `0.5`). Locked rows (`--wg-row-locked-opacity`,
  `0.7`) and the read-only checkbox (`0.5`) are not disabled states and keep theirs.

### Changed — BREAKING (v2 API naming unification)

Names now follow the suite-wide naming rules (BlissFramework naming-conventions D-NC-13..27),
the same in every KeenMate component. No aliases — rename on upgrade. The deprecated
aliases kept from 1.x are gone too (`showPagination`, `tableBorderOnly`, `toolbarFollowsCursor`,
`toolbarAlign`, `toolbarTopPosition`, types `EditorType`, `RowLockInfo`).

**Attributes — every boolean in the short HTML form** (derived from the config key:
feature switch `is*Enabled` → `enable-*`, part visibility `is*Shown` → `show-*`, behaviour
`should*` → bare, permission `is*Allowed` → `allow-*`, layout / data hint `is<Adj>` → bare).

| Old attribute | New attribute | Property |
|---|---|---|
| `is-filterable` | `enable-filtering` | `isFilteringEnabled` (was `isFilterable`; column `isFilterable` unchanged) |
| `is-pageable` | `enable-paging` | `isPagingEnabled` (was `isPageable`) |
| `is-pagination-visible` | `show-pagination` | `isPaginationShown` (was `isPaginationVisible`) |
| `is-striped` | `striped` | `isStriped` |
| `is-hoverable` | `hoverable` | `isHoverable` |
| `is-table-border-only` | `table-border-only` | `isTableBorderOnly` |
| `is-scrollable` | `scrollable` | `isScrollable` |
| `is-editable` | `enable-editing` | `isEditingEnabled` (was `isEditable`; column `isEditable` unchanged; also the `GRID_PRESETS` key) |
| `should-commit-on-click-away` | `commit-on-click-away` | `shouldCommitOnClickAway` |
| `mode` | `preset` | `preset` (was `mode`) |
| — | `readonly` (new) | `isReadonly` |
| — | `disabled` (new) | `isDisabled` |
| `should-show-dropdown-on-focus` | `open-dropdown-on-focus` | `shouldOpenDropdownOnFocus` (was `shouldShowDropdownOnFocus`) |
| `should-open-dropdown-on-enter` | `open-dropdown-on-enter` | `shouldOpenDropdownOnEnter` |
| `is-checkbox-always-editable` | `checkbox-always-editable` | `isCheckboxAlwaysEditable` |
| `is-row-numbers-visible` | `show-row-numbers` | `isRowNumbersShown` (was `isRowNumbersVisible`) |
| `is-dirty-indicator-visible` | `show-dirty-indicator` | `isDirtyIndicatorShown` (was `isDirtyIndicatorVisible`) |
| `is-sticky-row-numbers` | `sticky-row-numbers` | `isStickyRowNumbers` |
| `freeze-columns` | `frozen-column-count` | `frozenColumnCount` (was `freezeColumns`) |
| `is-row-toolbar-visible` | `show-row-toolbar` | `isRowToolbarShown` (was `isRowToolbarVisible`) |
| `should-toolbar-follow-cursor` | `toolbar-follow-cursor` | `shouldToolbarFollowCursor` |
| `is-shortcuts-help-visible` | `show-shortcuts-help` | `isShortcutsHelpShown` (was `isShortcutsHelpVisible`) |
| `is-column-reorder-allowed` | `allow-column-reorder` | `isColumnReorderAllowed` |
| `is-summary-inline` | `summary-inline` | `isSummaryInline` |
| `is-virtual-scroll-enabled` | `enable-virtual-scroll` | `isVirtualScrollEnabled` |
| `virtual-scroll-row-height` | `virtual-scroll-item-height` | `virtualScrollItemHeight` (was `virtualScrollRowHeight`) |
| `virtual-scroll-buffer` | `virtual-scroll-overscan` | `virtualScrollOverscan` (was `virtualScrollBuffer`) |
| `is-infinite-scroll-enabled` | `enable-infinite-scroll` | `isInfiniteScrollEnabled` |
| `is-new-row-enabled` | `enable-new-row` | `isNewRowEnabled` |
| `tree-data-sorted` | `tree-data-sorted` | `isTreeDataSorted` (was `treeDataSorted`) |
| `should-copy-with-headers` | `copy-with-headers` | `shouldCopyWithHeaders` |
| `should-validate-on-paste` | `validate-on-paste` | `shouldValidateOnPaste` |
| — | `labels` (new, JSON) | `labels` |

Unchanged: `filter-mode`, `page-size`, `pagination-mode`, `pagination-position`, `pagination-layout`,
`scroll-max-height`, `edit-trigger`, `edit-button-icon`, `edit-start-selection`, `cell-selection-mode`,
`dropdown-toggle-visibility`, `toolbar-*-align`, `toolbar-trigger`, `toolbar-position`,
`cell-toolbar-offset`, `context-menu-*-offset`, `shortcuts-help-position`,
`column-min-width`, `sort-mode`, `summary-position`, `virtual-scroll-threshold`,
`infinite-scroll-threshold`, `new-row-position`, `new-row-indicator`, `tree-double-click-behavior`,
`tree-*-glyph`, `paste-mode`, `fill-direction`, `tooltip-*-delay`.

**Enum values are kebab-case; "off" is `none`**

| Old | New |
|---|---|
| `editStartSelection`: `'mousePosition'` / `'selectAll'` / `'cursorAtStart'` / `'cursorAtEnd'` | `'mouse-position'` / `'select-all'` / `'cursor-at-start'` / `'cursor-at-end'` |
| `data-request` / `beforePageChangeCallback` `trigger`: `'pageSize'` / `'loadMore'` | `'page-size'` / `'load-more'` |
| `paginationLayout` tokens `pageSize` / `pageInfo` | `page-size` / `page-info` (default `'page-size\|previous\|page-info\|next'`) |
| `sortMode: 'multi'` | `'multiple'` |
| `cellSelectionMode: 'disabled'` | `'none'` |

**Presets, readonly, disabled, lifecycle**

- `mode` → `preset` (type `GridMode` → `GridPreset`, `MODE_PRESETS` → `GRID_PRESETS`). The
  `read-only` preset now also sets `isReadonly = true` (`excel` / `input-matrix` set it back to `false`).
- NEW `isReadonly` / `readonly`: values can't change — no editing, paste, fill or row add / delete /
  duplicate / move (those built-ins are disabled); the grid stays focusable, selectable and copyable.
- NEW `isDisabled` / `disabled`: no interaction at all — the grid container is `inert` and dimmed.
- Core lifecycle (web-components-core): `defer` attribute / `shouldDefer` holds the first render until
  `release()`; then the `ready` event (+ `onReady`), the `ready` host attribute, `:state(ready)` and
  `whenReady()`. `destroy()` comes from core (the grid owns nothing beyond what `disconnect()` releases).

**Selection & state (the same names on the element and `el.controller`)**

| Old | New |
|---|---|
| `clearSelection()` (rows only) | `clearSelection()` clears rows + cell range + columns; `clearRowSelection()` clears only rows |
| `selectedRows: number[]` | `selectedRows: T[]` (the row objects) + `selectedRowIndices: number[]` |
| element / controller `getSelectedRowsData()` | `selectedRows` |
| controller `getSelectedRows()` | `selectedRowIndices` |
| controller `getItems()` / `getDisplayItems()` / `getColumns()` / `getSort()` / `getFilters()` / `getInvalidCells()` / `getSelectedCellRange()` | read-only properties `items` / `displayItems` / `columns` / `sort` / `filters` / `invalidCells` / `selectedCellRange` (+ `expandedPaths`) |

**Tree (web-treeview names)**

| Old | New |
|---|---|
| `toggleExpandedPath(path)` | `toggleRowExpanded(path, options?)` |
| `expandSubtree(path)` / `collapseSubtree(path)` | `expandAll(paths)` / `collapseAll(paths)` — `string \| string[] \| null` (`null` / none = the whole tree; paths = those rows + everything under them, ancestors open) |
| — | `expandRows(paths, options?)` / `collapseRows(paths, options?)` (one level; collapsed ancestors open too; leaves are never "expanded") |
| — | `ExpandOptions { isExclusive?, isSilent? }` on every expand / collapse method (`isExclusive`: expanding collapses every other branch; `isSilent`: no events) |
| `expandedPaths: Set<string>` (bindable, mutated by the grid) | `expandedPaths: string[]` on the element and controller — reading returns a copy, assigning replaces the state (no events), `null` → the `expandLevel` default |
| event `expand-change { path, isExpanded, expandedPaths }` (+ `onExpandChange`) | `row-expand` / `row-collapse` `{ row, path }` for single-row acts + `expanded-change { paths }` (whole set, string array) on every change (`onRowExpand` / `onRowCollapse` / `onExpandedChange`) |
| cell-menu built-ins `expand-all` / `collapse-all` (row + subtree) | `expand-subtree` / `collapse-subtree`; NEW `expand` / `collapse` = one level. The per-row tree items act on the whole row selection when the clicked row is in it, else just that row |
| row built-ins `delete` / `duplicate` / `move-up` / `move-down` act on the clicked / focused row only (`delete`: a range shortcut's `rows`) | the same target rule as the tree items: the whole row selection when the row is in it, else just the row (`add` still inserts after the clicked row). Moves go as a block (disabled at the edge); the row selection follows its rows; a row toolbar opened on a selected row keeps the selection (it used to clear it) |
| cell-menu built-ins `expand-tree` / `collapse-tree` (whole tree) | `expand-all` / `collapse-all` |
| `labels.actions.expandAll` / `collapseAll` / `expandTree` / `collapseTree` | `expand` / `collapse` (one level) / `expandSubtree` / `collapseSubtree` (row + everything under it) / `expandAll` / `collapseAll` (whole tree) |
| `row-expand` / `row-collapse` `row: T \| undefined` | `row: T \| null` |
| `treePathMember` / `treeLevelMember` / `treeParentMember` | `pathMember` / `levelMember` / `parentPathMember` |
| `treeSeparator` | `treePathSeparator` |
| `defaultExpandDepth` | `expandLevel` |

**Events & details**

| Old | New |
|---|---|
| `edit-start` / `edit-cancel` (`onEditStart` / `onEditCancel`) | `cell-edit-start` / `cell-edit-cancel` (`onCellEditStart` / `onCellEditCancel`) |
| `paste-complete` (`onPasteComplete`, `PasteCompleteEventDetail`) | `cell-paste` (`onCellPaste`, `CellPasteEventDetail`) |
| `row-focus { row, rowIndex, previousRowIndex }` (`onRowFocus`) | `focus-change { row, rowIndex, oldRowIndex }` (`onFocusChange`) |
| `row-delete { row, rowIndex }` — a request on Ctrl+Delete, nothing was deleted | Ctrl/Cmd+Delete runs the `delete` built-in (veto with `beforeActionCallback`); `row-delete { rows, rowIndices }` reports the removal after the fact — for the menu / toolbar `delete` too. Programmatic `removeRows` / `removeRow` don't fire it |
| `findRowById(id) → { row, index }` | `getRowById(id) → row \| null`; NEW `getRowIndex(row) → display index \| -1` (element + controller) |
| `row-lock-change` `rowIndex` (index into `items`) | the display index (`-1` when not displayed), like every other `rowIndex` |
| `renderOptionCallback` ctx `index` / `isHighlighted` | `optionIndex` / `isFocused` |

**Methods & options**

| Old | New |
|---|---|
| `showGoToRowDialog(colIndex)` | `openGoToRowDialog(colIndex)` |
| `scrollToRowProgrammatically(targetRow)` | `scrollToRow(rowIndex): Promise<boolean>` — public, element + controller |
| `discardRowDraft(rowIndex)` | removed — `discardDraft(row)` |
| — | controller `insertRows(rows, afterRow?)`, `removeRow(row)` |
| column `isMovable` | `isReorderable` |
| column `isEditButtonVisible` | `isEditButtonShown` |
| `rowLocking.lockedMember` | `rowLocking.isLockedMember` |

**Labels (i18n)**

- `labels` is also a JSON attribute; `el.labels` reads back what was assigned (the texts are resolved
  per key over the English defaults).
- In `labels`, `''` renders nothing (deliberately empty); `undefined` / missing falls back to the
  English default. Every default uses the single `…` character (`dropdownSearching` "Searching…").
- NEW `labels.noData` — the empty-table text when the grid has no rows (was hard-coded "No items to
  display"); NEW `labels.noResults` ("No matching items") — rows exist / a filter is active but
  nothing matched. The empty cell carries `data-empty="no-data" | "no-results"`.
- NEW `labels.loading` ("Loading…") — a `role="status"` row at the bottom while an infinite-scroll
  `load-more` request is pending (gone on the next `items` / `hasMoreItems = false`; `''` = no row).
- `labels.dropdownNoOptions` → `labels.dropdownNoData` ("No options" — the editor has no options at
  all) + NEW `labels.dropdownNoResults` ("No matching options" — a typed filter / search matched nothing).
- NEW `labels.dropdownEmptyOption` ("—") and `labels.actions.expandSubtree` / `collapseSubtree`.
- Column `editorOptions.noOptionsText` / `searchingText` → `editorOptions.labels: { dropdownNoData,
  dropdownNoResults, dropdownSearching, dropdownEmptyOption }` (per key over the grid labels); the unused
  `editorOptions.emptyLabel` is removed.
- `inlineActionsTitle` / `inline-actions-title` removed — the inline actions header is
  `labels.inlineActionsHeader` only (`''` = blank header).
- Column `editorOptions.allowEmpty` (documented, never implemented) → `isEmptyAllowed`, now implemented:
  select / combobox / autocomplete get an empty first item (`labels.dropdownEmptyOption`) for the
  unfiltered list; picking it sets the value to `null`.

### Changed — BREAKING (interaction model, web-components-core rc15)

Callbacks, events and every clickable item (row toolbar, cell / header context menu,
shortcuts) follow the shared KeenMate interaction model (web-components-core `/actions`).
No aliases — rename on upgrade.

**Every callback takes ONE `ctx` argument.** Every ctx and every event detail carries
`controller` (the public `GridController`, also `el.controller`) and `element` (the host) —
both non-enumerable, so `JSON.stringify` / logs see only the data.

| Old | New |
|---|---|
| `el.grid` (the internal `WebGrid`) | `el.controller` — the public facade (rows, drafts, validation, locking, selection, tree, columns, focus, menus). The engine is `GridEngine` (exported for standalone use; `el.engine` is internal) |
| `rowClassCallback(row, rowIndex)` | `getRowClassCallback({ row, rowIndex })` |
| `customStylesCallback()` | `getCustomStylesCallback(ctx)` |
| `paginationLabelsCallback(ctx)` / `summaryContentCallback(ctx)` / `shortcutsHelpContentCallback()` | `getPaginationLabelsCallback(ctx)` / `renderSummaryCallback(ctx)` / `renderShortcutsHelpCallback(ctx)` |
| `validationTooltipCallback(ctx)` (grid + column) | `getValidationTooltipCallback(ctx)` — ctx is the cell + `error` |
| `treeChevronCallback({ expanded, … })` | `renderChevronCallback({ row, isExpanded, hasChildren, level, path })` |
| `isRowEditable: boolean \| (row) => boolean` | `isRowEditable: boolean` + `getIsRowEditableCallback({ row })` |
| `idValueCallback(row)` / `idValueMember` | `getIdCallback({ row })` / `idMember` (see below) |
| `createEmptyRowCallback()` / `createRowCallback(pastedData, rowIndex)` | `createEmptyRowCallback(ctx)` / `createRowCallback({ data, rowIndex })` |
| `rowLocking.isLockedCallback(row, i)` / `getLockInfoCallback(row, i)` / `canEditLockedCallback(row, lock)` | `getIsLockedCallback({ row, rowIndex })` / `getLockInfoCallback({ row, rowIndex })` / `getCanEditLockedCallback({ row, rowIndex, lockInfo })`; `lockTooltipCallback` (never called) removed |
| `fillDragCallback(detail)` → `false` | `beforeFillCallback(ctx)` → `false` cancels (async OK) |
| `onbeforepaste(detail)` + `detail.cancel = true` | `beforePasteCallback(ctx)` → `false` cancels (async OK); `ctx.skipCells` unchanged |
| `onfilterchange(filters)` set → server-side filtering | `filterMode: 'server'` (attribute `filter-mode`) + the `filter-change` event `{ filters }` |

**Columns**

| Old | New |
|---|---|
| `formatCallback(value, row)` | `getDisplayValueCallback(ctx)` — ctx = `{ row, rowIndex, column, colIndex, field, value }` |
| `templateCallback(row)` | `renderCellCallback(ctx)` (HTML) |
| `cellClassCallback(value, row)` / `tooltipCallback(value, row)` | `getCellClassCallback(ctx)` / `getTooltipCallback(ctx)` |
| `filter(filterValue, row)` | `filterCallback({ filterValue, row, column, field })` |
| `isEditable: boolean \| (row) => boolean` | `isEditable: boolean` + `getIsEditableCallback({ row })` |
| `beforeCommitCallback(ctx)` | `validateCallback(ctx)` — same result contract (`ValidationResult` / boolean / string / null); ctx gains `column`, `colIndex`, `source: 'edit' \| 'paste'`. The old deprecated `validateCallback(value, row)` is gone |
| `cellEditCallback(ctx)` | `renderEditorCallback(ctx)` — the cell ctx + `commit` / `cancel` |
| `beforeCopyCallback(value, row)` / `beforePasteCallback(value, row)` | `getCopyValueCallback(ctx)` / `getPasteValueCallback({ …cell, text })` (per-cell conversions, not vetoes) |
| `renderCallback`, `CellRenderCallback` (never called) | removed |
| `editorOptions.getDisplayCallback` / `getSearchCallback` / `getDisabledCallback` `(option)` | `getDisplayValueCallback` / `getSearchValueCallback` / `getIsDisabledCallback({ option })`; the other option callbacks take `({ option })` too |
| `editorOptions.renderOptionCallback(option, ctx)` | `renderOptionCallback({ option, index, isHighlighted, isSelected, isDisabled })` |
| `editorOptions.searchCallback(query, row, signal)` | `searchCallback({ term, row, rowIndex, column, field, signal })` |
| `editorOptions.onselect(option, row)` | `editorOptions.onSelect({ option, row, rowIndex, column, field, … })` |
| `editorOptions.loadOptions` / `optionsLoadTrigger` (never used) | removed |

**Items — row toolbar, context menus, shortcuts are core action items**

| Old | New |
|---|---|
| toolbar `{ id, icon, title, label, type, danger, disabled, hidden, tooltip: { description, shortcut }, tooltipCallback, onclick({ row, rowIndex }) }` | `{ action?, id?, icon, text, tooltip, shortcut, isDanger, isDisabled, isVisible, isToggled, cssClass, get*Callback(ctx), onClick(detail), row, isTextVisible }` — `text` is the accessible name + tooltip heading (shown only without an icon or with `isTextVisible`), `tooltip` the description |
| toolbar `group: n` / menu `dividerBefore: true` | a divider entry `{ divider: true, text? }` (or `menuDivider(text)`, exported) |
| `minWidth` on a toolbar item (was dropped anyway) | `cssClass` / `--wg-toolbar-btn-min-width` |
| built-ins `'add' \| 'delete' \| 'duplicate' \| 'moveUp' \| 'moveDown'` were icon presets — the consumer did the work in `ontoolbarclick` | `'add' \| 'delete' \| 'duplicate' \| 'move-up' \| 'move-down'` **do the work** (before the `action` event, which then sees the result): add inserts `createEmptyRowCallback(ctx)`'s row (else a blank row) after the row; delete removes it; duplicate inserts `createDuplicateRowCallback({ row })`'s copy (else a shallow copy with `idMember` cleared); move swaps with the displayed neighbour. Veto with `beforeActionCallback` → `false`. **Remove your own add / delete / move code from the old `ontoolbarclick` or the row changes twice.** Built-in texts: `labels.actions` |
| `cellToolbar(row, rowIndex, field, colIndex)` | `getCellToolbarItemsCallback(cellCtx)` — merged over `rowToolbar` by `id` / `action` |
| menu `{ id, label \| (ctx) => …, icon \| fn, visible \| fn, disabled \| fn, danger, type, onclick(ctx) }` | `{ action?, id?, text, getTextCallback, icon, getIconCallback, isVisible, getIsVisibleCallback, isDisabled, getIsDisabledCallback, isDanger, isToggled, shortcut, onClick(detail), children, getChildrenCallback, shouldCloseOnClick }` |
| header `submenu(ctx)` / `children` (child `onclick` never ran) | `children` / `getChildrenCallback(ctx)` (sync or async — a loading row shows meanwhile); every child activates |
| header built-ins `'sortAsc' \| 'sortDesc' \| 'clearSort' \| 'hideColumn' \| 'freezeColumn' \| 'unfreezeColumn' \| 'columnVisibility'` | kebab: `'sort-asc' \| 'sort-desc' \| 'clear-sort' \| 'hide-column' \| 'freeze-column' \| 'unfreeze-column' \| 'column-visibility'` (toggles report `action: 'toggle-column'` with `id` = field, and `'show-all-columns'`) |
| cell built-ins `'expand-all' \| …` (`type: …` on an object) | same names, by `action`; the row built-ins work in the cell menu too |
| a custom item whose `id` was a built-in name ran the built-in | built-ins only by `action`; `id` identifies custom items |
| `HeaderMenuContext.columnIndex` | `colIndex` (`column` is `null` on the filler) |
| `ContextMenuContext.cellValue` | `value` (`CellContext`: `row`, `rowIndex`, `column`, `colIndex`, `field`, `value`) |
| `oncontextmenuopen(ctx)` / `onheadercontextmenuopen(ctx)` | `beforeContextMenuOpenCallback(ctx)` / `beforeHeaderMenuOpenCallback(ctx)` — sync; `false` → no grid menu (the browser's shows), an entries array → shown instead |
| `rowShortcuts: [{ key, id, label, action(ctx), disabled }]` | `[{ shortcut, id?, action?, text, onClick(detail), isDisabled, getIsDisabledCallback }]` — action items bound to a key; `action` may name a row built-in |
| `rangeShortcuts` (same shape) | same item shape, ctx `{ rows, rowIndices, cellRange?, cells? }` |
| — | `beforeActionCallback(detail)` → `false` cancels any item activation (async OK) |
| `data-toolbar-item` / `data-action-id` / `data-item-id` on buttons | `data-action` (built-in name or `custom`) + `data-id` |

**Properties go through the core input pipeline** (no grid-side proxies). A property write
is validated by the input's converter: an invalid value (`el.pageSize = null`, `0`, `'abc'`,
`el.mode = 'bogus'`) warns and keeps the previous value, as in every other KM component —
it used to reach the engine. Reads stay synchronous: `el.pageSize = 25; el.totalPages` and
`el.controller.…` see the new value without awaiting. `mode` is a preset (core
`getBatchValuesCallback`): it also sets `isEditable`, `editTrigger`, the dropdown flags and
`cellSelectionMode`; an input set explicitly in the same tick or in the same markup wins,
whatever the order (`<web-grid mode="excel" edit-trigger="click">` keeps `click`).

**Events** — real DOM events (bubble, not composed) + a camelCase `on*` twin called with the
same detail first. Replaces the lowercase `on*` properties (which collided with native
handlers: `onpaste`, `onbeforepaste`, `onselect`).

| Old | New |
|---|---|
| `onrowchange` | `row-change` / `onRowChange` |
| `onroweditstart` / `onroweditcancel` | `edit-start` / `onEditStart`, `edit-cancel` / `onEditCancel` |
| `onvalidationerror` (never fired from paste) | `validation-error` / `onValidationError` — also from paste; detail gains `source` |
| `ontoolbarclick(detail)` | `action` / `onAction` — every toolbar, inline, cell-toolbar, menu and shortcut item (`source`: `row-toolbar` / `cell-toolbar` / `context-menu` / `header-menu` / `keyboard`); `event` → `sourceEvent` |
| `onrowaction` (never fired) | removed |
| `ondatarequest` | `data-request` / `onDataRequest` — now also after a header-menu sort |
| `onrowdelete` + the non-bubbling `rowdelete` DOM event | `row-delete` / `onRowDelete` (a request; the grid doesn't delete). Ctrl+Delete now reaches it in navigate mode (the action pipeline used to swallow it as "clear cell") |
| `onrowfocus` | `row-focus` / `onRowFocus` |
| `oncellselectionchange` | `cell-selection-change` / `onCellSelectionChange` |
| `onfilterchange(filters)` | `filter-change` / `onFilterChange({ filters })` |
| `oncolumnresize` / `oncolumnreorder` | `column-resize` / `onColumnResize`, `column-reorder` / `onColumnReorder` |
| `onexpandedpathschange({ path, expanded })` (toggle only) | `expand-change` / `onExpandChange({ path, isExpanded, expandedPaths })` — also for expand / collapse all (`path: null`) and subtree |
| `onrowlockchange` | `row-lock-change` / `onRowLockChange` |
| `onpaste` (shadowed `HTMLElement.onpaste`) | `paste-complete` / `onPasteComplete` |

**Toggle state is `isToggled`** (web-components-core rename, no alias): item `isActive` /
`getIsActiveCallback` → `isToggled` / `getIsToggledCallback`; classes `wg__toolbar-btn--active` /
`wg__inline-action-btn--active` → `…--toggled` (menu items: see the core `/menu` entry below); CSS variable
`--wg-toolbar-btn-active-color` → `--wg-toolbar-btn-toggled-color`. Toolbar buttons keep
`aria-pressed`; a context-menu item that defines its toggle state (e.g. the column-visibility
toggles) is `role="menuitemcheckbox"` + `aria-checked="true|false"` (was `menuitem` +
`aria-pressed`).

**Activation order (web-components-core #15):** `beforeActionCallback` (`false` cancels) →
item `onClick` → the built-in → the `action` event / `onAction`. The event is a notification
after the fact: after `delete` the row is already gone from `items`, after `add` the new row is
present, after `move-up` / `move-down` the new order is in place (the detail's `row` /
`rowIndex` are the surface context captured before the built-in). A throwing built-in is
logged and the event still fires. Prevent a built-in with `beforeActionCallback`, not in the
event.

### Changed — BREAKING (context menus on core `/menu`)

The cell and column-header menus are the shared KeenMate menu, core `openMenu()`
(web-components-core `/menu`) — the grid's own renderer / positioning / dismiss code is gone.

- **Rendered in the grid's shadow root**, not `document.body`. Selectors that reached the menu
  through `document.querySelector` must go through `el.shadowRoot` (Playwright locators pierce it).
- **Classes:** `.wg-context-menu-container` is gone; `.wg-context-menu` / `--submenu` /
  `__item` (`--disabled` / `--danger` / `--toggled` / `--has-submenu`) / `__icon` / `__label` /
  `__shortcut` / `__divider` → `.km-menu` / `.km-menu--submenu` / `.km-menu__item…` /
  `__icon` / `__label` / `__shortcut` / `__divider`; `__divider-label` → the text inside
  `.km-menu__divider--named`; `__loading` → `.km-menu__loading`. Submenus are sibling levels,
  not children of their parent item. Scoping hooks on every level: `wg-context-menu` (cell menu),
  `wg-header-menu` (header menu). The column-visibility toggles' `wg-context-menu__item--toggle`
  → `wg-header-menu__column-toggle`.
- **CSS variables:** the `--wg-cm-*` set (on the body-level container) and the dead
  `--wg-context-menu-min-width` / `--wg-context-menu-z-index` defaults and `--wg-z-context-menu`
  are removed. One public set `--wg-context-menu-*` on `web-grid` themes both menus — `bg`,
  `bg-hover`, `hover-color`, `text-color`, `border`, `border-radius`, `shadow`, `min-width`,
  `padding`, `font-size`, `item-padding`, `item-gap`, `toggled-color`, `icon-width`,
  `icon-font-size`, `arrow-font-size`, `shortcut-color`, `danger-color`, `danger-bg-hover`,
  `divider-color`, `divider-margin`, `disabled-opacity`, `z-index` — **unset by default**: a value
  resolves `--wg-context-menu-*` (this grid) → `--km-menu-*` (page-wide on `:root`, every
  KeenMate menu) → `--base-*` → core default. Old → new: `--wg-cm-background` → `-bg`,
  `--wg-cm-hover-bg` → `-bg-hover`, `--wg-cm-text-danger` → `-danger-color`,
  `--wg-cm-text-secondary` → `-shortcut-color`, `--wg-cm-border-color` → `-border` (shorthand)
  / `-divider-color`, `--wg-cm-icon-size` → `-icon-width`, `--wg-cm-icon-gap` → `-item-gap`,
  `--wg-cm-toggled-color` → `-toggled-color`, the rest by the same name.
- **Look (core defaults):** 14px font (was 13px), item padding 6px 12px (was 8px 12px), shadow
  `0 8px 16px` (was `0 4px 16px`), submenu arrow ▸ (was ▶), a focus / hover highlight on the
  keyboard-focused item; a toggled-on column toggle is in the accent colour (was the text colour
  with a dimmed ☐ glyph when off); the menu follows the grid's colour scheme (`data-theme`) since
  it lives in its shadow root. A menu whose items are all hidden is not shown and the browser's
  menu appears (the grid used to swallow the right-click).
- **Keyboard (new):** Shift+F10 / the ContextMenu key on the focused cell opens the cell menu
  below it, first item focused. In a menu: ↑ / ↓ (skip disabled, wrap), Home / End, → / Enter /
  Space open a submenu, ← / Escape close it, Enter / Space activate, Escape closes and returns
  focus to where it was, Tab closes; item `shortcut` letters still activate. It also closes on
  window blur and when another KeenMate overlay opens. Items are focusable `div`s with
  `role="menuitem"` / `menuitemcheckbox` + `aria-checked`, submenu owners `aria-haspopup` /
  `aria-expanded`.
- **Internal:** the action pipeline's no-op `openContextMenu` action (and its
  `OpenContextMenuAction` type) is removed; `contextMenuExecutor` now only handles
  `closeContextMenu`. Not part of the public API — opening a menu is `openMenu()` via the
  `contextmenu` event / Shift+F10.

### Changed — BREAKING (logging, row identity, editing)

- **Column selection API uses column indices.** `controller.selectColumn(colIndex)`,
  `selectColumnRange(from, to)`, `isColumnSelected(colIndex)` take and
  `getSelectedColumns()` reports the column index (index into `columns`, like a cell's
  `colIndex`) — they used the on-screen position, so with reordered / hidden columns they
  addressed the wrong column. `selectColumnRange` selects the on-screen span between the two
  columns; hidden columns are ignored. Same results as before when no column is reordered or
  hidden.
- **`controller.getSelectedColumns()` returns `{ colIndex, field, column }[]` in on-screen
  order** (was `number[]` of visual positions, ascending) — the same column fields a
  `getSelectedCells()` cell carries. Every selection output follows one rule: on-screen order,
  columns identified by index in `columns` + `field`. `.map(c => c.colIndex)` for the old indices.
- **`getSelectedCells()` returns full `CellContext` objects** — `{ row, rowIndex, column,
  colIndex, field, value }` + the non-enumerable `controller` / `element`, like every cell ctx
  (`column` is new; `value` is now draft-aware). Typed `CellContext<T>[]`.

- **Logging runs on core `/logging`.** The vendored `loglevel` copy is gone; the grid registers
  with core's `registerComponent` (`window.components['web-grid']` gains `register()` /
  `getInstances()`, and the page-wide `window.components.logging` switch covers the grid).
  Every `GRID:*` category defaults to **`warn`** (was silent) and `enableLogging()` /
  `setLogLevel()` now reach every category (they only moved the root logger).
  `getCategories()` returns bare names (`['INIT', 'DATA', 'UI', 'INTERACTION', 'PERF']`) and
  `setCategoryLevel()` on the registry takes them (`setCategoryLevel('DATA', 'debug')`). The
  grid's configuration / persistence warnings go through the loggers (no direct `console.*`).
- **One row-id member: `idMember`, default `'id'`.** `idValueMember` is removed; `getRowId()`,
  `getRowById`, `updateRowById`, `replaceRowById` and `lockRowById` read `idMember` (they used
  to need `idValueMember` and returned nothing with `idMember` alone). The callback twin is
  **`getIdCallback({ row })`** (was `getRowIdCallback`) and wins over `idMember`; drafts and
  invalid-cell markers are keyed by the same id. With the new default, rows that carry an `id`
  field are identified without configuration; set `idMember = null` for rows without ids. The
  `duplicate` built-in clears the `id` field of the copy by default.

### Added

- **Responsive rules** (web-components-core SPEC §6.7): partial grid configs per device class
  (`device` axis) or window-width breakpoint (`breakpoint` axis) from the page (`window.components.responsive` / `responsiveCallback`), the tag
  (`window.components['web-grid'].responsive` / `responsiveCallback`) or the instance
  (`el.responsive` / JSON attribute `responsive`, `el.responsiveCallback`) — e.g.
  `{ device: { mobile: { pageSize: 10, isRowNumbersShown: false } }, breakpoint: { mobile: { frozenColumnCount: 0 } } }`;
  own widths / combinations go in `responsiveCallback`. Attributes / properties set on the grid
  beat page rules; the grid's own rules beat both. Covers the input table only (`columns`, `items`
  and other plain properties are not settable by a rule). Typed aliases `GridResponsiveMap`,
  `GridResponsiveCallback`, `GridResponsiveConfig`, `GridInputKey` (+ `ResponsiveContext`
  re-export); the `static inputs` table is now `as const` so the config keys are literal types.
- **`fill-direction` input** (`fillDirection` property): the grid-wide fill-handle direction,
  `'vertical'` (default) or `'all'` — the engine setting was not reachable from the element. A
  column's own `fillDirection` still wins.
- **Drafts list.** `getDrafts()` (element + controller) and `ctx.drafts` on `renderSummaryCallback`:
  every unsaved draft `{ row, draftRow, changedFields, isValid }` — including rows on other pages,
  filtered out, or not in the current `items`. The summary usually shows server aggregates
  (`summaryMetadata`); adjust them by the draft deltas. `discardDraft(row)` drops one draft.
  Drafts are never pruned when `items` is set (server paging: a missing row is another page) —
  they leave via `replaceRowById`, `discardDraft`, `discardRowDraft`, `discardAllDrafts`. Server
  paging + editing without a usable row id logs a warning once.
- **Edit button** for `editTrigger: 'button'` (the value existed, nothing rendered it — cells couldn't
  be edited with the mouse). Editable cells (not read-only / locked) show it on hover and in the
  focused cell; a click starts editing, F2 / Enter as usual. New input **`editButtonIcon`** (HTML,
  default `✎`, attribute `edit-button-icon`) — e.g. `'<span class="lucide-pencil"></span>'`;
  accessible name `labels.editCell` ("Edit"). `column.isEditButtonVisible` (never read before) shows
  the button in that column whatever the trigger.
- **Keyboard range selection.** Shift+Arrow grows / shrinks a cell range from the focused cell (the
  anchor keeps focus), Shift+Home / End extend to the row start / end, Ctrl+Shift+Arrow to the data
  edge. In `cellSelectionMode: 'click'` (the default) Shift+click now extends the range from the
  focused cell (it started an edit with `editTrigger: 'click'`); `'shift'` mode is unchanged,
  `'disabled'` selects nothing, and while editing Shift+Arrow still selects text in the editor.
- **Filter row.** `isFilterable` now renders a row under the header with a text input for every
  column with `isFilterable: true` (it was API-only — the option, the `.wg__filter-*` CSS and the
  `--wg-filter-*` variables were orphaned). Debounced typing (Enter applies, Escape clears) →
  `setFilter` → page 1; a `filterCallback` returning `null` marks the input `.invalid`; in server
  pagination a change runs `beforePageChangeCallback` and fires `data-request` (trigger `'filter'`).
  Inputs are labelled by their column (`labels.filterColumn`, "Filter {column}"), sticky under the
  header and frozen with their column. Demo: `docs/test/filter-row.html`.
- **`beforePageChangeCallback(ctx)`** — runs before a user action swaps the rows: pager buttons,
  page-size change, header sort (and filter-row changes) in server pagination. ctx = the grid ctx +
  `{ trigger: 'page' | 'pageSize' | 'sort' | 'filter', fromPage, toPage, drafts }`. `false` stays,
  a number goes to that page instead; async OK — the pager is disabled (`aria-busy`) and a second
  navigation ignored while pending. Programmatic `currentPage` writes and `loadMore` skip it. Use it
  to force "save before leaving the page" (`ctx.drafts`) or to allow batch editing across pages.
  `DataRequestTrigger` gains `'filter'`.
- `el.controller` (`GridController`) incl. `insertRow`, `removeRows`, `duplicateRow`,
  `moveRow`, `expandSubtree` / `collapseSubtree`, `selectColumn*`, `closeContextMenu`,
  `closeToolbar`; `createDuplicateRowCallback`; `labels.actions` (built-in texts);
  `filterMode` / `filter-mode`; `cell-selection-mode` attribute; `menuDivider` re-exported; exported types for every ctx,
  item and event detail (`GridContext`, `RowContext`, `CellContext`, `HeaderMenuContext`,
  `GridToolbarItem`, `GridMenuEntry`, `GridShortcut`, `GridActionEventDetail`, `GridEventMap`, …).
- Menus: labelled dividers, `isToggled` (`role="menuitemcheckbox"` + `aria-checked`, `--toggled`), lazy submenus, item `tooltip`.
- **Selection events.** New `row-selection-change` (`onRowSelectionChange`) `{ rows, rowIndices }`
  and `column-selection-change` (`onColumnSelectionChange`) `{ fields }` (on-screen order) — for
  row-number / header clicks (plain, Ctrl, Shift, drag), the selection API, and a selection
  cleared by another kind. `cell-selection-change` gains `fields` (the range's columns,
  on-screen order) and `rows` (the row objects in the range); cleared →
  `{ range: null, cellCount: 0, fields: [], rows: [] }`. All three fire once per gesture / API
  call (a drag notifies on mouseup) and only when that selection actually changed — re-selecting
  the same range / rows / columns or clearing an empty selection is silent (a cell range used to
  re-fire on every `selectCellRange`).

### Fixed

- **The open row toolbar refreshes its buttons after a built-in.** After a move (or any
  built-in that keeps the toolbar open) the buttons are re-resolved against the row's new
  position — `move-down` disables on the last row, `move-up` re-enables off the first — instead
  of keeping the states from when the toolbar opened (a click on the stale button was a no-op).
  Only changed buttons are replaced. Docs: the built-ins run *before* the `action` event
  (README / usage / ai said "after").
- **Shortcuts on an open toolbar follow the moved row.** A `rowShortcuts` key pressed while a
  row / cell toolbar is open targeted the row's index from when the toolbar opened, so after a
  move it hit whichever row now sat there. It now acts on the toolbar's row at its current
  position (a cell toolbar keeps its cell fields), and refreshes the toolbar's buttons and the
  move connector like a click does.
- **Cell ranges with reordered or hidden columns.** Range column indices mixed the
  column index (`data-col`) and the visual position, so a drag selection, its highlight /
  border and `getSelectedCells()` could disagree once columns were reordered or hidden
  (e.g. a drag across the moved columns selected different cells than it highlighted). One
  convention end-to-end now: a `CellRange`'s `startColIndex` / `endColIndex` are visual
  positions (the on-screen rectangle; drag, Shift+click, Shift+Arrow, select-all), mapped to
  the column index when reading — `getSelectedCells()` reports each cell's `colIndex` as the
  column index (`data-col`, like every cell context), no longer the visual position.
- **Fill handle and column selection with reordered or hidden columns.** The fill handle read
  the focused cell's column index as an on-screen position: with a column moved or hidden it
  checked the wrong column's editability (a handle on a read-only column), filled the wrong
  field, and a horizontal drag spanned the wrong columns. The fill now uses on-screen positions
  internally (like cell ranges) and reports column indices in `beforeFillCallback`'s
  `sourceCell` / `targetCells`. The column-selection executor highlighted cells by position as
  if it were `data-col`.
- The floating toolbar ignored hidden items; a cell toolbar's swapped-in items were looked up in the
  base list on click (custom cell items did nothing).
- A row shortcut fired twice when a cell had focus and the hover toolbar was open on the same row.
- Paste validation treated `null` as invalid (an editor commit treats it as valid) — both now
  share one result contract.
- **One keyboard path.** Cell / editor keys were handled twice (action pipeline + a dead copy in
  the cell / editor keydown handlers); the pipeline is now the only path. Fallout fixed:
  a letter typed on an `editor: 'number'` cell no longer starts editing; single-cell Ctrl+C
  honours `getCopyValueCallback`; the new (empty) row is committed by Enter / Tab on its last
  editable cell again (focus moves to the fresh empty row); a clipboard rejection is never an
  unhandled promise rejection.
- Copy (Ctrl+C and the `copy*ToClipboard` methods) copies what the cell shows — draft values,
  not the originals; objects copy as JSON on every path; a range copied while a cell has focus
  honours `shouldCopyWithHeaders`.
- Cmd+G (go to row) and Cmd+Delete (`row-delete` request) work on macOS.
- An empty row built before `columns` were assigned was cached without the column fields.
- Drafts jumped rows on sort / page / filter / tree toggle (they were keyed by the display
  index). They are keyed by row identity now — the `idMember` (or `treePathMember`) value, else the
  row object — as the `idMember` docs already promised. `getDraftRowIndices()` returns the display
  indices of the displayed rows that have a draft.
- **Security:** HTML attribute values were not quote-escaped — row data in a tooltip
  (`getTooltipCallback` / `tooltipMember`) or a cell value could close `data-tooltip="…"` /
  `value="…"` and inject attributes. `"` and `'` are escaped everywhere now (a quoted value also
  reached the text editor truncated).
- A filter (or a shorter `items`) on a later client page rendered an empty grid with "Page 3 of 1".
  A filter change (`setFilter` / `filters`) now goes back to page 1 — a page set in the same task
  (a restored page + filter) is kept; a shorter `items` clamps `currentPage` to the last page.
  A header-menu sort resets to page 1 like a header click.
- Opening an editor and cancelling (or committing the unchanged value) left a phantom draft —
  `isRowDirty` / `hasRowDraft` / `getDraftRowIndices()` reported the clean row as dirty; `isRowDirty` is
  value-based now. The row-number dirty marker updates right after a commit (it waited for an
  unrelated full render).
- Hard-coded English: the lock tooltip, the go-to-row dialog and the tree chevron `aria-label` are
  translatable — new `labels` keys `rowLocked`, `rowLockedBy` (`{lockedBy}`), `goToRow` (`{max}`),
  `goToRowGo`, `goToRowCancel`, `treeExpand`, `treeCollapse`.
- A partial nested `labels.actions` / `labels.contextMenu` wiped the other texts of that group
  (shallow merge); the groups merge too now (`GridLabelsInput` type).
- `expand-change` handed out the grid's live `expandedPaths` Set — an earlier detail changed with
  later toggles, and mutating it changed the grid's state. The detail carries a snapshot now.
- The inline actions column header was blank by default — the `inline-actions-title` default `''`
  hid `labels.inlineActionsHeader` ("Actions"). The default is now absent (→ the label); an
  explicit `inline-actions-title=""` still gives a blank header (narrow one-action columns).
- Persisted column state was wiped when `gridName` / the persist flags were set before `columns`
  (every stored entry looked orphaned and was pruned); the load now waits for the columns.
  `setColumnOrder()` / `setColumnWidths()` are persisted like a drag / resize.
- `startEditing()` rendered an orphaned editor into a read-only / locked cell the engine had
  refused to edit.
- The shortcuts help listed only `rowShortcuts` (and stayed hidden with range shortcuts only);
  `rangeShortcuts` are listed under `labels.rangeShortcuts` ("Selection shortcuts").
- Focus was lost after a move-up / move-down built-in (a repeated move shortcut stopped after
  one step); the focused cell now follows its row.
- Go-to-row Escape / Cancel left no cell focused (arrow keys dead until a click); focus returns
  to the cell the dialog was opened from.
- The validation-error tooltip of a cell appeared only after an unrelated full render (and a
  fixed value kept the old one); the surgical cell update writes the tooltip attributes too.
- `tooltipHideDelay` was ignored when the pointer left the grid: closing the hover row toolbar
  hid every tooltip at once; it now hides only a toolbar-button tooltip.
- The summary (`renderSummaryCallback`) was not refreshed after a cell edit (commits update the
  cell surgically); a `row-change` now re-renders the summary blocks.
- Pasted values in `editor: 'number'` columns stayed strings (`"21"`) — in drafts and in rows
  created by the paste; they are numbers now (blank → null). Checkbox columns type pasted text too
  (`true` / `1` / `yes` / `x` / `✓` or the `trueValue` text → `trueValue`; `false` / `0` / `no` /
  blank or the `falseValue` text → `falseValue`), and date columns (the column's `dateFormat`,
  then ISO `YYYY-MM-DD`, stored per `outputFormat`). Text that doesn't parse is kept and the cell
  marked invalid (`labels.invalidBoolean` / `invalidDate`). `getPasteValueCallback` still wins.
- **Number editor validates.** `abc` was stored as the string `"abc"`, `12abc` silently became
  `12`, and `editorOptions.min / max / decimalPlaces / allowNegative` were ignored. The parse is
  strict now (`Number()` + `isFinite`; blank → null) for editor commits and pastes: a non-number,
  a value outside `min` / `max`, or a negative with `allowNegative: false` marks the cell invalid
  (`validation-error`, new `labels.invalidNumber` / `numberMin` / `numberMax` / `numberNegative`)
  with the typed value kept in the draft — no clamping; `decimalPlaces` rounds (`1.239` → `1.24`).
  The editor renders `min` / `max` / `step`; its value attribute is escaped.
- `isCheckboxAlwaysEditable` had no effect; with it on, one click on a display checkbox toggles
  it in navigate / click modes (the same toggle as Space).

### Changed

- **Dark / light follows the page in every browser (core theme context).** The page signal
  (`data-theme`, `data-bs-theme`, `.dark` / `.light` on `<html>` / `<body>`) now comes from
  `@keenmate/web-components-core`, mirrored onto the grid as `data-context-theme`, instead of
  `:host-context()` — which Firefox doesn't support and Safari only partly, so dark pages
  rendered a light grid there. A themed **wrapper** (`<div data-theme="dark">`) now needs
  `theme-source="closest"` on the grid; per-instance `data-theme` is unchanged, and the OS is
  still followed only through the page's `color-scheme`. Built on core 1.0.0-rc15 (was rc02).
- **Shadows share one tone with pure-admin: `--base-shadow-color`.** Dialog, tooltip, frozen-column
  edge, toolbar / context-menu / datepicker fallbacks keep their sizes but take their colour from
  `--base-shadow-color` (falls back to the previous black when the base layer is absent).
- **Reads `--base-primary-*` (was `--base-accent-*`)**, following `@keenmate/base-css-variables`
  2.0.0, which drops the `accent` names: `--base-primary-color[-hover|-active]`,
  `--base-primary-bg-subtle[-hover]` (was `-color-light[-hover]`) and `--base-on-primary-text-color`
  (was `--base-text-color-on-accent`). The component's own `--*-accent-*` tokens keep their names.
  Docs, examples and manifest updated.
- **Tooltip background no longer falls back through `--base-inverse-bg`** (removed in
  `@keenmate/base-css-variables` 2.0.0): it reads `--base-tooltip-bg` directly, then the
  component's own default. No visual change — `--base-tooltip-bg` is always defined by the contract.
- **Reads the 2.0.0 type-stating names:** `--base-outline-width` / `--base-focused-outline` /
  `--base-highlighted-outline` (were `-ring`), `--base-*-text-color` (was `-text`),
  `--base-on-<role>-text-color` (was `--base-text-on-<role>`), `--base-input-text-color` (was
  `--base-input-color`), `--base-input-icon-color` / `-icon-bg-hover` (were `--base-input-clear-*`),
  `--base-tooltip-text-color` (the `--base-tooltip-color` duplicate is gone) — whichever of these
  the component uses.
- **Invalid-cell tint reads `--base-danger-bg-subtle`** (was `--base-danger-bg-light`), following
  `@keenmate/base-css-variables` 2.0.0, which folds the two role tints into one. Docs and
  manifest updated.

### Added

- **`GridElement` now builds on `@keenmate/web-components-core` (`BlissElement`).** web-grid was the last of the five KeenMate components still re-implementing its own custom-element base. It now extends core's SSR-safe `BlissElement` (per-instance registry, lifecycle hooks) while keeping its full config-object/property API — columns, items, and every `on*`/`*Callback` stay properties, exactly as before.
- **Declarative attribute layer — 60 scalar/enum config flags are now real HTML attributes.** Previously web-grid had *no* observed attributes: markup like `<web-grid is-striped is-hoverable>` was silently dead (the flags only worked as JS properties). A core `static inputs` table now maps each scalar/enum flag to a kebab-case attribute parsed through a typed converter, e.g.:

  ```html
  <web-grid is-striped="false" page-size="25" mode="excel"
            edit-trigger="dblclick" is-pageable sort-mode="single"></web-grid>
  ```

  Covers appearance (`is-striped`, `is-hoverable`, `is-table-border-only`, `is-scrollable`, `scroll-max-height`), paging (`is-pageable`, `page-size`, `pagination-mode`, `is-pagination-visible`, `pagination-position`, `pagination-layout`), editing (`is-editable`, `edit-trigger`, `edit-start-selection`, `should-commit-on-click-away`), toolbar, tree, virtual/infinite scroll, paste, dropdown, and more. Absent attribute = the documented default. Structured config (columns/items/callbacks), self-mutated UI state (`currentPage`, `sort`, `filters`, `focusedRowIndex`, `totalItems`, `expandedPaths`, `hasMoreItems`) and the two column-persistence flags stay property-only by design.

### Changed

- **Attribute values are validated by their converter.** A malformed or out-of-range attribute (e.g. `page-size="abc"`) falls back to the default with a `console.warn` instead of forwarding garbage to the grid. The synchronous property API is unchanged — `el.pageSize = 25`, presets like `el.mode = 'excel'`, and immediate reads of `el.grid.*` propagate synchronously, exactly as before; only the new *attribute* path is coalesced through core.

- **Five UI-state clusters extracted from `GridElement` into dedicated Service classes.** The Element layer is supposed to be a thin I/O wrapper — tooltip / dropdown / dropdown-search / virtual-scroll / floating-toolbar state belongs in modules. Each service is independently unit-testable and has a single, self-documenting public surface. Module functions (and the GridContext interface) consume the service instances instead of bare flat fields:

  | Service | Fields owned | Surface change |
  |---|---|---|
  | `VirtualScrollService` (`modules/scroll/`) | `start`, `end`, `isLoadingMore`, `isProgrammatic` | `this.virtualScroll.X` on GridElement |
  | `ToolbarService` (`modules/toolbar/`) | hide-timeout, hover / move flags, hovered cell, cell-items JSON, document keydown handler | `this.toolbar.X` on GridElement (private) |
  | `AutocompleteService` (`modules/dropdown/`) | debounce timer, abort controller, `isSearching` | `ctx.autocomplete.X` in modules; `this.autocomplete.X` on GridElement |
  | `TooltipService` (`modules/tooltip/`) | element, arrow, anchor, show/hide timers | `ctx.tooltip.X` in modules; `this.tooltip.X` on GridElement |
  | `DropdownService` (`modules/dropdown/`) | `isOpen`, `options`, `highlightedIndex`, `filterText`, `isUserFiltering`, `justSelected`, `isOpening`, `userInteracted`, `isClosingViaToggle` | `ctx.dropdown.X` in modules; `this.dropdown.X` on GridElement |

  Dead field `toolbarMousemoveHandler` (declared but never assigned/used) dropped. `tooltipShowDelay` / `tooltipHideDelay` remain as accessors on GridContext — they're configuration, not runtime state. `isCommittingFromKeyboard` and `isTransitioningCells` remain on `GridElement` — they're editing-state-machine flags, distinct from dropdown state.

- **Nine TypeScript types renamed to drop the forbidden `Type` / `Info` suffix.** Old names retained as `@deprecated` type aliases for one release; both names refer to the same shape. Drop the aliases in the next major. Migration is a flat find/replace.

  | Old name | New name |
  |---|---|
  | `EditorType` | `Editor` |
  | `PredefinedToolbarItemType` | `PredefinedToolbarItem` |
  | `RowActionType` | `RowAction` |
  | `PredefinedContextMenuItemType` | `PredefinedContextMenuItem` |
  | `PredefinedHeaderMenuItemType` | `PredefinedHeaderMenuItem` |
  | `RowLockInfo` | `RowLock` |
  | `ClickEventType` | `ClickEventKind` (discriminator union; avoids DOM-`Event` family naming) |
  | `FocusEventType` | `FocusEventKind` (avoids shadowing the global `FocusEvent` DOM interface) |
  | `FormatInfo` | `FormatSpec` |

  `getRowLockInfo()` / `lockInfoMember` keep their names — they're nouns describing actions / property accessors, not types. Only the type name changed.

- **Three boolean Config fields renamed to the canonical `is*` / `should*` prefix.** Old names retained as `@deprecated` aliases for one release; both names refer to the same internal state, so consumers can migrate at their own pace. Drop the aliases in the next major.

  | Old name | New name |
  |---|---|
  | `showPagination` | `isPaginationVisible` |
  | `toolbarFollowsCursor` | `shouldToolbarFollowCursor` |
  | `tableBorderOnly` | `isTableBorderOnly` |

  Migration: a flat find/replace on the property names is sufficient — the types match, the semantics are identical. Two data-model booleans (`multiple` on combobox/autocomplete editor options; `nowrap` on column definitions) keep their bare names because they mirror HTML conventions (`<select multiple>`, `nowrap`); see `packages/web-grid/VALIDATION-NOTES.md` for the carve-out.

- **`--base-tooltip-color` reads now chain through the canonical `--base-tooltip-text-color`.** The canonical `--base-*` taxonomy renamed `--base-tooltip-color` to `--base-tooltip-text-color` on 2026-06-11 (consistent with the `*-text-color` pattern used by `--base-text-color-1` / `-2` / `-on-accent`). `--wg-tooltip-color` now reads the new name first, falls back to the legacy name, then the hardcoded `light-dark()` literal — so consumers on either name keep working through this release. Drop the legacy read in the next major. Manifest updated to list both entries with a "legacy" note.

- **`src/css/table.css` renamed to `src/css/base.css`** to match the canonical Tier-1 file name used by other Bliss components (web-multiselect, web-daterangepicker, svelte-treeview). The file's actual role is FOUC + root container baseline, not table chrome — the new name describes its content. Consumers who deep-import the file via `@keenmate/web-grid/src/css/table.css` must update the path; consumers using `main.css` are unaffected.
- **`--wg-tree-*` variable declarations consolidated into `variables.css`.** The four `--wg-tree-indent` / `--wg-tree-chevron-*` declarations moved from a `:host` block in `tree.css` into the existing `:host` block in `variables.css` (new `/* === TREE === */` section). Honors the "one place for `--wg-*`" contract — consumers can now find every overrideable variable in a single file. No visual or runtime change.
- **`--wg-selection-row-number-color` fallback chain canonicalized.** Was `var(--base-text-inverted, #fff)`; now `var(--base-text-color-on-accent, light-dark(#fff, #fff))`. `--base-text-inverted` was not part of the canonical `--base-*` taxonomy; `--base-text-color-on-accent` is the correct read and matches `--ms-text-color-on-accent` in web-multiselect. The `light-dark()` wrap makes the fallback script-conformant — the white-on-accent reading is identical in both branches because the accent stays the same color across schemes. `--base-text-inverted` removed from `component-variables.manifest.json` (the entry described a `--base-*` read that no longer exists).
- **README migration to the canonical landing-page + `docs/` layout.** README slimmed from 1076 → 117 lines (under the 200-line soft target). Four new files at `packages/web-grid/docs/`: `usage.md` (full property / column / editor / event / method reference), `theming.md` (the four contracts — container / variables / color-scheme / cascade layers), `examples.md` (cookbook of recipes pointing at the 24 runnable `docs/examples-*.html` demos), `accessibility.md` (keyboard model, ARIA additions, focus management, contrast targets). Resolves the BlissFramework readme-structure validation triad and consolidates the theming contract that was scattered across the README into a single dedicated file.

## [1.2.0-rc02] - 2026-06-11 [PUBLISHED]

### Added

- **`shouldCommitOnClickAway` property** (defaults to `true`) — Excel-like commit-on-click-away. Clicking a different cell while editing now commits the in-progress value through the existing `beforeCommitCallback` / `validateCallback` pipeline instead of silently discarding it. Set to `false` to preserve the legacy discard behavior. Wired into both the pipeline mousedown path and the four legacy click-transition paths via a new `commitOrCancelEditOnTransition` helper that reads the editor value from the DOM for text/number/date/checkbox/select editors. Covered by two new tests in `e2e/edit-trigger.spec.ts`.

### Fixed

- **Row focus on first cell click** — `.wg__row--focused` was never applied on the first cell click because the pipeline marked cell selection as pending on every mousedown, which suppressed the legacy row-focus update in the host mousedown handler. `setFocusedRow` + visual update moved into `executeFocusCell` so every `focusCell` action (mouse + keyboard) updates row focus, regardless of pending state. Shift+click still extends a range without dispatching `focusCell`, so range selection is unaffected.
- **Dark-mode signal handling no longer overrides consumer `--base-*` themes.** The framework-class and per-instance dark-mode blocks in `dark-mode.css` previously set `--wg-main-bg`, `--wg-elevated-bg`, `--wg-text-color-*`, etc. to hardcoded literals (`#1f1f1f`, `#2b2b2b`, …). On a page with pure-admin's dark theme loaded, those overrides won at host-selector specificity and silently replaced the consumer's `--base-*` values for resolution inside the shadow root. Same bug web-multiselect had and fixed in v1.11. The dark-mode block now only sets `color-scheme: dark/light` based on signals; every `--wg-*` color already resolves through `light-dark(<light>, <dark>)` in `variables.css`, so flipping `color-scheme` picks the dark branch automatically while leaving the consumer's `--base-*` chain intact as the source of truth.
- **Dirty indicator colors (`--wg-dirty-indicator-color`, `--wg-dirty-cell-bg`, `--wg-dirty-row-number-border-color`) now wrap their values in `light-dark()`** so they auto-flip when `color-scheme` resolves to dark, instead of relying on the dark-mode block to set them. Light value unchanged (`#ed8b00` orange); dark value brightened to `#ffa940` for contrast on dark surfaces (same as the prior dark-mode override).

### Changed

- **OS preference (signal #1) now requires the consumer to opt in** by setting `color-scheme: light dark` on `<html>` (or any ancestor). This mirrors web-multiselect's approach — without opt-in, `light-dark()` defaults to the light branch even when the OS prefers dark. Previously a `@media (prefers-color-scheme: dark)` block in `dark-mode.css` force-set web-grid to dark on OS-preference matches; that block has been removed because it overrode consumers who deliberately pinned their app to one mode. Test fixtures (`docs/test/theming.html`) now set `color-scheme: light dark` on `<html>` to keep the OS-preference e2e test passing.

## [1.5.0] - 2026-06-10

### Changed

- **Surface taxonomy renamed to match pure-admin's `--base-*` semantic names.** The internal `--wg-surface-1/2/3/floating` numbering originated when pure-admin emitted `--base-surface-1/2/3`; pure-admin renamed those to `--base-main-bg / --base-elevated-bg / --base-hover-bg / --base-dropdown-bg` and removed the legacy aliases, so web-grid's surface names drifted into a parallel taxonomy. Consumers overriding the old names need to migrate:
  - `--wg-surface-1` → `--wg-main-bg`
  - `--wg-surface-2` → `--wg-elevated-bg`
  - `--wg-surface-3` → merged into existing `--wg-hover-bg` (both sourced from `--base-hover-bg` already; the two were redundant)
  - `--wg-surface-floating` → `--wg-dropdown-bg`
- **`--wg-pagination-btn-bg-active`** now defaults to `var(--wg-hover-bg)` (was `var(--wg-surface-3)`, which resolved to the same `--base-hover-bg`). Visual behaviour unchanged.

### Fixed

- **Context menu was referencing pure-admin variables that no longer exist** (`--base-layer-01`, `--base-stroke-default`, `--base-text-color-primary`, `--base-text-color-secondary`, `--base-error-color`, `--base-layer-hover`, `--base-shadow-lg`). Updated to the current canonical names (`--base-main-bg` via `--base-dropdown-bg`, `--base-border-color`, `--base-text-color-1`, `--base-text-color-2`, `--base-danger-color`, `--base-hover-bg`, `--base-dropdown-box-shadow`). Without this fix, every fallback was silently in use even when a pure-admin theme was loaded.
- **Stale doc examples** in `README.md`, `CLAUDE.md`, and `ai/styling-theming.txt` mentioned the long-removed `--base-layer-*` / `--base-stroke-*` / `--base-error-*` names. Updated to current taxonomy.

## [1.4.0] - 2026-06-10

### Changed

- **CSS file structure refactored to the canonical web-component pattern** documented at `BlissFramework/guidelines/web-components/css-structure.md`:
  - Underscore prefix dropped from every CSS filename (`_variables.css` → `variables.css`, etc.). The underscore was a SASS partial convention with no meaning in pure CSS. Consumers importing individual CSS files by path must update those imports.
  - `main.css` now declares `@layer variables, component, overrides;` and every `@import` is wrapped in `layer(...)`. Consumer override contract: any unlayered consumer rule beats every rule in `@layer component` — `!important` no longer needed to override default styling. `:root` `--base-*` declarations still beat the variables layer via custom-property inheritance.
  - `main.css` header rewritten to describe the layer contract and the BEM convention; the previous file-list comment (which had drifted) is gone.
- **Mixed-bag files split**:
  - `dialogs.css` now owns only the Go-to-row dialog. Tooltip rules moved to `floating.css`.
  - `modifiers.css` deleted; its content (striped, hoverable, empty state, loading indicator) moved to `states.css`.
- **`@keyframes` centralized in `animations.css`** — currently just `wg-pulse` (loading indicator on autocomplete/combobox editors). Was previously inline in `editors.css`.

### Added

- **Four canonical Tier-2 CSS files** to align with the cross-component pattern, sitting between `base` and feature files:
  - `controls.css` (stub — web-grid's interactive controls are all feature-specific)
  - `floating.css` (tooltip; future floating chrome lands here)
  - `states.css` (striped/hoverable rows, empty state, loading indicator)
  - `animations.css` (`@keyframes` declarations)
- **Section banners on `editors.css`** for TEXT/NUMBER, DATE, CHECKBOX, CUSTOM, COMBOBOX/AUTOCOMPLETE editor types. Previously only the combobox section was banner-marked.

### Notes

- No behavioral changes, no API changes, no DOM-class renames. Strictly an internal-structure refactor.
- Full e2e suite passes (275 passed, 3 skipped). Library bundle size essentially unchanged.

## [1.3.0] - 2026-06-10

### Changed

- **`--base-*` taxonomy fallback chains**: `--wg-surface-floating` now chains `var(--base-dropdown-bg, var(--base-elevated-bg, …))` so floating UI (toolbar / context menu / dropdown panels) picks up theme-designer's elevated-bg when no dropdown-specific override is set. `--wg-tooltip-bg` now chains `var(--base-tooltip-bg, var(--base-inverse-bg, …))` for cross-component consistency. Existing `--base-dropdown-bg` / `--base-tooltip-bg` overrides keep working unchanged — these chains are second-tier fallbacks.
- **`--wg-active-bg` now sources from `--base-active-bg`**: previously it shared `--base-hover-bg` with `--wg-hover-bg`, so theme overrides could not distinguish active from hover. The new `--base-active-bg` lets theme-designer drive both states independently while still falling back to a color-mix derived from text + main-bg.
- **OS-aware dark mode via `light-dark()` in fallbacks**: hardcoded fallbacks for text / surface / border / input / hover / tooltip variables are now wrapped in `light-dark(<light>, <dark>)`. Consumers who set only `body { color-scheme: dark }` (no overrides, no framework class) now get a sensible dark palette automatically. The existing `dark-mode.css` selectors (`data-theme="dark"`, `data-bs-theme="dark"`, `.dark`, `@media (prefers-color-scheme: dark)`) remain in place for framework-driven theme switches.
- **Adaptive hover/active via `color-mix`**: `--wg-hover-bg` and `--wg-active-bg` fall back to `color-mix(in srgb, var(--wg-text-color-1) 8%/14%, <main-bg>)` instead of flat surface colors. The mix steps toward the text color, so highlights stay visible in both light and dark modes.

### Added

- **`--base-active-bg` and `--base-inverse-bg`**: two new cross-component theming hooks listed in `component-variables.manifest.json`. `--base-active-bg` distinguishes the pressed/active state from hover; `--base-inverse-bg` provides the inverse-colored surface for tooltips (and any future inverse UI). Both are optional and additive.

### Tests

- **Dark-mode WCAG contrast suite**: `e2e/dark-mode.spec.ts` mounts three grids on a dark page (fully themed, minimal-override, zero-override) and computes the WCAG contrast ratio for header / body / hover / focused / selected-row-number / editing-cell states. 18 assertions, all required to clear 3:1 (WCAG AA for non-text UI). Fixture: `docs/test/dark-mode.html`. Catches theme regressions that wouldn't surface from visual smoke testing.

## [1.2.0-rc01] - 2026-05-17 [PUBLISHED]

### Added

- **Tree / hierarchy context-menu predefined items**: `expand-all`, `collapse-all`, `expand-tree`, `collapse-tree` as string shorthand or `{ type: ... }` object form in `grid.contextMenu`. Per-row `expand-all` / `collapse-all` operate on the right-clicked subtree (file-explorer convention); `expand-tree` / `collapse-tree` operate on the entire tree. Caller can override `label`, `icon`, `onclick`, or `visible` while keeping the predefined behavior. New types: `ContextMenuConfig`, `PredefinedContextMenuItemType`. New helper: `normalizeContextMenu(config, grid)`.
- **`GRID:PERF` logger category**: Tree-toggle and render timings (data-pipeline cache, microtask delay, render body + summary, render total) route through `perfLogger.debug()`. Toggle via `window.components['web-grid'].logging.setCategoryLevel('GRID:PERF', 'debug' | 'silent')`. Counters live in a small `gridPerf` object exposed for ad-hoc instrumentation.
- **Paste API proxied through `<web-grid>`**: `onpaste`, `onbeforepaste`, `pasteMode`, and `shouldValidateOnPaste` are now reachable directly on the GridElement instance instead of requiring `el.grid.*`. `onbeforepaste` / `pasteMode` / `shouldValidateOnPaste` are normal class-accessor proxies; `onpaste` is installed via `Object.defineProperty` in the constructor because HTMLElement already declares `onpaste` as a ClipboardEvent handler — a class-level accessor with our `PasteDetail` signature would break the structural-typing contract with `HTMLElement` (and the `customElements.define` call). TypeScript consumers reading `el.onpaste` still see the native ClipboardEvent type; cast on assignment or use `el.grid.onpaste = fn` for full type fidelity. JS consumers have no friction.

### Changed

- **Tree column is now read-only when tree mode is active**: The column marked `isTree: true` hosts indent + chevron and (typically) the row's display name — editing it inline conflicts with the toggle interaction and rarely matches user intent. `column.isEditable: true` on the tree column is ignored. To make a column editable, omit `isTree: true` on it or move the tree marker to a different column.
- **Tree chevron uses a single rotating glyph** with a 120ms CSS transition. Default `treeExpandedGlyph` and `treeCollapsedGlyph` are both `▶`; `.wg__tree-chevron--expanded` rotates 90° on expand. Users who set distinct glyphs continue to get the swap behavior (no rotation).
- **Tree cell layout switched to inline-flex**: Replaced absolute-positioned chevron + computed `padding-left` with `display: inline-flex; gap` plus `padding-inline-start: level * --wg-tree-indent` on the wrapper. Leaf rows get a `wg__tree-leaf-spacer` for alignment with branches. Renamed CSS class `wg__tree-cell-content` → `wg__tree-cell-body`.
- **Tab navigation in heterogeneous trees**: Tab and Shift-Tab now skip rows with zero editable columns (e.g., team / category rows whose every cell is read-only) and walk forward / backward to the next row that has at least one editable column. Previously focus would land on a `<td>` with no editor and the spreadsheet pattern broke.
- **Auto-open editor after Tab/Shift-Tab in `dblclick`/`click`/`button` edit modes**: After committing a cell with Tab, the next editable cell now auto-opens its editor instead of leaving the user on an idle `<td>`. Deferred one frame so the previous editor unmounts before the next mounts.
- **Focus outline now applies in read-only navigate mode**: `.wg__cell--focused` outline applies under `.wg--navigate-mode` as well as `.wg--editable`. Read-only trees were focus-invisible before.

### Fixed

- **Tree-row expand was 700 ms+ on ~700 rows**: the `displayItems` getter ran the full sort → filter → page → tree-flatten pipeline on every cell render — ~800 invocations per render, totaling ~615 ms of recomputation. Memoized `paginatedItems` and `displayItems`; cache invalidated in the `requestUpdate` override on every state change. Render body dropped from ~615 ms to ~16 ms (~40× speedup).
- **Render now does a surgical DOM update** when the container, table, thead, tbody, and top/bottom-area wrappers already exist: replaces only the inner contents of those slots; preserves event listeners on `<table>`, scroll position, focus, and external references. Falls back to a full rebuild when the structure isn't in place.
- **Per-row `isEditable` predicates now apply in all action paths**: checkbox toggle, delete-cell, paste, fill-handle drag, and Tab navigation now all pass the row to `isCellEditable`. Previously many call sites omitted the row, so per-row read-only conditions silently let edits through. Heterogeneous trees (only leaves editable) now work correctly across every interaction, not just direct cell click.
- **Body-cell width could exceed header's `maxWidth`** with auto table-layout: body cells now mirror the header's `min-width: column.minWidth ?? grid.columnMinWidth`, get `max-width: cellWidth` when an explicit width is set, and apply `white-space: nowrap` directly when `column.nowrap` is true. Previously body cells could drag a column past the header's clamps because their intrinsic width determined the column's natural width.
- **Pasting into an autocomplete cell did not trigger the search**: `handleAutocompleteInput` set `ctx.filterText = input.value`, then called `renderDropdown(...)` on the "show dropdown immediately" branch. `renderDropdown` calls `removeDropdown` on entry, which resets `ctx.filterText` to `''`. The handler then read the empty string back for the `minLength` check and bailed without scheduling the debounced search. Typing only "worked" because keystrokes 2+ skipped the `if (!ctx.dropdownOpen)` branch and avoided the wipe — a single bubbling `input` event (paste, programmatic value set, `fill()`) had no follow-up keystroke to recover. Fix: capture `const query = input.value` at the top of `handleAutocompleteInput`, use it for the `minLength` check and the debounced `performAutocompleteSearch` call, and restore `ctx.filterText = query` after the render.
- **Cell did not re-render after a custom editor's commit or cancel**: `cellEditCallback`-driven editors that called `ctx.commit(value)` or `ctx.cancel()` left the cell's DOM in its mid-edit state until the next render pass. Now the cell re-renders synchronously after either path.
- **`oncontextmenuopen` callback was settable but not readable**: assigning the handler worked, but reading `grid.oncontextmenuopen` returned `undefined`. Added the missing getter so the property round-trips like other `on*` event hooks.
- **Pagination event listeners detached after surgical renders**: the new surgical-update path in `render()` replaced inner contents of the top/bottom-area wrappers but didn't re-bind the pagination button listeners attached to those wrappers. Clicking pagination buttons after any state change that triggered a surgical render became a no-op. Listeners are now reattached as part of the surgical pass.
- **Datepicker pipeline executor ignored `outputFormat`**: when a date column declared `editorOptions.outputFormat: 'timestamp'` (or `'date'`), `modules/actions/executors/datepicker-executor.ts` committed an ISO string anyway because `handleDateSelect` was hardcoded to `toISODateString(date)`. The legacy commit path on `web-component.ts` already honored the format, so the bug only showed up under `editTrigger='always'` and on keyboard-driven select (Enter / Tab) from the action pipeline. Now branches on `iso` / `date` / `timestamp` like the legacy `commitDateEditor`.
- **Removed `[LEGACY]` stack-trace dumps from the hot path**: `console.trace('[LEGACY] …')` calls in `web-component.ts` (`openDatePicker`, `handleDatePickerSelect`, `commitDateEditor`) and `modules/editing/lifecycle.ts` (`toggleCheckboxAndMove`) dumped a full stack trace on every datepicker open / day select / commit and on every navigate-mode checkbox toggle. Leftover instrumentation from a half-finished migration to the action pipeline.
- **Datepicker closed when you clicked its own chevrons / month-year header / disabled days**: the picker mounts in `document.body`, so any click on its chrome appeared as "outside the grid" to two independent listeners — `handleTableFocusOut` (via the date input's `focusout`) and `handleDocumentClick` (via the document-level click listener for outside-click detection). The first chain re-rendered the cell, detaching the editor anchor, which prompted Floating UI's `autoUpdate` to silently close the picker. The second chain dispatched `outsideClick` → `cancelEdit` directly. Both now consult an `isInsideOwnedPopover` predicate that recognizes our `document.body`-hosted popovers (datepicker, cell context menu, header context menu) as part of the grid's logical scope. New helpers: `DatePicker.getElement()`, `ClickEventManager.init(..., isPathInOwnedScope?)`. Side effect: the same fix prevents identical tear-down for the cell and header context menus if any of their items shift focus.

### Tests

- **E2E suite migrated to dedicated test-fixture pages**: Playwright specs now target purpose-built `docs/test/*.html` fixtures instead of the user-facing `docs/examples-*.html` demos. Each fixture exposes grid state through `[data-testid="…"]` nodes, so specs assert against deterministic seeds rather than the marketing chrome of the demos. Coverage added for selection, validation, keyboard shortcuts, edit-trigger modes, dropdowns (select / combobox / autocomplete), grid-mode preset, height-mode tableBorderOnly, custom-styling callbacks, column visibility (API + `hideColumn` / `columnVisibility` header context menu items), and the cell + header context menu module (dynamic labels, visible / disabled / danger / divider / shortcut, `oncontextmenuopen` / `onheadercontextmenuopen`).
- **Paste, virtual scroll, tree scroll, datepicker coverage**: 45 additional tests across `e2e/paste.spec.ts`, `e2e/virtual-scroll.spec.ts`, `e2e/tree-scroll.spec.ts`, `e2e/datepicker.spec.ts`. The paste spec exercises single-cell + multi-cell TSV paste with header detection, paste-mode (`skip-non-editable` / `all-columns`), new-row creation when the paste extends past the grid, `onbeforepaste` cancel, and the new web-component proxies. The virtual-scroll fixture asserts the spacer-row pattern (DOM body row count stays small even when `items.length === 1000`) and exercises infinite scroll via `ondatarequest` with `mode='append'`. The tree-scroll fixture combines tree mode with both scroll primitives — a 850-row 3-level tree with `defaultExpandDepth=1` plus an infinite-scroll grid that appends full root subtrees in batches. The datepicker fixture covers F2-open / click-to-select / arrow / Enter / Escape / outside-click flows, the chevron / month-year-header / disabled-day click behavior that was previously broken, and verifies `outputFormat='iso'` / `'timestamp'` and `dateFormat='DD.MM.YYYY'`. Total: 258 tests, 255 passing, 3 skipped.
- Fixture pages are dev-server-only (the docs `vite build` bundles `index.html` only).

### Docs

- **Dev page version badge** now reads from `packages/web-grid/package.json` via Vite's `__VERSION__` define instead of being hardcoded.

## [1.1.0] - 2026-04-30 [PUBLISHED]

### Added

- **Tree / hierarchy mode**: Render tree-structured data using ltree-style path strings (e.g. `"1.2.3"`, `"/a/b/c"`, `"C:\\Win\\Sys"` — separator auto-detected from the first row). Mark one column with `isTree: true` to add depth-based indentation and an expand/collapse chevron. Levels and parent paths are derived from the path string by default; provide `treeLevelMember` / `treeParentMember` if your DB already computes them. Sort is sibling-aware (parents always above their children); filter auto-expands ancestors of matches; pagination operates on currently-visible (post-collapse) rows. New props: `treePathMember`, `treeLevelMember`, `treeParentMember`, `treeSeparator`, `treeDataSorted`, `expandedPaths` (mutable Set), `defaultExpandDepth`, `treeDoubleClickBehavior`, `treeExpandedGlyph`, `treeCollapsedGlyph`, `treeChevronCallback`. Per-column flag: `isTree`. Methods: `isPathExpanded`, `toggleExpandedPath`, `expandAll`, `collapseAll`, `getRowTreeInfo`. Event: `onexpandedpathschange`. Two demo pages: **Tree / Hierarchy** (org chart + filesystem with Font Awesome icons + grouped-aggregate sort) and **Tree + Virtual / Infinite Scroll** (test view stressing 12k+ row trees with virtual scroll and lazy-loaded subtrees).
- **`treeChevronCallback` per-row icon override**: Receives `{ expanded, hasChildren, row, level, path }`, returns HTML for the chevron's inner content. Result is cached per `(row, expanded, hasChildren)` so the callback fires at most a handful of times per row across re-renders. Cache invalidated automatically when items or the callback are replaced.
- **`treeDoubleClickBehavior`**: `'none'` (default) or `'toggle'`. When set to `'toggle'`, double-clicking a tree-column cell expands/collapses the node. Detection uses `MouseEvent.detail === 2` on mousedown (not native `dblclick`) because the cell's innerHTML gets re-rendered between clicks, which suppresses the browser's dblclick event.

### Fixed

- **Spurious `onrowchange` events when entering edit mode and exiting via arrow keys**: `commitEdit` fired `onrowchange` unconditionally on every commit, even when `finalValue === oldValue`. This produced "X → X" change events when a user opened the editor in navigate mode (Excel-like) and pressed up/down without typing. Now `onrowchange` only fires when the value actually changed, or when validation failed (callers may want to know about the latter even with no value diff). Same fix applied to `updateDraftValue` (used by checkbox repeat-toggle).
- **Pathological filler-cell width with absolutely-positioned editors**: `.wg__table` had `min-width: max-content` which asks the browser for the table's intrinsic max-content size, computed recursively through all cell contents. With `overflow: auto` ancestors plus absolutely-positioned `.wg__editor` children, this computation could balloon — Firefox especially, but reproducible in Chromium too. Removed the `min-width: max-content` line; `table-layout: fixed` already causes the table to extend past the container when explicit column widths sum exceeds the container, so the min-width was redundant.
- **Logger leaking `%c` formatter codes into the console**: The colored-prefix logic in `logger.ts` checked `args[0].includes('%c')` before the prefix plugin had prepended its `%c`-laden prefix, so the corresponding CSS color args never got injected and the raw codes leaked through (e.g. `[GRID:UI]%c message`). Replaced the colored prefix with plain text (`[time] [LEVEL] [name]`) — the visual benefit of colored logs was marginal and not worth the breakage.

### Docs

- **Product-search custom-editor demo**: New `examples-product-search.html` with a full custom-editor dialog showing keyboard navigation, highlighted query matches, and a catalog-lookup formatter — a richer reference for `cellEditCallback` patterns than the minimal snippet in the editors page.
- **Fill-handle demo updated to current `cellEditCallback` signature**: The star-rating example in `examples-fill-handle.html` was using the older positional signature and silently never fired. Ported to the current single-context signature with `editor: 'custom'`.
- **Examples landing page grouped into categories**: `docs/index.html` now organizes examples into "Library" and "Practical Examples" rather than a flat list.
- **README refresh**: Updated the package README with current API surface and feature highlights (~250 lines reworked).

## [1.0.5] - 2026-04-21

### Fixed

- **Context menu not flipping at screen edges**: Both the cell context menu and header context menu clipped instead of flipping to the opposite side when opened near a viewport edge. The root menu used `strategy: 'absolute'` inside a `position: fixed` container, which gave Floating UI the wrong bounds for `flip`/`shift`. Switched to `strategy: 'fixed'` with `position: fixed` on the menu itself so placement math runs in viewport coords.
- **Submenus clipping at screen edges**: Header menu submenus (e.g. Column Visibility) were positioned with plain CSS (`left: 100%`) and shown via `:hover`, so they overflowed the viewport with no flip behavior. Replaced with Floating UI `computePosition` (`placement: 'right-start'` + `flip` fallbacks + `shift`) and JS-based hover handlers with a short hide delay so the cursor can cross into the submenu.
- **Context menu not closing on grid-internal scroll**: The menu subscribed only to the `'window'` scroll source, but scroll events from the grid's `.wg` container live inside shadow DOM and are non-composed, so they never reach the window capture listener. Now subscribes to both `'window'` and `'container'` sources, matching the dropdown close-on-scroll pipeline.
- **Context menu offset not flipping with placement**: The configured `contextMenuXOffset`/`contextMenuYOffset` were pre-added to the click coordinates, so when the menu flipped to `*-end` or `top-*` the offset pushed the menu the wrong way (toward the cursor instead of away). Now applied via Floating UI's `offset` middleware as `{ mainAxis: yOffset, alignmentAxis: xOffset }`, which flips sign automatically with the resolved placement.
- **Dropdown selected option unreadable in dark mode**: The `--wg-accent-color-light` fallback was a hardcoded opaque pale blue (`#e6f2ff`) and was not overridden in the dark-mode block, so the selected option in select/combobox/autocomplete dropdowns rendered bright-blue text/background against the dark surface. Replaced the fallback with `color-mix(in srgb, var(--wg-accent-color) 15%, transparent)` — the same transparent-tint pattern already used for selection/row-focus/fill-range — so it blends with whichever surface sits behind it in either theme.

## [1.0.4] - 2026-03-31

### Added

- **Dirty cell/row indicator**: New `isDirtyIndicatorVisible` property (default: `true`) shows which cells have been edited but not saved. Dirty cells get a subtle orange background tint and a small corner triangle (Excel-style). Row numbers show an orange left border when any cell in the row is modified. Fully themable via `--wg-dirty-indicator-color`, `--wg-dirty-cell-bg`, `--wg-dirty-indicator-size`. New public methods: `isCellDirty(rowIndex, field)`, `isRowDirty(rowIndex)`.

### Fixed

- **Dropdown positioning offset in shadow DOM**: Dropdown editors (select, combobox, autocomplete) appeared offset from their anchor cell because `position: fixed` with Floating UI computed viewport-relative coordinates that didn't account for the shadow DOM host offset. Switched to `position: absolute` with `strategy: 'absolute'`, matching the tooltip fix from v1.0.2.

## [1.0.3] - 2026-03-23

### Fixed
- **`onrowfocus` firing during cell range selection**: `onrowfocus` was triggered when starting a cell range selection (click+drag or shift+click) because the browser's focus event fires on mousedown. Now cell selection operations skip row focus entirely.
- **`onrowfocus` firing on mousedown instead of click**: `onrowfocus` fired immediately when pressing the mouse button down on a cell, before the click completed. Now mouse-triggered row focus is deferred to the click event (mouseup), while keyboard-triggered focus (Tab, arrows) still fires immediately.
- **Focused cell outline persisting during cell range drag**: When starting a cell range selection by click+drag, the initially clicked cell kept its `:focus` box-shadow outline throughout the entire drag. The browser's native `:focus` pseudo-class was applied on mousedown but never removed. Now the focused cell is blurred when the drag threshold is exceeded.
- **Toolbar tooltip staying visible**: The rich tooltip on toolbar buttons remained visible when the toolbar moved to a different row or closed entirely (e.g., after delete). The `mouseleave` event never fires when DOM elements are removed. Now tooltip is explicitly hidden when the toolbar closes or switches rows.
- **Selections persisting after toolbar action**: Row, cell range, and column selections were not cleared when clicking a toolbar action button. Now selections are cleared through the action pipeline before processing toolbar clicks.
- **Synchronous render after inline toolbar action detaching triggerElement**: `handleInlineActionClick` called `this.render()` synchronously after firing `ontoolbarclick`, which destroyed the `triggerElement` passed in the event detail. Consumers positioning UI relative to it (e.g., popconfirm) got a detached element. Removed the synchronous render — `requestUpdate` microtask handles it.

- **Cell selection bleeding through sticky header**: Selected cells (`.wg__cell--in-range`) had `z-index: 1`, same as the sticky header, causing their blue background to show through the header when scrolling. Introduced a proper z-index layer system with CSS variables (`--wg-z-cell-highlight`, `--wg-z-frozen`, `--wg-z-header`, `--wg-z-frozen-header`, etc.) replacing all hardcoded values. Header is now above cell highlights, frozen headers above regular headers.

### Added

- **Z-index layer system**: All z-index values within the grid now use CSS custom properties defined in `_variables.css`, making the stacking order explicit and overridable. See `docs/z-index-layers.md` for the full layer map.
- **Logging system**: Added loglevel-based logging with color-coded categories (`GRID:INIT`, `GRID:DATA`, `GRID:UI`, `GRID:INTERACTION`). Silent by default; enable at runtime via `window.components['web-grid'].logging.enableLogging()`.
- **`window.components['web-grid']` registration**: Runtime introspection API with `version()`, `config`, and `logging` — matching the pattern used by web-multiselect and web-daterangepicker.

### Docs

- **Cell range selection event log**: Added an event log panel to the Cell Range Selection demo showing all fired events (`onrowfocus`, `onrowchange`, `oncellselectionchange`, etc.) for easier debugging.

## [1.0.2] - 2026-02-26

### Fixed

- **Tooltip positioning in transformed containers**: Tooltips appeared at the grid's top-left corner instead of near the hovered cell when an ancestor element had a CSS `transform` (e.g., sidebar transitions in Pure Admin). Switched tooltip from `position: fixed` to `position: absolute` with `:host` as the positioning context, making it immune to ancestor transforms.

### Added

- **HTML tooltips for cells**: New `isTooltipHtml` column option renders `tooltipCallback`/`tooltipMember` content as HTML instead of plain text. Useful for rich formatting like bold text, line breaks, or lists in cell tooltips.
- **Toolbar click detail: `event` and `triggerElement`**: `ontoolbarclick` detail now includes the original `MouseEvent` and the clicked button `HTMLElement`. This enables anchoring popovers, popconfirms, or context menus directly to toolbar buttons — even though they live inside shadow DOM. Works for both floating and inline toolbar modes.

### Changed

- **Tooltip show delay**: Reduced default `tooltipShowDelay` from 400ms to 200ms for snappier feedback.

## [1.0.1] - 2026-02-25

### Fixed

- **Tab/Shift+Tab crash in read-only grids**: Pressing Tab when no columns are editable threw `TypeError: Cannot read properties of undefined (reading 'index')` because the navigate executor assumed at least one editable column existed. Tab now traverses all columns left-to-right (wrapping to next/previous row) when no editable columns are present.
- **Browser dark mode overriding app theme**: When the OS was in dark mode, web-grid always rendered dark — even if the app forced light theme (e.g. via `data-theme="light"`). The `@media (prefers-color-scheme: dark)` query set hardcoded dark values that couldn't be overridden. Added explicit light mode selectors (`data-theme="light"`, `data-bs-theme="light"`, `.light` class) that restore the `--base-*` fallback chain, allowing apps to force light mode regardless of OS preference.
- **Dark mode ancestor selectors not working through shadow DOM**: The `[data-theme="dark"] :host` and `.dark :host` selectors were dead code — regular CSS selectors inside shadow DOM cannot match elements outside the shadow boundary. Replaced with `:host-context()` selectors which correctly traverse up through the shadow DOM boundary to match ancestor attributes/classes.

## [1.0.0] - 2026-02-22

### Added

- **Shift+drag column selection when reorder is enabled**: When `isColumnReorderAllowed` is true, plain drag on headers starts column reorder, making drag-to-select columns impossible. Now holding Shift bypasses reorder and starts column selection drag instead. Shift+click also sets up drag listeners so the selection can be extended by dragging further.

### Docs

- **Dropdown demo: dynamic cell styling** — Priority column now shows colored background per value using `cellClassCallback` + `customStylesCallback`, with `formatCallback` rendering colored dots in display mode
- **Fill handle demo: fixed endless grid appearance** — Changed vertical/horizontal fill demo grids from `max-width: 100%` to `max-width: fit-content` so they don't stretch with a filler column
- **Selection demo: updated column selection instructions** — Reflects Shift+Click/Drag for column selection when reorder is enabled

### Fixed

- **Dropdown not closing on column/row header click**: Clicking a column header or row number while a dropdown (or editor) was open left the dropdown/edit state dangling. Root cause: header and row-number click handlers bypassed the action pipeline, so no cleanup ran. Fix: Added centralized `cleanupEditState()` helper that closes dropdowns, cancels edits, clears focused cell, and removes fill handle — called from both `handleHeaderMouseDown` and `handleRowNumberMouseDown`.
- **Dropdown staying open when clicking another cell**: In `editTrigger: 'always'` mode, clicking a different cell while a dropdown was open didn't close the dropdown. Root cause: `mapMouseDownToActions` only emitted `focusCell` for non-toggle cell clicks — no `closeDropdown`. Fix: prepend `closeDropdown` action when `dropdownOpen && !isToggleClick`.
- **`shouldShowDropdownOnFocus` not working**: The `shouldShowDropdownOnFocus` property was defined but never wired up. Dropdown editors (select/combobox/autocomplete) in `editTrigger: 'always'` mode now auto-open the dropdown when a cell receives focus (via click, Tab, arrow keys), if `shouldShowDropdownOnFocus` is `true` (the default). Explicit edit actions (click, dblclick, F2, Space) always open the dropdown regardless of this setting.
- **Column selection visual not clearing on cell click**: Clicking a data cell while a column was selected didn't remove the selection highlight from the header. Two root causes: (1) In `editTrigger: 'always'`/editing path, `clearSelection` was only dispatched for cell range selections, not row/column selections. (2) The selection executor used wrong CSS class name (`wg__header-cell--selected`) — the renderer applies `wg__header--selected`. Fixed both the dispatch condition and the class name.
- **No focus border in click/dblclick edit modes**: Clicking a cell in `editTrigger: 'click'` or `'dblclick'` mode showed the fill handle (proving focus was set) but no focus outline. Root cause: focus border CSS was scoped to `.wg--navigate-mode`, which is only added when `editTrigger === 'navigate'`. Fix: removed the navigate-mode guard — `.wg__cell--focused` outline now works in all editable modes.
- **Focused cell persists after clicking header/row number**: The focused cell's outline and fill handle remained visible after clicking a column header or row number to select. Fix: `cleanupEditState()` now also clears `focusedCell` state, removes the focus visual, and removes the fill handle.
- **Click-after-dropdown requires double click in click/dblclick modes**: In `editTrigger: 'dblclick'` (or `'click'`), opening a dropdown then clicking another cell only closed the dropdown — the new cell didn't get focused until a second click. Root cause: `cancelEdit` re-renders the old cell (removing its editor), which triggers `focusout`; the deferred `handleTableFocusOut` handler then clears the focus that `focusCell` just set. Fix: set `isTransitioningCells` flag before `cancelEdit` in the non-always path, and ensure cells get `tabindex="-1"` for programmatic focus.
- **Select dropdown not opening in `editTrigger: 'always'` mode**: Clicking a select cell opened the dropdown briefly but it immediately closed. Root cause: legacy click handler on `.wg__select-trigger` called `toggleDropdown()`, closing the dropdown that the pipeline had just opened on mousedown. Fix: skip legacy handler when the cell's editTrigger is `'always'` (pipeline handles it via `shouldShowDropdownOnFocus`).
- **Focus border not clearing on outside click in 'always' mode**: Clicking outside the grid left the `wg__cell--always-edit-focused` class on the last focused cell. Fix: outsideClick handler now removes both `wg__cell--focused` and `wg__cell--always-edit-focused`.
- **Dropdown filtering leaks between cells in 'always' mode**: Clicking from a combobox cell (e.g., Department="Engineering") to a select cell (e.g., Status) caused the Status dropdown to show zero options. Root cause: `updateFocusVisual` called `renderCell` on the old combobox cell, which set `ctx.filterText` to the current input value; the subsequent `openDropdownForCurrentEditor` for the new cell filtered its options against this stale text. Fix: in 'always' mode, `updateFocusVisual` only removes CSS classes from the old cell instead of re-rendering it.
- **Dropdown still filtered after selecting combobox value then clicking select cell**: Even with the `updateFocusVisual` fix above, selecting a value from a combobox dropdown (e.g., Department) and then clicking a select cell (e.g., Status) still showed zero options. Root cause: `selectDropdownOption` calls `renderCell` to show the committed value, and `renderComboboxEditor` sets `ctx.filterText` to the input's display value as a side effect — this stale text then filtered the next cell's options to zero. Fix: clear `ctx.filterText` in the focus executor when focusing a different cell.
- **Autocomplete search firing after switching cells**: Typing in an autocomplete cell and quickly clicking another cell could trigger a stale search request after focus moved. Fix: cancel pending `searchDebounceTimer` and abort in-flight `searchAbortController` when focusing a different cell.
- **Tab in navigate mode selects dropdown option instead of traversing**: In `editTrigger: 'navigate'` with `shouldShowDropdownOnFocus`, Tab/Shift+Tab always cancelled the dropdown — even when the user had arrowed to a different option. Added `dropdownUserInteracted` flag to distinguish auto-opened dropdowns (Tab traverses without selecting) from user-navigated dropdowns (Tab selects and moves). Also fixed `justSelected` flag blocking the next cell's dropdown from opening after Tab-selecting an option via `thenNavigate`.
- **Select/dropdown cell value cleared on Tab in input-matrix mode**: In `editTrigger: 'always'` mode, tabbing through a select/dropdown cell cleared its value. Root cause: the transition executor commits every cell on transition, reading the value from the editor's `data-value` attribute — but `renderSelectEditor` never set `data-value` on the trigger element, so the committed value was always empty string. Fix: add `data-value` attribute to the select trigger HTML so the original value is preserved during tab-through.
- **Row number invisible on selected rows in navigate mode**: In editable grids with `editTrigger: 'navigate'`, the selected row number cell's accent background was overridden by the read-only cell background rule (`.wg--editable.wg--navigate-mode .wg__cell:not(.wg__cell--editable)`), which had equal specificity but came later in source order. Fix: added `.wg--editable` prefix to the selection row-number rules to increase specificity above the readonly rule.
- **Frozen columns: focus/selection borders bleed over frozen columns**: Cell focus outline and selection range borders were visible on top of frozen (sticky) columns when scrolling horizontally. Three root causes: (1) CSS `outline` ignores z-index stacking contexts — switched cell focus to `box-shadow: inset` which respects stacking. (2) Range/row/column selection border divs had `z-index: 3`, above frozen cells (`z-index: 1-2`) — lowered to `z-index: 0`. (3) Selected/focused frozen cells used semi-transparent backgrounds (`color-mix` with `transparent`) that let scrolling content show through — changed to mix against the opaque frozen column base color instead.
- **Inline actions header title not clearable**: Setting `inlineActionsTitle = ''` still showed "Actions" because the rendering code used `||` (which treats empty string as falsy). Fix: changed to `??` so an explicit empty string is respected while `undefined` still falls back to the default label.
- **Frozen columns: no auto-scroll when cell is behind frozen columns**: Clicking or navigating to a cell partially hidden behind frozen columns didn't scroll horizontally to reveal it. `scrollIntoView({ inline: 'nearest' })` considers the cell visible (it's in the viewport), but doesn't account for sticky columns covering it. Fix: added `ensureCellNotBehindFrozen` that checks the focused cell's left edge against the last frozen column's right edge and scrolls to reveal it. Works in both navigate mode and read-only cell selection mode.

## [1.0.0-rc14] - 2026-02-12 (Published)

### Added

- **`cellToolbarOffset` accepts CSS lengths**: In addition to numbers (0-1 fraction of cell width), now accepts CSS length strings like `'2rem'` or `'24px'` for fixed offset from cell left edge
- **Toolbar configuration warnings**: Console warnings when toolbar settings are used with incompatible `toolbarPosition` values (e.g. `toolbarVerticalAlign` with `top` position, `toolbarColumn`/`cellToolbar`/`toolbarFollowsCursor` with non-`top` positions, `toolbarColumn` + `toolbarFollowsCursor` conflict)
- **Comprehensive README** - Complete rewrite covering all features, 18 property subsections, column definitions, 8 editor types, grid modes, row toolbar, context menus, callbacks, 40+ public methods, and styling guide
- **14 new CSS variables** for granular theming control:
  - `--wg-overlay-bg`, `--wg-dialog-shadow` — Dialog/overlay styling
  - `--wg-tooltip-max-width`, `--wg-tooltip-arrow-size` — Tooltip dimensions
  - `--wg-row-number-width`, `--wg-actions-column-width` — Column sizing
  - `--wg-editor-hitbox-height` — Editor click target height
  - `--wg-toolbar-divider-height`, `--wg-toolbar-icon-size` — Toolbar element sizing
  - `--wg-dropdown-max-height` — Dropdown list height
  - `--wg-frozen-column-shadow-gradient`, `--wg-frozen-column-shadow-width` — Frozen column shadow
  - `--wg-row-locked-bg`, `--wg-row-locked-opacity` — Row locking appearance

### Changed

- **CSS variable architecture cleanup** — All `--base-*` theme variables are now consumed exclusively in `_variables.css` and mapped to `--wg-*` intermediaries. Previously `_row-locking.css` defined its own `--base-*` fallbacks in a `:host` block.
- **Hardcoded values replaced with CSS variables** — ~30 magic numbers (pixel values, rgba colors, font weights) across 12 CSS files replaced with named `--wg-*` variables for consistent theming
- **Redundant CSS fallbacks removed** — Stripped inline fallback values from `var()` calls (e.g., `var(--wg-accent-color, #0078d4)` → `var(--wg-accent-color)`) in `_cells.css`, `_dropdown.css`, `_editors.css`, `_dialogs.css`, `_toolbar.css`, `_cell-selection.css` — all variables are already defined with defaults in `_variables.css`

### Fixed

- **Toolbar position flash on row boundaries**: When hovering between rows with `toolbarFollowsCursor` or `cellToolbar` active, the toolbar would briefly flash at a wrong X position before snapping to the correct cell-offset position. Now computes the correct initial X from the cursor position inside the `computePosition` callback, so the toolbar is never visible at a wrong position.
- **`toolbarColumn` ignored when `toolbarFollowsCursor` enabled**: The mousemove handler unconditionally overrode the column-anchored position. Now `toolbarColumn` takes priority — when set, cursor following is disabled and the toolbar stays pinned to the specified column.
- **Cell toolbar showing base items on row change**: When hovering across rows on the same column, `cellToolbar` would briefly show the base `rowToolbar` items instead of the cell-specific items. Root cause: `openToolbar` rebuilt the toolbar with base items but `currentCellToolbarItems` wasn't reset, so the subsequent cell-change comparison found no difference and skipped the update.
- **Inline actions column clipped**: With `table-layout: fixed`, the inline actions column had no explicit width so buttons were cut off by `overflow: hidden`. Now computes column width from the max button count per toolbar row using CSS `calc()` with theme variables. Also left-aligned buttons to prevent zig-zag when rows have different visible button counts (due to `hidden` callbacks).
- **Inline action buttons inconsistent width**: Emoji icons could expand buttons beyond `min-width`, causing layout overflow. Buttons now use fixed `width`/`max-width` equal to `--wg-toolbar-btn-min-width` for predictable column sizing.

## [1.0.0-rc13-pre] - 2026-02-11

### Added

- **`isMovable` column property**: Per-column opt-out from column reordering
  - Set `isMovable: false` on a column to prevent it from being dragged
  - Non-movable columns also block drops that would displace them (other columns can only be dropped after all non-movable columns)
- **`resetState` macro action**: New pipeline action that expands into primitive cleanup sub-actions (`cancelEdit`, `clearSelection`, `closeContextMenu`, `closeDatePicker`, `blurCell`)
  - Flags: `edit`, `selections`, `overlays` (default: true), `focus` (default: false) for partial cleanup
  - Foundation for replacing 20+ scattered manual cleanup locations with a single dispatch
- **`closeContextMenu` executor**: Pipeline executor now actually closes both cell and header context menus (was a no-op placeholder)
- **Editor alignment**: Text and number editors now respect column alignment settings
- **Checkbox scale variable**: `--wg-checkbox-scale` CSS variable to control checkbox size (default: 1.2)
- **Configuration warning**: Console warning when `editTrigger: 'always'` is used with `isEditable: false` (unsupported combination)
  - `horizontalAlign` is inherited by editors (number editor no longer hardcoded to right)
  - `verticalAlign` positions the editor input at top/middle/bottom of cell
  - Note: Text inside `<input>` elements is always vertically centered by CSS spec; the editor element itself is positioned

### Changed

- **Context menu element refs**: `contextMenuElement` and `headerContextMenuElement` are now part of `GridContext` (previously private on `GridElement`), enabling pipeline executors to access them

### Fixed

- **Toolbar position flash on row boundaries**: When hovering between rows with `toolbarFollowsCursor` or `cellToolbar` active, the toolbar would briefly flash at a wrong X position before snapping to the correct cell-offset position. Now computes the correct initial X from the cursor position inside the `computePosition` callback, so the toolbar is never visible at a wrong position.
- **Read-only mode with `editTrigger: 'always'` broken**: Switching from input-matrix mode to read-only mode caused broken state (cell selection didn't work, grid unresponsive). Root cause: `isAlwaysMode()` didn't check `isEditable`, so adapter entered "always" code path without editors. Fix: `isAlwaysMode()` now returns `false` when grid is not editable.
- **Combobox text selection in always mode**: First click on combobox now selects all text (enables quick type-to-filter workflow). Second click on already-focused combobox positions cursor for precise editing.
- **Number editor left-aligned**: Number inputs now default to right-align instead of inheriting (which defaulted to left).
- **Focus outline persists during cell selection drag**: Focus outline on the starting cell now clears immediately when drag begins (previously persisted until mouseup). If user returns to start cell or presses Escape, focus is properly restored.
- **Edit not cancelled when clicking another cell**: Clicking a non-editing cell while another cell was in dblclick/click edit mode now properly cancels the active edit (previously the edit state persisted because the pipeline only checked if the *clicked* cell was being edited)
- **Focus stuck on old cell during editor transitions**: Fixed focus outline remaining on the previously-edited cell when transitioning to a new cell via toggle click, date trigger click, or display-mode dropdown click. Root cause: `renderCell` on the old cell ran before `focusedCell` was updated, so the old cell re-rendered with the focus class. Now `setFocusedCell` is called before re-rendering in all four transition paths.
- **Editing cell outline clipped on left/right**: Fixed the blue editing outline being hidden on left and right sides. The date editor had `background: var(--wg-editor-bg)` (opaque) unlike text/number editors which use transparent backgrounds. Changed to `background: transparent` so the cell's own outline is visible. Also added `z-index: 1` to `.wg__cell--editing` to paint above neighboring cells.
- **Date input click closes editor**: In `editTrigger: 'click'` mode, clicking inside the date input to reposition the cursor would close the datepicker and exit edit mode. Two root causes: (1) the datepicker's outside-click handler used `e.target` which is retargeted to the shadow host across shadow DOM boundaries — fixed by using `composedPath()`. (2) The pipeline dispatched `focusCell` on the `<td>`, triggering `focusout` — text-like inputs in the same editing cell now skip pipeline handling entirely.
- **Date value not updated after picking**: Selecting a date from the calendar didn't update the cell's display value until the next edit. Root cause: the `onSelect` callback captured a DOM input reference that went stale on re-render. Fixed by capturing stable row/col/field values instead, and adding `renderCell` + `cell.focus()` after `commitEdit`.
- **Toggle/date trigger clicks not routed through pipeline in display mode**: Clicking a dropdown toggle or date calendar icon on a non-editing cell fell through to legacy handlers because the adapter only looked for editor containers (`.wg__editor--*`), which don't exist in display mode. Fixed by also looking in display containers (`.wg__cell-dropdown-display`, `.wg__cell-date-display`).
- **Number editor type-to-start**: Typing multiple characters (e.g., "1234") now captures all characters instead of only the first
  - Fixed transition executor to commit edit before re-rendering when navigating away from editing cell
  - Fixed adapter to not dispatch `startEdit` when cell is already being edited (allows native input handling)
- **Number editor formatting**: Values entered via keyboard are now saved as numbers (not strings), so `formatCallback` works correctly
- **'Always' mode focus**: Focus visual updates no longer re-render cells in `editTrigger: 'always'` mode (preserves typed content)
- **Click/dblclick editTrigger modes**: Fixed click and double-click edit triggers not working
  - Focus visual updates no longer re-render click/dblclick mode cells (prevents DOM replacement between mousedown and click)
  - Click events now calculate cursor position for `editStartSelection: 'mousePosition'`
  - Fixed "every 3rd click ignored" bug by checking `editingCell` instead of `focusedCell` when cleaning up old editor
  - Fixed blue editing border lingering on old cell when clicking to new cell (cancel edit before re-rendering)
- **Text/number editor vertical text shift**: Fixed text shifting down 1-2px when entering edit mode
  - Root cause: `--valign-middle` used `top: 50%; transform: translateY(-50%)` which centered the input box, but input text is always vertically centered within the input's height, causing a mismatch with display mode
  - Fix: Changed to `top: 0; bottom: 0` so input fills the cell height; input's natural text centering now matches table cell's `vertical-align: middle`
  - Affected CSS: `_editors.css` `.wg__editor--valign-middle`
- **Fill handle drag**: Now respects row locking - locked/read-only rows are skipped during fill operations
- Filler column cells now fire `cellClick` events with correct `rowIndex` (and `colIndex: -1`)
- **Datepicker keyboard navigation**: Arrow keys, Page Up/Down, Home/End, Enter, Escape, and Tab now work correctly when the calendar is open (previously intercepted by grid's table listener)
  - Fixed pipeline `Object.create` pattern shadowing property mutations - changed to `Proxy` so `ctx.datepicker` is set on the original context
  - Fixed async dispatch not working in callbacks - `ctx.dispatch()` now triggers new dispatch cycles for async scenarios like datepicker's `onSelect`
  - Added keyboard bypass in both adapter and table listener when datepicker is open
  - Focus now restored to cell after closing datepicker with Escape
- **Read-only cells**: Dropdown/date toggles no longer appear on non-editable cells (column `isEditable: false` or locked rows)
  - Toggle visibility now respects both column editability and row locking via `canEditCell()`
  - Clicking where toggle would be on read-only cells no longer opens editors
- **Dropdown Escape key behavior**: Improved two-phase Escape handling for all dropdown editors
  - **Select**: First Escape clears type-to-filter and shows all options; second Escape exits edit mode
  - **Autocomplete/Combobox**: First Escape restores original value and shows all options; second Escape exits edit mode
  - Implemented via new `escapeEdit` action in event pipeline
- **Row selection focus cleanup**: Clicking row numbers now clears cell focus visual
- **Navigation keys when dropdown open**: Navigation keys no longer move between cells when a dropdown is open
  - ArrowLeft/ArrowRight: For autocomplete, fall through to browser for cursor movement; for select/combobox, consumed via `noop`
- **Checkbox editor click mode**: Clicking checkbox to toggle value no longer exits edit mode immediately
  - Added `updateDraftValue()` method to update cell value without exiting edit mode
  - Checkbox can now be toggled multiple times while staying in edit mode
  - Standard exit methods (click elsewhere, Tab, Enter, Escape) still work as expected
  - Home/End: For autocomplete, cursor movement; for select/combobox, jump to first/last option
  - PageUp/PageDown: Jump through dropdown options by 10 items (all dropdown editors)
- **Dropdown not opening on first click**: Fixed dropdown editors (select/combobox/autocomplete/date) not opening on first click in `editTrigger: 'click'` mode
  - Root cause: Multiple click handlers on table element - adapter opened dropdown, then legacy handler toggled it closed
  - Fix: Use `stopImmediatePropagation()` to prevent other listeners on same element from firing
- **Double-click edit for complex editors**: Fixed double-click not entering edit mode on dropdown, date, combobox, and autocomplete cells
  - Display containers now use `pointer-events: none` so clicks pass through to the cell
  - Toggle buttons retain `pointer-events: auto` so they remain directly clickable
- **Cursor repositioning in text/number editors**: Single clicks inside text and number inputs now correctly reposition the cursor instead of being blocked by `preventDefault()`
- **Combobox/autocomplete text selection**: Double-clicking to edit combobox/autocomplete cells now selects all text by default, regardless of grid-level `editStartSelection` setting
  - Dropdown-type inputs default to `selectAll` since cursor positioning doesn't apply to filter inputs
  - Can still be overridden per-column via `editorOptions.editStartSelection`
- **Checkbox editor display**: Fixed checkbox rendering issues
  - Checkbox now vertically and horizontally centered in cell (was positioned at top)
  - Display mode now renders checkbox instead of "true"/"false" text
- **Autocomplete editor improvements**:
  - Cursor position now calculated correctly when clicking (was always at end)
  - Local filtering now works when no `searchCallback` is provided (filters `initialOptions` like combobox)
- **Dropdown display value consistency**: Display mode and edit mode now show the same value
  - Display mode now uses proper fallback chain: `getDisplayCallback` → `displayMember` → `label` → raw value
  - Previously display mode showed raw value ("USA") while edit mode showed label ("United States")
  - Escape key now compares against display value for consistent restore behavior
- **Fill handle disappearing on multi-grid pages**: Fixed fill handle vanishing when clicking between multiple grids
  - Root cause: Fill handle is module-level singleton; one grid's cleanup handlers removed another grid's handle
  - Fix: Track ownership of fill handle; only the owning grid can remove it
- **Right-click triggering selection on headers/row numbers**: Right-clicking column headers or row numbers no longer triggers selection (regression from pipeline refactor)
- **Frozen column headers lacking visual distinction**: Frozen column headers now have a subtle accent color tint to differentiate them from regular columns
- **`isResizable` example typo**: Fixed example using wrong property name (`resizable` → `isResizable`)
- **Sticky header bottom border disappearing**: Fixed header bottom border becoming invisible when scrolling with sticky headers
  - Root cause: With `border-collapse: collapse`, real borders get overlapped when content scrolls underneath
  - Fix: Changed to `box-shadow` which always paints on top regardless of scroll position
- **Dropdown not opening on click/double-click**: Fixed dropdown editors (select/combobox/autocomplete) not opening when clicking or double-clicking to start edit, when `showOnFocus: false` was set in editorOptions
  - Root cause: Pipeline adapter incorrectly checked `showOnFocus` setting for explicit edit actions
  - Fix: `showOnFocus: false` now only prevents auto-open on Tab/focus navigation, not on explicit edit actions (click, double-click, F2, Space, Enter)
- **Checkbox editor keyboard navigation**: Fixed multiple keyboard issues with checkbox editor
  - **Enter/Tab not working after toggle**: After toggling a checkbox with Space, Enter and Tab keys were not registered. Root cause: `renderCell()` replaced the checkbox HTML but didn't restore focus, so keyboard events had no target. Fix: Added `{ focusEditor: true }` to re-focus checkbox after toggle.
  - **Tab required two presses**: Tab key only navigated on second press because `toggleCheckbox` didn't set `editingCell`. Fix: Checkbox toggle now calls `startEdit()` to integrate with standard editing flow.
  - **Enter on last row caused stuck state**: Pressing Enter on the last row had nowhere to navigate, so edit was never committed. Fix: Navigate executor now commits edit and keeps focus on current cell when there's no navigation target.
  - **Escape didn't discard changes**: Pressing Escape after toggling didn't restore the original value. Fix: Added `discardCellDraft()` method and integrated with cancel/escape handlers for checkbox editor.
  - **Arrow keys navigated during edit**: Arrow keys moved between cells while checkbox was in edit mode. Fix: Arrow keys now return `noop` action for checkbox editor, matching other editor behavior.

---

## [1.0.0-rc12] - 2026-01-26

### Added

- **Table Border Only Mode**: New `tableBorderOnly` property for cleaner card integration
  - `tableBorderOnly: boolean` - When `true`, border only wraps the table, pagination/toolbar float outside (default: `false`)
  - Eliminates double-border issue when grid is inside a card component
  - Table wrapped in `.wg__table-container` with border; outer `.wg` container is borderless
  - Pagination and toolbar remain in outer container, visually separate from table

- **Scroll behavior properties**: New `isScrollable` and `scrollMaxHeight` properties for grids without a height-constrained container
  - `isScrollable: boolean` - When `true`, constrains grid to viewport height (default: `false`)
  - `scrollMaxHeight: string` - Custom max-height when scrollable (default: `'100vh'`)
  - Use when grid is not inside a container with explicit `max-height` but still needs to scroll

- **Paste from clipboard**: Multi-cell paste from Excel/TSV clipboard data
  - Automatically detects TSV format (tabs, newlines) from clipboard
  - **Header detection**: If first row matches column titles/fields (>50%), maps data by column name
  - **Position-based paste**: Without headers, pastes starting from focused cell position
  - **New row creation**: Automatically creates rows when pasting beyond existing data
  - `createRowCallback` - Custom row factory for new rows (default: plain object with pasted values)
  - `pasteMode` property - How to handle non-editable columns:
    - `'skip-non-editable'` (default) - Skip non-editable cells
    - `'all-columns'` - Paste into all columns regardless of editable flag
    - `'editable-only'` - Only paste if all target columns are editable
  - `shouldValidateOnPaste` property - Run validation on pasted values (default: true)
  - `onbeforepaste` event - Cancel or modify paste operation before it executes
  - `onpaste` event - Summary after paste completes with success/failure counts
  - Respects column `beforePasteCallback` for value transformation
  - Respects row locking - locked rows are skipped

- **Row Focus (Master/Detail)**: `onrowfocus` event fires when a different row is focused via cell click/focus — ideal for master/detail layouts
  - `onrowfocus` callback: `{ rowIndex, row, previousRowIndex }`
  - `focusedRowIndex` getter/setter for programmatic control (set to `null` to clear)
  - `isRowFocused(rowIndex)` method to check focus state
  - Visual: focused row gets `--wg-row-focus-bg` background, row number gets `--wg-row-focus-row-number-bg` (30% accent tint)
  - Row number clicks do **not** trigger focus (they handle row selection)
  - Clicking outside the grid clears row focus
  - Surgical DOM updates preserve cell focus (no full re-render)

- **🧪 New Row (Inline Data Entry) [Experimental]**: Always-visible empty row for adding data directly in the grid
  - `isNewRowEnabled: boolean` - Enable the empty row (default: `false`, requires navigate mode)
  - `newRowPosition: 'top' | 'bottom'` - Where to show the empty row (default: `'bottom'`)
  - `newRowIndicator: string` - Indicator in row number column (default: `'+'`)
  - `createEmptyRowCallback: () => T | Promise<T>` - Factory for new row objects (supports async)
  - Tab moves between cells within the empty row (saves to draft, doesn't commit)
  - Tab on last editable cell commits the row (if it has data) and starts a fresh empty row
  - Enter commits the row if it has any data
  - Lenient validation: tracks errors but doesn't block input (rows can be committed with invalid cells)
  - Paste support: pasting into the empty row creates new rows
  - **Note:** This feature is experimental and may change in future releases

- **Select All**: Click the `#` row number header to select all cells in the grid
  - `selectAll()` method for programmatic selection
  - Visual feedback: cursor changes to pointer, hover highlight on header

- **Column Selection**: Click column headers to select entire columns (like row selection)
  - `selectColumn(colIndex, mode)` method - modes: 'replace', 'toggle', 'range'
  - `isColumnSelected(colIndex)` method to check selection state
  - `selectedColumns` getter returns sorted array of selected column indices
  - `clearColumnSelection()` method
  - `copySelectedColumnsToClipboard()` method - copy all rows for selected columns
  - Click header = select single column (replaces previous)
  - Ctrl+Click = toggle individual columns (non-contiguous selection)
  - Shift+Click = select range from last clicked column
  - Escape = clear column selection
  - Ctrl+C = copy selected columns to clipboard
  - Visual: selected headers get accent background (like row numbers), cells get selection background
  - No border (matches row selection visual style)
  - Sort moved to sort indicator only (▲/▼/⬍) - clicking header body selects column
  - Mutual exclusivity: row, column, and cell range selections clear each other

- **Row/Column Selection Borders**: Visual borders around selected rows and columns for better visibility
  - Border appears around selected row/column range (similar to cell range selection)
  - Handles non-contiguous selections: separate borders for each contiguous segment (e.g., rows 1-2 and 5-7 show two borders)
  - Row border starts from first data column (excludes row number column)
  - Column border spans from header to last data row
  - Borders update on scroll to stay positioned correctly
  - CSS variables: `--wg-selection-border-width`, `--wg-selection-border-color`

- **Column Drag Selection**: When column reorder is disabled, drag on headers to select column ranges
  - Same UX as row drag selection on row numbers
  - Click + drag = select range of columns
  - 5px drag threshold before activating (prevents accidental selection)
  - Ctrl+click = toggle individual columns
  - Shift+click = range from last selected
  - `selectColumnRange(fromIndex, toIndex)` method for programmatic range selection
  - Cursor changes to `col-resize` during drag
  - Only active when `isColumnReorderAllowed = false` (doesn't conflict with column reordering)

### Changed

- **Click Event Manager**: Introduced `ClickEventManager` (pub/sub pattern) for centralized click handling, following the same pattern as `ScrollEventManager` and `FocusEventManager`. Outside-click detection for selection clearing now uses this unified system.
- **Sort Event Pipeline**: Sort indicator clicks now use the `ClickEventManager` pub/sub pattern (`sortClick` event type). This allows modules to subscribe to sort events and follows the same architecture as other event pipelines.

### Fixed

- **Date picker two-click with selection active**: Fixed date picker requiring two clicks when a row/column/cell selection was active. Moved selection clearing before cell edit transition to prevent render from interfering with date picker opening.
- **Dropdown/editor not closing on outside click**: Fixed dropdowns (select, combobox, autocomplete) and editors staying open/focused when clicking outside the grid. Outside-click handler now explicitly closes dropdowns, cancels edits, clears focused cell state and visual class.
- **Column selection with modifier keys when reorder enabled**: Fixed Ctrl+click and Shift+click not working for column selection when `isColumnReorderAllowed = true`. Reorder now skips when modifier keys are held, allowing column toggle/range selection.
- **Column selection after reorder**: Fixed issue where clicking a column header after reordering required two clicks. The `dragJustCompleted` flag now auto-clears after the current frame.
- **Selected header hover state**: Fixed unreadable text when hovering over selected column headers (gray background + white text). Selected headers now maintain accent styling on hover.
- **Selection clearing on click**: Row and column selections now clear when clicking on data cells or clicking outside the grid. Clicking row numbers preserves row selection, clicking headers preserves column selection.
- **Selected row number styling in navigate mode**: Fixed selected row numbers not showing correct colors (white text on accent background) when using `editTrigger: 'navigate'`. Increased CSS specificity to ensure selection styles win.
- **Shift+drag cell selection**: Fixed shift+drag cell selection not working when `editTrigger: 'click'` combined with `cellSelectionMode: 'shift'`. Simplified selection logic to handle all editTrigger combinations.
- **Frozen cell selection visibility**: Fixed row, column, and cell range selections not showing on frozen columns. Added CSS rules with `!important` to ensure selection backgrounds override frozen cell styling.
- **Frozen row number selection color**: Fixed selected row number cells showing wrong background color (light blue instead of accent) when row numbers are sticky/frozen.
- **Frozen header selection**: Fixed selected column headers not showing accent color when frozen.
- **Selection clearing with cell selection mode**: Fixed row/column selections not clearing when clicking on cells in grids with `cellSelectionMode: 'click'` (the default). The early return in cell selection handling now clears row/column selections first.
- **Dropdown toggle click with cell selection**: Fixed dropdown/date toggles not responding to clicks when `cellSelectionMode: 'click'`. Toggle clicks are now excluded from cell selection logic so they properly trigger their own handlers.
- **Dropdown not closing on cell selection**: Fixed dropdown staying open when clicking another cell to start cell selection. Active edit is now properly canceled (dropdown closed, cell re-rendered to display mode) before starting selection.
- **Cell selection cleared on any click**: Fixed cell selection being incorrectly cleared on any click due to shadow DOM detection issue in `outsideClick` handler. Now correctly checks if host element is in event's composed path.
- **Cell selection cleared on sort click**: Fixed cell selection being cleared when clicking sort indicator. The `render()` call after sorting was rebuilding the DOM, causing the document click handler to misdetect the click as outside the grid. Click event manager now tracks inside-grid clicks via a flag set on mousedown, and the listener is attached to the host element (not container) so it survives re-renders.
- **Shadow DOM event target retargeting**: Fixed click event manager not detecting clicked elements correctly. When events cross the shadow DOM boundary to the host element listener, `event.target` gets retargeted to the host. Now uses `composedPath()[0]` to get the actual clicked element inside the shadow DOM.
- **Click event subscription accumulation**: Fixed endless loop when clicking sort indicator. `attachEventListeners()` is called on every `render()`, causing subscriptions to accumulate. Added `clickEventsSubscribed` flag to ensure click event subscriptions are only registered once.
- **Sort handler shadow DOM compatibility**: Fixed sort clicks not working due to `handleSortClick` using `event.target` which is retargeted when crossing shadow DOM. Now passes the field directly from the click context instead of extracting it from the event.
- **Cell selection not cleared on sort**: Fixed cell selection remaining visible after clicking sort indicator. Now clears cell selection before sorting, matching behavior of other header interactions like column selection.
- **Selection not cleared on date picker open**: Fixed row/column/cell selections remaining visible when opening a date picker. All selections and borders are now cleared when the date picker opens.
- **Selection not cleared on resize/reorder**: Fixed row/column/cell selections remaining visible when starting column resize or reorder operations. Added `clearAllSelections()` helper method that clears all selection types and their visual borders.
- **Selection not clearing on first outside click after drag**: Fixed cell/row/column selections requiring two clicks outside the grid to clear after drag-selecting. The `insideGridClickInProgress` flag was set on mousedown but only cleared on click - drag operations (mousedown → mousemove → mouseup) don't produce a click event, leaving the flag stuck. Added mouseup handler with 10ms timeout to clear the flag after drags.
- **Blur and outsideClick handlers conflicting**: Fixed race condition where blur handlers and outsideClick handler both tried to handle cleanup when clicking outside the grid, causing inconsistent state. Blur handler now checks if focus is leaving the grid entirely (`relatedTarget` is null or outside shadow DOM) and defers all cleanup to the outsideClick handler in that case.

---

## [1.0.0-rc11] - 2026-01-16

### Added

- **Copy to clipboard**: Cell range and row selections can now be copied to clipboard in TSV format (Excel-compatible)
  - `copyCellSelectionToClipboard()` - Copy selected cell range
  - `copySelectedRowsToClipboard()` - Copy selected rows
  - `shouldCopyWithHeaders` property - Include column headers when copying (default: false)
  - Works with Ctrl+C keyboard shortcut via `rangeShortcuts`

### Fixed

- **Cell range selection border alignment**: Fixed 1px offset caused by container border (getBoundingClientRect measures from border edge, position:absolute from padding edge)
- **Focus border during drag**: Focus outline now properly hides when starting a cell range drag selection
- **Selection focus timing**: Improved focus reliability when multiple grids are on the same page using double requestAnimationFrame

## [1.0.0-rc10] - 2026-01-13 (Published)

### BREAKING CHANGES

This release contains significant API changes to align property naming with sibling components (web-multiselect, web-daterangepicker) and follow consistent naming conventions. Since this is a new library, no backwards compatibility layer is provided.

#### Grid-Level Property Renames

All boolean properties now use `is*` prefix for state properties and `should*` prefix for behavior configuration:

| Old Property | New Property | Description |
|--------------|--------------|-------------|
| `filterable` | `isFilterable` | Enable column filtering UI |
| `pageable` | `isPageable` | Enable pagination |
| `striped` | `isStriped` | Alternate row background colors |
| `hoverable` | `isHoverable` | Highlight row on hover |
| `editable` | `isEditable` | Enable cell editing |
| `showRowNumbers` | `isRowNumbersVisible` | Show row number column |
| `stickyRowNumbers` | `isStickyRowNumbers` | Pin row numbers when scrolling horizontally |
| `showRowToolbar` | `isRowToolbarVisible` | Show row toolbar on hover |
| `showShortcutsHelp` | `isShortcutsHelpVisible` | Show keyboard shortcuts info icon |
| `virtualScroll` | `isVirtualScrollEnabled` | Enable virtual scrolling for large datasets |
| `infiniteScroll` | `isInfiniteScrollEnabled` | Enable infinite scroll loading |
| `persistColumnWidths` | `shouldPersistColumnWidths` | Save column widths to localStorage |
| `persistColumnOrder` | `shouldPersistColumnOrder` | Save column order to localStorage |
| `allowColumnReorder` | `isColumnReorderAllowed` | Allow drag-to-reorder columns |
| `checkboxAlwaysEditable` | `isCheckboxAlwaysEditable` | Checkboxes toggle without entering edit mode |
| `dropdownShowOnFocus` | `shouldShowDropdownOnFocus` | Open dropdown when cell receives focus |
| `openDropdownOnEnter` | `shouldOpenDropdownOnEnter` | Open dropdown on Enter key |
| `summaryInline` | `isSummaryInline` | Show summary row inline vs footer |

**Migration example:**
```javascript
// Before
grid.editable = true
grid.showRowNumbers = true
grid.virtualScroll = true

// After
grid.isEditable = true
grid.isRowNumbersVisible = true
grid.isVirtualScrollEnabled = true
```

#### Column-Level Property Renames

| Old Property | New Property | Description |
|--------------|--------------|-------------|
| `sortable` | `isSortable` | Column can be sorted |
| `filterable` | `isFilterable` | Column can be filtered |
| `editable` | `isEditable` | Column cells can be edited |
| `frozen` | `isFrozen` | Column stays fixed when scrolling |
| `resizable` | `isResizable` | Column width can be resized |
| `hidden` | `isHidden` | Column is hidden from view |
| `showEditButton` | `isEditButtonVisible` | Show edit button in cell |
| `openDropdownOnEnter` | `shouldOpenDropdownOnEnter` | Open dropdown on Enter key |

**Migration example:**
```javascript
// Before
const columns = [
  { field: 'id', title: 'ID', editable: false, frozen: true },
  { field: 'name', title: 'Name', sortable: true },
  { field: 'status', title: 'Status', hidden: true }
]

// After
const columns = [
  { field: 'id', title: 'ID', isEditable: false, isFrozen: true },
  { field: 'name', title: 'Name', isSortable: true },
  { field: 'status', title: 'Status', isHidden: true }
]
```

#### Callback Renames

Per naming convention: Events (`on*`) = fire-and-forget, Callbacks (`*Callback`) = return value affects behavior.

| Old Name | New Name | Reason |
|----------|----------|--------|
| `onfilldrag` | `fillDragCallback` | Returns `false` to cancel fill operation |
| `onSearchCallback` (in editorOptions) | `searchCallback` | Returns search results array |

**Migration example:**
```javascript
// Before
grid.onfilldrag = (detail) => {
  if (detail.targetCells.length > 10) return false
}

// After
grid.fillDragCallback = (detail) => {
  if (detail.targetCells.length > 10) return false
}

// Before (in column editorOptions)
editorOptions: {
  onSearchCallback: async (query) => searchAPI(query)
}

// After
editorOptions: {
  searchCallback: async (query) => searchAPI(query)
}
```

### Added

- **Column `maxLines` Property** - Limit visible text lines with CSS line-clamp. When `textOverflow: 'wrap'` is set, use `maxLines: 3` to show at most 3 lines with ellipsis for overflow.

- **`horizontalAlign: 'justify'`** - New alignment option for justified text in cells and headers.

- **Header Vertical Alignment** - Header text now properly respects `verticalAlign` column property (`top`, `middle`, `bottom`) via flexbox alignment classes.

- **`--wg-header-min-height` CSS Variable** - Control minimum header row height.

- **Escape Key Cancels Fill Drag** - Press Escape while dragging the fill handle to cancel the operation without applying values to cells.

- **Component-Specific CSS Variables** - New granular CSS variables following the pattern `--wg-{component}-{property}`:

  **Dropdown Menu:**
  - `--wg-dropdown-option-gap` - Gap between option icon and text
  - `--wg-dropdown-option-padding` - Padding inside dropdown options
  - `--wg-dropdown-empty-padding` - Padding for "No options" message

  **Inline Actions:**
  - `--wg-inline-actions-padding` - Padding around inline action buttons
  - `--wg-inline-actions-gap` - Gap between action buttons

  **Toolbar:**
  - `--wg-toolbar-row-gap` - Gap between toolbar rows
  - `--wg-toolbar-row-padding` - Padding inside toolbar rows
  - `--wg-toolbar-label-font-size` - Font size for toolbar button labels
  - `--wg-toolbar-btn-gap` - Gap between toolbar buttons

  **Tooltip:**
  - `--wg-tooltip-padding` - Padding inside tooltips
  - `--wg-tooltip-shadow` - Box shadow for tooltip popups

### Changed

- **CSS Variable References** - Internal CSS now uses component-specific variables instead of generic spacing variables, making customization more targeted and predictable
- **Internal Method Names** - Grid class internal methods renamed to match new property names (e.g., `getEffectiveOpenDropdownOnEnter` → `getEffectiveShouldOpenDropdownOnEnter`)

### Fixed

- **Frozen Column Text Overflow** - Resizing frozen columns to narrow widths now properly shows ellipsis instead of text spilling out. The shadow scroll indicator still appears correctly when scrolling horizontally.

- **Fill Handle Focus State** - Fill handle now properly removed when clicking outside the grid. Fixed issue where multiple cells could appear focused when rapidly clicking between cells.

- **Consistent API Surface** - All boolean properties now follow consistent `is*`/`should*` naming pattern across grid and column levels
- **TypeScript Types** - All type definitions updated to reflect new property names
- **Example Files** - Fixed incorrect property names in example HTML files (`persistColumnWidths` → `shouldPersistColumnWidths`, `allowColumnReorder` → `isColumnReorderAllowed`, `showRowToolbar` → `isRowToolbarVisible`, etc.)

---

## [1.0.0-rc09] - 2026-01-11 (Published)

### Changed
- **Non-Resizable Column Cursor** - Columns with `resizable: false` now show `not-allowed` cursor instead of hiding the resize handle entirely. This provides visual feedback that the column exists but cannot be resized.

### Fixed
- **Column Reorder Header Transparency** - Dragging a column header no longer shows body cell content through the header when scrolled down. Changed from `opacity: 0.5` to opaque background with dashed outline indicator.
- **Column Reorder Drop Indicator Position** - The blue drop indicator line now correctly positions based on scroll offset, staying visible in the viewport when scrolled down.
- **Filler Header Sticky Positioning** - The filler `<th>` element now has proper `position: sticky` and `z-index` to match other header cells when scrolling.
- **Frozen Column Border Bleed** - Freezing columns no longer adds vertical separators to all frozen cells. Only the last frozen column now has the separator border.
- **Context Menu Divider Items** - Standalone `{ dividerBefore: true }` markers now correctly apply dividers to the next item instead of rendering as "undefined" menu items.
- **Hide Column Synced with Column Visibility** - The `'hideColumn'` action now sets `column.hidden = true` instead of removing the column from the array, keeping it synced with the Column Visibility submenu.

### Added
- **Header Context Menu** - Right-click context menu for column headers
  - `headerContextMenu` property accepts array of predefined strings or custom items
  - Predefined actions: `'sortAsc'`, `'sortDesc'`, `'clearSort'`, `'hideColumn'`, `'freezeColumn'`, `'unfreezeColumn'`, `'columnVisibility'`
  - String shorthand for predefined actions (same pattern as row toolbar)
  - Custom items with `id`, `label`, `icon`, `onclick`, `disabled`, `visible`, `dividerBefore`
  - `HeaderMenuContext` provides `column`, `field`, `columnIndex`, `sortDirection`, `isFrozen`, `allColumns`, `labels`
  - `onheadercontextmenuopen` callback fired before menu opens
  - Auto-visibility: sort options hidden if column not sortable, freeze/unfreeze shown based on state
- **Context Menu Submenus** - Menu items can now have nested submenus
  - `children` property for static submenu items
  - `submenu` callback for dynamic submenu generation
  - Submenus appear on hover with arrow indicator
- **Column Visibility Submenu** - New `'columnVisibility'` predefined action
  - Shows submenu with all columns and "Show all" option at top
  - Toggle column visibility with checkboxes (☑ visible, ☐ hidden)
  - "Show all" checkbox reflects whether all columns are visible
  - Menu stays open for multiple toggles with reactive checkbox updates
  - All labels translatable via `labels.contextMenu.*`
- **Header Filler Context Menu** - Right-clicking the empty header filler cell shows column-agnostic menu items (e.g., Column Visibility)
- **Context Menu Close on Scroll** - Context menus automatically close when page is scrolled
- **Translatable Context Menu Labels** - All predefined header context menu labels are now translatable via `labels.contextMenu.*` (`sortAsc`, `sortDesc`, `clearSort`, `hideColumn`, `freezeColumn`, `unfreezeColumn`, `columnVisibility`, `showAll`)
- **Multi-Sort via Context Menu** - Ctrl+clicking Sort Ascending/Descending in the header context menu adds to existing sort (when `sortMode === 'multi'`) instead of replacing it, matching Ctrl+click behavior on header cells
- **Column Hidden Property** - `column.hidden` property to show/hide columns
  - Hidden columns are excluded from rendering but kept in columns array
  - Allows toggling visibility without losing column configuration
- **Virtual Scroll + Reorder + Resize Demo** - New example combining virtual scrolling (10,000 rows), column reordering, and column resizing in `examples-resizable-columns.html`.

## [1.0.0-rc08] - 2026-01-09 (Published)

### Added
- **Row Keyboard Shortcuts** - Grid-level keyboard shortcuts for row operations
  - `rowShortcuts` property accepts array of shortcut definitions
  - Each shortcut has `key` (e.g., "Delete", "Ctrl+D", "F2"), `id`, `label`, and `action` callback
  - `disabled` property supports boolean or callback for conditional shortcuts
  - `ShortcutContext` provides `row`, `rowIndex`, `colIndex`, `column`, `cellValue`
- **Toolbar-Activated Shortcuts** - Keyboard shortcuts work on hovered row when toolbar is visible
  - No cell focus required - just hover over a row and press shortcut key
  - Matches `rowShortcuts` by ID (e.g., toolbar item `id: 'delete'` pairs with shortcut `id: 'delete'`)
  - Document-level listener activated when toolbar opens, cleaned up when closed
- **Rich Toolbar Tooltips** - Enhanced tooltips for toolbar buttons
  - `tooltip: { description, shortcut }` property on toolbar items
  - `tooltipCallback: (row, rowIndex) => htmlString` for dynamic HTML content
  - Auto-detects keyboard shortcut from matching `rowShortcuts` (by ID)
  - Uses Floating UI positioned tooltip with title, description, and shortcut display
- **Shortcuts Help Overlay** - Info icon showing available shortcuts
  - `showShortcutsHelp` property enables the info icon
  - `shortcutsHelpPosition` controls placement ('top-right' or 'top-left')
  - `shortcutsHelpContentCallback` for custom HTML in overlay
- **Context Menu Shortcuts** - Keyboard shortcuts for context menu items
  - `shortcut` property on `ContextMenuItem` displays shortcut hint
  - Pressing shortcut key while menu is open triggers the action
- **Context Menu Position Offset** - Control context menu position relative to click
  - `contextMenuXOffset` - Horizontal offset in pixels (default: 8)
  - `contextMenuYOffset` - Vertical offset in pixels (default: 0)
  - Matches svelte-treeview positioning behavior
- **Public Focus API** - New `focusCell(rowIndex, colIndex)` method for programmatic focus
- **Public Edit API** - New `startEditing(rowIndex, colIndex)` method for programmatic editing
- **Toolbar Position Property** - New `toolbarPosition` property to control toolbar placement
  - `toolbarPosition="auto"` - Auto-detect best position (default)
  - `toolbarPosition="left"` - Prefer left side
  - `toolbarPosition="right"` - Prefer right side
  - `toolbarPosition="top"` - Prefer above the row
  - `toolbarPosition="inline"` - Render as fixed column instead of floating popup
  - Uses floating-ui for intelligent fallback when preferred position has no space
- **Inline Actions Column** - Render toolbar buttons as a table column
  - Set `toolbarPosition="inline"` to enable
  - `inlineActionsTitle` property sets the column header text
  - Supports `disabled` and `hidden` callbacks per row
  - Multi-row button layout via `row` property on toolbar items
  - Keyboard shortcuts (`rowShortcuts`) work on hovered row
- **Labels/i18n Support** - Centralized labels object for translations
  - `grid.labels` property accepts `Partial<GridLabels>` (merged with defaults)
  - Translatable strings: `rowActions`, `inlineActionsHeader`, `keyboardShortcuts`
  - Pagination labels: `paginationFirst`, `paginationPrevious`, `paginationNext`, `paginationLast`, `paginationPageInfo`, `paginationItemCount`, `paginationPerPage`
  - Placeholder syntax for dynamic values: `{current}`, `{total}`, `{count}`
- **Row Locking** - Lock rows to prevent editing (for collaborative scenarios)
  - Three lock sources: property-based, callback-based, external API
  - Property-based: `rowLocking.lockedMember` or `rowLocking.lockInfoMember`
  - Callback-based: `rowLocking.isLockedCallback` or `rowLocking.getLockInfoCallback`
  - External API: `lockRowById(id, info)`, `unlockRowById(id)` for WebSocket scenarios
  - Visual indicator: lock icon replaces row number, muted row styling
  - Configurable edit behavior: `lockedEditBehavior` ('block' | 'allow' | 'callback')
  - Row identification: `idValueMember` or `idValueCallback` for ID-based operations
  - Row update methods: `updateRowById(id, data)`, `replaceRowById(id, row)`
  - Automatic edit cancellation when row is locked while editing
  - Lock tooltips use Floating UI (consistent with other tooltips)
  - New labels: `dropdownNoOptions`, `dropdownSearching`
- **Column-Level Dropdown Text Overrides** - `editorOptions.noOptionsText` and `editorOptions.searchingText`
  - Override "No options" and "Searching..." messages per column
  - Falls back to `grid.labels.dropdownNoOptions` / `dropdownSearching` if not specified
  - Reactive: updates when column definition changes (useful for i18n)
- **Resizable Columns** - Drag column header edges to resize columns (Excel-style)
  - Drag the resize handle between column headers to adjust width
  - Per-column opt-out via `column.resizable = false`
  - Respects `column.minWidth` and `column.maxWidth` constraints
  - `oncolumnresize` callback fired after resize with `{ field, oldWidth, newWidth, allWidths }`
  - Optional localStorage persistence via `gridName` + `persistColumnWidths` properties
  - Programmatic API: `setColumnWidth(field, width)`, `setColumnWidths(widths)`, `getColumnWidthsState()`
  - Visual column separators between headers (`--wg-header-separator` CSS variable)
- **Reorderable Columns** - Drag column headers to rearrange columns
  - `allowColumnReorder` property enables drag-to-reorder (default: false)
  - Drag threshold (5px) prevents accidental reorder when clicking to sort
  - Frozen columns cannot be reordered
  - `oncolumnreorder` callback fired after reorder with `{ field, fromIndex, toIndex, allOrder }`
  - Optional localStorage persistence via `gridName` + `persistColumnOrder` properties
  - Programmatic API: `setColumnOrder(order)`, `getColumnOrderState()`, `moveColumn(field, toIndex)`
  - Grab cursor only shown when `allowColumnReorder` is enabled
- **Fill Handle (Autofill)** - Excel-like drag-to-fill for copying values
  - Small handle appears at bottom-right corner of focused cell
  - Drag to fill cells with source cell value
  - `fillDirection` property controls allowed directions:
    - `'vertical'` (default) - fill only within same column
    - `'all'` - fill in any direction (up, down, left, right)
  - Per-column override via `column.fillDirection`
  - **Type-based validation** - incompatible values are automatically skipped:
    - Number columns: only accept numeric values
    - Select/Combobox columns: only accept values that exist in options
    - Date columns: only accept valid date strings/objects/timestamps
    - Text/Autocomplete columns: accept any value (use `onfilldrag` callback for custom validation)
  - `onfilldrag` callback with `{ sourceCell, targetCells, direction }` - return `false` to cancel
  - Non-editable cells are automatically skipped
  - Fires `onrowchange` for each modified cell after fill completes
  - Drag threshold (5px) prevents accidental fill on click
  - Correctly uses draft row values (recently edited cells)
- **Row Selection** - Multi-row selection via row number cells
  - Click row number to select row (clears other selections)
  - Ctrl+Click to toggle row in selection
  - Shift+Click to select range from last selected row
  - Click+Drag on row numbers to select range while dragging
  - `selectedRows` getter returns array of selected row indices (sorted ascending)
  - `selectRow(index, mode)` method - mode: 'replace', 'toggle', 'range'
  - `selectRowRange(from, to)` method for programmatic range selection
  - `clearSelection()` method to clear all selections
  - `isRowSelected(index)` method to check selection state
  - `getSelectedRowsData()` method to get data objects for selected rows
  - Escape key clears selection
  - Visual highlighting with `--wg-selection-bg` and `--wg-selection-row-number-bg` CSS variables
- **Range Shortcuts** - Keyboard shortcuts that operate on selected rows
  - `rangeShortcuts` property accepts array of shortcut definitions
  - Each shortcut has `key` (e.g., "Delete", "Ctrl+Alt+E"), `id`, `label`, and `action` callback
  - `action` callback receives `{ rows, rowIndices }` context
  - `disabled` property supports boolean or callback for conditional shortcuts
  - Shortcuts work when rows are selected (no cell focus required)
  - Example: Delete selected rows, export selected rows to CSV
- **Showcase: Row Locking Feature Page** - New `/features/row-locking` page with live demos
  - Property-based locking (lockedMember, lockInfoMember)
  - Callback-based locking (getLockInfoCallback)
  - External API locking (lockRowById, unlockRowById) with interactive controls
- **Showcase: Row Selection Example Page** - New `examples-row-selection.html` demo
  - Basic selection demo with selection log
  - Range shortcuts demo with Delete and Ctrl+Alt+E actions

### Changed
- **Centralized Interaction State** - Refactored hover/focus/edit state tracking
  - All interaction state now managed in `WebGrid` class (single source of truth)
  - `grid.hoveredRowIndex` getter for reading hovered row
  - `grid.setHoveredRow()` method for updating hover state
  - Internal `_onInteractionChange` callback for state change notifications
  - Enables future features like "shortcuts on focused row when no hover"
- **Readonly Cell Background** - `--wg-cell-readonly-bg` now uses `var(--base-disabled-bg, var(--wg-surface-2))` instead of `var(--wg-surface-2)`, providing visual distinction from striped rows when theme-designer's `--base-disabled-bg` is set
- **Toolbar Positioning** - Refactored to use floating-ui library for better space detection and automatic fallback positioning
- **Font Inheritance** - Changed default font-family fallback from `system-ui, sans-serif` to `inherit`, allowing grid to inherit font from parent context (Bootstrap, Tailwind, etc.)
- **Form Element Fonts** - Added `font-family: inherit` to all form elements (buttons, inputs, selects) that don't inherit by default
- **Line Height** - Changed `--wg-line-height-base` from absolute value (`2 * --wg-rem` = 20px) to unitless multiplier (`1.5`), matching web-multiselect and standard CSS best practices
- **Font Size Alignment** - Aligned font size scale with web-multiselect and web-daterangepicker: `--wg-font-size-base` now uses `--base-font-size-sm` (14px) instead of `--base-font-size-base` (16px), ensuring consistent text size across all KeenMate components

### Removed
- **Deprecated `sortable` Property** - The grid-level `sortable` boolean property has been removed
  - Use `sortMode` instead: `'none'` (disabled), `'single'` (one column), `'multi'` (multi-column with Ctrl+click)
  - Migration: `grid.sortable = true` → `grid.sortMode = 'multi'`
  - Column-level `sortable` property (to disable sorting per column) is unchanged

### Fixed
- **Cross-Column Dropdown Bug** - Rapidly clicking between dropdown cells in different columns no longer opens dropdown on wrong cell. Fixed generic selectors to use specific `data-row`/`data-field` attributes.
- **Dropdown Toggle Stays Visible After Scroll** - Scrolling while dropdown is open now properly re-renders the cell to remove editor HTML (toggle button)
- **Datepicker Stays Open When Switching Cells** - Datepicker now auto-closes silently when its anchor becomes disconnected (e.g., clicking another cell)
- **Focus Border Not Cleared** - Clicking a dropdown toggle while another cell is focused now clears the focus border from the old cell
- **Autocomplete Stuck at "Searching..."** - Empty search results now correctly show "No options" instead of staying at "Searching..."
- **Virtual Scroll Flickering on Keyboard Navigation** - Pressing Ctrl+PageDown, Ctrl+Home, PageUp/Down no longer causes grid to flicker/redraw multiple times. Keyboard navigation now pre-renders target row range once before scrolling, with flag to skip redundant scroll event handlers.
- **Edit Mode Full Re-render** - Entering and exiting edit mode (click, F2, Enter, Tab, Escape) no longer causes full grid re-render. Uses surgical DOM updates to replace only the cell content, preserving any DevTools modifications to other cells.
- **Focus Following Row on Move** - `focusCell()` now updates state synchronously before render, fixing focus not following row when using keyboard shortcuts to move rows up/down
- **Enter Key Blocked After Date Picker** - Fixed `this.datepicker` not being set to null after date selection, which caused Enter key to be blocked in other editors
- **Connector Arrow Clipping** - Connector arrow now clips at grid container boundaries instead of drawing outside the container
- **Connector Scroll Updates** - Connector arrow updates in real-time when scrolling, pointing to container edge when row scrolls out of view
- **Connector Right Position** - When toolbar is on right side, connector now correctly points to the right side of the row (not always left)
- **Connector Scrollbar Overlap** - Connector uses container bounds instead of table bounds, avoiding overlap with scrollbar
- **Connector Visibility Check** - Row is only considered "not visible" when completely outside container (not just when center is outside)
- **Cursor Anchor Bug** - Cursor-based positioning only applies when `toolbarPosition="top"`, not for left/right positions

## [1.0.0-rc04] - 2026-01-02

### Added
- **Validation Error Tooltips** - Invalid cells now show validation error message as tooltip on hover
- **Rich Validation Tooltips** - New `validationTooltipCallback` for custom HTML error tooltips
  - Grid-level: `grid.validationTooltipCallback = ({ field, error, value, row, rowIndex }) => htmlString`
  - Column-level: `column.validationTooltipCallback = (ctx) => htmlString` (overrides grid-level)
  - Context object provides `field`, `error`, `value`, `row`, `rowIndex`
  - Return HTML string for rich formatting (you must escape user values for XSS safety)

### Changed
- **CSS Base Variables** - Updated to align with Pure Admin theme system
  - `--base-main-bg` instead of `--base-surface-1`
  - `--base-elevated-bg` instead of `--base-surface-2`
  - `--base-hover-bg` instead of `--base-surface-3`
  - `--base-dropdown-bg` for floating surfaces
  - `--base-input-*` variables for form inputs
  - `--base-danger-*` variables for error states

## [1.0.0-rc03] - 2026-01-02

### Added
- **Edit Start Selection** - New `editStartSelection` property controls cursor/selection behavior when entering edit mode
  - `editStartSelection="mousePosition"` - Cursor placed at click position (default)
  - `editStartSelection="selectAll"` - Select all text
  - `editStartSelection="cursorAtStart"` - Cursor at beginning
  - `editStartSelection="cursorAtEnd"` - Cursor at end
  - Can be set at grid level or per-column via `editorOptions.editStartSelection`

### Changed
- **Sort Mode** - New `sortMode` property replaces `sortable` boolean
  - `sortMode="none"` - Sorting disabled (default)
  - `sortMode="single"` - Single column sorting only
  - `sortMode="multi"` - Multi-column sorting with Ctrl+Click
  - `sortable` property is now deprecated but still works as an alias

### Fixed
- **Edit Trigger Click** - `editTrigger="click"` now works correctly
  - Single click starts editing immediately
  - Clicking another cell while editing transitions directly to the new cell (no double-click needed)

## [1.0.0-rc02] - 2025-01-02

### Added
- **Component Variables Manifest** - Machine-readable manifest documenting all CSS variables
  - `component-variables.manifest.json` included in package
  - 34 base variables (`--base-*`) the component consumes
  - 121 component variables (`--wg-*`) with categories and usage descriptions
  - Import via `@keenmate/web-grid/manifest`
  - Schema: `https://raw.githubusercontent.com/keenmate/schemas/main/component-variables.schema.json`

### Changed
- **Dark Mode** - Added support for `.dark` class (Tailwind CSS convention)

## [1.0.0-rc01] - 2025-01-02

### Added
- **First Release Candidate** - Initial RC for npm publishing
- **TypeScript Declarations** - Full `.d.ts` files included in package
- **CSS Variable Architecture** - 121 customizable `--wg-*` variables
- **Base Theme Integration** - Falls back to `--base-*` variables from `@keenmate/theme-designer`

### Changed
- **CSS Naming Convention** - Aligned with web-multiselect/daterangepicker
  - Renamed `-background` suffix to `-bg` throughout
  - Renamed `--base-layer-*` to `--base-surface-*`
  - Renamed `--base-stroke-*` to `--base-border-*`

## [0.1.0] - 2024-12-XX

### Added
- Initial TypeScript implementation of WebGrid component
- Core features: sorting, filtering, editing, keyboard navigation
- Editor types: text, number, date, select, combobox, autocomplete
- Virtual scrolling for large datasets
- Row toolbar with predefined and custom actions
- Context menu support
- Custom cell/row styling via callbacks
- CSS variable theming with `--base-*` integration

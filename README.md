# Web Grid

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](packages/web-grid/LICENSE)
[![npm version](https://img.shields.io/npm/v/@keenmate/web-grid.svg)](https://www.npmjs.com/package/@keenmate/web-grid)

A framework-agnostic data grid web component — sorting, filtering, pagination, inline editing (8 editor
types), cell range selection, Excel-compatible clipboard, row toolbar, context menus, frozen columns, column
reorder / resize, fill handle, tree mode, virtual scroll and full CSS-variable theming, all in one
Shadow DOM `<web-grid>` element built on `@keenmate/web-components-core`.

This repository is a workspaces monorepo with one published package:

| Package | What | Docs |
|---|---|---|
| [`@keenmate/web-grid`](packages/web-grid) | The `<web-grid>` element, its controller and TypeScript types | [README](packages/web-grid/README.md) (install, quick start, browser support) · [usage / API reference](packages/web-grid/docs/usage.md) · [theming](packages/web-grid/docs/theming.md) · [examples / cookbook](packages/web-grid/docs/examples.md) · [accessibility](packages/web-grid/docs/accessibility.md) |

- [CHANGELOG.md](CHANGELOG.md) — release history.
- [Release notes](packages/web-grid/release-notes/) — upgrade guides per release ([2.0.0-rc01](packages/web-grid/release-notes/2.0.0-rc01.md)).
- [docs/](docs) — internal design notes ([action pipeline](docs/action-pipeline.md), [z-index layers](docs/z-index-layers.md)).
- `examples-*.html` — the example pages (run `npm run dev`).

## What's New in v2.0.0-rc01

Upgrade guide: the [2.0.0-rc01 release notes](packages/web-grid/release-notes/2.0.0-rc01.md); full list: the
[CHANGELOG 2.0.0-rc01 section](CHANGELOG.md). A major release — breaking, with no aliases.

- **Core — every option is an attribute and a validated input** — 1.x observed no attributes, so `<web-grid is-striped>` was dead markup. `<web-grid>` now extends `@keenmate/web-components-core`'s `BlissElement`: every scalar / enum option is one input row — an HTML attribute (`enable-paging`, `page-size`, `striped`, `preset`), a typed property (`GridElementConfig`) and a validated value. An invalid value warns, fires `input-rejected` and keeps the previous one; removing an attribute resets the default. The element gains core's lifecycle (`defer` / `release()`, `ready` / `whenReady()`, `destroy()`), responsive rules per device or breakpoint, `customStyles` (page-wide too) and `readonly` / `disabled` with native semantics.
- **Interaction model — one `ctx`, DOM events, action items** — every callback takes one `ctx` carrying `controller` and `element` (`formatCallback(value, row)` → `getDisplayValueCallback(ctx)`), every event is a DOM event with an `on*` twin (`onrowchange` → `row-change` / `onRowChange`), and the row toolbar, the cell / header menus and the shortcuts share core's action-item shape with one `action` event. The built-ins (`add`, `delete`, `duplicate`, `move-up`, `move-down`) now do the work — veto them with `beforeActionCallback`. `el.grid` is replaced by the frozen `el.controller`; the engine and the module plumbing are private.
- **Naming — suite-wide renames** — properties follow the Keenmate naming rules (`isFilterable` → `isFilteringEnabled`, `isEditable` → `isEditingEnabled`, `mode` → `preset`, `freezeColumns` → `frozenColumnCount`, `*Visible` → `*Shown`), enum values are kebab-case (`'mouse-position'`, `sortMode: 'multiple'`), the tree API uses web-treeview's names (`pathMember`, `expandLevel`, `expandedPaths: string[]`, `row-expand` / `expanded-change`) and `idMember` (default `'id'`) is the one row-id member. The release notes carry every old → new table.
- **Keyboard and accessibility — an ARIA grid with one tab stop** — the table is `role="grid"` (`treegrid` in tree mode) with row / column counts and indexes that stay right in a virtual grid, `aria-selected`, `aria-readonly` and `aria-sort`. Like Excel, the grid is one tab stop in every edit mode: only the active cell has `tabindex="0"`, Tab leaves the grid, Enter / F2 reach the controls inside a cell. Shift+Arrow builds cell ranges, Shift+F10 opens the cell menu, tooltips show on keyboard focus, and the cell dropdown is an ARIA combobox.
- **Editing and clipboard — the Excel rules** — leaving a cell saves the edit (a click outside, another overlay, `startEditing()` elsewhere), Escape cancels. Copy takes what the cell shows — option labels, formatted dates, locale numbers, `getDisplayValueCallback` — and a pasted option label maps back to its value. Ctrl+V and type-to-edit work in every edit mode, pasted text is typed per column, the number editor validates strictly, and `renderCellCallback` wins in every column type (`null` = the built-in look).
- **Localization — labels, locale, number formats** — UI strings go through core `/locale`: flat `<elementType>.<name>` keys (`labels.pageInfo`, `menuItems.sortAsc`), a page-wide dictionary in `window.components.locale`, and a `translateCallback` per grid or per page. Dynamic labels read the context of their spot — `{ctx.count}`, `{ctx.currentPage}` (was `{count}`, `{current}`), so an app's i18n can pluralize by `ctx.count`. The new `locale` input formats number columns Excel-style (`1.234,50` in `de`) and parses typed text with the same separators; `parseNumberCallback` reads text your own way.
- **Phone, touch and overlays — sheets and finger drags** — on a phone the cell dropdown and the date editor are an edge-to-edge sheet and the menus a bottom sheet (`menu-presentation`), with core's sheet chrome and the Back gesture. Column resize and reorder work with a finger. The menus run on core `/menu`, the dropdown and date editor on core `createPopover()` in the grid's shadow root, so they follow the grid's theme; the filter row matches case- and accent-insensitively.
- **Theming and icons — the shared contract** — standalone colours follow `@keenmate/base-css-variables` 2.0 (derived steps from `--wg-accent-color`), motion chains to `--base-duration-*`, layers sit on the core `--base-z-*` tiers and the context menus theme through `--wg-context-menu-*` → `--km-menu-*`. Icons render through core `renderIcon` (markup, built-in names, the grid's or the page's `renderIconCallback`, icon-font classes) and repaint when the page hook changes; loaders draw core's shared loader (`renderLoadingCallback`).

## What's New in v1.2.0-rc02

- **Excel-like commit-on-click-away** — new `shouldCommitOnClickAway` property (defaults to `true`). Clicking a different cell while editing now commits the in-progress value through `beforeCommitCallback` / `validateCallback` instead of silently discarding it. Set to `false` to keep the legacy discard behavior. Companion fix: row focus (`.wg__row--focused`) now applies on the first cell click — previously it only landed on the second.
- **CSS surface taxonomy aligned with pure-admin's `--base-*` names** — `--wg-surface-1/2/3` renamed to `--wg-main-bg` / `--wg-elevated-bg`, `--wg-surface-floating` → `--wg-dropdown-bg` (`--wg-surface-3` merged into `--wg-hover-bg`). Consumer overrides of the old names need to migrate; see the CHANGELOG mapping table.
- **Dark mode reworked to respect consumer themes** — the dark-mode override blocks used to set `--wg-*` to hardcoded literals, silently overriding pure-admin / theme-designer values. They now just flip `color-scheme` and let `light-dark()` in `variables.css` do the work. The consumer's `--base-*` chain stays the source of truth.
- **OS-aware dark mode via `light-dark()` fallbacks** — every hardcoded fallback in `variables.css` is wrapped in `light-dark(<light>, <dark>)`. A consumer who only sets `body { color-scheme: dark }` (no overrides, no framework class) now gets a sensible dark palette automatically.
- **CSS architecture refactor: `@layer` cascade + canonical file set** — `main.css` now declares `@layer variables, component, overrides;` so consumer rules beat library defaults without `!important`. CSS filenames dropped the underscore prefix (pure-CSS doesn't use SASS-partial convention). New canonical Tier-2 files (`controls.css` / `floating.css` / `states.css` / `animations.css`) match the cross-component pattern.
- **`--base-active-bg` + `--base-inverse-bg`** — two new cross-component theming hooks. `--base-active-bg` distinguishes pressed from hover; `--base-inverse-bg` covers tooltip and future inverse UI surfaces. Both are optional and additive.
- **Context menu was leaking through stale `--base-*` names** — was referencing `--base-layer-01` / `--base-stroke-default` / `--base-error-color` (all long-removed in pure-admin). Now uses the canonical names; consumers loading a pure-admin theme finally get themed context menus instead of silent fallbacks.
- **WCAG contrast e2e suite** — 18 assertions check header / body / hover / focused / selected-row / editing-cell contrast against the 3:1 threshold (WCAG AA for non-text UI). Catches theme regressions invisible to visual smoke tests.

Earlier releases: [CHANGELOG](CHANGELOG.md) (no release notes before 2.0.0-rc01).

## Install

```bash
npm install @keenmate/web-grid
```

## Quick start

```html
<script type="module">
  import '@keenmate/web-grid';
</script>

<web-grid id="grid" sort-mode="single" enable-paging page-size="25"></web-grid>

<script type="module">
  const grid = document.getElementById('grid');
  grid.columns = [
    { field: 'name', title: 'Name' },
    { field: 'age', title: 'Age', horizontalAlign: 'right' },
  ];
  grid.items = [{ id: 1, name: 'Ada', age: 36 }, { id: 2, name: 'Linus', age: 54 }];
</script>
```

Browser support, editor IntelliSense and the full walkthrough: the [package README](packages/web-grid/README.md).

## Development

```bash
npm install
npm run dev              # example pages (examples-*.html) on the devkit dev server
npm run build            # builds packages/web-grid (+ custom-elements.json)
npm run build:examples   # static examples site into dist-examples/
npm run test:unit        # vitest (packages/web-grid)
npm run test:e2e         # Playwright, against the fixture pages under test/
npm run doctor           # kmwc doctor (the BlissFramework rulebook checks)
```

## About

Authored and maintained by [Keenmate s.r.o.](https://keenmate.com/).
The component ships standalone with sensible light/dark defaults;
when mounted inside [Pure Admin](https://pureadmin.io/) — or any
host that publishes the `--base-*` taxonomy via
[`@keenmate/theme-designer`](https://www.npmjs.com/package/@keenmate/theme-designer) — it adopts the host's colors,
typography, and sizing automatically. There is no runtime
dependency on Pure Admin; the integration is opt-in via CSS
variables.

## Built with BlissFramework

Follows the [BlissFramework component guidelines](https://blissframework.dev/) for structure, theming,
color-scheme, and accessibility.

## License

MIT — see [LICENSE](packages/web-grid/LICENSE).

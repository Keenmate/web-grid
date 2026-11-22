# @keenmate/web-grid

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@keenmate/web-grid.svg)](https://www.npmjs.com/package/@keenmate/web-grid)

> A framework-agnostic data grid web component with sorting, filtering, inline editing, cell range selection, clipboard support, and full keyboard navigation. Built with TypeScript, encapsulated in a Shadow DOM, themeable through CSS variables, no dependencies.

## What is it

`@keenmate/web-grid` is a custom element (`<web-grid>`) that turns a `T[]` array of records into a spreadsheet-grade data grid. Framework-agnostic — works in React, Vue, Svelte, Blazor, plain HTML.

Works **standalone** out of the box — no theme provider required. Reads `--base-*` variables from the page if [`@keenmate/theme-designer`](https://theme-designer.keenmate.dev) is present, falls back to sensible OS-aware defaults otherwise. Ships with first-class dark mode and per-instance theming.

**Headline features:**

- 8 inline editor types (`text`, `number`, `checkbox`, `select`, `combobox`, `autocomplete`, `date`, `custom`).
- Spreadsheet-like keyboard navigation (Arrow / Tab / Home / End / PageUp / PageDown) with Excel-like commit-on-click-away.
- Single- or multi-column sorting, per-column filtering, client- or server-side pagination.
- Cell range selection with TSV clipboard copy/paste (Excel-compatible).
- Floating, inline, or cell-specific row toolbars; cell + header context menus and keyboard shortcuts — all one action-item shape, with built-ins that do the work and a single `action` event.
- Frozen columns, drag-to-resize, drag-to-reorder, fill handle, virtual scroll, infinite scroll.
- ltree-style tree mode with chevron + indent, per-row custom shortcuts, optimistic row locking.
- 223 `--wg-*` CSS variables with `--base-*` fallback for cross-component themes.
- TypeScript-first — full type definitions exported.

## What's New in v2.0.0-rc01

Upgrade guide: the [2.0.0-rc01 release notes](release-notes/2.0.0-rc01.md); full list: the
[CHANGELOG 2.0.0-rc01 section](https://github.com/KeenMate/web-grid/blob/prod/CHANGELOG.md). A major release — breaking, with no aliases.

- **Core — every option is an attribute and a validated input** — 1.x observed no attributes, so `<web-grid is-striped>` was dead markup. `<web-grid>` now extends `@keenmate/web-components-core`'s `BlissElement`: every scalar / enum option is one input row — an HTML attribute (`enable-paging`, `page-size`, `striped`, `preset`), a typed property (`GridElementConfig`) and a validated value. An invalid value warns, fires `input-rejected` and keeps the previous one; removing an attribute resets the default. The element gains core's lifecycle (`defer` / `release()`, `ready` / `whenReady()`, `destroy()`), responsive rules per device or breakpoint, `customStyles` (page-wide too) and `readonly` / `disabled` with native semantics.
- **Interaction model — one `ctx`, DOM events, action items** — every callback takes one `ctx` carrying `controller` and `element` (`formatCallback(value, row)` → `getDisplayValueCallback(ctx)`), every event is a DOM event with an `on*` twin (`onrowchange` → `row-change` / `onRowChange`), and the row toolbar, the cell / header menus and the shortcuts share core's action-item shape with one `action` event. The built-ins (`add`, `delete`, `duplicate`, `move-up`, `move-down`) now do the work — veto them with `beforeActionCallback`. `el.grid` is replaced by the frozen `el.controller`; the engine and the module plumbing are private.
- **Naming — suite-wide renames** — properties follow the Keenmate naming rules (`isFilterable` → `isFilteringEnabled`, `isEditable` → `isEditingEnabled`, `mode` → `preset`, `freezeColumns` → `frozenColumnCount`, `*Visible` → `*Shown`), enum values are kebab-case (`'mouse-position'`, `sortMode: 'multiple'`), the tree API uses web-treeview's names (`pathMember`, `expandLevel`, `expandedPaths: string[]`, `row-expand` / `expanded-change`) and `idMember` (default `'id'`) is the one row-id member. The release notes carry every old → new table.
- **Keyboard and accessibility — an ARIA grid with one tab stop** — the table is `role="grid"` (`treegrid` in tree mode) with row / column counts and indexes that stay right in a virtual grid, `aria-selected`, `aria-readonly` and `aria-sort`. Like Excel, the grid is one tab stop in every edit mode: only the active cell has `tabindex="0"`, Tab leaves the grid, Enter / F2 reach the controls inside a cell. Shift+Arrow builds cell ranges, Shift+F10 opens the cell menu, tooltips show on keyboard focus, and the cell dropdown is an ARIA combobox.
- **Editing and clipboard — the Excel rules** — leaving a cell saves the edit (a click outside, another overlay, `startEditing()` elsewhere), Escape cancels. Copy takes what the cell shows — option labels, formatted dates, locale numbers, `getDisplayValueCallback` — and a pasted option label maps back to its value. Ctrl+V and type-to-edit work in every edit mode, pasted text is typed per column, the number editor validates strictly, and `renderCellCallback` wins in every column type (`null` = the built-in look).
- **Localization — labels, locale, number formats** — UI strings go through core `/locale`: flat `<elementType>.<name>` keys (`labels.pageInfo`, `menuItems.sortAsc`), a page-wide dictionary in `window.components.locale`, and a `translateCallback` per grid or per page. The new `locale` input formats number columns Excel-style (`1.234,50` in `de`) and parses typed text with the same separators; `parseNumberCallback` reads text your own way.
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

Earlier releases: [CHANGELOG](https://github.com/KeenMate/web-grid/blob/prod/CHANGELOG.md) (no release notes before 2.0.0-rc01).

## Demos & docs

- 📘 [Usage / API reference](./docs/usage.md) — properties, columns, editors, callbacks, events, `el.controller`, methods.
- 🎨 [Theming](./docs/theming.md) — `--wg-*` variables, dark-mode signals, cascade layers, Theme Designer integration.
- 📚 [Examples / cookbook](./docs/examples.md) — recipes for sorting, editing, tree mode, virtual scroll, theming, more.
- ♿ [Accessibility](./docs/accessibility.md) — keyboard model, ARIA, focus management, contrast targets.

## Install

```bash
npm install @keenmate/web-grid
```

Or via CDN (no bundler):

```html
<script type="module" src="https://unpkg.com/@keenmate/web-grid"></script>
```

Editor IntelliSense: the package ships `custom-elements.json` + `web-types.json` (JetBrains, auto-discovered) and
VS Code data — add `"html.customData": ["./node_modules/@keenmate/web-grid/vscode.html-custom-data.json"]` and
`"css.customData": ["./node_modules/@keenmate/web-grid/vscode.css-custom-data.json"]` to `.vscode/settings.json`.

## Quick start

```html
<script type="module">
  import '@keenmate/web-grid';
</script>

<web-grid id="grid" style="max-height: 400px"></web-grid>

<script>
  const grid = document.getElementById('grid');

  grid.items = [
    { id: 1, name: 'Alice', age: 28, department: 'Engineering' },
    { id: 2, name: 'Bob',   age: 34, department: 'Marketing' }
  ];

  grid.columns = [
    { field: 'id',         title: 'ID',         width: '60px' },
    { field: 'name',       title: 'Name',       width: '160px' },
    { field: 'age',        title: 'Age',        width: '80px', horizontalAlign: 'right' },
    { field: 'department', title: 'Department', width: '160px' }
  ];

  // Optional: enable features
  grid.isStriped = true;
  grid.isHoverable = true;
  grid.sortMode = 'multiple';
  grid.isPagingEnabled = true;
  grid.pageSize = 25;
  grid.preset = 'excel';                 // isEditingEnabled + editTrigger='navigate' + cellSelectionMode='click'
</script>
```

That's it — the grid reads its configuration from properties on the element (not attributes). See [docs/usage.md](./docs/usage.md) for the full API and [docs/examples.md](./docs/examples.md) for sortable / editable / themed / tree / virtual-scroll patterns.

## Browser support

Modern evergreen browsers — anything with native `customElements`, Shadow DOM, CSS `@layer`, and CSS `light-dark()` support:

- Chrome / Edge 123+
- Firefox 120+
- Safari 17.5+

No polyfills are shipped. Page dark/light detection comes from `@keenmate/web-components-core` (mirrored onto the host as `data-context-theme`), so it works in every engine — no `:host-context()`.

## Development

```bash
# Install workspace dependencies
make setup

# Start docs dev server (HMR)
make dev

# Build library + docs
make build

# Build library for publishing
make package
```

## Built with BlissFramework

Follows the [BlissFramework component guidelines](https://blissframework.dev/) for structure, theming, color-scheme, and accessibility — shared across `@keenmate/web-grid`, `@keenmate/web-multiselect`, `@keenmate/web-daterangepicker`, and `svelte-treeview`.

## License

MIT — see [LICENSE](./LICENSE).

## Credits

Created by [Keenmate](https://github.com/KeenMate) as part of the Pure Admin design system.

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

A major release — see the [CHANGELOG](https://github.com/KeenMate/web-grid/blob/prod/CHANGELOG.md) for every rename (no aliases).

- **Shared interaction model** (`@keenmate/web-components-core`) — every callback takes one `ctx` (with `controller` + `element`), every event has an `on*` twin, the row toolbar / cell and header menus / shortcuts are core action items, and both menus run on core `openMenu()`.
- **Suite-wide naming** — boolean attributes in the short HTML form (`enable-filtering`, `enable-editing`, `show-row-numbers`, `enable-virtual-scroll`, …), kebab-case enum values, `preset` (was `mode`), tree API with web-treeview names (`toggleRowExpanded`, `expandRows` / `expandAll(paths?)` with `ExpandOptions`, `expandedPaths: string[]`, `row-expand` / `row-collapse` / `expanded-change`), `cell-edit-start` / `cell-paste` / `focus-change` events, state as same-named properties on the element and `el.controller` (`selectedRows`, `selectedRowIndices`, `items`, …).
- **`readonly` and `disabled`** — `readonly` blocks edits, paste, fill and row add / delete / move but keeps selection and copy; `disabled` makes the grid inert. The `read-only` preset sets `readonly`.
- **Ctrl+Delete deletes** — the `delete` built-in removes the row (veto with `beforeActionCallback`) and `row-delete` reports it after the fact.
- **Core lifecycle** — `defer` / `release()` hold the first render, then `ready` / `:state(ready)` / `whenReady()`; `destroy()`.
- **`labels`** — also a JSON attribute, with `labels.noData` / `labels.noResults` for the empty table (`''` = blank), `labels.loading` for a pending infinite-scroll load; `scrollToRow(rowIndex)` resolves when the row is in view.
- **Dropdowns** — `editorOptions.isEmptyAllowed` adds an empty first item (→ `null`); "no options" vs "no matching options" texts.
- **Shared loader** — the infinite-scroll row and async dropdown search draw one loader (`--base-loader-*` tokens); swap it with `renderLoadingCallback` or page-wide `window.components.renderLoadingCallback`.
- **Lookups** — `getRowById(id)` → row or `null`, `getRowIndex(row)` → display index or `-1`.
- **Core 1.0.0-rc20/rc21** — every input is a typed property (`GridElementConfig`); `customStyles` / `custom-styles` next to `getCustomStylesCallback`, plus page-wide `window.components['web-grid'].customStyles`; `beforeScrollCallback` gates every scroll the grid makes on its own (keyboard, `scrollToRow`, go-to-row), which now scrolls only the grid's container (`scrollToRow` centres the row and brings the grid on screen); `readonly` / `disabled` follow the native presence rule and reflect; position / layout / CSS-length inputs are validated (`input-rejected`).

## What's New in v1.2.0-rc02

- **Excel-like commit-on-click-away** — new `shouldCommitOnClickAway` property (defaults to `true`). Clicking a different cell while editing now commits the in-progress value through `beforeCommitCallback` / `validateCallback` instead of silently discarding it. Set to `false` to keep the legacy discard behavior. Companion fix: row focus (`.wg__row--focused`) now applies on the first cell click — previously it only landed on the second.
- **CSS surface taxonomy aligned with pure-admin's `--base-*` names** — `--wg-surface-1/2/3` renamed to `--wg-main-bg` / `--wg-elevated-bg`, `--wg-surface-floating` → `--wg-dropdown-bg` (`--wg-surface-3` merged into `--wg-hover-bg`). Consumer overrides of the old names need to migrate; see the CHANGELOG mapping table.
- **Dark mode reworked to respect consumer themes** — the dark-mode override blocks used to set `--wg-*` to hardcoded literals, silently overriding pure-admin / theme-designer values. They now just flip `color-scheme` and let `light-dark()` in `variables.css` do the work. The consumer's `--base-*` chain stays the source of truth.
- **OS-aware dark mode via `light-dark()` fallbacks** — every hardcoded fallback in `variables.css` is wrapped in `light-dark(<light>, <dark>)`. A consumer who only sets `body { color-scheme: dark }` (no overrides, no framework class) now gets a sensible dark palette automatically.
- **CSS architecture refactor: `@layer` cascade + canonical file set** — `main.css` now declares `@layer variables, component, overrides;` so consumer rules beat library defaults without `!important`. CSS filenames dropped the underscore prefix (pure-CSS doesn't use SASS-partial convention). New canonical Tier-2 files (`controls.css` / `floating.css` / `states.css` / `animations.css`) match the cross-component pattern.
- **`--base-active-bg` + `--base-inverse-bg`** — two new cross-component theming hooks. `--base-active-bg` distinguishes pressed from hover; `--base-inverse-bg` covers tooltip and future inverse UI surfaces. Both are optional and additive.
- **Context menu was leaking through stale `--base-*` names** — was referencing `--base-layer-01` / `--base-stroke-default` / `--base-error-color` (all long-removed in pure-admin). Now uses the canonical names; consumers loading a pure-admin theme finally get themed context menus instead of silent fallbacks.
- **WCAG contrast e2e suite** — 18 assertions check header / body / hover / focused / selected-row / editing-cell contrast against the 3:1 threshold (WCAG AA for non-text UI). Catches theme regressions invisible to visual smoke tests.

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

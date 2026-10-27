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
- 209 `--wg-*` CSS variables with `--base-*` fallback for cross-component themes.
- TypeScript-first — full type definitions exported.

## What's new

**v2.0.0-rc01** — a major: the shared KeenMate interaction model (one-ctx callbacks, `on*` event twins, core action items and menus) and suite-wide naming — short boolean attributes (`filterable`, `editable`, `show-row-numbers`, …), `preset` (was `mode`), `readonly` / `disabled`, web-treeview tree names, `cell-edit-start` / `cell-paste` / `focus-change`, Ctrl+Delete really deletes. See the CHANGELOG for every rename.

**v1.2.0-rc02** — Excel-like commit-on-click-away; dark-mode signals no longer override consumer `--base-*` themes; CSS surface taxonomy aligned with pure-admin (`--wg-main-bg` / `--wg-elevated-bg` / `--wg-dropdown-bg`); `@layer` cascade so consumer rules beat library defaults without `!important`; WCAG contrast e2e suite (18 assertions). See [CHANGELOG.md](../../CHANGELOG.md) for the full history.

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
  grid.isPageable = true;
  grid.pageSize = 25;
  grid.preset = 'excel';                 // isEditable + editTrigger='navigate' + cellSelectionMode='click'
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

Created by [KeenMate](https://github.com/KeenMate) as part of the Pure Admin design system.

# Theming

`@keenmate/web-grid` is styled entirely through CSS custom properties. The component lives in a Shadow DOM for encapsulation, but every visible color, size, font, and surface is exposed as a `--wg-*` variable that you can override from the light DOM.

For interactive theme exploration, use the [KeenMate Theme Designer](https://theme-designer.keenmate.dev).

Four contracts govern how theming works:

1. [Container contract](#container-contract) — what the host element renders and where the surfaces are painted.
2. [Variable contract](#variable-contract) — how the `--wg-*` / `--base-*` / hardcoded fallback chain resolves.
3. [Color-scheme contract](#color-scheme-contract) — the five signals that flip dark / light mode.
4. [Cascade-layer contract](#cascade-layer-contract) — how `@layer` orders library defaults vs. consumer overrides.

## Container contract

`<web-grid>` is a **transparent composite component**. The host element itself has no painted background — internal surfaces (table body, header row, dropdown, toolbar, tooltip, context menu) each paint via their own `--wg-*-bg` variable.

This matters because:

- The host can sit on any background — a panel, a card, a sidebar — and inherit visually without leaking color.
- You theme the surfaces, not the host. Setting `web-grid { background: pink }` would paint pink behind any gap; setting `--wg-main-bg: pink` paints only the table body cells.

The host's own CSS (set in `variables.css`):

```css
:host {
  display: block;
  position: relative;     /* offsetParent for absolute-positioned tooltip */
  font-family: var(--wg-font-family);
}
```

Sizing is controlled from the outside via `max-height` / `height` on the host (see [Height & scroll in usage.md](./usage.md#height--scroll)) — the shadow DOM's inner scroll container uses `max-height: inherit` to pick that up.

### Per-instance theming

Two host-level signals override the page's theme on a single grid instance:

```html
<!-- Force this grid into dark mode on a light page -->
<web-grid data-theme="dark"></web-grid>

<!-- Force light mode on a dark page (e.g. for export views) -->
<web-grid data-theme="light"></web-grid>
```

The same attribute on an ancestor scopes the override to a subtree, for grids that opt in with `theme-source="closest"`:

```html
<div data-theme="dark">
  <web-grid theme-source="closest"></web-grid>   <!-- ← dark -->
  <web-grid theme-source="closest"></web-grid>   <!-- ← dark -->
</div>
<web-grid></web-grid>     <!-- ← respects page color-scheme -->
```

Detection is done once per page by `@keenmate/web-components-core` and mirrored onto each grid as `data-context-theme` — no `:host-context()`, so it works in Firefox and Safari. It reads `<html>` then `<body>`; for a themed **section** like the wrapper above, add `theme-source="closest"` (nearest ancestor with a signal) or `theme-source="<selector>"` to the grids. See [color-scheme contract](#color-scheme-contract) for the full signal list.

## Variable contract

### The fallback chain

Every `--wg-*` color, font, or measurement resolves through a three-step chain:

```css
:host {
  /* 1. External override on the host wins.
     2. Otherwise read --base-*. theme-designer / pure-admin / ... declare these on :root.
     3. Otherwise the standalone fallback applies. */
  --wg-accent-color: var(--base-primary-color, #3b82f6);
  --wg-accent-color-hover: var(--base-primary-color-hover,
    light-dark(color-mix(in srgb, black 15%, var(--wg-accent-color)),
               color-mix(in srgb, white 15%, var(--wg-accent-color))));
}
```

Standalone (no `@keenmate/base-css-variables` on the page) the grid looks the same as with
it: inputs (accent, main bg, text color, danger, shadow color) fall back to the contract's
default values, and every derived color (hover / active, tints, text levels, borders, tooltip,
text on the accent) falls back to the contract's **formula** on the `--wg-*` input. So
`--wg-accent-color: #10b981` alone brings its hover, tint and text-on-accent along. The build
checks this (`npm run check:contract`, `base-contract-check`), and `e2e/contract-parity.spec.ts`
compares every color token standalone vs. with the contract, in light and dark.

Practical consequences:

```css
/* (1) Override just this grid */
web-grid { --wg-accent-color: #10b981; }

/* (2) Theme every KeenMate component on the page (Theme Designer pattern) */
:root { --base-primary-color: #10b981; }

/* (3) No override → the contract's default applies (`#3b82f6` in this case) */
```

The chain is the same for typography, surfaces, borders, danger colors, tooltip colors, and input chrome — see the [variables manifest](#variables-manifest) for the full list.

### Sizing — the `--wg-rem` unit

All sizing values are based on a single `--wg-rem` unit for consistent scaling:

```css
:host {
  --wg-rem: 10px;                                     /* default — produces standard pixel values */
}
:host {
  --wg-font-size-sm: calc(var(--base-font-size-sm, 1.4) * var(--wg-rem));
}
```

This means changing one variable rescales the entire grid proportionally:

```html
<!-- Compact (80% scale) -->
<web-grid style="--wg-rem: 8px"></web-grid>

<!-- Default -->
<web-grid></web-grid>

<!-- Large (120%) -->
<web-grid style="--wg-rem: 12px"></web-grid>

<!-- Pure Admin integration — inherits from html { font-size: 10px } -->
<web-grid style="--wg-rem: 1rem"></web-grid>
```

> Shadow DOM note: CSS variables must be set on the `<web-grid>` element itself, not on a wrapping div, for shadow DOM resolution.

### Variables manifest

A machine-readable manifest documenting every variable ships with the package:

```javascript
import manifest from '@keenmate/web-grid/manifest'

console.log(manifest.prefix)             // "wg"
console.log(manifest.baseVariables)      // 37 --base-* variables consumed
console.log(manifest.componentVariables) // 209 --wg-* variables exposed
```

The manifest conforms to the [component-variables schema](https://raw.githubusercontent.com/keenmate/schemas/main/component-variables.schema.json) and lists every variable with a category and a one-line usage description. Treat it as the source of truth — `variables.css` and this doc both derive from the same surface.

### Key variables

Headline variables you'll override most often:

| Variable | Purpose |
|---|---|
| `--wg-accent-color` | Primary accent — editor focus outline, active sort indicator, selected pagination button |
| `--wg-text-color-1` | Primary text in cells, headers, labels |
| `--wg-text-color-2` | Secondary text — row numbers, help labels |
| `--wg-main-bg` | Table body / cell background |
| `--wg-elevated-bg` | Header row, striped even rows, pagination bar |
| `--wg-hover-bg` | Row hover, sorted header, button hover |
| `--wg-dropdown-bg` | Floating toolbar, context menu, dropdown panels |
| `--wg-border-color` | Table border, cell borders, header separators |
| `--wg-rem` | Base sizing unit for proportional scaling |
| `--wg-tooltip-bg` / `--wg-tooltip-color` | Tooltip + validation-message surface |

The full table lives in [the manifest](../component-variables.manifest.json).

### `--base-*` variables consumed

`@keenmate/web-grid` reads roughly 37 `--base-*` variables across these categories. Setting any of them on `:root` themes every KeenMate component on the page at once.

- **Colors**: `--base-primary-color` (+ `-hover` / `-active`), `--base-primary-bg-subtle`, `--base-text-color-1` … `-4`, `--base-on-primary-text-color`, `--base-main-bg`, `--base-elevated-bg`, `--base-hover-bg`, `--base-active-bg`, `--base-disabled-bg`, `--base-dropdown-bg`, `--base-tooltip-bg`, `--base-tooltip-text-color`, `--base-border-color`.
- **Inputs**: `--base-input-bg` / `-text-color` / `-border-color` / `-border` (+ `-hover` / `-focus`) / `-placeholder-color`.
- **Danger**: `--base-danger-color`, `--base-danger-bg-subtle`.
- **Tooltip**: `--base-tooltip-bg`, `--base-tooltip-text-color`.
- **Typography**: `--base-font-family`, `--base-font-size-base` / `-sm` / `-xs` / `-2xs`, `--base-font-weight-normal` / `-semibold`, `--base-line-height-*`.
- **Other**: `--base-border-radius-*`, `--base-dropdown-box-shadow`, `--base-shadow-color`.

## Color-scheme contract

Dark / light mode is driven by **five signals**. Each one is honored at the right precedence so the consumer's intent always wins.

| # | Signal | Where it lives | Wins over |
|---|---|---|---|
| 1 | OS preference | The user's system, exposed by `@media (prefers-color-scheme: dark)` | — (lowest priority; opt-in only) |
| 2 | Page `color-scheme` | `html { color-scheme: light dark }` | OS preference |
| 3 | Framework data-attribute | `<html data-bs-theme="dark">`, `<body data-theme="dark">` (or a `theme-source` element) | Page color-scheme |
| 4 | Framework class | `<html class="dark">`, `<body class="dark">` | Same as #3 (parallel, both honored) |
| 5 | Per-instance attribute | `<web-grid data-theme="dark">` | Everything else (highest specificity) |

### How it works

Every `--wg-*` color fallback in `variables.css` resolves through `light-dark(<light>, <dark>)`:

```css
--wg-main-bg:       var(--base-main-bg, light-dark(#ffffff, #1e293b));
--wg-text-color-1:  var(--base-text-color-1, light-dark(#334155, #f1f5f9));
--wg-border-color:  var(--base-border-color, light-dark(oklch(from var(--wg-main-bg) calc(l - 0.096) c h),
                                                       oklch(from var(--wg-main-bg) calc(l + 0.192) c h)));
```

`light-dark()` picks the right branch based on the resolved `color-scheme` value at that element. The library's job is to set `color-scheme` correctly based on the signals above — that's all `dark-mode.css` does. It does **not** override `--wg-*` or `--base-*` directly; setting them would silently replace your themed values.

### Opting in to OS preference (signal #1)

By design, the OS preference is **opt-in**. Set `color-scheme: light dark` on `<html>` (or any ancestor):

```html
<html style="color-scheme: light dark">
  <!-- web-grid now follows the OS -->
</html>
```

Without this opt-in, `light-dark()` defaults to the light branch even if the OS prefers dark. This mirrors web-multiselect's approach — without opt-in, a consumer pinning their app to one mode would be overridden by anyone running the OS in dark mode.

### Forcing light mode

To force a single grid (or section) back to light on an otherwise-dark page:

```html
<web-grid data-theme="light"></web-grid>

<div data-theme="light">
  <web-grid></web-grid>   <!-- ← light, regardless of ancestor or OS -->
</div>
```

Same mechanism — `color-scheme: light` is set on the host, the `light-dark()` chain resolves to the light branch.

### Why we don't write `--wg-main-bg: #1f1f1f` in dark.css

Setting `--wg-main-bg: #1f1f1f` on `:host` in a dark-mode block would shadow the consumer's `:root { --base-main-bg: … }` for resolution inside the shadow root. Their themed value (e.g. pure-admin's dark theme) would be silently replaced by our hardcoded default. By flipping `color-scheme` instead, the consumer's `--base-*` chain remains the source of truth and we just pick the dark branch of our own `light-dark()` fallbacks.

This was a real bug — see [v1.2.0-rc02 in CHANGELOG.md](../../../CHANGELOG.md) for the incident.

### Contrast targets

The default palette honors **WCAG AA contrast for non-text UI (3:1)** on every interactive surface (header, body, hover, focused, selected-row, editing-cell). The Playwright suite at `<repo-root>/e2e/dark-mode.spec.ts` runs 18 assertions to keep this true; theme regressions that visual smoke tests miss surface here.

## Cascade-layer contract

`main.css` declares three cascade layers and routes every internal `@import` into the right one:

```css
@layer variables, component, overrides;

@import './variables.css'  layer(variables);
@import './base.css'       layer(component);
@import './controls.css'   layer(component);
/* … all feature files at layer(component) … */
@import './dark-mode.css'  layer(overrides);
```

Resolution order, low to high:

1. **`@layer variables`** — `:host { --wg-* }` declarations.
2. **`@layer component`** — base + feature rules (BEM selectors, table chrome, editors, etc.).
3. **`@layer overrides`** — dark-mode signals, per-instance overrides.
4. **Unlayered rules** — anything not in a layer wins over every layered rule.

### Consumer override contract

This is the key contract: **any unlayered consumer rule beats every internal rule**. You don't need `!important` to override default styling:

```css
/* Your stylesheet, no @layer wrapper */
web-grid::part(header) {
  background: linear-gradient(to bottom, #f5f5f5, #e8e8e8);
}
web-grid {
  --wg-accent-color: #10b981;            /* Variable override — wins via variables layer */
}
```

Note that **`:root` `--base-*` declarations** still win via the standard custom-property inheritance, not via cascade layers — they're inherited values, not styling rules. So both override paths work:

```css
:root      { --base-primary-color: #10b981; }   /* Theme every component */
web-grid   { --wg-accent-color: #10b981; }     /* Theme just this grid */
```

### Why this matters

Before cascade layers, overriding internal styling without `!important` was unreliable — any new internal rule could resurface and beat your override on specificity. With layers, every internal rule is now budgeted into one of three slots; consumer rules sit *above* all of them by default. The grid can grow new internal rules without breaking your overrides.

### The unlayered-reset footgun

The same rule that gives consumers a clean override path — *unlayered beats layered* — bites in the other direction when a consumer ships a **universal reset outside any layer**:

```css
/* Consumer's global stylesheet — Bootstrap reboot, Tailwind preflight, hand-rolled normalize */
* { margin: 0; padding: 0; box-sizing: border-box; }
```

Per the CSS `@layer` specification, that `*` rule is **unlayered**, so it beats *every* rule in web-grid's `@layer component` regardless of specificity. The grid's `.wg__cell { padding: var(--wg-cell-padding) }` loses to `* { padding: 0 }`, and the table renders with collapsed spacing even though every `--wg-*` variable resolved correctly.

**Fix on the consumer side:** wrap universal resets in a named layer so they're outranked by web-grid's layered defaults:

```css
@layer reset, page;

@layer reset {
  * { margin: 0; padding: 0; box-sizing: border-box; }
}

/* Intentional overrides stay unlayered — they still beat web-grid's defaults */
.my-app-header { padding: 1rem; }
```

This is the first thing to check if the grid renders with collapsed padding, missing margins, or wrong `box-sizing` despite the variables resolving to sane values.

## Dynamic styling

Two hooks for per-row / per-cell styling:

### Per-cell class via column callback

```javascript
grid.columns = [{
  field: 'salary',
  cellClass: 'salary-cell',                                              // Static class on every cell in this column
  getCellClassCallback: ({ value }) => value > 90000 ? 'high-value' : null // Dynamic class per value
}]
```

### Per-row class

```javascript
grid.getRowClassCallback = ({ row }) => row.status === 'inactive' ? 'row-inactive' : null
```

### Inject custom CSS into the shadow DOM

```javascript
grid.getCustomStylesCallback = () => `
  .high-value { background: #d1fae5 !important; }
  .row-inactive { opacity: 0.5; }
`
```

The CSS string lands inside the shadow root, so selectors target shadow-DOM nodes directly.

## Theme Designer integration

The easiest way to customize the grid's appearance is the **[KeenMate Theme Designer](https://theme-designer.keenmate.dev)**:

1. **Choose 3 base colors** — background, text, and accent.
2. **Preview changes live** — every KeenMate component on the page updates instantly.
3. **Fine-tune individual variables** — lock specific values while adjusting others.
4. **Export your theme** — copy CSS, JSON, or SCSS to your project.

The output is a list of `:root { --base-*: … }` declarations, which feed straight into web-grid's variable contract.

## See also

- [Usage / API reference](./usage.md) — `getCustomStylesCallback`, `getRowClassCallback`, `getCellClassCallback`, `labels`.
- [Examples](./examples.md) — `examples-theming.html`, `examples-custom-styling.html`.
- [`component-variables.manifest.json`](../component-variables.manifest.json) — the machine-readable variable catalog.

# Web-Grid Project Context

## Reference Implementation
Previous iteration at: `../web-grid-3`
Use this as reference for features being ported to TypeScript.

## Project Structure (Monorepo)

This is an npm workspaces monorepo with the following structure:

```
web-grid/
├── package.json              # Workspace root
├── packages/
│   └── web-grid/             # Library package (@keenmate/web-grid)
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── grid.ts       # Core WebGrid class (state, logic)
│           ├── web-component.ts  # GridElement (DOM, events, rendering)
│           ├── types.ts      # All TypeScript type definitions
│           ├── index.ts      # Main entry point
│           ├── css/          # Modular CSS files
│           └── modules/      # Feature modules
├── docs/                     # Documentation/demo site
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html            # Demo landing page
│   └── examples-*.html       # Example pages
└── Makefile                  # Workspace build commands
```

## Development Commands

- `make setup` - Install all workspace dependencies
- `make dev` - Start docs dev server with HMR
- `make build` - Build library and docs
- `make package` - Build library for publishing
- `make publish` - Publish to npm

## Technical Notes

### Scroll Container Setup

The grid supports both horizontal and vertical scrolling. Key CSS pattern:

```css
/* Host element (set by consumer) */
<web-grid style="max-width: 900px; max-height: 400px; display: block;">

/* Shadow DOM container */
.wg {
  max-height: inherit;  /* Picks up host's max-height */
  overflow: auto;       /* Single scroll container for both axes */
}

/* Table */
.wg__table {
  width: max-content;   /* Expand beyond container if columns are wide */
  min-width: 100%;      /* Fill container if columns are narrow */
  table-layout: fixed;  /* Respect explicit column widths */
}
```

**Why `max-height: inherit`?**
- `height: 100%` doesn't work when parent only has `max-height` (no explicit height)
- `max-height: inherit` passes the constraint from host into shadow DOM
- This enables vertical scrolling when content exceeds the max-height

**Why single scroll container?**
- Having separate scroll containers (host for vertical, .wg for horizontal) causes the horizontal scrollbar to only appear when you scroll to the bottom
- Single `.wg` container with `overflow: auto` shows both scrollbars at correct positions

### Sticky Headers

Headers remain visible at the top when scrolling vertically:

```css
.wg__header {
  position: sticky;
  top: 0;
  z-index: 1;  /* Stay above body cells */
  background: var(--wg-header-background);  /* Must be opaque */
}
```

**Why this works:**
- `position: sticky` with `top: 0` pins the element to the top of its scroll container
- The `.wg` container's `overflow: auto` creates the scroll context needed for sticky positioning
- `z-index: 1` ensures headers stay above body cells when scrolling
- Opaque background is essential - otherwise body content shows through the header

**Border placement is critical:**
- The border must be on `.wg` container, NOT on `.wg__table`
- With `border-collapse: collapse`, a table border sits outside/above the header cells
- This creates a gap where content scrolls through when headers stick at `top: 0`
- Moving border to container eliminates the gap

### CSS Variable Architecture: `--base-*` Integration

The `--base-*` CSS variables enable **centralized theming** across all KeenMate components via `@keenmate/theme-designer`.

**Pattern - fallback chain:**
```css
:host {
  /* If --base-accent-color is set on :root by theme-designer, use it */
  /* Otherwise, use hardcoded fallback */
  --wg-accent-color: var(--base-accent-color, #0078d4);
  --wg-font-size-sm: calc(var(--base-font-size-sm, 1.2) * var(--wg-rem));
}
```

**Variables that support `--base-*` fallback:**
- **Typography:** `--base-font-family`, `--base-font-size-*`, `--base-font-weight-*`, `--base-line-height-*`
- **Colors:** `--base-accent-color`, `--base-text-color-*`, `--base-main-bg`, `--base-elevated-bg`, `--base-hover-bg`, `--base-active-bg`, `--base-disabled-bg`, `--base-dropdown-bg`, `--base-inverse-bg`, `--base-border-color`, `--base-input-*`, `--base-danger-*`, `--base-tooltip-*`
- **Other:** `--base-border-radius-*`

**Benefits:**
1. All KeenMate components (web-multiselect, web-daterangepicker, web-grid) share the same base theme
2. Change `:root { --base-accent-color: red }` and all components update
3. Components work standalone with defaults, but integrate with theme-designer when present

### CSS Variable Naming: Component-Specific Variables

When creating new CSS variables, use **component-specific names** that describe their purpose, NOT generic spacing variables directly.

**Wrong - generic variable in styles:**
```css
/* DON'T do this */
.wg__combobox-arrow {
  right: var(--wg-spacing-md);  /* Too generic, unclear purpose */
}
```

**Correct - component-specific variable:**
```css
/* In _variables.css */
:host {
  --wg-dropdown-toggle-right: var(--wg-spacing-md);
}

/* In _base.css */
.wg__combobox-arrow {
  right: var(--wg-dropdown-toggle-right);  /* Clear purpose, easy to adjust */
}
```

**Why this pattern:**
1. **Self-documenting** - variable name explains what it controls
2. **Targeted overrides** - consumers can adjust specific things without affecting others
3. **Consistent with web-multiselect** - see `../web-multiselect/src/css/_variables.css` for reference
4. **Single point of change** - if dropdown toggle needs different spacing, change one variable

**Naming convention:** `--wg-{component}-{property}`
- `--wg-dropdown-toggle-right` - right position of dropdown toggle
- `--wg-toolbar-btn-min-width` - minimum width of toolbar buttons
- `--wg-filter-input-padding` - padding inside filter inputs

### UI Transitions: Keep It Snappy

Prefer **instant state changes** over CSS transitions for UI elements. Snappy feedback feels more responsive.

**Don't add transitions for:**
- Dropdown toggle appearing/disappearing on hover
- Focus/hover state changes
- Cell state changes (editing, focused, etc.)

**Exception:** Pagination buttons have a subtle transition for hover effects, but this is optional.

If in doubt, no transition is better than a slow one.

### Naming Convention: Events vs Callbacks

Use distinct naming patterns to differentiate between events (fire-and-forget notifications) and callbacks (return value affects behavior).

**Events** - `on*` lowercase, handler return value is ignored:
```typescript
// Grid-level events
onrowchange        // "row changed" notification
onroweditstart     // "editing started" notification
onvalidationerror  // "validation failed" notification

// EditorOptions events
onselect           // "option was selected" notification

// Toolbar/ContextMenu item events
onclick            // "item was clicked" notification
```

**Callbacks** - `*Callback` suffix, return value affects component behavior:
```typescript
// Column callbacks
formatCallback        // returns display string
tooltipCallback       // returns tooltip text
validateCallback      // returns error message → blocks commit
beforeCommitCallback  // returns ValidationResult → can block/transform
cellEditCallback      // takes over cell editing

// EditorOptions callbacks
getDisplayCallback    // returns display text for option
onSearchCallback      // returns search results (async)
renderOptionCallback  // returns HTML string for option
```

**Why this matters:**
- Events can be safely ignored - component works without them
- Callbacks affect behavior - component depends on return value
- Clear naming prevents confusion about whether return value matters

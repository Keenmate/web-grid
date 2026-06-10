# Z-Index Layer System

All z-index values within the grid are defined as CSS custom properties in `variables.css`. This makes the stacking order explicit, predictable, and overridable by consumers.

## Layer Map

### Table-internal layers (within scroll container)

These layers control stacking of elements inside the grid's scroll container. They must be carefully ordered so that sticky elements (headers, frozen columns) properly cover scrolling content.

| Layer | Variable | Default | Elements |
|-------|----------|---------|----------|
| Cell highlight | `--wg-z-cell-highlight` | 1 | `.wg__cell--in-range`, `.wg__cell--editing` |
| Selection border | `--wg-z-selection-border` | 1 | `.wg__cell-range-border`, `.wg__row-selection-border`, `.wg__column-selection-border` |
| Frozen columns | `--wg-z-frozen` | 2 | `.wg__cell--frozen`, `.wg__row-number.wg__cell--frozen` |
| Header | `--wg-z-header` | 3 | `.wg__header` (sticky), `th.wg__filler` |
| Frozen header | `--wg-z-frozen-header` | 4 | `.wg__header--frozen`, `.wg__row-number-header.wg__header--frozen` (corner cell) |
| Fill handle area | `--wg-z-fill-handle-area` | 4 | `.wg__fill-range` |
| Fill handle | `--wg-z-fill-handle` | 5 | `.wg__fill-handle` |
| Resize handle | `--wg-z-resize-handle` | 6 | `.wg__resize-handle` |
| Shortcuts help | `--wg-z-shortcuts-help` | 10 | `.wg__shortcuts-help` |

### Popover layers (above grid content)

These are floating elements positioned outside the normal table flow.

| Layer | Variable | Default | Elements |
|-------|----------|---------|----------|
| Reorder indicator | `--wg-z-reorder-indicator` | 100 | `.wg__drop-indicator` |
| Toolbar | `--wg-z-toolbar` | 1000 | `.wg__toolbar-container` |
| Context menu | `--wg-z-context-menu` | 1001 | Context menu |
| Dropdown | `--wg-z-dropdown` | 9999 | Dropdown popover |
| Reorder ghost | `--wg-z-reorder-ghost` | 10000 | `.wg__reorder-ghost` |
| Tooltip | `--wg-z-tooltip` | 10000 | `.wg__tooltip` |

## Key Constraints

The ordering encodes these requirements:

1. **Selected cells must scroll under headers.** `--wg-z-cell-highlight` (1) < `--wg-z-header` (3). Without this, the blue cell selection background bleeds through the sticky header row.

2. **Frozen columns must cover scrolling body cells.** `--wg-z-frozen` (2) > `--wg-z-cell-highlight` (1). Frozen columns use `position: sticky` and need to paint above normal cells, including highlighted ones.

3. **Headers must cover frozen body cells.** `--wg-z-header` (3) > `--wg-z-frozen` (2). When scrolling vertically, body cells (even frozen ones) must slide under the header.

4. **Frozen headers must cover non-frozen headers.** `--wg-z-frozen-header` (4) > `--wg-z-header` (3). When scrolling horizontally, non-frozen headers slide behind frozen header cells.

5. **Selection borders scroll behind frozen columns.** `--wg-z-selection-border` (1) < `--wg-z-frozen` (2). The range/row/column selection borders are `position: absolute` elements that should not bleed over frozen columns.

6. **Fill handle sits above everything in the table area** but below popovers. It needs to be clickable/draggable on top of any cell content.

## Overriding

Consumers can override any layer via CSS custom properties on the `<web-grid>` element:

```css
web-grid {
  --wg-z-header: 5;
  --wg-z-frozen-header: 6;
}
```

Be careful when overriding — changing one layer may require adjusting others to maintain the constraints above.

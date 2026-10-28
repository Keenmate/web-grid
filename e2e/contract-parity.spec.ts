import { test, expect } from './fixtures';
// @ts-expect-error — plain ESM helper shipped by the contract package (no .d.ts)
import { contractParity } from '@keenmate/base-css-variables/testing/parity';

/**
 * The grid looks the same with and without @keenmate/base-css-variables.
 *
 * Renders docs/test/contract-parity.html standalone and with the contract injected, in light
 * and dark, and compares every color-valued --wg-* token. A second pass sets a different
 * accent (--wg-accent-color standalone vs --base-primary-color with the contract): the derived
 * fallbacks are the contract's formulas on --wg-accent-color, so they follow.
 * The static side of the same rule is `npm run check:contract -w @keenmate/web-grid`.
 */
test('standalone colors match the contract (light + dark, default + custom accent)', async ({ page }) => {
    const diffs = await contractParity(page, {
        url: '/test/contract-parity.html',
        selector: '#parity',
        prefix: 'wg',
        accentToken: '--wg-accent-color',
    });
    expect(diffs).toEqual([]);
});

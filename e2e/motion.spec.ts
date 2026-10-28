import { test, expect } from './fixtures';

/**
 * Motion and disabled dimming follow @keenmate/base-css-variables (the page here loads no
 * contract, so the fallbacks show): the contract's speeds, 0s under reduced motion or when the
 * page sets --base-duration-*: 0s, and one disabled fade.
 */
const read = (page: import('@playwright/test').Page) => page.evaluate(() => {
    const grid = document.querySelector('#parity')!;
    const cs = getComputedStyle(grid);
    const v = (n: string) => cs.getPropertyValue(n).trim();
    return {
        fast: v('--wg-transition-fast'), normal: v('--wg-transition-normal'),
        pulse: v('--wg-loading-pulse-duration'), disabled: v('--wg-disabled-opacity'),
        pagination: v('--wg-pagination-btn-disabled-opacity'),
    };
});

test('durations are the contract speeds; disabled fade is 0.65', async ({ page }) => {
    await page.goto('/test/contract-parity.html');
    await page.locator('#parity').waitFor();
    expect(await read(page)).toEqual({ fast: '0.1s', normal: '0.15s', pulse: '1s', disabled: '0.65', pagination: '0.65' });
});

test('reduced motion turns every duration off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/test/contract-parity.html');
    await page.locator('#parity').waitFor();
    const r = await read(page);
    expect([r.fast, r.normal, r.pulse]).toEqual(['0s', '0s', '0s']);
});

test('--base-duration-*: 0s on the page turns grid motion off', async ({ page }) => {
    await page.goto('/test/contract-parity.html');
    await page.locator('#parity').waitFor();
    await page.evaluate(() => {
        for (const d of ['fast', 'normal']) document.documentElement.style.setProperty(`--base-duration-${d}`, '0s');
    });
    const r = await read(page);
    expect([r.fast, r.normal]).toEqual(['0s', '0s']);
});

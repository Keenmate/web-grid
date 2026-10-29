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
        loader: v('--wg-loader-duration'), disabled: v('--wg-disabled-opacity'),
        pagination: v('--wg-pagination-btn-disabled-opacity'),
    };
});

test('durations are the contract speeds; disabled fade is 0.65', async ({ page }) => {
    await page.goto('/test/contract-parity.html');
    await page.locator('#parity').waitFor();
    expect(await read(page)).toEqual({ fast: '0.1s', normal: '0.15s', loader: '0.8s', disabled: '0.65', pagination: '0.65' });
});

test('reduced motion turns every duration off; the loader slows', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/test/contract-parity.html');
    await page.locator('#parity').waitFor();
    const r = await read(page);
    expect([r.fast, r.normal]).toEqual(['0s', '0s']);
    // The loader slows instead of stopping
    expect(r.loader).toBe('1.5s');
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

const rollingScroll = async (page: import('@playwright/test').Page) => {
    await page.goto('/test/datepicker.html');
    const grid = page.locator('web-grid#grid');
    await grid.locator('.wg__cell[data-row="0"][data-col="2"]').click();
    await page.keyboard.press('F2');
    await page.locator('.wg-datepicker').waitFor();
    return page.locator('.wg-datepicker__rolling-list').first().evaluate((el) => getComputedStyle(el).scrollBehavior);
};

test('datepicker rolling lists scroll smoothly (--base-scroll-behavior)', async ({ page }) => {
    expect(await rollingScroll(page)).toBe('smooth');
});

test('reduced motion makes the datepicker rolling lists scroll instantly', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await rollingScroll(page)).toBe('auto');
});

import { definePlaywrightConfig, devices } from '@keenmate/web-components-devkit/playwright';

/**
 * Playwright config for end-to-end tests.
 *
 * Specs live in e2e/ and target dedicated fixture pages under test/*.html (never the
 * example pages). baseURL and the `npm run dev` web server come from
 * package.json#kmwc.ports.dev (the devkit preset), so the port can't drift from the
 * Vite config or the Makefile.
 *
 * Every spec runs in chromium, firefox and webkit (rulebook). Platform limits are
 * skipped per spec with the reason (clipboard-read only in Chromium, no isMobile in
 * Firefox). WebKit on Windows can hang a combined run at teardown — run it on its own
 * (`--project=webkit`).
 *
 *   npm run test:e2e:install   # one-time: download chromium, firefox and webkit
 *   npm run test:e2e           # headless run
 *   npm run test:e2e:ui        # Playwright Test UI (debugging)
 *   npm run test:e2e:headed    # watch the browser do its thing
 */
// Larger than the default 1280x720 so context menus that open near a cell at the bottom
// of the grid still fit in the viewport without flipping far enough to confuse
// Playwright's scroll-into-view checks.
const viewport = { width: 1440, height: 1024 };

export default definePlaywrightConfig({
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'], viewport } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'], viewport } },
	],
});

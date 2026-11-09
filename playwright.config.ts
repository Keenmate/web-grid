import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for end-to-end tests against the docs demo site.
 *
 * The docs dev server runs on port 12400 (see docs/vite.config.ts). Playwright
 * spins it up automatically before tests and reuses an already-running server
 * if one is detected (so `npm run dev` in another terminal doesn't conflict).
 *
 * Run:
 *   npm run test:e2e:install   # one-time: download chromium browser binary
 *   npm run test:e2e           # headless run
 *   npm run test:e2e:ui        # Playwright Test UI (debugging)
 *   npm run test:e2e:headed    # watch the browser do its thing
 */
export default defineConfig({
	testDir: './e2e',
	timeout: 30_000,
	expect: { timeout: 5_000 },

	// Fail fast in CI; permissive locally.
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,

	reporter: process.env.CI ? 'github' : 'list',

	use: {
		baseURL: 'http://localhost:12400',
		// Capture trace on first retry — small overhead in passing runs, big debugging
		// value when something breaks. View with `npx playwright show-trace`.
		trace: 'on-first-retry',
		// Screenshots only on failure, kept in test-results/.
		screenshot: 'only-on-failure',
		video: 'retain-on-failure'
	},

	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				// Larger than default 1280x720 so context menus that open near a cell
				// at the bottom of the grid still fit in the viewport without flipping
				// far enough to confuse Playwright's scroll-into-view checks.
				viewport: { width: 1440, height: 1024 }
			}
		},
		// Cross-browser (rulebook: e2e in chromium + firefox + webkit). Platform limits are
		// skipped per spec with the reason (clipboard-read only in Chromium, no isMobile in
		// Firefox). WebKit on Windows can hang a combined run at teardown — run it on its own.
		{ name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 1024 } } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1024 } } }
	],

	// Auto-start the docs dev server. `reuseExistingServer: true` means an
	// already-running `npm run dev` is fine — Playwright won't try to start a
	// second one. Useful when iterating: keep dev server up, run tests against it.
	webServer: {
		command: 'npm run dev -w docs',
		url: 'http://localhost:12400',
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
		stdout: 'ignore',
		stderr: 'pipe'
	}
})

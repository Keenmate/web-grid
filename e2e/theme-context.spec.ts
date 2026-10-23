import { test, expect, type Page } from '@playwright/test'

/**
 * Dark / light via @keenmate/web-components-core's theme context: core detects the
 * page signal (data-theme, data-bs-theme, .dark / .light on <html> then <body>) and
 * mirrors it onto the host as data-context-theme, which dark-mode.css turns into
 * `color-scheme`. No :host-context(), so this holds in Firefox and WebKit too.
 * With no signal the host inherits the page's color-scheme — there is deliberately
 * no prefers-color-scheme rule (same as web-multiselect / web-treeview).
 */

const PAGE = '/test/basic.html'
const HOSTS = ['web-grid']

const scheme = (page: Page, sel: string) =>
	page.locator(sel).first().evaluate((el) => getComputedStyle(el).colorScheme)

async function open(page: Page) {
	await page.goto(PAGE)
	await page.locator(HOSTS[0]).first().waitFor({ state: 'attached' })
}

test('no page signal + OS dark → inherits the page (normal), no data-context-theme', async ({ browser }) => {
	const context = await browser.newContext({ colorScheme: 'dark' })
	const page = await context.newPage()
	await open(page)
	for (const sel of HOSTS) {
		await expect(page.locator(sel).first()).not.toHaveAttribute('data-context-theme', /./)
		expect(await scheme(page, sel)).toBe('normal')
	}
	await context.close()
})

const SIGNALS: [string, string][] = [
	['data-theme="dark"', "document.documentElement.setAttribute('data-theme', 'dark')"],
	['data-bs-theme="dark"', "document.documentElement.setAttribute('data-bs-theme', 'dark')"],
	['class="dark"', "document.documentElement.classList.add('dark')"],
]
for (const [label, script] of SIGNALS) {
	test(`<html ${label}> → dark`, async ({ page }) => {
		await open(page)
		await page.evaluate(script)
		for (const sel of HOSTS) {
			await expect(page.locator(sel).first()).toHaveAttribute('data-context-theme', 'dark')
			await expect.poll(() => scheme(page, sel)).toBe('dark')
		}
	})
}

test('a light page signal beats an OS set to dark', async ({ browser }) => {
	const context = await browser.newContext({ colorScheme: 'dark' })
	const page = await context.newPage()
	await open(page)
	await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
	for (const sel of HOSTS) await expect.poll(() => scheme(page, sel)).toBe('light')
	await context.close()
})

test('per-instance data-theme="light" wins over a dark page', async ({ page }) => {
	await open(page)
	await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
	await page.locator(HOSTS[0]).first().evaluate((el) => el.setAttribute('data-theme', 'light'))
	await expect.poll(() => scheme(page, HOSTS[0])).toBe('light')
})

test('switching the page back to light follows live', async ({ page }) => {
	await open(page)
	await page.evaluate(() => document.documentElement.classList.add('dark'))
	await expect.poll(() => scheme(page, HOSTS[0])).toBe('dark')
	await page.evaluate(() => {
		document.documentElement.classList.replace('dark', 'light')
	})
	await expect.poll(() => scheme(page, HOSTS[0])).toBe('light')
})

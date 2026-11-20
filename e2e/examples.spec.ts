import { test, expect, type Page } from './fixtures'

/**
 * Example-page smoke (the one spec allowed to open an `examples-*.html` page): the shared
 * localization page loads without console errors and every toggle changes the shown text.
 */

const readout = (page: Page, id: string) => page.locator(`#${id}`)

/** Toggle `inputId` and expect the `readoutId` text to change. */
async function expectToggleChanges(page: Page, inputId: string, readoutId: string) {
	const before = (await readout(page, readoutId).textContent()) ?? ''
	await page.locator(`#${inputId}`).click()
	await expect(readout(page, readoutId)).not.toHaveText(before)
}

test.describe('examples-localization.html', () => {
	test('loads clean; every toggle changes the shown text', async ({ page }) => {
		const consoleErrors: string[] = []
		page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
		await page.goto('/examples-localization.html')
		await expect(readout(page, 'lo01-readout')).toContainText('pager info')
		await expect(readout(page, 'lo04-readout')).toContainText('aria-label')

		// LO01 · instance labels
		await expectToggleChanges(page, 'lo01-short', 'lo01-readout')
		await expect(readout(page, 'lo01-readout')).toContainText('rows per page')
		await expectToggleChanges(page, 'lo01-full', 'lo01-readout')
		await expect(readout(page, 'lo01-readout')).toContainText('23 records')

		// LO02 · page-wide dictionary — both grids
		await expectToggleChanges(page, 'lo02-dictionary', 'lo02-readout')
		await expect(readout(page, 'lo02-readout')).toContainText('Strana 1 z 4')
		await expect(readout(page, 'lo02-readout')).toContainText('položek')
		await page.locator('#lo02-dictionary').click()

		// LO03 · own callback first, page callback for the rest, instance labels win
		await expect(readout(page, 'lo03-readout')).toContainText('Seite 1 von 9')
		await expectToggleChanges(page, 'lo03-page', 'lo03-readout')
		await expect(readout(page, 'lo03-readout')).toContainText('Seite 1 von 9')
		await expect(readout(page, 'lo03-readout')).toContainText('42 položek')
		await expect(readout(page, 'lo03-readout')).toContainText('/ page (instance labels)')
		await expectToggleChanges(page, 'lo03-own', 'lo03-readout')
		await expect(readout(page, 'lo03-readout')).toContainText('Strana 1 z 9')
		await page.locator('#lo03-page').click()

		// LO04 · aria-labels follow the translated captions; an explicit one wins
		await expect(readout(page, 'lo04-readout')).toContainText('aria-label "First page"')
		await expectToggleChanges(page, 'lo04-captions', 'lo04-readout')
		await expect(readout(page, 'lo04-readout')).toContainText('aria-label "« První"')
		await expectToggleChanges(page, 'lo04-explicit', 'lo04-readout')
		await expect(readout(page, 'lo04-readout')).toContainText('aria-label "Přejít na další stránku"')

		// LO05 · page locale → pager count + Intl columns; the raw / pattern cells stay
		await page.locator('input[name="lo05-locale"][value="en-US"]').check()
		await expect(readout(page, 'lo05-readout')).toContainText('1,234 items')
		await expect(readout(page, 'lo05-readout')).toContainText('1234567.891')
		const enText = await readout(page, 'lo05-readout').textContent()
		await page.locator('input[name="lo05-locale"][value="cs-CZ"]').check()
		await expect(readout(page, 'lo05-readout')).not.toHaveText(enText ?? '')
		await expect(readout(page, 'lo05-readout')).toContainText('resolveLocale()  cs-CZ')
		await expect(readout(page, 'lo05-readout')).toContainText('01.01.2026')

		// LO06 · off: content labels render their markup; the switch escapes the whole label
		await expect(readout(page, 'lo06-readout')).toContainText('Nothing <b>here</b> yet')
		await expect(readout(page, 'lo06-readout')).toContainText('Page <b>1</b> of 3')
		await expectToggleChanges(page, 'lo06-escape', 'lo06-readout')
		await expect(readout(page, 'lo06-readout')).toContainText('Nothing &lt;b&gt;here&lt;/b&gt; yet')
		await expect(readout(page, 'lo06-readout')).toContainText('Page &lt;b&gt;1&lt;/b&gt; of 3')
		await expect(page.locator('#lo06-state')).toContainText('shouldEscapeLabels')

		expect(consoleErrors).toEqual([])
	})
})

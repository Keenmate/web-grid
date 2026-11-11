import { test, expect, gridLocator, onGrid } from './fixtures'

/**
 * Properties assigned before `<web-grid>` is defined (core rc20 rescue): the grid's own
 * `columns` / `items` accessors and the `pageSize` input are applied at upgrade, the
 * accessors are no longer shadowed by an own data property, and later writes work.
 *
 * Fixture: test/pre-upgrade.html (a classic script sets them before the module loads).
 */

test.beforeEach(async ({ page }) => {
	await page.goto('/test/pre-upgrade.html')
	await expect(gridLocator(page).locator('tbody tr').first()).toBeVisible()
})

test('early columns / items / pageSize are applied at upgrade', async ({ page }) => {
	await expect(gridLocator(page).locator('tbody tr')).toHaveCount(5)
	await expect(gridLocator(page).locator('tbody tr').first()).toContainText('Early 1')
	expect(await onGrid(page, (el: any) => [el.items.length, el.columns.length, el.pageSize, el.totalPages])).toEqual([12, 2, 5, 3])
})

test('no own data property is left; a later write goes through the setter', async ({ page }) => {
	expect(await onGrid(page, (el: any) => ['items', 'columns'].filter(k => Object.prototype.hasOwnProperty.call(el, k)))).toEqual([])
	await onGrid(page, (el: any) => { el.items = [{ id: 99, name: 'Later' }] })
	await expect(gridLocator(page).locator('tbody tr')).toHaveCount(1)
	await expect(gridLocator(page).locator('tbody tr').first()).toContainText('Later')
})

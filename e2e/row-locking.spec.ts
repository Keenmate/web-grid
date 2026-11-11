import { test, expect, type Page, gridLocator, cell, onGrid, domEvents, eventsOf, clearEvents, waitForRows, editorIn } from './fixtures'

/**
 * Row locking — `rowLocking` sources (`getLockInfoCallback`, `getIsLockedCallback`,
 * `isLockedMember`, `lockInfoMember`), external locks (`lockRowById` /
 * `unlockRowById` / `isRowLocked` / `getRowLockInfo` / `clearExternalLocks`),
 * `row-lock-change`, `lockedEditBehavior` + `getCanEditLockedCallback`, F2 / paste
 * blocked, the lock marker + tooltip.
 *
 * Fixture: test/row-locking.html — Alpha/Beta/Gamma/Delta (id 1-4); Beta is
 * locked by "Carol" through getLockInfoCallback. Columns 0=id, 1=name, 2=qty.
 */

const PAGE = '/test/row-locking.html'
const NAME = 1

const rowNumber = (page: Page, r: number) => gridLocator(page).locator(`.wg__row-number[data-row-number="${r}"]`)
const row = (page: Page, r: number) => gridLocator(page).locator(`tr[data-row-index="${r}"]`)

async function pressF2On(page: Page, r: number, c: number) {
	await cell(page, r, c).click()
	await page.keyboard.press('F2')
}

async function pasteText(page: Page, text: string) {
	await gridLocator(page).evaluate(async (el, txt) => {
		const dt = new DataTransfer()
		dt.setData('text', txt)
		const event = new Event('paste', { bubbles: true, cancelable: true })
		Object.defineProperty(event, 'clipboardData', { value: dt })
		el.dispatchEvent(event)
		await new Promise(r => setTimeout(r, 100))
	}, text)
}

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await waitForRows(page)
	await clearEvents(page, 'row-locking')
})

test.describe('lock sources', () => {
	test('getLockInfoCallback locks a row: lock icon, locked row class, tooltip names the locker', async ({ page }) => {
		await expect(row(page, 1)).toHaveClass(/wg__row--locked/)
		await expect(row(page, 0)).not.toHaveClass(/wg__row--locked/)
		await expect(rowNumber(page, 1)).toHaveClass(/wg__row-number--locked/)
		await expect(rowNumber(page, 1)).toHaveText('🔒')
		await expect(rowNumber(page, 1)).toHaveAttribute('data-tooltip', 'Locked by Carol')
		expect(await onGrid(page, el => [el.isRowLocked(2), el.isRowLocked(1), el.getRowLockInfo(2)]))
			.toEqual([true, false, { isLocked: true, lockedBy: 'Carol', reason: 'review' }])
	})

	test('getIsLockedCallback / isLockedMember / lockInfoMember are honoured', async ({ page }) => {
		const locked = await onGrid(page, el => {
			const out: Record<string, boolean[]> = {}
			const items = el.items
			el.rowLocking = { getIsLockedCallback: ({ row }: any) => row.qty >= 30 }
			out.isLockedCallback = items.map((r: any) => el.isRowLocked(r))
			el.items = items.map((r: any) => ({ ...r, flag: r.id === 4 }))
			el.rowLocking = { isLockedMember: 'flag' }
			out.isLockedMember = el.items.map((r: any) => el.isRowLocked(r))
			el.items = el.items.map((r: any) => ({ ...r, info: r.id === 1 ? { isLocked: true, lockedBy: 'Dan' } : { isLocked: false } }))
			el.rowLocking = { lockInfoMember: 'info' }
			out.lockInfoMember = el.items.map((r: any) => el.isRowLocked(r))
			return out
		})
		expect(locked).toEqual({
			isLockedCallback: [false, false, true, true],
			isLockedMember: [false, false, false, true],
			lockInfoMember: [true, false, false, false]
		})
		await expect(rowNumber(page, 0)).toHaveAttribute('data-tooltip', 'Locked by Dan')
	})

	test('a lock without lockedBy shows the generic tooltip', async ({ page }) => {
		await onGrid(page, el => el.lockRowById(3))
		await expect(rowNumber(page, 2)).toHaveAttribute('data-tooltip', 'This row is locked')
	})

	test('without row numbers the tooltip moves to the row', async ({ page }) => {
		await onGrid(page, el => { el.isRowNumbersShown = false })
		await expect(row(page, 1)).toHaveAttribute('data-tooltip', 'Locked by Carol')
		await expect(row(page, 0)).not.toHaveAttribute('data-tooltip', /./)
	})

	test('the lock tooltip text is translatable through labels', async ({ page }) => {
		await onGrid(page, el => { el.labels = { rowLocked: 'Řádek je zamčen', rowLockedBy: 'Zamkl(a) {lockedBy}' } })
		await expect(rowNumber(page, 1)).toHaveAttribute('data-tooltip', 'Zamkl(a) Carol', { timeout: 2000 })
	})
})

test.describe('external locks', () => {
	test('lockRowById locks + marks the row and fires row-lock-change (source external)', async ({ page }) => {
		const ok = await onGrid(page, el => el.lockRowById(3, { lockedBy: 'Eve', reason: 'sync' }))
		expect(ok).toBe(true)
		await expect(rowNumber(page, 2)).toHaveAttribute('data-tooltip', 'Locked by Eve')
		const ev = await domEvents(page, 'row-lock-change')
		expect(ev).toHaveLength(1)
		expect(ev[0]).toMatchObject({
			rowId: 3, rowIndex: 2, source: 'external',
			row: { id: 3, name: 'Gamma' },
			lockInfo: { isLocked: true, lockedBy: 'Eve', reason: 'sync' }
		})
		expect(typeof ev[0].lockInfo.lockedAt).toBe('string')  // a Date (serialized) defaulted in
		expect((await eventsOf(page, 'row-lock-change')).map(e => e.via)).toEqual(['twin', 'event'])
		expect(await onGrid(page, el => [el.isRowLocked(3), el.getExternalLocks().size])).toEqual([true, 1])
	})

	test('an external lock wins over the row sources', async ({ page }) => {
		await onGrid(page, el => el.lockRowById(2, { lockedBy: 'Server' }))
		await expect(rowNumber(page, 1)).toHaveAttribute('data-tooltip', 'Locked by Server')
	})

	test('unlockRowById unlocks, fires lockInfo:null; unlocking an unlocked id is a no-op (false, no event)', async ({ page }) => {
		await onGrid(page, el => el.lockRowById(4))
		await clearEvents(page, 'row-locking')
		expect(await onGrid(page, el => el.unlockRowById(4))).toBe(true)
		await expect(rowNumber(page, 3)).not.toHaveClass(/wg__row-number--locked/)
		expect(await domEvents(page, 'row-lock-change')).toEqual([
			expect.objectContaining({ rowId: 4, rowIndex: 3, lockInfo: null, source: 'external' })
		])
		await clearEvents(page, 'row-locking')
		expect(await onGrid(page, el => el.unlockRowById(4))).toBe(false)
		expect(await domEvents(page, 'row-lock-change')).toEqual([])
	})

	test('unlockRowById does not lift a lock that comes from rowLocking', async ({ page }) => {
		expect(await onGrid(page, el => el.unlockRowById(2))).toBe(false)
		expect(await onGrid(page, el => el.isRowLocked(2))).toBe(true)
	})

	test('clearExternalLocks drops every external lock', async ({ page }) => {
		await onGrid(page, el => { el.lockRowById(1); el.lockRowById(3) })
		await onGrid(page, el => el.clearExternalLocks())
		expect(await onGrid(page, el => [el.isRowLocked(1), el.isRowLocked(3), el.getExternalLocks().size])).toEqual([false, false, 0])
		await expect(gridLocator(page).locator('.wg__row-number--locked')).toHaveCount(1)  // Beta (callback) stays
	})

	test('locking the row being edited cancels the edit', async ({ page }) => {
		await pressF2On(page, 2, NAME)
		await expect(editorIn(cell(page, 2, NAME))).toBeVisible()
		await onGrid(page, el => el.lockRowById(3))
		await expect(editorIn(cell(page, 2, NAME))).toHaveCount(0)
		expect(await onGrid(page, el => el.isRowDirty(2) && el.isCellDirty(2, 'name'))).toBe(false)
	})
})

test.describe('editing a locked row', () => {
	test("default 'block': F2 does not open an editor, no cell-edit-start; canEditCell is false", async ({ page }) => {
		await pressF2On(page, 1, NAME)
		await expect(editorIn(cell(page, 1, NAME))).toHaveCount(0)
		expect(await domEvents(page, 'cell-edit-start')).toEqual([])
		expect(await onGrid(page, el => [el.canEditCell(1, 'name'), el.canEditCell(0, 'name')])).toEqual([false, true])
	})

	test("'block': typing on a locked cell does not start editing", async ({ page }) => {
		await cell(page, 1, NAME).click()
		await page.keyboard.press('x')
		await expect(editorIn(cell(page, 1, NAME))).toHaveCount(0)
	})

	test('paste skips locked rows (skipReason: locked)', async ({ page }) => {
		await cell(page, 0, NAME).click()
		await pasteText(page, 'A2\nB2\nG2')
		await expect(cell(page, 0, NAME)).toHaveText('A2')
		await expect(cell(page, 1, NAME)).toHaveText('Beta')
		await expect(cell(page, 2, NAME)).toHaveText('G2')
		const done = await domEvents(page, 'cell-paste')
		expect(done).toHaveLength(1)
		expect(done[0].skippedCells).toBe(1)
		expect(done[0].cellResults.find((c: any) => c.rowIndex === 1)).toMatchObject({ wasSkipped: true, skipReason: 'locked' })
	})

	test("lockedEditBehavior 'allow' edits a locked row (the marker stays)", async ({ page }) => {
		await onGrid(page, el => { el.rowLocking = { ...el.rowLocking, lockedEditBehavior: 'allow' } })
		await pressF2On(page, 1, NAME)
		await expect(editorIn(cell(page, 1, NAME))).toBeVisible()
		await expect(rowNumber(page, 1)).toHaveClass(/wg__row-number--locked/)
	})

	test("lockedEditBehavior 'callback': getCanEditLockedCallback decides, gets { row, rowIndex, lockInfo }", async ({ page }) => {
		await onGrid(page, el => {
			el.lockRowById(3, { lockedBy: 'Me' })
			el.rowLocking = {
				...el.rowLocking,
				lockedEditBehavior: 'callback',
				getCanEditLockedCallback: (ctx: any) => {
					;(window as any).lockCtxs.push({ id: ctx.row.id, rowIndex: ctx.rowIndex, lockedBy: ctx.lockInfo.lockedBy, hasController: !!ctx.controller })
					return ctx.lockInfo.lockedBy === 'Me'
				}
			}
		})
		await pressF2On(page, 1, NAME)  // Carol's lock → refused
		await expect(editorIn(cell(page, 1, NAME))).toHaveCount(0)
		await page.keyboard.press('Escape')
		await pressF2On(page, 2, NAME)  // my lock → allowed
		await expect(editorIn(cell(page, 2, NAME))).toBeVisible()
		const ctxs = await page.evaluate(() => (window as any).lockCtxs)
		expect(ctxs).toContainEqual({ id: 2, rowIndex: 1, lockedBy: 'Carol', hasController: true })
		expect(ctxs).toContainEqual({ id: 3, rowIndex: 2, lockedBy: 'Me', hasController: true })
	})

	test("'callback' without a callback blocks", async ({ page }) => {
		await onGrid(page, el => { el.rowLocking = { ...el.rowLocking, lockedEditBehavior: 'callback' } })
		expect(await onGrid(page, el => el.canEditCell(1, 'name'))).toBe(false)
	})
})

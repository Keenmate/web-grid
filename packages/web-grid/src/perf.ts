// Lightweight perf instrumentation, intentionally always-on while we
// chase the tree-toggle slowness. Remove (or gate behind a flag) once
// the hot path is identified.

export const gridPerf = {
	counters: {
		displayItems: 0,
		displayItemsMs: 0,
		paginatedItems: 0,
		paginatedItemsMs: 0,
		treeSorted: 0,
		treeSortedMs: 0,
		treeVisible: 0,
		treeVisibleMs: 0,
		cellDisplayItemsLookup: 0
	},
	reset(): void {
		const c = this.counters
		c.displayItems = 0
		c.displayItemsMs = 0
		c.paginatedItems = 0
		c.paginatedItemsMs = 0
		c.treeSorted = 0
		c.treeSortedMs = 0
		c.treeVisible = 0
		c.treeVisibleMs = 0
		c.cellDisplayItemsLookup = 0
	},
	summary(): string {
		const c = this.counters
		return [
			`displayItems=${c.displayItems} (${c.displayItemsMs.toFixed(1)}ms)`,
			`paginatedItems=${c.paginatedItems} (${c.paginatedItemsMs.toFixed(1)}ms)`,
			`treeSorted=${c.treeSorted} (${c.treeSortedMs.toFixed(1)}ms)`,
			`treeVisible=${c.treeVisible} (${c.treeVisibleMs.toFixed(1)}ms)`,
			`cellDisplayItemsLookup=${c.cellDisplayItemsLookup}`
		].join(' | ')
	}
}

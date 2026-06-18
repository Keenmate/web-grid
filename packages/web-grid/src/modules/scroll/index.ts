// =============================================================================
// Scroll Module - Re-exports
// =============================================================================

export {
	calculateVisibleRange,
	calculateScrollToRow,
	shouldTriggerInfiniteScroll,
	type VisibleRangeParams,
	type VisibleRange,
	type ScrollToRowParams,
	type ScrollToRowResult
} from './calculations.js'

export { VirtualScrollService } from './virtual-scroll-service.js'

export {
	handleVirtualScroll,
	renderVirtualRows,
	handleInfiniteScroll,
	handleScrollCloseDropdown
} from './element-handlers.js'

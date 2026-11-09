// =============================================================================
// Scroll Module - Re-exports
// =============================================================================

export {
	calculateVisibleRange,
	shouldTriggerInfiniteScroll,
	type VisibleRangeParams,
	type VisibleRange
} from './calculations.js'

export { VirtualScrollService } from './virtual-scroll-service.js'

export {
	handleVirtualScroll,
	renderVirtualRows,
	handleInfiniteScroll,
	handleScrollCloseDropdown
} from './element-handlers.js'

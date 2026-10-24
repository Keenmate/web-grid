// =============================================================================
// Action Pipeline
// Routes actions to executors and processes child actions
// =============================================================================

import type { GridHost } from '../grid-context.js'
import type { GridAction } from './types.js'

/**
 * Context passed to executors, extends GridHost with dispatch capability
 */
export interface ExecutorContext<T = unknown> extends GridHost<T> {
	/**
	 * Dispatch a child action to be processed after current action completes
	 */
	dispatch(action: GridAction): void
}

/**
 * Executor interface - handles a specific action type
 */
export interface ActionExecutor<T = unknown> {
	/**
	 * Action types this executor handles
	 */
	readonly handles: GridAction['type'][]

	/**
	 * Execute the action
	 * @returns Child actions to process, or void/empty array
	 */
	execute(ctx: ExecutorContext<T>, action: GridAction): GridAction[] | void
}

/**
 * Action pipeline - coordinates action dispatch and execution
 */
export class ActionPipeline<T = unknown> {
	private executors: Map<GridAction['type'], ActionExecutor<T>> = new Map()
	private ctx: GridHost<T>

	constructor(ctx: GridHost<T>) {
		this.ctx = ctx
	}

	/**
	 * Register an executor for action types
	 */
	registerExecutor(executor: ActionExecutor<T>): void {
		for (const type of executor.handles) {
			this.executors.set(type, executor)
		}
	}

	/**
	 * Dispatch an action through the pipeline
	 * Processes the action and any child actions it produces
	 */
	dispatch(action: GridAction): void {
		const queue: GridAction[] = [action]

		while (queue.length > 0) {
			const current = queue.shift()!
			const executor = this.executors.get(current.type)

			if (!executor) {
				console.warn(`[ActionPipeline] No executor for action type: ${current.type}`)
				continue
			}

			// Create executor context with dispatch capability
			// Use Proxy to delegate all property access/mutation to the original context
			// while adding the dispatch method
			// Note: dispatch calls this.dispatch() to support async callbacks (like datepicker onSelect)
			// that may call dispatch after the current dispatch cycle has completed
			const execCtx = new Proxy(this.ctx as ExecutorContext<T>, {
				get: (target, prop) => {
					if (prop === 'dispatch') {
						return (childAction: GridAction) => this.dispatch(childAction)
					}
					return target[prop as keyof typeof target]
				},
				set: (target, prop, value) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(target as any)[prop] = value
					return true
				}
			})

			// Execute and collect child actions
			const childActions = executor.execute(execCtx, current)
			if (childActions && childActions.length > 0) {
				// Add child actions to front of queue (depth-first)
				queue.unshift(...childActions)
			}
		}
	}
}

/**
 * Create a new action pipeline with the given context
 */
export function createActionPipeline<T>(ctx: GridHost<T>): ActionPipeline<T> {
	return new ActionPipeline(ctx)
}

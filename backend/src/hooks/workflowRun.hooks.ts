import type { HookContext, HookResult } from './hookTypes'

export function beforeWorkflowRunHook(ctx: HookContext): HookResult {
  const context = ctx.context as { hookState?: { workflowStartedAt?: number } } | undefined
  if (context) {
    context.hookState ??= {}
    context.hookState.workflowStartedAt = Date.now()
  }

  return {
    outcome: 'success',
    message: `Workflow ${ctx.workflowId ?? 'unknown'} started`
  }
}

export function afterWorkflowRunHook(ctx: HookContext): HookResult {
  return {
    outcome: 'success',
    message: `Workflow ${ctx.workflowId ?? 'unknown'} finished`
  }
}

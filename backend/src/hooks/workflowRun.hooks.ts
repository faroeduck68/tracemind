import { toolRegistry } from '../tools'
import type { HookContext, HookResult } from './hookTypes'

export function beforeWorkflowRunHook(ctx: HookContext): HookResult {
  const workflow = ctx.metadata?.workflow
  if (workflow) {
    for (const node of workflow.nodes) {
      if (!toolRegistry[node.tool as keyof typeof toolRegistry]) {
        return {
          outcome: 'blocking',
          blocked: true,
          reason: `Tool is not registered: ${node.tool}`
        }
      }
    }
  }

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

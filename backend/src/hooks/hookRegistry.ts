import type { HookCallback, HookContext, HookEvent, HookResult } from './hookTypes'

const HOOKS: Record<HookEvent, HookCallback[]> = {
  UserPromptSubmit: [],
  BeforeWorkflowGenerate: [],
  AfterWorkflowGenerate: [],
  BeforeWorkflowRun: [],
  BeforeNodeRun: [],
  PreToolUse: [],
  PostToolUse: [],
  AfterNodeRun: [],
  OnNodeError: [],
  AfterWorkflowRun: [],
  Stop: []
}

export function registerHook(event: HookEvent, callback: HookCallback) {
  HOOKS[event].push(callback)
}

export function resetHooks() {
  for (const event of Object.keys(HOOKS) as HookEvent[]) {
    HOOKS[event] = []
  }
}

export async function triggerHooks(event: HookEvent, ctx: HookContext): Promise<HookResult | null> {
  const callbacks = HOOKS[event] ?? []

  for (const callback of callbacks) {
    const startedAt = Date.now()

    try {
      const result = await callback(ctx)
      appendHookLog(ctx, event, result, Date.now() - startedAt)

      if (!result) continue

      if (result.updatedInput !== undefined) {
        ctx.input = result.updatedInput
      }

      if (result.additionalContext) {
        ctx.metadata = {
          ...(ctx.metadata ?? {}),
          additionalContext: result.additionalContext
        }
      }

      if (result.failureAnalysis) {
        ctx.metadata = {
          ...(ctx.metadata ?? {}),
          failureAnalysis: result.failureAnalysis
        }
      }

      if (result.outcome === 'non_blocking_error') {
        continue
      }

      if (result.blocked || result.preventContinuation || result.outcome === 'blocking') {
        return result
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown hook error'
      const result: HookResult = {
        outcome: 'blocking',
        blocked: true,
        error: message,
        reason: `Hook ${event} failed: ${message}`
      }
      appendHookLog(ctx, event, result, Date.now() - startedAt)
      return result
    }
  }

  return null
}

function appendHookLog(ctx: HookContext, event: HookEvent, result: HookResult | void, latencyMs: number) {
  const context = ctx.context
  if (!context || typeof context !== 'object') return

  const target = context as { hookLogs?: unknown[] }
  target.hookLogs ??= []
  target.hookLogs.push({
    event,
    runId: ctx.runId,
    workflowId: ctx.workflowId,
    nodeId: ctx.nodeId,
    toolName: ctx.toolName,
    outcome: result?.outcome ?? 'success',
    blocked: Boolean(result?.blocked || result?.preventContinuation || result?.outcome === 'blocking'),
    message: result?.message,
    reason: result?.reason,
    latencyMs,
    createdAt: new Date().toISOString()
  })
}

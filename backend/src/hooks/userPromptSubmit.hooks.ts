import { toolRegistry } from '../tools'
import type { HookContext, HookResult } from './hookTypes'

export function userPromptLogHook(ctx: HookContext): HookResult {
  return {
    outcome: 'success',
    message: `User prompt submitted: ${readQuery(ctx.input).slice(0, 120)}`
  }
}

export function injectToolContextHook(_ctx: HookContext): HookResult {
  return {
    outcome: 'success',
    additionalContext: `Available tools: ${Object.keys(toolRegistry).join(', ')}`
  }
}

function readQuery(input: unknown) {
  if (input && typeof input === 'object' && 'query' in input) {
    return String((input as { query?: unknown }).query ?? '')
  }

  return String(input ?? '')
}

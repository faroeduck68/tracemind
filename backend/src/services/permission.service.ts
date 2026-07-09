import type { HookToolDefinition } from '../hooks/hookTypes'

export type PermissionDecision = {
  behavior: 'allow' | 'ask' | 'deny'
  reason: string
}

export async function checkPermission(input: {
  toolName?: string
  input?: unknown
  context?: unknown
  toolDefinition?: HookToolDefinition
}): Promise<PermissionDecision> {
  if (!input.toolName) {
    return {
      behavior: 'deny',
      reason: 'Tool name is required before execution.'
    }
  }

  if (input.toolDefinition?.enabled === false) {
    return {
      behavior: 'deny',
      reason: `Tool ${input.toolName} is disabled.`
    }
  }

  return {
    behavior: 'allow',
    reason: `Tool ${input.toolName} is allowed.`
  }
}

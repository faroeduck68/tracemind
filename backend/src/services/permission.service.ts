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

  if (input.toolDefinition?.riskLevel === 'high' && !hasAdminPermission(input.context)) {
    return {
      behavior: 'deny',
      reason: `Tool ${input.toolName} is high risk and requires administrator permission.`
    }
  }

  return {
    behavior: 'allow',
    reason: `Tool ${input.toolName} is allowed.`
  }
}

function hasAdminPermission(context: unknown) {
  if (!context || typeof context !== 'object') return false
  const record = context as Record<string, unknown>
  return record.admin === true || record.isAdmin === true || record.role === 'admin'
}

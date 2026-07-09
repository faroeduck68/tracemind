import { WorkflowContext } from '../types/context'
import { WorkflowGraph, WorkflowNode } from '../types/workflow'

export type HookEvent =
  | 'UserPromptSubmit'
  | 'BeforeWorkflowGenerate'
  | 'AfterWorkflowGenerate'
  | 'BeforeWorkflowRun'
  | 'BeforeNodeRun'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'AfterNodeRun'
  | 'OnNodeError'
  | 'AfterWorkflowRun'
  | 'Stop'

export type HookOutcome = 'success' | 'blocking' | 'non_blocking_error' | 'cancelled'

export type HookResult = {
  outcome?: HookOutcome
  blocked?: boolean
  message?: string
  reason?: string
  updatedInput?: unknown
  additionalContext?: string
  permissionBehavior?: 'allow' | 'ask' | 'deny'
  permissionReason?: string
  approvalId?: number
  preventContinuation?: boolean
  error?: string
  failureAnalysis?: unknown
}

export type HookToolDefinition = {
  name: string
  displayName?: string
  enabled?: boolean
  dependencies?: string[]
  inputSchema?: unknown
  outputSchema?: unknown
  config?: unknown
  source?: 'registry' | 'database' | 'node'
}

export type HookContext = {
  runId?: number
  workflowId?: number
  nodeId?: string
  toolName?: string
  input?: unknown
  output?: unknown
  error?: unknown
  context?: WorkflowContext | Record<string, unknown>
  metadata?: {
    workflow?: WorkflowGraph
    node?: WorkflowNode
    toolDefinition?: HookToolDefinition
    latencyMs?: number
    source?: string
    [key: string]: unknown
  }
}

export type HookCallback = (ctx: HookContext) => Promise<HookResult | void> | HookResult | void

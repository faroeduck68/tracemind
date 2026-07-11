export type WorkflowContext = {
  runId: number
  workflowId: number
  userId?: string
  query?: string
  memories: unknown[]
  files: unknown[]
  nodeOutputs: Record<string, unknown>
  nodeInputs: Record<string, unknown>
  currentNodeId?: string
  traces: unknown[]
  finalResult?: unknown
  hookLogs?: unknown[]
  mockUsage?: unknown[]
  failures?: unknown[]
  warnings?: string[]
  runSummary?: unknown
  hookState?: {
    workflowStartedAt?: number
    tempFiles?: string[]
    nodes?: Record<
      string,
      {
        traceStepId?: number
        traceFinished?: boolean
        toolCallLogId?: number
        toolCallFinished?: boolean
        toolStatsUpdated?: boolean
        nodeStartedAt?: number
        toolStartedAt?: number
        failureAnalysis?: unknown
      }
    >
  }
}

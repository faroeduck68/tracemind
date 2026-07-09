export type WorkflowContext = {
  runId: number
  workflowId: number
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

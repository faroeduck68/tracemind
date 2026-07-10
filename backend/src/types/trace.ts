import { NodeStatus } from './common'

export type TraceStep = {
  id: string
  runId?: number
  workflowId?: number
  stepOrder?: number
  stepName: string
  nodeId?: string
  time: string
  status: NodeStatus
  tool?: string
  latency?: string
  errorMessage?: string
  permissionBehavior?: string
  permissionReason?: string
  approvalId?: string | number
  inputSummary?: string
  outputSummary?: string
}

export type TraceStepDetail = TraceStep & {
  stepType?: string
  reason?: string
  confidence?: number
  inputData?: unknown
  outputData?: unknown
  errorMessage?: string
  startedAt?: string
  finishedAt?: string
}

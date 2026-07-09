import { NodeStatus } from './common'

export type TraceStep = {
  id: string
  stepName: string
  nodeId?: string
  time: string
  status: NodeStatus
  tool?: string
  latency?: string
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

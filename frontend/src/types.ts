export type NodeStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'success'
  | 'partial_success'
  | 'failed'
  | 'skipped'
  | 'waiting_approval'
  | 'permission_denied'
  | 'cancelled'

export type PaletteNode = {
  type: string
  label: string
  desc: string
  icon: string
  category: string
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'cyan'
}

export type WorkflowNode = {
  id: string
  type: string
  label: string
  subLabel: string
  icon: string
  position: { x: number; y: number }
  status: NodeStatus
  tone: 'green' | 'blue' | 'violet' | 'amber' | 'cyan'
  tool: string
  toolName?: string
  displayName?: string
  toolReason?: string
  roleInWorkflow?: string
  confidence: number
  reason: string
  candidateTools?: ToolScore[]
  config?: unknown
  inputSummary?: string
  outputSummary?: string
  inputData?: unknown
  outputData?: unknown
}

export type WorkflowEdge = {
  id: string
  source: string
  target: string
  branch?: 'main' | 'alt'
}

export type ToolScore = {
  name: string
  score: number
  displayName?: string
  reason?: string
}

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
  reason?: string
  latency?: string
  latencyMs?: number
  inputData?: unknown
  outputData?: unknown
  errorMessage?: string
  permissionBehavior?: string
  permissionReason?: string
  approvalId?: string | number
  inputSummary?: string
  outputSummary?: string
}

export type UploadedFile = {
  fileId?: string | number
  id?: string | number
  filename: string
  originalName?: string
  filePath: string
  mimeType?: string
  size?: number
  status: 'uploaded' | 'pending' | 'failed'
  error?: string
}

export type WorkflowHistoryItem = {
  id: number
  name: string
  workflowType?: string
  intent?: string
  status?: string
  nodeCount?: number
  edgeCount?: number
  latestRunId?: number | null
  latestRunStatus?: string | null
  updatedAt?: string
  createdAt?: string
}

export type RunHistoryItem = {
  id: number
  workflowId: number
  workflowName?: string
  status: string
  totalLatencyMs?: number
  files?: UploadedFile[]
  summary?: string
  errorMessage?: string
  startedAt?: string
  finishedAt?: string
}

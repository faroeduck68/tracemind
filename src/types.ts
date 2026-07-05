export type NodeStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped'

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
  confidence: number
  reason: string
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
}

export type TraceStep = {
  id: string
  stepName: string
  nodeId?: string
  time: string
  status: NodeStatus
  tool?: string
  latency?: string
}

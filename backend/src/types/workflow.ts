import { NodeStatus } from './common'

export type WorkflowTone = 'green' | 'blue' | 'violet' | 'amber' | 'cyan'

export type WorkflowNode = {
  id: string
  type: string
  label: string
  subLabel: string
  icon: string
  position: { x: number; y: number }
  status: NodeStatus
  tone: WorkflowTone
  tool: string
  toolName?: string
  displayName?: string
  confidence: number
  reason: string
  candidateTools?: Array<{ name: string; score: number }>
  config?: unknown
  inputSchema?: unknown
  outputSchema?: unknown
}

export type WorkflowEdge = {
  id: string
  source: string
  target: string
  branch?: 'main' | 'alt'
}

export type WorkflowGraph = {
  id?: number
  name: string
  description?: string
  sourceType?: string
  originalQuery?: string
  intent: string
  confidence: number
  status?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export type WorkflowNodeRow = {
  id: number
  workflow_id: number
  node_key: string
  node_type: string
  label: string
  sub_label: string
  icon: string
  x: number
  y: number
  status: NodeStatus
  tone: WorkflowTone
  tool_name: string
  confidence: string | number | null
  reason: string
  config?: unknown
  input_schema?: unknown
  output_schema?: unknown
}

export type WorkflowEdgeRow = {
  id: number
  workflow_id: number
  edge_key: string
  source_node_key: string
  target_node_key: string
  branch: 'main' | 'alt'
  condition_expr?: string
}

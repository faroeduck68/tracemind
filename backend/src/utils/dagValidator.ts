import { WorkflowEdge, WorkflowNode } from '../types/workflow'
import { topologicalSort } from './topologicalSort'

export function validateDag(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  if (nodes.length === 0) {
    throw new Error('Workflow nodes cannot be empty')
  }

  if (edges.length === 0) {
    throw new Error('Workflow edges cannot be empty')
  }

  const nodeIds = new Set(nodes.map((node) => node.id))

  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      throw new Error(`Edge ${edge.id} source node does not exist: ${edge.source}`)
    }

    if (!nodeIds.has(edge.target)) {
      throw new Error(`Edge ${edge.id} target node does not exist: ${edge.target}`)
    }
  }

  topologicalSort(nodes, edges)
}

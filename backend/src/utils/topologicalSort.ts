import { WorkflowEdge, WorkflowNode } from '../types/workflow'

export function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const indegree = new Map(nodes.map((node) => [node.id, 0]))
  const outgoing = new Map<string, string[]>()

  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
  }

  const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id)
  const ordered: WorkflowNode[] = []

  while (queue.length > 0) {
    const nodeId = queue.shift() as string
    const node = nodeMap.get(nodeId)
    if (node) ordered.push(node)

    for (const nextId of outgoing.get(nodeId) ?? []) {
      indegree.set(nextId, (indegree.get(nextId) ?? 0) - 1)
      if ((indegree.get(nextId) ?? 0) === 0) {
        queue.push(nextId)
      }
    }
  }

  if (ordered.length !== nodes.length) {
    throw new Error('Workflow contains a cycle')
  }

  return ordered
}

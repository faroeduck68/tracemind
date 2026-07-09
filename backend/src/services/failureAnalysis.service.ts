import { WorkflowEdge, WorkflowNode } from '../types/workflow'

// 任务书 §17：根据失败节点和 edges 计算受影响的下游节点。
export function collectAffectedNodes(nodeId: string, edges: WorkflowEdge[]): string[] {
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
  }

  const affected = new Set<string>()
  const queue = [...(outgoing.get(nodeId) ?? [])]
  while (queue.length > 0) {
    const current = queue.shift() as string
    if (affected.has(current)) continue
    affected.add(current)
    queue.push(...(outgoing.get(current) ?? []))
  }

  return [...affected]
}

export function analyzeFailure(error: Error, node: WorkflowNode, edges: WorkflowEdge[] = []) {
  const affectedNodes = collectAffectedNodes(node.id, edges)

  return {
    failedNode: node.label,
    nodeId: node.id,
    reason: error.message,
    impact: affectedNodes.length > 0 ? `后续 ${affectedNodes.length} 个节点无法继续执行` : '后续节点无法继续执行',
    affectedNodes,
    suggestions: ['检查该节点输入是否为空', '确认工具是否启用', '尝试替换工具后重新执行']
  }
}

import { toolRegistry } from '../tools'
import { WorkflowEdge, WorkflowNode } from '../types/workflow'

export type ValidateResult = {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// 任务书 §11：在运行 Workflow 前进行结构与工具校验，返回 {valid, errors, warnings}。
export function validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): ValidateResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. nodes 不为空
  if (nodes.length === 0) errors.push('工作流节点不能为空')
  // 2. edges 不为空
  if (edges.length === 0) errors.push('工作流连线不能为空')

  // 3. node.id 唯一
  const seen = new Set<string>()
  for (const node of nodes) {
    if (seen.has(node.id)) errors.push(`节点 id 重复：${node.id}`)
    seen.add(node.id)
  }

  const nodeIds = new Set(nodes.map((node) => node.id))

  for (const edge of edges) {
    // 4/5. edge.source / edge.target 必须存在
    if (!nodeIds.has(edge.source)) errors.push(`连线 ${edge.id} 的源节点不存在：${edge.source}`)
    if (!nodeIds.has(edge.target)) errors.push(`连线 ${edge.id} 的目标节点不存在：${edge.target}`)
  }

  // 6. node.tool 必须存在于 toolRegistry
  for (const node of nodes) {
    if (!node.tool) {
      errors.push(`节点 ${node.id} 未绑定工具`)
    } else if (!(node.tool in toolRegistry)) {
      errors.push(`节点 ${node.id} 绑定的工具未注册：${node.tool}`)
    }
  }

  // 7. 不允许成环
  if (nodeIds.size > 0 && hasCycle(nodes, edges)) {
    errors.push('工作流存在环，无法确定执行顺序')
  }

  // 8. 必须有起始节点（无入边）
  const hasIncoming = new Set(edges.map((edge) => edge.target))
  const startNodes = nodes.filter((node) => !hasIncoming.has(node.id))
  if (nodes.length > 0 && startNodes.length === 0) {
    errors.push('工作流缺少起始节点（所有节点都有入边）')
  }

  // 9. 不允许孤立节点（既无入边也无出边），除非节点标记 optional
  const connected = new Set<string>()
  for (const edge of edges) {
    connected.add(edge.source)
    connected.add(edge.target)
  }
  for (const node of nodes) {
    const optional = Boolean((node.config as { optional?: boolean } | null | undefined)?.optional)
    if (!connected.has(node.id) && !optional) {
      warnings.push(`节点 ${node.id} 是孤立节点，未连接到工作流`)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

function hasCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
  const indegree = new Map(nodes.map((node) => [node.id, 0]))
  const outgoing = new Map<string, string[]>()

  for (const edge of edges) {
    if (!indegree.has(edge.target) || !indegree.has(edge.source)) continue
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
  }

  const queue = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id)
  let visited = 0

  while (queue.length > 0) {
    const nodeId = queue.shift() as string
    visited += 1
    for (const next of outgoing.get(nodeId) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1)
      if ((indegree.get(next) ?? 0) === 0) queue.push(next)
    }
  }

  return visited !== indegree.size
}

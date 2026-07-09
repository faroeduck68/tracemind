import { WorkflowContext } from '../types/context'
import { WorkflowEdge, WorkflowNode } from '../types/workflow'

export function createWorkflowContext(input: {
  runId: number
  workflowId: number
  query?: string
  memories?: unknown[]
  files?: unknown[]
}): WorkflowContext {
  return {
    runId: input.runId,
    workflowId: input.workflowId,
    query: input.query,
    memories: input.memories ?? [],
    files: input.files ?? [],
    nodeOutputs: {},
    nodeInputs: {},
    traces: []
  }
}

// 返回某节点所有上游节点的输出，key 为上游节点 id。
export function getUpstreamOutputs(nodeId: string, edges: WorkflowEdge[], context: WorkflowContext) {
  const upstream: Record<string, unknown> = {}
  for (const edge of edges) {
    if (edge.target === nodeId && edge.source in context.nodeOutputs) {
      upstream[edge.source] = context.nodeOutputs[edge.source]
    }
  }
  return upstream
}

// 计算节点输入：用户原始输入 + 上游节点输出 + 节点 config + context metadata。
export function getNodeInput(node: WorkflowNode, edges: WorkflowEdge[], context: WorkflowContext) {
  const upstreamOutputs = getUpstreamOutputs(node.id, edges, context)
  return {
    query: context.query,
    files: context.files,
    memories: context.memories,
    config: node.config ?? null,
    upstreamOutputs,
    previousOutputs: context.nodeOutputs
  }
}

export function setNodeOutput(nodeId: string, output: unknown, context: WorkflowContext) {
  context.nodeOutputs[nodeId] = output
}

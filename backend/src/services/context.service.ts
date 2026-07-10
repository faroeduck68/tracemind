import { WorkflowContext } from '../types/context'
import { WorkflowEdge, WorkflowNode } from '../types/workflow'

export function createWorkflowContext(input: {
  runId: number
  workflowId: number
  userId?: string
  query?: string
  memories?: unknown[]
  files?: unknown[]
}): WorkflowContext {
  return {
    runId: input.runId,
    workflowId: input.workflowId,
    userId: input.userId,
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
  const derivedFields = deriveInputFields(node.inputSchema, context.query)
  const weatherFields = deriveWeatherInputFields(node, context.query)
  return {
    ...derivedFields,
    ...weatherFields,
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

function deriveInputFields(schema: unknown, query = '') {
  if (!schema || typeof schema !== 'object' || !query.trim()) return {}
  const record = schema as Record<string, unknown>
  const fields = new Set<string>()
  const properties = record.properties

  if (properties && typeof properties === 'object') {
    Object.keys(properties).forEach((key) => fields.add(key))
  } else {
    Object.keys(record)
      .filter((key) => !['required', 'type', 'description'].includes(key))
      .forEach((key) => fields.add(key))
  }

  const derived: Record<string, unknown> = {}
  if (fields.has('city')) {
    derived.city = extractCity(query)
  }
  return derived
}

function extractCity(query: string) {
  const cleaned = query
    .replace(/你好啊|你好|请|帮我|帮忙|查询一下|查一下|查询|查|一下|今天|今日|现在|当前|实时|天气|气温|预报|并给出工作流|给出工作流|生成工作流|工作流|weather|temperature|forecast/gi, '')
    .replace(/[，。,.?？!！\s]/g, '')
    .trim()
  const match = cleaned.match(/([\u4e00-\u9fa5]{2,12})(?:市|县|区)?/)
  return (match?.[1] ?? (cleaned || query.trim())).replace(/市$/, '')
}

function deriveWeatherInputFields(node: WorkflowNode, query = '') {
  if (!query.trim()) return {}
  const text = `${node.tool ?? ''} ${node.toolName ?? ''} ${node.type ?? ''} ${node.label ?? ''}`.toLowerCase()
  const isWeatherTool = text.includes('weather') || text.includes('天气') || text.includes('气温') || text.includes('预报')
  return isWeatherTool ? { city: extractCity(query) } : {}
}

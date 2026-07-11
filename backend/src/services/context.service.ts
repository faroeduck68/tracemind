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

export function getUpstreamOutputs(nodeId: string, edges: WorkflowEdge[], context: WorkflowContext) {
  const upstream: Record<string, unknown> = {}
  for (const edge of edges) {
    if (edge.target === nodeId && edge.source in context.nodeOutputs) {
      upstream[edge.source] = context.nodeOutputs[edge.source]
    }
  }
  return upstream
}

export function getNodeInput(node: WorkflowNode, edges: WorkflowEdge[], context: WorkflowContext) {
  const upstreamOutputs = getUpstreamOutputs(node.id, edges, context)
  const derivedFields = deriveInputFields(node.inputSchema, context.query)
  const weatherFields = deriveWeatherInputFields(node, context.query)
  const query = deriveNodeQuery(node, upstreamOutputs, context.query)
  const knowledgeFields = deriveKnowledgeInputFields(node)
  return {
    ...derivedFields,
    ...weatherFields,
    ...knowledgeFields,
    query,
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
  if (fields.has('city')) derived.city = extractCity(query)
  return derived
}

export function extractWeatherCity(query: string) {
  return extractCity(query)
}

function extractCity(query: string) {
  const normalized = query.replace(/[，,。！？!?；;：:\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim()
  const prefix =
    '(?:\\u4f60\\u597d\\u554a|\\u4f60\\u597d|\\u8bf7\\u95ee|\\u8bf7|\\u5e2e\\u6211|\\u5e2e\\u5fd9|\\u9ebb\\u70e6|\\u67e5\\u8be2\\u4e00\\u4e0b|\\u67e5\\u4e00\\u4e0b|\\u67e5\\u8be2|\\u67e5|\\u770b\\u4e00\\u4e0b|\\u770b\\u770b|\\u6211\\u60f3\\u77e5\\u9053|\\u60f3\\u77e5\\u9053|\\u4e00\\u4e0b)*'
  const date = '(?:\\u4eca\\u5929|\\u4eca\\u65e5|\\u73b0\\u5728|\\u5f53\\u524d|\\u5b9e\\u65f6|\\u660e\\u5929|\\u540e\\u5929)'
  const weatherWord = '(?:\\u5929\\u6c14|\\u6c14\\u6e29|\\u9884\\u62a5)'
  const directMatch = normalized.match(
    new RegExp(`${prefix}\\s*(?:${date}\\s*\\u7684?\\s*)?([\\u4e00-\\u9fa5]{2,12}?)(?:\\u5e02|\\u53bf|\\u533a)?\\s*(?:${date}\\s*)?${weatherWord}`)
  )
  if (directMatch?.[1]) return cleanCityName(directMatch[1])

  const beforeWeather = normalized.split(/\u5929\u6c14|\u6c14\u6e29|\u9884\u62a5|weather|temperature|forecast/i)[0] || normalized
  const cleaned = beforeWeather
    .replace(
      /你好啊|你好|请问|请|帮我|帮忙|麻烦|查询一下|查一下|查询|查|看一下|看看|我想知道|想知道|一下|今天|今日|现在|当前|实时|明天|后天|并给出.*|给出.*|生成.*|工作流.*|分析.*|结果.*/g,
      ''
    )
    .replace(/\s+/g, '')
    .trim()
  const match = cleaned.match(/[\u4e00-\u9fa5]{2,12}/)
  return cleanCityName(match?.[0] ?? (cleaned || normalized))
}

function cleanCityName(value: string) {
  return value
    .replace(/(?:今天|今日|现在|当前|实时|明天|后天|的)/g, '')
    .replace(/^(省|市|县|区)+/, '')
    .replace(/(市|县|区)$/, '')
    .trim()
}

function deriveWeatherInputFields(node: WorkflowNode, query = '') {
  if (!query.trim()) return {}
  const text = `${node.tool ?? ''} ${node.toolName ?? ''} ${node.type ?? ''} ${node.label ?? ''}`.toLowerCase()
  const isWeatherTool =
    text.includes('weather') || text.includes('\u5929\u6c14') || text.includes('\u6c14\u6e29') || text.includes('\u9884\u62a5')
  return isWeatherTool ? { city: extractCity(query) } : {}
}

function deriveNodeQuery(node: WorkflowNode, upstreamOutputs: Record<string, unknown>, workflowQuery = '') {
  if (node.tool !== 'knowledge_search_tool' && node.tool !== 'finance_knowledge_base') return workflowQuery

  const config = node.config && typeof node.config === 'object' ? (node.config as Record<string, unknown>) : {}
  const queryTemplate = typeof config.queryTemplate === 'string' ? config.queryTemplate.trim() : ''
  const upstreamText = summarizeUpstreamForQuery(upstreamOutputs)
  return [queryTemplate, upstreamText, workflowQuery].filter(Boolean).join(' ')
}

function deriveKnowledgeInputFields(node: WorkflowNode) {
  if (node.tool !== 'knowledge_search_tool' && node.tool !== 'finance_knowledge_base') return {}
  const config = node.config && typeof node.config === 'object' ? (node.config as Record<string, unknown>) : {}
  return Object.fromEntries(
    ['knowledgeBaseId', 'retrievalMode', 'topK', 'knowledgeBaseType']
      .filter((key) => config[key] != null)
      .map((key) => [key, config[key]])
  )
}

function summarizeUpstreamForQuery(value: unknown): string {
  const terms = new Set<string>()
  collectQueryTerms(value, terms, 0)
  return [...terms].slice(0, 24).join(' ')
}

function collectQueryTerms(value: unknown, terms: Set<string>, depth: number) {
  if (depth > 4 || terms.size >= 32 || value == null) return
  if (typeof value === 'string' || typeof value === 'number') {
    addQueryTerm(String(value), terms)
    return
  }
  if (Array.isArray(value)) {
    value.slice(0, 12).forEach((item) => collectQueryTerms(item, terms, depth + 1))
    return
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/^(id|createdAt|updatedAt|filePath|downloadUrl)$/i.test(key)) continue
      addQueryTerm(key, terms)
      collectQueryTerms(item, terms, depth + 1)
    }
  }
}

function addQueryTerm(value: string, terms: Set<string>) {
  value
    .replace(/[，。！？；：、,.!?;:\n\r\t()[\]{}"'“”‘’]/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 60)
    .slice(0, 8)
    .forEach((item) => terms.add(item))
}

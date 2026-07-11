import {
  createTool,
  findToolByIdOrName,
  getToolStats,
  listTools,
  ToolRow,
  toggleTool,
  updateTool
} from '../models/tool.model'
import { parseJson } from '../utils/json'
import { runDraftTool, runTool } from './toolRunner.service'
import { createWorkflowContext } from './context.service'
import { toolRegistry } from '../tools'
import { env } from '../config/env'

export async function getTools() {
  const rows = await listTools()
  return rows.map(sanitizeTool)
}

export async function getTool(idOrName: string) {
  const row = await findToolByIdOrName(idOrName)
  return row ? sanitizeTool(row) : null
}

export async function addTool(input: Record<string, unknown>) {
  const name = String(input.name ?? '').trim()
  if (!name) throw new Error('工具名不能为空')

  const existing = await findToolByIdOrName(name)
  if (existing) throw duplicateToolNameError()
  validateAuthConfigForSave(input.authConfig ?? input.auth_config)

  return createTool({
    name,
    display_name: String(input.displayName ?? input.display_name ?? input.name),
    type: normalizeToolType(input.type),
    source: normalizeToolSource(input.source, input.type),
    mcp_server_id: normalizeNullableNumber(input.mcpServerId ?? input.mcp_server_id),
    mcp_tool_name: normalizeNullableString(input.mcpToolName ?? input.mcp_tool_name),
    version: String(input.version ?? 'v1.0.0'),
    category: input.category ? String(input.category) : defaultCategory(input.type),
    description: input.description ? String(input.description) : null,
    enabled: input.enabled === false ? 0 : 1,
    risk_level: input.riskLevel ? String(input.riskLevel) : input.risk_level ? String(input.risk_level) : 'low',
    config_schema: input.configSchema ?? input.config_schema ?? null,
    input_schema: input.inputSchema ?? input.input_schema ?? null,
    output_schema: input.outputSchema ?? input.output_schema ?? null,
    config_json: input.configJson ?? input.config_json ?? null,
    auth_config: input.authConfig ?? input.auth_config ?? null
  })
}

export async function editTool(id: number, input: Record<string, unknown>) {
  const existing = await findToolByIdOrName(String(id))
  if (!existing) throw new Error('Tool not found')
  validateAuthConfigForSave(input.authConfig ?? input.auth_config)

  await updateTool(id, {
    display_name: String(input.displayName ?? input.display_name ?? existing.display_name),
    type: normalizeToolType(input.type ?? existing.type),
    source: normalizeToolSource(input.source ?? existing.source, input.type ?? existing.type),
    mcp_server_id: normalizeNullableNumber(input.mcpServerId ?? input.mcp_server_id ?? existing.mcp_server_id),
    mcp_tool_name: normalizeNullableString(input.mcpToolName ?? input.mcp_tool_name ?? existing.mcp_tool_name),
    version: String(input.version ?? existing.version ?? 'v1.0.0'),
    category: input.category ? String(input.category) : existing.category ?? defaultCategory(input.type ?? existing.type),
    description: input.description != null ? String(input.description) : existing.description,
    enabled: input.enabled === false ? 0 : input.enabled === true ? 1 : existing.enabled,
    risk_level: input.riskLevel ? String(input.riskLevel) : input.risk_level ? String(input.risk_level) : existing.risk_level ?? 'low',
    config_schema: input.configSchema ?? input.config_schema ?? existing.config_schema ?? null,
    input_schema: input.inputSchema ?? input.input_schema ?? existing.input_schema ?? null,
    output_schema: input.outputSchema ?? input.output_schema ?? existing.output_schema ?? null,
    config_json: input.configJson ?? input.config_json ?? existing.config_json ?? null,
    auth_config: mergeAuthConfig(input.authConfig ?? input.auth_config, existing.auth_config)
  })
  return getTool(String(id))
}

export async function switchTool(id: number) {
  await toggleTool(id)
  return getTool(String(id))
}

export async function getToolsStats() {
  return getToolStats()
}

export async function checkToolName(name: string) {
  const normalized = name.trim()
  if (!normalized) return { exists: false, tool: null }
  const row = await findToolByIdOrName(normalized)
  return {
    exists: Boolean(row),
    tool: row ? sanitizeTool(row) : null
  }
}

export async function testTool(idOrName: string, input: unknown, userId = 'default_user') {
  const tool = await findToolByIdOrName(idOrName)
  if (!tool) throw new Error(`Tool not found: ${idOrName}`)

  const context = createWorkflowContext({
    runId: 0,
    workflowId: 0,
    userId,
    query: typeof input === 'object' && input && 'query' in input ? String((input as Record<string, unknown>).query ?? '') : '',
    files: [],
    memories: []
  })
  context.currentNodeId = `tool_test_${tool.id}`

  const result = await runTool(tool.name, input, context, {
    manageToolCallLog: true,
    manageToolStats: true
  })

  return {
    success: result.success,
    output: result.output,
    error: result.errorMessage,
    trace: {
      toolName: tool.name,
      type: tool.type,
      message: result.message,
      reason: result.reason
    }
  }
}

export async function testWebSearch(query: string, userId = 'default_user') {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) throw new Error('query is required')

  const startedAt = Date.now()
  const context = createWorkflowContext({
    runId: 0,
    workflowId: 0,
    userId,
    query: normalizedQuery,
    files: [],
    memories: []
  })
  context.currentNodeId = 'web_search_acceptance_test'

  const result = await runTool('web_search_tool', { query: normalizedQuery }, context, {
    manageToolCallLog: true,
    manageToolStats: true
  })
  if (!result.success) throw new Error(result.errorMessage ?? 'web_search_tool 测试失败。')

  const output = result.output && typeof result.output === 'object' ? (result.output as Record<string, unknown>) : {}
  return {
    query: normalizedQuery,
    results: Array.isArray(output.results) ? output.results : [],
    sources: Array.isArray(output.sources) ? output.sources : [],
    summary: typeof output.summary === 'string' ? output.summary : '',
    provider: typeof output.provider === 'string' ? output.provider : '',
    resultCount: Number(output.resultCount ?? 0),
    fallback: output.fallback === true,
    latencyMs: Date.now() - startedAt
  }
}

export async function testDraftTool(input: Record<string, unknown>) {
  const toolType = normalizeToolType(input.type)
  const name = String(input.name ?? `draft_${toolType}_tool`).trim()
  const draftTool = {
    id: 0,
    name,
    display_name: String(input.displayName ?? input.display_name ?? name),
    type: toolType,
    source: toolType === 'mcp' ? 'mcp' : 'local',
    mcp_server_id: normalizeNullableNumber(input.mcpServerId ?? input.mcp_server_id),
    mcp_tool_name: normalizeNullableString(input.mcpToolName ?? input.mcp_tool_name),
    version: 'draft',
    category: defaultCategory(toolType),
    description: typeof input.description === 'string' ? input.description : null,
    enabled: 1,
    risk_level: input.riskLevel ? String(input.riskLevel) : input.risk_level ? String(input.risk_level) : 'low',
    success_rate: 0,
    avg_latency_ms: 0,
    call_count: 0,
    config_schema: null,
    input_schema: input.inputSchema ?? input.input_schema ?? null,
    output_schema: input.outputSchema ?? input.output_schema ?? null,
    config_json: input.config ?? input.configJson ?? input.config_json ?? null,
    auth_config: input.authConfig ?? input.auth_config ?? null,
    created_at: '',
    updated_at: ''
  } as ToolRow

  if (toolType === 'builtin' && !(name in toolRegistry)) {
    return {
      success: false,
      output: null,
      error: '内置工具不存在，不能作为草稿测试。',
      trace: { toolName: name, type: toolType }
    }
  }

  const context = createWorkflowContext({
    runId: 0,
    workflowId: 0,
    userId: typeof input.userId === 'string' ? input.userId : 'default_user',
    query: '',
    files: [],
    memories: []
  })
  context.currentNodeId = `tool_draft_test_${Date.now()}`

  const result = await runDraftTool(draftTool, input.testInput ?? {}, context, {
    manageToolCallLog: true,
    manageToolStats: false
  })

  return {
    success: result.success,
    output: result.output,
    error: result.errorMessage,
    trace: {
      toolName: draftTool.name,
      type: draftTool.type,
      message: result.message,
      reason: result.reason
    }
  }
}

function sanitizeTool(row: ToolRow) {
  return {
    id: row.id,
    name: row.name,
    display_name: row.display_name,
    displayName: row.display_name,
    type: row.type ?? 'builtin',
    source: row.source ?? (row.type === 'mcp' ? 'mcp' : 'local'),
    mcp_server_id: row.mcp_server_id,
    mcpServerId: row.mcp_server_id,
    mcp_tool_name: row.mcp_tool_name,
    mcpToolName: row.mcp_tool_name,
    version: row.version,
    category: row.category,
    description: row.description,
    enabled: row.enabled,
    risk_level: row.risk_level ?? 'low',
    riskLevel: row.risk_level ?? 'low',
    success_rate: row.success_rate,
    avg_latency_ms: row.avg_latency_ms,
    call_count: row.call_count,
    config_schema: row.config_schema,
    input_schema: row.input_schema,
    output_schema: row.output_schema,
    config_json: row.config_json,
    configJson: row.config_json,
    auth_config: maskAuthConfig(row.auth_config),
    authConfig: maskAuthConfig(row.auth_config),
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function maskAuthConfig(value: unknown) {
  const record = parseJson<Record<string, unknown> | null>(value, null)
  if (!record) return null
  const rawValue = typeof record.value === 'string' ? record.value : ''
  const safeValue =
    rawValue.startsWith('env:') || rawValue.startsWith('userSecret:')
      ? rawValue
      : rawValue
        ? '***'
        : ''
  return {
    ...record,
    value: safeValue
  }
}

function mergeAuthConfig(nextValue: unknown, existingValue: unknown) {
  const next = parseJson<Record<string, unknown> | null>(nextValue, null)
  if (!next) return existingValue ?? null
  if (next.value === '***') {
    const existing = parseJson<Record<string, unknown> | null>(existingValue, null)
    return { ...next, value: existing?.value ?? '' }
  }
  return next
}

function normalizeToolType(value: unknown) {
  return value === 'http' || value === 'llm' || value === 'builtin' || value === 'mcp' ? value : 'builtin'
}

function normalizeToolSource(source: unknown, type: unknown) {
  if (source === 'mcp' || type === 'mcp') return 'mcp'
  return 'local'
}

function normalizeNullableNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

function normalizeNullableString(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function defaultCategory(value: unknown) {
  if (value === 'http') return 'HTTP API'
  if (value === 'llm') return '内容生成'
  if (value === 'mcp') return 'MCP'
  return '内置工具'
}

function validateAuthConfigForSave(value: unknown) {
  const auth = parseJson<Record<string, unknown> | null>(value, null)
  const rawValue = typeof auth?.value === 'string' ? auth.value : ''
  if (env.nodeEnv === 'production' && rawValue.startsWith('plain:')) {
    throw new Error('生产环境禁止保存 plain 明文 Key，请改用 env: 或 userSecret:。')
  }
}

function duplicateToolNameError() {
  const error = new Error('工具名已存在') as Error & { code: string; errno: number }
  error.code = 'ER_DUP_ENTRY'
  error.errno = 1062
  return error
}

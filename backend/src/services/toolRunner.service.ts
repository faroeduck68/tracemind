import { createToolCallLog, finishToolCallLog } from '../models/toolCallLog.model'
import { findToolByIdOrName, ToolRow, updateToolCallStats } from '../models/tool.model'
import { toolRegistry } from '../tools'
import { WorkflowContext } from '../types/context'
import { ToolResult } from '../types/tool'
import { parseJson } from '../utils/json'
import { checkPermission } from './permission.service'
import { runBuiltinTool } from './builtinToolRunner.service'
import { runHttpTool } from './httpToolRunner.service'
import { runLlmTool } from './llmToolRunner.service'
import { runMcpTool } from './mcpToolRunner.service'

export type RunToolOptions = {
  manageToolCallLog?: boolean
  manageToolStats?: boolean
  checkPermission?: boolean
}

export async function runTool(
  toolNameOrId: string | number,
  input: unknown,
  context: WorkflowContext | Record<string, unknown>,
  options: RunToolOptions = {}
): Promise<ToolResult> {
  const startedAt = Date.now()
  const tool = await findToolByIdOrName(String(toolNameOrId))
  const builtin = toolRegistry[(tool?.name ?? String(toolNameOrId)) as keyof typeof toolRegistry]

  if (!tool && !builtin) {
    return {
      success: false,
      output: null,
      errorMessage: `Tool is not registered or configured: ${toolNameOrId}`
    }
  }

  const resolvedTool = tool ?? virtualBuiltinTool(String(toolNameOrId))
  const toolDefinition = buildToolDefinition(resolvedTool)

  if (options.checkPermission !== false) {
    const permission = await checkPermission({
      toolName: resolvedTool.name,
      input,
      context,
      toolDefinition
    })
    if (permission.behavior !== 'allow') {
      return {
        success: false,
        output: { permission },
        errorMessage: permission.reason,
        reason: permission.reason
      }
    }
  }

  const validationError = validateRequiredFields(toolDefinition.inputSchema, input)
  if (validationError) {
    return {
      success: false,
      output: null,
      errorMessage: validationError
    }
  }

  const shouldLog = options.manageToolCallLog !== false
  const logId = shouldLog
    ? await createToolCallLog({
        runId: readNumber(context, 'runId') || undefined,
        nodeKey: readString(context, 'currentNodeId') || readString(context, 'nodeId') || undefined,
        toolName: resolvedTool.name,
        inputData: input
      })
    : null

  try {
    const result = await executeByType(resolvedTool, input, context)
    const latencyMs = Date.now() - startedAt
    const normalized = normalizeToolResult(result)

    if (logId) {
      await finishToolCallLog({
        id: logId,
        status: normalized.success ? 'success' : 'failed',
        outputData: normalized.output,
        errorMessage: normalized.errorMessage,
        latencyMs
      })
    }
    if (options.manageToolStats !== false) await updateToolCallStats(resolvedTool.name, normalized.success, latencyMs)

    return normalized
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    const message = error instanceof Error ? error.message : 'Unknown tool execution error'
    if (logId) {
      await finishToolCallLog({
        id: logId,
        status: 'failed',
        outputData: null,
        errorMessage: message,
        latencyMs
      })
    }
    if (options.manageToolStats !== false) await updateToolCallStats(resolvedTool.name, false, latencyMs)

    return {
      success: false,
      output: null,
      errorMessage: message
    }
  }
}

export async function runDraftTool(
  tool: ToolRow,
  input: unknown,
  context: WorkflowContext | Record<string, unknown>,
  options: RunToolOptions = {}
): Promise<ToolResult> {
  const startedAt = Date.now()
  const toolDefinition = buildToolDefinition(tool)

  if (options.checkPermission !== false) {
    const permission = await checkPermission({
      toolName: tool.name,
      input,
      context,
      toolDefinition
    })
    if (permission.behavior !== 'allow') {
      return {
        success: false,
        output: { permission },
        errorMessage: permission.reason,
        reason: permission.reason
      }
    }
  }

  const validationError = validateRequiredFields(toolDefinition.inputSchema, input)
  if (validationError) {
    return {
      success: false,
      output: null,
      errorMessage: validationError
    }
  }

  const shouldLog = options.manageToolCallLog !== false
  const logId = shouldLog
    ? await createToolCallLog({
        runId: readNumber(context, 'runId') || undefined,
        nodeKey: readString(context, 'currentNodeId') || readString(context, 'nodeId') || undefined,
        toolName: tool.name,
        inputData: input
      })
    : null

  try {
    const result = await executeByType(tool, input, context)
    const latencyMs = Date.now() - startedAt
    const normalized = normalizeToolResult(result)

    if (logId) {
      await finishToolCallLog({
        id: logId,
        status: normalized.success ? 'success' : 'failed',
        outputData: normalized.output,
        errorMessage: normalized.errorMessage,
        latencyMs
      })
    }
    if (options.manageToolStats !== false) await updateToolCallStats(tool.name, normalized.success, latencyMs)

    return normalized
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    const message = error instanceof Error ? error.message : 'Unknown tool execution error'
    if (logId) {
      await finishToolCallLog({
        id: logId,
        status: 'failed',
        outputData: null,
        errorMessage: message,
        latencyMs
      })
    }
    if (options.manageToolStats !== false) await updateToolCallStats(tool.name, false, latencyMs)

    return {
      success: false,
      output: null,
      errorMessage: message
    }
  }
}

export function buildToolDefinition(tool: ToolRow) {
  return {
    name: tool.name,
    displayName: tool.display_name,
    enabled: tool.enabled === 1,
    type: tool.type,
    riskLevel: tool.risk_level ?? 'low',
    inputSchema: parseJson(tool.input_schema, null),
    outputSchema: parseJson(tool.output_schema, null),
    config: parseJson(tool.config_json, parseJson(tool.config_schema, null)),
    source: tool.source ?? 'database',
    mcpServerId: tool.mcp_server_id,
    mcpToolName: tool.mcp_tool_name
  }
}

async function executeByType(tool: ToolRow, input: unknown, context: WorkflowContext | Record<string, unknown>) {
  if (tool.type === 'builtin') return runBuiltinTool(tool, input, context)
  if (tool.type === 'http') return runHttpTool(tool, input, context)
  if (tool.type === 'llm') return runLlmTool(tool, input, context)
  if (tool.type === 'mcp') return runMcpTool(tool, input, context)

  throw new Error(`Unsupported tool type: ${tool.type}`)
}

function normalizeToolResult(result: unknown): ToolResult {
  if (result && typeof result === 'object' && 'success' in result && 'output' in result) {
    return result as ToolResult
  }

  return {
    success: true,
    output: result
  }
}

function virtualBuiltinTool(name: string): ToolRow {
  const builtin = toolRegistry[name as keyof typeof toolRegistry]
  return {
    id: 0,
    name,
    display_name: builtin?.displayName ?? name,
    type: 'builtin',
    source: 'local',
    mcp_server_id: null,
    mcp_tool_name: null,
    version: 'v1.0.0',
    category: '内置',
    description: null,
    enabled: 1,
    risk_level: 'low',
    success_rate: 0,
    avg_latency_ms: 0,
    call_count: 0,
    config_schema: null,
    input_schema: null,
    output_schema: null,
    config_json: null,
    auth_config: null,
    created_at: '',
    updated_at: ''
  } as ToolRow
}

function validateRequiredFields(schema: unknown, input: unknown) {
  if (!schema || typeof schema !== 'object') return ''
  const required = new Set<string>()
  const record = schema as Record<string, unknown>

  if (Array.isArray(record.required)) {
    record.required.forEach((key) => required.add(String(key)))
  }

  const properties = record.properties
  if (properties && typeof properties === 'object') {
    for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
      if (value && typeof value === 'object' && (value as { required?: boolean }).required) required.add(key)
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === 'required' || key === 'properties') continue
    if (value && typeof value === 'object' && (value as { required?: boolean }).required) required.add(key)
  }

  if (!required.size) return ''
  const inputRecord = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  for (const key of required) {
    if (inputRecord[key] == null || inputRecord[key] === '') return `Tool input is missing required field: ${key}`
  }
  return ''
}

function readNumber(context: unknown, key: string) {
  return context && typeof context === 'object' ? Number((context as Record<string, unknown>)[key] ?? 0) : 0
}

function readString(context: unknown, key: string) {
  const value = context && typeof context === 'object' ? (context as Record<string, unknown>)[key] : null
  return typeof value === 'string' ? value : ''
}

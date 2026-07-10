import { createToolRankingLogs } from '../models/toolRankingLog.model'
import { createWorkflowRun, updateWorkflowRunFailed, updateWorkflowRunSuccess } from '../models/workflowRun.model'
import { findToolByIdOrName } from '../models/tool.model'
import { toolRegistry } from '../tools'
import { WorkflowGraph, WorkflowNode } from '../types/workflow'
import { topologicalSort } from '../utils/topologicalSort'
import { rankTools } from './toolRanking.service'
import { createWorkflowContext, getNodeInput, setNodeOutput } from './context.service'
import { getWorkflowGraphForExecution } from './workflow.service'
import { getAllowedWorkflowToolNames, validateWorkflow } from './workflowValidator.service'
import { triggerHooks } from '../hooks/hookRegistry'
import { HookContext, HookResult, HookToolDefinition } from '../hooks/hookTypes'
import { parseJson } from '../utils/json'
import { runTool } from './toolRunner.service'

class WorkflowExecutionError extends Error {
  failureAnalysis?: unknown

  constructor(message: string, failureAnalysis?: unknown) {
    super(message)
    this.name = 'WorkflowExecutionError'
    this.failureAnalysis = failureAnalysis
  }
}

export async function runWorkflow(workflowId: number, inputData: Record<string, unknown> = {}) {
  const graph = await getWorkflowGraphForExecution(workflowId)
  if (!graph) {
    throw new Error(`Workflow not found: ${workflowId}`)
  }

  // 任务书 §11：运行前必须通过校验，校验失败不允许运行。
  const validation = validateWorkflow(graph.nodes, graph.edges, {
    allowedToolNames: await getAllowedWorkflowToolNames()
  })
  if (!validation.valid) {
    throw new Error(`Workflow validation failed: ${validation.errors.join('; ')}`)
  }

  const runId = await createWorkflowRun(workflowId, inputData, {
    conversationId: typeof inputData.conversationId === 'string' ? inputData.conversationId : null
  })
  const startedAt = Date.now()
  const context = createWorkflowContext({
    runId,
    workflowId,
    userId: typeof inputData.userId === 'string' ? inputData.userId : 'default_user',
    query: graph.originalQuery ?? String(inputData.query ?? ''),
    files: Array.isArray(inputData.files) ? inputData.files : [],
    memories: []
  })

  try {
    const beforeRunResult = await triggerHooks('BeforeWorkflowRun', {
      runId,
      workflowId,
      input: inputData,
      context,
      metadata: { workflow: graph }
    })
    if (beforeRunResult?.blocked) {
      throw new WorkflowExecutionError(beforeRunResult.reason ?? 'Workflow run was blocked by hooks.')
    }

    const orderedNodes = topologicalSort(graph.nodes, graph.edges)

    for (const node of orderedNodes) {
      await executeNode(graph, node, context)
    }

    const totalLatencyMs = Date.now() - startedAt
    const outputData = buildRunOutput(context.finalResult, context.nodeOutputs)

    await triggerHooks('AfterWorkflowRun', {
      runId,
      workflowId,
      output: outputData,
      context,
      metadata: { workflow: graph, latencyMs: totalLatencyMs }
    })

    await triggerHooks('Stop', {
      runId,
      workflowId,
      output: outputData,
      context,
      metadata: { workflow: graph, latencyMs: totalLatencyMs }
    })

    await updateWorkflowRunSuccess(runId, outputData, totalLatencyMs)

    return {
      runId,
      workflowId,
      status: 'success',
      output: outputData,
      totalLatencyMs
    }
  } catch (error) {
    const totalLatencyMs = Date.now() - startedAt
    const message = error instanceof Error ? error.message : 'Unknown workflow execution error'
    const failureAnalysis =
      error instanceof WorkflowExecutionError ? error.failureAnalysis ?? context.failures?.[context.failures.length - 1] : undefined

    await triggerHooks('Stop', {
      runId,
      workflowId,
      error,
      context,
      metadata: { workflow: graph, latencyMs: totalLatencyMs, failureAnalysis }
    })

    await updateWorkflowRunFailed(runId, message, totalLatencyMs, failureAnalysis)
    return {
      runId,
      workflowId,
      status: 'failed',
      errorMessage: message,
      failureAnalysis,
      totalLatencyMs
    }
  }
}

export async function testWorkflowNode(workflowId: number, nodeId: string, inputData: Record<string, unknown> = {}) {
  const graph = await getWorkflowGraphForExecution(workflowId)
  if (!graph) {
    throw new Error(`Workflow not found: ${workflowId}`)
  }

  const node = graph.nodes.find((item) => item.id === nodeId)
  if (!node) {
    throw new Error(`Workflow node not found: ${nodeId}`)
  }

  const explicitInput = readRecord(inputData.input)
  const upstreamOutputs =
    readRecord(inputData.upstreamOutputs) ?? readRecord(inputData.previousOutputs) ?? readRecord(explicitInput?.upstreamOutputs) ?? {}
  const context = createWorkflowContext({
    runId: 0,
    workflowId,
    userId: typeof inputData.userId === 'string' ? inputData.userId : 'default_user',
    query: String(inputData.query ?? explicitInput?.query ?? graph.originalQuery ?? ''),
    files: Array.isArray(inputData.files) ? inputData.files : Array.isArray(explicitInput?.files) ? explicitInput.files : [],
    memories: Array.isArray(inputData.memories)
      ? inputData.memories
      : Array.isArray(explicitInput?.memories)
        ? explicitInput.memories
        : []
  })

  context.currentNodeId = node.id
  context.nodeOutputs = { ...upstreamOutputs }
  const nodeInput = explicitInput ?? getNodeInput(node, graph.edges, context)
  context.nodeInputs[node.id] = nodeInput

  const startedAt = Date.now()
  try {
    const result = await runTool(node.tool, nodeInput, context, {
      manageToolCallLog: true,
      manageToolStats: true
    })
    const latencyMs = Date.now() - startedAt
    return {
      workflowId,
      nodeId,
      toolName: node.tool,
      displayName: node.displayName ?? node.tool,
      status: result.success ? 'success' : 'failed',
      inputData: nodeInput,
      outputData: result.output,
      message: result.message,
      latencyMs,
      errorMessage: result.success ? undefined : result.errorMessage ?? result.message
    }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    return {
      workflowId,
      nodeId,
      toolName: node.tool,
      displayName: node.displayName ?? node.tool,
      status: 'failed',
      inputData: nodeInput,
      outputData: null,
      latencyMs,
      errorMessage: error instanceof Error ? error.message : 'Unknown node test error'
    }
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function buildRunOutput(finalResult: unknown, nodeOutputs: Record<string, unknown>) {
  const displayable = collectDisplayableOutput(nodeOutputs)
  const finalRecord = readRecord(finalResult)
  const businessFailure = detectBusinessFailure(finalResult, nodeOutputs)

  if (finalRecord) {
    return attachBusinessOutcome(fillMissingDisplayFields(finalRecord, displayable), businessFailure)
  }

  if (typeof finalResult === 'string' && finalResult.trim()) {
    return attachBusinessOutcome(fillMissingDisplayFields({ summary: finalResult.trim() }, displayable), businessFailure)
  }

  return attachBusinessOutcome(Object.keys(displayable).length ? { ...nodeOutputs, ...displayable } : nodeOutputs, businessFailure)
}

function fillMissingDisplayFields(target: Record<string, unknown>, fallback: Record<string, unknown>) {
  const output = { ...target }
  for (const [key, value] of Object.entries(fallback)) {
    if (!hasDisplayValueForKey(key, output[key]) && hasDisplayValueForKey(key, value)) {
      output[key] = value
    }
  }
  return output
}

function collectDisplayableOutput(nodeOutputs: Record<string, unknown>) {
  const records = Object.values(nodeOutputs).map(readRecord).filter(Boolean) as Record<string, unknown>[]
  const riskRecord = records.find(
    (record) =>
      typeof record.riskLevel === 'string' ||
      Array.isArray(record.risks) ||
      Array.isArray(record.suggestions) ||
      typeof record.recommendation === 'string'
  )

  const summary = firstString(
    ...records.map((record) => record.summary),
    riskRecord && buildRiskSummary(riskRecord),
    ...records.map((record) => record.recommendation)
  )
  const markdown = firstString(
    ...records.map((record) => record.markdown),
    ...records.map((record) => record.finalReport),
    ...records.map((record) => record.reportPreview),
    ...records.map((record) => record.content)
  )
  const downloadUrl = firstString(...records.map((record) => record.downloadUrl))
  const riskLevel = firstString(riskRecord?.riskLevel)
  const recommendation = firstString(...records.map((record) => record.recommendation), arrayText(riskRecord?.suggestions))
  const risks = Array.isArray(riskRecord?.risks) ? riskRecord?.risks : undefined

  return Object.fromEntries(
    Object.entries({
      summary,
      markdown,
      reportPreview: markdown ? markdown.slice(0, 600) : '',
      downloadUrl,
      riskLevel,
      recommendation,
      risks
    }).filter(([, value]) => hasDisplayValue(value))
  )
}

function buildRiskSummary(record: Record<string, unknown>) {
  return [
    `风险等级：${firstString(record.riskLevel) || 'unknown'}`,
    arrayText(record.risks) && `风险：${arrayText(record.risks)}`,
    firstString(record.recommendation, arrayText(record.suggestions)) &&
      `建议：${firstString(record.recommendation, arrayText(record.suggestions))}`
  ]
    .filter(Boolean)
    .join('\n')
}

function hasDisplayValue(value: unknown) {
  if (typeof value === 'string') return Boolean(value.trim())
  if (Array.isArray(value)) return value.length > 0
  return value != null
}

function hasDisplayValueForKey(key: string, value: unknown) {
  if (!hasDisplayValue(value)) return false
  if (key === 'riskLevel' && typeof value === 'string') return value.trim().toLowerCase() !== 'unknown'
  if ((key === 'summary' || key === 'markdown' || key === 'reportPreview') && typeof value === 'string') {
    return !isPlaceholderText(value)
  }
  return true
}

function isPlaceholderText(value: string) {
  return (
    value.includes('没有可直接展示') ||
    value.includes('暂未返回可汇总') ||
    value.includes('暂未形成可展示') ||
    value.includes('没有可汇总的上游报告内容')
  )
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function arrayText(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 4).join('；') : ''
}

function detectBusinessFailure(finalResult: unknown, nodeOutputs: Record<string, unknown>) {
  const values = [finalResult, nodeOutputs, ...Object.values(nodeOutputs)]
  const text = values.map((value) => stringifyForSearch(value)).join('\n').toLowerCase()
  const hasUnknownRisk = values.some((value) => {
    const record = readRecord(value)
    return typeof record?.riskLevel === 'string' && record.riskLevel.trim().toLowerCase() === 'unknown'
  })
  const hasNoDataSignal = [
    '无法完成有效分析',
    '未提取到指标',
    '未识别到财务数据',
    '文件不适合当前工作流',
    'no data',
    'not enough data'
  ].some((keyword) => text.includes(keyword.toLowerCase()))

  if (!hasUnknownRisk && !hasNoDataSignal) return null

  return {
    businessStatus: 'failed',
    businessMessage: hasNoDataSignal
      ? '分析未完成：未识别到可用于当前工作流的有效数据。'
      : '分析未完成：风险等级为 unknown，说明当前文件无法支持有效业务分析。',
    suggestedAction: '请上传包含有效财务数据的文件，或改用文档总结工作流。'
  }
}

function attachBusinessOutcome(output: Record<string, unknown>, businessFailure: Record<string, unknown> | null) {
  return businessFailure ? { ...output, ...businessFailure } : output
}

function stringifyForSearch(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value ?? '')
  } catch {
    return String(value ?? '')
  }
}

async function executeNode(graph: WorkflowGraph, node: WorkflowNode, context: ReturnType<typeof createWorkflowContext>) {
  const ranking = rankTools(context.query ?? '', node.tool)
  await createToolRankingLogs(context.runId, node.id, ranking)

  // Context Manager：按 edges 计算该节点输入（用户输入 + 上游输出 + config），并写入 context。
  context.currentNodeId = node.id
  const inputData = getNodeInput(node, graph.edges, context)
  context.nodeInputs[node.id] = inputData

  const beforeNodeResult = await triggerHooks('BeforeNodeRun', {
    runId: context.runId,
    workflowId: graph.id as number,
    nodeId: node.id,
    toolName: node.tool,
    input: inputData,
    context,
    metadata: { workflow: graph, node }
  })
  if (beforeNodeResult?.blocked) {
    throw await handleNodeError(graph, node, context, inputData, beforeNodeResult, Date.now())
  }

  const toolDefinition = await buildToolDefinition(node)

  const startedAt = Date.now()

  try {
    const preResult = await triggerHooks('PreToolUse', {
      runId: context.runId,
      workflowId: graph.id as number,
      nodeId: node.id,
      toolName: node.tool,
      input: inputData,
      context,
      metadata: { workflow: graph, node, toolDefinition }
    })

    if (preResult?.blocked) {
      throw await handleNodeError(graph, node, context, inputData, preResult, startedAt)
    }

    const result = await runTool(node.tool, inputData, context, {
      manageToolCallLog: false,
      manageToolStats: false
    })
    const latencyMs = Date.now() - startedAt

    if (!result.success) {
      const toolError = new Error(result.errorMessage ?? result.message ?? `Tool failed: ${node.tool}`)
      throw await handleNodeError(graph, node, context, inputData, toolError, startedAt, result.output, latencyMs)
    }

    const postResult = await triggerHooks('PostToolUse', {
      runId: context.runId,
      workflowId: graph.id as number,
      nodeId: node.id,
      toolName: node.tool,
      input: inputData,
      output: result.output,
      context,
      metadata: {
        workflow: graph,
        node,
        toolDefinition,
        latencyMs,
        nodeResultStatus: result.status,
        nodeResultErrorMessage: result.errorMessage,
        nodeResultReason: result.reason,
        businessFailure: result.businessFailure
      }
    })

    if (postResult?.blocked) {
      throw await handleNodeError(graph, node, context, inputData, postResult, startedAt, result.output)
    }

    setNodeOutput(node.id, result.output, context)

    const afterNodeResult = await triggerHooks('AfterNodeRun', {
      runId: context.runId,
      workflowId: graph.id as number,
      nodeId: node.id,
      toolName: node.tool,
      input: inputData,
      output: result.output,
      context,
      metadata: {
        workflow: graph,
        node,
        latencyMs,
        nodeResultStatus: result.status,
        nodeResultErrorMessage: result.errorMessage,
        nodeResultReason: result.reason,
        businessFailure: result.businessFailure
      }
    })

    if (afterNodeResult?.blocked) {
      throw await handleNodeError(graph, node, context, inputData, afterNodeResult, startedAt, result.output)
    }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    if (error instanceof WorkflowExecutionError) throw error

    const normalizedError = error instanceof Error ? error : new Error('Unknown tool execution error')
    throw await handleNodeError(graph, node, context, inputData, normalizedError, startedAt, undefined, latencyMs)
  }
}

async function handleNodeError(
  graph: WorkflowGraph,
  node: WorkflowNode,
  context: ReturnType<typeof createWorkflowContext>,
  inputData: unknown,
  error: Error | HookResult,
  startedAt: number,
  output?: unknown,
  latencyMs = Date.now() - startedAt
) {
  const normalizedError = error instanceof Error ? error : new Error(error.reason ?? error.message ?? `Node ${node.id} was blocked.`)

  const errorContext: HookContext = {
    runId: context.runId,
    workflowId: graph.id as number,
    nodeId: node.id,
    toolName: node.tool,
    input: inputData,
    output,
    error: normalizedError,
    context,
    metadata: { workflow: graph, node, latencyMs }
  }

  const hookResult = await triggerHooks('OnNodeError', errorContext)
  const failureAnalysis = hookResult?.failureAnalysis ?? errorContext.metadata?.failureAnalysis

  return new WorkflowExecutionError(normalizedError.message, failureAnalysis)
}

async function buildToolDefinition(node: WorkflowNode): Promise<HookToolDefinition> {
  const registeredTool = toolRegistry[node.tool as keyof typeof toolRegistry] as
    | (typeof toolRegistry)[keyof typeof toolRegistry] & {
        dependencies?: string[]
        inputSchema?: unknown
        outputSchema?: unknown
        config?: unknown
      }
    | undefined
  const row = await findToolByIdOrName(node.tool)

  return {
    name: node.tool,
    displayName: registeredTool?.displayName ?? row?.display_name,
    enabled: row ? row.enabled === 1 : true,
    type: row?.type ?? 'builtin',
    riskLevel: row?.risk_level ?? 'low',
    dependencies: registeredTool?.dependencies ?? readDependencies(node.config),
    inputSchema: node.inputSchema ?? parseJson(row?.input_schema, null) ?? registeredTool?.inputSchema,
    outputSchema: node.outputSchema ?? parseJson(row?.output_schema, null) ?? registeredTool?.outputSchema,
    config: node.config ?? registeredTool?.config ?? parseJson(row?.config_json, null) ?? parseJson(row?.config_schema, null),
    source: row?.source ?? (row ? 'database' : 'registry'),
    mcpServerId: row?.mcp_server_id ?? null,
    mcpToolName: row?.mcp_tool_name ?? null
  }
}

function readDependencies(config: unknown) {
  if (!config || typeof config !== 'object') return []
  const dependencies = (config as { dependencies?: unknown }).dependencies
  return Array.isArray(dependencies) ? dependencies.map(String) : []
}

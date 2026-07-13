import { createToolRankingLogs } from '../models/toolRankingLog.model'
import { finishToolCallLog } from '../models/toolCallLog.model'
import { createWorkflowRun, updateWorkflowRunFailed, updateWorkflowRunSuccess } from '../models/workflowRun.model'
import { findToolByIdOrName, updateToolCallStats } from '../models/tool.model'
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
import { buildRunOutput } from './runOutputBuilder.service'
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
    const outputData = buildRunOutput(context.finalResult, context.nodeOutputs, context.warnings)

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
      if (isOptionalNode(node)) {
        await skipOptionalNode(graph, node, context, inputData, preResult.reason ?? preResult.message, Date.now() - startedAt)
        return
      }
      throw await handleNodeError(graph, node, context, inputData, preResult, startedAt)
    }

    const result = await runTool(node.tool, inputData, context, {
      manageToolCallLog: false,
      manageToolStats: false
    })
    const latencyMs = Date.now() - startedAt

    if (!result.success) {
      if (isOptionalNode(node)) {
        await skipOptionalNode(graph, node, context, inputData, result.errorMessage ?? result.message, latencyMs, result.output)
        return
      }
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
    if (isOptionalNode(node)) {
      await skipOptionalNode(graph, node, context, inputData, normalizedError.message, latencyMs)
      return
    }
    throw await handleNodeError(graph, node, context, inputData, normalizedError, startedAt, undefined, latencyMs)
  }
}

function isOptionalNode(node: WorkflowNode) {
  const config = readRecord(node.config)
  return config?.optional === true
}

async function skipOptionalNode(
  graph: WorkflowGraph,
  node: WorkflowNode,
  context: ReturnType<typeof createWorkflowContext>,
  inputData: unknown,
  errorMessage: string | undefined,
  latencyMs: number,
  toolOutput?: unknown
) {
  const warning = buildOptionalNodeWarning(node, errorMessage)
  const output = {
    skipped: true,
    optional: true,
    warning,
    errorMessage: errorMessage ?? null,
    toolOutput: toolOutput ?? null,
    ...(node.tool === 'web_search_tool' ? { results: [], sources: [], provider: null, resultCount: 0, fallback: false } : {})
  }

  context.warnings ??= []
  context.warnings.push(warning)
  setNodeOutput(node.id, output, context)

  const state = context.hookState?.nodes?.[node.id]
  if (state?.toolCallLogId && !state.toolCallFinished) {
    await finishToolCallLog({
      id: state.toolCallLogId,
      status: 'failed',
      outputData: output,
      errorMessage: warning,
      latencyMs
    })
    state.toolCallFinished = true
  }
  if (node.tool && state && !state.toolStatsUpdated) {
    await updateToolCallStats(node.tool, false, latencyMs)
    state.toolStatsUpdated = true
  }

  await triggerHooks('AfterNodeRun', {
    runId: context.runId,
    workflowId: graph.id as number,
    nodeId: node.id,
    toolName: node.tool,
    input: inputData,
    output,
    context,
    metadata: {
      workflow: graph,
      node,
      latencyMs,
      nodeResultStatus: 'skipped',
      nodeResultErrorMessage: warning,
      nodeResultReason: warning
    }
  })
}

function buildOptionalNodeWarning(node: WorkflowNode, errorMessage?: string) {
  if (node.tool === 'web_search_tool' && /未配置搜索服务|missing.*(?:api )?key/i.test(errorMessage ?? '')) {
    return 'web_search_tool 未配置搜索服务，已跳过外部资料检索。'
  }
  return `${node.tool} 执行失败，已跳过可选节点：${errorMessage || '未知错误'}`
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

import { createToolRankingLogs } from '../models/toolRankingLog.model'
import { createWorkflowRun, updateWorkflowRunFailed, updateWorkflowRunSuccess } from '../models/workflowRun.model'
import { findToolByIdOrName } from '../models/tool.model'
import { toolRegistry } from '../tools'
import { WorkflowGraph, WorkflowNode } from '../types/workflow'
import { topologicalSort } from '../utils/topologicalSort'
import { rankTools } from './toolRanking.service'
import { createWorkflowContext, getNodeInput, setNodeOutput } from './context.service'
import { getWorkflowGraphForExecution } from './workflow.service'
import { validateWorkflow } from './workflowValidator.service'
import { triggerHooks } from '../hooks/hookRegistry'
import { HookContext, HookResult, HookToolDefinition } from '../hooks/hookTypes'
import { parseJson } from '../utils/json'

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
  const validation = validateWorkflow(graph.nodes, graph.edges)
  if (!validation.valid) {
    throw new Error(`Workflow validation failed: ${validation.errors.join('; ')}`)
  }

  const runId = await createWorkflowRun(workflowId, inputData)
  const startedAt = Date.now()
  const context = createWorkflowContext({
    runId,
    workflowId,
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
    const outputData = context.finalResult ?? context.nodeOutputs

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

async function executeNode(graph: WorkflowGraph, node: WorkflowNode, context: ReturnType<typeof createWorkflowContext>) {
  const tool = toolRegistry[node.tool as keyof typeof toolRegistry]
  if (!tool) {
    throw new Error(`Tool is not registered: ${node.tool}`)
  }

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

    const result = await tool.run(context)
    const latencyMs = Date.now() - startedAt

    if (!result.success) {
      throw new Error(result.message ?? `Tool failed: ${node.tool}`)
    }

    const postResult = await triggerHooks('PostToolUse', {
      runId: context.runId,
      workflowId: graph.id as number,
      nodeId: node.id,
      toolName: node.tool,
      input: inputData,
      output: result.output,
      context,
      metadata: { workflow: graph, node, toolDefinition, latencyMs }
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
      metadata: { workflow: graph, node, latencyMs }
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
    dependencies: registeredTool?.dependencies ?? readDependencies(node.config),
    inputSchema: node.inputSchema ?? parseJson(row?.input_schema, null) ?? registeredTool?.inputSchema,
    outputSchema: node.outputSchema ?? parseJson(row?.output_schema, null) ?? registeredTool?.outputSchema,
    config: node.config ?? registeredTool?.config ?? parseJson(row?.config_schema, null),
    source: row ? 'database' : 'registry'
  }
}

function readDependencies(config: unknown) {
  if (!config || typeof config !== 'object') return []
  const dependencies = (config as { dependencies?: unknown }).dependencies
  return Array.isArray(dependencies) ? dependencies.map(String) : []
}

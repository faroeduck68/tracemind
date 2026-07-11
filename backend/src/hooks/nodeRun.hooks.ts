import { createTraceStep, finishTraceStep, finishTraceStepFailed } from '../models/traceStep.model'
import { updateToolCallStats } from '../models/tool.model'
import { finishToolCallLog } from '../models/toolCallLog.model'
import { analyzeFailure } from '../services/failureAnalysis.service'
import { WorkflowContext } from '../types/context'
import { NodeStatus } from '../types/common'
import { WorkflowEdge, WorkflowGraph, WorkflowNode } from '../types/workflow'
import type { HookContext, HookResult } from './hookTypes'

export async function beforeNodeTraceHook(ctx: HookContext): Promise<HookResult | void> {
  const workflowContext = ctx.context as WorkflowContext | undefined
  const node = ctx.metadata?.node
  if (!workflowContext || !node || ctx.runId == null || ctx.workflowId == null || !ctx.nodeId) return

  const traceStepId = await createTraceStep({
    runId: ctx.runId,
    workflowId: ctx.workflowId,
    nodeKey: ctx.nodeId,
    stepName: node.label,
    stepType: node.type,
    toolName: node.tool,
    reason: node.reason,
    confidence: node.confidence,
    inputData: ctx.input
  })

  const state = getNodeState(workflowContext, ctx.nodeId)
  state.traceStepId = traceStepId
  state.nodeStartedAt = Date.now()

  return {
    outcome: 'success',
    message: `Node ${ctx.nodeId} started`
  }
}

export async function afterNodeTraceHook(ctx: HookContext): Promise<HookResult | void> {
  const workflowContext = ctx.context as WorkflowContext | undefined
  if (!workflowContext || !ctx.nodeId) return

  const state = getNodeState(workflowContext, ctx.nodeId)
  const latencyMs = Number(ctx.metadata?.latencyMs ?? Date.now() - (state.nodeStartedAt ?? Date.now()))

  if (state.traceStepId && !state.traceFinished) {
    const requestedStatus = ctx.metadata?.nodeResultStatus
    const status: NodeStatus =
      requestedStatus === 'partial_success' || requestedStatus === 'skipped' ? requestedStatus : 'success'
    const errorMessage =
      typeof ctx.metadata?.nodeResultErrorMessage === 'string'
        ? ctx.metadata.nodeResultErrorMessage
        : typeof ctx.metadata?.nodeResultReason === 'string'
          ? ctx.metadata.nodeResultReason
          : undefined
    await finishTraceStep(state.traceStepId, status, ctx.output, latencyMs, errorMessage)
    state.traceFinished = true
  }

  workflowContext.traces.push({ nodeId: ctx.nodeId, status: ctx.metadata?.nodeResultStatus ?? 'success', output: ctx.output })

  return {
    outcome: 'success',
    message: `Node ${ctx.nodeId} finished`
  }
}

export async function nodeErrorAnalysisHook(ctx: HookContext): Promise<HookResult> {
  const workflowContext = ctx.context as WorkflowContext | undefined
  const node = ctx.metadata?.node
  const edges = (ctx.metadata?.workflow as WorkflowGraph | undefined)?.edges ?? []
  const normalizedError = normalizeError(ctx.error)
  const failureAnalysis = buildFailureAnalysis(normalizedError, node, edges)
  const latencyMs = Number(ctx.metadata?.latencyMs ?? 0)

  if (workflowContext && ctx.nodeId) {
    const state = getNodeState(workflowContext, ctx.nodeId)

    if (state.traceStepId && !state.traceFinished) {
      await finishTraceStepFailed(
        state.traceStepId,
        normalizedError.message,
        { failureAnalysis, toolOutput: ctx.output },
        latencyMs
      )
      state.traceFinished = true
    }

    if (state.toolCallLogId && !state.toolCallFinished) {
      await finishToolCallLog({
        id: state.toolCallLogId,
        status: 'failed',
        errorMessage: normalizedError.message,
        outputData: failureAnalysis,
        latencyMs
      })
      state.toolCallFinished = true
    }

    if (ctx.toolName && !state.toolStatsUpdated) {
      await updateToolCallStats(ctx.toolName, false, latencyMs)
      state.toolStatsUpdated = true
    }

    workflowContext.failures ??= []
    workflowContext.failures.push(failureAnalysis)
    state.failureAnalysis = failureAnalysis
  }

  ctx.metadata = {
    ...(ctx.metadata ?? {}),
    failureAnalysis
  }

  return {
    outcome: 'success',
    message: `Node ${ctx.nodeId ?? 'unknown'} failed and was analyzed`,
    failureAnalysis
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return error
  return new Error(String(error ?? 'Unknown node execution error'))
}

function buildFailureAnalysis(error: Error, node?: WorkflowNode, edges: WorkflowEdge[] = []) {
  if (node) {
    const base = analyzeFailure(error, node, edges)
    return {
      ...base,
      category: classifyError(error.message),
      suggestions: createSuggestions(error.message, base.suggestions)
    }
  }

  return {
    failedNode: 'Unknown node',
    reason: error.message,
    category: classifyError(error.message),
    impact: 'Workflow execution was interrupted',
    suggestions: createSuggestions(error.message)
  }
}

function classifyError(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('permission') || normalized.includes('denied') || normalized.includes('disabled')) return 'permission'
  if (normalized.includes('missing dependency') || normalized.includes('dependency')) return 'dependency'
  if (normalized.includes('required') || normalized.includes('schema') || normalized.includes('input')) return 'validation'
  if (normalized.includes('file') || normalized.includes('path')) return 'file'
  return 'runtime'
}

function createSuggestions(message: string, existing: unknown[] = []) {
  const suggestions = existing.length > 0 ? [...existing] : ['Check the node input and tool configuration, then run again.']
  const category = classifyError(message)

  if (category === 'permission') suggestions.push('Enable the tool or adjust its permission policy.')
  if (category === 'dependency') suggestions.push('Install the missing dependency or switch to another tool.')
  if (category === 'validation') suggestions.push('Provide the required input fields or update the schema.')
  if (category === 'file') suggestions.push('Check that the file path exists and is inside the allowed workspace.')

  return [...new Set(suggestions)]
}

function getNodeState(context: WorkflowContext, nodeId: string) {
  context.hookState ??= {}
  context.hookState.nodes ??= {}
  context.hookState.nodes[nodeId] ??= {}
  return context.hookState.nodes[nodeId]
}

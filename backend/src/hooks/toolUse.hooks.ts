import fs from 'fs'
import path from 'path'
import { createToolCallLog, finishToolCallLog } from '../models/toolCallLog.model'
import { updateToolCallStats } from '../models/tool.model'
import { checkPermission } from '../services/permission.service'
import { WorkflowContext } from '../types/context'
import type { HookContext, HookResult } from './hookTypes'

export async function toolCallStartHook(ctx: HookContext): Promise<HookResult | void> {
  const workflowContext = ctx.context as WorkflowContext | undefined
  if (!workflowContext || !ctx.nodeId || !ctx.toolName) return

  const state = getNodeState(workflowContext, ctx.nodeId)
  if (state.toolCallLogId) return { outcome: 'success' }

  state.toolCallLogId = await createToolCallLog({
    runId: ctx.runId,
    nodeKey: ctx.nodeId,
    toolName: ctx.toolName,
    inputData: ctx.input
  })
  state.toolStartedAt = Date.now()

  return {
    outcome: 'success',
    message: `Tool call ${ctx.toolName} started`
  }
}

export async function permissionPreToolHook(ctx: HookContext): Promise<HookResult> {
  const permission = await checkPermission({
    toolName: ctx.toolName,
    input: ctx.input,
    context: ctx.context,
    toolDefinition: ctx.metadata?.toolDefinition
  })

  if (permission.behavior !== 'allow') {
    return {
      outcome: 'blocking',
      blocked: true,
      permissionBehavior: permission.behavior,
      permissionReason: permission.reason,
      reason: permission.reason
    }
  }

  return {
    outcome: 'success',
    permissionBehavior: 'allow',
    permissionReason: permission.reason
  }
}

export function dependencyCheckHook(ctx: HookContext): HookResult | void {
  const dependencies = ctx.metadata?.toolDefinition?.dependencies ?? readDependencies(ctx.metadata?.toolDefinition?.config)

  for (const dep of dependencies) {
    try {
      require.resolve(dep)
    } catch {
      return {
        outcome: 'blocking',
        blocked: true,
        reason: `Tool ${ctx.toolName ?? 'unknown'} is missing dependency ${dep}.`
      }
    }
  }
}

export function inputSchemaCheckHook(ctx: HookContext): HookResult | void {
  const reason = validateRequiredFields(ctx.metadata?.toolDefinition?.inputSchema, ctx.input, 'input')
  if (!reason) return

  return {
    outcome: 'blocking',
    blocked: true,
    reason: `Tool ${ctx.toolName ?? 'unknown'} ${reason}`
  }
}

export function outputSchemaCheckHook(ctx: HookContext): HookResult | void {
  const reason = validateRequiredFields(ctx.metadata?.toolDefinition?.outputSchema, ctx.output, 'output')
  if (!reason) return

  return {
    outcome: 'blocking',
    blocked: true,
    reason: `Tool ${ctx.toolName ?? 'unknown'} ${reason}`
  }
}

export function fileOutputHook(ctx: HookContext): HookResult | void {
  const output = ctx.output
  if (!output || typeof output !== 'object') return

  const filePath = readStringField(output, 'filePath')
  if (!filePath) return

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
  const exists = fs.existsSync(absolutePath)
  const filename = readStringField(output, 'filename') ?? path.basename(filePath)

  if ('downloadUrl' in output === false) {
    ;(output as Record<string, unknown>).downloadUrl = `/api/files/${filename}`
  }

  return {
    outcome: exists ? 'success' : 'non_blocking_error',
    message: exists ? `File generated: ${filename}` : `File path was returned but not found: ${filePath}`
  }
}

export async function postToolTraceHook(ctx: HookContext): Promise<HookResult | void> {
  const workflowContext = ctx.context as WorkflowContext | undefined
  if (!workflowContext || !ctx.nodeId || !ctx.toolName) return

  const state = getNodeState(workflowContext, ctx.nodeId)
  const latencyMs = Number(ctx.metadata?.latencyMs ?? Date.now() - (state.toolStartedAt ?? Date.now()))

  if (state.toolCallLogId && !state.toolCallFinished) {
    await finishToolCallLog({
      id: state.toolCallLogId,
      status: 'success',
      outputData: ctx.output,
      latencyMs
    })
    state.toolCallFinished = true
  }

  if (!state.toolStatsUpdated) {
    await updateToolCallStats(ctx.toolName, true, latencyMs)
    state.toolStatsUpdated = true
  }

  return {
    outcome: 'success',
    message: `Tool call ${ctx.toolName} finished`
  }
}

function validateRequiredFields(schema: unknown, value: unknown, label: 'input' | 'output') {
  if (!schema || typeof schema !== 'object') return null

  const required = new Set<string>()
  const schemaRecord = schema as Record<string, unknown>

  if (Array.isArray(schemaRecord.required)) {
    for (const key of schemaRecord.required) required.add(String(key))
  }

  const properties = schemaRecord.properties
  if (properties && typeof properties === 'object') {
    for (const [key, config] of Object.entries(properties as Record<string, unknown>)) {
      if (config && typeof config === 'object' && (config as { required?: boolean }).required) required.add(key)
    }
  }

  for (const [key, config] of Object.entries(schemaRecord)) {
    if (key === 'required' || key === 'properties') continue
    if (config && typeof config === 'object' && (config as { required?: boolean }).required) required.add(key)
  }

  if (required.size === 0) return null
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  for (const key of required) {
    if (record[key] == null) {
      return `${label} is missing required field: ${key}`
    }
  }

  return null
}

function readDependencies(config: unknown) {
  if (!config || typeof config !== 'object') return []
  const dependencies = (config as { dependencies?: unknown }).dependencies
  return Array.isArray(dependencies) ? dependencies.map(String) : []
}

function readStringField(value: object, key: string) {
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === 'string' && candidate.trim() ? candidate : null
}

function getNodeState(context: WorkflowContext, nodeId: string) {
  context.hookState ??= {}
  context.hookState.nodes ??= {}
  context.hookState.nodes[nodeId] ??= {}
  return context.hookState.nodes[nodeId]
}

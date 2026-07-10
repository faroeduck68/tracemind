import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'
import { NodeStatus } from '../types/common'
import { redactSecrets } from '../utils/redact'
import { stringifyJson } from '../utils/json'
import { summarize } from '../utils/summarize'
import { ensureWorkflowHistoryTables } from './workflowHistorySchema.model'

export type TraceStepRow = RowDataPacket & {
  id: number
  run_id: number
  workflow_id: number
  node_key: string | null
  step_order: number | null
  step_name: string
  step_type: string | null
  status: NodeStatus
  tool_name: string | null
  reason: string | null
  confidence: string | number | null
  input_data: unknown
  input_summary: string | null
  output_data: unknown
  output_summary: string | null
  error_message: string | null
  latency_ms: number | null
  started_at: string
  finished_at: string | null
}

export async function createTraceStep(input: {
  runId: number
  workflowId: number
  nodeKey?: string
  stepName: string
  stepType?: string
  toolName?: string
  reason?: string
  confidence?: number
  inputData?: unknown
  inputSummary?: string
  stepOrder?: number
}) {
  await ensureWorkflowHistoryTables()
  const stepOrder = input.stepOrder ?? (await nextStepOrder(input.runId))
  const result = await execute<ResultSetHeader>(
    `INSERT INTO trace_steps
     (run_id, workflow_id, node_key, step_order, step_name, step_type, status, tool_name, reason, confidence, input_data, input_summary)
     VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?)`,
    [
      input.runId,
      input.workflowId,
      input.nodeKey ?? null,
      stepOrder,
      input.stepName,
      input.stepType ?? null,
      input.toolName ?? null,
      input.reason ?? null,
      input.confidence ?? null,
      stringifyJson(redactSecrets(input.inputData ?? null)),
      input.inputSummary ?? summarize(redactSecrets(input.inputData), 240) ?? null
    ]
  )

  return result.insertId
}

export async function finishTraceStepSuccess(traceStepId: number, outputData: unknown, latencyMs: number) {
  return finishTraceStep(traceStepId, 'success', outputData, latencyMs)
}

export async function finishTraceStep(
  traceStepId: number,
  status: NodeStatus,
  outputData: unknown,
  latencyMs: number,
  errorMessage?: string
) {
  await ensureWorkflowHistoryTables()
  await execute(
    `UPDATE trace_steps
     SET status = ?, error_message = ?, output_data = ?, output_summary = ?, latency_ms = ?, finished_at = NOW()
     WHERE id = ?`,
    [
      status,
      errorMessage ?? null,
      stringifyJson(redactSecrets(outputData)),
      summarize(redactSecrets(outputData), 240) ?? null,
      latencyMs,
      traceStepId
    ]
  )
}

export async function finishTraceStepFailed(
  traceStepId: number,
  errorMessage: string,
  outputData: unknown,
  latencyMs: number
) {
  await ensureWorkflowHistoryTables()
  await execute(
    `UPDATE trace_steps
     SET status = 'failed', error_message = ?, output_data = ?, output_summary = ?, latency_ms = ?, finished_at = NOW()
     WHERE id = ?`,
    [
      errorMessage,
      stringifyJson(redactSecrets(outputData)),
      summarize(redactSecrets(outputData), 240) ?? errorMessage,
      latencyMs,
      traceStepId
    ]
  )
}

export async function listTraceStepsByRunId(runId: number) {
  await ensureWorkflowHistoryTables()
  return query<TraceStepRow[]>(
    `SELECT id, run_id, workflow_id, node_key, step_order, step_name, step_type, status, tool_name, reason, confidence, input_data, input_summary, output_data, output_summary, error_message, latency_ms, started_at, finished_at
     FROM trace_steps
     WHERE run_id = ?
     ORDER BY step_order ASC, id ASC`,
    [runId]
  )
}

async function nextStepOrder(runId: number) {
  const rows = await query<(RowDataPacket & { next_order: number })[]>(
    `SELECT COALESCE(MAX(step_order), 0) + 1 AS next_order
     FROM trace_steps
     WHERE run_id = ?`,
    [runId]
  )

  return Number(rows[0]?.next_order ?? 1)
}

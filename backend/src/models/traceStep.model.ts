import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'
import { NodeStatus } from '../types/common'
import { stringifyJson } from '../utils/json'

export type TraceStepRow = RowDataPacket & {
  id: number
  run_id: number
  workflow_id: number
  node_key: string | null
  step_name: string
  step_type: string | null
  status: NodeStatus
  tool_name: string | null
  reason: string | null
  confidence: string | number | null
  input_data: unknown
  output_data: unknown
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
}) {
  const result = await execute<ResultSetHeader>(
    `INSERT INTO trace_steps
     (run_id, workflow_id, node_key, step_name, step_type, status, tool_name, reason, confidence, input_data)
     VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?, ?)`,
    [
      input.runId,
      input.workflowId,
      input.nodeKey ?? null,
      input.stepName,
      input.stepType ?? null,
      input.toolName ?? null,
      input.reason ?? null,
      input.confidence ?? null,
      stringifyJson(input.inputData ?? null)
    ]
  )

  return result.insertId
}

export async function finishTraceStepSuccess(traceStepId: number, outputData: unknown, latencyMs: number) {
  await execute(
    `UPDATE trace_steps
     SET status = 'success', output_data = ?, latency_ms = ?, finished_at = NOW()
     WHERE id = ?`,
    [stringifyJson(outputData), latencyMs, traceStepId]
  )
}

export async function finishTraceStepFailed(
  traceStepId: number,
  errorMessage: string,
  outputData: unknown,
  latencyMs: number
) {
  await execute(
    `UPDATE trace_steps
     SET status = 'failed', error_message = ?, output_data = ?, latency_ms = ?, finished_at = NOW()
     WHERE id = ?`,
    [errorMessage, stringifyJson(outputData), latencyMs, traceStepId]
  )
}

export async function listTraceStepsByRunId(runId: number) {
  return query<TraceStepRow[]>(
    `SELECT id, run_id, workflow_id, node_key, step_name, step_type, status, tool_name, reason, confidence, input_data, output_data, error_message, latency_ms, started_at, finished_at
     FROM trace_steps
     WHERE run_id = ?
     ORDER BY id ASC`,
    [runId]
  )
}

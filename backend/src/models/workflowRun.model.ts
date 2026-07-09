import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'
import { stringifyJson } from '../utils/json'

export type WorkflowRunRow = RowDataPacket & {
  id: number
  workflow_id: number
  status: string
  input_data: unknown
  output_data: unknown
  total_latency_ms: number
  total_tokens: number
  error_message: string | null
  failure_analysis: unknown
  started_at: string
  finished_at: string | null
}

export async function createWorkflowRun(workflowId: number, inputData: unknown) {
  const result = await execute<ResultSetHeader>(
    `INSERT INTO workflow_runs (workflow_id, status, input_data)
     VALUES (?, 'running', ?)`,
    [workflowId, stringifyJson(inputData)]
  )

  return result.insertId
}

export async function updateWorkflowRunSuccess(runId: number, outputData: unknown, totalLatencyMs: number) {
  await execute(
    `UPDATE workflow_runs
     SET status = 'success', output_data = ?, total_latency_ms = ?, finished_at = NOW()
     WHERE id = ?`,
    [stringifyJson(outputData), totalLatencyMs, runId]
  )
}

export async function updateWorkflowRunFailed(
  runId: number,
  errorMessage: string,
  totalLatencyMs: number,
  failureAnalysis?: unknown
) {
  await execute(
    `UPDATE workflow_runs
     SET status = 'failed', error_message = ?, total_latency_ms = ?, failure_analysis = ?, finished_at = NOW()
     WHERE id = ?`,
    [errorMessage, totalLatencyMs, stringifyJson(failureAnalysis ?? null), runId]
  )
}

export async function findWorkflowRunById(runId: number) {
  const rows = await query<WorkflowRunRow[]>(
    `SELECT id, workflow_id, status, input_data, output_data, total_latency_ms, total_tokens, error_message, failure_analysis, started_at, finished_at
     FROM workflow_runs
     WHERE id = ?`,
    [runId]
  )

  return rows[0] ?? null
}

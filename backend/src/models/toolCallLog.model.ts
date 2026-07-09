import { ResultSetHeader } from 'mysql2/promise'
import { execute } from '../config/db'
import { stringifyJson } from '../utils/json'

export async function createToolCallLog(input: {
  runId?: number
  nodeKey?: string
  toolName: string
  inputData?: unknown
}) {
  const result = await execute<ResultSetHeader>(
    `INSERT INTO tool_call_logs
     (run_id, node_key, tool_name, input_data, status)
     VALUES (?, ?, ?, ?, 'running')`,
    [input.runId ?? null, input.nodeKey ?? null, input.toolName, stringifyJson(input.inputData ?? null)]
  )

  return result.insertId
}

export async function finishToolCallLog(input: {
  id: number
  status: 'success' | 'failed'
  outputData?: unknown
  errorMessage?: string
  latencyMs: number
}) {
  await execute(
    `UPDATE tool_call_logs
     SET status = ?, output_data = ?, error_message = ?, latency_ms = ?
     WHERE id = ?`,
    [
      input.status,
      stringifyJson(input.outputData ?? null),
      input.errorMessage ?? null,
      input.latencyMs,
      input.id
    ]
  )
}

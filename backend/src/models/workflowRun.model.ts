import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'
import { parseJson, stringifyJson } from '../utils/json'
import { pageResult, PaginationOptions, PageResult } from '../utils/pagination'
import { summarize } from '../utils/summarize'
import { ensureWorkflowHistoryTables } from './workflowHistorySchema.model'

export type WorkflowRunRow = RowDataPacket & {
  id: number
  workflow_id: number
  workflow_name?: string
  conversation_id: string | null
  status: string
  input_data: unknown
  output_data: unknown
  file_ids: unknown
  summary: string | null
  total_latency_ms: number
  total_tokens: number
  error_message: string | null
  failure_analysis: unknown
  started_at: string
  finished_at: string | null
}

export async function createWorkflowRun(
  workflowId: number,
  inputData: Record<string, unknown>,
  options: { conversationId?: string | null } = {}
) {
  await ensureWorkflowHistoryTables()
  const result = await execute<ResultSetHeader>(
    `INSERT INTO workflow_runs (workflow_id, conversation_id, status, input_data, file_ids, summary)
     VALUES (?, ?, 'running', ?, ?, ?)`,
    [
      workflowId,
      options.conversationId ?? readConversationId(inputData),
      stringifyJson(inputData),
      stringifyJson(extractFileIds(inputData)),
      summarize(inputData, 240) ?? null
    ]
  )

  await execute('UPDATE workflows SET updated_at = NOW() WHERE id = ?', [workflowId])
  return result.insertId
}

export async function updateWorkflowRunSuccess(runId: number, outputData: unknown, totalLatencyMs: number) {
  await ensureWorkflowHistoryTables()
  await execute(
    `UPDATE workflow_runs
     SET status = 'success', output_data = ?, summary = ?, total_latency_ms = ?, finished_at = NOW()
     WHERE id = ?`,
    [stringifyJson(outputData), summarizeRunOutput(outputData), totalLatencyMs, runId]
  )
}

export async function updateWorkflowRunFailed(
  runId: number,
  errorMessage: string,
  totalLatencyMs: number,
  failureAnalysis?: unknown
) {
  await ensureWorkflowHistoryTables()
  await execute(
    `UPDATE workflow_runs
     SET status = 'failed', error_message = ?, summary = ?, total_latency_ms = ?, failure_analysis = ?, finished_at = NOW()
     WHERE id = ?`,
    [errorMessage, errorMessage.slice(0, 1000), totalLatencyMs, stringifyJson(failureAnalysis ?? null), runId]
  )
}

export async function findWorkflowRunById(runId: number) {
  await ensureWorkflowHistoryTables()
  const rows = await query<WorkflowRunRow[]>(
    `SELECT id, workflow_id, conversation_id, status, input_data, output_data, file_ids, summary, total_latency_ms, total_tokens, error_message, failure_analysis, started_at, finished_at
     FROM workflow_runs
     WHERE id = ?`,
    [runId]
  )

  return rows[0] ?? null
}

export async function listWorkflowRuns(workflowId: number): Promise<WorkflowRunRow[]>
export async function listWorkflowRuns(workflowId: number, pagination: PaginationOptions): Promise<PageResult<WorkflowRunRow>>
export async function listWorkflowRuns(workflowId: number, pagination?: PaginationOptions) {
  await ensureWorkflowHistoryTables()
  const sql = `SELECT
       r.id,
       r.workflow_id,
       w.name AS workflow_name,
       r.conversation_id,
       r.status,
       r.input_data,
       r.output_data,
       r.file_ids,
       r.summary,
       r.total_latency_ms,
       r.total_tokens,
       r.error_message,
       r.failure_analysis,
       r.started_at,
       r.finished_at
     FROM workflow_runs r
     LEFT JOIN workflows w ON w.id = r.workflow_id
     WHERE r.workflow_id = ?
     ORDER BY r.started_at DESC, r.id DESC`
  const params = [workflowId]
  if (!pagination) return query<WorkflowRunRow[]>(sql, params)

  const rows = await query<WorkflowRunRow[]>(`${sql} LIMIT ? OFFSET ?`, [...params, pagination.pageSize, pagination.offset])
  const totalRows = await query<(RowDataPacket & { total: number })[]>(
    'SELECT COUNT(*) AS total FROM workflow_runs WHERE workflow_id = ?',
    params
  )
  return pageResult(rows, Number(totalRows[0]?.total ?? 0), pagination)
}

export async function listRecentWorkflowRuns(limit = 50) {
  await ensureWorkflowHistoryTables()
  return query<WorkflowRunRow[]>(
    `SELECT
       r.id,
       r.workflow_id,
       w.name AS workflow_name,
       r.conversation_id,
       r.status,
       r.input_data,
       r.output_data,
       r.file_ids,
       r.summary,
       r.total_latency_ms,
       r.total_tokens,
       r.error_message,
       r.failure_analysis,
       r.started_at,
       r.finished_at
     FROM workflow_runs r
     LEFT JOIN workflows w ON w.id = r.workflow_id
     ORDER BY r.started_at DESC, r.id DESC
     LIMIT ?`,
    [limit]
  )
}

export async function listRecentWorkflowRunsPaginated(pagination: PaginationOptions) {
  await ensureWorkflowHistoryTables()
  const sql = `SELECT
       r.id,
       r.workflow_id,
       w.name AS workflow_name,
       r.conversation_id,
       r.status,
       r.input_data,
       r.output_data,
       r.file_ids,
       r.summary,
       r.total_latency_ms,
       r.total_tokens,
       r.error_message,
       r.failure_analysis,
       r.started_at,
       r.finished_at
     FROM workflow_runs r
     LEFT JOIN workflows w ON w.id = r.workflow_id
     ORDER BY r.started_at DESC, r.id DESC`
  const rows = await query<WorkflowRunRow[]>(`${sql} LIMIT ? OFFSET ?`, [pagination.pageSize, pagination.offset])
  const totalRows = await query<(RowDataPacket & { total: number })[]>('SELECT COUNT(*) AS total FROM workflow_runs')
  return pageResult(rows, Number(totalRows[0]?.total ?? 0), pagination)
}

function readConversationId(inputData: Record<string, unknown>) {
  return typeof inputData.conversationId === 'string' && inputData.conversationId.trim()
    ? inputData.conversationId.trim()
    : null
}

function extractFileIds(inputData: Record<string, unknown>) {
  const explicit = inputData.fileIds
  if (Array.isArray(explicit)) return explicit

  const files = inputData.files
  if (!Array.isArray(files)) return []

  return files
    .map((file) => {
      if (!file || typeof file !== 'object') return null
      const record = file as Record<string, unknown>
      return record.fileId ?? record.id ?? null
    })
    .filter((value) => value != null)
}

function summarizeRunOutput(outputData: unknown) {
  const summary = readOutputSummary(outputData)
  return (summary || summarize(outputData, 500) || '工作流运行完成').slice(0, 1000)
}

function readOutputSummary(outputData: unknown): string {
  const record = outputData && typeof outputData === 'object' && !Array.isArray(outputData) ? (outputData as Record<string, unknown>) : null
  if (!record) return ''

  for (const key of ['summary', 'businessMessage', 'message', 'markdown', 'finalReport', 'reportPreview', 'recommendation']) {
    if (typeof record[key] === 'string' && record[key].trim()) return record[key].trim()
  }

  const nested = parseJson<Record<string, unknown> | null>(record.finalResult, null)
  if (nested) return readOutputSummary(nested)

  return ''
}

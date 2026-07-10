import { RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'

let workflowHistoryTablesReady = false

export async function ensureWorkflowHistoryTables() {
  if (workflowHistoryTablesReady) return

  await ensureWorkflowColumns()
  await ensureWorkflowRunColumns()
  await ensureTraceStepColumns()

  workflowHistoryTablesReady = true
}

async function ensureWorkflowColumns() {
  const columns = await listColumns('workflows')
  const migrations = [
    ['workflow_type', `ALTER TABLE workflows ADD COLUMN workflow_type VARCHAR(80) NULL AFTER intent`],
    ['node_count', `ALTER TABLE workflows ADD COLUMN node_count INT DEFAULT 0 AFTER status`],
    ['edge_count', `ALTER TABLE workflows ADD COLUMN edge_count INT DEFAULT 0 AFTER node_count`],
    ['conversation_id', `ALTER TABLE workflows ADD COLUMN conversation_id VARCHAR(80) NULL AFTER workflow_json`]
  ] as const

  for (const [column, sql] of migrations) {
    if (!columns.has(column)) await execute(sql)
  }
}

async function ensureWorkflowRunColumns() {
  const columns = await listColumns('workflow_runs')
  const migrations = [
    ['conversation_id', `ALTER TABLE workflow_runs ADD COLUMN conversation_id VARCHAR(80) NULL AFTER workflow_id`],
    ['file_ids', `ALTER TABLE workflow_runs ADD COLUMN file_ids JSON NULL AFTER output_data`],
    ['summary', `ALTER TABLE workflow_runs ADD COLUMN summary TEXT NULL AFTER file_ids`]
  ] as const

  for (const [column, sql] of migrations) {
    if (!columns.has(column)) await execute(sql)
  }
}

async function ensureTraceStepColumns() {
  const columns = await listColumns('trace_steps')
  const migrations = [
    ['step_order', `ALTER TABLE trace_steps ADD COLUMN step_order INT DEFAULT 0 AFTER node_key`],
    ['input_summary', `ALTER TABLE trace_steps ADD COLUMN input_summary TEXT NULL AFTER input_data`],
    ['output_summary', `ALTER TABLE trace_steps ADD COLUMN output_summary TEXT NULL AFTER output_data`]
  ] as const

  for (const [column, sql] of migrations) {
    if (!columns.has(column)) await execute(sql)
  }
}

async function listColumns(tableName: string) {
  const rows = await query<RowDataPacket[]>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tableName]
  )

  return new Set(rows.map((row) => String(row.COLUMN_NAME)))
}

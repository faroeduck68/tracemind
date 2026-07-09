import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'
import { stringifyJson } from '../utils/json'

export type ToolRow = RowDataPacket & {
  id: number
  name: string
  display_name: string
  version: string
  category: string | null
  description: string | null
  enabled: 0 | 1
  success_rate: string | number
  avg_latency_ms: number
  call_count: number
  config_schema: unknown
  input_schema: unknown
  output_schema: unknown
  created_at: string
  updated_at: string
}

export type ToolInput = {
  name?: string
  display_name?: string
  version?: string
  category?: string | null
  description?: string | null
  enabled?: 0 | 1
  success_rate?: string | number
  avg_latency_ms?: number
  call_count?: number
  config_schema?: unknown
  input_schema?: unknown
  output_schema?: unknown
}

export async function listTools() {
  return query<ToolRow[]>(
    `SELECT id, name, display_name, version, category, description, enabled, success_rate, avg_latency_ms, call_count,
            config_schema, input_schema, output_schema, created_at, updated_at
     FROM tools
     ORDER BY category ASC, id ASC`
  )
}

export async function findToolByIdOrName(idOrName: string) {
  const isNumeric = /^\d+$/.test(idOrName)
  const rows = await query<ToolRow[]>(
    `SELECT id, name, display_name, version, category, description, enabled, success_rate, avg_latency_ms, call_count,
            config_schema, input_schema, output_schema, created_at, updated_at
     FROM tools
     WHERE ${isNumeric ? 'id = ?' : 'name = ?'}
     LIMIT 1`,
    [isNumeric ? Number(idOrName) : idOrName]
  )

  return rows[0] ?? null
}

export async function createTool(input: ToolInput) {
  const result = await execute<ResultSetHeader>(
    `INSERT INTO tools
     (name, display_name, version, category, description, enabled, success_rate, avg_latency_ms, call_count, config_schema, input_schema, output_schema)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.display_name,
      input.version ?? 'v1.0.0',
      input.category ?? null,
      input.description ?? null,
      input.enabled ?? 1,
      input.success_rate ?? 0,
      input.avg_latency_ms ?? 0,
      input.call_count ?? 0,
      stringifyJson(input.config_schema ?? null),
      stringifyJson(input.input_schema ?? null),
      stringifyJson(input.output_schema ?? null)
    ]
  )

  return result.insertId
}

export async function updateTool(id: number, input: ToolInput) {
  await execute(
    `UPDATE tools
     SET display_name = ?, version = ?, category = ?, description = ?, enabled = ?, config_schema = ?, input_schema = ?, output_schema = ?
     WHERE id = ?`,
    [
      input.display_name,
      input.version ?? 'v1.0.0',
      input.category ?? null,
      input.description ?? null,
      input.enabled ?? 1,
      stringifyJson(input.config_schema ?? null),
      stringifyJson(input.input_schema ?? null),
      stringifyJson(input.output_schema ?? null),
      id
    ]
  )
}

export async function toggleTool(id: number) {
  await execute('UPDATE tools SET enabled = IF(enabled = 1, 0, 1) WHERE id = ?', [id])
}

export async function updateToolCallStats(toolName: string, success: boolean, latencyMs: number) {
  await execute(
    `UPDATE tools
     SET call_count = call_count + 1,
         avg_latency_ms = IF(call_count = 0, ?, ROUND((avg_latency_ms * call_count + ?) / (call_count + 1))),
         success_rate = ROUND(((success_rate * call_count) + ?) / (call_count + 1), 2)
     WHERE name = ?`,
    [latencyMs, latencyMs, success ? 100 : 0, toolName]
  )
}

export async function getToolStats() {
  const rows = await query<(RowDataPacket & {
    total_tools: number
    enabled_tools: number
    avg_success_rate: string | number
    total_calls: string | number
    avg_latency_ms: string | number
  })[]>(
    `SELECT
       COUNT(*) AS total_tools,
       SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled_tools,
       ROUND(AVG(success_rate), 2) AS avg_success_rate,
       SUM(call_count) AS total_calls,
       ROUND(AVG(avg_latency_ms), 0) AS avg_latency_ms
     FROM tools`
  )

  return rows[0]
}

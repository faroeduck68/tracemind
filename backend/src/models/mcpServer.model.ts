import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'
import { pageResult, PaginationOptions, PageResult } from '../utils/pagination'
import { ensureToolConfigSchema } from './toolSchema.model'

export type McpServerRow = RowDataPacket & {
  id: number
  name: string
  display_name: string | null
  endpoint: string
  transport: string
  enabled: 0 | 1
  status: string
  created_at: string
  updated_at: string
}

export type McpServerInput = {
  name: string
  display_name?: string | null
  endpoint: string
  transport?: string
  enabled?: 0 | 1
  status?: string
}

export async function listMcpServers(): Promise<McpServerRow[]>
export async function listMcpServers(pagination: PaginationOptions): Promise<PageResult<McpServerRow>>
export async function listMcpServers(pagination?: PaginationOptions) {
  await ensureToolConfigSchema()
  const sql = `SELECT id, name, display_name, endpoint, transport, enabled, status, created_at, updated_at
               FROM mcp_servers
               ORDER BY id DESC`
  if (!pagination) return query<McpServerRow[]>(sql)

  const rows = await query<McpServerRow[]>(`${sql} LIMIT ? OFFSET ?`, [pagination.pageSize, pagination.offset])
  const totalRows = await query<(RowDataPacket & { total: number })[]>('SELECT COUNT(*) AS total FROM mcp_servers')
  return pageResult(rows, Number(totalRows[0]?.total ?? 0), pagination)
}

export async function findMcpServerById(id: number) {
  await ensureToolConfigSchema()
  const rows = await query<McpServerRow[]>(
    `SELECT id, name, display_name, endpoint, transport, enabled, status, created_at, updated_at
     FROM mcp_servers
     WHERE id = ?
     LIMIT 1`,
    [id]
  )
  return rows[0] ?? null
}

export async function createMcpServer(input: McpServerInput) {
  await ensureToolConfigSchema()
  const result = await execute<ResultSetHeader>(
    `INSERT INTO mcp_servers (name, display_name, endpoint, transport, enabled, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.display_name ?? null,
      input.endpoint,
      input.transport ?? 'http',
      input.enabled ?? 1,
      input.status ?? 'unknown'
    ]
  )
  return result.insertId
}

export async function updateMcpServer(id: number, input: Partial<McpServerInput>) {
  await ensureToolConfigSchema()
  await execute(
    `UPDATE mcp_servers
     SET display_name = ?, endpoint = ?, transport = ?, enabled = ?, status = ?
     WHERE id = ?`,
    [
      input.display_name ?? null,
      input.endpoint,
      input.transport ?? 'http',
      input.enabled ?? 1,
      input.status ?? 'unknown',
      id
    ]
  )
}

export async function setMcpServerStatus(id: number, status: string) {
  await ensureToolConfigSchema()
  await execute(`UPDATE mcp_servers SET status = ? WHERE id = ?`, [status, id])
}

export async function toggleMcpServer(id: number) {
  await ensureToolConfigSchema()
  await execute(`UPDATE mcp_servers SET enabled = IF(enabled = 1, 0, 1) WHERE id = ?`, [id])
}

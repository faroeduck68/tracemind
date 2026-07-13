import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'
import { stringifyJson } from '../utils/json'
import { pageResult, PaginationOptions, PageResult } from '../utils/pagination'

export type TemplateRow = RowDataPacket & {
  id: number
  title: string
  description: string | null
  category: string | null
  badge: string | null
  is_official: 0 | 1
  workflow_json: unknown
  view_count: number
  like_count: number
  use_count: number
  starred_count: number
  created_at: string
  updated_at: string
}

export type TemplateInput = {
  title?: string
  description?: string | null
  category?: string | null
  badge?: string | null
  is_official?: 0 | 1
  workflow_json?: unknown
}

export async function listTemplates(): Promise<TemplateRow[]>
export async function listTemplates(pagination: PaginationOptions): Promise<PageResult<TemplateRow>>
export async function listTemplates(pagination?: PaginationOptions) {
  const sql = `SELECT id, title, description, category, badge, is_official, workflow_json, view_count, like_count, use_count, starred_count, created_at, updated_at
               FROM workflow_templates
               ORDER BY is_official DESC, use_count DESC, updated_at DESC`
  if (!pagination) return query<TemplateRow[]>(sql)

  const rows = await query<TemplateRow[]>(`${sql} LIMIT ? OFFSET ?`, [pagination.pageSize, pagination.offset])
  const totalRows = await query<(RowDataPacket & { total: number })[]>('SELECT COUNT(*) AS total FROM workflow_templates')
  return pageResult(rows, Number(totalRows[0]?.total ?? 0), pagination)
}

export async function findTemplateById(id: number) {
  const rows = await query<TemplateRow[]>(
    `SELECT id, title, description, category, badge, is_official, workflow_json, view_count, like_count, use_count, starred_count, created_at, updated_at
     FROM workflow_templates
     WHERE id = ?`,
    [id]
  )

  return rows[0] ?? null
}

export async function createTemplate(input: TemplateInput) {
  const result = await execute<ResultSetHeader>(
    `INSERT INTO workflow_templates
     (title, description, category, badge, is_official, workflow_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.description ?? null,
      input.category ?? null,
      input.badge ?? null,
      input.is_official ?? 0,
      stringifyJson(input.workflow_json ?? {})
    ]
  )

  return result.insertId
}

export async function markTemplateUsed(id: number) {
  await execute('UPDATE workflow_templates SET use_count = use_count + 1 WHERE id = ?', [id])
}

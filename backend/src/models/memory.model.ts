import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'

export type MemoryRow = RowDataPacket & {
  id: number
  memory_type: string
  title: string
  content: string
  importance: string
  importance_score: number
  source_type: string | null
  source_id: number | null
  enabled: 0 | 1
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export type MemoryInput = {
  memory_type?: string
  title?: string
  content?: string
  importance?: string
  importance_score?: number
  source_type?: string | null
  source_id?: number | null
  enabled?: 0 | 1
}

export async function listMemories() {
  return query<MemoryRow[]>(
    `SELECT id, memory_type, title, content, importance, importance_score, source_type, source_id, enabled, last_used_at, created_at, updated_at
     FROM memories
     ORDER BY importance_score DESC, updated_at DESC`
  )
}

export async function listEnabledMemories(limit = 5) {
  return query<MemoryRow[]>(
    `SELECT id, memory_type, title, content, importance, importance_score, source_type, source_id, enabled, last_used_at, created_at, updated_at
     FROM memories
     WHERE enabled = 1
     ORDER BY importance_score DESC, updated_at DESC
     LIMIT ?`,
    [limit]
  )
}

export async function createMemory(input: MemoryInput) {
  const result = await execute<ResultSetHeader>(
    `INSERT INTO memories
     (memory_type, title, content, importance, importance_score, source_type, source_id, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.memory_type ?? 'note',
      input.title,
      input.content,
      input.importance ?? 'medium',
      input.importance_score ?? 3,
      input.source_type ?? null,
      input.source_id ?? null,
      input.enabled ?? 1
    ]
  )

  return result.insertId
}

export async function updateMemory(id: number, input: MemoryInput) {
  await execute(
    `UPDATE memories
     SET memory_type = ?, title = ?, content = ?, importance = ?, importance_score = ?, source_type = ?, source_id = ?, enabled = ?
     WHERE id = ?`,
    [
      input.memory_type ?? 'note',
      input.title,
      input.content,
      input.importance ?? 'medium',
      input.importance_score ?? 3,
      input.source_type ?? null,
      input.source_id ?? null,
      input.enabled ?? 1,
      id
    ]
  )
}

export async function deleteMemory(id: number) {
  await execute('DELETE FROM memories WHERE id = ?', [id])
}

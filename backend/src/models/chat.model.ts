import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'
import { parseJson, stringifyJson } from '../utils/json'
import { pageResult, PaginationOptions, PageResult } from '../utils/pagination'

export type ConversationRow = RowDataPacket & {
  id: string
  title: string
  model: string
  status: string
  last_message: string | null
  last_message_at: string | null
  total_tokens: number | null
  message_count?: number
  created_at: string
  updated_at: string
}

export type MessageRow = RowDataPacket & {
  id: number
  conversation_id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  metadata_json: unknown
  model: string | null
  usage_json: unknown
  sequence: number | null
  created_at: string
}

export type ConversationListItem = {
  id: string
  title: string
  model: string
  status: string
  lastMessage: string
  lastMessageAt?: string
  totalTokens: number
  updatedAt: string
  createdAt: string
  messageCount: number
}

export type MessageListItem = {
  id: number
  conversationId: string
  role: string
  content: string
  metadata: unknown
  model?: string
  usage: unknown
  sequence?: number
  createdAt: string
}

let chatTablesReady = false

export async function ensureChatTables() {
  if (chatTablesReady) return

  await execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id VARCHAR(80) PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      model VARCHAR(100) NOT NULL,
      status VARCHAR(30) DEFAULT 'active',
      last_message TEXT NULL,
      last_message_at DATETIME NULL,
      total_tokens INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      conversation_id VARCHAR(80) NOT NULL,
      role VARCHAR(30) NOT NULL,
      content MEDIUMTEXT NOT NULL,
      metadata_json JSON NULL,
      model VARCHAR(100) NULL,
      usage_json JSON NULL,
      sequence INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_messages_conversation_id (conversation_id),
      CONSTRAINT fk_messages_conversation
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await ensureConversationColumns()
  await ensureMessageColumns()

  chatTablesReady = true
}

async function ensureConversationColumns() {
  const columns = await listColumns('conversations')
  const migrations = [
    ['last_message', `ALTER TABLE conversations ADD COLUMN last_message TEXT NULL AFTER status`],
    ['last_message_at', `ALTER TABLE conversations ADD COLUMN last_message_at DATETIME NULL AFTER last_message`],
    ['total_tokens', `ALTER TABLE conversations ADD COLUMN total_tokens INT DEFAULT 0 AFTER last_message_at`]
  ] as const

  for (const [column, sql] of migrations) {
    if (!columns.has(column)) await execute(sql)
  }
}

async function ensureMessageColumns() {
  const columns = await listColumns('messages')
  const migrations = [
    ['metadata_json', `ALTER TABLE messages ADD COLUMN metadata_json JSON NULL AFTER content`],
    ['sequence', `ALTER TABLE messages ADD COLUMN sequence INT NULL AFTER usage_json`]
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

export async function createConversation(input: { id: string; title: string; model: string; status?: string }) {
  await ensureChatTables()
  await execute(
    `INSERT INTO conversations (id, title, model, status)
     VALUES (?, ?, ?, ?)`,
    [input.id, input.title, input.model, input.status ?? 'active']
  )
}

export async function findConversation(id: string) {
  await ensureChatTables()
  const rows = await query<ConversationRow[]>(
    `SELECT id, title, model, status, last_message, last_message_at, total_tokens, created_at, updated_at
     FROM conversations
     WHERE id = ?
     LIMIT 1`,
    [id]
  )
  return rows[0] ?? null
}

export async function touchConversation(id: string, input: { title?: string; model?: string; status?: string } = {}) {
  await ensureChatTables()
  await execute(
    `UPDATE conversations
     SET title = COALESCE(?, title),
         model = COALESCE(?, model),
         status = COALESCE(?, status),
         updated_at = NOW()
     WHERE id = ?`,
    [input.title ?? null, input.model ?? null, input.status ?? null, id]
  )
}

export async function updateConversationAfterMessage(
  id: string,
  input: { lastMessage: string; model?: string | null; usage?: unknown }
) {
  await ensureChatTables()
  await execute(
    `UPDATE conversations
     SET model = COALESCE(?, model),
         last_message = ?,
         last_message_at = NOW(),
         total_tokens = COALESCE(total_tokens, 0) + ?,
         updated_at = NOW()
     WHERE id = ?`,
    [input.model ?? null, input.lastMessage.slice(0, 1000), readUsageTokens(input.usage), id]
  )
}

export async function createMessage(input: {
  conversationId: string
  role: 'system' | 'user' | 'assistant'
  content: string
  metadata?: unknown
  model?: string | null
  usage?: unknown
  sequence?: number | null
}) {
  await ensureChatTables()
  const result = await execute<ResultSetHeader>(
    `INSERT INTO messages (conversation_id, role, content, metadata_json, model, usage_json, sequence)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.conversationId,
      input.role,
      input.content,
      stringifyJson(input.metadata ?? null),
      input.model ?? null,
      stringifyJson(input.usage ?? null),
      input.sequence ?? null
    ]
  )

  return result.insertId
}

export async function listConversations(): Promise<ConversationListItem[]>
export async function listConversations(pagination: PaginationOptions): Promise<PageResult<ConversationListItem>>
export async function listConversations(pagination?: PaginationOptions): Promise<ConversationListItem[] | PageResult<ConversationListItem>> {
  await ensureChatTables()
  const sql = `SELECT
       c.id,
       c.title,
       c.model,
       c.status,
       c.last_message,
       c.last_message_at,
       c.total_tokens,
       c.created_at,
       c.updated_at,
       COUNT(m.id) AS message_count
     FROM conversations c
     LEFT JOIN messages m ON m.conversation_id = c.id
     GROUP BY c.id, c.title, c.model, c.status, c.last_message, c.last_message_at, c.total_tokens, c.created_at, c.updated_at
     ORDER BY c.updated_at DESC, c.created_at DESC`
  const rows = pagination
    ? await query<(ConversationRow & { message_count: number })[]>(`${sql} LIMIT ? OFFSET ?`, [pagination.pageSize, pagination.offset])
    : await query<(ConversationRow & { message_count: number })[]>(sql)

  const mapped = rows.map((row) => ({
    id: row.id,
    title: row.title,
    model: row.model,
    status: row.status,
    lastMessage: row.last_message ?? '',
    lastMessageAt: row.last_message_at ?? undefined,
    totalTokens: Number(row.total_tokens ?? 0),
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    messageCount: Number(row.message_count ?? 0)
  }))
  if (!pagination) return mapped

  const totalRows = await query<(RowDataPacket & { total: number })[]>('SELECT COUNT(*) AS total FROM conversations')
  return pageResult(mapped, Number(totalRows[0]?.total ?? 0), pagination)
}

export async function deleteConversation(id: string) {
  await ensureChatTables()
  return execute<ResultSetHeader>('DELETE FROM conversations WHERE id = ?', [id])
}

export async function countMessagesByConversation(conversationId: string) {
  await ensureChatTables()
  const rows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total
     FROM messages
     WHERE conversation_id = ?`,
    [conversationId]
  )

  return Number(rows[0]?.total ?? 0)
}

export async function listRecentMessages(conversationId: string, limit = 10) {
  await ensureChatTables()
  const rows = await query<MessageRow[]>(
    `SELECT id, conversation_id, role, content, metadata_json, model, usage_json, sequence, created_at
     FROM messages
     WHERE conversation_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [conversationId, limit]
  )

  return rows.reverse().map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: parseJson(row.metadata_json, null),
    model: row.model ?? undefined,
    usage: parseJson(row.usage_json, null),
    sequence: row.sequence ?? undefined,
    createdAt: row.created_at
  }))
}

export async function listMessagesByConversation(conversationId: string): Promise<MessageListItem[]>
export async function listMessagesByConversation(conversationId: string, pagination: PaginationOptions): Promise<PageResult<MessageListItem>>
export async function listMessagesByConversation(
  conversationId: string,
  pagination?: PaginationOptions
): Promise<MessageListItem[] | PageResult<MessageListItem>> {
  await ensureChatTables()
  const sql = `SELECT id, conversation_id, role, content, metadata_json, model, usage_json, sequence, created_at
               FROM messages
               WHERE conversation_id = ?
               ORDER BY created_at ASC, id ASC`
  const rows = pagination
    ? await query<MessageRow[]>(`${sql} LIMIT ? OFFSET ?`, [conversationId, pagination.pageSize, pagination.offset])
    : await query<MessageRow[]>(sql, [conversationId])

  const mapped = rows.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: parseJson(row.metadata_json, null),
    model: row.model ?? undefined,
    usage: parseJson(row.usage_json, null),
    sequence: row.sequence ?? undefined,
    createdAt: row.created_at
  }))
  if (!pagination) return mapped

  const totalRows = await query<(RowDataPacket & { total: number })[]>(
    'SELECT COUNT(*) AS total FROM messages WHERE conversation_id = ?',
    [conversationId]
  )
  return pageResult(mapped, Number(totalRows[0]?.total ?? 0), pagination)
}

function readUsageTokens(usage: unknown) {
  if (!usage || typeof usage !== 'object') return 0
  const record = usage as Record<string, unknown>
  return Number(record.total_tokens ?? record.totalTokens ?? 0) || 0
}

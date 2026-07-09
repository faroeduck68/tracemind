import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'
import { parseJson, stringifyJson } from '../utils/json'

export type ConversationRow = RowDataPacket & {
  id: string
  title: string
  model: string
  status: string
  created_at: string
  updated_at: string
}

export type MessageRow = RowDataPacket & {
  id: number
  conversation_id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  model: string | null
  usage_json: unknown
  sequence: number | null
  created_at: string
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

  await ensureMessageSequenceColumn()

  chatTablesReady = true
}

async function ensureMessageSequenceColumn() {
  const rows = await query<RowDataPacket[]>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'messages'
       AND COLUMN_NAME = 'sequence'`
  )

  if (!rows.length) {
    await execute(`ALTER TABLE messages ADD COLUMN sequence INT NULL AFTER usage_json`)
  }
}

export async function createConversation(input: { id: string; title: string; model: string }) {
  await ensureChatTables()
  await execute(
    `INSERT INTO conversations (id, title, model, status)
     VALUES (?, ?, ?, 'active')`,
    [input.id, input.title, input.model]
  )
}

export async function findConversation(id: string) {
  await ensureChatTables()
  const rows = await query<ConversationRow[]>(
    `SELECT id, title, model, status, created_at, updated_at
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

export async function createMessage(input: {
  conversationId: string
  role: 'system' | 'user' | 'assistant'
  content: string
  model?: string | null
  usage?: unknown
  sequence?: number | null
}) {
  await ensureChatTables()
  const result = await execute<ResultSetHeader>(
    `INSERT INTO messages (conversation_id, role, content, model, usage_json, sequence)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.conversationId, input.role, input.content, input.model ?? null, stringifyJson(input.usage ?? null), input.sequence ?? null]
  )

  return result.insertId
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
    `SELECT id, conversation_id, role, content, model, usage_json, sequence, created_at
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
    model: row.model ?? undefined,
    usage: parseJson(row.usage_json, null),
    sequence: row.sequence ?? undefined,
    createdAt: row.created_at
  }))
}

export async function listMessagesByConversation(conversationId: string) {
  await ensureChatTables()
  const rows = await query<MessageRow[]>(
    `SELECT id, conversation_id, role, content, model, usage_json, sequence, created_at
     FROM messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC, id ASC`,
    [conversationId]
  )

  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    model: row.model ?? undefined,
    usage: parseJson(row.usage_json, null),
    sequence: row.sequence ?? undefined,
    createdAt: row.created_at
  }))
}

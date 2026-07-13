import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query, withTransaction } from '../config/db'
import { stringifyJson } from '../utils/json'
import { pageResult, PaginationOptions, PageResult } from '../utils/pagination'

export type RetrievalMode = 'keyword' | 'fulltext' | 'hybrid' | 'vector'

export type KnowledgeBaseRow = RowDataPacket & {
  id: number
  name: string
  description: string | null
  embedding_model: string | null
  chunk_size: number
  chunk_overlap: number
  retrieval_mode: RetrievalMode
  top_k: number
  document_count: number
  chunk_count: number
  status: string
  owner_user_id: string | null
  created_at: string
  updated_at: string
}

export type KnowledgeDocumentRow = RowDataPacket & {
  id: number
  knowledge_base_id: number
  owner_user_id: string | null
  filename: string
  title: string | null
  file_type: string | null
  file_size: number | null
  file_path: string | null
  parse_status: string
  chunk_count: number
  created_at: string
}

export type KnowledgeChunkSearchRow = RowDataPacket & {
  id: number
  knowledge_base_id: number
  document_id: number
  chunk_index: number
  content: string
  token_count: number
  metadata: unknown
  created_at: string
  title: string | null
  filename: string | null
  score: number
}

export type KnowledgeBaseInput = {
  name: string
  description?: string | null
  embedding_model?: string | null
  chunk_size: number
  chunk_overlap: number
  retrieval_mode: RetrievalMode
  top_k: number
  owner_user_id: string
}

export type KnowledgeDocumentInput = {
  knowledgeBaseId: number
  ownerUserId: string
  filename: string
  title?: string | null
  fileType?: string | null
  fileSize?: number | null
  filePath?: string | null
  chunks: Array<{ content: string; metadata?: Record<string, unknown> }>
}

export type KnowledgeBaseUpdateInput = Omit<KnowledgeBaseInput, 'owner_user_id'>

let knowledgeSchemaReady = false

export async function ensureKnowledgeSchema() {
  if (knowledgeSchemaReady) return

  await ensureKnowledgeBaseColumns()
  await ensureKnowledgeDocumentColumns()

  knowledgeSchemaReady = true
}

export async function listKnowledgeBases(ownerUserId: string): Promise<KnowledgeBaseRow[]>
export async function listKnowledgeBases(ownerUserId: string, pagination: PaginationOptions): Promise<PageResult<KnowledgeBaseRow>>
export async function listKnowledgeBases(ownerUserId: string, pagination?: PaginationOptions) {
  await ensureKnowledgeSchema()
  const sql = `SELECT id, name, description, embedding_model, chunk_size, chunk_overlap, retrieval_mode, top_k,
                      document_count, chunk_count, status, owner_user_id, created_at, updated_at
               FROM knowledge_bases
               WHERE ${visibleKnowledgeBaseWhere()}
               ORDER BY updated_at DESC`
  const params = visibleKnowledgeBaseParams(ownerUserId)
  if (!pagination) return query<KnowledgeBaseRow[]>(sql, params)

  const rows = await query<KnowledgeBaseRow[]>(`${sql} LIMIT ? OFFSET ?`, [...params, pagination.pageSize, pagination.offset])
  const totalRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM knowledge_bases WHERE ${visibleKnowledgeBaseWhere()}`,
    params
  )
  return pageResult(rows, Number(totalRows[0]?.total ?? 0), pagination)
}

export async function findKnowledgeBaseById(id: number, ownerUserId: string) {
  await ensureKnowledgeSchema()
  const rows = await query<KnowledgeBaseRow[]>(
    `SELECT id, name, description, embedding_model, chunk_size, chunk_overlap, retrieval_mode, top_k,
            document_count, chunk_count, status, owner_user_id, created_at, updated_at
     FROM knowledge_bases
     WHERE id = ? AND ${visibleKnowledgeBaseWhere()}
     LIMIT 1`,
    [id, ...visibleKnowledgeBaseParams(ownerUserId)]
  )

  return rows[0] ?? null
}

export async function findKnowledgeBaseByName(name: string, ownerUserId: string) {
  await ensureKnowledgeSchema()
  const rows = await query<KnowledgeBaseRow[]>(
    `SELECT id, name, description, embedding_model, chunk_size, chunk_overlap, retrieval_mode, top_k,
            document_count, chunk_count, status, owner_user_id, created_at, updated_at
     FROM knowledge_bases
     WHERE name = ? AND ${visibleKnowledgeBaseWhere()}
     ORDER BY CASE WHEN owner_user_id = ? THEN 0 ELSE 1 END, updated_at DESC
     LIMIT 1`,
    [name, ...visibleKnowledgeBaseParams(ownerUserId), ownerUserId]
  )
  return rows[0] ?? null
}

export async function findDefaultKnowledgeBase(ownerUserId: string) {
  await ensureKnowledgeSchema()
  const rows = await query<KnowledgeBaseRow[]>(
    `SELECT id, name, description, embedding_model, chunk_size, chunk_overlap, retrieval_mode, top_k,
            document_count, chunk_count, status, owner_user_id, created_at, updated_at
     FROM knowledge_bases
     WHERE status = 'normal' AND ${visibleKnowledgeBaseWhere()}
     ORDER BY
       CASE WHEN owner_user_id = ? THEN 0 ELSE 1 END,
       chunk_count DESC,
       updated_at DESC
     LIMIT 1`,
    [...visibleKnowledgeBaseParams(ownerUserId), ownerUserId]
  )

  return rows[0] ?? null
}

export async function createKnowledgeBase(input: KnowledgeBaseInput) {
  await ensureKnowledgeSchema()
  const result = await execute<ResultSetHeader>(
    `INSERT INTO knowledge_bases
     (name, description, embedding_model, chunk_size, chunk_overlap, retrieval_mode, top_k, owner_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.description ?? null,
      input.embedding_model ?? 'local-keyword-v1',
      input.chunk_size,
      input.chunk_overlap,
      input.retrieval_mode,
      input.top_k,
      input.owner_user_id
    ]
  )

  return result.insertId
}

export async function updateKnowledgeBaseById(id: number, ownerUserId: string, input: KnowledgeBaseUpdateInput) {
  await ensureKnowledgeSchema()
  const result = await execute<ResultSetHeader>(
    `UPDATE knowledge_bases
     SET name = ?, description = ?, embedding_model = ?, chunk_size = ?, chunk_overlap = ?,
         retrieval_mode = ?, top_k = ?
     WHERE id = ? AND owner_user_id = ?`,
    [
      input.name,
      input.description ?? null,
      input.embedding_model ?? 'local-keyword-v1',
      input.chunk_size,
      input.chunk_overlap,
      input.retrieval_mode,
      input.top_k,
      id,
      ownerUserId
    ]
  )
  return result.affectedRows > 0
}

export async function deleteKnowledgeBaseById(id: number, ownerUserId: string) {
  await ensureKnowledgeSchema()
  const result = await execute<ResultSetHeader>(
    'DELETE FROM knowledge_bases WHERE id = ? AND owner_user_id = ?',
    [id, ownerUserId]
  )
  return result.affectedRows > 0
}

export async function createKnowledgeDocument(input: KnowledgeDocumentInput) {
  await ensureKnowledgeSchema()
  return withTransaction(async (connection) => {
    const knowledgeBase = await findKnowledgeBaseByIdForUpdate(connection, input.knowledgeBaseId, input.ownerUserId)
    if (!knowledgeBase) throw new Error('Knowledge base not found')

    const [documentResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO knowledge_documents
       (knowledge_base_id, owner_user_id, filename, title, file_type, file_size, file_path, parse_status, chunk_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'parsed', ?)`,
      [
        input.knowledgeBaseId,
        input.ownerUserId,
        input.filename,
        input.title ?? input.filename,
        input.fileType ?? null,
        input.fileSize ?? null,
        input.filePath ?? null,
        input.chunks.length
      ]
    )

    const documentId = documentResult.insertId
    if (input.chunks.length > 0) {
      const values = input.chunks.map((chunk, index) => [
        input.knowledgeBaseId,
        documentId,
        index,
        chunk.content,
        chunk.content.length,
        stringifyJson({ source: input.filename, title: input.title ?? input.filename, ...(chunk.metadata ?? {}) })
      ])
      await connection.query(
        `INSERT INTO knowledge_chunks
         (knowledge_base_id, document_id, chunk_index, content, token_count, metadata)
         VALUES ?`,
        [values]
      )
    }

    await connection.execute(
      `UPDATE knowledge_bases
       SET document_count = document_count + 1, chunk_count = chunk_count + ?
       WHERE id = ?`,
      [input.chunks.length, input.knowledgeBaseId]
    )

    return documentId
  })
}

export async function findKnowledgeDocumentById(documentId: number, ownerUserId: string) {
  await ensureKnowledgeSchema()
  const rows = await query<KnowledgeDocumentRow[]>(
    `SELECT d.id, d.knowledge_base_id, d.owner_user_id, d.filename, d.title, d.file_type, d.file_size,
            d.file_path, d.parse_status, d.chunk_count, d.created_at
     FROM knowledge_documents d
     INNER JOIN knowledge_bases b ON b.id = d.knowledge_base_id
     WHERE d.id = ? AND ${visibleKnowledgeBaseWhere('b')}
     LIMIT 1`,
    [documentId, ...visibleKnowledgeBaseParams(ownerUserId, 'b')]
  )

  return rows[0] ?? null
}

export async function listKnowledgeDocumentsByBaseId(knowledgeBaseId: number, ownerUserId: string): Promise<KnowledgeDocumentRow[]>
export async function listKnowledgeDocumentsByBaseId(
  knowledgeBaseId: number,
  ownerUserId: string,
  pagination: PaginationOptions
): Promise<PageResult<KnowledgeDocumentRow>>
export async function listKnowledgeDocumentsByBaseId(knowledgeBaseId: number, ownerUserId: string, pagination?: PaginationOptions) {
  await ensureKnowledgeSchema()
  const sql = `SELECT d.id, d.knowledge_base_id, d.owner_user_id, d.filename, d.title, d.file_type, d.file_size,
                      d.file_path, d.parse_status, d.chunk_count, d.created_at
               FROM knowledge_documents d
               INNER JOIN knowledge_bases b ON b.id = d.knowledge_base_id
               WHERE d.knowledge_base_id = ? AND ${visibleKnowledgeBaseWhere('b')}
               ORDER BY d.created_at DESC, d.id DESC`
  const params = [knowledgeBaseId, ...visibleKnowledgeBaseParams(ownerUserId, 'b')]
  if (!pagination) return query<KnowledgeDocumentRow[]>(sql, params)

  const rows = await query<KnowledgeDocumentRow[]>(`${sql} LIMIT ? OFFSET ?`, [...params, pagination.pageSize, pagination.offset])
  const totalRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total
     FROM knowledge_documents d
     INNER JOIN knowledge_bases b ON b.id = d.knowledge_base_id
     WHERE d.knowledge_base_id = ? AND ${visibleKnowledgeBaseWhere('b')}`,
    params
  )
  return pageResult(rows, Number(totalRows[0]?.total ?? 0), pagination)
}

export async function deleteKnowledgeDocumentById(documentId: number, ownerUserId: string) {
  await ensureKnowledgeSchema()
  return withTransaction(async (connection) => {
    const [rows] = await connection.execute<KnowledgeDocumentRow[]>(
      `SELECT d.id, d.knowledge_base_id, d.chunk_count
       FROM knowledge_documents d
       INNER JOIN knowledge_bases b ON b.id = d.knowledge_base_id
       WHERE d.id = ? AND ${visibleKnowledgeBaseWhere('b')}
       FOR UPDATE`,
      [documentId, ...visibleKnowledgeBaseParams(ownerUserId, 'b')]
    )
    const document = rows[0]
    if (!document) return false

    await connection.execute(`DELETE FROM knowledge_documents WHERE id = ?`, [documentId])
    await connection.execute(
      `UPDATE knowledge_bases
       SET document_count = GREATEST(document_count - 1, 0),
           chunk_count = GREATEST(chunk_count - ?, 0)
       WHERE id = ?`,
      [Number(document.chunk_count ?? 0), document.knowledge_base_id]
    )

    return true
  })
}

export async function searchKnowledgeChunks(input: {
  knowledgeBaseId: number
  ownerUserId: string
  query: string
  topK: number
}) {
  await ensureKnowledgeSchema()
  const terms = tokenizeQuery(input.query)
  if (terms.length === 0) return []

  const scoreExpression = terms.map(() => '(CASE WHEN c.content LIKE ? THEN 1 ELSE 0 END)').join(' + ')
  const likeParams = terms.map((term) => `%${term}%`)
  const whereExpression = terms.map(() => 'c.content LIKE ?').join(' OR ')

  return query<KnowledgeChunkSearchRow[]>(
    `SELECT c.id, c.knowledge_base_id, c.document_id, c.chunk_index, c.content, c.token_count, c.metadata, c.created_at,
            d.title, d.filename,
            (${scoreExpression}) / ? AS score
     FROM knowledge_chunks c
     INNER JOIN knowledge_documents d ON d.id = c.document_id
     INNER JOIN knowledge_bases b ON b.id = c.knowledge_base_id
     WHERE c.knowledge_base_id = ?
       AND ${visibleKnowledgeBaseWhere('b')}
       AND (${whereExpression})
     ORDER BY score DESC, c.token_count DESC, c.created_at DESC, c.chunk_index ASC
     LIMIT ?`,
    [
      ...likeParams,
      terms.length,
      input.knowledgeBaseId,
      ...visibleKnowledgeBaseParams(input.ownerUserId, 'b'),
      ...likeParams,
      input.topK
    ]
  )
}

function tokenizeQuery(value: string) {
  const normalized = value
    .replace(/[，。！？；：、,.!?;:\n\r\t()[\]{}"'“”‘’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const terms = new Set<string>()
  for (const part of normalized.split(' ')) {
    const token = part.trim()
    if (token.length >= 2) terms.add(token.slice(0, 60))
  }

  return [...terms].slice(0, 12)
}

async function findKnowledgeBaseByIdForUpdate(connection: PoolConnection, id: number, ownerUserId: string) {
  const [rows] = await connection.execute<KnowledgeBaseRow[]>(
    `SELECT id, name, description, embedding_model, chunk_size, chunk_overlap, retrieval_mode, top_k,
            document_count, chunk_count, status, owner_user_id, created_at, updated_at
     FROM knowledge_bases
     WHERE id = ? AND ${visibleKnowledgeBaseWhere()} AND status = 'normal'
     FOR UPDATE`,
    [id, ...visibleKnowledgeBaseParams(ownerUserId)]
  )

  return rows[0] ?? null
}

async function ensureKnowledgeBaseColumns() {
  const columns = await listColumns('knowledge_bases')
  const migrations = [
    ['owner_user_id', `ALTER TABLE knowledge_bases ADD COLUMN owner_user_id VARCHAR(80) DEFAULT 'default_user' AFTER status`]
  ] as const

  for (const [column, sql] of migrations) {
    if (!columns.has(column)) await execute(sql)
  }
}

async function ensureKnowledgeDocumentColumns() {
  const columns = await listColumns('knowledge_documents')
  const migrations = [
    ['owner_user_id', `ALTER TABLE knowledge_documents ADD COLUMN owner_user_id VARCHAR(80) DEFAULT 'default_user' AFTER knowledge_base_id`],
    ['title', `ALTER TABLE knowledge_documents ADD COLUMN title VARCHAR(255) NULL AFTER filename`]
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

function visibleKnowledgeBaseWhere(alias = '') {
  const prefix = alias ? `${alias}.` : ''
  return `(${prefix}owner_user_id = ? OR ${prefix}owner_user_id IN ('default_user', 'public', 'default') OR ${prefix}owner_user_id IS NULL)`
}

function visibleKnowledgeBaseParams(ownerUserId: string, _alias = '') {
  return [ownerUserId || 'default_user']
}

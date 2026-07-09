import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'
import { stringifyJson } from '../utils/json'

export type KnowledgeBaseRow = RowDataPacket & {
  id: number
  name: string
  description: string | null
  embedding_model: string | null
  chunk_size: number
  chunk_overlap: number
  retrieval_mode: string
  top_k: number
  document_count: number
  chunk_count: number
  status: string
  created_at: string
  updated_at: string
}

export type KnowledgeBaseInput = {
  name?: string
  description?: string | null
  embedding_model?: string | null
  chunk_size?: number
  chunk_overlap?: number
  retrieval_mode?: string
  top_k?: number
}

export async function listKnowledgeBases() {
  return query<KnowledgeBaseRow[]>(
    `SELECT id, name, description, embedding_model, chunk_size, chunk_overlap, retrieval_mode, top_k, document_count, chunk_count, status, created_at, updated_at
     FROM knowledge_bases
     ORDER BY updated_at DESC`
  )
}

export async function findKnowledgeBaseById(id: number) {
  const rows = await query<KnowledgeBaseRow[]>(
    `SELECT id, name, description, embedding_model, chunk_size, chunk_overlap, retrieval_mode, top_k, document_count, chunk_count, status, created_at, updated_at
     FROM knowledge_bases
     WHERE id = ?`,
    [id]
  )

  return rows[0] ?? null
}

export async function createKnowledgeBase(input: KnowledgeBaseInput) {
  const result = await execute<ResultSetHeader>(
    `INSERT INTO knowledge_bases
     (name, description, embedding_model, chunk_size, chunk_overlap, retrieval_mode, top_k)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.description ?? null,
      input.embedding_model ?? 'mock-embedding-v1',
      input.chunk_size ?? 800,
      input.chunk_overlap ?? 120,
      input.retrieval_mode ?? 'hybrid',
      input.top_k ?? 5
    ]
  )

  return result.insertId
}

export async function createKnowledgeDocument(input: {
  knowledgeBaseId: number
  filename: string
  fileType?: string
  fileSize?: number
  filePath?: string
  chunks: string[]
}) {
  const result = await execute<ResultSetHeader>(
    `INSERT INTO knowledge_documents
     (knowledge_base_id, filename, file_type, file_size, file_path, parse_status, chunk_count)
     VALUES (?, ?, ?, ?, ?, 'parsed', ?)`,
    [
      input.knowledgeBaseId,
      input.filename,
      input.fileType ?? null,
      input.fileSize ?? null,
      input.filePath ?? null,
      input.chunks.length
    ]
  )

  const documentId = result.insertId
  for (const [index, content] of input.chunks.entries()) {
    await execute(
      `INSERT INTO knowledge_chunks
       (knowledge_base_id, document_id, chunk_index, content, token_count, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.knowledgeBaseId, documentId, index, content, content.length, stringifyJson({ source: input.filename })]
    )
  }

  await execute(
    `UPDATE knowledge_bases
     SET document_count = document_count + 1, chunk_count = chunk_count + ?
     WHERE id = ?`,
    [input.chunks.length, input.knowledgeBaseId]
  )

  return documentId
}

export async function searchKnowledgeChunks(knowledgeBaseId: number, keyword: string, limit: number) {
  const like = `%${keyword}%`
  return query<RowDataPacket[]>(
    `SELECT id, knowledge_base_id, document_id, chunk_index, content, token_count, metadata, created_at
     FROM knowledge_chunks
     WHERE knowledge_base_id = ? AND content LIKE ?
     ORDER BY chunk_index ASC
     LIMIT ?`,
    [knowledgeBaseId, like, limit]
  )
}

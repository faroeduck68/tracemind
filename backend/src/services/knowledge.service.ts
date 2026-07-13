import fs from 'fs/promises'
import path from 'path'
import {
  createKnowledgeBase,
  createKnowledgeDocument,
  deleteKnowledgeBaseById,
  deleteKnowledgeDocumentById,
  findDefaultKnowledgeBase,
  findKnowledgeBaseById,
  findKnowledgeBaseByName,
  findKnowledgeDocumentById,
  listKnowledgeBases,
  listKnowledgeDocumentsByBaseId,
  RetrievalMode,
  searchKnowledgeChunks,
  updateKnowledgeBaseById
} from '../models/knowledge.model'
import { PaginationOptions } from '../utils/pagination'

const retrievalModes = new Set<RetrievalMode>(['keyword', 'fulltext', 'hybrid', 'vector'])
const defaultQuery = '财务风险 资产负债率 经营现金流 盈利能力'

export type KnowledgeSearchInput = {
  knowledgeBaseId?: number | null
  knowledgeBaseName?: string | null
  query?: string
  topK?: number
  retrievalMode?: RetrievalMode
  userId?: string
}

export async function getKnowledgeBases(userId = 'default_user', pagination?: PaginationOptions) {
  const normalizedUserId = normalizeUserId(userId)
  return pagination ? listKnowledgeBases(normalizedUserId, pagination) : listKnowledgeBases(normalizedUserId)
}

export async function getKnowledgeBase(id: number, userId = 'default_user') {
  return findKnowledgeBaseById(id, normalizeUserId(userId))
}

export async function addKnowledgeBase(input: Record<string, unknown>, userId = 'default_user') {
  const normalized = validateKnowledgeBaseInput(input, normalizeUserId(userId))
  return createKnowledgeBase(normalized)
}

export async function editKnowledgeBase(id: number, input: Record<string, unknown>, userId = 'default_user') {
  const normalizedUserId = normalizeUserId(userId)
  await requireKnowledgeBase(id, normalizedUserId)
  const normalized = validateKnowledgeBaseInput(input, normalizedUserId)
  const updated = await updateKnowledgeBaseById(id, normalizedUserId, normalized)
  if (!updated) throw new Error('Knowledge base cannot be edited by current user')
  return findKnowledgeBaseById(id, normalizedUserId)
}

export async function removeKnowledgeBase(id: number, userId = 'default_user') {
  const normalizedUserId = normalizeUserId(userId)
  await requireKnowledgeBase(id, normalizedUserId)
  const deleted = await deleteKnowledgeBaseById(id, normalizedUserId)
  if (!deleted) throw new Error('Knowledge base cannot be deleted by current user')
  return { deleted: true }
}

export async function addKnowledgeDocument(knowledgeBaseId: number, input: Record<string, unknown>, userId = 'default_user') {
  const knowledgeBase = await requireKnowledgeBase(knowledgeBaseId, userId)
  const content = readString(input.content)
  if (!content) throw new Error('content is required')

  const chunks = splitTextIntoChunks(content, {
    chunkSize: Number(input.chunkSize ?? knowledgeBase.chunk_size),
    chunkOverlap: Number(input.chunkOverlap ?? knowledgeBase.chunk_overlap)
  }).map((chunk, index) => ({ content: chunk, metadata: { importType: 'text', chunkIndex: index } }))

  const id = await createKnowledgeDocument({
    knowledgeBaseId,
    ownerUserId: normalizeUserId(userId),
    filename: readString(input.filename) || 'document.txt',
    title: readString(input.title) || readString(input.filename) || 'Untitled document',
    fileType: readString(input.fileType) || 'text/plain',
    fileSize: content.length,
    filePath: readString(input.filePath) || undefined,
    chunks
  })

  return { documentId: id, chunkCount: chunks.length, status: 'parsed' }
}

export async function importKnowledgeDocumentFromFile(
  knowledgeBaseId: number,
  input: Record<string, unknown>,
  userId = 'default_user'
) {
  const knowledgeBase = await requireKnowledgeBase(knowledgeBaseId, userId)
  const file = await resolveUploadedFile(input)
  const parsed = await parseFileToText(file.absolutePath)
  if (!parsed.text.trim()) throw new Error('Uploaded file did not contain readable text')

  const title = readString(input.title) || file.originalName || path.basename(file.absolutePath)
  const chunks = splitTextIntoChunks(parsed.text, {
    chunkSize: Number(input.chunkSize ?? knowledgeBase.chunk_size),
    chunkOverlap: Number(input.chunkOverlap ?? knowledgeBase.chunk_overlap)
  }).map((chunk, index) => ({
    content: chunk,
    metadata: {
      importType: 'file',
      parser: parsed.parser,
      pageCount: parsed.pages,
      chunkIndex: index
    }
  }))

  const documentId = await createKnowledgeDocument({
    knowledgeBaseId,
    ownerUserId: normalizeUserId(userId),
    filename: file.originalName || path.basename(file.absolutePath),
    title,
    fileType: parsed.fileType,
    fileSize: file.size,
    filePath: file.relativePath,
    chunks
  })

  return { documentId, chunkCount: chunks.length, status: 'parsed' }
}

export async function getKnowledgeDocument(documentId: number, userId = 'default_user') {
  return findKnowledgeDocumentById(documentId, normalizeUserId(userId))
}

export async function getKnowledgeDocuments(knowledgeBaseId: number, userId = 'default_user', pagination?: PaginationOptions) {
  await requireKnowledgeBase(knowledgeBaseId, userId)
  const normalizedUserId = normalizeUserId(userId)
  return pagination
    ? listKnowledgeDocumentsByBaseId(knowledgeBaseId, normalizedUserId, pagination)
    : listKnowledgeDocumentsByBaseId(knowledgeBaseId, normalizedUserId)
}

export async function deleteKnowledgeDocument(documentId: number, userId = 'default_user') {
  const deleted = await deleteKnowledgeDocumentById(documentId, normalizeUserId(userId))
  if (!deleted) throw new Error('Knowledge document not found')
  return { deleted: true }
}

export async function searchKnowledgeBase(input: KnowledgeSearchInput) {
  const userId = normalizeUserId(input.userId)
  const query = readString(input.query) || defaultQuery
  const topK = clampInteger(input.topK, 5, 1, 20)
  const explicitMode = normalizeRetrievalMode(input.retrievalMode)
  const knowledgeBase = input.knowledgeBaseId
    ? await findKnowledgeBaseById(Number(input.knowledgeBaseId), userId)
    : readString(input.knowledgeBaseName)
      ? await findKnowledgeBaseByName(readString(input.knowledgeBaseName), userId)
    : await findDefaultKnowledgeBase(userId)

  if (!knowledgeBase) {
    const requestedMode = explicitMode ?? 'keyword'
    const fallback = requestedMode !== 'keyword'
    return {
      query,
      knowledgeBaseId: input.knowledgeBaseId ?? null,
      retrievalMode: fallback ? 'keyword' : requestedMode,
      requestedRetrievalMode: requestedMode,
      fallback,
      results: []
    }
  }

  const requestedMode = explicitMode ?? knowledgeBase.retrieval_mode ?? 'keyword'
  const fallback = requestedMode !== 'keyword'
  const rows = await searchKnowledgeChunks({
    knowledgeBaseId: knowledgeBase.id,
    ownerUserId: userId,
    query,
    topK
  })

  return {
    query,
    knowledgeBaseId: knowledgeBase.id,
    retrievalMode: fallback ? 'keyword' : requestedMode,
    requestedRetrievalMode: requestedMode,
    fallback,
    results: rows.map((row) => ({
      chunkId: Number(row.id),
      documentId: Number(row.document_id),
      knowledgeBaseId: Number(row.knowledge_base_id),
      title: row.title || row.filename || `片段 ${row.chunk_index + 1}`,
      content: row.content,
      score: Number(Number(row.score ?? 0).toFixed(4)),
      source: 'knowledge_chunks',
      metadata: {
        fallback,
        requestedRetrievalMode: requestedMode,
        retrievalMode: fallback ? 'keyword' : requestedMode,
        chunkIndex: row.chunk_index,
        tokenCount: row.token_count
      }
    }))
  }
}

export function splitTextIntoChunks(content: string, options: { chunkSize: number; chunkOverlap: number }) {
  const chunkSize = clampInteger(options.chunkSize, 800, 300, 3000)
  const chunkOverlap = Math.min(Math.max(Math.trunc(options.chunkOverlap || 0), 0), chunkSize - 1)
  const blocks = splitIntoBlocks(content)
  const chunks: string[] = []
  let current = ''

  for (const block of blocks) {
    if (!block) continue
    if (block.length > chunkSize) {
      if (current) {
        chunks.push(current.trim())
        current = ''
      }
      chunks.push(...splitLongBlock(block, chunkSize, chunkOverlap))
      continue
    }

    const next = current ? `${current}\n\n${block}` : block
    if (next.length <= chunkSize) {
      current = next
      continue
    }

    if (current) chunks.push(current.trim())
    current = buildOverlap(current, chunkOverlap)
    current = current ? `${current}\n\n${block}` : block

    if (current.length > chunkSize) {
      chunks.push(...splitLongBlock(current, chunkSize, chunkOverlap))
      current = ''
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(Boolean)
}

async function parseFileToText(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.pdf') {
    const buffer = await fs.readFile(filePath)
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    const parsed = (await parser.getText()) as { text?: string; total?: number; pages?: unknown[] }
    return {
      text: parsed.text ?? '',
      parser: 'pdf-parse',
      pages: Number(parsed.total ?? parsed.pages?.length ?? 0),
      fileType: 'application/pdf'
    }
  }

  if (['.txt', '.md', '.markdown', '.csv'].includes(ext)) {
    return {
      text: await fs.readFile(filePath, 'utf8'),
      parser: 'fs-text',
      pages: 1,
      fileType: ext === '.csv' ? 'text/csv' : 'text/plain'
    }
  }

  throw new Error(`Unsupported knowledge import file type: ${ext || 'unknown'}`)
}

async function resolveUploadedFile(input: Record<string, unknown>) {
  const uploadRoot = path.resolve(process.cwd(), 'uploads', 'source')
  const filePath = readString(input.filePath)
  const fileId = readString(input.fileId)
  let absolutePath = ''

  if (filePath) {
    absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
  } else if (fileId) {
    const entries = await fs.readdir(uploadRoot)
    const found = entries.find((entry) => entry === fileId || entry.startsWith(`${fileId}-`) || entry.includes(fileId))
    if (found) absolutePath = path.resolve(uploadRoot, found)
  }

  if (!absolutePath) throw new Error('fileId or filePath is required')

  const resolved = path.resolve(absolutePath)
  if (!resolved.startsWith(`${uploadRoot}${path.sep}`) && resolved !== uploadRoot) {
    throw new Error('Only files uploaded under uploads/source can be imported into knowledge bases')
  }

  const stat = await fs.stat(resolved)
  if (!stat.isFile()) throw new Error('Uploaded file was not found')

  return {
    absolutePath: resolved,
    relativePath: path.relative(process.cwd(), resolved).replace(/\\/g, '/'),
    originalName: path.basename(resolved).replace(/^\d+-/, ''),
    size: stat.size
  }
}

async function requireKnowledgeBase(knowledgeBaseId: number, userId: string) {
  if (!Number.isInteger(knowledgeBaseId) || knowledgeBaseId <= 0) throw new Error('Valid knowledgeBaseId is required')
  const knowledgeBase = await findKnowledgeBaseById(knowledgeBaseId, normalizeUserId(userId))
  if (!knowledgeBase) throw new Error('Knowledge base not found')
  return knowledgeBase
}

function validateKnowledgeBaseInput(input: Record<string, unknown>, userId: string) {
  const name = readString(input.name)
  if (!name) throw new Error('name is required')

  const retrievalMode = normalizeRetrievalMode(input.retrievalMode) ?? 'keyword'
  const chunkSize = clampInteger(input.chunkSize, 800, 300, 3000)
  const chunkOverlap = clampInteger(input.chunkOverlap, 120, 0, chunkSize - 1)
  if (chunkOverlap >= chunkSize) throw new Error('chunkOverlap must be smaller than chunkSize')

  return {
    name,
    description: readString(input.description) || null,
    embedding_model: readString(input.embeddingModel) || 'local-keyword-v1',
    chunk_size: chunkSize,
    chunk_overlap: chunkOverlap,
    retrieval_mode: retrievalMode,
    top_k: clampInteger(input.topK, 5, 1, 20),
    owner_user_id: userId
  }
}

function normalizeRetrievalMode(value: unknown): RetrievalMode | undefined {
  const mode = readString(value) as RetrievalMode
  if (!mode) return undefined
  if (!retrievalModes.has(mode)) throw new Error('retrievalMode must be keyword, fulltext, hybrid, or vector')
  return mode
}

function splitIntoBlocks(content: string) {
  return content
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}|(?=^#{1,6}\s+)|(?=^[一二三四五六七八九十]+[、.．]\s*)|(?=^第[一二三四五六七八九十\d]+[章节部分])/m)
    .map((block) => block.replace(/\n{3,}/g, '\n\n').trim())
    .filter(Boolean)
}

function splitLongBlock(block: string, chunkSize: number, chunkOverlap: number) {
  const sentences = block
    .split(/(?<=[。！？.!?；;])\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences.length ? sentences : [block]) {
    if (sentence.length > chunkSize) {
      if (current) {
        chunks.push(current.trim())
        current = ''
      }
      chunks.push(...splitByLength(sentence, chunkSize, chunkOverlap))
      continue
    }

    const next = current ? `${current}${sentence}` : sentence
    if (next.length <= chunkSize) {
      current = next
    } else {
      if (current) chunks.push(current.trim())
      const overlap = buildOverlap(current, chunkOverlap)
      current = overlap ? `${overlap}${sentence}` : sentence
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks
}

function splitByLength(text: string, chunkSize: number, chunkOverlap: number) {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length)
    if (end < text.length) {
      const punctuation = Math.max(
        text.lastIndexOf('。', end),
        text.lastIndexOf('！', end),
        text.lastIndexOf('？', end),
        text.lastIndexOf('.', end),
        text.lastIndexOf('!', end),
        text.lastIndexOf('?', end)
      )
      if (punctuation > start + Math.floor(chunkSize * 0.6)) end = punctuation + 1
    }
    chunks.push(text.slice(start, end).trim())
    start = end >= text.length ? end : Math.max(end - chunkOverlap, start + 1)
  }

  return chunks.filter(Boolean)
}

function buildOverlap(text: string, chunkOverlap: number) {
  if (!text || chunkOverlap <= 0) return ''
  const tail = text.slice(-chunkOverlap)
  const boundary = Math.min(
    ...[tail.indexOf('。'), tail.indexOf('！'), tail.indexOf('？'), tail.indexOf('\n')]
      .filter((index) => index >= 0)
      .map((index) => index + 1)
  )
  return Number.isFinite(boundary) ? tail.slice(boundary).trim() : tail.trim()
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(Math.trunc(number), min), max)
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeUserId(userId?: string) {
  const normalized = readString(userId)
  return normalized || 'default_user'
}

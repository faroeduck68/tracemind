import {
  createKnowledgeBase,
  createKnowledgeDocument,
  findKnowledgeBaseById,
  listKnowledgeBases,
  searchKnowledgeChunks
} from '../models/knowledge.model'

export async function getKnowledgeBases() {
  return listKnowledgeBases()
}

export async function getKnowledgeBase(id: number) {
  return findKnowledgeBaseById(id)
}

export async function addKnowledgeBase(input: Record<string, unknown>) {
  return createKnowledgeBase({
    name: String(input.name),
    description: input.description ? String(input.description) : null,
    embedding_model: input.embeddingModel ? String(input.embeddingModel) : 'mock-embedding-v1',
    chunk_size: input.chunkSize ? Number(input.chunkSize) : 800,
    chunk_overlap: input.chunkOverlap ? Number(input.chunkOverlap) : 120,
    retrieval_mode: input.retrievalMode ? String(input.retrievalMode) : 'hybrid',
    top_k: input.topK ? Number(input.topK) : 5
  })
}

export async function addKnowledgeDocument(knowledgeBaseId: number, input: Record<string, unknown>) {
  const content = String(input.content ?? '')
  const chunks = content
    ? splitChunks(content, Number(input.chunkSize ?? 800))
    : ['第一版 mock 文档切片：用于验证知识库上传和检索闭环。']

  return createKnowledgeDocument({
    knowledgeBaseId,
    filename: String(input.filename ?? 'mock-document.txt'),
    fileType: input.fileType ? String(input.fileType) : 'text/plain',
    fileSize: content.length,
    filePath: input.filePath ? String(input.filePath) : undefined,
    chunks
  })
}

export async function searchKnowledgeBase(knowledgeBaseId: number, input: Record<string, unknown>) {
  const query = String(input.query ?? '')
  const topK = Number(input.topK ?? 5)
  return searchKnowledgeChunks(knowledgeBaseId, query, topK)
}

function splitChunks(content: string, chunkSize: number) {
  const chunks: string[] = []
  for (let index = 0; index < content.length; index += chunkSize) {
    chunks.push(content.slice(index, index + chunkSize))
  }
  return chunks
}

import { RetrievalMode } from '../models/knowledge.model'
import { searchKnowledgeBase } from '../services/knowledge.service'
import { WorkflowContext } from '../types/context'
import { TraceMindTool } from '../types/tool'

const fallbackQuery = '财务风险 资产负债率 经营现金流 盈利能力'

const knowledgeSearchTool: TraceMindTool = {
  name: 'knowledge_search_tool',
  displayName: '知识检索工具',
  async run(context) {
    const input = readCurrentNodeInput(context)
    const config = readRecord(input.config)
    const query =
      readString(input.query) ||
      readString(config?.queryTemplate) ||
      readString(context.query) ||
      readString((input as Record<string, unknown>).userInput) ||
      fallbackQuery
    const result = await searchKnowledgeBase({
      knowledgeBaseId: readOptionalNumber(input.knowledgeBaseId ?? config?.knowledgeBaseId),
      knowledgeBaseName: readString(input.knowledgeBaseName ?? config?.knowledgeBaseName),
      query,
      topK: readOptionalNumber(input.topK ?? config?.topK),
      retrievalMode: readString(input.retrievalMode ?? config?.retrievalMode) as RetrievalMode,
      userId: context.userId
    })

    return {
      success: true,
      output: {
        query: result.query,
        knowledgeBaseId: result.knowledgeBaseId,
        retrievalMode: result.retrievalMode,
        requestedRetrievalMode: result.requestedRetrievalMode,
        fallback: result.fallback,
        resultCount: result.results.length,
        results: result.results
      },
      message: `从本地知识库检索到 ${result.results.length} 条相关片段。`
    }
  }
}

function readCurrentNodeInput(context: WorkflowContext) {
  const currentNodeId = context.currentNodeId
  const input = currentNodeId ? context.nodeInputs[currentNodeId] : null
  return readRecord(input) ?? {}
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readOptionalNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : undefined
}

export default knowledgeSearchTool

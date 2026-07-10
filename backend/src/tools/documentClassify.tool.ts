import { classifyDocumentText } from '../services/documentClassifier.service'
import { TraceMindTool } from '../types/tool'

const documentClassifyTool: TraceMindTool = {
  name: 'document_classify_tool',
  displayName: '文档类型识别工具',
  async run(context) {
    const text = collectParsedText(context)
    const classification = classifyDocumentText(text)

    return {
      success: true,
      status: classification.type === 'unknown' ? 'partial_success' : 'success',
      output: {
        documentType: classification.type,
        confidence: classification.confidence,
        reason: classification.reason,
        matchedKeywords: classification.matchedKeywords,
        textPreview: classification.textPreview
      },
      message: '文档类型识别完成',
      reason: classification.reason
    }
  }
}

function collectParsedText(context: Parameters<TraceMindTool['run']>[0]) {
  const chunks: string[] = []
  for (const output of Object.values(context.nodeOutputs)) {
    if (output && typeof output === 'object' && typeof (output as { text?: unknown }).text === 'string') {
      chunks.push((output as { text: string }).text)
    }
  }
  return chunks.join('\n\n')
}

export default documentClassifyTool

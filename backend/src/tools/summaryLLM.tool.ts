import { env } from '../config/env'
import { callLLM } from '../services/llm.service'
import { TraceMindTool } from '../types/tool'

const summaryLLMTool: TraceMindTool = {
  name: 'summary_llm',
  displayName: '总结大模型工具',
  async run(context) {
    if (env.useRealLlm && !env.mockMode) {
      try {
        const result = await callLLM(
          [
            {
              role: 'system',
              content:
                '你是 TraceMind 的文档与工作流总结工具。请基于工作流上下文输出简洁、结构化的中文总结；不要编造上下文中没有的数据。'
            },
            {
              role: 'user',
              content: JSON.stringify({
                query: context.query,
                currentNodeId: context.currentNodeId,
                nodeInput: context.currentNodeId ? context.nodeInputs[context.currentNodeId] : undefined,
                nodeOutputs: context.nodeOutputs
              })
            }
          ],
          { temperature: 0.2, maxTokens: 900 }
        )

        return {
          success: true,
          output: {
            summary: result.content,
            mocked: false,
            provider: 'llm',
            model: result.model
          },
          message: 'LLM summary generated'
        }
      } catch (error) {
        if (!env.allowMockFallback) {
          return {
            success: false,
            output: {
              mocked: false,
              error: error instanceof Error ? error.message : 'Unknown LLM summary error'
            },
            message: error instanceof Error ? error.message : 'LLM summary failed'
          }
        }
      }
    }

    context.mockUsage ??= []
    context.mockUsage.push({ tool: 'summary_llm', reason: env.mockMode ? 'MOCK_MODE=true' : 'LLM fallback enabled' })
    return {
      success: true,
      output: buildFallbackSummary(context),
      message: '总结生成完成'
    }
  }
}

function buildFallbackSummary(context: Parameters<TraceMindTool['run']>[0]) {
  const text = collectParsedText(context)
  if (text.trim()) {
    return {
      summary: text.replace(/\s+/g, ' ').slice(0, 700),
      mocked: true,
      provider: 'mock',
      bullets: splitSentences(text).slice(0, 4)
    }
  }

  return {
    summary: '当前上下文没有足够的可总结正文。请上传可解析的 PDF、文本或 Markdown 文件后重试。',
    mocked: true,
    provider: 'mock',
    bullets: ['未获得足够正文。', '建议确认文件是否可复制文本，或换用文本版文件。']
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

function splitSentences(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/[。！？\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.length > 120 ? `${item.slice(0, 120)}...` : item))
}

export default summaryLLMTool

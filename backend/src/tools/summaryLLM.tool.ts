import { env } from '../config/env'
import { callLLM } from '../services/llm.service'
import { TraceMindTool } from '../types/tool'

const summaryLLMTool: TraceMindTool = {
  name: 'summary_llm',
  displayName: '总结大模型工具',
  async run(context) {
    const webSearchOutput = findWebSearchOutput(context)
    if (env.useRealLlm && !env.mockMode) {
      try {
        const result = await callLLM(
          [
            {
              role: 'system',
              content: webSearchOutput
                ? '你是 TraceMind 的联网搜索回答工具。只能基于提供的搜索结果回答。搜索结果不足、来源冲突或可信度不明时，必须明确说明信息不足。不允许编造、推测或用模型记忆补充任何实时数据。尽量在相关陈述后附来源链接。'
                : '你是 TraceMind 的文档与工作流总结工具。请基于工作流上下文输出简洁、结构化的中文总结；不要编造上下文中没有的数据。'
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
            ...(webSearchOutput ? { sources: webSearchOutput.sources } : {}),
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
      output: webSearchOutput ? buildFallbackSearchSummary(webSearchOutput) : buildFallbackSummary(context),
      message: '总结生成完成'
    }
  }
}

function findWebSearchOutput(context: Parameters<TraceMindTool['run']>[0]) {
  for (const output of Object.values(context.nodeOutputs)) {
    if (!output || typeof output !== 'object' || Array.isArray(output)) continue
    const record = output as Record<string, unknown>
    if (Array.isArray(record.results) && Array.isArray(record.sources) && typeof record.summary === 'string') {
      return { summary: record.summary, results: record.results, sources: record.sources }
    }
  }
  return null
}

function buildFallbackSearchSummary(output: NonNullable<ReturnType<typeof findWebSearchOutput>>) {
  const sources = output.sources
    .slice(0, 5)
    .map((source) => {
      if (!source || typeof source !== 'object') return ''
      const record = source as Record<string, unknown>
      const title = typeof record.title === 'string' ? record.title : '来源'
      const url = typeof record.url === 'string' ? record.url : ''
      return url ? `- [${title}](${url})` : ''
    })
    .filter(Boolean)
  return {
    summary: [
      output.summary || '搜索服务未返回可用摘要。',
      sources.length ? `来源：\n${sources.join('\n')}` : '来源不足，结果可靠性无法确认。'
    ].join('\n\n'),
    sources: output.sources,
    mocked: true,
    provider: 'search-fallback'
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

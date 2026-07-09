import { env } from '../config/env'
import { callLLM, parseLlmJson } from '../services/llm.service'
import { TraceMindTool } from '../types/tool'

type ExtractOutput = {
  sourceNode: string
  metrics: Record<string, unknown>
  warnings: string[]
  mocked: boolean
  extractor: string
}

const financialExtractTool: TraceMindTool = {
  name: 'financial_extract_tool',
  displayName: '财务指标提取工具',
  async run(context) {
    const text = collectParsedText(context)

    if (!text.trim()) {
      return {
        success: true,
        output: {
          sourceNode: 'none',
          metrics: {},
          warnings: ['未找到可用于提取的真实文本。'],
          mocked: false,
          extractor: 'empty-real-input'
        } satisfies ExtractOutput,
        message: '未找到可提取的真实文本'
      }
    }

    if (env.useRealLlm && !env.mockMode) {
      try {
        const result = await callLLM(
          [
            {
              role: 'system',
              content:
                '你是财报指标提取器。只返回 JSON，字段为 metrics、warnings。metrics 中只放从文本中能直接推断或明确抽取的指标，不要编造。'
            },
            {
              role: 'user',
              content: JSON.stringify({
                text: text.slice(0, 12000),
                schema: {
                  metrics: 'object，键名使用英文 camelCase，值可以是数字或字符串',
                  warnings: 'string[]，提取过程中的缺失信息或风险提示'
                }
              })
            }
          ],
          { json: true, temperature: 0, maxTokens: 1200 }
        )
        const parsed = parseLlmJson<{ metrics?: Record<string, unknown>; warnings?: string[] }>(result.content)

        return {
          success: true,
          output: {
            sourceNode: 'parsed_text',
            metrics: parsed.metrics ?? {},
            warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
            mocked: false,
            extractor: `llm:${result.model}`
          } satisfies ExtractOutput,
          message: '财务指标提取完成'
        }
      } catch (error) {
        if (!env.allowMockFallback) {
          return {
            success: false,
            output: {
              sourceNode: 'parsed_text',
              metrics: {},
              warnings: [error instanceof Error ? error.message : 'LLM extraction failed'],
              mocked: false,
              extractor: 'llm-error'
            } satisfies ExtractOutput,
            message: error instanceof Error ? error.message : '财务指标提取失败'
          }
        }
      }
    }

    context.mockUsage ??= []
    context.mockUsage.push({ tool: 'financial_extract_tool', reason: env.mockMode ? 'MOCK_MODE=true' : 'LLM fallback enabled' })

    return {
      success: true,
      output: {
        sourceNode: 'fallback',
        metrics: {},
        warnings: ['已启用 fallback，但未编造固定财务指标。'],
        mocked: true,
        extractor: 'fallback-empty'
      } satisfies ExtractOutput,
      message: '财务指标提取 fallback 完成'
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
  const nodeInput = context.currentNodeId ? context.nodeInputs[context.currentNodeId] : null
  const upstream = nodeInput && typeof nodeInput === 'object' ? (nodeInput as { upstreamOutputs?: Record<string, unknown> }).upstreamOutputs : null
  for (const output of Object.values(upstream ?? {})) {
    if (output && typeof output === 'object' && typeof (output as { text?: unknown }).text === 'string') {
      chunks.push((output as { text: string }).text)
    }
  }
  return chunks.join('\n\n')
}

export default financialExtractTool

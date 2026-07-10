import { env } from '../config/env'
import { callLLM, parseLlmJson } from '../services/llm.service'
import { TraceMindTool } from '../types/tool'

type ExtractOutput = {
  sourceNode: string
  metrics: Record<string, unknown>
  warnings: string[]
  error?: string
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
        success: false,
        output: {
          sourceNode: 'none',
          metrics: {},
          warnings: ['未找到可用于提取的真实文本。'],
          error: '未识别到财务数据',
          mocked: false,
          extractor: 'empty-real-input'
        } satisfies ExtractOutput,
        message: '未识别到财务数据，无法完成有效分析',
        errorMessage: '未识别到财务数据',
        businessFailure: true,
        reason: '上传文件没有可供财务指标提取的正文。'
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

        const metrics = parsed.metrics ?? {}
        const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : []
        if (Object.keys(metrics).length === 0) {
          return {
            success: false,
            output: {
              sourceNode: 'parsed_text',
              metrics: {},
              warnings: warnings.length ? warnings : ['未提取到指标，文件可能不是财务报表。'],
              error: '未识别到财务数据',
              mocked: false,
              extractor: `llm:${result.model}`
            } satisfies ExtractOutput,
            message: '未识别到财务数据，无法完成有效分析',
            errorMessage: '未识别到财务数据',
            businessFailure: true,
            reason: '解析文本中没有利润表、资产负债表、现金流量表或可用财务指标。'
          }
        }

        return {
          success: true,
          output: {
            sourceNode: 'parsed_text',
            metrics,
            warnings,
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
      success: false,
      output: {
        sourceNode: 'fallback',
        metrics: {},
        warnings: ['已启用 fallback，但未编造固定财务指标。'],
        error: '未识别到财务数据',
        mocked: true,
        extractor: 'fallback-empty'
      } satisfies ExtractOutput,
      message: '未识别到财务数据，无法完成有效分析',
      errorMessage: '未识别到财务数据',
      businessFailure: true,
      reason: 'fallback 不会编造财务指标，因此该文件不适合当前财务分析工作流。'
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

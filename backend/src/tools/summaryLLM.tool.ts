import { TraceMindTool } from '../types/tool'
import { env } from '../config/env'
import { callLLM } from '../services/llm.service'

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
              content: '你是 TraceMind 的风险总结工具。请基于工作流上下文输出简洁、结构化的中文总结。'
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
      output: {
        summary: '该财报整体收入保持增长，但现金流和负债结构值得关注。短期建议优先复核经营性现金流、应收账款和债务期限安排。',
        mocked: true,
        provider: 'mock',
        bullets: [
          '收入增长具备积极信号，但利润质量需要结合现金流验证。',
          '负债率偏高，需关注融资成本和偿债压力。',
          '建议补充同行业对比和历史趋势分析。'
        ]
      },
      message: '风险总结生成完成'
    }
  }
}

export default summaryLLMTool

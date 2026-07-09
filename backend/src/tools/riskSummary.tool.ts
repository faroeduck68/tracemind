import { TraceMindTool } from '../types/tool'

const riskSummaryTool: TraceMindTool = {
  name: 'risk_summary_tool',
  displayName: '风险总结工具',
  async run(context) {
    const riskOutput = Object.values(context.nodeOutputs).find(
      (output) => output && typeof output === 'object' && Array.isArray((output as { risks?: unknown }).risks)
    ) as { riskLevel?: string; risks?: unknown[]; suggestions?: unknown[] } | undefined

    return {
      success: true,
      output: {
        riskLevel: riskOutput?.riskLevel ?? 'unknown',
        risks: riskOutput?.risks ?? ['暂无可总结的真实风险项。'],
        recommendation: Array.isArray(riskOutput?.suggestions) ? riskOutput.suggestions.join('；') : '请补充真实财务指标后重新运行。',
        mocked: false,
        summarizer: 'context-real'
      },
      message: '风险总结完成'
    }
  }
}

export default riskSummaryTool

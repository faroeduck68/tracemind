import { TraceMindTool } from '../types/tool'

// report_generate_tool：任务书 §18.4，汇总指标与风险，生成 Markdown 报告。
const reportGenerateTool: TraceMindTool = {
  name: 'report_generate_tool',
  displayName: '报告生成工具',
  async run(context) {
    const extract = findMetricsOutput(context)
    const risk = findRiskOutput(context)

    const metrics = extract?.metrics ?? {}
    const risks = risk?.risks ?? []
    const suggestions = risk?.suggestions ?? (risk?.recommendation ? [risk.recommendation] : [])

    const markdown = [
      '# 财务风险分析报告',
      '',
      '## 一、核心指标',
      ...Object.entries(metrics).map(([key, value]) => `- ${key}：${String(value)}`),
      '',
      '## 二、风险分析',
      `整体风险等级：${risk?.riskLevel ?? '未知'}`,
      ...risks.map((item) => `- ${item}`),
      '',
      '## 三、建议',
      ...suggestions.map((item) => `- ${item}`)
    ].join('\n')

    return {
      success: true,
      output: { markdown },
      message: 'Markdown 报告生成完成'
    }
  }
}

function findMetricsOutput(context: Parameters<TraceMindTool['run']>[0]) {
  return Object.values(context.nodeOutputs).find(
    (output) => output && typeof output === 'object' && (output as { metrics?: unknown }).metrics
  ) as { metrics?: Record<string, unknown> } | undefined
}

function findRiskOutput(context: Parameters<TraceMindTool['run']>[0]) {
  return Object.values(context.nodeOutputs).find(
    (output) =>
      output &&
      typeof output === 'object' &&
      (typeof (output as { riskLevel?: unknown }).riskLevel === 'string' ||
        Array.isArray((output as { risks?: unknown }).risks) ||
        Array.isArray((output as { suggestions?: unknown }).suggestions) ||
        typeof (output as { recommendation?: unknown }).recommendation === 'string')
  ) as { riskLevel?: string; risks?: string[]; suggestions?: string[]; recommendation?: string } | undefined
}

export default reportGenerateTool

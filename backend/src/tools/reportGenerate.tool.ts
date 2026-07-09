import { TraceMindTool } from '../types/tool'

// report_generate_tool：任务书 §18.4，汇总指标与风险，生成 Markdown 报告。
const reportGenerateTool: TraceMindTool = {
  name: 'report_generate_tool',
  displayName: '报告生成工具',
  async run(context) {
    const extract = context.nodeOutputs.extract as { metrics?: Record<string, unknown> } | undefined
    const risk = context.nodeOutputs.risk as { riskLevel?: string; risks?: string[]; suggestions?: string[] } | undefined

    const metrics = extract?.metrics ?? {}
    const risks = risk?.risks ?? []
    const suggestions = risk?.suggestions ?? []

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

export default reportGenerateTool

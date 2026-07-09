import { TraceMindTool } from '../types/tool'

const reportOutputFinalTool: TraceMindTool = {
  name: 'report_output_tool',
  displayName: '报告结果输出工具',
  async run(context) {
    const docx = findOutput<{ downloadUrl?: string; mocked?: boolean }>(context, 'downloadUrl')
    const report = findOutput<{ markdown?: string }>(context, 'markdown')
    const risk = findOutput<{ riskLevel?: string; risks?: unknown[]; suggestions?: unknown[]; recommendation?: string }>(context, 'riskLevel')

    const summary = buildSummary(risk, report)
    const result = {
      message: '工作流执行完成',
      downloadUrl: docx?.downloadUrl,
      summary,
      riskLevel: risk?.riskLevel ?? 'unknown',
      reportPreview: report?.markdown?.slice(0, 600),
      mocked: Boolean(docx?.mocked),
      source: 'workflow-context'
    }

    context.finalResult = result

    return {
      success: true,
      output: result,
      message: '结果输出完成'
    }
  }
}

function findOutput<T>(context: Parameters<TraceMindTool['run']>[0], key: string): T | undefined {
  return Object.values(context.nodeOutputs).find((output) => output && typeof output === 'object' && key in output) as T | undefined
}

function buildSummary(
  risk?: { riskLevel?: string; risks?: unknown[]; suggestions?: unknown[]; recommendation?: string },
  report?: { markdown?: string }
) {
  if (risk) {
    const risks = Array.isArray(risk.risks) ? risk.risks.map(String).slice(0, 3).join('；') : ''
    const suggestions = Array.isArray(risk.suggestions) ? risk.suggestions.map(String).slice(0, 2).join('；') : risk.recommendation
    return [`风险等级：${risk.riskLevel ?? 'unknown'}`, risks && `风险：${risks}`, suggestions && `建议：${suggestions}`]
      .filter(Boolean)
      .join('\n')
  }

  return report?.markdown ? report.markdown.slice(0, 300) : '工作流已完成，但没有可汇总的上游报告内容。'
}

export default reportOutputFinalTool

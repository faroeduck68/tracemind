import { TraceMindTool } from '../types/tool'

const reportOutputTool: TraceMindTool = {
  name: 'report_output',
  displayName: '报告输出工具',
  async run(context) {
    const risk = findRecord(context, (record) => typeof record.riskLevel === 'string' || Array.isArray(record.risks))
    const summaryRecord = findRecord(context, (record) => typeof record.summary === 'string' || typeof record.recommendation === 'string')
    const reportRecord = findRecord(context, (record) => typeof record.markdown === 'string')
    const summary = buildSummary(risk, summaryRecord, reportRecord)

    const report = {
      title: '财报风险分析报告',
      generatedAt: new Date().toISOString(),
      risk,
      summary,
      markdown: firstText(reportRecord?.markdown),
      reportPreview: firstText(reportRecord?.markdown).slice(0, 600) || undefined,
      riskLevel: risk ? firstText(risk.riskLevel) || 'unknown' : undefined,
      recommendation: firstText(summaryRecord?.recommendation, arrayText(risk?.suggestions)),
      traceNodeCount: Object.keys(context.nodeOutputs).length
    }

    context.finalResult = report

    return {
      success: true,
      output: report,
      message: '报告输出完成'
    }
  }
}

function findRecord(context: Parameters<TraceMindTool['run']>[0], predicate: (record: Record<string, unknown>) => boolean) {
  return Object.values(context.nodeOutputs).find((output) => {
    if (!output || typeof output !== 'object' || Array.isArray(output)) return false
    return predicate(output as Record<string, unknown>)
  }) as Record<string, unknown> | undefined
}

function buildSummary(
  risk?: Record<string, unknown>,
  summaryRecord?: Record<string, unknown>,
  reportRecord?: Record<string, unknown>
) {
  const lines = [
    firstText(summaryRecord?.summary),
    risk && `风险等级：${firstText(risk.riskLevel) || 'unknown'}`,
    arrayText(risk?.risks) && `风险：${arrayText(risk?.risks)}`,
    firstText(summaryRecord?.recommendation, arrayText(risk?.suggestions)) &&
      `建议：${firstText(summaryRecord?.recommendation, arrayText(risk?.suggestions))}`,
    !summaryRecord && !risk && firstText(reportRecord?.markdown).slice(0, 300)
  ].filter(Boolean)

  return lines.length ? lines.join('\n') : '工作流已完成，但暂未形成可展示摘要。'
}

function arrayText(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 4).join('；') : ''
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export default reportOutputTool

import { TraceMindTool } from '../types/tool'

const recruitmentReportOutputTool: TraceMindTool = {
  name: 'recruitment_report_output_tool',
  displayName: '招聘报告输出工具',
  async run(context) {
    const report = Object.values(context.nodeOutputs).find(
      (output) => output && typeof output === 'object' && typeof (output as Record<string, unknown>).markdown === 'string' && Array.isArray((output as Record<string, unknown>).rankings)
    ) as Record<string, unknown> | undefined
    if (!report) return { success: false, output: null, errorMessage: '未找到招聘分析报告' }

    const result = {
      title: report.title,
      summary: report.summary,
      markdown: report.markdown,
      reportPreview: String(report.markdown ?? '').slice(0, 600),
      rankings: report.rankings,
      jobRequirement: report.jobRequirement,
      candidateCount: Array.isArray(report.rankings) ? report.rankings.length : 0,
      generatedAt: new Date().toISOString(),
      source: 'recruitment-workflow'
    }
    context.finalResult = result
    return { success: true, output: result, message: '招聘分析结果输出完成' }
  }
}

export default recruitmentReportOutputTool

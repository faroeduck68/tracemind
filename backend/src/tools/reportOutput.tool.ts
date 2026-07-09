import { TraceMindTool } from '../types/tool'

const reportOutputTool: TraceMindTool = {
  name: 'report_output',
  displayName: '报告输出工具',
  async run(context) {
    const risk = context.nodeOutputs.risk
    const summary = context.nodeOutputs.summary

    const report = {
      title: '财报风险分析报告',
      generatedAt: new Date().toISOString(),
      risk,
      summary,
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

export default reportOutputTool

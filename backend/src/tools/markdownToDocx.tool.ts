import { env } from '../config/env'
import { TraceMindTool } from '../types/tool'

// markdown_to_docx_tool：任务书 §18.5，第一版先 Mock 输出文件下载信息。
// TODO: 后续接入 markdown-it + html-to-docx 真实生成 .docx 文件。
const markdownToDocxTool: TraceMindTool = {
  name: 'markdown_to_docx_tool',
  displayName: 'Word 导出工具',
  async run(context) {
    const report = findMarkdownOutput(context)
    const hasContent = Boolean(report?.markdown)

    if (env.useRealDocxExport && !env.mockMode && !env.allowMockFallback) {
      return {
        success: false,
        output: {
          mocked: false,
          sourceLength: hasContent ? report?.markdown?.length ?? 0 : 0,
          error: 'Real DOCX export is not implemented yet. Set USE_REAL_DOCX_EXPORT=false or ALLOW_MOCK_FALLBACK=true to use fallback.'
        },
        message: 'Real DOCX export is not implemented yet'
      }
    }

    context.mockUsage ??= []
    context.mockUsage.push({ tool: 'markdown_to_docx_tool', reason: env.mockMode ? 'MOCK_MODE=true' : 'USE_REAL_DOCX_EXPORT=false or fallback enabled' })

    return {
      success: true,
      output: {
        filePath: 'uploads/reports/finance_report.docx',
        filename: 'finance_report.docx',
        downloadUrl: '/api/files/reports/finance_report.docx',
        mocked: true,
        exporter: 'mock',
        sourceLength: hasContent ? report?.markdown?.length ?? 0 : 0
      },
      message: 'Word 报告导出完成（Mock）'
    }
  }
}

function findMarkdownOutput(context: Parameters<TraceMindTool['run']>[0]) {
  return Object.values(context.nodeOutputs).find(
    (output) => output && typeof output === 'object' && typeof (output as { markdown?: unknown }).markdown === 'string'
  ) as { markdown?: string } | undefined
}

export default markdownToDocxTool

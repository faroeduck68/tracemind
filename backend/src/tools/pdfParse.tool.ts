import fs from 'fs/promises'
import path from 'path'
import { env } from '../config/env'
import { TraceMindTool } from '../types/tool'

const pdfParseTool: TraceMindTool = {
  name: 'pdf_parse_tool',
  displayName: 'PDF 解析工具',
  async run(context) {
    const sources = context.files.length > 0 ? context.files : []

    if (env.useRealFileParse && !env.mockMode && sources.length > 0) {
      const documents: Array<Record<string, unknown>> = []
      const errors: Array<{ source: unknown; error: string }> = []

      for (const source of sources) {
        try {
          const filePath = readFilePath(source)
          if (!filePath) throw new Error('No filePath/path provided for real file parsing.')
          const ext = path.extname(filePath).toLowerCase()
          const parsed = ext === '.pdf' ? await parsePdf(filePath) : await parseTextFile(filePath, ext)
          documents.push({
            source,
            filename: readFileName(source, filePath),
            text: parsed.text,
            pages: parsed.pages,
            tables: parsed.tables,
            mocked: false,
            parser: parsed.parser
          })
        } catch (error) {
          errors.push({ source, error: error instanceof Error ? error.message : 'Unknown file parse error' })
        }
      }

      if (documents.length > 0) {
        return {
          success: true,
          output: {
            source: documents[0].source,
            text: documents.map((item) => `# ${item.filename}\n${item.text}`).join('\n\n'),
            pages: documents.reduce((sum, item) => sum + Number(item.pages ?? 0), 0),
            tables: documents.reduce((sum, item) => sum + Number(item.tables ?? 0), 0),
            documents,
            fileCount: documents.length,
            errors,
            mocked: false,
            parser: documents.length === 1 ? documents[0].parser : 'multi-file'
          },
          message: `成功解析 ${documents.length} 个文件${errors.length ? `，${errors.length} 个文件失败` : ''}`
        }
      }

      if (!env.allowMockFallback) {
        return {
          success: false,
          output: { documents: [], errors, mocked: false },
          message: errors[0]?.error ?? 'Real file parse failed',
          errorMessage: errors[0]?.error ?? 'Real file parse failed'
        }
      }
    }

    context.mockUsage ??= []
    context.mockUsage.push({ tool: 'pdf_parse_tool', reason: env.mockMode ? 'MOCK_MODE=true' : 'file parse fallback enabled' })
    const source = sources[0] ?? { filename: 'mock-financial-report.pdf' }
    const text = '公司本期收入同比增长 12.8%，净利润率 9.6%，经营性现金流承压，资产负债率升至 61.4%。'
    return {
      success: true,
      output: {
        source,
        text,
        pages: 1,
        tables: 0,
        documents: [{ source, filename: readFileName(source), text, pages: 1, tables: 0, mocked: true, parser: 'mock' }],
        fileCount: 1,
        errors: [],
        mocked: true,
        parser: 'mock'
      },
      message: 'PDF 内容解析完成'
    }
  }
}

function readFilePath(source: unknown) {
  if (!source || typeof source !== 'object') return null
  const record = source as Record<string, unknown>
  const candidate = record.filePath ?? record.path
  return typeof candidate === 'string' && candidate.trim() ? candidate : null
}

function readFileName(source: unknown, fallbackPath = '') {
  if (source && typeof source === 'object') {
    const record = source as Record<string, unknown>
    const candidate = record.originalName ?? record.filename ?? record.name
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return fallbackPath ? path.basename(fallbackPath).replace(/^\d+-/, '') : 'document'
}

async function parseTextFile(filePath: string, ext: string) {
  if (!['.txt', '.md', '.markdown', '.csv'].includes(ext)) {
    throw new Error(`Real parser currently supports PDF and text-like files, got ${ext || 'unknown extension'}.`)
  }
  return { text: await fs.readFile(filePath, 'utf8'), pages: 1, tables: 0, parser: 'fs-text' }
}

async function parsePdf(filePath: string) {
  const buffer = await fs.readFile(filePath)
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  const parsed = (await parser.getText()) as { text?: string; total?: number; pages?: unknown[] }
  return {
    text: parsed.text ?? '',
    pages: Number(parsed.total ?? parsed.pages?.length ?? 0),
    tables: 0,
    parser: 'pdf-parse'
  }
}

export default pdfParseTool

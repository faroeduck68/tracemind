import fs from 'fs/promises'
import path from 'path'
import { env } from '../config/env'
import { TraceMindTool } from '../types/tool'

const pdfParseTool: TraceMindTool = {
  name: 'pdf_parse_tool',
  displayName: 'PDF 解析工具',
  async run(context) {
    const source = context.files.length > 0 ? context.files[0] : { filename: 'mock-financial-report.pdf' }

    if (env.useRealFileParse && !env.mockMode) {
      try {
        const filePath = readFilePath(source)
        if (!filePath) throw new Error('No filePath/path provided for real file parsing.')

        const ext = path.extname(filePath).toLowerCase()
        const parsed = ext === '.pdf' ? await parsePdf(filePath) : await parseTextFile(filePath, ext)
        return {
          success: true,
          output: {
            source,
            text: parsed.text,
            pages: parsed.pages,
            tables: parsed.tables,
            mocked: false,
            parser: parsed.parser
          },
          message: 'File parsed with real parser'
        }
      } catch (error) {
        if (!env.allowMockFallback) {
          return {
            success: false,
            output: {
              source,
              mocked: false,
              error: error instanceof Error ? error.message : 'Unknown file parse error'
            },
            message: error instanceof Error ? error.message : 'Real file parse failed'
          }
        }
      }
    }

    context.mockUsage ??= []
    context.mockUsage.push({ tool: 'pdf_parse_tool', reason: env.mockMode ? 'MOCK_MODE=true' : 'file parse fallback enabled' })

    return {
      success: true,
      output: {
        source,
        text: '公司本期收入同比增长 12.8%，净利润率 9.6%，经营性现金流承压，资产负债率升至 61.4%。',
        pages: 18,
        tables: 6,
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

async function parseTextFile(filePath: string, ext: string) {
  if (!['.txt', '.md', '.markdown', '.csv'].includes(ext)) {
    throw new Error(`Real parser currently supports PDF and text-like files, got ${ext || 'unknown extension'}.`)
  }

  return {
    text: await fs.readFile(filePath, 'utf8'),
    pages: 1,
    tables: 0,
    parser: 'fs-text'
  }
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

import fs from 'fs/promises'
import path from 'path'

export type DocumentType = 'financial' | 'document' | 'unknown'

export type DocumentClassification = {
  type: DocumentType
  confidence: number
  reason: string
  matchedKeywords: string[]
  textPreview?: string
}

const financialKeywords = [
  '利润表',
  '资产负债表',
  '现金流量表',
  '营业收入',
  '营收',
  '净利润',
  '财务报表',
  '资产负债',
  '现金流',
  '毛利率',
  '负债率',
  '应收账款'
]

const documentKeywords = ['图纸', '设计说明', '施工图', '方案说明', '研究报告', '普通报告', '摘要', '目录', '结论']

export async function classifyDocumentFiles(files: unknown[] = []): Promise<DocumentClassification> {
  const text = await readFilesText(files)
  return classifyDocumentText(text)
}

export function classifyDocumentText(text: string): DocumentClassification {
  const normalized = text.toLowerCase()
  const matchedFinancial = financialKeywords.filter((keyword) => normalized.includes(keyword.toLowerCase()))
  const matchedDocument = documentKeywords.filter((keyword) => normalized.includes(keyword.toLowerCase()))

  if (matchedFinancial.length >= 2) {
    return {
      type: 'financial',
      confidence: Math.min(0.96, 0.72 + matchedFinancial.length * 0.04),
      reason: '文档包含利润表、资产负债表、现金流量表、营收、净利润等财务关键词。',
      matchedKeywords: matchedFinancial,
      textPreview: text.slice(0, 800)
    }
  }

  if (matchedDocument.length > 0 || text.trim().length >= 120) {
    return {
      type: 'document',
      confidence: matchedDocument.length > 0 ? 0.86 : 0.72,
      reason:
        matchedDocument.length > 0
          ? '文档包含图纸、设计说明、报告结构等普通文档特征。'
          : '文档已解析出正文，但没有识别到足够的财务报表关键词，更适合先做文档总结。',
      matchedKeywords: matchedDocument,
      textPreview: text.slice(0, 800)
    }
  }

  return {
    type: 'unknown',
    confidence: 0.35,
    reason: '未能从上传文件中读取足够文本，无法判断应做文档总结还是财务分析。',
    matchedKeywords: [],
    textPreview: text.slice(0, 800)
  }
}

async function readFilesText(files: unknown[]) {
  const chunks: string[] = []

  for (const file of files.slice(0, 3)) {
    const filePath = readFilePath(file)
    if (!filePath) continue

    try {
      chunks.push(await readFileText(filePath))
    } catch {
      // Classification is best-effort; parsing failures should lead to unknown.
    }
  }

  return chunks.join('\n\n').slice(0, 16000)
}

function readFilePath(source: unknown) {
  if (!source || typeof source !== 'object') return ''
  const record = source as Record<string, unknown>
  const candidate = record.filePath ?? record.path
  return typeof candidate === 'string' ? candidate.trim() : ''
}

async function readFileText(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.pdf') return readPdfText(filePath)
  if (['.txt', '.md', '.markdown', '.csv'].includes(ext)) return fs.readFile(filePath, 'utf8')
  return ''
}

async function readPdfText(filePath: string) {
  const buffer = await fs.readFile(filePath)
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  const parsed = (await parser.getText()) as { text?: string }
  return parsed.text ?? ''
}

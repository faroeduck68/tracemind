import { ToolRankingScore } from '../models/toolRankingLog.model'
import { needsRealtimeInformation } from './realtimeIntent.service'

const financeKeywords = ['财报', '财务', '风险', '利润', '收入', '现金流']

export function rankTools(query: string, selectedToolName: string): ToolRankingScore[] {
  const candidates = candidateToolsFor(selectedToolName)

  return candidates
    .map((toolName) => {
      const keywordScore = scoreByKeyword(query, toolName)
      const semanticScore = scoreBySemantic(toolName)
      const historyScore = scoreByHistory(toolName)
      const preferenceScore = scoreByPreference(toolName)
      const finalScore = round(
        0.4 * keywordScore + 0.3 * semanticScore + 0.2 * historyScore + 0.1 * preferenceScore
      )

      return {
        toolName,
        keywordScore,
        semanticScore,
        historyScore,
        preferenceScore,
        finalScore,
        selected: toolName === selectedToolName,
        reason: toolName === selectedToolName ? '与当前节点职责匹配度最高' : '作为候选工具参与评分'
      }
    })
    .sort((a, b) => b.finalScore - a.finalScore)
}

function candidateToolsFor(selectedToolName: string) {
  const map: Record<string, string[]> = {
    pdf_parse_tool: ['pdf_parse_tool', 'text_extract_tool', 'summary_llm', 'general_qa_tool'],
    financial_extract_tool: ['financial_extract_tool', 'text_extract_tool', 'summary_llm', 'general_qa_tool'],
    financial_risk_tool: ['financial_risk_tool', 'risk_summary_tool', 'summary_llm', 'general_qa_tool'],
    risk_summary_tool: ['risk_summary_tool', 'financial_risk_tool', 'summary_llm', 'general_qa_tool'],
    document_classify_tool: ['document_classify_tool', 'summary_llm', 'general_qa_tool'],
    report_output_tool: ['report_output_tool', 'summary_llm', 'general_qa_tool'],
    report_generate_tool: ['report_generate_tool', 'summary_llm', 'general_qa_tool'],
    markdown_to_docx_tool: ['markdown_to_docx_tool', 'report_output_tool', 'general_qa_tool'],
    web_search_tool: ['web_search_tool', 'knowledge_search_tool', 'summary_llm', 'general_qa_tool']
  }

  return Array.from(new Set(map[selectedToolName] ?? [selectedToolName, 'summary_llm', 'general_qa_tool']))
}

function scoreByKeyword(query: string, toolName: string) {
  const isFinance = financeKeywords.some((keyword) => query.includes(keyword))
  if (toolName.includes('financial') && isFinance) return 0.95
  if (toolName.includes('risk') && isFinance) return 0.9
  if (toolName.includes('document_classify')) return 0.88
  if (toolName === 'web_search_tool' && needsRealtimeSearch(query)) return 0.98
  if (toolName === 'knowledge_search_tool') return needsRealtimeSearch(query) ? 0.45 : 0.82
  if (toolName.includes('pdf')) return isFinance ? 0.78 : 0.62
  if (toolName.includes('summary')) return 0.72
  return 0.35
}

function scoreBySemantic(toolName: string) {
  if (toolName.includes('financial')) return 0.9
  if (toolName.includes('risk')) return 0.86
  if (toolName.includes('document_classify')) return 0.88
  if (toolName === 'web_search_tool') return 0.94
  if (toolName === 'knowledge_search_tool') return 0.84
  if (toolName.includes('summary')) return 0.82
  if (toolName.includes('pdf')) return 0.8
  return 0.55
}

function needsRealtimeSearch(query: string) {
  return needsRealtimeInformation(query)
}

function scoreByHistory(toolName: string) {
  if (toolName.includes('pdf')) return 0.93
  if (toolName.includes('summary')) return 0.95
  if (toolName.includes('financial')) return 0.88
  return 0.8
}

function scoreByPreference(toolName: string) {
  if (toolName.includes('financial')) return 0.9
  if (toolName.includes('summary')) return 0.86
  return 0.75
}

function round(value: number) {
  return Math.round(value * 10000) / 10000
}

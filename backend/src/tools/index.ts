import financialExtractTool from './financialExtract.tool'
import financialRiskTool from './financialRisk.tool'
import intentClassifierTool from './intentClassifier.tool'
import knowledgeSearchTool from './knowledgeSearch.tool'
import markdownToDocxTool from './markdownToDocx.tool'
import pdfParseTool from './pdfParse.tool'
import reportGenerateTool from './reportGenerate.tool'
import reportOutputTool from './reportOutput.tool'
import reportOutputFinalTool from './reportOutputFinal.tool'
import riskSummaryTool from './riskSummary.tool'
import summaryLLMTool from './summaryLLM.tool'
import userInputTool from './userInput.tool'

export const toolRegistry = {
  user_input: userInputTool,
  intent_classifier: intentClassifierTool,
  pdf_parse_tool: pdfParseTool,
  financial_extract_tool: financialExtractTool,
  financial_risk_tool: financialRiskTool,
  report_generate_tool: reportGenerateTool,
  markdown_to_docx_tool: markdownToDocxTool,
  report_output_tool: reportOutputFinalTool,
  risk_summary_tool: riskSummaryTool,
  finance_knowledge_base: knowledgeSearchTool,
  summary_llm: summaryLLMTool,
  report_output: reportOutputTool
}

export type RegisteredToolName = keyof typeof toolRegistry

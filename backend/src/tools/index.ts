import financialExtractTool from './financialExtract.tool'
import financialRiskTool from './financialRisk.tool'
import documentClassifyTool from './documentClassify.tool'
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
import webSearchTool from './webSearch.tool'
import resumeExtractTool from './resumeExtract.tool'
import jobRequirementTool from './jobRequirement.tool'
import candidateMatchTool from './candidateMatch.tool'
import candidateRankTool from './candidateRank.tool'
import recruitmentReportTool from './recruitmentReport.tool'
import recruitmentReportOutputTool from './recruitmentReportOutput.tool'

export const toolRegistry = {
  user_input: userInputTool,
  intent_classifier: intentClassifierTool,
  document_classify_tool: documentClassifyTool,
  pdf_parse_tool: pdfParseTool,
  financial_extract_tool: financialExtractTool,
  financial_risk_tool: financialRiskTool,
  report_generate_tool: reportGenerateTool,
  markdown_to_docx_tool: markdownToDocxTool,
  report_output_tool: reportOutputFinalTool,
  risk_summary_tool: riskSummaryTool,
  knowledge_search_tool: knowledgeSearchTool,
  finance_knowledge_base: knowledgeSearchTool,
  summary_llm: summaryLLMTool,
  web_search_tool: webSearchTool,
  resume_extract_tool: resumeExtractTool,
  job_requirement_tool: jobRequirementTool,
  candidate_match_tool: candidateMatchTool,
  candidate_rank_tool: candidateRankTool,
  recruitment_report_tool: recruitmentReportTool,
  recruitment_report_output_tool: recruitmentReportOutputTool,
  report_output: reportOutputTool
}

export type RegisteredToolName = keyof typeof toolRegistry

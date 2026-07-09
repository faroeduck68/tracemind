import { WorkflowGraph, WorkflowNode } from '../types/workflow'
import { triggerHooks } from '../hooks/hookRegistry'
import { toolRegistry } from '../tools'
import { validateDag } from '../utils/dagValidator'
import { env } from '../config/env'
import { callLLM, parseLlmJson } from './llm.service'

const financeKeywords = ['财报', '财务', '风险', '利润', '收入', '现金流']
const weatherKeywords = ['天气', '气温', 'weather', 'temperature', 'forecast']
// 触发严格线性财报报告模板（任务书 §10.2）的关键词。
const linearReportKeywords = ['Word 报告', 'Word报告', '生成报告', '导出报告', '财报风险报告', 'word 报告', 'word报告']
// 触发现有分支型财报模板（含知识检索 + 综合总结）的关键词。
const branchKeywords = ['知识检索', '行业知识', '综合总结', 'RAG', 'rag']

type FinanceTemplate = 'linear' | 'branch' | 'none'

const toolDisplayNames: Record<string, string> = {
  pdf_parse_tool: 'PDF解析工具',
  financial_extract_tool: '财务指标提取工具',
  financial_risk_tool: '财务风险分析工具',
  risk_summary_tool: '风险总结工具',
  report_output_tool: '报告输出工具',
  report_generate_tool: '报告生成工具',
  markdown_to_docx_tool: 'Word导出工具',
  intent_classifier: '意图识别工具',
  user_input: '用户输入',
  summary_llm: '总结模型',
  finance_knowledge_base: '财务知识库检索工具',
  knowledge_search_tool: '知识检索工具',
  report_output: '报告输出工具'
}

const candidateToolsByTool: Record<string, Array<{ name: string; score: number }>> = {
  pdf_parse_tool: [
    { name: 'pdf_parse_tool', score: 0.94 },
    { name: 'text_extract_tool', score: 0.82 },
    { name: 'summary_llm', score: 0.61 },
    { name: 'general_qa_tool', score: 0.42 }
  ],
  financial_extract_tool: [
    { name: 'financial_extract_tool', score: 0.96 },
    { name: 'text_extract_tool', score: 0.78 },
    { name: 'summary_llm', score: 0.64 },
    { name: 'general_qa_tool', score: 0.38 }
  ],
  financial_risk_tool: [
    { name: 'financial_risk_tool', score: 0.95 },
    { name: 'risk_summary_tool', score: 0.86 },
    { name: 'summary_llm', score: 0.7 },
    { name: 'general_qa_tool', score: 0.42 }
  ],
  risk_summary_tool: [
    { name: 'risk_summary_tool', score: 0.93 },
    { name: 'financial_risk_tool', score: 0.84 },
    { name: 'summary_llm', score: 0.76 },
    { name: 'general_qa_tool', score: 0.45 }
  ],
  report_output_tool: [
    { name: 'report_output_tool', score: 0.92 },
    { name: 'summary_llm', score: 0.68 },
    { name: 'general_qa_tool', score: 0.4 }
  ]
}

// 根据 query 选择财报模板：
// 1. 命中线性报告关键词 -> linear_finance_report
// 2. 命中知识检索/综合总结关键词 -> branch_finance_analysis
// 3. 命中财报相关关键词但无法细分 -> 默认 linear（更适合 MVP 演示与任务书验收）
// 4. 完全无关 -> none（走通用工作流）
export function selectFinanceTemplate(query: string): FinanceTemplate {
  if (linearReportKeywords.some((keyword) => query.includes(keyword))) return 'linear'
  if (branchKeywords.some((keyword) => query.includes(keyword))) return 'branch'
  if (financeKeywords.some((keyword) => query.includes(keyword))) return 'linear'
  return 'none'
}

export async function generateWorkflowFromQuery(query: string, memories: unknown[] = []): Promise<WorkflowGraph> {
  if (isWeatherQuery(query) && !('weather_tool' in toolRegistry)) {
    throw new Error('当前系统没有天气查询工具，无法实时查询天气。可以为系统新增 weather_tool 后支持该能力。')
  }

  const promptContext = { memories }
  const userPromptResult = await triggerHooks('UserPromptSubmit', {
    input: { query, memories },
    context: promptContext
  })
  if (userPromptResult?.blocked) throw new Error(userPromptResult.reason ?? 'User prompt was blocked by hooks.')

  const beforeGenerateResult = await triggerHooks('BeforeWorkflowGenerate', {
    input: { query, memories },
    context: promptContext
  })
  if (beforeGenerateResult?.blocked) {
    throw new Error(beforeGenerateResult.reason ?? 'Workflow generation was blocked by hooks.')
  }

  let graph: WorkflowGraph
  let source = 'rule_engine'

  if (shouldUseMockWorkflowGenerator()) {
    graph = buildRuleWorkflow(query, memories)
    source = 'mock_rule_engine'
  } else {
    try {
      graph = await generateWorkflowWithLLM(query, memories)
      source = 'llm'
    } catch (error) {
      if (!env.allowMockFallback) {
        const message = error instanceof Error ? error.message : 'Unknown workflow generation error'
        throw new Error(`Real workflow generation failed: ${message}`)
      }
      graph = buildRuleWorkflow(query, memories)
      source = 'fallback_rule_engine'
    }
  }

  const afterGenerateContext = {
    input: graph,
    context: promptContext,
    metadata: { source }
  }
  const afterGenerateResult = await triggerHooks('AfterWorkflowGenerate', afterGenerateContext)
  if (afterGenerateResult?.blocked) {
    throw new Error(afterGenerateResult.reason ?? 'Generated workflow was blocked by hooks.')
  }

  graph = normalizeToolFields(afterGenerateContext.input as WorkflowGraph)

  validateDag(graph.nodes, graph.edges)
  return graph
}

function isWeatherQuery(query: string) {
  const normalized = query.toLowerCase()
  return weatherKeywords.some((keyword) => normalized.includes(keyword))
}

function normalizeToolFields(graph: WorkflowGraph): WorkflowGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const toolName = String(node.toolName ?? node.tool).replace(/\s+/g, '_')
      return {
        ...node,
        tool: toolName,
        toolName,
        displayName: node.displayName ?? toolDisplayNames[toolName] ?? toolName,
        candidateTools: node.candidateTools?.length ? node.candidateTools : candidateToolsByTool[toolName] ?? []
      }
    })
  }
}

function shouldUseMockWorkflowGenerator() {
  return env.mockMode || !env.useRealLlm
}

function buildRuleWorkflow(query: string, memories: unknown[]) {
  const template = selectFinanceTemplate(query)
  return template === 'linear'
    ? buildLinearFinanceWorkflow(query, memories)
    : template === 'branch'
      ? buildFinancialWorkflow(query, memories)
      : buildGeneralWorkflow(query, memories)
}

async function generateWorkflowWithLLM(query: string, memories: unknown[]): Promise<WorkflowGraph> {
  const availableTools = Object.entries(toolRegistry).map(([key, tool]) => ({
    name: key,
    displayName: tool.displayName
  }))

  const response = await callLLM(
    [
      {
        role: 'system',
        content: [
          'You are TraceMind workflow generator. Return only valid JSON.',
          'Generate a DAG workflow for the user query.',
          'Every node.tool must be one of the available tool names.',
          'Keep the existing tool run(context) contract in mind; do not invent new tools.',
          'Required top-level JSON fields: name, description, sourceType, originalQuery, intent, confidence, status, nodes, edges.',
          'Node fields: id, type, label, subLabel, icon, position{x,y}, status, tone, tool, confidence, reason.',
          'Edge fields: id, source, target, optional branch.',
          'Use status=\"draft\" for workflow and status=\"idle\" for nodes.',
          'Allowed tones: green, blue, violet, amber, cyan.'
        ].join('\n')
      },
      {
        role: 'user',
        content: JSON.stringify({
          query,
          memories,
          availableTools
        })
      }
    ],
    { json: true, temperature: 0.1, maxTokens: 3000 }
  )

  const graph = normalizeGeneratedGraph(parseLlmJson<WorkflowGraph>(response.content), query)
  validateGeneratedToolNames(graph)
  validateDag(graph.nodes, graph.edges)
  return graph
}

function normalizeGeneratedGraph(graph: WorkflowGraph, query: string): WorkflowGraph {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('LLM workflow JSON is missing nodes or edges.')
  }

  return {
    ...graph,
    sourceType: graph.sourceType ?? 'generated',
    originalQuery: graph.originalQuery ?? query,
    status: graph.status ?? 'draft',
    confidence: Number(graph.confidence ?? 0.75),
    nodes: graph.nodes.map((node, index) => ({
      ...node,
      id: String(node.id),
      type: String(node.type ?? 'task'),
      label: String(node.label ?? node.id),
      subLabel: String(node.subLabel ?? ''),
      icon: String(node.icon ?? 'Bot'),
      position: {
        x: Number(node.position?.x ?? 80 + index * 220),
        y: Number(node.position?.y ?? 220)
      },
      status: node.status ?? 'idle',
      tone: node.tone ?? 'blue',
      tool: String(node.tool),
      confidence: Number(node.confidence ?? 0.75),
      reason: String(node.reason ?? 'Generated by LLM.')
    })),
    edges: graph.edges.map((edge, index) => ({
      ...edge,
      id: String(edge.id ?? `e-${index}`),
      source: String(edge.source),
      target: String(edge.target)
    }))
  }
}

function validateGeneratedToolNames(graph: WorkflowGraph) {
  const missingTools = graph.nodes
    .map((node) => node.tool)
    .filter((toolName) => !toolRegistry[toolName as keyof typeof toolRegistry])

  if (missingTools.length > 0) {
    throw new Error(`LLM generated unknown tool(s): ${[...new Set(missingTools)].join(', ')}`)
  }
}

function withIdle(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => ({ ...node, status: 'idle' }))
}

// 任务书 §10.2 / §4：严格线性 8 节点财报报告工作流。
function buildLinearFinanceWorkflow(query: string, memories: unknown[]): WorkflowGraph {
  const nodes = withIdle([
    {
      id: 'start',
      type: 'input',
      label: '开始',
      subLabel: '用户输入',
      icon: 'CirclePlay',
      position: { x: 80, y: 260 },
      status: 'idle',
      tone: 'green',
      tool: 'user_input',
      confidence: 0.98,
      reason: '接收用户自然语言需求，作为工作流入口。'
    },
    {
      id: 'intent',
      type: 'intent',
      label: '意图识别',
      subLabel: '识别财务分析任务',
      icon: 'Bot',
      position: { x: 320, y: 260 },
      status: 'idle',
      tone: 'blue',
      tool: 'intent_classifier',
      confidence: 0.95,
      reason: '需要先判断用户任务类型，确定后续流程。'
    },
    {
      id: 'file',
      type: 'file_read',
      label: '文件读取',
      subLabel: '解析财报文件',
      icon: 'FileText',
      position: { x: 560, y: 260 },
      status: 'idle',
      tone: 'green',
      tool: 'pdf_parse_tool',
      confidence: 0.92,
      reason: '财报分析需要先读取并解析上传文件内容。'
    },
    {
      id: 'extract',
      type: 'financial_extract',
      label: '财务指标提取',
      subLabel: '提取收入、利润、现金流等指标',
      icon: 'ClipboardList',
      position: { x: 800, y: 260 },
      status: 'idle',
      tone: 'blue',
      tool: 'financial_extract_tool',
      confidence: 0.91,
      reason: '风险分析依赖财务指标，需要先提取结构化数据。'
    },
    {
      id: 'risk',
      type: 'risk_analysis',
      label: '风险分析',
      subLabel: '判断财务风险',
      icon: 'ChartNoAxesCombined',
      position: { x: 1040, y: 260 },
      status: 'idle',
      tone: 'violet',
      tool: 'financial_risk_tool',
      confidence: 0.89,
      reason: '用户要求总结风险，需要基于财务指标进行风险判断。'
    },
    {
      id: 'report',
      type: 'report_generate',
      label: '报告生成',
      subLabel: '生成 Markdown 报告',
      icon: 'ClipboardCheck',
      position: { x: 1280, y: 260 },
      status: 'idle',
      tone: 'amber',
      tool: 'report_generate_tool',
      confidence: 0.9,
      reason: '将财务指标和风险分析结果整理为可读报告。'
    },
    {
      id: 'docx',
      type: 'docx_export',
      label: 'Word 导出',
      subLabel: '转换为 Word 文件',
      icon: 'FileText',
      position: { x: 1520, y: 260 },
      status: 'idle',
      tone: 'cyan',
      tool: 'markdown_to_docx_tool',
      confidence: 0.88,
      reason: '用户要求生成 Word 报告，因此需要将 Markdown 转换为 docx 文件。'
    },
    {
      id: 'output',
      type: 'output',
      label: '结果输出',
      subLabel: '返回报告下载链接',
      icon: 'PanelRightOpen',
      position: { x: 1760, y: 260 },
      status: 'idle',
      tone: 'cyan',
      tool: 'report_output_tool',
      confidence: 0.92,
      reason: '将最终报告文件和分析结论返回给用户。'
    }
  ])

  return {
    name: '财报风险分析 Workflow',
    description: `根据自然语言需求自动生成的线性财报报告流程。已参考 ${memories.length} 条记忆。`,
    sourceType: 'generated',
    originalQuery: query,
    intent: 'financial_report_analysis',
    confidence: 0.94,
    status: 'draft',
    nodes,
    edges: [
      { id: 'e-start-intent', source: 'start', target: 'intent' },
      { id: 'e-intent-file', source: 'intent', target: 'file' },
      { id: 'e-file-extract', source: 'file', target: 'extract' },
      { id: 'e-extract-risk', source: 'extract', target: 'risk' },
      { id: 'e-risk-report', source: 'risk', target: 'report' },
      { id: 'e-report-docx', source: 'report', target: 'docx' },
      { id: 'e-docx-output', source: 'docx', target: 'output' }
    ]
  }
}

function buildFinancialWorkflow(query: string, memories: unknown[]): WorkflowGraph {
  const nodes = withIdle([
    {
      id: 'start',
      type: 'input',
      label: '开始',
      subLabel: '用户输入',
      icon: 'CirclePlay',
      position: { x: 22, y: 214 },
      status: 'idle',
      tone: 'green',
      tool: 'user_input',
      confidence: 0.98,
      reason: '用户发起财报风险分析任务，作为工作流入口。'
    },
    {
      id: 'intent',
      type: 'intent',
      label: '意图识别',
      subLabel: '识别用户意图',
      icon: 'Bot',
      position: { x: 190, y: 214 },
      status: 'idle',
      tone: 'blue',
      tool: 'intent_classifier',
      confidence: 0.94,
      reason: '需求中包含财报分析和风险总结，因此先识别任务类型与分析目标。'
    },
    {
      id: 'file',
      type: 'file_read',
      label: '文件读取',
      subLabel: '读取财报文件',
      icon: 'FileText',
      position: { x: 340, y: 104 },
      status: 'idle',
      tone: 'green',
      tool: 'pdf_parse_tool',
      confidence: 0.92,
      reason: '财报分析依赖上传文件内容，需要先读取和解析源文件。'
    },
    {
      id: 'extract',
      type: 'financial_extract',
      label: '财务指标提取',
      subLabel: '提取关键财务指标',
      icon: 'ClipboardList',
      position: { x: 500, y: 104 },
      status: 'idle',
      tone: 'blue',
      tool: 'financial_extract_tool',
      confidence: 0.92,
      reason: '从财报中提取收入、利润、负债率、现金流等结构化指标，为后续风险分析提供数据基础。'
    },
    {
      id: 'risk',
      type: 'risk_analysis',
      label: '风险分析',
      subLabel: '分析财报风险',
      icon: 'ChartNoAxesCombined',
      position: { x: 660, y: 104 },
      status: 'idle',
      tone: 'violet',
      tool: 'risk_summary_tool',
      confidence: 0.91,
      reason: '基于财务指标判断盈利能力、偿债能力和现金流风险。'
    },
    {
      id: 'knowledge',
      type: 'knowledge',
      label: '知识检索',
      subLabel: '检索相关知识',
      icon: 'BookOpen',
      position: { x: 340, y: 334 },
      status: 'idle',
      tone: 'violet',
      tool: 'finance_knowledge_base',
      confidence: 0.86,
      reason: '引入行业风险知识和财报解读经验，辅助生成更可信的解释。'
    },
    {
      id: 'summary',
      type: 'risk_summary',
      label: '风险总结',
      subLabel: '生成风险总结',
      icon: 'ClipboardCheck',
      position: { x: 500, y: 334 },
      status: 'idle',
      tone: 'amber',
      tool: 'summary_llm',
      confidence: 0.89,
      reason: '汇总指标提取和知识检索结果，生成清晰的风险结论。'
    },
    {
      id: 'output',
      type: 'output',
      label: '结果输出',
      subLabel: '输出分析报告',
      icon: 'PanelRightOpen',
      position: { x: 660, y: 334 },
      status: 'idle',
      tone: 'cyan',
      tool: 'report_output_tool',
      confidence: 0.9,
      reason: '将分析结论整理为可读报告，并保留结构化 JSON 输出。'
    }
  ])

  return {
    name: '财报风险分析 Workflow',
    description: `根据自然语言需求自动生成。已参考 ${memories.length} 条记忆。`,
    sourceType: 'generated',
    originalQuery: query,
    intent: 'financial_report_analysis',
    confidence: 0.94,
    status: 'draft',
    nodes,
    edges: [
      { id: 'e-start-intent', source: 'start', target: 'intent' },
      { id: 'e-intent-file', source: 'intent', target: 'file', branch: 'main' },
      { id: 'e-file-extract', source: 'file', target: 'extract' },
      { id: 'e-extract-risk', source: 'extract', target: 'risk' },
      { id: 'e-intent-knowledge', source: 'intent', target: 'knowledge', branch: 'alt' },
      { id: 'e-knowledge-summary', source: 'knowledge', target: 'summary' },
      { id: 'e-summary-output', source: 'summary', target: 'output' },
      { id: 'e-risk-output', source: 'risk', target: 'output' }
    ]
  }
}

function buildGeneralWorkflow(query: string, memories: unknown[]): WorkflowGraph {
  const nodes = withIdle([
    {
      id: 'start',
      type: 'input',
      label: '开始',
      subLabel: '用户输入',
      icon: 'CirclePlay',
      position: { x: 80, y: 220 },
      status: 'idle',
      tone: 'green',
      tool: 'user_input',
      confidence: 0.96,
      reason: '接收用户自然语言需求，作为工作流入口。'
    },
    {
      id: 'intent',
      type: 'intent',
      label: '意图识别',
      subLabel: '识别任务类型',
      icon: 'Bot',
      position: { x: 260, y: 220 },
      status: 'idle',
      tone: 'blue',
      tool: 'intent_classifier',
      confidence: 0.78,
      reason: '先识别用户目标，决定后续处理方式。'
    },
    {
      id: 'summary',
      type: 'summary',
      label: '内容总结',
      subLabel: '生成结构化回复',
      icon: 'ClipboardCheck',
      position: { x: 440, y: 220 },
      status: 'idle',
      tone: 'amber',
      tool: 'summary_llm',
      confidence: 0.82,
      reason: '第一版通用任务以总结输出为主，保持流程可解释。'
    },
    {
      id: 'output',
      type: 'output',
      label: '结果输出',
      subLabel: '输出最终结果',
      icon: 'PanelRightOpen',
      position: { x: 620, y: 220 },
      status: 'idle',
      tone: 'cyan',
      tool: 'report_output_tool',
      confidence: 0.86,
      reason: '将执行结果整理为前端可展示的结构化报告。'
    }
  ])

  return {
    name: '通用任务 Workflow',
    description: `根据自然语言需求自动生成。已参考 ${memories.length} 条记忆。`,
    sourceType: 'generated',
    originalQuery: query,
    intent: 'general_workflow',
    confidence: 0.78,
    status: 'draft',
    nodes,
    edges: [
      { id: 'e-start-intent', source: 'start', target: 'intent' },
      { id: 'e-intent-summary', source: 'intent', target: 'summary' },
      { id: 'e-summary-output', source: 'summary', target: 'output' }
    ]
  }
}

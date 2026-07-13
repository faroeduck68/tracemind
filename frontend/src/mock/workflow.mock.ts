import type { PaletteNode, TraceStep, ToolScore, WorkflowEdge, WorkflowNode } from '../types'

export const paletteNodes: PaletteNode[] = [
  { type: 'llm', label: '大语言模型', desc: '调用大语言模型', icon: 'BrainCircuit', category: '常用节点', tone: 'violet' },
  { type: 'search', label: '知识检索', desc: '从知识库检索信息', icon: 'Search', category: '常用节点', tone: 'cyan' },
  { type: 'code', label: '代码执行', desc: '执行 Python 代码', icon: 'TerminalSquare', category: '常用节点', tone: 'green' },
  { type: 'condition', label: '条件判断', desc: '根据条件分支', icon: 'GitBranch', category: '常用节点', tone: 'amber' },
  { type: 'transform', label: '数据处理', desc: '处理和转换数据', icon: 'Shuffle', category: '常用节点', tone: 'blue' },
  { type: 'file', label: '文件读取', desc: '读取文件内容', icon: 'FileText', category: '常用节点', tone: 'violet' },
  { type: 'http', label: 'HTTP 请求', desc: '发送 HTTP 请求', icon: 'CloudCog', category: '常用节点', tone: 'blue' },
  { type: 'output', label: '结果输出', desc: '输出最终结果', icon: 'Send', category: '常用节点', tone: 'violet' }
]

export const workflowNodes: WorkflowNode[] = [
  {
    id: 'start',
    type: 'input',
    label: '开始',
    subLabel: '用户输入',
    icon: 'CirclePlay',
    position: { x: 22, y: 214 },
    status: 'success',
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
    status: 'success',
    tone: 'blue',
    tool: 'intent_classifier',
    confidence: 0.94,
    reason: '需求中包含“财报分析”和“风险总结”，因此先识别任务类型与分析目标。'
  },
  {
    id: 'file',
    type: 'file_read',
    label: '文件读取',
    subLabel: '读取财报文件',
    icon: 'FileText',
    position: { x: 340, y: 104 },
    status: 'success',
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
    status: 'success',
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
    status: 'success',
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
    status: 'success',
    tone: 'violet',
    tool: 'knowledge_search_tool',
    config: {
      knowledgeBaseType: 'finance',
      queryTemplate: '制造业 财务风险 资产负债率 经营现金流 盈利能力',
      retrievalMode: 'keyword',
      topK: 5
    },
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
    status: 'success',
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
    status: 'success',
    tone: 'cyan',
    tool: 'report_output',
    confidence: 0.9,
    reason: '将分析结论整理为可读报告，并保留结构化 JSON 输出。'
  }
]

export const workflowEdges: WorkflowEdge[] = [
  { id: 'e-start-intent', source: 'start', target: 'intent' },
  { id: 'e-intent-file', source: 'intent', target: 'file', branch: 'main' },
  { id: 'e-file-extract', source: 'file', target: 'extract' },
  { id: 'e-extract-risk', source: 'extract', target: 'risk' },
  { id: 'e-intent-knowledge', source: 'intent', target: 'knowledge', branch: 'alt' },
  { id: 'e-knowledge-summary', source: 'knowledge', target: 'summary' },
  { id: 'e-summary-output', source: 'summary', target: 'output' },
  { id: 'e-risk-output', source: 'risk', target: 'output' }
]

export const traceSteps: TraceStep[] = [
  { id: 't1', stepName: '开始', nodeId: 'start', time: '17:30:21', status: 'success' },
  { id: 't2', stepName: '意图识别', nodeId: 'intent', time: '17:30:22', status: 'success' },
  { id: 't3', stepName: '文件读取', nodeId: 'file', time: '17:30:23', status: 'success' },
  { id: 't4', stepName: '财务指标提取', nodeId: 'extract', time: '17:30:25', status: 'running', tool: 'financial_extract_tool', latency: '2.1s' },
  { id: 't5', stepName: '风险分析', nodeId: 'risk', time: '17:30:28', status: 'success' },
  { id: 't6', stepName: '风险总结', nodeId: 'summary', time: '17:30:30', status: 'success' },
  { id: 't7', stepName: '结果输出', nodeId: 'output', time: '17:30:31', status: 'success' }
]

export const toolScores: ToolScore[] = [
  { name: 'financial_extract_tool', score: 0.92 },
  { name: 'pdf_parse_tool', score: 0.78 },
  { name: 'text_extract_tool', score: 0.65 },
  { name: 'general_qa_tool', score: 0.35 }
]

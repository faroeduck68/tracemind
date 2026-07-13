<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Bell,
  BarChart3,
  BookOpen,
  Bot,
  BrainCircuit,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  ChevronDown,
  CirclePlay,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  CloudCog,
  Code2,
  Database,
  Download,
  FileInput,
  FileChartColumn,
  FileOutput,
  FileText,
  Files,
  Filter,
  GitBranch,
  Grid2X2,
  Home,
  House,
  Layers3,
  Library,
  Maximize2,
  MessageSquarePlus,
  MoreVertical,
  PanelRightOpen,
  Play,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Star,
  Heart,
  Eye,
  User,
  Layers,
  Clock,
  Wrench,
  Calendar,
  Target,
  Info,
  ContactRound,
  ListOrdered,
  Box,
  CheckCircle,
  PauseCircle,
  RefreshCw,
  Activity,
  MoreHorizontal,
  Gauge,
  Languages,
  TerminalSquare,
  TimerReset,
  TrendingUp,
  Upload,
  Workflow,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-vue-next'
import { api } from './api'
import AgentsPage from './components/AgentsPage.vue'
import AppSidebar from './components/AppSidebar.vue'
import HomeAgentPage from './components/HomeAgentPage.vue'
import KnowledgePage from './components/KnowledgePage.vue'
import MemoryPage from './components/MemoryPage.vue'
import PageErrorBoundary from './components/PageErrorBoundary.vue'
import SettingsPage from './components/SettingsPage.vue'
import TemplatesPage from './components/TemplatesPage.vue'
import ToolsPage from './components/ToolsPage.vue'
import WorkflowPage from './components/WorkflowPage.vue'
import { usePageNavigation, type PageKey } from './composables/usePageNavigation'
import { useToast } from './composables/useToast'
import { paletteNodes as initialPaletteNodes } from './mock/palette.mock'
import { formatFileSize, formatMs, shortDate, timeNow } from './utils/formatters'
import type {
  NodeStatus,
  PaletteNode,
  RunHistoryItem,
  ToolScore,
  TraceStep,
  UploadedFile,
  WorkflowEdge,
  WorkflowHistoryItem,
  WorkflowNode
} from './types'

const { activePage, setPage } = usePageNavigation()
const activeNodeId = ref('')
const inspectorTab = ref('explain')
const traceTab = ref('node')
const traceOpenKey = ref(0)
const agentInput = ref('')
const workflowId = ref<number | null>(null)
const activeWorkflowId = ref<number | null>(Number(localStorage.getItem('tracemind_active_workflow_id') ?? 0) || null)
const activeRunId = ref<number | null>(Number(localStorage.getItem('tracemind_active_run_id') ?? 0) || null)
const workflowTitle = ref('暂无工作流')
const workflowDescription = ref('暂无工作流，请先在工作台生成工作流')
const workflowNodes = ref<WorkflowNode[]>([])
const workflowEdges = ref<WorkflowEdge[]>([])
const traceSteps = ref<TraceStep[]>([])
const workflowHistory = ref<WorkflowHistoryItem[]>([])
const runHistory = ref<RunHistoryItem[]>([])
const paletteSearch = ref('')
const workflowZoom = ref(100)
const canvasMode = ref<'canvas' | 'config'>('canvas')
const toolboxTab = ref<'nodes' | 'tools' | 'variables'>('nodes')
const workflowStatus = ref<'idle' | 'saving' | 'running' | 'complete' | 'failed'>('idle')
const savedAt = ref('--:--:--')
const runOutput = ref('')
const runError = ref('')
const { toastMessage, notify } = useToast()
const apiOnline = ref(false)
type ChatMessage = {
  id: number
  role: 'user' | 'assistant'
  text: string
  time: string
  createdAt?: string
  sequence?: number
  workflowId?: number | null
  runId?: number | null
  files?: UploadedFile[]
  finalResult?: unknown
  messageType?: string
  sources?: Array<{ title: string; url: string }>
}
const chatMessages = ref<ChatMessage[]>([])
const conversations = ref<any[]>([])
const activeConversationId = ref<string | null>(localStorage.getItem('tracemind_active_conversation_id'))
const conversationStatus = ref('未开始')
const conversationStartedAt = ref('-')
const conversationLatency = ref('-')
const conversationId = ref(activeConversationId.value ?? '')
const conversationModel = ref('deepseek-chat')
const conversationTotalTokens = ref(0)
const uploadedFiles = ref<UploadedFile[]>([])
const uploadingFiles = ref(false)
const lastWorkflowFiles = ref<UploadedFile[]>([])
const lastWorkflowId = ref<number | null>(null)
const lastRunId = ref<number | null>(null)

function restoreMockWorkflow(title = '通用任务 Workflow') {
  workflowId.value = null
  workflowTitle.value = title
  workflowDescription.value = '暂无工作流，请先在工作台生成工作流'
  workflowNodes.value = []
  workflowEdges.value = []
  traceSteps.value = []
  activeNodeId.value = ''
}

const iconMap = {
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  CirclePlay,
  ClipboardCheck,
  ClipboardList,
  CloudCog,
  ContactRound,
  Database,
  FileChartColumn,
  FileOutput,
  Files,
  FileText,
  GitBranch,
  PanelRightOpen,
  Search,
  Send,
  Shuffle,
  ListOrdered,
  TerminalSquare
}

const navItems = [
  { id: 'home', label: '工作台', icon: House, page: 'home' },
  { id: 'agent', label: '智能体', icon: Bot, page: 'agent' },
  { id: 'workflow', label: '工作流', icon: Workflow, page: 'workflow' },
  { id: 'knowledge', label: '知识库', icon: Database, page: 'knowledge' },
  { id: 'tools', label: '工具库', icon: Library, page: 'tools' },
  { id: 'template', label: '模板库', icon: Grid2X2, page: 'template' },
  { id: 'memory', label: '记忆', icon: Layers3, page: 'memory' },
  { id: 'settings', label: '设置', icon: Settings, page: 'settings' }
]

const emptyNode: WorkflowNode = {
  id: '',
  type: '',
  label: '暂无节点',
  subLabel: '数据库暂无工作流节点',
  icon: 'Sparkles',
  position: { x: 0, y: 0 },
  status: 'idle',
  tone: 'blue',
  tool: '-',
  confidence: 0,
  reason: '数据库中还没有可展示的节点。'
}

const selectedNode = computed(() => workflowNodes.value.find((node) => node.id === activeNodeId.value) ?? workflowNodes.value[0] ?? emptyNode)

const agentCards = ref<any[]>([])
const templateCards = ref<any[]>([])
const knowledgeBases = ref<any[]>([])
const knowledgeDocuments = ref<any[]>([])
const retrievalSnippets = ref<any[]>([])
const memoryItems = ref<any[]>([])

const toolCategories = ['全部', '数据处理', '内容生成', 'HTTP API', 'MCP', '代码开发', '检索搜索', '分析计算', '其他']

const toolRows = ref<any[]>([])
const mcpServers = ref<any[]>([])
const userSecrets = ref<any[]>([])

const templateSearch = ref('')
const activeTemplateCategory = ref('全部')
const toolSearch = ref('')
const activeToolCategory = ref('全部')
const activeToolStatus = ref<'全部状态' | '启用' | '禁用'>('全部状态')
const memorySearch = ref('')
const activeMemoryType = ref('全部')
const knowledgeSearch = ref('')
const activeKnowledgeId = ref<string | number>('')
const importingKnowledgeFiles = ref(false)
const agentSearch = ref('')
const selectedAgentName = ref('')
const settingsForm = ref({
  language: '简体中文',
  model: 'GPT-4o',
  theme: '跟随系统',
  autoSave: true,
  interval: '5 分钟',
  webhook: '',
  modelProvider: 'OpenAI',
  temperature: '0.7',
  maxTokens: '4096',
  memoryEnabled: true,
  memoryLimit: '5',
  memoryScope: '全部工作流',
  auditLog: true,
  allowExport: true,
  ipAllowlist: ''
})

const settingOptions = {
  language: ['简体中文', 'English'],
  model: ['GPT-4o', 'Qwen3-32B', 'DeepSeek-Coder', 'mock-workflow-generator'],
  theme: ['跟随系统', '浅色', '深色'],
  interval: ['1 分钟', '5 分钟', '10 分钟', '30 分钟'],
  modelProvider: ['OpenAI', '通义千问', 'DeepSeek', '本地模型'],
  temperature: ['0.2', '0.7', '1.0'],
  maxTokens: ['2048', '4096', '8192', '16384'],
  memoryLimit: ['3', '5', '10', '20'],
  memoryScope: ['全部工作流', '仅当前工作流', '关闭跨任务引用']
}

const filteredPaletteNodes = computed(() => {
  const keyword = paletteSearch.value.trim().toLowerCase()
  if (!keyword) return initialPaletteNodes
  return initialPaletteNodes.filter((node) => matchesText(keyword, node.label, node.desc, node.type))
})

const selectedTraceStep = computed(() => {
  return traceSteps.value.find((step) => step.nodeId === activeNodeId.value)
})

const selectedMemory = computed(() => memoryItems.value.find((item) => item.active) ?? memoryItems.value[0])
const selectedKnowledgeBase = computed(() => knowledgeBases.value.find((kb) => kb.active) ?? knowledgeBases.value[0])
const selectedAgent = computed(() => agentCards.value.find((agent) => agent.name === selectedAgentName.value) ?? agentCards.value[0])
const relatedTools = computed(() => {
  const selectedTool = selectedNode.value.toolName ?? selectedNode.value.tool
  return toolRows.value.filter((tool) => tool.name !== selectedTool).slice(0, 3)
})
const agentAvgSuccess = computed(() => {
  const values = agentCards.value.map((agent) => Number(String(agent.success).replace('%', ''))).filter(Number.isFinite)
  return values.length ? `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)}` : '0'
})
const agentTotalCalls = computed(() => {
  return agentCards.value.reduce((sum, agent) => sum + Number(String(agent.calls).replace(/,/g, '')), 0).toLocaleString('zh-CN')
})
const recentTasks = computed(() => traceSteps.value.map((step) => ({
  name: step.stepName,
  time: step.time,
  status: statusLabel(step.status)
})))

const templateStats = computed(() => [
  { label: '全部模板', value: templateCards.value.length, icon: Grid2X2, tone: 'violet' },
  { label: '官方模板', value: templateCards.value.filter((item) => item.badge === '官方' || item.tags.includes('官方')).length, icon: Star, tone: 'amber' },
  { label: '我的模板', value: templateCards.value.filter((item) => item.author !== 'TraceMind官方').length, icon: User, tone: 'blue' },
  { label: '收藏模板', value: templateCards.value.filter((item) => item.starred).length, icon: Heart, tone: 'pink' }
])

const templateCategories = computed(() => ['全部', ...Array.from(new Set(templateCards.value.flatMap((item) => item.tags))).filter(Boolean)])

const knowledgeStats = computed(() => [
  { label: '知识库总数', value: String(knowledgeBases.value.length), suffix: '个', icon: BookOpen, tone: 'violet' },
  { label: '文档数量', value: knowledgeBases.value.reduce((sum, item) => sum + Number(item.docs ?? 0), 0).toLocaleString('zh-CN'), suffix: '个', icon: FileText, tone: 'green' },
  { label: '知识片段', value: knowledgeBases.value.reduce((sum, item) => sum + Number(String(item.chunks ?? 0).replace(/,/g, '')), 0).toLocaleString('zh-CN'), suffix: '个', icon: Layers, tone: 'amber' },
  { label: '当前检索结果', value: String(retrievalSnippets.value.length), suffix: '条', icon: BarChart3, tone: 'violet' }
])

const memoryStats = computed(() => [
  { label: '用户偏好', value: memoryItems.value.filter((item) => item.type === '偏好记忆').length, desc: '数据库记录数量', icon: Heart, tone: 'pink' },
  { label: '任务历史', value: memoryItems.value.filter((item) => item.type === '任务历史').length, desc: '数据库记录数量', icon: Clock, tone: 'amber' },
  { label: '工具习惯', value: memoryItems.value.filter((item) => item.type === '工具习惯').length, desc: '数据库记录数量', icon: Wrench, tone: 'green' }
])

const memoryRefs = computed(() => memoryItems.value.slice(0, 3).map((item) => ({ icon: item.icon, tone: item.tone, text: item.title })))

const toolStats = computed(() => {
  const successRates = toolRows.value.map((tool) => Number(String(tool.success).replace('%', ''))).filter(Number.isFinite)
  const avgSuccess = successRates.length ? `${(successRates.reduce((sum, value) => sum + value, 0) / successRates.length).toFixed(1)}%` : '0%'
  return [
    { label: '全部工具', value: String(toolRows.value.length), delta: '0', icon: Box, tone: 'violet' },
    { label: '启用工具', value: String(toolRows.value.filter((tool) => tool.enabled).length), delta: '0', icon: CheckCircle, tone: 'green' },
    { label: '禁用工具', value: String(toolRows.value.filter((tool) => !tool.enabled).length), delta: '0', icon: PauseCircle, tone: 'amber' },
    { label: '平均成功率', value: avgSuccess, delta: '0', icon: Activity, tone: 'blue' },
    { label: '平均耗时', value: toolRows.value[0]?.latency ?? '0 ms', delta: '0', icon: Clock, tone: 'violet' }
  ]
})

const filteredTemplates = computed(() => {
  const keyword = templateSearch.value.trim().toLowerCase()
  return templateCards.value.filter((item) => {
    const inCategory = activeTemplateCategory.value === '全部' || item.tags.includes(activeTemplateCategory.value)
    const inSearch = !keyword || matchesText(keyword, item.title, item.desc, item.tags.join(' '))
    return inCategory && inSearch
  })
})

const filteredTools = computed(() => {
  const keyword = toolSearch.value.trim().toLowerCase()
  return toolRows.value.filter((tool) => {
    const rawCategory = tool.category ?? tool.type
    const normalizedType = rawCategory === '数据分析' ? '分析计算' : rawCategory
    const inCategory = activeToolCategory.value === '全部' || normalizedType === activeToolCategory.value
    const inStatus =
      activeToolStatus.value === '全部状态' ||
      (activeToolStatus.value === '启用' && tool.enabled) ||
      (activeToolStatus.value === '禁用' && !tool.enabled)
    const inSearch = !keyword || matchesText(keyword, tool.name, tool.desc, tool.type)
    return inCategory && inStatus && inSearch
  })
})

const filteredMemories = computed(() => {
  const keyword = memorySearch.value.trim().toLowerCase()
  return memoryItems.value.filter((item) => {
    const inType = activeMemoryType.value === '全部' || item.type === activeMemoryType.value
    const inSearch = !keyword || matchesText(keyword, item.title, item.desc, item.type)
    return inType && inSearch
  })
})

const filteredKnowledgeBases = computed(() => {
  const keyword = knowledgeSearch.value.trim().toLowerCase()
  if (!keyword) return knowledgeBases.value
  return knowledgeBases.value.filter((kb) => matchesText(keyword, kb.name, kb.desc))
})

const filteredAgents = computed(() => {
  const keyword = agentSearch.value.trim().toLowerCase()
  if (!keyword) return agentCards.value
  return agentCards.value.filter((agent) => matchesText(keyword, agent.name, agent.tag, agent.model))
})

const workflowPayload = computed(() => ({
  id: workflowId.value ?? undefined,
  name: workflowTitle.value,
  description: workflowDescription.value,
  sourceType: 'manual',
  intent: 'financial_report_analysis',
  confidence: 0.94,
  status: 'draft',
  nodes: workflowNodes.value,
  edges: workflowEdges.value
}))

function matchesText(keyword: string, ...values: Array<string | number | undefined | null>) {
  return values.some((value) => String(value ?? '').toLowerCase().includes(keyword))
}

function iconForTool(name: string) {
  if (name.includes('resume') || name.includes('job_requirement')) return ContactRound
  if (name.includes('candidate')) return ListOrdered
  if (name.includes('recruitment')) return FileChartColumn
  if (name.includes('pdf') || name.includes('summary') || name.includes('output')) return FileText
  if (name.includes('financial') || name.includes('risk')) return BarChart3
  if (name.includes('knowledge') || name.includes('search')) return Search
  if (name.includes('code')) return Code2
  if (name.includes('translate')) return Languages
  return Wrench
}

function toneForIndex(index: number) {
  return ['violet', 'green', 'amber', 'blue', 'cyan'][index % 5]
}

const toolDisplayNames: Record<string, string> = {
  pdf_parse_tool: 'PDF解析工具',
  financial_extract_tool: '财务指标提取工具',
  financial_risk_tool: '财务风险分析工具',
  risk_summary_tool: '风险总结工具',
  document_classify_tool: '文档类型识别工具',
  report_output_tool: '报告输出工具',
  report_generate_tool: '报告生成工具',
  markdown_to_docx_tool: 'Word导出工具',
  intent_classifier: '意图识别工具',
  user_input: '用户输入',
  summary_llm: '总结模型',
  finance_knowledge_base: '财务知识库检索工具',
  knowledge_search_tool: '知识检索工具'
}

function normalizeToolName(node: any) {
  return String(node.toolName ?? node.tool ?? '').replace(/\s+/g, '_')
}

function normalizeCandidateTools(node: any): ToolScore[] {
  const configCandidates = node.config?.candidateTools ?? node.config?.candidate_tools
  const raw = node.candidateTools ?? node.candidate_tools ?? configCandidates ?? []
  if (!Array.isArray(raw)) return []

  return raw
    .map((tool: any) => ({
      name: String(tool.name ?? tool.toolName ?? tool.tool_name ?? ''),
      displayName: typeof tool.displayName === 'string' ? tool.displayName : typeof tool.display_name === 'string' ? tool.display_name : undefined,
      score: Number(tool.score ?? tool.finalScore ?? tool.final_score ?? 0),
      reason: typeof tool.reason === 'string' ? tool.reason : undefined
    }))
    .filter((tool) => tool.name)
}

function normalizeWorkflowNode(node: any): WorkflowNode {
  const toolName = normalizeToolName(node)
  return {
    ...node,
    id: String(node.id),
    type: String(node.type ?? ''),
    label: String(node.label ?? node.id ?? ''),
    subLabel: String(node.subLabel ?? node.sub_label ?? ''),
    icon: String(node.icon ?? 'Sparkles'),
    position: {
      x: Number(node.position?.x ?? node.x ?? 0),
      y: Number(node.position?.y ?? node.y ?? 0)
    },
    status: (node.status ?? 'idle') as NodeStatus,
    tone: node.tone ?? 'blue',
    tool: toolName,
    toolName,
    displayName: String(node.displayName ?? node.display_name ?? node.config?.displayName ?? toolDisplayNames[toolName] ?? toolName),
    toolReason: node.toolReason ?? node.tool_reason ?? node.config?.toolReason,
    roleInWorkflow: node.roleInWorkflow ?? node.role_in_workflow ?? node.config?.roleInWorkflow,
    confidence: Number(node.confidence ?? 0),
    reason: String(node.reason ?? ''),
    candidateTools: normalizeCandidateTools(node),
    config: node.config ?? null,
    inputSummary: node.inputSummary ?? node.input_summary ?? node.config?.inputSummary,
    outputSummary: node.outputSummary ?? node.output_summary ?? node.config?.outputSummary,
    inputData: node.inputData ?? node.input_data ?? node.config?.inputData,
    outputData: node.outputData ?? node.output_data ?? node.config?.outputData
  }
}

function normalizeWorkflow(workflow: any) {
  workflowId.value = Number(workflow.id ?? workflowId.value ?? 0) || null
  workflowTitle.value = workflow.name ?? workflowTitle.value
  workflowDescription.value = workflow.description ?? workflowDescription.value
  workflowNodes.value = Array.isArray(workflow.nodes) ? workflow.nodes.map(normalizeWorkflowNode) : []
  workflowEdges.value = Array.isArray(workflow.edges) ? workflow.edges : []
  activeNodeId.value = workflowNodes.value[0]?.id ?? ''
}

function applyTraceToWorkflowNodes(steps: TraceStep[]) {
  const stepByNode = new Map(steps.filter((step) => step.nodeId).map((step) => [step.nodeId as string, step]))
  workflowNodes.value = workflowNodes.value.map((node) => ({
    ...node,
    status: stepByNode.get(node.id)?.status ?? node.status,
    inputData: stepByNode.get(node.id)?.inputData ?? node.inputData,
    outputData: stepByNode.get(node.id)?.outputData ?? node.outputData,
    inputSummary: stepByNode.get(node.id)?.inputSummary ?? node.inputSummary,
    outputSummary: stepByNode.get(node.id)?.outputSummary ?? node.outputSummary
  }))
  const failed = steps.find((step) => step.status === 'failed')
  activeNodeId.value = failed?.nodeId ?? steps[steps.length - 1]?.nodeId ?? activeNodeId.value
}

function statusFromRunAndTrace(status: unknown, steps: TraceStep[]): 'idle' | 'running' | 'complete' | 'failed' {
  if (status === 'failed' || steps.some((step) => step.status === 'failed' || step.status === 'permission_denied' || step.status === 'cancelled')) {
    return 'failed'
  }
  if (status === 'running' || steps.some((step) => step.status === 'running' || step.status === 'queued')) {
    return 'running'
  }
  if (status === 'success' || steps.length) return 'complete'
  return 'idle'
}

function mapWorkflowHistory(row: any): WorkflowHistoryItem {
  return {
    id: Number(row.id),
    name: String(row.name ?? `Workflow ${row.id}`),
    workflowType: row.workflowType ?? row.workflow_type ?? row.intent,
    intent: row.intent,
    status: row.status,
    nodeCount: Number(row.nodeCount ?? row.node_count ?? row.workflowJson?.nodes?.length ?? 0),
    edgeCount: Number(row.edgeCount ?? row.edge_count ?? row.workflowJson?.edges?.length ?? 0),
    latestRunId: Number(row.latestRunId ?? row.latest_run_id ?? 0) || null,
    latestRunStatus: row.latestRunStatus ?? row.latest_run_status ?? null,
    updatedAt: row.updatedAt ?? row.updated_at,
    createdAt: row.createdAt ?? row.created_at
  }
}

function mapRunHistory(row: any): RunHistoryItem {
  return {
    id: Number(row.id),
    workflowId: Number(row.workflowId ?? row.workflow_id ?? 0),
    workflowName: row.workflowName ?? row.workflow_name,
    status: String(row.status ?? 'unknown'),
    totalLatencyMs: Number(row.totalLatencyMs ?? row.total_latency_ms ?? 0),
    files: Array.isArray(row.files) ? row.files.map(mapHistoryFile) : [],
    summary: row.summary,
    errorMessage: row.errorMessage ?? row.error_message,
    startedAt: row.startedAt ?? row.started_at,
    finishedAt: row.finishedAt ?? row.finished_at
  }
}

function mapHistoryFile(file: any): UploadedFile {
  return {
    id: file?.id,
    fileId: file?.fileId ?? file?.id,
    filename: String(file?.originalName ?? file?.filename ?? file?.name ?? '未命名文件'),
    originalName: file?.originalName,
    filePath: String(file?.filePath ?? file?.path ?? ''),
    mimeType: file?.mimeType,
    size: Number(file?.size ?? 0) || undefined,
    status: file?.status === 'failed' ? 'failed' : 'uploaded',
    error: file?.error
  }
}

function mapTool(row: any, index: number) {
  const toolKind = String(row.type ?? row.toolType ?? 'builtin')
  const typeLabel = toolKind === 'http' ? 'HTTP API' : toolKind === 'llm' ? 'LLM Prompt' : row.category ?? '内置工具'
  const normalizedTypeLabel = toolKind === 'mcp' ? 'MCP' : typeLabel
  return {
    id: row.id,
    name: row.name ?? row.display_name ?? `tool_${index + 1}`,
    displayName: row.displayName ?? row.display_name ?? row.name ?? `tool_${index + 1}`,
    version: row.version ?? 'v1.0.0',
    type: normalizedTypeLabel,
    toolKind,
    source: row.source ?? (toolKind === 'mcp' ? 'mcp' : 'local'),
    mcpServerId: row.mcpServerId ?? row.mcp_server_id,
    mcpToolName: row.mcpToolName ?? row.mcp_tool_name,
    category: row.category ?? normalizedTypeLabel,
    desc: row.description ?? '暂无描述',
    description: row.description ?? '暂无描述',
    enabled: row.enabled === true || row.enabled === 1,
    riskLevel: row.riskLevel ?? row.risk_level ?? 'low',
    inputSchema: row.inputSchema ?? row.input_schema,
    outputSchema: row.outputSchema ?? row.output_schema,
    configJson: row.configJson ?? row.config_json,
    authConfig: row.authConfig ?? row.auth_config,
    success: `${Number(row.success_rate ?? 0).toFixed(1)}%`,
    latency: formatMs(row.avg_latency_ms),
    calls: Number(row.call_count ?? 0).toLocaleString('zh-CN'),
    icon: iconForTool(String(row.name ?? '')),
    tone: toneForIndex(index),
    trend: row.enabled ? 'up' : 'down',
    raw: row
  }
}

function mapTemplate(row: any, index: number) {
  const workflowJson = row.workflow_json ?? {}
  const tags = [row.category ?? '其他', row.is_official ? '官方' : '社区'].filter(Boolean)
  return {
    id: row.id,
    title: row.title ?? `模板 ${index + 1}`,
    badge: row.badge ?? (row.is_official ? '官方' : ''),
    badgeTone: row.is_official ? 'violet' : 'blue',
    desc: row.description ?? '暂无描述',
    steps: Array.isArray(workflowJson?.steps) ? workflowJson.steps : ['需求输入', '流程生成', '工具执行', '结果输出'],
    tags,
    views: String(row.view_count ?? 0),
    likes: Number(row.like_count ?? 0),
    author: row.is_official ? 'TraceMind官方' : '社区用户',
    date: shortDate(row.updated_at ?? row.created_at),
    starred: Number(row.starred_count ?? 0) > 0,
    tone: toneForIndex(index)
  }
}

function mapKnowledgeBase(row: any, index: number) {
  return {
    id: row.id,
    name: row.name ?? `知识库 ${index + 1}`,
    desc: row.description ?? '暂无描述',
    docs: Number(row.document_count ?? 0),
    chunks: Number(row.chunk_count ?? 0).toLocaleString('zh-CN'),
    updated: row.updated_at ?? '刚刚',
    icon: index % 2 === 0 ? FileText : BarChart3,
    tone: toneForIndex(index),
    active: index === 0,
    embeddingModel: row.embedding_model ?? '-',
    chunkSize: row.chunk_size ?? 800,
    chunkOverlap: row.chunk_overlap ?? 120,
    retrievalMode: row.retrieval_mode ?? 'hybrid',
    topK: row.top_k ?? 5,
    status: row.status ?? 'normal',
    createdAt: row.created_at ?? '-',
    ownerUserId: row.owner_user_id ?? '-'
  }
}

function mapKnowledgeDocument(row: any) {
  return {
    id: row.id,
    name: row.title || row.filename || `文档 ${row.id}`,
    type: `${Number(row.chunk_count ?? 0)} chunks`,
    tone: row.parse_status === 'parsed' ? 'green' : 'amber',
    size: row.file_size == null ? '-' : formatFileSize(row.file_size),
    createdAt: row.created_at ?? '-'
  }
}

async function loadKnowledgeDocuments(knowledgeBaseId: number | string | undefined) {
  knowledgeDocuments.value = []
  if (!knowledgeBaseId) return

  const rows = await api.listKnowledgeDocuments(Number(knowledgeBaseId))
  knowledgeDocuments.value = rows.map(mapKnowledgeDocument)
}

function mapMemory(row: any, index: number) {
  const typeMap: Record<string, string> = {
    preference: '偏好记忆',
    task_history: '任务历史',
    tool_preference: '工具习惯'
  }
  const toneMap: Record<string, string> = {
    preference: 'pink',
    task_history: 'amber',
    tool_preference: 'green'
  }
  const iconMapByType: Record<string, any> = {
    preference: Heart,
    task_history: Clock,
    tool_preference: Wrench
  }
  return {
    id: row.id,
    title: row.title ?? `记忆 ${index + 1}`,
    desc: row.content ?? '暂无内容',
    type: typeMap[row.memory_type] ?? row.memory_type ?? '普通记忆',
    level: row.importance === 'high' ? '高' : row.importance === 'low' ? '低' : '中',
    tone: toneMap[row.memory_type] ?? 'green',
    icon: iconMapByType[row.memory_type] ?? FileText,
    updated: row.updated_at ?? '刚刚',
    active: index === 0,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at ?? '-',
    sourceType: row.source_type ?? '-'
  }
}

function applySettings(row: any) {
  if (!row) return
  const extra = row.settings_json ?? row.settingsJson ?? {}
  const interval = (row.auto_save_interval ?? row.autoSaveInterval ?? Number(settingsForm.value.interval.replace(/\D/g, ''))) || 5
  settingsForm.value = {
    ...settingsForm.value,
    ...extra,
    language: row.language === 'zh-CN' ? '简体中文' : row.language === 'en-US' ? 'English' : settingsForm.value.language,
    model: row.default_model ?? row.defaultModel ?? settingsForm.value.model,
    theme: row.theme === 'system' ? '跟随系统' : row.theme === 'light' ? '浅色' : row.theme === 'dark' ? '深色' : row.theme ?? settingsForm.value.theme,
    autoSave: Boolean(row.auto_save ?? row.autoSave ?? settingsForm.value.autoSave),
    interval: `${interval} 分钟`,
    webhook: row.webhook_url ?? row.webhookUrl ?? settingsForm.value.webhook
  }
}

async function loadBackendData() {
  try {
    const previousKnowledgeBaseId = activeKnowledgeId.value
    const [workflows, tools, mcpServerRows, secrets, templates, bases, memories, settings] = await Promise.all([
      api.listWorkflows(),
      api.listTools(),
      api.listMcpServers(),
      api.listSecrets(),
      api.listTemplates(),
      api.listKnowledgeBases(),
      api.listMemories(),
      api.listSettings()
    ])
    apiOnline.value = true
    applySettings(settings)
    restoreMockWorkflow('暂无工作流')
    toolRows.value = tools.map(mapTool)
    mcpServers.value = mcpServerRows
    userSecrets.value = secrets
    templateCards.value = templates.map(mapTemplate)
    const mappedKnowledgeBases = bases.map(mapKnowledgeBase)
    const activeKnowledgeBase = mappedKnowledgeBases.find((item) => item.id === previousKnowledgeBaseId)
      ?? mappedKnowledgeBases.find((item) => Number(String(item.chunks).replace(/,/g, '')) > 0)
      ?? mappedKnowledgeBases[0]
    knowledgeBases.value = mappedKnowledgeBases.map((item) => ({ ...item, active: item.id === activeKnowledgeBase?.id }))
    activeKnowledgeId.value = activeKnowledgeBase?.id ?? activeKnowledgeBase?.name ?? ''
    await loadKnowledgeDocuments(activeKnowledgeBase?.id)
    memoryItems.value = memories.map(mapMemory)
    agentCards.value = workflows.map((workflow, index) => ({
      name: workflow.name,
      tag: workflow.intent ?? '工作流',
      icon: Workflow,
      tone: toneForIndex(index),
      model: settingsForm.value.model,
      tools: Array.isArray(workflow.workflowJson?.nodes) ? workflow.workflowJson.nodes.length : 0,
      success: `${Math.round(Number(workflow.confidence ?? 0) * 100)}%`,
      calls: '0',
      running: 0,
      online: true
    }))
    selectedAgentName.value = agentCards.value[0]?.name ?? ''
    notify('已连接后端数据')
  } catch {
    apiOnline.value = false
    restoreMockWorkflow('暂无工作流')
    workflowId.value = null
    workflowTitle.value = '暂无工作流'
    workflowDescription.value = '暂无工作流，请先在工作台生成工作流'
    workflowNodes.value = []
    workflowEdges.value = []
    traceSteps.value = []
    toolRows.value = []
    mcpServers.value = []
    templateCards.value = []
    knowledgeBases.value = []
    memoryItems.value = []
    agentCards.value = []
    notify('后端未连接，Workflow 页面保持空状态')
  }
}

async function loadConversations() {
  try {
    conversations.value = await api.listConversations()
  } catch {
    conversations.value = []
  }
}

async function loadWorkflowHistory() {
  try {
    workflowHistory.value = (await api.listWorkflowHistory()).map(mapWorkflowHistory)
  } catch {
    workflowHistory.value = []
  }
}

async function loadRunHistory() {
  try {
    runHistory.value = (await api.listRunHistory()).map(mapRunHistory)
  } catch {
    runHistory.value = []
  }
}

async function refreshWorkflowHistories() {
  await Promise.all([loadWorkflowHistory(), loadRunHistory()])
}

function rememberWorkflowSelection(id: number | null) {
  activeWorkflowId.value = id
  workflowId.value = id
  if (id) localStorage.setItem('tracemind_active_workflow_id', String(id))
  else localStorage.removeItem('tracemind_active_workflow_id')
}

function rememberRunSelection(id: number | null) {
  activeRunId.value = id
  if (id) localStorage.setItem('tracemind_active_run_id', String(id))
  else localStorage.removeItem('tracemind_active_run_id')
}

async function loadWorkflow(targetWorkflowId: number) {
  const workflow = await api.getWorkflow(targetWorkflowId)
  normalizeWorkflow(workflow)
  rememberWorkflowSelection(targetWorkflowId)
  rememberRunSelection(null)
  traceSteps.value = []
  workflowStatus.value = 'idle'
  setPage('workflow')
}

async function loadRunReplay(targetRunId: number) {
  const replay = await api.getRunReplay(targetRunId)
  if (replay?.workflow) {
    normalizeWorkflow(replay.workflow)
    rememberWorkflowSelection(Number(replay.workflow.id ?? replay.run?.workflowId ?? 0) || null)
  }

  const steps = Array.isArray(replay?.traceSteps) ? replay.traceSteps : Array.isArray(replay?.run?.trace) ? replay.run.trace : []
  traceSteps.value = steps
  applyTraceToWorkflowNodes(traceSteps.value)
  rememberRunSelection(targetRunId)
  runOutput.value = JSON.stringify(replay?.run?.outputData ?? replay?.run ?? replay, null, 2)
  runError.value = replay?.run?.errorMessage ?? ''
  workflowStatus.value = statusFromRunAndTrace(replay?.run?.status, traceSteps.value)
  traceOpenKey.value += 1
  setPage('workflow')
}

async function loadConversation(targetConversationId: string) {
  activeConversationId.value = targetConversationId
  conversationId.value = targetConversationId
  localStorage.setItem('tracemind_active_conversation_id', targetConversationId)

  const rows = await api.getConversationMessages(targetConversationId)
  chatMessages.value = rows.map(messageFromHistoryRow)
  conversationStatus.value = chatMessages.value.length ? '已加载历史' : '空会话'

  const latestContextMessage = [...chatMessages.value].reverse().find((message) => message.workflowId || message.runId || message.files?.length)
  lastWorkflowId.value = latestContextMessage?.workflowId ?? null
  lastRunId.value = latestContextMessage?.runId ?? null
  lastWorkflowFiles.value = latestContextMessage?.files ?? []
}

function messageFromHistoryRow(row: any): ChatMessage {
  const metadata = asRecord(row.metadata) ?? {}
  const createdAt = String(row.createdAt ?? row.created_at ?? new Date().toISOString())
  const content = String(row.content ?? '')
  return {
    id: Number(row.id),
    role: row.role === 'assistant' ? 'assistant' : 'user',
    text: content,
    time: formatMessageTime(createdAt),
    createdAt,
    sequence: Number(row.sequence ?? row.id ?? 0),
    workflowId: Number(metadata.workflowId ?? matchNumber(content, /Workflow ID\D+(\d+)/i) ?? 0) || null,
    runId: Number(metadata.runId ?? matchNumber(content, /Run ID\D+(\d+)/i) ?? 0) || null,
    files: Array.isArray(metadata.files) ? (metadata.files as UploadedFile[]) : [],
    finalResult: metadata.finalResult,
    messageType: typeof metadata.messageType === 'string' ? metadata.messageType : undefined,
    sources: normalizeSources(metadata.sources)
  }
}

function matchNumber(text: string, pattern: RegExp) {
  const matched = text.match(pattern)
  return matched?.[1] ? Number(matched[1]) : null
}

async function saveWorkflow() {
  workflowStatus.value = 'saving'
  try {
    if (workflowId.value) {
      await api.updateWorkflow(workflowId.value, workflowPayload.value)
    }
    await loadWorkflowHistory()
    savedAt.value = timeNow()
    workflowStatus.value = 'complete'
    notify(workflowId.value ? '工作流已保存到后端' : '当前工作流已本地保存')
  } catch (error) {
    workflowStatus.value = 'failed'
    notify(error instanceof Error ? error.message : '保存失败')
  }
}

async function generateWorkflowFromInput(query?: string) {
  const prompt = (query ?? agentInput.value).trim()
  if (!prompt) {
    notify('请先输入需要生成的工作流任务')
    return
  }
  try {
    const workflow = await api.generateWorkflow(prompt, uploadedFiles.value, activeConversationId.value)
    apiOnline.value = true
    normalizeWorkflow(workflow)
    rememberWorkflowSelection(Number(workflow.id ?? 0) || null)
    rememberRunSelection(null)
    await loadWorkflowHistory()
    traceSteps.value = []
    runOutput.value = ''
    workflowStatus.value = 'idle'
    setPage('workflow')
    notify('已根据输入生成工作流')
  } catch (error) {
    notify(error instanceof Error ? error.message : '后端未连接，无法从数据库生成工作流')
  }
}

async function runWorkflowNow() {
  workflowStatus.value = 'running'
  workflowNodes.value = workflowNodes.value.map((node) => ({ ...node, status: 'running' }))
  runError.value = ''

  try {
    if (!workflowId.value) {
      notify('暂无工作流，请先在工作台生成工作流')
      workflowStatus.value = 'idle'
      workflowNodes.value = workflowNodes.value.map((node) => ({ ...node, status: 'idle' }))
      return
    }
    const result = await api.runWorkflow(workflowId.value as number, {
      query: workflowTitle.value,
      files: uploadedFiles.value,
      conversationId: activeConversationId.value
    })
    runOutput.value = JSON.stringify(result.output ?? result, null, 2)
    if (result.runId) {
      rememberRunSelection(Number(result.runId))
      traceSteps.value = await api.getTrace(result.runId)
      applyTraceToWorkflowNodes(traceSteps.value)
    }
    rememberWorkflowSelection(Number(result.workflowId ?? workflowId.value ?? 0) || null)
    await refreshWorkflowHistories()
    apiOnline.value = true
    workflowStatus.value = result.status === 'failed' || result.output?.businessStatus === 'failed' ? 'failed' : 'complete'
    runError.value = result.errorMessage ?? ''
    notify(
      result.status === 'failed' || result.output?.businessStatus === 'failed'
        ? '运行结束，但业务分析未完成'
        : '工作流运行完成'
    )
  } catch (error) {
    workflowStatus.value = 'failed'
    runOutput.value = ''
    notify(error instanceof Error ? error.message : '运行失败')
  }
}

function addPaletteNode(node: PaletteNode) {
  const id = `${node.type}-${Date.now().toString(36).slice(-4)}`
  const x = 120 + (workflowNodes.value.length % 4) * 160
  const y = 120 + Math.floor(workflowNodes.value.length / 4) * 120
  workflowNodes.value = [
    ...workflowNodes.value,
    {
      id,
      type: node.type,
      label: node.label,
      subLabel: node.desc,
      icon: node.icon,
      position: { x, y },
      status: 'idle',
      tone: node.tone,
      tool: node.type === 'search' ? 'knowledge_search_tool' : node.type === 'llm' ? 'summary_llm' : 'user_input',
      confidence: 0.76,
      reason: `从工具库添加“${node.label}”，用于扩展当前工作流。`
    }
  ]
  activeNodeId.value = id
  workflowStatus.value = 'idle'
}

function addCustomNode() {
  addPaletteNode({
    type: 'custom',
    label: '自定义节点',
    desc: '手动配置工具和输入输出',
    icon: 'Sparkles',
    category: '自定义',
    tone: 'violet'
  })
}

function zoomCanvas(delta: number) {
  workflowZoom.value = Math.min(150, Math.max(60, workflowZoom.value + delta))
}

function resetCanvas() {
  workflowZoom.value = 100
  activeNodeId.value = workflowNodes.value[0]?.id ?? activeNodeId.value
}

function updateNodePosition(nodeId: string, position: { x: number; y: number }) {
  workflowNodes.value = workflowNodes.value.map((node) => (node.id === nodeId ? { ...node, position } : node))
  workflowStatus.value = 'idle'
}

function createWorkflowEdge(edge: WorkflowEdge) {
  const exists = workflowEdges.value.some((item) => item.source === edge.source && item.target === edge.target)
  if (edge.source === edge.target || exists) return
  workflowEdges.value = [...workflowEdges.value, edge]
  workflowStatus.value = 'idle'
}

function updateWorkflowEdge(edgeId: string, edge: WorkflowEdge) {
  workflowEdges.value = workflowEdges.value.map((item) => (item.id === edgeId ? { ...item, ...edge, id: edgeId } : item))
  workflowStatus.value = 'idle'
}

function deleteWorkflowNode(nodeId: string) {
  workflowNodes.value = workflowNodes.value.filter((node) => node.id !== nodeId)
  workflowEdges.value = workflowEdges.value.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
  activeNodeId.value = workflowNodes.value[0]?.id ?? ''
  workflowStatus.value = 'idle'
}

function deleteWorkflowEdge(edgeId: string) {
  workflowEdges.value = workflowEdges.value.filter((edge) => edge.id !== edgeId)
  workflowStatus.value = 'idle'
}

function exportWorkflow() {
  navigator.clipboard?.writeText(JSON.stringify(workflowPayload.value, null, 2))
  notify('工作流 JSON 已复制')
}

function shareWorkflow() {
  navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}#workflow`)
  notify('分享链接已复制')
}

async function uploadAgentFiles(files: FileList) {
  const sourceFiles = Array.from(files)
  const existingKeys = new Set(uploadedFiles.value.map((file) => `${file.originalName ?? file.filename}:${file.size ?? 0}`.toLowerCase()))
  const batchKeys = new Set<string>()
  const uniqueSourceFiles = sourceFiles.filter((file) => {
    const key = `${file.name}:${file.size}`.toLowerCase()
    if (existingKeys.has(key) || batchKeys.has(key)) return false
    batchKeys.add(key)
    return true
  })
  const duplicateCount = sourceFiles.length - uniqueSourceFiles.length
  if (uniqueSourceFiles.length === 0) {
    notify('所选文件已在上传列表中，未重复添加')
    return
  }

  uploadingFiles.value = true
  try {
    const settled = await Promise.allSettled(uniqueSourceFiles.map((file) => api.uploadFile(file)))
    const mappedFiles = settled.map((result, index): UploadedFile => {
      const sourceFile = uniqueSourceFiles[index]
      if (result.status === 'fulfilled') {
        const file = result.value
        return {
          id: file.id,
          fileId: file.fileId ?? file.id,
          filename: String(file.originalName ?? file.filename ?? file.name ?? sourceFile.name),
          originalName: typeof file.originalName === 'string' ? file.originalName : sourceFile.name,
          filePath: String(file.filePath ?? file.path ?? ''),
          mimeType: file.mimeType ?? sourceFile.type,
          size: Number(file.size ?? sourceFile.size) || undefined,
          status: 'uploaded'
        }
      }

      const message = result.reason instanceof Error ? result.reason.message : '上传失败'
      return {
        fileId: `${Date.now()}-${index}`,
        filename: sourceFile.name,
        originalName: sourceFile.name,
        filePath: '',
        mimeType: sourceFile.type,
        size: sourceFile.size,
        status: 'failed',
        error: message
      }
    })

    uploadedFiles.value = [
      ...uploadedFiles.value,
      ...mappedFiles
    ]
    const successCount = mappedFiles.filter((file) => file.status === 'uploaded').length
    const failedCount = mappedFiles.filter((file) => file.status === 'failed').length
    const duplicateMessage = duplicateCount ? `，已忽略 ${duplicateCount} 个重复文件` : ''
    notify(failedCount ? `已上传 ${successCount} 个文件，${failedCount} 个失败${duplicateMessage}` : `已上传 ${successCount} 个文件${duplicateMessage}`)
  } catch (error) {
    notify(error instanceof Error ? error.message : '文件上传失败')
  } finally {
    uploadingFiles.value = false
  }
}

function dedupeUploadedFiles(files: UploadedFile[]) {
  const seen = new Set<string>()
  return files.filter((file) => {
    const key = `${file.originalName ?? file.filename}:${file.size ?? 0}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function shouldUseWorkflowMode(text: string) {
  if (uploadedFiles.value.length > 0) return true
  const normalized = text.toLowerCase()
  const explicitWorkflow = ['生成工作流', '创建工作流', '工作流', 'workflow', '执行流程'].some((keyword) =>
    normalized.includes(keyword.toLowerCase())
  )
  const financeWorkflow =
    (normalized.includes('财报') || normalized.includes('财务') || normalized.includes('pdf')) &&
    (normalized.includes('分析') || normalized.includes('风险') || normalized.includes('报告') || normalized.includes('总结'))
  const reportWorkflow =
    normalized.includes('生成') &&
    normalized.includes('报告') &&
    (normalized.includes('财务') || normalized.includes('财报') || normalized.includes('风险'))

  return explicitWorkflow || financeWorkflow || reportWorkflow
}

function readUsageTokens(usage: unknown) {
  if (!usage || typeof usage !== 'object') return 0
  const record = usage as Record<string, unknown>
  return Number(record.total_tokens ?? record.totalTokens ?? 0) || 0
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = displayTextFromValue(value)
    if (text) return text
  }
  return ''
}

function displayTextFromValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(displayTextFromValue).filter(Boolean).join('；')
  return ''
}

function compactText(value: string, limit = 520) {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized) return ''
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized
}

function firstContentText(...values: unknown[]) {
  let placeholder = ''
  for (const value of values) {
    const text = firstText(value)
    if (!text) continue
    if (!isPlaceholderText(text)) return text
    placeholder ||= text
  }
  return placeholder
}

function isPlaceholderText(text: string) {
  return (
    text.includes('没有可直接展示') ||
    text.includes('暂未返回可汇总') ||
    text.includes('暂未形成可展示') ||
    text.includes('没有可汇总的上游报告内容')
  )
}

function firstRiskLevel(...values: unknown[]) {
  let fallback = ''
  for (const value of values) {
    const text = firstText(value)
    if (!text) continue
    if (text.toLowerCase() !== 'unknown') return text
    fallback ||= text
  }
  return fallback
}

function outputContainsNoDataSignal(...values: unknown[]) {
  const text = values.map((value) => stringifyForSearch(value)).join('\n').toLowerCase()
  return ['无法完成有效分析', '未提取到指标', '未识别到财务数据', '文件不适合当前工作流', 'no data', 'not enough data'].some((keyword) =>
    text.includes(keyword.toLowerCase())
  )
}

function stringifyForSearch(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value ?? '')
  } catch {
    return String(value ?? '')
  }
}

function isBusinessFailureResult(result: unknown, records: Record<string, unknown>[]) {
  const resultRecord = asRecord(result)
  const output = asRecord(resultRecord?.output)
  const businessStatus = firstText(output?.businessStatus, resultRecord?.businessStatus)
  const riskLevel = firstRiskLevel(output?.riskLevel, resultRecord?.riskLevel, firstFieldText(records, ['riskLevel']))
  return businessStatus === 'failed' || riskLevel.toLowerCase() === 'unknown' || outputContainsNoDataSignal(result, records)
}

function collectDisplayRecords(result: unknown, steps: TraceStep[]) {
  const resultRecord = asRecord(result)
  const output = asRecord(resultRecord?.output)
  const context = asRecord(resultRecord?.context)
  const seeds = [
    resultRecord,
    output,
    asRecord(resultRecord?.finalResult),
    asRecord(output?.finalResult),
    context,
    asRecord(context?.finalResult),
    ...steps.map((step) => step.outputData)
  ]
  const records: Record<string, unknown>[] = []
  const seen = new Set<Record<string, unknown>>()

  const visit = (value: unknown, depth = 0) => {
    if (depth > 3) return
    const record = asRecord(value)
    if (!record || seen.has(record)) return
    seen.add(record)
    records.push(record)

    for (const nested of Object.values(record)) {
      if (asRecord(nested)) visit(nested, depth + 1)
      if (Array.isArray(nested)) nested.forEach((item) => visit(item, depth + 1))
    }
  }

  seeds.forEach((seed) => visit(seed))
  return records
}

function firstFieldText(records: Record<string, unknown>[], fields: string[]) {
  for (const record of records) {
    for (const field of fields) {
      const text = firstText(record[field])
      if (text) return text
    }
  }
  return ''
}

function buildRiskSummaryFromRecords(records: Record<string, unknown>[]) {
  const riskRecord = records.find(
    (record) =>
      firstText(record.riskLevel) ||
      firstText(record.risks) ||
      firstText(record.suggestions) ||
      firstText(record.recommendation)
  )
  if (!riskRecord) return ''

  return [
    firstText(riskRecord.riskLevel) && `风险等级：${firstText(riskRecord.riskLevel)}`,
    firstText(riskRecord.risks) && `风险：${firstText(riskRecord.risks)}`,
    firstText(riskRecord.recommendation, riskRecord.suggestions) && `建议：${firstText(riskRecord.recommendation, riskRecord.suggestions)}`
  ]
    .filter(Boolean)
    .join('\n')
}

function buildWorkflowAssistantText(result: any, workflow: any, filesForThisMessage: UploadedFile[], traceForThisRun: TraceStep[] = []) {
  const resultRecord = asRecord(result) ?? {}
  const output = asRecord(resultRecord.output) ?? {}
  const context = asRecord(resultRecord.context) ?? {}
  const displayRecords = collectDisplayRecords(resultRecord, traceForThisRun)
  const finalResult = asRecord(resultRecord.finalResult) ?? asRecord(output.finalResult) ?? asRecord(context.finalResult)
  const reportOutput =
    asRecord(output.report_output_tool) ??
    asRecord(output.report_output) ??
    asRecord(resultRecord.report_output_tool) ??
    asRecord(resultRecord.report_output)
  const report =
    asRecord(output.report) ??
    asRecord(output.report_generate_tool) ??
    asRecord(reportOutput?.report) ??
    asRecord(finalResult?.report)
  const summaryNode = asRecord(output.summary) ?? asRecord(output.risk_summary_tool)
  const riskNode = asRecord(output.risk) ?? asRecord(output.financial_risk_tool) ?? summaryNode
  const finalReport = asRecord(output.finalReport) ?? asRecord(resultRecord.finalReport) ?? asRecord(finalResult?.finalReport)
  const primary = output
  const genericMessage = firstText(primary.message, finalResult?.message, reportOutput?.message)
  const fallbackMessage = genericMessage === '工作流执行完成' || genericMessage === '结果输出完成' ? '' : genericMessage

  const summary = compactText(
    firstContentText(
      output.summary,
      finalReport?.summary,
      finalResult?.summary,
      context.finalResult,
      reportOutput?.summary,
      riskNode?.summary,
      summaryNode?.summary,
      summaryNode?.recommendation,
      firstFieldText(displayRecords, ['summary']),
      buildRiskSummaryFromRecords(displayRecords),
      firstFieldText(displayRecords, ['recommendation']),
      fallbackMessage
    )
  )
  const markdown = compactText(
    firstText(
      primary.markdown,
      primary.reportPreview,
      output.markdown,
      output.finalReport,
      finalReport?.markdown,
      finalReport?.content,
      report?.markdown,
      finalResult?.markdown,
      reportOutput?.markdown,
      reportOutput?.reportPreview,
      firstFieldText(displayRecords, ['markdown', 'finalReport', 'reportPreview', 'content'])
    ),
    720
  )
  const downloadUrl = firstText(primary.downloadUrl, finalResult?.downloadUrl, reportOutput?.downloadUrl, firstFieldText(displayRecords, ['downloadUrl']))
  const riskLevel = firstRiskLevel(primary.riskLevel, riskNode?.riskLevel, finalResult?.riskLevel, firstFieldText(displayRecords, ['riskLevel']))
  const fileList = filesForThisMessage.map((file) => file.originalName ?? file.filename).filter(Boolean)
  const businessFailed = isBusinessFailureResult(resultRecord, displayRecords)
  const businessMessage = firstText(primary.businessMessage, resultRecord.businessMessage)
  const suggestedAction = firstText(primary.suggestedAction, resultRecord.suggestedAction)
  const warnings = Array.isArray(primary.warnings) ? primary.warnings.map(String) : []
  const skippedWebSearch = warnings.some((warning) => warning.includes('已跳过外部资料检索'))
  const lines = [
    businessFailed
      ? '分析未完成 / 文件不适合当前工作流。'
      : workflow.intent === 'document_summary_workflow'
        ? '文档总结已完成。'
        : '分析已完成。'
  ]

  if (skippedWebSearch) lines.push('已跳过外部联网搜索，正在基于上传文件继续分析。')
  if (fileList.length) lines.push(`已处理文件：${fileList.join('、')}`)
  if (businessFailed && businessMessage) lines.push(businessMessage)
  if (summary) {
    lines.push('')
    lines.push(businessFailed ? '已获得的信息：' : '结果摘要：')
    lines.push(summary)
  }
  if (riskLevel && riskLevel.toLowerCase() !== 'unknown') lines.push(`风险等级：${riskLevel}`)
  if (markdown) {
    lines.push('')
    lines.push('报告预览：')
    lines.push(markdown)
  }
  if (downloadUrl) lines.push(`下载地址：${downloadUrl}`)
  if (businessFailed) {
    lines.push('')
    lines.push('下一步建议：')
    lines.push(suggestedAction || '请上传包含有效财务数据的文件，或改用文档总结工作流。')
  }
  if (!summary && !markdown && !downloadUrl) {
    lines.push(businessFailed ? '当前结果没有足够数据支撑有效业务分析。' : '后端已返回运行结果，但当前结果中没有可直接展示的摘要内容。')
  }

  return lines.join('\n')
}

function nextChatSequence() {
  return Math.floor(chatMessages.value.length / 2) * 2
}

function messageFromApi(message: any, fallback: ChatMessage): ChatMessage {
  const createdAt = String(message?.createdAt ?? fallback.createdAt ?? new Date().toISOString())
  const metadata = asRecord(message?.metadata) ?? {}
  return {
    ...fallback,
    id: Number(message?.id ?? fallback.id),
    role: (message?.role ?? fallback.role) as 'user' | 'assistant',
    text: String(message?.content ?? fallback.text),
    createdAt,
    sequence: Number(message?.sequence ?? fallback.sequence ?? 0),
    time: formatMessageTime(createdAt, fallback.time),
    workflowId: Number(metadata.workflowId ?? fallback.workflowId ?? 0) || null,
    runId: Number(metadata.runId ?? fallback.runId ?? 0) || null,
    files: Array.isArray(metadata.files) ? (metadata.files as UploadedFile[]) : fallback.files,
    finalResult: metadata.finalResult ?? fallback.finalResult,
    messageType: typeof metadata.messageType === 'string' ? metadata.messageType : fallback.messageType,
    sources: normalizeSources(metadata.sources).length ? normalizeSources(metadata.sources) : fallback.sources
  }
}

function normalizeSources(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const record = asRecord(item)
      const url = typeof record?.url === 'string' ? record.url : ''
      if (!/^https?:\/\//i.test(url)) return null
      return {
        title: typeof record?.title === 'string' && record.title.trim() ? record.title.trim() : url,
        url
      }
    })
    .filter((item): item is { title: string; url: string } => Boolean(item))
}

function formatMessageTime(createdAt?: string, fallback = timeNow().slice(0, 5)) {
  if (!createdAt) return fallback
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toTimeString().slice(0, 5)
}

function rememberConversation(targetConversationId: string) {
  activeConversationId.value = targetConversationId
  conversationId.value = targetConversationId
  localStorage.setItem('tracemind_active_conversation_id', targetConversationId)
}

async function ensureActiveConversation() {
  if (activeConversationId.value) return activeConversationId.value
  const conversation = await api.createConversation()
  const id = String(conversation.id)
  rememberConversation(id)
  await loadConversations()
  return id
}

async function appendPersistedMessage(
  targetConversationId: string,
  input: { role: 'user' | 'assistant'; content: string; metadata?: unknown; sequence?: number }
) {
  try {
    const row = await api.appendConversationMessage(targetConversationId, input)
    await loadConversations()
    return row
  } catch {
    return null
  }
}

function latestWorkflowContext() {
  const reversedMessages = [...chatMessages.value].reverse()
  const latestMessage = reversedMessages.find((message) => Array.isArray(asRecord(message.finalResult)?.rankings))
    ?? reversedMessages.find((message) => message.workflowId || message.runId)
  return {
    workflowId: latestMessage?.workflowId ?? lastWorkflowId.value,
    runId: latestMessage?.runId ?? lastRunId.value,
    files: lastWorkflowFiles.value
  }
}

async function sendAgentMessage() {
  const text = agentInput.value.trim()
  if (!text && uploadedFiles.value.length === 0) return

  if (shouldUseWorkflowMode(text)) {
    await runAgentWorkflowMessage()
    return
  }

  const startedAt = Date.now()
  const userSequence = nextChatSequence()
  const userCreatedAt = new Date().toISOString()
  const userMessage = {
    id: Date.now(),
    role: 'user' as const,
    text,
    time: timeNow().slice(0, 5),
    createdAt: userCreatedAt,
    sequence: userSequence
  }
  chatMessages.value = [...chatMessages.value, userMessage]
  agentInput.value = ''
  conversationStatus.value = '运行中'
  runError.value = ''

  try {
    const recentWorkflow = latestWorkflowContext()
    const result = await api.sendChat({
      conversationId: activeConversationId.value || conversationId.value || undefined,
      message: text,
      mode: 'chat',
      workflowId: recentWorkflow.workflowId,
      runId: recentWorkflow.runId
    })

    rememberConversation(result.conversationId)
    conversationModel.value = result.assistantMessage?.model ?? conversationModel.value
    conversationTotalTokens.value += readUsageTokens(result.assistantMessage?.usage)
    conversationStatus.value = '已完成'
    conversationLatency.value = formatMs(Date.now() - startedAt)
    apiOnline.value = true
    const confirmedUserMessage = messageFromApi(result.userMessage, userMessage)
    const assistantMetadata = asRecord(result.assistantMessage?.metadata) ?? {}

    chatMessages.value = [
      ...chatMessages.value.map((message) => (message.id === userMessage.id ? confirmedUserMessage : message)),
      {
        id: Number(result.assistantMessage?.id ?? Date.now() + 1),
        role: 'assistant' as const,
        text: String(result.assistantMessage?.content ?? ''),
        createdAt: String(result.assistantMessage?.createdAt ?? new Date().toISOString()),
        sequence: Number(result.assistantMessage?.sequence ?? (confirmedUserMessage.sequence ?? userSequence) + 1),
        time: formatMessageTime(result.assistantMessage?.createdAt),
        workflowId: result.workflowId ?? recentWorkflow.workflowId ?? null,
        runId: result.runId ?? recentWorkflow.runId ?? null,
        messageType: typeof assistantMetadata.messageType === 'string' ? assistantMetadata.messageType : undefined,
        sources: normalizeSources(assistantMetadata.sources)
      }
    ]
    await loadConversations()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat request failed'
    conversationStatus.value = '失败'
    conversationLatency.value = formatMs(Date.now() - startedAt)
    runError.value = message
    chatMessages.value = [
      ...chatMessages.value,
      {
        id: Date.now() + 1,
        role: 'assistant' as const,
        text: `真实 Chat 接口调用失败：${message}`,
        time: timeNow().slice(0, 5),
        createdAt: new Date().toISOString(),
        sequence: userSequence + 1
      }
    ]
  }
}

async function runAgentWorkflowMessage() {
  const text = agentInput.value.trim()
  if (!text && uploadedFiles.value.length === 0) return
  const filesForThisMessage = dedupeUploadedFiles(uploadedFiles.value)

  const userSequence = nextChatSequence()
  const userMessage = {
    id: Date.now(),
    role: 'user' as const,
    text: [text, filesForThisMessage.length ? `已上传文件：${filesForThisMessage.map((file) => file.filename).join('、')}` : '']
      .filter(Boolean)
      .join('\n'),
    time: timeNow().slice(0, 5),
    createdAt: new Date().toISOString(),
    sequence: userSequence
  }
  chatMessages.value = [...chatMessages.value, userMessage]
  agentInput.value = ''
  conversationStatus.value = '运行中'
  workflowStatus.value = 'running'
  runError.value = ''
  const startedAt = Date.now()

  try {
    const targetConversationId = await ensureActiveConversation()
    const persistedUser = await appendPersistedMessage(targetConversationId, {
      role: 'user',
      content: userMessage.text,
      sequence: userSequence,
      metadata: {
        messageType: 'workflow_request',
        files: filesForThisMessage
      }
    })
    if (persistedUser?.id) {
      chatMessages.value = chatMessages.value.map((message) =>
        message.id === userMessage.id
          ? {
              ...message,
              id: Number(persistedUser.id),
              createdAt: String(persistedUser.createdAt ?? message.createdAt),
              time: formatMessageTime(persistedUser.createdAt, message.time)
            }
          : message
      )
    }

    const prompt = text || `请分析我上传的 ${filesForThisMessage.map((file) => file.filename).join('、')}`
    const workflow = await api.generateWorkflow(prompt, filesForThisMessage, targetConversationId)
    normalizeWorkflow(workflow)
    rememberWorkflowSelection(Number(workflow.id ?? 0) || null)
    rememberRunSelection(null)
    workflowNodes.value = workflowNodes.value.map((node) => ({ ...node, status: 'running' }))

    const result = await api.runWorkflow(workflow.id, {
      query: prompt,
      files: filesForThisMessage,
      conversationId: targetConversationId
    })

    runOutput.value = JSON.stringify(result.output ?? result.finalResult ?? result, null, 2)
    let runTraceSteps: TraceStep[] = []
    if (result.runId) {
      rememberRunSelection(Number(result.runId))
      runTraceSteps = await api.getTrace(result.runId)
      traceSteps.value = runTraceSteps
      applyTraceToWorkflowNodes(traceSteps.value)
    }

    apiOnline.value = true
    workflowStatus.value = result.status === 'failed' || result.output?.businessStatus === 'failed' ? 'failed' : 'complete'
    runError.value = result.errorMessage ?? ''
    conversationStatus.value = result.status === 'failed' || result.output?.businessStatus === 'failed' ? '分析未完成' : '已完成'
    conversationLatency.value = formatMs(result.totalLatencyMs ?? Date.now() - startedAt)
    lastWorkflowId.value = Number(workflow.id ?? result.workflowId ?? 0) || null
    lastRunId.value = Number(result.runId ?? 0) || null
    lastWorkflowFiles.value = filesForThisMessage
    if (result.status !== 'failed') uploadedFiles.value = []
    await refreshWorkflowHistories()

    const assistantText =
      result.status === 'failed'
        ? outputContainsNoDataSignal(result.errorMessage)
          ? `分析未完成 / 文件不适合当前工作流。\n${result.errorMessage ?? '未识别到有效数据。'}\n\n下一步建议：请上传包含有效财务数据的文件，或改用文档总结工作流。`
          : `真实工作流执行失败：${result.errorMessage ?? '未知错误'}\n请查看执行过程中的失败节点和 Trace。`
        : buildWorkflowAssistantText(result, workflow, filesForThisMessage, runTraceSteps)
    const assistantWorkflowId = Number(workflow.id ?? result.workflowId ?? 0) || null
    const assistantRunId = Number(result.runId ?? 0) || null
    const assistantMetadata = {
      messageType: result.output?.businessStatus === 'failed' ? 'workflow_business_failed' : 'workflow_result',
      workflowId: assistantWorkflowId,
      runId: assistantRunId,
      files: filesForThisMessage,
      finalResult: result.output ?? result.finalResult ?? result,
      missingTools: [],
      sources: normalizeSources(result.output?.sources ?? result.finalResult?.sources)
    }
    const persistedAssistant = await appendPersistedMessage(targetConversationId, {
      role: 'assistant',
      content: assistantText,
      sequence: userSequence + 1,
      metadata: assistantMetadata
    })
    chatMessages.value = [
      ...chatMessages.value,
      {
        id: Number(persistedAssistant?.id ?? Date.now() + 1),
        role: 'assistant' as const,
        text: assistantText,
        time: formatMessageTime(persistedAssistant?.createdAt, timeNow().slice(0, 5)),
        createdAt: String(persistedAssistant?.createdAt ?? new Date().toISOString()),
        sequence: userSequence + 1,
        workflowId: assistantWorkflowId,
        runId: assistantRunId,
        files: filesForThisMessage,
        finalResult: assistantMetadata.finalResult,
        messageType: assistantMetadata.messageType,
        sources: assistantMetadata.sources
      }
    ]
  } catch (error) {
    const message = error instanceof Error ? error.message : '真实工作流执行失败'
    const needsClarification = message.includes('无法判断文档类型') || message.includes('文档总结') || message.includes('财务分析')
    workflowStatus.value = needsClarification ? 'idle' : 'failed'
    conversationStatus.value = needsClarification ? '等待确认' : '失败'
    conversationLatency.value = formatMs(Date.now() - startedAt)
    runError.value = message
    const assistantText = needsClarification ? message : `没有使用本地 Mock。\n真实后端调用失败：${message}`
    const persistedAssistant = activeConversationId.value
      ? await appendPersistedMessage(activeConversationId.value, {
          role: 'assistant',
          content: assistantText,
          sequence: userSequence + 1,
          metadata: {
            messageType: needsClarification ? 'workflow_clarification' : 'workflow_error',
            files: filesForThisMessage
          }
        })
      : null
    chatMessages.value = [
      ...chatMessages.value,
      {
        id: Number(persistedAssistant?.id ?? Date.now() + 1),
        role: 'assistant' as const,
        text: assistantText,
        time: formatMessageTime(persistedAssistant?.createdAt, timeNow().slice(0, 5)),
        createdAt: String(persistedAssistant?.createdAt ?? new Date().toISOString()),
        sequence: userSequence + 1,
        files: filesForThisMessage,
        messageType: needsClarification ? 'workflow_clarification' : 'workflow_error'
      }
    ]
  }
}

function clearConversation() {
  chatMessages.value = []
  uploadedFiles.value = []
  lastWorkflowFiles.value = []
  lastWorkflowId.value = null
  lastRunId.value = null
  activeConversationId.value = null
  conversationId.value = ''
  localStorage.removeItem('tracemind_active_conversation_id')
  conversationStatus.value = '空会话'
  notify('会话已清空')
}

function newConversation() {
  clearConversation()
  conversationStartedAt.value = new Date().toLocaleString('zh-CN', { hour12: false })
}

function toggleTemplateStar(item: any) {
  item.starred = !item.starred
  item.likes += item.starred ? 1 : -1
}

async function useTemplateCard(item: any) {
  if (item.id) {
    try {
      await api.useTemplate(item.id)
    } catch {
      // Local interaction still proceeds when backend is unavailable.
    }
  }
  await generateWorkflowFromInput(item.title)
}

async function refreshTools() {
  try {
    const [tools, mcpServerRows] = await Promise.all([api.listTools(), api.listMcpServers()])
    toolRows.value = tools.map(mapTool)
    mcpServers.value = mcpServerRows
    apiOnline.value = true
    notify('工具列表已刷新')
  } catch {
    toolRows.value = []
    notify('后端未连接，暂无工具数据')
  }
}

async function refreshMcpServers() {
  try {
    mcpServers.value = await api.listMcpServers()
  } catch {
    mcpServers.value = []
  }
}

async function toggleTool(tool: any) {
  tool.enabled = !tool.enabled
  if (tool.id) {
    try {
      const updated = await api.toggleTool(tool.id)
      Object.assign(tool, mapTool(updated, toolRows.value.indexOf(tool)))
    } catch {
      notify('已本地切换工具状态')
    }
  }
}

async function createMcpServer(input: unknown, done?: (result: any) => void) {
  try {
    const result = await api.createMcpServer(input)
    await refreshMcpServers()
    done?.(result)
    notify('MCP Server 已添加')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MCP Server 保存失败'
    notify(message)
    done?.({ error: message })
  }
}

async function toggleMcpServer(server: any) {
  if (!server?.id) return
  try {
    const updated = await api.toggleMcpServer(server.id)
    Object.assign(server, updated)
  } catch (error) {
    notify(error instanceof Error ? error.message : 'MCP Server 状态切换失败')
  }
}

async function testMcpServer(server: any, done?: (result: any) => void) {
  if (!server?.id) return
  try {
    const result = await api.testMcpServer(server.id)
    await refreshMcpServers()
    done?.(result)
    notify(result.message ?? 'MCP Server 测试完成')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MCP Server 测试失败'
    notify(message)
    done?.({ error: message })
  }
}

async function syncMcpServerTools(server: any, done?: (result: any) => void) {
  if (!server?.id) return
  try {
    const result = await api.syncMcpServerTools(server.id)
    await Promise.all([refreshMcpServers(), refreshTools()])
    done?.(result)
    notify(result.message ?? 'MCP 工具同步完成')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MCP 工具同步失败'
    notify(message)
    done?.({ error: message })
  }
}

async function createConfiguredTool(input: unknown, done?: (result: any) => void) {
  try {
    const result = await api.createTool(input)
    await refreshTools()
    done?.(result)
    notify('工具已保存到数据库')
  } catch (error) {
    notify(error instanceof Error ? error.message : '工具保存失败')
    done?.({ error: error instanceof Error ? error.message : '工具保存失败' })
  }
}

async function updateConfiguredTool(id: number | string, input: unknown, done?: (result: any) => void) {
  try {
    const result = await api.updateTool(id, input)
    await refreshTools()
    done?.(result)
    notify('工具配置已更新')
  } catch (error) {
    const message = error instanceof Error ? error.message : '工具更新失败'
    notify(message)
    done?.({ error: message })
  }
}

async function checkConfiguredToolName(name: string, done?: (result: any) => void) {
  try {
    done?.(await api.checkToolName(name))
  } catch (error) {
    done?.({ error: error instanceof Error ? error.message : '工具名检查失败' })
  }
}

async function testDraftConfiguredTool(input: unknown, done?: (result: any) => void) {
  try {
    const result = await api.testDraftTool(input)
    done?.(result)
    notify(result.success ? '草稿测试成功' : result.error ?? '草稿测试失败')
  } catch (error) {
    const message = error instanceof Error ? error.message : '草稿测试失败'
    done?.({ success: false, error: message })
    notify(message)
  }
}

async function refreshSecrets() {
  try {
    userSecrets.value = await api.listSecrets()
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Secret 列表加载失败')
  }
}

async function saveUserSecret(input: { name: string; provider?: string; value: string }, done?: (result: any) => void) {
  try {
    const result = await api.saveSecret(input)
    await refreshSecrets()
    done?.(result)
    notify('用户 Key 已保存')
  } catch (error) {
    const message = error instanceof Error ? error.message : '用户 Key 保存失败'
    done?.({ error: message })
    notify(message)
  }
}

async function deleteUserSecret(name: string, done?: (result: any) => void) {
  try {
    const result = await api.deleteSecret(name)
    await refreshSecrets()
    done?.(result)
    notify('用户 Key 已删除')
  } catch (error) {
    const message = error instanceof Error ? error.message : '用户 Key 删除失败'
    done?.({ error: message })
    notify(message)
  }
}

async function testConfiguredTool(id: number | string, input: unknown, done?: (result: any) => void) {
  try {
    const result = await api.testTool(id, input)
    done?.(result)
    notify(result.success ? '工具测试成功' : '工具测试失败')
  } catch (error) {
    const message = error instanceof Error ? error.message : '工具测试失败'
    done?.({ success: false, error: message })
    notify(message)
  }
}

function cycleToolStatus() {
  activeToolStatus.value = activeToolStatus.value === '全部状态' ? '启用' : activeToolStatus.value === '启用' ? '禁用' : '全部状态'
}

function selectMemory(item: any) {
  memoryItems.value = memoryItems.value.map((memory) => ({ ...memory, active: memory === item }))
}

async function addMemoryItem() {
  try {
    await api.createMemory({
      memoryType: 'preference',
      title: '前端交互偏好',
      content: '用户希望前端只展示数据库真实内容，不再显示本地 mock 数据。',
      importance: 'medium',
      importanceScore: 3,
      enabled: true
    })
    await loadBackendData()
    notify('记忆已写入数据库')
  } catch {
    notify('后端未连接，无法新增记忆')
  }
}

async function selectKnowledgeBase(kb: any) {
  activeKnowledgeId.value = kb.id ?? kb.name
  knowledgeBases.value = knowledgeBases.value.map((item) => ({ ...item, active: item.id === kb.id }))
  retrievalSnippets.value = []
  try {
    await loadKnowledgeDocuments(kb.id)
  } catch {
    knowledgeDocuments.value = []
    notify('文档列表加载失败')
  }
}

async function searchSelectedKnowledge(queryOverride?: string) {
  const kb = selectedKnowledgeBase.value
  if (!kb?.id) {
    notify('请选择一个后端知识库后再检索')
    return
  }
  try {
    const query = (typeof queryOverride === 'string' ? queryOverride.trim() : '') || knowledgeSearch.value.trim() || workflowTitle.value || kb.name
    const response = await api.searchKnowledgeBase(kb.id, query)
    const results: any[] = Array.isArray(response) ? response : response.results ?? []
    retrievalSnippets.value = results.map((item, index) => ({
      title: item.title ?? `片段 ${item.chunk_index ?? index + 1}`,
      text: item.content ?? '',
      score: Number(item.score ?? 0)
    }))
    notify(`检索到 ${results.length} 条片段`)
  } catch {
    retrievalSnippets.value = []
    notify('后端未连接，无法检索数据库片段')
  }
}

async function importKnowledgeFiles(files: FileList) {
  const kb = selectedKnowledgeBase.value
  if (!kb?.id) {
    notify('请先选择一个后端知识库')
    return
  }

  const sourceFiles = Array.from(files)
  if (sourceFiles.length === 0) return

  importingKnowledgeFiles.value = true
  try {
    let importedCount = 0

    for (const file of sourceFiles) {
      const uploaded = await api.uploadFile(file)
      await api.importKnowledgeDocumentFromFile(kb.id, {
        fileId: uploaded.fileId ?? uploaded.id ?? uploaded.storedName,
        filePath: uploaded.filePath ?? uploaded.path,
        title: uploaded.originalName ?? uploaded.filename ?? file.name
      })
      importedCount += 1
    }

    await loadBackendData()
    notify(`已导入 ${importedCount} 个文档并写入本地知识库`)
  } catch (error) {
    notify(error instanceof Error ? error.message : '文档导入失败')
  } finally {
    importingKnowledgeFiles.value = false
  }
}

async function createKnowledgeBase(input: Record<string, unknown>) {
  try {
    const result = await api.createKnowledgeBase(input)
    activeKnowledgeId.value = result.id
    await loadBackendData()
    notify('知识库已创建')
  } catch (error) {
    notify(error instanceof Error ? error.message : '知识库创建失败')
  }
}

async function updateKnowledgeBase(payload: { id: number; input: Record<string, unknown> }) {
  try {
    await api.updateKnowledgeBase(payload.id, payload.input)
    activeKnowledgeId.value = payload.id
    await loadBackendData()
    notify('知识库设置已保存')
  } catch (error) {
    notify(error instanceof Error ? error.message : '知识库更新失败')
  }
}

async function deleteKnowledgeBase(kb: any) {
  if (!kb?.id) return
  try {
    await api.deleteKnowledgeBase(Number(kb.id))
    if (activeKnowledgeId.value === kb.id) activeKnowledgeId.value = ''
    retrievalSnippets.value = []
    await loadBackendData()
    notify(`已删除知识库“${kb.name}”`)
  } catch (error) {
    notify(error instanceof Error ? error.message : '知识库删除失败')
  }
}

async function deleteKnowledgeDocument(doc: any) {
  if (!doc?.id) return
  try {
    await api.deleteKnowledgeDocument(doc.id)
    retrievalSnippets.value = []
    await loadBackendData()
    notify(`已删除文档“${doc.name}”`)
  } catch (error) {
    notify(error instanceof Error ? error.message : '文档删除失败')
  }
}

async function openWorkflowFromMessage(payload: { workflowId?: number | null; runId?: number | null; targetPage?: 'workflow' | 'tools' }) {
  if (!payload.workflowId && !payload.runId) return

  try {
    if (payload.runId) {
      await loadRunReplay(payload.runId)
    } else if (payload.workflowId) {
      await loadWorkflow(payload.workflowId)
    }

    setPage(payload.targetPage ?? 'workflow')
  } catch (error) {
    notify(error instanceof Error ? error.message : '无法打开对应工作流')
  }
}

function selectAgent(agent: any) {
  selectedAgentName.value = agent.name
}

function enterAgent(agent: any) {
  selectAgent(agent)
  setPage('home')
}

function switchAgent() {
  if (!filteredAgents.value.length) return
  const currentIndex = filteredAgents.value.findIndex((agent) => agent.name === selectedAgentName.value)
  selectedAgentName.value = filteredAgents.value[(currentIndex + 1) % filteredAgents.value.length]?.name ?? selectedAgentName.value
}

function createAgent() {
  notify('智能体列表来自数据库工作流，请先生成或保存工作流')
}

async function saveSettings() {
  try {
    const themeMap: Record<string, string> = {
      跟随系统: 'system',
      浅色: 'light',
      深色: 'dark'
    }
    await api.saveSettings({
      language: settingsForm.value.language === '简体中文' ? 'zh-CN' : 'en-US',
      default_model: settingsForm.value.model,
      theme: themeMap[settingsForm.value.theme] ?? settingsForm.value.theme,
      auto_save: settingsForm.value.autoSave ? 1 : 0,
      auto_save_interval: Number(settingsForm.value.interval.replace(/\D/g, '')) || 5,
      webhook_url: settingsForm.value.webhook,
      settings_json: settingsForm.value
    })
    notify('设置已保存到后端')
  } catch {
    notify('设置已本地保存')
  }
}

function iconFor(name: string) {
  return iconMap[name as keyof typeof iconMap] ?? Sparkles
}

function statusLabel(status: NodeStatus) {
  return {
    idle: '待执行',
    queued: '排队中',
    running: '运行中',
    success: '成功',
    partial_success: '部分成功',
    failed: '失败',
    skipped: '跳过',
    waiting_approval: '等待审批',
    permission_denied: '权限拒绝',
    cancelled: '已取消'
  }[status]
}

function edgePath(source: WorkflowNode, target: WorkflowNode) {
  const x1 = source.position.x + 146
  const y1 = source.position.y + 38
  const x2 = target.position.x
  const y2 = target.position.y + 38
  const mid = Math.max(40, Math.abs(x2 - x1) / 2)
  return `M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`
}

onMounted(async () => {
  await Promise.all([loadBackendData(), loadConversations(), refreshWorkflowHistories()])
  const storedConversationId = activeConversationId.value
  if (storedConversationId) {
    try {
      await loadConversation(storedConversationId)
    } catch {
      activeConversationId.value = null
      conversationId.value = ''
      localStorage.removeItem('tracemind_active_conversation_id')
    }
  }

  if (activeRunId.value) {
    try {
      await loadRunReplay(activeRunId.value)
      return
    } catch {
      rememberRunSelection(null)
    }
  }

  if (activeWorkflowId.value) {
    try {
      await loadWorkflow(activeWorkflowId.value)
    } catch {
      rememberWorkflowSelection(null)
    }
  }
})
</script>

<template>
  <div class="app-shell">
    <AppSidebar
      :active-page="activePage"
      :nav-items="navItems"
      :conversations="conversations"
      :active-conversation-id="activeConversationId"
      :workflow-history="workflowHistory"
      :run-history="runHistory"
      :active-workflow-id="activeWorkflowId"
      :active-run-id="activeRunId"
      @navigate="setPage($event as PageKey)"
      @new-conversation="newConversation"
      @select-conversation="loadConversation"
      @select-workflow="loadWorkflow"
      @select-run="loadRunReplay"
    />

    <PageErrorBoundary :reset-key="activePage" @error="notify(`页面渲染失败：${$event}`)">
    <WorkflowPage
      v-if="activePage === 'workflow'"
      v-model:active-node-id="activeNodeId"
      v-model:inspector-tab="inspectorTab"
      v-model:trace-tab="traceTab"
      v-model:palette-search="paletteSearch"
      v-model:canvas-mode="canvasMode"
      v-model:toolbox-tab="toolboxTab"
      :workflow-title="workflowTitle"
      :workflow-id="workflowId"
      :workflow-nodes="workflowNodes"
      :workflow-edges="workflowEdges"
      :trace-steps="traceSteps"
      :trace-open-key="traceOpenKey"
      :filtered-palette-nodes="filteredPaletteNodes"
      :selected-node="selectedNode"
      :selected-trace-step="selectedTraceStep"
      :selected-knowledge-base="selectedKnowledgeBase"
      :retrieval-snippets="retrievalSnippets"
      :related-tools="relatedTools"
      :workflow-zoom="workflowZoom"
      :workflow-status="workflowStatus"
      :saved-at="savedAt"
      :run-output="runOutput"
      :run-error="runError"
      :api-online="apiOnline"
      :icon-for="iconFor"
      :status-label="statusLabel"
      :edge-path="edgePath"
      @save="saveWorkflow"
      @run="runWorkflowNow"
      @export="exportWorkflow"
      @share="shareWorkflow"
      @generate="generateWorkflowFromInput(workflowTitle)"
      @zoom="zoomCanvas"
      @reset="resetCanvas"
      @add-custom-node="addCustomNode"
      @add-palette-node="addPaletteNode"
      @search-knowledge="searchSelectedKnowledge"
      @update-node-position="updateNodePosition"
      @create-edge="createWorkflowEdge"
      @update-edge="updateWorkflowEdge"
      @delete-node="deleteWorkflowNode"
      @delete-edge="deleteWorkflowEdge"
    />

    <HomeAgentPage
      v-else-if="activePage === 'home'"
      v-model:agent-input="agentInput"
      :chat-messages="chatMessages"
      :conversation-status="conversationStatus"
      :conversation-started-at="conversationStartedAt"
      :conversation-latency="conversationLatency"
      :conversation-id="conversationId"
      :total-tokens="conversationTotalTokens"
      :model="conversationModel || settingsForm.model"
      :uploaded-files="uploadedFiles"
      :uploading="uploadingFiles"
      @new-conversation="newConversation"
      @share="shareWorkflow"
      @generate="generateWorkflowFromInput()"
      @send="sendAgentMessage"
      @upload-files="uploadAgentFiles"
      @clear="clearConversation"
      @navigate="setPage"
      @open-workflow="openWorkflowFromMessage"
    />

    <SettingsPage
      v-else-if="activePage === 'settings'"
      v-model:form="settingsForm"
      :options="settingOptions"
      @save="saveSettings"
    />

    <ToolsPage
      v-else-if="activePage === 'tools'"
      v-model:tool-search="toolSearch"
      v-model:active-tool-category="activeToolCategory"
      :tool-stats="toolStats"
      :tool-categories="toolCategories"
      :active-tool-status="activeToolStatus"
      :filtered-tools="filteredTools"
      :tools="toolRows"
      :mcp-servers="mcpServers"
      :secrets="userSecrets"
      @cycle-tool-status="cycleToolStatus"
      @refresh="refreshTools"
      @notify="notify"
      @toggle-tool="toggleTool"
      @create-mcp-server="createMcpServer"
      @toggle-mcp-server="toggleMcpServer"
      @test-mcp-server="testMcpServer"
      @sync-mcp-server-tools="syncMcpServerTools"
      @create-tool="createConfiguredTool"
      @update-tool="updateConfiguredTool"
      @check-tool-name="checkConfiguredToolName"
      @test-draft-tool="testDraftConfiguredTool"
      @save-secret="saveUserSecret"
      @delete-secret="deleteUserSecret"
      @refresh-secrets="refreshSecrets"
    />

    <MemoryPage
      v-else-if="activePage === 'memory'"
      v-model:memory-search="memorySearch"
      v-model:active-memory-type="activeMemoryType"
      :memory-stats="memoryStats"
      :filtered-memories="filteredMemories"
      :selected-memory="selectedMemory"
      :memory-refs="memoryRefs"
      @add-memory="addMemoryItem"
      @select-memory="selectMemory"
    />

    <KnowledgePage
      v-else-if="activePage === 'knowledge'"
      v-model:knowledge-search="knowledgeSearch"
      :knowledge-stats="knowledgeStats"
      :filtered-knowledge-bases="filteredKnowledgeBases"
      :selected-knowledge-base="selectedKnowledgeBase"
      :knowledge-documents="knowledgeDocuments"
      :retrieval-snippets="retrievalSnippets"
      :importing-knowledge="importingKnowledgeFiles"
      @create-knowledge-base="createKnowledgeBase"
      @update-knowledge-base="updateKnowledgeBase"
      @delete-knowledge-base="deleteKnowledgeBase"
      @delete-knowledge-document="deleteKnowledgeDocument"
      @select-knowledge-base="selectKnowledgeBase"
      @import-knowledge-files="importKnowledgeFiles"
      @search-knowledge="searchSelectedKnowledge"
    />

    <TemplatesPage
      v-else-if="activePage === 'template'"
      v-model:template-search="templateSearch"
      v-model:active-template-category="activeTemplateCategory"
      :template-stats="templateStats"
      :template-categories="templateCategories"
      :filtered-templates="filteredTemplates"
      @notify="notify"
      @toggle-template-star="toggleTemplateStar"
      @use-template="useTemplateCard"
      @create-blank="generateWorkflowFromInput('创建一个空白工作流模板')"
    />

    <AgentsPage
      v-else
      v-model:agent-search="agentSearch"
      :agent-cards="agentCards"
      :filtered-agents="filteredAgents"
      :selected-agent="selectedAgent"
      :selected-agent-name="selectedAgentName"
      :agent-avg-success="agentAvgSuccess"
      :agent-total-calls="agentTotalCalls"
      :recent-tasks="recentTasks"
      @create-agent="createAgent"
      @navigate="setPage"
      @select-agent="selectAgent"
      @enter-agent="enterAgent"
      @switch-agent="switchAgent"
      @notify="notify"
    />
    </PageErrorBoundary>
  </div>
</template>

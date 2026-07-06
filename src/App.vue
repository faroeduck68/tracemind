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
  FileText,
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
import SettingsPage from './components/SettingsPage.vue'
import TemplatesPage from './components/TemplatesPage.vue'
import ToolsPage from './components/ToolsPage.vue'
import WorkflowPage from './components/WorkflowPage.vue'
import { paletteNodes as initialPaletteNodes } from './mock/workflow.mock'
import type { NodeStatus, PaletteNode, TraceStep, WorkflowEdge, WorkflowNode } from './types'

type PageKey = 'home' | 'agent' | 'workflow' | 'template' | 'knowledge' | 'memory' | 'tools' | 'settings'

const pageFromHash = (): PageKey => {
  if (window.location.hash === '#agent') return 'agent'
  if (window.location.hash === '#workflow') return 'workflow'
  if (window.location.hash === '#template') return 'template'
  if (window.location.hash === '#knowledge') return 'knowledge'
  if (window.location.hash === '#memory') return 'memory'
  if (window.location.hash === '#tools') return 'tools'
  if (window.location.hash === '#settings') return 'settings'
  return 'home'
}

const activePage = ref<PageKey>(pageFromHash())
const activeNodeId = ref('')
const inspectorTab = ref('explain')
const traceTab = ref('node')
const agentInput = ref('')
const workflowId = ref<number | null>(null)
const workflowTitle = ref('暂无工作流')
const workflowDescription = ref('')
const workflowNodes = ref<WorkflowNode[]>([])
const workflowEdges = ref<WorkflowEdge[]>([])
const traceSteps = ref<TraceStep[]>([])
const paletteSearch = ref('')
const workflowZoom = ref(100)
const canvasMode = ref<'canvas' | 'config'>('canvas')
const toolboxTab = ref<'nodes' | 'tools' | 'variables'>('nodes')
const workflowStatus = ref<'idle' | 'saving' | 'running' | 'complete' | 'failed'>('idle')
const savedAt = ref('--:--:--')
const runOutput = ref('')
const runError = ref('')
const toastMessage = ref('')
const apiOnline = ref(false)
const chatMessages = ref<Array<{ id: number; role: 'user' | 'assistant'; text: string; time: string }>>([])
const conversationStatus = ref('未开始')
const conversationStartedAt = ref('-')
const conversationLatency = ref('-')

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
  FileText,
  GitBranch,
  PanelRightOpen,
  Search,
  Send,
  Shuffle,
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

const toolCategories = ['全部', '数据处理', '内容生成', '代码开发', '检索搜索', '分析计算', '其他']

const toolRows = ref<any[]>([])

const templateSearch = ref('')
const activeTemplateCategory = ref('全部')
const toolSearch = ref('')
const activeToolCategory = ref('全部')
const activeToolStatus = ref<'全部状态' | '启用' | '禁用'>('全部状态')
const memorySearch = ref('')
const activeMemoryType = ref('全部')
const knowledgeSearch = ref('')
const activeKnowledgeId = ref<string | number>('')
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
  return traceSteps.value.find((step) => step.nodeId === activeNodeId.value) ?? traceSteps.value[0]
})

const selectedMemory = computed(() => memoryItems.value.find((item) => item.active) ?? memoryItems.value[0])
const selectedKnowledgeBase = computed(() => knowledgeBases.value.find((kb) => kb.active) ?? knowledgeBases.value[0])
const selectedAgent = computed(() => agentCards.value.find((agent) => agent.name === selectedAgentName.value) ?? agentCards.value[0])
const relatedTools = computed(() => toolRows.value.filter((tool) => tool.name !== selectedNode.value.tool).slice(0, 3))
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
  { label: '知识库总数', value: String(knowledgeBases.value.length), suffix: '个', delta: '0', icon: BookOpen, tone: 'violet' },
  { label: '文档数量', value: knowledgeBases.value.reduce((sum, item) => sum + Number(item.docs ?? 0), 0).toLocaleString('zh-CN'), suffix: '个', delta: '0', icon: FileText, tone: 'green' },
  { label: '向量片段', value: knowledgeBases.value.reduce((sum, item) => sum + Number(String(item.chunks ?? 0).replace(/,/g, '')), 0).toLocaleString('zh-CN'), suffix: '个', delta: '0', icon: Layers, tone: 'amber' },
  { label: '今日检索量', value: String(retrievalSnippets.value.length), suffix: '次', delta: '0', icon: BarChart3, tone: 'violet' }
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
    const normalizedType = tool.type === '数据分析' ? '分析计算' : tool.type
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

function notify(message: string) {
  toastMessage.value = message
  window.setTimeout(() => {
    if (toastMessage.value === message) toastMessage.value = ''
  }, 2200)
}

function timeNow() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function shortDate(value?: string) {
  if (!value) return '刚刚'
  return value.slice(0, 10)
}

function formatMs(value: unknown) {
  const ms = Number(value ?? 0)
  if (!Number.isFinite(ms) || ms <= 0) return '0 ms'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`
}

function iconForTool(name: string) {
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

function normalizeWorkflow(workflow: any) {
  workflowId.value = Number(workflow.id ?? workflowId.value ?? 0) || null
  workflowTitle.value = workflow.name ?? workflowTitle.value
  workflowDescription.value = workflow.description ?? workflowDescription.value
  workflowNodes.value = Array.isArray(workflow.nodes) ? workflow.nodes : []
  workflowEdges.value = Array.isArray(workflow.edges) ? workflow.edges : []
  activeNodeId.value = workflowNodes.value[0]?.id ?? ''
}

function mapTool(row: any, index: number) {
  return {
    id: row.id,
    name: row.name ?? row.display_name ?? `tool_${index + 1}`,
    version: row.version ?? 'v1.0.0',
    type: row.category ?? '其他',
    desc: row.description ?? '暂无描述',
    enabled: Boolean(row.enabled),
    success: `${Number(row.success_rate ?? 0).toFixed(1)}%`,
    latency: formatMs(row.avg_latency_ms),
    calls: Number(row.call_count ?? 0).toLocaleString('zh-CN'),
    icon: iconForTool(String(row.name ?? '')),
    tone: toneForIndex(index),
    trend: row.enabled ? 'up' : 'down'
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
    createdAt: row.created_at ?? '-'
  }
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
    const [workflows, tools, templates, bases, memories, settings] = await Promise.all([
      api.listWorkflows(),
      api.listTools(),
      api.listTemplates(),
      api.listKnowledgeBases(),
      api.listMemories(),
      api.listSettings()
    ])
    apiOnline.value = true
    applySettings(settings)
    if (workflows[0]) {
      const latest = workflows[0].workflowJson?.nodes ? workflows[0].workflowJson : workflows[0]
      normalizeWorkflow({ ...latest, id: workflows[0].id, name: workflows[0].name, description: workflows[0].description })
    } else {
      workflowId.value = null
      workflowTitle.value = '暂无工作流'
      workflowDescription.value = ''
      workflowNodes.value = []
      workflowEdges.value = []
      traceSteps.value = []
      activeNodeId.value = ''
    }
    toolRows.value = tools.map(mapTool)
    templateCards.value = templates.map(mapTemplate)
    knowledgeBases.value = bases.map(mapKnowledgeBase)
    activeKnowledgeId.value = knowledgeBases.value[0]?.id ?? knowledgeBases.value[0]?.name ?? ''
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
    workflowId.value = null
    workflowTitle.value = '后端未连接'
    workflowDescription.value = ''
    workflowNodes.value = []
    workflowEdges.value = []
    traceSteps.value = []
    toolRows.value = []
    templateCards.value = []
    knowledgeBases.value = []
    memoryItems.value = []
    agentCards.value = []
    notify('后端未连接，暂无数据库内容可展示')
  }
}

async function saveWorkflow() {
  workflowStatus.value = 'saving'
  try {
    if (workflowId.value) {
      await api.updateWorkflow(workflowId.value, workflowPayload.value)
    }
    savedAt.value = timeNow()
    workflowStatus.value = 'complete'
    notify(workflowId.value ? '工作流已保存到后端' : '当前工作流已本地保存')
  } catch (error) {
    workflowStatus.value = 'failed'
    notify(error instanceof Error ? error.message : '保存失败')
  }
}

async function generateWorkflowFromInput(query?: string) {
  const prompt = (query ?? agentInput.value).trim() || '帮我分析这份财报并总结风险'
  try {
    const workflow = await api.generateWorkflow(prompt)
    apiOnline.value = true
    normalizeWorkflow(workflow)
    workflowStatus.value = 'idle'
    setPage('workflow')
    notify('已根据输入生成工作流')
  } catch {
    notify('后端未连接，无法从数据库生成工作流')
  }
}

async function runWorkflowNow() {
  workflowStatus.value = 'running'
  runError.value = ''
  workflowNodes.value = workflowNodes.value.map((node) => ({ ...node, status: 'idle' }))

  for (const node of workflowNodes.value) {
    workflowNodes.value = workflowNodes.value.map((item) => (item.id === node.id ? { ...item, status: 'running' } : item))
    activeNodeId.value = node.id
    await new Promise((resolve) => window.setTimeout(resolve, 120))
    workflowNodes.value = workflowNodes.value.map((item) => (item.id === node.id ? { ...item, status: 'success' } : item))
  }

  try {
    if (!workflowId.value) {
      const generated = await api.generateWorkflow(workflowTitle.value)
      normalizeWorkflow(generated)
    }
    const result = await api.runWorkflow(workflowId.value as number, { query: workflowTitle.value, files: [{ filename: 'demo_financial_report.pdf' }] })
    runOutput.value = JSON.stringify(result.output ?? result, null, 2)
    if (result.runId) traceSteps.value = await api.getTrace(result.runId)
    apiOnline.value = true
    workflowStatus.value = result.status === 'failed' ? 'failed' : 'complete'
    runError.value = result.errorMessage ?? ''
    notify(result.status === 'failed' ? '运行完成，但有失败节点' : '工作流运行完成')
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

function exportWorkflow() {
  navigator.clipboard?.writeText(JSON.stringify(workflowPayload.value, null, 2))
  notify('工作流 JSON 已复制')
}

function shareWorkflow() {
  navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}#workflow`)
  notify('分享链接已复制')
}

function sendAgentMessage() {
  const text = agentInput.value.trim()
  if (!text) return
  const userMessage = { id: Date.now(), role: 'user' as const, text, time: timeNow().slice(0, 5) }
  chatMessages.value = [...chatMessages.value, userMessage]
  agentInput.value = ''
  conversationStatus.value = '运行中'
  window.setTimeout(() => {
    chatMessages.value = [
      ...chatMessages.value,
      {
        id: Date.now() + 1,
        role: 'assistant' as const,
        text: `已收到：${text}\n\n当前页面只展示数据库返回的数据。若需要生成工作流，请先确认后端和数据库可用。`,
        time: timeNow().slice(0, 5)
      }
    ]
    conversationStatus.value = '已完成'
    conversationLatency.value = '1.28s'
  }, 500)
}

function clearConversation() {
  chatMessages.value = []
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
    const tools = await api.listTools()
    toolRows.value = tools.map(mapTool)
    apiOnline.value = true
    notify('工具列表已刷新')
  } catch {
    toolRows.value = []
    notify('后端未连接，暂无工具数据')
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

function selectKnowledgeBase(kb: any) {
  activeKnowledgeId.value = kb.id ?? kb.name
  knowledgeBases.value = knowledgeBases.value.map((item) => ({ ...item, active: item === kb }))
}

async function searchSelectedKnowledge() {
  const kb = selectedKnowledgeBase.value
  if (!kb?.id) {
    notify('请选择一个后端知识库后再检索')
    return
  }
  try {
    const results = await api.searchKnowledgeBase(kb.id, workflowTitle.value)
    retrievalSnippets.value = results.map((item, index) => ({
      title: `片段 ${item.chunk_index ?? index + 1}`,
      text: item.content ?? '',
      score: 1
    }))
    notify(`检索到 ${results.length} 条片段`)
  } catch {
    retrievalSnippets.value = []
    notify('后端未连接，无法检索数据库片段')
  }
}

async function createKnowledgeBase() {
  try {
    await api.createKnowledgeBase({
      name: `知识库 ${knowledgeBases.value.length + 1}`,
      description: '通过前端创建的知识库',
      embeddingModel: 'mock-embedding-v1',
      chunkSize: 800,
      chunkOverlap: 120,
      retrievalMode: 'hybrid',
      topK: 5
    })
    await loadBackendData()
    notify('知识库已写入数据库')
  } catch {
    notify('后端未连接，无法新建知识库')
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
    running: '运行中',
    success: '成功',
    failed: '失败',
    skipped: '跳过'
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

function setPage(page: PageKey) {
  activePage.value = page
  window.location.hash = page
}

onMounted(() => {
  void loadBackendData()
})
</script>

<template>
  <div class="app-shell">
    <AppSidebar :active-page="activePage" :nav-items="navItems" @navigate="setPage($event as PageKey)" />

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
    />

    <HomeAgentPage
      v-else-if="activePage === 'home'"
      v-model:agent-input="agentInput"
      :chat-messages="chatMessages"
      :conversation-status="conversationStatus"
      :conversation-started-at="conversationStartedAt"
      :conversation-latency="conversationLatency"
      :model="settingsForm.model"
      @new-conversation="newConversation"
      @share="shareWorkflow"
      @generate="generateWorkflowFromInput()"
      @send="sendAgentMessage"
      @clear="clearConversation"
      @navigate="setPage"
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
      @cycle-tool-status="cycleToolStatus"
      @refresh="refreshTools"
      @notify="notify"
      @toggle-tool="toggleTool"
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
      @create-knowledge-base="createKnowledgeBase"
      @notify="notify"
      @select-knowledge-base="selectKnowledgeBase"
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
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
import { paletteNodes, toolScores, traceSteps, workflowEdges, workflowNodes } from './mock/workflow.mock'
import type { NodeStatus, WorkflowNode } from './types'

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
const activeNodeId = ref('extract')
const inspectorTab = ref('explain')
const traceTab = ref('node')
const agentInput = ref('')

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

const selectedNode = computed(() => workflowNodes.find((node) => node.id === activeNodeId.value) ?? workflowNodes[3])

const agentCards = [
  { name: '财报分析助手', tag: '分析助手', icon: FileText, tone: 'green', model: 'Qwen3-32B', tools: 12, success: '95.2%', calls: '2,347', running: 2, online: true },
  { name: '代码审查助手', tag: '开发助手', icon: Code2, tone: 'violet', model: 'DeepSeek-Coder', tools: 8, success: '93.1%', calls: '1,823', running: 1, online: false },
  { name: '研究总结助手', tag: '研究助手', icon: ClipboardList, tone: 'blue', model: 'Qwen3-32B', tools: 10, success: '90.3%', calls: '1,256', running: 0, online: false },
  { name: '市场调研助手', tag: '调研助手', icon: BarChart3, tone: 'amber', model: 'GLM-4-Plus', tools: 9, success: '94.6%', calls: '1,987', running: 2, online: true },
  { name: '简历优化助手', tag: 'HR 助手', icon: Bot, tone: 'cyan', model: 'Qwen3-32B', tools: 7, success: '88.7%', calls: '932', running: 0, online: false },
  { name: '知识问答助手', tag: '知识助手', icon: MessageSquarePlus, tone: 'violet', model: 'Qwen3-32B', tools: 6, success: '96.1%', calls: '3,451', running: 3, online: true }
]

const templateStats = [
  { label: '全部模板', value: 28, icon: Grid2X2, tone: 'violet' },
  { label: '官方模板', value: 12, icon: Star, tone: 'amber' },
  { label: '我的模板', value: 8, icon: User, tone: 'blue' },
  { label: '收藏模板', value: 5, icon: Heart, tone: 'pink' }
]

const templateCategories = ['全部', '数据分析', '内容创作', '编程开发', '文档处理', '研究学习', '办公效率', '其他']

const templateCards = [
  {
    title: '财报分析助手',
    badge: '官方',
    badgeTone: 'violet',
    desc: '自动解析财报文件，提取关键财务指标并生成分析报告',
    steps: ['文件上传', '财报解析', '指标提取', '分析生成'],
    tags: ['数据分析', '财务', '报告生成'],
    views: '1.2k',
    likes: 89,
    author: 'TraceMind官方',
    date: '2024-01-15',
    starred: true,
    tone: 'blue'
  },
  {
    title: '论文阅读助手',
    badge: '官方',
    badgeTone: 'green',
    desc: '上传论文PDF，提取关键信息并生成摘要和思维导图',
    steps: ['PDF上传', '内容提取', '摘要生成', '思维导图'],
    tags: ['研究学习', '论文', '摘要'],
    views: '856',
    likes: 67,
    author: 'TraceMind官方',
    date: '2024-01-14',
    starred: false,
    tone: 'green'
  },
  {
    title: '代码审查助手',
    badge: '热门',
    badgeTone: 'orange',
    desc: '自动分析代码质量，发现潜在问题并提供优化建议',
    steps: ['代码输入', '静态分析', '问题检测', '建议生成'],
    tags: ['编程开发', '代码审查', '质量检查'],
    views: '2.1k',
    likes: 156,
    author: '社区用户',
    date: '2024-01-13',
    starred: false,
    tone: 'violet'
  },
  {
    title: '市场调研分析',
    badge: '',
    badgeTone: 'blue',
    desc: '收集和分析市场信息，生成调研报告和趋势分析',
    steps: ['数据收集', '数据清洗', '趋势分析', '报告生成'],
    tags: ['数据分析', '市场调研', '趋势分析'],
    views: '643',
    likes: 45,
    author: '社区用户',
    date: '2024-01-12',
    starred: false,
    tone: 'blue'
  },
  {
    title: '内容创作助手',
    badge: '',
    badgeTone: 'blue',
    desc: '根据主题生成文章大纲、内容和优化建议',
    steps: ['主题输入', '大纲生成', '内容创作', '优化建议'],
    tags: ['内容创作', '写作', '优化'],
    views: '1.8k',
    likes: 123,
    author: '社区用户',
    date: '2024-01-11',
    starred: false,
    tone: 'green'
  },
  {
    title: '会议纪要生成器',
    badge: '',
    badgeTone: 'blue',
    desc: '自动转录会议内容，提取关键信息并生成会议纪要',
    steps: ['音频上传', '语音转录', '要点提取', '纪要生成'],
    tags: ['办公效率', '会议', '转录'],
    views: '892',
    likes: 78,
    author: '社区用户',
    date: '2024-01-10',
    starred: false,
    tone: 'blue'
  },
  {
    title: '翻译助手',
    badge: '',
    badgeTone: 'blue',
    desc: '多语言文档翻译，支持术语库和格式保持',
    steps: ['文档上传', '文本识别', '翻译处理', '格式输出'],
    tags: ['文档处理', '翻译', '多语言'],
    views: '567',
    likes: 34,
    author: '社区用户',
    date: '2024-01-09',
    starred: false,
    tone: 'violet'
  },
  {
    title: '学习计划制定器',
    badge: '',
    badgeTone: 'blue',
    desc: '根据学习目标和时间安排，生成个性化学习计划',
    steps: ['目标设定', '能力评估', '计划生成', '进度跟踪'],
    tags: ['研究学习', '学习计划', '个性化'],
    views: '445',
    likes: 29,
    author: '社区用户',
    date: '2024-01-08',
    starred: false,
    tone: 'cyan'
  }
]

const knowledgeStats = [
  { label: '知识库总数', value: '12', suffix: '个', delta: '+1', icon: BookOpen, tone: 'violet' },
  { label: '文档数量', value: '1,284', suffix: '个', delta: '+28', icon: FileText, tone: 'green' },
  { label: '向量片段', value: '3,256,789', suffix: '个', delta: '+56,213', icon: Layers, tone: 'amber' },
  { label: '今日检索量', value: '12,845', suffix: '次', delta: '+8.2%', icon: BarChart3, tone: 'violet' }
]

const knowledgeBases = [
  { name: '产品文档库', desc: '包含产品手册、功能说明、更新日志等官方文档', docs: 128, chunks: '326,541', updated: '2024-05-12 10:30', icon: FileText, tone: 'violet', active: true },
  { name: '财报分析库', desc: '历年财报、财务分析报告及相关数据', docs: 86, chunks: '215,678', updated: '2024-05-10 16:45', icon: BarChart3, tone: 'green', active: false },
  { name: '代码规范库', desc: '开发规范、接口文档、示例代码等', docs: 64, chunks: '128,934', updated: '2024-05-08 09:21', icon: Code2, tone: 'violet', active: false },
  { name: '客户支持库', desc: '常见问题、解决方案、售后政策等', docs: 72, chunks: '98,732', updated: '2024-05-07 14:11', icon: MessageSquarePlus, tone: 'amber', active: false }
]

const knowledgeDocuments = [
  { name: '产品手册.pdf', type: 'PDF', size: '2.4 MB', tone: 'red' },
  { name: '功能更新日志.md', type: 'MD', size: '1.1 MB', tone: 'cyan' },
  { name: '快速入门指南.pdf', type: 'PDF', size: '3.6 MB', tone: 'red' },
  { name: 'API 接口说明.md', type: 'MD', size: '2.2 MB', tone: 'cyan' },
  { name: '产品路线图.xlsx', type: 'XLSX', size: '1.8 MB', tone: 'green' }
]

const retrievalSnippets = [
  { title: '2024Q1 财报摘要.pdf', text: '营业收入同比增长 12.8%，毛利率提升至 25.4%，现金流保持稳定。', score: 0.92 },
  { title: '行业风险指标说明.md', text: '负债率、现金流覆盖倍数和存货周转率是财报风险分析的关键指标。', score: 0.86 },
  { title: '财报分析模板.md', text: '建议按盈利能力、偿债能力、经营效率三个维度生成风险总结。', score: 0.81 }
]

const memoryStats = [
  { label: '用户偏好', value: 36, desc: '记录你的偏好与习惯', icon: Heart, tone: 'pink' },
  { label: '任务历史', value: 52, desc: '追踪任务与执行记录', icon: Clock, tone: 'amber' },
  { label: '工具习惯', value: 18, desc: '记录常用工具与偏好', icon: Wrench, tone: 'green' }
]

const memoryItems = [
  {
    title: '用户偏好：喜欢表格化输出',
    desc: '用户倾向于以表格形式查看结果，特别是在数据分析和对比汇总场景中。',
    type: '偏好记忆',
    level: '高',
    tone: 'pink',
    icon: Heart,
    updated: '2025-05-15 10:24',
    active: true
  },
  {
    title: '任务历史：经常执行财报分析流程',
    desc: '用户在过去30天内 12 次执行财报分析相关工作流程。',
    type: '任务历史',
    level: '高',
    tone: 'amber',
    icon: Clock,
    updated: '2025-05-15 09:12',
    active: false
  },
  {
    title: '工具习惯：偏好 financial_extract_tool',
    desc: '在财务数据提取场景中，用户优先使用 financial_extract_tool。',
    type: '工具习惯',
    level: '中',
    tone: 'green',
    icon: Wrench,
    updated: '2025-05-14 16:45',
    active: false
  },
  {
    title: '用户偏好：喜欢简洁明了的回答',
    desc: '用户更喜欢简洁、直接的回答，避免冗长的解释性内容。',
    type: '偏好记忆',
    level: '低',
    tone: 'pink',
    icon: Heart,
    updated: '2025-05-13 11:08',
    active: false
  }
]

const memoryRefs = [
  { icon: Heart, tone: 'pink', text: '用户偏好：喜欢表格化输出' },
  { icon: Clock, tone: 'amber', text: '任务历史：经常执行财报分析流程' },
  { icon: Wrench, tone: 'green', text: '工具习惯：偏好 financial_extract_tool' }
]

const toolStats = [
  { label: '全部工具', value: '18', delta: '+2', icon: Box, tone: 'violet' },
  { label: '启用工具', value: '15', delta: '+1', icon: CheckCircle, tone: 'green' },
  { label: '禁用工具', value: '3', delta: '-1', icon: PauseCircle, tone: 'amber' },
  { label: '平均成功率', value: '92.3%', delta: '+3.1%', icon: Activity, tone: 'blue' },
  { label: '平均耗时', value: '1.42 s', delta: '-0.3s', icon: Clock, tone: 'violet' }
]

const toolCategories = ['全部', '数据处理', '内容生成', '代码开发', '检索搜索', '分析计算', '其他']

const toolRows = [
  { name: 'pdf_parse_tool', version: 'v1.2.0', type: '数据处理', desc: '解析PDF文件内容，提取文本和结构化信息', enabled: true, success: '96.2%', latency: '1.23 s', calls: '2,341', icon: FileText, tone: 'violet', trend: 'up' },
  { name: 'financial_extract_tool', version: 'v1.1.0', type: '数据分析', desc: '从财报文本中提取关键财务指标', enabled: true, success: '92.5%', latency: '1.87 s', calls: '1,892', icon: BarChart3, tone: 'green', trend: 'up' },
  { name: 'risk_summary_tool', version: 'v1.0.3', type: '数据分析', desc: '基于财务数据生成风险分析与总结', enabled: true, success: '91.3%', latency: '2.34 s', calls: '1,256', icon: ShieldCheck, tone: 'amber', trend: 'up' },
  { name: 'code_review_tool', version: 'v1.3.1', type: '代码开发', desc: '分析代码质量、安全性并提供优化建议', enabled: true, success: '94.1%', latency: '2.15 s', calls: '1,734', icon: Code2, tone: 'blue', trend: 'up' },
  { name: 'summary_tool', version: 'v1.0.2', type: '内容生成', desc: '对长文本进行摘要总结', enabled: true, success: '95.0%', latency: '1.05 s', calls: '3,214', icon: FileText, tone: 'pink', trend: 'up' },
  { name: 'knowledge_search_tool', version: 'v1.2.0', type: '检索搜索', desc: '在知识库中检索相关内容', enabled: true, success: '90.2%', latency: '0.98 s', calls: '4,532', icon: Search, tone: 'cyan', trend: 'up' },
  { name: 'table_output_tool', version: 'v1.0.1', type: '内容生成', desc: '将数据整理为结构化表格', enabled: true, success: '93.7%', latency: '0.76 s', calls: '2,105', icon: Grid2X2, tone: 'pink', trend: 'up' },
  { name: 'translate_tool', version: 'v1.1.0', type: '其他', desc: '多语言翻译工具', enabled: false, success: '88.4%', latency: '1.66 s', calls: '932', icon: Languages, tone: 'gray', trend: 'down' }
]

const outputJson = `{
  "status": "success",
  "data": {
    "revenue": "1200.50",
    "net_profit": "200.30",
    "debt_ratio": "0.45",
    "gross_margin": "0.25"
  }
}`

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
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark"><span></span></span>
        <span>TraceMind</span>
      </div>
      <button class="new-chat">
        <Plus :size="18" />
        新建对话
      </button>

      <nav class="nav-list">
        <button
          v-for="item in navItems"
          :key="item.id"
          class="nav-item"
          :class="{ active: item.page === activePage }"
          @click="setPage(item.page as PageKey)"
        >
          <component :is="item.icon" :size="19" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="history">
        <div class="history-title">
          <span>历史会话</span>
          <Clock3 :size="15" />
        </div>
        <div class="history-search">
          <Search :size="15" />
          <span>搜索历史会话</span>
        </div>
        <div class="history-card active">
          <strong>财报风险分析助手</strong>
          <span>今天 17:30</span>
        </div>
        <div class="history-card"><strong>论文阅读总结</strong><span>今天 16:20</span></div>
        <div class="history-card"><strong>代码审查助手</strong><span>昨天 15:10</span></div>
        <div class="history-card"><strong>市场调研分析</strong><span>05-20 14:30</span></div>
        <div class="history-card"><strong>简历优化助手</strong><span>05-19 11:20</span></div>
      </div>

      <button class="collapse-btn">
        <ChevronDown :size="17" />
        收起侧边栏
      </button>
    </aside>

    <main v-if="activePage === 'workflow'" class="main-workspace">
      <header class="topbar">
        <div class="title-wrap">
          <Workflow :size="18" />
          <h1>财报风险分析助手</h1>
          <Code2 :size="15" />
        </div>
        <div class="top-actions">
          <div class="saved-pill"><CheckCircle2 :size="17" /> 已自动保存 17:30:45</div>
          <button><Save :size="17" />保存</button>
          <button><Play :size="17" />运行</button>
          <button><Upload :size="17" />导出</button>
          <button class="share"><Share2 :size="17" />分享</button>
          <MoreVertical :size="20" class="muted-icon" />
          <div class="avatar">Z</div>
        </div>
      </header>

      <section class="studio">
        <aside class="toolbox panel">
          <h2>工具库</h2>
          <div class="mini-tabs">
            <button class="active">节点</button>
            <button>工具</button>
            <button>变量</button>
          </div>
          <label class="search-box">
            <Search :size="16" />
            <input placeholder="搜索节点" />
          </label>
          <p class="section-label">常用节点</p>
          <div class="palette-list">
            <button v-for="node in paletteNodes" :key="node.type" class="palette-card">
              <span class="palette-icon" :class="node.tone">
                <component :is="iconFor(node.icon)" :size="19" />
              </span>
              <span>
                <strong>{{ node.label }}</strong>
                <small>{{ node.desc }}</small>
              </span>
            </button>
          </div>
          <button class="custom-node"><Plus :size="17" /> 添加自定义节点</button>
        </aside>

        <section class="canvas-column">
          <div class="canvas-tabs">
            <button class="active">工作流画布</button>
            <button>流程配置</button>
          </div>

          <div class="canvas panel">
            <div class="canvas-toolbar">
              <button><Sparkles :size="17" /></button>
              <button><ZoomIn :size="16" /></button>
              <button><ZoomOut :size="16" /></button>
              <button><Maximize2 :size="16" /></button>
              <button><Plus :size="16" /></button>
              <span>100%</span>
              <ChevronDown :size="15" />
            </div>

            <svg class="edges" width="1120" height="560" viewBox="0 0 1120 560">
              <template v-for="edge in workflowEdges" :key="edge.id">
                <path
                  :d="edgePath(workflowNodes.find((n) => n.id === edge.source)!, workflowNodes.find((n) => n.id === edge.target)!)"
                  class="edge-path"
                />
              </template>
            </svg>

            <button
              v-for="node in workflowNodes"
              :key="node.id"
              class="flow-node"
              :class="[node.tone, node.status, { selected: activeNodeId === node.id }]"
              :style="{ left: `${node.position.x}px`, top: `${node.position.y}px` }"
              @click="activeNodeId = node.id"
            >
              <span class="connector left"></span>
              <span class="node-title">
                <component :is="iconFor(node.icon)" :size="16" />
                {{ node.label }}
              </span>
              <span class="node-sub">{{ node.subLabel }}</span>
              <span class="connector right"></span>
            </button>

            <div class="minimap">
              <div class="mini-content">
                <span v-for="node in workflowNodes" :key="node.id" :style="{ left: `${node.position.x / 8}px`, top: `${node.position.y / 8}px` }"></span>
              </div>
            </div>

            <div class="zoom-stack">
              <button>+</button>
              <button>-</button>
              <button><Home :size="14" /></button>
              <button><Maximize2 :size="14" /></button>
            </div>
          </div>

          <section class="trace-panel panel">
            <div class="trace-head">
              <h3>执行轨迹</h3>
              <span><CheckCircle2 :size="15" /> 运行完成</span>
            </div>
            <div class="trace-grid">
              <div class="timeline">
                <button
                  v-for="step in traceSteps"
                  :key="step.id"
                  :class="{ active: step.nodeId === activeNodeId }"
                  @click="step.nodeId && (activeNodeId = step.nodeId)"
                >
                  <CheckCircle2 :size="15" />
                  <span>{{ step.stepName }}</span>
                  <small>{{ step.time }}</small>
                </button>
              </div>
              <div class="trace-detail">
                <div class="trace-tabs">
                  <button :class="{ active: traceTab === 'node' }" @click="traceTab = 'node'">节点日志</button>
                  <button :class="{ active: traceTab === 'input' }" @click="traceTab = 'input'">输入数据</button>
                  <button :class="{ active: traceTab === 'output' }" @click="traceTab = 'output'">输出数据</button>
                  <button :class="{ active: traceTab === 'detail' }" @click="traceTab = 'detail'">执行详情</button>
                </div>
                <div class="detail-columns">
                  <div>
                    <h4>执行信息</h4>
                    <p>工具名称：<b>{{ selectedNode.tool }}</b></p>
                    <p>执行状态：<span class="success-tag">成功</span></p>
                    <p>开始时间：17:30:23</p>
                    <p>结束时间：17:30:25</p>
                    <p>执行时长：2.1s</p>
                  </div>
                  <div class="code-card">
                    <h4>执行结果</h4>
                    <pre>{{ outputJson }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>

        <aside class="inspector-column">
          <section class="inspector panel">
            <h2>节点详情</h2>
            <div class="inspector-tabs">
              <button :class="{ active: inspectorTab === 'config' }" @click="inspectorTab = 'config'">配置</button>
              <button :class="{ active: inspectorTab === 'explain' }" @click="inspectorTab = 'explain'">解释</button>
              <button :class="{ active: inspectorTab === 'io' }" @click="inspectorTab = 'io'">输入输出</button>
              <button :class="{ active: inspectorTab === 'test' }" @click="inspectorTab = 'test'">测试</button>
            </div>
            <div class="inspector-body">
              <h3>节点解释</h3>
              <h4>为什么需要这个节点？</h4>
              <p>{{ selectedNode.reason }}</p>

              <h4>选择的工具</h4>
              <div class="selected-tool">
                <FileInput :size="16" />
                <span>{{ selectedNode.tool }}</span>
                <b>匹配度 {{ selectedNode.confidence.toFixed(2) }}</b>
              </div>

              <div v-if="selectedNode.id === 'knowledge'" class="workflow-kb-select">
                <h4>选择知识库</h4>
                <button><Database :size="16" /> 财报分析库 <ChevronDown :size="14" /></button>
                <p>系统将从该知识库返回相关文档片段，供后续风险总结节点使用。</p>
                <div class="workflow-snippets">
                  <article v-for="item in retrievalSnippets.slice(0, 2)" :key="item.title">
                    <strong>{{ item.title }}</strong>
                    <span>{{ item.text }}</span>
                  </article>
                </div>
              </div>

              <h4>选择原因</h4>
              <ul>
                <li>用户需求包含“财报分析”和“风险总结”</li>
                <li>该工具专门用于财务指标提取</li>
                <li>历史成功率高达 88%</li>
                <li>相比其他工具更适合结构化数据提取</li>
              </ul>

              <h4>备选工具（Top 3）</h4>
              <div class="tool-ranks">
                <div v-for="tool in toolScores.slice(1)" :key="tool.name">
                  <span>{{ tool.name }}</span>
                  <b>{{ tool.score.toFixed(2) }}</b>
                </div>
              </div>

              <h4>置信度 <strong class="confidence">0.91</strong></h4>
              <div class="progress"><span></span></div>
            </div>
          </section>

          <section class="side-card panel">
            <div class="card-title">失败分析 <X :size="16" /></div>
            <div class="empty-failure">暂无失败节点</div>
          </section>
          <section class="side-card panel">
            <div class="card-title">优化建议</div>
            <p class="suggestion"><Check :size="16" /> 工作流执行顺利，所有节点运行正常</p>
            <p class="suggestion"><Check :size="16" /> 可考虑添加数据可视化节点增强报告展示</p>
          </section>
        </aside>
      </section>
    </main>

    <main v-else-if="activePage === 'home'" class="agent-page">
      <header class="topbar">
        <div class="title-wrap">
          <Bot :size="18" />
          <h1>智能体工作台</h1>
          <Code2 :size="15" />
        </div>
        <div class="top-actions">
          <div class="saved-pill"><CheckCircle2 :size="17" /> 在线</div>
          <button><MessageSquarePlus :size="17" />新建会话</button>
          <button><Upload :size="17" />导入文件</button>
          <button class="share"><Share2 :size="17" />分享</button>
          <MoreVertical :size="20" class="muted-icon" />
          <div class="avatar">Z</div>
        </div>
      </header>
      <section class="agent-shell">
        <header class="agent-top">
          <h1>Agent 工作台</h1>
          <span class="online-dot">在线</span>
          <div class="agent-actions">
            <button><MessageSquarePlus :size="15" /> 新建会话</button>
            <button><RefreshCw :size="15" /></button>
            <button><MoreVertical :size="15" /></button>
            <button><Maximize2 :size="15" /></button>
          </div>
        </header>

        <section class="agent-body">
          <div class="chat-pane">
            <div class="user-bubble">
              <div class="headshot"></div>
              <p>帮我分析这段 Python 代码的时间复杂度，并指出潜在问题</p>
              <small>10:30</small>
            </div>
            <div class="assistant-bubble">
              <div class="agent-icon"><Bot :size="17" /></div>
              <div>
                <strong>TraceMind Agent</strong>
                <p>我会帮你分析这段 Python 代码的时间复杂度和潜在问题。</p>
                <h4>分析结果：</h4>
                <ul>
                  <li>时间复杂度：O(n²)</li>
                  <li>空间复杂度：O(1)</li>
                </ul>
                <h4>潜在问题：</h4>
                <ul>
                  <li>双重循环导致时间复杂度较高</li>
                  <li>当输入规模较大时，性能会受到影响</li>
                </ul>
                <p>优化建议：可以考虑使用哈希表来优化查找操作，将时间复杂度降低到 O(n)。</p>
                <small>10:31</small>
              </div>
            </div>
            <div class="quick-actions">
              <button><FileText :size="14" /> 查看执行过程</button>
              <button><Library :size="14" /> 查看工具调用</button>
              <button><ChartNoAxesCombined :size="14" /> 查看详细分析</button>
            </div>
            <label class="chat-input">
              <input v-model="agentInput" placeholder="输入你的问题，或使用 / 触发快捷指令" />
              <button><Sparkles :size="15" /></button>
              <button class="send"><Send :size="16" /></button>
            </label>
          </div>

          <aside class="conversation-info">
            <h3>会话信息</h3>
            <p><b>会话ID</b><span>conv_20240520_001</span></p>
            <p><b>创建时间</b><span>2024-05-20 10:30:15</span></p>
            <p><b>模型</b><span>gpt-4-turbo</span></p>
            <p><b>状态</b><span class="green">已完成</span></p>
            <p><b>总耗时</b><span>12.34s</span></p>
            <p><b>总用量</b><span>1,245</span></p>
            <div class="quick-list">
              <h3>快速操作</h3>
              <button><MessageSquarePlus :size="15" /> 新建会话</button>
              <button><Upload :size="15" /> 导入文件</button>
              <button><X :size="15" /> 清空对话</button>
            </div>
          </aside>
        </section>
      </section>
    </main>

    <main v-else-if="activePage === 'settings'" class="settings-page">
      <header class="settings-page-head">
        <h1>设置</h1>
        <p>管理系统偏好、模型配置和集成设置。</p>
      </header>

      <section class="settings-content">
        <div class="settings-layout">
          <aside class="settings-menu panel">
            <button class="active">通用设置</button>
            <button>模型设置</button>
            <button>记忆设置</button>
            <button>安全设置</button>
          </aside>

          <section class="settings-form panel">
            <div class="settings-form-head">
              <h2>通用设置</h2>
              <button class="template-create">保存设置</button>
            </div>

            <div class="setting-row">
              <label>语言</label>
              <button class="setting-select">简体中文 <ChevronDown :size="16" /></button>
            </div>
            <div class="setting-row">
              <label>默认模型</label>
              <button class="setting-select">GPT-4o <ChevronDown :size="16" /></button>
            </div>
            <div class="setting-row">
              <label>主题模式</label>
              <button class="setting-select">跟随系统 <ChevronDown :size="16" /></button>
            </div>
            <div class="setting-row">
              <div>
                <label>自动保存</label>
                <p>自动保存编辑内容，避免数据丢失</p>
              </div>
              <span class="settings-switch"></span>
            </div>
            <div class="setting-row">
              <div>
                <label>自动保存间隔</label>
                <p>设置自动保存的时间间隔</p>
              </div>
              <button class="setting-select small">5 分钟 <ChevronDown :size="16" /></button>
            </div>
            <div class="setting-row webhook">
              <div>
                <label>Webhook URL（可选）</label>
                <p>当事件触发时发送 POST 请求到此地址</p>
              </div>
              <input value="https://example.com/webhook" />
            </div>
          </section>
        </div>

        <section class="settings-changes panel">
          <h2>最近配置变更</h2>
          <div class="settings-change-row"><span>更新默认模型</span><span>今天 10:32</span><span>Zhang San</span></div>
          <div class="settings-change-row"><span>修改主题模式</span><span>今天 10:15</span><span>Zhang San</span></div>
          <div class="settings-change-row"><span>更新自动保存间隔</span><span>昨天 16:05</span><span>Zhang San</span></div>
        </section>
      </section>
    </main>

    <main v-else-if="activePage === 'tools'" class="tools-page">
      <header class="tools-header">
        <div>
          <h1>工具库</h1>
          <p>管理和配置智能体可调用的工具，支持工具的启用、禁用与监控</p>
        </div>
        <div class="tools-actions">
          <label><Search :size="16" /><input placeholder="搜索工具名称或描述..." /></label>
          <button class="template-create"><Plus :size="17" />添加工具</button>
        </div>
      </header>

      <section class="tools-content">
        <div class="tools-stats">
          <article v-for="stat in toolStats" :key="stat.label" class="tools-stat panel">
            <span :class="['tools-stat-icon', stat.tone]"><component :is="stat.icon" :size="22" /></span>
            <div>
              <p>{{ stat.label }}</p>
              <strong>{{ stat.value }}</strong>
              <small>较上周 <b>{{ stat.delta }}</b></small>
            </div>
          </article>
        </div>

        <div class="tools-toolbar">
          <div class="tools-tabs">
            <button v-for="category in toolCategories" :key="category" :class="{ active: category === '全部' }">{{ category }}</button>
          </div>
          <div class="tools-filter">
            <button>全部状态 <ChevronDown :size="14" /></button>
            <button>默认排序 <ChevronDown :size="14" /></button>
            <button><RefreshCw :size="15" />刷新</button>
          </div>
        </div>

        <section class="tools-table panel">
          <div class="tools-table-head">
            <span>工具名称</span>
            <span>类型</span>
            <span>描述</span>
            <span>状态</span>
            <span>成功率</span>
            <span>平均耗时</span>
            <span>调用次数</span>
            <span>操作</span>
          </div>
          <article v-for="tool in toolRows" :key="tool.name" class="tools-row">
            <div class="tool-name-cell">
              <span :class="['tool-row-icon', tool.tone]"><component :is="tool.icon" :size="22" /></span>
              <div><strong>{{ tool.name }}</strong><small>{{ tool.version }}</small></div>
            </div>
            <span class="tool-type">{{ tool.type }}</span>
            <p>{{ tool.desc }}</p>
            <div class="tool-status">
              <span class="toggle" :class="{ off: !tool.enabled }"></span>
              <b>{{ tool.enabled ? '启用' : '禁用' }}</b>
            </div>
            <span class="tool-success">{{ tool.success }} <TrendingUp v-if="tool.trend === 'up'" :size="13" /><span v-else class="down">↓</span></span>
            <span>{{ tool.latency }}</span>
            <span>{{ tool.calls }}</span>
            <div class="tool-actions">
              <button><Eye :size="15" /></button>
              <button><Gauge :size="15" /></button>
              <button><MoreHorizontal :size="15" /></button>
            </div>
          </article>
        </section>

        <div class="tools-pagination">
          <span>共 18 条工具</span>
          <div><button disabled><ChevronDown :size="14" /></button><button class="active">1</button><button>2</button><button>3</button><button><ChevronDown :size="14" /></button><button>10 条/页 <ChevronDown :size="14" /></button></div>
        </div>
      </section>
    </main>

    <main v-else-if="activePage === 'memory'" class="memory-page">
      <header class="memory-header">
        <div>
          <h1>记忆中心</h1>
          <p>管理用户偏好、任务历史与工具习惯，帮助智能体更好地理解你</p>
        </div>
        <div class="memory-actions">
          <label><Search :size="17" /><input placeholder="搜索记忆..." /></label>
          <button class="template-create"><Plus :size="17" />新增记忆</button>
        </div>
      </header>

      <section class="memory-content">
        <div class="memory-stats">
          <article v-for="stat in memoryStats" :key="stat.label" class="memory-stat panel">
            <span :class="['memory-icon', stat.tone]"><component :is="stat.icon" :size="28" /></span>
            <div>
              <p>{{ stat.label }}</p>
              <strong>{{ stat.value }}</strong>
              <small>{{ stat.desc }}</small>
            </div>
          </article>
        </div>

        <div class="memory-tabs">
          <button class="active">全部</button>
          <button>偏好记忆</button>
          <button>任务历史</button>
          <button>工具习惯</button>
        </div>

        <section class="memory-main">
          <div class="memory-list">
            <article v-for="item in memoryItems" :key="item.title" class="memory-item panel" :class="{ active: item.active }">
              <span :class="['memory-icon', item.tone]"><component :is="item.icon" :size="22" /></span>
              <div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.desc }}</p>
                <div>
                  <b :class="item.tone">{{ item.type }}</b>
                  <b class="level">{{ item.level }}</b>
                  <time>更新于 {{ item.updated }}</time>
                </div>
              </div>
            </article>
            <p class="memory-count">共 4 条记忆</p>
          </div>

          <aside class="memory-detail">
            <section class="memory-detail-card panel">
              <div class="memory-detail-title">
                <span class="memory-icon pink"><Heart :size="22" /></span>
                <h2>用户偏好：喜欢表格化输出</h2>
                <b>高</b>
              </div>
              <div class="memory-kv">
                <span><Target :size="16" />记忆类型</span><strong>偏好记忆</strong>
                <span><Info :size="16" />重要性</span><strong><b class="level">高</b></strong>
                <span><Bot :size="16" />来源任务</span><strong>财报分析助手 - 财报分析报告生成</strong>
                <span><Calendar :size="16" />首次记录</span><strong>2025-04-20 14:32</strong>
                <span><Clock :size="16" />最后更新</span><strong>2025-05-15 10:24</strong>
                <span><FileText :size="16" />详细描述</span>
                <p>用户倾向于以表格形式查看结果，特别是在数据分析、对比和汇总场景中。当提供多个选项或方案时，用户更容易通过表格快速理解关键信息。</p>
                <span><Layers3 :size="16" />影响模块</span>
                <div class="memory-tags"><b>输出生成</b><b>数据分析</b><b>报告撰写</b></div>
              </div>
            </section>

            <section class="memory-ref-card panel">
              <h3>本次生成参考的记忆 <Info :size="15" /></h3>
              <div v-for="ref in memoryRefs" :key="ref.text">
                <component :is="ref.icon" :class="ref.tone" :size="17" />
                <span>{{ ref.text }}</span>
              </div>
            </section>
          </aside>
        </section>
      </section>
    </main>

    <main v-else-if="activePage === 'knowledge'" class="knowledge-page">
      <header class="knowledge-header">
        <div class="title-wrap">
          <h1>知识库</h1>
          <span class="online-dot">在线</span>
        </div>
        <div class="knowledge-actions">
          <button class="template-create"><Plus :size="17" />新建知识库</button>
          <button><Upload :size="17" />导入文档</button>
          <label><Search :size="16" /><input placeholder="搜索知识库" /></label>
          <Bell :size="19" class="muted-icon" />
          <div class="avatar">Z</div>
        </div>
      </header>

      <section class="knowledge-content">
        <div class="knowledge-stats">
          <article v-for="stat in knowledgeStats" :key="stat.label" class="knowledge-stat panel">
            <span :class="['knowledge-stat-icon', stat.tone]"><component :is="stat.icon" :size="25" /></span>
            <div>
              <p>{{ stat.label }}</p>
              <strong>{{ stat.value }} <small>{{ stat.suffix }}</small></strong>
              <em>较昨日 <b>{{ stat.delta }}</b></em>
            </div>
          </article>
        </div>

        <section class="knowledge-main">
          <aside class="kb-list panel">
            <div class="kb-list-head">
              <h3>知识库列表</h3>
              <button>全部状态 <ChevronDown :size="14" /></button>
            </div>
            <article v-for="kb in knowledgeBases" :key="kb.name" class="kb-item" :class="{ active: kb.active }">
              <span :class="['kb-icon', kb.tone]"><component :is="kb.icon" :size="28" /></span>
              <div>
                <h4>{{ kb.name }} <small>正常</small></h4>
                <p>{{ kb.desc }}</p>
                <div class="kb-meta">
                  <span>文档数 {{ kb.docs }}</span>
                  <span>向量片段 {{ kb.chunks }}</span>
                  <span>更新于 {{ kb.updated }}</span>
                  <b>正常</b>
                </div>
              </div>
              <button>{{ kb.active ? '进入' : '查看' }}</button>
              <MoreVertical :size="18" />
            </article>
            <div class="kb-pagination">
              <span>共 12 条</span>
              <div><button disabled><ChevronDown :size="14" /></button><button class="active">1</button><button>2</button><button><ChevronDown :size="14" /></button><button>10 条/页</button></div>
            </div>
          </aside>

          <section class="kb-detail panel">
            <div class="kb-detail-head">
              <h3>产品文档库 <span>正常</span></h3>
              <div><button>编辑</button><button><MoreVertical :size="16" /></button></div>
            </div>
            <div class="kb-detail-tabs">
              <button class="active">概览</button>
              <button>文档管理</button>
              <button>检索测试</button>
              <button>设置</button>
            </div>

            <div class="kb-section">
              <h4>基本信息</h4>
              <div class="kb-info-grid">
                <span>知识库名称<b>产品文档库</b></span>
                <span>创建时间<b>2024-03-15 09:30</b></span>
                <span>更新时间<b>2024-05-12 10:30</b></span>
                <span>创建人<b>张晓明</b></span>
              </div>
            </div>

            <div class="kb-section">
              <h4>检索配置</h4>
              <div class="kb-config-row">
                <span>Embedding 模型<b>text-embedding-3-large</b></span>
                <span>Chunk 大小<b>800</b></span>
                <span>Chunk 重叠<b>120</b></span>
                <span>检索模式<b>混合检索</b></span>
                <span>Top K<b>8</b></span>
              </div>
            </div>

            <div class="kb-bottom-grid">
              <div class="kb-mini-chart">
                <div><h4>检索趋势（近7天）</h4><strong>总检索量 2,845 次</strong></div>
                <svg viewBox="0 0 420 150">
                  <polyline points="8,112 70,82 132,62 194,38 256,74 318,34 386,48 414,40" />
                  <path d="M8 112 L70 82 L132 62 L194 38 L256 74 L318 34 L386 48 L414 40 L414 142 L8 142 Z" />
                </svg>
              </div>

              <div class="kb-docs-simple">
                <div class="kb-docs-head"><h4>已关联文档（128）</h4><button>查看全部</button></div>
                <div v-for="doc in knowledgeDocuments" :key="doc.name" class="kb-doc-row">
                  <FileText :size="15" />
                  <span>{{ doc.name }}</span>
                  <b :class="doc.tone">{{ doc.type }}</b>
                  <small>{{ doc.size }}</small>
                </div>
              </div>
            </div>

            <div class="kb-retrieval-simple">
              <div>
                <h4>模拟检索结果</h4>
                <p>当前 Workflow 知识检索节点选择“财报分析库”后，可返回以下相关片段。</p>
              </div>
              <article v-for="item in retrievalSnippets" :key="item.title">
                <span>{{ item.title }}</span>
                <p>{{ item.text }}</p>
                <b>相关度 {{ item.score.toFixed(2) }}</b>
              </article>
            </div>
          </section>
        </section>
      </section>
    </main>

    <main v-else-if="activePage === 'template'" class="template-page">
      <header class="template-header">
        <div>
          <h1>模板库</h1>
          <p>从模板快速开始，或创建你自己的模板</p>
        </div>
        <div class="template-header-actions">
          <label class="template-search"><Search :size="16" /><input placeholder="搜索模板..." /></label>
          <button class="template-create"><Plus :size="17" />创建模板</button>
        </div>
      </header>

      <section class="template-content">
        <div class="template-stats">
          <article v-for="stat in templateStats" :key="stat.label" class="template-stat panel">
            <span :class="['template-stat-icon', stat.tone]"><component :is="stat.icon" :size="20" /></span>
            <div>
              <p>{{ stat.label }}</p>
              <strong>{{ stat.value }}</strong>
            </div>
          </article>
        </div>

        <div class="template-toolbar">
          <div class="template-tabs">
            <button v-for="category in templateCategories" :key="category" :class="{ active: category === '全部' }">{{ category }}</button>
          </div>
          <div class="template-sort">
            <button>排序：最新 <ChevronDown :size="14" /></button>
            <button><Filter :size="15" />筛选</button>
          </div>
        </div>

        <section class="template-grid">
          <article v-for="item in templateCards" :key="item.title" class="template-card panel">
            <div class="template-card-head">
              <span v-if="item.badge" :class="['template-badge', item.badgeTone]">{{ item.badge }}</span>
              <button :class="{ starred: item.starred }"><Star :size="17" /></button>
            </div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.desc }}</p>
            <div class="template-flow">
              <template v-for="(step, index) in item.steps" :key="step">
                <span :class="item.tone"><FileText :size="13" />{{ step }}</span>
                <i v-if="index < item.steps.length - 1"></i>
              </template>
            </div>
            <div class="template-tags">
              <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
            </div>
            <div class="template-meta">
              <span><Eye :size="14" />{{ item.views }}</span>
              <span><Heart :size="14" />{{ item.likes }}</span>
              <span><User :size="14" />{{ item.author }}</span>
              <time>{{ item.date }}</time>
            </div>
          </article>

          <article class="template-new-card panel">
            <button><Plus :size="30" /></button>
            <h3>创建新模板</h3>
            <p>从空白模板开始，创建你自己的工作流模板</p>
            <button class="template-create">开始创建</button>
          </article>
        </section>

        <div class="template-pagination">
          <button disabled><ChevronDown :size="15" /></button>
          <button class="active">1</button>
          <button>2</button>
          <button>3</button>
          <button><ChevronDown :size="15" /></button>
          <button><ChevronDown :size="15" /></button>
        </div>
      </section>
    </main>

    <main v-else class="agents-page">
      <header class="topbar">
        <div class="title-wrap">
          <Bot :size="18" />
          <h1>智能体</h1>
          <span class="online-dot">在线</span>
        </div>
        <div class="top-actions">
          <button class="share"><Plus :size="17" />创建智能体</button>
          <button><Upload :size="17" />导入配置</button>
          <button><MessageSquarePlus :size="17" /></button>
          <button><Bell :size="17" /></button>
          <div class="avatar">Z</div>
        </div>
      </header>

      <section class="agents-dashboard">
        <section class="agent-hero panel">
          <div>
            <h2>构建、管理并协作你的 AI 智能体</h2>
            <p>快速构建专属智能体，自动化复杂任务，赋能业务增长。</p>
            <div class="hero-actions">
              <button class="primary"><Plus :size="17" /> 新建智能体</button>
              <button><TimerReset :size="17" /> 查看运行记录</button>
              <button><Library :size="17" /> 智能体市场</button>
            </div>
          </div>
          <div class="hero-visual">
            <div class="bot-orbit">
              <Bot :size="58" />
            </div>
          </div>
        </section>

        <div class="metrics-strip">
          <section class="metric-card panel">
            <div class="metric-top"><span>智能体总数</span><span class="metric-icon blue"><Bot :size="20" /></span></div>
            <strong>24 <small>个</small></strong>
            <p>较昨日 +2 <TrendingUp :size="13" /></p>
            <svg viewBox="0 0 180 44"><path d="M2 32 C20 38 26 26 42 31 S65 39 80 28 101 37 116 24 135 30 148 18 165 15 178 8" /></svg>
          </section>
          <section class="metric-card panel">
            <div class="metric-top"><span>在线运行中</span><span class="metric-icon green"><TimerReset :size="20" /></span></div>
            <strong>8 <small>个</small></strong>
            <p>较昨日 +1 <TrendingUp :size="13" /></p>
            <svg class="green-line" viewBox="0 0 180 44"><path d="M2 25 C18 20 27 34 42 29 S61 18 78 31 101 34 116 12 134 19 148 13 164 18 178 6" /></svg>
          </section>
          <section class="metric-card panel">
            <div class="metric-top"><span>平均成功率</span><span class="metric-icon violet"><ShieldCheck :size="20" /></span></div>
            <strong>92.7 <small>%</small></strong>
            <p>较昨日 +3.6% <TrendingUp :size="13" /></p>
            <svg class="violet-line" viewBox="0 0 180 44"><path d="M2 35 C18 39 23 12 39 20 S62 33 78 22 101 30 117 23 136 27 150 20 166 13 178 7" /></svg>
          </section>
          <section class="metric-card panel">
            <div class="metric-top"><span>日均调用量</span><span class="metric-icon amber"><BarChart3 :size="20" /></span></div>
            <strong>12,845 <small>次</small></strong>
            <p>较昨日 +8.2% <TrendingUp :size="13" /></p>
            <svg class="amber-line" viewBox="0 0 180 44"><path d="M2 33 C18 28 28 36 44 29 S66 14 82 24 101 38 117 19 137 25 151 14 164 17 178 5" /></svg>
          </section>
        </div>

        <section class="agents-list panel">
          <div class="agents-list-head">
            <h3>我的智能体</h3>
            <div>
              <button>全部状态 <ChevronDown :size="14" /></button>
              <button>全部角色 <ChevronDown :size="14" /></button>
              <label><Search :size="15" /><input placeholder="搜索智能体名称或描述" /></label>
            </div>
          </div>
          <div class="agent-card-grid">
            <article v-for="agent in agentCards" :key="agent.name" class="agent-manage-card" :class="{ featured: agent.name === '财报分析助手' }">
              <div class="agent-card-top">
                <span class="agent-card-icon" :class="agent.tone"><component :is="agent.icon" :size="30" /></span>
                <div>
                  <h4>{{ agent.name }} <small>{{ agent.tag }}</small></h4>
                  <p>自动提取关键数据，分析财务指标并生成洞察报告。</p>
                </div>
              </div>
              <div class="agent-meta">
                <span><Sparkles :size="13" /> {{ agent.model }}</span>
                <span>{{ agent.tools }} 个工具</span>
                <b :class="{ online: agent.online }">{{ agent.online ? '在线' : '离线' }}</b>
              </div>
              <div class="agent-stats">
                <span><small>成功率</small>{{ agent.success }}</span>
                <span><small>调用量</small>{{ agent.calls }}</span>
                <span><small>运行中</small>{{ agent.running }}</span>
                <button>进入</button>
                <button class="ghost">编辑</button>
                <button class="dots">...</button>
              </div>
            </article>
          </div>
        </section>

        <aside class="agent-detail panel">
          <div class="detail-title">
            <h3>智能体详情</h3>
            <button>切换智能体 <ChevronDown :size="14" /></button>
          </div>
          <div class="detail-agent-head">
            <span class="agent-card-icon green"><FileText :size="34" /></span>
            <div>
              <h4>财报分析助手 <small>分析助手</small></h4>
              <p><span class="online-dot">在线</span></p>
            </div>
          </div>
          <p class="detail-desc">自动提取财报关键数据，分析财务指标并生成洞察报告。</p>
          <div class="detail-kv">
            <span>模型</span><b>Qwen3-32B</b>
            <span>工具</span><b>12 个工具</b>
          </div>
          <div class="tool-chip-row">
            <span v-for="tone in ['violet','amber','blue','cyan','green']" :key="tone" :class="tone"></span>
            <small>+7</small>
          </div>
          <div class="recent-task-head">
            <h4>最近任务</h4>
            <button>查看全部</button>
          </div>
          <div class="recent-task" v-for="task in ['腾讯控股 2024Q1 财报分析', '阿里巴巴 2024Q4 财报对比', '美团 2024Q1 经营分析报告']" :key="task">
            <FileText :size="15" />
            <span>{{ task }}</span>
            <small>今天 17:20</small>
            <b>成功</b>
          </div>
        </aside>
      </section>
    </main>
  </div>
</template>

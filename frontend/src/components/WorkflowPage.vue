<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ConnectionLineType,
  Handle,
  MarkerType,
  Panel,
  Position,
  useVueFlow,
  VueFlow,
  type Connection,
  type EdgeChange,
  type EdgeMouseEvent,
  type EdgeUpdateEvent,
  type NodeChange,
  type NodeDragEvent,
  type NodeMouseEvent
} from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  Database,
  Download,
  FileInput,
  ListTree,
  Maximize2,
  Minimize2,
  PanelLeftOpen,
  PanelRightOpen,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Share2,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-vue-next'
import { api } from '../api'
import type { NodeStatus, PaletteNode, TraceStep, WorkflowEdge, WorkflowNode } from '../types'

type DrawerName = 'toolbox' | 'inspector' | null

const props = defineProps<{
  workflowTitle: string
  workflowId: number | null
  workflowNodes: WorkflowNode[]
  workflowEdges: WorkflowEdge[]
  traceSteps: TraceStep[]
  traceOpenKey: number
  filteredPaletteNodes: PaletteNode[]
  activeNodeId: string
  selectedNode: WorkflowNode
  selectedTraceStep?: TraceStep
  selectedKnowledgeBase?: any
  retrievalSnippets: any[]
  relatedTools: any[]
  inspectorTab: string
  traceTab: string
  paletteSearch: string
  workflowZoom: number
  canvasMode: string
  toolboxTab: string
  workflowStatus: string
  savedAt: string
  runOutput: string
  runError: string
  apiOnline: boolean
  iconFor: (name: string) => unknown
  statusLabel: (status: NodeStatus) => string
  edgePath: (source: WorkflowNode, target: WorkflowNode) => string
}>()

const emit = defineEmits<{
  (event: 'update:activeNodeId', value: string): void
  (event: 'update:inspectorTab', value: string): void
  (event: 'update:traceTab', value: string): void
  (event: 'update:paletteSearch', value: string): void
  (event: 'update:canvasMode', value: 'canvas' | 'config'): void
  (event: 'update:toolboxTab', value: 'nodes' | 'tools' | 'variables'): void
  (event: 'save'): void
  (event: 'run'): void
  (event: 'export'): void
  (event: 'share'): void
  (event: 'generate'): void
  (event: 'zoom', delta: number): void
  (event: 'reset'): void
  (event: 'addCustomNode'): void
  (event: 'addPaletteNode', node: PaletteNode): void
  (event: 'searchKnowledge'): void
  (event: 'updateNodePosition', nodeId: string, position: { x: number; y: number }): void
  (event: 'createEdge', edge: WorkflowEdge): void
  (event: 'updateEdge', edgeId: string, edge: WorkflowEdge): void
  (event: 'deleteNode', nodeId: string): void
  (event: 'deleteEdge', edgeId: string): void
}>()

const flowRoot = ref<HTMLElement | null>(null)
const flowId = 'tracemind-workflow-flow'
const flowNodes = ref<any[]>([])
const flowEdges = ref<any[]>([])
const activeDrawer = ref<DrawerName>(null)
const traceOpen = ref(false)
const isImmersive = ref(false)
const isNativeFullscreen = ref(false)
const selectedEdgeId = ref('')
const { zoomIn, zoomOut, zoomTo, fitView } = useVueFlow(flowId)

const particles = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  top: `${(index * 61) % 100}%`,
  delay: `${(index % 9) * -0.7}s`,
  duration: `${12 + (index % 7)}s`
}))

const traceStatusText = computed(() => {
  if (!props.traceSteps.length) return '待执行'
  if (props.workflowStatus === 'running') return '运行中'
  if (props.workflowStatus === 'failed') return '运行失败'
  return '运行完成'
})
const hasWorkflow = computed(() => Boolean(props.workflowId && props.workflowNodes.length))
const hasRightDrawer = computed(() => activeDrawer.value === 'inspector')
const selectedTraceStep = computed(() => {
  if (!props.selectedNode.id) return undefined
  return props.traceSteps.find((step) => step.nodeId === props.selectedNode.id)
})
const selectedNodeInput = computed(() => selectedTraceStep.value?.inputData ?? props.selectedNode.inputData ?? null)
const selectedNodeOutput = computed(() => selectedTraceStep.value?.outputData ?? props.selectedNode.outputData ?? null)
const selectedNodeStatus = computed(() => selectedTraceStep.value?.status ?? props.selectedNode.status)
const selectedNodeLatency = computed(() => {
  const latencyMs = selectedTraceStep.value?.latencyMs
  if (typeof latencyMs === 'number') return `${latencyMs}ms`
  return selectedTraceStep.value?.latency ?? '-'
})
const upstreamNodes = computed(() => {
  const sourceIds = props.workflowEdges.filter((edge) => edge.target === props.selectedNode.id).map((edge) => edge.source)
  return props.workflowNodes.filter((node) => sourceIds.includes(node.id))
})
const downstreamNodes = computed(() => {
  const targetIds = props.workflowEdges.filter((edge) => edge.source === props.selectedNode.id).map((edge) => edge.target)
  return props.workflowNodes.filter((node) => targetIds.includes(node.id))
})
const hasTraceData = computed(() => Boolean(selectedTraceStep.value))
const currentToolName = computed(() => props.selectedNode.toolName ?? props.selectedNode.tool)
const selectedToolReason = computed(() => {
  const fromNode = props.selectedNode.toolReason?.trim()
  if (fromNode) return fromNode
  const selectedCandidate = props.selectedNode.candidateTools?.find((tool) => tool.name === currentToolName.value)
  return selectedCandidate?.reason?.trim() || '后端暂未返回工具选择原因'
})
const webSearchTraceDetails = computed(() => {
  if (currentToolName.value !== 'web_search_tool') return null
  const input = readRecord(selectedNodeInput.value)
  const output = readRecord(selectedNodeOutput.value)
  return {
    query: typeof input?.query === 'string' ? input.query : '-',
    provider: typeof output?.provider === 'string' ? output.provider : '-',
    resultCount: output?.resultCount != null && Number.isFinite(Number(output.resultCount)) ? Number(output.resultCount) : null,
    sources: normalizeTraceSources(output?.sources),
    latencyMs: typeof selectedTraceStep.value?.latencyMs === 'number' ? selectedTraceStep.value.latencyMs : null,
    fallback: typeof output?.fallback === 'boolean' ? output.fallback : null
  }
})
const workflowRoleText = computed(() => {
  if (props.selectedNode.roleInWorkflow) return props.selectedNode.roleInWorkflow
  const upstream = upstreamNodes.value.map((node) => node.label || node.id).join('、') || '工作流入口'
  const downstream = downstreamNodes.value.map((node) => node.label || node.id).join('、') || '最终输出'
  return `该节点接收 ${upstream} 的输出，并将结果传递给 ${downstream}。`
})
const candidateToolRows = computed(() => (props.selectedNode.candidateTools ?? []).map((tool) => ({
  ...tool,
  displayName: tool.displayName ?? tool.name,
  scoreText: `${Math.round(Number(tool.score ?? 0) * 100)}%`,
  selected: tool.name === currentToolName.value
})))

function readRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function normalizeTraceSources(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const record = readRecord(item)
      const url = typeof record?.url === 'string' ? record.url : ''
      if (!/^https?:\/\//i.test(url)) return null
      return { title: typeof record?.title === 'string' ? record.title : url, url }
    })
    .filter((item): item is { title: string; url: string } => Boolean(item))
}
const highlightedOutput = computed(() => {
  const output = selectedNodeOutput.value
  if (!output || typeof output !== 'object' || Array.isArray(output)) return null
  const record = output as Record<string, unknown>
  return {
    summary: typeof record.summary === 'string' ? record.summary : '',
    markdown: typeof record.markdown === 'string' ? record.markdown : '',
    downloadUrl: typeof record.downloadUrl === 'string' ? record.downloadUrl : ''
  }
})
const nodeTestInput = ref('{\n  "query": "",\n  "files": [],\n  "upstreamOutputs": {}\n}')
const nodeTestResult = ref('')
const nodeTestError = ref('')
const nodeTestRunning = ref(false)

function traceIconFor(status: NodeStatus) {
  if (status === 'success') return CheckCircle2
  if (status === 'partial_success') return Check
  if (status === 'running') return Play
  if (status === 'failed' || status === 'permission_denied' || status === 'cancelled') return X
  return Clock3
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function statusBadgeClass(status: NodeStatus) {
  return {
    success: 'success',
    partial_success: 'partial',
    running: 'running',
    failed: 'failed',
    permission_denied: 'failed',
    cancelled: 'failed',
    waiting_approval: 'waiting',
    queued: 'waiting',
    skipped: 'muted',
    idle: 'muted'
  }[status]
}

async function runNodeTest() {
  nodeTestError.value = ''
  nodeTestResult.value = ''

  if (!props.workflowId || !props.selectedNode.id) {
    nodeTestError.value = '缺少 workflowId 或 nodeId，无法运行单节点测试。'
    return
  }

  let payload: unknown
  try {
    payload = JSON.parse(nodeTestInput.value || '{}')
  } catch {
    nodeTestError.value = '测试输入不是合法 JSON。'
    return
  }

  nodeTestRunning.value = true
  try {
    const result = await api.testWorkflowNode(props.workflowId, props.selectedNode.id, payload)
    nodeTestResult.value = formatJson(result)
    if (result?.errorMessage) nodeTestError.value = String(result.errorMessage)
  } catch (error) {
    nodeTestError.value = error instanceof Error ? error.message : '单节点测试失败'
  } finally {
    nodeTestRunning.value = false
  }
}

watch(
  () => props.workflowNodes,
  () => {
    flowNodes.value = props.workflowNodes.map((node) => ({
      id: node.id,
      type: 'workflow',
      position: { ...node.position },
      data: node,
      draggable: true,
      connectable: true,
      selectable: true,
      deletable: true,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      class: [node.tone, node.status, props.activeNodeId === node.id ? 'selected' : ''].filter(Boolean).join(' ')
    }))
  },
  { deep: true, immediate: true }
)

watch(
  () => props.workflowEdges,
  () => {
    flowEdges.value = props.workflowEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      data: edge,
      updatable: true,
      selectable: true,
      deletable: true,
      animated: edge.branch === 'alt',
      markerEnd: MarkerType.ArrowClosed,
      interactionWidth: 24,
      class: [edge.branch === 'alt' ? 'alt' : '', selectedEdgeId.value === edge.id ? 'selected' : ''].filter(Boolean).join(' ')
    }))
  },
  { deep: true, immediate: true }
)

watch(
  () => props.activeNodeId,
  () => {
    flowNodes.value = flowNodes.value.map((node) => ({
      ...node,
      selected: node.id === props.activeNodeId,
      class: [node.data?.tone, node.data?.status, node.id === props.activeNodeId ? 'selected' : ''].filter(Boolean).join(' ')
    }))
  }
)

watch(
  () => props.traceOpenKey,
  () => {
    if (props.traceOpenKey > 0) traceOpen.value = true
  }
)

function openDrawer(drawer: DrawerName) {
  activeDrawer.value = activeDrawer.value === drawer ? null : drawer
}

function selectNode(nodeId: string) {
  selectedEdgeId.value = ''
  emit('update:activeNodeId', nodeId)
  activeDrawer.value = 'inspector'
}

function onNodeClick(event: NodeMouseEvent) {
  selectNode(event.node.id)
}

function onEdgeClick(event: EdgeMouseEvent) {
  selectedEdgeId.value = event.edge.id
  flowEdges.value = flowEdges.value.map((edge) => ({
    ...edge,
    selected: edge.id === event.edge.id,
    class: [edge.data?.branch === 'alt' ? 'alt' : '', edge.id === event.edge.id ? 'selected' : ''].filter(Boolean).join(' ')
  }))
}

function onPaneClick() {
  selectedEdgeId.value = ''
  flowEdges.value = flowEdges.value.map((edge) => ({
    ...edge,
    selected: false,
    class: edge.data?.branch === 'alt' ? 'alt' : ''
  }))
}

function onNodeDragStop(event: NodeDragEvent) {
  emit('updateNodePosition', event.node.id, {
    x: Math.round(event.node.position.x),
    y: Math.round(event.node.position.y)
  })
}

function onConnect(connection: Connection) {
  if (!connection.source || !connection.target) return
  emit('createEdge', {
    id: `e-${connection.source}-${connection.target}-${Date.now()}`,
    source: connection.source,
    target: connection.target
  })
}

function onEdgeUpdate(event: EdgeUpdateEvent) {
  if (!event.connection.source || !event.connection.target) return
  if (event.connection.source === event.connection.target) return
  const original = props.workflowEdges.find((edge) => edge.id === event.edge.id)
  emit('updateEdge', event.edge.id, {
    id: event.edge.id,
    source: event.connection.source,
    target: event.connection.target,
    branch: original?.branch
  })
}

function onNodesChange(changes: NodeChange[]) {
  changes.forEach((change) => {
    if (change.type === 'remove') emit('deleteNode', change.id)
  })
}

function onEdgesChange(changes: EdgeChange[]) {
  changes.forEach((change) => {
    if (change.type === 'remove') emit('deleteEdge', change.id)
  })
}

function toggleImmersive() {
  isImmersive.value = !isImmersive.value
  if (isImmersive.value) {
    activeDrawer.value = null
    traceOpen.value = false
  }
}

function zoomCanvasIn() {
  void zoomIn({ duration: 180 })
  emit('zoom', 10)
}

function zoomCanvasOut() {
  void zoomOut({ duration: 180 })
  emit('zoom', -10)
}

function resetCanvasZoom() {
  void zoomTo(1, { duration: 180 })
  emit('reset')
}

function fitCanvasView() {
  void fitView({ padding: 0.18, duration: 220 })
  emit('reset')
}

async function toggleNativeFullscreen() {
  if (!document.fullscreenElement) {
    await flowRoot.value?.requestFullscreen()
  } else {
    await document.exitFullscreen()
  }
}

function handleFullscreenChange() {
  isNativeFullscreen.value = document.fullscreenElement === flowRoot.value
  if (isNativeFullscreen.value) isImmersive.value = true
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    window.location.hash = 'home'
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
</script>

<template>
  <main ref="flowRoot" class="workflow-editor" :class="{ immersive: isImmersive, 'native-fullscreen': isNativeFullscreen }">
    <header class="workflow-toolbar">
      <div class="workflow-toolbar-left">
        <button class="toolbar-icon-button" aria-label="返回" @click="goBack">
          <ArrowLeft :size="18" />
        </button>
        <span class="workflow-mark"><Code2 :size="17" /></span>
        <div class="workflow-title-block">
          <h1>{{ workflowTitle }}</h1>
          <span><Code2 :size="13" /> ID {{ workflowId ?? 'local' }}</span>
        </div>
      </div>

      <div class="workflow-toolbar-center">
        <span class="backend-pill" :class="{ offline: !apiOnline }">
          <CheckCircle2 :size="15" /> {{ apiOnline ? '后端已连接' : '后端未连接' }} {{ savedAt }}
        </span>
      </div>

      <div class="workflow-toolbar-actions">
        <button :disabled="!hasWorkflow" @click="emit('save')"><Save :size="16" />保存</button>
        <button :disabled="!hasWorkflow" @click="emit('run')"><Play :size="16" />{{ workflowStatus === 'running' ? '运行中' : '运行' }}</button>
        <button :disabled="!hasWorkflow" @click="emit('export')"><Download :size="16" />导出</button>
        <button class="primary" @click="emit('share')"><Share2 :size="16" />分享</button>
        <button @click="toggleImmersive">
          <component :is="isImmersive ? Minimize2 : Maximize2" :size="16" />
          {{ isImmersive ? '退出全屏' : '全屏编辑' }}
        </button>
        <button @click="toggleNativeFullscreen">
          <Maximize2 :size="16" />
          {{ isNativeFullscreen ? '退出完全全屏' : '完全全屏' }}
        </button>
      </div>
    </header>

    <section v-if="!hasWorkflow" class="workflow-empty-state">
      <Sparkles :size="30" />
      <h2>暂无工作流，请先在工作台生成工作流</h2>
      <p>普通聊天不会自动套用财报模板；只有明确的工作流任务会生成并打开对应流程。</p>
    </section>

    <section v-else class="workflow-canvas-shell">
      <div class="workflow-canvas-surface">
        <div class="workflow-particles" aria-hidden="true">
          <span
            v-for="particle in particles"
            :key="particle.id"
            :style="{ left: particle.left, top: particle.top, animationDelay: particle.delay, animationDuration: particle.duration }"
          ></span>
        </div>

        <div class="canvas-action-rail">
          <button title="工具库" @click="openDrawer('toolbox')"><PanelLeftOpen :size="18" /></button>
          <button title="节点详情" :disabled="!selectedNode.id" @click="openDrawer('inspector')"><PanelRightOpen :size="18" /></button>
          <button title="执行轨迹" @click="traceOpen = !traceOpen"><ListTree :size="18" /></button>
          <button title="智能生成" @click="emit('generate')"><Sparkles :size="18" /></button>
        </div>

        <VueFlow
          :id="flowId"
          v-model:nodes="flowNodes"
          v-model:edges="flowEdges"
          class="tracemind-vue-flow"
          :fit-view-on-init="true"
          :default-viewport="{ x: 260, y: 140, zoom: 1 }"
          :min-zoom="0.35"
          :max-zoom="1.8"
          :nodes-draggable="true"
          :nodes-connectable="true"
          :elements-selectable="true"
          :connection-line-type="ConnectionLineType.SmoothStep"
          :delete-key-code="['Backspace', 'Delete']"
          :edge-updater-radius="16"
          @node-click="onNodeClick"
          @edge-click="onEdgeClick"
          @pane-click="onPaneClick"
          @node-drag-stop="onNodeDragStop"
          @connect="onConnect"
          @edge-update="onEdgeUpdate"
          @nodes-change="onNodesChange"
          @edges-change="onEdgesChange"
        >
          <Panel position="bottom-center" class="canvas-zoom-toolbar">
            <button title="放大" @click="zoomCanvasIn"><ZoomIn :size="17" /></button>
            <button title="缩小" @click="zoomCanvasOut"><ZoomOut :size="17" /></button>
            <button title="100%" @click="resetCanvasZoom"><RotateCcw :size="16" />100%</button>
            <button title="适配视图" @click="fitCanvasView"><Maximize2 :size="16" /></button>
          </Panel>

          <template #node-workflow="{ data }">
            <div class="flow-node-card" :class="[data.tone, data.status, { selected: activeNodeId === data.id }]">
              <Handle id="target" type="target" :position="Position.Left" class="flow-handle target" />
              <span class="node-status-dot"></span>
              <span class="node-title">
                <component :is="iconFor(data.icon)" :size="17" />
                {{ data.label }}
              </span>
              <span class="node-sub">{{ data.subLabel }}</span>
              <span class="node-tool">{{ data.displayName ?? data.toolName ?? data.tool }}</span>
              <Handle id="source" type="source" :position="Position.Right" class="flow-handle source" />
            </div>
          </template>
        </VueFlow>

        <div class="minimap">
          <div class="mini-content">
            <span v-for="node in workflowNodes" :key="node.id" :style="{ left: `${node.position.x / 7}px`, top: `${node.position.y / 7}px` }"></span>
          </div>
        </div>
      </div>

      <Transition name="drawer-left">
        <aside v-if="activeDrawer === 'toolbox'" class="workflow-drawer workflow-drawer-left">
          <div class="drawer-head">
            <div>
              <h2>工具库</h2>
              <p>节点从这里添加，画布始终保持为核心区域</p>
            </div>
            <button @click="activeDrawer = null"><X :size="18" /></button>
          </div>
          <div class="mini-tabs">
            <button :class="{ active: toolboxTab === 'nodes' }" @click="emit('update:toolboxTab', 'nodes')">节点</button>
            <button :class="{ active: toolboxTab === 'tools' }" @click="emit('update:toolboxTab', 'tools')">工具</button>
            <button :class="{ active: toolboxTab === 'variables' }" @click="emit('update:toolboxTab', 'variables')">变量</button>
          </div>
          <label class="search-box">
            <Search :size="16" />
            <input :value="paletteSearch" placeholder="搜索节点" @input="emit('update:paletteSearch', ($event.target as HTMLInputElement).value)" />
          </label>
          <p class="section-label">常用节点</p>
          <div class="palette-list">
            <button v-for="node in filteredPaletteNodes" :key="node.type" class="palette-card" @click="emit('addPaletteNode', node)">
              <span class="palette-icon" :class="node.tone">
                <component :is="iconFor(node.icon)" :size="19" />
              </span>
              <span>
                <strong>{{ node.label }}</strong>
                <small>{{ node.desc }}</small>
              </span>
            </button>
          </div>
          <button class="custom-node" @click="emit('addCustomNode')"><Plus :size="17" /> 添加自定义节点</button>
        </aside>
      </Transition>

      <Transition name="drawer-right">
        <aside v-if="activeDrawer === 'inspector'" class="workflow-drawer workflow-drawer-right">
          <div class="drawer-head">
            <div>
              <h2>{{ selectedNode.label || '节点详情' }}</h2>
              <p>{{ selectedNode.type || '-' }} / {{ statusLabel(selectedNodeStatus) }}</p>
            </div>
            <button @click="activeDrawer = null"><X :size="18" /></button>
          </div>

          <section class="node-overview-card">
            <div>
              <small>绑定工具</small>
              <strong>{{ currentToolName || '-' }}</strong>
            </div>
            <div>
              <small>显示工具</small>
              <strong>{{ selectedNode.displayName ?? currentToolName ?? '-' }}</strong>
            </div>
            <div>
              <small>状态</small>
              <span class="status-badge" :class="statusBadgeClass(selectedNodeStatus)">{{ statusLabel(selectedNodeStatus) }}</span>
            </div>
            <div>
              <small>耗时</small>
              <strong>{{ selectedNodeLatency }}</strong>
            </div>
            <div>
              <small>上游</small>
              <strong>{{ upstreamNodes.length }}</strong>
            </div>
            <div>
              <small>下游</small>
              <strong>{{ downstreamNodes.length }}</strong>
            </div>
            <div class="trace-flag">
              <small>真实 Trace</small>
              <strong>{{ hasTraceData ? '已有' : '暂无' }}</strong>
            </div>
          </section>

          <div class="inspector-tabs">
            <button :class="{ active: inspectorTab === 'config' }" @click="emit('update:inspectorTab', 'config')">配置</button>
            <button :class="{ active: inspectorTab === 'explain' }" @click="emit('update:inspectorTab', 'explain')">解释</button>
            <button :class="{ active: inspectorTab === 'io' }" @click="emit('update:inspectorTab', 'io')">输入输出</button>
            <button :class="{ active: inspectorTab === 'score' }" @click="emit('update:inspectorTab', 'score')">工具评分</button>
            <button :class="{ active: inspectorTab === 'test' }" @click="emit('update:inspectorTab', 'test')">测试</button>
          </div>
          <div class="inspector-body floating">
            <template v-if="inspectorTab === 'config'">
              <h3>节点配置</h3>
              <div class="field-grid">
                <span>节点 ID</span><b>{{ selectedNode.id || '-' }}</b>
                <span>节点类型</span><b>{{ selectedNode.type || '-' }}</b>
                <span>节点名称</span><b>{{ selectedNode.label || '-' }}</b>
                <span>子标题</span><b>{{ selectedNode.subLabel || '-' }}</b>
                <span>绑定工具名</span><b>{{ currentToolName || '-' }}</b>
                <span>显示工具名</span><b>{{ selectedNode.displayName ?? '-' }}</b>
                <span>状态</span><b>{{ statusLabel(selectedNodeStatus) }}</b>
                <span>置信度</span><b>{{ selectedNode.confidence?.toFixed?.(2) ?? '-' }}</b>
              </div>

              <h4>config JSON</h4>
              <div class="code-card">
                <pre>{{ formatJson(selectedNode.config ?? null) }}</pre>
              </div>

              <h4>上游节点</h4>
              <div v-if="upstreamNodes.length" class="node-link-list">
                <span v-for="node in upstreamNodes" :key="node.id">{{ node.label }} <small>{{ node.id }}</small></span>
              </div>
              <div v-else class="empty-state small">没有上游节点。</div>

              <h4>下游节点</h4>
              <div v-if="downstreamNodes.length" class="node-link-list">
                <span v-for="node in downstreamNodes" :key="node.id">{{ node.label }} <small>{{ node.id }}</small></span>
              </div>
              <div v-else class="empty-state small">没有下游节点。</div>
            </template>

            <template v-else-if="inspectorTab === 'explain'">
              <h3>节点解释</h3>
              <section class="inspector-section">
                <h4>为什么需要这个节点？</h4>
                <p v-if="selectedNode.reason">{{ selectedNode.reason }}</p>
                <div v-else class="empty-state small">后端暂未返回节点解释。</div>
              </section>

              <section class="inspector-section">
                <h4>为什么选择这个工具？</h4>
                <p>{{ selectedToolReason }}</p>
              </section>

              <section class="inspector-section">
                <h4>它在工作流中的作用</h4>
                <p>{{ workflowRoleText }}</p>
              </section>

              <section class="inspector-section">
                <h4>执行解释</h4>
                <template v-if="selectedTraceStep">
                  <p v-if="selectedTraceStep.reason">{{ selectedTraceStep.reason }}</p>
                  <p v-if="selectedTraceStep.inputSummary">输入摘要：{{ selectedTraceStep.inputSummary }}</p>
                  <p v-if="selectedTraceStep.outputSummary">输出摘要：{{ selectedTraceStep.outputSummary }}</p>
                  <p v-if="selectedTraceStep.errorMessage">错误信息：{{ selectedTraceStep.errorMessage }}</p>
                </template>
                <div v-else class="empty-state small">节点尚未执行，暂无执行解释。</div>
              </section>
            </template>

            <template v-else-if="inspectorTab === 'io'">
              <h3>输入输出</h3>
              <h4>输入摘要</h4>
              <p v-if="selectedTraceStep?.inputSummary || selectedNode.inputSummary">{{ selectedTraceStep?.inputSummary ?? selectedNode.inputSummary }}</p>
              <div v-else class="empty-state small">当前节点尚未执行或后端未返回输入摘要。</div>

              <h4>输入 JSON</h4>
              <div v-if="selectedNodeInput !== null" class="code-card">
                <pre>{{ formatJson(selectedNodeInput) }}</pre>
              </div>
              <div v-else class="empty-state small">当前节点尚未执行或后端未返回输入数据。</div>

              <h4>输出摘要</h4>
              <p v-if="selectedTraceStep?.outputSummary || selectedNode.outputSummary">{{ selectedTraceStep?.outputSummary ?? selectedNode.outputSummary }}</p>
              <div v-else class="empty-state small">当前节点尚未执行或后端未返回输出摘要。</div>

              <div v-if="highlightedOutput && (highlightedOutput.summary || highlightedOutput.markdown || highlightedOutput.downloadUrl)" class="output-highlights">
                <div v-if="highlightedOutput.summary"><small>summary</small><p>{{ highlightedOutput.summary }}</p></div>
                <div v-if="highlightedOutput.markdown"><small>markdown</small><pre>{{ highlightedOutput.markdown }}</pre></div>
                <div v-if="highlightedOutput.downloadUrl"><small>downloadUrl</small><a :href="highlightedOutput.downloadUrl" target="_blank">{{ highlightedOutput.downloadUrl }}</a></div>
              </div>

              <h4>输出 JSON</h4>
              <div v-if="selectedNodeOutput !== null" class="code-card">
                <pre>{{ formatJson(selectedNodeOutput) }}</pre>
              </div>
              <div v-else class="empty-state small">当前节点尚未执行或后端未返回输出数据。</div>
            </template>

            <template v-else-if="inspectorTab === 'score'">
              <h3>候选工具评分</h3>
              <div v-if="candidateToolRows.length" class="candidate-tool-list">
                <div v-for="tool in candidateToolRows" :key="tool.name" class="candidate-tool-card" :class="{ selected: tool.selected }">
                  <div>
                    <strong>{{ tool.name }}</strong>
                    <span>{{ tool.displayName }}</span>
                    <p>{{ tool.reason ?? '后端暂未返回该候选工具原因。' }}</p>
                  </div>
                  <b>{{ tool.scoreText }}</b>
                </div>
              </div>
              <div v-else class="empty-state small">当前节点没有返回候选工具评分。</div>

              <details v-if="relatedTools.length" class="global-tool-recommend">
                <summary>全局工具推荐</summary>
                <div class="tool-ranks compact">
                  <div v-for="tool in relatedTools" :key="tool.name">
                    <span>{{ tool.name }}</span>
                    <b>{{ tool.success ?? tool.score ?? '-' }}</b>
                  </div>
                </div>
              </details>
            </template>

            <template v-else-if="inspectorTab === 'test'">
              <h3>单节点测试</h3>
              <label class="node-test-editor">
                <span>测试输入 JSON</span>
                <textarea v-model="nodeTestInput" spellcheck="false"></textarea>
              </label>
              <button class="node-test-run" :disabled="nodeTestRunning || !workflowId || !selectedNode.id" @click="runNodeTest">
                {{ nodeTestRunning ? '运行中...' : '运行当前节点' }}
              </button>
              <div class="empty-state small">调用 POST /api/workflows/:workflowId/nodes/:nodeId/test，仅测试当前节点，不写入正式 Trace。</div>

              <h4>测试结果</h4>
              <div class="code-card"><pre>{{ nodeTestResult || '暂无测试结果。' }}</pre></div>
              <h4>错误区域</h4>
              <div class="code-card error"><pre>{{ nodeTestError || '暂无错误。' }}</pre></div>
            </template>

            <template v-else>
              <div class="empty-state small">请选择一个调试面板。</div>
            </template>
          </div>
        </aside>
      </Transition>
      <Transition name="drawer-bottom">
        <section v-if="traceOpen" class="workflow-trace-drawer" :class="{ 'with-right-drawer': hasRightDrawer }">
          <div class="trace-head">
            <h3>执行轨迹</h3>
            <span><CheckCircle2 :size="15" /> {{ traceStatusText }}</span>
            <button @click="traceOpen = false"><X :size="18" /></button>
          </div>
          <div class="trace-grid floating">
            <div class="timeline">
              <button
                v-for="step in traceSteps"
                :key="step.id"
                :class="[{ active: step.nodeId === activeNodeId }, `status-${step.status}`]"
                @click="step.nodeId && selectNode(step.nodeId)"
              >
                <component :is="traceIconFor(step.status)" :size="15" />
                <span>{{ step.stepName }}</span>
                <small>{{ step.time }}</small>
              </button>
            </div>
            <div class="trace-detail">
              <div class="trace-tabs">
                <button :class="{ active: traceTab === 'node' }" @click="emit('update:traceTab', 'node')">节点日志</button>
                <button :class="{ active: traceTab === 'input' }" @click="emit('update:traceTab', 'input')">输入数据</button>
                <button :class="{ active: traceTab === 'output' }" @click="emit('update:traceTab', 'output')">输出数据</button>
                <button :class="{ active: traceTab === 'detail' }" @click="emit('update:traceTab', 'detail')">执行详情</button>
              </div>
              <div class="detail-columns">
                <div>
                  <h4>执行信息</h4>
                  <p>显示工具：<b>{{ selectedNode.displayName ?? selectedNode.toolName ?? selectedNode.tool }}</b></p>
                  <p>执行工具：<b>{{ selectedNode.toolName ?? selectedNode.tool }}</b></p>
                  <p>执行状态：<span class="success-tag">{{ statusLabel(selectedNodeStatus) }}</span></p>
                  <p>开始时间：{{ selectedTraceStep?.time ?? '-' }}</p>
                  <p>结束时间：{{ workflowStatus === 'running' ? '-' : savedAt }}</p>
                  <p>执行时长：{{ selectedNodeLatency }}</p>
                </div>
                <div class="code-card">
                  <h4>执行结果</h4>
                  <pre>{{ traceTab === 'input' ? formatJson(selectedNodeInput ?? { query: workflowTitle, node: selectedNode.id }) : traceTab === 'detail' ? formatJson({ workflowId, status: selectedNodeStatus, apiOnline, toolName: selectedNode.toolName ?? selectedNode.tool }) : formatJson(selectedNodeOutput ?? runOutput) }}</pre>
                </div>
                <section v-if="webSearchTraceDetails" class="web-search-trace-card">
                  <h4>网页搜索详情</h4>
                  <div class="web-search-trace-grid">
                    <div><small>搜索 query</small><strong>{{ webSearchTraceDetails.query }}</strong></div>
                    <div><small>provider</small><strong>{{ webSearchTraceDetails.provider }}</strong></div>
                    <div><small>resultCount</small><strong>{{ webSearchTraceDetails.resultCount ?? '-' }}</strong></div>
                    <div><small>latencyMs</small><strong>{{ webSearchTraceDetails.latencyMs ?? '-' }}</strong></div>
                    <div><small>fallback</small><strong>{{ webSearchTraceDetails.fallback === null ? '-' : webSearchTraceDetails.fallback ? '是' : '否' }}</strong></div>
                  </div>
                  <div class="web-search-trace-sources">
                    <small>sources</small>
                    <a
                      v-for="source in webSearchTraceDetails.sources"
                      :key="source.url"
                      :href="source.url"
                      target="_blank"
                      rel="noopener noreferrer"
                    >{{ source.title }}</a>
                    <span v-if="!webSearchTraceDetails.sources.length">无来源</span>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </section>
      </Transition>
    </section>
  </main>
</template>

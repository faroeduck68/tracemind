<script setup lang="ts">
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Database,
  FileInput,
  Home,
  Maximize2,
  MoreVertical,
  Play,
  Plus,
  Save,
  Search,
  Share2,
  Sparkles,
  Upload,
  Workflow,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-vue-next'
import type { NodeStatus, PaletteNode, TraceStep, WorkflowEdge, WorkflowNode } from '../types'

defineProps<{
  workflowTitle: string
  workflowId: number | null
  workflowNodes: WorkflowNode[]
  workflowEdges: WorkflowEdge[]
  traceSteps: TraceStep[]
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
}>()
</script>

<template>
  <main class="main-workspace">
    <header class="topbar">
      <div class="title-wrap">
        <Workflow :size="18" />
        <h1>{{ workflowTitle }}</h1>
        <Code2 :size="15" />
      </div>
      <div class="top-actions">
        <div class="saved-pill"><CheckCircle2 :size="17" /> {{ apiOnline ? '后端已连接' : '后端未连接' }} {{ savedAt }}</div>
        <button @click="emit('save')"><Save :size="17" />{{ workflowStatus === 'saving' ? '保存中' : '保存' }}</button>
        <button @click="emit('run')"><Play :size="17" />{{ workflowStatus === 'running' ? '运行中' : '运行' }}</button>
        <button @click="emit('export')"><Upload :size="17" />导出</button>
        <button class="share" @click="emit('share')"><Share2 :size="17" />分享</button>
        <MoreVertical :size="20" class="muted-icon" />
        <div class="avatar">Z</div>
      </div>
    </header>

    <section class="studio">
      <aside class="toolbox panel">
        <h2>工具库</h2>
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

      <section class="canvas-column">
        <div class="canvas-tabs">
          <button :class="{ active: canvasMode === 'canvas' }" @click="emit('update:canvasMode', 'canvas')">工作流画布</button>
          <button :class="{ active: canvasMode === 'config' }" @click="emit('update:canvasMode', 'config')">流程配置</button>
        </div>

        <div class="canvas panel">
          <div class="canvas-toolbar">
            <button @click="emit('generate')"><Sparkles :size="17" /></button>
            <button @click="emit('zoom', 10)"><ZoomIn :size="16" /></button>
            <button @click="emit('zoom', -10)"><ZoomOut :size="16" /></button>
            <button @click="emit('reset')"><Maximize2 :size="16" /></button>
            <button @click="emit('addCustomNode')"><Plus :size="16" /></button>
            <span>{{ workflowZoom }}%</span>
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
            @click="emit('update:activeNodeId', node.id)"
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
            <button @click="emit('zoom', 10)">+</button>
            <button @click="emit('zoom', -10)">-</button>
            <button @click="emit('reset')"><Home :size="14" /></button>
            <button @click="emit('reset')"><Maximize2 :size="14" /></button>
          </div>
        </div>

        <section class="trace-panel panel">
          <div class="trace-head">
            <h3>执行轨迹</h3>
            <span><CheckCircle2 :size="15" /> {{ workflowStatus === 'running' ? '运行中' : workflowStatus === 'failed' ? '运行失败' : '运行完成' }}</span>
          </div>
          <div class="trace-grid">
            <div class="timeline">
              <button
                v-for="step in traceSteps"
                :key="step.id"
                :class="{ active: step.nodeId === activeNodeId }"
                @click="step.nodeId && emit('update:activeNodeId', step.nodeId)"
              >
                <CheckCircle2 :size="15" />
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
                  <p>工具名称：<b>{{ selectedNode.tool }}</b></p>
                  <p>执行状态：<span class="success-tag">{{ statusLabel(selectedTraceStep?.status ?? selectedNode.status) }}</span></p>
                  <p>开始时间：{{ selectedTraceStep?.time ?? '-' }}</p>
                  <p>结束时间：{{ workflowStatus === 'running' ? '-' : savedAt }}</p>
                  <p>执行时长：{{ selectedTraceStep?.latency ?? '-' }}</p>
                </div>
                <div class="code-card">
                  <h4>执行结果</h4>
                  <pre>{{ traceTab === 'input' ? JSON.stringify({ query: workflowTitle, node: selectedNode.id }, null, 2) : traceTab === 'detail' ? JSON.stringify({ workflowId, status: workflowStatus, apiOnline }, null, 2) : runOutput }}</pre>
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
            <button :class="{ active: inspectorTab === 'config' }" @click="emit('update:inspectorTab', 'config')">配置</button>
            <button :class="{ active: inspectorTab === 'explain' }" @click="emit('update:inspectorTab', 'explain')">解释</button>
            <button :class="{ active: inspectorTab === 'io' }" @click="emit('update:inspectorTab', 'io')">输入输出</button>
            <button :class="{ active: inspectorTab === 'test' }" @click="emit('update:inspectorTab', 'test')">测试</button>
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
              <button @click="emit('searchKnowledge')"><Database :size="16" /> {{ selectedKnowledgeBase?.name ?? '暂无知识库' }} <ChevronDown :size="14" /></button>
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
              <li>节点来自数据库中的工作流定义</li>
              <li>当前绑定工具：{{ selectedNode.tool }}</li>
              <li>数据库记录的置信度：{{ selectedNode.confidence.toFixed(2) }}</li>
              <li>运行后可在下方轨迹中查看真实 Trace</li>
            </ul>

            <h4>备选工具（Top 3）</h4>
            <div class="tool-ranks">
              <div v-for="tool in relatedTools" :key="tool.name">
                <span>{{ tool.name }}</span>
                <b>{{ tool.success }}</b>
              </div>
            </div>

            <h4>置信度 <strong class="confidence">{{ selectedNode.confidence.toFixed(2) }}</strong></h4>
            <div class="progress"><span :style="{ width: `${Math.round(selectedNode.confidence * 100)}%` }"></span></div>
          </div>
        </section>

        <section class="side-card panel">
          <div class="card-title">失败分析 <X :size="16" /></div>
          <div class="empty-failure">{{ runError || '暂无失败节点' }}</div>
        </section>
        <section class="side-card panel">
          <div class="card-title">优化建议</div>
          <p class="suggestion"><Check :size="16" /> 当前展示内容来自数据库接口</p>
          <p class="suggestion"><Check :size="16" /> 数据为空时不会展示本地示例数据</p>
        </section>
      </aside>
    </section>
  </main>
</template>

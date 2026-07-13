<script setup lang="ts">
import { computed } from 'vue'
import { Activity, ChevronDown, Clock3, GitBranch, Plus, Search } from 'lucide-vue-next'
import type { RunHistoryItem, WorkflowHistoryItem } from '../types'
import PaginationBar from './PaginationBar.vue'
import { usePagination } from '../composables/usePagination'

const props = defineProps<{
  activePage: string
  navItems: Array<{ id: string; label: string; icon: unknown; page: string }>
  conversations: Array<{
    id: string
    title?: string
    lastMessage?: string
    updatedAt?: string
    createdAt?: string
    messageCount?: number
  }>
  activeConversationId?: string | null
  workflowHistory: WorkflowHistoryItem[]
  runHistory: RunHistoryItem[]
  activeWorkflowId?: number | null
  activeRunId?: number | null
}>()

const conversationSource = computed(() => props.conversations)
const workflowSource = computed(() => props.workflowHistory)
const runSource = computed(() => props.runHistory)
const { page: conversationPage, pageSize: conversationPageSize, total: conversationTotal, paginatedItems: paginatedConversations, setPage: setConversationPage } = usePagination(conversationSource, 5)
const { page: workflowPage, pageSize: workflowPageSize, total: workflowTotal, paginatedItems: paginatedWorkflows, setPage: setWorkflowPage } = usePagination(workflowSource, 5)
const { page: runPage, pageSize: runPageSize, total: runTotal, paginatedItems: paginatedRuns, setPage: setRunPage } = usePagination(runSource, 5)

const emit = defineEmits<{
  (event: 'navigate', page: string): void
  (event: 'newConversation'): void
  (event: 'selectConversation', conversationId: string): void
  (event: 'selectWorkflow', workflowId: number): void
  (event: 'selectRun', runId: number): void
}>()

function formatHistoryTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function formatLatency(value?: number) {
  const ms = Number(value ?? 0)
  if (!Number.isFinite(ms) || ms <= 0) return '-'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

function statusText(status?: string | null) {
  if (status === 'success') return '成功'
  if (status === 'failed') return '失败'
  if (status === 'running') return '运行中'
  if (status === 'partial_success') return '部分成功'
  return status || '待执行'
}

function fileText(run: RunHistoryItem) {
  const names = (run.files ?? []).map((file) => file.originalName ?? file.filename).filter(Boolean)
  return names.length ? names.join('、') : run.summary || run.errorMessage || '暂无文件'
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="brand-mark"><span></span></span>
      <span>TraceMind</span>
    </div>
    <button class="new-chat" @click="emit('newConversation')">
      <Plus :size="18" />
      新建对话
    </button>

    <nav class="nav-list">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="nav-item"
        :class="{ active: item.page === activePage }"
        @click="emit('navigate', item.page)"
      >
        <component :is="item.icon" :size="19" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div class="history">
      <section class="history-section">
        <div class="history-title">
          <span>历史会话</span>
          <Clock3 :size="15" />
        </div>
        <div class="history-search">
          <Search :size="15" />
          <span>搜索历史会话</span>
        </div>
        <div v-if="!conversations.length" class="history-empty">暂无历史会话</div>
        <template v-else>
          <button
            v-for="conversation in paginatedConversations"
            :key="conversation.id"
            class="history-card"
            :class="{ active: conversation.id === activeConversationId }"
            @click="emit('selectConversation', conversation.id)"
          >
            <strong>{{ conversation.title || '新会话' }}</strong>
            <span>{{ conversation.lastMessage || '暂无消息' }}</span>
            <small>{{ formatHistoryTime(conversation.updatedAt || conversation.createdAt) }}</small>
          </button>
          <PaginationBar v-if="conversationTotal > conversationPageSize" compact :page="conversationPage" :page-size="conversationPageSize" :total="conversationTotal" @update:page="setConversationPage" />
        </template>
      </section>

      <section class="history-section">
        <div class="history-title">
          <span>工作流历史</span>
          <GitBranch :size="15" />
        </div>
        <div v-if="!workflowHistory.length" class="history-empty">暂无工作流</div>
        <template v-else>
          <button
            v-for="workflow in paginatedWorkflows"
            :key="workflow.id"
            class="history-card"
            :class="{ active: workflow.id === activeWorkflowId }"
            @click="emit('selectWorkflow', workflow.id)"
          >
            <strong>{{ workflow.name || `Workflow ${workflow.id}` }}</strong>
            <span>{{ workflow.workflowType || workflow.intent || 'workflow' }} · {{ workflow.nodeCount ?? 0 }} 节点</span>
            <small>
              <b :class="['history-status', workflow.latestRunStatus || workflow.status]">{{ statusText(workflow.latestRunStatus || workflow.status) }}</b>
              {{ formatHistoryTime(workflow.updatedAt || workflow.createdAt) }}
            </small>
          </button>
          <PaginationBar v-if="workflowTotal > workflowPageSize" compact :page="workflowPage" :page-size="workflowPageSize" :total="workflowTotal" @update:page="setWorkflowPage" />
        </template>
      </section>

      <section class="history-section">
        <div class="history-title">
          <span>运行历史</span>
          <Activity :size="15" />
        </div>
        <div v-if="!runHistory.length" class="history-empty">暂无运行记录</div>
        <template v-else>
          <button
            v-for="run in paginatedRuns"
            :key="run.id"
            class="history-card"
            :class="{ active: run.id === activeRunId }"
            @click="emit('selectRun', run.id)"
          >
            <strong>Run #{{ run.id }}</strong>
            <span>{{ run.workflowName || `Workflow ${run.workflowId}` }}</span>
            <span>{{ fileText(run) }}</span>
            <small>
              <b :class="['history-status', run.status]">{{ statusText(run.status) }}</b>
              {{ formatLatency(run.totalLatencyMs) }} · {{ formatHistoryTime(run.startedAt || run.finishedAt) }}
            </small>
          </button>
          <PaginationBar v-if="runTotal > runPageSize" compact :page="runPage" :page-size="runPageSize" :total="runTotal" @update:page="setRunPage" />
        </template>
      </section>
    </div>

    <button class="collapse-btn">
      <ChevronDown :size="17" />
      收起侧边栏
    </button>
  </aside>
</template>

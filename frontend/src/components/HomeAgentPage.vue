<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  Bot,
  ChartNoAxesCombined,
  CheckCircle2,
  Code2,
  FileText,
  ExternalLink,
  Globe2,
  Library,
  Maximize2,
  MessageSquarePlus,
  MoreVertical,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  Upload,
  X
} from 'lucide-vue-next'

const props = defineProps<{
  chatMessages: Array<{
    id: number
    role: 'user' | 'assistant'
    text: string
    time: string
    createdAt?: string
    sequence?: number
    workflowId?: number | null
    runId?: number | null
    sources?: Array<{ title: string; url: string }>
  }>
  agentInput: string
  conversationStatus: string
  conversationStartedAt: string
  conversationLatency: string
  conversationId: string
  totalTokens: number
  model: string
  uploadedFiles: Array<{
    fileId?: string | number
    id?: string | number
    filename: string
    originalName?: string
    filePath: string
    mimeType?: string
    size?: number
    status?: 'uploaded' | 'pending' | 'failed'
    error?: string
  }>
  uploading: boolean
}>()

const emit = defineEmits<{
  (event: 'update:agentInput', value: string): void
  (event: 'newConversation'): void
  (event: 'share'): void
  (event: 'generate'): void
  (event: 'send'): void
  (event: 'uploadFiles', files: FileList): void
  (event: 'clear'): void
  (event: 'navigate', page: 'workflow' | 'tools'): void
  (event: 'openWorkflow', payload: { workflowId?: number | null; runId?: number | null; targetPage?: 'workflow' | 'tools' }): void
}>()

const orderedMessages = computed(() =>
  [...props.chatMessages].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    if (timeA !== timeB) return timeA - timeB
    if ((a.sequence ?? 0) !== (b.sequence ?? 0)) return (a.sequence ?? 0) - (b.sequence ?? 0)
    return a.id - b.id
  })
)
const chatScrollRef = ref<HTMLElement | null>(null)

watch(
  orderedMessages,
  async () => {
    await nextTick()
    const el = chatScrollRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  },
  { deep: true, immediate: true }
)

function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) emit('uploadFiles', input.files)
  input.value = ''
}

function stripTechnicalInfo(text: string) {
  return text
    .split('\n')
    .filter((line) => !/^\s*(Workflow ID|Run ID)\b/i.test(line))
    .join('\n')
    .trim()
}

function renderMarkdown(text: string) {
  const lines = stripTechnicalInfo(text).replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inList = false

  const closeList = () => {
    if (inList) {
      html.push('</ul>')
      inList = false
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      closeList()
      continue
    }
    if (/^---+$/.test(trimmed)) {
      closeList()
      html.push('<hr>')
      continue
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      closeList()
      const level = Math.min(4, heading[1].length + 2)
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }
    const listItem = trimmed.match(/^[-*]\s+(.+)$/)
    if (listItem) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${renderInline(listItem[1])}</li>`)
      continue
    }
    closeList()
    html.push(`<p>${renderInline(trimmed)}</p>`)
  }

  closeList()
  return html.join('')
}

function renderInline(text: string) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
</script>

<template>
  <main class="agent-page">
    <header class="topbar">
      <div class="title-wrap">
        <Bot :size="18" />
        <h1>智能体工作台</h1>
        <Code2 :size="15" />
      </div>
      <div class="top-actions">
        <div class="saved-pill"><CheckCircle2 :size="17" /> {{ conversationStatus }}</div>
        <button @click="emit('newConversation')"><MessageSquarePlus :size="17" />新建会话</button>
        <label class="file-action">
          <Upload :size="17" />{{ uploading ? '上传中...' : '导入文件' }}
          <input type="file" multiple accept=".pdf,.txt,.md,.markdown,.csv" @change="handleFiles" />
        </label>
        <button class="share" @click="emit('share')"><Share2 :size="17" />分享</button>
        <MoreVertical :size="20" class="muted-icon" />
        <div class="avatar">Z</div>
      </div>
    </header>

    <section class="agent-shell">
      <header class="agent-top">
        <h1>Agent 工作台</h1>
        <span class="online-dot">在线</span>
        <div class="agent-actions">
          <button @click="emit('newConversation')"><MessageSquarePlus :size="15" /> 新建会话</button>
          <button @click="emit('generate')"><RefreshCw :size="15" /></button>
          <button><MoreVertical :size="15" /></button>
          <button><Maximize2 :size="15" /></button>
        </div>
      </header>

      <section class="agent-body">
        <div class="chat-pane">
          <div ref="chatScrollRef" class="chat-scroll">
            <div
              v-for="message in orderedMessages"
              :key="`${message.role}-${message.id}-${message.sequence ?? 0}`"
              class="message-row"
              :class="message.role"
            >
              <div v-if="message.role === 'user'" class="user-bubble">
                <p>{{ message.text }}</p>
                <small>{{ message.time }}</small>
                <div class="headshot"></div>
              </div>

              <div v-else class="assistant-message">
                <div class="assistant-bubble">
                  <div class="agent-icon"><Bot :size="17" /></div>
                  <div>
                    <strong>TraceMind Agent</strong>
                    <div class="assistant-markdown" v-html="renderMarkdown(message.text)"></div>
                    <section v-if="message.sources?.length" class="message-sources" aria-label="回答来源">
                      <div class="message-sources-title"><Globe2 :size="14" />来源</div>
                      <a
                        v-for="source in message.sources"
                        :key="source.url"
                        :href="source.url"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span>{{ source.title }}</span>
                        <small>{{ sourceHost(source.url) }}</small>
                        <ExternalLink :size="13" />
                      </a>
                    </section>
                    <details v-if="message.workflowId || message.runId" class="message-tech-info">
                      <summary>技术信息</summary>
                      <p v-if="message.workflowId">Workflow ID：{{ message.workflowId }}</p>
                      <p v-if="message.runId">Run ID：{{ message.runId }}</p>
                    </details>
                    <small>{{ message.time }}</small>
                  </div>
                </div>
                <div v-if="message.workflowId || message.runId" class="quick-actions">
                  <button v-if="message.workflowId" @click="emit('openWorkflow', { workflowId: message.workflowId, runId: message.runId, targetPage: 'workflow' })">
                    <FileText :size="14" /> 查看执行过程
                  </button>
                  <button v-if="message.runId" @click="emit('openWorkflow', { workflowId: message.workflowId, runId: message.runId, targetPage: 'tools' })">
                    <Library :size="14" /> 查看工具调用
                  </button>
                  <button v-if="message.runId" @click="emit('openWorkflow', { workflowId: message.workflowId, runId: message.runId, targetPage: 'workflow' })">
                    <ChartNoAxesCombined :size="14" /> 查看详细分析
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="chat-composer">
            <div v-if="uploadedFiles.length" class="uploaded-files">
              <span
                v-for="file in uploadedFiles"
                :key="file.fileId ?? file.filePath"
                class="uploaded-file-chip"
                :class="file.status ?? 'success'"
              >
                <b>{{ file.status === 'failed' ? '❌' : '✅' }} {{ file.filename }}</b>
                <small>{{ file.status === 'failed' ? `· 上传失败${file.error ? `：${file.error}` : ''}` : file.status === 'pending' ? '· 上传中' : '· 上传成功' }}</small>
              </span>
            </div>

            <div class="chat-input">
              <span v-if="uploadedFiles.length" class="file-count">已上传 {{ uploadedFiles.length }} 个文件</span>
              <input
                :value="agentInput"
                placeholder="输入普通问题会直接对话；上传文件或输入工作流任务会执行真实流程"
                @input="emit('update:agentInput', ($event.target as HTMLInputElement).value)"
                @keydown.enter="emit('send')"
              />
              <label class="inline-upload" :class="{ uploading }" title="上传文件">
                <Upload :size="15" />
                <input type="file" multiple accept=".pdf,.txt,.md,.markdown,.csv" :disabled="uploading" @change="handleFiles" />
              </label>
              <button type="button" title="智能生成" @click="emit('generate')"><Sparkles :size="15" /></button>
              <button type="button" class="send" title="发送" @click="emit('send')"><Send :size="16" /></button>
            </div>
          </div>
        </div>

        <aside class="conversation-info">
          <h3>会话信息</h3>
          <p><b>会话ID</b><span>{{ conversationId || '-' }}</span></p>
          <p><b>创建时间</b><span>{{ conversationStartedAt }}</span></p>
          <p><b>模型</b><span>{{ model }}</span></p>
          <p><b>状态</b><span class="green">{{ conversationStatus }}</span></p>
          <p><b>总耗时</b><span>{{ conversationLatency }}</span></p>
          <p><b>总用量</b><span>{{ totalTokens }}</span></p>
          <div class="quick-list">
            <h3>快速操作</h3>
            <button @click="emit('newConversation')"><MessageSquarePlus :size="15" /> 新建会话</button>
            <label class="quick-upload">
              <Upload :size="15" /> {{ uploading ? '上传中...' : '导入文件' }}
              <input type="file" multiple accept=".pdf,.txt,.md,.markdown,.csv" @change="handleFiles" />
            </label>
            <button @click="emit('clear')"><X :size="15" /> 清空对话</button>
          </div>
        </aside>
      </section>
    </section>
  </main>
</template>

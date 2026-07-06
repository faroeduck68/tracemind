<script setup lang="ts">
import {
  Bot,
  ChartNoAxesCombined,
  CheckCircle2,
  Code2,
  FileText,
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

defineProps<{
  chatMessages: Array<{ id: number; role: 'user' | 'assistant'; text: string; time: string }>
  agentInput: string
  conversationStatus: string
  conversationStartedAt: string
  conversationLatency: string
  model: string
}>()

const emit = defineEmits<{
  (event: 'update:agentInput', value: string): void
  (event: 'newConversation'): void
  (event: 'share'): void
  (event: 'generate'): void
  (event: 'send'): void
  (event: 'clear'): void
  (event: 'navigate', page: 'workflow' | 'tools'): void
}>()
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
        <button><Upload :size="17" />导入文件</button>
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
          <div v-for="message in chatMessages.filter((item) => item.role === 'user')" :key="message.id" class="user-bubble">
            <div class="headshot"></div>
            <p>{{ message.text }}</p>
            <small>{{ message.time }}</small>
          </div>
          <div v-for="message in chatMessages.filter((item) => item.role === 'assistant')" :key="message.id" class="assistant-bubble">
            <div class="agent-icon"><Bot :size="17" /></div>
            <div>
              <strong>TraceMind Agent</strong>
              <p v-for="line in message.text.split('\n').filter(Boolean)" :key="line">{{ line }}</p>
              <small>{{ message.time }}</small>
            </div>
          </div>
          <div class="quick-actions">
            <button @click="emit('navigate', 'workflow')"><FileText :size="14" /> 查看执行过程</button>
            <button @click="emit('navigate', 'tools')"><Library :size="14" /> 查看工具调用</button>
            <button @click="emit('generate')"><ChartNoAxesCombined :size="14" /> 查看详细分析</button>
          </div>
          <label class="chat-input">
            <input
              :value="agentInput"
              placeholder="输入你的问题，或使用 / 触发快捷指令"
              @input="emit('update:agentInput', ($event.target as HTMLInputElement).value)"
              @keydown.enter="emit('send')"
            />
            <button @click="emit('generate')"><Sparkles :size="15" /></button>
            <button class="send" @click="emit('send')"><Send :size="16" /></button>
          </label>
        </div>

        <aside class="conversation-info">
          <h3>会话信息</h3>
          <p><b>会话ID</b><span>{{ chatMessages.length ? `conv_${chatMessages[0].id}` : '-' }}</span></p>
          <p><b>创建时间</b><span>{{ conversationStartedAt }}</span></p>
          <p><b>模型</b><span>{{ model }}</span></p>
          <p><b>状态</b><span class="green">{{ conversationStatus }}</span></p>
          <p><b>总耗时</b><span>{{ conversationLatency }}</span></p>
          <p><b>总用量</b><span>{{ chatMessages.length ? chatMessages.length * 384 : 0 }}</span></p>
          <div class="quick-list">
            <h3>快速操作</h3>
            <button @click="emit('newConversation')"><MessageSquarePlus :size="15" /> 新建会话</button>
            <button><Upload :size="15" /> 导入文件</button>
            <button @click="emit('clear')"><X :size="15" /> 清空对话</button>
          </div>
        </aside>
      </section>
    </section>
  </main>
</template>

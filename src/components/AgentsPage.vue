<script setup lang="ts">
import {
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  FileText,
  Library,
  MessageSquarePlus,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  TrendingUp,
  Upload
} from 'lucide-vue-next'

defineProps<{
  agentSearch: string
  agentCards: any[]
  filteredAgents: any[]
  selectedAgent?: any
  selectedAgentName: string
  agentAvgSuccess: string
  agentTotalCalls: string
  recentTasks: any[]
}>()

const emit = defineEmits<{
  (event: 'update:agentSearch', value: string): void
  (event: 'createAgent'): void
  (event: 'navigate', page: 'workflow' | 'template' | 'home'): void
  (event: 'selectAgent', agent: any): void
  (event: 'enterAgent', agent: any): void
  (event: 'switchAgent'): void
  (event: 'notify', message: string): void
}>()
</script>

<template>
  <main class="agents-page">
    <header class="topbar">
      <div class="title-wrap">
        <Bot :size="18" />
        <h1>智能体</h1>
        <span class="online-dot">在线</span>
      </div>
      <div class="top-actions">
        <button class="share" @click="emit('createAgent')"><Plus :size="17" />创建智能体</button>
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
            <button class="primary" @click="emit('createAgent')"><Plus :size="17" /> 新建智能体</button>
            <button @click="emit('navigate', 'workflow')"><TimerReset :size="17" /> 查看运行记录</button>
            <button @click="emit('navigate', 'template')"><Library :size="17" /> 智能体市场</button>
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
          <strong>{{ agentCards.length }} <small>个</small></strong>
          <p>较昨日 +0 <TrendingUp :size="13" /></p>
          <svg viewBox="0 0 180 44"><path d="M2 32 C20 38 26 26 42 31 S65 39 80 28 101 37 116 24 135 30 148 18 165 15 178 8" /></svg>
        </section>
        <section class="metric-card panel">
          <div class="metric-top"><span>在线运行中</span><span class="metric-icon green"><TimerReset :size="20" /></span></div>
          <strong>{{ agentCards.filter((agent) => agent.online).length }} <small>个</small></strong>
          <p>较昨日 +0 <TrendingUp :size="13" /></p>
          <svg class="green-line" viewBox="0 0 180 44"><path d="M2 25 C18 20 27 34 42 29 S61 18 78 31 101 34 116 12 134 19 148 13 164 18 178 6" /></svg>
        </section>
        <section class="metric-card panel">
          <div class="metric-top"><span>平均成功率</span><span class="metric-icon violet"><ShieldCheck :size="20" /></span></div>
          <strong>{{ agentAvgSuccess }} <small>%</small></strong>
          <p>来自数据库工作流置信度 <TrendingUp :size="13" /></p>
          <svg class="violet-line" viewBox="0 0 180 44"><path d="M2 35 C18 39 23 12 39 20 S62 33 78 22 101 30 117 23 136 27 150 20 166 13 178 7" /></svg>
        </section>
        <section class="metric-card panel">
          <div class="metric-top"><span>日均调用量</span><span class="metric-icon amber"><BarChart3 :size="20" /></span></div>
          <strong>{{ agentTotalCalls }} <small>次</small></strong>
          <p>来自数据库记录 <TrendingUp :size="13" /></p>
          <svg class="amber-line" viewBox="0 0 180 44"><path d="M2 33 C18 28 28 36 44 29 S66 14 82 24 101 38 117 19 137 25 151 14 164 17 178 5" /></svg>
        </section>
      </div>

      <section class="agents-list panel">
        <div class="agents-list-head">
          <h3>我的智能体</h3>
          <div>
            <button>全部状态 <ChevronDown :size="14" /></button>
            <button>全部角色 <ChevronDown :size="14" /></button>
            <label><Search :size="15" /><input :value="agentSearch" placeholder="搜索智能体名称或描述" @input="emit('update:agentSearch', ($event.target as HTMLInputElement).value)" /></label>
          </div>
        </div>
        <div class="agent-card-grid">
          <article v-for="agent in filteredAgents" :key="agent.name" class="agent-manage-card" :class="{ featured: agent.name === selectedAgentName }" @click="emit('selectAgent', agent)">
            <div class="agent-card-top">
              <span class="agent-card-icon" :class="agent.tone"><component :is="agent.icon" :size="30" /></span>
              <div>
                <h4>{{ agent.name }} <small>{{ agent.tag }}</small></h4>
                <p>{{ agent.description ?? agent.tag ?? '数据库暂无智能体描述' }}</p>
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
              <button @click.stop="emit('enterAgent', agent)">进入</button>
              <button class="ghost" @click.stop="emit('notify', `${agent.name} 已选中，可继续编辑`)">编辑</button>
              <button class="dots">...</button>
            </div>
          </article>
        </div>
      </section>

      <aside class="agent-detail panel">
        <div class="detail-title">
          <h3>智能体详情</h3>
          <button @click="emit('switchAgent')">切换智能体 <ChevronDown :size="14" /></button>
        </div>
        <div class="detail-agent-head">
          <span class="agent-card-icon" :class="selectedAgent?.tone ?? 'green'"><component :is="selectedAgent?.icon ?? FileText" :size="34" /></span>
          <div>
            <h4>{{ selectedAgent?.name }} <small>{{ selectedAgent?.tag }}</small></h4>
            <p><span class="online-dot">{{ selectedAgent?.online ? '在线' : '离线' }}</span></p>
          </div>
        </div>
        <p class="detail-desc">{{ selectedAgent?.tag ?? '数据库暂无智能体数据' }}</p>
        <div class="detail-kv">
          <span>模型</span><b>{{ selectedAgent?.model }}</b>
          <span>工具</span><b>{{ selectedAgent?.tools }} 个工具</b>
        </div>
        <div class="tool-chip-row">
          <span v-for="tone in ['violet','amber','blue','cyan','green']" :key="tone" :class="tone"></span>
          <small>+{{ Math.max(0, Number(selectedAgent?.tools ?? 0) - 5) }}</small>
        </div>
        <div class="recent-task-head">
          <h4>最近任务</h4>
          <button>查看全部</button>
        </div>
        <div class="recent-task" v-for="task in recentTasks" :key="task.name">
          <FileText :size="15" />
          <span>{{ task.name }}</span>
          <small>{{ task.time }}</small>
          <b>{{ task.status }}</b>
        </div>
      </aside>
    </section>
  </main>
</template>

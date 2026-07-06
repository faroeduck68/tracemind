<script setup lang="ts">
import { ChevronDown, Eye, Gauge, MoreHorizontal, Plus, RefreshCw, Search, TrendingUp } from 'lucide-vue-next'

defineProps<{
  toolSearch: string
  toolStats: any[]
  toolCategories: string[]
  activeToolCategory: string
  activeToolStatus: string
  filteredTools: any[]
}>()

const emit = defineEmits<{
  (event: 'update:toolSearch', value: string): void
  (event: 'update:activeToolCategory', value: string): void
  (event: 'cycleToolStatus'): void
  (event: 'refresh'): void
  (event: 'notify', message: string): void
  (event: 'toggleTool', tool: any): void
}>()
</script>

<template>
  <main class="tools-page">
    <header class="tools-header">
      <div>
        <h1>工具库</h1>
        <p>管理和配置智能体可调用的工具，支持工具的启用、禁用与监控</p>
      </div>
      <div class="tools-actions">
        <label><Search :size="16" /><input :value="toolSearch" placeholder="搜索工具名称或描述..." @input="emit('update:toolSearch', ($event.target as HTMLInputElement).value)" /></label>
        <button class="template-create" @click="emit('notify', '添加工具表单将在下一版开放')"><Plus :size="17" />添加工具</button>
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
          <button v-for="category in toolCategories" :key="category" :class="{ active: activeToolCategory === category }" @click="emit('update:activeToolCategory', category)">{{ category }}</button>
        </div>
        <div class="tools-filter">
          <button @click="emit('cycleToolStatus')">{{ activeToolStatus }} <ChevronDown :size="14" /></button>
          <button>默认排序 <ChevronDown :size="14" /></button>
          <button @click="emit('refresh')"><RefreshCw :size="15" />刷新</button>
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
        <article v-for="tool in filteredTools" :key="tool.name" class="tools-row">
          <div class="tool-name-cell">
            <span :class="['tool-row-icon', tool.tone]"><component :is="tool.icon" :size="22" /></span>
            <div><strong>{{ tool.name }}</strong><small>{{ tool.version }}</small></div>
          </div>
          <span class="tool-type">{{ tool.type }}</span>
          <p>{{ tool.desc }}</p>
          <div class="tool-status">
            <span class="toggle" :class="{ off: !tool.enabled }" @click="emit('toggleTool', tool)"></span>
            <b>{{ tool.enabled ? '启用' : '禁用' }}</b>
          </div>
          <span class="tool-success">{{ tool.success }} <TrendingUp v-if="tool.trend === 'up'" :size="13" /><span v-else class="down">↓</span></span>
          <span>{{ tool.latency }}</span>
          <span>{{ tool.calls }}</span>
          <div class="tool-actions">
            <button @click="emit('notify', `${tool.name}：${tool.desc}`)"><Eye :size="15" /></button>
            <button @click="emit('toggleTool', tool)"><Gauge :size="15" /></button>
            <button><MoreHorizontal :size="15" /></button>
          </div>
        </article>
      </section>

      <div class="tools-pagination">
        <span>共 {{ filteredTools.length }} 条工具</span>
        <div><button disabled><ChevronDown :size="14" /></button><button class="active">1</button><button>2</button><button>3</button><button><ChevronDown :size="14" /></button><button>10 条/页 <ChevronDown :size="14" /></button></div>
      </div>
    </section>
  </main>
</template>

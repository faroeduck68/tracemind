<script setup lang="ts">
import { Bot, Calendar, Clock, FileText, Heart, Info, Layers3, Plus, Search, Target } from 'lucide-vue-next'

defineProps<{
  memorySearch: string
  activeMemoryType: string
  memoryStats: any[]
  filteredMemories: any[]
  selectedMemory?: any
  memoryRefs: any[]
}>()

const emit = defineEmits<{
  (event: 'update:memorySearch', value: string): void
  (event: 'update:activeMemoryType', value: string): void
  (event: 'addMemory'): void
  (event: 'selectMemory', item: any): void
}>()
</script>

<template>
  <main class="memory-page">
    <header class="memory-header">
      <div>
        <h1>记忆中心</h1>
        <p>管理用户偏好、任务历史与工具习惯，帮助智能体更好地理解你</p>
      </div>
      <div class="memory-actions">
        <label><Search :size="17" /><input :value="memorySearch" placeholder="搜索记忆..." @input="emit('update:memorySearch', ($event.target as HTMLInputElement).value)" /></label>
        <button class="template-create" @click="emit('addMemory')"><Plus :size="17" />新增记忆</button>
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
        <button v-for="type in ['全部', '偏好记忆', '任务历史', '工具习惯']" :key="type" :class="{ active: activeMemoryType === type }" @click="emit('update:activeMemoryType', type)">{{ type }}</button>
      </div>

      <section class="memory-main">
        <div class="memory-list">
          <article v-for="item in filteredMemories" :key="item.title" class="memory-item panel" :class="{ active: item.active }" @click="emit('selectMemory', item)">
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
          <p class="memory-count">共 {{ filteredMemories.length }} 条记忆</p>
        </div>

        <aside class="memory-detail">
          <section class="memory-detail-card panel">
            <div class="memory-detail-title">
              <span :class="['memory-icon', selectedMemory?.tone ?? 'pink']"><component :is="selectedMemory?.icon ?? Heart" :size="22" /></span>
              <h2>{{ selectedMemory?.title }}</h2>
              <b>{{ selectedMemory?.level }}</b>
            </div>
            <div class="memory-kv">
              <span><Target :size="16" />记忆类型</span><strong>{{ selectedMemory?.type }}</strong>
              <span><Info :size="16" />重要性</span><strong><b class="level">{{ selectedMemory?.level }}</b></strong>
              <span><Bot :size="16" />来源任务</span><strong>{{ selectedMemory?.sourceType ?? '-' }}</strong>
              <span><Calendar :size="16" />首次记录</span><strong>{{ selectedMemory?.createdAt ?? '-' }}</strong>
              <span><Clock :size="16" />最后更新</span><strong>{{ selectedMemory?.updated }}</strong>
              <span><FileText :size="16" />详细描述</span>
              <p>{{ selectedMemory?.desc }}</p>
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
</template>

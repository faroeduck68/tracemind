<script setup lang="ts">
import { computed, watch } from 'vue'
import { ChevronDown, Eye, FileText, Filter, Heart, Plus, Search, Star, User } from 'lucide-vue-next'
import PaginationBar from './PaginationBar.vue'
import { usePagination } from '../composables/usePagination'

const props = defineProps<{
  templateSearch: string
  templateStats: any[]
  templateCategories: string[]
  activeTemplateCategory: string
  filteredTemplates: any[]
}>()

const templateSource = computed(() => props.filteredTemplates)
const {
  page: templatePage,
  pageSize: templatePageSize,
  total: templateTotal,
  paginatedItems: paginatedTemplates,
  setPage: setTemplatePage,
  setPageSize: setTemplatePageSize,
  resetPage: resetTemplatePage
} = usePagination(templateSource, 6)

watch(() => [props.templateSearch, props.activeTemplateCategory], resetTemplatePage)

const emit = defineEmits<{
  (event: 'update:templateSearch', value: string): void
  (event: 'update:activeTemplateCategory', value: string): void
  (event: 'notify', message: string): void
  (event: 'toggleTemplateStar', item: any): void
  (event: 'useTemplate', item: any): void
  (event: 'createBlank'): void
}>()
</script>

<template>
  <main class="template-page">
    <header class="template-header">
      <div>
        <h1>模板库</h1>
        <p>从模板快速开始，或创建你自己的模板</p>
      </div>
      <div class="template-header-actions">
        <label class="template-search"><Search :size="16" /><input :value="templateSearch" placeholder="搜索模板..." @input="emit('update:templateSearch', ($event.target as HTMLInputElement).value)" /></label>
        <button class="template-create" @click="emit('notify', '创建模板表单将在下一版开放')"><Plus :size="17" />创建模板</button>
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
          <button v-for="category in templateCategories" :key="category" :class="{ active: activeTemplateCategory === category }" @click="emit('update:activeTemplateCategory', category)">{{ category }}</button>
        </div>
        <div class="template-sort">
          <button>排序：最新 <ChevronDown :size="14" /></button>
          <button><Filter :size="15" />筛选</button>
        </div>
      </div>

      <section class="template-grid">
        <article v-for="item in paginatedTemplates" :key="item.title" class="template-card panel" @dblclick="emit('useTemplate', item)">
          <div class="template-card-head">
            <span v-if="item.badge" :class="['template-badge', item.badgeTone]">{{ item.badge }}</span>
            <button :class="{ starred: item.starred }" @click.stop="emit('toggleTemplateStar', item)"><Star :size="17" /></button>
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
          <button @click="emit('createBlank')"><Plus :size="30" /></button>
          <h3>创建新模板</h3>
          <p>从空白模板开始，创建你自己的工作流模板</p>
          <button class="template-create" @click="emit('createBlank')">开始创建</button>
        </article>
      </section>

      <PaginationBar
        :page="templatePage"
        :page-size="templatePageSize"
        :total="templateTotal"
        item-label="个模板"
        @update:page="setTemplatePage"
        @update:page-size="setTemplatePageSize"
      />
    </section>
  </main>
</template>

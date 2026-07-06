<script setup lang="ts">
import { ChevronDown, Clock3, Plus, Search } from 'lucide-vue-next'

defineProps<{
  activePage: string
  navItems: Array<{ id: string; label: string; icon: unknown; page: string }>
}>()

const emit = defineEmits<{
  (event: 'navigate', page: string): void
}>()
</script>

<template>
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
        @click="emit('navigate', item.page)"
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
      <div class="history-empty">暂无数据库历史会话</div>
    </div>

    <button class="collapse-btn">
      <ChevronDown :size="17" />
      收起侧边栏
    </button>
  </aside>
</template>

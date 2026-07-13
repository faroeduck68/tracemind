<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  page: number
  pageSize: number
  total: number
  pageSizeOptions?: number[]
  itemLabel?: string
  compact?: boolean
}>(), {
  pageSizeOptions: () => [5, 10, 20],
  itemLabel: '条记录',
  compact: false
})

const emit = defineEmits<{
  (event: 'update:page', value: number): void
  (event: 'update:pageSize', value: number): void
}>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const visiblePages = computed(() => {
  const start = Math.max(1, Math.min(props.page - 2, totalPages.value - 4))
  const end = Math.min(totalPages.value, start + 4)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

function updatePageSize(event: Event) {
  emit('update:pageSize', Number((event.target as HTMLSelectElement).value))
}
</script>

<template>
  <nav class="pagination-bar" :class="{ compact }" aria-label="分页导航">
    <template v-if="compact">
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <div class="pagination-controls">
        <button title="上一页" aria-label="上一页" :disabled="page <= 1" @click="emit('update:page', page - 1)"><ChevronLeft :size="14" /></button>
        <button title="下一页" aria-label="下一页" :disabled="page >= totalPages" @click="emit('update:page', page + 1)"><ChevronRight :size="14" /></button>
      </div>
    </template>
    <template v-else>
    <span>共 {{ total }} {{ itemLabel }}</span>
    <div class="pagination-controls">
      <label>
        <span>每页</span>
        <select :value="pageSize" @change="updatePageSize">
          <option v-for="option in pageSizeOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>
      <button title="上一页" aria-label="上一页" :disabled="page <= 1" @click="emit('update:page', page - 1)"><ChevronLeft :size="15" /></button>
      <button v-for="pageNumber in visiblePages" :key="pageNumber" :class="{ active: pageNumber === page }" :aria-current="pageNumber === page ? 'page' : undefined" @click="emit('update:page', pageNumber)">{{ pageNumber }}</button>
      <button title="下一页" aria-label="下一页" :disabled="page >= totalPages" @click="emit('update:page', page + 1)"><ChevronRight :size="15" /></button>
    </div>
    </template>
  </nav>
</template>

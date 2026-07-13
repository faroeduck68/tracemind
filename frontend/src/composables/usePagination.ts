import { computed, ref, watch, type ComputedRef } from 'vue'

export function usePagination<T>(source: ComputedRef<T[]> | (() => T[]), defaultPageSize = 6) {
  const page = ref(1)
  const pageSize = ref(defaultPageSize)
  const items = computed(() => typeof source === 'function' ? source() : source.value)
  const total = computed(() => items.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  const paginatedItems = computed(() => {
    const offset = (page.value - 1) * pageSize.value
    return items.value.slice(offset, offset + pageSize.value)
  })

  watch(totalPages, (value) => {
    if (page.value > value) page.value = value
  })

  function setPage(value: number) {
    page.value = Math.min(Math.max(Math.trunc(value) || 1, 1), totalPages.value)
  }

  function setPageSize(value: number) {
    pageSize.value = Math.max(Math.trunc(value) || defaultPageSize, 1)
    page.value = 1
  }

  function resetPage() {
    page.value = 1
  }

  return { page, pageSize, total, totalPages, paginatedItems, setPage, setPageSize, resetPage }
}

<script setup lang="ts">
import { onErrorCaptured, ref, watch } from 'vue'
import { AlertTriangle, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{
  resetKey: string | number
}>()

const emit = defineEmits<{
  (event: 'error', message: string): void
}>()

const errorMessage = ref('')

watch(
  () => props.resetKey,
  () => {
    errorMessage.value = ''
  }
)

onErrorCaptured((error) => {
  const message = error instanceof Error ? error.message : String(error)
  errorMessage.value = message
  emit('error', message)
  console.error(error)
  return false
})

function retry() {
  errorMessage.value = ''
}
</script>

<template>
  <slot v-if="!errorMessage" />
  <main v-else class="page-error-state">
    <div class="page-error-panel">
      <AlertTriangle :size="24" />
      <h1>页面渲染失败</h1>
      <p>{{ errorMessage }}</p>
      <button @click="retry">
        <RefreshCw :size="16" />
        重新加载当前页面
      </button>
    </div>
  </main>
</template>

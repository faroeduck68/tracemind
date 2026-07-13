<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: string
  options: string[]
  compact?: boolean
}>(), {
  compact: false
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const root = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const activeIndex = ref(0)

const selectedLabel = computed(() => props.modelValue || props.options[0] || '暂无可选项')

function syncActiveIndex() {
  const index = props.options.findIndex((option) => option === props.modelValue)
  activeIndex.value = index >= 0 ? index : 0
}

function open() {
  if (!props.options.length) return
  syncActiveIndex()
  isOpen.value = true
}

function close() {
  isOpen.value = false
}

function toggle() {
  if (isOpen.value) {
    close()
    return
  }
  open()
}

function selectOption(option: string) {
  emit('update:modelValue', option)
  close()
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) {
    close()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.options.length) return

  if (event.key === 'Escape') {
    close()
    return
  }

  if (event.key === 'Tab') {
    close()
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!isOpen.value) open()
    activeIndex.value = Math.min(activeIndex.value + 1, props.options.length - 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (!isOpen.value) open()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (!isOpen.value) {
      open()
      return
    }
    selectOption(props.options[activeIndex.value])
  }
}

watch(() => props.modelValue, syncActiveIndex)
watch(() => props.options, syncActiveIndex, { immediate: true })

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<template>
  <div ref="root" class="animated-select" :class="{ small: compact, open: isOpen }" @keydown="handleKeydown">
    <button
      type="button"
      class="setting-select"
      :class="{ small: compact, open: isOpen }"
      :disabled="!options.length"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <span>{{ selectedLabel }}</span>
      <ChevronDown class="select-chevron" :class="{ open: isOpen }" :size="16" />
    </button>

    <Transition name="select-pop">
      <div v-if="isOpen" class="setting-select-menu" role="listbox">
        <button
          v-for="(option, index) in options"
          :key="option"
          type="button"
          class="setting-select-option"
          :class="{ active: option === modelValue, focused: index === activeIndex }"
          role="option"
          :aria-selected="option === modelValue"
          @mouseenter="activeIndex = index"
          @click="selectOption(option)"
        >
          <span>{{ option }}</span>
          <Check v-if="option === modelValue" :size="15" />
        </button>
      </div>
    </Transition>
  </div>
</template>

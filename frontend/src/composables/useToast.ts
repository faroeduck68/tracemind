import { ref } from 'vue'

export function useToast(timeoutMs = 2200) {
  const toastMessage = ref('')

  function notify(message: string) {
    toastMessage.value = message
    window.setTimeout(() => {
      if (toastMessage.value === message) toastMessage.value = ''
    }, timeoutMs)
  }

  return {
    toastMessage,
    notify
  }
}

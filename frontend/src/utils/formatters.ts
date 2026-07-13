export function timeNow() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export function shortDate(value?: string) {
  if (!value) return '刚刚'
  return value.slice(0, 10)
}

export function formatMs(value: unknown) {
  const ms = Number(value ?? 0)
  if (!Number.isFinite(ms) || ms <= 0) return '0 ms'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`
}

export function formatFileSize(value: unknown) {
  const bytes = Number(value ?? 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return '-'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${Math.round(bytes)} B`
}

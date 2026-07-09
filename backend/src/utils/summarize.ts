// 从任意数据派生一段简短的可读摘要，用于 Trace 的 inputSummary / outputSummary。
export function summarize(data: unknown, maxLength = 120): string | undefined {
  if (data == null) return undefined

  if (typeof data === 'string') return truncate(data, maxLength)
  if (typeof data === 'number' || typeof data === 'boolean') return String(data)

  if (Array.isArray(data)) {
    return truncate(`共 ${data.length} 项：${data.map((item) => shallow(item)).join('，')}`, maxLength)
  }

  if (typeof data === 'object') {
    const record = data as Record<string, unknown>

    // 优先挑选一些语义化字段作为摘要。
    for (const key of ['summary', 'message', 'markdown', 'text', 'downloadUrl', 'intent', 'riskLevel']) {
      if (typeof record[key] === 'string') return truncate(record[key] as string, maxLength)
    }

    const keys = Object.keys(record)
    return truncate(`字段：${keys.join('、')}`, maxLength)
  }

  return undefined
}

function shallow(value: unknown): string {
  if (value == null) return 'null'
  if (typeof value === 'object') return Array.isArray(value) ? `[${value.length}]` : '{…}'
  return String(value)
}

function truncate(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized
}

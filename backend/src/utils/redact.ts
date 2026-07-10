const SENSITIVE_KEY_PATTERN = /(^|_|\b)(api[-_]?key|key|token|secret|password|authorization|auth)(\b|_|$)/i

export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[RedactedDepth]'
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, depth + 1))
  if (!value || typeof value !== 'object') return redactString(value)

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '***' : redactSecrets(item, depth + 1)
    ])
  )
}

function redactString(value: unknown) {
  if (typeof value !== 'string') return value
  if (value.startsWith('plain:')) return 'plain:***'
  return value
}

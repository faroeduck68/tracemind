export function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? null)
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value === 'object') return value as T
  if (typeof value !== 'string') return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

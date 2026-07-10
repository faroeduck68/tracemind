import dns from 'dns/promises'
import net from 'net'
import { env } from '../config/env'
import { ToolRow } from '../models/tool.model'
import { parseJson } from '../utils/json'
import { readUserSecretValue } from './userSecret.service'

type HttpToolConfig = {
  method?: string
  endpoint?: string
  headers?: Record<string, unknown>
  queryParams?: Record<string, unknown>
  bodyTemplate?: unknown
  inputMapping?: Record<string, string>
  outputMapping?: Record<string, string>
}

type AuthConfig = {
  type?: string
  keyName?: string
  in?: 'query' | 'header'
  value?: string
  fallback?: boolean
  fallbackEnv?: string
}

export async function runHttpTool(tool: ToolRow, input: unknown, context: unknown) {
  const config = withHttpToolDefaults(tool, parseJson<HttpToolConfig>(tool.config_json, {}))
  if (!config.endpoint) throw new Error(`HTTP tool ${tool.name} is missing config_json.endpoint.`)

  const url = new URL(renderTemplate(config.endpoint, input, context))
  await assertSafeHttpUrl(url)

  const method = String(config.method ?? 'GET').toUpperCase()
  const headers = renderRecord(config.headers ?? {}, input, context)
  const queryParams = renderRecord(config.queryParams ?? {}, input, context)
  const mappedInput = applyInputMapping(config.inputMapping ?? {}, input, context)

  for (const [key, value] of Object.entries({ ...queryParams, ...mappedInput.query })) {
    if (value != null && value !== '') url.searchParams.set(key, String(value))
  }

  const auth = parseJson<AuthConfig>(tool.auth_config, {})
  await injectAuth(url, headers, auth, context)

  const bodySource = Object.keys(mappedInput.body).length ? mappedInput.body : config.bodyTemplate
  const body = method === 'GET' || method === 'HEAD' ? undefined : renderValue(bodySource ?? {}, input, context)
  const startedAt = Date.now()
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body == null ? {} : { 'Content-Type': 'application/json' }),
      ...Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]))
    },
    body: body == null ? undefined : JSON.stringify(body),
    redirect: 'manual'
  })

  const text = await response.text()
  const raw = parseResponseBody(text)
  const output = Object.keys(config.outputMapping ?? {}).length ? applyOutputMapping(config.outputMapping ?? {}, raw) : raw

  return {
    success: response.ok,
    output,
    errorMessage: response.ok ? undefined : `HTTP ${response.status}: ${text.slice(0, 300)}`,
    trace: {
      method,
      endpoint: maskUrl(url),
      status: response.status,
      latencyMs: Date.now() - startedAt
    }
  }
}

function applyInputMapping(mapping: Record<string, string>, input: unknown, context: unknown) {
  const query: Record<string, unknown> = {}
  const body: Record<string, unknown> = {}

  for (const [target, sourcePath] of Object.entries(mapping)) {
    const value = readPath({ input, context }, sourcePath)
    if (target.startsWith('query.')) query[target.slice(6)] = value
    else if (target.startsWith('body.')) body[target.slice(5)] = value
    else query[target] = value
  }

  return { query, body }
}

function applyOutputMapping(mapping: Record<string, string>, responseBody: unknown) {
  const output: Record<string, unknown> = {}
  for (const [target, sourcePath] of Object.entries(mapping)) {
    output[target] = readPath(responseBody, sourcePath) ?? readPath({ response: responseBody, body: responseBody }, sourcePath)
  }
  return output
}

function withHttpToolDefaults(tool: ToolRow, config: HttpToolConfig): HttpToolConfig {
  if (!isAmapWeatherTool(tool, config)) return config

  return {
    ...config,
    method: config.method ?? 'GET',
    headers: config.headers ?? {},
    queryParams: {
      city: '{{input.city}}',
      extensions: 'base',
      ...(config.queryParams ?? {})
    },
    bodyTemplate: config.bodyTemplate ?? {},
    inputMapping: config.inputMapping ?? {},
    outputMapping: {
      city: 'lives[0].city',
      province: 'lives[0].province',
      weather: 'lives[0].weather',
      temperature: 'lives[0].temperature',
      winddirection: 'lives[0].winddirection',
      windpower: 'lives[0].windpower',
      humidity: 'lives[0].humidity',
      reporttime: 'lives[0].reporttime',
      status: 'status',
      info: 'info',
      ...(config.outputMapping ?? {})
    }
  }
}

function isAmapWeatherTool(tool: ToolRow, config: HttpToolConfig) {
  const endpoint = String(config.endpoint ?? '').toLowerCase()
  if (endpoint.includes('restapi.amap.com/v3/weather/weatherinfo')) return true

  const text = `${tool.name} ${tool.display_name ?? ''} ${tool.description ?? ''}`.toLowerCase()
  return text.includes('weather') && endpoint.includes('amap')
}

async function injectAuth(url: URL, headers: Record<string, unknown>, auth: AuthConfig, context: unknown) {
  if (!auth?.type || auth.type === 'none') return
  if (auth.type !== 'apiKey') throw new Error(`Unsupported auth_config.type: ${auth.type}`)
  if (!auth.keyName) throw new Error('apiKey auth requires keyName.')

  const value = await resolveSecret(auth, context)
  if (!value) {
    const secretName = readSecretName(auth.value) || auth.keyName
    throw new Error(`缺少 ${secretName}，请配置平台 Key 或用户自己的 Key。`)
  }

  if (auth.in === 'header') headers[auth.keyName] = value
  else url.searchParams.set(auth.keyName, value)
}

async function resolveSecret(auth: AuthConfig, context: unknown) {
  const value = auth.value ?? ''
  if (!value) return ''

  if (value.startsWith('env:')) return process.env[value.slice(4)] ?? ''

  if (value.startsWith('userSecret:')) {
    const secretName = value.slice('userSecret:'.length)
    const userValue = await readUserSecretValue(readUserId(context), secretName)
    if (userValue) return userValue
    if (auth.fallback) return process.env[auth.fallbackEnv || secretName] ?? ''
    return ''
  }

  if (value.startsWith('plain:')) {
    if (env.nodeEnv === 'production') {
      throw new Error('生产环境禁止使用 plain 明文 Key，请改用 env: 或 userSecret:。')
    }
    return value.slice('plain:'.length)
  }

  if (value.startsWith('${') && value.endsWith('}')) return process.env[value.slice(2, -1)] ?? ''

  if (env.nodeEnv === 'production') {
    throw new Error('生产环境禁止使用未标注来源的明文 Key，请改用 env: 或 userSecret:。')
  }
  return value
}

function readUserId(context: unknown) {
  if (!context || typeof context !== 'object') return 'default_user'
  const value = (context as Record<string, unknown>).userId
  return typeof value === 'string' && value.trim() ? value.trim() : 'default_user'
}

function readSecretName(value?: string) {
  if (!value) return ''
  if (value.startsWith('env:')) return value.slice(4)
  if (value.startsWith('userSecret:')) return value.slice('userSecret:'.length)
  if (value.startsWith('plain:')) return 'plain'
  return value
}

function renderRecord(record: Record<string, unknown>, input: unknown, context: unknown) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, renderValue(value, input, context)]))
}

function renderValue(value: unknown, input: unknown, context: unknown): unknown {
  if (typeof value === 'string') return renderTemplate(value, input, context)
  if (Array.isArray(value)) return value.map((item) => renderValue(item, input, context))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, renderValue(item, input, context)]))
  }
  return value
}

function renderTemplate(template: string, input: unknown, context: unknown) {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path: string) => {
    const value = readPath({ input, context }, path)
    return value == null ? '' : String(value)
  })
}

function readPath(source: unknown, path: string) {
  const segments = path.replace(/\[(\d+)]/g, '.$1').split('.').filter(Boolean)
  let current: unknown = source
  for (const segment of segments) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function parseResponseBody(text: string) {
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { text }
  }
}

async function assertSafeHttpUrl(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('HTTP tools can only access http/https URLs.')
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('HTTP tools cannot access localhost.')
  }

  if (isBlockedIp(hostname)) {
    throw new Error('HTTP tools cannot access loopback or private IP ranges.')
  }

  const addresses = await dns.lookup(hostname, { all: true }).catch(() => [])
  for (const address of addresses) {
    if (isBlockedIp(address.address)) {
      throw new Error('HTTP tools cannot resolve to loopback or private IP ranges.')
    }
  }
}

function isBlockedIp(value: string) {
  const version = net.isIP(value)
  if (version === 4) {
    const [a, b] = value.split('.').map(Number)
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    )
  }
  if (version === 6) {
    const normalized = value.toLowerCase()
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')
  }
  return false
}

function maskUrl(url: URL) {
  const cloned = new URL(url.toString())
  for (const key of cloned.searchParams.keys()) {
    if (/key|token|secret|password/i.test(key)) cloned.searchParams.set(key, '***')
  }
  return cloned.toString()
}

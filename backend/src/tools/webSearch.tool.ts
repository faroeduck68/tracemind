import { TraceMindTool } from '../types/tool'

type SearchProvider = 'tavily' | 'brave' | 'serpapi' | 'bing' | 'aliyun'

type SearchResult = {
  title: string
  url: string
  content: string
  score?: number
  publishedAt?: string
}

const MAX_RESULTS = readLimit('WEB_SEARCH_MAX_RESULTS', 5, 1, 10)
const MAX_RESULT_LENGTH = readLimit('WEB_SEARCH_MAX_RESULT_LENGTH', 1200, 200, 4000)
const MAX_TOTAL_LENGTH = readLimit('WEB_SEARCH_MAX_TOTAL_LENGTH', 6000, 1000, 16000)

const webSearchTool: TraceMindTool & { inputSchema: unknown; outputSchema: unknown } = {
  name: 'web_search_tool',
  displayName: '网页搜索工具',
  inputSchema: {
    query: {
      type: 'string',
      required: true
    }
  },
  outputSchema: {
    results: 'array',
    summary: 'string',
    sources: 'array'
  },
  async run(context) {
    const input = context.currentNodeId ? context.nodeInputs[context.currentNodeId] : undefined
    const query = readQuery(input) || context.query?.trim() || ''
    if (!query) {
      return { success: false, output: null, errorMessage: 'web_search_tool 缺少必填参数 query。' }
    }

    const providerPlan = resolveProviderPlan()
    if (!providerPlan.providers.length) {
      return {
        success: false,
        output: null,
        errorMessage:
          'web_search_tool 未配置搜索服务，请在后端 .env 中配置 Tavily/Brave/SerpAPI/Bing/阿里云 OpenSearch 任一搜索服务。'
      }
    }

    const startedAt = Date.now()
    const { provider, raw, fallback } = await searchWithFallback(providerPlan, query)
    const results = limitResults(raw.results)
    const sources = results.map(({ title, url }) => ({ title, url }))
    const summary = truncateText(
      raw.summary || results.map((item) => `${item.title}: ${item.content}`).filter(Boolean).join('\n'),
      MAX_TOTAL_LENGTH
    )

    return {
      success: true,
      output: {
        query,
        results,
        summary,
        sources,
        provider,
        fallback,
        resultCount: results.length,
        searchedAt: new Date().toISOString()
      },
      message: `网页搜索完成，共返回 ${results.length} 条结果。`,
      reason: `${provider} search completed in ${Date.now() - startedAt}ms`
    }
  }
}

async function searchWithFallback(plan: ReturnType<typeof resolveProviderPlan>, query: string) {
  let lastError: unknown
  for (const [index, provider] of plan.providers.entries()) {
    try {
      return {
        provider,
        raw: await search(provider, query),
        fallback: index > 0 || Boolean(plan.configuredProvider && provider !== plan.configuredProvider)
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('所有已配置的搜索服务均调用失败。')
}

async function search(provider: SearchProvider, query: string): Promise<{ results: SearchResult[]; summary?: string }> {
  if (provider === 'tavily') return searchTavily(query)
  if (provider === 'brave') return searchBrave(query)
  if (provider === 'serpapi') return searchSerpApi(query)
  if (provider === 'bing') return searchBing(query)
  return searchAliyun(query)
}

async function searchTavily(query: string) {
  const response = await fetchJson('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: MAX_RESULTS,
      include_answer: true,
      search_depth: 'basic'
    })
  })
  const record = readRecord(response)
  const results = readArray(record?.results).map((item) => normalizeResult(item, 'title', 'url', 'content'))
  return { results, summary: readString(record?.answer) }
}

async function searchBrave(query: string) {
  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', String(MAX_RESULTS))
  const response = await fetchJson(url, {
    headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY ?? '' }
  })
  const record = readRecord(response)
  const web = readRecord(record?.web)
  return {
    results: readArray(web?.results).map((item) => normalizeResult(item, 'title', 'url', 'description'))
  }
}

async function searchSerpApi(query: string) {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('q', query)
  url.searchParams.set('num', String(MAX_RESULTS))
  url.searchParams.set('api_key', process.env.SERPAPI_API_KEY ?? '')
  const response = await fetchJson(url)
  const record = readRecord(response)
  const answerBox = readRecord(record?.answer_box)
  return {
    results: readArray(record?.organic_results).map((item) => normalizeResult(item, 'title', 'link', 'snippet')),
    summary: readString(answerBox?.answer, answerBox?.snippet)
  }
}

async function searchBing(query: string) {
  const url = new URL('https://api.bing.microsoft.com/v7.0/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', String(MAX_RESULTS))
  url.searchParams.set('textDecorations', 'false')
  url.searchParams.set('textFormat', 'Raw')
  const response = await fetchJson(url, {
    headers: { 'Ocp-Apim-Subscription-Key': process.env.BING_SEARCH_API_KEY ?? '' }
  })
  const record = readRecord(response)
  const webPages = readRecord(record?.webPages)
  return {
    results: readArray(webPages?.value).map((item) => normalizeResult(item, 'name', 'url', 'snippet'))
  }
}

async function searchAliyun(query: string) {
  const url = resolveAliyunSearchUrl()
  const response = await fetchJson(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.ALIYUN_OPENSEARCH_API_KEY ?? ''}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      top_k: MAX_RESULTS
    })
  })
  const record = readRecord(response)
  const result = readRecord(record?.result) ?? readRecord(record?.data) ?? record
  const rawResults =
    readArray(result?.search_result).length > 0
      ? readArray(result?.search_result)
      : readArray(result?.results).length > 0
        ? readArray(result?.results)
        : readArray(result?.items)

  return {
    results: rawResults.map(normalizeAliyunResult),
    summary: readString(result?.answer, result?.summary, result?.content)
  }
}

async function fetchJson(url: string | URL, init: RequestInit = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), readLimit('WEB_SEARCH_TIMEOUT_MS', 12000, 1000, 30000))
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: 'error' })
    const text = await response.text()
    if (!response.ok) throw new Error(`搜索服务请求失败（HTTP ${response.status}）：${truncateText(text, 300)}`)
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new Error('搜索服务返回了无效 JSON。')
    }
  } finally {
    clearTimeout(timeout)
  }
}

function resolveProviderPlan() {
  const configured = String(process.env.WEB_SEARCH_PROVIDER ?? '').trim().toLowerCase()
  const supported: SearchProvider[] = ['tavily', 'brave', 'serpapi', 'bing', 'aliyun']
  const configuredProvider = supported.includes(configured as SearchProvider) ? (configured as SearchProvider) : null
  const ordered = configuredProvider ? [configuredProvider, ...supported.filter((provider) => provider !== configuredProvider)] : supported
  return {
    configuredProvider,
    providers: ordered.filter((provider) => Boolean(readProviderKey(provider)))
  }
}

function readProviderKey(provider: SearchProvider) {
  if (provider === 'tavily') return process.env.TAVILY_API_KEY
  if (provider === 'brave') return process.env.BRAVE_SEARCH_API_KEY
  if (provider === 'serpapi') return process.env.SERPAPI_API_KEY
  if (provider === 'bing') return process.env.BING_SEARCH_API_KEY
  if (provider === 'aliyun') return process.env.ALIYUN_OPENSEARCH_API_KEY
  return ''
}

function limitResults(results: SearchResult[]) {
  let remaining = MAX_TOTAL_LENGTH
  const limited: SearchResult[] = []
  for (const result of results.slice(0, MAX_RESULTS)) {
    if (!result.url || remaining <= 0) continue
    const content = truncateText(result.content, Math.min(MAX_RESULT_LENGTH, remaining))
    remaining -= content.length
    limited.push({ ...result, content })
  }
  return limited
}

function normalizeResult(value: unknown, titleKey: string, urlKey: string, contentKey: string): SearchResult {
  const record = readRecord(value)
  return {
    title: sanitizeText(readString(record?.[titleKey])) || '未命名来源',
    url: readPublicUrl(readString(record?.[urlKey])),
    content: sanitizeText(readString(record?.[contentKey])),
    score: readNumber(record?.score),
    publishedAt: readString(record?.published_date, record?.datePublished, record?.age) || undefined
  }
}

function normalizeAliyunResult(value: unknown): SearchResult {
  const record = readRecord(value)
  return {
    title: sanitizeText(readString(record?.title, record?.name)) || '未命名来源',
    url: readPublicUrl(readString(record?.link, record?.url)),
    content: sanitizeText(readString(record?.snippet, record?.content, record?.summary, record?.description)),
    score: readNumber(record?.score),
    publishedAt: readString(record?.published_at, record?.publishedAt, record?.date, record?.time) || undefined
  }
}

function resolveAliyunSearchUrl() {
  const endpoint = readString(process.env.ALIYUN_OPENSEARCH_ENDPOINT).replace(/\/+$/, '')
  if (!endpoint) throw new Error('阿里云 OpenSearch 未配置 ALIYUN_OPENSEARCH_ENDPOINT。')

  if (/\/v3\/openapi\/workspaces\//.test(endpoint)) return endpoint

  const workspace = readString(process.env.ALIYUN_OPENSEARCH_WORKSPACE, 'default')
  return `${endpoint}/v3/openapi/workspaces/${encodeURIComponent(workspace)}/web-search/ops-web-search-001`
}

function readPublicUrl(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

function sanitizeText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

function readQuery(value: unknown) {
  const record = readRecord(value)
  return readString(record?.query).trim()
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function readString(...values: unknown[]) {
  for (const value of values) if (typeof value === 'string' && value.trim()) return value.trim()
  return ''
}

function readNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function readLimit(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback
}

export default webSearchTool

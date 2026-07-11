const weatherKeywords = ['天气', '气温', '预报', 'weather', 'temperature', 'forecast']
const explicitWebSearchKeywords = [
  '联网搜索',
  '联网查询',
  '上网查',
  '查网页',
  '搜一下',
  '网上搜索',
  '结合网上资料',
  '结合网络资料',
  '外部资料',
  '行业最新数据',
  'search the web',
  'web search',
  'online search'
]
const realtimeKeywords = [
  '今天',
  '今日',
  '现在',
  '最新',
  '实时',
  '最近',
  '天气',
  '气温',
  '预报',
  '新闻',
  '价格',
  '股价',
  '股票',
  '政策',
  '赛事',
  '比赛结果',
  '汇率',
  'today',
  'latest',
  'current',
  'real-time',
  'realtime',
  'weather',
  'news',
  'price',
  'stock',
  'policy',
  'match result',
  'exchange rate'
]

const currentRealtimePatterns = [
  /当前(?:的)?(?:价格|股价|汇率|天气|气温|政策)/,
  /current\s+(?:price|stock|exchange rate|weather|policy)/i
]

const explicitWebSearchPatterns = [/结合(?:网上|网络).{0,8}资料/, /(?:联网|上网).{0,6}(?:搜索|查询|查)/]

export function isWeatherQuery(query: string) {
  const normalized = query.toLowerCase()
  return weatherKeywords.some((keyword) => normalized.includes(keyword))
}

export function needsRealtimeInformation(query: string) {
  const normalized = query.toLowerCase()
  return (
    hasExplicitWebSearchIntent(query) ||
    realtimeKeywords.some((keyword) => normalized.includes(keyword)) ||
    currentRealtimePatterns.some((pattern) => pattern.test(normalized))
  )
}

export function hasExplicitWebSearchIntent(query: string) {
  const normalized = query.toLowerCase()
  return (
    explicitWebSearchKeywords.some((keyword) => normalized.includes(keyword)) ||
    explicitWebSearchPatterns.some((pattern) => pattern.test(normalized))
  )
}

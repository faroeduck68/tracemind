import { TraceMindTool } from '../types/tool'

type RiskOutput = {
  riskLevel?: string
  risks?: unknown[]
  suggestions?: unknown[]
  recommendation?: string
  mocked?: boolean
}

type SummaryOutput = {
  summary?: string
  bullets?: unknown[]
  recommendation?: string
  mocked?: boolean
}

type ReportOutput = {
  markdown?: string
  finalReport?: string
  reportPreview?: string
  mocked?: boolean
}

type DownloadOutput = {
  downloadUrl?: string
  mocked?: boolean
}

type WeatherOutput = {
  city?: string
  province?: string
  weather?: string
  temperature?: string | number
  winddirection?: string
  windpower?: string
  humidity?: string | number
  reporttime?: string
  lives?: WeatherOutput[]
  response?: {
    lives?: WeatherOutput[]
  }
  body?: {
    lives?: WeatherOutput[]
  }
}

const reportOutputFinalTool: TraceMindTool = {
  name: 'report_output_tool',
  displayName: '报告结果输出工具',
  async run(context) {
    const docx = findOutput<DownloadOutput>(context, 'downloadUrl')
    const report = findOutput<ReportOutput>(context, 'markdown') ?? findOutput<ReportOutput>(context, 'finalReport')
    const risk = findRiskOutput(context)
    const summaryOutput = findOutput<SummaryOutput>(context, 'summary')
    const weather = findWeatherOutput(context)

    const markdown = firstText(report?.markdown, report?.finalReport, report?.reportPreview)
    const weatherSummary = buildWeatherSummary(weather)
    const summary = weatherSummary || buildSummary(risk, report, summaryOutput)
    const recommendation = firstText(risk?.recommendation, arrayText(risk?.suggestions), summaryOutput?.recommendation)

    const result = {
      message: '工作流执行完成',
      downloadUrl: docx?.downloadUrl,
      summary,
      markdown: markdown || weatherSummary,
      weather,
      riskLevel: risk?.riskLevel,
      risks: Array.isArray(risk?.risks) ? risk?.risks : [],
      recommendation,
      reportPreview: (markdown || weatherSummary) ? (markdown || weatherSummary).slice(0, 600) : undefined,
      mocked: Boolean(docx?.mocked || report?.mocked || risk?.mocked || summaryOutput?.mocked),
      source: 'workflow-context'
    }

    context.finalResult = result

    return {
      success: true,
      output: result,
      message: '结果输出完成'
    }
  }
}

function findOutput<T>(context: Parameters<TraceMindTool['run']>[0], key: string): T | undefined {
  return Object.values(context.nodeOutputs).find((output) => output && typeof output === 'object' && key in output) as T | undefined
}

function findRiskOutput(context: Parameters<TraceMindTool['run']>[0]) {
  return Object.values(context.nodeOutputs).find(
    (output) =>
      output &&
      typeof output === 'object' &&
      (typeof (output as RiskOutput).riskLevel === 'string' ||
        Array.isArray((output as RiskOutput).risks) ||
        Array.isArray((output as RiskOutput).suggestions) ||
      typeof (output as RiskOutput).recommendation === 'string')
  ) as RiskOutput | undefined
}

function findWeatherOutput(context: Parameters<TraceMindTool['run']>[0]) {
  for (const output of Object.values(context.nodeOutputs)) {
    const weather = normalizeWeatherOutput(output)
    if (weather) return weather
  }
  return undefined
}

function normalizeWeatherOutput(output: unknown): WeatherOutput | undefined {
  if (!output || typeof output !== 'object') return undefined
  const record = output as WeatherOutput & Record<string, unknown>

  const live =
    Array.isArray(record.lives) ? record.lives[0] :
    Array.isArray(record.response?.lives) ? record.response.lives[0] :
    Array.isArray(record.body?.lives) ? record.body.lives[0] :
    undefined
  const candidate = live ?? record

  if (!hasWeatherFields(candidate)) return undefined
  return candidate
}

function hasWeatherFields(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return ['weather', 'temperature', 'humidity', 'winddirection', 'windpower', 'reporttime'].some(
    (key) => record[key] != null && record[key] !== ''
  )
}

function buildWeatherSummary(weather?: WeatherOutput) {
  if (!weather) return ''

  const city = firstText(weather.city, weather.province)
  const weatherText = firstText(weather.weather)
  const temperature = formatValue(weather.temperature, '°C')
  const humidity = formatValue(weather.humidity, '%')
  const wind = [firstText(weather.winddirection), firstText(weather.windpower)].filter(Boolean).join(' ')
  const reporttime = firstText(weather.reporttime)

  const parts = [
    city ? `${city}当前天气` : '当前天气',
    weatherText,
    temperature && `温度 ${temperature}`,
    humidity && `湿度 ${humidity}`,
    wind && `风况 ${wind}`,
    reporttime && `更新时间 ${reporttime}`
  ].filter(Boolean)

  return parts.length ? parts.join('，') : ''
}

function buildSummary(risk?: RiskOutput, report?: ReportOutput, summaryOutput?: SummaryOutput) {
  const directSummary = firstText(summaryOutput?.summary, arrayText(summaryOutput?.bullets))
  const risks = arrayText(risk?.risks)
  const suggestions = firstText(arrayText(risk?.suggestions), risk?.recommendation, summaryOutput?.recommendation)
  const reportPreview = firstText(report?.markdown, report?.finalReport, report?.reportPreview)

  const lines = [
    directSummary,
    risk && `风险等级：${risk.riskLevel ?? 'unknown'}`,
    risks && `风险：${risks}`,
    suggestions && `建议：${suggestions}`,
    !directSummary && !risk && reportPreview && reportPreview.slice(0, 300)
  ].filter(Boolean)

  return lines.length ? lines.join('\n') : '工作流已完成，但后端暂未返回可汇总的上游报告内容。'
}

function arrayText(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 4).join('；') : ''
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function formatValue(value: unknown, unit: string) {
  if (value == null || value === '') return ''
  const text = String(value).trim()
  if (!text) return ''
  return text.endsWith(unit) ? text : `${text}${unit}`
}

export default reportOutputFinalTool

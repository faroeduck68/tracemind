import { TraceMindTool } from '../types/tool'

type RiskFactor = {
  name: string
  score: number
  evidence: string
  suggestion: string
}

const metricAliases = {
  assetLiabilityRatio: ['assetLiabilityRatio', 'debtRatio', 'liabilityRatio', '资产负债率', '负债率'],
  operatingCashFlow: [
    'operatingCashFlow',
    'operatingCashFlowNet',
    'netOperatingCashFlow',
    'cashFlowFromOperatingActivities',
    '经营现金流',
    '经营活动现金流',
    '经营活动现金流量净额'
  ],
  netProfit: ['netProfit', '净利润', '归母净利润'],
  grossProfitMargin: ['grossProfitMargin', '毛利率', '综合毛利率'],
  netProfitMargin: ['netProfitMargin', 'profitMargin', '净利率', '销售净利率'],
  currentRatio: ['currentRatio', '流动比率'],
  quickRatio: ['quickRatio', '速动比率'],
  accountsReceivableDays: ['accountsReceivableDays', '应收账款周转天数', '应收账款周转期'],
  inventoryTurnoverDays: ['inventoryTurnoverDays', '存货周转天数', '存货周转期'],
  shortTermBorrowings: ['shortTermBorrowings', 'shortTermLoan', '短期借款'],
  revenue: ['revenue', 'operatingRevenue', '营业收入', '营收'],
  revenueGrowth: ['revenueGrowth', 'revenueGrowthRate', '营业收入增长率', '营收增长率'],
  netProfitGrowth: ['netProfitGrowth', 'netProfitGrowthRate', '净利润增长率']
}

const financialRiskTool: TraceMindTool = {
  name: 'financial_risk_tool',
  displayName: '财务风险分析工具',
  async run(context) {
    const metrics = findMetrics(context)
    const metricKeys = Object.keys(metrics)

    if (metricKeys.length === 0) {
      return {
        success: false,
        output: {
          riskLevel: 'unknown',
          riskScore: 0,
          basedOnMetrics: {},
          risks: ['未提取到指标，无法完成有效分析。'],
          riskFactors: [],
          suggestions: ['请上传包含利润表、资产负债表、现金流量表等有效财务数据的文件。'],
          error: '未识别到财务数据',
          mocked: false,
          analyzer: 'rule-real-empty'
        },
        message: '未识别到财务数据，无法完成有效分析',
        errorMessage: '未识别到财务数据',
        businessFailure: true,
        reason: '上游节点没有提供可用于风险分析的财务指标。'
      }
    }

    const factors: RiskFactor[] = []
    const addFactor = (factor: RiskFactor) => factors.push(factor)

    const assetLiabilityRatio = readLatestRatio(metrics, metricAliases.assetLiabilityRatio)
    if (assetLiabilityRatio != null && assetLiabilityRatio >= 0.65) {
      addFactor({
        name: '资产负债率超过预警线',
        score: 2,
        evidence: `资产负债率为 ${formatPercent(assetLiabilityRatio)}，高于 65% 预警线。`,
        suggestion: '压降有息负债，优化长短债结构，并评估新增融资对偿债能力的压力。'
      })
    }

    const operatingCashFlow = readLatestNumber(metrics, metricAliases.operatingCashFlow)
    if (operatingCashFlow != null && operatingCashFlow < 0) {
      addFactor({
        name: '经营现金流转负',
        score: 2,
        evidence: `经营现金流为 ${formatAmount(operatingCashFlow)}，现金创造能力承压。`,
        suggestion: '优先核查回款、存货采购节奏和付款周期，避免利润增长无法转化为现金。'
      })
    }

    const revenueSeries = readSeries(metrics, metricAliases.revenue)
    const netProfitSeries = readSeries(metrics, metricAliases.netProfit)
    const revenueGrowth = readLatestRatio(metrics, metricAliases.revenueGrowth)
    const netProfitGrowth = readLatestRatio(metrics, metricAliases.netProfitGrowth)
    const netProfitDown = isLatestDown(netProfitSeries) || (netProfitGrowth != null && netProfitGrowth < 0)
    const revenueUp = isLatestUp(revenueSeries) || (revenueGrowth != null && revenueGrowth > 0)

    if (netProfitDown) {
      addFactor({
        name: revenueUp ? '营业收入增长但净利润下降' : '净利润同比下降',
        score: 1,
        evidence: buildTrendEvidence('净利润', netProfitSeries, netProfitGrowth),
        suggestion: '拆解毛利率、期间费用率、资产减值和非经常损益，确认利润下滑来源。'
      })
    }

    const grossMarginSeries = readSeries(metrics, metricAliases.grossProfitMargin).map(toRatioPoint)
    if (isConsecutiveDown(grossMarginSeries)) {
      addFactor({
        name: '毛利率连续下降',
        score: 1,
        evidence: `毛利率呈下降趋势：${formatSeries(grossMarginSeries, true)}。`,
        suggestion: '复核产品价格、原材料成本、低毛利业务占比和收入确认结构。'
      })
    }

    const netMarginSeries = readSeries(metrics, metricAliases.netProfitMargin).map(toRatioPoint)
    if (isConsecutiveDown(netMarginSeries)) {
      addFactor({
        name: '净利率连续下降',
        score: 1,
        evidence: `净利率呈下降趋势：${formatSeries(netMarginSeries, true)}。`,
        suggestion: '关注费用率、财务费用、减值损失与所得税影响，提升利润质量。'
      })
    }

    const currentRatio = readLatestNumber(metrics, metricAliases.currentRatio)
    if (currentRatio != null && currentRatio < 1) {
      addFactor({
        name: '流动比率低于 1',
        score: 1,
        evidence: `流动比率为 ${formatNumber(currentRatio)}，短期偿债安全垫不足。`,
        suggestion: '加强短期现金流滚动预测，控制短债集中到期风险。'
      })
    }

    const quickRatio = readLatestNumber(metrics, metricAliases.quickRatio)
    if (quickRatio != null && quickRatio < 0.7) {
      addFactor({
        name: '速动比率低于 0.7',
        score: 1,
        evidence: `速动比率为 ${formatNumber(quickRatio)}，剔除存货后的即时偿债能力偏弱。`,
        suggestion: '加快应收回款，降低慢周转存货占用。'
      })
    }

    const receivableDays = readSeries(metrics, metricAliases.accountsReceivableDays)
    if (isObviouslyUp(receivableDays)) {
      addFactor({
        name: '应收账款周转恶化',
        score: 1,
        evidence: `应收账款周转天数上升：${formatSeries(receivableDays)}。`,
        suggestion: '加强客户信用分层和逾期催收，评估坏账准备是否充分。'
      })
    }

    const inventoryDays = readSeries(metrics, metricAliases.inventoryTurnoverDays)
    if (isObviouslyUp(inventoryDays)) {
      addFactor({
        name: '存货周转恶化',
        score: 1,
        evidence: `存货周转天数上升：${formatSeries(inventoryDays)}。`,
        suggestion: '复核备货策略、滞销品跌价准备和产销匹配情况。'
      })
    }

    const shortTermBorrowings = readSeries(metrics, metricAliases.shortTermBorrowings)
    if (isLatestUp(shortTermBorrowings)) {
      addFactor({
        name: '短期借款上升',
        score: 1,
        evidence: `短期借款上升：${formatSeries(shortTermBorrowings)}。`,
        suggestion: '关注短期借款增长对利息费用、现金流和再融资安排的影响。'
      })
    }

    const riskScore = factors.reduce((sum, factor) => sum + factor.score, 0)
    const riskLevel = scoreToRiskLevel(riskScore)
    const suggestions = unique(factors.map((factor) => factor.suggestion))

    return {
      success: true,
      output: {
        riskLevel,
        riskScore,
        riskLevelBasis: buildRiskLevelBasis(riskScore, riskLevel, factors),
        basedOnMetrics: metrics,
        riskFactors: factors,
        risks: factors.length ? factors.map((factor) => `${factor.name}：${factor.evidence}`) : ['基于已提取指标，暂未发现明显财务异常。'],
        suggestions: suggestions.length ? suggestions : ['建议补充现金流量表、资产负债表和同行业对比数据。'],
        mocked: false,
        analyzer: 'rule-real-v2'
      },
      message: '风险分析完成'
    }
  }
}

function findMetrics(context: Parameters<TraceMindTool['run']>[0]) {
  for (const output of Object.values(context.nodeOutputs)) {
    if (output && typeof output === 'object' && (output as { metrics?: unknown }).metrics) {
      return ((output as { metrics?: Record<string, unknown> }).metrics ?? {}) as Record<string, unknown>
    }
  }
  return {}
}

function findMetric(metrics: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (metrics[key] != null) return metrics[key]
  }

  const normalizedEntries = Object.entries(metrics).map(([key, value]) => [normalizeKey(key), value] as const)
  for (const key of keys.map(normalizeKey)) {
    const matched = normalizedEntries.find(([candidate]) => candidate.includes(key) || key.includes(candidate))
    if (matched) return matched[1]
  }

  return undefined
}

function readLatestNumber(metrics: Record<string, unknown>, keys: string[]) {
  const series = readSeries(metrics, keys)
  return series.length ? series[series.length - 1].value : null
}

function readLatestRatio(metrics: Record<string, unknown>, keys: string[]) {
  const latest = readLatestNumber(metrics, keys)
  return latest == null ? null : toRatio(latest)
}

function readSeries(metrics: Record<string, unknown>, keys: string[]) {
  return extractSeries(findMetric(metrics, keys)).sort((a, b) => Number(a.year ?? 9999) - Number(b.year ?? 9999))
}

function extractSeries(value: unknown): Array<{ year?: string | number; value: number; raw?: unknown }> {
  if (value == null) return []
  if (typeof value === 'number') return Number.isFinite(value) ? [{ value, raw: value }] : []
  if (typeof value === 'string') return parseStringSeries(value)
  if (Array.isArray(value)) return value.flatMap((item) => extractSeries(item))
  if (typeof value !== 'object') return []

  const record = value as Record<string, unknown>
  const years = record.years ?? record.yearData ?? record.history ?? record.data
  if (years && typeof years === 'object' && !Array.isArray(years)) {
    const points = Object.entries(years as Record<string, unknown>).flatMap(([year, raw]) =>
      extractSeries(raw).map((point) => ({ ...point, year }))
    )
    if (points.length) return points
  }

  const yearKeys = Object.keys(record).filter((key) => /^20\d{2}$/.test(key))
  if (yearKeys.length) {
    return yearKeys.flatMap((year) => extractSeries(record[year]).map((point) => ({ ...point, year })))
  }

  for (const key of ['value', 'current', 'amount', 'latest', 'ending', '期末', '本期']) {
    if (record[key] != null) {
      const points = extractSeries(record[key])
      if (points.length) return points
    }
  }

  return parseStringSeries(JSON.stringify(record))
}

function parseStringSeries(value: string) {
  const text = value.replace(/,/g, '')
  const points: Array<{ year?: string; value: number; raw?: string }> = []
  const yearPattern = /(20\d{2})\D{0,20}(-?\d+(?:\.\d+)?)\s*(%|万元|万|亿元|元|天|次)?/g
  let matched: RegExpExecArray | null

  while ((matched = yearPattern.exec(text))) {
    points.push({ year: matched[1], value: normalizeUnit(Number(matched[2]), matched[3], text), raw: matched[0] })
  }

  if (points.length) return points

  const single = text.match(/-?\d+(?:\.\d+)?\s*(%|万元|万|亿元|元|天|次)?/)
  if (!single) return []
  const numberText = single[0].match(/-?\d+(?:\.\d+)?/)?.[0]
  const unit = single[1]
  if (!numberText) return []
  return [{ value: normalizeUnit(Number(numberText), unit, text), raw: value }]
}

function normalizeUnit(value: number, unit?: string, rawText = '') {
  if (!Number.isFinite(value)) return value
  if (unit === '亿元') return value * 10000
  if (rawText.includes('(') && rawText.includes(')') && value > 0) return -value
  return value
}

function toRatio(value: number) {
  return Math.abs(value) > 1.5 ? value / 100 : value
}

function toRatioPoint(point: { year?: string | number; value: number; raw?: unknown }) {
  return { ...point, value: toRatio(point.value) }
}

function isLatestDown(series: Array<{ value: number }>) {
  return series.length >= 2 && series[series.length - 1].value < series[series.length - 2].value
}

function isLatestUp(series: Array<{ value: number }>) {
  return series.length >= 2 && series[series.length - 1].value > series[series.length - 2].value
}

function isConsecutiveDown(series: Array<{ value: number }>) {
  if (series.length >= 3) {
    return series.slice(-3).every((point, index, items) => index === 0 || point.value < items[index - 1].value)
  }
  return isLatestDown(series)
}

function isObviouslyUp(series: Array<{ value: number }>) {
  if (series.length < 2) return false
  const previous = series[series.length - 2].value
  const latest = series[series.length - 1].value
  return latest - previous >= 10 || (previous > 0 && latest / previous >= 1.1)
}

function scoreToRiskLevel(score: number) {
  if (score <= 1) return 'low'
  if (score <= 4) return 'medium'
  return 'medium-high'
}

function buildRiskLevelBasis(score: number, level: string, factors: RiskFactor[]) {
  return `风险评分 ${score} 分，评级为 ${level}。评分依据：${factors.map((factor) => `${factor.name}+${factor.score}`).join('；') || '未触发主要预警规则'}。`
}

function buildTrendEvidence(name: string, series: Array<{ year?: string | number; value: number }>, growth?: number | null) {
  const trend = series.length ? `${name}趋势：${formatSeries(series)}` : ''
  const growthText = growth != null ? `${name}同比增速：${formatPercent(growth)}。` : ''
  return [trend, growthText].filter(Boolean).join('；') || `${name}出现同比下降。`
}

function formatSeries(series: Array<{ year?: string | number; value: number }>, percent = false) {
  return series
    .map((point, index) => `${point.year ?? `第${index + 1}期`}${point.year ? '年' : ''}${percent ? formatPercent(point.value) : formatNumber(point.value)}`)
    .join('，')
}

function formatPercent(value: number) {
  return `${(toRatio(value) * 100).toFixed(2)}%`
}

function formatAmount(value: number) {
  return `${formatNumber(value)}万元`
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toLocaleString('zh-CN') : value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[\s_\-()（）]/g, '')
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

export default financialRiskTool

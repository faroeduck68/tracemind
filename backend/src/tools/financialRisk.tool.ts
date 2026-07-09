import { TraceMindTool } from '../types/tool'

const financialRiskTool: TraceMindTool = {
  name: 'financial_risk_tool',
  displayName: '财务风险分析工具',
  async run(context) {
    const metrics = findMetrics(context)
    const metricKeys = Object.keys(metrics)

    if (metricKeys.length === 0) {
      return {
        success: true,
        output: {
          riskLevel: 'unknown',
          basedOnMetrics: {},
          risks: ['未提取到足够的真实财务指标，无法给出确定风险等级。'],
          suggestions: ['请上传包含财务报表数据的 PDF、CSV 或文本文件。'],
          mocked: false,
          analyzer: 'rule-real-empty'
        },
        message: '真实指标不足，风险等级未知'
      }
    }

    const risks: string[] = []
    const suggestions: string[] = []
    const debtRatio = readNumber(metrics, ['debtRatio', 'assetLiabilityRatio', 'liabilityRatio'])
    const netProfitMargin = readNumber(metrics, ['netProfitMargin', 'profitMargin'])
    const revenueGrowth = readNumber(metrics, ['revenueGrowth', 'revenueGrowthRate'])

    if (debtRatio != null && debtRatio >= 0.6) {
      risks.push(`资产负债率较高：${formatPercent(debtRatio)}`)
      suggestions.push('关注短期债务、融资成本和现金覆盖能力。')
    }
    if (netProfitMargin != null && netProfitMargin < 0.05) {
      risks.push(`净利率偏低：${formatPercent(netProfitMargin)}`)
      suggestions.push('复核毛利率、期间费用和非经常性损益。')
    }
    if (revenueGrowth != null && revenueGrowth < 0) {
      risks.push(`收入增长为负：${formatPercent(revenueGrowth)}`)
      suggestions.push('结合订单、客户集中度和行业周期判断收入压力。')
    }

    const riskLevel = risks.length >= 2 ? 'high' : risks.length === 1 ? 'medium' : 'low'

    return {
      success: true,
      output: {
        riskLevel,
        basedOnMetrics: metrics,
        risks: risks.length ? risks : ['基于已提取指标，暂未发现明显财务异常。'],
        suggestions: suggestions.length ? suggestions : ['建议补充现金流量表、资产负债表和同行业对比数据。'],
        mocked: false,
        analyzer: 'rule-real'
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

function readNumber(metrics: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metrics[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value.replace('%', '')) / (value.includes('%') ? 100 : 1)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`
}

export default financialRiskTool

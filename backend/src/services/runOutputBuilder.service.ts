export function buildRunOutput(finalResult: unknown, nodeOutputs: Record<string, unknown>, warnings: string[] = []) {
  const displayable = collectDisplayableOutput(nodeOutputs)
  const finalRecord = readRecord(finalResult)
  const businessFailure = detectBusinessFailure(finalResult, nodeOutputs)

  if (finalRecord) {
    return attachWarnings(attachBusinessOutcome(fillMissingDisplayFields(finalRecord, displayable), businessFailure), warnings)
  }

  if (typeof finalResult === 'string' && finalResult.trim()) {
    return attachWarnings(attachBusinessOutcome(fillMissingDisplayFields({ summary: finalResult.trim() }, displayable), businessFailure), warnings)
  }

  return attachWarnings(
    attachBusinessOutcome(Object.keys(displayable).length ? { ...nodeOutputs, ...displayable } : nodeOutputs, businessFailure),
    warnings
  )
}

function attachWarnings(output: Record<string, unknown>, warnings: string[]) {
  return warnings.length ? { ...output, warnings: [...new Set(warnings)] } : output
}

function fillMissingDisplayFields(target: Record<string, unknown>, fallback: Record<string, unknown>) {
  const output = { ...target }
  for (const [key, value] of Object.entries(fallback)) {
    if (!hasDisplayValueForKey(key, output[key]) && hasDisplayValueForKey(key, value)) {
      output[key] = value
    }
  }
  return output
}

function collectDisplayableOutput(nodeOutputs: Record<string, unknown>) {
  const records = Object.values(nodeOutputs).map(readRecord).filter(Boolean) as Record<string, unknown>[]
  const riskRecord = records.find(
    (record) =>
      typeof record.riskLevel === 'string' ||
      Array.isArray(record.risks) ||
      Array.isArray(record.suggestions) ||
      typeof record.recommendation === 'string'
  )

  const summary = firstString(
    ...records.map((record) => record.summary),
    riskRecord && buildRiskSummary(riskRecord),
    ...records.map((record) => record.recommendation)
  )
  const markdown = firstString(
    ...records.map((record) => record.markdown),
    ...records.map((record) => record.finalReport),
    ...records.map((record) => record.reportPreview),
    ...records.map((record) => record.content)
  )
  const downloadUrl = firstString(...records.map((record) => record.downloadUrl))
  const riskLevel = firstString(riskRecord?.riskLevel)
  const recommendation = firstString(...records.map((record) => record.recommendation), arrayText(riskRecord?.suggestions))
  const risks = Array.isArray(riskRecord?.risks) ? riskRecord?.risks : undefined

  return Object.fromEntries(
    Object.entries({
      summary,
      markdown,
      reportPreview: markdown ? markdown.slice(0, 600) : '',
      downloadUrl,
      riskLevel,
      recommendation,
      risks
    }).filter(([, value]) => hasDisplayValue(value))
  )
}

function buildRiskSummary(record: Record<string, unknown>) {
  return [
    `风险等级：${firstString(record.riskLevel) || 'unknown'}`,
    arrayText(record.risks) && `风险：${arrayText(record.risks)}`,
    firstString(record.recommendation, arrayText(record.suggestions)) &&
      `建议：${firstString(record.recommendation, arrayText(record.suggestions))}`
  ]
    .filter(Boolean)
    .join('\n')
}

function hasDisplayValue(value: unknown) {
  if (typeof value === 'string') return Boolean(value.trim())
  if (Array.isArray(value)) return value.length > 0
  return value != null
}

function hasDisplayValueForKey(key: string, value: unknown) {
  if (!hasDisplayValue(value)) return false
  if (key === 'riskLevel' && typeof value === 'string') return value.trim().toLowerCase() !== 'unknown'
  if ((key === 'summary' || key === 'markdown' || key === 'reportPreview') && typeof value === 'string') {
    return !isPlaceholderText(value)
  }
  return true
}

function isPlaceholderText(value: string) {
  return (
    value.includes('没有可直接展示') ||
    value.includes('暂未返回可汇总') ||
    value.includes('暂未形成可展示') ||
    value.includes('没有可汇总的上游报告内容')
  )
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function arrayText(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 4).join('；') : ''
}

function detectBusinessFailure(finalResult: unknown, nodeOutputs: Record<string, unknown>) {
  const values = [finalResult, nodeOutputs, ...Object.values(nodeOutputs)]
  const text = values.map((value) => stringifyForSearch(value)).join('\n').toLowerCase()
  const hasUnknownRisk = values.some((value) => {
    const record = readRecord(value)
    return typeof record?.riskLevel === 'string' && record.riskLevel.trim().toLowerCase() === 'unknown'
  })
  const hasNoDataSignal = [
    '无法完成有效分析',
    '未提取到指标',
    '未识别到财务数据',
    '文件不适合当前工作流',
    'no data',
    'not enough data'
  ].some((keyword) => text.includes(keyword.toLowerCase()))

  if (!hasUnknownRisk && !hasNoDataSignal) return null

  return {
    businessStatus: 'failed',
    businessMessage: hasNoDataSignal
      ? '分析未完成：未识别到可用于当前工作流的有效数据。'
      : '分析未完成：风险等级为 unknown，说明当前文件无法支持有效业务分析。',
    suggestedAction: '请上传包含有效财务数据的文件，或改用文档总结工作流。'
  }
}

function attachBusinessOutcome(output: Record<string, unknown>, businessFailure: Record<string, unknown> | null) {
  return businessFailure ? { ...output, ...businessFailure } : output
}

function stringifyForSearch(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value ?? '')
  } catch {
    return String(value ?? '')
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

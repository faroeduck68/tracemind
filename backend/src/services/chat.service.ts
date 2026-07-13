import { env } from '../config/env'
import {
  countMessagesByConversation,
  createConversation,
  createMessage,
  findConversation,
  listRecentMessages,
  updateConversationAfterMessage
} from '../models/chat.model'
import { listTools } from '../models/tool.model'
import { makeKey } from '../utils/uuid'
import { extractWeatherCity } from './context.service'
import { chat, LlmMessage } from './llm.service'
import { getRunDetail } from './trace.service'
import { runTool } from './toolRunner.service'
import { hasExplicitWebSearchIntent, isWeatherQuery, needsRealtimeInformation } from './realtimeIntent.service'
import { generateAndSaveWorkflow } from './workflow.service'
import { runWorkflow } from './workflowExecutor.service'

export async function sendChatMessage(input: {
  conversationId?: string
  message: string
  mode?: string
  fileIds?: Array<string | number>
  files?: unknown[]
  workflowId?: number | null
  runId?: number | null
}) {
  const message = input.message.trim()
  if (!message) {
    throw new Error('message is required')
  }

  const conversationId = input.conversationId?.trim() || makeKey('conv')
  const existingConversation = input.conversationId ? await findConversation(input.conversationId) : null
  const title = createConversationTitle(message)

  if (!existingConversation) {
    await createConversation({
      id: conversationId,
      title,
      model: env.openai.model
    })
  }

  const messageCount = await countMessagesByConversation(conversationId)
  const turnIndex = Math.floor(messageCount / 2)
  const userSequence = turnIndex * 2
  const assistantSequence = userSequence + 1

  const userMessageId = await createMessage({
    conversationId,
    role: 'user',
    content: message,
    metadata: {
      messageType: 'user',
      files: input.files ?? [],
      fileIds: input.fileIds ?? [],
      workflowId: input.workflowId ?? null,
      runId: input.runId ?? null
    },
    sequence: userSequence
  })

  const history = await listRecentMessages(conversationId, 10)
  const recentWorkflowContext = await buildRecentWorkflowContext({
    explicitWorkflowId: input.workflowId,
    explicitRunId: input.runId,
    explicitFiles: input.files,
    history
  })
  const explicitFiles = Array.isArray(input.files) ? input.files : []
  const attachedFiles = explicitFiles
  const hasUploadedFiles = explicitFiles.length > 0 || Boolean(input.fileIds?.length)
  const explicitWebSearch = hasExplicitWebSearchIntent(message)

  const weatherToolName = !hasUploadedFiles && isWeatherQuery(message) ? await findWeatherToolName() : ''
  const webSearchToolName =
    explicitWebSearch || (!hasUploadedFiles && needsRealtimeInformation(message)) ? await findWebSearchToolName() : ''

  if (hasUploadedFiles) {
    const workflow = await generateAndSaveWorkflow(message, attachedFiles, {
      conversationId,
      fileIds: input.fileIds
    })
    const run = await runWorkflow(workflow.id, {
      query: message,
      files: attachedFiles,
      fileIds: input.fileIds ?? [],
      conversationId,
      userId: 'default_user'
    })
    const runOutput = readRecord(run.output)
    const warnings = Array.isArray(runOutput?.warnings) ? runOutput.warnings.map(String) : []
    const skippedWebSearch = warnings.some((warning) => warning.includes('已跳过外部资料检索'))
    const baseContent =
      run.status === 'success'
        ? firstString(runOutput?.summary, runOutput?.markdown, '已完成上传文件分析。')
        : run.errorMessage ?? '文件分析工作流执行失败。'
    const content = skippedWebSearch
      ? `已跳过外部联网搜索，正在基于上传文件继续分析。\n\n${baseContent}`
      : baseContent
    const metadata = {
      messageType: run.status === 'success' ? 'file_analysis_result' : 'file_analysis_error',
      workflowId: workflow.id,
      runId: run.runId,
      files: attachedFiles,
      fileIds: input.fileIds ?? [],
      warnings,
      sources: Array.isArray(runOutput?.sources) ? runOutput.sources : []
    }
    const assistantMessageId = await createMessage({
      conversationId,
      role: 'assistant',
      content,
      metadata,
      model: env.openai.model,
      sequence: assistantSequence
    })

    await updateConversationAfterMessage(conversationId, { lastMessage: content, model: env.openai.model })

    return {
      conversationId,
      userMessage: {
        id: userMessageId,
        role: 'user',
        content: message,
        metadata: {
          messageType: 'user',
          files: attachedFiles,
          fileIds: input.fileIds ?? [],
          workflowId: input.workflowId ?? null,
          runId: input.runId ?? null
        },
        sequence: userSequence,
        createdAt: new Date().toISOString()
      },
      assistantMessage: {
        id: assistantMessageId,
        role: 'assistant',
        content,
        metadata,
        model: env.openai.model,
        sequence: assistantSequence,
        createdAt: new Date().toISOString()
      },
      workflowId: workflow.id,
      runId: run.runId
    }
  }

  const recruitmentFollowUp = buildRecruitmentFollowUpAnswer(message, recentWorkflowContext.runOutput)
  if (recruitmentFollowUp) {
    const metadata = {
      messageType: 'recruitment_follow_up',
      workflowId: recentWorkflowContext.workflowId ?? null,
      runId: recentWorkflowContext.runId ?? null,
      files: recentWorkflowContext.files ?? []
    }
    const assistantMessageId = await createMessage({
      conversationId,
      role: 'assistant',
      content: recruitmentFollowUp,
      metadata,
      model: 'recruitment-rules-v1',
      sequence: assistantSequence
    })
    await updateConversationAfterMessage(conversationId, { lastMessage: recruitmentFollowUp, model: 'recruitment-rules-v1' })
    return {
      conversationId,
      userMessage: {
        id: userMessageId,
        role: 'user',
        content: message,
        metadata: { messageType: 'user', workflowId: recentWorkflowContext.workflowId, runId: recentWorkflowContext.runId },
        sequence: userSequence,
        createdAt: new Date().toISOString()
      },
      assistantMessage: {
        id: assistantMessageId,
        role: 'assistant',
        content: recruitmentFollowUp,
        metadata,
        model: 'recruitment-rules-v1',
        sequence: assistantSequence,
        createdAt: new Date().toISOString()
      },
      workflowId: recentWorkflowContext.workflowId ?? null,
      runId: recentWorkflowContext.runId ?? null
    }
  }

  if (isWeatherQuery(message) && !weatherToolName && !webSearchToolName) {
    const content = '当前系统没有联网查询能力：weather_query_tool 和 web_search_tool 均不可用。'
    const assistantMessageId = await createMessage({
      conversationId,
      role: 'assistant',
      content,
      metadata: { messageType: 'weather_missing_tool', missingTools: ['weather_query_tool'] },
      model: env.openai.model,
      sequence: assistantSequence
    })

    await updateConversationAfterMessage(conversationId, { lastMessage: content, model: env.openai.model })

    return {
      conversationId,
      userMessage: {
        id: userMessageId,
        role: 'user',
        content: message,
        metadata: {
          messageType: 'user',
          files: input.files ?? [],
          workflowId: input.workflowId ?? null,
          runId: input.runId ?? null
        },
        sequence: userSequence,
        createdAt: new Date().toISOString()
      },
      assistantMessage: {
        id: assistantMessageId,
        role: 'assistant',
        content,
        metadata: { messageType: 'weather_missing_tool', missingTools: ['weather_query_tool'] },
        model: env.openai.model,
        sequence: assistantSequence,
        createdAt: new Date().toISOString()
      },
      workflowId: null,
      runId: null
    }
  }

  if (isWeatherQuery(message) && weatherToolName) {
    const city = extractWeatherCity(message)
    const result = await runTool(
      weatherToolName,
      { city },
      { userId: 'default_user', query: message, nodeOutputs: {}, nodeInputs: {}, traces: [] },
      { checkPermission: false, manageToolCallLog: false, manageToolStats: true }
    )
    const content = buildWeatherReply(city, result)
    const assistantMessageId = await createMessage({
      conversationId,
      role: 'assistant',
      content,
      metadata: { messageType: result.success ? 'weather_result' : 'weather_error', toolName: weatherToolName, city },
      model: env.openai.model,
      sequence: assistantSequence
    })

    await updateConversationAfterMessage(conversationId, { lastMessage: content, model: env.openai.model })

    return {
      conversationId,
      userMessage: {
        id: userMessageId,
        role: 'user',
        content: message,
        metadata: {
          messageType: 'user',
          files: input.files ?? [],
          workflowId: input.workflowId ?? null,
          runId: input.runId ?? null
        },
        sequence: userSequence,
        createdAt: new Date().toISOString()
      },
      assistantMessage: {
        id: assistantMessageId,
        role: 'assistant',
        content,
        metadata: { messageType: result.success ? 'weather_result' : 'weather_error', toolName: weatherToolName, city },
        model: env.openai.model,
        sequence: assistantSequence,
        createdAt: new Date().toISOString()
      },
      workflowId: null,
      runId: null
    }
  }

  if (needsRealtimeInformation(message) && webSearchToolName) {
    const workflow = await generateAndSaveWorkflow(message, input.files ?? [], { conversationId })
    const run = await runWorkflow(workflow.id, {
      query: message,
      files: input.files ?? [],
      conversationId,
      userId: 'default_user'
    })
    const runOutput = readRecord(run.output)
    const content =
      run.status === 'success'
        ? firstString(runOutput?.summary, runOutput?.markdown)
        : friendlyWebSearchError(run.errorMessage ?? '网页搜索失败。')
    const model = env.openai.model

    const metadata = {
      messageType: run.status === 'success' ? 'web_search_result' : 'web_search_error',
      toolName: webSearchToolName,
      query: message,
      sources: Array.isArray(runOutput?.sources) ? runOutput.sources : [],
      workflowId: workflow.id,
      runId: run.runId
    }
    const assistantMessageId = await createMessage({
      conversationId,
      role: 'assistant',
      content,
      metadata,
      model,
      sequence: assistantSequence
    })

    await updateConversationAfterMessage(conversationId, { lastMessage: content, model })

    return {
      conversationId,
      userMessage: {
        id: userMessageId,
        role: 'user',
        content: message,
        metadata: {
          messageType: 'user',
          files: input.files ?? [],
          workflowId: input.workflowId ?? null,
          runId: input.runId ?? null
        },
        sequence: userSequence,
        createdAt: new Date().toISOString()
      },
      assistantMessage: {
        id: assistantMessageId,
        role: 'assistant',
        content,
        metadata,
        model,
        sequence: assistantSequence,
        createdAt: new Date().toISOString()
      },
      workflowId: workflow.id,
      runId: run.runId
    }
  }

  if (needsRealtimeInformation(message)) {
    const content = '当前系统没有联网查询能力：web_search_tool 不可用。'
    const metadata = { messageType: 'web_search_missing_tool', missingTools: ['web_search_tool'] }
    const assistantMessageId = await createMessage({
      conversationId,
      role: 'assistant',
      content,
      metadata,
      model: env.openai.model,
      sequence: assistantSequence
    })
    await updateConversationAfterMessage(conversationId, { lastMessage: content, model: env.openai.model })
    return {
      conversationId,
      userMessage: {
        id: userMessageId,
        role: 'user',
        content: message,
        metadata: { messageType: 'user' },
        sequence: userSequence,
        createdAt: new Date().toISOString()
      },
      assistantMessage: {
        id: assistantMessageId,
        role: 'assistant',
        content,
        metadata,
        model: env.openai.model,
        sequence: assistantSequence,
        createdAt: new Date().toISOString()
      },
      workflowId: null,
      runId: null
    }
  }

  const messages: LlmMessage[] = [
    {
      role: 'system',
      content:
        '你是 TraceMind Agent，一个工作流编排和财报分析助手。普通问题请直接自然回答；如果用户明确要求生成工作流、分析上传文件或执行任务，可以建议使用工作流功能，但不要假装已经执行。'
    },
    ...history
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map((item) => ({ role: item.role as 'user' | 'assistant', content: item.content }))
  ]

  if (recentWorkflowContext.contextText && (input.runId || input.workflowId || shouldUseRecentDocumentContext(message))) {
    messages.splice(1, 0, {
      role: 'system',
      content: recentWorkflowContext.contextText
    })
  }

  const llmResult = await chat(messages, { temperature: 0.3, maxTokens: 1600 })
  const assistantMessageId = await createMessage({
    conversationId,
    role: 'assistant',
    content: llmResult.content,
    metadata: {
      messageType: 'chat',
      workflowId: recentWorkflowContext.workflowId ?? null,
      runId: recentWorkflowContext.runId ?? null,
      files: recentWorkflowContext.files ?? []
    },
    model: llmResult.model,
    usage: llmResult.usage,
    sequence: assistantSequence
  })

  await updateConversationAfterMessage(conversationId, {
    lastMessage: llmResult.content,
    model: llmResult.model,
    usage: llmResult.usage
  })

  return {
    conversationId,
    userMessage: {
      id: userMessageId,
      role: 'user',
      content: message,
      metadata: {
        messageType: 'user',
        files: input.files ?? [],
        workflowId: input.workflowId ?? null,
        runId: input.runId ?? null
      },
      sequence: userSequence,
      createdAt: new Date().toISOString()
    },
    assistantMessage: {
      id: assistantMessageId,
      role: 'assistant',
      content: llmResult.content,
      metadata: {
        messageType: 'chat',
        workflowId: recentWorkflowContext.workflowId ?? null,
        runId: recentWorkflowContext.runId ?? null,
        files: recentWorkflowContext.files ?? []
      },
      model: llmResult.model,
      usage: llmResult.usage,
      sequence: assistantSequence,
      createdAt: new Date().toISOString()
    },
    workflowId: recentWorkflowContext.workflowId ?? null,
    runId: recentWorkflowContext.runId ?? null
  }
}

function friendlyWebSearchError(message: string) {
  if (message.includes('未配置搜索服务')) {
    return 'web_search_tool 未配置搜索服务，请在后端 .env 中配置 Tavily/Brave/SerpAPI/Bing/阿里云 OpenSearch 任一搜索服务。'
  }
  return message
}

function createConversationTitle(message: string) {
  return message.replace(/\s+/g, ' ').slice(0, 60) || 'New conversation'
}

async function findWeatherToolName() {
  const tools = await listTools()
  const weatherTools = tools.filter((tool) => {
    if (tool.enabled !== 1) return false
    const text = `${tool.name} ${tool.display_name} ${tool.description ?? ''}`.toLowerCase()
    return ['weather', 'forecast', 'temperature', '\u5929\u6c14', '\u6c14\u6e29', '\u9884\u62a5'].some((keyword) =>
      text.includes(keyword.toLowerCase())
    )
  })
  return weatherTools.find((tool) => tool.name === 'weather_query_tool')?.name ?? weatherTools[0]?.name ?? ''
}

async function findWebSearchToolName() {
  const tools = await listTools()
  return tools.find((tool) => tool.enabled === 1 && tool.name === 'web_search_tool')?.name ?? ''
}

function buildWeatherReply(city: string, result: Awaited<ReturnType<typeof runTool>>) {
  if (!result.success) {
    return `天气查询失败：${result.errorMessage ?? result.message ?? '未知错误'}`
  }

  const output = readRecord(result.output)
  const status = firstString(output?.status)
  const info = firstString(output?.info)
  if (status === '0') return `天气查询失败：${info || '天气服务没有返回有效数据'}`

  const cityName = firstString(output?.city, city)
  const weather = firstString(output?.weather)
  const temperature = formatWeatherValue(output?.temperature, '°C')
  const humidity = formatWeatherValue(output?.humidity, '%')
  const wind = [firstString(output?.winddirection), firstString(output?.windpower)].filter(Boolean).join(' ')
  const reporttime = firstString(output?.reporttime)
  const parts = [
    `${cityName || city}当前天气`,
    weather,
    temperature && `温度 ${temperature}`,
    humidity && `湿度 ${humidity}`,
    wind && `风况 ${wind}`,
    reporttime && `更新时间 ${reporttime}`
  ].filter(Boolean)

  return parts.length > 1 ? parts.join('，') : `天气查询完成，但未返回 ${city || '目标城市'} 的天气明细。`
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function arrayText(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).join('、') : ''
}

function formatWeatherValue(value: unknown, unit: string) {
  const text = firstString(value)
  if (!text) return ''
  return text.endsWith(unit) ? text : `${text}${unit}`
}

function shouldUseRecentDocumentContext(message: string) {
  return ['这篇', '这个文件', '这个文档', '这份', '刚才', '上一个', '报告', '文档', '文件', '它'].some((keyword) =>
    message.includes(keyword)
  )
}

async function buildRecentWorkflowContext(input: {
  explicitWorkflowId?: number | null
  explicitRunId?: number | null
  explicitFiles?: unknown[]
  history: Awaited<ReturnType<typeof listRecentMessages>>
}) {
  const parsed = findLatestWorkflowRef(input.history)
  const runId = Number(input.explicitRunId ?? parsed.runId ?? 0) || null
  const workflowId = Number(input.explicitWorkflowId ?? parsed.workflowId ?? 0) || null
  const run = runId ? await getRunDetail(runId) : null
  const files =
    Array.isArray(input.explicitFiles) && input.explicitFiles.length
      ? input.explicitFiles
      : parsed.files.length
        ? parsed.files
        : readFilesFromRun(run?.inputData)

  if (!run && !files.length) {
    return { workflowId, runId, files, runOutput: null, contextText: '' }
  }

  return {
    workflowId: workflowId ?? run?.workflowId ?? null,
    runId,
    files,
    runOutput: run?.outputData ?? null,
    contextText: [
      '以下是用户最近一次上传文件和工作流运行上下文。用户说“这篇报告 / 这个文件 / 刚才那个文档”时，必须优先基于这些内容回答；不要说没有看到文件。',
      `Workflow ID: ${workflowId ?? run?.workflowId ?? '-'}`,
      `Run ID: ${runId ?? '-'}`,
      files.length ? `Uploaded files: ${files.map(readFileName).filter(Boolean).join('、')}` : '',
      run?.outputData ? `Run output:\n${compactJson(run.outputData, 4000)}` : '',
      Array.isArray(run?.trace) && run.trace.length ? `Trace outputs:\n${compactJson(run.trace.map((step) => ({ nodeId: step.nodeId, tool: step.tool, status: step.status, outputData: step.outputData, errorMessage: step.errorMessage })), 6000)}` : ''
    ]
      .filter(Boolean)
      .join('\n\n')
  }
}

function buildRecruitmentFollowUpAnswer(message: string, output: unknown) {
  const record = readRecord(output)
  const rankings = Array.isArray(record?.rankings) ? record.rankings.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>> : []
  if (rankings.length === 0) return ''
  if (!/(为什么|多少分|评分|得分|排名|匹配|技能|学历|经验|推荐|候选人)/.test(message)) return ''

  const selected = rankings.find((item) => {
    const name = firstString(item.name)
    return name && message.includes(name)
  })

  if (selected) {
    const breakdown = readRecord(selected.scoreBreakdown)
    const breakdownText = breakdown
      ? `技能 ${firstString(breakdown.skills)} 分 + 学历 ${firstString(breakdown.education)} 分 + 经验 ${firstString(breakdown.experience)} 分 + 信息完整度 ${firstString(breakdown.completeness)} 分 + 加分技能 ${firstString(breakdown.preferredSkillsBonus)} 分 = ${firstString(breakdown.total)} 分`
      : `总分 ${firstString(selected.score)} 分`
    return [
      `${firstString(selected.name)}的匹配分是 ${firstString(selected.score)} 分。`,
      `评分构成：${breakdownText}。`,
      `匹配技能：${arrayText(selected.matchedSkills) || '无'}。`,
      `缺失技能：${arrayText(selected.missingSkills) || '无'}。`,
      `工作经验：${firstString(selected.experienceYears) || '0'} 年；学历：${firstString(selected.education) || '未识别'}。`,
      `最终建议：${firstString(selected.recommendation) || '暂无'}。`
    ].join('\n')
  }

  if (/(排名|排序|候选人)/.test(message)) {
    return ['本次候选人排名：', ...rankings.map((item) => `${item.rank}. ${item.name}：${item.score} 分，${item.recommendation}`)].join('\n')
  }
  return ''
}

function findLatestWorkflowRef(history: Awaited<ReturnType<typeof listRecentMessages>>) {
  for (const message of [...history].reverse()) {
    const metadata = readRecord(message.metadata)
    const workflowId =
      Number(metadata?.workflowId ?? 0) ||
      matchNumber(message.content, /Workflow ID\D+(\d+)/i) ||
      matchNumber(message.content, /workflowId\D+(\d+)/i)
    const runId =
      Number(metadata?.runId ?? 0) ||
      matchNumber(message.content, /Run ID\D+(\d+)/i) ||
      matchNumber(message.content, /runId\D+(\d+)/i)
    const files = Array.isArray(metadata?.files) ? metadata.files : []
    if (workflowId || runId || files.length) return { workflowId, runId, files }
  }
  return { workflowId: null, runId: null, files: [] as unknown[] }
}

function readRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function matchNumber(text: string, pattern: RegExp) {
  const matched = text.match(pattern)
  return matched?.[1] ? Number(matched[1]) : null
}

function readFilesFromRun(inputData: unknown) {
  if (!inputData || typeof inputData !== 'object') return []
  const files = (inputData as { files?: unknown }).files
  return Array.isArray(files) ? files : []
}

function readFileName(file: unknown) {
  if (!file || typeof file !== 'object') return ''
  const record = file as Record<string, unknown>
  return String(record.originalName ?? record.filename ?? record.name ?? '').trim()
}

function compactJson(value: unknown, limit: number) {
  const text = JSON.stringify(value, null, 2)
  return text.length > limit ? `${text.slice(0, limit)}\n...` : text
}

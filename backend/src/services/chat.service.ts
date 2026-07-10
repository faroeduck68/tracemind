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
import { chat, LlmMessage } from './llm.service'
import { getRunDetail } from './trace.service'

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

  if (isWeatherQuery(message) && !(await hasWeatherTool())) {
    const content = '当前系统没有天气查询工具，无法实时查询天气。可以为系统新增 weather_query_tool 后支持该能力。'
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

  if (recentWorkflowContext.contextText && shouldUseRecentDocumentContext(message)) {
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

function createConversationTitle(message: string) {
  return message.replace(/\s+/g, ' ').slice(0, 60) || 'New conversation'
}

function isWeatherQuery(message: string) {
  const normalized = message.toLowerCase()
  return ['天气', '气温', 'weather', 'temperature', 'forecast'].some((keyword) => normalized.includes(keyword))
}

async function hasWeatherTool() {
  const tools = await listTools()
  return tools.some((tool) => {
    if (tool.enabled !== 1) return false
    const text = `${tool.name} ${tool.display_name} ${tool.description ?? ''}`.toLowerCase()
    return ['weather', 'forecast', 'temperature', '天气', '气温'].some((keyword) => text.includes(keyword.toLowerCase()))
  })
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
    return { workflowId, runId, files, contextText: '' }
  }

  return {
    workflowId: workflowId ?? run?.workflowId ?? null,
    runId,
    files,
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

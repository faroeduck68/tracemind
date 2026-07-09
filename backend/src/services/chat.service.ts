import { env } from '../config/env'
import {
  countMessagesByConversation,
  createConversation,
  createMessage,
  findConversation,
  listRecentMessages,
  touchConversation
} from '../models/chat.model'
import { toolRegistry } from '../tools'
import { makeKey } from '../utils/uuid'
import { chat, LlmMessage } from './llm.service'

export async function sendChatMessage(input: { conversationId?: string; message: string; mode?: string }) {
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
    sequence: userSequence
  })

  const history = await listRecentMessages(conversationId, 10)

  if (isWeatherQuery(message) && !hasWeatherTool()) {
    const content = '当前系统没有天气查询工具，无法实时查询天气。可以为系统新增 weather_tool 后支持该能力。'
    const assistantMessageId = await createMessage({
      conversationId,
      role: 'assistant',
      content,
      model: env.openai.model,
      sequence: assistantSequence
    })

    await touchConversation(conversationId, { model: env.openai.model, status: 'active' })

    return {
      conversationId,
      userMessage: {
        id: userMessageId,
        role: 'user',
        content: message,
        sequence: userSequence,
        createdAt: new Date().toISOString()
      },
      assistantMessage: {
        id: assistantMessageId,
        role: 'assistant',
        content,
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

  const llmResult = await chat(messages, { temperature: 0.3, maxTokens: 1600 })
  const assistantMessageId = await createMessage({
    conversationId,
    role: 'assistant',
    content: llmResult.content,
    model: llmResult.model,
    usage: llmResult.usage,
    sequence: assistantSequence
  })

  await touchConversation(conversationId, { model: llmResult.model, status: 'active' })

  return {
    conversationId,
    userMessage: {
      id: userMessageId,
      role: 'user',
      content: message,
      sequence: userSequence,
      createdAt: new Date().toISOString()
    },
    assistantMessage: {
      id: assistantMessageId,
      role: 'assistant',
      content: llmResult.content,
      model: llmResult.model,
      usage: llmResult.usage,
      sequence: assistantSequence,
      createdAt: new Date().toISOString()
    },
    workflowId: null,
    runId: null
  }
}

function createConversationTitle(message: string) {
  return message.replace(/\s+/g, ' ').slice(0, 60) || 'New conversation'
}

function isWeatherQuery(message: string) {
  const normalized = message.toLowerCase()
  return ['天气', '气温', 'weather', 'temperature', 'forecast'].some((keyword) => normalized.includes(keyword))
}

function hasWeatherTool() {
  return 'weather_tool' in toolRegistry
}

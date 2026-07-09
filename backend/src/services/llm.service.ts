import OpenAI from 'openai'
import { env } from '../config/env'

export type LlmRole = 'system' | 'user' | 'assistant'

export type LlmMessage = {
  role: LlmRole
  content: string
}

export type CallLlmOptions = {
  json?: boolean
  temperature?: number
  maxTokens?: number
}

export type LlmCallResult = {
  content: string
  model: string
  baseURL: string
  usage?: unknown
}

export class LlmServiceError extends Error {
  status?: number
  details?: unknown

  constructor(message: string, status?: number, details?: unknown) {
    super(message)
    this.name = 'LlmServiceError'
    this.status = status
    this.details = details
  }
}

export async function callLLM(messages: LlmMessage[], options: CallLlmOptions = {}): Promise<LlmCallResult> {
  if (env.mockMode) {
    throw new LlmServiceError('MOCK_MODE=true, real LLM calls are disabled.')
  }

  if (!env.useRealLlm) {
    throw new LlmServiceError('USE_REAL_LLM=false, real LLM calls are disabled.')
  }

  if (!env.openai.apiKey) {
    throw new LlmServiceError('OPENAI_API_KEY is not configured.')
  }

  const baseURL = env.openai.baseURL.replace(/\/+$/, '')
  const client = new OpenAI({
    apiKey: env.openai.apiKey,
    baseURL
  })

  try {
    const response = await client.chat.completions.create({
      model: env.openai.model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 2048,
      ...(options.json ? { response_format: { type: 'json_object' } } : {})
    })

    const content = response.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      throw new LlmServiceError('LLM response did not contain choices[0].message.content.', undefined, response)
    }

    return {
      content,
      model: String(response.model ?? env.openai.model),
      baseURL,
      usage: response.usage
    }
  } catch (error) {
    if (error instanceof LlmServiceError) throw error
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : undefined
    const message = error instanceof Error ? error.message : 'Unknown LLM request error'
    throw new LlmServiceError(`LLM request failed${status ? ` with HTTP ${status}` : ''}: ${message}`, status, error)
  }
}

export async function chat(messages: LlmMessage[], options: CallLlmOptions = {}) {
  return callLLM(messages, options)
}

export async function testLLM() {
  const result = await callLLM(
    [
      {
        role: 'system',
        content: 'You are a connectivity test endpoint. Reply with a short Chinese sentence.'
      },
      {
        role: 'user',
        content: '请回复：TraceMind LLM connected.'
      }
    ],
    { temperature: 0, maxTokens: 80 }
  )

  return {
    success: true,
    model: result.model,
    baseURL: result.baseURL,
    message: result.content,
    apiKeyConfigured: Boolean(env.openai.apiKey),
    apiKeyPreview: maskApiKey(env.openai.apiKey)
  }
}

export function parseLlmJson<T>(content: string): T {
  const trimmed = content.trim()
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  return JSON.parse(withoutFence) as T
}

function maskApiKey(value: string) {
  if (!value) return ''
  if (value.length <= 8) return '****'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

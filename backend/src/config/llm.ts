import { env } from './env'

export const llmConfig = {
  enabled: env.useRealLlm && !env.mockMode,
  provider: env.openai.baseURL.includes('deepseek') ? 'deepseek' : 'openai-compatible',
  model: env.openai.model,
  baseURL: env.openai.baseURL,
  mockMode: env.mockMode,
  allowMockFallback: env.allowMockFallback
}

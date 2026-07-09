import { Request, Response } from 'express'
import { env } from '../config/env'
import { testLLM } from '../services/llm.service'
import { sendSuccess } from '../utils/response'

export async function testLlmController(_req: Request, res: Response) {
  try {
    return sendSuccess(res, await testLLM(), 'LLM connected')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown LLM test error'
    return sendSuccess(
      res,
      {
        success: false,
        model: env.openai.model,
        baseURL: env.openai.baseURL,
        message,
        apiKeyConfigured: Boolean(env.openai.apiKey),
        apiKeyPreview: env.openai.apiKey ? `${env.openai.apiKey.slice(0, 4)}...${env.openai.apiKey.slice(-4)}` : ''
      },
      'LLM test failed',
      502
    )
  }
}

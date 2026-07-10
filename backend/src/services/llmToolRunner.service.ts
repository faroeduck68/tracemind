import { ToolRow } from '../models/tool.model'
import { parseJson } from '../utils/json'
import { callLLM, parseLlmJson } from './llm.service'

type LlmToolConfig = {
  promptTemplate?: string
  responseFormat?: 'json' | 'text'
  temperature?: number
}

export async function runLlmTool(tool: ToolRow, input: unknown, context: unknown) {
  const config = parseJson<LlmToolConfig>(tool.config_json, {})
  if (!config.promptTemplate) throw new Error(`LLM tool ${tool.name} is missing config_json.promptTemplate.`)

  const prompt = renderTemplate(config.promptTemplate, input, context)
  const result = await callLLM(
    [
      {
        role: 'system',
        content: config.responseFormat === 'json' ? 'Return only valid JSON.' : 'Return a concise, useful answer.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    {
      json: config.responseFormat === 'json',
      temperature: Number(config.temperature ?? 0.2),
      maxTokens: 1200
    }
  )

  return {
    success: true,
    output: config.responseFormat === 'json' ? parseLlmJson(result.content) : { text: result.content },
    trace: {
      model: result.model,
      responseFormat: config.responseFormat ?? 'text'
    }
  }
}

function renderTemplate(template: string, input: unknown, context: unknown) {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path: string) => {
    const value = readPath({ input, context }, path)
    return value == null ? '' : String(value)
  })
}

function readPath(source: unknown, path: string) {
  const segments = path.replace(/\[(\d+)]/g, '.$1').split('.').filter(Boolean)
  let current: unknown = source
  for (const segment of segments) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

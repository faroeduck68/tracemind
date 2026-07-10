import { ToolRow } from '../models/tool.model'
import { toolRegistry } from '../tools'
import { WorkflowContext } from '../types/context'

export async function runBuiltinTool(tool: ToolRow, input: unknown, context: WorkflowContext | Record<string, unknown>) {
  const builtin = toolRegistry[tool.name as keyof typeof toolRegistry]
  if (!builtin) {
    throw new Error(`Builtin tool is not registered: ${tool.name}`)
  }

  if ('currentNodeId' in context && typeof context.currentNodeId === 'string') {
    ;(context as WorkflowContext).nodeInputs[context.currentNodeId] = input
  }

  return builtin.run(context as WorkflowContext)
}

import { ToolRow } from '../models/tool.model'
import { WorkflowContext } from '../types/context'
import { ToolResult } from '../types/tool'

export async function runMcpTool(
  tool: ToolRow,
  input: unknown,
  context: WorkflowContext | Record<string, unknown>
): Promise<ToolResult> {
  return {
    success: false,
    output: {
      phase: 'mcp-client-placeholder',
      toolName: tool.name,
      mcpServerId: tool.mcp_server_id,
      mcpToolName: tool.mcp_tool_name,
      input,
      context: {
        runId: readContextValue(context, 'runId'),
        workflowId: readContextValue(context, 'workflowId'),
        currentNodeId: readContextValue(context, 'currentNodeId')
      }
    },
    errorMessage: `MCP tool runner is a phase-1 placeholder: ${tool.name}`,
    reason: 'MCP Client protocol integration is planned for phase 2.'
  }
}

function readContextValue(context: unknown, key: string) {
  return context && typeof context === 'object' ? (context as Record<string, unknown>)[key] : undefined
}

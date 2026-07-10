import { NodeStatus } from './common'
import { WorkflowContext } from './context'

export type ToolResult = {
  success: boolean
  output: unknown
  message?: string
  status?: NodeStatus
  errorMessage?: string
  businessFailure?: boolean
  reason?: string
}

export type TraceMindTool = {
  name: string
  displayName: string
  run(context: WorkflowContext): Promise<ToolResult>
}

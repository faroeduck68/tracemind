import { WorkflowContext } from './context'

export type ToolResult = {
  success: boolean
  output: unknown
  message?: string
}

export type TraceMindTool = {
  name: string
  displayName: string
  run(context: WorkflowContext): Promise<ToolResult>
}

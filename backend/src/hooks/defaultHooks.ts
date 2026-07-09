import { registerHook } from './hookRegistry'
import { beforeWorkflowRunHook, afterWorkflowRunHook } from './workflowRun.hooks'
import { cleanWorkflowJsonHook, fillNodePositionHook } from './workflowGenerate.hooks'
import { afterNodeTraceHook, beforeNodeTraceHook, nodeErrorAnalysisHook } from './nodeRun.hooks'
import { cleanupTempFilesHook, workflowSummaryHook } from './stop.hooks'
import {
  dependencyCheckHook,
  fileOutputHook,
  inputSchemaCheckHook,
  outputSchemaCheckHook,
  permissionPreToolHook,
  postToolTraceHook,
  toolCallStartHook
} from './toolUse.hooks'
import { injectToolContextHook, userPromptLogHook } from './userPromptSubmit.hooks'

let registered = false

export function registerDefaultHooks() {
  if (registered) return
  registered = true

  registerHook('UserPromptSubmit', userPromptLogHook)
  registerHook('UserPromptSubmit', injectToolContextHook)

  registerHook('BeforeWorkflowRun', beforeWorkflowRunHook)
  registerHook('AfterWorkflowRun', afterWorkflowRunHook)

  registerHook('AfterWorkflowGenerate', cleanWorkflowJsonHook)
  registerHook('AfterWorkflowGenerate', fillNodePositionHook)

  registerHook('BeforeNodeRun', beforeNodeTraceHook)
  registerHook('AfterNodeRun', afterNodeTraceHook)
  registerHook('OnNodeError', nodeErrorAnalysisHook)

  registerHook('PreToolUse', toolCallStartHook)
  registerHook('PreToolUse', permissionPreToolHook)
  registerHook('PreToolUse', dependencyCheckHook)
  registerHook('PreToolUse', inputSchemaCheckHook)

  registerHook('PostToolUse', outputSchemaCheckHook)
  registerHook('PostToolUse', fileOutputHook)
  registerHook('PostToolUse', postToolTraceHook)

  registerHook('Stop', workflowSummaryHook)
  registerHook('Stop', cleanupTempFilesHook)
}

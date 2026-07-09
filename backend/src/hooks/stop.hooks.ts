import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { WorkflowContext } from '../types/context'
import type { HookContext, HookResult } from './hookTypes'

export function workflowSummaryHook(ctx: HookContext): HookResult {
  const workflowContext = ctx.context as WorkflowContext | undefined
  const nodeCount = Object.keys(workflowContext?.nodeOutputs ?? {}).length
  const failureCount = workflowContext?.failures?.length ?? 0
  const startedAt = workflowContext?.hookState?.workflowStartedAt
  const totalLatencyMs = startedAt ? Date.now() - startedAt : undefined

  const summary = {
    runId: ctx.runId,
    workflowId: ctx.workflowId,
    status: failureCount > 0 || ctx.error ? 'failed' : 'success',
    executedNodeCount: nodeCount,
    failureCount,
    mockUsage: workflowContext?.mockUsage ?? [],
    totalLatencyMs
  }

  if (workflowContext) {
    workflowContext.runSummary = summary
  }

  return {
    outcome: 'success',
    message: `Workflow summary generated: ${nodeCount} node(s), ${failureCount} failure(s).`
  }
}

export async function cleanupTempFilesHook(ctx: HookContext): Promise<HookResult> {
  const workflowContext = ctx.context as WorkflowContext | undefined
  const tempFiles = workflowContext?.hookState?.tempFiles ?? []
  let cleaned = 0

  for (const filePath of tempFiles) {
    if (!isSafeTempPath(filePath)) continue
    try {
      await fs.rm(filePath, { force: true })
      cleaned += 1
    } catch {
      // Cleanup is best-effort and should not block workflow completion.
    }
  }

  return {
    outcome: 'success',
    message: `Cleaned ${cleaned} temporary file(s).`
  }
}

function isSafeTempPath(filePath: string) {
  const resolved = path.resolve(filePath)
  const tmpRoot = path.resolve(os.tmpdir())
  const uploadTmpRoot = path.resolve(process.cwd(), 'uploads', 'tmp')

  return resolved.startsWith(tmpRoot) || resolved.startsWith(uploadTmpRoot)
}

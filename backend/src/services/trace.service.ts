import { findWorkflowRunById, listRecentWorkflowRuns, listRecentWorkflowRunsPaginated, WorkflowRunRow } from '../models/workflowRun.model'
import { listTraceStepsByRunId, TraceStepRow } from '../models/traceStep.model'
import { parseJson } from '../utils/json'
import { mapPageResult, PaginationOptions } from '../utils/pagination'
import { summarize } from '../utils/summarize'
import { formatClock, formatLatency } from '../utils/time'
import { getWorkflow } from './workflow.service'

export async function getTraceForRun(runId: number) {
  const rows = await listTraceStepsByRunId(runId)
  return rows.map(toTraceStep)
}

export async function getTraceDetailsForRun(runId: number) {
  const rows = await listTraceStepsByRunId(runId)
  return rows.map((row) => ({
    ...toTraceStep(row),
    stepType: row.step_type ?? undefined,
    reason: row.reason ?? undefined,
    confidence: row.confidence == null ? undefined : Number(row.confidence),
    inputData: parseJson(row.input_data, null),
    outputData: parseJson(row.output_data, null),
    errorMessage: row.error_message ?? undefined,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined
  }))
}

export async function getRunDetail(runId: number) {
  const run = await findWorkflowRunById(runId)
  if (!run) return null

  return {
    id: run.id,
    workflowId: run.workflow_id,
    workflowName: run.workflow_name,
    conversationId: run.conversation_id,
    status: run.status,
    inputData: parseJson(run.input_data, null),
    outputData: parseJson(run.output_data, null),
    fileIds: parseJson(run.file_ids, []),
    files: readFilesFromInput(run.input_data),
    summary: run.summary ?? '',
    totalLatencyMs: run.total_latency_ms,
    totalTokens: run.total_tokens,
    errorMessage: run.error_message,
    failureAnalysis: parseJson(run.failure_analysis, null),
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    trace: await getTraceDetailsForRun(runId)
  }
}

export async function getRunHistory(limitOrPagination: number | PaginationOptions = 50) {
  const rows = typeof limitOrPagination === 'number'
    ? await listRecentWorkflowRuns(limitOrPagination)
    : await listRecentWorkflowRunsPaginated(limitOrPagination)
  return Array.isArray(rows) ? rows.map(mapRunHistoryRow) : mapPageResult(rows, mapRunHistoryRow)
}

function mapRunHistoryRow(run: WorkflowRunRow) {
  return {
    id: run.id,
    workflowId: run.workflow_id,
    workflowName: run.workflow_name,
    conversationId: run.conversation_id,
    status: run.status,
    inputData: parseJson(run.input_data, null),
    outputData: parseJson(run.output_data, null),
    fileIds: parseJson(run.file_ids, []),
    files: readFilesFromInput(run.input_data),
    summary: run.summary ?? '',
    errorMessage: run.error_message,
    totalLatencyMs: run.total_latency_ms,
    totalTokens: run.total_tokens,
    failureAnalysis: parseJson(run.failure_analysis, null),
    startedAt: run.started_at,
    finishedAt: run.finished_at
  }
}

export async function getRunReplay(runId: number) {
  const run = await getRunDetail(runId)
  if (!run) return null

  const workflow = await getWorkflow(run.workflowId)
  return {
    workflow,
    run,
    traceSteps: run.trace
  }
}

function toTraceStep(row: TraceStepRow) {
  const inputData = parseJson(row.input_data, null)
  const outputData = parseJson(row.output_data, null)

  return {
    id: `t${row.id}`,
    runId: row.run_id,
    workflowId: row.workflow_id,
    stepOrder: Number(row.step_order ?? 0),
    stepName: row.step_name,
    nodeId: row.node_key ?? undefined,
    time: formatClock(row.started_at),
    status: row.status,
    tool: row.tool_name ?? undefined,
    reason: row.reason ?? undefined,
    latency: formatLatency(row.latency_ms),
    latencyMs: row.latency_ms ?? undefined,
    inputData,
    outputData,
    inputSummary: row.input_summary ?? summarize(inputData),
    outputSummary: row.output_summary ?? summarize(outputData),
    errorMessage: row.error_message ?? undefined,
    permissionBehavior: undefined,
    permissionReason: undefined,
    approvalId: undefined
  }
}

function readFilesFromInput(inputData: unknown) {
  const input = parseJson<Record<string, unknown>>(inputData, {})
  return Array.isArray(input.files) ? input.files : []
}

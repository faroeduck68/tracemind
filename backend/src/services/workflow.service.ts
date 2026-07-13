import {
  createWorkflowWithGraph,
  deleteWorkflowById,
  edgeRowToWorkflowEdge,
  findWorkflowById,
  listEdgesByWorkflowId,
  listWorkflowHistory,
  listNodesByWorkflowId,
  listWorkflows,
  listWorkflowsByConversationId,
  nodeRowToWorkflowNode,
  updateWorkflowWithGraph,
  WorkflowHistoryRow,
  WorkflowRow
} from '../models/workflow.model'
import { listWorkflowRuns, WorkflowRunRow } from '../models/workflowRun.model'
import { listEnabledMemories } from '../models/memory.model'
import { WorkflowGraph } from '../types/workflow'
import { parseJson } from '../utils/json'
import { validateDag } from '../utils/dagValidator'
import { mapPageResult, PaginationOptions } from '../utils/pagination'
import { generateWorkflowFromQuery } from './workflowGenerator.service'

export async function generateAndSaveWorkflow(
  query: string,
  files: unknown[] = [],
  options: {
    conversationId?: string | null
    fileIds?: Array<string | number>
    attachments?: unknown[]
  } = {}
) {
  const memories = await listEnabledMemories(5)
  const graph = await generateWorkflowFromQuery(query, memories, {
    files,
    fileIds: options.fileIds,
    attachments: options.attachments
  })
  const id = await createWorkflowWithGraph(graph, { conversationId: options.conversationId })
  return { ...graph, id, conversationId: options.conversationId ?? null }
}

export async function getWorkflow(id: number) {
  const workflow = await findWorkflowById(id)
  if (!workflow) return null

  const nodes = (await listNodesByWorkflowId(id)).map(nodeRowToWorkflowNode)
  const edges = (await listEdgesByWorkflowId(id)).map(edgeRowToWorkflowEdge)

  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    sourceType: workflow.source_type,
    originalQuery: workflow.original_query,
    intent: workflow.intent,
    workflowType: workflow.workflow_type,
    confidence: Number(workflow.confidence ?? 0),
    status: workflow.status,
    nodeCount: Number(workflow.node_count ?? nodes.length),
    edgeCount: Number(workflow.edge_count ?? edges.length),
    conversationId: workflow.conversation_id,
    nodes,
    edges,
    createdAt: workflow.created_at,
    updatedAt: workflow.updated_at
  }
}

export async function getWorkflowGraphForExecution(id: number): Promise<WorkflowGraph | null> {
  const workflow = await findWorkflowById(id)
  if (!workflow) return null

  const nodes = (await listNodesByWorkflowId(id)).map(nodeRowToWorkflowNode)
  const edges = (await listEdgesByWorkflowId(id)).map(edgeRowToWorkflowEdge)
  validateDag(nodes, edges)

  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description ?? undefined,
    sourceType: workflow.source_type,
    originalQuery: workflow.original_query ?? undefined,
    intent: workflow.intent,
    workflowType: workflow.workflow_type ?? undefined,
    confidence: Number(workflow.confidence ?? 0),
    status: workflow.status,
    nodes,
    edges
  }
}

export async function getWorkflowList(pagination?: PaginationOptions) {
  const workflows = pagination ? await listWorkflows(pagination) : await listWorkflows()
  const mapper = (workflow: WorkflowRow) => ({
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    sourceType: workflow.source_type,
    originalQuery: workflow.original_query,
    intent: workflow.intent,
    workflowType: workflow.workflow_type,
    confidence: Number(workflow.confidence ?? 0),
    status: workflow.status,
    nodeCount: Number(workflow.node_count ?? 0),
    edgeCount: Number(workflow.edge_count ?? 0),
    conversationId: workflow.conversation_id,
    workflowJson: parseJson(workflow.workflow_json, null),
    createdAt: workflow.created_at,
    updatedAt: workflow.updated_at
  })
  return Array.isArray(workflows) ? workflows.map(mapper) : mapPageResult(workflows, mapper)
}

export async function updateWorkflow(id: number, graph: WorkflowGraph) {
  validateDag(graph.nodes, graph.edges)
  await updateWorkflowWithGraph(id, graph)
  return getWorkflow(id)
}

export async function removeWorkflow(id: number) {
  return deleteWorkflowById(id)
}

export async function getWorkflowHistory(pagination?: PaginationOptions) {
  const rows = pagination ? await listWorkflowHistory(pagination) : await listWorkflowHistory()
  return Array.isArray(rows) ? rows.map(mapWorkflowHistoryRow) : mapPageResult(rows, mapWorkflowHistoryRow)
}

export async function getConversationWorkflows(conversationId: string, pagination?: PaginationOptions) {
  const rows = pagination ? await listWorkflowsByConversationId(conversationId, pagination) : await listWorkflowsByConversationId(conversationId)
  return Array.isArray(rows) ? rows.map(mapWorkflowHistoryRow) : mapPageResult(rows, mapWorkflowHistoryRow)
}

export async function getWorkflowRuns(workflowId: number, pagination?: PaginationOptions) {
  const rows = pagination ? await listWorkflowRuns(workflowId, pagination) : await listWorkflowRuns(workflowId)
  const mapper = (run: WorkflowRunRow) => ({
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
  })
  return Array.isArray(rows) ? rows.map(mapper) : mapPageResult(rows, mapper)
}

function mapWorkflowHistoryRow(row: WorkflowHistoryRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sourceType: row.source_type,
    originalQuery: row.original_query,
    intent: row.intent,
    workflowType: row.workflow_type,
    confidence: Number(row.confidence ?? 0),
    status: row.status,
    nodeCount: Number(row.node_count ?? 0),
    edgeCount: Number(row.edge_count ?? 0),
    conversationId: row.conversation_id,
    latestRunId: row.latest_run_id,
    latestRunStatus: row.latest_run_status,
    latestRunStartedAt: row.latest_run_started_at,
    latestRunFinishedAt: row.latest_run_finished_at,
    workflowJson: parseJson(row.workflow_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function readFilesFromInput(inputData: unknown) {
  const input = parseJson<Record<string, unknown>>(inputData, {})
  return Array.isArray(input.files) ? input.files : []
}

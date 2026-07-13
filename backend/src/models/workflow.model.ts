import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query, withTransaction } from '../config/db'
import { WorkflowEdge, WorkflowEdgeRow, WorkflowGraph, WorkflowNode, WorkflowNodeRow } from '../types/workflow'
import { parseJson, stringifyJson } from '../utils/json'
import { pageResult, PaginationOptions, PageResult } from '../utils/pagination'
import { ensureWorkflowHistoryTables } from './workflowHistorySchema.model'

export type WorkflowRow = RowDataPacket & {
  id: number
  name: string
  description: string | null
  source_type: string
  original_query: string | null
  intent: string
  workflow_type: string | null
  confidence: string | number | null
  status: string
  node_count: number | null
  edge_count: number | null
  workflow_json: unknown
  conversation_id: string | null
  created_at: string
  updated_at: string
}

export type WorkflowHistoryRow = WorkflowRow & {
  latest_run_id: number | null
  latest_run_status: string | null
  latest_run_started_at: string | null
  latest_run_finished_at: string | null
}

export async function createWorkflowWithGraph(graph: WorkflowGraph, options: { conversationId?: string | null } = {}) {
  await ensureWorkflowHistoryTables()
  return withTransaction(async (connection) => {
    const [workflowResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO workflows
       (name, description, source_type, original_query, intent, workflow_type, confidence, status, node_count, edge_count, workflow_json, conversation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        graph.name,
        graph.description ?? null,
        graph.sourceType ?? 'generated',
        graph.originalQuery ?? null,
        graph.intent,
        inferWorkflowType(graph),
        graph.confidence,
        graph.status ?? 'draft',
        graph.nodes.length,
        graph.edges.length,
        stringifyJson({
          name: graph.name,
          description: graph.description,
          intent: graph.intent,
          workflowType: inferWorkflowType(graph),
          confidence: graph.confidence,
          nodes: graph.nodes,
          edges: graph.edges
        }),
        options.conversationId ?? null
      ]
    )

    const workflowId = workflowResult.insertId
    await insertNodes(connection, workflowId, graph.nodes)
    await insertEdges(connection, workflowId, graph.edges)

    return workflowId
  })
}

export async function updateWorkflowWithGraph(workflowId: number, graph: WorkflowGraph) {
  await ensureWorkflowHistoryTables()
  return withTransaction(async (connection) => {
    await connection.execute(
      `UPDATE workflows
       SET name = ?, description = ?, source_type = ?, original_query = ?, intent = ?, workflow_type = ?, confidence = ?, status = ?, node_count = ?, edge_count = ?, workflow_json = ?
       WHERE id = ?`,
      [
        graph.name,
        graph.description ?? null,
        graph.sourceType ?? 'manual',
        graph.originalQuery ?? null,
        graph.intent,
        inferWorkflowType(graph),
        graph.confidence,
        graph.status ?? 'draft',
        graph.nodes.length,
        graph.edges.length,
        stringifyJson({
          id: workflowId,
          name: graph.name,
          description: graph.description,
          intent: graph.intent,
          workflowType: inferWorkflowType(graph),
          confidence: graph.confidence,
          nodes: graph.nodes,
          edges: graph.edges
        }),
        workflowId
      ]
    )

    await connection.execute('DELETE FROM workflow_edges WHERE workflow_id = ?', [workflowId])
    await connection.execute('DELETE FROM workflow_nodes WHERE workflow_id = ?', [workflowId])
    await insertNodes(connection, workflowId, graph.nodes)
    await insertEdges(connection, workflowId, graph.edges)
  })
}

async function insertNodes(connection: PoolConnection, workflowId: number, nodes: WorkflowNode[]) {
  for (const node of nodes) {
    await connection.execute(
      `INSERT INTO workflow_nodes
       (workflow_id, node_key, node_type, label, sub_label, icon, x, y, status, tone, tool_name, confidence, reason, config, input_schema, output_schema)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workflowId,
        node.id,
        node.type,
        node.label,
        node.subLabel,
        node.icon,
        node.position.x,
        node.position.y,
        node.status,
        node.tone,
        node.toolName ?? node.tool,
        node.confidence,
        node.reason,
        stringifyJson({
          ...(node.config && typeof node.config === 'object' && !Array.isArray(node.config) ? node.config : {}),
          displayName: node.displayName,
          toolReason: node.toolReason,
          roleInWorkflow: node.roleInWorkflow,
          inputSummary: node.inputSummary,
          outputSummary: node.outputSummary,
          candidateTools: node.candidateTools ?? []
        }),
        stringifyJson(node.inputSchema ?? null),
        stringifyJson(node.outputSchema ?? null)
      ]
    )
  }
}

async function insertEdges(connection: PoolConnection, workflowId: number, edges: WorkflowEdge[]) {
  for (const edge of edges) {
    await connection.execute(
      `INSERT INTO workflow_edges
       (workflow_id, edge_key, source_node_key, target_node_key, branch)
       VALUES (?, ?, ?, ?, ?)`,
      [workflowId, edge.id, edge.source, edge.target, edge.branch ?? 'main']
    )
  }
}

export async function listWorkflows(): Promise<WorkflowRow[]>
export async function listWorkflows(pagination: PaginationOptions): Promise<PageResult<WorkflowRow>>
export async function listWorkflows(pagination?: PaginationOptions) {
  await ensureWorkflowHistoryTables()
  const sql = `SELECT id, name, description, source_type, original_query, intent, workflow_type, confidence, status, node_count, edge_count, workflow_json, conversation_id, created_at, updated_at
               FROM workflows
               ORDER BY updated_at DESC`
  if (!pagination) return query<WorkflowRow[]>(sql)

  const rows = await query<WorkflowRow[]>(`${sql} LIMIT ? OFFSET ?`, [pagination.pageSize, pagination.offset])
  const totalRows = await query<(RowDataPacket & { total: number })[]>('SELECT COUNT(*) AS total FROM workflows')
  return pageResult(rows, Number(totalRows[0]?.total ?? 0), pagination)
}

export async function findWorkflowById(id: number) {
  await ensureWorkflowHistoryTables()
  const rows = await query<WorkflowRow[]>(
    `SELECT id, name, description, source_type, original_query, intent, workflow_type, confidence, status, node_count, edge_count, workflow_json, conversation_id, created_at, updated_at
     FROM workflows
     WHERE id = ?`,
    [id]
  )

  return rows[0] ?? null
}

export async function deleteWorkflowById(id: number) {
  await ensureWorkflowHistoryTables()
  return execute<ResultSetHeader>('DELETE FROM workflows WHERE id = ?', [id])
}

export async function listNodesByWorkflowId(workflowId: number) {
  await ensureWorkflowHistoryTables()
  return query<(RowDataPacket & WorkflowNodeRow)[]>(
    `SELECT id, workflow_id, node_key, node_type, label, sub_label, icon, x, y, status, tone, tool_name, confidence, reason, config, input_schema, output_schema
     FROM workflow_nodes
     WHERE workflow_id = ?
     ORDER BY id ASC`,
    [workflowId]
  )
}

export async function listEdgesByWorkflowId(workflowId: number) {
  await ensureWorkflowHistoryTables()
  return query<(RowDataPacket & WorkflowEdgeRow)[]>(
    `SELECT id, workflow_id, edge_key, source_node_key, target_node_key, branch, condition_expr
     FROM workflow_edges
     WHERE workflow_id = ?
     ORDER BY id ASC`,
    [workflowId]
  )
}

export async function listWorkflowHistory(): Promise<WorkflowHistoryRow[]>
export async function listWorkflowHistory(pagination: PaginationOptions): Promise<PageResult<WorkflowHistoryRow>>
export async function listWorkflowHistory(pagination?: PaginationOptions) {
  await ensureWorkflowHistoryTables()
  const sql = `SELECT
       w.id,
       w.name,
       w.description,
       w.source_type,
       w.original_query,
       w.intent,
       w.workflow_type,
       w.confidence,
       w.status,
       w.node_count,
       w.edge_count,
       w.workflow_json,
       w.conversation_id,
       w.created_at,
       w.updated_at,
       r.id AS latest_run_id,
       r.status AS latest_run_status,
       r.started_at AS latest_run_started_at,
       r.finished_at AS latest_run_finished_at
     FROM workflows w
     LEFT JOIN (
       SELECT wr.*
       FROM workflow_runs wr
       INNER JOIN (
         SELECT workflow_id, MAX(id) AS latest_run_id
         FROM workflow_runs
         GROUP BY workflow_id
       ) latest ON latest.latest_run_id = wr.id
     ) r ON r.workflow_id = w.id
     ORDER BY w.updated_at DESC, w.id DESC`
  if (!pagination) return query<WorkflowHistoryRow[]>(sql)

  const rows = await query<WorkflowHistoryRow[]>(`${sql} LIMIT ? OFFSET ?`, [pagination.pageSize, pagination.offset])
  const totalRows = await query<(RowDataPacket & { total: number })[]>('SELECT COUNT(*) AS total FROM workflows')
  return pageResult(rows, Number(totalRows[0]?.total ?? 0), pagination)
}

export async function listWorkflowsByConversationId(conversationId: string): Promise<WorkflowHistoryRow[]>
export async function listWorkflowsByConversationId(conversationId: string, pagination: PaginationOptions): Promise<PageResult<WorkflowHistoryRow>>
export async function listWorkflowsByConversationId(conversationId: string, pagination?: PaginationOptions) {
  await ensureWorkflowHistoryTables()
  const sql = `SELECT
       w.id,
       w.name,
       w.description,
       w.source_type,
       w.original_query,
       w.intent,
       w.workflow_type,
       w.confidence,
       w.status,
       w.node_count,
       w.edge_count,
       w.workflow_json,
       w.conversation_id,
       w.created_at,
       w.updated_at,
       r.id AS latest_run_id,
       r.status AS latest_run_status,
       r.started_at AS latest_run_started_at,
       r.finished_at AS latest_run_finished_at
     FROM workflows w
     LEFT JOIN (
       SELECT wr.*
       FROM workflow_runs wr
       INNER JOIN (
         SELECT workflow_id, MAX(id) AS latest_run_id
         FROM workflow_runs
         GROUP BY workflow_id
       ) latest ON latest.latest_run_id = wr.id
     ) r ON r.workflow_id = w.id
     WHERE w.conversation_id = ?
     ORDER BY w.updated_at DESC, w.id DESC`
  const params = [conversationId]
  if (!pagination) return query<WorkflowHistoryRow[]>(sql, params)

  const rows = await query<WorkflowHistoryRow[]>(`${sql} LIMIT ? OFFSET ?`, [...params, pagination.pageSize, pagination.offset])
  const totalRows = await query<(RowDataPacket & { total: number })[]>(
    'SELECT COUNT(*) AS total FROM workflows WHERE conversation_id = ?',
    params
  )
  return pageResult(rows, Number(totalRows[0]?.total ?? 0), pagination)
}

export function nodeRowToWorkflowNode(row: WorkflowNodeRow): WorkflowNode {
  const config = parseJson<Record<string, unknown>>(row.config, {})
  const displayName = typeof config?.displayName === 'string' ? config.displayName : undefined
  const candidateTools = Array.isArray(config?.candidateTools)
    ? config.candidateTools
        .map((tool) => ({
          name: String((tool as Record<string, unknown>).name ?? ''),
          displayName: typeof (tool as Record<string, unknown>).displayName === 'string'
            ? ((tool as Record<string, unknown>).displayName as string)
            : undefined,
          score: Number((tool as Record<string, unknown>).score ?? 0),
          reason: typeof (tool as Record<string, unknown>).reason === 'string'
            ? ((tool as Record<string, unknown>).reason as string)
            : undefined
        }))
        .filter((tool) => tool.name)
    : []

  return {
    id: row.node_key,
    type: row.node_type,
    label: row.label,
    subLabel: row.sub_label,
    icon: row.icon,
    position: { x: row.x, y: row.y },
    status: row.status,
    tone: row.tone,
    tool: row.tool_name,
    toolName: row.tool_name,
    displayName,
    toolReason: typeof config?.toolReason === 'string' ? config.toolReason : undefined,
    roleInWorkflow: typeof config?.roleInWorkflow === 'string' ? config.roleInWorkflow : undefined,
    confidence: Number(row.confidence ?? 0),
    reason: row.reason,
    candidateTools,
    config,
    inputSummary: typeof config?.inputSummary === 'string' ? config.inputSummary : undefined,
    outputSummary: typeof config?.outputSummary === 'string' ? config.outputSummary : undefined,
    inputSchema: parseJson(row.input_schema, null),
    outputSchema: parseJson(row.output_schema, null)
  }
}

export function edgeRowToWorkflowEdge(row: WorkflowEdgeRow): WorkflowEdge {
  return {
    id: row.edge_key,
    source: row.source_node_key,
    target: row.target_node_key,
    branch: row.branch
  }
}

function inferWorkflowType(graph: WorkflowGraph) {
  const raw = `${graph.intent ?? ''} ${graph.name ?? ''} ${graph.description ?? ''}`.toLowerCase()
  if (raw.includes('document_summary') || raw.includes('文档总结')) return 'document_summary'
  if (raw.includes('financial') || raw.includes('财务') || raw.includes('财报') || raw.includes('risk')) return 'financial_analysis'
  return graph.intent || 'general_workflow'
}

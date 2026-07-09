import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query, withTransaction } from '../config/db'
import { WorkflowEdge, WorkflowEdgeRow, WorkflowGraph, WorkflowNode, WorkflowNodeRow } from '../types/workflow'
import { parseJson, stringifyJson } from '../utils/json'

export type WorkflowRow = RowDataPacket & {
  id: number
  name: string
  description: string | null
  source_type: string
  original_query: string | null
  intent: string
  confidence: string | number | null
  status: string
  workflow_json: unknown
  created_at: string
  updated_at: string
}

export async function createWorkflowWithGraph(graph: WorkflowGraph) {
  return withTransaction(async (connection) => {
    const [workflowResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO workflows
       (name, description, source_type, original_query, intent, confidence, status, workflow_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        graph.name,
        graph.description ?? null,
        graph.sourceType ?? 'generated',
        graph.originalQuery ?? null,
        graph.intent,
        graph.confidence,
        graph.status ?? 'draft',
        stringifyJson({
          name: graph.name,
          description: graph.description,
          intent: graph.intent,
          confidence: graph.confidence,
          nodes: graph.nodes,
          edges: graph.edges
        })
      ]
    )

    const workflowId = workflowResult.insertId
    await insertNodes(connection, workflowId, graph.nodes)
    await insertEdges(connection, workflowId, graph.edges)

    return workflowId
  })
}

export async function updateWorkflowWithGraph(workflowId: number, graph: WorkflowGraph) {
  return withTransaction(async (connection) => {
    await connection.execute(
      `UPDATE workflows
       SET name = ?, description = ?, source_type = ?, original_query = ?, intent = ?, confidence = ?, status = ?, workflow_json = ?
       WHERE id = ?`,
      [
        graph.name,
        graph.description ?? null,
        graph.sourceType ?? 'manual',
        graph.originalQuery ?? null,
        graph.intent,
        graph.confidence,
        graph.status ?? 'draft',
        stringifyJson({
          id: workflowId,
          name: graph.name,
          description: graph.description,
          intent: graph.intent,
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

export async function listWorkflows() {
  return query<WorkflowRow[]>(
    `SELECT id, name, description, source_type, original_query, intent, confidence, status, workflow_json, created_at, updated_at
     FROM workflows
     ORDER BY updated_at DESC`
  )
}

export async function findWorkflowById(id: number) {
  const rows = await query<WorkflowRow[]>(
    `SELECT id, name, description, source_type, original_query, intent, confidence, status, workflow_json, created_at, updated_at
     FROM workflows
     WHERE id = ?`,
    [id]
  )

  return rows[0] ?? null
}

export async function deleteWorkflowById(id: number) {
  return execute<ResultSetHeader>('DELETE FROM workflows WHERE id = ?', [id])
}

export async function listNodesByWorkflowId(workflowId: number) {
  return query<(RowDataPacket & WorkflowNodeRow)[]>(
    `SELECT id, workflow_id, node_key, node_type, label, sub_label, icon, x, y, status, tone, tool_name, confidence, reason, config, input_schema, output_schema
     FROM workflow_nodes
     WHERE workflow_id = ?
     ORDER BY id ASC`,
    [workflowId]
  )
}

export async function listEdgesByWorkflowId(workflowId: number) {
  return query<(RowDataPacket & WorkflowEdgeRow)[]>(
    `SELECT id, workflow_id, edge_key, source_node_key, target_node_key, branch, condition_expr
     FROM workflow_edges
     WHERE workflow_id = ?
     ORDER BY id ASC`,
    [workflowId]
  )
}

export function nodeRowToWorkflowNode(row: WorkflowNodeRow): WorkflowNode {
  const config = parseJson<Record<string, unknown>>(row.config, {})
  const displayName = typeof config?.displayName === 'string' ? config.displayName : undefined
  const candidateTools = Array.isArray(config?.candidateTools)
    ? config.candidateTools
        .map((tool) => ({
          name: String((tool as Record<string, unknown>).name ?? ''),
          score: Number((tool as Record<string, unknown>).score ?? 0)
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
    confidence: Number(row.confidence ?? 0),
    reason: row.reason,
    candidateTools,
    config,
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

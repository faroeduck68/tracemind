import {
  createWorkflowWithGraph,
  deleteWorkflowById,
  edgeRowToWorkflowEdge,
  findWorkflowById,
  listEdgesByWorkflowId,
  listNodesByWorkflowId,
  listWorkflows,
  nodeRowToWorkflowNode,
  updateWorkflowWithGraph
} from '../models/workflow.model'
import { listEnabledMemories } from '../models/memory.model'
import { WorkflowGraph } from '../types/workflow'
import { parseJson } from '../utils/json'
import { validateDag } from '../utils/dagValidator'
import { generateWorkflowFromQuery } from './workflowGenerator.service'

export async function generateAndSaveWorkflow(query: string) {
  const memories = await listEnabledMemories(5)
  const graph = await generateWorkflowFromQuery(query, memories)
  const id = await createWorkflowWithGraph(graph)
  return { ...graph, id }
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
    confidence: Number(workflow.confidence ?? 0),
    status: workflow.status,
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
    confidence: Number(workflow.confidence ?? 0),
    status: workflow.status,
    nodes,
    edges
  }
}

export async function getWorkflowList() {
  const workflows = await listWorkflows()
  return workflows.map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    sourceType: workflow.source_type,
    originalQuery: workflow.original_query,
    intent: workflow.intent,
    confidence: Number(workflow.confidence ?? 0),
    status: workflow.status,
    workflowJson: parseJson(workflow.workflow_json, null),
    createdAt: workflow.created_at,
    updatedAt: workflow.updated_at
  }))
}

export async function updateWorkflow(id: number, graph: WorkflowGraph) {
  validateDag(graph.nodes, graph.edges)
  await updateWorkflowWithGraph(id, graph)
  return getWorkflow(id)
}

export async function removeWorkflow(id: number) {
  return deleteWorkflowById(id)
}

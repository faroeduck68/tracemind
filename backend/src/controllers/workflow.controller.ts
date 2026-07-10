import { Request, Response } from 'express'
import {
  generateAndSaveWorkflow,
  getConversationWorkflows,
  getWorkflow,
  getWorkflowHistory,
  getWorkflowList,
  getWorkflowRuns,
  removeWorkflow,
  updateWorkflow
} from '../services/workflow.service'
import { runWorkflow, testWorkflowNode } from '../services/workflowExecutor.service'
import { sendSuccess } from '../utils/response'
import { getRequestUserId } from '../utils/requestUser'

export async function generateWorkflowController(req: Request, res: Response) {
  const query = String(req.body?.query ?? '').trim()
  if (!query) {
    return sendSuccess(res, null, 'query is required', 400)
  }

  const files = Array.isArray(req.body?.files) ? req.body.files : []
  const conversationId = typeof req.body?.conversationId === 'string' && req.body.conversationId.trim() ? req.body.conversationId.trim() : null
  const workflow = await generateAndSaveWorkflow(query, files, { conversationId })
  return sendSuccess(res, workflow, 'Workflow generated')
}

export async function listWorkflowController(_req: Request, res: Response) {
  return sendSuccess(res, await getWorkflowList())
}

export async function listWorkflowHistoryController(_req: Request, res: Response) {
  return sendSuccess(res, await getWorkflowHistory())
}

export async function listWorkflowRunsController(req: Request, res: Response) {
  return sendSuccess(res, await getWorkflowRuns(Number(req.params.id)))
}

export async function listConversationWorkflowsController(req: Request, res: Response) {
  const conversationId = String(req.params.conversationId ?? req.params.id ?? '').trim()
  if (!conversationId) {
    return sendSuccess(res, null, 'conversation id is required', 400)
  }

  return sendSuccess(res, await getConversationWorkflows(conversationId))
}

export async function getWorkflowController(req: Request, res: Response) {
  const workflow = await getWorkflow(Number(req.params.id))
  if (!workflow) {
    return sendSuccess(res, null, 'Workflow not found', 404)
  }

  return sendSuccess(res, workflow)
}

export async function updateWorkflowController(req: Request, res: Response) {
  const workflow = await updateWorkflow(Number(req.params.id), req.body)
  return sendSuccess(res, workflow, 'Workflow updated')
}

export async function deleteWorkflowController(req: Request, res: Response) {
  await removeWorkflow(Number(req.params.id))
  return sendSuccess(res, { id: Number(req.params.id) }, 'Workflow deleted')
}

export async function runWorkflowController(req: Request, res: Response) {
  const result = await runWorkflow(Number(req.params.id), { ...(req.body ?? {}), userId: getRequestUserId(req) })
  return sendSuccess(res, result, 'Workflow executed')
}

export async function testWorkflowNodeController(req: Request, res: Response) {
  const workflowId = Number(req.params.id)
  const nodeId = String(req.params.nodeId ?? '').trim()
  if (!nodeId) {
    return sendSuccess(res, null, 'nodeId is required', 400)
  }

  const result = await testWorkflowNode(workflowId, nodeId, { ...(req.body ?? {}), userId: getRequestUserId(req) })
  return sendSuccess(res, result, 'Workflow node tested')
}

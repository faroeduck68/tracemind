import { Request, Response } from 'express'
import { generateAndSaveWorkflow, getWorkflow, getWorkflowList, removeWorkflow, updateWorkflow } from '../services/workflow.service'
import { runWorkflow } from '../services/workflowExecutor.service'
import { sendSuccess } from '../utils/response'
import { toolRegistry } from '../tools'

export async function generateWorkflowController(req: Request, res: Response) {
  const query = String(req.body?.query ?? '').trim()
  if (!query) {
    return sendSuccess(res, null, 'query is required', 400)
  }
  if (isWeatherQuery(query) && !('weather_tool' in toolRegistry)) {
    return sendSuccess(res, null, '当前系统没有天气查询工具，无法实时查询天气。可以为系统新增 weather_tool 后支持该能力。', 400)
  }

  const workflow = await generateAndSaveWorkflow(query)
  return sendSuccess(res, workflow, 'Workflow generated')
}

function isWeatherQuery(query: string) {
  const normalized = query.toLowerCase()
  return ['天气', '气温', 'weather', 'temperature', 'forecast'].some((keyword) => normalized.includes(keyword))
}

export async function listWorkflowController(_req: Request, res: Response) {
  return sendSuccess(res, await getWorkflowList())
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
  const result = await runWorkflow(Number(req.params.id), req.body ?? {})
  return sendSuccess(res, result, 'Workflow executed')
}

import { Request, Response } from 'express'
import { addTool, editTool, getTool, getTools, getToolsStats, switchTool } from '../services/tool.service'
import { sendSuccess } from '../utils/response'

export async function listToolController(_req: Request, res: Response) {
  return sendSuccess(res, await getTools())
}

export async function getToolController(req: Request, res: Response) {
  const tool = await getTool(String(req.params.id))
  if (!tool) {
    return sendSuccess(res, null, 'Tool not found', 404)
  }

  return sendSuccess(res, tool)
}

export async function createToolController(req: Request, res: Response) {
  const id = await addTool(req.body)
  return sendSuccess(res, { id }, 'Tool created', 201)
}

export async function updateToolController(req: Request, res: Response) {
  return sendSuccess(res, await editTool(Number(req.params.id), req.body), 'Tool updated')
}

export async function toggleToolController(req: Request, res: Response) {
  return sendSuccess(res, await switchTool(Number(req.params.id)), 'Tool toggled')
}

export async function toolStatsController(_req: Request, res: Response) {
  return sendSuccess(res, await getToolsStats())
}

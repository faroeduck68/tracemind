import { Request, Response } from 'express'
import { addMemory, editMemory, getMemories, getMemoriesForWorkflow, removeMemory } from '../services/memory.service'
import { sendSuccess } from '../utils/response'
import { readPagination } from '../utils/pagination'
import { readIdParam } from '../utils/requestParams'

export async function listMemoryController(req: Request, res: Response) {
  return sendSuccess(res, await getMemories(readPagination(req.query) ?? undefined))
}

export async function createMemoryController(req: Request, res: Response) {
  const id = await addMemory(req.body)
  return sendSuccess(res, { id }, 'Memory created', 201)
}

export async function updateMemoryController(req: Request, res: Response) {
  const id = readIdParam(req)
  await editMemory(id, req.body)
  return sendSuccess(res, { id }, 'Memory updated')
}

export async function deleteMemoryController(req: Request, res: Response) {
  const id = readIdParam(req)
  await removeMemory(id)
  return sendSuccess(res, { id }, 'Memory deleted')
}

export async function memoryForWorkflowController(_req: Request, res: Response) {
  return sendSuccess(res, await getMemoriesForWorkflow())
}

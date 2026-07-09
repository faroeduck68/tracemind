import { Request, Response } from 'express'
import { addMemory, editMemory, getMemories, getMemoriesForWorkflow, removeMemory } from '../services/memory.service'
import { sendSuccess } from '../utils/response'

export async function listMemoryController(_req: Request, res: Response) {
  return sendSuccess(res, await getMemories())
}

export async function createMemoryController(req: Request, res: Response) {
  const id = await addMemory(req.body)
  return sendSuccess(res, { id }, 'Memory created', 201)
}

export async function updateMemoryController(req: Request, res: Response) {
  await editMemory(Number(req.params.id), req.body)
  return sendSuccess(res, { id: Number(req.params.id) }, 'Memory updated')
}

export async function deleteMemoryController(req: Request, res: Response) {
  await removeMemory(Number(req.params.id))
  return sendSuccess(res, { id: Number(req.params.id) }, 'Memory deleted')
}

export async function memoryForWorkflowController(_req: Request, res: Response) {
  return sendSuccess(res, await getMemoriesForWorkflow())
}

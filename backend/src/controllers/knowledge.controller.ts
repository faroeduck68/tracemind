import { Request, Response } from 'express'
import {
  addKnowledgeBase,
  addKnowledgeDocument,
  getKnowledgeBase,
  getKnowledgeBases,
  searchKnowledgeBase
} from '../services/knowledge.service'
import { sendSuccess } from '../utils/response'

export async function listKnowledgeBaseController(_req: Request, res: Response) {
  return sendSuccess(res, await getKnowledgeBases())
}

export async function getKnowledgeBaseController(req: Request, res: Response) {
  const knowledgeBase = await getKnowledgeBase(Number(req.params.id))
  if (!knowledgeBase) {
    return sendSuccess(res, null, 'Knowledge base not found', 404)
  }

  return sendSuccess(res, knowledgeBase)
}

export async function createKnowledgeBaseController(req: Request, res: Response) {
  const id = await addKnowledgeBase(req.body)
  return sendSuccess(res, { id }, 'Knowledge base created', 201)
}

export async function addKnowledgeDocumentController(req: Request, res: Response) {
  const id = await addKnowledgeDocument(Number(req.params.id), req.body)
  return sendSuccess(res, { id }, 'Document added', 201)
}

export async function searchKnowledgeBaseController(req: Request, res: Response) {
  return sendSuccess(res, await searchKnowledgeBase(Number(req.params.id), req.body))
}

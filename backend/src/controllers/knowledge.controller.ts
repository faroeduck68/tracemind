import { Request, Response } from 'express'
import {
  addKnowledgeBase,
  addKnowledgeDocument,
  deleteKnowledgeDocument,
  getKnowledgeBase,
  getKnowledgeBases,
  getKnowledgeDocument,
  importKnowledgeDocumentFromFile,
  searchKnowledgeBase
} from '../services/knowledge.service'
import { sendSuccess } from '../utils/response'

export async function listKnowledgeBaseController(req: Request, res: Response) {
  return sendSuccess(res, await getKnowledgeBases(readUserId(req)))
}

export async function getKnowledgeBaseController(req: Request, res: Response) {
  const knowledgeBase = await getKnowledgeBase(Number(req.params.id), readUserId(req))
  if (!knowledgeBase) {
    return sendSuccess(res, null, 'Knowledge base not found', 404)
  }

  return sendSuccess(res, knowledgeBase)
}

export async function createKnowledgeBaseController(req: Request, res: Response) {
  const id = await addKnowledgeBase(req.body, readUserId(req))
  return sendSuccess(res, { id }, 'Knowledge base created', 201)
}

export async function addKnowledgeDocumentController(req: Request, res: Response) {
  const result = await addKnowledgeDocument(Number(req.params.id), req.body, readUserId(req))
  return sendSuccess(res, result, 'Document added', 201)
}

export async function importKnowledgeDocumentFromFileController(req: Request, res: Response) {
  const result = await importKnowledgeDocumentFromFile(Number(req.params.id), req.body, readUserId(req))
  return sendSuccess(res, result, 'Document imported', 201)
}

export async function getKnowledgeDocumentController(req: Request, res: Response) {
  const document = await getKnowledgeDocument(Number(req.params.documentId), readUserId(req))
  if (!document) {
    return sendSuccess(res, null, 'Knowledge document not found', 404)
  }

  return sendSuccess(res, document)
}

export async function deleteKnowledgeDocumentController(req: Request, res: Response) {
  return sendSuccess(res, await deleteKnowledgeDocument(Number(req.params.documentId), readUserId(req)), 'Document deleted')
}

export async function searchKnowledgeBaseController(req: Request, res: Response) {
  const result = await searchKnowledgeBase({
    ...(req.body ?? {}),
    knowledgeBaseId: Number(req.params.id),
    userId: readUserId(req)
  })
  return sendSuccess(res, result)
}

function readUserId(req: Request) {
  return req.get('X-User-Id') || 'default_user'
}

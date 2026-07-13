import { Request, Response } from 'express'
import {
  addKnowledgeBase,
  addKnowledgeDocument,
  deleteKnowledgeDocument,
  editKnowledgeBase,
  getKnowledgeBase,
  getKnowledgeBases,
  getKnowledgeDocument,
  getKnowledgeDocuments,
  importKnowledgeDocumentFromFile,
  removeKnowledgeBase,
  searchKnowledgeBase
} from '../services/knowledge.service'
import { sendSuccess } from '../utils/response'
import { readPagination } from '../utils/pagination'
import { readIdParam } from '../utils/requestParams'

export async function listKnowledgeBaseController(req: Request, res: Response) {
  return sendSuccess(res, await getKnowledgeBases(readUserId(req), readPagination(req.query) ?? undefined))
}

export async function getKnowledgeBaseController(req: Request, res: Response) {
  const knowledgeBase = await getKnowledgeBase(readIdParam(req), readUserId(req))
  if (!knowledgeBase) {
    return sendSuccess(res, null, 'Knowledge base not found', 404)
  }

  return sendSuccess(res, knowledgeBase)
}

export async function createKnowledgeBaseController(req: Request, res: Response) {
  const id = await addKnowledgeBase(req.body, readUserId(req))
  return sendSuccess(res, { id }, 'Knowledge base created', 201)
}

export async function updateKnowledgeBaseController(req: Request, res: Response) {
  return sendSuccess(res, await editKnowledgeBase(readIdParam(req), req.body, readUserId(req)), 'Knowledge base updated')
}

export async function deleteKnowledgeBaseController(req: Request, res: Response) {
  return sendSuccess(res, await removeKnowledgeBase(readIdParam(req), readUserId(req)), 'Knowledge base deleted')
}

export async function addKnowledgeDocumentController(req: Request, res: Response) {
  const result = await addKnowledgeDocument(readIdParam(req), req.body, readUserId(req))
  return sendSuccess(res, result, 'Document added', 201)
}

export async function importKnowledgeDocumentFromFileController(req: Request, res: Response) {
  const result = await importKnowledgeDocumentFromFile(readIdParam(req), req.body, readUserId(req))
  return sendSuccess(res, result, 'Document imported', 201)
}

export async function getKnowledgeDocumentController(req: Request, res: Response) {
  const document = await getKnowledgeDocument(readIdParam(req, 'documentId'), readUserId(req))
  if (!document) {
    return sendSuccess(res, null, 'Knowledge document not found', 404)
  }

  return sendSuccess(res, document)
}

export async function listKnowledgeDocumentController(req: Request, res: Response) {
  return sendSuccess(res, await getKnowledgeDocuments(readIdParam(req), readUserId(req), readPagination(req.query) ?? undefined))
}

export async function deleteKnowledgeDocumentController(req: Request, res: Response) {
  return sendSuccess(res, await deleteKnowledgeDocument(readIdParam(req, 'documentId'), readUserId(req)), 'Document deleted')
}

export async function searchKnowledgeBaseController(req: Request, res: Response) {
  const result = await searchKnowledgeBase({
    ...(req.body ?? {}),
    knowledgeBaseId: readIdParam(req),
    userId: readUserId(req)
  })
  return sendSuccess(res, result)
}

function readUserId(req: Request) {
  return req.get('X-User-Id') || 'default_user'
}

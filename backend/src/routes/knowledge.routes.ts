import { Router } from 'express'
import {
  addKnowledgeDocumentController,
  createKnowledgeBaseController,
  deleteKnowledgeBaseController,
  deleteKnowledgeDocumentController,
  getKnowledgeBaseController,
  getKnowledgeDocumentController,
  importKnowledgeDocumentFromFileController,
  listKnowledgeBaseController,
  listKnowledgeDocumentController,
  searchKnowledgeBaseController,
  updateKnowledgeBaseController
} from '../controllers/knowledge.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const knowledgeRouter = Router()

knowledgeRouter.get('/', asyncHandler(listKnowledgeBaseController))
knowledgeRouter.post('/', asyncHandler(createKnowledgeBaseController))
knowledgeRouter.get('/documents/:documentId', asyncHandler(getKnowledgeDocumentController))
knowledgeRouter.delete('/documents/:documentId', asyncHandler(deleteKnowledgeDocumentController))
knowledgeRouter.get('/:id', asyncHandler(getKnowledgeBaseController))
knowledgeRouter.put('/:id', asyncHandler(updateKnowledgeBaseController))
knowledgeRouter.delete('/:id', asyncHandler(deleteKnowledgeBaseController))
knowledgeRouter.get('/:id/documents', asyncHandler(listKnowledgeDocumentController))
knowledgeRouter.post('/:id/documents', asyncHandler(addKnowledgeDocumentController))
knowledgeRouter.post('/:id/documents/import-file', asyncHandler(importKnowledgeDocumentFromFileController))
knowledgeRouter.post('/:id/search', asyncHandler(searchKnowledgeBaseController))

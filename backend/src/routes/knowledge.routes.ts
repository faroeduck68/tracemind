import { Router } from 'express'
import {
  addKnowledgeDocumentController,
  createKnowledgeBaseController,
  getKnowledgeBaseController,
  listKnowledgeBaseController,
  searchKnowledgeBaseController
} from '../controllers/knowledge.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const knowledgeRouter = Router()

knowledgeRouter.get('/', asyncHandler(listKnowledgeBaseController))
knowledgeRouter.post('/', asyncHandler(createKnowledgeBaseController))
knowledgeRouter.get('/:id', asyncHandler(getKnowledgeBaseController))
knowledgeRouter.post('/:id/documents', asyncHandler(addKnowledgeDocumentController))
knowledgeRouter.post('/:id/search', asyncHandler(searchKnowledgeBaseController))

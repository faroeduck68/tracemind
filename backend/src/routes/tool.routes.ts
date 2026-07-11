import { Router } from 'express'
import {
  checkToolNameController,
  createToolController,
  getToolController,
  listToolController,
  testDraftToolController,
  testToolController,
  testWebSearchController,
  toggleToolController,
  toolStatsController,
  updateToolController
} from '../controllers/tool.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const toolRouter = Router()

toolRouter.get('/', asyncHandler(listToolController))
toolRouter.get('/stats', asyncHandler(toolStatsController))
toolRouter.get('/check-name', asyncHandler(checkToolNameController))
toolRouter.post('/test-draft', asyncHandler(testDraftToolController))
toolRouter.post('/web-search/test', asyncHandler(testWebSearchController))
toolRouter.get('/:id', asyncHandler(getToolController))
toolRouter.post('/', asyncHandler(createToolController))
toolRouter.post('/:id/test', asyncHandler(testToolController))
toolRouter.put('/:id', asyncHandler(updateToolController))
toolRouter.patch('/:id/toggle', asyncHandler(toggleToolController))

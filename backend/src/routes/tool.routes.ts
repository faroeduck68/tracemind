import { Router } from 'express'
import {
  createToolController,
  getToolController,
  listToolController,
  toggleToolController,
  toolStatsController,
  updateToolController
} from '../controllers/tool.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const toolRouter = Router()

toolRouter.get('/', asyncHandler(listToolController))
toolRouter.get('/stats', asyncHandler(toolStatsController))
toolRouter.get('/:id', asyncHandler(getToolController))
toolRouter.post('/', asyncHandler(createToolController))
toolRouter.put('/:id', asyncHandler(updateToolController))
toolRouter.patch('/:id/toggle', asyncHandler(toggleToolController))

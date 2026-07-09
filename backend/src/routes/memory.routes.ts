import { Router } from 'express'
import {
  createMemoryController,
  deleteMemoryController,
  listMemoryController,
  memoryForWorkflowController,
  updateMemoryController
} from '../controllers/memory.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const memoryRouter = Router()

memoryRouter.get('/', asyncHandler(listMemoryController))
memoryRouter.get('/for-workflow', asyncHandler(memoryForWorkflowController))
memoryRouter.post('/', asyncHandler(createMemoryController))
memoryRouter.put('/:id', asyncHandler(updateMemoryController))
memoryRouter.delete('/:id', asyncHandler(deleteMemoryController))

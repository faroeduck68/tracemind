import { Router } from 'express'
import {
  createMcpServerController,
  listMcpServersController,
  syncMcpServerToolsController,
  testMcpServerController,
  toggleMcpServerController,
  updateMcpServerController
} from '../controllers/mcpServer.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const mcpServerRouter = Router()

mcpServerRouter.get('/', asyncHandler(listMcpServersController))
mcpServerRouter.post('/', asyncHandler(createMcpServerController))
mcpServerRouter.put('/:id', asyncHandler(updateMcpServerController))
mcpServerRouter.patch('/:id/toggle', asyncHandler(toggleMcpServerController))
mcpServerRouter.post('/:id/test', asyncHandler(testMcpServerController))
mcpServerRouter.post('/:id/sync-tools', asyncHandler(syncMcpServerToolsController))

import { Router } from 'express'
import {
  deleteWorkflowController,
  generateWorkflowController,
  getWorkflowController,
  listWorkflowHistoryController,
  listWorkflowController,
  listWorkflowRunsController,
  runWorkflowController,
  testWorkflowNodeController,
  updateWorkflowController
} from '../controllers/workflow.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const workflowRouter = Router()

workflowRouter.post('/generate', asyncHandler(generateWorkflowController))
workflowRouter.get('/history', asyncHandler(listWorkflowHistoryController))
workflowRouter.get('/', asyncHandler(listWorkflowController))
workflowRouter.get('/:id/runs', asyncHandler(listWorkflowRunsController))
workflowRouter.get('/:id', asyncHandler(getWorkflowController))
workflowRouter.put('/:id', asyncHandler(updateWorkflowController))
workflowRouter.delete('/:id', asyncHandler(deleteWorkflowController))
workflowRouter.post('/:id/run', asyncHandler(runWorkflowController))
workflowRouter.post('/:id/nodes/:nodeId/test', asyncHandler(testWorkflowNodeController))

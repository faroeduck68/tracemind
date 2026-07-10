import { Router } from 'express'
import { getRunController, getRunReplayController, getTraceController, listRunHistoryController } from '../controllers/trace.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const traceRouter = Router()

traceRouter.get('/history', asyncHandler(listRunHistoryController))
traceRouter.get('/:runId/replay', asyncHandler(getRunReplayController))
traceRouter.get('/:runId/trace', asyncHandler(getTraceController))
traceRouter.get('/:runId', asyncHandler(getRunController))

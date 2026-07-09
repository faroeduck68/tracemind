import { Router } from 'express'
import { getRunController, getTraceController } from '../controllers/trace.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const traceRouter = Router()

traceRouter.get('/:runId', asyncHandler(getRunController))
traceRouter.get('/:runId/trace', asyncHandler(getTraceController))

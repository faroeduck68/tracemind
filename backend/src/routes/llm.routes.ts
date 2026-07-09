import { Router } from 'express'
import { testLlmController } from '../controllers/llm.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const llmRouter = Router()

llmRouter.get('/test', asyncHandler(testLlmController))

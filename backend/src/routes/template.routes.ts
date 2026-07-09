import { Router } from 'express'
import {
  createTemplateController,
  getTemplateController,
  listTemplateController,
  useTemplateController
} from '../controllers/template.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const templateRouter = Router()

templateRouter.get('/', asyncHandler(listTemplateController))
templateRouter.get('/:id', asyncHandler(getTemplateController))
templateRouter.post('/', asyncHandler(createTemplateController))
templateRouter.post('/:id/use', asyncHandler(useTemplateController))

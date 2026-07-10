import { Router } from 'express'
import { createSecretController, deleteSecretController, listSecretController } from '../controllers/secret.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const secretRouter = Router()

secretRouter.get('/', asyncHandler(listSecretController))
secretRouter.post('/', asyncHandler(createSecretController))
secretRouter.delete('/:name', asyncHandler(deleteSecretController))

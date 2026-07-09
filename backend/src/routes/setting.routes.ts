import { Router } from 'express'
import { getSettingsController, updateSettingsController } from '../controllers/setting.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const settingRouter = Router()

settingRouter.get('/', asyncHandler(getSettingsController))
settingRouter.put('/', asyncHandler(updateSettingsController))

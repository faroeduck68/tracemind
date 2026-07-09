import { Router } from 'express'
import { sendChatController } from '../controllers/chat.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const chatRouter = Router()

chatRouter.post('/send', asyncHandler(sendChatController))

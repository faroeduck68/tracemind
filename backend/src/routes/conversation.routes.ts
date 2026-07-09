import { Router } from 'express'
import { listConversationMessagesController } from '../controllers/conversation.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const conversationRouter = Router()

conversationRouter.get('/:id/messages', asyncHandler(listConversationMessagesController))

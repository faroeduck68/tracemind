import { Router } from 'express'
import {
  appendConversationMessageController,
  createConversationController,
  deleteConversationController,
  listConversationMessagesController,
  listConversationWorkflowsController,
  listConversationsController
} from '../controllers/conversation.controller'
import { asyncHandler } from '../utils/asyncHandler'

export const conversationRouter = Router()

conversationRouter.get('/', asyncHandler(listConversationsController))
conversationRouter.post('/', asyncHandler(createConversationController))
conversationRouter.get('/:id/messages', asyncHandler(listConversationMessagesController))
conversationRouter.get('/:id/workflows', asyncHandler(listConversationWorkflowsController))
conversationRouter.post('/:id/messages', asyncHandler(appendConversationMessageController))
conversationRouter.delete('/:id', asyncHandler(deleteConversationController))

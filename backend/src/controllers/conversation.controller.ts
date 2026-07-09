import { Request, Response } from 'express'
import { listMessagesByConversation } from '../models/chat.model'
import { sendSuccess } from '../utils/response'

export async function listConversationMessagesController(req: Request, res: Response) {
  const conversationId = String(req.params.id ?? '').trim()
  if (!conversationId) {
    return sendSuccess(res, null, 'conversation id is required', 400)
  }

  return sendSuccess(res, await listMessagesByConversation(conversationId))
}

import { Request, Response } from 'express'
import { sendChatMessage } from '../services/chat.service'
import { sendSuccess } from '../utils/response'

export async function sendChatController(req: Request, res: Response) {
  const result = await sendChatMessage({
    conversationId: typeof req.body?.conversationId === 'string' ? req.body.conversationId : undefined,
    message: String(req.body?.message ?? ''),
    mode: typeof req.body?.mode === 'string' ? req.body.mode : 'chat',
    fileIds: Array.isArray(req.body?.fileIds) ? req.body.fileIds : undefined,
    files: Array.isArray(req.body?.files) ? req.body.files : undefined,
    workflowId: Number(req.body?.workflowId ?? 0) || undefined,
    runId: Number(req.body?.runId ?? 0) || undefined
  })

  return sendSuccess(res, result, 'Chat message sent')
}

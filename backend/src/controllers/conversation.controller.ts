import { Request, Response } from 'express'
import {
  countMessagesByConversation,
  createConversation,
  createMessage,
  deleteConversation,
  findConversation,
  listConversations,
  listMessagesByConversation,
  touchConversation,
  updateConversationAfterMessage
} from '../models/chat.model'
import { env } from '../config/env'
import { getConversationWorkflows } from '../services/workflow.service'
import { sendSuccess } from '../utils/response'
import { makeKey } from '../utils/uuid'
import { readPagination } from '../utils/pagination'

export async function listConversationsController(req: Request, res: Response) {
  const pagination = readPagination(req.query)
  return sendSuccess(res, pagination ? await listConversations(pagination) : await listConversations())
}

export async function createConversationController(req: Request, res: Response) {
  const id = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : makeKey('conv')
  const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim().slice(0, 200) : '新会话'
  const model = typeof req.body?.model === 'string' && req.body.model.trim() ? req.body.model.trim() : env.openai.model

  const existing = await findConversation(id)
  if (!existing) {
    await createConversation({ id, title, model })
  }

  return sendSuccess(res, {
    id,
    title,
    model,
    status: existing?.status ?? 'active',
    createdAt: existing?.created_at ?? new Date().toISOString(),
    updatedAt: existing?.updated_at ?? new Date().toISOString()
  })
}

export async function listConversationMessagesController(req: Request, res: Response) {
  const conversationId = String(req.params.id ?? '').trim()
  if (!conversationId) {
    return sendSuccess(res, null, 'conversation id is required', 400)
  }

  const pagination = readPagination(req.query)
  return sendSuccess(res, pagination ? await listMessagesByConversation(conversationId, pagination) : await listMessagesByConversation(conversationId))
}

export async function listConversationWorkflowsController(req: Request, res: Response) {
  const conversationId = String(req.params.id ?? '').trim()
  if (!conversationId) {
    return sendSuccess(res, null, 'conversation id is required', 400)
  }

  return sendSuccess(res, await getConversationWorkflows(conversationId, readPagination(req.query) ?? undefined))
}

export async function appendConversationMessageController(req: Request, res: Response) {
  const conversationId = String(req.params.id ?? '').trim()
  if (!conversationId) {
    return sendSuccess(res, null, 'conversation id is required', 400)
  }

  const existing = await findConversation(conversationId)
  if (!existing) {
    await createConversation({
      id: conversationId,
      title: createTitle(String(req.body?.content ?? '新会话')),
      model: typeof req.body?.model === 'string' ? req.body.model : env.openai.model
    })
  }

  const role = req.body?.role === 'assistant' ? 'assistant' : req.body?.role === 'system' ? 'system' : 'user'
  const content = String(req.body?.content ?? '').trim()
  if (!content) {
    return sendSuccess(res, null, 'message content is required', 400)
  }

  const messageCount = await countMessagesByConversation(conversationId)
  const id = await createMessage({
    conversationId,
    role,
    content,
    metadata: req.body?.metadata ?? null,
    model: typeof req.body?.model === 'string' ? req.body.model : null,
    usage: req.body?.usage ?? null,
    sequence: Number(req.body?.sequence ?? messageCount)
  })

  if (messageCount === 0 && role === 'user') {
    await touchConversation(conversationId, { title: createTitle(content) })
  }

  await updateConversationAfterMessage(conversationId, {
    lastMessage: content,
    model: typeof req.body?.model === 'string' ? req.body.model : null,
    usage: req.body?.usage ?? null
  })

  return sendSuccess(res, {
    id,
    conversationId,
    role,
    content,
    metadata: req.body?.metadata ?? null,
    createdAt: new Date().toISOString()
  })
}

export async function deleteConversationController(req: Request, res: Response) {
  const conversationId = String(req.params.id ?? '').trim()
  if (!conversationId) {
    return sendSuccess(res, null, 'conversation id is required', 400)
  }

  await deleteConversation(conversationId)
  return sendSuccess(res, { id: conversationId })
}

function createTitle(content: string) {
  return content.replace(/\s+/g, ' ').slice(0, 60) || '新会话'
}

import { Request, Response } from 'express'
import { addTemplate, getTemplate, getTemplates, useTemplate } from '../services/template.service'
import { sendSuccess } from '../utils/response'
import { readPagination } from '../utils/pagination'
import { readIdParam } from '../utils/requestParams'

export async function listTemplateController(req: Request, res: Response) {
  return sendSuccess(res, await getTemplates(readPagination(req.query) ?? undefined))
}

export async function getTemplateController(req: Request, res: Response) {
  const template = await getTemplate(readIdParam(req))
  if (!template) {
    return sendSuccess(res, null, 'Template not found', 404)
  }

  return sendSuccess(res, template)
}

export async function createTemplateController(req: Request, res: Response) {
  const id = await addTemplate(req.body)
  return sendSuccess(res, { id }, 'Template created', 201)
}

export async function useTemplateController(req: Request, res: Response) {
  return sendSuccess(res, await useTemplate(readIdParam(req)), 'Template used')
}

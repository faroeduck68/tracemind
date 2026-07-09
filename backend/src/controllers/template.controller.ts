import { Request, Response } from 'express'
import { addTemplate, getTemplate, getTemplates, useTemplate } from '../services/template.service'
import { sendSuccess } from '../utils/response'

export async function listTemplateController(_req: Request, res: Response) {
  return sendSuccess(res, await getTemplates())
}

export async function getTemplateController(req: Request, res: Response) {
  const template = await getTemplate(Number(req.params.id))
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
  return sendSuccess(res, await useTemplate(Number(req.params.id)), 'Template used')
}

import { createTemplate, findTemplateById, listTemplates, markTemplateUsed } from '../models/template.model'

export async function getTemplates() {
  return listTemplates()
}

export async function getTemplate(id: number) {
  return findTemplateById(id)
}

export async function addTemplate(input: Record<string, unknown>) {
  return createTemplate({
    title: String(input.title),
    description: input.description ? String(input.description) : null,
    category: input.category ? String(input.category) : null,
    badge: input.badge ? String(input.badge) : null,
    is_official: input.isOfficial || input.is_official ? 1 : 0,
    workflow_json: input.workflowJson ?? input.workflow_json ?? {}
  })
}

export async function useTemplate(id: number) {
  await markTemplateUsed(id)
  return getTemplate(id)
}

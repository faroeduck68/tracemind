import { createMemory, deleteMemory, listEnabledMemories, listMemories, updateMemory } from '../models/memory.model'
import { PaginationOptions } from '../utils/pagination'

export async function getMemories(pagination?: PaginationOptions) {
  return pagination ? listMemories(pagination) : listMemories()
}

export async function getMemoriesForWorkflow() {
  return listEnabledMemories(5)
}

export async function addMemory(input: Record<string, unknown>) {
  return createMemory({
    memory_type: String(input.memoryType ?? input.memory_type ?? 'note'),
    title: String(input.title),
    content: String(input.content),
    importance: String(input.importance ?? 'medium'),
    importance_score: Number(input.importanceScore ?? input.importance_score ?? 3),
    source_type: input.sourceType ? String(input.sourceType) : null,
    source_id: input.sourceId ? Number(input.sourceId) : null,
    enabled: input.enabled === false ? 0 : 1
  })
}

export async function editMemory(id: number, input: Record<string, unknown>) {
  await updateMemory(id, {
    memory_type: String(input.memoryType ?? input.memory_type ?? 'note'),
    title: String(input.title),
    content: String(input.content),
    importance: String(input.importance ?? 'medium'),
    importance_score: Number(input.importanceScore ?? input.importance_score ?? 3),
    source_type: input.sourceType ? String(input.sourceType) : null,
    source_id: input.sourceId ? Number(input.sourceId) : null,
    enabled: input.enabled === false ? 0 : 1
  })
}

export async function removeMemory(id: number) {
  await deleteMemory(id)
}

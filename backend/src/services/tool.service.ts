import {
  createTool,
  findToolByIdOrName,
  getToolStats,
  listTools,
  toggleTool,
  updateTool
} from '../models/tool.model'

export async function getTools() {
  return listTools()
}

export async function getTool(idOrName: string) {
  return findToolByIdOrName(idOrName)
}

export async function addTool(input: Record<string, unknown>) {
  return createTool({
    name: String(input.name),
    display_name: String(input.displayName ?? input.display_name ?? input.name),
    version: String(input.version ?? 'v1.0.0'),
    category: input.category ? String(input.category) : null,
    description: input.description ? String(input.description) : null,
    enabled: input.enabled === false ? 0 : 1,
    config_schema: input.configSchema ?? input.config_schema ?? null,
    input_schema: input.inputSchema ?? input.input_schema ?? null,
    output_schema: input.outputSchema ?? input.output_schema ?? null
  })
}

export async function editTool(id: number, input: Record<string, unknown>) {
  await updateTool(id, {
    display_name: String(input.displayName ?? input.display_name ?? input.name ?? ''),
    version: String(input.version ?? 'v1.0.0'),
    category: input.category ? String(input.category) : null,
    description: input.description ? String(input.description) : null,
    enabled: input.enabled === false ? 0 : 1,
    config_schema: input.configSchema ?? input.config_schema ?? null,
    input_schema: input.inputSchema ?? input.input_schema ?? null,
    output_schema: input.outputSchema ?? input.output_schema ?? null
  })
  return getTool(String(id))
}

export async function switchTool(id: number) {
  await toggleTool(id)
  return getTool(String(id))
}

export async function getToolsStats() {
  return getToolStats()
}

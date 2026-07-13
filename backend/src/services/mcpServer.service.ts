import { RowDataPacket } from 'mysql2/promise'
import {
  createMcpServer,
  findMcpServerById,
  listMcpServers,
  McpServerRow,
  setMcpServerStatus,
  toggleMcpServer,
  updateMcpServer
} from '../models/mcpServer.model'
import { execute, query } from '../config/db'
import { stringifyJson } from '../utils/json'
import { mapPageResult, PaginationOptions } from '../utils/pagination'

type McpToolDescriptor = {
  name?: unknown
  displayName?: unknown
  display_name?: unknown
  description?: unknown
  inputSchema?: unknown
  input_schema?: unknown
  outputSchema?: unknown
  output_schema?: unknown
}

export async function getMcpServers(pagination?: PaginationOptions) {
  const servers = pagination ? await listMcpServers(pagination) : await listMcpServers()
  if (!Array.isArray(servers)) {
    const list = await Promise.all(servers.list.map(sanitizeMcpServerWithCount))
    return mapPageResult({ ...servers, list }, (server) => server)
  }
  return Promise.all(servers.map(sanitizeMcpServerWithCount))
}

export async function addMcpServer(input: Record<string, unknown>) {
  const name = String(input.name ?? '').trim()
  const endpoint = String(input.endpoint ?? '').trim()
  if (!name) throw new Error('MCP Server name is required')
  if (!endpoint) throw new Error('MCP Server endpoint is required')

  return createMcpServer({
    name,
    display_name: String(input.displayName ?? input.display_name ?? name),
    endpoint,
    transport: normalizeTransport(input.transport),
    enabled: input.enabled === false ? 0 : 1,
    status: 'unknown'
  })
}

export async function editMcpServer(id: number, input: Record<string, unknown>) {
  const existing = await findMcpServerById(id)
  if (!existing) throw new Error('MCP Server not found')

  await updateMcpServer(id, {
    display_name: String(input.displayName ?? input.display_name ?? existing.display_name ?? existing.name),
    endpoint: String(input.endpoint ?? existing.endpoint),
    transport: normalizeTransport(input.transport ?? existing.transport),
    enabled: input.enabled === false ? 0 : input.enabled === true ? 1 : existing.enabled,
    status: String(input.status ?? existing.status ?? 'unknown')
  })

  const updated = await findMcpServerById(id)
  return updated ? sanitizeMcpServerWithCount(updated) : null
}

export async function switchMcpServer(id: number) {
  await toggleMcpServer(id)
  const updated = await findMcpServerById(id)
  return updated ? sanitizeMcpServerWithCount(updated) : null
}

export async function testMcpServerConnection(id: number) {
  const server = await findMcpServerById(id)
  if (!server) throw new Error('MCP Server not found')

  const status = server.enabled === 1 ? 'ready' : 'disabled'
  await setMcpServerStatus(id, status)

  return {
    success: server.enabled === 1,
    status,
    server: await sanitizeMcpServerWithCount({ ...server, status }),
    message:
      server.enabled === 1
        ? 'MCP connection test placeholder completed. Real MCP client will be added in phase 2.'
        : 'MCP Server is disabled.'
  }
}

export async function syncMcpServerTools(id: number, descriptors: McpToolDescriptor[] = []) {
  const server = await findMcpServerById(id)
  if (!server) throw new Error('MCP Server not found')
  if (server.enabled !== 1) throw new Error('MCP Server is disabled')

  const syncedTools = []
  for (const descriptor of descriptors) {
    const mcpToolName = String(descriptor.name ?? '').trim()
    if (!mcpToolName) continue
    const toolName = `${server.name}_${mcpToolName}`.replace(/[^a-zA-Z0-9_]/g, '_')
    await upsertMcpTool(server, toolName, mcpToolName, descriptor)
    syncedTools.push(toolName)
  }

  await setMcpServerStatus(id, 'ready')
  const existingTools = await listMcpToolsByServer(id)

  return {
    success: true,
    status: 'ready',
    syncedCount: syncedTools.length,
    tools: existingTools,
    message:
      descriptors.length > 0
        ? 'MCP tool descriptors synced into Tool Registry.'
        : 'MCP sync endpoint is ready. Phase 1 does not call the real MCP protocol yet.'
  }
}

async function upsertMcpTool(server: McpServerRow, toolName: string, mcpToolName: string, descriptor: McpToolDescriptor) {
  await execute(
    `INSERT INTO tools
     (name, display_name, \`type\`, source, mcp_server_id, mcp_tool_name, version, category, description, enabled, risk_level, success_rate, avg_latency_ms, call_count, input_schema, output_schema, config_json, auth_config)
     VALUES (?, ?, 'mcp', 'mcp', ?, ?, 'v1.0.0', 'MCP', ?, 0, 'medium', 0, 0, 0, ?, ?, ?, JSON_OBJECT('type', 'none'))
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       \`type\` = 'mcp',
       source = 'mcp',
       mcp_server_id = VALUES(mcp_server_id),
       mcp_tool_name = VALUES(mcp_tool_name),
       category = VALUES(category),
       description = VALUES(description),
       input_schema = VALUES(input_schema),
       output_schema = VALUES(output_schema),
       config_json = VALUES(config_json)`,
    [
      toolName,
      String(descriptor.displayName ?? descriptor.display_name ?? mcpToolName),
      server.id,
      mcpToolName,
      descriptor.description ? String(descriptor.description) : null,
      stringifyJson(descriptor.inputSchema ?? descriptor.input_schema ?? null),
      stringifyJson(descriptor.outputSchema ?? descriptor.output_schema ?? null),
      stringifyJson({
        mcpServerId: server.id,
        mcpServerName: server.name,
        mcpToolName,
        phase: 'mcp-client-placeholder'
      })
    ]
  )
}

async function listMcpToolsByServer(serverId: number) {
  return query<RowDataPacket[]>(
    `SELECT id, name, display_name, enabled, mcp_tool_name
     FROM tools
     WHERE \`type\` = 'mcp'
       AND mcp_server_id = ?
     ORDER BY id ASC`,
    [serverId]
  )
}

async function sanitizeMcpServerWithCount(row: McpServerRow) {
  const tools = await listMcpToolsByServer(row.id)
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name ?? row.name,
    display_name: row.display_name ?? row.name,
    endpoint: row.endpoint,
    transport: row.transport ?? 'http',
    enabled: row.enabled,
    status: row.status ?? 'unknown',
    toolCount: tools.length,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function normalizeTransport(value: unknown) {
  const normalized = String(value ?? 'http').trim().toLowerCase()
  return normalized === 'stdio' || normalized === 'sse' || normalized === 'http' ? normalized : 'http'
}

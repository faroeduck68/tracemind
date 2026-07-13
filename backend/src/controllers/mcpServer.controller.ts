import { Request, Response } from 'express'
import {
  addMcpServer,
  editMcpServer,
  getMcpServers,
  switchMcpServer,
  syncMcpServerTools,
  testMcpServerConnection
} from '../services/mcpServer.service'
import { sendSuccess } from '../utils/response'
import { readPagination } from '../utils/pagination'
import { readIdParam } from '../utils/requestParams'

export async function listMcpServersController(req: Request, res: Response) {
  return sendSuccess(res, await getMcpServers(readPagination(req.query) ?? undefined))
}

export async function createMcpServerController(req: Request, res: Response) {
  const id = await addMcpServer(req.body ?? {})
  return sendSuccess(res, { id }, 'MCP Server created', 201)
}

export async function updateMcpServerController(req: Request, res: Response) {
  return sendSuccess(res, await editMcpServer(readIdParam(req), req.body ?? {}), 'MCP Server updated')
}

export async function toggleMcpServerController(req: Request, res: Response) {
  return sendSuccess(res, await switchMcpServer(readIdParam(req)), 'MCP Server toggled')
}

export async function testMcpServerController(req: Request, res: Response) {
  const result = await testMcpServerConnection(readIdParam(req))
  return sendSuccess(res, result, result.message, result.success ? 200 : 400)
}

export async function syncMcpServerToolsController(req: Request, res: Response) {
  const result = await syncMcpServerTools(readIdParam(req), Array.isArray(req.body?.tools) ? req.body.tools : [])
  return sendSuccess(res, result, result.message)
}

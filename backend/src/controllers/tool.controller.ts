import { Request, Response } from 'express'
import {
  addTool,
  checkToolName,
  editTool,
  getTool,
  getTools,
  getToolsStats,
  switchTool,
  testDraftTool,
  testTool,
  testWebSearch
} from '../services/tool.service'
import { sendSuccess } from '../utils/response'
import { getRequestUserId } from '../utils/requestUser'
import { readPagination } from '../utils/pagination'
import { readIdParam } from '../utils/requestParams'

export async function listToolController(req: Request, res: Response) {
  return sendSuccess(res, await getTools(readPagination(req.query) ?? undefined))
}

export async function getToolController(req: Request, res: Response) {
  const tool = await getTool(String(req.params.id))
  if (!tool) {
    return sendSuccess(res, null, 'Tool not found', 404)
  }

  return sendSuccess(res, tool)
}

export async function createToolController(req: Request, res: Response) {
  try {
    const id = await addTool(req.body)
    return sendSuccess(res, { id }, 'Tool created', 201)
  } catch (error) {
    if (isDuplicateToolNameError(error)) {
      return res.status(409).json({
        code: 409,
        message: '工具名已存在',
        field: 'name'
      })
    }
    throw error
  }
}

export async function updateToolController(req: Request, res: Response) {
  return sendSuccess(res, await editTool(readIdParam(req), req.body), 'Tool updated')
}

export async function toggleToolController(req: Request, res: Response) {
  return sendSuccess(res, await switchTool(readIdParam(req)), 'Tool toggled')
}

export async function toolStatsController(_req: Request, res: Response) {
  return sendSuccess(res, await getToolsStats())
}

export async function checkToolNameController(req: Request, res: Response) {
  return sendSuccess(res, await checkToolName(String(req.query.name ?? '')))
}

export async function testToolController(req: Request, res: Response) {
  const result = await testTool(String(req.params.id), req.body?.input ?? {}, getRequestUserId(req))
  return sendSuccess(res, result, result.success ? 'Tool tested' : 'Tool test failed', result.success ? 200 : 400)
}

export async function testDraftToolController(req: Request, res: Response) {
  const result = await testDraftTool({ ...(req.body ?? {}), userId: getRequestUserId(req) })
  return sendSuccess(res, result, result.success ? 'Draft tool tested' : 'Draft tool test failed')
}

export async function testWebSearchController(req: Request, res: Response) {
  try {
    const result = await testWebSearch(String(req.body?.query ?? ''), getRequestUserId(req))
    return sendSuccess(res, result, 'web_search_tool 测试成功')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'web_search_tool 测试失败。'
    return res.status(400).json({ code: 400, message, data: null })
  }
}

function isDuplicateToolNameError(error: unknown) {
  const record = error as { code?: string; errno?: number; message?: string }
  return record?.code === 'ER_DUP_ENTRY' || record?.errno === 1062 || String(record?.message ?? '').includes('Duplicate entry')
}

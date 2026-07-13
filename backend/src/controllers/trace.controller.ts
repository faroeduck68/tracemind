import { Request, Response } from 'express'
import { getRunDetail, getRunHistory, getRunReplay, getTraceForRun } from '../services/trace.service'
import { sendSuccess } from '../utils/response'
import { readPagination } from '../utils/pagination'
import { readIdParam } from '../utils/requestParams'

export async function getTraceController(req: Request, res: Response) {
  return sendSuccess(res, await getTraceForRun(readIdParam(req, 'runId')))
}

export async function getRunController(req: Request, res: Response) {
  const run = await getRunDetail(readIdParam(req, 'runId'))
  if (!run) {
    return sendSuccess(res, null, 'Run not found', 404)
  }

  return sendSuccess(res, run)
}

export async function listRunHistoryController(req: Request, res: Response) {
  return sendSuccess(res, await getRunHistory(readPagination(req.query) ?? undefined))
}

export async function getRunReplayController(req: Request, res: Response) {
  const replay = await getRunReplay(readIdParam(req, 'runId'))
  if (!replay) {
    return sendSuccess(res, null, 'Run not found', 404)
  }

  return sendSuccess(res, replay)
}

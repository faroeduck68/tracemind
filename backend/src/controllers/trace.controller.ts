import { Request, Response } from 'express'
import { getRunDetail, getRunHistory, getRunReplay, getTraceForRun } from '../services/trace.service'
import { sendSuccess } from '../utils/response'

export async function getTraceController(req: Request, res: Response) {
  return sendSuccess(res, await getTraceForRun(Number(req.params.runId)))
}

export async function getRunController(req: Request, res: Response) {
  const run = await getRunDetail(Number(req.params.runId))
  if (!run) {
    return sendSuccess(res, null, 'Run not found', 404)
  }

  return sendSuccess(res, run)
}

export async function listRunHistoryController(_req: Request, res: Response) {
  return sendSuccess(res, await getRunHistory())
}

export async function getRunReplayController(req: Request, res: Response) {
  const replay = await getRunReplay(Number(req.params.runId))
  if (!replay) {
    return sendSuccess(res, null, 'Run not found', 404)
  }

  return sendSuccess(res, replay)
}

import { NextFunction, Request, Response } from 'express'
import { sendError } from '../utils/response'

export function errorMiddleware(error: Error, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = readStatusCode(error, res)
  return sendError(res, error.message || 'Internal Server Error', statusCode)
}

function readStatusCode(error: Error, res: Response) {
  const statusCode = Number((error as Error & { statusCode?: number; status?: number }).statusCode ?? (error as Error & { status?: number }).status)
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600) return statusCode
  return res.statusCode >= 400 ? res.statusCode : 500
}

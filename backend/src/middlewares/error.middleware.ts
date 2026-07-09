import { NextFunction, Request, Response } from 'express'
import { sendError } from '../utils/response'

export function errorMiddleware(error: Error, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = res.statusCode >= 400 ? res.statusCode : 500
  return sendError(res, error.message || 'Internal Server Error', statusCode)
}

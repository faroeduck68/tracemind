import { Response } from 'express'

export type ApiResponse<T = unknown> = {
  code: number
  message: string
  data?: T
}

export function sendSuccess<T>(res: Response, data?: T, message = 'success', statusCode = 200) {
  const payload: ApiResponse<T> = { code: statusCode, message }
  if (data !== undefined) payload.data = data
  return res.status(statusCode).json(payload)
}

export function sendError(res: Response, message = 'Internal Server Error', statusCode = 500) {
  return res.status(statusCode).json({ code: statusCode, message })
}

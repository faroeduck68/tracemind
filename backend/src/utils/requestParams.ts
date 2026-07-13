import { Request } from 'express'

export function readIdParam(req: Request, name = 'id') {
  const value = Number(req.params[name])
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error(`${name} must be a positive integer`) as Error & { statusCode?: number }
    error.statusCode = 400
    throw error
  }
  return value
}

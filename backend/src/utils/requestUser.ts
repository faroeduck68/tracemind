import { Request } from 'express'

export function getRequestUserId(req: Request) {
  const headerValue = req.header('x-user-id')
  const bodyValue = typeof req.body?.userId === 'string' ? req.body.userId : ''
  const queryValue = typeof req.query?.userId === 'string' ? req.query.userId : ''
  return sanitizeUserId(headerValue ?? bodyValue ?? queryValue) || 'default_user'
}

function sanitizeUserId(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/[^\w:@.-]/g, '')
    .slice(0, 80)
}

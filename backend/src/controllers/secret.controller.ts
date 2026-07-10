import { Request, Response } from 'express'
import { getRequestUserId } from '../utils/requestUser'
import { getUserSecrets, removeUserSecret, saveUserSecret } from '../services/userSecret.service'
import { sendSuccess } from '../utils/response'

export async function createSecretController(req: Request, res: Response) {
  const userId = getRequestUserId(req)
  return sendSuccess(res, await saveUserSecret(userId, req.body ?? {}), 'Secret saved', 201)
}

export async function listSecretController(req: Request, res: Response) {
  const userId = getRequestUserId(req)
  return sendSuccess(res, await getUserSecrets(userId))
}

export async function deleteSecretController(req: Request, res: Response) {
  const userId = getRequestUserId(req)
  return sendSuccess(res, await removeUserSecret(userId, String(req.params.name ?? '')), 'Secret deleted')
}

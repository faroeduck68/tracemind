import { Request, Response } from 'express'
import { getSettings, updateSettings } from '../models/setting.model'
import { sendSuccess } from '../utils/response'

export async function getSettingsController(_req: Request, res: Response) {
  return sendSuccess(res, await getSettings())
}

export async function updateSettingsController(req: Request, res: Response) {
  return sendSuccess(res, await updateSettings(req.body), 'Settings updated')
}

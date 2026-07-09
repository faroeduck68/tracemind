import { Request, Response } from 'express'
import path from 'path'
import { sendSuccess } from '../utils/response'

export async function uploadFileController(req: Request, res: Response) {
  if (!req.file) {
    return sendSuccess(res, null, 'file is required', 400)
  }

  return sendSuccess(
    res,
    {
      filename: req.file.originalname,
      storedName: req.file.filename,
      filePath: path.relative(process.cwd(), req.file.path).replace(/\\/g, '/'),
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date().toISOString()
    },
    'File uploaded'
  )
}

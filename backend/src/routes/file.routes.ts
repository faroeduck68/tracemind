import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import multer from 'multer'
import { uploadFileController } from '../controllers/file.controller'
import { asyncHandler } from '../utils/asyncHandler'

const uploadDir = path.resolve(process.cwd(), 'uploads', 'source')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    const safeName = file.originalname.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
    callback(null, `${Date.now()}-${safeName}`)
  }
})

export const fileRouter = Router()
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }
})

fileRouter.post('/upload', upload.single('file'), asyncHandler(uploadFileController))

import crypto from 'crypto'
import { env } from '../config/env'

const ALGORITHM = 'aes-256-gcm'

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
}

export function decryptSecret(payload: string) {
  const [version, ivText, tagText, encryptedText] = payload.split(':')
  if (version !== 'v1' || !ivText || !tagText || !encryptedText) {
    throw new Error('Invalid encrypted secret payload.')
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivText, 'base64'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64')), decipher.final()]).toString('utf8')
}

export function maskSecret(value: string) {
  const suffix = value.slice(-4).toUpperCase()
  return `****${suffix}`
}

function getEncryptionKey() {
  const configuredKey = env.secretEncryptionKey || (env.nodeEnv === 'production' ? '' : 'tracemind-local-dev-secret')
  if (!configuredKey) {
    throw new Error('生产环境必须配置 SECRET_ENCRYPTION_KEY 后才能保存用户 Secret。')
  }
  return crypto.createHash('sha256').update(configuredKey).digest()
}

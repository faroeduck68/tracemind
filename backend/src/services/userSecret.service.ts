import { deleteUserSecret, findUserSecret, listUserSecrets, upsertUserSecret } from '../models/userSecret.model'
import { decryptSecret, encryptSecret, maskSecret } from './secretCrypto.service'

export async function saveUserSecret(
  userId: string,
  input: {
    name?: unknown
    provider?: unknown
    value?: unknown
  }
) {
  const name = normalizeSecretName(input.name)
  const value = String(input.value ?? '').trim()
  if (!name) throw new Error('Secret 名称不能为空')
  if (!value) throw new Error('Secret value 不能为空')

  await upsertUserSecret({
    userId,
    name,
    provider: typeof input.provider === 'string' ? input.provider.trim() || null : null,
    encryptedValue: encryptSecret(value),
    maskedValue: maskSecret(value)
  })

  const saved = await findUserSecret(userId, name)
  return saved ? sanitizeSecret(saved) : { name, maskedValue: maskSecret(value) }
}

export async function getUserSecrets(userId: string) {
  const rows = await listUserSecrets(userId)
  return rows.map(sanitizeSecret)
}

export async function removeUserSecret(userId: string, name: string) {
  await deleteUserSecret(userId, normalizeSecretName(name))
  return { name: normalizeSecretName(name) }
}

export async function readUserSecretValue(userId: string, name: string) {
  const row = await findUserSecret(userId, normalizeSecretName(name))
  return row ? decryptSecret(row.encrypted_value) : ''
}

function sanitizeSecret(row: {
  id: number
  name: string
  provider: string | null
  masked_value: string
  created_at?: string
  updated_at?: string
}) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    maskedValue: row.masked_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function normalizeSecretName(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/[^\w.-]/g, '')
    .slice(0, 100)
}

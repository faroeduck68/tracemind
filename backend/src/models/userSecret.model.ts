import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'

export type UserSecretRow = RowDataPacket & {
  id: number
  user_id: string
  name: string
  provider: string | null
  encrypted_value: string
  masked_value: string
  created_at: string
  updated_at: string
}

let userSecretsSchemaReady = false

export async function ensureUserSecretsTable() {
  if (userSecretsSchemaReady) return
  await execute(`
    CREATE TABLE IF NOT EXISTS user_secrets (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id VARCHAR(80) NOT NULL,
      name VARCHAR(100) NOT NULL,
      provider VARCHAR(100) NULL,
      encrypted_value TEXT NOT NULL,
      masked_value VARCHAR(40) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_secret_name (user_id, name),
      INDEX idx_user_secrets_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  userSecretsSchemaReady = true
}

export async function upsertUserSecret(input: {
  userId: string
  name: string
  provider?: string | null
  encryptedValue: string
  maskedValue: string
}) {
  await ensureUserSecretsTable()
  const result = await execute<ResultSetHeader>(
    `INSERT INTO user_secrets (user_id, name, provider, encrypted_value, masked_value)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       provider = VALUES(provider),
       encrypted_value = VALUES(encrypted_value),
       masked_value = VALUES(masked_value),
       updated_at = NOW()`,
    [input.userId, input.name, input.provider ?? null, input.encryptedValue, input.maskedValue]
  )
  return result.insertId
}

export async function listUserSecrets(userId: string) {
  await ensureUserSecretsTable()
  return query<UserSecretRow[]>(
    `SELECT id, user_id, name, provider, encrypted_value, masked_value, created_at, updated_at
     FROM user_secrets
     WHERE user_id = ?
     ORDER BY provider ASC, name ASC`,
    [userId]
  )
}

export async function findUserSecret(userId: string, name: string) {
  await ensureUserSecretsTable()
  const rows = await query<UserSecretRow[]>(
    `SELECT id, user_id, name, provider, encrypted_value, masked_value, created_at, updated_at
     FROM user_secrets
     WHERE user_id = ? AND name = ?
     LIMIT 1`,
    [userId, name]
  )
  return rows[0] ?? null
}

export async function deleteUserSecret(userId: string, name: string) {
  await ensureUserSecretsTable()
  await execute(`DELETE FROM user_secrets WHERE user_id = ? AND name = ?`, [userId, name])
}

import { RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'
import { stringifyJson } from '../utils/json'

export type SettingRow = RowDataPacket & {
  id: number
  language: string
  default_model: string | null
  theme: string
  auto_save: 0 | 1
  auto_save_interval: number
  webhook_url: string | null
  settings_json: unknown
  updated_at: string
}

export async function getSettings() {
  const rows = await query<SettingRow[]>(
    `SELECT id, language, default_model, theme, auto_save, auto_save_interval, webhook_url, settings_json, updated_at
     FROM user_settings
     WHERE id = 1`
  )

  if (rows[0]) return rows[0]

  await execute(
    `INSERT INTO user_settings (id, language, default_model, theme, auto_save, auto_save_interval, settings_json)
     VALUES (1, 'zh-CN', 'mock-workflow-generator', 'system', 1, 5, JSON_OBJECT())`
  )

  const createdRows = await query<SettingRow[]>(
    `SELECT id, language, default_model, theme, auto_save, auto_save_interval, webhook_url, settings_json, updated_at
     FROM user_settings
     WHERE id = 1`
  )

  return createdRows[0]
}

export async function updateSettings(input: Partial<SettingRow>) {
  await execute(
    `INSERT INTO user_settings
     (id, language, default_model, theme, auto_save, auto_save_interval, webhook_url, settings_json)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       language = VALUES(language),
       default_model = VALUES(default_model),
       theme = VALUES(theme),
       auto_save = VALUES(auto_save),
       auto_save_interval = VALUES(auto_save_interval),
       webhook_url = VALUES(webhook_url),
       settings_json = VALUES(settings_json)`,
    [
      input.language ?? 'zh-CN',
      input.default_model ?? 'mock-workflow-generator',
      input.theme ?? 'system',
      input.auto_save ?? 1,
      input.auto_save_interval ?? 5,
      input.webhook_url ?? null,
      stringifyJson(input.settings_json ?? {})
    ]
  )

  return getSettings()
}

import dotenv from 'dotenv'

dotenv.config()

function readNumber(name: string, fallback: number) {
  const value = process.env[name]
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readBoolean(name: string, fallback: boolean) {
  const value = process.env[name]
  if (value == null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: readNumber('PORT', 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  mockMode: readBoolean('MOCK_MODE', false),
  allowMockFallback: readBoolean('ALLOW_MOCK_FALLBACK', false),
  useRealLlm: readBoolean('USE_REAL_LLM', true),
  useRealFileParse: readBoolean('USE_REAL_FILE_PARSE', true),
  useRealDocxExport: readBoolean('USE_REAL_DOCX_EXPORT', false),
  secretEncryptionKey: process.env.SECRET_ENCRYPTION_KEY ?? process.env.TOOL_SECRET_KEY ?? '',
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseURL: process.env.OPENAI_BASE_URL ?? 'https://api.deepseek.com',
    model: process.env.OPENAI_MODEL ?? 'deepseek-chat'
  },
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: readNumber('DB_PORT', 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'tracemind',
    connectionLimit: readNumber('DB_CONNECTION_LIMIT', 10)
  }
}

import mysql, { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
import { env } from './env'

let pool: Pool | null = null

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      connectionLimit: env.db.connectionLimit,
      waitForConnections: true,
      namedPlaceholders: true,
      dateStrings: true,
      charset: 'utf8mb4'
    })
  }

  return pool
}

export async function closePool() {
  if (!pool) return
  const current = pool
  pool = null
  await current.end()
}

export async function query<T extends RowDataPacket[]>(sql: string, params: unknown[] = []) {
  const [rows] = await getPool().query<T>(sql, params as any[])
  return rows
}

export async function execute<T = mysql.ResultSetHeader>(sql: string, params: unknown[] = []) {
  const [result] = await getPool().execute<T & mysql.ResultSetHeader>(sql, params as any[])
  return result
}

export async function withTransaction<T>(handler: (connection: PoolConnection) => Promise<T>) {
  const connection = await getPool().getConnection()
  try {
    await connection.beginTransaction()
    const result = await handler(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

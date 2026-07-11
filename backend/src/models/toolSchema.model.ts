import { RowDataPacket } from 'mysql2/promise'
import { execute, query } from '../config/db'
import { stringifyJson } from '../utils/json'

let toolSchemaReady = false

export async function ensureToolConfigSchema() {
  if (toolSchemaReady) return

  await ensureMcpServersTable()
  const columns = await listColumns('tools')
  const migrations = [
    ['type', `ALTER TABLE tools ADD COLUMN \`type\` VARCHAR(30) DEFAULT 'builtin' AFTER display_name`],
    ['source', `ALTER TABLE tools ADD COLUMN source VARCHAR(30) DEFAULT 'local' AFTER \`type\``],
    ['mcp_server_id', `ALTER TABLE tools ADD COLUMN mcp_server_id BIGINT NULL AFTER source`],
    ['mcp_tool_name', `ALTER TABLE tools ADD COLUMN mcp_tool_name VARCHAR(100) NULL AFTER mcp_server_id`],
    ['risk_level', `ALTER TABLE tools ADD COLUMN risk_level VARCHAR(30) DEFAULT 'low' AFTER enabled`],
    ['config_json', `ALTER TABLE tools ADD COLUMN config_json JSON NULL AFTER output_schema`],
    ['auth_config', `ALTER TABLE tools ADD COLUMN auth_config JSON NULL AFTER config_json`]
  ] as const

  for (const [column, sql] of migrations) {
    if (!columns.has(column)) await execute(sql)
  }

  await execute(`UPDATE tools SET \`type\` = 'builtin' WHERE \`type\` IS NULL OR \`type\` = ''`)
  await execute(`UPDATE tools SET source = IF(\`type\` = 'mcp', 'mcp', 'local') WHERE source IS NULL OR source = ''`)
  await ensureMcpToolForeignKey()
  await ensureWeatherExampleTool()
  await ensureAmapWeatherToolDefaults()
  await ensureWebSearchTool()
  toolSchemaReady = true
}

async function ensureWebSearchTool() {
  await execute(
    `INSERT INTO tools
     (name, display_name, \`type\`, version, category, description, enabled, risk_level, success_rate, avg_latency_ms, call_count, input_schema, output_schema)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       \`type\` = VALUES(\`type\`),
       category = VALUES(category),
       description = VALUES(description),
       input_schema = VALUES(input_schema),
       output_schema = VALUES(output_schema)`,
    [
      'web_search_tool',
      '网页搜索工具',
      'builtin',
      'v1.0.0',
      '检索搜索',
      '根据用户问题搜索互联网实时信息，并返回摘要与来源。',
      1,
      'low',
      0,
      0,
      0,
      stringifyJson({ query: { type: 'string', required: true } }),
      stringifyJson({ results: 'array', summary: 'string', sources: 'array' })
    ]
  )
}

async function ensureMcpServersTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL UNIQUE,
      display_name VARCHAR(100),
      endpoint VARCHAR(500) NOT NULL,
      transport VARCHAR(50) DEFAULT 'http',
      enabled TINYINT DEFAULT 1,
      status VARCHAR(30) DEFAULT 'unknown',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

async function ensureMcpToolForeignKey() {
  const indexes = await query<RowDataPacket[]>(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tools'
       AND INDEX_NAME = 'idx_tools_mcp_server_id'
     LIMIT 1`
  )
  if (!indexes.length) await execute(`ALTER TABLE tools ADD INDEX idx_tools_mcp_server_id (mcp_server_id)`)

  const constraints = await query<RowDataPacket[]>(
    `SELECT CONSTRAINT_NAME
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tools'
       AND CONSTRAINT_NAME = 'fk_tools_mcp_server'
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'
     LIMIT 1`
  )
  if (!constraints.length) {
    await execute(`
      ALTER TABLE tools
      ADD CONSTRAINT fk_tools_mcp_server
      FOREIGN KEY (mcp_server_id) REFERENCES mcp_servers(id)
      ON DELETE SET NULL
    `)
  }
}

async function ensureWeatherExampleTool() {
  await execute(
    `INSERT INTO tools
     (name, display_name, \`type\`, version, category, description, enabled, risk_level, success_rate, avg_latency_ms, call_count, input_schema, output_schema, config_json, auth_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       \`type\` = VALUES(\`type\`),
       category = VALUES(category),
       description = VALUES(description),
       input_schema = VALUES(input_schema),
       output_schema = VALUES(output_schema),
       config_json = VALUES(config_json),
       auth_config = VALUES(auth_config)`,
    [
      'weather_query_tool',
      '天气查询工具',
      'http',
      'v1.0.0',
      'HTTP API',
      '根据城市查询实时天气',
      0,
      'low',
      0,
      0,
      0,
      stringifyJson({
        city: {
          type: 'string',
          required: true
        }
      }),
      stringifyJson({
        city: 'string',
        province: 'string',
        weather: 'string',
        temperature: 'string',
        winddirection: 'string',
        windpower: 'string',
        humidity: 'string',
        reporttime: 'string'
      }),
      stringifyJson({
        method: 'GET',
        endpoint: 'https://restapi.amap.com/v3/weather/weatherInfo',
        headers: {},
        queryParams: {
          city: '{{input.city}}',
          extensions: 'base'
        },
        bodyTemplate: {},
        inputMapping: {},
        outputMapping: {
          city: 'lives[0].city',
          province: 'lives[0].province',
          weather: 'lives[0].weather',
          temperature: 'lives[0].temperature',
          winddirection: 'lives[0].winddirection',
          windpower: 'lives[0].windpower',
          humidity: 'lives[0].humidity',
          reporttime: 'lives[0].reporttime',
          status: 'status',
          info: 'info'
        }
      }),
      stringifyJson({
        type: 'apiKey',
        keyName: 'key',
        in: 'query',
        value: 'userSecret:weather',
        fallback: true
      })
    ]
  )
}

async function ensureAmapWeatherToolDefaults() {
  await execute(
    `UPDATE tools
     SET input_schema = ?,
         output_schema = ?,
         config_json = ?
     WHERE \`type\` = 'http'
       AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.endpoint')) = ?`,
    [
      stringifyJson({
        city: {
          type: 'string',
          required: true
        }
      }),
      stringifyJson({
        city: 'string',
        province: 'string',
        weather: 'string',
        temperature: 'string',
        winddirection: 'string',
        windpower: 'string',
        humidity: 'string',
        reporttime: 'string'
      }),
      stringifyJson({
        method: 'GET',
        endpoint: 'https://restapi.amap.com/v3/weather/weatherInfo',
        headers: {},
        queryParams: {
          city: '{{input.city}}',
          extensions: 'base'
        },
        bodyTemplate: {},
        inputMapping: {},
        outputMapping: {
          city: 'lives[0].city',
          province: 'lives[0].province',
          weather: 'lives[0].weather',
          temperature: 'lives[0].temperature',
          winddirection: 'lives[0].winddirection',
          windpower: 'lives[0].windpower',
          humidity: 'lives[0].humidity',
          reporttime: 'lives[0].reporttime',
          status: 'status',
          info: 'info'
        }
      }),
      'https://restapi.amap.com/v3/weather/weatherInfo'
    ]
  )
}

async function listColumns(tableName: string) {
  const rows = await query<RowDataPacket[]>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tableName]
  )

  return new Set(rows.map((row) => String(row.COLUMN_NAME)))
}

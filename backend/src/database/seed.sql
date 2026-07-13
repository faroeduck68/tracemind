USE tracemind;

SET NAMES utf8mb4;

INSERT INTO tools
(name, display_name, `type`, version, category, description, enabled, risk_level, success_rate, avg_latency_ms, call_count)
VALUES
('user_input', '用户输入', 'builtin', 'v1.0.0', '输入', '接收用户原始需求', 1, 'low', 99.0, 100, 0),
('intent_classifier', '意图识别器', 'builtin', 'v1.0.0', '智能分析', '识别用户任务意图', 1, 'low', 94.0, 800, 0),
('pdf_parse_tool', 'PDF 解析工具', 'builtin', 'v1.2.0', '数据处理', '解析 PDF 文件内容，提取文本和结构化信息', 1, 'low', 96.2, 1230, 2341),
('financial_extract_tool', '财务指标提取工具', 'builtin', 'v1.1.0', '数据分析', '从财报文本中提取收入、利润、负债率、现金流等指标', 1, 'low', 92.5, 1870, 1892),
('risk_summary_tool', '风险总结工具', 'builtin', 'v1.0.3', '数据分析', '基于财务指标生成风险分析与总结', 1, 'low', 91.3, 2340, 1256),
('knowledge_search_tool', '知识检索工具', 'builtin', 'v1.1.0', '检索搜索', '从本地知识库 knowledge_chunks 中检索相关片段', 1, 'low', 90.2, 980, 4532),
('finance_knowledge_base', '财务知识检索工具（兼容别名）', 'builtin', 'v1.0.1', '检索搜索', '兼容旧工作流，实际调用本地知识库检索工具', 1, 'low', 90.2, 980, 4532),
('summary_llm', '总结大模型工具', 'builtin', 'v1.0.0', '内容生成', '调用大模型生成总结内容', 1, 'low', 95.0, 1050, 3214),
('report_output', '报告输出工具', 'builtin', 'v1.0.0', '输出', '生成结构化报告并输出结果', 1, 'low', 97.0, 760, 2105),
('financial_risk_tool', '财务风险分析工具', 'builtin', 'v1.0.0', '数据分析', '基于财务指标输出结构化风险判断与建议', 1, 'low', 91.0, 1600, 0),
('report_generate_tool', '报告生成工具', 'builtin', 'v1.0.0', '内容生成', '将财务指标与风险分析汇总为 Markdown 报告', 1, 'low', 95.5, 900, 0),
('markdown_to_docx_tool', 'Word 导出工具', 'builtin', 'v1.0.0', '输出', '将 Markdown 报告转换为 Word 文件（第一版 Mock）', 1, 'low', 96.0, 700, 0),
('report_output_tool', '报告结果输出工具', 'builtin', 'v1.0.0', '输出', '返回最终报告下载链接与分析结论', 1, 'low', 97.5, 500, 0)
ON DUPLICATE KEY UPDATE
display_name = VALUES(display_name),
`type` = VALUES(`type`),
version = VALUES(version),
category = VALUES(category),
description = VALUES(description),
enabled = VALUES(enabled),
risk_level = VALUES(risk_level),
success_rate = VALUES(success_rate),
avg_latency_ms = VALUES(avg_latency_ms);

INSERT INTO tools
(name, display_name, `type`, version, category, description, enabled, risk_level, input_schema, output_schema, config_json, auth_config)
VALUES
(
  'weather_query_tool',
  '天气查询工具',
  'http',
  'v1.0.0',
  'HTTP API',
  '根据城市查询实时天气',
  0,
  'low',
  JSON_OBJECT('city', JSON_OBJECT('type', 'string', 'required', true)),
  JSON_OBJECT(
    'city', 'string',
    'province', 'string',
    'weather', 'string',
    'temperature', 'string',
    'winddirection', 'string',
    'windpower', 'string',
    'humidity', 'string',
    'reporttime', 'string'
  ),
  JSON_OBJECT(
    'method', 'GET',
    'endpoint', 'https://restapi.amap.com/v3/weather/weatherInfo',
    'headers', JSON_OBJECT(),
    'queryParams', JSON_OBJECT('city', '{{input.city}}', 'extensions', 'base'),
    'bodyTemplate', JSON_OBJECT(),
    'inputMapping', JSON_OBJECT(),
    'outputMapping', JSON_OBJECT(
      'city', 'lives[0].city',
      'province', 'lives[0].province',
      'weather', 'lives[0].weather',
      'temperature', 'lives[0].temperature',
      'winddirection', 'lives[0].winddirection',
      'windpower', 'lives[0].windpower',
      'humidity', 'lives[0].humidity',
      'reporttime', 'lives[0].reporttime',
      'status', 'status',
      'info', 'info'
    )
  ),
  JSON_OBJECT('type', 'apiKey', 'keyName', 'key', 'in', 'query', 'value', 'userSecret:weather', 'fallback', true)
)
ON DUPLICATE KEY UPDATE
display_name = VALUES(display_name),
`type` = VALUES(`type`),
category = VALUES(category),
description = VALUES(description),
input_schema = VALUES(input_schema),
output_schema = VALUES(output_schema),
config_json = VALUES(config_json),
auth_config = VALUES(auth_config);

INSERT INTO tools
(name, display_name, `type`, version, category, description, enabled, risk_level, input_schema, output_schema)
VALUES
(
  'web_search_tool',
  '网页搜索工具',
  'builtin',
  'v1.0.0',
  '检索搜索',
  '根据用户问题搜索互联网实时信息，并返回摘要与来源。',
  1,
  'low',
  JSON_OBJECT('query', JSON_OBJECT('type', 'string', 'required', true)),
  JSON_OBJECT('results', 'array', 'summary', 'string', 'sources', 'array')
)
ON DUPLICATE KEY UPDATE
display_name = VALUES(display_name),
`type` = VALUES(`type`),
category = VALUES(category),
description = VALUES(description),
input_schema = VALUES(input_schema),
output_schema = VALUES(output_schema);

INSERT INTO memories
(memory_type, title, content, importance, importance_score, source_type, enabled)
VALUES
('preference', '输出偏好', '用户偏好结构化表格和简洁摘要。', 'high', 5, 'seed', 1),
('task_history', '常见任务', '用户经常执行财报分析、风险总结和知识库检索任务。', 'medium', 4, 'seed', 1),
('tool_preference', '工具偏好', '财报类任务优先使用 PDF 解析、财务指标提取和风险总结工具。', 'medium', 4, 'seed', 1);

INSERT INTO workflow_templates
(title, description, category, badge, is_official, workflow_json)
VALUES
(
  '财报风险分析 Workflow',
  '读取财报、提取指标、检索知识并生成风险总结。',
  '财务分析',
  'official',
  1,
  JSON_OBJECT('name', '财报风险分析 Workflow', 'intent', 'financial_report_analysis')
);

INSERT INTO knowledge_bases
(name, description, embedding_model, retrieval_mode, top_k, document_count, chunk_count, status, owner_user_id)
VALUES
('财务风险知识库', '本地财务风险知识库，用于财报风险分析场景。', 'local-keyword-v1', 'keyword', 5, 0, 0, 'normal', 'default_user');

INSERT INTO user_settings
(id, language, default_model, theme, auto_save, auto_save_interval, settings_json)
VALUES
(1, 'zh-CN', 'mock-workflow-generator', 'system', 1, 5, JSON_OBJECT('traceReplay', true, 'toolRanking', true))
ON DUPLICATE KEY UPDATE
language = VALUES(language),
default_model = VALUES(default_model),
theme = VALUES(theme),
auto_save = VALUES(auto_save),
auto_save_interval = VALUES(auto_save_interval),
settings_json = VALUES(settings_json);

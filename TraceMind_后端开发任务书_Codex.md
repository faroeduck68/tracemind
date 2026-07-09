# TraceMind 后端开发任务书（给 Codex 使用）

> 目标：让 Codex 根据当前前端页面和 mock 数据，实现一套 Node.js 后端。  
> 技术栈建议：**Node.js + Express + TypeScript + MySQL**。  
> 第一阶段不要追求复杂 AI 能力，先实现完整业务闭环：  
> **生成 Workflow → 保存 Workflow → 运行 Workflow → 调用工具 → 记录 Trace → 返回给前端展示**。

---

## 1. 项目背景

TraceMind 是一个可解释 AI Agent Workflow 平台。

它的核心不是普通聊天，而是：

```text
用户输入自然语言需求
↓
后端生成 Workflow 节点和连线
↓
前端展示 Workflow 图
↓
用户点击运行
↓
后端按节点执行工具
↓
每一步写入 Trace 执行轨迹
↓
前端展示执行过程、工具评分、失败分析
```

当前前端已经有以下核心数据结构：

```ts
NodeStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped'

WorkflowNode = {
  id: string
  type: string
  label: string
  subLabel: string
  icon: string
  position: { x: number; y: number }
  status: NodeStatus
  tone: string
  tool: string
  confidence: number
  reason: string
}

WorkflowEdge = {
  id: string
  source: string
  target: string
  branch?: 'main' | 'alt'
}

TraceStep = {
  id: string
  stepName: string
  nodeId?: string
  time: string
  status: NodeStatus
  tool?: string
  latency?: string
}
```

后端必须围绕这些字段进行设计。

---

## 2. 后端核心目标

后端第一版必须实现 5 件事：

```text
1. 提供工具库接口
2. 根据自然语言生成 Workflow
3. 保存 Workflow 节点和连线
4. 执行 Workflow 节点
5. 记录并返回 Trace 执行轨迹
```

第一版可以使用模拟工具，不必真的解析 PDF、真的分析财报。

但是这些流程必须真实：

```text
Workflow 保存是真的
节点执行顺序是真的
Trace 写入数据库是真的
工具调用日志是真的
```

---

## 3. 推荐目录结构

```text
backend/
├─ package.json
├─ tsconfig.json
├─ .env
├─ src/
│  ├─ app.ts
│  ├─ server.ts
│  │
│  ├─ config/
│  │  ├─ db.ts
│  │  ├─ env.ts
│  │  └─ llm.ts
│  │
│  ├─ routes/
│  │  ├─ workflow.routes.ts
│  │  ├─ trace.routes.ts
│  │  ├─ tool.routes.ts
│  │  ├─ template.routes.ts
│  │  ├─ knowledge.routes.ts
│  │  ├─ memory.routes.ts
│  │  └─ setting.routes.ts
│  │
│  ├─ controllers/
│  │  ├─ workflow.controller.ts
│  │  ├─ trace.controller.ts
│  │  ├─ tool.controller.ts
│  │  ├─ template.controller.ts
│  │  ├─ knowledge.controller.ts
│  │  ├─ memory.controller.ts
│  │  └─ setting.controller.ts
│  │
│  ├─ services/
│  │  ├─ llm.service.ts
│  │  ├─ workflowGenerator.service.ts
│  │  ├─ workflowExecutor.service.ts
│  │  ├─ trace.service.ts
│  │  ├─ toolRanking.service.ts
│  │  ├─ context.service.ts
│  │  ├─ tool.service.ts
│  │  ├─ template.service.ts
│  │  ├─ knowledge.service.ts
│  │  ├─ memory.service.ts
│  │  └─ failureAnalysis.service.ts
│  │
│  ├─ models/
│  │  ├─ db.ts
│  │  ├─ workflow.model.ts
│  │  ├─ workflowNode.model.ts
│  │  ├─ workflowEdge.model.ts
│  │  ├─ workflowRun.model.ts
│  │  ├─ traceStep.model.ts
│  │  ├─ tool.model.ts
│  │  ├─ template.model.ts
│  │  ├─ knowledge.model.ts
│  │  ├─ memory.model.ts
│  │  └─ setting.model.ts
│  │
│  ├─ tools/
│  │  ├─ index.ts
│  │  ├─ userInput.tool.ts
│  │  ├─ intentClassifier.tool.ts
│  │  ├─ pdfParse.tool.ts
│  │  ├─ financialExtract.tool.ts
│  │  ├─ riskSummary.tool.ts
│  │  ├─ knowledgeSearch.tool.ts
│  │  ├─ summaryLLM.tool.ts
│  │  └─ reportOutput.tool.ts
│  │
│  ├─ middlewares/
│  │  ├─ error.middleware.ts
│  │  ├─ upload.middleware.ts
│  │  └─ notFound.middleware.ts
│  │
│  ├─ utils/
│  │  ├─ response.ts
│  │  ├─ asyncHandler.ts
│  │  ├─ sleep.ts
│  │  ├─ uuid.ts
│  │  ├─ dagValidator.ts
│  │  ├─ topologicalSort.ts
│  │  ├─ jsonRepair.ts
│  │  └─ promptBuilder.ts
│  │
│  ├─ types/
│  │  ├─ workflow.ts
│  │  ├─ trace.ts
│  │  ├─ tool.ts
│  │  ├─ context.ts
│  │  └─ common.ts
│  │
│  └─ database/
│     ├─ schema.sql
│     └─ seed.sql
```

---

## 4. 第一版最小接口

第一版优先实现这些接口。

### 4.1 Workflow 接口

```http
POST /api/workflows/generate
GET  /api/workflows/:id
PUT  /api/workflows/:id
POST /api/workflows/:id/run
GET  /api/workflows
DELETE /api/workflows/:id
```

### 4.2 Trace 接口

```http
GET /api/runs/:runId/trace
GET /api/runs/:runId
```

### 4.3 Tool 工具库接口

```http
GET  /api/tools
GET  /api/tools/:id
POST /api/tools
PUT  /api/tools/:id
PATCH /api/tools/:id/toggle
GET  /api/tools/stats
```

### 4.4 模板库接口

```http
GET  /api/templates
GET  /api/templates/:id
POST /api/templates
POST /api/templates/:id/use
```

### 4.5 知识库接口

```http
GET  /api/knowledge-bases
POST /api/knowledge-bases
GET  /api/knowledge-bases/:id
POST /api/knowledge-bases/:id/documents
POST /api/knowledge-bases/:id/search
```

### 4.6 记忆接口

```http
GET    /api/memories
POST   /api/memories
PUT    /api/memories/:id
DELETE /api/memories/:id
GET    /api/memories/for-workflow
```

### 4.7 设置接口

```http
GET /api/settings
PUT /api/settings
```

---

## 5. 数据库表设计

第一版建议先创建这些表。

---

### 5.1 tools 工具表

```sql
CREATE TABLE tools (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  version VARCHAR(50) DEFAULT 'v1.0.0',
  category VARCHAR(50),
  description TEXT,
  enabled TINYINT DEFAULT 1,
  success_rate DECIMAL(5,2) DEFAULT 0,
  avg_latency_ms INT DEFAULT 0,
  call_count INT DEFAULT 0,
  config_schema JSON,
  input_schema JSON,
  output_schema JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

### 5.2 workflows 工作流表

```sql
CREATE TABLE workflows (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  source_type VARCHAR(50) DEFAULT 'manual',
  original_query TEXT,
  intent VARCHAR(100),
  confidence DECIMAL(5,4),
  status VARCHAR(30) DEFAULT 'draft',
  workflow_json JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

说明：

```text
workflow_json 用于保存完整前端数据。
同时也要拆分保存到 workflow_nodes 和 workflow_edges，方便后端执行。
```

---

### 5.3 workflow_nodes 节点表

```sql
CREATE TABLE workflow_nodes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  workflow_id BIGINT NOT NULL,
  node_key VARCHAR(100) NOT NULL,
  node_type VARCHAR(100) NOT NULL,
  label VARCHAR(100),
  sub_label VARCHAR(200),
  icon VARCHAR(100),
  x INT DEFAULT 0,
  y INT DEFAULT 0,
  status VARCHAR(30) DEFAULT 'idle',
  tone VARCHAR(30),
  tool_name VARCHAR(100),
  confidence DECIMAL(5,4),
  reason TEXT,
  config JSON,
  input_schema JSON,
  output_schema JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

---

### 5.4 workflow_edges 连线表

```sql
CREATE TABLE workflow_edges (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  workflow_id BIGINT NOT NULL,
  edge_key VARCHAR(100),
  source_node_key VARCHAR(100) NOT NULL,
  target_node_key VARCHAR(100) NOT NULL,
  branch VARCHAR(50) DEFAULT 'main',
  condition_expr TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

---

### 5.5 workflow_runs 运行记录表

```sql
CREATE TABLE workflow_runs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  workflow_id BIGINT NOT NULL,
  status VARCHAR(30) DEFAULT 'running',
  input_data JSON,
  output_data JSON,
  total_latency_ms INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  error_message TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,

  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

---

### 5.6 trace_steps 执行轨迹表

```sql
CREATE TABLE trace_steps (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  workflow_id BIGINT NOT NULL,
  node_key VARCHAR(100),
  step_name VARCHAR(100) NOT NULL,
  step_type VARCHAR(100),
  status VARCHAR(30) DEFAULT 'running',
  tool_name VARCHAR(100),
  reason TEXT,
  confidence DECIMAL(5,4),
  input_data JSON,
  output_data JSON,
  error_message TEXT,
  latency_ms INT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,

  FOREIGN KEY (run_id) REFERENCES workflow_runs(id),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

---

### 5.7 tool_ranking_logs 工具评分表

```sql
CREATE TABLE tool_ranking_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  node_key VARCHAR(100),
  tool_name VARCHAR(100) NOT NULL,
  keyword_score DECIMAL(5,4) DEFAULT 0,
  semantic_score DECIMAL(5,4) DEFAULT 0,
  history_score DECIMAL(5,4) DEFAULT 0,
  preference_score DECIMAL(5,4) DEFAULT 0,
  final_score DECIMAL(5,4) NOT NULL,
  selected TINYINT DEFAULT 0,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (run_id) REFERENCES workflow_runs(id)
);
```

---

### 5.8 tool_call_logs 工具调用日志表

```sql
CREATE TABLE tool_call_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT,
  node_key VARCHAR(100),
  tool_name VARCHAR(100) NOT NULL,
  input_data JSON,
  output_data JSON,
  status VARCHAR(30) DEFAULT 'running',
  error_message TEXT,
  latency_ms INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### 5.9 workflow_templates 模板表

```sql
CREATE TABLE workflow_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  badge VARCHAR(50),
  is_official TINYINT DEFAULT 0,
  workflow_json JSON NOT NULL,
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  use_count INT DEFAULT 0,
  starred_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

### 5.10 knowledge_bases 知识库表

```sql
CREATE TABLE knowledge_bases (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  embedding_model VARCHAR(100),
  chunk_size INT DEFAULT 800,
  chunk_overlap INT DEFAULT 120,
  retrieval_mode VARCHAR(50) DEFAULT 'hybrid',
  top_k INT DEFAULT 5,
  document_count INT DEFAULT 0,
  chunk_count INT DEFAULT 0,
  status VARCHAR(30) DEFAULT 'normal',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

### 5.11 knowledge_documents 文档表

```sql
CREATE TABLE knowledge_documents (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  knowledge_base_id BIGINT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  file_size BIGINT,
  file_path VARCHAR(500),
  parse_status VARCHAR(30) DEFAULT 'pending',
  chunk_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id)
);
```

---

### 5.12 knowledge_chunks 文档切片表

```sql
CREATE TABLE knowledge_chunks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  knowledge_base_id BIGINT NOT NULL,
  document_id BIGINT NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  token_count INT DEFAULT 0,
  embedding_id VARCHAR(100),
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id),
  FOREIGN KEY (document_id) REFERENCES knowledge_documents(id)
);
```

---

### 5.13 memories 记忆表

```sql
CREATE TABLE memories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  memory_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  importance VARCHAR(20) DEFAULT 'medium',
  importance_score INT DEFAULT 3,
  source_type VARCHAR(50),
  source_id BIGINT NULL,
  enabled TINYINT DEFAULT 1,
  last_used_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

### 5.14 memory_usage_logs 记忆使用表

```sql
CREATE TABLE memory_usage_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  memory_id BIGINT NOT NULL,
  run_id BIGINT NULL,
  workflow_id BIGINT NULL,
  usage_type VARCHAR(50),
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (memory_id) REFERENCES memories(id)
);
```

---

### 5.15 user_settings 设置表

```sql
CREATE TABLE user_settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  language VARCHAR(50) DEFAULT 'zh-CN',
  default_model VARCHAR(100),
  theme VARCHAR(50) DEFAULT 'system',
  auto_save TINYINT DEFAULT 1,
  auto_save_interval INT DEFAULT 5,
  webhook_url VARCHAR(500),
  settings_json JSON,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 6. 后端核心业务流程

---

### 6.1 生成 Workflow

接口：

```http
POST /api/workflows/generate
```

请求：

```json
{
  "query": "帮我分析这份财报并总结风险"
}
```

后端流程：

```text
1. 接收 query
2. 读取最近 5 条 enabled memory
3. 调用 workflowGenerator.service.ts
4. 构造 Prompt
5. 如果没有真实 LLM，就返回内置 mock workflow
6. 校验 nodes 和 edges
7. 写入 workflows
8. 写入 workflow_nodes
9. 写入 workflow_edges
10. 返回前端需要的 workflow JSON
```

响应：

```json
{
  "code": 200,
  "message": "Workflow generated",
  "data": {
    "id": 1,
    "name": "财报风险分析 Workflow",
    "intent": "financial_report_analysis",
    "confidence": 0.94,
    "nodes": [],
    "edges": []
  }
}
```

---

### 6.2 运行 Workflow

接口：

```http
POST /api/workflows/:id/run
```

后端流程：

```text
1. 根据 workflowId 查询 workflow_nodes 和 workflow_edges
2. 创建 workflow_runs 记录
3. 创建 context
4. 根据 edges 计算执行顺序
5. 遍历节点
6. 每个节点执行前写 trace_steps running
7. 根据 node.tool_name 从 toolRegistry 找工具
8. 执行工具
9. 工具成功：写 trace_steps success
10. 工具失败：写 trace_steps failed，并调用 failureAnalysis
11. 更新 workflow_runs 状态
12. 返回 runId
```

响应：

```json
{
  "code": 200,
  "message": "Workflow running",
  "data": {
    "runId": 1,
    "status": "running"
  }
}
```

---

### 6.3 获取 Trace

接口：

```http
GET /api/runs/:runId/trace
```

响应：

```json
{
  "code": 200,
  "data": [
    {
      "id": "t1",
      "stepName": "开始",
      "nodeId": "start",
      "time": "17:30:21",
      "status": "success"
    },
    {
      "id": "t4",
      "stepName": "财务指标提取",
      "nodeId": "extract",
      "time": "17:30:25",
      "status": "success",
      "tool": "financial_extract_tool",
      "latency": "2.1s"
    }
  ]
}
```

注意：返回格式要尽量贴近前端 `TraceStep`。

---

## 7. Tool Registry 工具注册表

创建：

```text
src/tools/index.ts
```

内容：

```ts
import userInputTool from './userInput.tool'
import intentClassifierTool from './intentClassifier.tool'
import pdfParseTool from './pdfParse.tool'
import financialExtractTool from './financialExtract.tool'
import riskSummaryTool from './riskSummary.tool'
import knowledgeSearchTool from './knowledgeSearch.tool'
import summaryLLMTool from './summaryLLM.tool'
import reportOutputTool from './reportOutput.tool'

export const toolRegistry = {
  user_input: userInputTool,
  intent_classifier: intentClassifierTool,
  pdf_parse_tool: pdfParseTool,
  financial_extract_tool: financialExtractTool,
  risk_summary_tool: riskSummaryTool,
  finance_knowledge_base: knowledgeSearchTool,
  summary_llm: summaryLLMTool,
  report_output: reportOutputTool
}
```

每个工具统一格式：

```ts
export default {
  name: 'financial_extract_tool',
  async run(context: WorkflowContext) {
    return {
      success: true,
      output: {},
      message: ''
    }
  }
}
```

---

## 8. Context 上下文结构

创建：

```text
src/types/context.ts
```

内容：

```ts
export type WorkflowContext = {
  runId: number
  workflowId: number
  query?: string
  memories: any[]
  files: any[]
  nodeOutputs: Record<string, any>
  traces: any[]
  finalResult?: any
}
```

执行器中每个节点都读取和更新 context。

示例：

```ts
context.nodeOutputs[node.node_key] = result.output
```

后续节点可以读取前面节点输出。

---

## 9. Tool Ranking 逻辑

`toolRanking.service.ts` 负责给候选工具打分。

第一版可以先写死规则。

```ts
const financeKeywords = ['财报', '财务', '风险', '利润', '收入', '现金流']

function keywordScore(query: string, toolName: string) {
  if (toolName.includes('financial') && financeKeywords.some(k => query.includes(k))) {
    return 0.95
  }
  if (toolName.includes('pdf')) return 0.78
  if (toolName.includes('summary')) return 0.72
  return 0.35
}
```

评分公式：

```text
final_score =
0.4 * keyword_score
+ 0.3 * semantic_score
+ 0.2 * history_score
+ 0.1 * preference_score
```

第一版可以把 semantic / history / preference 设成 mock 分数。

---

## 10. Workflow Generator 逻辑

`workflowGenerator.service.ts` 第一版可以这样实现：

```text
如果 query 包含“财报”
返回财报分析 Workflow
否则返回通用 Workflow
```

财报分析 Workflow 固定为：

```text
start
↓
intent
↓
file
↓
extract
↓
risk
↓
output

intent
↓
knowledge
↓
summary
↓
output
```

这个结构和前端 mock 保持一致。

---

## 11. DAG 校验

`dagValidator.ts` 必须检查：

```text
1. nodes 不能为空
2. edges 不能为空
3. edge.source 必须存在于 nodes
4. edge.target 必须存在于 nodes
5. 不能出现环
```

`topologicalSort.ts` 用于计算执行顺序。

如果第一版嫌复杂，可以先按 nodes 顺序执行，但代码里保留 TODO。

---

## 12. Failure Analysis 失败分析

`failureAnalysis.service.ts` 第一版可以返回固定结构：

```ts
export function analyzeFailure(error: Error, node: any) {
  return {
    failedNode: node.label,
    reason: error.message,
    impact: '后续节点无法继续执行',
    suggestions: [
      '检查该节点输入是否为空',
      '确认工具是否启用',
      '尝试替换工具后重新执行'
    ]
  }
}
```

---

## 13. 响应格式

所有接口统一返回：

```ts
{
  code: number
  message: string
  data?: any
}
```

成功：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

失败：

```json
{
  "code": 500,
  "message": "error message"
}
```

创建：

```text
src/utils/response.ts
```

---

## 14. 种子数据 seed.sql

需要插入默认工具。

```sql
INSERT INTO tools
(name, display_name, version, category, description, enabled, success_rate, avg_latency_ms, call_count)
VALUES
('user_input', '用户输入', 'v1.0.0', '输入', '接收用户原始需求', 1, 99.0, 100, 0),
('intent_classifier', '意图识别器', 'v1.0.0', '智能分析', '识别用户任务意图', 1, 94.0, 800, 0),
('pdf_parse_tool', 'PDF 解析工具', 'v1.2.0', '数据处理', '解析 PDF 文件内容，提取文本和结构化信息', 1, 96.2, 1230, 2341),
('financial_extract_tool', '财务指标提取工具', 'v1.1.0', '数据分析', '从财报文本中提取收入、利润、负债率、现金流等指标', 1, 92.5, 1870, 1892),
('risk_summary_tool', '风险总结工具', 'v1.0.3', '数据分析', '基于财务指标生成风险分析与总结', 1, 91.3, 2340, 1256),
('finance_knowledge_base', '财务知识检索工具', 'v1.0.0', '检索搜索', '从财务知识库中检索相关资料', 1, 90.2, 980, 4532),
('summary_llm', '总结大模型工具', 'v1.0.0', '内容生成', '调用大模型生成总结内容', 1, 95.0, 1050, 3214),
('report_output', '报告输出工具', 'v1.0.0', '输出', '生成结构化报告并输出结果', 1, 97.0, 760, 2105);
```

---

## 15. 开发顺序

请按这个顺序实现：

```text
1. 初始化 Express + TypeScript 项目
2. 配置 MySQL 连接
3. 创建 schema.sql 和 seed.sql
4. 实现 tools 工具注册表
5. 实现 workflow generate 接口
6. 实现 workflow 保存 nodes / edges
7. 实现 workflow run 接口
8. 实现 trace_steps 写入
9. 实现 get trace 接口
10. 实现 tools 工具库列表接口
11. 实现 memories 简单接口
12. 实现 templates / knowledge / settings 的基础 CRUD
```

---

## 16. 不要做的事情

第一版不要做：

```text
1. 不要做复杂权限系统
2. 不要做完整 RAG 向量数据库
3. 不要做真实 PDF OCR
4. 不要做多 Agent 协作
5. 不要做 Browser Agent
6. 不要做复杂队列系统
```

先把最小闭环跑通。

---

## 17. 给 Codex 的最终任务提示词

请基于本任务书生成一个完整的 Node.js + Express + TypeScript 后端项目。

要求：

```text
1. 使用 MySQL 作为数据库
2. 实现 schema.sql 和 seed.sql
3. 实现 Workflow 生成、保存、运行、Trace 查询
4. 实现 Tool Registry 工具注册表
5. 工具执行可以先 mock，但必须真实写入 trace_steps
6. 返回数据结构要适配前端 WorkflowNode、WorkflowEdge、TraceStep
7. 代码结构清晰，分 routes/controllers/services/models/tools/utils
8. 所有接口统一返回 { code, message, data }
9. 提供 README.md，说明安装、配置、启动方式
10. 第一版必须能通过 npm run dev 启动
```

核心接口必须可用：

```http
POST /api/workflows/generate
GET  /api/workflows/:id
POST /api/workflows/:id/run
GET  /api/runs/:runId/trace
GET  /api/tools
GET  /api/memories
GET  /api/templates
GET  /api/knowledge-bases
GET  /api/settings
```

运行命令：

```bash
npm install
npm run dev
```

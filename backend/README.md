# TraceMind Backend

TraceMind 后端第一版：围绕前端现有 `WorkflowNode`、`WorkflowEdge`、`TraceStep` 数据结构，实现自然语言生成 Workflow、保存、运行、工具调用、Trace 记录和查询闭环。

## 技术栈

- Node.js
- Express
- TypeScript
- MySQL
- mysql2/promise

## 快速开始

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

默认服务地址：

```text
http://localhost:4000
```

健康检查：

```http
GET /health
```

## MySQL 初始化

先创建并导入表结构和种子数据：

```bash
mysql -u root -p < src/database/schema.sql
mysql -u root -p tracemind < src/database/seed.sql
```

然后修改 `.env`：

```env
PORT=4000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=tracemind
CORS_ORIGIN=http://localhost:5173
```

## 核心接口

```http
POST /api/workflows/generate
GET  /api/workflows
GET  /api/workflows/:id
PUT  /api/workflows/:id
DELETE /api/workflows/:id
POST /api/workflows/:id/run

GET  /api/runs/:runId
GET  /api/runs/:runId/trace

GET  /api/tools
POST /api/tools/web-search/test
GET  /api/memories
GET  /api/templates
GET  /api/knowledge-bases
GET  /api/settings
```

网页搜索工具的真实 Key 配置、npm 验收和 curl 验收见：

[`docs/web-search-real-api-test.md`](docs/web-search-real-api-test.md)

## 工作流模板

生成时按 query 关键词选择模板（`selectFinanceTemplate`）：

- 命中 `Word 报告 / 生成报告 / 导出报告 / 财报风险报告` → `linear_finance_report`（线性 8 节点）
- 命中 `知识检索 / 行业知识 / 综合总结 / RAG` → `branch_finance_analysis`（现有分支型）
- 命中财报相关词但无法细分 → 默认 `linear_finance_report`（更适合 MVP 演示）
- 完全无关 → 通用工作流

线性财报模板节点顺序（任务书 §10.2）：

```text
start → intent → file → extract → risk → report → docx → output
```

对应工具：`user_input → intent_classifier → pdf_parse_tool → financial_extract_tool
→ financial_risk_tool → report_generate_tool → markdown_to_docx_tool → report_output_tool`

两套模板共用同一套 Validator / Executor / Context / Trace / FailureAnalysis。

## 冒烟测试（无需 MySQL）

不依赖数据库即可验证「生成 → 校验 → 拓扑排序 → 按 edges 执行工具 → Context 传递 → Trace → 失败分析」全链路：

```bash
npx tsx src/scripts/smokeLinearFinance.ts
```

输出会打印节点执行顺序、每步 Trace（含 inputSummary/outputSummary/latencyMs），
以及禁用某工具后的失败节点、影响节点和修复建议。

## 示例流程（完整 DB 闭环）

生成 Workflow（默认走线性财报模板）：

```bash
curl -X POST http://localhost:4000/api/workflows/generate ^
  -H "Content-Type: application/json" ^
  -d "{\"query\":\"帮我分析这份财报，并总结主要风险，生成 Word 报告\"}"
```

获取 Workflow 详情（前端 Vue Flow 渲染）：

```bash
curl http://localhost:4000/api/workflows/1
```

运行 Workflow：

```bash
curl -X POST http://localhost:4000/api/workflows/1/run ^
  -H "Content-Type: application/json" ^
  -d "{\"query\":\"帮我分析这份财报并总结风险\",\"files\":[{\"filename\":\"2025_financial_report.pdf\"}]}"
```

查询运行详情与 Trace：

```bash
curl http://localhost:4000/api/runs/1
curl http://localhost:4000/api/runs/1/trace
```

失败分析演示：将某个工具禁用（`UPDATE tools SET enabled = 0 WHERE name = 'financial_risk_tool';`）
后再次运行，Trace 中该节点为 `failed`，运行输出包含 `failure`（失败节点 / 原因 / 影响节点 / 修复建议）。

## 第一版实现范围

已实现：

- 统一响应格式 `{ code, message, data }`
- MySQL schema 和 seed
- Workflow 生成、保存、查询、更新、删除
- Workflow DAG 校验和拓扑排序
- Workflow Validator（`{valid, errors, warnings}`，运行前强制校验）
- Context Manager（按 edges 计算节点输入、传递上游输出）
- 线性财报模板 + 分支财报模板，共用同一执行引擎
- Workflow 运行记录 `workflow_runs`
- Trace 写入和查询 `trace_steps`（含 input/outputSummary、latencyMs、errorMessage）
- 失败分析（失败节点 / 原因 / 影响节点 / 修复建议）
- Tool Registry 和 12 个 mock tools
- 工具调用日志 `tool_call_logs`
- 工具评分日志 `tool_ranking_logs`
- Tools / Memories / Templates / Knowledge Bases / Settings 基础接口

暂不实现：

- 复杂权限系统
- 真正的 LLM 调用
- 真正的 PDF OCR
- 完整 RAG 向量检索
- 多 Agent 协作
- 队列系统

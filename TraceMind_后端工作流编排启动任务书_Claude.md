# TraceMind 后端工作流编排启动任务书（给 Claude Code 使用）

> 目标：当前 TraceMind 已经有工具相关设计，但后端 Workflow 还没有真正启动。  
> 本任务书要求 Claude Code 帮我实现 **后端工作流编排核心代码**，让系统从“有工具”变成“能生成、保存、运行、追踪工作流”的完整闭环。

---

## 0. 项目定位

TraceMind 是一个可解释 AI Agent Workflow 平台。

系统目标不是简单聊天，而是：

```text
用户输入自然语言任务
↓
系统生成 Workflow JSON
↓
前端渲染工作流图
↓
用户确认 / 修改
↓
后端按节点顺序执行工具
↓
每一步记录 Trace
↓
失败时定位节点并给出修复建议
↓
成功时输出最终结果
```

当前第一阶段重点场景是：

```text
报告 / 财报分析
```

但底层架构要设计成通用 Workflow 平台，后续可以扩展到论文阅读、代码审查、市场调研等任务。

---

## 1. 当前状态

我现在已经重点设计了：

```text
1. 工具 Tool 的概念
2. Tool Registry 工具注册表
3. 工具输入输出格式
4. 权限 Permission 设计
5. Hooks 机制设计
```

但是现在缺少最关键的：

```text
后端 Workflow 编排与执行主流程
```

也就是说，目前有工具，但还没有真正做到：

```text
生成 Workflow
保存 Workflow
校验 Workflow
启动 Workflow Run
按 edges 顺序执行节点
调用 node.tool
记录 trace_steps
失败分析
前端查询 Trace
```

请基于本任务书实现这些核心后端代码。

---

## 2. 这次 Claude Code 的核心任务

请重点实现以下内容：

```text
1. Workflow 数据结构
2. Workflow Generator
3. Workflow Validator
4. Workflow Repository / Model
5. Workflow Executor
6. Context Manager
7. Trace Recorder
8. Failure Analyzer
9. Workflow Run API
10. Trace 查询 API
```

最终要实现完整闭环：

```text
POST /api/workflows/generate
↓
生成 workflow nodes / edges
↓
保存 MySQL
↓
GET /api/workflows/:id
↓
前端展示
↓
POST /api/workflows/:id/run
↓
后端执行节点工具
↓
GET /api/runs/:runId/trace
↓
前端展示执行轨迹
```

---

## 3. 核心设计思想

### 3.1 AI 负责规划，后端负责执行

不要让大模型直接控制系统运行。

正确逻辑：

```text
AI / 规则引擎：
负责根据用户需求生成 Workflow JSON

后端 Executor：
负责按照 Workflow JSON 真实执行工具

Trace Recorder：
负责记录每一步执行状态、输入、输出、耗时、错误
```

---

### 3.2 工作流不是图片，而是可执行 JSON

前端看到的是节点图，但后端存储的是结构化数据：

```json
{
  "name": "财报风险分析 Workflow",
  "intent": "financial_report_analysis",
  "nodes": [
    {
      "id": "file",
      "type": "file_read",
      "label": "文件读取",
      "tool": "pdf_parse_tool",
      "reason": "财报分析需要先解析文件内容",
      "confidence": 0.92,
      "position": { "x": 120, "y": 180 }
    }
  ],
  "edges": [
    {
      "id": "e-file-extract",
      "source": "file",
      "target": "extract"
    }
  ]
}
```

---

### 3.3 节点、工具、连线、Context、Trace 的关系

```text
Workflow = 总流程
Node = 流程中的一步
Tool = 节点真正调用的函数
Edge = 节点执行顺序 / 数据依赖
Context = 节点之间传递数据的容器
Trace = 执行过程记录
```

例子：

```text
Node：财务指标提取
Tool：financial_extract_tool
Input：来自 PDF 解析节点的财报文本
Output：收入、利润、现金流、负债率
Trace：记录该节点输入、输出、状态、耗时、错误
```

---

## 4. 财报分析场景的标准 Workflow

第一版必须至少支持这个固定财报分析 Workflow。

### 4.1 用户输入

```text
帮我分析这份财报，并总结主要风险，生成 Word 报告
```

### 4.2 应生成的 Workflow

```text
开始
↓
意图识别
↓
文件读取
↓
财务指标提取
↓
风险分析
↓
报告生成
↓
Word 导出
↓
结果输出
```

### 4.3 工具流

```text
user_input
↓
intent_classifier
↓
pdf_parse_tool
↓
financial_extract_tool
↓
financial_risk_tool
↓
report_generate_tool
↓
markdown_to_docx_tool
↓
report_output_tool
```

### 4.4 数据流

```text
用户需求 + 财报文件
↓
任务意图
↓
财报文本
↓
财务指标 JSON
↓
风险分析 JSON
↓
Markdown 报告
↓
Word 文件
↓
下载链接
```

---

## 5. Workflow JSON 数据契约

后端生成、保存、返回给前端的数据必须接近下面格式。

```ts
export type NodeStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'waiting_approval'
  | 'permission_denied'

export type WorkflowNode = {
  id: string
  type: string
  label: string
  subLabel?: string
  icon?: string
  position: {
    x: number
    y: number
  }
  status: NodeStatus
  tone?: 'green' | 'blue' | 'violet' | 'amber' | 'cyan' | 'red'
  tool: string
  confidence: number
  reason: string
  candidateTools?: ToolCandidate[]
  config?: Record<string, any>
}

export type ToolCandidate = {
  name: string
  score: number
  reason: string
}

export type WorkflowEdge = {
  id: string
  source: string
  target: string
  branch?: 'main' | 'alt'
  condition?: string
}

export type Workflow = {
  id?: number
  name: string
  description?: string
  intent: string
  confidence: number
  originalQuery: string
  status: 'draft' | 'ready' | 'running' | 'success' | 'failed'
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}
```

---

## 6. Trace 数据契约

执行轨迹返回给前端的格式：

```ts
export type TraceStep = {
  id: string
  runId: number
  nodeId: string
  stepName: string
  status: NodeStatus
  tool?: string
  inputData?: any
  outputData?: any
  inputSummary?: string
  outputSummary?: string
  reason?: string
  errorMessage?: string
  latencyMs?: number
  startedAt?: string
  finishedAt?: string

  permissionBehavior?: 'allow' | 'ask' | 'deny'
  permissionReason?: string
  approvalId?: number

  hookLogs?: any[]
}
```

前端可以根据这个展示：

```text
节点名称
状态
使用工具
耗时
输入摘要
输出摘要
失败原因
权限判断
修复建议
```

---

## 7. 数据库表设计

如果项目已经有类似表，请尽量复用；如果没有，请新增。

### 7.1 workflows

```sql
CREATE TABLE IF NOT EXISTS workflows (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  source_type VARCHAR(50) DEFAULT 'generated',
  original_query TEXT,
  intent VARCHAR(100),
  confidence DECIMAL(5,4),
  status VARCHAR(30) DEFAULT 'draft',
  workflow_json JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

### 7.2 workflow_nodes

```sql
CREATE TABLE IF NOT EXISTS workflow_nodes (
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
  candidate_tools JSON,
  config JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

---

### 7.3 workflow_edges

```sql
CREATE TABLE IF NOT EXISTS workflow_edges (
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

### 7.4 workflow_runs

```sql
CREATE TABLE IF NOT EXISTS workflow_runs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  workflow_id BIGINT NOT NULL,
  status VARCHAR(30) DEFAULT 'running',
  input_data JSON,
  output_data JSON,
  context_snapshot JSON,
  total_latency_ms INT DEFAULT 0,
  error_message TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,

  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

---

### 7.5 trace_steps

```sql
CREATE TABLE IF NOT EXISTS trace_steps (
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
  input_summary TEXT,
  output_summary TEXT,
  error_message TEXT,
  latency_ms INT,
  permission_behavior VARCHAR(30),
  permission_reason TEXT,
  approval_id BIGINT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,

  FOREIGN KEY (run_id) REFERENCES workflow_runs(id),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

---

### 7.6 tool_call_logs

```sql
CREATE TABLE IF NOT EXISTS tool_call_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT,
  workflow_id BIGINT,
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

## 8. 后端目录结构

请按照以下结构实现或补齐：

```text
src/
├─ routes/
│  ├─ workflow.routes.ts
│  ├─ run.routes.ts
│  └─ trace.routes.ts
│
├─ controllers/
│  ├─ workflow.controller.ts
│  ├─ run.controller.ts
│  └─ trace.controller.ts
│
├─ services/
│  ├─ workflowGenerator.service.ts
│  ├─ workflowValidator.service.ts
│  ├─ workflowExecutor.service.ts
│  ├─ workflowRun.service.ts
│  ├─ context.service.ts
│  ├─ trace.service.ts
│  ├─ failureAnalysis.service.ts
│  ├─ permission.service.ts
│  └─ hook.service.ts
│
├─ models/
│  ├─ workflow.model.ts
│  ├─ workflowNode.model.ts
│  ├─ workflowEdge.model.ts
│  ├─ workflowRun.model.ts
│  ├─ traceStep.model.ts
│  └─ toolCallLog.model.ts
│
├─ tools/
│  ├─ index.ts
│  ├─ userInput.tool.ts
│  ├─ intentClassifier.tool.ts
│  ├─ pdfParse.tool.ts
│  ├─ financialExtract.tool.ts
│  ├─ financialRisk.tool.ts
│  ├─ reportGenerate.tool.ts
│  ├─ markdownToDocx.tool.ts
│  └─ reportOutput.tool.ts
│
├─ utils/
│  ├─ topologicalSort.ts
│  ├─ dagValidator.ts
│  ├─ response.ts
│  ├─ jsonRepair.ts
│  └─ summarize.ts
│
└─ types/
   ├─ workflow.ts
   ├─ trace.ts
   ├─ context.ts
   └─ tool.ts
```

---

## 9. API 设计

### 9.1 生成 Workflow

```http
POST /api/workflows/generate
```

请求：

```json
{
  "query": "帮我分析这份财报，并总结主要风险，生成 Word 报告",
  "fileIds": [1]
}
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
    "nodes": [],
    "edges": []
  }
}
```

---

### 9.2 获取 Workflow 详情

```http
GET /api/workflows/:id
```

---

### 9.3 保存前端编辑后的 Workflow

```http
PUT /api/workflows/:id
```

请求：

```json
{
  "nodes": [],
  "edges": []
}
```

---

### 9.4 运行 Workflow

```http
POST /api/workflows/:id/run
```

请求：

```json
{
  "input": {
    "query": "帮我分析这份财报，并总结主要风险",
    "fileIds": [1]
  }
}
```

响应：

```json
{
  "code": 200,
  "message": "Workflow started",
  "data": {
    "runId": 1001,
    "status": "running"
  }
}
```

第一版可以同步执行并直接返回最终状态；后续可以改成异步执行。

---

### 9.5 获取运行详情

```http
GET /api/runs/:runId
```

---

### 9.6 获取 Trace

```http
GET /api/runs/:runId/trace
```

响应：

```json
{
  "code": 200,
  "data": [
    {
      "id": "1",
      "runId": 1001,
      "nodeId": "file",
      "stepName": "文件读取",
      "status": "success",
      "tool": "pdf_parse_tool",
      "inputSummary": "读取上传的财报 PDF 文件",
      "outputSummary": "解析得到 3500 字财报文本",
      "latencyMs": 1200
    }
  ]
}
```

---

## 10. Workflow Generator 实现要求

### 10.1 第一版先用规则 / 模板兜底

为了稳定演示，第一版不要完全依赖 LLM。

实现：

```ts
generateWorkflow(query: string, options?: any)
```

逻辑：

```text
如果 query 包含 财报 / 财务 / 风险 / 报告
→ 返回财报分析 Workflow 模板

如果 query 包含 论文 / 文献
→ 返回论文阅读 Workflow 模板，可简单实现

如果 query 包含 代码 / bug
→ 返回代码审查 Workflow 模板，可简单实现

否则
→ 返回通用分析 Workflow
```

### 10.2 财报分析模板必须完整

必须生成：

```text
start
intent
file
extract
risk
report
docx
output
```

节点：

```json
[
  {
    "id": "start",
    "type": "input",
    "label": "开始",
    "subLabel": "用户输入",
    "tool": "user_input",
    "reason": "接收用户自然语言需求，作为工作流入口。",
    "confidence": 0.98,
    "position": { "x": 80, "y": 260 }
  },
  {
    "id": "intent",
    "type": "intent",
    "label": "意图识别",
    "subLabel": "识别财务分析任务",
    "tool": "intent_classifier",
    "reason": "需要先判断用户任务类型，确定后续流程。",
    "confidence": 0.95,
    "position": { "x": 320, "y": 260 }
  },
  {
    "id": "file",
    "type": "file_read",
    "label": "文件读取",
    "subLabel": "解析财报文件",
    "tool": "pdf_parse_tool",
    "reason": "财报分析需要先读取并解析上传文件内容。",
    "confidence": 0.92,
    "position": { "x": 560, "y": 260 }
  },
  {
    "id": "extract",
    "type": "financial_extract",
    "label": "财务指标提取",
    "subLabel": "提取收入、利润、现金流等指标",
    "tool": "financial_extract_tool",
    "reason": "风险分析依赖财务指标，需要先提取结构化数据。",
    "confidence": 0.91,
    "position": { "x": 800, "y": 260 }
  },
  {
    "id": "risk",
    "type": "risk_analysis",
    "label": "风险分析",
    "subLabel": "判断财务风险",
    "tool": "financial_risk_tool",
    "reason": "用户要求总结风险，需要基于财务指标进行风险判断。",
    "confidence": 0.89,
    "position": { "x": 1040, "y": 260 }
  },
  {
    "id": "report",
    "type": "report_generate",
    "label": "报告生成",
    "subLabel": "生成 Markdown 报告",
    "tool": "report_generate_tool",
    "reason": "将财务指标和风险分析结果整理为可读报告。",
    "confidence": 0.9,
    "position": { "x": 1280, "y": 260 }
  },
  {
    "id": "docx",
    "type": "docx_export",
    "label": "Word 导出",
    "subLabel": "转换为 Word 文件",
    "tool": "markdown_to_docx_tool",
    "reason": "用户要求生成 Word 报告，因此需要将 Markdown 转换为 docx 文件。",
    "confidence": 0.88,
    "position": { "x": 1520, "y": 260 }
  },
  {
    "id": "output",
    "type": "output",
    "label": "结果输出",
    "subLabel": "返回报告下载链接",
    "tool": "report_output_tool",
    "reason": "将最终报告文件和分析结论返回给用户。",
    "confidence": 0.92,
    "position": { "x": 1760, "y": 260 }
  }
]
```

edges：

```json
[
  { "id": "e-start-intent", "source": "start", "target": "intent" },
  { "id": "e-intent-file", "source": "intent", "target": "file" },
  { "id": "e-file-extract", "source": "file", "target": "extract" },
  { "id": "e-extract-risk", "source": "extract", "target": "risk" },
  { "id": "e-risk-report", "source": "risk", "target": "report" },
  { "id": "e-report-docx", "source": "report", "target": "docx" },
  { "id": "e-docx-output", "source": "docx", "target": "output" }
]
```

---

## 11. Workflow Validator 实现要求

创建：

```text
src/services/workflowValidator.service.ts
```

必须检查：

```text
1. nodes 不为空
2. edges 不为空
3. node.id 唯一
4. edge.source 必须存在于 nodes
5. edge.target 必须存在于 nodes
6. node.tool 必须存在于 toolRegistry
7. 不允许成环
8. 必须有起始节点
9. 不允许孤立节点，除非明确标记 optional
```

返回：

```ts
type ValidateResult = {
  valid: boolean
  errors: string[]
  warnings: string[]
}
```

如果校验失败：

```text
不允许运行 Workflow
返回错误给前端
```

---

## 12. 拓扑排序 topologicalSort

创建：

```text
src/utils/topologicalSort.ts
```

输入：

```ts
nodes: WorkflowNode[]
edges: WorkflowEdge[]
```

输出：

```ts
WorkflowNode[]
```

要求：

```text
根据 edges 计算执行顺序。
如果成环，抛出错误。
如果有多个起点，按 nodes 顺序处理。
```

财报分析应排序为：

```text
start → intent → file → extract → risk → report → docx → output
```

---

## 13. Context Manager 实现要求

创建：

```text
src/services/context.service.ts
```

Context 结构：

```ts
export type WorkflowContext = {
  runId: number
  workflowId: number
  query?: string
  fileIds?: number[]
  files?: any[]

  nodeOutputs: Record<string, any>
  nodeInputs: Record<string, any>

  finalResult?: any
  errors: any[]

  metadata: {
    startedAt: string
    currentNodeId?: string
    executedNodes: string[]
  }
}
```

必须实现：

```ts
createContext(runId, workflowId, input): WorkflowContext

getNodeInput(node, context): any

setNodeOutput(nodeId, output, context): void

getUpstreamOutputs(nodeId, edges, context): any
```

核心逻辑：

```text
每个节点的输入来自：
1. 用户原始输入
2. 上游节点 output
3. 节点 config
4. context metadata
```

---

## 14. Tool Registry 接入要求

假设已有工具：

```text
src/tools/index.ts
```

必须导出：

```ts
export const toolRegistry = {
  user_input,
  intent_classifier,
  pdf_parse_tool,
  financial_extract_tool,
  financial_risk_tool,
  report_generate_tool,
  markdown_to_docx_tool,
  report_output_tool
}
```

每个工具统一格式：

```ts
export type ToolResult = {
  success: boolean
  output?: any
  error?: string
  trace?: {
    inputSummary?: string
    outputSummary?: string
    reason?: string
    latencyMs?: number
  }
}

export type Tool = {
  name: string
  run(input: any, context: WorkflowContext): Promise<ToolResult>
}
```

Executor 调用：

```ts
const tool = toolRegistry[node.tool]
const result = await tool.run(toolInput, context)
```

---

## 15. Executor 实现核心逻辑

创建或重构：

```text
src/services/workflowExecutor.service.ts
```

核心函数：

```ts
runWorkflow(workflowId: number, input: any): Promise<{
  runId: number
  status: string
  output?: any
}>
```

执行流程：

```text
1. 查询 workflow
2. 查询 nodes
3. 查询 edges
4. 校验 workflow
5. 创建 workflow_run
6. 创建 context
7. 拓扑排序 nodes
8. 遍历 sortedNodes
9. 每个节点执行前写 trace running
10. 触发 BeforeNodeRun Hook
11. 计算 toolInput
12. 触发 PreToolUse Hook / permission check
13. 调用 tool.run()
14. 结果写入 context
15. 记录 tool_call_logs
16. 触发 PostToolUse Hook
17. 更新 trace success
18. 如果失败，触发 OnNodeError
19. 更新 workflow_run failed / success
20. 触发 Stop Hook
21. 返回 runId 和最终结果
```

伪代码：

```ts
export async function runWorkflow(workflowId: number, input: any) {
  const workflow = await workflowModel.findById(workflowId)
  const nodes = await workflowNodeModel.findByWorkflowId(workflowId)
  const edges = await workflowEdgeModel.findByWorkflowId(workflowId)

  const validateResult = await workflowValidator.validate({ nodes, edges })
  if (!validateResult.valid) {
    throw new Error(validateResult.errors.join('; '))
  }

  const run = await workflowRunModel.create({
    workflowId,
    status: 'running',
    inputData: input
  })

  const context = contextService.createContext(run.id, workflowId, input)
  const sortedNodes = topologicalSort(nodes, edges)

  for (const node of sortedNodes) {
    const start = Date.now()

    await traceService.createStep({
      runId: run.id,
      workflowId,
      nodeKey: node.id,
      stepName: node.label,
      status: 'running',
      toolName: node.tool,
      reason: node.reason,
      inputData: contextService.getNodeInput(node, context)
    })

    try {
      const tool = toolRegistry[node.tool]
      if (!tool) {
        throw new Error(`工具不存在：${node.tool}`)
      }

      const toolInput = contextService.getNodeInput(node, context)

      // 如果已经实现 hooks，则在这里触发 PreToolUse
      // 如果没有 hooks，则直接调用 permissionService.checkPermission

      const result = await tool.run(toolInput, context)

      if (!result.success) {
        throw new Error(result.error || `${node.tool} 执行失败`)
      }

      contextService.setNodeOutput(node.id, result.output, context)

      await traceService.updateStepSuccess({
        runId: run.id,
        nodeKey: node.id,
        outputData: result.output,
        outputSummary: result.trace?.outputSummary,
        latencyMs: Date.now() - start
      })
    } catch (error) {
      await traceService.updateStepFailed({
        runId: run.id,
        nodeKey: node.id,
        errorMessage: error.message,
        latencyMs: Date.now() - start
      })

      const failure = await failureAnalysisService.analyze({
        workflowId,
        runId: run.id,
        failedNode: node,
        error,
        edges,
        context
      })

      await workflowRunModel.updateFailed(run.id, {
        errorMessage: error.message,
        outputData: {
          failure
        }
      })

      return {
        runId: run.id,
        status: 'failed',
        output: {
          failure
        }
      }
    }
  }

  await workflowRunModel.updateSuccess(run.id, {
    outputData: context.finalResult || context.nodeOutputs,
    contextSnapshot: context
  })

  return {
    runId: run.id,
    status: 'success',
    output: context.finalResult || context.nodeOutputs
  }
}
```

---

## 16. Trace Service 实现要求

创建或补齐：

```text
src/services/trace.service.ts
```

必须实现：

```ts
createStep(data)
updateStepSuccess(data)
updateStepFailed(data)
findByRunId(runId)
recordPermission(data)
recordHook(data)
```

Trace 记录必须足够让前端展示：

```text
当前节点
执行状态
使用工具
输入摘要
输出摘要
耗时
错误原因
权限判断
Hook 结果
```

---

## 17. Failure Analysis 实现要求

创建：

```text
src/services/failureAnalysis.service.ts
```

实现：

```ts
analyze({
  workflowId,
  runId,
  failedNode,
  error,
  edges,
  context
})
```

返回：

```ts
{
  failedNodeId: string
  failedNodeLabel: string
  errorType: string
  reason: string
  affectedNodes: string[]
  suggestions: string[]
}
```

规则：

```text
1. 工具不存在 → 建议检查工具注册表
2. 权限拒绝 → 建议修改权限规则或更换工具
3. 依赖缺失 → 建议安装依赖或切换输出格式
4. 输入为空 → 建议检查上游节点输出
5. 文件不存在 → 建议重新上传文件
6. 模型调用失败 → 建议检查 API Key 或重试
```

---

## 18. 第一版工具实现可以 Mock

为了先跑通工作流，工具可以先 Mock。

### 18.1 pdf_parse_tool

输入：

```json
{
  "fileIds": [1]
}
```

输出：

```json
{
  "text": "本期营业收入1200万元，净利润300万元，经营现金流良好，负债率42%。",
  "pages": 12
}
```

---

### 18.2 financial_extract_tool

输入上一步文本，输出：

```json
{
  "revenue": "1200万元",
  "profit": "300万元",
  "cashflow": "良好",
  "debtRatio": "42%"
}
```

---

### 18.3 financial_risk_tool

输出：

```json
{
  "riskLevel": "中等",
  "risks": [
    "负债率处于中等偏高水平，需要关注偿债压力",
    "利润情况较稳定，但仍需持续观察现金流变化"
  ],
  "suggestions": [
    "关注短期债务偿还能力",
    "保持主营业务收入稳定性"
  ]
}
```

---

### 18.4 report_generate_tool

输出 Markdown：

```json
{
  "markdown": "# 财务风险分析报告\n\n## 一、核心指标\n- 营业收入：1200万元\n- 净利润：300万元\n- 负债率：42%\n\n## 二、风险分析\n公司整体经营较稳定，但存在一定偿债压力。"
}
```

---

### 18.5 markdown_to_docx_tool

如果依赖暂时没装，可以先 Mock 输出：

```json
{
  "filePath": "uploads/reports/finance_report.docx",
  "filename": "finance_report.docx",
  "downloadUrl": "/api/files/reports/finance_report.docx"
}
```

后续再真实接入 `markdown-it` 和 `html-to-docx`。

---

### 18.6 report_output_tool

输出：

```json
{
  "message": "财务风险分析报告已生成",
  "downloadUrl": "/api/files/reports/finance_report.docx",
  "summary": "公司经营较稳定，但负债率偏高，需要关注偿债风险。"
}
```

---

## 19. Hooks 和 Permission 接入要求

如果项目已经实现 Hooks 和 Permission，请按下面方式接入 Executor。

### 19.1 PreToolUse

工具执行前触发：

```text
权限检查
输入校验
依赖检查
路径安全检查
```

如果 Hook 返回 blocked：

```text
停止当前节点
写 trace failed / waiting_approval / permission_denied
触发 OnNodeError
```

### 19.2 PostToolUse

工具执行后触发：

```text
输出校验
文件检查
下载链接生成
Trace 更新
```

### 19.3 Stop

Workflow 结束时触发：

```text
运行摘要
临时文件清理
workflow_run 状态更新
```

如果 Hooks 还没有做好，可以先在 Executor 内部保留 TODO，但必须留出接入点。

---

## 20. 前端联调要求

后端返回的数据必须适配前端 Workflow 页面。

### 20.1 Workflow 页面需要

```text
nodes
edges
node.status
node.tool
node.reason
node.confidence
node.position
candidateTools
```

### 20.2 Trace 面板需要

```text
stepName
nodeId
status
tool
latencyMs
inputSummary
outputSummary
errorMessage
permissionBehavior
permissionReason
```

### 20.3 点击节点详情需要

```text
label
subLabel
tool
reason
confidence
candidateTools
inputData
outputData
trace
```

---

## 21. 开发顺序

请 Claude Code 按这个顺序实现：

```text
1. 检查当前后端目录结构
2. 找到已有 toolRegistry 和工具文件
3. 新增 / 补齐 workflow 类型定义
4. 新增 / 补齐数据库 model
5. 实现 workflowGenerator.service.ts
6. 实现 workflowValidator.service.ts
7. 实现 topologicalSort.ts
8. 实现 context.service.ts
9. 实现 trace.service.ts
10. 实现 failureAnalysis.service.ts
11. 实现 workflowExecutor.service.ts
12. 实现 workflow.controller.ts
13. 实现 workflow.routes.ts
14. 实现 run / trace 查询接口
15. 用财报分析模板跑通完整流程
16. 写 README 测试方式
```

---

## 22. 验收标准

必须能完成下面演示：

### 22.1 生成工作流

请求：

```http
POST /api/workflows/generate
```

body：

```json
{
  "query": "帮我分析这份财报，并总结主要风险，生成 Word 报告"
}
```

结果：

```text
返回 workflowId
返回 nodes
返回 edges
nodes 中包含 file / extract / risk / report / docx / output
```

---

### 22.2 获取工作流

请求：

```http
GET /api/workflows/:id
```

结果：

```text
返回可供前端 Vue Flow 渲染的 nodes / edges
```

---

### 22.3 运行工作流

请求：

```http
POST /api/workflows/:id/run
```

结果：

```text
创建 run
依次执行工具
写入 trace_steps
返回 runId
```

---

### 22.4 查询 Trace

请求：

```http
GET /api/runs/:runId/trace
```

结果至少包含：

```text
文件读取 success
财务指标提取 success
风险分析 success
报告生成 success
Word 导出 success
结果输出 success
```

---

### 22.5 失败分析

人为禁用一个工具或让工具抛错后，运行结果应显示：

```text
失败节点
失败原因
影响节点
修复建议
Trace 中有 failed 状态
```

---

## 23. 不要做的事情

这次不要做：

```text
1. 不要重写整个项目架构
2. 不要删除已有工具代码
3. 不要破坏前端数据结构
4. 不要强依赖真实大模型
5. 不要一开始做复杂异步队列
6. 不要把所有业务写死在 controller
7. 不要让 AI 直接执行工具
8. 不要跳过 Workflow 校验
```

---

## 24. 最终给 Claude Code 的提示词

请基于本任务书，帮我编排并实现 TraceMind 后端 Workflow 启动与执行代码。

当前重点不是工具本身，而是把已有工具串成可运行的工作流。

请实现：

```text
1. 工作流生成 generate
2. 工作流保存 save
3. 工作流校验 validate
4. 工作流运行 run
5. 节点拓扑排序
6. Context 数据传递
7. Tool Registry 调用
8. Trace 执行轨迹记录
9. 失败分析
10. API 接口联调
```

要求：

```text
1. 第一版必须支持财报分析 Workflow。
2. 工具可以先 Mock，但工作流执行链路必须真实。
3. 后端必须按照 edges 顺序执行节点。
4. 每个节点必须调用 node.tool 对应工具。
5. 每个节点执行结果必须写入 context。
6. 每个节点执行过程必须写入 trace_steps。
7. 如果工具失败，必须停止后续节点并生成失败分析。
8. API 返回结构必须适配前端 Workflow 页面。
9. 保留 Hooks / Permission 接入点。
10. 写清楚测试方式。
```

实现完成后，请输出：

```text
1. 新增文件列表
2. 修改文件列表
3. 核心执行流程说明
4. API 测试样例
5. 财报分析完整运行示例
6. 还有哪些 TODO
```

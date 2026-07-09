# TraceMind 前端生成任务书：参考 Flowise，但重新生成全新前端

> 用途：把这份文档交给 Codex，让它根据 Flowise 的前端交互方式，重新生成一套 TraceMind 前端。  
> 核心要求：**可以借鉴 Flowise 的节点画布、左侧节点库、右侧配置面板交互，但不要直接复制 Flowise 源码、Logo、品牌文案和完整视觉。**

---

## 1. 项目定位

项目名：**TraceMind**

项目一句话：

> TraceMind 是一个支持自然语言生成 Workflow、节点原因解释、工具候选排序、执行轨迹回放与失败分析的可解释 AI Agent 工作流平台。

它不是普通聊天系统，也不是普通 Workflow Builder。

核心流程：

```text
用户输入自然语言需求
↓
系统自动生成 Workflow
↓
解释每个节点为什么存在
↓
解释为什么选择某个 Tool
↓
执行 Workflow
↓
记录 Trace 执行轨迹
↓
失败时定位节点并给出修复建议
```

---

## 2. 与 Flowise 的参考关系

可以参考 Flowise 的通用交互：

```text
1. 左侧节点工具栏
2. 中间 Workflow Canvas
3. 节点拖拽和连线
4. 右侧节点配置面板
5. 顶部 Save / Run / Export 操作区
6. 节点执行状态颜色
```

但是 TraceMind 必须和 Flowise 拉开差异。

Flowise 重点：

```text
手动拖拽搭建 AI Workflow
```

TraceMind 重点：

```text
自然语言生成 Workflow
+
解释为什么这样生成
+
回放 Agent 执行过程
+
定位失败节点
```

所以不要只做一个“低配 Flowise”，而要做成：

```text
Flowise-like Canvas
+
Explainable Node Inspector
+
Trace Replay
+
Tool Ranking
+
Failure Analysis
```

---

## 3. 推荐技术栈

优先使用：

```text
Vue 3
Vite
TypeScript
Vue Flow
Pinia
Axios
Element Plus 或 Naive UI
ECharts
```

如果项目当前是 React，也可以用：

```text
React
TypeScript
React Flow
Zustand
MUI / Ant Design
Axios
ECharts
```

---

## 4. 页面整体布局

主页面采用“四区结构”：

```text
┌───────────────────────────────────────────────┐
│ Topbar：项目名 / Generate / Run / Save / Export │
├──────────────┬────────────────────┬───────────┤
│ 左侧节点库    │ 中间 Workflow 画布   │ 右侧详情面板 │
│ Node Palette │ Workflow Canvas     │ Inspector │
├──────────────┴────────────────────┴───────────┤
│ 底部 Trace Replay：执行轨迹 / 日志 / 失败分析    │
└───────────────────────────────────────────────┘
```

建议尺寸：

```text
左侧节点库：220px
右侧 Inspector：360px
顶部栏：56px
底部 Trace Panel：260px
中间 Canvas：自适应
```

---

## 5. 主要页面

### 5.1 DashboardView

路径：

```text
/dashboard
```

作用：

```text
展示项目概览、最近 Workflow、最近 Trace、工具成功率、任务数量。
```

卡片内容：

```text
今日运行任务数
成功率
失败节点数
平均执行耗时
Token 消耗
```

---

### 5.2 WorkflowStudioView

路径：

```text
/workflow-studio
```

这是核心页面。

包含：

```text
1. Topbar
2. Natural Language Input
3. Node Palette
4. Workflow Canvas
5. Node Inspector
6. Trace Replay Panel
```

---

### 5.3 TraceView

路径：

```text
/trace/:taskId
```

作用：

```text
单独查看某次任务的完整执行轨迹。
```

展示：

```text
Timeline
原始日志 JSON
每一步 input/output
失败分析
性能指标
```

---

### 5.4 ToolLibraryView

路径：

```text
/tools
```

作用：

```text
展示系统可用工具，以及每个工具的用途、成功率、平均耗时。
```

---

### 5.5 MemoryView

路径：

```text
/memory
```

作用：

```text
展示用户长期记忆、任务历史、工具使用偏好。
```

---

## 6. WorkflowStudio 详细设计

### 6.1 Topbar

按钮：

```text
Generate Workflow
Run Workflow
Save
Export JSON
Import JSON
Simulate Failure
```

交互：

```text
Generate Workflow：根据输入框内容生成 Mock Workflow
Run Workflow：模拟节点逐步运行
Save：模拟保存
Export JSON：导出当前 Workflow JSON
Import JSON：导入 Workflow JSON
Simulate Failure：模拟某节点失败
```

---

### 6.2 Natural Language Input

输入框 placeholder：

```text
请输入需求，例如：帮我分析这份财报并总结风险
```

点击 Generate Workflow 后：

```text
1. 读取 query
2. 显示 loading
3. 返回 mockWorkflow
4. 在 Canvas 中渲染节点和边
5. 右侧默认选中第一个节点
6. 底部 Trace 增加“Workflow 生成完成”步骤
```

---

### 6.3 左侧 Node Palette

节点分类：

```text
Input 输入类
- Text Input
- File Upload
- Webhook Input

LLM 模型类
- Intent Analyzer
- Workflow Generator
- Reason Generator
- Summary LLM

Tool 工具类
- PDF Parser
- Code Analyzer
- Financial Extractor
- Risk Summarizer
- Translator

Memory 记忆类
- User Memory
- Task History
- Tool Statistics

Control 控制类
- Condition
- Retry
- Fallback
- Human Confirm

Output 输出类
- Text Output
- Report Output
- JSON Output
```

每个节点项数据结构：

```ts
type PaletteNode = {
  type: string
  label: string
  desc: string
  icon: string
  category: string
}
```

---

### 6.4 中间 Workflow Canvas

使用 Vue Flow / React Flow。

节点支持：

```text
拖拽
连线
点击选中
删除
状态颜色
运行时高亮
失败时红色标记
```

节点状态：

```ts
type NodeStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped'
```

状态颜色：

```text
idle：白色
running：蓝色或黄色，带 loading 动效
success：绿色
failed：红色
skipped：灰色虚线
```

节点内容展示：

```text
节点名称
节点类型
执行状态
使用工具
置信度
```

示例节点：

```json
{
  "id": "extract",
  "type": "financial_extract",
  "label": "财务指标提取",
  "tool": "financial_extract_tool",
  "status": "success",
  "confidence": 0.91,
  "reason": "财报分析需要提取收入、利润、现金流等核心指标"
}
```

---

## 7. 右侧 Node Inspector

点击节点后，右侧显示节点详情。

必须有 5 个 Tab：

```text
Overview 概览
Explain 解释
Config 配置
Ranking 工具排序
IO 输入输出
```

### 7.1 Overview

展示：

```text
节点名称
节点类型
执行状态
置信度
使用工具
耗时
```

### 7.2 Explain

展示：

```text
为什么生成这个节点？
为什么放在这个位置？
为什么连接到下一个节点？
为什么选择这个工具？
```

示例：

```text
系统检测到用户需求中包含“财报”“分析”“风险”等关键词，因此判断需要提取财务指标。
该节点依赖 PDF 解析结果，所以被放置在 PDF Parser 节点之后。
```

### 7.3 Config

展示节点参数：

```json
{
  "model": "gpt-4.1",
  "temperature": 0.3,
  "maxTokens": 1200
}
```

### 7.4 Ranking

展示候选工具评分：

```text
financial_extract_tool 0.94
pdf_parse_tool 0.88
general_qa_tool 0.32
```

### 7.5 IO

展示：

```text
Input Data
Output Data
Error Message
```

---

## 8. 底部 Trace Replay Panel

这是 TraceMind 的核心创新点之一，必须做得比普通日志更强。

Tab：

```text
Timeline 时间线
Logs 原始日志
Failure 失败分析
Metrics 性能指标
```

---

### 8.1 Timeline

展示：

```text
00:00 用户输入任务
00:01 意图识别完成
00:02 Workflow 生成完成
00:03 工具候选排序完成
00:04 执行 PDF Parser
00:05 执行 Financial Extractor
00:06 执行 Risk Summary
```

每一步点击后：

```text
1. 高亮对应 Trace Step
2. 如果有 nodeId，同步高亮 Canvas 节点
3. 右侧 Inspector 显示该步骤详情
```

Trace Step 类型：

```ts
type TraceStep = {
  id: string
  taskId: string
  stepName: string
  stepType: string
  nodeId?: string
  status: 'running' | 'success' | 'failed'
  inputData?: any
  outputData?: any
  reason?: string
  confidence?: number
  selectedTool?: string
  candidateTools?: ToolScore[]
  latency?: number
  errorMessage?: string
  createdAt: string
}
```

---

### 8.2 Logs

展示原始 JSON 日志。

要求：

```text
支持折叠
支持复制
支持按 status 过滤
支持按 nodeId 搜索
```

---

### 8.3 Failure Analysis

失败时展示：

```text
失败节点
失败原因
影响范围
建议操作
```

示例：

```text
失败节点：财务指标提取
失败原因：上传文件缺少利润表页面
影响范围：风险总结节点无法继续执行

建议：
1. 上传完整财报
2. 切换 OCR 解析工具
3. 手动补充关键指标
```

按钮：

```text
Retry Node
Skip Node
Replace Tool
Manual Input
```

第一版按钮可以只做 UI，不需要真实功能。

---

### 8.4 Metrics

展示：

```text
总耗时
成功节点数
失败节点数
LLM 调用次数
Tool 调用次数
Token 消耗
平均节点耗时
```

可以用卡片 + 简单图表。

---

## 9. Tool Ranking 设计

工具评分公式：

```text
score = 0.4 × keyword_match
      + 0.3 × semantic_similarity
      + 0.2 × historical_success_rate
      + 0.1 × user_preference
```

表格字段：

```text
排名
工具名称
关键词匹配
语义匹配
历史成功率
用户偏好
总分
选择原因
```

示例数据：

```ts
const toolRanking = [
  {
    name: 'financial_extract_tool',
    keyword: 0.95,
    semantic: 0.92,
    history: 0.88,
    preference: 0.90,
    score: 0.92,
    reason: '与财报分析任务高度匹配'
  },
  {
    name: 'pdf_parse_tool',
    keyword: 0.86,
    semantic: 0.89,
    history: 0.93,
    preference: 0.75,
    score: 0.87,
    reason: '适合处理 PDF 文件解析'
  },
  {
    name: 'general_qa_tool',
    keyword: 0.20,
    semantic: 0.31,
    history: 0.80,
    preference: 0.50,
    score: 0.36,
    reason: '通用问答工具，但不适合结构化财报分析'
  }
]
```

---

## 10. Memory / Context 面板

可以放在右侧面板或单独页面。

展示：

```text
用户偏好
历史任务
工具使用成功率
当前上下文
```

示例：

```text
用户偏好：
- 用户喜欢表格化输出
- 用户经常执行财报分析任务
- 用户偏好简洁摘要

当前上下文：
- 当前任务：财报分析
- 上传文件：2025_financial_report.pdf
- 已解析文本：3000 字
- 当前节点输出：财务指标 JSON
```

---

## 11. Mock 数据

第一版先用 Mock 数据，不接后端。

创建：

```text
src/mock/workflow.mock.ts
src/mock/trace.mock.ts
src/mock/tools.mock.ts
src/mock/memory.mock.ts
```

### workflow.mock.ts

```ts
export const mockWorkflow = {
  id: 'wf_finance_001',
  name: '财报风险分析 Workflow',
  intent: 'financial_report_analysis',
  confidence: 0.94,
  nodes: [
    {
      id: 'input',
      type: 'file_upload',
      label: '文件上传',
      position: { x: 100, y: 120 },
      data: {
        tool: 'file_upload_tool',
        status: 'success',
        confidence: 0.98,
        reason: '用户需要分析财报，因此需要先上传文件'
      }
    },
    {
      id: 'parse',
      type: 'pdf_parse',
      label: 'PDF 解析',
      position: { x: 360, y: 120 },
      data: {
        tool: 'pdf_parse_tool',
        status: 'success',
        confidence: 0.92,
        reason: '财报通常为 PDF，需要先解析文本'
      }
    },
    {
      id: 'extract',
      type: 'financial_extract',
      label: '财务指标提取',
      position: { x: 620, y: 120 },
      data: {
        tool: 'financial_extract_tool',
        status: 'running',
        confidence: 0.91,
        reason: '需要提取收入、利润、现金流等关键指标'
      }
    },
    {
      id: 'summary',
      type: 'risk_summary',
      label: '风险总结',
      position: { x: 880, y: 120 },
      data: {
        tool: 'risk_summary_tool',
        status: 'idle',
        confidence: 0.89,
        reason: '用户明确要求总结风险'
      }
    }
  ],
  edges: [
    { id: 'e1', source: 'input', target: 'parse' },
    { id: 'e2', source: 'parse', target: 'extract' },
    { id: 'e3', source: 'extract', target: 'summary' }
  ]
}
```

### trace.mock.ts

```ts
export const mockTraceSteps = [
  {
    id: 'step_1',
    stepName: '意图识别',
    stepType: 'intent_analyze',
    status: 'success',
    reason: '检测到关键词：财报、分析、风险',
    confidence: 0.94,
    latency: 850,
    createdAt: '00:01'
  },
  {
    id: 'step_2',
    stepName: 'Workflow 生成',
    stepType: 'workflow_generate',
    status: 'success',
    reason: '根据财报分析任务生成 4 个节点',
    confidence: 0.91,
    latency: 1230,
    createdAt: '00:02'
  },
  {
    id: 'step_3',
    stepName: '工具候选排序',
    stepType: 'tool_ranking',
    status: 'success',
    selectedTool: 'financial_extract_tool',
    candidateTools: [
      { name: 'financial_extract_tool', score: 0.92 },
      { name: 'pdf_parse_tool', score: 0.87 },
      { name: 'general_qa_tool', score: 0.36 }
    ],
    reason: 'financial_extract_tool 与财报分析任务匹配度最高',
    latency: 920,
    createdAt: '00:03'
  }
]
```

---

## 12. 主要交互逻辑

### 12.1 Generate Workflow

```text
1. 读取输入框 query
2. 显示 loading
3. 使用 mockWorkflow 或调用 /api/workflow/generate
4. 渲染节点和边
5. 默认选中第一个节点
6. 右侧 Inspector 显示节点详情
7. 底部 Trace 增加 Workflow 生成记录
```

### 12.2 Run Workflow

```text
1. 所有节点状态变为 idle
2. 按节点顺序模拟执行
3. 当前节点变为 running
4. 延迟 800ms
5. 当前节点变为 success
6. 底部 Trace Timeline 增加一条记录
7. 最终显示执行成功
```

### 12.3 点击节点

```text
1. 高亮选中节点
2. 右侧 Inspector 更新
3. 显示节点 reason、tool、confidence、IO
4. 如果有 candidateTools，显示 Ranking
```

### 12.4 点击 Trace Step

```text
1. 高亮对应步骤
2. 如果 step 有 nodeId，则同步高亮画布中的节点
3. 右侧显示该步骤 input/output/reason
```

### 12.5 Simulate Failure

```text
1. 将 extract 节点状态设置为 failed
2. 底部 Failure Analysis 显示失败信息
3. 后续节点设置为 skipped
4. 画布对应节点变红
```

---

## 13. 样式要求

整体风格：

```text
现代、干净、专业、AI SaaS 后台
```

主题色：

```css
:root {
  --tm-bg: #f5f7fb;
  --tm-panel: #ffffff;
  --tm-border: #e5e9f2;
  --tm-text: #162033;
  --tm-muted: #718096;
  --tm-primary: #2563eb;
  --tm-primary-soft: #eaf1ff;
  --tm-success: #16a34a;
  --tm-success-soft: #eaf8ef;
  --tm-danger: #dc2626;
  --tm-danger-soft: #fff0f0;
  --tm-warning: #d97706;
  --tm-warning-soft: #fff7e6;
  --tm-sidebar: #101827;
}
```

卡片样式：

```css
border-radius: 16px;
border: 1px solid var(--tm-border);
background: var(--tm-panel);
box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
```

---

## 14. 必须做到

```text
1. UI 可以参考 Flowise，但不能直接复制 Flowise 源码和品牌元素。
2. 所有名称、Logo、文案都改成 TraceMind。
3. 画布只是基础，重点是 Explainability 和 Trace Replay。
4. 第一版用 Mock 数据即可。
5. 组件拆分清晰。
6. 页面必须能独立运行。
7. 所有核心数据结构写成 TypeScript 类型。
8. 代码要有注释，方便团队协作。
```

---

## 15. 不要做

```text
1. 不要复制 Flowise Logo
2. 不要复制 Flowise 原文案
3. 不要复制企业版功能
4. 不要只做空白画布
5. 不要把 Trace Replay 做成普通日志列表
6. 不要把项目做成“低配 Flowise”
```

---

## 16. 交付要求

请生成完整前端项目：

```text
1. 可运行 Vue 3 + Vite 项目
2. 完整页面布局
3. Mock 数据
4. Workflow Canvas
5. Node Inspector
6. Trace Replay
7. Tool Ranking
8. Failure Analysis
9. Memory / Context 面板
10. README.md
```

运行命令：

```bash
npm install
npm run dev
```

---

## 17. 给 Codex 的最终一句话任务

请根据 Flowise 的可视化节点编辑器交互风格，重新生成一套 TraceMind 前端。  
要求使用全新代码实现，保留“左侧节点库 + 中间画布 + 右侧节点详情 + 底部执行轨迹”的产品结构，并突出 TraceMind 的核心能力：自然语言生成 Workflow、节点原因解释、工具候选排序、执行轨迹回放和失败分析。

# TraceMind Hooks 机制设计任务书（给 Codex 使用）

> 目标：基于 `learn-claude-code/s04_hooks` 的思想，为 TraceMind 增加一套 Hooks 扩展机制。  
> 核心思想：**不要把权限检查、日志记录、依赖检查、Trace 写入、输出校验全部硬塞进 Executor，而是通过 Hook 注册表挂载到工作流和工具执行流程上。**

---

## 1. 背景说明

TraceMind 当前已经有：

```text
Workflow Generator：生成工作流
Workflow Executor：执行工作流
Tool Registry：工具注册表
Permission Service：工具权限检查
Trace Service：执行轨迹记录
Failure Analysis：失败分析
```

如果继续把所有逻辑都写进 `workflowExecutor.service.ts`，执行器会越来越乱。

例如后面要加：

```text
权限检查
输入校验
依赖检查
路径安全检查
Trace running 记录
工具调用日志
输出检查
文件大小检查
下载链接生成
失败分析
运行摘要
临时文件清理
```

如果全部写在 Executor 里，会变成：

```ts
checkPermission()
checkInput()
checkDependency()
recordTraceStart()
executeTool()
checkOutput()
recordTraceEnd()
generateDownloadUrl()
cleanupTempFiles()
```

这不利于维护。

所以需要引入 Hooks 机制。

---

## 2. Hooks 是什么

Hook 可以理解成：

```text
在工作流运行的关键时机，自动触发的扩展函数。
```

普通执行流程：

```text
执行节点
↓
执行工具
↓
返回结果
```

加入 Hooks 后：

```text
BeforeWorkflowRun Hook
↓
BeforeNodeRun Hook
↓
PreToolUse Hook
↓
执行工具
↓
PostToolUse Hook
↓
AfterNodeRun Hook
↓
AfterWorkflowRun / Stop Hook
```

Hook 的作用是：

```text
让 Executor 保持简洁
让扩展逻辑外挂
让权限、日志、校验、Trace、失败分析都可以模块化接入
```

---

## 3. 参考思想

参考 `learn-claude-code/s04_hooks` 的核心思想：

```text
“挂在循环上，不写进循环里”
```

也就是：

```text
循环本身只负责触发 hook；
具体权限、日志、检查、输出处理都写成 hook 回调。
```

TraceMind 要借鉴这个思想，但不要照搬 Python 代码，而是结合 Node.js + Express + TypeScript 后端重新设计。

---

## 4. TraceMind 中需要的 Hook 事件

第一版建议实现这些事件：

```ts
export type HookEvent =
  | 'UserPromptSubmit'
  | 'BeforeWorkflowGenerate'
  | 'AfterWorkflowGenerate'
  | 'BeforeWorkflowRun'
  | 'BeforeNodeRun'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'AfterNodeRun'
  | 'OnNodeError'
  | 'AfterWorkflowRun'
  | 'Stop'
```

如果第一版时间不够，最小版本至少实现：

```text
PreToolUse
PostToolUse
OnNodeError
Stop
```

---

## 5. Hook 事件说明

### 5.1 UserPromptSubmit

触发时机：

```text
用户在工作台提交自然语言需求之后，进入 AI 生成 Workflow 之前。
```

用途：

```text
输入安全检查
补充用户记忆
补充工具库信息
补充当前场景信息
记录用户输入日志
```

示例：

```text
用户输入：帮我分析这份财报，并生成 Word 报告

UserPromptSubmit Hook 可以补充：
当前可用工具：pdf_parse_tool、financial_extract_tool、markdown_to_docx_tool
当前主场景：报告与财务分析
用户偏好：喜欢表格化输出
```

---

### 5.2 BeforeWorkflowGenerate

触发时机：

```text
后端准备构造 Prompt，调用大模型生成 Workflow 前。
```

用途：

```text
注入工具说明
注入模板信息
注入记忆信息
注入输出 JSON 格式约束
```

---

### 5.3 AfterWorkflowGenerate

触发时机：

```text
AI 返回 Workflow JSON 之后，保存和渲染之前。
```

用途：

```text
清洗 JSON
修复 markdown 包裹
补充默认 position
补充默认 status
检查字段缺失
记录生成日志
```

示例：

```text
AI 返回的节点没有 position，Hook 自动按布局算法补充 x/y 坐标。
```

---

### 5.4 BeforeWorkflowRun

触发时机：

```text
用户点击运行工作流之后，真正执行第一个节点之前。
```

用途：

```text
创建 run 记录
初始化 context
检查工作流是否成环
检查所有工具是否存在
检查禁用工具
```

---

### 5.5 BeforeNodeRun

触发时机：

```text
每个节点执行前。
```

用途：

```text
写 Trace running
检查节点输入是否存在
检查上游节点是否成功
更新前端节点状态
```

---

### 5.6 PreToolUse

触发时机：

```text
工具真正执行前。
```

用途最重要：

```text
权限检查
依赖检查
路径安全检查
输入 Schema 校验
工具启用状态检查
工具调用日志开始记录
```

示例：

```text
执行 markdown_to_docx_tool 前：
1. 检查 markdown 是否为空
2. 检查输出路径是否在 uploads/reports
3. 检查 html-to-docx 是否已安装
4. 检查该工具权限是否 allow
```

---

### 5.7 PostToolUse

触发时机：

```text
工具执行后。
```

用途：

```text
输出 Schema 校验
输出过大提醒
文件是否生成检查
生成 downloadUrl
更新工具成功率
写 Trace success / failed
保存 tool_call_logs
```

示例：

```text
markdown_to_docx_tool 执行成功后：
1. 检查 docx 文件是否存在
2. 记录文件大小
3. 生成下载链接
4. 写入 Trace 输出摘要
```

---

### 5.8 AfterNodeRun

触发时机：

```text
某个节点完整执行完成后。
```

用途：

```text
更新节点状态
把工具输出写入 context
计算下游节点是否可执行
记录节点耗时
```

---

### 5.9 OnNodeError

触发时机：

```text
某个节点执行失败时。
```

用途：

```text
失败原因归类
计算影响范围
生成修复建议
决定是否停止工作流
决定是否允许重试
```

示例：

```text
PDF 解析失败：
失败原因：文件格式不支持
影响节点：财务指标提取、风险分析、报告输出
修复建议：重新上传 PDF 或切换 text_extract_tool
```

---

### 5.10 AfterWorkflowRun / Stop

触发时机：

```text
整个工作流执行完成或停止时。
```

用途：

```text
生成运行摘要
清理临时文件
汇总工具调用次数
生成最终 Trace 总结
更新 workflow_runs 状态
```

示例：

```text
本次运行共执行 6 个节点，成功 6 个，失败 0 个，生成 finance_report.docx，总耗时 8.2 秒。
```

---

## 6. 推荐目录结构

新增：

```text
src/
├─ hooks/
│  ├─ hookTypes.ts
│  ├─ hookRegistry.ts
│  ├─ defaultHooks.ts
│  ├─ userPromptSubmit.hooks.ts
│  ├─ workflowGenerate.hooks.ts
│  ├─ workflowRun.hooks.ts
│  ├─ nodeRun.hooks.ts
│  ├─ toolUse.hooks.ts
│  └─ stop.hooks.ts
│
├─ services/
│  ├─ hook.service.ts
│  ├─ permission.service.ts
│  ├─ trace.service.ts
│  ├─ workflowExecutor.service.ts
│  └─ workflowGenerator.service.ts
```

---

## 7. Hook 类型设计

创建：

```text
src/hooks/hookTypes.ts
```

内容：

```ts
export type HookEvent =
  | 'UserPromptSubmit'
  | 'BeforeWorkflowGenerate'
  | 'AfterWorkflowGenerate'
  | 'BeforeWorkflowRun'
  | 'BeforeNodeRun'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'AfterNodeRun'
  | 'OnNodeError'
  | 'AfterWorkflowRun'
  | 'Stop'

export type HookOutcome =
  | 'success'
  | 'blocking'
  | 'non_blocking_error'
  | 'cancelled'

export type HookResult = {
  outcome?: HookOutcome
  blocked?: boolean
  message?: string
  reason?: string
  updatedInput?: any
  additionalContext?: string
  permissionBehavior?: 'allow' | 'ask' | 'deny'
  permissionReason?: string
  approvalId?: number
  preventContinuation?: boolean
  error?: string
}

export type HookContext = {
  runId?: number
  workflowId?: number
  nodeId?: string
  toolName?: string
  input?: any
  output?: any
  error?: any
  context?: any
  metadata?: Record<string, any>
}

export type HookCallback = (ctx: HookContext) => Promise<HookResult | void> | HookResult | void
```

---

## 8. Hook Registry 设计

创建：

```text
src/hooks/hookRegistry.ts
```

内容：

```ts
import type { HookCallback, HookEvent, HookContext, HookResult } from './hookTypes'

const HOOKS: Record<HookEvent, HookCallback[]> = {
  UserPromptSubmit: [],
  BeforeWorkflowGenerate: [],
  AfterWorkflowGenerate: [],
  BeforeWorkflowRun: [],
  BeforeNodeRun: [],
  PreToolUse: [],
  PostToolUse: [],
  AfterNodeRun: [],
  OnNodeError: [],
  AfterWorkflowRun: [],
  Stop: []
}

export function registerHook(event: HookEvent, callback: HookCallback) {
  HOOKS[event].push(callback)
}

export async function triggerHooks(event: HookEvent, ctx: HookContext): Promise<HookResult | null> {
  const callbacks = HOOKS[event] || []

  for (const callback of callbacks) {
    try {
      const result = await callback(ctx)

      if (!result) continue

      if (result.outcome === 'non_blocking_error') {
        continue
      }

      if (result.updatedInput) {
        ctx.input = result.updatedInput
      }

      if (result.additionalContext) {
        ctx.metadata = {
          ...(ctx.metadata || {}),
          additionalContext: result.additionalContext
        }
      }

      if (result.blocked || result.preventContinuation || result.outcome === 'blocking') {
        return result
      }
    } catch (error: any) {
      return {
        outcome: 'blocking',
        blocked: true,
        error: error.message,
        reason: `Hook ${event} 执行异常：${error.message}`
      }
    }
  }

  return null
}
```

---

## 9. 默认 Hooks 设计

创建：

```text
src/hooks/defaultHooks.ts
```

统一注册：

```ts
import { registerHook } from './hookRegistry'
import {
  userPromptLogHook,
  injectToolContextHook
} from './userPromptSubmit.hooks'
import {
  cleanWorkflowJsonHook,
  fillNodePositionHook
} from './workflowGenerate.hooks'
import {
  beforeNodeTraceHook,
  afterNodeTraceHook,
  nodeErrorAnalysisHook
} from './nodeRun.hooks'
import {
  permissionPreToolHook,
  dependencyCheckHook,
  inputSchemaCheckHook,
  postToolTraceHook,
  outputSchemaCheckHook,
  fileOutputHook
} from './toolUse.hooks'
import {
  workflowSummaryHook,
  cleanupTempFilesHook
} from './stop.hooks'

export function registerDefaultHooks() {
  registerHook('UserPromptSubmit', userPromptLogHook)
  registerHook('UserPromptSubmit', injectToolContextHook)

  registerHook('AfterWorkflowGenerate', cleanWorkflowJsonHook)
  registerHook('AfterWorkflowGenerate', fillNodePositionHook)

  registerHook('BeforeNodeRun', beforeNodeTraceHook)
  registerHook('AfterNodeRun', afterNodeTraceHook)
  registerHook('OnNodeError', nodeErrorAnalysisHook)

  registerHook('PreToolUse', permissionPreToolHook)
  registerHook('PreToolUse', dependencyCheckHook)
  registerHook('PreToolUse', inputSchemaCheckHook)

  registerHook('PostToolUse', outputSchemaCheckHook)
  registerHook('PostToolUse', fileOutputHook)
  registerHook('PostToolUse', postToolTraceHook)

  registerHook('Stop', workflowSummaryHook)
  registerHook('Stop', cleanupTempFilesHook)
}
```

在 `app.ts` 或 `server.ts` 启动时调用：

```ts
registerDefaultHooks()
```

---

## 10. PreToolUse Hooks 设计

创建：

```text
src/hooks/toolUse.hooks.ts
```

### 10.1 权限 Hook

```ts
import { checkPermission } from '../services/permission.service'

export async function permissionPreToolHook(ctx) {
  const permission = await checkPermission({
    toolName: ctx.toolName,
    input: ctx.input,
    context: ctx.context
  })

  if (permission.behavior === 'deny') {
    return {
      outcome: 'blocking',
      blocked: true,
      permissionBehavior: 'deny',
      permissionReason: permission.reason,
      reason: permission.reason
    }
  }

  if (permission.behavior === 'ask') {
    return {
      outcome: 'blocking',
      blocked: true,
      permissionBehavior: 'ask',
      permissionReason: permission.reason,
      reason: permission.reason
    }
  }

  return {
    outcome: 'success',
    permissionBehavior: 'allow',
    permissionReason: permission.reason
  }
}
```

### 10.2 依赖检查 Hook

```ts
export async function dependencyCheckHook(ctx) {
  const dependencies = ctx.metadata?.toolDefinition?.dependencies || []

  for (const dep of dependencies) {
    try {
      require.resolve(dep)
    } catch {
      return {
        outcome: 'blocking',
        blocked: true,
        reason: `工具 ${ctx.toolName} 缺少依赖 ${dep}，请先安装。`
      }
    }
  }
}
```

### 10.3 输入校验 Hook

```ts
export async function inputSchemaCheckHook(ctx) {
  const schema = ctx.metadata?.toolDefinition?.inputSchema
  if (!schema) return

  for (const key of Object.keys(schema)) {
    if (schema[key]?.required && ctx.input?.[key] == null) {
      return {
        outcome: 'blocking',
        blocked: true,
        reason: `工具 ${ctx.toolName} 缺少必要输入字段：${key}`
      }
    }
  }
}
```

---

## 11. PostToolUse Hooks 设计

### 11.1 输出校验 Hook

```ts
export async function outputSchemaCheckHook(ctx) {
  const schema = ctx.metadata?.toolDefinition?.outputSchema
  if (!schema || !ctx.output) return

  for (const key of Object.keys(schema)) {
    if (schema[key]?.required && ctx.output?.[key] == null) {
      return {
        outcome: 'blocking',
        blocked: true,
        reason: `工具 ${ctx.toolName} 输出缺少必要字段：${key}`
      }
    }
  }
}
```

### 11.2 文件结果处理 Hook

```ts
export async function fileOutputHook(ctx) {
  const output = ctx.output
  if (!output?.filePath) return

  return {
    outcome: 'success',
    message: `文件已生成：${output.filename || output.filePath}`
  }
}
```

### 11.3 Trace 记录 Hook

```ts
export async function postToolTraceHook(ctx) {
  // 调用 traceService 更新节点执行结果
  // 记录 outputSummary、latency、fileUrl 等信息
  return {
    outcome: 'success'
  }
}
```

---

## 12. Node Hooks 设计

创建：

```text
src/hooks/nodeRun.hooks.ts
```

### 12.1 BeforeNodeRun

```ts
export async function beforeNodeTraceHook(ctx) {
  // 写入 trace_steps running
  return {
    outcome: 'success',
    message: `节点 ${ctx.nodeId} 开始执行`
  }
}
```

### 12.2 AfterNodeRun

```ts
export async function afterNodeTraceHook(ctx) {
  // 更新 trace_steps success
  return {
    outcome: 'success',
    message: `节点 ${ctx.nodeId} 执行完成`
  }
}
```

### 12.3 OnNodeError

```ts
export async function nodeErrorAnalysisHook(ctx) {
  // 根据错误类型生成失败分析
  // 例如：缺依赖、权限拒绝、输入为空、文件不存在、模型调用失败
  return {
    outcome: 'success',
    message: `节点 ${ctx.nodeId} 执行失败，已生成失败分析`
  }
}
```

---

## 13. Workflow Generator 中集成 Hooks

修改：

```text
src/services/workflowGenerator.service.ts
```

流程：

```ts
await triggerHooks('UserPromptSubmit', {
  input: { query },
  context
})

await triggerHooks('BeforeWorkflowGenerate', {
  input: { query, tools, memories },
  context
})

const workflow = await callLLMOrRuleEngine(query)

await triggerHooks('AfterWorkflowGenerate', {
  input: workflow,
  context,
  metadata: {
    source: 'llm'
  }
})
```

注意：

```text
AfterWorkflowGenerate Hook 可以补充 position、status、tone、默认 reason。
```

---

## 14. Workflow Executor 中集成 Hooks

修改：

```text
src/services/workflowExecutor.service.ts
```

执行流程：

```ts
await triggerHooks('BeforeWorkflowRun', {
  runId,
  workflowId,
  context
})

for (const node of sortedNodes) {
  await triggerHooks('BeforeNodeRun', {
    runId,
    workflowId,
    nodeId: node.id,
    context
  })

  const preResult = await triggerHooks('PreToolUse', {
    runId,
    workflowId,
    nodeId: node.id,
    toolName: node.tool,
    input: toolInput,
    context,
    metadata: {
      toolDefinition
    }
  })

  if (preResult?.blocked) {
    await triggerHooks('OnNodeError', {
      runId,
      workflowId,
      nodeId: node.id,
      toolName: node.tool,
      input: toolInput,
      error: preResult.reason,
      context
    })
    break
  }

  try {
    const result = await tool.run(toolInput, context)

    const postResult = await triggerHooks('PostToolUse', {
      runId,
      workflowId,
      nodeId: node.id,
      toolName: node.tool,
      input: toolInput,
      output: result.output,
      context,
      metadata: {
        toolDefinition
      }
    })

    if (postResult?.blocked) {
      await triggerHooks('OnNodeError', {
        runId,
        workflowId,
        nodeId: node.id,
        toolName: node.tool,
        input: toolInput,
        output: result.output,
        error: postResult.reason,
        context
      })
      break
    }

    context.nodeOutputs[node.id] = result.output

    await triggerHooks('AfterNodeRun', {
      runId,
      workflowId,
      nodeId: node.id,
      toolName: node.tool,
      input: toolInput,
      output: result.output,
      context
    })
  } catch (error) {
    await triggerHooks('OnNodeError', {
      runId,
      workflowId,
      nodeId: node.id,
      toolName: node.tool,
      input: toolInput,
      error,
      context
    })
    break
  }
}

await triggerHooks('Stop', {
  runId,
  workflowId,
  context
})
```

---

## 15. 财务分析场景完整 Hooks 流程

用户输入：

```text
帮我分析这份财报，并生成 Word 风险报告
```

流程：

```text
UserPromptSubmit
- 记录用户输入
- 注入当前工具库和财务分析场景

BeforeWorkflowGenerate
- 注入输出 JSON Schema
- 注入财报分析模板

AI / 规则生成 Workflow
文件读取 → 财务指标提取 → 风险分析 → 报告生成 → Word 导出 → 结果输出

AfterWorkflowGenerate
- 清洗 JSON
- 补充 position
- 校验默认字段

BeforeWorkflowRun
- 创建 run
- 初始化 context

BeforeNodeRun：文件读取
PreToolUse：pdf_parse_tool
- 检查文件路径
- 检查文件是否存在
- 权限 allow

PostToolUse：pdf_parse_tool
- 检查文本是否为空
- 写入 Trace

BeforeNodeRun：财务指标提取
PreToolUse：financial_extract_tool
- 检查上游文本是否存在
- 权限 allow

PostToolUse：financial_extract_tool
- 检查是否提取 revenue / profit / cashflow
- 写入 Trace

BeforeNodeRun：报告生成
PreToolUse：report_generate_tool
- 检查输入指标和风险分析是否存在

PostToolUse：report_generate_tool
- 检查 Markdown 是否为空
- 记录生成字数

BeforeNodeRun：Word 导出
PreToolUse：markdown_to_docx_tool
- 检查 markdown 是否为空
- 检查 html-to-docx 是否安装
- 检查输出路径是否在 uploads/reports
- 权限 allow

PostToolUse：markdown_to_docx_tool
- 检查 docx 文件是否存在
- 生成 downloadUrl
- 写入 Trace

Stop
- 汇总运行结果
- 清理临时文件
```

---

## 16. Hook 日志表设计

可选新增：

```sql
CREATE TABLE hook_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NULL,
  workflow_id BIGINT NULL,
  node_id VARCHAR(100) NULL,
  tool_name VARCHAR(100) NULL,
  hook_event VARCHAR(100) NOT NULL,
  outcome VARCHAR(50),
  message TEXT,
  reason TEXT,
  blocked TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

如果不想增加表，也可以把 hook 关键结果写入 `trace_steps`。

---

## 17. 前端展示建议

Workflow Trace 面板增加 Hook 信息折叠区：

```text
节点：Word 导出
工具：markdown_to_docx_tool

PreToolUse Hooks:
✅ 权限检查：allow
✅ 依赖检查：html-to-docx 已安装
✅ 路径检查：uploads/reports 合法

PostToolUse Hooks:
✅ 文件检查：docx 已生成
✅ 下载链接：/api/files/reports/finance_report.docx

执行结果：success
```

如果失败：

```text
PreToolUse Hooks:
✅ 权限检查：allow
❌ 依赖检查：缺少 html-to-docx

节点状态：failed
修复建议：请管理员安装 html-to-docx，或切换为 Markdown 输出
```

---

## 18. V1.0 必做范围

第一版只做这些：

```text
1. hookTypes.ts
2. hookRegistry.ts
3. registerDefaultHooks()
4. PreToolUse Hook
   - 权限检查
   - 依赖检查
   - 输入检查
5. PostToolUse Hook
   - 输出检查
   - Trace 记录
   - 文件结果处理
6. OnNodeError Hook
   - 失败分析
7. Stop Hook
   - 运行摘要
8. Executor 中接入 triggerHooks()
```

---

## 19. V1.1 可选增强

```text
1. UserPromptSubmit Hook 注入记忆
2. BeforeWorkflowGenerate Hook 注入工具库和模板
3. AfterWorkflowGenerate Hook 自动布局
4. hook_logs 表
5. 前端 Hook 详情面板
6. Hook 开关配置
```

---

## 20. V2.0 后续扩展

```text
1. 自定义 Hook 插件
2. Webhook 通知
3. 工具沙箱运行 Hook
4. PostToolUse 自动生成测试样例
5. Stop Hook 自动生成运行报告
6. Hook 失败自动恢复策略
```

---

## 21. Codex 最终任务提示词

请基于本任务书，为 TraceMind 后端增加 Hooks 扩展机制。

要求：

```text
1. 新增 hooks 目录。
2. 实现 HookEvent、HookResult、HookContext、HookCallback 类型。
3. 实现 registerHook() 和 triggerHooks()。
4. 实现 registerDefaultHooks()。
5. 在 workflowGenerator.service.ts 中接入：
   - UserPromptSubmit
   - BeforeWorkflowGenerate
   - AfterWorkflowGenerate
6. 在 workflowExecutor.service.ts 中接入：
   - BeforeWorkflowRun
   - BeforeNodeRun
   - PreToolUse
   - PostToolUse
   - AfterNodeRun
   - OnNodeError
   - Stop
7. PreToolUse 至少完成：
   - 权限检查
   - 依赖检查
   - 输入校验
8. PostToolUse 至少完成：
   - 输出校验
   - 文件结果处理
   - Trace 更新
9. OnNodeError 完成：
   - 失败原因归类
   - 修复建议生成
10. Stop 完成：
   - 运行摘要
   - 清理临时文件
11. Executor 不要继续堆权限、日志、校验等硬编码逻辑，尽量交给 hooks。
12. 保持原有接口兼容，不要破坏现有 Workflow 运行。
```

优先修改文件：

```text
src/services/workflowExecutor.service.ts
src/services/workflowGenerator.service.ts
src/hooks/hookTypes.ts
src/hooks/hookRegistry.ts
src/hooks/defaultHooks.ts
src/hooks/toolUse.hooks.ts
src/hooks/nodeRun.hooks.ts
src/hooks/stop.hooks.ts
```

修改完成后请说明：

```text
1. 新增了哪些文件
2. 修改了哪些文件
3. hooks 如何注册
4. hooks 如何触发
5. PreToolUse 如何拦截工具执行
6. PostToolUse 如何处理输出和 Trace
7. OnNodeError 如何生成失败分析
8. Stop 如何生成运行摘要
9. 还有哪些 TODO
```

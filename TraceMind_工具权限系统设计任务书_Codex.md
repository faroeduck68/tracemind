# TraceMind 工具权限系统设计任务书（给 Codex 使用）

> 目标：为 TraceMind 增加一套工具执行前的权限控制系统。  
> 核心思想：**AI 只能提出工具调用请求，后端必须在真正执行工具前做权限检查。**  
> 参考方向：借鉴 Claude Code / learn-claude-code s03_permission 的权限管线思想，但结合 TraceMind 的工作流、工具库、Trace 回放和报告生成场景重新设计。

---

## 1. 背景说明

TraceMind 是一个可解释 AI Agent Workflow 平台。系统中存在大量可调用工具，例如：

```text
pdf_parse_tool
financial_extract_tool
risk_summary_tool
report_generate_tool
markdown_to_docx_tool
docx_edit_tool
dependency_install_tool
file_write_tool
bash_tool
```

这些工具有些风险很低，例如 PDF 解析、财务指标提取、报告生成；有些风险较高，例如修改文件、删除文件、安装依赖、执行 Shell 命令。

因此不能让 AI 拥有最高权限，也不能让 AI 想执行什么就直接执行。

必须实现：

```text
AI 生成工具调用请求
↓
后端权限检查 Permission Check
↓
返回 allow / ask / deny
↓
允许后才真正执行工具
↓
权限结果写入 Trace
```

---

## 2. 核心设计原则

### 2.1 AI 不能直接执行工具

错误设计：

```text
AI 选择工具
↓
后端直接执行
```

正确设计：

```text
AI 选择工具
↓
Permission Engine 检查权限
↓
通过后 Executor 执行工具
```

### 2.2 权限必须由后端代码决定

AI 可以输出：

```json
{
  "tool": "markdown_to_docx_tool",
  "reason": "用户需要导出 Word 报告"
}
```

但是否允许执行，必须由后端判断。

### 2.3 不给 AI 最高权限

禁止设计：

```text
AI 可以执行任意 npm install
AI 可以执行任意 shell 命令
AI 可以读写任意文件
AI 可以修改 .env
AI 可以删除项目文件
```

### 2.4 权限结果必须可解释、可记录、可回放

每次工具执行前都要记录：

```text
工具名
权限结果 allow / ask / deny
权限原因
用户是否审批
审批时间
最终是否执行
```

这样 TraceMind 的 Trace 面板可以展示：

```text
节点：Word 报告生成
工具：markdown_to_docx_tool
权限判断：allow
原因：该工具仅在 reports 目录生成 docx 文件，属于低风险操作
执行结果：success
```

---

## 3. 权限结果类型

第一版只实现三种：

```ts
export type PermissionBehavior = 'allow' | 'ask' | 'deny'
```

| 行为 | 含义 | 示例 |
|---|---|---|
| allow | 直接允许执行 | 解析 PDF、生成 Word、生成报告 |
| ask | 需要用户确认 | 修改已有文件、删除文件、安装依赖 |
| deny | 直接拒绝 | 读取 .env、执行 rm -rf、操作系统根目录 |

---

## 4. 工具风险等级设计

```ts
export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'danger'
```

| 风险等级 | 默认行为 | 示例 |
|---|---|---|
| low | allow | 文件解析、报告生成、Markdown 转 Word |
| medium | ask | 修改文档、覆盖文件 |
| high | ask | 安装依赖、删除文件 |
| danger | deny | Shell 命令、读取密钥、系统级操作 |

---

## 5. TraceMind 工具权限规则

创建文件：

```text
src/permissions/permissionRules.ts
```

内容示例：

```ts
export const TOOL_PERMISSION_RULES = {
  user_input: {
    level: 'low',
    defaultBehavior: 'allow'
  },

  pdf_parse_tool: {
    level: 'low',
    defaultBehavior: 'allow',
    allowedDirs: ['uploads']
  },

  financial_extract_tool: {
    level: 'low',
    defaultBehavior: 'allow'
  },

  financial_risk_tool: {
    level: 'low',
    defaultBehavior: 'allow'
  },

  risk_summary_tool: {
    level: 'low',
    defaultBehavior: 'allow'
  },

  report_generate_tool: {
    level: 'low',
    defaultBehavior: 'allow'
  },

  markdown_to_docx_tool: {
    level: 'low',
    defaultBehavior: 'allow',
    allowedDirs: ['uploads/reports']
  },

  markdown_to_pdf_tool: {
    level: 'low',
    defaultBehavior: 'allow',
    allowedDirs: ['uploads/reports']
  },

  docx_edit_tool: {
    level: 'medium',
    defaultBehavior: 'ask',
    allowedDirs: ['uploads/reports']
  },

  file_write_tool: {
    level: 'medium',
    defaultBehavior: 'ask',
    allowedDirs: ['uploads', 'uploads/reports', 'temp']
  },

  file_delete_tool: {
    level: 'high',
    defaultBehavior: 'ask',
    allowedDirs: ['uploads/reports', 'temp']
  },

  dependency_install_tool: {
    level: 'high',
    defaultBehavior: 'ask',
    allowedPackages: [
      'markdown-it',
      'html-to-docx',
      'pdf-parse',
      'docx',
      'mammoth',
      'xlsx'
    ]
  },

  bash_tool: {
    level: 'danger',
    defaultBehavior: 'deny'
  }
} as const
```

---

## 6. 权限检查总流程

```text
Executor 准备执行节点
↓
拿到 node.tool 和 input
↓
调用 permissionService.checkPermission()
↓
如果 deny：写 Trace，跳过执行
↓
如果 ask：生成审批请求，等待用户确认
↓
如果 allow：执行工具
↓
工具执行结果写入 Trace
```

---

## 7. Permission Service 设计

创建文件：

```text
src/services/permission.service.ts
```

核心函数：

```ts
import { TOOL_PERMISSION_RULES } from '../permissions/permissionRules'
import { isSafePath } from '../utils/safePath'

export type PermissionResult = {
  behavior: 'allow' | 'ask' | 'deny'
  reason: string
  riskLevel?: string
  approvalRequired?: boolean
  blockedBy?: string
}

export async function checkPermission(params: {
  toolName: string
  input: any
  context: any
}): Promise<PermissionResult> {
  const { toolName, input } = params

  const rule = TOOL_PERMISSION_RULES[toolName as keyof typeof TOOL_PERMISSION_RULES]

  if (!rule) {
    return {
      behavior: 'deny',
      reason: `工具 ${toolName} 未注册，拒绝执行。`,
      blockedBy: 'UNREGISTERED_TOOL'
    }
  }

  if (rule.defaultBehavior === 'deny') {
    return {
      behavior: 'deny',
      reason: `工具 ${toolName} 属于危险工具，默认拒绝执行。`,
      riskLevel: rule.level,
      blockedBy: 'DANGEROUS_TOOL'
    }
  }

  const pathFields = ['filePath', 'outputPath', 'targetPath', 'templatePath']

  for (const field of pathFields) {
    if (input?.[field]) {
      const allowedDirs = (rule as any).allowedDirs || []
      const safe = isSafePath(input[field], allowedDirs)

      if (!safe) {
        return {
          behavior: 'deny',
          reason: `路径 ${input[field]} 超出允许目录，拒绝执行。`,
          riskLevel: rule.level,
          blockedBy: 'PATH_OUT_OF_SCOPE'
        }
      }
    }
  }

  if (toolName === 'dependency_install_tool') {
    const pkg = input?.packageName
    const allowedPackages = (rule as any).allowedPackages || []

    if (!allowedPackages.includes(pkg)) {
      return {
        behavior: 'deny',
        reason: `依赖 ${pkg} 不在白名单中，禁止自动安装。`,
        riskLevel: rule.level,
        blockedBy: 'PACKAGE_NOT_ALLOWED'
      }
    }
  }

  if (rule.defaultBehavior === 'ask') {
    return {
      behavior: 'ask',
      reason: `工具 ${toolName} 会产生状态变更，需要用户确认。`,
      riskLevel: rule.level,
      approvalRequired: true
    }
  }

  return {
    behavior: 'allow',
    reason: `工具 ${toolName} 通过权限检查，允许执行。`,
    riskLevel: rule.level
  }
}
```

---

## 8. 安全路径检查

创建文件：

```text
src/utils/safePath.ts
```

实现：

```ts
import path from 'path'

export function isSafePath(targetPath: string, allowedDirs: string[]) {
  if (!targetPath) return false

  const root = process.cwd()
  const resolvedTarget = path.resolve(root, targetPath)

  return allowedDirs.some(dir => {
    const resolvedAllowed = path.resolve(root, dir)
    return resolvedTarget.startsWith(resolvedAllowed)
  })
}
```

作用：

```text
防止工具访问项目外文件
防止读取 .env
防止写入系统目录
防止路径穿越 ../../../
```

---

## 9. Executor 中集成权限检查

修改：

```text
src/services/workflowExecutor.service.ts
```

在工具执行前加入：

```ts
const permission = await permissionService.checkPermission({
  toolName: node.tool,
  input: toolInput,
  context
})

await traceService.recordPermission({
  runId,
  nodeId: node.id,
  toolName: node.tool,
  behavior: permission.behavior,
  reason: permission.reason,
  riskLevel: permission.riskLevel
})

if (permission.behavior === 'deny') {
  await traceService.updateStep({
    runId,
    nodeId: node.id,
    status: 'permission_denied',
    errorMessage: permission.reason
  })

  break
}

if (permission.behavior === 'ask') {
  const approval = await approvalService.createApprovalRequest({
    runId,
    nodeId: node.id,
    toolName: node.tool,
    input: toolInput,
    reason: permission.reason
  })

  await traceService.updateStep({
    runId,
    nodeId: node.id,
    status: 'waiting_approval',
    outputData: {
      approvalId: approval.id
    }
  })

  return {
    status: 'waiting_approval',
    approvalId: approval.id
  }
}

const tool = toolRegistry[node.tool]
const result = await tool.run(toolInput, context)
```

---

## 10. 新增执行状态

原本状态可能只有：

```ts
'idle' | 'running' | 'success' | 'failed' | 'skipped'
```

建议新增：

```ts
'waiting_approval'
'permission_denied'
```

完整状态：

```ts
export type NodeStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'waiting_approval'
  | 'permission_denied'
```

---

## 11. 审批请求设计

当权限结果为 `ask` 时，后端创建审批请求。

### 11.1 数据结构

```ts
type ApprovalRequest = {
  id: number
  runId: number
  nodeId: string
  toolName: string
  inputPreview: string
  reason: string
  riskLevel: 'medium' | 'high'
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  decidedAt?: string
}
```

### 11.2 接口设计

```http
GET  /api/approvals/pending
POST /api/approvals/:id/approve
POST /api/approvals/:id/reject
POST /api/runs/:runId/resume
```

---

## 12. 数据库设计

### 12.1 permission_logs 权限日志表

```sql
CREATE TABLE permission_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  node_id VARCHAR(100),
  tool_name VARCHAR(100) NOT NULL,
  behavior VARCHAR(30) NOT NULL,
  risk_level VARCHAR(30),
  reason TEXT,
  blocked_by VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 12.2 approval_requests 审批请求表

```sql
CREATE TABLE approval_requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  node_id VARCHAR(100),
  tool_name VARCHAR(100) NOT NULL,
  input_preview TEXT,
  reason TEXT,
  risk_level VARCHAR(30),
  status VARCHAR(30) DEFAULT 'pending',
  user_decision VARCHAR(30),
  decided_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 12.3 trace_steps 增加字段

```sql
ALTER TABLE trace_steps
ADD COLUMN permission_behavior VARCHAR(30) NULL,
ADD COLUMN permission_reason TEXT NULL,
ADD COLUMN approval_id BIGINT NULL;
```

---

## 13. 前端展示设计

### 13.1 节点详情中展示权限结果

节点详情 Drawer 增加：

```text
权限状态：allow / ask / deny
风险等级：low / medium / high / danger
权限原因：xxx
审批状态：pending / approved / rejected
```

### 13.2 Trace 面板展示权限记录

例如：

```text
步骤 4：Markdown 转 Word
工具：markdown_to_docx_tool
权限：allow
原因：该工具只在 reports 目录生成 Word 文件
执行结果：success
```

需要审批：

```text
步骤 6：修改 Word 文档
工具：docx_edit_tool
权限：ask
原因：该工具会修改已有报告内容
状态：等待用户确认
[允许执行] [拒绝执行]
```

被拒绝：

```text
步骤 7：执行 Shell 命令
工具：bash_tool
权限：deny
原因：bash_tool 属于危险工具，系统默认拒绝
状态：permission_denied
```

---

## 14. 财务分析场景中的权限例子

### 14.1 正常生成报告

```text
pdf_parse_tool：allow
financial_extract_tool：allow
financial_risk_tool：allow
report_generate_tool：allow
markdown_to_docx_tool：allow
report_output_tool：allow
```

原因：这些工具只读取上传文件或生成报告文件，风险较低。

### 14.2 修改生成后的 Word 报告

用户输入：

```text
把刚才生成的财务报告改得正式一点，并突出偿债风险
```

工具流：

```text
docx_parse_tool
↓
section_locate_tool
↓
polish_tool
↓
markdown_to_docx_tool
↓
report_output_tool
```

权限：

```text
docx_parse_tool：allow
section_locate_tool：allow
polish_tool：allow
markdown_to_docx_tool：allow
```

如果使用的是直接覆盖原文件：

```text
docx_edit_tool：ask
```

原因：

```text
该工具会修改已有报告内容，需要用户确认。
```

### 14.3 安装依赖

如果 `markdown_to_docx_tool` 缺少依赖：

```text
dependency_install_tool
```

权限：

```text
dependency_install_tool：ask
```

条件：

```text
包名必须在 allowedPackages 白名单中。
```

如果请求安装：

```text
html-to-docx
```

可以 ask。

如果请求安装：

```text
unknown-danger-package
```

直接 deny。

---

## 15. API 设计

### 15.1 查询权限日志

```http
GET /api/runs/:runId/permissions
```

返回：

```json
{
  "code": 200,
  "data": [
    {
      "toolName": "markdown_to_docx_tool",
      "behavior": "allow",
      "riskLevel": "low",
      "reason": "工具通过权限检查，允许执行。"
    }
  ]
}
```

### 15.2 审批请求列表

```http
GET /api/approvals/pending
```

### 15.3 同意审批

```http
POST /api/approvals/:id/approve
```

### 15.4 拒绝审批

```http
POST /api/approvals/:id/reject
```

### 15.5 继续执行

```http
POST /api/runs/:runId/resume
```

---

## 16. 目录结构

建议新增：

```text
src/
├─ permissions/
│  ├─ permissionRules.ts
│  ├─ denyList.ts
│  └─ allowedPackages.ts
│
├─ services/
│  ├─ permission.service.ts
│  ├─ approval.service.ts
│  └─ workflowExecutor.service.ts
│
├─ routes/
│  ├─ approval.routes.ts
│  └─ permission.routes.ts
│
├─ controllers/
│  ├─ approval.controller.ts
│  └─ permission.controller.ts
│
├─ models/
│  ├─ approval.model.ts
│  └─ permissionLog.model.ts
│
└─ utils/
   ├─ safePath.ts
   └─ commandGuard.ts
```

---

## 17. Deny List 设计

创建：

```text
src/permissions/denyList.ts
```

内容：

```ts
export const DENY_COMMAND_PATTERNS = [
  /rm\s+-rf\s+\//,
  /sudo\s+/,
  /chmod\s+777/,
  /cat\s+.*\.env/,
  /type\s+.*\.env/,
  /del\s+\/s/,
  /format\s+/,
  /shutdown\s+/,
  /curl\s+.*\|\s*sh/,
  /wget\s+.*\|\s*sh/
]

export const DENY_PATH_PATTERNS = [
  /\.env$/,
  /node_modules/,
  /\.git/,
  /package-lock\.json$/,
  /pnpm-lock\.yaml$/,
  /yarn\.lock$/
]
```

第一版建议：

```text
bash_tool 默认 deny，不开放执行。
```

---

## 18. 版本规划

### V1.0 必做

```text
1. permissionRules.ts
2. checkPermission()
3. Executor 执行前权限检查
4. permission_logs 表
5. trace_steps 中记录权限结果
6. deny / allow 生效
7. ask 可以先返回 waiting_approval，不一定完整恢复执行
```

### V1.1 增强

```text
1. approval_requests 表
2. 前端审批弹窗
3. approve / reject 接口
4. run resume 继续执行
5. Trace 面板展示审批结果
```

### V2.0 迭代

```text
1. 受控依赖自动安装
2. 工具沙箱隔离
3. Docker 沙箱执行高风险工具
4. 用户自定义权限规则
5. 权限策略导入导出
6. 审批历史审计
```

---

## 19. Codex 最终任务提示词

请基于本任务书，为 TraceMind 后端实现工具权限系统。

要求：

```text
1. 在工具执行前增加 Permission Check。
2. 实现 allow / ask / deny 三种权限行为。
3. 未注册工具、危险工具、越权路径直接 deny。
4. 低风险工具默认 allow。
5. 修改文件、删除文件、安装依赖等高风险操作默认 ask。
6. 权限结果写入 permission_logs。
7. Trace 中展示 permission_behavior、permission_reason、approval_id。
8. 新增 approval_requests 表及基础接口。
9. 第一版 bash_tool 默认 deny。
10. dependency_install_tool 只能安装白名单依赖。
11. 所有文件操作必须限制在 uploads / reports / temp 等项目目录内。
12. 不要让 AI 直接执行系统命令。
13. 不要让 AI 拥有最高权限。
```

优先修改：

```text
src/services/workflowExecutor.service.ts
src/services/permission.service.ts
src/permissions/permissionRules.ts
src/utils/safePath.ts
src/models/permissionLog.model.ts
src/models/approval.model.ts
src/routes/approval.routes.ts
src/routes/permission.routes.ts
```

请先给出修改方案，再生成代码。修改完成后说明：

```text
1. 新增了哪些文件
2. 修改了哪些文件
3. 权限检查如何接入 Executor
4. allow / ask / deny 如何生效
5. Trace 如何记录权限结果
6. 还有哪些 TODO
```

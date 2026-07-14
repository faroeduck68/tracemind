# TraceMind Agent

TraceMind Agent 是一个面向学期项目的智能体工作流平台。系统支持通过自然语言生成工作流，调用文件解析、知识库检索、联网搜索、财务分析、招聘简历分析等工具，并记录每一步执行过程，方便展示智能体从“理解任务”到“调用工具”再到“输出报告”的完整链路。

> 项目定位：教学与课程设计演示项目，重点展示智能体工作流、工具调用、知识库和可解释 Trace，不按生产级系统设计。

## 功能特性

- 自然语言生成工作流：根据用户需求自动生成 DAG 工作流节点和连线。
- 可解释执行 Trace：记录节点输入、输出、耗时、工具选择原因和执行状态。
- 工具库管理：支持内置工具、HTTP API 工具、LLM Prompt 工具和 MCP 占位接入。
- 知识库管理：支持知识库增删改查、文档导入、文本切片和关键词检索。
- 联网搜索：支持阿里云 OpenSearch、Tavily、Brave、SerpAPI、Bing 等搜索服务。
- 文件分析：支持 PDF、TXT、Markdown、CSV 等文本类文件解析。
- 财务分析：可对财报文本进行指标提取、风险分析和报告输出。
- 招聘分析：支持多份简历解析、岗位要求提取、匹配度评分、候选人排序和招聘分析报告。
- 分页能力：主要列表接口支持 `page` / `pageSize` 分页参数。
- Docker 数据库：提供 MySQL 8 的 Docker Compose 启动方案，前后端使用本地开发命令启动。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vite、TypeScript、Vue Flow、Lucide Icons |
| 后端 | Node.js、Express、TypeScript |
| 数据库 | MySQL 8 |
| 大模型 | DeepSeek API，兼容 OpenAI SDK 调用方式 |
| 联网搜索 | 阿里云 OpenSearch，可选 Tavily / Brave / SerpAPI / Bing |
| 文件解析 | pdf-parse、文本文件解析 |
| 数据库容器 | Docker、Docker Compose、MySQL 8 |

## 项目结构

```text
tracemind/
├── backend/                 # Express + TypeScript 后端
│   ├── src/controllers/     # 接口控制器
│   ├── src/services/        # 业务服务层
│   ├── src/models/          # MySQL 数据访问层
│   ├── src/tools/           # 智能体可调用工具
│   ├── src/database/        # schema.sql / seed.sql
│   └── Dockerfile
├── frontend/                # Vue + Vite 前端
│   ├── src/
│   ├── nginx.conf
│   └── Dockerfile
├── demo/                    # 演示文件，例如招聘简历样例
├── docs/                    # 架构和 Docker 文档
├── docker-compose.yml
└── README.md
```

## 环境变量

后端环境变量放在：

```text
backend/.env
```

请不要把真实 Key 上传到 GitHub。仓库中只应提交 `.env.example`。

最小配置示例：

```env
PORT=4000
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASSWORD=123456
DB_NAME=tracemind
CORS_ORIGIN=http://localhost:5173

OPENAI_API_KEY=your_deepseek_api_key
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat

MOCK_MODE=false
ALLOW_MOCK_FALLBACK=false
USE_REAL_LLM=true
USE_REAL_FILE_PARSE=true
USE_REAL_DOCX_EXPORT=false

WEB_SEARCH_PROVIDER=aliyun
ALIYUN_OPENSEARCH_API_KEY=your_aliyun_opensearch_key
ALIYUN_OPENSEARCH_ENDPOINT=https://default-xxxx.platform-cn-shanghai.opensearch.aliyuncs.com
ALIYUN_OPENSEARCH_WORKSPACE=default
```

## 本地开发启动

### 1. 初始化数据库

可以直接用 Docker 启动 MySQL：

```powershell
docker compose up -d
```

Docker 中 MySQL 暴露在 `localhost:3307`。如果使用 Docker 数据库，本地 `backend/.env` 建议设置：

```env
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASSWORD=123456
DB_NAME=tracemind
```

首次创建数据库卷时，Docker 会自动执行：

```text
backend/src/database/schema.sql
backend/src/database/seed.sql
```

如果不用 Docker，也可以自己创建 MySQL 数据库并导入表结构和种子数据：

```powershell
cd backend
npm install
npm run db:schema
npm run db:seed
```

如需写入演示知识库和招聘分析演示数据：

```powershell
npm run db:seed-knowledge-demo
npm run db:seed-recruitment-demo
npm run db:seed-workflow-demo
```

### 2. 启动后端

```powershell
cd backend
npm run dev
```

默认后端地址：

```text
http://localhost:4000
```

### 3. 启动前端

```powershell
cd frontend
npm install
npm run dev
```

默认前端地址：

```text
http://localhost:5173
```

## Docker 启动

项目的 Docker Compose 现在只启动 MySQL 数据库。后端和前端请使用本地 `npm run dev` 启动。

```powershell
docker compose up -d
```

当前默认端口：

| 服务 | 地址 |
| --- | --- |
| MySQL | localhost:3307 |

说明：

- MySQL 数据保存在 Docker volume：`tracemind_tracemind-mysql-data`。
- `docker compose down` 不会删除数据库数据。
- `docker compose down -v` 会删除数据库 volume 并清空数据。
- DeepSeek 和阿里云 Key 仍然放在本地 `backend/.env`，不会写入 Docker 镜像或提交到 GitHub。

更多说明见：[docs/DOCKER.md](docs/DOCKER.md)。

## 常用脚本

### 后端

```powershell
cd backend
npm run dev                  # 开发模式启动
npm run build                # TypeScript 构建
npm run test:web-search -- "Shanghai weather today"
npm run test:workflow-routing
npm run db:seed-knowledge-demo
npm run db:seed-recruitment-demo
npm run db:seed-workflow-demo
```

### 前端

```powershell
cd frontend
npm run dev
npm run build
npm run preview
```

## 联网搜索配置

推荐使用阿里云 OpenSearch：

```env
WEB_SEARCH_PROVIDER=aliyun
ALIYUN_OPENSEARCH_API_KEY=your_key
ALIYUN_OPENSEARCH_ENDPOINT=https://default-xxxx.platform-cn-shanghai.opensearch.aliyuncs.com
ALIYUN_OPENSEARCH_WORKSPACE=default
```

也可以使用其他搜索服务：

| Provider | 环境变量 |
| --- | --- |
| Tavily | `TAVILY_API_KEY` |
| Brave Search | `BRAVE_SEARCH_API_KEY` |
| SerpAPI | `SERPAPI_API_KEY` |
| Bing Web Search | `BING_SEARCH_API_KEY` |

测试联网搜索：

```powershell
cd backend
npm run test:web-search -- "Shanghai weather today"
```

## 招聘分析演示

演示流程：

```text
上传多份简历
→ 提取学历、技能、经历
→ 读取岗位要求
→ 计算匹配度
→ 生成候选人排序
→ 输出招聘分析报告
```

示例文件位于：

```text
demo/recruitment/
```

可使用类似提示词：

```text
请分析这些简历，招聘 Java 开发工程师，要求本科及以上，3年工作经验，掌握 Java、Spring Boot、MySQL、Redis，熟悉 Docker 者优先，生成候选人排序和招聘分析报告。
```

## 知识库说明

知识库支持：

- 创建、编辑、删除知识库
- 导入文本或文件
- 文档切片
- 根据关键词检索相关片段
- 工作流中通过 `knowledge_search_tool` 调用知识库

当前检索以关键词匹配为主。`fulltext`、`hybrid`、`vector` 模式会回退到 keyword 检索，适合作为课程项目演示，不是真正的向量数据库实现。

## 注意事项

- 不要提交 `backend/.env`、真实 API Key、数据库密码等敏感信息。
- 当前 Word 导出工具仍是演示版 mock 输出，不是真正生成 `.docx` 文件。
- 本项目默认没有用户登录体系，`X-User-Id` 仅作为演示隔离字段。
- 如果 Docker 拉镜像失败，优先检查 Docker Desktop 的 registry mirror 配置。
- 如果本机已有 MySQL，Docker Compose 已默认避让端口：MySQL 使用 `3307`。

## License

本项目用于课程设计和学习展示，可根据学校项目要求自行补充许可证。

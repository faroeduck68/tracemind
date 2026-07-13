# TraceMind Docker 启动说明

## 1. 准备环境变量

Docker Compose 会读取 `backend/.env` 中的 DeepSeek 和阿里云配置。请确认至少包含：

```env
OPENAI_API_KEY=你的DeepSeekKey
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat

WEB_SEARCH_PROVIDER=aliyun
ALIYUN_OPENSEARCH_API_KEY=你的阿里云OpenSearchKey
ALIYUN_OPENSEARCH_ENDPOINT=https://default-kr6f.platform-cn-shanghai.opensearch.aliyuncs.com
ALIYUN_OPENSEARCH_WORKSPACE=default
```

这些 Key 不会写入镜像，只在容器启动时通过环境变量注入。

## 2. 启动

在项目根目录执行：

```powershell
docker compose up --build
```

访问：

```text
前端：http://localhost:5173
后端健康检查：http://localhost:4001/health
MySQL：localhost:3307
```

首次启动时，MySQL 会自动执行：

```text
backend/src/database/schema.sql
backend/src/database/seed.sql
```

## 3. 常用命令

后台启动：

```powershell
docker compose up -d --build
```

查看日志：

```powershell
docker compose logs -f backend
```

停止服务：

```powershell
docker compose down
```

清空数据库并重新初始化：

```powershell
docker compose down -v
docker compose up --build
```

## 4. 可选 Demo 数据

如果需要重新写入招聘分析或知识库演示数据：

```powershell
docker compose exec backend npm run db:seed-knowledge-demo
docker compose exec backend npm run db:seed-recruitment-demo
```

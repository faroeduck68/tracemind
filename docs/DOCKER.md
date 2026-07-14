# TraceMind Docker 数据库说明

当前 Docker Compose 只负责启动 MySQL 数据库。后端和前端使用本地开发命令启动，方便课程项目调试代码。

## 1. 启动数据库

在项目根目录执行：

```powershell
docker compose up -d
```

默认连接信息：

```text
Host: 127.0.0.1
Port: 3307
User: root
Password: 123456
Database: tracemind
```

首次启动并创建数据卷时，MySQL 会自动执行：

```text
backend/src/database/schema.sql
backend/src/database/seed.sql
```

## 2. 后端连接配置

本地后端的 `backend/.env` 建议使用：

```env
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASSWORD=123456
DB_NAME=tracemind
```

DeepSeek 和阿里云 OpenSearch 的 Key 仍然只放在 `backend/.env`，不要提交到 GitHub。

## 3. 常用命令

查看状态：

```powershell
docker compose ps
```

查看 MySQL 日志：

```powershell
docker compose logs -f mysql
```

停止数据库：

```powershell
docker compose down
```

清空数据库并重新初始化：

```powershell
docker compose down -v
docker compose up -d
```

进入 MySQL：

```powershell
docker exec -it tracemind-mysql mysql -uroot -p123456 --default-character-set=utf8mb4 tracemind
```

## 4. 补充 Demo 数据

数据库容器启动后，在本地后端目录执行：

```powershell
cd backend
npm run db:seed-knowledge-demo
npm run db:seed-recruitment-demo
npm run db:seed-workflow-demo
```

如果使用 Docker 数据库，执行这些脚本前请确认 `backend/.env` 中的 `DB_PORT=3307`。

import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env'
import { registerDefaultHooks } from './hooks/defaultHooks'
import { errorMiddleware } from './middlewares/error.middleware'
import { notFoundMiddleware } from './middlewares/notFound.middleware'
import { chatRouter } from './routes/chat.routes'
import { conversationRouter } from './routes/conversation.routes'
import { fileRouter } from './routes/file.routes'
import { knowledgeRouter } from './routes/knowledge.routes'
import { llmRouter } from './routes/llm.routes'
import { memoryRouter } from './routes/memory.routes'
import { settingRouter } from './routes/setting.routes'
import { templateRouter } from './routes/template.routes'
import { toolRouter } from './routes/tool.routes'
import { traceRouter } from './routes/trace.routes'
import { workflowRouter } from './routes/workflow.routes'

export const app = express()
registerDefaultHooks()

app.use(helmet())
app.use(cors({ origin: env.corsOrigin, credentials: true }))
app.use(express.json({ limit: '5mb' }))
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'))

app.get('/health', (_req, res) => {
  res.json({ code: 200, message: 'ok', data: { service: 'tracemind-backend' } })
})

app.use('/api/workflows', workflowRouter)
app.use('/api/conversations', conversationRouter)
app.use('/api/chat', chatRouter)
app.use('/api/llm', llmRouter)
app.use('/api/runs', traceRouter)
app.use('/api/files', fileRouter)
app.use('/api/tools', toolRouter)
app.use('/api/templates', templateRouter)
app.use('/api/knowledge-bases', knowledgeRouter)
app.use('/api/memories', memoryRouter)
app.use('/api/settings', settingRouter)

app.use(notFoundMiddleware)
app.use(errorMiddleware)

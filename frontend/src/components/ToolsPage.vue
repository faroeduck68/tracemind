<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  AlertTriangle,
  ArrowLeft,
  Braces,
  CheckCircle2,
  ChevronDown,
  Code2,
  Eye,
  Gauge,
  Globe2,
  MessageSquareText,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ServerCog,
  Sparkles,
  TrendingUp,
  X
} from 'lucide-vue-next'
import PaginationBar from './PaginationBar.vue'
import { usePagination } from '../composables/usePagination'

const props = defineProps<{
  toolSearch: string
  toolStats: any[]
  toolCategories: string[]
  activeToolCategory: string
  activeToolStatus: string
  filteredTools: any[]
  tools: any[]
  mcpServers: any[]
  secrets: any[]
}>()

const toolSource = computed(() => props.filteredTools)
const mcpSource = computed(() => props.mcpServers)
const {
  page: toolPage,
  pageSize: toolPageSize,
  total: toolTotal,
  paginatedItems: paginatedTools,
  setPage: setToolPage,
  setPageSize: setToolPageSize,
  resetPage: resetToolPage
} = usePagination(toolSource, 10)
const {
  page: mcpPage,
  pageSize: mcpPageSize,
  total: mcpTotal,
  paginatedItems: paginatedMcpServers,
  setPage: setMcpPage,
  setPageSize: setMcpPageSize
} = usePagination(mcpSource, 5)

watch(() => [props.toolSearch, props.activeToolCategory, props.activeToolStatus], resetToolPage)

const emit = defineEmits<{
  (event: 'update:toolSearch', value: string): void
  (event: 'update:activeToolCategory', value: string): void
  (event: 'cycleToolStatus'): void
  (event: 'refresh'): void
  (event: 'notify', message: string): void
  (event: 'toggleTool', tool: any): void
  (event: 'createMcpServer', payload: unknown, done?: (result: any) => void): void
  (event: 'toggleMcpServer', server: any): void
  (event: 'testMcpServer', server: any, done?: (result: any) => void): void
  (event: 'syncMcpServerTools', server: any, done?: (result: any) => void): void
  (event: 'createTool', payload: unknown, done?: (result: any) => void): void
  (event: 'updateTool', id: number | string, payload: unknown, done?: (result: any) => void): void
  (event: 'checkToolName', name: string, done?: (result: any) => void): void
  (event: 'testDraftTool', payload: unknown, done?: (result: any) => void): void
  (event: 'saveSecret', payload: { name: string; provider?: string; value: string }, done?: (result: any) => void): void
  (event: 'deleteSecret', name: string, done?: (result: any) => void): void
  (event: 'refreshSecrets'): void
}>()

type ToolKind = 'http' | 'llm' | 'builtin'
type ModalMode = 'create_blank' | 'create_from_template' | 'edit_existing'
type ModalStep = 'choose_type' | 'configure'
type HttpTemplateKey = 'custom' | 'weather' | 'stock' | 'express' | 'news'
type AuthMode = 'none' | 'platform' | 'user'

type ToolForm = {
  type: ToolKind
  name: string
  displayName: string
  description: string
  enabled: boolean
  riskLevel: string
  method: string
  endpoint: string
  apiKeyEnvName: string
  authMode: AuthMode
  authKeyName: string
  authIn: 'query' | 'header'
  secretName: string
  secretProvider: string
  secretValue: string
  allowSecretFallback: boolean
  headersJson: string
  queryParamsJson: string
  bodyTemplateJson: string
  inputMappingJson: string
  outputMappingJson: string
  inputSchemaJson: string
  outputSchemaJson: string
  authConfigJson: string
  promptTemplate: string
  responseFormat: 'json' | 'text'
  temperature: number
  testInputJson: string
}

type BuiltinDraft = {
  enabled: boolean
  displayName: string
  description: string
  riskLevel: string
}

const toolTypeOptions = [
  {
    value: 'http' as ToolKind,
    title: 'HTTP API 工具',
    description: '用于天气、股票、快递、新闻等外部接口。',
    icon: Globe2
  },
  {
    value: 'llm' as ToolKind,
    title: 'LLM Prompt 工具',
    description: '用于总结、润色、分类、信息抽取等文本任务。',
    icon: MessageSquareText
  },
  {
    value: 'builtin' as ToolKind,
    title: '内置工具',
    description: '启用或配置后端已有代码工具。',
    icon: ServerCog
  }
]

const httpTemplates = [
  { key: 'weather' as HttpTemplateKey, label: '天气查询工具', description: '根据城市查询实时天气' },
  { key: 'stock' as HttpTemplateKey, label: '股票查询工具', description: '根据股票代码查询行情' },
  { key: 'express' as HttpTemplateKey, label: '快递查询工具', description: '根据单号查询物流进度' },
  { key: 'news' as HttpTemplateKey, label: '新闻搜索工具', description: '根据关键词查询新闻' },
  { key: 'custom' as HttpTemplateKey, label: '自定义 HTTP API', description: '从空白配置开始' }
]

const builtinToolDefinitions = [
  {
    name: 'web_search_tool',
    displayName: '网页搜索工具',
    description: '搜索互联网实时信息，返回受限长度的摘要与来源链接。'
  },
  {
    name: 'pdf_parse_tool',
    displayName: 'PDF解析工具',
    description: '解析 PDF 文件，提取文本、页码和基础结构。'
  },
  {
    name: 'financial_extract_tool',
    displayName: '财务指标提取工具',
    description: '从财报或财务文本中提取营收、利润、现金流等指标。'
  },
  {
    name: 'report_output_tool',
    displayName: '报告输出工具',
    description: '把分析结果整理为面向用户的报告输出。'
  },
  {
    name: 'markdown_to_docx_tool',
    displayName: 'Word导出工具',
    description: '将 Markdown 报告转换为可下载的 Word 文档。'
  }
]

const modalOpen = ref(false)
const modalMode = ref<ModalMode>('create_blank')
const modalStep = ref<ModalStep>('choose_type')
const selectedToolType = ref<ToolKind | null>(null)
const editingToolId = ref<number | string | null>(null)
const httpTemplate = ref<HttpTemplateKey>('custom')
const saving = ref(false)
const testing = ref(false)
const savingSecret = ref(false)
const savingBuiltinName = ref('')
const testResult = ref<any | null>(null)
const nameConflict = ref<{ name: string; suggestedName: string; tool: any | null } | null>(null)
const builtinDrafts = ref<Record<string, BuiltinDraft>>({})
const form = ref<ToolForm>(blankForm())
const mcpSaving = ref(false)
const mcpBusyServerId = ref<number | string | null>(null)
const mcpResult = ref<any | null>(null)
const mcpForm = ref({
  name: '',
  displayName: '',
  endpoint: '',
  transport: 'http'
})

const selectedSecret = computed(() => props.secrets.find((secret) => secret.name === form.value.secretName))

const modalTitle = computed(() => {
  if (modalMode.value === 'edit_existing') return '编辑工具'
  if (modalStep.value === 'choose_type') return '添加工具'
  return selectedToolType.value === 'builtin' ? '配置内置工具' : '配置新工具'
})

const modalSubtitle = computed(() => {
  if (modalStep.value === 'choose_type') return '先选择工具类型，再进入对应配置表单。'
  if (selectedToolType.value === 'http') return 'HTTP 工具可以先用草稿测试，测试不会写入数据库。'
  if (selectedToolType.value === 'llm') return 'LLM Prompt 工具只需要配置提示词、输出格式和测试输入。'
  return '内置工具来自后端代码注册表，只允许启用、禁用和调整展示配置。'
})

const builtinTools = computed(() =>
  builtinToolDefinitions.map((definition) => {
    const tool = props.tools.find((item) => item.name === definition.name)
    return {
      ...definition,
      tool,
      exists: Boolean(tool?.id)
    }
  })
)

watch(
  () => props.tools,
  () => {
    const next = { ...builtinDrafts.value }
    for (const item of builtinToolDefinitions) {
      const tool = props.tools.find((row) => row.name === item.name)
      next[item.name] = {
        enabled: tool ? Boolean(tool.enabled) : false,
        displayName: String(tool?.displayName ?? item.displayName),
        description: String(tool?.description ?? tool?.desc ?? item.description),
        riskLevel: String(tool?.riskLevel ?? 'low')
      }
    }
    builtinDrafts.value = next
  },
  { immediate: true, deep: true }
)

function blankForm(type: ToolKind = 'http'): ToolForm {
  return {
    type,
    name: '',
    displayName: '',
    description: '',
    enabled: true,
    riskLevel: 'low',
    method: 'GET',
    endpoint: '',
    apiKeyEnvName: '',
    authMode: 'none',
    authKeyName: 'key',
    authIn: 'query',
    secretName: '',
    secretProvider: '',
    secretValue: '',
    allowSecretFallback: true,
    headersJson: '{}',
    queryParamsJson: '{}',
    bodyTemplateJson: '{}',
    inputMappingJson: '{}',
    outputMappingJson: '{}',
    inputSchemaJson: '{}',
    outputSchemaJson: '{}',
    authConfigJson: '{\n  "type": "none"\n}',
    promptTemplate: '',
    responseFormat: 'json',
    temperature: 0.2,
    testInputJson: '{}'
  }
}

function openToolModal() {
  resetModal()
  emit('refreshSecrets')
  modalOpen.value = true
}

function closeToolModal() {
  modalOpen.value = false
}

function resetModal() {
  modalMode.value = 'create_blank'
  modalStep.value = 'choose_type'
  selectedToolType.value = null
  editingToolId.value = null
  httpTemplate.value = 'custom'
  saving.value = false
  testing.value = false
  savingSecret.value = false
  testResult.value = null
  nameConflict.value = null
  form.value = blankForm()
}

function chooseToolType(type: ToolKind) {
  selectedToolType.value = type
  modalStep.value = 'configure'
  modalMode.value = 'create_blank'
  editingToolId.value = null
  nameConflict.value = null
  testResult.value = null
  httpTemplate.value = 'custom'
  form.value = blankForm(type)
  if (type === 'llm') {
    form.value.testInputJson = '{\n  "text": ""\n}'
  }
}

function returnToTypeChoice() {
  modalStep.value = 'choose_type'
  selectedToolType.value = null
  nameConflict.value = null
  testResult.value = null
  form.value = blankForm()
}

function onTemplateChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as HttpTemplateKey
  applyHttpTemplate(value)
}

function applyHttpTemplate(templateKey: HttpTemplateKey) {
  httpTemplate.value = templateKey
  selectedToolType.value = 'http'
  nameConflict.value = null
  testResult.value = null

  if (templateKey === 'custom') {
    modalMode.value = 'create_blank'
    form.value = blankForm('http')
    return
  }

  modalMode.value = 'create_from_template'
  const template = createHttpTemplateForm(templateKey)
  form.value = { ...blankForm('http'), ...template }
}

function createHttpTemplateForm(templateKey: HttpTemplateKey): Partial<ToolForm> {
  if (templateKey === 'weather') {
    return {
      name: 'weather_query_tool',
      displayName: '天气查询工具',
      description: '根据城市查询实时天气。',
      endpoint: 'https://restapi.amap.com/v3/weather/weatherInfo',
      apiKeyEnvName: 'AMAP_API_KEY',
      authMode: 'user',
      authKeyName: 'key',
      authIn: 'query',
      secretName: 'AMAP_API_KEY',
      secretProvider: 'amap',
      allowSecretFallback: true,
      queryParamsJson: '{\n  "city": "{{input.city}}",\n  "extensions": "base"\n}',
      outputMappingJson: '{\n  "city": "lives[0].city",\n  "province": "lives[0].province",\n  "weather": "lives[0].weather",\n  "temperature": "lives[0].temperature",\n  "winddirection": "lives[0].winddirection",\n  "windpower": "lives[0].windpower",\n  "humidity": "lives[0].humidity",\n  "reporttime": "lives[0].reporttime"\n}',
      inputSchemaJson: '{\n  "city": {\n    "type": "string",\n    "required": true\n  }\n}',
      outputSchemaJson: '{\n  "city": "string",\n  "province": "string",\n  "weather": "string",\n  "temperature": "string",\n  "winddirection": "string",\n  "windpower": "string",\n  "humidity": "string",\n  "reporttime": "string"\n}',
      authConfigJson: '{\n  "type": "apiKey",\n  "keyName": "key",\n  "in": "query",\n  "value": "userSecret:AMAP_API_KEY",\n  "fallback": true\n}',
      testInputJson: '{\n  "city": "芜湖"\n}'
    }
  }

  if (templateKey === 'stock') {
    return {
      name: 'stock_quote_tool',
      displayName: '股票查询工具',
      description: '根据股票代码查询实时或延迟行情。',
      queryParamsJson: '{\n  "symbol": "{{input.symbol}}"\n}',
      inputSchemaJson: '{\n  "symbol": {\n    "type": "string",\n    "required": true\n  }\n}',
      outputSchemaJson: '{\n  "price": "string",\n  "change": "string",\n  "updatedAt": "string"\n}',
      testInputJson: '{\n  "symbol": "AAPL"\n}'
    }
  }

  if (templateKey === 'express') {
    return {
      name: 'express_tracking_tool',
      displayName: '快递查询工具',
      description: '根据快递单号查询物流进度。',
      queryParamsJson: '{\n  "trackingNo": "{{input.trackingNo}}"\n}',
      inputSchemaJson: '{\n  "trackingNo": {\n    "type": "string",\n    "required": true\n  }\n}',
      outputSchemaJson: '{\n  "status": "string",\n  "latestEvent": "string",\n  "updatedAt": "string"\n}',
      testInputJson: '{\n  "trackingNo": ""\n}'
    }
  }

  return {
    name: 'news_search_tool',
    displayName: '新闻搜索工具',
    description: '根据关键词搜索新闻结果。',
    queryParamsJson: '{\n  "q": "{{input.keyword}}"\n}',
    inputSchemaJson: '{\n  "keyword": {\n    "type": "string",\n    "required": true\n  }\n}',
    outputSchemaJson: '{\n  "items": "array"\n}',
    testInputJson: '{\n  "keyword": "AI"\n}'
  }
}

async function saveMcpServer() {
  const name = mcpForm.value.name.trim()
  const endpoint = mcpForm.value.endpoint.trim()
  if (!name || !endpoint) {
    emit('notify', '请填写 MCP Server 名称和 endpoint')
    return
  }

  mcpSaving.value = true
  const result = await new Promise<any>((resolve) => {
    emit(
      'createMcpServer',
      {
        name,
        displayName: mcpForm.value.displayName.trim() || name,
        endpoint,
        transport: mcpForm.value.transport,
        enabled: true
      },
      resolve
    )
  })
  mcpSaving.value = false
  mcpResult.value = result

  if (result?.error) {
    emit('notify', result.error)
    return
  }

  mcpForm.value = { name: '', displayName: '', endpoint: '', transport: 'http' }
}

async function testMcp(server: any) {
  mcpBusyServerId.value = server.id
  const result = await new Promise<any>((resolve) => {
    emit('testMcpServer', server, resolve)
  })
  mcpBusyServerId.value = null
  mcpResult.value = result
}

async function syncMcpTools(server: any) {
  mcpBusyServerId.value = server.id
  const result = await new Promise<any>((resolve) => {
    emit('syncMcpServerTools', server, resolve)
  })
  mcpBusyServerId.value = null
  mcpResult.value = result
}

async function saveTool() {
  if (selectedToolType.value === 'builtin') return

  let payload: any
  try {
    payload = buildToolPayload()
  } catch (error) {
    emit('notify', error instanceof Error ? error.message : '工具配置不是合法 JSON')
    return
  }

  if (modalMode.value !== 'edit_existing') {
    const check = await checkNameAvailability(payload.name)
    if (check?.error) {
      emit('notify', check.error)
      return
    }
    if (check?.exists) {
      nameConflict.value = {
        name: payload.name,
        suggestedName: suggestToolName(payload.name),
        tool: check.tool ?? null
      }
      emit('notify', `工具名 ${payload.name} 已存在。`)
      return
    }
  }

  saving.value = true
  const result = await new Promise<any>((resolve) => {
    if (modalMode.value === 'edit_existing' && editingToolId.value) {
      emit('updateTool', editingToolId.value, payload, resolve)
    } else {
      emit('createTool', payload, resolve)
    }
  })
  saving.value = false

  if (result?.error) {
    if (String(result.error).includes('工具名已存在')) {
      nameConflict.value = {
        name: payload.name,
        suggestedName: suggestToolName(payload.name),
        tool: null
      }
    }
    testResult.value = result
    return
  }

  closeToolModal()
}

async function testCurrentTool() {
  if (selectedToolType.value === 'builtin') return

  let payload: unknown
  try {
    payload = buildDraftPayload()
  } catch (error) {
    emit('notify', error instanceof Error ? error.message : '测试输入不是合法 JSON')
    return
  }

  testing.value = true
  const result = await new Promise<any>((resolve) => {
    emit('testDraftTool', payload, resolve)
  })
  testing.value = false
  testResult.value = result
  emit('notify', result?.success ? '草稿测试成功' : result?.error ?? '草稿测试失败')
}

async function saveCurrentSecret() {
  const name = form.value.secretName.trim()
  const value = form.value.secretValue.trim()
  if (!name) {
    emit('notify', '请先填写 Secret 名称')
    return
  }
  if (!value) {
    emit('notify', '请填写你的真实 API Key')
    return
  }

  savingSecret.value = true
  const result = await new Promise<any>((resolve) => {
    emit(
      'saveSecret',
      {
        name,
        provider: form.value.secretProvider.trim() || undefined,
        value
      },
      resolve
    )
  })
  savingSecret.value = false

  if (result?.error) {
    emit('notify', result.error)
    return
  }
  form.value.secretValue = ''
  emit('notify', '我的 Key 已保存')
}

async function deleteCurrentSecret() {
  const name = form.value.secretName.trim()
  if (!name) return
  const result = await new Promise<any>((resolve) => {
    emit('deleteSecret', name, resolve)
  })
  if (result?.error) emit('notify', result.error)
}

async function saveBuiltinTool(item: any) {
  const tool = item.tool
  const draft = builtinDrafts.value[item.name]
  if (!tool?.id || !draft) {
    emit('notify', '该内置工具尚未入库，请先由后端初始化工具记录。')
    return
  }

  savingBuiltinName.value = item.name
  const result = await new Promise<any>((resolve) => {
    emit(
      'updateTool',
      tool.id,
      {
        type: 'builtin',
        category: '内置工具',
        enabled: draft.enabled,
        displayName: draft.displayName,
        description: draft.description,
        riskLevel: draft.riskLevel
      },
      resolve
    )
  })
  savingBuiltinName.value = ''

  if (result?.error) {
    emit('notify', result.error)
    return
  }
  emit('notify', '内置工具配置已更新')
}

function buildToolPayload() {
  const type = selectedToolType.value ?? form.value.type
  const name = form.value.name.trim()
  if (!name) throw new Error('工具名不能为空')
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) throw new Error('工具名只能使用英文字母、数字和下划线，并且必须以字母开头')

  const inputSchema = parseJsonField(form.value.inputSchemaJson, '输入字段 inputSchema')
  const outputSchema = parseJsonField(form.value.outputSchemaJson, '输出字段 outputSchema')

  return {
    name,
    displayName: form.value.displayName.trim() || name,
    type,
    category: type === 'http' ? 'HTTP API' : type === 'llm' ? '内容生成' : '内置工具',
    description: form.value.description.trim(),
    enabled: true,
    riskLevel: form.value.riskLevel,
    inputSchema,
    outputSchema,
    configJson: buildConfigJson(type),
    authConfig: type === 'http' ? buildAuthConfig() : { type: 'none' }
  }
}

function buildDraftPayload() {
  const payload = buildToolPayload()
  const testInput = parseJsonField(form.value.testInputJson, '测试输入 JSON')
  return {
    type: payload.type,
    name: payload.name,
    displayName: payload.displayName,
    description: payload.description,
    riskLevel: payload.riskLevel,
    inputSchema: payload.inputSchema,
    outputSchema: payload.outputSchema,
    config: payload.configJson,
    authConfig: payload.authConfig,
    testInput
  }
}

function buildConfigJson(type: ToolKind) {
  if (type === 'http') {
    return {
      method: form.value.method,
      endpoint: form.value.endpoint.trim(),
      headers: parseJsonField(form.value.headersJson, 'headers'),
      queryParams: parseJsonField(form.value.queryParamsJson, 'queryParams'),
      bodyTemplate: parseJsonField(form.value.bodyTemplateJson, 'bodyTemplate'),
      inputMapping: parseJsonField(form.value.inputMappingJson, 'inputMapping'),
      outputMapping: parseJsonField(form.value.outputMappingJson, 'outputMapping')
    }
  }

  if (type === 'llm') {
    return {
      promptTemplate: form.value.promptTemplate.trim(),
      responseFormat: form.value.responseFormat,
      temperature: Number(form.value.temperature)
    }
  }

  return {}
}

function buildAuthConfig() {
  const auth = parseJsonField(form.value.authConfigJson, 'authConfig') as Record<string, unknown>
  const authMode = form.value.authMode
  if (authMode === 'none') return { type: 'none' }

  const keyName = form.value.authKeyName.trim() || String(auth.keyName ?? 'key')
  const target = form.value.authIn === 'header' ? 'header' : 'query'

  if (authMode === 'platform') {
    const envName = form.value.apiKeyEnvName.trim()
    if (!envName) throw new Error('请填写平台 Key 环境变量名')
    return {
      ...auth,
      type: 'apiKey',
      keyName,
      in: target,
      value: `env:${envName}`
    }
  }

  const secretName = form.value.secretName.trim()
  if (!secretName) throw new Error('请填写用户 Secret 名称')
  return {
    ...auth,
    type: 'apiKey',
    keyName,
    in: target,
    value: `userSecret:${secretName}`,
    fallback: form.value.allowSecretFallback
  }
}

async function checkNameAvailability(name: string) {
  return new Promise<any>((resolve) => {
    emit('checkToolName', name, resolve)
  })
}

function openEditTool(tool: any) {
  const rawTool = tool.raw ?? tool
  const type = String(rawTool.type ?? tool.toolKind ?? '')
  if (type === 'mcp') {
    emit('notify', 'MCP 工具由 MCP Server 同步维护，第一阶段暂不支持手动编辑。')
    return
  }
  if (!tool?.id && !rawTool?.id) {
    emit('notify', '无法读取工具 ID，请刷新工具库后重试。')
    return
  }

  emit('refreshSecrets')
  fillFormFromTool(rawTool)
  modalMode.value = 'edit_existing'
  editingToolId.value = rawTool.id ?? tool.id
  nameConflict.value = null
  testResult.value = null
  modalOpen.value = true
}

function editExistingTool() {
  const tool = nameConflict.value?.tool
  if (!tool?.id) {
    emit('notify', '无法读取已有工具详情，请刷新工具库后重试。')
    return
  }
  fillFormFromTool(tool)
  modalMode.value = 'edit_existing'
  editingToolId.value = tool.id
  nameConflict.value = null
  testResult.value = null
}

function saveAsSuggestedName() {
  if (!nameConflict.value) return
  form.value.name = nameConflict.value.suggestedName
  nameConflict.value = null
  modalMode.value = httpTemplate.value === 'custom' ? 'create_blank' : 'create_from_template'
}

function fillFormFromTool(tool: any) {
  const type = normalizeToolKind(tool.type ?? tool.toolKind)
  const config = parseMaybeJson(tool.configJson ?? tool.config_json ?? tool.config ?? {}, {})
  const auth = parseMaybeJson(tool.authConfig ?? tool.auth_config ?? {}, {})
  selectedToolType.value = type
  modalStep.value = 'configure'
  httpTemplate.value = 'custom'

  form.value = {
    ...blankForm(type),
    name: String(tool.name ?? ''),
    displayName: String(tool.displayName ?? tool.display_name ?? tool.name ?? ''),
    description: String(tool.description ?? tool.desc ?? ''),
    enabled: tool.enabled === true || tool.enabled === 1,
    riskLevel: String(tool.riskLevel ?? tool.risk_level ?? 'low'),
    method: String(config.method ?? 'GET'),
    endpoint: String(config.endpoint ?? ''),
    apiKeyEnvName: extractEnvName(auth.value),
    authMode: readAuthMode(auth.value),
    authKeyName: String(auth.keyName ?? 'key'),
    authIn: auth.in === 'header' ? 'header' : 'query',
    secretName: extractUserSecretName(auth.value),
    secretProvider: '',
    secretValue: '',
    allowSecretFallback: auth.fallback !== false,
    headersJson: stringifyJsonField(config.headers ?? {}),
    queryParamsJson: stringifyJsonField(config.queryParams ?? {}),
    bodyTemplateJson: stringifyJsonField(config.bodyTemplate ?? {}),
    inputMappingJson: stringifyJsonField(config.inputMapping ?? {}),
    outputMappingJson: stringifyJsonField(config.outputMapping ?? {}),
    inputSchemaJson: stringifyJsonField(tool.inputSchema ?? tool.input_schema ?? {}),
    outputSchemaJson: stringifyJsonField(tool.outputSchema ?? tool.output_schema ?? {}),
    authConfigJson: stringifyJsonField(auth && typeof auth === 'object' ? auth : { type: 'none' }),
    promptTemplate: String(config.promptTemplate ?? ''),
    responseFormat: config.responseFormat === 'text' ? 'text' : 'json',
    temperature: Number(config.temperature ?? 0.2),
    testInputJson: type === 'llm' ? '{\n  "text": ""\n}' : '{}'
  }
}

function suggestToolName(baseName: string) {
  const existing = new Set(props.tools.map((tool) => String(tool.name)))
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${baseName}_${index}`
    if (!existing.has(candidate)) return candidate
  }
  return `${baseName}_${Date.now().toString(36).slice(-4)}`
}

function parseJsonField(value: string, label: string) {
  try {
    return value.trim() ? JSON.parse(value) : {}
  } catch {
    throw new Error(`${label} 不是合法 JSON`)
  }
}

function parseMaybeJson(value: unknown, fallback: Record<string, unknown>) {
  if (!value) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      return fallback
    }
  }
  return typeof value === 'object' ? (value as Record<string, unknown>) : fallback
}

function stringifyJsonField(value: unknown) {
  return JSON.stringify(parseMaybeJson(value, {}), null, 2)
}

function normalizeToolKind(value: unknown): ToolKind {
  return value === 'http' || value === 'llm' || value === 'builtin' ? value : 'builtin'
}

function extractEnvName(value: unknown) {
  const text = typeof value === 'string' ? value : ''
  return text.startsWith('env:') ? text.slice(4) : ''
}

function extractUserSecretName(value: unknown) {
  const text = typeof value === 'string' ? value : ''
  return text.startsWith('userSecret:') ? text.slice('userSecret:'.length) : ''
}

function readAuthMode(value: unknown): AuthMode {
  const text = typeof value === 'string' ? value : ''
  if (text.startsWith('env:')) return 'platform'
  if (text.startsWith('userSecret:')) return 'user'
  return 'none'
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}
</script>

<template>
  <main class="tools-page">
    <header class="tools-header">
      <div>
        <h1>工具库</h1>
        <p>管理智能体可调用的内置工具、HTTP API 工具和 LLM Prompt 工具。</p>
      </div>
      <div class="tools-actions">
        <label>
          <Search :size="16" />
          <input
            :value="props.toolSearch"
            placeholder="搜索工具名称或描述..."
            @input="emit('update:toolSearch', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <button class="template-create" @click="openToolModal"><Plus :size="17" />添加工具</button>
      </div>
    </header>

    <section class="tools-content">
      <div class="tools-stats">
        <article v-for="stat in props.toolStats" :key="stat.label" class="tools-stat panel">
          <span :class="['tools-stat-icon', stat.tone]"><component :is="stat.icon" :size="22" /></span>
          <div>
            <p>{{ stat.label }}</p>
            <strong>{{ stat.value }}</strong>
            <small>较上次 <b>{{ stat.delta }}</b></small>
          </div>
        </article>
      </div>

      <section class="mcp-manager panel">
        <div class="mcp-manager-head">
          <div>
            <h2>MCP Server</h2>
            <p>Phase 1 keeps MCP as a compatible tool source; the real MCP Client protocol comes later.</p>
          </div>
          <span>{{ props.mcpServers.length }} servers</span>
        </div>

        <div class="mcp-create-row">
          <label>
            <span>Name</span>
            <input v-model="mcpForm.name" placeholder="local_context_server" />
          </label>
          <label>
            <span>Display</span>
            <input v-model="mcpForm.displayName" placeholder="Local Context MCP" />
          </label>
          <label class="endpoint">
            <span>Endpoint</span>
            <input v-model="mcpForm.endpoint" placeholder="http://localhost:3001/mcp" />
          </label>
          <label>
            <span>Transport</span>
            <select v-model="mcpForm.transport">
              <option value="http">http</option>
              <option value="sse">sse</option>
              <option value="stdio">stdio</option>
            </select>
          </label>
          <button :disabled="mcpSaving" @click="saveMcpServer">
            <Plus :size="15" />{{ mcpSaving ? 'Saving' : 'Add' }}
          </button>
        </div>

        <div class="mcp-server-list">
          <article v-for="server in paginatedMcpServers" :key="server.id" class="mcp-server-row">
            <div>
              <strong>{{ server.displayName || server.name }}</strong>
              <small>{{ server.endpoint }}</small>
            </div>
            <span class="mcp-pill">{{ server.transport || 'http' }}</span>
            <span :class="['mcp-status', server.status]">{{ server.status || 'unknown' }}</span>
            <span>{{ server.toolCount || 0 }} tools</span>
            <button @click="emit('toggleMcpServer', server)">
              <Gauge :size="15" />{{ server.enabled ? 'Disable' : 'Enable' }}
            </button>
            <button :disabled="mcpBusyServerId === server.id" @click="testMcp(server)">
              <Play :size="15" />Test
            </button>
            <button :disabled="mcpBusyServerId === server.id" @click="syncMcpTools(server)">
              <RefreshCw :size="15" />Sync
            </button>
          </article>
          <p v-if="!props.mcpServers.length" class="mcp-empty">No MCP Server configured yet.</p>
        </div>
        <PaginationBar
          v-if="props.mcpServers.length > 0"
          :page="mcpPage"
          :page-size="mcpPageSize"
          :total="mcpTotal"
          item-label="个 MCP 服务"
          @update:page="setMcpPage"
          @update:page-size="setMcpPageSize"
        />

        <pre v-if="mcpResult" class="mcp-result">{{ formatJson(mcpResult) }}</pre>
      </section>

      <div class="tools-toolbar">
        <div class="tools-tabs">
          <button
            v-for="category in props.toolCategories"
            :key="category"
            :class="{ active: props.activeToolCategory === category }"
            @click="emit('update:activeToolCategory', category)"
          >
            {{ category }}
          </button>
        </div>
        <div class="tools-filter">
          <button @click="emit('cycleToolStatus')">{{ props.activeToolStatus }} <ChevronDown :size="14" /></button>
          <button>默认排序 <ChevronDown :size="14" /></button>
          <button @click="emit('refresh')"><RefreshCw :size="15" />刷新</button>
        </div>
      </div>

      <section class="tools-table panel">
        <div class="tools-table-head">
          <span>工具名称</span>
          <span>类型</span>
          <span>描述</span>
          <span>状态</span>
          <span>成功率</span>
          <span>平均耗时</span>
          <span>调用次数</span>
          <span>操作</span>
        </div>
        <article v-for="tool in paginatedTools" :key="tool.name" class="tools-row">
          <div class="tool-name-cell">
            <span :class="['tool-row-icon', tool.tone]"><component :is="tool.icon" :size="22" /></span>
            <div>
              <strong>{{ tool.name }}</strong>
              <small>{{ tool.toolKind === 'mcp' ? tool.mcpToolName || tool.displayName : tool.displayName || tool.version }}</small>
            </div>
          </div>
          <span class="tool-type">{{ tool.type }}</span>
          <p>{{ tool.desc }}</p>
          <div class="tool-status">
            <span class="toggle" :class="{ off: !tool.enabled }" @click="emit('toggleTool', tool)"></span>
            <b>{{ tool.enabled ? '启用' : '禁用' }}</b>
          </div>
          <span class="tool-success">
            {{ tool.success }}
            <TrendingUp v-if="tool.trend === 'up'" :size="13" />
            <span v-else class="down">下降</span>
          </span>
          <span>{{ tool.latency }}</span>
          <span>{{ tool.calls }}</span>
          <div class="tool-actions">
            <button @click="emit('notify', `${tool.name}：${tool.desc}`)"><Eye :size="15" /></button>
            <button @click="emit('toggleTool', tool)"><Gauge :size="15" /></button>
            <button @click="openEditTool(tool)"><Pencil :size="15" /></button>
          </div>
        </article>
      </section>

      <PaginationBar
        :page="toolPage"
        :page-size="toolPageSize"
        :total="toolTotal"
        item-label="个工具"
        @update:page="setToolPage"
        @update:page-size="setToolPageSize"
      />
    </section>

    <Teleport to="body">
      <div v-if="modalOpen" class="tool-modal-backdrop">
        <section class="tool-modal" role="dialog" aria-modal="true">
          <header class="tool-modal-head">
            <div>
              <h2>{{ modalTitle }}</h2>
              <p>{{ modalSubtitle }}</p>
            </div>
            <button aria-label="关闭" @click="closeToolModal"><X :size="18" /></button>
          </header>

          <div v-if="modalStep === 'choose_type'" class="tool-modal-body">
            <div class="tool-type-choice-grid">
              <button v-for="option in toolTypeOptions" :key="option.value" class="tool-type-card" @click="chooseToolType(option.value)">
                <span class="tool-type-icon"><component :is="option.icon" :size="24" /></span>
                <strong>{{ option.title }}</strong>
                <small>{{ option.description }}</small>
              </button>
            </div>
          </div>

          <div v-else class="tool-modal-body">
            <button v-if="modalMode !== 'edit_existing'" class="tool-back-btn" @click="returnToTypeChoice">
              <ArrowLeft :size="16" />重新选择类型
            </button>

            <template v-if="selectedToolType === 'http'">
              <section class="tool-form-section">
                <div class="tool-section-title">
                  <Globe2 :size="18" />
                  <div>
                    <h3>HTTP API 工具</h3>
                    <p>选择模板后再填写真实接口地址和鉴权信息。</p>
                  </div>
                </div>

                <label class="template-select">
                  <span>模板</span>
                  <select :value="httpTemplate" :disabled="modalMode === 'edit_existing'" @change="onTemplateChange">
                    <option v-for="template in httpTemplates" :key="template.key" :value="template.key">
                      {{ template.label }} - {{ template.description }}
                    </option>
                  </select>
                </label>

                <div class="tool-form-grid basic">
                  <label>
                    <span>工具名 name</span>
                    <input v-model="form.name" :disabled="modalMode === 'edit_existing'" placeholder="my_http_tool" />
                  </label>
                  <label>
                    <span>显示名 displayName</span>
                    <input v-model="form.displayName" placeholder="天气查询工具" />
                  </label>
                  <label class="full">
                    <span>描述 description</span>
                    <input v-model="form.description" placeholder="说明工具能做什么，便于 Workflow Generator 选择" />
                  </label>
                  <label class="tool-check">
                    <input v-model="form.enabled" type="checkbox" />
                    <span>启用工具</span>
                  </label>
                  <label>
                    <span>风险等级 riskLevel</span>
                    <select v-model="form.riskLevel">
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                  </label>
                  <label>
                    <span>请求方法 method</span>
                    <select v-model="form.method">
                      <option>GET</option>
                      <option>POST</option>
                      <option>PUT</option>
                      <option>PATCH</option>
                      <option>DELETE</option>
                    </select>
                  </label>
                  <div class="tool-auth-card full">
                    <div class="tool-auth-head">
                      <strong>鉴权方式</strong>
                      <span v-if="form.authMode === 'platform'">由管理员在后端环境变量中配置</span>
                      <span v-else-if="form.authMode === 'user'">使用当前用户自己保存的 Secret</span>
                      <span v-else>该工具请求不会注入 API Key</span>
                    </div>
                    <div class="tool-auth-options">
                      <label>
                        <input v-model="form.authMode" type="radio" value="none" />
                        <span>不需要鉴权</span>
                      </label>
                      <label>
                        <input v-model="form.authMode" type="radio" value="platform" />
                        <span>使用平台 Key</span>
                      </label>
                      <label>
                        <input v-model="form.authMode" type="radio" value="user" />
                        <span>用户自带 Key</span>
                      </label>
                    </div>

                    <div v-if="form.authMode !== 'none'" class="tool-form-grid auth-grid">
                      <label>
                        <span>注入参数名 keyName</span>
                        <input v-model="form.authKeyName" placeholder="key" />
                      </label>
                      <label>
                        <span>注入位置</span>
                        <select v-model="form.authIn">
                          <option value="query">query</option>
                          <option value="header">header</option>
                        </select>
                      </label>
                    </div>

                    <div v-if="form.authMode === 'platform'" class="tool-form-grid auth-grid">
                      <label class="full">
                        <span>平台环境变量名</span>
                        <input v-model="form.apiKeyEnvName" placeholder="AMAP_API_KEY" />
                      </label>
                      <p class="tool-auth-note full">平台 Key 只在后端读取，前端不会拿到真实值。</p>
                    </div>

                    <div v-else-if="form.authMode === 'user'" class="tool-form-grid auth-grid">
                      <label>
                        <span>Secret 名称</span>
                        <input v-model="form.secretName" placeholder="AMAP_API_KEY" />
                      </label>
                      <label>
                        <span>Provider</span>
                        <input v-model="form.secretProvider" placeholder="amap" />
                      </label>
                      <label class="full tool-check">
                        <input v-model="form.allowSecretFallback" type="checkbox" />
                        <span>如果用户未配置，则允许 fallback 到同名平台 env Key</span>
                      </label>
                      <div class="secret-status full">
                        <span>{{ selectedSecret ? `已配置：${selectedSecret.maskedValue}` : '尚未配置我的 Key' }}</span>
                      </div>
                      <label class="full">
                        <span>我的真实 API Key</span>
                        <input v-model="form.secretValue" type="password" autocomplete="off" placeholder="仅保存到后端加密 Secret 表" />
                      </label>
                      <button class="secret-save-btn" :disabled="savingSecret" @click="saveCurrentSecret">
                        <Save :size="15" />{{ savingSecret ? '保存中...' : '配置我的 Key' }}
                      </button>
                      <button v-if="selectedSecret" class="secret-save-btn danger" @click="deleteCurrentSecret">
                        <X :size="15" />删除我的 Key
                      </button>
                    </div>
                  </div>
                  <label class="full">
                    <span>请求地址 endpoint</span>
                    <input v-model="form.endpoint" placeholder="https://restapi.amap.com/v3/weather/weatherInfo" />
                  </label>
                  <label class="full">
                    <span>测试输入 JSON</span>
                    <textarea v-model="form.testInputJson" spellcheck="false"></textarea>
                  </label>
                </div>

                <details class="tool-advanced">
                  <summary><Braces :size="16" />高级模式</summary>
                  <div class="tool-form-grid">
                    <label>
                      <span>headers</span>
                      <textarea v-model="form.headersJson" spellcheck="false"></textarea>
                    </label>
                    <label>
                      <span>queryParams</span>
                      <textarea v-model="form.queryParamsJson" spellcheck="false"></textarea>
                    </label>
                    <label>
                      <span>bodyTemplate</span>
                      <textarea v-model="form.bodyTemplateJson" spellcheck="false"></textarea>
                    </label>
                    <label>
                      <span>authConfig</span>
                      <textarea v-model="form.authConfigJson" spellcheck="false"></textarea>
                    </label>
                    <label>
                      <span>inputMapping</span>
                      <textarea v-model="form.inputMappingJson" spellcheck="false"></textarea>
                    </label>
                    <label>
                      <span>outputMapping</span>
                      <textarea v-model="form.outputMappingJson" spellcheck="false"></textarea>
                    </label>
                    <label>
                      <span>inputSchema</span>
                      <textarea v-model="form.inputSchemaJson" spellcheck="false"></textarea>
                    </label>
                    <label>
                      <span>outputSchema</span>
                      <textarea v-model="form.outputSchemaJson" spellcheck="false"></textarea>
                    </label>
                  </div>
                </details>
              </section>
            </template>

            <template v-else-if="selectedToolType === 'llm'">
              <section class="tool-form-section">
                <div class="tool-section-title">
                  <MessageSquareText :size="18" />
                  <div>
                    <h3>LLM Prompt 工具</h3>
                    <p>该类型只配置 Prompt、响应格式和输入输出 Schema。</p>
                  </div>
                </div>

                <div class="tool-form-grid">
                  <label>
                    <span>工具名 name</span>
                    <input v-model="form.name" :disabled="modalMode === 'edit_existing'" placeholder="summary_prompt_tool" />
                  </label>
                  <label>
                    <span>显示名 displayName</span>
                    <input v-model="form.displayName" placeholder="摘要生成工具" />
                  </label>
                  <label class="full">
                    <span>描述 description</span>
                    <input v-model="form.description" placeholder="说明这个 Prompt 工具适合什么任务" />
                  </label>
                  <label class="tool-check">
                    <input v-model="form.enabled" type="checkbox" />
                    <span>启用工具</span>
                  </label>
                  <label>
                    <span>风险等级 riskLevel</span>
                    <select v-model="form.riskLevel">
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                  </label>
                  <label class="full">
                    <span>promptTemplate</span>
                    <textarea v-model="form.promptTemplate" spellcheck="false" placeholder="请根据以下输入生成摘要：{{input.text}}"></textarea>
                  </label>
                  <label>
                    <span>responseFormat</span>
                    <select v-model="form.responseFormat">
                      <option value="json">json</option>
                      <option value="text">text</option>
                    </select>
                  </label>
                  <label>
                    <span>temperature</span>
                    <input v-model.number="form.temperature" type="number" min="0" max="2" step="0.1" />
                  </label>
                  <label>
                    <span>inputSchema</span>
                    <textarea v-model="form.inputSchemaJson" spellcheck="false"></textarea>
                  </label>
                  <label>
                    <span>outputSchema</span>
                    <textarea v-model="form.outputSchemaJson" spellcheck="false"></textarea>
                  </label>
                  <label class="full">
                    <span>测试输入 JSON</span>
                    <textarea v-model="form.testInputJson" spellcheck="false"></textarea>
                  </label>
                </div>
              </section>
            </template>

            <template v-else>
              <section class="tool-form-section">
                <div class="tool-section-title">
                  <ServerCog :size="18" />
                  <div>
                    <h3>内置工具</h3>
                    <p>内置工具不能随意新建，只能配置后端已注册的工具记录。</p>
                  </div>
                </div>

                <div class="builtin-config-list">
                  <article v-for="item in builtinTools" :key="item.name" class="builtin-config-card">
                    <div class="builtin-config-main">
                      <span class="tool-type-icon"><Code2 :size="20" /></span>
                      <div>
                        <strong>{{ item.name }}</strong>
                        <small>{{ item.exists ? '已入库，可配置' : '后端工具尚未入库' }}</small>
                      </div>
                    </div>

                    <div v-if="builtinDrafts[item.name]" class="builtin-config-grid">
                      <label class="tool-check">
                        <input v-model="builtinDrafts[item.name].enabled" type="checkbox" :disabled="!item.exists" />
                        <span>启用</span>
                      </label>
                      <label>
                        <span>显示名</span>
                        <input v-model="builtinDrafts[item.name].displayName" :disabled="!item.exists" />
                      </label>
                      <label>
                        <span>风险等级</span>
                        <select v-model="builtinDrafts[item.name].riskLevel" :disabled="!item.exists">
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                        </select>
                      </label>
                      <label class="full">
                        <span>描述</span>
                        <input v-model="builtinDrafts[item.name].description" :disabled="!item.exists" />
                      </label>
                    </div>

                    <button :disabled="!item.exists || savingBuiltinName === item.name" @click="saveBuiltinTool(item)">
                      <Save :size="15" />{{ savingBuiltinName === item.name ? '保存中...' : '保存配置' }}
                    </button>
                  </article>
                </div>
              </section>
            </template>

            <div v-if="nameConflict" class="tool-conflict-panel">
              <AlertTriangle :size="18" />
              <div>
                <strong>工具名 {{ nameConflict.name }} 已存在。</strong>
                <p>请选择编辑已有工具，或者使用新的工具名另存。</p>
                <div>
                  <button :disabled="!nameConflict.tool" @click="editExistingTool"><Pencil :size="15" />编辑已有工具</button>
                  <button @click="saveAsSuggestedName"><Sparkles :size="15" />另存为 {{ nameConflict.suggestedName }}</button>
                  <button @click="nameConflict = null">取消</button>
                </div>
              </div>
            </div>

            <div v-if="selectedToolType !== 'builtin'" class="tool-modal-actions">
              <button @click="closeToolModal">取消</button>
              <button :disabled="saving || testing" @click="testCurrentTool">
                <Play :size="16" />{{ testing ? '测试中...' : '测试草稿' }}
              </button>
              <button class="primary" :disabled="saving || testing" @click="saveTool">
                <Save :size="16" />{{ saving ? '保存中...' : modalMode === 'edit_existing' ? '保存修改' : '保存工具' }}
              </button>
            </div>

            <div v-if="testResult" class="tool-test-result">
              <span>
                <CheckCircle2 v-if="testResult.success" class="success-icon" :size="15" />
                <AlertTriangle v-else class="warning-icon" :size="15" />
                测试结果
              </span>
              <pre>{{ formatJson(testResult) }}</pre>
            </div>
          </div>
        </section>
      </div>
    </Teleport>
  </main>
</template>

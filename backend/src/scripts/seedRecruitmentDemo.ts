import { getPool } from '../config/db'
import { createKnowledgeBase, createKnowledgeDocument, findKnowledgeBaseByName, listKnowledgeDocumentsByBaseId } from '../models/knowledge.model'
import { createTemplate, listTemplates } from '../models/template.model'
import { createTool, listTools, ToolInput, updateTool } from '../models/tool.model'

const userId = 'default_user'
const knowledgeBaseName = '招聘评估知识库'
const knowledgeFilename = 'recruitment-evaluation-rules.md'

const toolDefinitions: ToolInput[] = [
  {
    name: 'resume_extract_tool',
    display_name: '简历信息提取工具',
    type: 'builtin',
    version: 'v1.0.0',
    category: '招聘分析',
    description: '从多份真实简历文本中提取姓名、学历、技能、工作年限和经历摘要。',
    enabled: 1,
    risk_level: 'low',
    input_schema: { files: { type: 'array', required: false }, upstreamOutputs: { type: 'object', required: false } },
    output_schema: { candidates: 'array', candidateCount: 'number', warnings: 'array' }
  },
  {
    name: 'job_requirement_tool',
    display_name: '岗位要求解析工具',
    type: 'builtin',
    version: 'v1.0.0',
    category: '招聘分析',
    description: '从用户需求中提取岗位名称、最低学历、经验年限、必备技能和加分技能。',
    enabled: 1,
    risk_level: 'low',
    input_schema: { query: { type: 'string', required: true } },
    output_schema: { jobRequirement: 'object' }
  },
  {
    name: 'candidate_match_tool',
    display_name: '候选人匹配评分工具',
    type: 'builtin',
    version: 'v1.0.0',
    category: '招聘分析',
    description: '按照技能、学历、工作经验、信息完整度和加分项计算候选人匹配分。',
    enabled: 1,
    risk_level: 'low',
    input_schema: { upstreamOutputs: { type: 'object', required: false } },
    output_schema: { matches: 'array', scoringModel: 'string' }
  },
  {
    name: 'candidate_rank_tool',
    display_name: '候选人排序工具',
    type: 'builtin',
    version: 'v1.0.0',
    category: '招聘分析',
    description: '按匹配分生成候选人排名和优先面试、建议面试、人才储备等建议。',
    enabled: 1,
    risk_level: 'low',
    input_schema: { upstreamOutputs: { type: 'object', required: false } },
    output_schema: { rankings: 'array', recommendedCount: 'number', topCandidate: 'object' }
  },
  {
    name: 'recruitment_report_tool',
    display_name: '招聘分析报告生成工具',
    type: 'builtin',
    version: 'v1.0.0',
    category: '内容生成',
    description: '将岗位要求、候选人排名、匹配技能和关注事项整理为 Markdown 招聘分析报告。',
    enabled: 1,
    risk_level: 'low',
    input_schema: { upstreamOutputs: { type: 'object', required: false } },
    output_schema: { title: 'string', summary: 'string', markdown: 'string', rankings: 'array' }
  },
  {
    name: 'recruitment_report_output_tool',
    display_name: '招聘报告输出工具',
    type: 'builtin',
    version: 'v1.0.0',
    category: '输出',
    description: '输出最终招聘分析结果、候选人排序和报告预览。',
    enabled: 1,
    risk_level: 'low',
    input_schema: { upstreamOutputs: { type: 'object', required: false } },
    output_schema: { title: 'string', summary: 'string', markdown: 'string', rankings: 'array', candidateCount: 'number' }
  }
]

async function main() {
  await seedTools()
  await seedKnowledgeBase()
  await seedTemplate()
  console.log('Recruitment analysis tools, knowledge base, and template seeded')
}

async function seedTools() {
  const existing = await listTools()
  for (const definition of toolDefinitions) {
    const row = existing.find((item) => item.name === definition.name)
    if (row) await updateTool(row.id, definition)
    else await createTool(definition)
  }
}

async function seedKnowledgeBase() {
  let knowledgeBase = await findKnowledgeBaseByName(knowledgeBaseName, userId)
  if (!knowledgeBase) {
    const id = await createKnowledgeBase({
      name: knowledgeBaseName,
      description: '用于简历筛选、岗位匹配、候选人评分和公平招聘检查的本地知识库。',
      embedding_model: 'local-keyword-v1',
      chunk_size: 800,
      chunk_overlap: 120,
      retrieval_mode: 'keyword',
      top_k: 5,
      owner_user_id: userId
    })
    knowledgeBase = await findKnowledgeBaseByName(knowledgeBaseName, userId)
    if (!knowledgeBase || Number(knowledgeBase.id) !== Number(id)) throw new Error('Failed to create recruitment knowledge base')
  }

  const documents = await listKnowledgeDocumentsByBaseId(knowledgeBase.id, userId)
  if (documents.some((item) => item.filename === knowledgeFilename)) return

  await createKnowledgeDocument({
    knowledgeBaseId: knowledgeBase.id,
    ownerUserId: userId,
    filename: knowledgeFilename,
    title: '招聘候选人评估规则',
    fileType: 'text/markdown',
    chunks: [
      { content: '候选人岗位匹配应优先评估与工作直接相关的技能、项目经验、教育背景和工作年限。建议使用统一评分表，避免仅凭主观印象决定候选人排序。', metadata: { section: '评估原则' } },
      { content: '技能匹配可以作为主要评分项。必备技能缺失需要明确列为关注事项；加分技能只能增加有限分值，不能代替岗位的核心能力要求。', metadata: { section: '技能评分' } },
      { content: '学历和工作年限应按照岗位实际需要设置。候选人超过最低学历或经验要求时可以获得对应分数，但不应无限提高权重。', metadata: { section: '学历与经验' } },
      { content: '招聘评估不得使用性别、年龄、民族、婚姻、生育、籍贯等与岗位能力无关的信息进行评分。自动排序只能作为辅助结果，最终录用应保留人工复核。', metadata: { section: '公平招聘' } },
      { content: '候选人报告应列出匹配技能、缺失技能、主要优势、关注事项和推荐结论。推荐等级可分为优先面试、建议面试、人才储备和暂不推荐。', metadata: { section: '报告规范' } }
    ]
  })
}

async function seedTemplate() {
  const templates = await listTemplates()
  if (templates.some((item) => item.title === '多简历候选人匹配分析 Workflow')) return
  await createTemplate({
    title: '多简历候选人匹配分析 Workflow',
    description: '批量读取简历，提取学历、技能和经历，依据岗位要求完成评分、排序并生成招聘分析报告。',
    category: '招聘分析',
    badge: 'official',
    is_official: 1,
    workflow_json: {
      name: '多简历候选人匹配分析 Workflow',
      intent: 'resume_screening',
      steps: ['批量读取简历', '提取候选人信息', '解析岗位要求', '检索招聘知识', '匹配评分', '候选人排序', '生成招聘报告']
    }
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await getPool().end()
  })

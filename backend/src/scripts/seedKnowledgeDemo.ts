import { execute, getPool } from '../config/db'
import {
  createKnowledgeBase,
  createKnowledgeDocument,
  listKnowledgeBases,
  listKnowledgeDocumentsByBaseId
} from '../models/knowledge.model'

const userId = 'default_user'
const demoFilename = 'demo-financial-risk.md'

async function main() {
  const knowledgeBases = await listKnowledgeBases(userId)
  let knowledgeBase = knowledgeBases.find((item) => item.name === '财务风险知识库')

  if (!knowledgeBase) {
    const id = await createKnowledgeBase({
      name: '财务风险知识库',
      description: '用于财报风险分析演示的本地知识库。',
      embedding_model: 'local-keyword-v1',
      chunk_size: 800,
      chunk_overlap: 120,
      retrieval_mode: 'keyword',
      top_k: 5,
      owner_user_id: userId
    })
    knowledgeBase = (await listKnowledgeBases(userId)).find((item) => Number(item.id) === Number(id))
  }

  if (!knowledgeBase) throw new Error('Failed to create demo knowledge base')

  await execute(
    `UPDATE knowledge_bases
     SET description = '用于财报风险分析场景的本地关键词知识库。',
         embedding_model = 'local-keyword-v1', retrieval_mode = 'keyword'
     WHERE id = ?`,
    [knowledgeBase.id]
  )

  const documents = await listKnowledgeDocumentsByBaseId(knowledgeBase.id, userId)
  if (documents.some((item) => item.filename === demoFilename)) {
    console.log('Knowledge demo data already exists')
    return
  }

  await createKnowledgeDocument({
    knowledgeBaseId: knowledgeBase.id,
    ownerUserId: userId,
    filename: demoFilename,
    title: '企业财务风险分析要点',
    fileType: 'text/markdown',
    chunks: [
      {
        content: '财务风险分析应同时观察偿债能力、盈利能力和现金流质量。单个指标异常不一定代表企业经营恶化，需要结合行业水平、历史趋势和报表附注综合判断。',
        metadata: { section: '分析框架' }
      },
      {
        content: '资产负债率反映企业资产中由负债提供资金的比例。资产负债率持续上升、短期债务占比过高或流动比率下降时，企业可能面临偿债压力和再融资风险。',
        metadata: { section: '偿债能力' }
      },
      {
        content: '经营现金流应与净利润进行对照。净利润增长但经营现金流长期为负，可能说明应收账款增加、收入确认偏激进或盈利质量不足，需要进一步检查现金流和盈利能力。',
        metadata: { section: '现金流与盈利质量' }
      }
    ]
  })

  console.log('Knowledge demo data seeded')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await getPool().end()
  })

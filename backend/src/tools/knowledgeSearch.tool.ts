import { TraceMindTool } from '../types/tool'

const knowledgeSearchTool: TraceMindTool = {
  name: 'finance_knowledge_base',
  displayName: '财务知识检索工具',
  async run(context) {
    return {
      success: true,
      output: {
        query: context.query,
        hits: [
          {
            title: '现金流风险识别规则',
            score: 0.89,
            snippet: '经营性现金流持续弱于净利润时，需要关注收入质量和回款压力。'
          },
          {
            title: '资产负债率解读',
            score: 0.83,
            snippet: '高负债率本身不是风险结论，需要结合债务期限、利率和现金覆盖能力判断。'
          }
        ]
      },
      message: '知识检索完成'
    }
  }
}

export default knowledgeSearchTool

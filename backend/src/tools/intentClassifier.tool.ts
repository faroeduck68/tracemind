import { TraceMindTool } from '../types/tool'

const financeKeywords = ['财报', '财务', '风险', '利润', '收入', '现金流']
const recruitmentKeywords = ['简历', '候选人', '招聘', '岗位匹配', '人才筛选', '应聘']

const intentClassifierTool: TraceMindTool = {
  name: 'intent_classifier',
  displayName: '意图识别器',
  async run(context) {
    const query = context.query ?? ''
    const matchedKeywords = financeKeywords.filter((keyword) => query.includes(keyword))
    const matchedRecruitmentKeywords = recruitmentKeywords.filter((keyword) => query.includes(keyword))
    const intent = matchedRecruitmentKeywords.length > 0
      ? 'resume_screening'
      : matchedKeywords.length > 0
        ? 'financial_report_analysis'
        : 'general_workflow'

    return {
      success: true,
      output: {
        intent,
        confidence: matchedRecruitmentKeywords.length > 0 || matchedKeywords.length > 0 ? 0.94 : 0.78,
        matchedKeywords: [...matchedRecruitmentKeywords, ...matchedKeywords]
      },
      message: '意图识别完成'
    }
  }
}

export default intentClassifierTool

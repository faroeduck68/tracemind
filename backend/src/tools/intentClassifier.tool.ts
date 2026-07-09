import { TraceMindTool } from '../types/tool'

const financeKeywords = ['财报', '财务', '风险', '利润', '收入', '现金流']

const intentClassifierTool: TraceMindTool = {
  name: 'intent_classifier',
  displayName: '意图识别器',
  async run(context) {
    const query = context.query ?? ''
    const matchedKeywords = financeKeywords.filter((keyword) => query.includes(keyword))

    return {
      success: true,
      output: {
        intent: matchedKeywords.length > 0 ? 'financial_report_analysis' : 'general_workflow',
        confidence: matchedKeywords.length > 0 ? 0.94 : 0.78,
        matchedKeywords
      },
      message: '意图识别完成'
    }
  }
}

export default intentClassifierTool

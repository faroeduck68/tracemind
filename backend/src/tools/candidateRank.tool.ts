import { TraceMindTool } from '../types/tool'

const candidateRankTool: TraceMindTool = {
  name: 'candidate_rank_tool',
  displayName: '候选人排序工具',
  async run(context) {
    const matches = findMatches(context)
    const rankings: Array<Record<string, unknown>> = [...matches]
      .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
      .map((candidate, index) => ({
        ...candidate,
        rank: index + 1,
        recommendation: recommendation(Number(candidate.score ?? 0))
      }))
    return {
      success: true,
      output: {
        rankings,
        recommendedCount: rankings.filter((item) => Number(item.score ?? 0) >= 65).length,
        topCandidate: rankings[0] ?? null
      },
      message: `已生成 ${rankings.length} 位候选人的排序结果`
    }
  }
}

function findMatches(context: Parameters<TraceMindTool['run']>[0]) {
  for (const output of Object.values(context.nodeOutputs)) {
    if (output && typeof output === 'object' && Array.isArray((output as Record<string, unknown>).matches)) return (output as Record<string, unknown>).matches as Array<Record<string, unknown>>
  }
  return []
}

function recommendation(score: number) {
  if (score >= 80) return '优先面试'
  if (score >= 65) return '建议面试'
  if (score >= 50) return '人才储备'
  return '暂不推荐'
}

export default candidateRankTool

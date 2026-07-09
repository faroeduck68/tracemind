import { execute } from '../config/db'

export type ToolRankingScore = {
  toolName: string
  keywordScore: number
  semanticScore: number
  historyScore: number
  preferenceScore: number
  finalScore: number
  selected: boolean
  reason: string
}

export async function createToolRankingLogs(runId: number, nodeKey: string, scores: ToolRankingScore[]) {
  for (const score of scores) {
    await execute(
      `INSERT INTO tool_ranking_logs
       (run_id, node_key, tool_name, keyword_score, semantic_score, history_score, preference_score, final_score, selected, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        runId,
        nodeKey,
        score.toolName,
        score.keywordScore,
        score.semanticScore,
        score.historyScore,
        score.preferenceScore,
        score.finalScore,
        score.selected ? 1 : 0,
        score.reason
      ]
    )
  }
}

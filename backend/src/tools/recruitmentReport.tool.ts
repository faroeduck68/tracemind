import { TraceMindTool } from '../types/tool'

const recruitmentReportTool: TraceMindTool = {
  name: 'recruitment_report_tool',
  displayName: '招聘分析报告生成工具',
  async run(context) {
    const rankingOutput = findRecord(context, 'rankings')
    const requirementOutput = findRecord(context, 'jobRequirement')
    const rankings = Array.isArray(rankingOutput?.rankings) ? rankingOutput.rankings as Array<Record<string, unknown>> : []
    const requirement = requirementOutput?.jobRequirement as Record<string, unknown> | undefined
    const title = `${String(requirement?.title ?? '目标岗位')}候选人分析报告`
    const table = rankings.map((item) => `| ${item.rank} | ${item.name} | ${item.score} | ${item.education} | ${item.experienceYears} 年 | ${item.recommendation} |`).join('\n')
    const details = rankings.flatMap((item) => [
      `### ${item.rank}. ${item.name}（${item.score} 分）`,
      `- 推荐结论：${item.recommendation}`,
      `- 评分构成：${formatBreakdown(item.scoreBreakdown)}`,
      `- 匹配技能：${arrayText(item.matchedSkills) || '未识别'}`,
      `- 缺失技能：${arrayText(item.missingSkills) || '无'}`,
      `- 主要优势：${arrayText(item.strengths) || '暂无'}`,
      `- 关注事项：${arrayText(item.concerns) || '暂无'}`,
      ''
    ])
    const markdown = [
      `# ${title}`, '',
      '## 岗位要求',
      `- 最低学历：${String(requirement?.minimumEducation ?? '不限')}`,
      `- 最低经验：${Number(requirement?.minimumExperienceYears ?? 0)} 年`,
      `- 必备技能：${arrayText(requirement?.requiredSkills) || '未指定'}`, '',
      '## 候选人排名',
      '| 排名 | 姓名 | 匹配分 | 学历 | 经验 | 建议 |',
      '| --- | --- | ---: | --- | ---: | --- |',
      table || '| - | 暂无候选人 | 0 | - | 0 | - |', '',
      '## 候选人详情', ...details,
      '## 评分说明',
      '- 必备技能匹配占 60 分，学历和经验各占 15 分，信息完整度与加分技能共占 10 分。',
      '- 排名仅用于辅助筛选，不应使用性别、年龄、民族、婚育等与岗位能力无关的信息。'
    ].join('\n')
    const summary = rankings.length
      ? `共分析 ${rankings.length} 位候选人，${rankingOutput?.recommendedCount ?? 0} 位达到建议面试线。排名第一的是 ${rankings[0].name}，匹配分 ${rankings[0].score}。`
      : '没有可用于生成招聘分析报告的候选人。'

    return { success: true, output: { title, summary, markdown, rankings, jobRequirement: requirement }, message: '招聘分析报告生成完成' }
  }
}

function findRecord(context: Parameters<TraceMindTool['run']>[0], key: string) {
  return Object.values(context.nodeOutputs).find((output) => output && typeof output === 'object' && key in (output as Record<string, unknown>)) as Record<string, unknown> | undefined
}

function arrayText(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).join('、') : ''
}

function formatBreakdown(value: unknown) {
  if (!value || typeof value !== 'object') return '暂无评分明细'
  const item = value as Record<string, unknown>
  return `技能 ${item.skills ?? 0} + 学历 ${item.education ?? 0} + 经验 ${item.experience ?? 0} + 完整度 ${item.completeness ?? 0} + 加分项 ${item.preferredSkillsBonus ?? 0} = ${item.total ?? 0}`
}

export default recruitmentReportTool

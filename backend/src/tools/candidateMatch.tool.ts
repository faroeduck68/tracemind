import { TraceMindTool } from '../types/tool'

const candidateMatchTool: TraceMindTool = {
  name: 'candidate_match_tool',
  displayName: '候选人匹配评分工具',
  async run(context) {
    const candidates = findArray(context, 'candidates')
    const requirement = findRecordWithKey(context, 'jobRequirement')?.jobRequirement as Record<string, unknown> | undefined
    if (!candidates.length || !requirement) {
      return { success: false, output: { matches: [] }, errorMessage: '缺少候选人信息或岗位要求' }
    }

    const requiredSkills = stringArray(requirement.requiredSkills)
    const preferredSkills = stringArray(requirement.preferredSkills)
    const minEducation = Number(requirement.minimumEducationRank ?? 0)
    const minYears = Number(requirement.minimumExperienceYears ?? 0)
    const knowledge = findRecordWithKey(context, 'results')

    const matches = candidates.map((candidate) => {
      const skills = stringArray(candidate.skills)
      const matchedSkills = requiredSkills.filter((skill) => includesIgnoreCase(skills, skill))
      const missingSkills = requiredSkills.filter((skill) => !includesIgnoreCase(skills, skill))
      const preferredMatches = preferredSkills.filter((skill) => includesIgnoreCase(skills, skill))
      const skillScore = requiredSkills.length ? matchedSkills.length / requiredSkills.length * 60 : 45
      const educationScore = minEducation === 0 ? 15 : Math.min(Number(candidate.educationRank ?? 0) / minEducation, 1) * 15
      const experienceScore = minYears === 0 ? 15 : Math.min(Number(candidate.experienceYears ?? 0) / minYears, 1) * 15
      const completenessScore = [candidate.name, candidate.education, skills.length, candidate.experienceYears].filter(Boolean).length / 4 * 5
      const bonusScore = Math.min(preferredMatches.length * 2.5, 5)
      const score = Math.round((skillScore + educationScore + experienceScore + completenessScore + bonusScore) * 10) / 10
      return {
        candidateId: candidate.candidateId,
        name: candidate.name,
        filename: candidate.filename,
        score,
        matchedSkills,
        missingSkills,
        preferredMatches,
        education: candidate.education,
        experienceYears: candidate.experienceYears,
        scoreBreakdown: {
          skills: roundScore(skillScore),
          education: roundScore(educationScore),
          experience: roundScore(experienceScore),
          completeness: roundScore(completenessScore),
          preferredSkillsBonus: roundScore(bonusScore),
          total: score
        },
        strengths: [matchedSkills.length && `匹配技能：${matchedSkills.join('、')}`, Number(candidate.experienceYears ?? 0) >= minYears && '工作年限达到要求'].filter(Boolean),
        concerns: [missingSkills.length && `缺少技能：${missingSkills.join('、')}`, Number(candidate.educationRank ?? 0) < minEducation && '学历未达到要求', Number(candidate.experienceYears ?? 0) < minYears && '工作年限未达到要求'].filter(Boolean),
        knowledgeReferenceCount: Array.isArray(knowledge?.results) ? knowledge.results.length : 0
      }
    })

    return { success: true, output: { matches, scoringModel: 'skills60-education15-experience15-completeness5-bonus5' }, message: `已完成 ${matches.length} 位候选人的匹配评分` }
  }
}

function findArray(context: Parameters<TraceMindTool['run']>[0], key: string) {
  for (const output of Object.values(context.nodeOutputs)) {
    if (output && typeof output === 'object' && Array.isArray((output as Record<string, unknown>)[key])) return (output as Record<string, unknown>)[key] as Array<Record<string, unknown>>
  }
  return []
}

function findRecordWithKey(context: Parameters<TraceMindTool['run']>[0], key: string) {
  return Object.values(context.nodeOutputs).find((output) => output && typeof output === 'object' && key in (output as Record<string, unknown>)) as Record<string, unknown> | undefined
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

function includesIgnoreCase(values: string[], target: string) {
  return values.some((value) => value.toLowerCase() === target.toLowerCase())
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10
}

export default candidateMatchTool

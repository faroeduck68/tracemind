import path from 'path'
import { TraceMindTool } from '../types/tool'

const skillCatalog = [
  'Java', 'Spring Boot', 'Spring Cloud', 'MySQL', 'Redis', 'MongoDB', 'Python', 'Django', 'Flask',
  'JavaScript', 'TypeScript', 'Vue', 'React', 'Node.js', 'Go', 'C++', 'Docker', 'Kubernetes', 'Linux',
  'Git', 'Maven', 'Gradle', 'RabbitMQ', 'Kafka', 'Elasticsearch', 'HTML', 'CSS', 'SQL', 'Excel', 'PPT'
]

const resumeExtractTool: TraceMindTool = {
  name: 'resume_extract_tool',
  displayName: '简历信息提取工具',
  async run(context) {
    const documents = findParsedDocuments(context)
    if (documents.length === 0) {
      return { success: false, output: { candidates: [], warnings: ['没有找到可解析的简历正文'] }, errorMessage: '没有找到可解析的简历正文' }
    }

    const candidates = documents.map((document, index) => extractCandidate(document, index))
    return {
      success: true,
      output: {
        candidates,
        candidateCount: candidates.length,
        warnings: candidates.flatMap((candidate) => candidate.warnings.map((warning) => `${candidate.name}：${warning}`)),
        extractor: 'local-resume-rules-v1',
        mocked: false
      },
      message: `已从 ${documents.length} 份简历中提取候选人信息`
    }
  }
}

function findParsedDocuments(context: Parameters<TraceMindTool['run']>[0]) {
  for (const output of Object.values(context.nodeOutputs)) {
    if (!output || typeof output !== 'object') continue
    const record = output as Record<string, unknown>
    if (Array.isArray(record.documents)) {
      const documents = record.documents
        .filter((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).text === 'string')
        .map((item) => item as Record<string, unknown>)
      const seen = new Set<string>()
      return documents.filter((item) => {
        const key = `${String(item.filename ?? '')}\n${String(item.text ?? '').replace(/\s+/g, ' ').trim()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
  }
  return []
}

function extractCandidate(document: Record<string, unknown>, index: number) {
  const text = String(document.text ?? '').replace(/\r/g, '')
  const filename = String(document.filename ?? `candidate-${index + 1}.txt`)
  const name = extractName(text, filename, index)
  const education = extractEducation(text)
  const experienceYears = extractExperienceYears(text)
  const explicitSkillLines = text
    .split(/\n+/)
    .filter((line) => /^(?:专业)?技能|^技术栈|^掌握技能/i.test(line.trim()))
    .join(' ')
  const skillSource = explicitSkillLines || text
  const skills = skillCatalog.filter((skill) => containsSkill(skillSource, skill))
  const experienceHighlights = selectLines(text, /工作经历|项目经历|实习|公司|负责|项目|开发|设计|实现/, 6)
  const warnings: string[] = []
  if (education === '未识别') warnings.push('未识别学历')
  if (skills.length === 0) warnings.push('未识别明确技能')
  if (experienceYears === 0) warnings.push('未识别工作年限')

  return {
    candidateId: `C${String(index + 1).padStart(3, '0')}`,
    name,
    filename,
    education,
    educationRank: educationRank(education),
    experienceYears,
    skills,
    experienceHighlights,
    summary: selectLines(text, /优势|自我评价|个人总结|熟悉|掌握|擅长/, 3).join('；'),
    warnings
  }
}

function extractName(text: string, filename: string, index: number) {
  const match = text.match(/(?:姓名|姓\s*名)\s*[:：]\s*([\u4e00-\u9fa5·]{2,12})/)
  if (match?.[1]) return match[1]
  const base = path.basename(filename, path.extname(filename)).replace(/^\d+-/, '').replace(/简历|个人|resume|cv/gi, '').replace(/[_\-\s]/g, '')
  const chinese = base.match(/[\u4e00-\u9fa5·]{2,12}/)?.[0]
  return chinese || `候选人${index + 1}`
}

function extractEducation(text: string) {
  if (/博士|Ph\.?D/i.test(text)) return '博士'
  if (/硕士|研究生|Master/i.test(text)) return '硕士'
  if (/本科|学士|Bachelor/i.test(text)) return '本科'
  if (/大专|专科|Associate/i.test(text)) return '大专'
  if (/高中|中专/.test(text)) return '高中/中专'
  return '未识别'
}

function educationRank(value: string) {
  return ({ '博士': 5, '硕士': 4, '本科': 3, '大专': 2, '高中/中专': 1 } as Record<string, number>)[value] ?? 0
}

function extractExperienceYears(text: string) {
  const values = [...text.matchAll(/(\d{1,2})\s*年(?:以上)?(?:工作|开发|项目|相关)?经验/g)].map((match) => Number(match[1]))
  return values.length ? Math.max(...values.filter((value) => value <= 40)) : 0
}

function containsSkill(text: string, skill: string) {
  const aliases: Record<string, string[]> = {
    'Spring Boot': ['Spring Boot', 'SpringBoot'],
    'Spring Cloud': ['Spring Cloud', 'SpringCloud'],
    'Node.js': ['Node.js', 'NodeJS'],
    'JavaScript': ['JavaScript', 'JS'],
    'TypeScript': ['TypeScript', 'TS'],
    'Kubernetes': ['Kubernetes', 'K8s']
  }
  return (aliases[skill] ?? [skill]).some((alias) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias)}([^a-z0-9]|$)`, 'i').test(text))
}

function selectLines(text: string, pattern: RegExp, limit: number) {
  return text.split(/\n+/).map((line) => line.trim()).filter((line) => line.length >= 4 && pattern.test(line)).slice(0, limit)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default resumeExtractTool

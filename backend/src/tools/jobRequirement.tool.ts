import { TraceMindTool } from '../types/tool'

const skills = ['Java', 'Spring Boot', 'Spring Cloud', 'MySQL', 'Redis', 'Python', 'Django', 'Flask', 'JavaScript', 'TypeScript', 'Vue', 'React', 'Node.js', 'Go', 'C++', 'Docker', 'Kubernetes', 'Linux', 'Git', 'Kafka', 'Elasticsearch', 'SQL', 'Excel']

const jobRequirementTool: TraceMindTool = {
  name: 'job_requirement_tool',
  displayName: '岗位要求解析工具',
  async run(context) {
    const query = context.query?.trim() ?? ''
    const clauses = query.split(/[，,。；;\n]/).map((item) => item.trim()).filter(Boolean)
    const requiredText = clauses.filter((clause) => !/加分|优先|最好/.test(clause)).join(' ')
    const requiredSkills = skills.filter((skill) => containsSkill(requiredText, skill))
    const education = /博士/.test(query) ? '博士' : /硕士|研究生/.test(query) ? '硕士' : /本科|学士/.test(query) ? '本科' : /大专|专科/.test(query) ? '大专' : '不限'
    const yearsMatch = query.match(/(\d{1,2})\s*年(?:以上)?(?:工作|开发|项目|相关)?经验/)
    const titleMatch = query.match(/(?:招聘|岗位|应聘|职位)\s*[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9+.#\- ]{2,30}?)(?:，|。|；|要求|需要|$)/)
    const requirement = {
      title: titleMatch?.[1]?.trim() || inferTitle(query),
      minimumEducation: education,
      minimumEducationRank: educationRank(education),
      minimumExperienceYears: Number(yearsMatch?.[1] ?? 0),
      requiredSkills,
      preferredSkills: extractPreferredSkills(query),
      rawRequirement: query
    }

    return { success: true, output: { jobRequirement: requirement }, message: `已解析岗位要求：${requirement.title}` }
  }
}

function inferTitle(query: string) {
  if (/Java/.test(query)) return 'Java 开发工程师'
  if (/前端|Vue|React/.test(query)) return '前端开发工程师'
  if (/Python/.test(query)) return 'Python 开发工程师'
  if (/产品经理/.test(query)) return '产品经理'
  if (/数据分析/.test(query)) return '数据分析师'
  return '目标岗位'
}

function extractPreferredSkills(query: string) {
  const clauses = query.split(/[，,。；;\n]/).map((item) => item.trim()).filter(Boolean)
  const preferredText = clauses.filter((clause) => /加分|优先|最好/.test(clause)).join(' ')
  return skills.filter((skill) => containsSkill(preferredText, skill))
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function educationRank(value: string) {
  return ({ '博士': 5, '硕士': 4, '本科': 3, '大专': 2 } as Record<string, number>)[value] ?? 0
}

export default jobRequirementTool

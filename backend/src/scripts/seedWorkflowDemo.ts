import { getPool } from '../config/db'
import { createWorkflowWithGraph, listWorkflows } from '../models/workflow.model'
import { createWorkflowRun, listWorkflowRuns, updateWorkflowRunSuccess } from '../models/workflowRun.model'
import { WorkflowEdge, WorkflowGraph, WorkflowNode } from '../types/workflow'

function node(
  id: string,
  label: string,
  subLabel: string,
  tool: string,
  x: number,
  y: number,
  tone: WorkflowNode['tone']
): WorkflowNode {
  return {
    id,
    type: 'tool',
    label,
    subLabel,
    icon: 'Wrench',
    position: { x, y },
    status: 'idle',
    tone,
    tool,
    toolName: tool,
    displayName: label,
    confidence: 0.94,
    reason: `演示工作流节点：${subLabel}`,
    inputSummary: '接收上游节点输出',
    outputSummary: '输出结构化结果',
    candidateTools: [{ name: tool, displayName: label, score: 0.94 }]
  }
}

function edges(nodes: WorkflowNode[]): WorkflowEdge[] {
  return nodes.slice(0, -1).map((item, index) => ({
    id: `edge_${item.id}_${nodes[index + 1].id}`,
    source: item.id,
    target: nodes[index + 1].id,
    branch: 'main'
  }))
}

const financeNodes = [
  node('input', '用户输入', '读取财报分析需求', 'user_input', 80, 120, 'blue'),
  node('parse_pdf', 'PDF 解析', '提取财报文本', 'pdf_parse_tool', 300, 120, 'cyan'),
  node('extract_metrics', '财务指标提取', '抽取收入、利润、现金流等指标', 'financial_extract_tool', 520, 120, 'green'),
  node('risk_analyze', '风险分析', '识别偿债、盈利和现金流风险', 'financial_risk_tool', 740, 120, 'amber'),
  node('knowledge_search', '知识库检索', '检索财务风险知识库', 'knowledge_search_tool', 960, 120, 'violet'),
  node('report_generate', '报告生成', '生成 Markdown 风险分析报告', 'report_generate_tool', 1180, 120, 'green'),
  node('report_output', '报告输出', '输出最终报告结果', 'report_output_tool', 1400, 120, 'blue')
]

const recruitmentNodes = [
  node('input', '用户输入', '读取岗位要求和简历文件', 'user_input', 80, 300, 'blue'),
  node('resume_extract', '简历信息提取', '提取学历、技能和经历', 'resume_extract_tool', 300, 300, 'cyan'),
  node('job_requirement', '岗位要求解析', '解析学历、经验和必备技能', 'job_requirement_tool', 520, 300, 'violet'),
  node('candidate_match', '候选人匹配评分', '计算岗位匹配度', 'candidate_match_tool', 740, 300, 'green'),
  node('candidate_rank', '候选人排序', '生成候选人排名和建议', 'candidate_rank_tool', 960, 300, 'amber'),
  node('recruitment_report', '招聘报告生成', '整理候选人分析报告', 'recruitment_report_tool', 1180, 300, 'green'),
  node('report_output', '招聘报告输出', '输出招聘分析结果', 'recruitment_report_output_tool', 1400, 300, 'blue')
]

const demos: Array<{ graph: WorkflowGraph; input: Record<string, unknown>; output: Record<string, unknown> }> = [
  {
    graph: {
      name: '财报风险分析演示 Workflow',
      description: '读取财报文件，提取关键财务指标，结合知识库生成风险分析报告。',
      sourceType: 'seed',
      originalQuery: '上传财报 PDF，分析偿债能力、盈利质量和现金流风险，并生成报告。',
      intent: 'financial_report_analysis',
      confidence: 0.96,
      status: 'active',
      nodes: financeNodes,
      edges: edges(financeNodes)
    },
    input: { query: '上传财报 PDF，分析财务风险并生成报告。', files: [{ filename: 'demo-financial-report.pdf' }] },
    output: {
      summary: '财报风险分析演示运行完成，已提取指标并生成风险摘要。',
      riskLevel: 'medium',
      recommendation: '建议重点关注现金流质量、短期偿债压力和应收账款变化。'
    }
  },
  {
    graph: {
      name: '多简历候选人匹配演示 Workflow',
      description: '批量读取简历，解析岗位要求，计算匹配度并生成招聘分析报告。',
      sourceType: 'seed',
      originalQuery: '上传多份简历，读取 Java 开发工程师岗位要求，生成候选人排序和招聘分析报告。',
      intent: 'resume_screening',
      confidence: 0.97,
      status: 'active',
      nodes: recruitmentNodes,
      edges: edges(recruitmentNodes)
    },
    input: {
      query: 'Java 开发工程师，本科，3 年经验，必备技能 Java、Spring Boot、MySQL、Redis。',
      files: [{ filename: '张三-简历.txt' }, { filename: '王五-简历.txt' }]
    },
    output: {
      summary: '共分析 2 位候选人，1 位达到建议面试线。',
      topCandidate: '张三',
      recommendation: '张三技能匹配度较高，建议优先面试；王五可进入人才储备。'
    }
  }
]

async function main() {
  const existing = await listWorkflows()

  for (const demo of demos) {
    const matched = existing.find((item) => item.name === demo.graph.name)
    const workflowId = matched?.id ?? await createWorkflowWithGraph(demo.graph)
    const runs = await listWorkflowRuns(Number(workflowId))
    if (!runs.length) {
      const runId = await createWorkflowRun(Number(workflowId), demo.input)
      await updateWorkflowRunSuccess(runId, demo.output, 1280)
    }
  }

  console.log('Workflow demo data seeded')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await getPool().end()
  })

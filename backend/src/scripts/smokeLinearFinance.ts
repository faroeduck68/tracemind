/**
 * 线性财报 Workflow 冒烟测试（不依赖 MySQL / 不注册 Hooks）。
 * 运行：npx tsx src/scripts/smokeLinearFinance.ts
 *
 * 验证任务书链路：generate -> validate -> topologicalSort -> 按 edges 执行工具
 * -> Context 传递上游输出 -> 记录 trace -> 失败分析。
 */
import { createWorkflowContext, getNodeInput, setNodeOutput } from '../services/context.service'
import { analyzeFailure } from '../services/failureAnalysis.service'
import { generateWorkflowFromQuery } from '../services/workflowGenerator.service'
import { validateWorkflow } from '../services/workflowValidator.service'
import { toolRegistry } from '../tools'
import { WorkflowContext } from '../types/context'
import { WorkflowGraph, WorkflowNode } from '../types/workflow'
import { summarize } from '../utils/summarize'
import { topologicalSort } from '../utils/topologicalSort'

type TraceEntry = {
  nodeId: string
  stepName: string
  tool: string
  status: string
  latencyMs: number
  inputSummary?: string
  outputSummary?: string
  errorMessage?: string
}

async function runGraph(graph: WorkflowGraph, context: WorkflowContext, disabledTools: Set<string> = new Set()) {
  const trace: TraceEntry[] = []
  const ordered = topologicalSort(graph.nodes, graph.edges)

  for (const node of ordered) {
    const startedAt = Date.now()
    context.currentNodeId = node.id
    const input = getNodeInput(node, graph.edges, context)
    context.nodeInputs[node.id] = input

    try {
      if (disabledTools.has(node.tool)) {
        throw new Error(`工具已禁用：${node.tool}`)
      }
      const tool = toolRegistry[node.tool as keyof typeof toolRegistry]
      if (!tool) throw new Error(`工具不存在：${node.tool}`)

      const result = await tool.run(context)
      if (!result.success) throw new Error(result.message ?? `${node.tool} 执行失败`)

      setNodeOutput(node.id, result.output, context)
      trace.push({
        nodeId: node.id,
        stepName: node.label,
        tool: node.tool,
        status: 'success',
        latencyMs: Date.now() - startedAt,
        inputSummary: summarize(input),
        outputSummary: summarize(result.output)
      })
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      const failure = analyzeFailure(normalized, node, graph.edges)
      trace.push({
        nodeId: node.id,
        stepName: node.label,
        tool: node.tool,
        status: 'failed',
        latencyMs: Date.now() - startedAt,
        inputSummary: summarize(input),
        errorMessage: normalized.message
      })
      return { status: 'failed' as const, trace, failure }
    }
  }

  return { status: 'success' as const, trace, output: context.finalResult }
}

function printTrace(trace: TraceEntry[]) {
  for (const step of trace) {
    const icon = step.status === 'success' ? '✅' : '❌'
    console.log(`  ${icon} [${step.nodeId}] ${step.stepName} (${step.tool}) ${step.latencyMs}ms`)
    if (step.outputSummary) console.log(`       out: ${step.outputSummary}`)
    if (step.errorMessage) console.log(`       err: ${step.errorMessage}`)
  }
}

async function main() {
  const query = '帮我分析这份财报，并总结主要风险，生成 Word 报告'
  console.log('=== 1. 生成 Workflow ===')
  const graph = await generateWorkflowFromQuery(query)
  console.log(`意图: ${graph.intent}  节点数: ${graph.nodes.length}  连线数: ${graph.edges.length}`)
  console.log(`节点顺序: ${topologicalSort(graph.nodes, graph.edges).map((n: WorkflowNode) => n.id).join(' → ')}`)

  console.log('\n=== 2. 校验 Workflow ===')
  const validation = validateWorkflow(graph.nodes, graph.edges)
  console.log(`valid=${validation.valid} errors=${JSON.stringify(validation.errors)} warnings=${JSON.stringify(validation.warnings)}`)
  if (!validation.valid) throw new Error('校验失败，终止')

  console.log('\n=== 3. 正常执行 ===')
  const okContext = createWorkflowContext({ runId: 1, workflowId: 1, query, files: [{ filename: 'demo.pdf' }] })
  const okResult = await runGraph(graph, okContext)
  printTrace(okResult.trace)
  console.log(`最终状态: ${okResult.status}`)
  console.log(`最终输出: ${JSON.stringify(okResult.status === 'success' ? okResult.output : null)}`)

  console.log('\n=== 4. 失败分析（禁用 financial_risk_tool）===')
  const failContext = createWorkflowContext({ runId: 2, workflowId: 1, query, files: [{ filename: 'demo.pdf' }] })
  const failResult = await runGraph(graph, failContext, new Set(['financial_risk_tool']))
  printTrace(failResult.trace)
  if (failResult.status === 'failed') {
    console.log(`失败节点: ${failResult.failure.failedNode}`)
    console.log(`失败原因: ${failResult.failure.reason}`)
    console.log(`影响节点: ${JSON.stringify(failResult.failure.affectedNodes)}`)
    console.log(`修复建议: ${JSON.stringify(failResult.failure.suggestions)}`)
  }

  console.log('\n✅ 冒烟测试通过')
}

main().catch((error) => {
  console.error('❌ 冒烟测试失败:', error)
  process.exit(1)
})

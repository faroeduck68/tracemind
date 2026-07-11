import '../config/env'
import webSearchTool from '../tools/webSearch.tool'

async function main() {
  const query = process.argv.slice(2).join(' ').trim() || '今天美元兑人民币汇率'
  const context = {
    runId: 0,
    workflowId: 0,
    userId: 'acceptance_test',
    query,
    memories: [],
    files: [],
    nodeOutputs: {},
    nodeInputs: { web_search_acceptance_test: { query } },
    currentNodeId: 'web_search_acceptance_test',
    traces: []
  }

  const result = await webSearchTool.run(context)
  if (!result.success) {
    console.error(result.errorMessage ?? 'web_search_tool 测试失败。')
    process.exitCode = 1
    return
  }

  console.log(JSON.stringify(result.output, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

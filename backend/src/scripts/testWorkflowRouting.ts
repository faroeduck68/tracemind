import assert from 'node:assert/strict'
import { generateWorkflowFromQuery } from '../services/workflowGenerator.service'
import { hasExplicitWebSearchIntent, needsRealtimeInformation } from '../services/realtimeIntent.service'

async function main() {
  assert.equal(needsRealtimeInformation('请分析当前的项目报告'), false, '“当前的项目报告”不应触发实时搜索')
  assert.equal(hasExplicitWebSearchIntent('请结合网上行业资料分析'), true)

  const uploadedFile = { filename: 'financial-report.pdf' }
  const fileOnly = await generateWorkflowFromQuery('请分析当前的项目报告', [], { files: [uploadedFile] })
  assert.ok(fileOnly.nodes.some((node) => node.tool === 'pdf_parse_tool'), '上传文件必须生成文件解析节点')
  assert.ok(!fileOnly.nodes.some((node) => node.tool === 'web_search_tool'), '普通文件分析不得调用网页搜索')

  const enriched = await generateWorkflowFromQuery('请结合网上行业资料分析', [], { files: [uploadedFile] })
  const optionalSearch = enriched.nodes.find((node) => node.tool === 'web_search_tool')
  assert.ok(optionalSearch, '明确要求网上资料时应加入网页搜索节点')
  assert.deepEqual(optionalSearch?.config, {
    optional: true,
    skipOnMissingConfig: true,
    tool: 'web_search_tool'
  })
  assert.ok(enriched.nodes.some((node) => node.tool === 'pdf_parse_tool'), '搜索增强不能替代文件解析主链路')

  const weather = await generateWorkflowFromQuery('今天芜湖天气怎么样')
  assert.ok(
    weather.nodes.some((node) => node.tool === 'weather_query_tool' || node.tool === 'web_search_tool'),
    '天气查询必须使用天气工具或网页搜索回退'
  )

  const news = await generateWorkflowFromQuery('最近 AI Agent 有什么新闻')
  assert.ok(news.nodes.some((node) => node.tool === 'web_search_tool'), '无文件实时新闻必须走网页搜索工作流')

  console.log('workflow routing regression tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

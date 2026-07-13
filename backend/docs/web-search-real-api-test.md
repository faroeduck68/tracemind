# web_search_tool 真实搜索验收

## 1. 配置搜索服务

在 `backend/.env` 中设置 `WEB_SEARCH_PROVIDER`，可选值为：

```env
WEB_SEARCH_PROVIDER=tavily
```

只需配置任意一家搜索服务的 Key：

| Provider | 必需环境变量 | 申请地址 |
| --- | --- | --- |
| Tavily | `TAVILY_API_KEY` | https://tavily.com/ |
| Brave Search | `BRAVE_SEARCH_API_KEY` | https://brave.com/search/api/ |
| SerpAPI | `SERPAPI_API_KEY` | https://serpapi.com/ |
| Bing Web Search | `BING_SEARCH_API_KEY` | Azure Bing Search 资源 |
| 阿里云 OpenSearch | `ALIYUN_OPENSEARCH_API_KEY`、`ALIYUN_OPENSEARCH_ENDPOINT`、`ALIYUN_OPENSEARCH_WORKSPACE` | 阿里云 AI Search Open Platform |

完整示例：

```env
WEB_SEARCH_PROVIDER=tavily
TAVILY_API_KEY=tvly-your-key

WEB_SEARCH_MAX_RESULTS=5
WEB_SEARCH_MAX_RESULT_LENGTH=1200
WEB_SEARCH_MAX_TOTAL_LENGTH=6000
WEB_SEARCH_TIMEOUT_MS=12000
```

阿里云 OpenSearch 示例：

```env
WEB_SEARCH_PROVIDER=aliyun
ALIYUN_OPENSEARCH_API_KEY=OS-your-key
ALIYUN_OPENSEARCH_ENDPOINT=https://your-public-endpoint
ALIYUN_OPENSEARCH_WORKSPACE=default
```

`ALIYUN_OPENSEARCH_ENDPOINT` 可以填写阿里云控制台复制的 Public API Endpoint。如果你已经复制了完整接口地址，也可以直接填完整的 `/v3/openapi/workspaces/.../web-search/ops-web-search-001` 地址。

`WEB_SEARCH_PROVIDER` 指定的服务会优先调用。如果该服务请求失败，并且其他服务也配置了 Key，工具会依次尝试其他服务，此时输出中的 `fallback` 为 `true`。

如果没有配置任何搜索服务，接口返回：

```text
web_search_tool 未配置搜索服务，请在后端 .env 中配置 Tavily/Brave/SerpAPI/Bing/阿里云 OpenSearch 任一搜索服务。
```

## 2. npm 直接验收

该方式直接运行真实工具，不要求启动 HTTP 服务：

```bash
cd backend
npm run test:web-search -- "今天美元兑人民币汇率"
```

成功输出应包含：

```json
{
  "query": "今天美元兑人民币汇率",
  "results": [
    { "title": "示例来源", "url": "https://example.com/rate", "content": "搜索摘要" }
  ],
  "sources": [
    { "title": "示例来源", "url": "https://example.com/rate" }
  ],
  "provider": "tavily",
  "resultCount": 1,
  "fallback": false
}
```

## 3. HTTP 接口验收

启动后端：

```bash
npm run dev
```

macOS/Linux/Git Bash：

```bash
curl -X POST http://localhost:4000/api/tools/web-search/test \
  -H "Content-Type: application/json" \
  -d '{"query":"今天美元兑人民币汇率"}'
```

Windows PowerShell：

```powershell
$body = @{ query = '今天美元兑人民币汇率' } | ConvertTo-Json
Invoke-RestMethod `
  -Uri 'http://localhost:4000/api/tools/web-search/test' `
  -Method Post `
  -ContentType 'application/json; charset=utf-8' `
  -Body $body
```

TraceMind 使用统一响应结构，搜索结果位于 `data`：

```json
{
  "code": 200,
  "message": "web_search_tool 测试成功",
  "data": {
    "results": [
      { "title": "示例来源", "url": "https://example.com/rate", "content": "搜索摘要" }
    ],
    "sources": [
      { "title": "示例来源", "url": "https://example.com/rate" }
    ],
    "provider": "tavily",
    "resultCount": 1,
    "fallback": false,
    "latencyMs": 820
  }
}
```

## 4. 验收检查项

- `results` 包含标题、URL 和受长度限制的摘要。
- `sources` 只包含来源标题和 HTTP/HTTPS 链接。
- `provider` 与实际成功调用的服务一致。
- `fallback` 表示是否从首选服务切换到其他已配置服务。
- API Key 不出现在响应、聊天 metadata 或 Trace 中。
- `web_search_tool` 只调用外部搜索 API，不读取 `knowledge_chunks`。
- `knowledge_search_tool` 只查询本地知识库，不调用外部搜索 API。

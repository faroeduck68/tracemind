# TraceMind Architecture

TraceMind is organized as a semester-project MVP around one main loop:

```text
User request -> Workflow generation -> DAG execution -> Tool calls -> Trace -> Explainable result
```

## Frontend

The frontend is a Vue/Vite dashboard. Its pages are organized by product area:

- `HomeAgentPage.vue`: main conversation and task entry.
- `WorkflowPage.vue`: workflow canvas, node inspector, execution trace, and node toolbox.
- `ToolsPage.vue`: builtin tools, HTTP tools, LLM tools, MCP servers, and user secrets.
- `KnowledgePage.vue`: knowledge bases, imported documents, and retrieval results.
- `MemoryPage.vue`, `TemplatesPage.vue`, `AgentsPage.vue`, `SettingsPage.vue`: supporting pages for the demo system.

Shared UI behavior is gradually moving out of `App.vue`:

- `src/composables/usePageNavigation.ts`: hash-based page navigation.
- `src/composables/useToast.ts`: global toast message state.
- `src/composables/usePagination.ts`: shared page state, page-size changes, and boundary correction.
- `src/components/PaginationBar.vue`: reusable full and compact pagination controls.
- `src/utils/formatters.ts`: time, latency, date, and file-size display helpers.

For the current MVP, `App.vue` is still the main integration layer. Future cleanup should continue by moving workflow, chat, tool, and knowledge state into dedicated composables.

## Backend

The backend uses a conventional Express/TypeScript structure:

- `routes/`: HTTP route definitions.
- `controllers/`: request parsing and response formatting.
- `services/`: application logic and workflow orchestration.
- `models/`: database access.
- `tools/`: executable tool implementations.
- `hooks/`: explainability and lifecycle extension points.

The core workflow path is:

```text
workflow.controller
  -> workflow.service
  -> workflowGenerator.service
  -> workflowExecutor.service
  -> toolRunner.service
  -> trace / run output / failure analysis
```

Important service responsibilities:

- `workflowGenerator.service.ts`: selects or builds a workflow from natural language input.
- `workflowExecutor.service.ts`: validates and executes the workflow DAG.
- `runOutputBuilder.service.ts`: converts node outputs into a frontend-friendly final result.
- `toolRunner.service.ts`: dispatches builtin, HTTP, LLM, and MCP tools through one interface.
- `context.service.ts`: passes query, files, upstream outputs, and node state through the workflow.
- `trace.service.ts`: reads run details and replay data for the frontend.

This structure is intentionally lightweight: it is enough to demonstrate explainable AI workflow orchestration without introducing production-grade infrastructure.

## Pagination

Major list endpoints accept optional `page` and `pageSize` query parameters. When either parameter is present, the response data is:

```json
{
  "list": [],
  "total": 0,
  "page": 1,
  "pageSize": 10,
  "totalPages": 1
}
```

Calls without pagination parameters still return the original array for backward compatibility. The shared backend implementation is in `src/utils/pagination.ts`; the frontend uses one pagination component across knowledge bases, documents, tools, MCP servers, templates, memories, agents, conversations, workflow history, and run history.
